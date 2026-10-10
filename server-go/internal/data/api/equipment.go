package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
)

// Equipment documents are the client's LocalProfile.equipment, which the
// game nodes also receive at hello/create/join/equipment:
//
//	{"itemIds": {"1": 2, "2": 6, "3": 0, ...35 slots}, "kartSerial": 0,
//	 "exceedType": 0, "valueAt3E": 0, "systemKart": "practiceKart"}
//
// A slot number is the item category it holds. Ownership is checked for the
// slots whose category the shop sells (economy.Kinds) and for system karts
// (slot 3 with item 0, named by systemKart). Other slots hold the garage's
// free parts and coatings and are not checked.

// equipmentSlots are the slots of a complete equipment document, as the
// game node's lobby validates it (internal/game/lobby/equipment.go).
var equipmentSlots = []int{1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
	32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78}

const maxSlotItemID = 65535

var (
	errInvalidEquipment = apierr.New(http.StatusBadRequest, "INVALID_EQUIPMENT")
	errInvalidAccountID = apierr.New(http.StatusBadRequest, "INVALID_ACCOUNT_ID")
	errNotEquipment     = errors.New("not an equipment document")
)

// equippedItem is one non-empty slot of an equipment document.
type equippedItem struct {
	Slot      int
	ItemID    int
	SystemKey string // the systemKart of slot 3 when ItemID is 0
}

// equipmentDoc is a parsed equipment document that keeps unknown fields.
type equipmentDoc struct {
	fields  map[string]json.RawMessage
	itemIDs map[string]json.RawMessage
}

func parseEquipment(raw json.RawMessage) (equipmentDoc, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || raw[0] != '{' {
		return equipmentDoc{}, errNotEquipment
	}
	var doc equipmentDoc
	if json.Unmarshal(raw, &doc.fields) != nil {
		return equipmentDoc{}, errNotEquipment
	}
	ids := bytes.TrimSpace(doc.fields["itemIds"])
	if len(ids) == 0 || ids[0] != '{' || json.Unmarshal(ids, &doc.itemIDs) != nil {
		return equipmentDoc{}, errNotEquipment
	}
	return doc, nil
}

// items lists the non-empty slots (and an empty slot 3, which names a
// system kart) in slot order.
func (d equipmentDoc) items() ([]equippedItem, error) {
	items := make([]equippedItem, 0, len(d.itemIDs))
	for key, value := range d.itemIDs {
		slot, err := strconv.Atoi(key)
		if err != nil || strconv.Itoa(slot) != key || slot <= 0 || slot > 1000 {
			return nil, errNotEquipment
		}
		var itemID int
		if err := json.Unmarshal(value, &itemID); err != nil || itemID < 0 || itemID > maxSlotItemID {
			return nil, errNotEquipment
		}
		if itemID == 0 && slot != economy.CategoryKart {
			continue
		}
		item := equippedItem{Slot: slot, ItemID: itemID}
		if slot == economy.CategoryKart && itemID == 0 {
			var key string
			if raw, ok := d.fields["systemKart"]; ok && json.Unmarshal(raw, &key) != nil {
				return nil, errNotEquipment
			}
			item.SystemKey = key
		}
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b equippedItem) int { return a.Slot - b.Slot })
	return items, nil
}

// ownershipRef is the inventory item a slot needs, if it is checked.
func ownershipRef(item equippedItem) (store.ItemRef, bool) {
	if item.Slot == economy.CategoryKart && item.ItemID == 0 {
		return store.ItemRef{Category: economy.CategoryKart, SystemKey: item.SystemKey}, true
	}
	if _, sellable := economy.Kinds[item.Slot]; !sellable || item.ItemID == 0 {
		return store.ItemRef{}, false
	}
	return store.ItemRef{Category: item.Slot, ItemID: item.ItemID}, true
}

// missingItems returns the checked slots whose item the account does not
// own unexpired at the API clock, and validUntil: the earliest expiry
// (Unix ms) among the checked items that are rentals, nil when every owned
// checked item is permanent.
func (a *API) missingItems(ctx context.Context, accountID string, items []equippedItem) (
	missing []contract.EquipmentSlot, validUntil *int64, err error) {
	var refs []store.ItemRef
	for _, item := range items {
		if ref, checked := ownershipRef(item); checked {
			refs = append(refs, ref)
		}
	}
	owned, err := a.store.OwnedAmong(ctx, accountID, refs, a.nowMillis())
	if err != nil {
		return nil, nil, err
	}
	for _, item := range items {
		ref, checked := ownershipRef(item)
		if !checked {
			continue
		}
		ownership, ok := owned[ref]
		if !ok {
			missing = append(missing, contract.EquipmentSlot{Slot: item.Slot, ItemID: item.ItemID})
			continue
		}
		if expires := ownership.ExpiresAt; expires != nil && (validUntil == nil || *expires < *validUntil) {
			until := *expires
			validUntil = &until
		}
	}
	return missing, validUntil, nil
}

// itemNotOwned is the 409 body naming the slots the account does not own.
type itemNotOwned struct {
	Error   string                   `json:"error"`
	OK      bool                     `json:"ok"`
	Missing []contract.EquipmentSlot `json:"missing"`
}

