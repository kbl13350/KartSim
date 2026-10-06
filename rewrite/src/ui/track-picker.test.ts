import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filteredTracks, gameTypeEnabled, matchingRandomGroup, randomGroupsForDisplay,
  type SelectableRandomGroup, type SelectableTrack, type TrackPickerState,
} from "./track-picker";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class _7 {");
assert.ok(classStart > 0);
function methods(start: string, end: string): string {
  const first = source.indexOf(start, classStart);
  const last = source.indexOf(end, first);
  assert.ok(first > classStart && last > first, `${start} → ${end}`);
  return source.slice(first, last);
}
const Original = new Function(`return class {
  ${methods("  filteredTracks() {", "  loadVisibleCards() {")}
  ${methods("  remapRandomSelection(e) {", "  onPointerMove =")}
};`)() as new () => TrackPickerState & {
  filteredTracks(): SelectableTrack[];
  randomGroupsForDisplay(): SelectableRandomGroup[];
  gameTypeEnabled(candidate: { gameType: string }): boolean;
  remapRandomSelection(gameType: string): void;
  selectedRandomGroupId?: string;
};

const tracks: SelectableTrack[] = [
  { id: "a", title: "城镇高速公路", theme: "city", gameType: "speed" },
  { id: "b", title: "城镇运河", theme: "city", gameType: "item" },
  { id: "c", title: "森林高速", theme: "forest", gameType: "speed" },
  { id: "d", title: "雪山", theme: "snow", gameType: "item" },
];
const groups: SelectableRandomGroup[] = [
  { id: "all-item", cardToken: "allRandom", randomType: "all", gameType: "item" },
  { id: "all-speed", cardToken: "allRandom", randomType: "all", gameType: "speed" },
  { id: "hot-item", cardToken: "hot1", randomType: "hot1", gameType: "item", level: 1 },
  { id: "hot-speed", cardToken: "hot1", randomType: "hot1", gameType: "speed", level: 1 },
  { id: "speed-all", cardToken: "speedAllRandom", randomType: "speedAll", gameType: "speed" },
  { id: "reverse", cardToken: "reverse", randomType: "reverse", gameType: "speed" },
  { id: "unknown", cardToken: "unknown", randomType: "custom", gameType: "speed" },
];

function state(theme: string | undefined, item: boolean, speed: boolean,
  searchQuery = ""): TrackPickerState {
  return {
    options: { tracks, favoriteTrackIds: new Set(["a", "d"]), randomGroups: groups },
    selectedTheme: theme, itemEnabled: item, speedEnabled: speed, searchQuery,
  };
}

test("track filters, favorites, themes and literal-space search match release", () => {
  for (const theme of [undefined, "favorite", "0", "city", "forest", "1024"]) {
    for (const item of [false, true]) for (const speed of [false, true]) {
      for (const query of ["", "城镇", "城镇 高速", "城镇  高速", "运河"]) {
        const input = state(theme, item, speed, query);
        const original = Object.assign(new Original(), input);
        assert.deepEqual(filteredTracks(input), original.filteredTracks());
        for (const candidate of tracks) {
          assert.equal(gameTypeEnabled(input, candidate), original.gameTypeEnabled(candidate));
        }
      }
    }
  }
});

test("random group card deduplication and category order match release", () => {
  for (const item of [false, true]) for (const speed of [false, true]) {
    const input = state("1024", item, speed);
    const original = Object.assign(new Original(), input);
    assert.deepEqual(randomGroupsForDisplay(input), original.randomGroupsForDisplay());
  }
});

test("switching random game type preserves equivalent card and level", () => {
  for (const selectedId of [undefined, "hot-item", "hot-speed", "all-item", "reverse", "missing"]) {
    for (const mode of ["item", "speed"]) {
      const input = state("1024", true, true);
      const original = Object.assign(new Original(), input, { selectedRandomGroupId: selectedId });
      original.remapRandomSelection(mode);
      const match = matchingRandomGroup(groups, selectedId, mode);
      assert.equal(match?.id ?? selectedId, original.selectedRandomGroupId);
    }
  }
});
