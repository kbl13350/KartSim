package api

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"kartsim/internal/data/config"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/netcfg"
)

const (
	sessionLifetime = 30 * 24 * time.Hour
	sessionCacheTTL = 5 * time.Minute
	accountCacheTTL = 10 * time.Minute
)

var (
	errInvalidHost         = apierr.New(http.StatusBadRequest, "INVALID_HOST")
	errInvalidGuestName    = apierr.New(http.StatusBadRequest, "INVALID_GUEST_NAME")
	errInvalidAccountField = apierr.New(http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	errInvalidInvite       = apierr.New(http.StatusBadRequest, "INVALID_INVITE")
	errInvalidCredentials  = apierr.New(http.StatusUnauthorized, "INVALID_CREDENTIALS")
	errLoginRequired       = apierr.New(http.StatusUnauthorized, "LOGIN_REQUIRED")
	errAdminRequired       = apierr.New(http.StatusForbidden, "ADMIN_REQUIRED")
	errRegistrationClosed  = apierr.New(http.StatusForbidden, "REGISTRATION_CLOSED")

	trailingPort = regexp.MustCompile(`:\d+$`)
)

// publicAccount is Java Account.publicView().
type publicAccount struct {
	Nickname string `json:"nickname"`
	Admin    bool   `json:"admin"`
	Username string `json:"username"`
}

func publicView(account store.Account) publicAccount {
	return publicAccount{Nickname: account.Nickname, Admin: account.Admin, Username: account.Username}
}

type accountBody struct {
	Account publicAccount `json:"account"`
}

func (a *API) health(w http.ResponseWriter, _ *http.Request) error {
	return writeJSON(w, http.StatusOK, struct {
		ProtocolVersion int    `json:"protocolVersion"`
		Ruleset         string `json:"ruleset"`
		Transport       string `json:"transport"`
		Service         string `json:"service"`
		DataNode        string `json:"dataNode"`
	}{contract.ProtocolVersion, contract.Ruleset, "websocket", "data", a.dataNode})
}

// authConfig tells the page which origin serves the data API, and how
// accounts work: a login is always required to play (ECONOMY.md 0), guests
// only when KART_ALLOW_GUESTS is set (multiplayer tickets), and which kind of
// registration is offered.
func (a *API) authConfig(w http.ResponseWriter, r *http.Request) error {
	type config struct {
		LoginRequired bool    `json:"loginRequired"`
		BackendOrigin *string `json:"backendOrigin"`
		Registration  string  `json:"registration"`
		Guests        bool    `json:"guests"`
	}
	answer := config{LoginRequired: true, Registration: a.registration, Guests: a.allowGuests}
	if a.publicOrigin != "" {
		origin := a.publicOrigin
		answer.BackendOrigin = &origin
		return writeJSON(w, http.StatusOK, answer)
	}
	if forwarded := header(r, "X-Forwarded-Host"); forwarded != nil {
		first, _, _ := strings.Cut(*forwarded, ",")
		host := trailingPort.ReplaceAllString(strings.TrimSpace(first), "")
		if !a.network.AllowsHost(host) {
			return errInvalidHost
		}
		// Reached through the page's dev-server proxy: the backend is the page origin.
		return writeJSON(w, http.StatusOK, answer)
	}
	host := netcfg.RequestHost(r)
	if !a.network.AllowsHost(host) {
		return errInvalidHost
	}
	// JoinHostPort brackets IPv6 literals, as Java's getServerName() kept them.
	origin := "http://" + net.JoinHostPort(strings.ToLower(host), strconv.Itoa(localPort(r)))
	answer.BackendOrigin = &origin
	return writeJSON(w, http.StatusOK, answer)
}

// localPort is the port the connection was accepted on (Java getLocalPort).
func localPort(r *http.Request) int {
	if addr, ok := r.Context().Value(http.LocalAddrContextKey).(net.Addr); ok {
		if tcp, ok := addr.(*net.TCPAddr); ok {
			return tcp.Port
		}
		if _, port, err := net.SplitHostPort(addr.String()); err == nil {
			if value, err := strconv.Atoi(port); err == nil {
				return value
			}
		}
	}
	return 0
}

// guestName reports whether a guest may use a name: valid, not an account
// nickname and not live on any game node.
func (a *API) guestName(w http.ResponseWriter, r *http.Request) error {
	fields, err := stringFields(w, r)
	if err != nil {
		return err
	}
	name := fields["name"]
	if !validName(name, 18) {
		return errInvalidGuestName
	}
	available := false
	taken, err := a.store.NicknameTaken(r.Context(), *name)
	if err != nil {
		return err
	}
	if !taken {
		online, err := a.cluster.NameOnline(r.Context(), *name)
		if err != nil {
			a.log.Warn("guest name presence lookup failed", "error", err)
			return errServiceUnavailable
		}
		available = !online
	}
	return writeJSON(w, http.StatusOK, map[string]bool{"available": available})
}

// Password length in UTF-16 units (ECONOMY.md 6).
const (
	minPasswordLength = 8
	maxPasswordLength = 128
)

// register creates an account and logs it in ({account, token}). Open
// registration needs no invite (one that is given must be valid and is
// consumed), invite mode requires one, closed mode refuses. A username
// listed in KART_ADMIN_USERNAMES always needs a valid invite (400
// INVALID_INVITE otherwise): the account is an admin at once, so the name
// must not be free for anybody to take (Bootstrap logs an invite for it).
// Registrations are rate limited per client IP, per IPv6 /56 and, once the
// precheck passed, globally; they fail closed without Redis. The password is
// hashed before any lock is taken; cheap checks run first so a doomed
// request costs no hash.
func (a *API) register(w http.ResponseWriter, r *http.Request) error {
	if a.registration == config.RegistrationClosed {
		return errRegistrationClosed
	}
	fields, err := stringFields(w, r)
	if err != nil {
		return err
	}
	username, nickname, password, invite := fields["username"], fields["nickname"], fields["password"], fields["invite"]
	if !validUsername(username) || !validName(nickname, 16) || password == nil ||
		utf16Len(*password) < minPasswordLength || utf16Len(*password) > maxPasswordLength {
		return errInvalidAccountField
	}
	inviteMode := a.registration == config.RegistrationInvite
	if !inviteMode && invite != nil && *invite == "" {
		invite = nil // an empty invite field of an open registration form
	}
	adminName := a.admins[strings.ToLower(*username)]
	if ((inviteMode || adminName) && invite == nil) || (invite != nil && utf16Len(*invite) > 128) {
		return errInvalidInvite
	}
	ctx := r.Context()
	client := a.clientIP(r)
	if err := a.hit(ctx, "register-ip:"+ipKey(client), a.limits.RegisterPerIP, a.limits.RegisterPerIPWindow, true); err != nil {
		return err
	}
	if site := ipv6SiteKey(client); site != "" {
		if err := a.hit(ctx, "register-site:"+site, a.limits.RegisterPerIPv6Site, a.limits.RegisterPerIPWindow, true); err != nil {
			return err
		}
	}
	inviteHash := ""
	if invite != nil {
		inviteHash = digest(*invite)
	}
	if err := a.store.RegistrationPrecheck(ctx, inviteHash, *username, *nickname); err != nil {
		return err
	}
	if err := a.hit(ctx, "register-all", a.limits.RegisterGlobal, a.limits.RegisterGlobalWindow, true); err != nil {
		return err
	}
	var hash string
	if busy := withPasswordSlot(ctx, func() { hash, err = hashPassword(*password) }); busy != nil {
		return busy
	}
	if err != nil {
		return err
	}
	token := randomCode(32)
	tokenHash := digest(token)
	now := a.now()
	account, err := a.store.Register(ctx, store.Registration{
		ID:               newUUID(),
		Username:         *username,
		Nickname:         *nickname,
		PasswordHash:     hash,
		InviteHash:       inviteHash,
		InviteMode:       inviteMode,
		TokenHash:        tokenHash,
		SessionExpiresAt: now.Add(sessionLifetime).UnixMilli(),
		CreatedAt:        now.UnixMilli(),
	})
	if err != nil {
		return err
	}
	a.cache.Fill(ctx, "session:"+tokenHash, account.ID, sessionCacheTTL)
	a.log.Info("account registered", "username", account.Username, "mode", a.registration, "listedAdmin", adminName)
	return writeJSON(w, http.StatusOK, struct {
		Account publicAccount `json:"account"`
		Token   string        `json:"token"`
	}{publicView(a.withAdmin(account)), token})
}

// login checks a password. Attempts are limited per client IP, and failed
// attempts per (username, client network), before any hashing; both limits
// fail open. Failures from one network never lock other clients out of an
// account.
func (a *API) login(w http.ResponseWriter, r *http.Request) error {
	fields, err := stringFields(w, r)
	if err != nil {
		return err
	}
	username, password := fields["username"], fields["password"]
	if username == nil || password == nil {
		return errInvalidCredentials
	}
	ctx := r.Context()
	client := a.clientIP(r)
	if err := a.hit(ctx, "login-ip:"+ipKey(client), a.limits.LoginPerIP, a.limits.LoginPerIPWindow, false); err != nil {
		return err
	}
	// Only well-formed usernames can exist; others are covered by the IP limit.
	failureKey := ""
	if validUsername(username) {
		failureKey = "login-fail:" + strings.ToLower(*username) + "|" + networkKey(client)
		if a.exceeded(ctx, failureKey, a.limits.LoginFailures) {
			return errTooManyAttempts
		}
	}
	account, saved, found, err := a.store.LoginAccount(ctx, *username)
	if err != nil {
		return err
	}
	verified := false
	if err := withPasswordSlot(ctx, func() {
		if !found {
			verifyPassword(*password, dummyPasswordHash())
			return
		}
		verified = verifyPassword(*password, saved)
	}); err != nil {
		return err
	}
	if !verified {
		if failureKey != "" {
			a.record(ctx, failureKey, a.limits.LoginFailures, a.limits.LoginFailuresWindow)
		}
		return errInvalidCredentials
	}
	token := randomCode(32)
	tokenHash := digest(token)
	if err := a.store.CreateSession(ctx, tokenHash, account.ID, a.now().Add(sessionLifetime).UnixMilli()); err != nil {
		return err
	}
	a.cache.Fill(ctx, "session:"+tokenHash, account.ID, sessionCacheTTL)
	return writeJSON(w, http.StatusOK, struct {
		Account publicAccount `json:"account"`
		Token   string        `json:"token"`
	}{publicView(a.withAdmin(account)), token})
}

func (a *API) me(w http.ResponseWriter, r *http.Request) error {
	account, err := a.requireAccount(r.Context(), bearer(r))
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, accountBody{publicView(account)})
}

