package api

import (
	"net/http"

	"kartsim/internal/data/license"
	"kartsim/internal/data/store"
)

// 驾照考试 (RIDER_SCHOOL.md): the rider school table, an account's standing,
// cleared steps, taking a license and the PRO qualification.

// licenseTable is the table GET /api/license sends with every standing:
// the licenses and their steps, the PRO qualification and the reward
// stocks' names.
type licenseTable struct {
	Version  string            `json:"version"`
	Licenses []license.License `json:"licenses"`
	Pro      license.ProRules  `json:"pro"`
	Days     int               `json:"proDays"`
	Rewards  map[int]string    `json:"rewards"`
}

func newLicenseTable(data *license.Data) licenseTable {
	table := licenseTable{Version: data.Version, Licenses: data.Licenses, Pro: data.Pro, Days: license.ProDays,
		Rewards: map[int]string{}}
	for id, stock := range data.Stocks {
		table.Rewards[id] = stock.Name
	}
	return table
}

// licensed fills the license fields of a progress object.
func (a *API) licensed(progress progressJSON, level int, proUntil int64) progressJSON {
	progress.License, progress.ProUntil = level, proUntil
	if proUntil > a.nowMillis() {
		progress.License = license.Pro
	}
	return progress
}

// licenseAccount resolves the signed-in account and its tryLevel.
func (a *API) licenseAccount(r *http.Request) (store.Account, int, error) {
	account, err := a.signedIn(r)
	if err != nil {
		return store.Account{}, 0, err
	}
	summary, err := a.summary(r, account)
	if err != nil {
		return store.Account{}, 0, err
	}
	return account, summary.Progress.TryLevel, nil
}

func (a *API) getLicense(w http.ResponseWriter, r *http.Request) error {
	account, tryLevel, err := a.licenseAccount(r)
	if err != nil {
		return err
	}
	view, err := a.store.License(r.Context(), a.license, account.ID, tryLevel, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, struct {
		Table licenseTable      `json:"table"`
		State store.LicenseView `json:"state"`
	}{a.licenseDoc, view})
}

// licenseAnswer is what the license writes answer: the standing and the
// account summary (wallet, progress) after the change.
func (a *API) licenseAnswer(w http.ResponseWriter, r *http.Request, account store.Account, view store.LicenseView,
	fields map[string]any) error {
	summary, err := a.summary(r, account)
	if err != nil {
		return err
	}
	body := map[string]any{"state": view, "account": summary}
	for key, value := range fields {
		body[key] = value
	}
	return writeJSON(w, http.StatusOK, body)
}

func validLicenseTime(elapsedMs int64) bool {
	return elapsedMs >= store.MinLicenseMs && elapsedMs <= store.MaxLicenseMs
}

// runLicenseStep records a cleared step (POST {requestId, step, elapsedMs}).
func (a *API) runLicenseStep(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		RequestID string `json:"requestId"`
		Step      int    `json:"step"`
		ElapsedMs int64  `json:"elapsedMs"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, tryLevel, err := a.licenseAccount(r)
	if err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	if !validLicenseTime(request.ElapsedMs) {
		return errInvalidElapsed
	}
	ctx := r.Context()
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	run, view, err := a.store.RunLicenseStep(ctx, store.LicenseRunRequest{AccountID: account.ID, RequestID: id,
		Step: request.Step, ElapsedMs: request.ElapsedMs, TryLevel: tryLevel, Now: a.nowMillis(),
		Data: a.license, Lottery: a.lottery})
	if err != nil {
		return err
	}
	a.log.Debug("license run", "username", account.Username, "step", run.Step, "first", run.First,
		"best", run.BestMs)
	return a.licenseAnswer(w, r, account, view, map[string]any{"run": run})
}

// takeLicense takes a license once its steps are cleared (POST {level}).
func (a *API) takeLicense(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Level int `json:"level"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, tryLevel, err := a.licenseAccount(r)
	if err != nil {
		return err
	}
	ctx := r.Context()
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	taken, view, err := a.store.TakeLicense(ctx, a.license, account.ID, request.Level, tryLevel, a.nowMillis())
	if err != nil {
		return err
	}
	a.log.Info("license taken", "username", account.Username, "level", request.Level)
	return a.licenseAnswer(w, r, account, view, map[string]any{"license": taken})
}

// qualifyLicense records a PRO qualification time trial
// (POST {requestId, track, elapsedMs}).
func (a *API) qualifyLicense(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		RequestID string `json:"requestId"`
		Track     string `json:"track"`
		ElapsedMs int64  `json:"elapsedMs"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, tryLevel, err := a.licenseAccount(r)
	if err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	if !validLicenseTime(request.ElapsedMs) {
		return errInvalidElapsed
	}
	ctx := r.Context()
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	record, view, err := a.store.RecordLicenseQualify(ctx, store.LicenseQualifyRequest{AccountID: account.ID,
		RequestID: id, Track: request.Track, ElapsedMs: request.ElapsedMs, TryLevel: tryLevel, Now: a.nowMillis(),
		Data: a.license})
	if err != nil {
		return err
	}
	return a.licenseAnswer(w, r, account, view, map[string]any{"record": record})
}

// claimLicenseEmblem grants the PRO qualification emblem (POST {}).
func (a *API) claimLicenseEmblem(w http.ResponseWriter, r *http.Request) error {
	account, tryLevel, err := a.licenseAccount(r)
	if err != nil {
		return err
	}
	ctx := r.Context()
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	granted, view, err := a.store.ClaimProEmblem(ctx, a.license, account.ID, tryLevel, a.nowMillis())
	if err != nil {
		return err
	}
	return a.licenseAnswer(w, r, account, view, map[string]any{"granted": granted, "emblemId": a.license.Pro.EmblemID})
}
