package economy

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBuiltinTrackDirectoryCoverage(t *testing.T) {
	d, err := DefaultTrackDirectory()
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Tracks) != 796 || len(d.byID) != 921 {
		t.Fatalf("coverage %d/%d", len(d.Tracks), len(d.byID))
	}
	korea := 0
	for _, track := range d.Tracks {
		if track.Theme == "korea" {
			korea++
		}
		if track.Aliases == nil {
			t.Fatalf("nil aliases: %s", track.ID)
		}
		for _, id := range track.Aliases {
			resolved, ok := d.Find(id)
			if !ok || resolved.ID != track.ID {
				t.Fatalf("alias %s", id)
			}
		}
	}
	if korea == 0 {
		t.Fatal("Korean theme is missing")
	}
}

func TestBuiltinTrackDirectoryRejectsStaleOrAmbiguousExports(t *testing.T) {
	accepted, err := DefaultTracks()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		change func(*TrackDirectory)
	}{
		{"missing map", func(d *TrackDirectory) { d.Tracks = d.Tracks[1:] }},
		{"unknown alias", func(d *TrackDirectory) { d.Tracks[0].Aliases = append(d.Tracks[0].Aliases, "not_a_track") }},
		{"alias chain", func(d *TrackDirectory) { d.Tracks[0].Aliases = append(d.Tracks[0].Aliases, d.Tracks[1].ID) }},
		{"missing theme", func(d *TrackDirectory) { d.Tracks[0].Theme = "" }},
		{"bad version", func(d *TrackDirectory) { d.Version = strings.Repeat("x", 64) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var doc TrackDirectory
			if err := json.Unmarshal(embeddedTrackDirectory, &doc); err != nil {
				t.Fatal(err)
			}
			tc.change(&doc)
			data, _ := json.Marshal(doc)
			if _, err := ParseTrackDirectory(data, accepted); err == nil {
				t.Fatal("invalid directory accepted")
			}
		})
	}
}
