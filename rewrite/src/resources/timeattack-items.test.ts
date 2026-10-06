import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  bodyParams, timeAttackCharacterItem, timeAttackDecorationItem,
  timeAttackGarageCatalog, timeAttackKartItem, timeAttackLinkedCharacterItem,
  timeAttackPlateItem, type GarageItemDefinition, type GarageItemLibrary,
  type GarageResource,
} from "./timeattack-items";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const release = readFileSync(path.resolve(project, "../recovered/formatted/index.js"), "utf8");

function between(start: string, end: string): string {
  const from = release.indexOf(start);
  const to = release.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `release segment ${start}`);
  return release.slice(from, to);
}

const ReleaseLibrary = new Function([
  between("class Sw {", "\nconst BZ = "),
  between("const VM = ", "\nfunction XZ("),
  between("function Kl(", "\nfunction YZ("),
  between("function Ge(", "\nfunction iQ("),
  "return Sw;",
].join("\n"))() as new (input: { files: GarageResource[]; [field: string]: unknown }) =>
  GarageItemLibrary & {
    bodyParams(): Promise<GarageResource[]>;
    timeAttackGarageCatalog(): Promise<unknown>;
    timeAttackKartItem(id: number, path: string): Promise<unknown>;
    timeAttackPlateItem(id: number): Promise<unknown>;
    timeAttackCharacterItem(id: number, path: string): Promise<unknown>;
    timeAttackLinkedCharacterItem(id: number): Promise<unknown>;
    timeAttackDecorationItem(category: number, id: number): Promise<unknown>;
  };

class AuthoredLibrary extends ReleaseLibrary {
  bodyParams() { return bodyParams(this); }
  timeAttackGarageCatalog() { return timeAttackGarageCatalog(this); }
  timeAttackKartItem(id: number, model: string) { return timeAttackKartItem(this, id, model); }
  timeAttackPlateItem(id: number) { return timeAttackPlateItem(this, id); }
  timeAttackCharacterItem(id: number, model: string) { return timeAttackCharacterItem(this, id, model); }
  timeAttackLinkedCharacterItem(id: number) { return timeAttackLinkedCharacterItem(this, id); }
  timeAttackDecorationItem(category: number, id: number) { return timeAttackDecorationItem(this, category, id); }
}

function file(path: string, sourceName = "test.rho"): GarageResource {
  const name = path.split("/").at(-1)!;
  return {
    name, extension: name.split(".").at(-1)!.toLowerCase(),
    virtualPath: path, canonicalPath: path, sourceName, sourceKind: "rho",
    containerId: sourceName,
    bytes: async () => new Uint8Array(),
    text: async () => "",
  };
}

function setup<T extends GarageItemLibrary>(Constructor: new (input: any) => T,
  files: GarageResource[], definitions: GarageItemDefinition[] = [], catalog: unknown = {}): T {
  const library = new Constructor({
    files, archives: [], errors: [], warnings: [], region: "cn", manifestAvailable: false,
    manifestMountPaths: new Set(), archiveIndexes: { rho: [], rho5: [] },
  });
  library.itemTableGarageDefinitions = async () => definitions;
  library.loadTimeAttackGarageCatalog = async () => catalog;
  return library;
}

async function outcome(operation: () => Promise<unknown>): Promise<unknown> {
  try { return { value: await operation() }; }
  catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}

test("赛道参数与车库目录缓存保持 release 调用和结果", async () => {
  const files = [
    file("kart_/KartA/param@cn.bml"), file("kart_/KartB/param.xml"),
    file("track_/ice_R01/param.kml"), file("kart_/KartB/parameter.xml"),
  ];
  const catalog = { karts: [], characters: [], equipment: [] };
  const original = setup(ReleaseLibrary, files, [], catalog);
  const authored = setup(AuthoredLibrary, files, [], catalog);
  assert.deepEqual(await authored.bodyParams(), await original.bodyParams());
  assert.deepEqual(await authored.timeAttackGarageCatalog(), await original.timeAttackGarageCatalog());
  assert.deepEqual(await authored.timeAttackGarageCatalog(), await original.timeAttackGarageCatalog());
  assert.equal(authored.timeAttackGarageCatalogPromise, authored.timeAttackGarageCatalogPromise);
});

