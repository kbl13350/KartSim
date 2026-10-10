import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  loadGhostDecorations, loadGhostKartAssets, rankGhostColors,
  type GhostAssetBuilder, type GhostAssetDependencies, type GhostAssetLibrary,
  type GhostKartCatalogEntry, type GhostSource,
} from "./ghost-asset-loading";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class if0 extends ul {");
const end = release.indexOf("\nclass rf0", start);
assert.ok(start >= 0 && end > start);
const classSource = release.slice(start, end);
const names = new Set(["loadGhostKartAssets", "loadGhostDecorations", "rankColors"]);
const selected = parse(classSource, { sourceType: "script" }).program.body[0]
  .body.body.filter((member: any) => member.type === "ClassMethod" &&
    names.has(member.key.name));
assert.equal(selected.length, names.size);
const originalSource = selected.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Mode = "ordinary" | "linked-always" | "linked-conditional" | "zero-kart" |
  "no-library" | "missing-kart" | "missing-metadata" | "invalid-linked" |
  "missing-character" | "no-balloon" | "failed-accessory" | "failed-paint";
type Builder = GhostAssetBuilder & {
  loadGhostKartAssets(...args: unknown[]): Promise<unknown>;
  loadGhostDecorations(...args: unknown[]): Promise<unknown>;
  rankColors(ghosts: GhostSource[]): Promise<unknown>;
};

function makeFixture(mode: Mode, rewritten: boolean) {
  const events: unknown[][] = [];
  const scene = { name: "scene" };
  const importer = { name: "importer" };
  const signal = { name: "signal" };
  const linked = mode.startsWith("linked") || mode === "invalid-linked";
  const kart: GhostKartCatalogEntry = {
    itemId: mode === "zero-kart" ? 0 : 7,
    path: "kart_/sample.kart",
    systemKey: 23,
    textureKey: "kart-texture",
    engineGrade: 4,
    fixedPlateId: 14,
    hideChar: mode === "invalid-linked",
    characterAniType: 0,
    ...(linked ? { linkCharacterId: 42, alwaysLinkCharacter: mode === "linked-always" } : {}),
  };
  if (mode === "missing-metadata") delete kart.textureKey;
  const ghost: GhostSource = { equipment: {
    kart: kart.itemId,
    kartPath: "kart_/sample.kart",
    systemKey: 23,
    character: 3,
    characterColor: 0x1234567,
    itemIds: { 2: 10, 8: 8, 9: mode === "no-balloon" ? 0 : 9,
      11: 11, 16: 16 },
  } };
  const dispose = (name: string) => ({ dispose() { events.push(["dispose", name]); } });
  const library: GhostAssetLibrary = {
    async timeAttackGarageCatalog() {
      events.push(["catalog"]);
      return { karts: [kart], characters: mode === "missing-character"
        ? [] : [{ itemId: 3, path: "character_/neo" }] };
    },
    async timeAttackLinkedCharacterItem(id) {
      events.push(["linked-item", id]); return { path: "character_/linked" };
    },
    async timeAttackCharacterItem(id, path) {
      events.push(["character-item", id, path]); return { itemId: id, path };
    },
    async timeAttackDecorationItem(slot, itemId) {
      events.push(["decoration-item", slot, itemId]);
      return { internalId: `${slot}:${itemId}`, title: "ornament" };
    },
  };
  const findKart: GhostAssetDependencies["findKart"] = (_catalog, id, path, key) => {
    events.push(["find-kart", id, path, key]);
    return mode === "missing-kart" ? undefined : kart;
  };
  const createVehicleTimeAttackParameters = (_identity: unknown, speed: unknown,
    body: unknown, version: unknown) => {
    events.push(["parameters", speed, body, version]);
    return { spec: { motorcycleType: 1 } };
  };
  const AS = { createVehicleTimeAttackParameters };
  const El = async (load: () => Promise<unknown>, marker: unknown) => {
    events.push(["preload", marker]); return load();
  };
  const loadBodyParameter: GhostAssetDependencies["loadBodyParameter"] =
    async (_library, path, key) => {
      events.push(["body", path, key]);
      return { parameter: { value: "body-params" } };
    };
  const ghostItemIds = (equipment: GhostSource["equipment"]) => {
    events.push(["item-ids", equipment.kart]); return equipment.itemIds;
  };
  const loadPaintColor: GhostAssetDependencies["loadPaintColor"] =
    async (_library, itemId, slot) => {
      events.push(["paint", itemId, slot]);
      if (mode === "failed-paint") throw new Error("paint unavailable");
      return { primary: 0x1234567 };
    };
  const createBalloon: GhostAssetDependencies["createBalloon"] =
    async (_library, internalId, actualScene, actualImporter, config) => {
      events.push(["balloon", internalId, actualScene === scene,
        actualImporter === importer, config.wireColor]);
      return dispose("balloon");
    };
  const createAccessory: GhostAssetDependencies["createAccessory"] =
    async (_library, kind, internalId, actualScene, actualImporter, config) => {
      events.push(["accessory", kind, internalId,
        actualScene === scene, actualImporter === importer,
        config.convertClientCoordinates]);
      if (mode === "failed-accessory" && kind === "headBand") {
        throw new Error("accessory unavailable");
      }
      return dispose(kind);
    };
  const dependencies: GhostAssetDependencies = {
    findKart,
    async loadParameterFactory() {
      const loaded = await El(async () => {
        const { createVehicleTimeAttackParameters: create } =
          await Promise.resolve().then(() => AS);
        return { createVehicleTimeAttackParameters: create };
      }, undefined) as typeof AS;
      return loaded.createVehicleTimeAttackParameters;
    },
    loadBodyParameter, ghostItemIds, loadPaintColor, createBalloon, createAccessory,
  };
  const Original = new Function("b4", "El", "AS", "t3", "U_", "We", "Jw", "hr",
    `return class { ${originalSource} };`)(
      findKart, El, AS, loadBodyParameter, ghostItemIds,
      loadPaintColor, createBalloon, createAccessory,
    ) as new () => Builder;
  const builder = new Original();
  Object.assign(builder, {
    host: {
      getLibrary() { events.push(["library"]); return mode === "no-library" ? undefined : library; },
      userProfile: { equipment: { itemIds: { 70: 0x1234567 } } },
    },
    async loadVehicleRuntime(...args: unknown[]) {
      events.push(["vehicle-runtime", args[0], args[1], args[2],
        args[3] === library, args[4] === scene, args[5] === importer,
        args[10], args[11] === signal, args[12]]);
      return { imported: "imported-kart", visual: {
        reverse: "reverse-visual", onCharacterSize: "resize-character",
      } };
    },
    async loadCharacterAsset(...args: unknown[]) {
      events.push(["character-asset", args[0], args[2], args[3], args[4],
        args[5] === scene, args[6] === importer, args[7], args[9] === signal]);
      return { scene: "character-scene" };
    },
  });
  if (rewritten) Object.assign(builder, {
    loadGhostKartAssets(value: GhostSource, targetScene: unknown, targetImporter: unknown,
      speed: unknown, version: unknown, targetSignal: unknown) {
      return loadGhostKartAssets(builder, value, targetScene, targetImporter,
        speed, version, targetSignal, dependencies);
    },
    loadGhostDecorations(value: GhostSource, source: GhostAssetLibrary,
      targetScene: unknown, targetImporter: unknown) {
      return loadGhostDecorations(value, source, targetScene, targetImporter, dependencies);
    },
    rankColors(values: GhostSource[]) { return rankGhostColors(builder, values, dependencies); },
  });
  return { builder, events, ghost, library, scene, importer, signal };
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try { return { value: await promise }; }
  catch (error) { return { error: (error as Error).message }; }
}

test("Ghost kart identity, motorcycle mode and linked characters match release", async () => {
  for (const mode of ["ordinary", "linked-always", "linked-conditional", "zero-kart",
    "no-library", "missing-kart", "missing-metadata", "invalid-linked",
    "missing-character"] as const) {
    async function inspect(rewritten: boolean): Promise<unknown> {
      const fixture = makeFixture(mode, rewritten);
      const { builder, ghost, scene, importer, signal, events } = fixture;
      const result = await capture(builder.loadGhostKartAssets(ghost, scene, importer,
        7, "国服", signal));
      return { result, events };
    }
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});

test("Ghost decorations release completed assets on failure like release", async () => {
  for (const mode of ["ordinary", "no-balloon", "failed-accessory", "failed-paint"] as const) {
    async function inspect(rewritten: boolean): Promise<unknown> {
      const fixture = makeFixture(mode, rewritten);
      const { builder, ghost, library, scene, importer, events } = fixture;
      const result = await capture(builder.loadGhostDecorations(ghost, library, scene, importer));
      const normalized = "value" in (result as object)
        ? { balloon: !!(result as { value: { balloon?: unknown } }).value.balloon,
          accessories: (result as { value: { accessories: Array<{ kind: string }> } })
            .value.accessories.map(entry => entry.kind) }
        : result;
      return { result: normalized, events };
    }
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});

test("Ghost rank colors include the local rider and mask paint values like release", async () => {
  for (const mode of ["ordinary", "no-library", "failed-paint"] as const) {
    async function inspect(rewritten: boolean): Promise<unknown> {
      const fixture = makeFixture(mode, rewritten);
      const { builder, ghost, events } = fixture;
      const result = await capture(builder.rankColors([
        ghost, { equipment: { ...ghost.equipment, characterColor: 0 } },
      ]));
      return { result, events };
    }
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});
