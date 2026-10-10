import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  setGhostVisualAssets, setGhostVisualDecorations,
  type GhostVisualAssetDependencies, type GhostVisualAssetHost,
} from "./ghost-visual-assets";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Xd0 {");
const end = release.indexOf("\nconst J_", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Visual = GhostVisualAssetHost & {
  setAssets(...args: unknown[]): void;
  setDecorations(...args: unknown[]): void;
};
type Mode = "linked" | "scaled" | "no-character" | "missing-root" |
  "missing-mount" | "balloon-fallback";

function makeFixture(mode: Mode, rewritten: boolean) {
  const events: unknown[][] = [];
  const rootNode = { children: Array.from({ length: 7 }, () => ({ value: {} })) };
  const mountNode = { children: [] };
  rootNode.children[6] = { value: mountNode };
  const sceneObject = (name: string) => ({
    name,
    add(child: unknown) { events.push([`${name}-add`, child === character.object
      ? "character" : (child as { name?: string })?.name ?? child]); },
    clear() { events.push([`${name}-clear`]); },
  });
  const rootRender = sceneObject("root-render");
  const characterMount = sceneObject("character-mount");
  const balloonMount = sceneObject("balloon-mount");
  const modelMount = sceneObject("model-mount");
  const socket = sceneObject("socket");
  const character = {
    object: { ...sceneObject("character"), scale: {
      setScalar(value: number) { events.push(["character-scale", value]); },
    } },
    getDecorationSocket(first: unknown, second: unknown) {
      events.push(["decoration-socket", first, second]);
      return first === "head" ? socket : undefined;
    },
  };
  const imported = {
    model: { model: true }, object: "kart-mesh", animation: { playing: true },
    scene: { nodes: new Map<string, { object: ReturnType<typeof sceneObject> }>([
      ["body", { object: balloonMount }],
    ]) },
    renderScene: { bySource: new Map<object, ReturnType<typeof sceneObject>>([
      ...mode === "missing-root" ? [] : [[rootNode, rootRender] as const],
      ...mode === "missing-mount" ? [] : [[mountNode, characterMount] as const],
    ]) },
  };
  const visualInfo = { attachments: Array(17).fill("body") as string[] };
  if (mode === "balloon-fallback") visualInfo.attachments[16] = "balloon";
  let now = 100;
  const dependencies: GhostVisualAssetDependencies = {
    serializedRoot(model) { events.push(["serialized-root", model]); return rootNode; },
    createLinkedPresentation(root, mount, driver, always) {
      events.push(["linked", root === rootRender,
        mount === characterMount, driver === character.object, always]);
      return { setMode(value) { events.push(["linked-mode", value]); } };
    },
    collectToonPairs(object, pairs) {
      events.push(["toon", object === modelMount ? "model-mount"
        : (object as { name?: string }).name ?? object, !!pairs]);
      pairs?.push("copied-pair");
    },
    createBalloonMount(model, scene) {
      events.push(["create-balloon-mount", model, scene === imported.scene]);
      return balloonMount;
    },
    decorationSockets: { headBand: ["head", 2], back: ["back", 3] },
    nowMs() { events.push(["now"]); return now++; },
  };
  const Original = new Function("J5", "_a", "qf", "c7", "jd0", "performance",
    `${originalClass}\nreturn Xd0;`)(
      dependencies.serializedRoot,
      class { constructor(root: unknown, mount: unknown, driver: unknown,
        always: boolean) {
        return dependencies.createLinkedPresentation(root as never,
          mount as never, driver as never, always);
      } },
      dependencies.collectToonPairs, dependencies.createBalloonMount,
      dependencies.decorationSockets, { now: dependencies.nowMs },
    ) as new () => Visual;
  const visual = Object.create(Original.prototype) as Visual;
  visual.modelMount = modelMount;
  visual.toonPairs = ["stale"];
  visual.attachmentNodes = [];
  visual.accessories = [];
  if (rewritten) Object.assign(visual, {
    setAssets(kart: typeof imported, driver: typeof character | undefined,
      scale: number, linked: string | undefined,
      resource: typeof visualInfo, motorcycle: unknown,
      format: string, level: number) {
      return setGhostVisualAssets(visual, kart, driver, scale, linked,
        resource, motorcycle, format, level, dependencies);
    },
    setDecorations(balloon: unknown, accessories: unknown[]) {
      return setGhostVisualDecorations(visual, balloon as never,
        accessories as never, dependencies);
    },
  });
  return { visual, events, imported, character, visualInfo, sceneObject };
}

function observeAssets(mode: Mode, rewritten: boolean) {
  const { visual, events, imported, character, visualInfo } = makeFixture(mode, rewritten);
  let outcome: unknown;
  try {
    visual.setAssets(imported, mode === "no-character" ? undefined : character,
      0.8, mode === "linked" ? "always" : undefined, visualInfo, true,
      "p3553", 6);
  } catch (error) { outcome = { error: (error as Error).message }; }
  return { outcome, events, nonDual: visual.usesP3553NonDualLinkedState,
    hasImported: !!visual.imported, hasCharacter: !!visual.character,
    hasLinked: !!visual.linkedPresentation, toonPairs: visual.toonPairs,
    attachmentCount: visual.attachmentNodes.length,
    balloonMountCreated: !!visual.attachmentNodes[16] };
}

test("Ghost kart and driver mounting, fallback and missing roots match release", () => {
  for (const mode of ["linked", "scaled", "no-character", "missing-root",
    "missing-mount", "balloon-fallback"] as const) {
    assert.deepEqual(observeAssets(mode, true), observeAssets(mode, false), mode);
  }
});

test("balloon and accessory reset, sockets and toon setup match release", () => {
  const inspect = (rewritten: boolean, withDriver: boolean) => {
    const { visual, events, imported, character, visualInfo,
      sceneObject } = makeFixture("scaled", rewritten);
    visual.setAssets(imported, withDriver ? character : undefined,
      0.8, undefined, visualInfo, false, "p3553", 7);
    const balloon = { scene: {
      reset(now: number) { events.push(["balloon-reset", now]); },
      object: sceneObject("balloon"),
    } };
    const accessories = ["headBand", "back"].map(kind => ({
      kind,
      render: { scene: {
        reset(now: number) { events.push([`${kind}-reset`, now]); },
        object: sceneObject(kind),
      } },
    }));
    visual.setDecorations(balloon, accessories);
    return { events, hasBalloon: !!visual.balloon,
      accessories: visual.accessories.map(item => item.kind) };
  };
  for (const withDriver of [true, false]) {
    assert.deepEqual(inspect(true, withDriver), inspect(false, withDriver));
  }
});
