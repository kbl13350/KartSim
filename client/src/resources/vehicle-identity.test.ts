import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { Rho5Reader } from "../codecs/rho5";
import type { ArchiveSource } from "./container-store";
import type { Rho5ArchiveIndex } from "./archive-index";
import {
  loadVehicleEngineGrades, loadVehicleItemIds, loadVehicleLinkCharacterIds,
  vehicleAssets, vehicleCatalog, vehicleEngineGrade, vehicleItemId,
  vehicleLinkCharacterId, vehicleTextureKey, type VehicleDefinition,
  type VehicleIdentityLibrary, type VehicleResource, type VehicleTitle,
} from "./vehicle-identity";

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
  between("function Ge(", "\nfunction iQ("),
  "return Sw;",
].join("\n"))() as new (input: { files: VehicleResource[]; [field: string]: unknown }) =>
  VehicleIdentityLibrary & {
    vehicleCatalog(): Promise<unknown>;
    vehicleTextureKey(path: string): Promise<string>;
    vehicleEngineGrade(path: string): Promise<number>;
    vehicleItemId(path: string): Promise<number>;
    vehicleLinkCharacterId(path: string): Promise<number>;
  };

class AuthoredLibrary extends ReleaseLibrary {
  vehicleAssets() { return vehicleAssets(this); }
  vehicleCatalog() { return vehicleCatalog(this); }
  vehicleTextureKey(path: string) { return vehicleTextureKey(this, path); }
  vehicleEngineGrade(path: string) { return vehicleEngineGrade(this, path); }
  vehicleItemId(path: string) { return vehicleItemId(this, path); }
  vehicleLinkCharacterId(path: string) { return vehicleLinkCharacterId(this, path); }
  loadVehicleEngineGrades() { return loadVehicleEngineGrades(this); }
  loadVehicleItemIds() { return loadVehicleItemIds(this); }
  loadVehicleLinkCharacterIds() { return loadVehicleLinkCharacterIds(this); }
}

function setup<T extends VehicleIdentityLibrary>(Constructor: new (input: any) => T,
  files: VehicleResource[], definitions: VehicleDefinition[] = [],
  titles = new Map<string, VehicleTitle>()): T {
  const library = new Constructor({
    files, archives: [], errors: [], warnings: [], region: "cn", manifestAvailable: false,
    manifestMountPaths: new Set(), archiveIndexes: { rho: [], rho5: [] },
  });
  library.vehicleTitles = async () => titles;
  library.itemTableGarageDefinitions = async () => definitions;
  return library;
}

function file(virtualPath: string, sourceName: string): VehicleResource {
  const name = virtualPath.split("/").at(-1)!;
  return {
    name, extension: name.split(".").at(-1)!.toLowerCase(), virtualPath,
    canonicalPath: virtualPath, sourceName, sourceKind: "rho",
    containerId: `rho:${sourceName}`,
  };
}

function vehicleFileSet(folder: string, sourceName = `${folder}.rho`): VehicleResource[] {
  return ["model.1s", "f00.1s", "f01.1s", "f02.1s", "f03.1s", "param@cn.xml"]
    .map(name => file(`${folder}/${name}`, sourceName));
}

async function outcome(operation: () => Promise<unknown>): Promise<unknown> {
  try { return { value: await operation() }; }
  catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}

