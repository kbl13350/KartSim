package cluster

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

const secret = "cluster-test-secret-0123456789abcdef"

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// recorder is a fake data service that logs every call in arrival order.
type recorder struct {
	mu       sync.Mutex
	log      []string
	payloads [][]byte
	reply    func(path string, body []byte) (int, any)
	release  chan struct{} // when set, release calls wait on it
}

func (r *recorder) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Header.Get(contract.ClusterKeyHeader) != secret {
		apierr.WriteError(w, apierr.New(http.StatusUnauthorized, "CLUSTER_KEY_INVALID"))
		return
	}
	body, _ := io.ReadAll(req.Body)
	if req.URL.Path == contract.PathPresenceRelease && r.release != nil {
		<-r.release
	}
	r.mu.Lock()
	r.log = append(r.log, req.URL.Path)
	r.payloads = append(r.payloads, body)
	r.mu.Unlock()
	status, value := http.StatusOK, any(contract.OK{OK: true})
	if req.URL.Path == contract.PathHeartbeat {
		value = contract.HeartbeatResponse{Accepted: true, DataNode: "data-1"}
	}
	if r.reply != nil {
		if s, v := r.reply(req.URL.Path, body); s != 0 {
			status, value = s, v
		}
	}
	apierr.WriteJSON(w, status, value)
}

func (r *recorder) calls() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.log)
}

type source struct{ players []contract.OnlinePlayer }

func (s source) Online() ([]contract.OnlinePlayer, int) { return s.players, 1 }

func TestClaimWaitsForAnEarlierReleaseOfTheSameName(t *testing.T) {
	// Same name under names.Fold, which is also the data service's presence
	// key (ẞ and the Kelvin sign fold like their ordinary partners).
	for _, names := range [][2]string{{"Alice", "alice"}, {"STRAẞE", "straße"}, {"Kelvin", "kelvin"}} {
		t.Run(names[1], func(t *testing.T) {
			data := &recorder{release: make(chan struct{})}
			server := httptest.NewServer(data)
			defer server.Close()
			agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
			agent.SetSource(source{})
			runAgent(t, agent)

			agent.Release(contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: "old", Name: names[0]})
			claimed := make(chan error, 1)
			go func() {
				claimed <- agent.Claim(context.Background(), contract.PresenceClaimRequest{
					NodeID: "game-1", PlayerID: "new", Name: names[1], Guest: true})
			}()
			time.Sleep(50 * time.Millisecond)
			select {
			case err := <-claimed:
				t.Fatalf("claim did not wait for the release: %v", err)
			default:
			}
			close(data.release)
			if err := <-claimed; err != nil {
				t.Fatal(err)
			}
			calls := data.calls()
			release := slices.Index(calls, contract.PathPresenceRelease)
			claim := slices.Index(calls, contract.PathPresenceClaim)
			if release < 0 || claim < 0 || release > claim {
				t.Fatalf("calls %v", calls)
			}
		})
	}
}

// An account claim also waits for an earlier release of the same account
// under another nickname (a player reconnecting after a rename), since the
// data service reserves the account too; other accounts do not wait.
func TestClaimWaitsForAnEarlierReleaseOfTheSameAccount(t *testing.T) {
	data := &recorder{release: make(chan struct{})}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
	agent.SetSource(source{})
	runAgent(t, agent)

	agent.Release(contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: "old", Name: "OldName",
		AccountID: "acc-1"})
	if err := agent.Claim(context.Background(), contract.PresenceClaimRequest{NodeID: "game-1",
		PlayerID: "other", Name: "Other", AccountID: "acc-2"}); err != nil {
		t.Fatal(err)
	}
	claimed := make(chan error, 1)
	go func() {
		claimed <- agent.Claim(context.Background(), contract.PresenceClaimRequest{
			NodeID: "game-1", PlayerID: "new", Name: "NewName", AccountID: "acc-1"})
	}()
	time.Sleep(50 * time.Millisecond)
	select {
	case err := <-claimed:
		t.Fatalf("claim did not wait for the release: %v", err)
	default:
	}
	close(data.release)
	if err := <-claimed; err != nil {
		t.Fatal(err)
	}
	calls := data.calls()
	release := slices.Index(calls, contract.PathPresenceRelease)
	lastClaim := -1
	for i := len(calls) - 1; i >= 0; i-- {
		if calls[i] == contract.PathPresenceClaim {
			lastClaim = i
			break
		}
	}
	if release < 0 || lastClaim < release {
		t.Fatalf("calls %v", calls)
	}
	if got := data.bodies(contract.PathPresenceRelease); len(got) != 1 || got[0].AccountID != "acc-1" {
		t.Fatalf("releases %+v", got)
	}
}

