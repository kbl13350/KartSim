// Package buildinfo names the build of the running binary for status
// pages: the VCS revision Go stamped into it, or "dev".
package buildinfo

import (
	"runtime/debug"
	"sync"
)

// Version is the first 12 characters of the commit the binary was built
// from, with "-dirty" when the tree had changes; "dev" when the build has
// no VCS stamp (go run, go test, a build outside the repository).
var Version = sync.OnceValue(func() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "dev"
	}
	return version(info.Settings)
})

func version(settings []debug.BuildSetting) string {
	revision, modified := "", false
	for _, setting := range settings {
		switch setting.Key {
		case "vcs.revision":
			revision = setting.Value
		case "vcs.modified":
			modified = setting.Value == "true"
		}
	}
	if revision == "" {
		return "dev"
	}
	revision = revision[:min(len(revision), 12)]
	if modified {
		revision += "-dirty"
	}
	return revision
}
