package app

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/game/config"
	"kartsim/internal/shared/ticket"
)

func gear(kart int) map[string]any {
	value := equipment()
	value["itemIds"].(map[string]any)["3"] = kart
	return value
}

func accountHello(t *testing.T, nickname, accountID string, equipment any) map[string]any {
	value := hello("ignored", sign(t, ticket.Claims{AccountID: accountID, Username: accountID, Nickname: nickname}))
	if equipment == nil {
		delete(value, "equipment")
	} else {
		value["equipment"] = equipment
	}
	return value
}

func createRoom(equipment any) map[string]any {
	value := map[string]any{"type": "create", "name": "Owned", "capacity": 4,
		"channelName": "speedIndiCombine", "mode": "individual", "speed": 7, "speedVersion": "国服"}
	if equipment != nil {
		value["equipment"] = equipment
	}
	return value
}

// Account players may only bring equipment the data service confirms; the
// node checks over the internal API and remembers the last confirmed gear.
func TestEquipmentOwnershipEndToEnd(t *testing.T) {
	data := newFakeData()
	data.unowned[900] = true
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	verifies := func() (count int) {
		data.read(func() { count = len(data.verifies) })
		return
	}

	bob := dial(t, n.wsURL, nil)
	if reply := bob.request(accountHello(t, "Bob", "acc-bob", gear(387))); reply["type"] != "welcome" {
		t.Fatalf("hello: %v", reply)
	}
	data.read(func() {
		sent := data.verifies[0]
		var gearSent map[string]any
		if sent.AccountID != "acc-bob" || json.Unmarshal(sent.Equipment, &gearSent) != nil ||
			gearSent["itemIds"].(map[string]any)["3"] != 387.0 {
			t.Errorf("verify request %+v", sent)
		}
	})
	room := bob.room(createRoom(gear(387))) // the gear confirmed at hello
	roomID := room["roomId"].(string)
	if verifies() != 1 {
		t.Fatalf("%d checks, want 1", verifies())
	}

	// Unowned gear is refused at hello (the browser repairs and retries
	// with a new ticket) and everywhere else, changing nothing.
	carol := dial(t, n.wsURL, nil)
	if reply := carol.request(accountHello(t, "Carol", "acc-carol", gear(900))); reply["code"] != "ITEM_NOT_OWNED" {
		t.Fatalf("hello with unowned gear: %v", reply)
	}
	if reply := carol.request(accountHello(t, "Carol", "acc-carol", nil)); reply["type"] != "welcome" {
		t.Fatalf("hello again without gear: %v", reply)
	}
	carolID := ""
	for _, refused := range []map[string]any{
		createRoom(gear(900)),
		{"type": "join", "roomId": roomID, "equipment": gear(900)},
	} {
		if reply := carol.request(refused); reply["code"] != "ITEM_NOT_OWNED" {
			t.Fatalf("%v: %v", refused["type"], reply)
		}
	}
	room = carol.room(map[string]any{"type": "join", "roomId": roomID})
	for _, m := range room["members"].([]any) {
		member := m.(map[string]any)
		if member["name"] == "Carol" {
			carolID = member["playerId"].(string)
			if _, ok := member["equipment"]; ok {
				t.Fatalf("Carol joined with unowned gear: %v", member)
			}
		}
	}
	if reply := carol.request(map[string]any{"type": "equipment", "roomId": roomID,
		"equipment": gear(900)}); reply["code"] != "ITEM_NOT_OWNED" {
		t.Fatalf("equipment: %v", reply)
	}

	// The data service being down is 503 DATA_SERVICE_UNAVAILABLE.
	data.read(func() { data.verifyDown = true })
	if reply := carol.request(map[string]any{"type": "equipment", "roomId": roomID,
		"equipment": gear(1637)}); reply["code"] != "DATA_SERVICE_UNAVAILABLE" {
		t.Fatalf("equipment while down: %v", reply)
	}
	dave := dial(t, n.wsURL, nil)
	if reply := dave.request(accountHello(t, "Dave", "acc-dave", gear(387))); reply["code"] != "DATA_SERVICE_UNAVAILABLE" {
		t.Fatalf("hello while down: %v", reply)
	}
	data.read(func() { data.verifyDown = false })
	room = carol.room(map[string]any{"type": "equipment", "roomId": roomID, "equipment": gear(1637)})
	for _, m := range room["members"].([]any) {
		member := m.(map[string]any)
		if member["playerId"] == carolID {
			if member["equipment"].(map[string]any)["itemIds"].(map[string]any)["3"] != 1637.0 {
				t.Fatalf("Carol's gear %v", member)
			}
		}
	}
	// Asked: Bob's hello, Carol's refused hello and her final change. Not
	// asked: Bob's create with the gear confirmed at hello, Carol's second
	// hello and her join without gear, and her create, join and equipment
	// with the gear refused moments before (refusals are remembered for 10
	// seconds).
	if got := verifies(); got != 3 {
		t.Fatalf("%d checks, want 3", got)
	}
	// A hello without gear needs no check.
	erin := dial(t, n.wsURL, nil)
	if reply := erin.request(accountHello(t, "Erin", "acc-erin", nil)); reply["type"] != "welcome" {
		t.Fatalf("hello without gear: %v", reply)
	}
	if got := verifies(); got != 3 {
		t.Fatalf("%d checks after a hello without gear", got)
	}
}