test("车型、号牌、角色与关联角色查找保持 release 验证", async () => {
  const definitions: GarageItemDefinition[] = [
    { kind: "kart", itemId: 101, internalId: "KartA", fixedPlateId: 4, hideChar: false,
      characterAniType: 2, engineGrade: 8 },
    { kind: "kart", itemId: 102, internalId: "KartB", fixedPlateId: 0, hideChar: true },
    { kind: "plate", itemId: 201, internalId: "PlateA", fontName: "A" },
    { kind: "plate", itemId: 202, internalId: "MissingPlate" },
    { kind: "character", itemId: 301, internalId: "Dao", uniform: "3", goggleType: "b" },
    { kind: "character", itemId: 302, internalId: "Bazzi" },
  ];
  const files = [
    file("stuff2_/plate/texture/PlateA.png", "stuff2_plate.rho"),
    file("character_Dao/model.1s", "character_Dao.rho"),
    file("character_Bazzi/costume/body/model.1s", "character_Bazzi.rho"),
  ];
  const original = setup(ReleaseLibrary, files, definitions);
  const authored = setup(AuthoredLibrary, files, definitions);
  for (const [id, model] of [
    [101, "kart_/KartA/model.1s"], [102, "kart_/KartB/model.1s"],
    [999, "kart_/Missing/model.1s"], [101, "kart_/Other/model.1s"],
  ] as const) {
    assert.deepEqual(await outcome(() => authored.timeAttackKartItem(id, model)),
      await outcome(() => original.timeAttackKartItem(id, model)));
  }
  for (const id of [201, 202, 999])
    assert.deepEqual(await outcome(() => authored.timeAttackPlateItem(id)),
      await outcome(() => original.timeAttackPlateItem(id)));
  for (const [id, model] of [
    [301, "character_/Dao/model.1s"], [301, "character_/Other/model.1s"],
    [302, "character_/Bazzi/model.1s"], [999, "character_/Missing/model.1s"],
  ] as const)
    assert.deepEqual(await outcome(() => authored.timeAttackCharacterItem(id, model)),
      await outcome(() => original.timeAttackCharacterItem(id, model)));
  for (const id of [301, 302, 999])
    assert.deepEqual(await outcome(() => authored.timeAttackLinkedCharacterItem(id)),
      await outcome(() => original.timeAttackLinkedCharacterItem(id)));
});

test("全部装饰类别、缺失物品与未知类别保持 release 结果", async () => {
  const definitions: GarageItemDefinition[] = [
    { kind: "goggle", itemId: 1, internalId: "goggleA" },
    { kind: "balloon", itemId: 2, internalId: "balloonA", balloonPos: [1, 2, 3],
      balloonWireLengthLimit: 4, balloonFloatingForce: 5, balloonViscousDrag: 6 },
    { kind: "headBand", itemId: 3, internalId: "headA", decorationTrans: 0.5 },
    { kind: "handGearL", itemId: 4, internalId: "handA" },
    { kind: "aura", itemId: 5, internalId: "auraA" },
    { kind: "skidMark", itemId: 6, internalId: "skidA" },
  ];
  const original = setup(ReleaseLibrary, [], definitions);
  const authored = setup(AuthoredLibrary, [], definitions);
  for (const [category, id] of [[8, 1], [9, 2], [11, 3], [16, 4], [26, 5], [27, 6], [9, 999], [999, 1]])
    assert.deepEqual(await outcome(() => authored.timeAttackDecorationItem(category!, id!)),
      await outcome(() => original.timeAttackDecorationItem(category!, id!)));
});