test("车辆模型筛选、目录标题及纹理身份与原版一致", async () => {
  const files = [
    ...vehicleFileSet("kart_/KartA"),
    ...vehicleFileSet("kart_/KartB").filter(entry => !entry.virtualPath.endsWith("f03.1s")),
    ...vehicleFileSet("kart_/KartC"),
    ...vehicleFileSet("kart_/KartC", "KartC-alt.rho").map(entry => ({
      ...entry, virtualPath: `${entry.virtualPath} [duplicate]`,
      canonicalPath: entry.canonicalPath,
    })),
    ...vehicleFileSet("kart_/KartD"),
    file("unrelated/model.1s", "unrelated.rho"),
  ];
  const titles = new Map<string, VehicleTitle>([
    ["karta", { title: "练习车 A", itemId: "101", textureKey: "3" }],
    ["kartd", { ambiguous: true, textureAmbiguous: true }],
  ]);
  const original = setup(ReleaseLibrary, files, [], titles);
  const authored = setup(AuthoredLibrary, files, [], titles);
  assert.deepEqual(authored.vehicleAssets(), original.vehicleAssets());
  assert.deepEqual(await authored.vehicleCatalog(), await original.vehicleCatalog());
  assert.deepEqual(await outcome(() => authored.vehicleTextureKey("kart_/KartA/model.1s")),
    await outcome(() => original.vehicleTextureKey("kart_/KartA/model.1s")));
  assert.deepEqual(await outcome(() => authored.vehicleTextureKey("kart_/KartD/model.1s")),
    await outcome(() => original.vehicleTextureKey("kart_/KartD/model.1s")));
  assert.deepEqual(await outcome(() => authored.vehicleTextureKey("unknown/model.1s")),
    await outcome(() => original.vehicleTextureKey("unknown/model.1s")));
  assert.deepEqual(authored.vehicleAssets().map(entry => entry.virtualPath), [
    "kart_/KartA/model.1s", "kart_/KartD/model.1s",
  ]);
});

test("车辆引擎、物品、角色身份及冲突错误与原版一致", async () => {
  const definitions: VehicleDefinition[] = [
    { kind: "kart", internalId: "KartA", itemId: 101, engineGrade: 8, linkCharacterId: 19 },
    { kind: "kart", internalId: "karta", itemId: 101, engineGrade: 8, linkCharacterId: 19 },
    { kind: "kart", internalId: "KartB", itemId: 102, engineGrade: 7, linkCharacterId: 0 },
    { kind: "kart", internalId: "kartb", itemId: 102, engineGrade: 9, linkCharacterId: 0 },
    { kind: "kart", internalId: "KartC", itemId: 103 },
    { kind: "kart", internalId: "kartc", itemId: 104 },
    { kind: "kart", internalId: "KartD", itemId: 105, linkCharacterId: 20 },
    { kind: "kart", internalId: "kartd", itemId: 105, linkCharacterId: 21 },
    { kind: "character", internalId: "KartA", itemId: 999, engineGrade: 99 },
  ];
  const original = setup(ReleaseLibrary, [], definitions);
  const authored = setup(AuthoredLibrary, [], definitions);
  assert.deepEqual(await authored.loadVehicleEngineGrades(), await original.loadVehicleEngineGrades());
  assert.deepEqual(await authored.loadVehicleItemIds(), await original.loadVehicleItemIds());
  assert.deepEqual(await authored.loadVehicleLinkCharacterIds(), await original.loadVehicleLinkCharacterIds());
  for (const path of ["kart_/KartA/model.1s", "kart_/KartB/model.1s",
    "kart_/KartC/model.1s", "kart_/KartD/model.1s", "kart_/Missing/model.1s"]) {
    for (const method of ["vehicleEngineGrade", "vehicleItemId", "vehicleLinkCharacterId"] as const) {
      assert.deepEqual(await outcome(() => authored[method](path)),
        await outcome(() => original[method](path)));
    }
  }
  assert.equal(await authored.vehicleEngineGrade("kart_/KartA/model.1s"), 8);
  assert.equal(await authored.vehicleItemId("kart_/KartA/model.1s"), 101);
  assert.equal(await authored.vehicleLinkCharacterId("kart_/KartC/model.1s"), 0);
  assert.equal(authored.vehicleEngineGradePromise, authored.vehicleEngineGradePromise);
});

