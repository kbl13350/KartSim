import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PresentationController,
  type PresentationControllerServices } from "./presentation-controller";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as typeof import("@babel/parser");
const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function originalController() {
  const source = await readFile(releaseFile, "utf8");
  const node = parse(source, { sourceType: "module" }).program.body
    .find(entry => entry.type === "ClassDeclaration" && entry.id?.name === "vf0");
  assert.ok(node);
  return source.slice(node.start!, node.end!);
}

function fixture(releaseSource: string, rewritten: boolean) {
  const calls: unknown[] = [];
  const stage = (name: string) => ({ name,
    diagnosticsView: `${name}:diagnostics`, interface: `${name}:interface`,
    handleRouteSurfaceTag: (...args: unknown[]) => calls.push([name, "tag", ...args]),
    applyWarpNextActions: (...args: unknown[]) => calls.push([name, "actions", ...args]),
    warpToCheckpoint: (...args: unknown[]) => calls.push([name, "checkpoint", ...args]),
    warpToPoint: (...args: unknown[]) => calls.push([name, "point", ...args]),
    renderGameplayUi: (...args: unknown[]) => calls.push([name, "ui", ...args]),
    disposeInterface: () => calls.push([name, "dispose-interface"]),
    initiateSpeedReset: (...args: unknown[]) => calls.push([name, "speed-reset", ...args]),
    advanceResetCompletion: (...args: unknown[]) => calls.push([name, "reset-complete", ...args]),
    updateDriving: (...args: unknown[]) => calls.push([name, "driving", ...args]),
    updateTimeAttackRoute: (...args: unknown[]) => calls.push([name, "route", ...args]),
    handleTimeAttackActions: (...args: unknown[]) => calls.push([name, "race-actions", ...args]),
    handleTimeAttackActionAudio: (...args: unknown[]) => {
      calls.push([name, "audio-action", ...args]); return true;
    },
    handleTimeAttackFinishAction: (...args: unknown[]) => {
      calls.push([name, "finish-action", ...args]); return false;
    },
    showTimeAttackResult: (...args: unknown[]) => calls.push([name, "result", ...args]),
  });
  class StageManager {
    factories = new Map<string, () => unknown>();
    currentName: string | undefined;
    register(name: string, factory: () => unknown) {
      calls.push(["register", name]); this.factories.set(name, factory);
    }
    changeStage(name: string, value?: unknown) {
      calls.push(["stage", name, value]);
      this.currentName = name;
      return this.factories.get(name)?.();
    }
  }
  class ReadyStage { name = "ready"; }
  class RaceStage { constructor() { Object.assign(this, stage("race")); } }
  class Counter { kind = "counter"; }
  const shell = {
    current: "Ready",
    enterMultiplayerRace() { calls.push(["enter-multiplayer"]); this.current = "MultiplayerRacing"; },
    leaveMultiplayerRace() { calls.push(["leave-multiplayer"]); this.current = "Ready"; },
  };
  const host = { shell };
  const services: PresentationControllerServices = {
    createFrameRateCounter: () => new Counter(),
    createStageManager: () => new StageManager(),
    createReadyStage: () => new ReadyStage(),
    createRaceStage: () => new RaceStage(),
    startLoop: () => undefined, stopLoop: () => undefined,
    advanceFrame: () => undefined, renderFrame: () => undefined,
    releaseRace: () => undefined, replaceTrack: () => undefined,
    applyRaceOptions: () => undefined,
  };
  const Original = new Function("rf0", "wf0", "mf0", "df0",
    `${releaseSource}\nreturn vf0;`)(Counter, StageManager, ReadyStage, RaceStage) as
      new (host: unknown, time?: number) => PresentationController;
  const owner = rewritten
    ? new PresentationController(host, 17, services)
    : new Original(host, 17);
  return { owner, calls, stage };
}

async function exercise(releaseSource: string, rewritten: boolean) {
  const { owner, calls, stage } = fixture(releaseSource, rewritten);
  const initial = {
    previousRenderTime: owner.previousRenderTime,
    animationFrame: owner.animationFrame,
    fps: owner.fps,
    frameTimeSeconds: owner.frameTimeSeconds,
    clock: owner.presentationClockMs,
    counter: (owner.clientFramerate as { kind: string }).kind,
    callbacks: owner.nextFrameCallbacks.length,
  };
  owner.changeStage("TimeAttackStage", 3);
  owner.handleRouteSurfaceTag("road", 1);
  owner.applyWarpNextActions(["warp"]);
  owner.warpToCheckpoint(2);
  owner.warpToPoint(3);
  owner.renderGameplayUi("canvas", 4);
  owner.disposeRaceInterface();
  owner.initiateSpeedReset(5);
  owner.advanceResetCompletion(6);
  owner.updateDriving(7);
  owner.updateTimeAttackRoute("route", 8, 9);
  owner.handleTimeAttackActions("action", 10);
  const audio = owner.handleTimeAttackActionAudio("audio", 11);
  const finish = owner.handleTimeAttackFinishAction("finish", 12);
  owner.showTimeAttackResult("result", 13);
  const interfaceName = owner.raceInterface;
  const callback = owner.afterNextFrame(() => "next");
  owner.nextFrameCallbacks.shift()!.run();
  const callbackResult = await callback;
  const multiplayer = stage("multiplayer");
  owner.publishMultiplayer(multiplayer);
  const diagnostics = owner.multiplayerDiagnosticsView;
  owner.releaseMultiplayer(stage("different"));
  owner.releaseMultiplayer(multiplayer);
  const state = { initial, audio, finish, interfaceName, callbackResult,
    diagnostics, stageName: owner.stageName,
    currentRaceStage: owner.currentRaceStage,
    multiplayerStage: owner.multiplayerStage };
  return { calls, state };
}

test("演示调度、比赛转场、委派和下一帧回调与发行版一致", async () => {
  const source = await originalController();
  assert.deepEqual(await exercise(source, true), await exercise(source, false));
});
