package api

import (
	"context"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/datatest"
	"kartsim/internal/shared/contract"
)

// claimBanHook commits a ban right before the claim script runs once
// armed: the ban lands between presenceClaim's first check and its claim.
type claimBanHook struct {
	armed atomic.Bool
	ban   func()
}

func (k *claimBanHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (k *claimBanHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (k *claimBanHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		name := strings.ToLower(cmd.Name())
		if args := cmd.Args(); (name == "evalsha" || name == "eval") && len(args) > 3 {
			if key, ok := args[3].(string); ok && strings.Contains(key, ":presence:") && k.armed.CompareAndSwap(true, false) {
				k.ban()
			}
		}
		return next(ctx, cmd)
	}
}

// A ban committed between the claim's ban check and the claim itself is
// caught by the check after the claim, which releases it.
func TestPresenceClaimRechecksTheBan(t *testing.T) {
	hook := &claimBanHook{}
	h := newAdminHarness(t, harnessOptions{redisHook: hook})
	u := h.u
	id := h.account("racing_"+u, "竞态"+u, password, false)
	hook.ban = func() {
		datatest.Exec(t, h.db, "UPDATE accounts SET banned_until = ?, ban_reason = '外挂' WHERE id = ?",
			time.Now().Add(time.Hour).UnixMilli(), id)
	}
	node := "node-r-" + u
	h.heartbeat(node, "竞态", "", 10)
	hook.armed.Store(true)
	refused := h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: node, PlayerID: "pr",
		Name: "竞态" + u, AccountID: id}).expect(t, http.StatusForbidden, "ACCOUNT_BANNED")
	var body struct{ Reason string }
	refused.json(t, &body)
	if body.Reason != "外挂" || hook.armed.Load() {
		t.Fatalf("refusal %s (hook armed %v)", refused.body, hook.armed.Load())
	}
	for _, key := range h.redis.Keys() {
		if strings.Contains(key, "presence:") || strings.Contains(key, "presence-account:") {
			t.Fatalf("the banned account's claim was kept: %s", key)
		}
	}
}