func (a *API) nickname(w http.ResponseWriter, r *http.Request) error {
	fields, err := stringFields(w, r)
	if err != nil {
		return err
	}
	nickname := fields["nickname"]
	if !validName(nickname, 16) {
		return errInvalidAccountField
	}
	account, err := a.requireAccount(r.Context(), bearer(r))
	if err != nil {
		return err
	}
	if err := a.store.Rename(r.Context(), account.ID, *nickname); err != nil {
		return err
	}
	a.cache.Invalidate(r.Context(), "account:"+account.ID)
	account.Nickname = *nickname
	return writeJSON(w, http.StatusOK, accountBody{publicView(account)})
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) error {
	if token := bearer(r); token != nil {
		tokenHash := digest(*token)
		if err := a.store.DeleteSession(r.Context(), tokenHash); err != nil {
			return err
		}
		a.cache.Invalidate(r.Context(), "session:"+tokenHash)
	}
	return writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) createInvite(w http.ResponseWriter, r *http.Request) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	code := randomCode(18)
	if err := a.store.CreateInvite(r.Context(), digest(code), a.nowMillis()); err != nil {
		return err
	}
	a.log.Info("invite created", "admin", admin.Username)
	return writeJSON(w, http.StatusOK, map[string]string{"invite": code})
}

