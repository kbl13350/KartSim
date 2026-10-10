// Package plugin loads an anti-cheat plugin: a WebAssembly (WASI reactor)
// module implementing ABI 1 (ANTICHEAT.md), run in process by wazero (pure
// Go, so the node stays a static binary). It implements cheat.Guard.
//
// ABI 1: the module exports ac_buffer(size u32) -> u32, the address of a
// buffer of size bytes the host writes a request into, and ac_call(op u32,
// length u32) -> u64, which handles the request and returns its reply's
// address << 32 | length (0: an empty reply). The operations and their
// encodings are the op* constants below. Calls come one at a time.
package plugin

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"

	"kartsim/internal/game/cheat"
)

// ABI is the plugin interface version this host speaks.
const ABI = 1

// Operations. JSON requests and replies use the cheat package's field
// names; binary ones are little-endian.
const (
	opInit        = 1  // JSON {"abi","env"} -> JSON {"abi","name","version","mode"} | {"error"}
	opRace        = 2  // JSON {"race": RaceInfo, "now"} -> u32 race
	opRacer       = 3  // JSON {"race","playerId","kart"} -> u32 racer
	opMotion      = 4  // u32 racer, u8 kind, u8 valid, i64 now, payload -> Violation JSON | empty
	opFinish      = 5  // JSON {"racer", Finish fields} -> JSON {"violation","stats"} | empty
	opItemUse     = 6  // u32 racer, i32 item -> empty
	opCube        = 7  // u32 racer, i32 cube, i64 now -> Violation JSON | empty
	opTeamCharge  = 8  // u32 racer, f64 amount, i64 now -> Violation JSON | empty
	opProgressCap = 9  // u32 race, i32 lap, i64 racedMs -> f64 | empty
	opEndRace     = 10 // u32 race -> empty
)

// FileName is the plugin's file name in the default places (Find).
const FileName = "anticheat.wasm"

// Find returns the plugin to load: configured (KART_ANTICHEAT_PLUGIN) when
// set ("off" or "none": no plugin), otherwise the first existing of
// plugins/anticheat.wasm next to the executable, one level above it (the
// repository's server-go/plugins for server-go/bin), lib/kart/plugins
// beside its directory (/usr/local/lib/kart/plugins for /usr/local/bin,
// the Docker image) and in the working directory; "" when there is none.
func Find(configured, executable string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(configured)) {
	case "off", "none":
		return "", nil
	case "":
	default:
		if _, err := os.Stat(configured); err != nil {
			return "", fmt.Errorf("KART_ANTICHEAT_PLUGIN: %w", err)
		}
		return configured, nil
	}
	var candidates []string
	if executable != "" {
		dir := filepath.Dir(executable)
		candidates = append(candidates, filepath.Join(dir, "plugins", FileName),
			filepath.Join(dir, "..", "plugins", FileName),
			filepath.Join(dir, "..", "lib", "kart", "plugins", FileName))
	}
	candidates = append(candidates, filepath.Join("plugins", FileName))
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return filepath.Clean(candidate), nil
		}
	}
	return "", nil
}

// Plugin is a loaded anti-cheat plugin. A plugin that fails a call (a trap,
// a malformed reply) is switched off for good: the node keeps running
// without checks, and the failure is logged once.
type Plugin struct {
	// Name, Version and Mode are what the plugin reported at init (Mode
	// describes how it handles a failed check, in its own words).
	Name, Version, Mode string

	log      *slog.Logger
	ctx      context.Context
	runtime  wazero.Runtime
	module   api.Module
	buffer   api.Function
	call     api.Function
	mu       sync.Mutex
	stack    []uint64
	disabled bool
}