// KART_ALLOW_GUESTS defaults to false: guest tickets get 401 LOGIN_REQUIRED.
func TestGuestsNeedToLogIn(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	cfg, err := config.FromEnv(func(name string) string {
		if name == "KART_CLUSTER_SECRET" {
			return e2eSecret
		}
		return ""
	})
	if err != nil || cfg.AllowGuests {
		t.Fatalf("default AllowGuests %v (%v)", cfg.AllowGuests, err)
	}
	n := startNodeWith(t, dataServer.URL, data, func(c *config.Config) { c.AllowGuests = cfg.AllowGuests })
	c := dial(t, n.wsURL, nil)
	if reply := c.request(hello("Guest", sign(t, ticket.Claims{Guest: true}))); reply["code"] != "LOGIN_REQUIRED" {
		t.Fatalf("guest: %v", reply)
	}
	data.read(func() {
		if len(data.claims) != 0 {
			t.Errorf("guest claimed %+v", data.claims)
		}
	})
	if reply := c.request(accountHello(t, "Member", "acc-member", nil)); reply["type"] != "welcome" {
		t.Fatalf("account: %v", reply)
	}
}

// A heartbeat that reports a player's nickname as held by another node
// disconnects that player (1008 "nickname taken elsewhere"), freeing the
// room seat like any disconnect.
func TestHeartbeatConflictsDisconnectThePlayer(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	alice := dial(t, n.wsURL, nil)
	alice.request(accountHello(t, "Alice", "acc-alice", nil))
	bob := dial(t, n.wsURL, nil)
	bobID := bob.request(accountHello(t, "Bob", "acc-bob", nil))["playerId"].(string)
	room := alice.room(createRoom(nil))
	bob.room(map[string]any{"type": "join", "roomId": room["roomId"]})

	data.read(func() { data.conflicts = []string{bobID, "someone-else"} })
	for {
		_, err := bob.read()
		if err == nil {
			continue
		}
		var closeErr *websocket.CloseError
		if !errors.As(err, &closeErr) || closeErr.Code != websocket.ClosePolicyViolation ||
			closeErr.Text != "nickname taken elsewhere" {
			t.Fatalf("Bob's socket: %v", err)
		}
		break
	}
	alice.waitFor(func(m map[string]any) bool {
		return m["type"] == "room" && len(m["room"].(map[string]any)["members"].([]any)) == 1
	})
	eventually(t, "Bob's name release", func() (ok bool) {
		data.read(func() { ok = len(data.releases) == 1 && data.releases[0].PlayerID == bobID })
		return
	})
	if players, _ := n.app.Lobby().Counts(); players != 1 {
		t.Fatalf("players %d", players)
	}
}

// One account has one session on the node: a second hello of the same
// account under another nickname is refused ACCOUNT_ONLINE. Claims and
// releases carry the account so the data service enforces it cluster-wide.
func TestOneSessionPerAccountEndToEnd(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	bob := dial(t, n.wsURL, nil)
	bobID, _ := bob.request(accountHello(t, "Bob", "acc-bob", nil))["playerId"].(string)
	again := dial(t, n.wsURL, nil)
	if reply := again.request(accountHello(t, "Robert", "acc-bob", nil)); reply["code"] != "ACCOUNT_ONLINE" {
		t.Fatalf("second session: %v", reply)
	}
	_ = bob.conn.Close()
	eventually(t, "Bob's release", func() (ok bool) {
		data.read(func() {
			ok = len(data.releases) == 1 && data.releases[0].PlayerID == bobID && data.releases[0].AccountID == "acc-bob"
		})
		return
	})
	if reply := again.request(accountHello(t, "Robert", "acc-bob", nil)); reply["type"] != "welcome" {
		t.Fatalf("after Bob left: %v", reply)
	}
	data.read(func() {
		if len(data.claims) != 2 || data.claims[0].AccountID != "acc-bob" || data.claims[1].AccountID != "acc-bob" {
			t.Errorf("claims %+v", data.claims)
		}
	})
}

// A rental confirmed at hello is checked again once the data service's
// validUntil has passed.
func TestExpiredRentalIsCheckedAgainEndToEnd(t *testing.T) {
	data := newFakeData()
	data.rentals[387] = time.Now().Add(300 * time.Millisecond).UnixMilli()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	verifies := func() (count int) {
		data.read(func() { count = len(data.verifies) })
		return
	}
	renter := dial(t, n.wsURL, nil)
	if reply := renter.request(accountHello(t, "Renter", "acc-renter", gear(387))); reply["type"] != "welcome" {
		t.Fatalf("hello: %v", reply)
	}
	room := renter.room(createRoom(gear(387)))
	renter.request(map[string]any{"type": "leave", "roomId": room["roomId"]})
	if verifies() != 1 {
		t.Fatalf("%d checks within the rental", verifies())
	}
	time.Sleep(time.Until(time.UnixMilli(data.rentals[387])) + 50*time.Millisecond)
	data.read(func() { data.unowned[387] = true })
	if reply := renter.request(createRoom(gear(387))); reply["code"] != "ITEM_NOT_OWNED" {
		t.Fatalf("create after the rental ended: %v", reply)
	}
	if verifies() != 2 {
		t.Fatalf("%d checks after the rental ended", verifies())
	}
}
