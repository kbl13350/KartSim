package economy

import (
	_ "embed"
	"fmt"
	"sync"
)

//go:embed track-directory.json
var embeddedTrackDirectory []byte

// DirectoryTrack is a visible built-in map. Aliases remain accepted settlement
// IDs, but share the canonical map's visibility setting and are never extra
// choices in the picker. Theme comes from resource metadata, not the ID prefix.
type DirectoryTrack struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Theme      string   `json:"theme"`
	ThemeTitle string   `json:"themeTitle"`
	GameType   string   `json:"gameType"`
	Difficulty *int     `json:"difficulty,omitempty"`
	Reverse    bool     `json:"reverse"`
	Aliases    []string `json:"aliases"`
}

type TrackDirectory struct {
	Version       string           `json:"version"`
	GeneratedFrom string           `json:"generatedFrom"`
	Tracks        []DirectoryTrack `json:"tracks"`
	byID          map[string]int
}

// Find resolves both a current picker ID and a hidden historical alias.
func (d *TrackDirectory) Find(id string) (DirectoryTrack, bool) {
	i, ok := d.byID[id]
	if !ok {
		return DirectoryTrack{}, false
	}
	return d.Tracks[i], true
}

// ParseTrackDirectory validates the visible directory against every accepted
// settlement ID. This catches stale exports and ambiguous/transitive aliases.
func ParseTrackDirectory(data []byte, accepted *Tracks) (*TrackDirectory, error) {
	d := &TrackDirectory{}
	if err := decodeStrict(data, d); err != nil {
		return nil, fmt.Errorf("economy: track-directory.json: %w", err)
	}
	if !versionPattern.MatchString(d.Version) || len(d.Tracks) == 0 || accepted == nil {
		return nil, fmt.Errorf("economy: track-directory.json: invalid version, empty directory or missing accepted tracks")
	}
	d.byID = make(map[string]int)
	themes := make(map[string]string)
	for i, track := range d.Tracks {
		if !trackIDPattern.MatchString(track.ID) || !trackIDPattern.MatchString(track.Theme) ||
			track.Title == "" || track.ThemeTitle == "" || (track.GameType != "item" && track.GameType != "speed") ||
			(track.Difficulty != nil && *track.Difficulty < 0) {
			return nil, fmt.Errorf("economy: track-directory.json: invalid map %q", track.ID)
		}
		if title, ok := themes[track.Theme]; ok && title != track.ThemeTitle {
			return nil, fmt.Errorf("economy: track-directory.json: inconsistent theme title for %s", track.Theme)
		}
		themes[track.Theme] = track.ThemeTitle
		if track.Aliases == nil {
			d.Tracks[i].Aliases = []string{}
		}
		for _, id := range append([]string{track.ID}, track.Aliases...) {
			if !accepted.Has(id) {
				return nil, fmt.Errorf("economy: track-directory.json: unknown settlement ID %q", id)
			}
			if _, exists := d.byID[id]; exists {
				return nil, fmt.Errorf("economy: track-directory.json: repeated ID or alias %q", id)
			}
			d.byID[id] = i
		}
	}
	if len(d.byID) != accepted.Len() {
		return nil, fmt.Errorf("economy: track-directory.json: covers %d of %d settlement IDs", len(d.byID), accepted.Len())
	}
	return d, nil
}

var loadTrackDirectory = sync.OnceValues(func() (*TrackDirectory, error) {
	accepted, err := DefaultTracks()
	if err != nil {
		return nil, err
	}
	return ParseTrackDirectory(embeddedTrackDirectory, accepted)
})

func DefaultTrackDirectory() (*TrackDirectory, error) { return loadTrackDirectory() }