test("真实 p3553 车辆档案索引筛选出的可驾驶模型与原版一致", async () => {
  const index = JSON.parse(inflateSync(readFileSync(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as {
    rho: { name: string; files: { path: string }[] }[];
    rho5: { name: string; files: { path: string }[] }[];
  };
  const files: VehicleResource[] = [];
  index.rho.forEach((archive, ordinal) => {
    const mount = archive.name.replace(/\.rho$/i, "");
    for (const record of archive.files) {
      const virtualPath = `${mount}/${record.path}`;
      const name = record.path.split("/").at(-1)!;
      files.push({ virtualPath, canonicalPath: virtualPath, name,
        extension: name.split(".").at(-1)!.toLowerCase(),
        sourceName: archive.name, sourceKind: "rho", containerId: `rho:${ordinal}` });
    }
  });
  for (const archive of index.rho5) for (const record of archive.files) {
    const name = record.path.split("/").at(-1)!;
    files.push({ virtualPath: record.path, canonicalPath: record.path, name,
      extension: name.split(".").at(-1)!.toLowerCase(),
      sourceName: archive.name, sourceKind: "rho5", containerId: `rho5:${archive.name}` });
  }
  const original = setup(ReleaseLibrary, files);
  const authored = setup(AuthoredLibrary, files);
  const originalModels = original.vehicleAssets();
  const authoredModels = authored.vehicleAssets();
  assert.deepEqual(authoredModels, originalModels);
  assert.equal(authoredModels.length, 1096);
  assert.deepEqual(await authored.vehicleCatalog(), await original.vehicleCatalog());
  assert.ok(authoredModels.some(model => model.virtualPath.includes("kart_")));
});

test("真实 p3553 ItemTable 车辆身份值与原版冲突判定一致", async () => {
  const index = JSON.parse(inflateSync(readFileSync(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8"), (_key, value: unknown) => {
    if (value && typeof value === "object" && "$u8" in value &&
        typeof value.$u8 === "string") return Uint8Array.from(Buffer.from(value.$u8, "base64"));
    return value;
  }) as { rho5: Rho5ArchiveIndex[] };
  const dataPack = index.rho5.find(group => group.name.toLowerCase() === "datapack1");
  assert.ok(dataPack);
  const sources: ArchiveSource[] = dataPack.parts.map(part => {
    const bytes = readFileSync(path.resolve(project, "../mirror/p3553", part.name));
    const copy = (chunk: Uint8Array): ArrayBuffer => Uint8Array.from(chunk).buffer as ArrayBuffer;
    return {
      name: part.name, size: bytes.length,
      arrayBuffer: async () => copy(bytes),
      slice: (start = 0, end = bytes.length) => ({
        arrayBuffer: async () => copy(bytes.subarray(start, end)),
      }),
    };
  });
  const payload = await new Rho5Reader(dataPack, sources).read("etc_/itemTable.kml");
  assert.deepEqual([...payload.subarray(0, 2)], [255, 254]);
  const xml = new TextDecoder("utf-16le", { fatal: true }).decode(payload.subarray(2));
  const definitions: VehicleDefinition[] = [];
  for (const match of xml.matchAll(/<kart\b([^>]*)\/>/g)) {
    const attributes = new Map<string, string>();
    for (const attribute of match[1]!.matchAll(/([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attributes.set(attribute[1]!, attribute[2] ?? attribute[3]!);
    const id = attributes.get("id");
    const name = attributes.get("name");
    if (!id || !/^\d+$/.test(id) || !name || !Number.isSafeInteger(Number(id))) continue;
    definitions.push({
      kind: "kart", internalId: name.trim(), itemId: Number(id),
      engineGrade: Number(attributes.get("engineGrade") ?? 0),
      linkCharacterId: Number(attributes.get("linkCharacterId") ?? 0),
    });
  }
  assert.ok(definitions.length > 500);
  const original = setup(ReleaseLibrary, [], definitions);
  const authored = setup(AuthoredLibrary, [], definitions);
  assert.deepEqual(await authored.loadVehicleEngineGrades(), await original.loadVehicleEngineGrades());
  assert.deepEqual(await authored.loadVehicleItemIds(), await original.loadVehicleItemIds());
  assert.deepEqual(await authored.loadVehicleLinkCharacterIds(), await original.loadVehicleLinkCharacterIds());
  for (const definition of definitions.slice(0, 20)) {
    const model = `kart_/${definition.internalId}/model.1s`;
    for (const method of ["vehicleEngineGrade", "vehicleItemId", "vehicleLinkCharacterId"] as const)
      assert.deepEqual(await outcome(() => authored[method](model)),
        await outcome(() => original[method](model)));
  }
});
