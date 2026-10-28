package economy

import (
	_ "embed"
	"fmt"
	"regexp"
	"strconv"
	"sync"
)

//go:embed vehicle-directory.json
var embeddedVehicleDirectory []byte

// DirectoryVehicle is one resource-backed garage vehicle. Catalog IDs and
// system kart keys are separate identities even when they share a display name.
type DirectoryVehicle struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	ItemID        int    `json:"itemId"`
	SystemKey     string `json:"systemKey,omitempty"`
	InternalID    string `json:"internalId"`
	Category      string `json:"category"`
	CategoryTitle string `json:"categoryTitle"`
	EngineGrade   *int   `json:"engineGrade,omitempty"`
	EngineTitle   string `json:"engineTitle"`
}

type VehicleDirectory struct {
	Version       string             `json:"version"`
	GeneratedFrom string             `json:"generatedFrom"`
	Vehicles      []DirectoryVehicle `json:"vehicles"`
	byID          map[string]int
}

var vehicleResourceKey = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,128}$`)
var vehicleInternalID = regexp.MustCompile(`^[A-Za-z0-9_. -]{1,128}$`)

func (d *VehicleDirectory) Find(id string) (DirectoryVehicle, bool) {
	i, ok := d.byID[id]
	if !ok {
		return DirectoryVehicle{}, false
	}
	return d.Vehicles[i], true
}

// ParseVehicleDirectory rejects ambiguous or stale exports before they can
// change the identity of an administrator's persisted visibility settings.
func ParseVehicleDirectory(data []byte, catalog *Catalog) (*VehicleDirectory, error) {
	d := &VehicleDirectory{}
	if err := decodeStrict(data, d); err != nil {
		return nil, fmt.Errorf("economy: vehicle-directory.json: %w", err)
	}
	if !versionPattern.MatchString(d.Version) || d.GeneratedFrom == "" || len(d.Vehicles) == 0 || catalog == nil {
		return nil, fmt.Errorf("economy: vehicle-directory.json: invalid version, source, directory or catalog")
	}
	d.byID = make(map[string]int, len(d.Vehicles))
	categories := make(map[string]string)
	for i, row := range d.Vehicles {
		if row.Title == "" || row.CategoryTitle == "" || row.EngineTitle == "" || !vehicleInternalID.MatchString(row.InternalID) ||
			(row.EngineGrade != nil && (*row.EngineGrade < 0 || *row.EngineGrade > 255)) {
			return nil, fmt.Errorf("economy: vehicle-directory.json: invalid vehicle %q", row.ID)
		}
		switch row.Category {
		case "speed", "item", "other", "system":
		default:
			return nil, fmt.Errorf("economy: vehicle-directory.json: invalid category %q", row.Category)
		}
		if row.ItemID == 0 {
			if row.Category != "system" || !vehicleResourceKey.MatchString(row.SystemKey) || row.ID != "system:"+row.SystemKey {
				return nil, fmt.Errorf("economy: vehicle-directory.json: invalid system kart %q", row.ID)
			}
		} else {
			item, ok := catalog.ItemByKey(CategoryKart, row.ItemID)
			if row.ItemID < 0 || !ok || row.ID != "catalog:3:"+strconv.Itoa(row.ItemID) || row.SystemKey != "" ||
				row.Category == "system" || item.InternalID != row.InternalID {
				return nil, fmt.Errorf("economy: vehicle-directory.json: unknown or mismatched catalog kart %q", row.ID)
			}
			category := "other"
			if item.KartType == 1 {
				category = "item"
			} else if item.KartType == 2 {
				category = "speed"
			}
			if row.Category != category {
				return nil, fmt.Errorf("economy: vehicle-directory.json: wrong vehicle category for %q", row.ID)
			}
		}
		if title, ok := categories[row.Category]; ok && title != row.CategoryTitle {
			return nil, fmt.Errorf("economy: vehicle-directory.json: inconsistent category title for %q", row.Category)
		}
		categories[row.Category] = row.CategoryTitle
		if _, exists := d.byID[row.ID]; exists {
			return nil, fmt.Errorf("economy: vehicle-directory.json: repeated vehicle %q", row.ID)
		}
		d.byID[row.ID] = i
	}
	for _, item := range catalog.Items {
		if item.Category == CategoryKart {
			if _, ok := d.Find("catalog:3:" + strconv.Itoa(item.ItemID)); !ok {
				return nil, fmt.Errorf("economy: vehicle-directory.json: missing catalog kart %d", item.ItemID)
			}
		}
	}
	if _, ok := d.Find("system:" + catalog.Starter.Kart.SystemKey); !ok {
		return nil, fmt.Errorf("economy: vehicle-directory.json: missing starter kart")
	}
	return d, nil
}

var loadVehicleDirectory = sync.OnceValues(func() (*VehicleDirectory, error) {
	data, err := Default()
	if err != nil {
		return nil, err
	}
	return ParseVehicleDirectory(embeddedVehicleDirectory, data.Catalog)
})

func DefaultVehicleDirectory() (*VehicleDirectory, error) { return loadVehicleDirectory() }