// Load compiles and initialises the plugin at path with the node's
// KART_ANTICHEAT* settings.
func Load(ctx context.Context, path string, env map[string]string, log *slog.Logger) (*Plugin, error) {
	if log == nil {
		log = slog.Default()
	}
	wasm, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	runtime := wazero.NewRuntime(ctx)
	ok := false
	defer func() {
		if !ok {
			_ = runtime.Close(ctx)
		}
	}()
	if _, err := wasi_snapshot_preview1.Instantiate(ctx, runtime); err != nil {
		return nil, err
	}
	compiled, err := runtime.CompileModule(ctx, wasm)
	if err != nil {
		return nil, fmt.Errorf("anti-cheat plugin %s: %w", path, err)
	}
	module, err := runtime.InstantiateModule(ctx, compiled,
		wazero.NewModuleConfig().WithName("anticheat").WithStartFunctions("_initialize"))
	if err != nil {
		return nil, fmt.Errorf("anti-cheat plugin %s: %w", path, err)
	}
	p := &Plugin{log: log, ctx: ctx, runtime: runtime, module: module,
		buffer: module.ExportedFunction("ac_buffer"), call: module.ExportedFunction("ac_call"),
		stack: make([]uint64, 2)}
	if p.buffer == nil || p.call == nil {
		return nil, fmt.Errorf("anti-cheat plugin %s does not export ac_buffer and ac_call", path)
	}
	request, _ := json.Marshal(map[string]any{"abi": ABI, "env": env})
	reply, err := p.roundTrip(opInit, request)
	if err != nil {
		return nil, fmt.Errorf("anti-cheat plugin %s: %w", path, err)
	}
	var init struct {
		ABI     int    `json:"abi"`
		Name    string `json:"name"`
		Version string `json:"version"`
		Mode    string `json:"mode"`
		Error   string `json:"error"`
	}
	if err := json.Unmarshal(reply, &init); err != nil {
		return nil, fmt.Errorf("anti-cheat plugin %s: init reply: %w", path, err)
	}
	if init.Error != "" {
		return nil, fmt.Errorf("anti-cheat plugin %s: %s", path, init.Error)
	}
	if init.ABI != ABI {
		return nil, fmt.Errorf("anti-cheat plugin %s speaks ABI %d, the node %d", path, init.ABI, ABI)
	}
	p.Name, p.Version, p.Mode = init.Name, init.Version, init.Mode
	ok = true
	return p, nil
}

// Close releases the plugin.
func (p *Plugin) Close(ctx context.Context) error { return p.runtime.Close(ctx) }

// roundTrip writes a request, calls op and copies the reply out.
func (p *Plugin) roundTrip(op uint32, request []byte) ([]byte, error) {
	p.stack[0] = uint64(len(request))
	if err := p.buffer.CallWithStack(p.ctx, p.stack); err != nil {
		return nil, err
	}
	if len(request) > 0 && !p.module.Memory().Write(uint32(p.stack[0]), request) {
		return nil, errors.New("request buffer out of range")
	}
	p.stack[0], p.stack[1] = uint64(op), uint64(len(request))
	if err := p.call.CallWithStack(p.ctx, p.stack); err != nil {
		return nil, err
	}
	result := p.stack[0]
	if result == 0 {
		return nil, nil
	}
	reply, ok := p.module.Memory().Read(uint32(result>>32), uint32(result))
	if !ok {
		return nil, errors.New("reply out of range")
	}
	return append([]byte(nil), reply...), nil
}

// request calls op unless the plugin is off; a failure switches it off.
func (p *Plugin) request(op uint32, request []byte) []byte {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.disabled {
		return nil
	}
	reply, err := p.roundTrip(op, request)
	if err != nil {
		p.fail(op, err)
		return nil
	}
	return reply
}

func (p *Plugin) fail(op uint32, err error) {
	p.disabled = true
	p.log.Error("anti-cheat plugin failed; the node runs on without its checks", "op", op, "error", err)
}

func (p *Plugin) handle(op uint32, request []byte) uint32 {
	reply := p.request(op, request)
	if len(reply) != 4 {
		return 0
	}
	return binary.LittleEndian.Uint32(reply)
}

func (p *Plugin) violation(op uint32, reply []byte) *cheat.Violation {
	if len(reply) == 0 {
		return nil
	}
	var v cheat.Violation
	if err := json.Unmarshal(reply, &v); err != nil || v.Code == "" ||
		(v.Action != cheat.ActionKick && v.Action != cheat.ActionLog) {
		p.mu.Lock()
		if !p.disabled {
			p.fail(op, fmt.Errorf("malformed violation %q", reply))
		}
		p.mu.Unlock()
		return nil
	}
	return &v
}

// StartRace implements cheat.Guard.
func (p *Plugin) StartRace(info cheat.RaceInfo, now int64) cheat.Race {
	request, _ := json.Marshal(map[string]any{"race": info, "now": now})
	return &race{p: p, handle: p.handle(opRace, request)}
}

