import assert from "node:assert/strict";
import test from "node:test";
import type { ItemXmlNode } from "./item-bml";
import { loadItemCatalog } from "./item-catalog";
import {
  FALLBACK_CUBE_THEME, MOVING_CUBE_ID_OFFSET, clientToThree, collectItemCubes, createItemCubeSource,
  customItemCubeTheme, decodeTrackLocale, itemCubeThemes, resolveItemCubeModel,
  type ItemTrackObject,
} from "./item-cube-source";
import { TRACK_LOCALE_PATH } from "./item-race-map";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

function xml(name: string, attributes: Record<string, string> = {}, children: ItemXmlNode[] = []): ItemXmlNode {
  return { name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children };
}

const cube = (name: string, ordinal: number | undefined, position: number[], item?: string): ItemTrackObject => ({
  kind: "ToItemCube", name, instanceOrdinal: ordinal, transform: { position },
  ...(item ? { property: xml("property", {}, [xml("item", { name: item })]) } : {}),
});
const movingCube = (name: string, ordinal: number, position: number[]): ItemTrackObject => ({
  kind: "ToMovableObject", name, instanceOrdinal: ordinal, transform: { position },
  property: xml("property", {}, [xml("object", { type: "itemCube\0junk" })]),
  object: { kind: "node", name },
});
const track = (objects: ItemTrackObject[]) => ({ root: { kind: "track", trackObjects: objects } });

test("cubes keep their ordinals; moving cubes are numbered after the static range", () => {
  const cubes = collectItemCubes(track([
    cube("ic01", 1, [1, 2, 3]),
    cube("flag", 2, [4, 5, 6], "supershield"),
    movingCube("mo_itemcube", 1, [7, 8, 9]),
    movingCube("broken", 2, [Number.NaN, 0, 0]),
    { kind: "ToMovableObject", name: "box", instanceOrdinal: 3, property: xml("property", {}, [xml("object", { type: "obstacle" })]) },
    { kind: "ToLucci", name: "coin", instanceOrdinal: 1, transform: { position: [0, 0, 0] } },
  ]));
  assert.deepEqual(cubes.map(entry => [entry.id, entry.name, entry.item, !!entry.anchor]), [
    [1, "ic01", undefined, false], [2, "flag", "supershield", false],
    [MOVING_CUBE_ID_OFFSET + 1, "mo_itemcube", undefined, true],
  ]);
  assert.deepEqual(cubes[0]!.position, { x: 1, y: 3, z: -2 });
  assert.deepEqual(clientToThree([1, 2, 3]), { x: 1, y: 3, z: -2 });
  for (const bad of [
    [cube("a", 1, [0, 0, 0]), cube("b", 1, [0, 0, 0])],
    [cube("a", undefined, [0, 0, 0])],
    [cube("a", 0, [0, 0, 0])],
    [cube("a", 4097, [0, 0, 0])],
    [cube("a", 1, [Number.NaN, 0, 0])],
    [{ ...movingCube("m", 1, [0, 0, 0]), object: undefined }],
  ]) assert.throws(() => collectItemCubes(track(bad)));
  assert.throws(() => collectItemCubes({ root: { kind: "node", trackObjects: [] } }));
});

test("cube skins: customItemCube, then the id theme, cn before zz, then village", () => {
  const locale = xml("trackList", {}, [
    xml("track", { id: "fengshen_I03", customItemCube: "fengshen_dev" }),
    xml("track", { id: "forest_I01" }),
    xml("track_rvs", { refId: "fengshen_I03", customItemCube: "fengshen_tail" }),
  ]);
  assert.equal(customItemCubeTheme(locale, "fengshen_I03"), "fengshen_dev");
  assert.equal(customItemCubeTheme(locale, "fengshen_I03_rvs"), "fengshen_tail");
  assert.equal(customItemCubeTheme(locale, "forest_I01_rvs"), undefined);
  assert.equal(customItemCubeTheme(locale, "missing"), undefined);
  assert.deepEqual(itemCubeThemes("transFormer_I01_rvs"), ["transFormer", FALLBACK_CUBE_THEME]);
  assert.deepEqual(itemCubeThemes("village_R02", "village"), ["village"]);
  const files = new Set(["item/itemCube/village/cn/itemCube.1s", "item/itemCube/village/zz/itemCube.1s",
    "item/itemCube/forest/zz/itemCube.1s"]);
  const exists = (path: string) => files.has(path);
  assert.deepEqual(resolveItemCubeModel(exists, "village_I02"),
    { theme: "village", path: "item/itemCube/village/cn/itemCube.1s" });
  assert.deepEqual(resolveItemCubeModel(exists, "forest_I01"),
    { theme: "forest", path: "item/itemCube/forest/zz/itemCube.1s" });
  assert.deepEqual(resolveItemCubeModel(exists, "korea_I01"),
    { theme: "village", path: "item/itemCube/village/cn/itemCube.1s" });
  assert.throws(() => resolveItemCubeModel(() => false, "forest_I01"));
  assert.throws(() => decodeTrackLocale(new Uint8Array([1])));
});

test("the cube source reads the real cube definition and trackLocale skins", async () => {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const catalog = await loadItemCatalog(library);
  const locale = decodeTrackLocale(await library.exactCanonicalCandidates(TRACK_LOCALE_PATH)[0]!.bytes());
  assert.equal(customItemCubeTheme(locale, "fengshen_I04"), "fengshen_dev");
  assert.equal(customItemCubeTheme(locale, "fengshen_S03"), "fengshen_tail");
  assert.equal(customItemCubeTheme(locale, "forest_I01"), undefined);
  const exists = (path: string) => catalog.has(path);
  const source = createItemCubeSource(track([cube("ic", 1, [1, 2, 3])]), "fengshen_I05", catalog.cube, locale, exists);
  assert.deepEqual({ ...source, cubes: source.cubes.length }, {
    trackId: "fengshen_I05", theme: "fengshen_dev",
    modelPath: "item/itemCube/fengshen_dev/zz/itemCube.1s",
    eatenModelPath: "item/itemCube/fired01.1s", eatenSoundPath: "sound_/fx/item/itemCube/eaten.ogg",
    radius: 2, eatenLifeMs: 2000, cubes: 1,
  });
  // Every theme prefix of an item track with cubes has its own skin, except korea.
  for (const theme of ["abyss", "beach", "brodi", "camelot", "castle", "china", "desert", "factory", "fairy",
    "fengshen", "forest", "god", "gold", "ice", "jurassic", "mabi", "maple", "mechanic", "mine", "moonhill",
    "nemo", "northeu", "nymph", "olympos", "park", "pirate", "steam", "sword", "tomb", "transFormer",
    "village", "wkc", "world", "xyy"])
    assert.equal(resolveItemCubeModel(exists, `${theme}_I01`).theme, theme, theme);
  assert.equal(resolveItemCubeModel(exists, "village_I01").path, "item/itemCube/village/cn/itemCube.1s");
  const broken = { ...catalog.cube, states: new Map([...catalog.cube.states].filter(([name]) => name !== "Eaten")) };
  assert.throws(() => createItemCubeSource(track([]), "forest_I01", broken, locale, exists), /Stay\/Eaten/);
  assert.throws(() => createItemCubeSource(track([]), "forest_I01", catalog.cube, locale, () => false), /原件/);
});
