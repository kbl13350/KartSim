package api

import (
	"net/http"
	"net/netip"
	"net/url"
	"testing"
	"time"
)

// Requests that succeed with a session token note the account's last
// activity, at most every 5 minutes; the first one of a Beijing day with a
// remembered token is a "resume" login record, counted among the day's
// logins (ADMIN.md 5).
func TestAdminActivityAndResumedSessions(t *testing.T) {
	// A day far from the other tests' records, at 20:00 Beijing time.
	clock := newFakeClock(time.Date(2031, 3, 1, 20, 0, 0, 0, beijing))
	h := newAdminHarness(t, harnessOptions{now: clock.now})
	u := h.u
	address := func(n string) string {
		return netip.MustParseAddr("2001:db8:" + u[:4] + "::" + n).String()
	}
	from := func(ip string) map[string]string {
		return map[string]string{"X-Forwarded-For": ip, "User-Agent": "Agent/" + u}
	}
	withToken := func(token, ip string) map[string]string {
		headers := from(ip)
		headers["Authorization"] = "Bearer " + token
		return headers
	}
	var registered struct{ Token string }
	h.post("/multiplayer/auth/register", map[string]string{"username": "seen_" + u, "nickname": "活跃" + u,
		"password": password}, from(address("1"))).expect(t, http.StatusOK, "").json(t, &registered)
	id := h.accountID("seen_" + u)
	token := registered.Token
	row := func() accountRowBody {
		t.Helper()
		var detail struct{ Account accountRowBody }
		h.adminGet("/api/admin/accounts/"+id, &detail)
		return detail.Account
	}
	// Registering counts as activity.
	if got := row(); got.LastSeenAt == nil || *got.LastSeenAt != clock.millis() || got.LastSeenIP != address("1") {
		t.Fatalf("registered %+v", got)
	}

	// The first token request writes; the next ones within 5 minutes do not.
	clock.advance(time.Minute)
	h.get("/api/account", withToken(token, address("2"))).expect(t, http.StatusOK, "")
	seenAt := clock.millis()
	clock.advance(time.Minute)
	h.get("/api/account", withToken(token, address("3"))).expect(t, http.StatusOK, "")
	if got := row(); got.LastSeenAt == nil || *got.LastSeenAt != seenAt || got.LastSeenIP != address("2") {
		t.Fatalf("throttled %+v", got)
	}
	// The same day after a login: no resume record.
	if n := h.count("SELECT COUNT(*) FROM login_records WHERE account_id = ? AND kind = 'resume'", id); n != 0 {
		t.Fatalf("%d resume records on the registration day", n)
	}

	// The next day the remembered token resumes: a resume record with the
	// address and browser, at once (the throttle is per day).
	clock.advance(24 * time.Hour)
	h.get("/api/account", withToken(token, address("4"))).expect(t, http.StatusOK, "")
	resumedAt := clock.millis()
	var logins struct {
		Items []loginRowJSON
		Total int
	}
	h.adminGet("/api/admin/logins?kind=resume&account="+id, &logins)
	if logins.Total != 1 || logins.Items[0].IP != address("4") || logins.Items[0].UserAgent != "Agent/"+u ||
		logins.Items[0].At != resumedAt || logins.Items[0].Kind != "resume" {
		t.Fatalf("resume records %+v", logins)
	}
	h.get("/api/account", withToken(token, address("5"))).expect(t, http.StatusOK, "")
	clock.advance(6 * time.Minute)
	h.redis.FastForward(6 * time.Minute)
	h.get("/api/account", withToken(token, address("6"))).expect(t, http.StatusOK, "")
	if got := row(); got.LastSeenAt == nil || *got.LastSeenAt != clock.millis() || got.LastSeenIP != address("6") ||
		got.LastLoginAt == nil || *got.LastLoginAt != got.CreatedAt {
		t.Fatalf("after the window %+v", got)
	}
	h.adminGet("/api/admin/logins?account="+id, &logins)
	if logins.Total != 2 { // the registration and one resume
		t.Fatalf("records %+v", logins)
	}
	var overview struct {
		Logins struct{ Today, UniqueToday int }
	}
	h.adminGet("/api/admin/overview", &overview)
	if overview.Logins.UniqueToday < 1 {
		t.Fatalf("overview %+v", overview)
	}

	// The list sorts by and searches the activity.
	var list accountListBody
	h.adminGet("/api/admin/accounts?sort=lastSeenAt&q="+url.QueryEscape(address("6")), &list)
	if list.Total != 1 || list.Items[0].ID != id {
		t.Fatalf("by activity address %+v", list)
	}

	// A refused request is no activity, even with a valid token.
	clock.advance(24 * time.Hour)
	h.post("/api/account/starter", map[string]int{"character": -1}, withToken(token, address("7"))).
		expect(t, http.StatusBadRequest, "")
	h.get("/api/admin/me", withToken(token, address("7"))).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	if got := row(); got.LastSeenIP != address("6") {
		t.Fatalf("refused requests counted %+v", got)
	}

	// Without Redis the throttle is kept in the process.
	h.redis.SetError("ERR down")
	t.Cleanup(func() { h.redis.SetError("") })
	h.get("/api/account", withToken(token, address("8"))).expect(t, http.StatusOK, "")
	h.get("/api/account", withToken(token, address("9"))).expect(t, http.StatusOK, "")
	if got := row(); got.LastSeenIP != address("8") {
		t.Fatalf("without Redis %+v", got)
	}
	h.adminGet("/api/admin/logins?kind=resume&account="+id, &logins)
	if logins.Total != 2 {
		t.Fatalf("resume records %+v", logins)
	}
}
