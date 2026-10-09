import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SlipstreamBoost } from "./race-driving-scales";
import { updateActiveRaceFrame, updateRaceRemoteViews,
  type RaceFrameHost } from "./race-frame-coordination";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("const M9 = Math.fround,");
const end = source.indexOf("const NL = 0.6796875;", start);
assert.ok(start > 0 && end > start);
const states = { Racing: 3, Result: 7 };
const captureMotion = (_physics: unknown, frame: any) => ({ tick: frame.tick });
const captureAnimation = () => ({ physicsState: 3 });
const release = new Function("X2", "B40", "R40",
  `${source.slice(start, end)}\nreturn { Ui0, fE };`)(
    states, captureMotion, captureAnimation,
  ) as {
    Ui0: { prototype: Record<string, any> };
    fE: new () => SlipstreamBoost;
  };
const dependencies = {
  racingState: states.Racing, resultState: states.Result,
  captureMotion, captureAnimation,
};

function draftState(draft: SlipstreamBoost) {
  return {
    history: [...draft.history], chargeStart: draft.chargeStart,
    activeStart: draft.activeStart, cooldownStart: draft.cooldownStart,
    presentationVisible: draft.presentationVisible, hudActive: draft.hudActive,
  };
}

function fixture(released: boolean, giant = false) {
  const events: unknown[] = [];
  let actions: { kind: string }[] = [];
  let teamGain = 0;
  let remoteX = 8;
  const pendingGiant: unknown[] = [];
  const host: RaceFrameHost & { update(nowMs: number, frame: unknown,
    bypass: boolean): { kind: string }[] } = released
      ? Object.create(release.Ui0.prototype) : {} as any;
  host.disposed = false;
  host.remotePhysicsBypass = false;
  host.remoteFrameUpdated = false;
  host.finishReported = false;
  host.giantCleared = false;
  host.giantSequence = 0;
  host.giantSend = Promise.resolve();
  host.teamCharge = 0;
  host.teamSentAt = -Infinity;
  host.teamSentSequence = 0;
  host.assets = {
    mode: "ordinary", speed: 2, drivingMode: { kind: "ordinary" },
    participants: ["me", "peer"].map(playerId => ({
      playerId, vehicle: { physicsParams: { draftTick: 1_000,
        draftMulAccelFactor: 1.75 } },
    })),
  };
  host.connection = {
    playerId: "me",
    resetMotionRtt: () => { events.push("rtt.reset"); },
    reportFinish: elapsedMs => { events.push(["finish.report", elapsedMs]);
      return Promise.resolve(); },
    sendTeamCharge: (value, sequence) => {
      events.push(["team.send", value, sequence]); return Promise.resolve();
    },
    sendGiantState: (packet, sequence) => {
      events.push(["giant.send", packet, sequence]); return Promise.resolve();
    },
  };
  host.local = {
    lifecycle: { state: states.Racing, finishedElapsedMs: 12_345 },
    physics: {
      body: { position: { x: 0, y: 0, z: 0 },
        forward: { x: 1, y: 0, z: 0 },
        linearVelocity: { x: 40, y: 0, z: 0 } },
      setMultiplayerDrivingScales: scales => { events.push(["scales", scales]); },
      clearGiantRaceEffects: () => { events.push("giant.clear"); },
      consumeMultiplayerTeamCharge: () => {
        events.push("team.consume"); const value = teamGain; teamGain = 0; return value;
      },
    },
    resetSuspended: false,
    raceProgress: () => { events.push("progress"); return { distance: 100 }; },
    update: (nowMs, frame) => { events.push(["local.update", nowMs, frame]);
      return actions; },
    ...(giant ? { giant: { consumePackets: () => pendingGiant.splice(0) } } : {}),
  };
  host.remotes = {
    updateAndForEachFreshRacePeer: (nowMs, options, callback) => {
      events.push(["remote.fresh", nowMs, options]);
      callback("peer", { distance: 800 },
        { position: { x: remoteX, y: 0, z: 0 }, forward: { x: 1, y: 0, z: 0 } }, 130);
    },
    update: (nowMs, options) => { events.push(["remote.update", nowMs, options]); },
    resetGiants: () => { events.push("remote.giant.reset"); },
  };
  host.slipstream = released ? new release.fE() : new SlipstreamBoost();
  host.remoteSlipstreams = new Map();
  host.room = { phase: "racing", race: { loadedIds: ["me", "peer"] } };
  host.presentation = { capture: (motion, frame, animation) => {
    events.push(["presentation", motion, frame, animation]);
    return { frontLamp: true, rearLamp: false, animation: { physicsState: 3 } };
  } };
  host.sender = { update: (...args: any[]) => { events.push(["sender", args]); return true; } };
  host.onError = error => { events.push(["error", (error as Error).message]); };
  host.dispose = () => { host.disposed = true; events.push("dispose"); };
  if (!released) {
    host.updateRemotes = nowMs => updateRaceRemoteViews(host, nowMs, dependencies);
    host.update = (nowMs, frame, bypass) =>
      updateActiveRaceFrame(host, nowMs, frame, bypass, dependencies);
  }
  const snapshot = () => ({
    disposed: host.disposed, remotePhysicsBypass: host.remotePhysicsBypass,
    remoteFrameUpdated: host.remoteFrameUpdated,
    finishReported: host.finishReported,
    giantCleared: host.giantCleared, giantSequence: host.giantSequence,
    teamCharge: host.teamCharge, teamSentAt: host.teamSentAt,
    teamSentSequence: host.teamSentSequence,
    localPresentation: host.localPresentation,
    slipstream: draftState(host.slipstream),
    remoteSlipstreams: [...host.remoteSlipstreams].map(([id, draft]) => [id, draftState(draft)]),
    events: [...events],
  });
  return {
    host, snapshot,
    setActions(value: { kind: string }[]) { actions = value; },
    setTeamGain(value: number) { teamGain = value; },
    setRemoteX(value: number) { remoteX = value; },
    addGiantPacket(value: unknown) { pendingGiant.push(value); },
  };
}

