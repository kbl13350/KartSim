import assert from "node:assert/strict";
import test from "node:test";
import { loadGhostKartAssets, type GhostAssetBuilder, type GhostAssetDependencies,
  type GhostAssetLibrary, type GhostKartCatalogEntry } from "../timeattack/ghost-asset-loading";
import { setGhostVisualAssets, type GhostVisualAssetHost } from "../timeattack/ghost-visual-assets";
import { updateGhostVisualFrame, type GhostVisualUpdateDependencies,
  type GhostVisualUpdateHost } from "../timeattack/ghost-visual-update";

test("dedicated Formula kart loading skips the external character and preserves its embedded rider mesh", async () => {
  const embeddedRider = { name: "original NPC rider" };
  let clears = 0, characterLoads = 0, characterLookups = 0;
  const mount = { children: [embeddedRider], clear() { clears++; this.children.length = 0; },
    add(value: unknown) { this.children.push(value as typeof embeddedRider); } };
  const characterNode = { children: [] };
  const serialized = { children: Array.from({ length: 7 }, (_, i) => ({ value: i === 6 ? characterNode : {} })) };
  const renderRoot = { clear() {}, add(_value: unknown) {} };
  const imported = { model: {}, scene: { nodes: new Map() }, object: { name: "NPC kart with rider" }, animation: {},
    renderScene: { bySource: new Map<object, typeof renderRoot>([[serialized, renderRoot], [characterNode, mount]]) } };
  const kart: GhostKartCatalogEntry = { itemId: 456, path: "kart_/npc_f1/kart.1s", engineGrade: 6,
    textureKey: "npc_f1", fixedPlateId: 0, hideChar: true, characterAniType: 0 };
  const library: GhostAssetLibrary = {
    timeAttackGarageCatalog: async () => ({ karts: [kart], characters: [{ itemId: 20, path: "character_/neo.1s" }] }),
    timeAttackLinkedCharacterItem: async () => { throw new Error("unexpected linked character lookup"); },
    timeAttackCharacterItem: async () => { characterLookups++; return {}; },
    timeAttackDecorationItem: async () => ({ internalId: 0 }),
  };
  const builder: GhostAssetBuilder = { host: { getLibrary: () => library, userProfile: { equipment: { itemIds: {} } } },
    loadVehicleRuntime: async () => ({ imported, visual: { reverse: false, onCharacterSize: 1 } }),
    loadCharacterAsset: async () => { characterLoads++; return { scene: { name: "external character" } }; },
  };
  const dependencies: GhostAssetDependencies = { findKart: () => kart,
    loadParameterFactory: async () => () => ({ spec: { motorcycleType: 0 } }),
    loadBodyParameter: async () => ({ parameter: { value: {} } }), ghostItemIds: equipment => equipment.itemIds,
    loadPaintColor: async () => ({ primary: 0 }), createBalloon: async () => ({ dispose() {} }),
    createAccessory: async () => ({ dispose() {} }),
  };
  const ghost = { hideCharacter: true, equipment: { kart: 456, character: 20, itemIds: {} } };
  const assets = await loadGhostKartAssets(builder, ghost, {}, {}, 7, "国服", undefined, dependencies);
  assert.equal(assets.character, undefined);
  assert.equal(assets.imported, imported);
  assert.equal(characterLoads, 0); assert.equal(characterLookups, 0);
  const attached: unknown[] = [];
  const visual: GhostVisualAssetHost = { usesP3553NonDualLinkedState: false, solid: true,
    modelMount: { clear() {}, add(value) { attached.push(value); } }, toonPairs: [], attachmentNodes: [], accessories: [] };
  setGhostVisualAssets(visual, imported, undefined, 1, undefined, { attachments: [] }, false, "p3553", 6, {
    serializedRoot: () => serialized,
    createLinkedPresentation: () => { throw new Error("dedicated NPC must not create external linked presentation"); },
    collectToonPairs: () => { throw new Error("Formula NPCs are solid, not translucent ghosts"); },
    createBalloonMount: () => renderRoot, decorationSockets: {}, nowMs: () => 0,
  });
  assert.equal(clears, 0);
  assert.deepEqual(mount.children, [embeddedRider]);
  assert.deepEqual(attached, [imported.object]);
  assert.equal(visual.character, undefined);

  const ordinary = await loadGhostKartAssets(builder, { ...ghost, hideCharacter: false }, {}, {}, 7, "国服", undefined, dependencies);
  assert.ok(ordinary.character, "ordinary replay ghosts still load their external character");
  assert.equal(characterLoads, 1); assert.equal(characterLookups, 1);
});

