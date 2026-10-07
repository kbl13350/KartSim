import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  disposeGaragePreview, loadGarageEquipmentCard, loadGarageKartCard,
  garageEquipmentCardKey, normalizedGarageKartPath,
  setParticleModificationPageVisible, syncGarageCards, syncGarageCharacters,
  syncGarageCoatingPreview, syncGarageEquipment, syncGarageKarts,
  syncGaragePreview, validateCoatingEquipment,
  type GarageLivePanelAssetDependencies, type GarageLivePanelAssetsHost,
} from "./garage-live-panel-assets";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class E7 {");
const end = release.indexOf("\nfunction xc(", start);
assert.ok(start >= 0 && end > start);

test("garage live asset identity keys match release", () => {
  const keyStart = release.indexOf("function xc(", end);
  const keyEnd = release.indexOf("function QP(", keyStart);
  const pathStart = release.indexOf("function n80(", keyEnd);
  const pathEnd = release.indexOf("async function Qv(", pathStart);
  assert.ok(keyEnd > keyStart && pathEnd > pathStart);
  const oldKey = new Function(`${release.slice(keyStart, keyEnd)}\nreturn xc;`)() as
    (item: { kind: string; itemId: number }) => string;
  const oldPath = new Function(`${release.slice(pathStart, pathEnd)}\nreturn n80;`)() as
    (path: string) => string;
  for (const item of [{ kind: "kart", itemId: 1 }, { kind: "balloon", itemId: 27 }])
    assert.equal(garageEquipmentCardKey(item), oldKey(item));
  for (const path of ["KART_\\Foo\\model.1s", "kart_/bar/model.1s"])
    assert.equal(normalizedGarageKartPath(path), oldPath(path));
});

async function exercise(readable: boolean) {
  const events: unknown[] = [];
  const disposeCharacter = (value: unknown) => events.push(["character-dispose", value]);
  const disposeKart = (value: unknown) => events.push(["kart-dispose", value]);
  const disposePreview = (value: unknown) => events.push(["preview-dispose",
    (value as { id: string }).id]);
  const loadCharacter = async (_library: unknown, item: { itemId: number },
    _environment: unknown, _binding: unknown, mode: string) => {
    events.push(["character-load", item.itemId, mode]);
    return { id: `character:${item.itemId}` };
  };
  const loadKart = async (_library: unknown, item: { itemId: number }) => {
    events.push(["kart-load", item.itemId]);
    return { id: `kart:${item.itemId}` };
  };
  const loadEquipment = async (_library: unknown, item: { itemId: number }) => {
    events.push(["equipment-load", item.itemId]);
    return { dispose() { events.push(["equipment-dispose", item.itemId]); } };
  };
  const createPreview = async (_library: unknown, kart: { itemId: number },
    rider: { itemId: number }, _environment: unknown, _binding: unknown,
    _importer: unknown, mode: string) => {
    events.push(["preview-load", kart.itemId, rider.itemId, mode]);
    return { id: `preview:${kart.itemId}`, reverse: true, origin: 22,
      kart: { model: { name: "model" } },
      coatingSource: { itemId: kart.itemId, visual: "visual", engineGrade: 8 },
      particleModification: {
        setPresentationAllowed: (allowed: boolean) => events.push(["particles", allowed]),
      } };
  };
  const createFitting = () => ({ current: "coating",
    select: async (request: unknown) => { events.push(["coating-select", request]); return true; },
    cancel: () => { events.push(["coating-cancel"]); },
    dispose: () => { events.push(["coating-dispose"]); },
  });
  const deps: GarageLivePanelAssetDependencies = {
    coatingEquipment: async (_library, model, visual, grade, coating) => {
      events.push(["coating-validate", model, visual, grade, coating]);
    },
    equipmentKey: item => `${item.kind}:${item.itemId}`,
    loadEquipment, disposeCharacter, loadCharacter,
    kartKey: item => `kart:${item.itemId}`,
    disposeKart, loadKart,
    garageKart: () => ({ cosmetics: { coating: "blue" },
      progression: { kind: "xun", level: 2 } }),
    normalizedKartPath: path => path.replaceAll("\\", "/").toLowerCase(),
    loadPreview: createPreview, disposePreview,
    createCoatingFitting: createFitting,
  };
  const Original = new Function("Ak", "xc", "La0", "af", "Ho", "N3", "Js",
    "Qv", "n80", "p5", "T7", "Lt", "JP",
    `${release.slice(start, end)}\nreturn E7;`)(
      deps.coatingEquipment, deps.equipmentKey, deps.loadEquipment,
      deps.disposeCharacter, deps.loadCharacter, deps.kartKey, deps.disposeKart,
      deps.loadKart, deps.normalizedKartPath, deps.garageKart,
      deps.loadPreview, deps.disposePreview, deps.createCoatingFitting,
    ) as new () => GarageLivePanelAssetsHost;
  const host = Object.create(readable ? Object.prototype : Original.prototype) as
    GarageLivePanelAssetsHost;
  Object.assign(host, {
    library: {}, environment: {}, stageBinding: {}, importer: {},
    previewMode: "ready", coatingTextures: {}, particleModificationPageVisible: true,
    characters: new Map(), karts: new Map(), equipment: new Map(),
    characterLoading: new Set(), kartLoading: new Set(), equipmentLoading: new Set(),
    characterFailed: new Set(), kartFailed: new Set(), equipmentFailed: new Set(),
    desiredCharacters: new Set(), desiredKarts: new Set(), desiredEquipment: new Set(),
    previewGeneration: 0, previewReverse: false, disposed: false,
    transformPreviewEnabled: true, transformPreviewTimelineActive: true,
    transformPreviewCancelled: true, transformPreviewCompleted: true,
    transformPreviewClosing: true,
    onReady: () => events.push(["ready"]),
    resetPreviewRotation: () => events.push(["rotation-reset"]),
  });
  if (readable) Object.assign(host, {
    disposePreview: () => disposeGaragePreview(host, deps),
    syncCharacters: (items: unknown[]) => syncGarageCharacters(host, items as never, deps),
    syncKarts: (items: unknown[]) => syncGarageKarts(host, items as never, deps),
    syncEquipment: (items: unknown[]) => syncGarageEquipment(host, items as never, deps),
    loadEquipmentCard: (item: unknown) => loadGarageEquipmentCard(host, item as never, deps),
    loadKartCard: (item: unknown) => loadGarageKartCard(host, item as never, deps),
  });
  const call = (name: string, ...args: unknown[]) => {
    if (!readable) return (host as unknown as Record<string, (...params: unknown[]) => unknown>)[name]!(...args);
    const functions = {
      syncCards: (items: unknown[]) => syncGarageCards(host, items as never),
      syncPreview: (kart: unknown, rider: unknown, selection: unknown) =>
        syncGaragePreview(host, kart as never, rider as never, selection as never, deps),
      syncCoatingPreview: (request: unknown) => syncGarageCoatingPreview(host, request, deps),
      setParticleModificationPageVisible: (visible: boolean) =>
        setParticleModificationPageVisible(host, visible),
      validateCoatingEquipment: (id: number, coating: unknown) =>
        validateCoatingEquipment(host, id, coating as never, deps),
      disposePreview: () => disposeGaragePreview(host, deps),
    } as Record<string, (...params: never[]) => unknown>;
    return functions[name]!(...args as never[]);
  };
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));
  const snapshot = () => ({
    characters: [...host.characters.keys()], karts: [...host.karts.keys()],
    equipment: [...host.equipment.keys()],
    loading: [host.characterLoading.size, host.kartLoading.size, host.equipmentLoading.size],
    desired: [[...host.desiredCharacters], [...host.desiredKarts], [...host.desiredEquipment]],
    preview: (host.preview as { id?: string } | undefined)?.id,
    previewKey: host.previewKey, previewGeneration: host.previewGeneration,
    previewReverse: host.previewReverse, coatingRequest: host.coatingRequest,
    coatingFailure: host.coatingFailure,
    origin: host.preview?.origin,
    motion: [
      (host as unknown as Record<string, boolean>).transformPreviewEnabled,
      (host as unknown as Record<string, boolean>).transformPreviewTimelineActive,
      (host as unknown as Record<string, boolean>).transformPreviewCancelled,
      (host as unknown as Record<string, boolean>).transformPreviewCompleted,
      (host as unknown as Record<string, boolean>).transformPreviewClosing,
    ],
    events: structuredClone(events),
  });
  const states: unknown[] = [];
  const character = { kind: "character", itemId: 8 };
  const kart = { kind: "kart", itemId: 3, path: "KART_\\X\\model.1s" };
  const equipment = { kind: "balloon", itemId: 5, category: "decoration" };
  call("syncCards", [character, kart, equipment]);
  states.push(snapshot());
  await flush(); states.push(snapshot());
  call("syncCards", []);
  states.push(snapshot());
  const selection = { equipment: { itemIds: { 2: 8, 3: 3, 4: 2, 70: 1 }, kartSerial: 9 },
    garage: {}, initial: true };
  call("syncPreview", kart, character, selection);
  states.push(snapshot());
  await flush(); states.push(snapshot());
  call("setParticleModificationPageVisible", false);
  (host as { previewMode: string }).previewMode = "kart-only";
  call("syncCoatingPreview", "blue");
  await flush(); states.push(snapshot());
  await call("validateCoatingEquipment", 3, { family: "color", id: "blue" });
  states.push(snapshot());
  call("syncCoatingPreview", undefined);
  states.push(snapshot());
  call("disposePreview");
  states.push(snapshot());
  return states;
}

test("garage live card and preview ownership matches release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});