func (a *API) ice(w http.ResponseWriter, _ *http.Request) error {
	return writeJSON(w, http.StatusOK, map[string][]any{"iceServers": {}})
}

func (a *API) offer(w http.ResponseWriter, _ *http.Request) error {
	return writeJSON(w, http.StatusNotImplemented, map[string]string{"error": "USE_LOCAL_WEBSOCKET"})
}

// bearer is Java HttpApi.bearer: the text after "Bearer ", or nil.
func bearer(r *http.Request) *string {
	value := header(r, "Authorization")
	if value == nil || !strings.HasPrefix(*value, "Bearer ") {
		return nil
	}
	token := (*value)[len("Bearer "):]
	return &token
}

func (a *API) requireAccount(ctx context.Context, token *string) (store.Account, error) {
	account, found, err := a.findAccount(ctx, token)
	if err != nil {
		return store.Account{}, err
	}
	if !found {
		return store.Account{}, errLoginRequired
	}
	return account, nil
}

// findAccount resolves a session token through the session and account
// caches, falling back to the authoritative sessions/accounts join. The
// admin flag includes KART_ADMIN_USERNAMES.
func (a *API) findAccount(ctx context.Context, token *string) (store.Account, bool, error) {
	account, found, err := a.findStoredAccount(ctx, token)
	return a.withAdmin(account), found, err
}

