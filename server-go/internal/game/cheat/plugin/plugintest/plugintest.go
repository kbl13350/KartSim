// Package plugintest builds the test anti-cheat plugin
// (../testdata/testplugin) for the node's tests.
package plugintest

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
)

var (
	once  sync.Once
	built string
	err   error
)

// Build compiles the test plugin once per test binary and returns its
// path; it skips the test when no Go toolchain is at hand.
func Build(tb testing.TB) string {
	tb.Helper()
	once.Do(func() {
		_, file, _, _ := runtime.Caller(0)
		source := filepath.Join(filepath.Dir(file), "..", "testdata", "testplugin")
		goTool := filepath.Join(runtime.GOROOT(), "bin", "go")
		if _, statErr := os.Stat(goTool); statErr != nil {
			goTool, err = exec.LookPath("go")
			if err != nil {
				return
			}
		}
		dir, mkErr := os.MkdirTemp("", "kart-testplugin-")
		if mkErr != nil {
			err = mkErr
			return
		}
		built = filepath.Join(dir, "anticheat.wasm")
		cmd := exec.Command(goTool, "build", "-buildmode=c-shared", "-o", built, ".")
		cmd.Dir = source
		cmd.Env = append(os.Environ(), "GOOS=wasip1", "GOARCH=wasm", "CGO_ENABLED=0")
		if output, buildErr := cmd.CombinedOutput(); buildErr != nil {
			err = &buildError{output: string(output), err: buildErr}
		}
	})
	if err != nil {
		if _, ok := err.(*exec.Error); ok {
			tb.Skipf("no Go toolchain to build the test plugin: %v", err)
		}
		tb.Fatalf("build the test plugin: %v", err)
	}
	return built
}

type buildError struct {
	output string
	err    error
}

func (e *buildError) Error() string { return e.err.Error() + "\n" + e.output }
