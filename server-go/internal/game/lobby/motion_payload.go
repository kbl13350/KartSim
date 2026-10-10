package lobby

// Motion payload validation: the browser's decoder rules. A browser that
// receives a payload it cannot decode drops its whole game connection
// (client/src/multiplayer/client-motion.ts acceptServerMotion), so the node
// never relays one; no honest client sends one, its encoder refuses the same
// values.

import (
	"encoding/binary"
	"math"
)

// kinematicPayloadLength is the payload length of a kinematic motion kind
// 2..10 (payload.ts decodeKinematicSample), or 0 for another kind (kind 1
// has its own lengths).
func kinematicPayloadLength(kind int) int {
	var length int
	switch {
	case kind < 2 || kind > 10:
		return 0
	case kind == 8 || kind == 10:
		length = 151 // routing: motion mode and observed slot (protocol 40; the release: a 16-byte UUID)
	case kind == 7 || kind == 9:
		length = 149
	case kind == 6:
		length = 137
	case kind == 5:
		length = 128
	case kind == 4:
		length = 124
	case kind == 3:
		length = 108
	default:
		length = 80
	}
	if kind >= 9 {
		length += 12
	}
	return length
}

func f32(b []byte, offset int) float32 {
	return math.Float32frombits(binary.LittleEndian.Uint32(b[offset:]))
}

func finite32(value float32) bool {
	return !math.IsNaN(float64(value)) && !math.IsInf(float64(value), 0)
}

// finiteAll reports whether count float32 values from offset are finite.
func finiteAll(b []byte, offset, count int) bool {
	for i := range count {
		if !finite32(f32(b, offset+4*i)) {
			return false
		}
	}
	return true
}

// nonzeroQuaternion mirrors the remote predictor's check: the float32 sum
// of the squared components is finite and positive.
func nonzeroQuaternion(b []byte, offset int) bool {
	var norm float32
	for i := range 4 {
		value := f32(b, offset+4*i)
		norm += value * value
	}
	return finite32(norm) && norm > 0
}

// maxMotionSlot is the highest room slot a frame may name (motion.ts
// MAX_MOTION_SLOT).
const maxMotionSlot = 7

// validReset is payload.ts validReset: the reset started at most 2 s before
// the frame (uint32 arithmetic).
func validReset(tick, startedAt uint32) bool { return tick-startedAt <= 2_000 }

// validPayload reports whether the browser accepts a motion payload of
// kind: payload.ts decodeKinematicSample (kinds 2..10) and
// decodeDrivingSample (kind 1), and the remote predictor's checks.
func validPayload(kind int, b []byte) bool {
	if kind == 1 {
		return validDriving(b)
	}
	if kind < 2 || kind > 10 || len(b) != kinematicPayloadLength(kind) {
		return false
	}
	// tick, then position, quaternion, linear and angular velocity and two
	// more vectors: 19 floats.
	if !finiteAll(b, 4, 19) || !nonzeroQuaternion(b, 16) {
		return false
	}
	tick := binary.LittleEndian.Uint32(b)
	if kind >= 3 {
		if b[98] > 15 || b[99] != 0 || !finiteAll(b, 80, 4) || b[97] > 3 {
			return false
		}
	}
	if kind >= 4 {
		distance := math.Float64frombits(binary.LittleEndian.Uint64(b[108:]))
		if math.IsNaN(distance) || math.IsInf(distance, 0) || binary.LittleEndian.Uint32(b[116:]) > 65_535 {
			return false
		}
	}
	var resetAt uint32
	if len(b) >= 128 {
		resetAt = binary.LittleEndian.Uint32(b[124:])
	}
	if kind == 5 && !validReset(tick, resetAt) {
		return false
	}
	if kind >= 6 {
		flags := b[136]
		if flags > 3 {
			return false
		}
		if flags&2 != 0 {
			if !validReset(tick, resetAt) {
				return false
			}
		} else if resetAt != 0 {
			return false
		}
		if !finiteAll(b, 128, 2) || f32(b, 128) <= 0 || f32(b, 132) <= 0 {
			return false
		}
	}
	if kind >= 7 {
		if b[140] > 3 || (b[138] != 0 && b[138] != 1 && b[138] != 3) {
			return false
		}
		if speed, ready := f32(b, 141), f32(b, 145); !finite32(speed) || speed < 0 || !finite32(ready) || ready < 0 {
			return false
		}
	}
	if kind == 8 || kind == 10 {
		switch b[149] {
		case 0, 1, 2, 3, 5, 6:
		default:
			return false
		}
		if b[150] > maxMotionSlot {
			return false
		}
	}
	if kind >= 9 {
		offset := 149
		if kind == 10 {
			offset = 151
		}
		if !finiteAll(b, offset, 3) {
			return false
		}
	}
	return true
}

// validDriving mirrors decodeDrivingSample: a length its flag bytes imply,
// finite floats, and the remote predictor's refusals (special motion,
// a zero quaternion).
func validDriving(b []byte) bool {
	if len(b) < 113 || len(b) > 137 {
		return false
	}
	flags0, flags1 := b[4], b[5]
	length := 113
	if flags1&7 != 0 {
		// Special remote motion: the predictor refuses it.
		return false
	}
	if flags0&4 != 0 {
		length += 4
	}
	if flags0&8 != 0 {
		length += 4
	}
	if len(b) != length {
		return false
	}
	// Position, quaternion and four vectors from offset 7, then the optional
	// scalars, then (after 2 + 1 + 4 + 4 bytes) two more floats.
	if !finiteAll(b, 7, 19) || !nonzeroQuaternion(b, 19) {
		return false
	}
	offset := 7 + 19*4
	for _, present := range []bool{flags0&4 != 0, flags0&8 != 0} {
		if present {
			if !finite32(f32(b, offset)) {
				return false
			}
			offset += 4
		}
	}
	offset += 2 + 1 + 4 + 4
	return finiteAll(b, offset, 2)
}