// A claim waits only a bounded time for an earlier release, and then still
// gets its own full call timeout.
func TestClaimWaitForAReleaseIsBounded(t *testing.T) {
	data := &recorder{release: make(chan struct{})}
	server := httptest.NewServer(data)
	defer server.Close()
	defer close(data.release)
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
	agent.waitBudget = 50 * time.Millisecond
	agent.SetSource(source{})
	runAgent(t, agent)
	agent.Release(contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: "old", Name: "Alice"})
	began := time.Now()
	if err := agent.Claim(context.Background(), contract.PresenceClaimRequest{NodeID: "game-1",
		PlayerID: "new", Name: "Alice"}); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(began); elapsed < agent.waitBudget || elapsed > time.Second {
		t.Fatalf("claim returned after %v", elapsed)
	}
}

// runAgent runs agent until the test ends.
func runAgent(t *testing.T, agent *Agent) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		agent.Run(ctx)
		close(done)
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})
}

// bodies decodes the requests the fake data service received on path.
func (r *recorder) bodies(path string) []contract.PresenceReleaseRequest {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []contract.PresenceReleaseRequest
	for i, p := range r.log {
		if p == path {
			var req contract.PresenceReleaseRequest
			_ = json.Unmarshal(r.payloads[i], &req)
			out = append(out, req)
		}
	}
	return out
}

func waitUntil(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func TestClaimErrorMapping(t *testing.T) {
	var mu sync.Mutex
	var answer struct {
		status int
		code   string
	}
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		mu.Lock()
		defer mu.Unlock()
		if path == contract.PathPresenceClaim && answer.status != 0 {
			return answer.status, map[string]string{"error": answer.code}
		}
		return 0, nil
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
	agent.SetSource(source{})
	runAgent(t, agent)
	releases := 0
	for i, tc := range []struct {
		status  int
		code    string
		want    string
		release bool // an uncertain failure undoes the claim it may have made
	}{
		{0, "", "", false},
		{409, "NICKNAME_TAKEN", "NICKNAME_TAKEN", false},
		{409, "ACCOUNT_ONLINE", "ACCOUNT_ONLINE", false},
		{400, "INVALID_GUEST_NAME", "INVALID_GUEST_NAME", false},
		{400, "INVALID_REQUEST", "DATA_SERVICE_UNAVAILABLE", true},
		{401, "CLUSTER_KEY_INVALID", "DATA_SERVICE_UNAVAILABLE", true},
		{503, "DATA_SERVICE_UNAVAILABLE", "DATA_SERVICE_UNAVAILABLE", true},
		{500, "INTERNAL_ERROR", "DATA_SERVICE_UNAVAILABLE", true},
	} {
		mu.Lock()
		answer.status, answer.code = tc.status, tc.code
		mu.Unlock()
		playerID := "p" + strconv.Itoa(i)
		err := agent.Claim(context.Background(), contract.PresenceClaimRequest{NodeID: "game-1",
			PlayerID: playerID, Name: "Alice", Guest: true})
		got := ""
		var rejected *apierr.Error
		if errors.As(err, &rejected) {
			got = rejected.Code
		} else if err != nil {
			t.Fatalf("%d: non-API error %v", tc.status, err)
		}
		if got != tc.want {
			t.Errorf("%d %s: got %q, want %q", tc.status, tc.code, got, tc.want)
		}
		if tc.release {
			releases++
			waitUntil(t, "release of "+playerID, func() bool {
				return len(data.bodies(contract.PathPresenceRelease)) == releases
			})
			last := data.bodies(contract.PathPresenceRelease)[releases-1]
			if last != (contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: playerID, Name: "Alice"}) {
				t.Errorf("%d: release %+v", tc.status, last)
			}
		}
	}
	if n := len(data.bodies(contract.PathPresenceRelease)); n != releases {
		t.Fatalf("%d releases, want %d", n, releases)
	}
	server.Close()
	err := agent.Claim(context.Background(), contract.PresenceClaimRequest{Name: "Alice"})
	var rejected *apierr.Error
	if !errors.As(err, &rejected) || rejected.Code != "DATA_SERVICE_UNAVAILABLE" || rejected.Status != 503 {
		t.Fatalf("service down: %v", err)
	}
}

