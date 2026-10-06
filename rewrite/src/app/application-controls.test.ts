import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  canReloadForUpdate, configureApplicationBackbuffer, haltApplicationRuntime,
  handleApplicationShortcut, onApplicationKeyDown, restartRaceFromPause,
  toggleRacePause, type AppControlEvent, type ApplicationControlHost,
} from "./application-controls";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Bf0 {");
const end = release.indexOf("\nfunction Rf0", start);
assert.ok(start >= 0 && end > start);
const classSource = release.slice(start, end);
const parsed = parse(classSource, { sourceType: "script" });
const selected = new Set([
  "canReloadForUpdate", "haltRuntime", "togglePause", "restartRaceFromPause",
  "onGlobalKeyDown", "handleGlobalShortcut", "configureBackbuffer",
]);
const members = parsed.program.body[0].body.body.filter((node: any) =>
  node.key?.type === "Identifier" && selected.has(node.key.name));
assert.equal(members.length, selected.size);
const memberSource = members.map((node: any) => classSource.slice(node.start, node.end)).join("\n");

const bindings = { KeyM: "music", KeyR: "enableRoadSound" };
const pausedPhase = "Paused";
const Original = new Function("Ne", "BP", "EX", "H2", "$2", "eT", "performance", "window",
  `return class { ${memberSource} };`)(
    { Paused: pausedPhase }, bindings,
    (...args: unknown[]) => { originalEvents.push(["scale", ...args]); return 0.75; },
    1600, 900,
    (_root: unknown) => { originalEvents.push(["curtain"]); return () => originalEvents.push(["close-curtain"]); },
    { now: () => 12_345 }, { devicePixelRatio: 2 },
  ) as new () => ApplicationControlHost & {
    canReloadForUpdate(): boolean;
    onGlobalKeyDown(event: { code: string; repeat: boolean; preventDefault(): void }): void;
    configureBackbuffer(): void;
    restartRaceFromPause(): Promise<void>;
  };
let originalEvents: unknown[][] = [];

function makeHost(rewritten: boolean): { host: ApplicationControlHost & Record<string, unknown>; events: unknown[][] } {
  const events: unknown[][] = [];
  const host = new Original() as unknown as ApplicationControlHost & Record<string, unknown>;
  host.root = { getBoundingClientRect: () => {
    events.push(["rect"]);
    return { width: 800, height: 450 };
  } };
  host.shell = { current: "Ready", started: true, halted: false, modal: undefined,
    readyModalBusy: false, halt: () => events.push(["halt"]) };
  host.racePageTransition = false;
  host.paused = false;
  host.previousRenderTime = 0;
  host.session = {
    selection: { trackId: "city", mode: 1 }, cameraMode: "drive", driveCameraState: { distance: 10 },
    lifecycle: {
      phase: pausedPhase,
      togglePause: now => { events.push(["toggle", now]); return ["pause"]; },
      effectiveTime: now => { events.push(["effective", now]); return now - 100; },
    },
    pause: { setVisible: value => events.push(["pause-visible", value]) },
    physics: {
      hardCancelControls: () => events.push(["hard-cancel"]),
      synchronizeClock: now => events.push(["sync", now]),
    },
  };
  host.audio = {
    kartAudio: { setPaused: value => events.push(["audio-paused", value]) },
    context: { resume: async () => { events.push(["resume"]); } },
  };
  host.hud = {
    showDebugText: (message, kind) => events.push(["debug", message, kind]),
    setPaused: value => events.push(["hud-paused", value]),
  };
  host.input = { setEnabled: value => events.push(["input", value]) };
  host.drivingInput = { cancel: () => events.push(["driving-cancel"]) };
  host.autoForward = { cancel: () => events.push(["auto-cancel"]) };
  host.presenter = { afterNextFrame: async callback => {
    events.push(["next-frame"]);
    return callback();
  } };
  host.gameOptions = { music: true, enableRoadSound: false };
  host.activeBlackBar = { setViewportHeight: value => events.push(["blackbar", value]) };
  host.renderer = { setDrawingBufferSize: (...args) => events.push(["buffer", ...args]) };
  host.camera = { aspect: 0, updateProjectionMatrix: () => events.push(["projection"]) };
  host.cameras = {
    drive: { apply: (_camera, state) => events.push(["drive-camera", state]) },
    surround: { apply: (_camera, state) => events.push(["surround-camera", state]) },
  };
  host.handleTimeAttackActions = (actions, now) => { events.push(["actions", actions, now]); };
  host.handleReadyShortcut = event => { events.push(["ready-shortcut", event.code]); return false; };
  host.saveGameOptions = () => { events.push(["save-options"]); };
  host.applySavedAudioOptions = () => { events.push(["apply-audio"]); };
  host.startRace = async selection => { events.push(["start-race", selection]); };
  host.releaseRaceForReady = () => { events.push(["release-race"]); };
  if (rewritten) {
    host.togglePause = () => toggleRacePause(host, () => 12_345, pausedPhase);
    host.haltRuntime = (error, now) => haltApplicationRuntime(host, error, now);
    host.handleGlobalShortcut = event => handleApplicationShortcut(host, event, bindings);
    host.onGlobalKeyDown = (event: AppControlEvent) => onApplicationKeyDown(host, event);
    host.canReloadForUpdate = () => canReloadForUpdate(host);
    host.configureBackbuffer = () => configureApplicationBackbuffer(host,
      { width: 1600, height: 900 }, (...args) => {
        events.push(["scale", ...args]); return 0.75;
      }, 2);
    host.restartRaceFromPause = () => restartRaceFromPause(host,
      () => { events.push(["curtain"]); return () => events.push(["close-curtain"]); },
      () => 12_345);
  }
  return { host, events };
}

function snapshot(host: ApplicationControlHost, events: unknown[][]): {
  events: unknown[][]; paused: boolean; transition: boolean;
  previousRenderTime: number; gameOptions: Record<string, unknown>; cameraAspect: number;
} {
  return { events: structuredClone(events), paused: host.paused,
    transition: host.racePageTransition, previousRenderTime: host.previousRenderTime,
    gameOptions: { ...host.gameOptions }, cameraAspect: host.camera.aspect };
}

function exerciseControls(rewritten: boolean): unknown {
  const { host, events } = makeHost(rewritten);
  if (!rewritten) originalEvents = events;
  const captures: unknown[] = [];
  const capture = (label: string, result?: unknown) => captures.push({ label, result, ...snapshot(host, events) });
  capture("can-reload", (host as any).canReloadForUpdate());
  host.shell.readyModalBusy = true;
  capture("modal-blocks-reload", (host as any).canReloadForUpdate());
  host.shell.readyModalBusy = false;
  host.togglePause(); capture("pause");
  host.shell.current = "MultiplayerRacing";
  host.togglePause(); capture("multiplayer-no-pause");
  host.shell.current = "Ready";
  host.shell.halted = true;
  host.togglePause(); capture("halted-no-pause");
  host.shell.halted = false;
  host.haltRuntime(new Error("sample"), 345); capture("halt");
  host.shell.halted = false;
  const key = (code: string, repeat = false) => ({ code, repeat,
    preventDefault: () => events.push(["prevent", code]) });
  capture("music-shortcut", host.handleGlobalShortcut(key("KeyM")));
  capture("road-sound-shortcut", host.handleGlobalShortcut(key("KeyR")));
  capture("repeat-shortcut", host.handleGlobalShortcut(key("KeyZ", true)));
  (host as any).onGlobalKeyDown(key("Escape")); capture("escape-pauses");
  host.racePageTransition = true;
  (host as any).onGlobalKeyDown(key("Escape")); capture("transition-blocks-key");
  host.racePageTransition = false;
  host.shell.current = "MultiplayerRacing";
  (host as any).onGlobalKeyDown(key("Escape")); capture("multiplayer-escape");
  host.shell.current = "Ready";
  (host as any).configureBackbuffer(); capture("drive-backbuffer");
  host.session.cameraMode = "surround";
  host.session.surroundCameraState = { distance: 20 };
  (host as any).configureBackbuffer(); capture("surround-backbuffer");
  host.session.cameraMode = "none";
  (host as any).configureBackbuffer(); capture("plain-backbuffer");
  return captures;
}

test("application pause, failure, keyboard, and viewport behavior matches release", () => {
  const expected = exerciseControls(false);
  const actual = exerciseControls(true);
  assert.deepEqual(actual, expected);
});

async function exerciseRestart(rewritten: boolean, selected: boolean): Promise<unknown> {
  const { host, events } = makeHost(rewritten);
  if (!rewritten) originalEvents = events;
  if (!selected) host.session.selection = undefined;
  await (host as any).restartRaceFromPause();
  return snapshot(host, events);
}

test("race retry and missing selection cleanup match release", async () => {
  for (const selected of [true, false]) {
    assert.deepEqual(await exerciseRestart(true, selected), await exerciseRestart(false, selected));
  }
});
