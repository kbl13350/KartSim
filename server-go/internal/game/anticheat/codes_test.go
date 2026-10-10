package anticheat

import (
	"slices"
	"testing"

	"kartsim/internal/shared/contract"
)

// Every check is one the data service knows (and the admin console names).
func TestCodesAreInTheContract(t *testing.T) {
	codes := []string{CodeBadFrame, CodeTeleport, CodeSpeed, CodeClock, CodeProgress, CodeLap, CodeFinishTime,
		CodeFinishEarly, CodeFinishFast, CodeCubeRate}
	for _, code := range codes {
		if !slices.Contains(contract.AntiCheatCodes, code) {
			t.Errorf("%s is not in contract.AntiCheatCodes", code)
		}
	}
	if len(codes) != len(contract.AntiCheatCodes) {
		t.Errorf("contract.AntiCheatCodes %v, checks %v", contract.AntiCheatCodes, codes)
	}
}
