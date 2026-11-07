package economy

import "testing"

func TestVehicleDetailsCoverageAndValidation(t *testing.T) {
	data, err := DefaultVehicleDetails()
	if err != nil {
		t.Fatal(err)
	}
	if len(data.Vehicles) != 1651 || len(data.MetadataFields) != 13 || len(data.PhysicsFields) != 90 {
		t.Fatalf("coverage: %d/%d/%d", len(data.Vehicles), len(data.MetadataFields), len(data.PhysicsFields))
	}
	for _, vehicle := range data.Vehicles {
		if _, ok := data.Find(vehicle.ID); !ok {
			t.Fatal(vehicle.ID)
		}
		if vehicle.Sources["7"] == "" || len(vehicle.Profile("7")) < 60 {
			t.Fatalf("missing source/values: %s", vehicle.ID)
		}
	}
	changes := EmptyVehicleOverrides()
	changes.Metadata["kartType"] = float64(1)
	if data.Validate("system:practiceKart", changes) == nil {
		t.Fatal("system vehicle category was editable")
	}
	if data.Validate("unknown", EmptyVehicleOverrides()) == nil {
		t.Fatal("unknown identity accepted")
	}
}
