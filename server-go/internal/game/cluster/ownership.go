package cluster

import (
	"context"
	"encoding/json"
	"time"

	"kartsim/internal/game/itemmode"
	"kartsim/internal/game/lobby"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
)

// Ownership checks with the data service that an account owns the items of
// an equipment document (contract.PathEquipmentVerify). It implements
// lobby.Ownership.
type Ownership struct {
	data    *DataClient
	timeout time.Duration
}

var _ lobby.Ownership = (*Ownership)(nil)

// NewOwnership returns a checker that gives each call 5 seconds.
func NewOwnership(data *DataClient) *Ownership {
	return &Ownership{data: data, timeout: 5 * time.Second}
}

// VerifyEquipment returns Owned=true when the data service confirms every
// item, with ValidUntil set from the earliest rental expiry it reports;
// Owned=false when it answers ITEM_NOT_OWNED (or a 200 without ok); and an
// error for anything else: a network failure, a timeout, or another status,
// which the lobby reports as 503 DATA_SERVICE_UNAVAILABLE.
func (o *Ownership) VerifyEquipment(ctx context.Context, accountID string, equipment json.RawMessage) (lobby.OwnershipAnswer, error) {
	ctx, cancel := context.WithTimeout(ctx, o.timeout)
	defer cancel()
	var resp contract.EquipmentVerifyResponse
	err := o.data.Call(ctx, contract.PathEquipmentVerify,
		contract.EquipmentVerifyRequest{AccountID: accountID, Equipment: equipment}, &resp)
	if err == nil {
		answer := lobby.OwnershipAnswer{Owned: resp.OK}
		if resp.ValidUntil != nil {
			answer.ValidUntil = time.UnixMilli(*resp.ValidUntil)
		}
		if resp.Changers != nil {
			// -1 (a voucher) is itemmode.Infinite; nothing below it.
			answer.Changers = &itemmode.Changers{Slot: max(resp.Changers.Slot, itemmode.Infinite),
				Item: max(resp.Changers.Item, itemmode.Infinite)}
		}
		return answer, nil
	}
	if rejected, ok := apierr.As(err); ok && rejected.Code == "ITEM_NOT_OWNED" {
		return lobby.OwnershipAnswer{}, nil
	}
	return lobby.OwnershipAnswer{}, err
}
