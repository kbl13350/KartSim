package lobby

import (
	"crypto/sha256"
	"encoding/hex"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"

	"kartsim/internal/game/brawl"
)

// Track and race data each client gameplay mode needs (GameModes.java).

const roadblockLimitMs = 180_000

// maxRoomCapacity is the most seats a room has, but for a 50人乱斗 room
// (brawl.Slots).
const maxRoomCapacity = 8

var (
	roadblockTracks = []string{
		"desert_I01", "village_I02", "village_R01", "ice_I05", "ice_R04",
		"tomb_I01", "tomb_R01", "mine_I02", "fairy_I04", "china_I02",
		"castle_I02", "castle_I03", "castle_I06", "park_R01", "steam_I01",
		"jurassic_R01", "forest_I01_rvs", "forest_I05_rvs", "forest_I07_rvs",
		"village_I01_rvs", "village_I13_rvs", "ice_I02_rvs", "ice_I04_rvs",
		"northeu_I04_rvs"}
	giantTracks = []string{
		"village_R01", "village_I04", "village_I05", "forest_I03", "forest_I04",
		"forest_I05", "forest_I07", "desert_I03", "ice_I03", "tomb_I04",
		"pirate_I03", "moonhill_I01", "moonhill_I03", "gold_I01", "gold_I03",
		"china_I01", "china_I04"}
	lteTracks     = []string{"jurassic_R02", "beach_R05", "moonhill_R06"}
	defaultTracks = []string{"village_R01", "desert_I01", "forest_I01", "ice_I03"}

	gameplays = []string{"ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp", "item", "brawl", "brave"}

	// rpKarts were checked against the local P3553 catalog, model, parameter,
	// animation-frame and texture resources. The server cannot trust an
	// arbitrary kart ID supplied in hello/equipment.
	rpKarts = []int{387, 390, 378, 361}
	// rpPoolRevision is the SHA-256 of Java's List.toString() of rpKarts.
	rpPoolRevision = sha256Hex("[387, 390, 378, 361]")
)

func validateCreation(gameplay, channel, version string, capacity int) error {
	if !slices.Contains(gameplays, gameplay) {
		return fail(http.StatusBadRequest, "INVALID_GAMEPLAY")
	}
	if gameplay != "ordinary" && version != "p3553" {
		return fail(http.StatusBadRequest, "RESOURCE_VERSION_UNSUPPORTED")
	}
	if gameplay == "brave" {
		if channel != "speedTeamCombine" {
			return fail(http.StatusBadRequest, "INVALID_CHANNEL")
		}
		if capacity < 4 || capacity > 8 || capacity%2 != 0 {
			return fail(http.StatusBadRequest, "INVALID_CAPACITY")
		}
	}
	if (gameplay == "roadblock" || gameplay == "giant" || gameplay == "brawl") && channel != "speedIndiCombine" {
		return fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	if (gameplay == "grip" || gameplay == "lte") && !strings.HasSuffix(channel, "Combine") {
		return fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	// The item channels run only item races, and item races only run there.
	if (gameplay == "item") != isItemChannel(channel) {
		return fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	if gameplay == "roadblock" && capacity < 5 {
		return fail(http.StatusBadRequest, "NOT_ENOUGH_PLAYERS")
	}
	// Only a 50人乱斗 room seats more than the release's eight.
	if gameplay != "brawl" && capacity > maxRoomCapacity {
		return fail(http.StatusBadRequest, "INVALID_CAPACITY")
	}
	return nil
}

func initializeTrack(r *room) {
	if r.gameplay == "brave" {
		r.trackID = braveTrack
	}
	if r.gameplay == "roadblock" || r.gameplay == "lte" {
		r.trackID = ""
		code := 0
		r.randomTrackCode = &code
	}
}

func validateTrack(r *room, trackID string) error {
	switch r.gameplay {
	case "brave":
		if trackID != braveTrack {
			return fail(http.StatusBadRequest, "INVALID_TRACK")
		}
	case "roadblock", "lte":
		return fail(http.StatusBadRequest, "TRACK_FIXED_TO_RANDOM")
	case "giant":
		if !slices.Contains(giantTracks, trackID) {
			return fail(http.StatusBadRequest, "INVALID_TRACK")
		}
	case "brawl":
		if brawl.TrackByID(trackID) == nil {
			return fail(http.StatusBadRequest, "INVALID_TRACK")
		}
	}
	return nil
}

func validateRandomTrack(r *room, code int) error {
	if r.gameplay == "brave" {
		return fail(http.StatusBadRequest, "INVALID_TRACK")
	}
	if (r.gameplay == "roadblock" || r.gameplay == "lte" || r.gameplay == "giant" || r.gameplay == "brawl") &&
		code != 0 {
		return fail(http.StatusBadRequest, "INVALID_TRACK")
	}
	return nil
}

func chooseTrack(r *room) string {
	if r.trackID != "" {
		return r.trackID
	}
	pool := randomTrackPool(r)
	return pool[rand.IntN(len(pool))]
}

func randomTrackPool(r *room) []string {
	var pool []string
	switch r.gameplay {
	case "roadblock":
		pool = roadblockTracks
	case "lte":
		pool = lteTracks
	case "giant":
		pool = giantTracks
	case "brawl":
		pool = brawl.TrackIDs()
	default:
		pool = defaultTracks
	}
	return pool
}

func addRaceData(r *room, rc *race) {
	switch r.gameplay {
	case "brave":
		freezeBraveRace(rc)
	case "roadblock":
		rc.roadblockRunner = r.hostID
		rc.roadblock = obj{
			{"ruleset", "web-roadblock-v1"},
			{"runnerId", r.hostID},
			{"limitMs", roadblockLimitMs},
			{"noRunnerManualReset", true},
		}
	case "giant":
		rc.giant = obj{{"ruleset", "p948-giant-p3553-web-v1"}}
	case "lte":
		rc.lte = obj{{"ruleset", "web-lte-v1"}, {"featureSet", "dodge-trial"}}
	case "rp":
		rc.rp = rpDraws(r)
	case "brawl":
		rc.brawl = &brawlRace{}
	}
}

func rpDraws(r *room) obj {
	draws := make(obj, 0, len(r.members))
	for _, m := range r.members {
		kart := rpKarts[rand.IntN(len(rpKarts))]
		draws = append(draws, field{m.playerID, obj{{"kartId", kart}, {"flyingPetId", 0}}})
	}
	return obj{
		{"ruleset", "web-rp-speed-v1"},
		{"poolRevision", rpPoolRevision},
		{"draws", draws},
	}
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

// dealRandomTeams (隊伍隨機分配, not in Java) shuffles the members and splits
// them into two teams as even as possible: the first half joins team 1 and
// takes slots 0…, the rest team 2 with slots 4…. Closed slots a dealt
// member lands on open again.
func dealRandomTeams(r *room) {
	dealt := append([]*member(nil), r.members...)
	rand.Shuffle(len(dealt), func(i, j int) { dealt[i], dealt[j] = dealt[j], dealt[i] })
	first := (len(dealt) + 1) / 2
	for i, m := range dealt {
		if i < first {
			m.team, m.slot = 1, i
		} else {
			m.team, m.slot = 2, 4+i-first
		}
	}
	kept := r.closedSlots[:0]
	for _, slot := range r.closedSlots {
		if r.slotMember(slot) == nil {
			kept = append(kept, slot)
		}
	}
	r.closedSlots = kept
}