func writeItemNotOwned(w http.ResponseWriter, missing []contract.EquipmentSlot) error {
	return writeJSON(w, http.StatusConflict, itemNotOwned{Error: "ITEM_NOT_OWNED", Missing: missing})
}

// verifyEquipment is the game nodes' ownership check (contract
// PathEquipmentVerify): 200 {ok:true, validUntil?, changers}, or 409
// ITEM_NOT_OWNED with the slots in missing. validUntil is the earliest
// expiry of the rented items checked; a node must not trust the answer
// after it. changers are the account's item changer cards. An unknown
// account owns nothing.
func (a *API) verifyEquipment(w http.ResponseWriter, r *http.Request) error {
	var request contract.EquipmentVerifyRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validASCIIID(request.AccountID, 36) {
		return errInvalidAccountID
	}
	doc, err := parseEquipment(request.Equipment)
	if err != nil {
		return errInvalidEquipment
	}
	items, err := doc.items()
	if err != nil {
		return errInvalidEquipment
	}
	missing, validUntil, err := a.missingItems(r.Context(), request.AccountID, items)
	if err != nil {
		return err
	}
	if len(missing) > 0 {
		return writeItemNotOwned(w, missing)
	}
	// The item changer cards an item race starting now gives the racer
	// (rewrite/ITEM_MODE.md C.6).
	cards, err := a.store.Changers(r.Context(), request.AccountID, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, contract.EquipmentVerifyResponse{OK: true, ValidUntil: validUntil,
		Changers: &contract.Changers{Slot: cards.Slot, Item: cards.Item, SlotUntil: cards.SlotUntil,
			ItemUntil: cards.ItemUntil}})
}

// starterFallback is what replaces equipment the account no longer owns
// (ECONOMY.md 4.3): the starter kart, the starter character, paint and dye.
type starterFallback struct {
	KartKey   string
	Character int
	Paint     int
	Dye       int
}

// fallbackFor returns the account's claimed starter picks, or the catalog
// defaults before the gift was claimed.
func (a *API) fallbackFor(ctx context.Context, accountID string) (starterFallback, error) {
	starter := a.economy.Catalog.Starter
	fallback := starterFallback{KartKey: starter.Kart.SystemKey, Character: starter.DefaultCharacter,
		Paint: starter.DefaultPaint, Dye: starter.DefaultDye}
	choice, found, err := a.store.Onboarding(ctx, accountID)
	if err != nil {
		return starterFallback{}, err
	}
	if found {
		fallback.Character, fallback.Paint, fallback.Dye = choice.Character, choice.Paint, choice.Dye
	}
	return fallback, nil
}

// replace applies the fallback to the missing slots: a kart becomes the
// starter system kart (serial and exceed type reset), the character, paint
// and dye become the starter picks, anything else is unequipped.
func (d equipmentDoc) replace(missing []contract.EquipmentSlot, fallback starterFallback) {
	number := func(value int) json.RawMessage { return json.RawMessage(strconv.Itoa(value)) }
	for _, slot := range missing {
		key := strconv.Itoa(slot.Slot)
		switch slot.Slot {
		case economy.CategoryKart:
			d.itemIDs[key] = number(0)
			kartKey, _ := json.Marshal(fallback.KartKey)
			d.fields["systemKart"] = kartKey
			delete(d.fields, "systemKartVariant")
			d.fields["kartSerial"] = number(0)
			d.fields["exceedType"] = number(0)
		case economy.CategoryCharacter:
			d.itemIDs[key] = number(fallback.Character)
		case economy.CategoryPaint:
			d.itemIDs[key] = number(fallback.Paint)
		case economy.CategoryDye:
			d.itemIDs[key] = number(fallback.Dye)
		default:
			d.itemIDs[key] = number(0)
		}
	}
}

func (d equipmentDoc) marshal() (json.RawMessage, error) {
	ids, err := marshalJSON(d.itemIDs)
	if err != nil {
		return nil, err
	}
	d.fields["itemIds"] = ids
	return marshalJSON(d.fields)
}

// starterEquipment is the complete initial equipment of a new rider: the
// starter kart and the picked character, paint and dye, everything else
// empty. It satisfies the game node's equipment validation.
func starterEquipment(fallback starterFallback) (json.RawMessage, error) {
	ids := make(map[string]int, len(equipmentSlots))
	for _, slot := range equipmentSlots {
		ids[strconv.Itoa(slot)] = 0
	}
	ids[strconv.Itoa(economy.CategoryCharacter)] = fallback.Character
	ids[strconv.Itoa(economy.CategoryPaint)] = fallback.Paint
	ids[strconv.Itoa(economy.CategoryDye)] = fallback.Dye
	return marshalJSON(struct {
		ItemIDs    map[string]int `json:"itemIds"`
		KartSerial int            `json:"kartSerial"`
		ExceedType int            `json:"exceedType"`
		ValueAt3E  int            `json:"valueAt3E"`
		SystemKart string         `json:"systemKart"`
	}{ids, 0, 0, 0, fallback.KartKey})
}
