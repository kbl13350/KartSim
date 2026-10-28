import assert from "node:assert/strict";
import test from "node:test";
import { parseTrackDisplaySettings } from "../resources/track-display-settings";
import { findTrackChoice } from "../resources/track-duplicates";
import { filteredTracks } from "./track-picker";
import { applyTrackPickerPolicy, prepareTrackPickerOptions } from "./track-picker-policy";

const track = (id: string) => ({ id, path: `track_/${id}`, title: id, theme: "korea", gameType: "speed" });
const fixture = () => ({
  tracks: [{ ...track("open"), duplicateAliases: [track("old_open")] },
    { ...track("closed"), duplicateAliases: [track("old_closed")] }],
  randomGroups: [{ id: "mixed", cardToken: "allRandom_TimeAttack@zz", randomType: "all", gameType: "speed",
    trackIds: ["open", "old_open", "closed", "old_closed"], displayTrackIds: ["open", "closed"] },
    { id: "closed-only", cardToken: "newRandom_TimeAttack@zz", randomType: "new", gameType: "speed", trackIds: ["closed"] }],
  favoriteTrackIds: new Set(["open", "closed"]),
  selectedTrackId: "closed", selectedRandomGroupId: "closed-only",
});
const settings = (ids: string[]) => parseTrackDisplaySettings({ disabledTrackIds: ids, version: "v1", updatedAt: 1 });

test("all picker views and random pools exclude closed maps without changing legacy lookups", () => {
  const original = fixture(), saved = structuredClone(original);
  const result = applyTrackPickerPolicy(original, settings(["closed", "old_closed"]));
  assert.deepEqual(result.tracks.map(t => t.id), ["open"]);
  assert.deepEqual([...result.favoriteTrackIds], ["open"]);
  assert.deepEqual(result.randomGroups, [{ ...original.randomGroups[0], trackIds: ["open", "old_open"], displayTrackIds: ["open"] }]);
  assert.equal(result.selectedRandomGroupId, undefined);
  assert.equal(result.selectedTrackId, "open");
  const state = { options: result, searchQuery: "", itemEnabled: true, speedEnabled: true };
  assert.deepEqual(filteredTracks(state).map(t => t.id), ["open"]);
  assert.deepEqual(filteredTracks({ ...state, selectedTheme: "favorite" }).map(t => t.id), ["open"]);
  assert.deepEqual(filteredTracks({ ...state, searchQuery: "closed" }), []);
  assert.deepEqual(original, saved);
  assert.equal(original.selectedTrackId, "closed");
  assert.equal(findTrackChoice(original.tracks, "old_closed")?.id, "old_closed");
});

test("old selection aliases highlight canonical cards; all disabled produces no implicit choice", () => {
  const options = fixture();
  options.selectedTrackId = "old_open";
  assert.equal(applyTrackPickerPolicy(options, settings([])).selectedTrackId, "open");
  const result = applyTrackPickerPolicy(options, settings(["open", "old_open", "closed", "old_closed"]));
  assert.deepEqual(result.tracks, []);
  assert.deepEqual(result.randomGroups, []);
  assert.equal(result.selectedTrackId, "");
  assert.equal(result.favoriteTrackIds.size, 0);
});

test("opening the picker refreshes immediately, explains all-disabled, and observes re-enable", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldFetch = globalThis.fetch;
  let calls = 0, disabled = ["open", "old_open", "closed", "old_closed"];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://picker-policy.example" },
  } });
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ disabledTrackIds: disabled, version: String(calls), updatedAt: calls }));
  };
  try {
    await assert.rejects(prepareTrackPickerOptions(fixture()), /当前没有开放的地图/);
    disabled = ["closed", "old_closed"];
    assert.equal((await prepareTrackPickerOptions(fixture())).tracks.length, 1);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
