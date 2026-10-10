// Package myroom is the real-time side of My Room (小屋) visits: one
// WebSocket per browser tab while the room screen is open
// (GET /api/myroom/ws), and an in-process hub holding the live rooms. A room
// is keyed by its owner's account; up to MaxMembers riders (the original
// riderCard0..7) walk in it at once, see each other move, chat, and get
// enter/leave notices, and the owner can kick visitors. Rooms live only
// while someone is in them; the durable part (room settings and the
// riders' looks) is each account's profile document, read through Backend.
//
// Lock order: Hub.mu, then conn.mu. Hub methods never block on a socket.
package myroom

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"unicode/utf8"
)

// MaxMembers is the most riders in one room (riderCard0..7).
const MaxMembers = 8

// DefaultEnvironment is the room environment of a profile without one
// (myRoom.bml ID 16 tomb_M01, client local-profile.ts).
const DefaultEnvironment = 16

// Settings are the room settings of an owner's profile (client
// local-profile.ts MyRoomProfile, edited in the roomAdmin dialog).
type Settings struct {
	EnvironmentID int               `json:"environmentId"`
	DisplayName   string            `json:"displayName"`
	Message       string            `json:"message"`
	DisplayKarts  []json.RawMessage `json:"displayKarts"`
	ChatAllowed   bool              `json:"chatAllowed"`
	// Locked: a room password is set; visitors must give it to enter.
	Locked bool `json:"locked"`
	// EtcLocked: 车库/徽章/图鉴/成就是否公开 has a password; visitors must
	// give it to view the owner's emblems, careers and items.
	EtcLocked bool `json:"etcLocked"`

	roomPassword, etcPassword string
}

// RoomPasswordMatches reports whether password opens the room.
func (s Settings) RoomPasswordMatches(password string) bool {
	return !s.Locked || subtle.ConstantTimeCompare([]byte(password), []byte(s.roomPassword)) == 1
}

// EtcPasswordMatches reports whether password opens the owner's emblems,
// careers and items to a visitor.
func (s Settings) EtcPasswordMatches(password string) bool {
	return !s.EtcLocked || subtle.ConstantTimeCompare([]byte(password), []byte(s.etcPassword)) == 1
}

// Profile is what a room needs of an account's profile document.
type Profile struct {
	Settings Settings
	// Appearance is the rider's look for the scene: equipment, initial and
	// the garage builds of its kart and display karts (a LocalProfile
	// subset the client renders like its own profile).
	Appearance json.RawMessage
}

type favoriteKart struct {
	Kind   string `json:"kind"`
	ItemID int    `json:"itemId"`
}

// maxText bounds the room texts copied from a profile (the client allows
// 32 and 120 code points).
const (
	maxDisplayName = 32
	maxMessage     = 120
	maxPassword    = 12
)

func clip(text string, limit int) string {
	if utf8.RuneCountInString(text) <= limit {
		return text
	}
	runes := []rune(text)
	return string(runes[:limit])
}

// ParseProfile reads a profile document; a missing or malformed document
// gives the default room with no appearance.
func ParseProfile(document string) Profile {
	var doc struct {
		Equipment json.RawMessage `json:"equipment"`
		Initial   json.RawMessage `json:"initial"`
		Garage    struct {
			Version int                        `json:"version"`
			Builds  map[string]json.RawMessage `json:"builds"`
		} `json:"garage"`
		MyRoom struct {
			EnvironmentID *int              `json:"environmentId"`
			DisplayName   string            `json:"displayName"`
			Message       string            `json:"message"`
			DisplayKarts  []json.RawMessage `json:"displayKarts"`
			ChatAllowed   *bool             `json:"chatAllowed"`
			RoomPassword  string            `json:"roomPassword"`
			EtcPassword   string            `json:"etcPassword"`
		} `json:"myRoom"`
	}
	profile := Profile{Settings: Settings{EnvironmentID: DefaultEnvironment, DisplayName: "我的小屋",
		DisplayKarts: []json.RawMessage{}, ChatAllowed: true}}
	if document == "" || json.Unmarshal([]byte(document), &doc) != nil {
		return profile
	}
	room := doc.MyRoom
	settings := &profile.Settings
	if room.EnvironmentID != nil && *room.EnvironmentID > 0 {
		settings.EnvironmentID = *room.EnvironmentID
	}
	if room.DisplayName != "" {
		settings.DisplayName = clip(room.DisplayName, maxDisplayName)
	}
	settings.Message = clip(room.Message, maxMessage)
	if room.ChatAllowed != nil {
		settings.ChatAllowed = *room.ChatAllowed
	}
	settings.roomPassword = clip(room.RoomPassword, maxPassword)
	settings.etcPassword = clip(room.EtcPassword, maxPassword)
	settings.Locked = settings.roomPassword != ""
	settings.EtcLocked = settings.etcPassword != ""
	builds := map[string]json.RawMessage{}
	if len(room.DisplayKarts) > 2 {
		room.DisplayKarts = room.DisplayKarts[:2]
	}
	for _, raw := range room.DisplayKarts {
		var kart favoriteKart
		if json.Unmarshal(raw, &kart) != nil || kart.Kind != "kart" || kart.ItemID < 0 {
			continue
		}
		settings.DisplayKarts = append(settings.DisplayKarts, raw)
		if build, ok := doc.Garage.Builds[fmt.Sprintf("%d:0", kart.ItemID)]; ok {
			builds[fmt.Sprintf("%d:0", kart.ItemID)] = build
		}
	}
	if len(doc.Equipment) == 0 || doc.Equipment[0] != '{' {
		return profile
	}
	var equipment struct {
		ItemIDs    map[string]int `json:"itemIds"`
		KartSerial int            `json:"kartSerial"`
	}
	if json.Unmarshal(doc.Equipment, &equipment) == nil {
		key := fmt.Sprintf("%d:%d", equipment.ItemIDs["3"], equipment.KartSerial)
		if build, ok := doc.Garage.Builds[key]; ok {
			builds[key] = build
		}
	}
	initial := json.RawMessage(`""`)
	if len(doc.Initial) > 0 && doc.Initial[0] == '"' {
		initial = doc.Initial
	}
	appearance, err := json.Marshal(struct {
		Equipment json.RawMessage `json:"equipment"`
		Initial   json.RawMessage `json:"initial"`
		Garage    any             `json:"garage"`
	}{doc.Equipment, initial, struct {
		Version int                        `json:"version"`
		Builds  map[string]json.RawMessage `json:"builds"`
	}{1, builds}})
	if err == nil {
		profile.Appearance = appearance
	}
	return profile
}
