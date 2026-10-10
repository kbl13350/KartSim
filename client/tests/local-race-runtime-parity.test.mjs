import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import {
  requestLocalRaceReset,
  checkLocalRaceAutomaticReset,
  advanceLocalRaceReset,
  acceptLocalRaceEndTiming,
  handleLocalRaceRouteTag,
  applyLocalRaceWarpActions,
  scheduleLocalRaceStart,
  localRaceScheduledStartAtMs,
  localRaceStartBoosterWindow,
  localRaceProgress,
  localRaceElapsedMs,
  updateLocalRace,
} from "../src/multiplayer/local-race-runtime.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body.find(
  node => node.type === "ClassDeclaration" && node.id?.name === "Ci0",
);
assert.ok(declaration, "release Ci0 class must exist");
const methods = declaration.body.body.filter(node => node.type === "ClassMethod" && node.kind !== "constructor");
const methodNames = new Set(methods.map(node => node.key.name));
for (const name of ["requestReset", "checkAutomaticReset", "advanceReset", "acceptEndTiming",
  "handleLocalRouteTag", "applyWarpActions", "scheduleStart", "update", "elapsedMs"])
  assert.ok(methodNames.has(name), `missing release Ci0.${name}`);
const context = { structuredClone };
runInNewContext(`class ReleasedRace { ${methods.map(node => source.slice(node.start, node.end)).join("\n")} }
globalThis.ReleasedRace = ReleasedRace;`, context);

const states = { Ready: 0, Countdown: 1, Racing: 2, PostFinish: 3 };
const clone = value => value === undefined ? "<undefined>" : JSON.parse(JSON.stringify(value));

