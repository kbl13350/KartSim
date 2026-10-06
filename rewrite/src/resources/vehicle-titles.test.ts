import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { vehicleTitles, type VehicleTitleDependencies, type VehicleTitleLibrary } from "./vehicle-titles";
import type { GarageItemDefinition, GarageResource } from "./timeattack-items";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const release = readFileSync(path.resolve(project, "../recovered/formatted/index.js"), "utf8");
const from = release.indexOf("class Sw {");
const to = release.indexOf("\nconst BZ = ", from);
assert.ok(from >= 0 && to > from);

type Row = Record<string, string>;
function document(rows: Record<string, Row[]>): Document {
  return {
    getElementsByTagName: (tag: string) => (rows[tag] ?? []).map(row => ({
      getAttribute: (name: string) => row[name] ?? null,
      hasAttribute: (name: string) => Object.hasOwn(row, name),
    })),
  } as unknown as Document;
}

const documents: Record<string, Document> = {
  base: document({ kart: [
    { id: "10", name: " KartA ", t1ImageName: "1" },
    { id: "11", name: "KartA", t1ImageName: "2" },
    { id: "12", name: "KartB" },
    { id: "13", name: "KartC" },
  ] }),
  cn: document({ kart: [
    { id: "10", t1ImageName: "3" },
    { id: "12", name: "KartB", t1ImageName: "" },
    { id: "14", name: "KartD" },
  ] }),
  shop: document({ item: [
    { itemCatId: "3", itemId: "10", itemName: "车 A" },
    { itemCatId: "3", itemId: "11", itemName: "车 B" },
    { itemCatId: "3", itemId: "12", itemName: "车 C" },
    { itemCatId: "1", itemId: "13", itemName: "忽略" },
  ] }),
};
const parseXml: VehicleTitleDependencies["parseXml"] = text => {
  const parsed = documents[text];
  if (!parsed) throw new Error(`missing document ${text}`);
  return parsed;
};

const ReleaseLibrary = new Function("Zu", `${release.slice(from, to)}\nreturn Sw;`)(parseXml) as new (input: {
  files: GarageResource[]; [field: string]: unknown;
}) => VehicleTitleLibrary & { vehicleTitles(): Promise<Map<string, unknown>> };

class AuthoredLibrary extends ReleaseLibrary {
  vehicleTitles() { return vehicleTitles(this, { parseXml }); }
}

function file(virtualPath: string, content: string): GarageResource {
  const name = virtualPath.split("/").at(-1)!;
  return {
    name, extension: name.split(".").at(-1)!.toLowerCase(), virtualPath,
    canonicalPath: virtualPath, sourceName: "test.rho", sourceKind: "rho",
    bytes: async () => new Uint8Array(), text: async () => content,
  };
}

function setup<T extends VehicleTitleLibrary>(Constructor: new (input: any) => T,
  files: GarageResource[], definitions: GarageItemDefinition[] = []): T {
  const library = new Constructor({
    files, archives: [], errors: [], warnings: [], region: "cn", manifestAvailable: false,
    manifestMountPaths: new Set(), archiveIndexes: { rho: [], rho5: [] },
  });
  library.itemTableGarageDefinitions = async () => definitions;
  return library;
}

test("基础表、国服覆盖、商店标题歧义与系统车覆盖保持 release 行为", async () => {
  const previous = globalThis.DOMParser;
  (globalThis as unknown as { DOMParser: unknown }).DOMParser = class {};
  try {
    const files = [
      file("etc_/itemTable@cn.xml", "cn"),
      file("etc_/itemTable.kml", "base"),
      file("zeta_/cn/shop/data/item.kml", "shop"),
    ];
    const definitions: GarageItemDefinition[] = [{
      kind: "kart", itemId: 0, internalId: "KartC", title: "系统车 C", textureKey: "7",
    }];
    const original = setup(ReleaseLibrary, files, definitions);
    const authored = setup(AuthoredLibrary, files, definitions);
    assert.deepEqual(await authored.vehicleTitles(), await original.vehicleTitles());
    assert.equal(authored.vehicleTitles(), authored.vehicleTitles());
    const titles = await authored.vehicleTitles();
    assert.equal(titles.get("karta")?.textureAmbiguous, true);
    assert.equal(titles.get("kartb")?.title, "车 C");
    assert.equal(titles.get("kartc")?.title, "系统车 C");
  } finally {
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = previous;
  }
});

test("无 ItemTable 或无 DOMParser 时返回空目录，和 release 一致", async () => {
  const previous = globalThis.DOMParser;
  try {
    const files = [file("etc_/itemTable.kml", "base")];
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = undefined;
    assert.deepEqual(await setup(AuthoredLibrary, files).vehicleTitles(),
      await setup(ReleaseLibrary, files).vehicleTitles());
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = class {};
    assert.deepEqual(await setup(AuthoredLibrary, []).vehicleTitles(),
      await setup(ReleaseLibrary, []).vehicleTitles());
  } finally {
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = previous;
  }
});
