package lobby

import (
	"bytes"
	"testing"
	"time"

	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
	"kartsim/internal/shared/ticket"
)

// connectAccount says hello with an account ticket; the ticket's nickname
// becomes the player's name.
func (h *harness) connectAccount(nickname, accountID string) *Client {
	h.t.Helper()
	c := h.newClient()
	h.must(c, helloRequest("ignored", h.sign(ticket.Claims{AccountID: accountID,
		Username: accountID, Nickname: nickname})))
	return c
}

// startRace creates a room hosted by players[0], fills it, starts the race,
// loads everyone and runs the countdown. It returns the room and race IDs.
func (h *harness) startRace(players []*Client, gameplay, channel string, capacity int) (string, string) {
	h.t.Helper()
	room := h.joinAndReady(players, h.create(players, gameplay, channel, capacity))
	roomID := room["roomId"].(string)
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"].(string)
	if _, ok := raceOf(room)["rewards"]; ok {
		h.t.Fatal("rewards published at the start")
	}
	for _, p := range players {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3 * time.Second)
	return roomID, raceID
}

func reward(exp, lucci int) map[string]any { return map[string]any{"exp": exp, "lucci": lucci} }

// The finished race publishes race.rewards ({playerId: {exp, lucci}}) after
// the Java fields, leaves race.results exactly as Java writes them, and the
// settlement lists every reward with the racer's account ID (none for guests).
func TestRaceRewardsInSnapshotAndSettlement(t *testing.T) {
	h := newHarness(t)
	pro := h.connectAccount("Pro", "acc-pro")
	second, third := h.connect("Second"), h.connect("Third")
	players := []*Client{pro, second, third}
	roomID, raceID := h.startRace(players, "ordinary", "speedIndiCombine", 3)
	h.clock.Advance(50 * time.Second)
	room := h.command(pro, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 50_000})
	if _, ok := raceOf(room)["rewards"]; ok {
		t.Fatal("rewards published before the race finished")
	}
	h.must(second, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 51_000})
	h.clock.Advance(10 * time.Second) // Third never finishes

	h.sink(pro).mu.Lock()
	pushed := h.sink(pro).texts[len(h.sink(pro).texts)-1]
	h.sink(pro).mu.Unlock()
	raceRaw := rawField(t, rawField(t, pushed, "room"), "race")
	assertEqual(t, keysOf(t, raceRaw), []string{"raceId", "channelName", "gameplay", "trackId",
		"loadingDeadline", "roster", "startSlots", "loadedIds", "startAt", "finishWindowMs",
		"finishDeadline", "finishes", "raceOverAt", "results", "rewards"})
	// N = 3 in a Combine channel (exp x1.1): 1st p = 1, 2nd p = 0.5, and
	// a racer without a time gets 10 / 10 (exp x1.1).
	wantJSON := `{"` + pro.playerID + `":{"exp":94,"lucci":130},"` + second.playerID +
		`":{"exp":66,"lucci":90},"` + third.playerID + `":{"exp":11,"lucci":10}}`
	if got := string(rawField(t, raceRaw, "rewards")); got != wantJSON {
		t.Fatalf("rewards %s, want %s", got, wantJSON)
	}
	rc := raceOf(object(decodeObject(t, pushed)["room"]))
	assertEqual(t, rc["results"], []any{
		map[string]any{"playerId": pro.playerID, "rank": 1, "elapsedMs": 50_000, "points": 10},
		map[string]any{"playerId": second.playerID, "rank": 2, "elapsedMs": 51_000, "points": 8},
		map[string]any{"playerId": third.playerID, "rank": 3, "elapsedMs": nil, "points": 0},
	})

	settlements := h.recorder.settlements()
	if len(settlements) != 1 {
		t.Fatalf("settlements %d", len(settlements))
	}
	s := settlements[0]
	assertEqual(t, s.Rewards, []contract.RaceReward{
		{PlayerID: pro.playerID, AccountID: "acc-pro", Exp: 94, Lucci: 130},
		{PlayerID: second.playerID, Exp: 66, Lucci: 90},
		{PlayerID: third.playerID, Exp: 11, Lucci: 10},
	})
	if !bytes.Contains(rawField(t, s.Snapshot, "race"), []byte(`"rewards":`+wantJSON)) {
		t.Fatalf("stored outcome %s", s.Snapshot)
	}
	// The rewards stay with the finished race until it closes.
	room = h.command(second, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, raceOf(room)["rewards"], map[string]any{pro.playerID: reward(94, 130),
		second.playerID: reward(66, 90), third.playerID: reward(11, 10)})
}