type race struct {
	p      *Plugin
	handle uint32
}

func (r *race) Racer(playerID string, kart int) cheat.Racer {
	if r.handle == 0 {
		return &racer{p: r.p}
	}
	request, _ := json.Marshal(map[string]any{"race": r.handle, "playerId": playerID, "kart": kart})
	return &racer{p: r.p, handle: r.p.handle(opRacer, request)}
}

func (r *race) ProgressCap(lap int, racedMs int64) (float64, bool) {
	if r.handle == 0 {
		return 0, false
	}
	var request [16]byte
	binary.LittleEndian.PutUint32(request[:], r.handle)
	binary.LittleEndian.PutUint32(request[4:], uint32(int32(lap)))
	binary.LittleEndian.PutUint64(request[8:], uint64(racedMs))
	reply := r.p.request(opProgressCap, request[:])
	if len(reply) != 8 {
		return 0, false
	}
	value := math.Float64frombits(binary.LittleEndian.Uint64(reply))
	return value, !math.IsNaN(value) && !math.IsInf(value, 0)
}

func (r *race) End() {
	if r.handle == 0 {
		return
	}
	var request [4]byte
	binary.LittleEndian.PutUint32(request[:], r.handle)
	r.p.request(opEndRace, request[:])
	r.handle = 0
}

type racer struct {
	p      *Plugin
	handle uint32
	motion []byte
}

func (x *racer) Motion(kind int, valid bool, now int64, payload []byte) *cheat.Violation {
	if x.handle == 0 {
		return nil
	}
	request := binary.LittleEndian.AppendUint32(x.motion[:0], x.handle)
	request = append(request, byte(kind), 0)
	if valid {
		request[5] = 1
	}
	request = binary.LittleEndian.AppendUint64(request, uint64(now))
	request = append(request, payload...)
	x.motion = request
	return x.p.violation(opMotion, x.p.request(opMotion, request))
}

func (x *racer) Finish(f cheat.Finish) (*cheat.Violation, map[string]any) {
	if x.handle == 0 {
		return nil, nil
	}
	request, _ := json.Marshal(struct {
		Racer uint32 `json:"racer"`
		cheat.Finish
	}{x.handle, f})
	reply := x.p.request(opFinish, request)
	if len(reply) == 0 {
		return nil, nil
	}
	var result struct {
		Violation json.RawMessage `json:"violation"`
		Stats     map[string]any  `json:"stats"`
	}
	if err := json.Unmarshal(reply, &result); err != nil {
		x.p.mu.Lock()
		if !x.p.disabled {
			x.p.fail(opFinish, fmt.Errorf("malformed finish reply %q", reply))
		}
		x.p.mu.Unlock()
		return nil, nil
	}
	var v *cheat.Violation
	if len(result.Violation) > 0 && string(result.Violation) != "null" {
		v = x.p.violation(opFinish, result.Violation)
	}
	return v, result.Stats
}

func (x *racer) ItemUse(itemID int) {
	if x.handle == 0 {
		return
	}
	var request [8]byte
	binary.LittleEndian.PutUint32(request[:], x.handle)
	binary.LittleEndian.PutUint32(request[4:], uint32(int32(itemID)))
	x.p.request(opItemUse, request[:])
}

func (x *racer) Cube(cubeID int, now int64) *cheat.Violation {
	if x.handle == 0 {
		return nil
	}
	var request [16]byte
	binary.LittleEndian.PutUint32(request[:], x.handle)
	binary.LittleEndian.PutUint32(request[4:], uint32(int32(cubeID)))
	binary.LittleEndian.PutUint64(request[8:], uint64(now))
	return x.p.violation(opCube, x.p.request(opCube, request[:]))
}

func (x *racer) TeamCharge(amount float64, now int64) *cheat.Violation {
	if x.handle == 0 {
		return nil
	}
	var request [20]byte
	binary.LittleEndian.PutUint32(request[:], x.handle)
	binary.LittleEndian.PutUint64(request[4:], math.Float64bits(amount))
	binary.LittleEndian.PutUint64(request[12:], uint64(now))
	return x.p.violation(opTeamCharge, x.p.request(opTeamCharge, request[:]))
}

var _ cheat.Guard = (*Plugin)(nil)
