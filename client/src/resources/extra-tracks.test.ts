import assert from "node:assert/strict";
import test from "node:test";
import { indexedTrackLibrary } from "../../tools/export-track-catalog.mjs";
import { resourceTracks, extraTrackChoices } from "./extra-tracks";
import { itemTrackCatalog, timeAttackRandomTrackGroups, timeAttackTrackCatalogAll, trackMetadata, type TrackLibrary } from "./track-catalog";
import { deduplicateTrackChoices, expandTrackChoices } from "./track-duplicates";
import { filteredTracks } from "../ui/track-picker";
import { loadSelectableTrackCard, type TrackPickerResourceLibrary } from "../ui/track-picker-window-assets";
import { taiwanTrack } from "./taiwan-tracks";

const library = indexedTrackLibrary() as TrackLibrary;

test("the full catalog retains every indexed race model and variant, excluding room scenery", async () => {
  const resources = resourceTracks(library);
  const choices = await timeAttackTrackCatalogAll(library);
  assert.equal(resources.filter(track => !taiwanTrack(track.id)).length, 559);
  assert.equal(choices.length, resources.length);
  assert.equal(new Set(choices.map(track => track.id)).size, choices.length);
  for (const choice of choices) assert.equal(!!choice.reverse, choice.id.endsWith("_rvs"), choice.id);
  assert.ok(choices.some(track => track.id === "village_A07__d_rvs"));
  const paths = new Set(choices.map(track => track.path));
  for (const resource of resources) assert.ok(paths.has(resource.model.virtualPath), resource.id);
  assert.ok(!choices.some(track => /myRoom/i.test(track.path)));
  assert.equal(choices.filter(track => track.theme === "tomb" && !taiwanTrack(track.id)).length, 24);
  assert.equal(choices.filter(track => track.resourceCategory && !taiwanTrack(track.id)).length, 188);
});

test("hidden, mission, training, special and variant selections resolve usable race metadata", async () => {
  for (const choice of await timeAttackTrackCatalogAll(library)) {
    const metadata = await trackMetadata(library, choice.id);
    assert.ok(metadata?.cnTitle, choice.id);
    assert.ok(metadata.laps! >= 1, choice.id);
    assert.ok(["item", "speed"].includes(metadata.gameType ?? "speed"), choice.id);
    assert.notEqual(metadata.blocked, true, choice.id);
    assert.notEqual(metadata.choosable, false, choice.id);
  }
  for (const id of ["pirate_P01", "maple_P01", "fengshen_P01", "mabi_P01"]) {
    const metadata = await trackMetadata(library, id);
    assert.equal(metadata?.laps, 99999, id);
    assert.match(metadata!.cnTitle!, /自由探索/);
  }
  assert.equal((await trackMetadata(library, "tomb_I02"))?.laps, 3);
  assert.equal((await trackMetadata(library, "tomb_F01"))?.gameType, "speed");
  assert.equal((await trackMetadata(library, "tomb_S02"))?.laps, 1);
  assert.equal((await trackMetadata(library, "village_L01_02"))?.resourceCategory, "resource:training");
});

test("expanded maps stay out of speed random pools; only validated Korea item maps enter item rooms", async () => {
  const choices = await library.timeAttackTrackCatalog();
  const extras = new Set(choices.filter(track => track.resourceCategory).map(track => track.id));
  for (const group of await timeAttackRandomTrackGroups(library))
    assert.ok(group.trackIds.every(id => !extras.has(id)), group.id);
  const items = await itemTrackCatalog(library);
  assert.equal(items.filter(track => !taiwanTrack(track.id)).length, 188);
  assert.equal(items.filter(track => taiwanTrack(track.id)).length, 9);
  assert.ok(items.filter(track => taiwanTrack(track.id)).every(track => track.theme === "korea"));
});

test("resource categories, original themes and ID searches can all find task maps", async () => {
  const choices = await library.timeAttackTrackCatalog();
  const state = { options: { tracks: choices, favoriteTrackIds: new Set<string>() },
    searchQuery: "", itemEnabled: true, speedEnabled: true, selectedTheme: "resource:mission" as string | undefined };
  assert.ok(filteredTracks(state).some(track => track.id === "tomb_S02"));
  state.selectedTheme = "tomb";
  assert.equal(filteredTracks(state).filter(track => !taiwanTrack(track.id)).length, 24);
  state.selectedTheme = undefined;
  state.searchQuery = "TOMB_S02";
  assert.deepEqual(filteredTracks(state).map(track => track.id), ["tomb_S02"]);
});