// Team mode: the winning team's exp and lucci are x1.2; an Infinit channel
// has no exp bonus.
func TestTeamRaceRewards(t *testing.T) {
	h := newHarness(t)
	players := []*Client{h.connectAccount("A", "acc-a"), h.connect("B"), h.connect("C"), h.connect("D")}
	roomID, raceID := h.startRace(players, "ordinary", "speedTeamInfinit", 4)
	h.clock.Advance(60 * time.Second)
	// Team 1 = players 0 and 2, team 2 = players 1 and 3; player 3 never finishes.
	for i, p := range players[:3] {
		h.must(p, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID,
			"elapsedMs": 60_000 + i*1_000})
	}
	h.clock.Advance(10 * time.Second)
	rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
	assertEqual(t, rc["winningTeam"], 1)
	// N = 4: p = 1, 2/3, 1/3; team 1 won.
	assertEqual(t, rc["rewards"], map[string]any{
		players[0].playerID: reward(108, 168), // (30+50+10) x1.2, (40+80+20) x1.2
		players[1].playerID: reward(73, 113),  // 30+33.3+10, 40+53.3+20
		players[2].playerID: reward(68, 104),  // (30+16.7+10) x1.2, (40+26.7+20) x1.2
		players[3].playerID: reward(10, 10),   // no time, losing team
	})
	assertEqual(t, h.recorder.settlements()[0].Rewards, []contract.RaceReward{
		{PlayerID: players[0].playerID, AccountID: "acc-a", Exp: 108, Lucci: 168},
		{PlayerID: players[1].playerID, Exp: 73, Lucci: 113},
		{PlayerID: players[2].playerID, Exp: 68, Lucci: 104},
		{PlayerID: players[3].playerID, Exp: 10, Lucci: 10},
	})
}

// Roadblock races have no ranked results (race.results stays []), but every
// loaded racer still in the room is rewarded: the winning side as 1st,
// losing blockers as rank N/2 and a losing runner as last, all counted as
// finished. A runner who leaves earns nothing (blockers win, N stays 5).
func TestRoadblockRewards(t *testing.T) {
	for _, reason := range []string{"finish", "timeout", "runner-left"} {
		t.Run(reason, func(t *testing.T) {
			h := newHarness(t)
			players := []*Client{h.connectAccount("Runner", "acc-runner"), h.connectAccount("Blocker", "acc-blocker")}
			for _, name := range []string{"B2", "B3", "B4"} {
				players = append(players, h.connect(name))
			}
			roomID, raceID := h.startRace(players, "roadblock", "speedIndiCombine", 5)
			switch reason {
			case "finish":
				h.clock.Advance(40 * time.Second)
				h.must(players[0], map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 1_000})
			case "timeout":
				h.clock.Advance(180 * time.Second)
			case "runner-left":
				h.clock.Advance(40 * time.Second)
				h.must(players[0], map[string]any{"type": "leave", "roomId": roomID})
			}
			rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
			assertEqual(t, object(rc["roadblockOutcome"])["reason"], reason)
			assertEqual(t, rc["results"], []any{})
			// N = 5 in speedIndiCombine (exp x1.1): 1st is 105 / 150, rank 2.5
			// (p = 0.625) is 84 / 120, last (p = 0) is 50 / 70.
			runner, blocker := reward(50, 70), reward(105, 150)
			if reason == "finish" {
				runner, blocker = reward(105, 150), reward(84, 120)
			}
			want := map[string]any{players[0].playerID: runner}
			if reason == "runner-left" {
				delete(want, players[0].playerID)
			}
			for _, p := range players[1:] {
				want[p.playerID] = blocker
			}
			assertEqual(t, rc["rewards"], want)

			settlements := h.recorder.settlements()
			if len(settlements) != 1 || len(settlements[0].Results) != 0 {
				t.Fatalf("settlements %+v", settlements)
			}
			got := settlements[0].Rewards
			wantRunner := contract.RaceReward{PlayerID: players[0].playerID, AccountID: "acc-runner",
				Exp: 50, Lucci: 70}
			wantBlocker := contract.RaceReward{PlayerID: players[1].playerID, AccountID: "acc-blocker",
				Exp: 105, Lucci: 150}
			if reason == "finish" {
				wantRunner.Exp, wantRunner.Lucci, wantBlocker.Exp, wantBlocker.Lucci = 105, 150, 84, 120
			}
			if reason == "runner-left" {
				if len(got) != 4 || got[0] != wantBlocker {
					t.Fatalf("settlement rewards %+v", got)
				}
			} else {
				// Loading order: everyone loaded in player order.
				if len(got) != 5 {
					t.Fatalf("settlement rewards %+v", got)
				}
				assertEqual(t, got[:2], []contract.RaceReward{wantRunner, wantBlocker})
			}
			assertEqual(t, got[len(got)-1], contract.RaceReward{PlayerID: players[4].playerID,
				Exp: wantBlocker.Exp, Lucci: wantBlocker.Lucci})
		})
	}
}

