package club

import (
	"testing"
	"time"

	"kartsim/internal/data/canonical"
)

func TestEmbeddedVersionMatchesContent(t *testing.T) {
	stored, computed, err := canonical.Version(embedded)
	if err != nil {
		t.Fatal(err)
	}
	if stored != computed {
		t.Errorf("club.json: version %s, content hashes to %s; regenerate with "+
			"`node --import tsx tools/export-club-data.mjs` in client/ instead of editing by hand", stored, computed)
	}
}

func TestMarksAndFrames(t *testing.T) {
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Marks) != 493 || len(d.Frames) != 14 {
		t.Fatalf("marks %d frames %d", len(d.Marks), len(d.Frames))
	}
	basic := 0
	for _, mark := range d.Marks {
		if mark.Basic {
			basic++
		}
	}
	if basic != 9 || !d.MarkUsable(22, 0) || d.MarkUsable(23, 0) || !d.MarkUsable(23, 1) || d.MarkUsable(24, 1) ||
		!d.MarkUsable(24, 2) || d.MarkUsable(99999, 5) {
		t.Fatalf("marks: %d basic", basic)
	}
	if !d.FrameUsable(0, 0) || d.FrameUsable(3, 0) || d.FrameUsable(3, 1) || !d.FrameUsable(3, 2) || d.FrameUsable(11, 5) {
		t.Fatal("frames")
	}
}

func TestWeekAndDay(t *testing.T) {
	at := func(value string) int64 {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			t.Fatal(err)
		}
		return parsed.UnixMilli()
	}
	// 2026-10-08 is a Thursday.
	for value, want := range map[string]string{
		"2026-10-08T00:00:00+08:00": "2026-10-08",
		"2026-10-07T23:59:59+08:00": "2026-10-01",
		"2026-10-14T23:59:59+08:00": "2026-10-08",
		"2026-10-15T00:00:00+08:00": "2026-10-15",
	} {
		if got := Week(at(value)); got != want {
			t.Errorf("Week(%s) = %s, want %s", value, got, want)
		}
	}
	if Day(at("2026-10-09T23:30:00+08:00")) != "2026-10-09" || Day(at("2026-10-09T16:30:00Z")) != "2026-10-10" {
		t.Fatal("Day")
	}
}

func TestNamesAndPermissions(t *testing.T) {
	for name, ok := range map[string]bool{"跑跑": true, " 跑跑卡丁车俱乐部 ": true, "a": false, "abcdefghijk": false,
		"跑 跑": false, "跑跑!": false, "Kart2026": true} {
		if _, got := CleanName(name); got != ok {
			t.Errorf("CleanName(%q) = %v", name, got)
		}
	}
	if _, ok := CleanIntro("第一行\n第二行"); !ok {
		t.Fatal("intro with a line break")
	}
	if _, ok := CleanIntro(" "); ok {
		t.Fatal("empty intro")
	}
	if !CanKick(GradeMaster, GradeManager) || CanKick(GradeManager, GradeManager) || !CanKick(GradeManager, GradeMember) ||
		CanKick(GradeFirst, GradeMember) || CanKick(GradeMaster, GradeMaster) {
		t.Fatal("kick")
	}
	if !CanApprove(GradeFirst) || CanApprove(GradeMember) || CanManage(GradeFirst) || !CanManage(GradeManager) {
		t.Fatal("approve/manage")
	}
	if MemberCap(0) != 100 || MemberCap(5) != 500 || BudgetCap(9) != 20_000_000 || !ValidDonation(30_000) ||
		ValidDonation(20_000) {
		t.Fatal("caps")
	}
	if cost, ok := UpgradeTo(2); !ok || cost.Members != 5 {
		t.Fatal("upgrade")
	}
	if _, ok := UpgradeTo(6); ok {
		t.Fatal("upgrade past 5")
	}
}
