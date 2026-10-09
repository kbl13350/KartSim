package api

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"time"

	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

const (
	maxProfileChars  = 1_000_000
	maxRecordChars   = 4_000_000
	maxCachedRecord  = 256 << 10
	documentCacheTTL = 10 * time.Minute
	ownerKeyCacheTTL = time.Hour
)

var (
	errInvalidOwnerID     = apierr.New(http.StatusBadRequest, "INVALID_OWNER_ID")
	errInvalidRecordID    = apierr.New(http.StatusBadRequest, "INVALID_RECORD_ID")
	errInvalidDocument    = apierr.New(http.StatusBadRequest, "INVALID_DOCUMENT")
	errProfileKeyRequired = apierr.New(http.StatusForbidden, "PROFILE_KEY_REQUIRED")
	errProfileKeyInvalid  = apierr.New(http.StatusForbidden, "PROFILE_KEY_INVALID")
	errProfileNotFound    = apierr.New(http.StatusNotFound, "PROFILE_NOT_FOUND")
)

func profileKey(ownerID string) string          { return "profile:" + ownerID }
func recordKey(ownerID, recordID string) string { return "record:" + ownerID + ":" + recordID }
func ownerKeyKey(ownerID string) string         { return "ownerkey:" + ownerID }

// readDocument reads a JSON body (any JSON value) and returns it compacted,
// plus the first byte that identifies its kind.
func readDocument(w http.ResponseWriter, r *http.Request) (string, byte, error) {
	body, err := readBody(w, r)
	if err != nil {
		return "", 0, err
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, body); err != nil || compact.Len() == 0 {
		return "", 0, errInvalidRequest
	}
	return compact.String(), compact.Bytes()[0], nil
}

// checkDocument is Java requireDocument: an object (or, for records, an
// array) of at most maxChars UTF-16 units in its compact form.
func checkDocument(doc string, kind byte, maxChars int, allowArray bool) error {
	if !(kind == '{' || (allowArray && kind == '[')) || utf16Len(doc) > maxChars {
		return errInvalidDocument
	}
	return nil
}

// profileKeyDigest checks the X-Profile-Key shape and returns its digest.
func profileKeyDigest(r *http.Request) (string, error) {
	key := header(r, "X-Profile-Key")
	if key == nil || !validToken(*key) {
		return "", errProfileKeyRequired
	}
	return digest(*key), nil
}

// ownerKey returns the stored key digest of ownerID through the cache;
// owner keys never change once created.
func (a *API) ownerKey(ctx context.Context, ownerID string) (string, bool, error) {
	if cached, ok := a.cache.Get(ctx, ownerKeyKey(ownerID)); ok {
		return cached, true, nil
	}
	stored, found, err := a.store.OwnerKey(ctx, ownerID)
	if err != nil || !found {
		return "", false, err
	}
	a.cache.Fill(ctx, ownerKeyKey(ownerID), stored, ownerKeyCacheTTL)
	return stored, true, nil
}

// requireReader is Java requireOwner(allowCreate=false).
func (a *API) requireReader(r *http.Request, ownerID string) error {
	keyDigest, err := profileKeyDigest(r)
	if err != nil {
		return err
	}
	stored, found, err := a.ownerKey(r.Context(), ownerID)
	if err != nil {
		return err
	}
	if !found {
		return errProfileNotFound
	}
	if subtle.ConstantTimeCompare([]byte(stored), []byte(keyDigest)) != 1 {
		return errProfileKeyInvalid
	}
	return nil
}

// cachedDocument reads a profile or record through the cache.
func (a *API) cachedDocument(ctx context.Context, key string, load func() (string, bool, error), cacheable func(string) bool) (string, bool, error) {
	if cached, ok := a.cache.Get(ctx, key); ok {
		return cached, true, nil
	}
	doc, found, err := load()
	if err != nil || !found {
		return "", false, err
	}
	if cacheable(doc) {
		a.cache.Fill(ctx, key, doc, documentCacheTTL)
	}
	return doc, true, nil
}

func (a *API) getProfile(w http.ResponseWriter, r *http.Request) error {
	ownerID := r.PathValue("ownerId")
	if !validOwnerID(ownerID) {
		return errInvalidOwnerID
	}
	if err := a.requireReader(r, ownerID); err != nil {
		return err
	}
	doc, found, err := a.cachedDocument(r.Context(), profileKey(ownerID),
		func() (string, bool, error) { return a.store.Profile(r.Context(), ownerID) },
		func(string) bool { return true })
	if err != nil {
		return err
	}
	if !found {
		w.WriteHeader(http.StatusNotFound)
		return nil
	}
	writeRaw(w, http.StatusOK, []byte(doc))
	return nil
}

func (a *API) putProfile(w http.ResponseWriter, r *http.Request) error {
	doc, kind, err := readDocument(w, r)
	if err != nil {
		return err
	}
	ownerID := r.PathValue("ownerId")
	if !validOwnerID(ownerID) {
		return errInvalidOwnerID
	}
	if err := checkDocument(doc, kind, maxProfileChars, false); err != nil {
		return err
	}
	if err := a.saveDocument(r, ownerID, "", doc, profileKey(ownerID), true); err != nil {
		return err
	}
	writeRaw(w, http.StatusOK, []byte(doc))
	return nil
}