// With KART_EXP_RATE / KART_LUCCI_RATE other than 1 (reported by the data
// service in heartbeat responses) the snapshot shows the scaled rewards the
// data service credits, rounded like rewards.ApplyRate, while the
// settlement keeps the base amounts the data service scales once.
func TestRaceRewardsShowConfiguredRates(t *testing.T) {
	h := newHarness(t)
	rates := rewards.Rates{Exp: 1.5, Lucci: 2}
	h.lobby.rates = func() rewards.Rates { return rates }
	pro := h.connectAccount("Pro", "acc-pro")
	second, third := h.connect("Second"), h.connect("Third")
	roomID, raceID := h.startRace([]*Client{pro, second, third}, "ordinary", "speedIndiCombine", 3)
	h.clock.Advance(50 * time.Second)
	h.must(pro, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 50_000})
	h.must(second, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 51_000})
	h.clock.Advance(10 * time.Second)

	// Base 94/130, 66/90, 11/10 (see TestRaceRewardsInSnapshotAndSettlement).
	shown := map[string]any{pro.playerID: reward(141, 260), second.playerID: reward(99, 180),
		third.playerID: reward(17, 20)} // 16.5 rounds up
	assertEqual(t, raceOf(object(h.sink(second).last(t)["room"]))["rewards"], shown)
	settlement := h.recorder.settlements()[0]
	assertEqual(t, settlement.Rewards, []contract.RaceReward{
		{PlayerID: pro.playerID, AccountID: "acc-pro", Exp: 94, Lucci: 130},
		{PlayerID: second.playerID, Exp: 66, Lucci: 90},
		{PlayerID: third.playerID, Exp: 11, Lucci: 10},
	})
	for _, reward := range settlement.Rewards {
		credited := rates.Apply(rewards.Reward{Exp: int64(reward.Exp), Lucci: int64(reward.Lucci)})
		assertEqual(t, shown[reward.PlayerID], map[string]any{"exp": int(credited.Exp), "lucci": int(credited.Lucci)})
	}
	// The settlement names the rates it was shown with; the data service
	// credits with them even if its configuration changed meanwhile.
	if settlement.ExpRate == nil || *settlement.ExpRate != 1.5 || settlement.LucciRate == nil || *settlement.LucciRate != 2 {
		t.Fatalf("settlement rates %v %v", settlement.ExpRate, settlement.LucciRate)
	}

	// A rate change reaches the next race only; this race's snapshot keeps its numbers.
	rates = rewards.DefaultRates()
	room := h.command(second, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, raceOf(room)["rewards"], shown)
}