function execute(kind, options, perform) {
  const trace = [];
  const log = (name, ...args) => trace.push([name, ...args.map(clone)]);
  const deps = {
    states,
    beginResetState: state => { log("beginResetState", state); return { ...state, phase: 1 }; },
    advanceResetState: (state, now) => {
      log("advanceResetState", state, now);
      return { state: { ...state, phase: options.nextResetPhase ?? state.phase },
        actions: options.resetActions ?? [] };
    },
    routeTagFamily: tag => { log("routeTagFamily", tag); return tag.split(":")[0]; },
    isStartBoosterWindow: (start, now) => {
      log("isStartBoosterWindow", start, now); return now >= start - 100 && now <= start + 100;
    },
  };
  Object.assign(context, {
    X2: states,
    mL: deps.beginResetState,
    wL: deps.advanceResetState,
    Vo: deps.routeTagFamily,
    fL: deps.isStartBoosterWindow,
  });
  const race = kind === "release" ? new context.ReleasedRace() : {};
  const physics = {
    body: { position: { y: options.height ?? 0 } },
    beginResetInitiation: player => { log("physics.beginResetInitiation", player); return options.canReset ?? true; },
    prepareLowHeightResetPose: () => log("physics.prepareLowHeightResetPose"),
    consumeAutomaticResetRequest: () => { log("physics.consumeAutomaticResetRequest"); return options.autoReset ?? false; },
    lowSpeedAutomaticResetActive: delta => {
      log("physics.lowSpeedAutomaticResetActive", delta); return options.stalled ?? false;
    },
    canHandleRouteSurfaceTag: tag => {
      log("physics.canHandleRouteSurfaceTag", tag); return options.surfaceSupported ?? true;
    },
    completeCheckpointPose: (...args) => log("physics.completeCheckpointPose", ...args),
    prepareRailCheckpointReentry: () => log("physics.prepareRailCheckpointReentry"),
    handleRouteSurfaceTag: tag => {
      log("physics.handleRouteSurfaceTag", tag); return options.surfaceHandled ?? true;
    },
    setFullPhysicsBypass: value => log("physics.setFullPhysicsBypass", value),
    restoreResetInteraction: () => log("physics.restoreResetInteraction"),
    setRaceMotionLocked: value => log("physics.setRaceMotionLocked", value),
    setWarpPresentationActive: value => log("physics.setWarpPresentationActive", value),
    setWarpPressProtected: value => log("physics.setWarpPressProtected", value),
    consumeRailResetRequest: () => {
      log("physics.consumeRailResetRequest");
      return options.railReset ?? false;
    },
    updateLockedIngameClock: at => log("physics.updateLockedIngameClock", at),
    synchronizeClock: at => log("physics.synchronizeClock", at),
    updateModeInventory: () => { log("physics.updateModeInventory"); return true; },
  };
  const track = {
    data: { lapTarget: 2, warp: "warp-config" },
    updateMovingRoads: at => log("track.updateMovingRoads", at),
    getRouteState: () => { log("track.getRouteState"); return { lap: options.lap ?? 1, distance: 37 }; },
    prepareCurrentSectionReset: () => {
      log("track.prepareCurrentSectionReset");
      return { surface: options.surface ?? "rail", frame: "checkpoint" };
    },
    commitCurrentSectionReset: () => log("track.commitCurrentSectionReset"),
    setLensFlareEnabled: value => log("track.setLensFlareEnabled", value),
    warpNextDestination: () => { log("track.warpNextDestination"); return "destination"; },
  };
  const lifecycle = {
    state: options.state ?? states.Racing,
    startAtMs: 6000,
    finishedElapsedMs: 9000,
    acceptTiming: (...args) => {
      log("lifecycle.acceptTiming", ...args);
      return [{ kind: "timing", atMs: args[1] }];
    },
    update: input => {
      log("lifecycle.update", input);
      if (options.nextState !== undefined) lifecycle.state = options.nextState;
      return options.lifecycleActions ?? [];
    },
  };
  const coordinator = {
    synchronizePositionAnchor: () => log("coordinator.synchronizePositionAnchor"),
    completeWarpNextRailLanding: () => log("coordinator.completeWarpNextRailLanding"),
    deferWarpNextRailLanding: () => log("coordinator.deferWarpNextRailLanding"),
    run: (...args) => log("coordinator.run", ...args),
  };
  const warpNext = {
    blocksDriving: () => { log("warpNext.blocksDriving"); return options.warpBlocked ?? false; },
    enter: (...args) => { log("warpNext.enter", ...args); return options.enterActions ?? []; },
    tick: at => { log("warpNext.tick", at); return options.tickActions ?? []; },
  };
  const lte = { cancel: () => log("lte.cancel"), update: (...args) => log("lte.update", ...args) };
  const giant = { setDrivingActive: value => log("giant.setDrivingActive", value) };
  const assets = {
    map: { warpNextCamera: options.warpCamera ?? true },
    rain: { setEnabled: value => log("rain.setEnabled", value) },
    rainAudio: { setRainEnabled: value => log("rainAudio.setRainEnabled", value) },
    snow: { setEnabled: value => log("snow.setEnabled", value) },
  };
  Object.assign(race, {
    physics, track, lifecycle, coordinator, warpNext, lte, giant, assets,
    lapTiming: { update: (...args) => log("lapTiming.update", ...args) },
    scheduled: options.scheduled ?? true,
    clockOriginMs: options.clockOriginMs ?? 1000,
    disposed: options.disposed ?? false,
    isRoadBlockRunner: options.runner ?? false,
    roadblock: options.roadblock ?? false,
    resetState: { phase: options.resetPhase ?? 0, startMs: 0 },
    lowSpeedResetStartedAtMs: options.lowSpeedSince ?? 0,
    resetSoundPending: false,
    roadBlockResetNoticePending: false,
    pendingActions: options.pendingActions ?? [],
    pendingRouteTags: [], pendingWarpActions: [],
    resultsReady: false, naturallyFinished: options.naturallyFinished ?? false,
    finishDeadline: options.finishDeadline,
    raceOverAt: options.raceOverAt,
    forcedElapsedMs: options.forcedElapsedMs,
    routeClockMs: 0,
    boostGaugeFull: true,
  });
  if (kind === "rewrite") {
    Object.assign(race, {
      requestReset: player => requestLocalRaceReset(race, deps, player),
      checkAutomaticReset: (now, step) => checkLocalRaceAutomaticReset(race, deps, now, step),
      advanceReset: now => advanceLocalRaceReset(race, deps, now),
      acceptEndTiming: (...args) => acceptLocalRaceEndTiming(race, deps, ...args),
      handleLocalRouteTag: tag => handleLocalRaceRouteTag(race, deps, tag),
      applyWarpActions: actions => applyLocalRaceWarpActions(race, actions),
      scheduleStart: at => scheduleLocalRaceStart(race, at),
      isStartBoosterWindow: now => localRaceStartBoosterWindow(race, deps, now),
      raceProgress: () => localRaceProgress(race),
      elapsedMs: now => localRaceElapsedMs(race, deps, now),
      update: (now, step) => updateLocalRace(race, deps, now, step),
      lteAvailable: () => true,
    });
    Object.defineProperties(race, {
      scheduledStartAtMs: { get: () => localRaceScheduledStartAtMs(race) },
      resetSuspended: { get: () => race.resetState.phase === 1 || race.resetState.phase === 2 },
    });
  } else {
    // This helper is outside the target slice and is held constant for update.
    race.lteAvailable = () => true;
  }
  let result;
  let error;
  try { result = perform(race); } catch (caught) { error = caught.message; }
  return {
    trace, result: clone(result), error,
    state: clone({
      scheduled: race.scheduled, clockOriginMs: race.clockOriginMs,
      resetState: race.resetState, lowSpeedResetStartedAtMs: race.lowSpeedResetStartedAtMs,
      resetSoundPending: race.resetSoundPending,
      roadBlockResetNoticePending: race.roadBlockResetNoticePending,
      pendingActions: race.pendingActions, pendingRouteTags: race.pendingRouteTags,
      pendingWarpActions: race.pendingWarpActions,
      finishDeadline: race.finishDeadline, raceOverAt: race.raceOverAt,
      forcedElapsedMs: race.forcedElapsedMs, resultsReady: race.resultsReady,
      naturallyFinished: race.naturallyFinished, routeClockMs: race.routeClockMs,
      boostGaugeFull: race.boostGaugeFull,
    }),
  };
}

