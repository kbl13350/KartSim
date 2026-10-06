import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  advanceRaceBgmTransition, clearRaceBgmTransition, currentRaceBgmName,
  disposeRaceBgm, playGarageBgm, playMultiplayerBgm,
  playMultiplayerFinishBgm, playMultiplayerPodiumBgm, playMyItemsBgm,
  playReadyBgm, playResultBgm, restartRaceBgm, silenceRaceBgm,
  startRaceBgm, stopRaceBgmOwner,
  type RaceBgmHost, type RaceBgmPlaybackDependencies,
} from "./race-bgm-playback";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class P7 {");
const end = release.indexOf("\nfunction Zd0", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Bgm = RaceBgmHost & {
  playMultiplayer(kind: "lobby" | "room"): void;
  playMultiplayerPodium(): void;
  playMultiplayerFinish(won: boolean): void;
  restart(): void;
  readonly currentRaceName: unknown;
  playGarage(): void;
  playMyItems(): void;
  silence(): void;
};

function makeBgm(rewritten: boolean, mode: "normal" | "stop-error" = "normal") {
  const events: unknown[][] = [];
  let sourceId = 0;
  let timerId = 0;
  const callbacks = new Map<number, () => void>();
  const dependencies: RaceBgmPlaybackDependencies = {
    setLoop(source, loop) { events.push(["loop", source.buffer, loop]); },
    setGain(gain, value, time) { events.push(["gain", gain, value, time]); },
    connect(_context, source, channel, gain) {
      events.push(["connect", source.buffer, channel, gain.gain]);
    },
    setDucking(_context, fading) { events.push(["ducking", fading]); },
    fadeCurve(step) { events.push(["curve", step]);
      return { incoming: step / 16, outgoing: 1 - step / 16 }; },
    schedule(callback, intervalMs) {
      const id = ++timerId;
      callbacks.set(id, callback);
      events.push(["schedule", id, intervalMs]);
      return id as unknown as ReturnType<typeof setInterval>;
    },
    cancel(timer) {
      const id = timer as unknown as number;
      events.push(["cancel", id]);
      callbacks.delete(id);
    },
  };
  const Original = new Function("w4", "he", "S9", "qM", "Qd0",
    "setInterval", "clearInterval",
    `${originalClass}\nreturn P7;`)(
      dependencies.setLoop, dependencies.setGain, dependencies.connect,
      dependencies.setDucking, dependencies.fadeCurve,
      dependencies.schedule, dependencies.cancel,
    ) as new () => Bgm;
  const bgm = Object.create(Original.prototype) as Bgm;
  bgm.context = {
    currentTime: 12,
    createBufferSource() {
      const id = ++sourceId;
      events.push(["create-source", id]);
      return {
        buffer: undefined as unknown,
        start() { events.push(["source-start", id]); },
        stop() { events.push(["source-stop", id]);
          if (mode === "stop-error") throw new Error("already stopped"); },
        disconnect() { events.push(["source-disconnect", id]); },
      };
    },
    createGain() {
      const id = sourceId;
      events.push(["create-gain", id]);
      return { gain: `gain-${id}`,
        disconnect() { events.push(["gain-disconnect", id]); } };
    },
  };
  bgm.readyBuffer = "ready";
  bgm.garageBuffer = "garage";
  bgm.winBuffer = "win";
  bgm.loseBuffer = "lose";
  bgm.random = { next() { events.push(["random"]); return 3; } };
  bgm.raceBuffers = ["race-1", "race-2"];
  bgm.raceNames = ["Forest", "Desert"];
  bgm.transitionStep = 0;
  bgm.multiplayerBuffers = {
    lobby: "multi-lobby", room: "multi-room",
    finish: "multi-finish", podium: "multi-podium",
  };
  if (rewritten) {
    Object.assign(bgm, {
      playMultiplayer(kind: "lobby" | "room") { return playMultiplayerBgm(bgm, kind); },
      playMultiplayerPodium() { return playMultiplayerPodiumBgm(bgm); },
      playMultiplayerFinish(won: boolean) { return playMultiplayerFinishBgm(bgm, won); },
      restart() { return restartRaceBgm(bgm); },
      playReady() { return playReadyBgm(bgm); },
      playGarage() { return playGarageBgm(bgm); },
      playMyItems() { return playMyItemsBgm(bgm); },
      playResult(won: boolean) { return playResultBgm(bgm, won); },
      dispose() { return disposeRaceBgm(bgm); },
      silence() { return silenceRaceBgm(bgm); },
      start(buffer: unknown, loop: boolean, fade: boolean) {
        return startRaceBgm(bgm, buffer, loop, fade, dependencies);
      },
      advanceTransition() { return advanceRaceBgmTransition(bgm, dependencies); },
      clearTransition() { return clearRaceBgmTransition(bgm, dependencies); },
      stop(owner: RaceBgmHost["current"]) { return stopRaceBgmOwner(owner); },
    });
    Object.defineProperty(bgm, "currentRaceName", {
      get: () => currentRaceBgmName(bgm), configurable: true,
    });
  }
  return { bgm, events, callbacks };
}

test("race and multiplayer BGM selection, deduplication and missing buffers match release", () => {
  const inspect = (rewritten: boolean) => {
    const { bgm, events } = makeBgm(rewritten);
    const outcomes: unknown[] = [];
    const capture = (action: () => unknown) => {
      try { outcomes.push(action()); }
      catch (error) { outcomes.push({ error: (error as Error).message }); }
    };
    capture(() => bgm.playReady());
    capture(() => bgm.playReady());
    capture(() => bgm.playGarage());
    capture(() => bgm.playMyItems());
    capture(() => bgm.restart());
    outcomes.push(bgm.currentRaceName);
    capture(() => bgm.playMultiplayer("lobby"));
    capture(() => bgm.playMultiplayer("lobby"));
    capture(() => bgm.playMultiplayer("room"));
    capture(() => bgm.playMultiplayerPodium());
    capture(() => bgm.playMultiplayerFinish(false));
    capture(() => bgm.playMultiplayerFinish(true));
    bgm.multiplayerBuffers = undefined;
    capture(() => bgm.playMultiplayer("room"));
    capture(() => bgm.playMultiplayerPodium());
    capture(() => bgm.playMultiplayerFinish(false));
    return { outcomes, events, raceName: bgm.currentRaceName,
      current: bgm.current?.source.buffer,
      retiring: bgm.retiring?.source.buffer,
      timer: bgm.transitionTimer !== undefined };
  };
  assert.deepEqual(inspect(true), inspect(false));
});

test("crossfade envelopes, source stop failures, silence and disposal match release", () => {
  const inspect = (rewritten: boolean, mode: "normal" | "stop-error") => {
    const { bgm, events, callbacks } = makeBgm(rewritten, mode);
    bgm.start("first", true, true);
    bgm.start("second", false, true);
    for (let index = 0; index < 17; index++) bgm.advanceTransition();
    bgm.start("third", false, false);
    bgm.silence();
    bgm.advanceTransition();
    return { events, hasCurrent: !!bgm.current,
      hasRetiring: !!bgm.retiring, hasTimer: !!bgm.transitionTimer,
      transitionStep: bgm.transitionStep, scheduledCount: callbacks.size };
  };
  for (const mode of ["normal", "stop-error"] as const) {
    assert.deepEqual(inspect(true, mode), inspect(false, mode), mode);
  }
});