func finishRequest(roomID, raceID string, elapsedMs int) map[string]any {
	return map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": elapsedMs}
}

// Rewards do not trust the reported times alone: a finish counts only when
// the server saw at least 10 s of racing before it arrived and the
// reported time is at most 3 s shorter than that. Otherwise the racer earns
// the unfinished reward, and the counted finishers rank ahead. race.results
// stay exactly as Java ranks the reported times.
func TestRewardsUseServerObservedRaceTime(t *testing.T) {
	t.Run("instant finishes", func(t *testing.T) {
		h := newHarness(t)
		players := []*Client{h.connectAccount("A", "acc-a"), h.connectAccount("B", "acc-b")}
		roomID, raceID := h.startRace(players, "ordinary", "speedIndiCombine", 2)
		for i, p := range players {
			h.must(p, finishRequest(roomID, raceID, i))
		}
		rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
		assertEqual(t, rc["results"], []any{
			map[string]any{"playerId": players[0].playerID, "rank": 1, "elapsedMs": 0, "points": 10},
			map[string]any{"playerId": players[1].playerID, "rank": 2, "elapsedMs": 1, "points": 8},
		})
		assertEqual(t, rc["rewards"], map[string]any{players[0].playerID: reward(11, 10),
			players[1].playerID: reward(11, 10)})
	})
	t.Run("reported time too short", func(t *testing.T) {
		h := newHarness(t)
		cheat, honest, slow := h.connectAccount("Cheat", "acc-cheat"), h.connect("Honest"), h.connect("Slow")
		roomID, raceID := h.startRace([]*Client{cheat, honest, slow}, "ordinary", "speedIndiCombine", 3)
		h.clock.Advance(60 * time.Second)
		h.must(cheat, finishRequest(roomID, raceID, 20_000))  // 60 s observed
		h.must(honest, finishRequest(roomID, raceID, 57_000)) // exactly 3 s under: counts
		h.clock.Advance(time.Second)
		h.must(slow, finishRequest(roomID, raceID, 57_999)) // 61 s observed: 1 ms too short
		rc := raceOf(object(h.sink(honest).last(t)["room"]))
		assertEqual(t, rc["results"], []any{
			map[string]any{"playerId": cheat.playerID, "rank": 1, "elapsedMs": 20_000, "points": 10},
			map[string]any{"playerId": honest.playerID, "rank": 2, "elapsedMs": 57_000, "points": 8},
			map[string]any{"playerId": slow.playerID, "rank": 3, "elapsedMs": 57_999, "points": 6},
		})
		// N = 3: Honest is the only counted finisher, so 1st (p = 1).
		assertEqual(t, rc["rewards"], map[string]any{cheat.playerID: reward(11, 10),
			honest.playerID: reward(94, 130), slow.playerID: reward(11, 10)})
		assertEqual(t, h.recorder.settlements()[0].Rewards[0],
			contract.RaceReward{PlayerID: cheat.playerID, AccountID: "acc-cheat", Exp: 11, Lucci: 10})
	})
	t.Run("ten seconds", func(t *testing.T) {
		h := newHarness(t)
		players := []*Client{h.connect("A"), h.connect("B")}
		roomID, raceID := h.startRace(players, "ordinary", "speedIndiInfinit", 2)
		h.clock.Advance(9_999 * time.Millisecond)
		h.must(players[0], finishRequest(roomID, raceID, 9_999))
		h.clock.Advance(time.Millisecond)
		h.must(players[1], finishRequest(roomID, raceID, 10_000))
		rc := raceOf(object(h.sink(players[0]).last(t)["room"]))
		// B is the only counted finisher: 1st of 2 in an Infinit channel.
		assertEqual(t, rc["rewards"], map[string]any{players[0].playerID: reward(10, 10),
			players[1].playerID: reward(80, 120)})
	})
}

