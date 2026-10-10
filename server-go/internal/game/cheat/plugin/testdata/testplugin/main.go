//go:build wasip1

// A test plugin speaking ABI 1 with fixed rules (no real checks), for the
// host's tests (plugintest.Build):
//   - a payload the node says is invalid: BAD_FRAME;
//   - a motion frame whose x (payload float32 at 4) is over 1000: FAR;
//   - a finish under 1 s: QUICK, with {"frames": the racer's frames} as stats;
//   - a third item cube: CUBES; a team charge over 1e6: CHARGE;
//   - the progress cap is 12345 m; op 99 traps.
//
// KART_ANTICHEAT=log turns the kicks into logs, KART_ANTICHEAT=broken
// fails the init.
package main

import (
	"encoding/binary"
	"encoding/json"
	"math"
	"unsafe"
)

var (
	in, out []byte
	action  = "kick"
	next    uint32
	frames  = map[uint32]int{}
	cubes   = map[uint32]int{}
	items   = map[uint32][]int{}
)

//go:wasmexport ac_buffer
func acBuffer(size uint32) uint32 {
	if uint32(cap(in)) < size {
		in = make([]byte, size)
	}
	in = in[:size]
	if size == 0 {
		return 0
	}
	return uint32(uintptr(unsafe.Pointer(unsafe.SliceData(in))))
}

func reply(value any) {
	data, _ := json.Marshal(value)
	out = append(out, data...)
}

func violation(code string) {
	reply(map[string]string{"code": code, "detail": "测试：" + code, "action": action})
}

//go:wasmexport ac_call
func acCall(op, length uint32) uint64 {
	request := in[:length]
	le := binary.LittleEndian
	out = out[:0]
	switch op {
	case 1:
		var init struct {
			ABI int               `json:"abi"`
			Env map[string]string `json:"env"`
		}
		_ = json.Unmarshal(request, &init)
		switch init.Env["KART_ANTICHEAT"] {
		case "broken":
			reply(map[string]any{"error": "broken settings"})
		case "log":
			action = "log"
			fallthrough
		default:
			reply(map[string]any{"abi": 1, "name": "testplugin", "mode": action})
		}
	case 2, 3:
		next++
		out = le.AppendUint32(out, next)
	case 4:
		racer, kind, valid := le.Uint32(request), request[4], request[5] != 0
		payload := request[14:]
		frames[racer]++
		switch {
		case !valid:
			violation("BAD_FRAME")
		case kind >= 2 && len(payload) >= 8 && math.Float32frombits(le.Uint32(payload[4:])) > 1000:
			violation("FAR")
		}
	case 5:
		var f struct {
			Racer     uint32 `json:"racer"`
			ElapsedMs int    `json:"elapsedMs"`
		}
		_ = json.Unmarshal(request, &f)
		var v any
		if f.ElapsedMs < 1000 {
			v = map[string]string{"code": "QUICK", "detail": "测试：QUICK", "action": action}
		}
		reply(map[string]any{"violation": v, "stats": map[string]any{"frames": frames[f.Racer],
			"items": items[f.Racer]}})
	case 6:
		racer := le.Uint32(request)
		items[racer] = append(items[racer], int(int32(le.Uint32(request[4:]))))
	case 7:
		racer := le.Uint32(request)
		if cubes[racer]++; cubes[racer] >= 3 {
			violation("CUBES")
		}
	case 8:
		if math.Float64frombits(le.Uint64(request[4:])) > 1e6 {
			violation("CHARGE")
		}
	case 9:
		out = le.AppendUint64(out, math.Float64bits(12345))
	case 99:
		panic("test trap")
	}
	if len(out) == 0 {
		return 0
	}
	return uint64(uintptr(unsafe.Pointer(unsafe.SliceData(out))))<<32 | uint64(len(out))
}

func main() {}
