import assert from "node:assert/strict";
import test from "node:test";
import { indexedTrackLibrary } from "../../tools/export-track-catalog.mjs";
import { timeAttackTrackCatalogAll, type TrackChoice, type TrackLibrary } from "./track-catalog";
import { deduplicateTrackChoices, duplicateAwareFavoriteTrackIds, equivalentTrackChoices,
  expandTrackChoices, findTrackChoice, TRACK_DUPLICATE_GROUPS, visibleTrackId } from "./track-duplicates";

const groups = [
  { canonicalId: "village_R01", aliasIds: ["old_village_R01", "duplicate_R01"] },
  { canonicalId: "village_R01_rvs", aliasIds: ["old_village_R01_rvs"] },
];
const choice = (id: string): TrackChoice => ({ id, path: `track_/${id}/track.1s`,
  title: id, theme: "village", gameType: "speed", difficulty: 1, reverse: /_rvs$/.test(id) || undefined });

test("only reviewed aliases collapse; forward, reverse, scene variants and custom maps remain distinct", () => {
  const input = ["old_village_R01", "village_R01_rvs", "village_R01", "duplicate_R01",
    "old_village_R01_rvs", "village_R01_night", "custom_123456"].map(choice);
  const before = structuredClone(input);
  const selected = deduplicateTrackChoices(input, groups);
  assert.deepEqual(selected.map(track => track.id),
    ["village_R01_rvs", "village_R01", "village_R01_night", "custom_123456"]);
  assert.deepEqual(input, before, "catalog folding cannot rewrite stored IDs or assets");
  assert.deepEqual(selected.find(track => track.id === "village_R01")?.duplicateAliases?.map(track => track.id),
    ["old_village_R01", "duplicate_R01"]);
  assert.deepEqual(deduplicateTrackChoices(input, []), input);
  assert.throws(() => deduplicateTrackChoices(input, [{ canonicalId: "village_R01", aliasIds: ["village_R01_rvs"] }]),
    /Invalid reviewed/);
  assert.throws(() => deduplicateTrackChoices(input, [{ canonicalId: "village_R01", aliasIds: ["custom_123456"] }]),
    /Invalid reviewed/);
  assert.throws(() => deduplicateTrackChoices(input, [...groups, groups[0]!]), /overlap/);
});

test("a mounted alias stays available when canonical assets are absent", () => {
  const selected = deduplicateTrackChoices([choice("old_village_R01"), choice("duplicate_R01")], groups);
  assert.deepEqual(selected.map(track => track.id), ["old_village_R01"]);
  assert.equal(findTrackChoice(selected, "DUPLICATE_R01")?.path, "track_/duplicate_R01/track.1s");
  assert.equal(findTrackChoice(selected, "village_R01"), undefined, "never invent an absent canonical asset");
});

test("old replay IDs resolve their exact paths while picker selection and favorites use the visible card", () => {
  const all = [choice("village_R01"), choice("old_village_R01"), choice("duplicate_R01")];
  const selected = deduplicateTrackChoices(all, groups);
  assert.equal(findTrackChoice(selected, "OLD_VILLAGE_R01"), all[1]);
  assert.equal(visibleTrackId("old_village_R01", selected), "village_R01");
  assert.equal(visibleTrackId("unknown", selected), "unknown");
  assert.deepEqual(expandTrackChoices(selected).map(track => track.id), all.map(track => track.id));
  const encode = (track: unknown) => ({ themeId: 3, trackId: (track as TrackChoice).id });
  const favorite = [{ themeId: 3, trackId: "old_village_R01" }];
  assert.deepEqual(duplicateAwareFavoriteTrackIds(favorite, selected, encode), new Set(["village_R01"]));
  assert.deepEqual(favorite, [{ themeId: 3, trackId: "old_village_R01" }], "reading favorites does not rewrite storage");
  assert.equal(equivalentTrackChoices(selected[0]).length, 3);
});

test("the full mounted catalog retains every settlement/replay ID after picker deduplication", async () => {
  const library = indexedTrackLibrary() as TrackLibrary;
  const all = await timeAttackTrackCatalogAll(library);
  const selected = await library.timeAttackTrackCatalog();
  assert.equal(all.length, 921);
  for (const track of all) {
    const original = findTrackChoice(selected, track.id);
    assert.equal(original?.id, track.id, track.id);
    assert.equal(original?.path, track.path, track.id);
  }
  for (const group of TRACK_DUPLICATE_GROUPS) {
    const ids = [group.canonicalId, ...group.aliasIds];
    const mounted = all.filter(track => ids.includes(track.id));
    const visible = selected.filter(track => ids.includes(track.id));
    assert.equal(visible.length, mounted.length ? 1 : 0, group.canonicalId);
    if (mounted.some(track => track.id === group.canonicalId)) assert.equal(visible[0]?.id, group.canonicalId);
  }
});