// A roadblock race that ends within 10 s of racing, for any reason, pays
// everyone the unfinished reward (the runner's time is the server's).
func TestShortRoadblockRacePaysUnfinished(t *testing.T) {
	for _, reason := range []string{"finish", "runner-left"} {
		t.Run(reason, func(t *testing.T) {
			h := newHarness(t)
			players := []*Client{h.connectAccount("Runner", "acc-runner")}
			for _, name := range []string{"B1", "B2", "B3", "B4"} {
				players = append(players, h.connect(name))
			}
			roomID, raceID := h.startRace(players, "roadblock", "speedIndiCombine", 5)
			h.clock.Advance(9_999 * time.Millisecond)
			if reason == "finish" {
				h.must(players[0], finishRequest(roomID, raceID, 60_000))
			} else {
				h.must(players[0], map[string]any{"type": "leave", "roomId": roomID})
			}
			rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
			assertEqual(t, object(rc["roadblockOutcome"])["reason"], reason)
			want := map[string]any{}
			for _, p := range players {
				want[p.playerID] = reward(11, 10)
			}
			if reason == "runner-left" {
				delete(want, players[0].playerID)
			}
			assertEqual(t, rc["rewards"], want)
		})
	}
}

// Roadblock: a racer who leaves during the race earns nothing, even when
// their side wins; N still counts every loaded racer.
func TestRoadblockLeaverEarnsNothing(t *testing.T) {
	h := newHarness(t)
	players := []*Client{h.connectAccount("Runner", "acc-runner"), h.connectAccount("Blocker", "acc-blocker")}
	for _, name := range []string{"B2", "B3", "B4"} {
		players = append(players, h.connect(name))
	}
	roomID, raceID := h.startRace(players, "roadblock", "speedIndiCombine", 5)
	h.clock.Advance(time.Second)
	h.must(players[1], map[string]any{"type": "leave", "roomId": roomID})
	// The leaver races elsewhere meanwhile, and even comes back.
	h.command(players[1], createRequest(map[string]any{"capacity": 2}))
	h.must(players[1], map[string]any{"type": "leave", "roomId": h.lobby.clientRoom(players[1])})
	h.command(players[1], map[string]any{"type": "join", "roomId": roomID})
	h.clock.Advance(180 * time.Second)
	rc := raceOf(object(h.sink(players[2]).last(t)["room"]))
	assertEqual(t, object(rc["roadblockOutcome"])["reason"], "timeout")
	// N = 5: the blockers win (1st, 105 / 150), the runner is last (50 / 70).
	assertEqual(t, rc["rewards"], map[string]any{players[0].playerID: reward(50, 70),
		players[2].playerID: reward(105, 150), players[3].playerID: reward(105, 150),
		players[4].playerID: reward(105, 150)})
	settlement := h.recorder.settlements()[0]
	if len(settlement.Rewards) != 4 || settlement.Rewards[0].AccountID != "acc-runner" {
		t.Fatalf("settlement rewards %+v (raceID %s)", settlement.Rewards, raceID)
	}
}

// Product rule: on a team tie neither team gets the x1.2 bonus, while the
// snapshot's winningTeam stays Java's (team 1).
func TestTeamTieHasNoTeamBonus(t *testing.T) {
	h := newHarness(t)
	players := []*Client{h.connectAccount("A", "acc-a"), h.connect("B"), h.connect("C"), h.connect("D")}
	roomID, raceID := h.startRace(players, "ordinary", "speedTeamInfinit", 4)
	h.clock.Advance(60 * time.Second)
	// Team 1 = players 0 and 2, team 2 = players 1 and 3. Order 1 (10), 0 (8),
	// 2 (6), 3 (4): 14 to 14.
	for i, idx := range []int{1, 0, 2, 3} {
		h.must(players[idx], finishRequest(roomID, raceID, 60_000+i))
	}
	rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
	assertEqual(t, rc["teamScores"], map[string]any{"1": 14, "2": 14})
	assertEqual(t, rc["winningTeam"], 1)
	// N = 4, p = 1, 2/3, 1/3, 0; no bonus: 30+50p+10, 40+80p+20.
	assertEqual(t, rc["rewards"], map[string]any{
		players[1].playerID: reward(90, 140),
		players[0].playerID: reward(73, 113),
		players[2].playerID: reward(57, 87),
		players[3].playerID: reward(40, 60),
	})
}
