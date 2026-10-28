import assert from "node:assert/strict";
import test from "node:test";
import { indexedTrackLibrary } from "../../tools/export-track-catalog.mjs";
import { resourceTracks, extraTrackChoices } from "./extra-tracks";
import { itemTrackCatalog, timeAttackRandomTrackGroups, trackMetadata, type TrackLibrary } from "./track-catalog";
import { filteredTracks } from "../ui/track-picker";
import { loadSelectableTrackCard, type TrackPickerResourceLibrary } from "../ui/track-picker-window-assets";

const library = indexedTrackLibrary() as TrackLibrary;

test("every indexed race model and variant is manually selectable, excluding room scenery", async () => {
  const resources = resourceTracks(library);
  const choices = await library.timeAttackTrackCatalog();
  assert.equal(resources.length, 559);
  assert.equal(choices.length, 559);
  assert.equal(new Set(choices.map(track => track.id)).size, choices.length);
  for (const choice of choices) assert.equal(!!choice.reverse, choice.id.endsWith("_rvs"), choice.id);
  assert.ok(choices.some(track => track.id === "village_A07__d_rvs"));
  const paths = new Set(choices.map(track => track.path));
  for (const resource of resources) assert.ok(paths.has(resource.model.virtualPath), resource.id);
  assert.ok(!choices.some(track => /myRoom/i.test(track.path)));
  assert.equal(choices.filter(track => track.theme === "tomb").length, 24);
  assert.equal(choices.filter(track => track.resourceCategory).length, 188);
});

test("hidden, mission, training, special and variant selections resolve usable race metadata", async () => {
  for (const choice of await library.timeAttackTrackCatalog()) {
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

test("expanded maps stay out of existing random pools and item-room admission", async () => {
  const choices = await library.timeAttackTrackCatalog();
  const extras = new Set(choices.filter(track => track.resourceCategory).map(track => track.id));
  for (const group of await timeAttackRandomTrackGroups(library))
    assert.ok(group.trackIds.every(id => !extras.has(id)), group.id);
  assert.equal((await itemTrackCatalog(library)).length, 188);
});

test("resource categories, original themes and ID searches can all find task maps", async () => {
  const choices = await library.timeAttackTrackCatalog();
  const state = { options: { tracks: choices, favoriteTrackIds: new Set<string>() },
    searchQuery: "", itemEnabled: true, speedEnabled: true, selectedTheme: "resource:mission" as string | undefined };
  assert.ok(filteredTracks(state).some(track => track.id === "tomb_S02"));
  state.selectedTheme = "tomb";
  assert.equal(filteredTracks(state).length, 24);
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
});
