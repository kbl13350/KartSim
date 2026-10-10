import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RpResultNotice, type RpResultNoticeDependencies } from "./rp-result-notice";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class vy {");
const end = release.indexOf("\nasync function Nl0(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "lucky" | "unlucky" | "aborted" | "repeated" |
  "dispose" | "play-error" | "sound-error" | "view-error" |
  "render-error" | "state";

async function observeLifecycle(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const box = { name: "Play1SPanel", children: [] };
  const sparkle = { name: "Play1SPanel", children: [] };
  let nextFrame = 0;
  const deps = {
    nodeName: (node: { name: string }) => node.name,
    nowMs: () => 1000,
    requestFrame: (_callback: () => void) => {
      events.push(["frame", ++nextFrame]); return nextFrame;
    },
    cancelFrame: (frame: number) => { events.push(["cancel", frame]); },
  } as unknown as RpResultNoticeDependencies;
  const Original = new Function("T", "performance", "requestAnimationFrame",
    "cancelAnimationFrame", `${originalClass}\nreturn vy;`)(
      deps.nodeName, { now: deps.nowMs }, deps.requestFrame,
      deps.cancelFrame,
    ) as new (lucky: boolean, box: unknown, sparkle: unknown) => RpResultNotice;
  const notice = rewritten
    ? new RpResultNotice(variant !== "unlucky", box, sparkle, deps)
    : new Original(variant !== "unlucky", box, sparkle);
  notice.scene = {
    play(node, nowMs) {
      events.push(["play", node === box ? "box" : "sparkle", nowMs]);
      if (variant === "play-error") throw new Error("play failed");
    },
    paintKart(_canvas, _rect, nowMs) { events.push(["paint-kart", nowMs]); },
    paint(node, _canvas, _rect, nowMs) {
      events.push(["paint", node === box ? "box" : "sparkle", nowMs]);
    },
    dispose() { events.push(["scene-dispose"]); },
  };
  notice.sound = {
    async prepare() {},
    play(kind) { events.push(["sound", kind]);
      if (variant === "sound-error") throw new Error("sound failed"); },
    stop() { events.push(["sound-stop"]); },
    dispose() { events.push(["sound-dispose"]); },
  };
  notice.view = {
    element: { dataset: {} },
    show() { events.push(["show"]);
      if (variant === "view-error") throw new Error("view failed"); },
    hide() { events.push(["hide"]); },
    render() { events.push(["render"]);
      if (variant === "render-error") throw new Error("render failed"); },
    dispose() { events.push(["view-dispose"]); },
  };
  const controller = new AbortController();
  if (variant === "aborted") controller.abort();
  let error: string | undefined;
  let settled: string | undefined;
  if (variant === "state") {
    for (const node of [{ name: "boxOpen", children: [] },
      { name: "noticeDlg", children: [] }, { name: "당첨", children: [] },
      { name: "꽝", children: [] }, { name: "main", children: [] },
      box, sparkle, { name: "other", children: [] }]) {
      const state = notice.state(node);
      events.push(["state", node.name, state.visible,
        typeof state.paint === "function"]);
      if (typeof state.paint === "function") state.paint({}, {});
    }
  } else {
    let promise: Promise<void> | undefined;
    try {
      promise = notice.present(controller.signal);
      if (variant === "repeated") {
        try { notice.present(controller.signal); }
        catch (failure) { events.push(["repeat-error", (failure as Error).message]); }
      }
      if (variant === "lucky" || variant === "unlucky" ||
        variant === "render-error") {
        notice.update(3600);
        notice.update(7200);
      }
      if (variant === "dispose" || variant === "repeated") notice.dispose();
    } catch (failure) { error = (failure as Error).message; }
    if (promise) {
      if (variant === "aborted" || variant === "dispose" ||
        variant === "play-error" || variant === "sound-error" ||
        variant === "view-error" || variant === "render-error" ||
        variant === "repeated") {
        try { await promise; settled = "resolved"; }
        catch (failure) { settled = (failure as Error).message; }
      } else {
        await promise;
        settled = "resolved";
      }
    }
  }
  return { events, error, settled, phase: notice.phase,
    now: notice.now, since: notice.since,
    started: notice.started, disposed: notice.disposed,
    animation: notice.animation, hasComplete: !!notice.complete };
}

test("RP result reveal, state painting, cancellation and cleanup match release", async () => {
  for (const variant of ["lucky", "unlucky", "aborted", "repeated",
    "dispose", "play-error", "sound-error", "view-error",
    "render-error", "state"] as const) {
    assert.deepEqual(await observeLifecycle(true, variant),
      await observeLifecycle(false, variant), variant);
  }
});

type LoadVariant = "normal" | "invalid-race" | "missing-draw" |
  "missing-kart" | "missing-pet" | "scene-error" | "sound-error" |
  "prepare-error" | "view-error";

async function observeLoad(rewritten: boolean, variant: LoadVariant) {
  const events: unknown[][] = [];
  const box = { name: "Play1SPanel", children: [] };
  const sparkle = { name: "Play1SPanel", children: [] };
  const decorated = { name: "Root", children: [
    { name: "boxOpen", children: [box] },
    { name: "noticeDlg", children: [{ name: "당첨", children: [sparkle] }] },
  ] };
  const root = { id: "root" };
  const library = {
    async timeAttackGarageCatalog() {
      events.push(["catalog"]);
      return { karts: variant === "missing-kart" ? [] :
        [{ itemId: 3, title: "赛车甲" }],
      equipment: variant === "missing-pet" ? [] :
        [{ kind: "flyingPet", itemId: 5, title: "飞宠甲" }] };
    },
  };
  const draws: Record<string, { kartId: number; flyingPetId: number }> =
    variant === "missing-draw" ? {} : {
      self: { kartId: 3, flyingPetId: 5 },
    };
  const race = {
    rp: variant === "invalid-race" ? undefined : {
      draws,
    },
    roster: [{ playerId: "self" }],
  };
  const scene = { play() {}, paintKart() {}, paint() {},
    dispose() { events.push(["scene-dispose"]); } };
  const sound = { async prepare() { events.push(["prepare"]);
    if (variant === "prepare-error") throw new Error("prepare failed"); },
  play() {}, stop() { events.push(["stop"]); },
  dispose() { events.push(["sound-dispose"]); } };
  const view = { element: { dataset: {} as Record<string, string> },
    show() {}, hide() { events.push(["hide"]); }, render() {},
    dispose() { events.push(["view-dispose"]); } };
  const dependencies = {
    validDraws: (_draws: unknown, ids: string[]) => {
      events.push(["valid", ids]); return variant !== "invalid-race";
    },
    loadDefinition: async (_library: unknown, directory: string, name: string) => {
      events.push(["definition", directory, name]); return { name: "Original", children: [] };
    },
    decorateDefinition: (_definition: unknown, kartTitle: string,
      petTitle: string) => {
      events.push(["decorate", kartTitle, petTitle]); return decorated;
    },
    nodeName: (node: { name: string }) => node.name,
    loadScene: async (_library: unknown, definition: unknown, kart: unknown) => {
      events.push(["scene", definition === decorated, kart]);
      if (variant === "scene-error") throw new Error("scene failed");
      return scene;
    },
    loadSound: async (_library: unknown, audio: unknown) => {
      events.push(["sound", audio]);
      if (variant === "sound-error") throw new Error("sound failed");
      return sound;
    },
    loadView: async (options: Record<string, unknown>) => {
      events.push(["view", options.library === library,
        options.root === root, options.definition === decorated,
        options.roots, options.label, options.modal,
        typeof options.state]);
      if (variant === "view-error") throw new Error("view failed");
      return view;
    },
    nowMs: () => 1000,
    requestFrame: (_callback: () => void) => 1,
    cancelFrame: (_id: number) => undefined,
  } as unknown as RpResultNoticeDependencies;
  const legacyDependencies = {
    ba: dependencies.validDraws,
    F9: dependencies.loadDefinition,
    Vl0: dependencies.decorateDefinition,
    T: dependencies.nodeName,
    my: { load: dependencies.loadScene },
    wy: { load: dependencies.loadSound },
    te: { load: dependencies.loadView },
    performance: { now: dependencies.nowMs },
    requestAnimationFrame: dependencies.requestFrame,
    cancelAnimationFrame: dependencies.cancelFrame,
  };
  const Original = new Function(...Object.keys(legacyDependencies),
    `${originalClass}\nreturn vy;`)(...Object.values(legacyDependencies)) as {
      load(library: unknown, root: unknown, race: unknown, playerId: string,
        audio: unknown): Promise<RpResultNotice>;
    };
  class Modern extends RpResultNotice {
    constructor(lucky: boolean,
      box: ConstructorParameters<typeof RpResultNotice>[1],
      sparkle: ConstructorParameters<typeof RpResultNotice>[2]) {
      super(lucky, box, sparkle, dependencies);
    }
  }
  let notice: RpResultNotice | undefined;
  let error: string | undefined;
  try {
    notice = rewritten
      ? await Modern.load(library, root, race, "self", "audio", dependencies)
      : await Original.load(library, root, race, "self", "audio");
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, notice: notice && {
    lucky: notice.lucky, box: notice.box === box,
    sparkle: notice.sparkle === sparkle,
    phase: notice.phase, layer: notice.view?.element.dataset.uiLayer,
  } };
}

test("RP result asset identity and staged failure cleanup match release", async () => {
  for (const variant of ["normal", "invalid-race", "missing-draw",
    "missing-kart", "missing-pet", "scene-error", "sound-error",
    "prepare-error", "view-error"] as const) {
    assert.deepEqual(await observeLoad(true, variant),
      await observeLoad(false, variant), variant);
  }
});