// A claim the data service applies but answers too late must not leave the
// name held by a player ID nobody uses: the agent releases exactly that value.
func TestClaimFailureReleasesTheUncertainClaim(t *testing.T) {
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		if path == contract.PathPresenceClaim {
			time.Sleep(300 * time.Millisecond)
		}
		return 0, nil
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
	agent.timeout = 50 * time.Millisecond
	agent.SetSource(source{})
	runAgent(t, agent)
	began := time.Now()
	err := agent.Claim(context.Background(), contract.PresenceClaimRequest{NodeID: "game-1",
		PlayerID: "lost", Name: "Alice", AccountID: "acc-alice"})
	if rejected, ok := apierr.As(err); !ok || rejected.Code != "DATA_SERVICE_UNAVAILABLE" {
		t.Fatalf("slow claim: %v", err)
	}
	if elapsed := time.Since(began); elapsed > 250*time.Millisecond {
		t.Fatalf("claim took %v", elapsed)
	}
	waitUntil(t, "release", func() bool { return len(data.bodies(contract.PathPresenceRelease)) == 1 })
	want := contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: "lost", Name: "Alice", AccountID: "acc-alice"}
	if got := data.bodies(contract.PathPresenceRelease)[0]; got != want {
		t.Fatalf("release %+v, want %+v", got, want)
	}
}

// A failed release is resent (before a claim of the same name), instead of
// leaving the old claim to block the player's reconnect for 30 s.
func TestFailedReleaseIsRetriedBeforeTheNextClaim(t *testing.T) {
	var mu sync.Mutex
	failures := 1
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		mu.Lock()
		defer mu.Unlock()
		if path == contract.PathPresenceRelease && failures > 0 {
			failures--
			return 503, map[string]string{"error": "DATA_SERVICE_UNAVAILABLE"}
		}
		return 0, nil
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
	agent.SetSource(source{})
	runAgent(t, agent)
	agent.Release(contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: "old", Name: "Alice"})
	waitUntil(t, "first release attempt", func() bool {
		return len(data.bodies(contract.PathPresenceRelease)) == 1
	})
	began := time.Now()
	if err := agent.Claim(context.Background(), contract.PresenceClaimRequest{NodeID: "game-1",
		PlayerID: "new", Name: "ALICE"}); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(began); elapsed >= agent.waitBudget {
		t.Fatalf("claim waited %v for the retried release", elapsed)
	}
	calls := data.calls()
	want := []string{contract.PathHeartbeat, contract.PathPresenceRelease, contract.PathPresenceRelease,
		contract.PathPresenceClaim}
	if !slices.Equal(calls, want) {
		t.Fatalf("calls %v, want %v", calls, want)
	}
}

// Slow releases are drained between heartbeats, never in front of a due one,
// and a claim behind them only waits for the release of its own name.
func TestSlowReleasesDoNotStarveHeartbeats(t *testing.T) {
	const interval, latency = 200 * time.Millisecond, 100 * time.Millisecond
	var mu sync.Mutex
	var beats []time.Time
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		switch path {
		case contract.PathPresenceRelease:
			time.Sleep(latency)
		case contract.PathHeartbeat:
			mu.Lock()
			beats = append(beats, time.Now())
			mu.Unlock()
		}
		return 0, nil
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, interval, quiet)
	agent.SetSource(source{})
	runAgent(t, agent)
	waitUntil(t, "registration", func() bool {
		mu.Lock()
		defer mu.Unlock()
		return len(beats) > 0
	})
	for i := range 20 {
		agent.Release(contract.PresenceReleaseRequest{NodeID: "game-1", PlayerID: "p" + strconv.Itoa(i),
			Name: "Player" + strconv.Itoa(i)})
	}
	began := time.Now()
	if err := agent.Claim(context.Background(), contract.PresenceClaimRequest{NodeID: "game-1",
		PlayerID: "again", Name: "player19"}); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(began); elapsed > 3*latency+interval {
		t.Fatalf("claim behind 20 slow releases took %v", elapsed)
	}
	waitUntil(t, "every release", func() bool {
		return len(data.bodies(contract.PathPresenceRelease)) == 20
	})
	time.Sleep(interval)
	mu.Lock()
	defer mu.Unlock()
	limit := interval + latency + 100*time.Millisecond
	for i := 1; i < len(beats); i++ {
		if gap := beats[i].Sub(beats[i-1]); gap > limit {
			t.Fatalf("heartbeat gap %v while draining releases (limit %v)", gap, limit)
		}
	}
	if len(beats) < 5 {
		t.Fatalf("only %d heartbeats", len(beats))
	}
}