function compare(options, perform) {
  assert.deepStrictEqual(execute("rewrite", options, perform), execute("release", options, perform));
}

test("local reset request guards and side effects match release", () => {
  for (const options of [{}, { runner: true }, { canReset: false }, { disposed: true },
    { state: states.Ready }, { resetPhase: 2 }])
    compare(options, race => race.requestReset(true));
});

test("automatic low-height, physics and stall resets match release", () => {
  for (const options of [{ height: -8 }, { autoReset: true }, { warpBlocked: true },
    { stalled: true, lowSpeedSince: 1000 }, { stalled: true, lowSpeedSince: 1000, state: states.Ready }])
    compare(options, race => race.checkAutomaticReset(4000, 0.016));
});

test("checkpoint reset stages, rail surface and errors match release", () => {
  for (const options of [
    { resetActions: ["complete-checkpoint-pose", "suspend-physics", "resume-physics", "restore"] },
    { resetActions: ["complete-checkpoint-pose"], surface: "lensflare" },
    { resetActions: ["complete-checkpoint-pose"], surfaceSupported: false },
    { resetActions: ["complete-checkpoint-pose"], surfaceHandled: false },
  ]) compare(options, race => race.advanceReset(3200));
});

test("server end timing and duplicate guards match release", () => {
  for (const options of [{}, { finishDeadline: 5000 }, { raceOverAt: 7000 },
    { state: states.Countdown }, { disposed: true }])
    compare(options, race => race.acceptEndTiming(6000, 8000, true));
});

test("route tags and warp presentation actions match release", () => {
  for (const tag of ["warpnext:in:next", "flash:in:next", "shake01:out:next",
    "lensflare:in:next", "norain:out:next", "nosnow:in:next", "rail, norain:in:next"])
    compare({ enterActions: [{ kind: "start-warp-presentation" }] }, race => race.handleLocalRouteTag(tag));
  const actions = [
    { kind: "start-warp-presentation" }, { kind: "freeze-camera" },
    { kind: "teleport", frame: "frame", clearMotion: true },
    { kind: "teleport", frame: "frame", clearMotion: false },
    { kind: "finish-warp-presentation" }, { kind: "other" },
  ];
  compare({}, race => race.applyWarpActions(actions));
  compare({ warpCamera: false }, race => race.applyWarpActions(actions));
});

test("start scheduling, booster window and race clocks match release", () => {
  compare({ scheduled: false }, race => {
    race.scheduleStart(9000.9);
    return [race.scheduledStartAtMs, race.isStartBoosterWindow(9050),
      race.raceProgress(), race.elapsedMs(11000)];
  });
  for (const options of [{}, { scheduled: false }, { disposed: true },
    { state: states.Ready }, { state: states.PostFinish, forcedElapsedMs: 7500 },
    { naturallyFinished: true }])
    compare(options, race => [race.scheduledStartAtMs, race.isStartBoosterWindow(7000),
      race.raceProgress(), race.elapsedMs(12000)]);
  for (const at of [NaN, -1, Infinity])
    compare({ scheduled: false }, race => race.scheduleStart(at));
});

test("local frame loop branches and action clock mapping match release", () => {
  for (const options of [
    { disposed: true }, { scheduled: false }, { clockOriginMs: 5000 },
    { state: states.Ready }, { state: states.Countdown },
    { state: states.PostFinish }, { nextState: states.Racing },
    { roadblock: true, runner: false }, { railReset: true },
    { nextState: states.PostFinish },
    { lifecycleActions: [{ kind: "release-race", startAtMs: 6000 },
      { kind: "natural-finish", atMs: 9000 }, { kind: "misc" }],
      tickActions: [{ kind: "teleport", frame: "warp-frame", clearMotion: true }] },
  ]) compare(options, race => race.update(8000.8, 0.016));
  compare({}, race => race.update(-1, 0.016));
});
