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
