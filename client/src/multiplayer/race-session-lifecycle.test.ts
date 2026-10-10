import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { bindRaceSessionClock, disposeRaceSession, exitRaceSession,
  failRaceSession, initializeRaceSession, raceSessionDiagnosticsView,
  raceSessionPresentingResults, raceSessionTouchDodgeEnabled,
  raceSessionTouchDrivingAvailable, renderRaceSession,
  requestRaceSessionLeave, scheduleRaceSessionStart,
  showRaceSessionWaiting, updateRaceSessionRoom,
  type RaceSessionLifecycleHost } from "./race-session-lifecycle";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Yr0 extends aP {");
const end = release.indexOf("\nfunction fc(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Method = "diagnostics" | "touch-driving" | "touch-dodge" |
  "bind-clock" | "update-room" | "presenting-results" |
  "waiting" | "schedule" | "render" | "leave" | "fail" |
  "exit" | "dispose";
type Variant = "normal" | "inactive" | "disposed" | "result" |
  "lte" | "render-error" | "return-to-room" | "close" |
  "leave-error" | "already-leaving";

async function observe(rewritten: boolean, method: Method, variant: Variant) {
  const events: unknown[][] = [];
  const Original = new Function("aP", "sG", "performance",
    `${originalClass}\nreturn Yr0;`)(class {}, class {},
    { now: () => 1200 }) as new () => RaceSessionLifecycleHost & {
      readonly diagnosticsView: unknown;
      readonly touchDrivingAvailable: boolean;
      readonly touchDodgeEnabled: boolean;
      bindClock(clock: unknown): void;
      updateRoom(room: unknown): void;
      presentingResults(): boolean;
      scheduleStart(start: unknown): void;
      render(): void;
      exit(): void;
    };
  const session = Object.create(Original.prototype) as InstanceType<typeof Original>;
  const room = { phase: "open", members: [] };
  const scene = {
    updateRoom(snapshot: unknown) { events.push(["scene-room", snapshot]); },
    update(renderer: unknown, nowMs: number, actions: unknown) {
      events.push(["scene-update", renderer === session.host.renderer,
        nowMs, actions]);
    },
    render(renderer: unknown, nowMs: number) {
      events.push(["scene-render", renderer === session.host.renderer, nowMs]);
      if (variant === "render-error" && method === "render") {
        throw new Error("render failed");
      }
    },
    startAudio() { events.push(["scene-audio"]); },
    resultComplete: false,
    dispose() { events.push(["scene-dispose"]); },
  };
  Object.assign(session, {
    runtime: {
      local: { physics: { speedRaceMode: {
        kind: variant === "lte" ? "lte" : "ordinary",
      } } },
      bindClock(clock: unknown) { events.push(["bind-clock", clock]); },
      updateRoom(snapshot: unknown) { events.push(["runtime-room", snapshot]); },
      resultSnapshot() { events.push(["result-snapshot"]);
        return variant === "result" ? [] : undefined; },
      scheduleStart(startAt: unknown) { events.push(["schedule", startAt]); },
      dispose() { events.push(["runtime-dispose"]); },
    },
    scene,
    host: {
      renderer: { domElement: { focus() { events.push(["focus"]); } } },
      publish(value: unknown) { events.push(["publish", value === session]); },
      release(value: unknown) { events.push(["release", value === session]); },
      input: {
        cancelAll() { events.push(["input-cancel"]); },
        setEnabled(enabled: boolean) { events.push(["input-enabled", enabled]); },
      },
      autoForward: {
        cancel() { events.push(["auto-cancel"]); },
        setRaceState(active: boolean, pending: boolean) {
          events.push(["auto-state", active, pending]);
        },
      },
      touchControls: { setAutoForwardActive(active: boolean) {
        events.push(["touch-auto", active]);
      } },
      status(message: string, error?: boolean) {
        events.push(["status", message, error]);
      },
      closePresentation: variant === "close" ? () => {
        events.push(["close-presentation"]);
      } : undefined,
      returnToRoom: variant === "return-to-room" ? () => {
        events.push(["return-to-room"]); return Promise.resolve();
      } : undefined,
      leave() { events.push(["leave"]);
        return variant === "leave-error"
          ? Promise.reject(new Error("leave failed")) : Promise.resolve(); },
    },
    chat: {
      updateRoom(snapshot: unknown) { events.push(["chat-room", snapshot]); },
      show() { events.push(["chat-show"]); },
      setAllowed(allowed: boolean) { events.push(["chat-allowed", allowed]); },
      dispose() { events.push(["chat-dispose"]); },
    },
    notice: { visible: variant === "result", dispose() {
      events.push(["notice-dispose"]);
    } },
    controls: { cancel() { events.push(["controls-cancel"]); } },
    active: variant !== "inactive",
    disposed: variant === "disposed",
    leaving: variant === "already-leaving",
    resultVisible: variant === "result" || variant === "return-to-room" ||
      variant === "close",
    roomPhase: "open",
    now: 0,
  });
  // These two methods call their peers; retain the released peer method in
  // both variants so this test isolates the selected lifecycle operation.
  if (method === "fail" || method === "render") {
    session.fail = (error: unknown) => { events.push(["fail", (error as Error).message]); };
  }
  let returned: unknown;
  let error: string | undefined;
  try {
    if (rewritten) {
      if (method === "diagnostics") returned = raceSessionDiagnosticsView(session) === scene;
      else if (method === "touch-driving") returned = raceSessionTouchDrivingAvailable(session);
      else if (method === "touch-dodge") returned = raceSessionTouchDodgeEnabled(session);
      else if (method === "bind-clock") bindRaceSessionClock(session, "clock");
      else if (method === "update-room") updateRaceSessionRoom(session, room);
      else if (method === "presenting-results") returned = raceSessionPresentingResults(session);
      else if (method === "waiting") showRaceSessionWaiting(session, () => 1200);
      else if (method === "schedule") scheduleRaceSessionStart(session, 1500);
      else if (method === "render") renderRaceSession(session);
      else if (method === "leave") requestRaceSessionLeave(session);
      else if (method === "fail") {
        delete (session as { fail?: unknown }).fail;
        failRaceSession(session, new Error("race failed"));
      } else if (method === "exit") exitRaceSession(session);
      else disposeRaceSession(session);
    } else {
      if (method === "diagnostics") returned = session.diagnosticsView === scene;
      else if (method === "touch-driving") returned = session.touchDrivingAvailable;
      else if (method === "touch-dodge") returned = session.touchDodgeEnabled;
      else if (method === "bind-clock") session.bindClock("clock");
      else if (method === "update-room") session.updateRoom(room);
      else if (method === "presenting-results") returned = session.presentingResults();
      else if (method === "waiting") session.showWaiting();
      else if (method === "schedule") session.scheduleStart(1500);
      else if (method === "render") session.render();
      else if (method === "leave") session.requestLeave();
      else if (method === "fail") {
        delete (session as { fail?: unknown }).fail;
        session.fail(new Error("race failed"));
      } else if (method === "exit") session.exit();
      else session.dispose();
    }
  } catch (failure) { error = (failure as Error).message; }
  await Promise.resolve();
  return { events, returned, error,
    active: session.active, disposed: session.disposed,
    leaving: session.leaving, resultVisible: session.resultVisible,
    roomPhase: session.roomPhase, now: session.now };
}

test("multiplayer race session lifecycle and leave failures match release", async () => {
  const cases: Array<[Method, Variant]> = [
    ["diagnostics", "normal"], ["touch-driving", "normal"],
    ["touch-driving", "inactive"], ["touch-driving", "result"],
    ["touch-dodge", "lte"], ["touch-dodge", "disposed"],
    ["bind-clock", "normal"], ["update-room", "normal"],
    ["presenting-results", "normal"], ["presenting-results", "result"],
    ["waiting", "inactive"], ["waiting", "normal"],
    ["waiting", "disposed"], ["schedule", "inactive"],
    ["schedule", "lte"], ["render", "normal"],
    ["render", "render-error"], ["render", "inactive"],
    ["leave", "normal"], ["leave", "result"],
    ["leave", "return-to-room"], ["leave", "close"],
    ["leave", "leave-error"], ["leave", "already-leaving"],
    ["fail", "normal"], ["fail", "disposed"],
    ["exit", "normal"], ["dispose", "normal"],
    ["dispose", "inactive"], ["dispose", "disposed"],
  ];
  for (const [method, variant] of cases) {
    assert.deepEqual(await observe(true, method, variant),
      await observe(false, method, variant), `${method}:${variant}`);
  }
});

test("multiplayer race session constructor stores live owners in release order", () => {
  const Original = new Function("aP", "sG",
    `${originalClass}\nreturn Yr0;`)(class {}, class {}) as
    new (...owners: unknown[]) => RaceSessionLifecycleHost;
  const owners = [{ name: "runtime" }, { name: "scene" },
    { name: "host" }, { name: "chat" }, { name: "notice" }];
  const original = new Original(...owners);
  const rewritten = Object.create(Original.prototype) as RaceSessionLifecycleHost;
  const typedOwners = owners as unknown as [
    RaceSessionLifecycleHost["runtime"], RaceSessionLifecycleHost["scene"],
    RaceSessionLifecycleHost["host"], RaceSessionLifecycleHost["chat"],
    RaceSessionLifecycleHost["notice"],
  ];
  initializeRaceSession(rewritten, ...typedOwners);
  assert.deepEqual([rewritten.runtime, rewritten.scene, rewritten.host,
    rewritten.chat, rewritten.notice],
  [original.runtime, original.scene, original.host,
    original.chat, original.notice]);
  for (const [index, owner] of owners.entries()) {
    assert.strictEqual([rewritten.runtime, rewritten.scene, rewritten.host,
      rewritten.chat, rewritten.notice][index], owner);
  }
});

test("item races cancel held input when the window loses focus or the page is hidden", () => {
  const events: string[] = [];
  const page = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const session = (itemMode: boolean) => ({
    runtime: { local: { physics: { speedRaceMode: { kind: "item" }, itemMode } }, dispose() {} },
    scene: { update() {}, render() {}, startAudio() {}, dispose() {}, resultComplete: false },
    host: {
      renderer: { domElement: { focus() {} } },
      publish() {}, release() {},
      input: { cancelAll() { events.push("cancel"); }, setEnabled() {} },
      autoForward: { cancel() {}, setRaceState() {} },
      touchControls: { setAutoForwardActive() {} },
      status() {},
      leave: () => Promise.resolve(),
    },
    controls: { cancel() {} },
    active: false, disposed: false, leaving: false, resultVisible: false, now: 0,
    showWaiting() {}, requestLeave() {}, dispose() {}, fail() {},
  }) as unknown as RaceSessionLifecycleHost;
  const targets = { window: page, document: doc };

  const item = session(true);
  showRaceSessionWaiting(item, () => 1200, targets);
  events.length = 0;
  page.dispatchEvent(new Event("blur"));
  assert.deepEqual(events, ["cancel"], "a lost keyup can no longer leave Ctrl held");
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(events, ["cancel"], "showing the page again keeps the input");
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(events, ["cancel", "cancel"]);
  disposeRaceSession(item);
  events.length = 0;
  page.dispatchEvent(new Event("blur"));
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(events, [], "a disposed race stops listening");

  const speed = session(false);
  showRaceSessionWaiting(speed, () => 1200, targets);
  events.length = 0;
  page.dispatchEvent(new Event("blur"));
  assert.deepEqual(events, [], "speed races keep the released input behaviour");
});