test("Formula world poses bypass stamp decoding while keeping kart orientation, boost and stun presentation", () => {
  const vectors = new Map<string, number[]>();
  const vector = (name: string) => ({ set(x: number, y: number, z: number) { vectors.set(name, [x, y, z]); } });
  let decoded = 0, basisDecoded = 0, appliedBasis = 0;
  const effects: number[] = [];
  const animations: number[] = [];
  const characters: Array<Record<string, unknown>> = [];
  const host: GhostVisualUpdateHost = {
    poseScratch: {}, basisScratch: {}, root: { position: vector("position"), quaternion: { setFromRotationMatrix(matrix) {
      assert.equal(matrix, host.orientationMatrix); appliedBasis++;
    } } },
    basisRight: vector("right"), basisUp: vector("up"), basisForward: vector("forward"),
    orientationMatrix: { makeBasis(right, up, forward) {
      assert.equal(right, host.basisRight); assert.equal(up, host.basisUp); assert.equal(forward, host.basisForward);
    } },
    lastBoosterState: 0, burstTeam: false, usesP3553NonDualLinkedState: true,
    toonPairs: [], accessories: [], trailState: 0,
    deriveMotion: () => ({ forwardSpeed: 50, rawSteer: 0.2, displaySpeedKmh: 180 }),
    updateAnimation: (_time, booster) => { animations.push(booster); }, ghostDualTeam: () => false,
    character: { update: (_time, _render, _seconds, _clock, state) => { characters.push(state); } },
    effects: { setState(booster) { effects.push(booster); return false; }, update() {} },
  };
  const fallback = { position: { x: 2, y: 4, z: 6 }, right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 } };
  const dependencies: GhostVisualUpdateDependencies = {
    decodePose() { decoded++; return fallback; },
    decodeBasis() { basisDecoded++; return fallback; },
    boosterState: status => status & 7, secondaryState: () => 0, instantAcceleration: () => false,
    copyToon() {}, nextTrailState: () => 0,
  };
  const pose = { position: { x: 123, y: 8, z: -456 }, right: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 }, forward: { x: 1, y: 0, z: 0 }, stunned: false };
  updateGhostVisualFrame(host, { sample: { status: 3, timeMs: 1000 }, formulaPose: pose, speedKmh: 180 },
    11_000, 1, 1 / 60, 0, undefined, dependencies);
  assert.equal(decoded, 0); assert.equal(basisDecoded, 0);
  assert.deepEqual(vectors.get("position"), [123, 8, -456]);
  assert.deepEqual(vectors.get("right"), [0, 0, -1]);
  assert.deepEqual(vectors.get("up"), [0, 1, 0]);
  assert.deepEqual(vectors.get("forward"), [1, 0, 0]);
  assert.deepEqual(effects, [3]); assert.deepEqual(animations, [3]);
  assert.equal(characters.at(-1)!.boosterState, 3);
  assert.equal(characters.at(-1)!.collisionHit, false);

  updateGhostVisualFrame(host, { sample: { status: 0, timeMs: 1050 }, formulaPose: { ...pose, stunned: true } },
    11_050, 1, 1 / 60, 0, undefined, dependencies);
  assert.equal(characters.at(-1)!.collisionHit, true);
  assert.equal(characters.at(-1)!.collisionStrength, 1);
  assert.equal(effects.at(-1), 0);
  assert.equal(appliedBasis, 2);

  updateGhostVisualFrame(host, { status: 0, timeMs: 1100 }, 11_100, 1, 1 / 60, 0, undefined, dependencies);
  assert.equal(decoded, 1, "ordinary replay stamps retain their original decoder path");
  assert.deepEqual(vectors.get("position"), [2, 4, 6]);
  assert.equal(characters.at(-1)!.collisionHit, false);
});