// recordItem is one entry of the record list (Java listRecords).
type recordItem struct {
	RecordID  string          `json:"recordId"`
	Record    json.RawMessage `json:"record"`
	UpdatedAt int64           `json:"updatedAt"`
}

// listRecords writes the owner's records, newest first, one document at a
// time: memory stays bounded by the largest record however much the owner
// stored, and no MySQL connection waits for a slow client. A failure after
// the first byte can only abort the response.
func (a *API) listRecords(w http.ResponseWriter, r *http.Request) error {
	ownerID := r.PathValue("ownerId")
	if !validOwnerID(ownerID) {
		return errInvalidOwnerID
	}
	if err := a.requireReader(r, ownerID); err != nil {
		return err
	}
	ctx := r.Context()
	index, err := a.store.RecordIndex(ctx, ownerID)
	if err != nil {
		return err
	}
	started := false
	for _, info := range index {
		row, found, err := a.store.RecordRow(ctx, ownerID, info.RecordID)
		var item []byte
		if err == nil && found {
			item, err = marshalJSON(recordItem{RecordID: row.RecordID, Record: json.RawMessage(row.JSON), UpdatedAt: row.UpdatedAt})
		}
		if err != nil {
			if !started {
				return err
			}
			a.log.Warn("record list aborted", "owner", ownerID, "error", err)
			panic(http.ErrAbortHandler)
		}
		if !found {
			continue // records are never deleted, but a missing one is simply left out
		}
		separator := []byte{','}
		if !started {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			separator[0] = '['
			started = true
		}
		if _, err := w.Write(separator); err != nil {
			panic(http.ErrAbortHandler) // the client went away
		}
		if _, err := w.Write(item); err != nil {
			panic(http.ErrAbortHandler)
		}
	}
	if !started {
		writeRaw(w, http.StatusOK, []byte("[]"))
		return nil
	}
	_, _ = w.Write([]byte{']'})
	return nil
}

func (a *API) getRecord(w http.ResponseWriter, r *http.Request) error {
	ownerID, recordID := r.PathValue("ownerId"), r.PathValue("recordId")
	if !validOwnerID(ownerID) {
		return errInvalidOwnerID
	}
	if !validRecordID(recordID) {
		return errInvalidRecordID
	}
	if err := a.requireReader(r, ownerID); err != nil {
		return err
	}
	doc, found, err := a.cachedDocument(r.Context(), recordKey(ownerID, recordID),
		func() (string, bool, error) { return a.store.Record(r.Context(), ownerID, recordID) },
		func(doc string) bool { return len(doc) <= maxCachedRecord })
	if err != nil {
		return err
	}
	if !found {
		w.WriteHeader(http.StatusNotFound)
		return nil
	}
	writeRaw(w, http.StatusOK, []byte(doc))
	return nil
}

func (a *API) putRecord(w http.ResponseWriter, r *http.Request) error {
	doc, kind, err := readDocument(w, r)
	if err != nil {
		return err
	}
	ownerID, recordID := r.PathValue("ownerId"), r.PathValue("recordId")
	if !validOwnerID(ownerID) {
		return errInvalidOwnerID
	}
	if !validRecordID(recordID) {
		return errInvalidRecordID
	}
	if err := checkDocument(doc, kind, maxRecordChars, true); err != nil {
		return err
	}
	if err := a.saveDocument(r, ownerID, recordID, doc, recordKey(ownerID, recordID), len(doc) <= maxCachedRecord); err != nil {
		return err
	}
	writeRaw(w, http.StatusOK, []byte(doc))
	return nil
}

// saveDocument is Java requireOwner(allowCreate=true) plus the upsert. The
// cache is written while the row lock is held (see package cache); a record
// too large to cache is invalidated instead.
func (a *API) saveDocument(r *http.Request, ownerID, recordID, doc, cacheKey string, cacheable bool) error {
	ctx := r.Context()
	keyDigest, err := profileKeyDigest(r)
	if err != nil {
		return err
	}
	verified := false
	if cached, ok := a.cache.Get(ctx, ownerKeyKey(ownerID)); ok {
		if subtle.ConstantTimeCompare([]byte(cached), []byte(keyDigest)) != 1 {
			return errProfileKeyInvalid
		}
		verified = true
	}
	written := false
	err = a.store.SaveDocument(ctx, store.DocumentWrite{
		OwnerID:     ownerID,
		RecordID:    recordID,
		KeyDigest:   keyDigest,
		KeyVerified: verified,
		JSON:        doc,
		Now:         a.nowMillis(),
		Written: func() {
			written = true
			if cacheable {
				a.cache.Put(ctx, cacheKey, doc, documentCacheTTL)
			} else {
				a.cache.Invalidate(ctx, cacheKey)
			}
		},
	})
	if err != nil {
		if written {
			// The cache may hold a value whose transaction did not commit.
			a.cache.Invalidate(ctx, cacheKey)
		}
		return err
	}
	a.cache.Fill(ctx, ownerKeyKey(ownerID), keyDigest, ownerKeyCacheTTL)
	return nil
}
