package economy

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBuiltinVehicleDirectoryCoverage(t *testing.T) {
	d, err := DefaultVehicleDirectory()
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Vehicles) != 1651 || len(d.byID) != 1651 {
		t.Fatalf("coverage %d/%d", len(d.Vehicles), len(d.byID))
	}
	counts := map[string]int{}
	for _, row := range d.Vehicles {
		counts[row.Category]++
		resolved, ok := d.Find(row.ID)
		if !ok || resolved.InternalID != row.InternalID {
			t.Fatalf("unresolvable vehicle %s", row.ID)
		}
	}
	if counts["speed"] != 1017 || counts["item"] != 630 || counts["system"] != 4 {
		t.Fatalf("categories %v", counts)
	}
}

func TestBuiltinVehicleDirectoryRejectsStaleOrAmbiguousExports(t *testing.T) {
	e, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseVehicleDirectory(embeddedVehicleDirectory, e.Catalog); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		change func(*VehicleDirectory)
	}{
		{"missing catalog kart", func(d *VehicleDirectory) {
			for i, row := range d.Vehicles {
				if row.ItemID > 0 {
					d.Vehicles = append(d.Vehicles[:i], d.Vehicles[i+1:]...)
					return
				}
			}
		}},
		{"duplicate identity", func(d *VehicleDirectory) { d.Vehicles = append(d.Vehicles, d.Vehicles[0]) }},
		{"changed identity", func(d *VehicleDirectory) { d.Vehicles[0].ID = "catalog:3:99999" }},
		{"missing category", func(d *VehicleDirectory) { d.Vehicles[0].Category = "" }},
		{"invalid resource", func(d *VehicleDirectory) { d.Vehicles[0].InternalID = "../escape" }},
		{"bad version", func(d *VehicleDirectory) { d.Version = strings.Repeat("x", 64) }},
		{"negative engine", func(d *VehicleDirectory) { value := -1; d.Vehicles[0].EngineGrade = &value }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var doc VehicleDirectory
			if err := json.Unmarshal(embeddedVehicleDirectory, &doc); err != nil {
				t.Fatal(err)
			}
			tc.change(&doc)
			data, _ := json.Marshal(doc)
			if _, err := ParseVehicleDirectory(data, e.Catalog); err == nil {
				t.Fatal("invalid directory accepted")
			}
		})
	}
}
