import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTimeAttackGarageCatalog, type GarageCatalogDependencies } from "./garage-catalog";
import type { GarageItemDefinition, GarageItemLibrary, GarageResource } from "./timeattack-items";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const release = readFileSync(path.resolve(project, "../recovered/formatted/index.js"), "utf8");

function between(start: string, end: string): string {
  const from = release.indexOf(start);
  const to = release.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `release segment ${start}`);
  return release.slice(from, to);
}

function shopDocument(items: { category: string; id: string; title: string }[]): Document {
  return {
    getElementsByTagName: () => items.map(item => ({
      getAttribute: (name: string) => ({ itemCatId: item.category, itemId: item.id,
        itemName: item.title } as Record<string, string>)[name] ?? null,
    })),
  } as unknown as Document;
}

const SHOP = shopDocument([
  { category: "3", id: "5", title: "卡丁车 B" },
  { category: "1", id: "10", title: "皮蛋" },
  { category: "4", id: "20", title: "号牌 A" },
  { category: "9", id: "21", title: "气球 A" },
  { category: "8", id: "22", title: "护目镜 A" },
  { category: "8", id: "22", title: "护目镜 B" },
]);
const FAMILIES = [{ key: "legacy-test" }];
const parseShop = (_text: string, _path: string) => SHOP;
const resolveModel = async (_library: GarageItemLibrary, modelPath: string) => ({
  find: (_names: string[]) => modelPath === "kart_/KartB/model.1s"
    ? file("kart_/KartB/model.1s", "kart_b.rho") : undefined,
});
const dependencies: GarageCatalogDependencies = {
  parseShopXml: parseShop,
  resolveModel,
  legacyFamilies: FAMILIES,
};

const ReleaseLibrary = new Function("IR", "Zu", "Cr", [
  between("class Sw {", "\nconst BZ = "),
  between("function qZ(", "\nfunction YZ("),
  between("function YX(", "\nfunction ZX("),
  between("function Ge(", "\nfunction iQ("),
  between("function z3(", "\nfunction sQ("),
  "return Sw;",
].join("\n"))(resolveModel, parseShop, FAMILIES) as new (input: {
  files: GarageResource[]; [field: string]: unknown;
}) => GarageItemLibrary;

class AuthoredLibrary extends ReleaseLibrary {
  loadTimeAttackGarageCatalog() { return loadTimeAttackGarageCatalog(this, dependencies); }
}

function file(virtualPath: string, sourceName = "test.rho"): GarageResource {
  const name = virtualPath.split("/").at(-1)!;
  return {
    name, extension: name.split(".").at(-1)!.toLowerCase(), virtualPath,
    canonicalPath: virtualPath, sourceName, sourceKind: "rho", containerId: sourceName,
    bytes: async () => new Uint8Array(), text: async () => "shop",
  };
}

function setup<T extends GarageItemLibrary>(Constructor: new (input: any) => T,
  files: GarageResource[], definitions: GarageItemDefinition[]): T {
  const library = new Constructor({
    files, archives: [], errors: [], warnings: [], region: "cn", manifestAvailable: false,
    manifestMountPaths: new Set(), archiveIndexes: { rho: [], rho5: [] },
  });
  library.itemTableGarageDefinitions = async () => definitions;
  return library;
}

async function outcome(operation: () => Promise<unknown>): Promise<unknown> {
  try { return { value: await operation() }; }
  catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}

test("车库目录合并、模型回退、目录排序与装备筛选和原版一致", async () => {
  const definitions: GarageItemDefinition[] = [
    { kind: "kart", itemId: 2, internalId: "KartA", title: "系统车 A", engineGrade: 8 },
    { kind: "kart", itemId: 5, internalId: "KartB", engineGrade: 7 },
    { kind: "kart", itemId: 8, internalId: "KartC" },
    { kind: "character", itemId: 10, internalId: "Dao", uniform: "2" },
    { kind: "character", itemId: 11, internalId: "Bazzi" },
    { kind: "plate", itemId: 20, internalId: "PlateA", tuneGroupId: 9 },
    { kind: "balloon", itemId: 21, internalId: "BalloonA" },
    { kind: "goggle", itemId: 22, internalId: "GoggleA" },
  ];
  const files = [
    file("zeta_/cn/shop/data/item.kml", "zeta_shop.rho"),
    file("kart_/KartA/model.1s", "kart_a.rho"),
    file("kart_/KartB/param.xml", "kart_b.rho"),
    file("kart_/KartC/model.1s", "kart_c.rho"),
    { ...file("kart_/KartC/model.1s [duplicate]", "kart_c2.rho"),
      name: "model.1s", extension: "1s", canonicalPath: "kart_/KartC/model.1s" },
    file("character_Dao/model.1s", "character_Dao.rho"),
    file("character_Bazzi/costume/body/model.1s", "character_Bazzi.rho"),
    file("stuff2_/plate/texture/PlateA.png", "stuff2_plate.rho"),
  ];
  const original = setup(ReleaseLibrary, files, definitions);
  const authored = setup(AuthoredLibrary, files, definitions);
  const expected = await original.loadTimeAttackGarageCatalog();
  const actual = await authored.loadTimeAttackGarageCatalog();
  assert.deepEqual(actual, expected);
  assert.deepEqual((actual as { karts: { itemId: number }[] }).karts.map(item => item.itemId), [5, 2]);
  assert.equal((actual as { characters: unknown[] }).characters.length, 1);
  assert.deepEqual((actual as { equipment: { itemId: number }[] }).equipment.map(item => item.itemId), [20, 21]);
});

test("缺少或重复中国商店文件与原版报错一致", async () => {
  const shop = file("zeta_/cn/shop/data/item.kml");
  for (const files of [[], [shop, { ...shop, virtualPath: "zeta_/cn/shop/data/copy/item.kml" }]]) {
    const original = setup(ReleaseLibrary, files, []);
    const authored = setup(AuthoredLibrary, files, []);
    assert.deepEqual(await outcome(() => authored.loadTimeAttackGarageCatalog()),
      await outcome(() => original.loadTimeAttackGarageCatalog()));
  }
});