async function runFrames(released: boolean, giant = false) {
  const item = fixture(released, giant);
  const { host } = item;
  const output: unknown[] = [];
  const frame = async (nowMs: number, bypass = false) => {
    const result = host.update(nowMs, { tick: nowMs }, bypass);
    await Promise.resolve();
    await Promise.resolve();
    output.push([result, item.snapshot()]);
  };
  await frame(100);
  item.setRemoteX(1);
  await frame(200, true);
  host.local.lifecycle.state = 2;
  await frame(300);
  host.local.lifecycle.state = states.Racing;
  host.assets.mode = "team";
  item.setTeamGain(1.125);
  item.setActions([{ kind: "natural-finish" }]);
  if (giant) item.addGiantPacket({ kind: "effect" });
  await frame(400);
  item.setActions([]);
  if (giant) {
    host.room!.phase = "finished";
    host.local.lifecycle.state = states.Result;
    await frame(500);
  }
  return output;
}

test("race frame scales, remote views, presentation and result reporting match release", async () => {
  assert.deepEqual(await runFrames(false), await runFrames(true));
  assert.deepEqual(await runFrames(false, true), await runFrames(true, true));
});

test("race frame errors are reported and release the race like release", () => {
  function run(released: boolean) {
    const item = fixture(released);
    item.host.local.update = () => { throw new Error("physics failed"); };
    const result = item.host.update(1_000, { tick: 1_000 }, false);
    return { result, state: item.snapshot() };
  }
  assert.deepEqual(run(false), run(true));
});

test("an item team race never sends 组队集气", async () => {
  for (const kind of ["item", "ordinary"]) {
    const item = fixture(false);
    item.host.assets.mode = "team";
    item.host.assets.speed = 7;
    item.host.assets.drivingMode = { kind };
    item.setTeamGain(2.5);
    item.host.update(100, { tick: 100 }, false);
    await Promise.resolve();
    const sent = item.snapshot().events.filter(event =>
      Array.isArray(event) && event[0] === "team.send");
    assert.deepEqual(sent, kind === "item" ? [] : [["team.send", 2.5, 1]], kind);
  }
});
