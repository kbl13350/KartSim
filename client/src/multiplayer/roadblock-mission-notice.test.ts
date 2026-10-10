import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RoadblockMissionNotice, type RoadblockMissionDependencies,
  type RoadblockNoticeNode } from "./roadblock-mission-notice";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class yy {");
const end = release.indexOf("\nfunction NT(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "runner" | "blocker" | "missing-race" | "missing-player" |
  "missing-scene" | "missing-mission" | "missing-size" |
  "definition-error" | "view-error";

async function observeLoad(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const root = { id: "root" };
  const library = { id: "library" };
  const mission: RoadblockNoticeNode = {
    name: "roadBlockMisson", children: [],
    windowSize: variant === "missing-size" ? undefined : "320 100",
  };
  const scene: RoadblockNoticeNode = {
    name: "roadBlockFinalScene",
    children: variant === "missing-mission" ? [] : [mission],
  };
  const definition: RoadblockNoticeNode = {
    name: "stage", children: variant === "missing-scene" ? [] : [scene],
  };
  const view = { element: { dataset: {} as Record<string, string>,
    style: { pointerEvents: "" } },
  show() {}, render() {}, hide() {}, dispose() {} };
  const deps = {
    loadDefinition: async (_library: unknown, folder: string, name: string) => {
      events.push(["definition", _library === library, folder, name]);
      if (variant === "definition-error") throw new Error("definition failed");
      return definition;
    },
    attribute: (node: RoadblockNoticeNode, key: string) => node[key] as string | undefined,
    clone: (node: RoadblockNoticeNode, attributes: Record<string, string>,
      children?: RoadblockNoticeNode[]) => {
      events.push(["clone", node.name, attributes, children?.length]);
      return { ...node, ...attributes, children: children ?? node.children };
    },
    loadView: async (options: Record<string, unknown>) => {
      const card = options.definition as { children: RoadblockNoticeNode[] };
      const frames = card.children[0]!.children;
      const state = options.state as (node: RoadblockNoticeNode) => Record<string, unknown>;
      events.push(["view", options.library === library, options.root === root,
        JSON.stringify(options.definition), options.roots, options.label,
        options.preserveDisplayPixels, options.smoothImages,
        frames.map(frame => state(frame).visible), state(definition)]);
      if (variant === "view-error") throw new Error("view failed");
      return view;
    },
    nowMs: () => 0,
    requestFrame: (_callback: (timestamp: number) => void) => 1,
    cancelFrame: (_id: number) => undefined,
  } satisfies RoadblockMissionDependencies;
  const Original = new Function("F9", "T", "h2", "te", "performance",
    "requestAnimationFrame", "cancelAnimationFrame",
    `${originalClass}\nreturn yy;`)(deps.loadDefinition, deps.attribute,
      deps.clone, { load: deps.loadView }, { now: deps.nowMs },
      deps.requestFrame, deps.cancelFrame) as unknown as {
        load(library: unknown, root: unknown, race: unknown,
          playerId: string): Promise<RoadblockMissionNotice>;
      };
  class Modern extends RoadblockMissionNotice {
    constructor() { super(deps); }
  }
  const race = {
    roadblock: variant === "missing-race" ? undefined : {
      runnerId: variant === "blocker" ? "other" : "self",
    },
    roster: variant === "missing-player" ? [{ playerId: "other" }] :
      [{ playerId: "self" }],
  };
  let error: string | undefined;
  let notice: RoadblockMissionNotice | undefined;
  try {
    notice = rewritten
      ? await Modern.load(library, root, race, "self", deps)
      : await Original.load(library, root, race, "self");
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, notice: notice && {
    frame: notice.frame, since: notice.since, lastFrame: notice.lastFrame,
    uiLayer: notice.view.element.dataset.uiLayer,
    pointerEvents: notice.view.element.style.pointerEvents,
  } };
}

test("roadblock mission asset selection and role banner match release", async () => {
  for (const variant of ["runner", "blocker", "missing-race", "missing-player",
    "missing-scene", "missing-mission", "missing-size",
    "definition-error", "view-error"] as const) {
    assert.deepEqual(await observeLoad(true, variant),
      await observeLoad(false, variant), variant);
  }
});

type PlaybackVariant = "normal" | "preaborted" | "disposed-before" |
  "aborted" | "disposed" | "repeated" | "show-error" |
  "render-error" | "frame-error";

async function observePlayback(rewritten: boolean, variant: PlaybackVariant) {
  const events: unknown[][] = [];
  let nextFrame = 0;
  const deps = {
    loadDefinition: async () => ({ name: "", children: [] }),
    attribute: () => undefined,
    clone: (node: RoadblockNoticeNode) => node,
    loadView: async () => { throw new Error("unused"); },
    nowMs: () => 0,
    requestFrame: (_callback: (timestamp: number) => void) => {
      events.push(["request", ++nextFrame]);
      if (variant === "frame-error") throw new Error("frame failed");
      return nextFrame;
    },
    cancelFrame: (id: number) => { events.push(["cancel", id]); },
  } satisfies RoadblockMissionDependencies;
  const Original = new Function("F9", "T", "h2", "te", "performance",
    "requestAnimationFrame", "cancelAnimationFrame",
    `${originalClass}\nreturn yy;`)(deps.loadDefinition, deps.attribute,
      deps.clone, { load: deps.loadView }, { now: deps.nowMs },
      deps.requestFrame, deps.cancelFrame) as unknown as new () => RoadblockMissionNotice;
  const notice = rewritten ? new RoadblockMissionNotice(deps) : new Original();
  notice.view = { element: { dataset: {}, style: { pointerEvents: "" } },
    show() { events.push(["show"]);
      if (variant === "show-error") throw new Error("show failed"); },
    render() { events.push(["render"]);
      if (variant === "render-error") throw new Error("render failed"); },
    hide() { events.push(["hide"]); },
    dispose() { events.push(["dispose"]); },
  };
  const controller = new AbortController();
  if (variant === "preaborted") controller.abort();
  if (variant === "disposed-before") notice.dispose();
  let error: string | undefined;
  let settled: string | undefined;
  let promise: Promise<void> | undefined;
  try {
    promise = notice.present(controller.signal);
    if (variant === "repeated") {
      try { notice.present(controller.signal); }
      catch (failure) { events.push(["repeat-error", (failure as Error).message]); }
    }
    if (variant === "normal") {
      notice.update(500);
      notice.update(501);
      notice.update(1002);
      notice.update(4001);
    }
    if (variant === "render-error") notice.update(501);
    if (variant === "aborted") controller.abort();
    if (variant === "disposed" || variant === "repeated") {
      notice.dispose(); notice.dispose();
    }
  } catch (failure) { error = (failure as Error).message; }
  if (promise) {
    try { await promise; settled = "resolved"; }
    catch (failure) { settled = (failure as Error).message; }
  }
  return { events, error, settled, frame: notice.frame,
    since: notice.since, lastFrame: notice.lastFrame,
    animation: notice.animation, started: notice.started,
    disposed: notice.disposed, complete: !!notice.complete };
}

test("roadblock mission timing, cancellation and cleanup match release", async () => {
  for (const variant of ["normal", "preaborted", "disposed-before",
    "aborted", "disposed", "repeated", "show-error", "render-error",
    "frame-error"] as const) {
    assert.deepEqual(await observePlayback(true, variant),
      await observePlayback(false, variant), variant);
  }
});
