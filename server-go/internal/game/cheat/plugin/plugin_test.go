package plugin_test

import (
	"bytes"
	"context"
	"encoding/binary"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kartsim/internal/game/cheat"
	"kartsim/internal/game/cheat/plugin"
	"kartsim/internal/game/cheat/plugin/plugintest"
)

func load(t *testing.T, env map[string]string) (*plugin.Plugin, *bytes.Buffer) {
	t.Helper()
	logs := &bytes.Buffer{}
	p, err := plugin.Load(context.Background(), plugintest.Build(t), env,
		slog.New(slog.NewTextHandler(logs, nil)))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = p.Close(context.Background()) })
	return p, logs
}

// payload is a kind 2 payload at x meters east.
func payload(x float32) []byte {
	b := make([]byte, 80)
	binary.LittleEndian.PutUint32(b[4:], math.Float32bits(x))
	return b
}

func TestPluginCalls(t *testing.T) {
	p, _ := load(t, map[string]string{})
	if p.Name != "testplugin" || p.Mode != "kick" {
		t.Fatalf("init %q %q", p.Name, p.Mode)
	}
	race := p.StartRace(cheat.RaceInfo{TrackID: "village_R01", Gameplay: "ordinary", Speed: 7, StartAt: 100}, 50)
	racer := race.Racer("player-1", 3)
	if v := racer.Motion(2, true, 1000, payload(10)); v != nil {
		t.Fatalf("near frame: %+v", v)
	}
	if v := racer.Motion(2, true, 1064, payload(5000)); v == nil || v.Code != "FAR" ||
		v.Action != cheat.ActionKick || v.Detail != "测试：FAR" {
		t.Fatalf("far frame: %+v", v)
	}
	if v := racer.Motion(2, false, 1100, make([]byte, 12)); v == nil || v.Code != "BAD_FRAME" {
		t.Fatalf("invalid frame: %+v", v)
	}
	racer.ItemUse(6)
	racer.ItemUse(31)
	if limit, ok := race.ProgressCap(1, 20_000); !ok || limit != 12345 {
		t.Fatalf("progress cap %v %v", limit, ok)
	}
	for i, want := range []string{"", "", "CUBES"} {
		v := racer.Cube(i+1, 2000)
		if (v == nil) != (want == "") || (v != nil && v.Code != want) {
			t.Fatalf("cube %d: %+v", i+1, v)
		}
	}
	if v := racer.TeamCharge(2e6, 3000); v == nil || v.Code != "CHARGE" {
		t.Fatalf("team charge: %+v", v)
	}
	v, stats := racer.Finish(cheat.Finish{ElapsedMs: 500, RacedMs: 600})
	if v == nil || v.Code != "QUICK" || stats["frames"] != 3.0 || len(stats["items"].([]any)) != 2 {
		t.Fatalf("finish %+v %v", v, stats)
	}
	v, stats = racer.Finish(cheat.Finish{ElapsedMs: 90_000, RacedMs: 90_100})
	if v != nil || stats == nil {
		t.Fatalf("slow finish %+v %v", v, stats)
	}
	race.End()
	race.End()
	if _, ok := race.ProgressCap(1, 1); ok {
		t.Fatal("an ended race still answers")
	}
}

func TestPluginLogModeAndBrokenSettings(t *testing.T) {
	p, _ := load(t, map[string]string{"KART_ANTICHEAT": "log"})
	racer := p.StartRace(cheat.RaceInfo{}, 0).Racer("p", 0)
	if v := racer.Motion(2, true, 1, payload(5000)); v == nil || v.Action != cheat.ActionLog {
		t.Fatalf("log mode: %+v", v)
	}
	_, err := plugin.Load(context.Background(), plugintest.Build(t), map[string]string{"KART_ANTICHEAT": "broken"}, nil)
	if err == nil || !strings.Contains(err.Error(), "broken settings") {
		t.Fatalf("broken settings: %v", err)
	}
	notWasm := filepath.Join(t.TempDir(), "anticheat.wasm")
	if err := os.WriteFile(notWasm, []byte("not wasm"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := plugin.Load(context.Background(), notWasm, nil, nil); err == nil {
		t.Fatal("a file that is not WebAssembly loaded")
	}
}

// A plugin that traps is switched off: the node runs on without checks.
func TestPluginFailureSwitchesItOff(t *testing.T) {
	p, logs := load(t, nil)
	racer := p.StartRace(cheat.RaceInfo{}, 0).Racer("p", 0)
	plugin.Trap(p)
	if v := racer.Motion(2, true, 1, payload(5000)); v != nil {
		t.Fatalf("a switched-off plugin answered %+v", v)
	}
	if !strings.Contains(logs.String(), "anti-cheat plugin failed") {
		t.Fatalf("logs %s", logs)
	}
}

func TestFind(t *testing.T) {
	dir := t.TempDir()
	write := func(path string) string {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		return path
	}
	executable := filepath.Join(dir, "bin", "kart-game")
	if path, err := plugin.Find("", executable); err != nil || path != "" {
		t.Fatalf("nothing installed: %q %v", path, err)
	}
	above := write(filepath.Join(dir, "plugins", plugin.FileName))
	if path, _ := plugin.Find("", executable); path != above {
		t.Fatalf("above the executable: %q", path)
	}
	beside := write(filepath.Join(dir, "bin", "plugins", plugin.FileName))
	if path, _ := plugin.Find("", executable); path != beside {
		t.Fatalf("beside the executable first: %q", path)
	}
	for _, off := range []string{"off", "none", " OFF "} {
		if path, err := plugin.Find(off, executable); err != nil || path != "" {
			t.Fatalf("%q: %q %v", off, path, err)
		}
	}
	if path, err := plugin.Find(above, executable); err != nil || path != above {
		t.Fatalf("configured: %q %v", path, err)
	}
	if _, err := plugin.Find(filepath.Join(dir, "missing.wasm"), executable); err == nil {
		t.Fatal("a missing configured plugin was accepted")
	}
}