// withAdmin marks the accounts named in KART_ADMIN_USERNAMES as admins; the
// stored flag (the invite-mode first account, migrated Java admins) stays.
// The list is not written to MySQL, so removing a name revokes it.
func (a *API) withAdmin(account store.Account) store.Account {
	if !account.Admin && account.Username != "" && a.admins[strings.ToLower(account.Username)] {
		account.Admin = true
	}
	return account
}

// requireAdmin resolves the Bearer session of an admin.
func (a *API) requireAdmin(r *http.Request) (store.Account, error) {
	account, err := a.requireAccount(r.Context(), bearer(r))
	if err != nil {
		return store.Account{}, err
	}
	if !account.Admin {
		return store.Account{}, errAdminRequired
	}
	return account, nil
}

func (a *API) findStoredAccount(ctx context.Context, token *string) (store.Account, bool, error) {
	if token == nil || !validToken(*token) {
		return store.Account{}, false, nil
	}
	tokenHash := digest(*token)
	sessionKey := "session:" + tokenHash
	if accountID, ok := a.cache.Get(ctx, sessionKey); ok {
		account, found, err := a.accountByID(ctx, accountID)
		if err != nil || found {
			return account, found, err
		}
	}
	now := a.now()
	account, expiresAt, found, err := a.store.SessionAccount(ctx, tokenHash, now.UnixMilli())
	if err != nil || !found {
		return store.Account{}, false, err
	}
	ttl := min(sessionCacheTTL, time.Duration(expiresAt-now.UnixMilli())*time.Millisecond)
	a.cache.Fill(ctx, sessionKey, account.ID, ttl)
	a.fillAccount(ctx, account)
	return account, true, nil
}

func (a *API) accountByID(ctx context.Context, id string) (store.Account, bool, error) {
	if cached, ok := a.cache.Get(ctx, "account:"+id); ok {
		var account store.Account
		if json.Unmarshal([]byte(cached), &account) == nil && account.ID == id {
			return account, true, nil
		}
	}
	account, found, err := a.store.AccountByID(ctx, id)
	if err != nil || !found {
		return store.Account{}, false, err
	}
	a.fillAccount(ctx, account)
	return account, true, nil
}

func (a *API) fillAccount(ctx context.Context, account store.Account) {
	if encoded, err := json.Marshal(account); err == nil {
		a.cache.Fill(ctx, "account:"+account.ID, string(encoded), accountCacheTTL)
	}
}

// Bootstrap prepares the first logins at startup.
//
// In invite mode it creates the first invitation when there are neither
// invites nor accounts, like the Java Accounts constructor: the configured
// code, or a random one when it is blank.
//
// Then, in every mode, each KART_ADMIN_USERNAMES name without an account is
// logged as an error: registering it needs an invite (see register), so a
// bootstrap invitation is made sure to exist and logged: the one just
// created, else the configured code when it is unused (created if absent),
// else a new random one (one per start while a listed name is missing).
func (a *API) Bootstrap(ctx context.Context, configured string) error {
	now := a.nowMillis()
	logged := false
	if a.registration == config.RegistrationInvite {
		code := configured
		if javaBlank(code) {
			code = randomCode(18)
		}
		created, err := a.store.Bootstrap(ctx, digest(code), now)
		if err != nil {
			return err
		}
		if created {
			a.log.Info("First local account invitation", "invite", code)
			logged = true
		}
	}
	names := make([]string, 0, len(a.admins))
	for name := range a.admins {
		names = append(names, name)
	}
	missing, err := a.store.MissingUsernames(ctx, names)
	if err != nil || len(missing) == 0 {
		return err
	}
	for _, name := range missing {
		a.log.Error("KART_ADMIN_USERNAMES lists a username without an account; register it with the bootstrap invitation"+
			" (POST /multiplayer/auth/register with \"invite\")", "username", name, "registration", a.registration)
	}
	if logged {
		return nil
	}
	if !javaBlank(configured) {
		found, unused, err := a.store.InviteState(ctx, digest(configured))
		if err != nil {
			return err
		}
		if !found || unused {
			if !found {
				if err := a.store.CreateInvite(ctx, digest(configured), now); err != nil {
					return err
				}
			}
			a.log.Warn("Bootstrap invitation for KART_ADMIN_USERNAMES", "invite", configured, "usernames", missing)
			return nil
		}
		a.log.Warn("KART_BOOTSTRAP_INVITE was already used; generated a one-time invitation instead")
	}
	code := randomCode(18)
	if err := a.store.CreateInvite(ctx, digest(code), now); err != nil {
		return err
	}
	a.log.Warn("Bootstrap invitation for KART_ADMIN_USERNAMES", "invite", code, "usernames", missing)
	return nil
}
