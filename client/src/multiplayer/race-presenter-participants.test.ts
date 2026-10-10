import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { updateRacePresenterParticipants,
  type RacePresenterParticipantsHost } from "./race-presenter-participants";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

interface Scenario {
  remotePresentation?: boolean;
  remoteAnimation?: boolean;
  remotePose?: boolean;
  remoteRetired?: boolean;
  remoteImported?: boolean;
}

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const external = {
    remote(_vehicle: unknown, _view: unknown, _camera: unknown,
      nowMs: number, animation: unknown, instant: unknown,
      width: number, height: number) {
      events.push(["remote-effects", nowMs, animation, instant, width, height]);
    },
    local(_vehicle: unknown, _local: unknown, _view: unknown,
      _camera: unknown, nowMs: number, slot: unknown, shadow: unknown) {
      events.push(["local-effects", nowMs, slot, shadow]);
    },
  };
  const Original = new Function("X2", "xr0", "Mr0",
    `${originalClass}\nreturn jr0;`)(
    { Racing: "Racing", Countdown: "Countdown" }, external.remote, external.local,
  ) as new () => { update(renderer: unknown, nowMs: number,
    actions: unknown[]): void };
  const presenter = Object.create(Original.prototype) as InstanceType<typeof Original>;
  const camera = { name: "camera" };
  const remotePose = { position: { x: 10, y: 20, z: 30 }, speed: 4 };
  const initialPose = { position: { x: 1, y: 2, z: 3 }, initial: true };
  const localMotion = { boosterState: 2, instantAccelerationActive: true,
    forwardSpeed: 300 };
  const remoteMotion = { boosterState: 3, instantAccelerationActive: false,
    forwardSpeed: 280 };
  const localPresentation = { motion: localMotion, animation: "lean",
    frontLamp: "local-front", rearLamp: "local-rear" };
  const remotePresentation = scenario.remotePresentation === false ? undefined
    : { motion: remoteMotion, animation: scenario.remoteAnimation === false
      ? undefined : "drift", frontLamp: "remote-front", rearLamp: "remote-rear" };

  function vehicle(name: string) {
    const imported = scenario.remoteImported === false && name === "remote"
      ? {} : { renderScene: { update(_camera: unknown, width: number,
        height: number) { events.push([`${name}-imported`, width, height]); } } };
    return {
      imported,
      lampFlares: {
        setInputPair(pair: string, value: unknown) {
          events.push([`${name}-lamp-input`, pair, value]);
        },
        update(nowMs: number, _camera: unknown, present: boolean) {
          events.push([`${name}-lamps`, nowMs, present]);
        },
      },
      trails: {
        setState(boost: number, nowMs: number) {
          events.push([`${name}-trail-state`, boost, nowMs]);
        },
        update(nowMs: number, _camera: unknown, present: boolean) {
          events.push([`${name}-trails`, nowMs, present]);
        },
      },
      accessories: [{ kind: "headBand", render: {
        setOwnerState(boost: number, nowMs: number) {
          events.push([`${name}-headband-state`, boost, nowMs]);
        },
        scene: { update(nowMs: number) { events.push([`${name}-headband`, nowMs]); } },
      } }, { kind: "balloon", render: {
        scene: { update(nowMs: number) { events.push([`${name}-balloon`, nowMs]); } },
      } }],
      decoration: { scene: { update(nowMs: number) {
        events.push([`${name}-decoration`, nowMs]);
      } } },
    };
  }
  function participant(name: string) {
    return {
      playerId: name,
      vehicle: vehicle(name),
      characters: { ordinary: { scene: { update(_nowMs: number,
        _camera: unknown, _width: number, _height: number, motion: unknown) {
        events.push([`${name}-character`, motion]);
      } } } },
      draftEffect: { update(nowMs: number, visible: boolean, burst: boolean) {
        events.push([`${name}-draft`, nowMs, visible, burst]);
      } },
    };
  }
  function view(name: string) {
    return {
      root: { visible: false, updateMatrixWorld(force: boolean) {
        events.push([`${name}-matrix`, force, this.visible]);
      } },
      update(state: unknown, nowMs: number, animation: unknown) {
        events.push([`${name}-update`, state, nowMs, animation]); return 6;
      },
      updateRemote(pose: unknown, nowMs: number, animation: unknown) {
        events.push([`${name}-remote`, pose, nowMs, animation]);
      },
      updatePose(pose: unknown) { events.push([`${name}-pose`, pose]); },
    };
  }
  const physics = {
    body: { position: { x: 5, y: 6, z: 7 }, right: "R", forward: "F", up: "U" },
    state: { velocity: 120 },
    giant: { main: 2, extra: 3 },
    consumeKartAnimationInput() { events.push(["animation-input"]); return "throttle"; },
    setAnimationSlot(slot: unknown) { events.push(["animation-slot", slot]); },
    consumeTrackEventEffectRequests() { throw new Error("stop-after-participants"); },
  };
  Object.assign(presenter, {
    disposed: false,
    size: { x: 0, y: 0 },
    camera,
    resultVisible: false,
    warpCameraFrozen: true,
    race: { roadblock: false },
    playerId: "local",
    applyWarpCamera() {},
    finishCountdown: { update() { return false; } },
    applyLocalWarpActions() {},
    lightFactor: { update() {} },
    assets: {
      map: { stageBinding: { beginFrame(nowMs: number) {
        events.push(["begin-frame", nowMs]);
      } } },
      lteCoins: { update(nowMs: number) { events.push(["coins", nowMs]); } },
      rain: { update(nowMs: number) { events.push(["rain", nowMs]); } },
      snow: { update(nowMs: number) { events.push(["snow", nowMs]); } },
      participants: [participant("local"), participant("remote"),
        participant("missing-view")],
    },
    runtime: {
      giantEffectsEnded: false,
      local: {
        physics,
        lifecycle: { state: "Racing" },
        consumeResetSound() { return false; },
        consumeLocalRouteTags() { return []; },
        track: { updateRender(nowMs: number) { events.push(["track", nowMs]); } },
        resetVisible(nowMs: number) { events.push(["reset-visible", nowMs]);
          return true; },
        warpNext: { presentationVisible(nowMs: number) {
          events.push(["warp-visible", nowMs]); return true;
        } },
      },
      localPresentation,
      remotes: {
        consumePresentation(id: unknown) { events.push(["consume-presentation", id]);
          return remotePresentation; },
        copyWebPose(id: unknown) { events.push(["copy-pose", id]);
          return scenario.remotePose === false ? undefined : remotePose; },
        presentationVisible(id: unknown, nowMs: number) {
          events.push(["remote-visible", id, nowMs]); return false;
        },
        hasDeparted() { return false; },
        giant(id: unknown) { events.push(["remote-giant", id]);
          return { main: 4, extra: 5 }; },
      },
      finishSnapshot() { events.push(["finish-snapshot"]); return []; },
      resultSnapshot() { events.push(["result-snapshot"]); return [
        { playerId: "remote", elapsedMs: scenario.remoteRetired ? null : 1500 },
      ]; },
      draftPresentationVisible(id: unknown) { events.push(["draft-visible", id]);
        return true; },
      draftBurstActive(id: unknown) { events.push(["draft-burst", id]);
        return false; },
    },
    views: new Map([["local", view("local")], ["remote", view("remote")]]),
    initialPoses: new Map([["remote", initialPose]]),
    linkedPresentations: new Map([["local", {
      updateSpeedRace(boost: number, nowMs: number) {
        events.push(["local-linked", boost, nowMs]); return "local-link-motion";
      },
      simpleShadowEnabled() { events.push(["shadow-enabled"]); return false; },
    }], ["remote", {
      updateSpeedRace(boost: number, nowMs: number) {
        events.push(["remote-linked", boost, nowMs]); return "remote-link-motion";
      },
      simpleShadowEnabled() { throw new Error("remote shadow should not be used"); },
    }]]),
    giantAppearances: new Map([["local", { update(main: number, extra: unknown) {
      events.push(["local-giant", main, extra]);
    } }], ["remote", { update(main: number, extra: unknown) {
      events.push(["remote-giant-view", main, extra]);
    } }]]),
    retiredCharacterIds: new Set<unknown>(),
    localRetirePending: false,
    winnerMotion: { consume(id: unknown, localId: unknown, _finishes: unknown,
      retired: boolean) { events.push(["winner-motion", id, localId, retired]);
      return id === "remote" && !retired ? 9 : undefined; } },
  });
  const renderer = { getDrawingBufferSize(size: { x: number; y: number }) {
    size.x = 1280; size.y = 720;
  } };
  let remotePoses: unknown;
  let error: string | undefined;
  try {
    if (rewritten) {
      remotePoses = updateRacePresenterParticipants(
        presenter as unknown as RacePresenterParticipantsHost, 1200, 1280, 720,
        { updateRemoteVehicleEffects: external.remote,
          updateLocalVehicleEffects: external.local });
    } else {
      presenter.update(renderer, 1200, []);
    }
  } catch (failure) { error = (failure as Error).message; }
  const phase = events.findIndex(event => event[0] === "begin-frame");
  return { events: events.slice(phase),
    error: error === "stop-after-participants" ? undefined : error,
    remotePoses: rewritten ? remotePoses : undefined };
}

test("multiplayer presenter local and remote visuals match release frame order", () => {
  for (const scenario of [{}, { remotePose: false, remoteAnimation: false },
    { remotePresentation: false, remoteImported: false },
    { remoteRetired: true }]) {
    const actual = observe(true, scenario);
    const expected = observe(false, scenario);
    assert.equal(expected.error, undefined, JSON.stringify(scenario));
    assert.deepEqual(actual.events, expected.events, JSON.stringify(scenario));
    assert.equal(actual.error, undefined);
    assert.equal(expected.error, undefined);
    assert.deepEqual(actual.remotePoses, [{ playerId: "remote", pose:
      scenario.remotePose === false
        ? { position: { x: 1, y: 2, z: 3 }, initial: true }
        : { position: { x: 10, y: 20, z: 30 }, speed: 4 } }]);
  }
});