func TestHeartbeatCarriesNodeState(t *testing.T) {
	var mu sync.Mutex
	var beats []contract.HeartbeatRequest
	data := &recorder{reply: func(path string, body []byte) (int, any) {
		if path == contract.PathHeartbeat {
			var req contract.HeartbeatRequest
			_ = json.Unmarshal(body, &req)
			mu.Lock()
			beats = append(beats, req)
			mu.Unlock()
		}
		return 0, nil
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL+"/", []byte(secret)), NodeInfo{NodeID: "game-1",
		Name: "一号", Origin: "https://kart.example", Capacity: 50}, 20*time.Millisecond, quiet)
	agent.SetSource(source{players: []contract.OnlinePlayer{{PlayerID: "p1", Name: "Alice"}}})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		agent.Run(ctx)
		close(done)
	}()
	deadline := time.Now().Add(5 * time.Second)
	for {
		mu.Lock()
		n := len(beats)
		mu.Unlock()
		if n >= 3 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("heartbeats missing")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	<-done
	mu.Lock()
	first := beats[0]
	mu.Unlock()
	if first.NodeID != "game-1" || first.Name != "一号" || first.Origin != "https://kart.example" ||
		first.Capacity != 50 || first.Rooms != 1 || len(first.Players) != 1 ||
		first.ProtocolVersion != contract.ProtocolVersion {
		t.Fatalf("heartbeat %+v", first)
	}
	if err := agent.Leave(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls := data.calls(); calls[len(calls)-1] != contract.PathNodeLeave {
		t.Fatalf("calls %v", calls)
	}
	// Releases after shutdown are dropped instead of queued forever.
	agent.Release(contract.PresenceReleaseRequest{Name: "Alice"})
	if err := agent.Claim(context.Background(), contract.PresenceClaimRequest{Name: "Alice"}); err != nil {
		t.Fatal(err)
	}
}

func TestWrongClusterKeyIsAnAPIError(t *testing.T) {
	server := httptest.NewServer(&recorder{})
	defer server.Close()
	err := NewDataClient(server.URL, []byte("wrong")).Call(context.Background(),
		contract.PathHeartbeat, contract.HeartbeatRequest{}, nil)
	var rejected *apierr.Error
	if !errors.As(err, &rejected) || rejected.Status != 401 || rejected.Code != "CLUSTER_KEY_INVALID" {
		t.Fatalf("got %v", err)
	}
}

// The agent keeps the reward rates of the latest heartbeat response for the
// lobby's race.rewards; before one (or from a data service that does not
// send them) it reports 1/1, and invalid values keep the previous ones.
func TestAgentKeepsHeartbeatRates(t *testing.T) {
	var mu sync.Mutex
	reply := contract.HeartbeatResponse{Accepted: true, DataNode: "data-1"}
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		if path != contract.PathHeartbeat {
			return 0, nil
		}
		mu.Lock()
		defer mu.Unlock()
		return http.StatusOK, reply
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, time.Hour, quiet)
	agent.SetSource(source{})
	if got := agent.Rates(); got != rewards.DefaultRates() {
		t.Fatalf("rates before any heartbeat %+v", got)
	}
	ctx := context.Background()
	agent.heartbeat(ctx)
	if got := agent.Rates(); got != rewards.DefaultRates() {
		t.Fatalf("rates without rates in the response %+v", got)
	}
	set := func(exp, lucci float64) {
		mu.Lock()
		defer mu.Unlock()
		reply.ExpRate, reply.LucciRate = &exp, &lucci
	}
	set(1.5, 0)
	agent.heartbeat(ctx)
	if got := agent.Rates(); got != (rewards.Rates{Exp: 1.5, Lucci: 0}) {
		t.Fatalf("rates %+v", got)
	}
	set(-1, 2)
	agent.heartbeat(ctx)
	if got := agent.Rates(); got != (rewards.Rates{Exp: 1.5, Lucci: 2}) {
		t.Fatalf("an invalid rate must keep the previous one: %+v", got)
	}
	// A failed heartbeat changes nothing.
	mu.Lock()
	reply.Accepted = false
	mu.Unlock()
	set(3, 3)
	agent.heartbeat(ctx)
	if got := agent.Rates(); got != (rewards.Rates{Exp: 1.5, Lucci: 2}) {
		t.Fatalf("a rejected heartbeat changed the rates: %+v", got)
	}
}