test("folder aliases do not introduce duplicate choices", () => {
  const model = { name: "track.1s", extension: "1s", canonicalPath: "track_/tomb_I02/track.1s",
    virtualPath: "track_tomb_I02/track.1s", sourceName: "track_tomb_I02.rho", bytes: async () => new Uint8Array() };
  const stub = { files: [model, { ...model }] } as TrackLibrary;
  const existing = [{ id: "alias", path: model.virtualPath, title: "alias", theme: "tomb", gameType: "speed" as const, difficulty: 1 }];
  assert.equal(extraTrackChoices(stub, [], existing).length, 0);
  assert.equal(resourceTracks(stub).length, 1);
});

test("missing task thumbnails get a Ready card; ambiguous resources still fail", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = { fillRect() {}, fillText() {} };
  const canvas = { width: 0, height: 0, getContext: () => context };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  const file = { virtualPath: "track_/tomb_S01/track.1s" };
  const source = { get: () => file, resolveContainerPath: () => ({ status: "missing" }) } as unknown as TrackPickerResourceLibrary;
  const dependencies = { decodePng: async () => { throw new Error("must not decode missing thumbnail"); } };
  try {
    assert.equal((await loadSelectableTrackCard(source, file.virtualPath, dependencies)).image, canvas);
    source.resolveContainerPath = () => ({ status: "ambiguous", entries: [] });
    await assert.rejects(loadSelectableTrackCard(source, file.virtualPath, dependencies), /不唯一/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

// Use the same serializer and restoration path as Ready's track selector.
test("all selectable maps initialize and round-trip through the real favorites codec", async () => {
  const { IP, nT } = await import("../generated/world.js");
  const choices = await library.timeAttackTrackCatalog();
  assert.equal(nT([], choices).size, 0);
  const favorites = choices.map(choice => IP(choice));
  assert.deepEqual(nT(favorites, choices), new Set(choices.map(choice => choice.id)));
  const city = choices.find(choice => choice.id === "kartcity")!;
  assert.deepEqual(IP(city), { themeId: 3, trackId: 506332011 });
  assert.deepEqual(nT([IP(city)], choices), new Set(["kartcity"]));
  const tracks = await timeAttackTrackCatalogAll(library);
  const canonical = tracks.find(track => track.id === "village_R01")!;
  const alias = tracks.find(track => track.id === "village_R01_cn")!;
  assert.ok(canonical && alias);
  const deduplicated = deduplicateTrackChoices([canonical, alias], [
    { canonicalId: canonical.id, aliasIds: [alias.id] },
  ]);
  assert.deepEqual(nT([IP(alias)], deduplicated), new Set([canonical.id]));
  assert.deepEqual(IP(alias), IP(expandTrackChoices(deduplicated).find(track => track.id === alias.id)!));
});


test("mounted workshop maps keep their authored metadata without duplicate resource choices", async () => {
  const { registerCustomMap, removeCustomMap, summaryTrackId } = await import("../mapeditor/custom-tracks");
  const { IP, nT } = await import("../generated/world.js");
  const mounted = Object.assign(indexedTrackLibrary(), {
    byPath: new Map(), byCanonicalPath: new Map(), byExactCanonicalPath: new Map(),
  });
  const summaries = (["server", "local"] as const).map(source => ({
    id: "test1234", source, name: "工坊收藏回归", author: "test", theme: "forest",
    laps: 3, difficulty: 2, roadExtent: 100, sha256: source, size: 0, items: 1,
    files: [{ path: "track.1s", size: 0 }], updatedAt: 1,
  }));
  try {
    for (const summary of summaries) registerCustomMap(mounted, summary, {
      container: async () => { throw new Error("catalog must not download map geometry"); },
    });
    const choices = await mounted.timeAttackTrackCatalog();
    // This is the picker initialization that used to throw on the synthetic custom theme.
    assert.equal(nT([], choices).size, 0);
    assert.equal(expandTrackChoices(choices).length, resourceTracks(mounted).length + 2);
    assert.equal(resourceTracks(mounted).filter(track => !taiwanTrack(track.id)).length, 559);
    for (const summary of summaries) {
      const id = summaryTrackId(summary);
      const entries = choices.filter(choice => choice.id === id);
      assert.equal(entries.length, 1, id);
      assert.equal(entries[0]!.theme, "forest");
      assert.equal(entries[0]!.title, summary.source === "local" ? `[草稿] ${summary.name}` : summary.name);
      assert.equal(entries[0]!.resourceCategory, undefined);
      assert.deepEqual(nT([IP(entries[0])], choices), new Set([id]));
      assert.equal((await trackMetadata(mounted, id))?.laps, 3);
    }
    const itemChoices = await itemTrackCatalog(mounted);
    assert.equal(itemChoices.filter(choice => choice.id === "custom_test1234").length, 1);
    assert.ok(!itemChoices.some(choice => choice.id === "custom_test1234_draft"));
  } finally {
    for (const summary of summaries) removeCustomMap(mounted, summaryTrackId(summary));
  }
});
