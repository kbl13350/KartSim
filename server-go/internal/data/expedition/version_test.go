package expedition

import (
	"testing"

	"kartsim/internal/data/canonical"
)

func TestEmbeddedVersionMatchesContent(t *testing.T) {
	stored, computed, err := canonical.Version(embedded)
	if err != nil {
		t.Fatal(err)
	}
	if stored != computed {
		t.Errorf("expedition.json: version %s, content hashes to %s; regenerate with "+
			"`node --import tsx tools/export-expedition-data.mjs` in rewrite/ instead of editing by hand", stored, computed)
	}
}
