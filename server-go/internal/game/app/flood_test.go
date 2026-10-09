package app

import (
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"testing"

	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

// A host toggling the track as fast as allowed while the data service is
// unavailable leaves at most a couple of outbox records for the room; the
// data service ends with the final rules, and a settlement queued after the
// flood is not stuck behind it.
func TestRoomRuleChangesAreCoalesced(t *testing.T) {
	data := newFakeData()
	data.rulesDown = true
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	host := dial(t, n.wsURL, nil)
	if reply := host.request(hello("Host", sign(t, ticket.Claims{Guest: true}))); reply["type"] != "welcome" {
		t.Fatalf("hello: %v", reply)
	}
	room := host.room(map[string]any{"type": "create", "name": "Flood", "capacity": 2,
		"channelName": "speedIndiCombine", "mode": "individual", "speed": 7, "speedVersion": "国服"})
	roomID := room["roomId"].(string)
	for i := range 18 { // within the rule-change burst, no replies
		host.send(map[string]any{"type": "track", "roomId": roomID, "trackId": "track_" + strconv.Itoa(i%2)})
	}
	host.room(map[string]any{"type": "track", "roomId": roomID, "trackId": "track_final"})
	if queued := n.app.outbox.Len(); queued > 3 {
		t.Fatalf("%d outbox records for one room", queued)
	}

	n.app.recorderForTest().SaveRace(contract.RaceSettlement{NodeID: e2eNode, RaceID: "race-after-flood",
		RoomID: roomID, Snapshot: json.RawMessage(`{}`)})
	data.read(func() { data.rulesDown = false })
	eventually(t, "final rules and the settlement", func() (ok bool) {
		data.read(func() {
			ok = len(data.races) == 1 && len(data.rules) > 0 &&
				data.rules[len(data.rules)-1].RoomID == roomID &&
				json.Valid(data.rules[len(data.rules)-1].Rules)
			if ok {
				var rules map[string]any
				_ = json.Unmarshal(data.rules[len(data.rules)-1].Rules, &rules)
				ok = rules["trackId"] == "track_final"
			}
		})
		return
	})
	data.read(func() {
		if len(data.rules) > 3 {
			t.Errorf("%d rules saves delivered for one room", len(data.rules))
		}
	})
	eventually(t, "empty outbox", func() bool { return n.app.outbox.Len() == 0 })
}
