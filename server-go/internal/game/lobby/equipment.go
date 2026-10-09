package lobby

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strconv"
)

// equipmentSlots are the item slots a valid equipment object must carry.
var equipmentSlots = []int{1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
	32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78}

// maxEquipmentBytes caps a member's stored (compacted) equipment. Java had
// no cap, but every room snapshot repeats each member's equipment and goes
// to every other member, so a padded object (unknown keys are kept) would
// amplify each broadcast. A real one is well under 1 KiB.
const maxEquipmentBytes = 4 << 10

// identifierPattern is the Java "[A-Za-z][A-Za-z0-9_]{0,63}" used with matches().
var identifierPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,63}$`)

// validEquipment mirrors the Java validEquipment over a raw JSON value.
// present=false is Java's null from input.get(key) on a missing key. Unlike
// Java it also refuses equipment larger than maxEquipmentBytes once compacted.
func validEquipment(raw json.RawMessage, present bool) bool {
	if !present || kindOf(raw) != kindObject {
		return false
	}
	if len(raw) > maxEquipmentBytes && len(compactJSON(raw)) > maxEquipmentBytes {
		return false
	}
	var value map[string]json.RawMessage
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	idsRaw, ok := value["itemIds"]
	if !ok || kindOf(idsRaw) != kindObject {
		return false
	}
	var ids map[string]json.RawMessage
	if json.Unmarshal(idsRaw, &ids) != nil || len(ids) != len(equipmentSlots) {
		return false
	}
	for _, slot := range equipmentSlots {
		item, ok := ids[strconv.Itoa(slot)]
		if !ok || !intInRange(item, 0, 65535) {
			return false
		}
	}
	if first, _ := intValue(ids["1"]); first == 0 {
		return false
	}
	for _, key := range []string{"kartSerial", "exceedType", "valueAt3E"} {
		maximum := 65535
		if key == "valueAt3E" {
			maximum = 255
		}
		number, ok := value[key]
		if !ok || !intInRange(number, 0, maximum) {
			return false
		}
	}
	if kart, _ := intValue(ids["3"]); kart == 0 {
		systemKart, ok := value["systemKart"]
		if !ok || !identifier(systemKart) {
			return false
		}
		variant, ok := value["systemKartVariant"]
		return !ok || identifier(variant)
	}
	_, hasKart := value["systemKart"]
	_, hasVariant := value["systemKartVariant"]
	return !hasKart && !hasVariant
}

func intInRange(raw json.RawMessage, min, max int) bool {
	value, ok := intValue(raw)
	return ok && value >= min && value <= max
}

func identifier(raw json.RawMessage) bool {
	value, ok := decodeString(raw)
	return ok && identifierPattern.MatchString(value)
}

// compactJSON stores equipment without insignificant whitespace, the way
// Jackson re-serializes a tree.
func compactJSON(raw json.RawMessage) json.RawMessage {
	var out bytes.Buffer
	if err := json.Compact(&out, raw); err != nil {
		return append(json.RawMessage(nil), raw...)
	}
	return json.RawMessage(out.Bytes())
}
