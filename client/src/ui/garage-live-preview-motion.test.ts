import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  advancePreviewRotation, beginPreviewRotation, beginTransformPreviewSession,
  closeCompletedTransformPreview, resetPreviewForPageTransition,
  resetPreviewRotation, restartTransformPreview, rotatePreview,
  setTransformPreview, stepPreviewYaw, toggleTransformPreview,
  type GaragePreviewMotionHost,
} from "./garage-live-preview-motion";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const helperStart = release.indexOf("function Oa0(");
const helperEnd = release.indexOf("function Qs(", helperStart);
const classStart = release.indexOf("class E7 {");
const classEnd = release.indexOf("\nfunction xc(", classStart);
assert.ok(helperStart > 0 && helperEnd > helperStart && classStart > 0 && classEnd > classStart);
const originalStep = new Function("Le", "Na0",
  `${release.slice(helperStart, helperEnd)}\nreturn Oa0;`)(Math.fround, 6.283185005187988) as
  (current: number, target: number, elapsed: number) => { yaw: number; complete: boolean };

test("garage preview yaw float32 easing matches release", () => {
  for (const current of [-6.2, -3.1, -0.1, 0, 0.1, 3.1, 6.2])
    for (const target of [-3.141592025756836, 0, 3.141592025756836])
      for (const elapsed of [0, 1, 16, 100, 1000])
        assert.deepEqual(stepPreviewYaw(current, target, elapsed),
          originalStep(current, target, elapsed));
});

function exercise(readable: boolean) {
  const events: unknown[] = [];
  let clock = 1000;
  const deps = {
    cameraYaw: (_camera: unknown, yaw: number) => events.push(["camera", yaw]),
    resetLinkedPresentation: (_preview: unknown) => events.push(["linked-reset"]),
    now: () => clock,
  };
  const Original = new Function("J3", "Oa0", "lT", "Zv", "performance",
    `${release.slice(classStart, classEnd)}\nreturn E7;`)(
      deps.cameraYaw, originalStep, 3.141592025756836,
      deps.resetLinkedPresentation, { now: deps.now },
    ) as new () => GaragePreviewMotionHost;
  const host = Object.create(readable ? Object.prototype : Original.prototype) as
    GaragePreviewMotionHost;
  Object.assign(host, {
    previewMode: "kart-only", previewCamera: {}, previewYaw: 1,
    previewReverse: true, previewRearView: false,
    transformPreviewEnabled: false, transformPreviewTimelineActive: false,
    transformPreviewCancelled: false, transformPreviewCompleted: false,
    transformPreviewClosing: false, disposed: false,
    preview: {
      origin: 33, transformEnabled: true,
      kart: { animation: { state: 4,
        reset: (tick: number) => events.push(["animation-reset", tick]) } },
      cosmeticEffects: {
        restartGaragePreview: (time: number) => events.push(["effect-restart", time]),
        setState: (...args: unknown[]) => events.push(["effect-state", ...args]),
      },
      cosmeticTrails: {
        restartGaragePreview: () => events.push(["trail-restart"]),
        setState: (...args: unknown[]) => events.push(["trail-state", ...args]),
      },
    },
  });
  if (readable) Object.assign(host, {
    resetPreviewRotation: (rearView?: boolean) => resetPreviewRotation(host, rearView),
    beginTransformPreviewSession: () => beginTransformPreviewSession(host),
    closeCompletedTransformPreview: () => closeCompletedTransformPreview(host, deps),
    setTransformPreview: (enabled: boolean) => setTransformPreview(host, enabled, deps),
  });
  const call = (name: string, ...args: unknown[]) => {
    if (!readable) return (host as unknown as Record<string, (...params: unknown[]) => unknown>)[name]!(...args);
    const functions: Record<string, (...params: never[]) => unknown> = {
      beginPreviewRotation: () => beginPreviewRotation(host),
      rotatePreview: (delta: number) => rotatePreview(host, delta, deps),
      beginTransformPreviewSession: () => beginTransformPreviewSession(host),
      restartTransformPreview: () => restartTransformPreview(host, deps),
      toggleTransformPreview: () => toggleTransformPreview(host),
      setTransformPreview: (enabled: boolean) => setTransformPreview(host, enabled, deps),
      resetPreviewForPageTransition: () => resetPreviewForPageTransition(host, deps),
      closeCompletedTransformPreview: () => closeCompletedTransformPreview(host, deps),
      resetPreviewRotation: (rearView?: boolean) => resetPreviewRotation(host, rearView),
      advancePreviewRotation: (now: number) => advancePreviewRotation(host, now, deps),
    } as unknown as Record<string, (...params: never[]) => unknown>;
    return functions[name]!(...args as never[]);
  };
  const snapshot = () => ({
    yaw: host.previewYaw, rear: host.previewRearView,
    reverse: host.previewReverse, target: host.previewTargetYaw,
    yawTime: host.previewYawTime, enabled: host.transformPreviewEnabled,
    timeline: host.transformPreviewTimelineActive,
    cancelled: host.transformPreviewCancelled,
    completed: host.transformPreviewCompleted,
    closing: host.transformPreviewClosing,
    origin: host.preview?.origin, transformEnabled: host.preview?.transformEnabled,
    events: structuredClone(events),
  });
  const states: unknown[] = [];
  const step = (name: string, ...args: unknown[]) => { call(name, ...args); states.push(snapshot()); };
  step("beginPreviewRotation");
  step("rotatePreview", 30);
  step("beginTransformPreviewSession");
  clock = 1100; step("restartTransformPreview");
  clock = 1200; step("setTransformPreview", false);
  clock = 1300; step("setTransformPreview", true);
  step("resetPreviewRotation", false);
  step("advancePreviewRotation", 1400);
  step("advancePreviewRotation", 1450);
  host.transformPreviewCompleted = true;
  clock = 1500; step("toggleTransformPreview");
  step("advancePreviewRotation", 1600);
  clock = 1700; step("resetPreviewForPageTransition");
  return states;
}

test("garage transform preview lifecycle and camera turns match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
