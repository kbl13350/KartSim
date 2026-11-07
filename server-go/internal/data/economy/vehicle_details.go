package economy

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"
)

//go:embed vehicle-details.json
var embeddedVehicleDetails []byte

type VehicleDetailField struct {
	Key     string  `json:"key"`
	Label   string  `json:"label"`
	Group   string  `json:"group"`
	Type    string  `json:"type"`
	Integer bool    `json:"integer,omitempty"`
	Min     float64 `json:"min,omitempty"`
	Max     float64 `json:"max,omitempty"`
	Unit    string  `json:"unit,omitempty"`
}

type VehicleDetailBase struct {
	ID            string                        `json:"id"`
	Identity      map[string]any                `json:"identity"`
	ParameterPath string                        `json:"parameterPath"`
	Body          map[string]string             `json:"body"`
	Profiles      map[string]map[string]float64 `json:"profiles"`
	Sources       map[string]string             `json:"sources"`
}

type VehicleDetails struct {
	Version        string               `json:"version"`
	MetadataFields []VehicleDetailField `json:"metadataFields"`
	PhysicsFields  []VehicleDetailField `json:"physicsFields"`
	Vehicles       []VehicleDetailBase  `json:"vehicles"`
	byID           map[string]int
}

// Only differences are persisted; deleting a field restores its bundled value.
type VehicleOverrides struct {
	Metadata map[string]any                `json:"metadata"`
	Profiles map[string]map[string]float64 `json:"profiles"`
}

func EmptyVehicleOverrides() VehicleOverrides {
	return VehicleOverrides{Metadata: map[string]any{}, Profiles: map[string]map[string]float64{}}
}

func (d *VehicleDetails) Find(id string) (VehicleDetailBase, bool) {
	i, ok := d.byID[id]
	if !ok {
		return VehicleDetailBase{}, false
	}
	return d.Vehicles[i], true
}

func (b VehicleDetailBase) Profile(speed string) map[string]float64 {
	result := make(map[string]float64, len(b.Profiles["7"]))
	for key, value := range b.Profiles["7"] {
		result[key] = value
	}
	for key, value := range b.Profiles[speed] {
		result[key] = value
	}
	return result
}

func fieldValid(field VehicleDetailField, value any) bool {
	switch field.Type {
	case "string":
		v, ok := value.(string)
		return ok && utf8.ValidString(v) && strings.TrimSpace(v) == v && float64(utf8.RuneCountInString(v)) >= field.Min &&
			float64(utf8.RuneCountInString(v)) <= field.Max && !strings.ContainsAny(v, "<>") && strings.IndexFunc(v, unicode.IsControl) < 0
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "number":
		v, ok := value.(float64)
		return ok && !math.IsNaN(v) && !math.IsInf(v, 0) && v >= field.Min && v <= field.Max && (!field.Integer || math.Trunc(v) == v)
	}
	return false
}

func (d *VehicleDetails) Validate(id string, changes VehicleOverrides) error {
	base, ok := d.Find(id)
	if !ok {
		return fmt.Errorf("unknown vehicle")
	}
	metadata, physics := map[string]VehicleDetailField{}, map[string]VehicleDetailField{}
	for _, field := range d.MetadataFields {
		metadata[field.Key] = field
	}
	for _, field := range d.PhysicsFields {
		physics[field.Key] = field
	}
	for key, value := range changes.Metadata {
		field, ok := metadata[key]
		if !ok || !fieldValid(field, value) || (strings.HasPrefix(id, "system:") && key == "kartType") {
			return fmt.Errorf("invalid metadata %s", key)
		}
	}
	for speed, values := range changes.Profiles {
		if (speed != "4" && speed != "7") || values == nil {
			return fmt.Errorf("invalid speed profile")
		}
		merged := base.Profile(speed)
		for key, value := range values {
			field, ok := physics[key]
			if !ok || !fieldValid(field, value) {
				return fmt.Errorf("invalid physics %s", key)
			}
			merged[key] = value
		}
		if merged["dualBoosterTickMin"] > merged["dualBoosterTickMax"] {
			return fmt.Errorf("minimum dual booster duration exceeds maximum")
		}
	}
	return nil
}

var loadVehicleDetails = sync.OnceValues(func() (*VehicleDetails, error) {
	var result VehicleDetails
	if err := json.Unmarshal(embeddedVehicleDetails, &result); err != nil {
		return nil, err
	}
	directory, err := DefaultVehicleDirectory()
	if err != nil {
		return nil, err
	}
	if !versionPattern.MatchString(result.Version) || len(result.Vehicles) != len(directory.Vehicles) || len(result.PhysicsFields) != 90 {
		return nil, fmt.Errorf("invalid vehicle detail export")
	}
	result.byID = make(map[string]int, len(result.Vehicles))
	for i, vehicle := range result.Vehicles {
		if _, ok := directory.Find(vehicle.ID); !ok {
			return nil, fmt.Errorf("unknown detail vehicle %s", vehicle.ID)
		}
		if _, exists := result.byID[vehicle.ID]; exists {
			return nil, fmt.Errorf("duplicate detail vehicle %s", vehicle.ID)
		}
		result.byID[vehicle.ID] = i
	}
	return &result, nil
})

func DefaultVehicleDetails() (*VehicleDetails, error) { return loadVehicleDetails() }
