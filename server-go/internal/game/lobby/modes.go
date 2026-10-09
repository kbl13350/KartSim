package lobby

import (
	"crypto/sha256"
	"encoding/hex"
	"math/rand/v2"
	"net/http"
	"slices"
	"strings"
)

// Track and race data each client gameplay mode needs (GameModes.java).

const roadblockLimitMs = 180_000

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

	gameplays = []string{"ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp"}

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
	if (gameplay == "roadblock" || gameplay == "giant") && channel != "speedIndiCombine" {
		return fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	if (gameplay == "grip" || gameplay == "lte") && !strings.HasSuffix(channel, "Combine") {
		return fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	if gameplay == "roadblock" && capacity < 5 {
		return fail(http.StatusBadRequest, "NOT_ENOUGH_PLAYERS")
	}
	return nil
}

func initializeTrack(r *room) {
	if r.gameplay == "roadblock" || r.gameplay == "lte" {
		r.trackID = ""
		code := 0
		r.randomTrackCode = &code
	}
}

func validateTrack(r *room, trackID string) error {
	switch r.gameplay {
	case "roadblock", "lte":
		return fail(http.StatusBadRequest, "TRACK_FIXED_TO_RANDOM")
	case "giant":
		if !slices.Contains(giantTracks, trackID) {
			return fail(http.StatusBadRequest, "INVALID_TRACK")
		}
	}
	return nil
}

func validateRandomTrack(r *room, code int) error {
	if (r.gameplay == "roadblock" || r.gameplay == "lte" || r.gameplay == "giant") && code != 0 {
		return fail(http.StatusBadRequest, "INVALID_TRACK")
	}
	return nil
}

func chooseTrack(r *room) string {
	if r.trackID != "" {
		return r.trackID
	}
	var pool []string
	switch r.gameplay {
	case "roadblock":
		pool = roadblockTracks
	case "lte":
		pool = lteTracks
	case "giant":
		pool = giantTracks
	default:
		pool = defaultTracks
	}
	return pool[rand.IntN(len(pool))]
}

func addRaceData(r *room, rc *race) {
	switch r.gameplay {
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
