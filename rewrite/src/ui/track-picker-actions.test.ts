import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  changeFavoriteTrack, commitTrackSearch, confirmTrackSelection,
  placeInitialThemeOffset, searchTracks, selectTrackTheme,
  toggleTrackGameType, trackGameTypeOffered, type TrackPickerActionHost,
} from "./track-picker-actions";
import { matchingRandomGroup } from "./track-picker";

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
  ${methods("  placeInitialOffsets() {", "  render() {")}
  ${methods("  changeFavorite(e, t) {", "  showFavoriteNotice(e, t) {")}
  ${methods("  confirm() {", "  onPointerMove =")}
  ${methods("  searchTracks(e) {", "  beginScrollbar(e) {")}
};`)() as new () => TrackPickerActionHost & {
  placeInitialOffsets(): void;
  confirm(): void;
  toggleGameType(mode: string): void;
  commitSearch(): void;
  changeFavorite(id: string, favorite: boolean): string;
};

test("track picker theme, search, filters, confirmation and favorite mutations match release", () => {
  const run = (released: boolean) => {
    const events: unknown[] = [];
    const tracks = [
      { id: "city", title: "城镇高速", theme: "city", gameType: "speed" },
      { id: "forest", title: "森林", theme: "forest", gameType: "item" },
    ];
    const groups = [
      { id: "random-speed", cardToken: "same", randomType: "hot1", gameType: "speed", level: 1 },
      { id: "random-item", cardToken: "same", randomType: "hot1", gameType: "item", level: 1 },
    ];
    const target = released ? new Original() : {} as TrackPickerActionHost;
    Object.assign(target, {
      options: {
        tracks, randomGroups: groups, favoriteTrackIds: new Set(["forest"]),
        onConfirm: (selection: unknown) => events.push(["confirm", selection]),
        getFavoriteCount: () => 49,
        onFavoriteChange: (id: string, favorite: boolean) =>
          events.push(["favorite", id, favorite]),
      },
      assets: { themes: Array.from({ length: 10 }, (_, index) => ({ id: String(index) })) },
      selectedTheme: "7", selectedTrackId: "city",
      selectedRandomGroupId: "random-speed",
      itemEnabled: true, speedEnabled: true,
      search: { value: "", blur: () => events.push("blur") },
      searchQuery: "old", themeOffset: 0, trackOffset: 3,
      pageSize: () => 4,
      resetTrackScrollbar: () => events.push("reset"),
      render: () => events.push("render"),
    });
    if (!released) {
      Object.assign(target, {
        placeInitialOffsets(this: TrackPickerActionHost) { placeInitialThemeOffset(this); },
        confirm(this: TrackPickerActionHost) { confirmTrackSelection(this); },
        selectTheme(this: TrackPickerActionHost, theme: string) { selectTrackTheme(this, theme); },
        toggleGameType(this: TrackPickerActionHost, mode: string) { toggleTrackGameType(this, mode); },
        searchTracks(this: TrackPickerActionHost, query: string) { searchTracks(this, query); },
        commitSearch(this: TrackPickerActionHost) { commitTrackSearch(this); },
        changeFavorite(this: TrackPickerActionHost, id: string, favorite: boolean) {
          return changeFavoriteTrack(this, id, favorite);
        },
        remapRandomSelection(this: TrackPickerActionHost, mode: string) {
          const group = matchingRandomGroup(this.options.randomGroups,
            this.selectedRandomGroupId, mode);
          if (group) this.selectedRandomGroupId = group.id;
        },
      });
    }
    const controller = target as InstanceType<typeof Original>;
    const snapshots: unknown[] = [];
    const capture = (label: string, result?: unknown) => snapshots.push({
      label, result, selectedTheme: controller.selectedTheme,
      selectedRandomGroupId: controller.selectedRandomGroupId,
      itemEnabled: controller.itemEnabled, speedEnabled: controller.speedEnabled,
      searchQuery: controller.searchQuery, searchValue: controller.search.value,
      themeOffset: controller.themeOffset, trackOffset: controller.trackOffset,
      favorites: [...controller.options.favoriteTrackIds].sort(), events: [...events],
    });
    controller.placeInitialOffsets(); capture("initial-offset");
    controller.confirm(); capture("concrete-confirm");
    controller.selectTheme("1024"); capture("random-theme");
    controller.confirm(); capture("random-confirm");
    controller.toggleGameType("item"); capture("item-filter");
    controller.search.value = "　城镇 高速　";
    controller.commitSearch(); capture("search-enter");
    controller.toggleGameType("speed"); capture("search-mode");
    controller.search.value = "   ";
    controller.commitSearch(); capture("empty-search");
    capture("favorite-added", controller.changeFavorite("city", true));
    capture("favorite-removed", controller.changeFavorite("forest", false));
    controller.options.getFavoriteCount = () => 50;
    capture("favorite-cap", controller.changeFavorite("forest", true));
    return snapshots;
  };
  assert.deepEqual(run(false), run(true));
});

test("a picker limited to 道具 ignores the 竞速 switch on both tabs", () => {
  assert.equal(trackGameTypeOffered({}, "speed"), true);
  assert.equal(trackGameTypeOffered({ gameTypes: ["item"] }, "speed"), false);
  assert.equal(trackGameTypeOffered({ gameTypes: ["item"] }, "item"), true);
  const events: unknown[] = [];
  const host = {
    options: { tracks: [], favoriteTrackIds: new Set<string>(), gameTypes: ["item"],
      onConfirm: () => {}, getFavoriteCount: () => 0, onFavoriteChange: () => {} },
    assets: { themes: [] }, selectedTheme: "1024", itemEnabled: true, speedEnabled: false,
    search: { value: "", blur: () => {} }, searchQuery: "", themeOffset: 0, trackOffset: 0,
    pageSize: () => 4, resetTrackScrollbar: () => {}, render: () => {},
    remapRandomSelection: (gameType: string) => events.push(["remap", gameType]),
    selectTheme: (theme: string) => events.push(["theme", theme]),
    searchTracks: (query: string) => events.push(["search", query]),
  } as TrackPickerActionHost;
  toggleTrackGameType(host, "speed");
  host.selectedTheme = "village";
  toggleTrackGameType(host, "speed");
  assert.deepEqual([host.itemEnabled, host.speedEnabled, events], [true, false, []]);
  toggleTrackGameType(host, "item");
  assert.deepEqual([host.itemEnabled, events], [false, [["theme", "village"]]]);
});
