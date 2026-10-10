package buildinfo

import (
	"runtime/debug"
	"testing"
)

func TestVersion(t *testing.T) {
	for _, tc := range []struct {
		settings []debug.BuildSetting
		want     string
	}{
		{nil, "dev"},
		{[]debug.BuildSetting{{Key: "vcs.revision", Value: "0123456789abcdef0123"}}, "0123456789ab"},
		{[]debug.BuildSetting{{Key: "vcs.revision", Value: "abc"}, {Key: "vcs.modified", Value: "true"}}, "abc-dirty"},
	} {
		if got := version(tc.settings); got != tc.want {
			t.Errorf("version(%v) = %q, want %q", tc.settings, got, tc.want)
		}
	}
	if Version() == "" {
		t.Fatal("empty version")
	}
}
