import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { captureOutgoingMotion, isKnownNetworkMotionMode,
  OutgoingRaceMotionSender, type OutgoingMotionSource,
  type OutgoingMotionBody } from "./outgoing-race-motion";
import type { MotionPresentation, MotionRaceProgress } from "./payload";

const sourceText = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = sourceText.indexOf("const us = (n) =>");
const end = sourceText.indexOf("const b9 = Math.fround,", start);
assert.ok(start > 0 && end > start);
const bodyQuaternion = (_body: OutgoingMotionBody) => ({ w: 0.5, x: 0.25, y: -0.125, z: 0.75 });
const release = new Function("PL", `${sourceText.slice(start, end)}\nreturn { FL, Ii0, ki0 };`)(
  bodyQuaternion,
) as {
  FL: (mode: number) => boolean;
  Ii0: (source: OutgoingMotionSource, tick: number, suspended?: boolean) => unknown;
  ki0: new (...args: any[]) => OutgoingRaceMotionSender;
};

function makeSource() {
  const calls: unknown[] = [];
  const source: OutgoingMotionSource = {
    networkMotionMode: 0,
    body: {
      position: { x: 1.12500001, y: -2.4, z: 3.8 },
      linearVelocity: { x: 4.2, y: -5.3, z: 6.4 },
      angularVelocity: { x: 0.1, y: -0.2, z: 0.3 },
    },
    copyNetworkWrench(wrench) {
      calls.push("copyNetworkWrench");
      wrench.force = { x: 9.1, y: -8.2, z: 7.3 };
      wrench.torque = { x: -0.7, y: 0.8, z: -0.9 };
    },
    networkCollisionState() {
      calls.push("networkCollisionState");
      return { active: true, scaleX: 1.25, scaleY: 0.9 };
    },
    state: { visualScale: { x: 1.1, y: 1.2, z: 1.3 } },
  };
  return { source, calls };
}

test("outgoing sample coordinates, wrench, and motion modes match release", () => {
  for (const mode of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) {
    assert.equal(isKnownNetworkMotionMode(mode), release.FL(mode));
    for (const suspended of [false, true]) {
      const actual = makeSource();
      const original = makeSource();
      actual.source.networkMotionMode = original.source.networkMotionMode = mode;
      const read = (run: () => unknown) => {
        try { return { value: run() }; }
        catch (error) { return { error: (error as Error).message }; }
      };
      assert.deepEqual(
        read(() => captureOutgoingMotion(actual.source, 4_294_967_123,
          suspended, bodyQuaternion)),
        read(() => release.Ii0(original.source, 4_294_967_123, suspended)),
      );
      assert.deepEqual(actual.calls, original.calls);
    }
  }
});

const presentation: MotionPresentation = {
  forwardSpeed: 82, rawSteer: 0.3, tireTransient: 0,
  collisionStrength: 0, boosterState: 1, visualScaleMode: 0,
  frontLamp: false, rearLamp: true, motorcycle: false,
  instantAccelerationActive: false, landingSequence: 2, collisionSequence: 3,
  animation: { physicsState: 1, dualMode: 0, dualBoosterState: 0,
    dualTeam: false, chargerActive: false, displaySpeedKmh: 120,
    dualReadyRemainingMs: 0 },
};
const progress: MotionRaceProgress = { distance: 123.5, lap: 2 };

// The release routes by player ID, protocol 40 by room slot.
const slots = new Map([["me", 4]]);

function runSender(released: boolean, withRouting: boolean, slotOf = (id: string) => slots.get(id)) {
  const { source, calls } = makeSource();
  const connection = {
    hasMotionRecipients: true,
    directMotionAvailable(slot: number) { calls.push(["direct", slot]); return slot === 1; },
    sendMotion(sample: any, mask?: number) {
      const sent = structuredClone(sample);
      if (sent.routing?.observedPlayerId !== undefined) {
        sent.routing = { motionMode: sent.routing.motionMode, observedSlot: slots.get(sent.routing.observedPlayerId) };
      }
      calls.push(["send", sent, mask]); return true;
    },
  };
  const clock = { encode(timeMs: number) {
    calls.push(["encode", timeMs]); return Math.trunc(timeMs + 1_000);
  } };
  let mask = 2;
  const routing = withRouting ? {
    playerId: "me",
    position(id: string) { calls.push(["position", id]); return { x: 3, y: 4, z: 5 }; },
    cadence: { select(...args: any[]) {
      calls.push(["select", args.slice(0, 4), args[5](1)]);
      return mask;
    }, slotOf },
  } : undefined;
  const sender = released
    ? new release.ki0(source, clock, connection, routing)
    : new OutgoingRaceMotionSender(source, clock, connection, routing, bodyQuaternion);
  const output: unknown[] = [];
  const step = (label: string, run: () => unknown) => {
    try { output.push([label, run(), sender.lastBucket, sender.disposed, [...calls]]); }
    catch (error) {
      output.push([label, (error as Error).message, sender.lastBucket, sender.disposed, [...calls]]);
    }
    calls.length = 0;
  };
  step("first", () => sender.update(0, presentation, progress));
  step("same bucket", () => sender.update(32, presentation, progress));
  step("next bucket", () => sender.update(64, presentation, progress));
  mask = 0;
  step("cadence skipped", () => sender.update(128, presentation, progress));
  step("same skipped bucket", () => sender.update(129, presentation, progress));
  mask = 2;
  connection.hasMotionRecipients = false;
  step("no recipients", () => sender.update(192, presentation, progress));
  connection.hasMotionRecipients = true;
  step("recipients resume within bucket", () => sender.update(193, presentation, progress));
  source.networkMotionMode = 3;
  step("special motion", () => sender.update(256, presentation, progress));
  step("reset", () => sender.update(320, presentation, progress, true, 301));
  step("missing presentation", () => sender.update(384, undefined, progress));
  source.state = undefined;
  step("missing visual scale", () => sender.update(448, presentation, progress));
  source.state = { visualScale: { x: 1, y: 1, z: 1 } };
  step("clock backwards", () => sender.update(64, presentation, progress));
  step("invalid clock", () => sender.update(NaN, presentation, progress));
  sender.dispose();
  step("disposed", () => sender.update(512, presentation, progress));
  return output;
}

test("motion send bucket, cadence, packet composition, and failure state match release", () => {
  assert.deepEqual(runSender(false, true), runSender(true, true));
  assert.deepEqual(runSender(false, false), runSender(true, false));
  const first = runSender(false, true)[0] as [string, boolean, number, boolean, unknown[]];
  const sent = first[4].find(call => (call as unknown[])[0] === "send") as [string, { routing: unknown }];
  assert.deepEqual(sent[1].routing, { motionMode: 0, observedSlot: 4 });
});

test("routing without a slot for the observed racer fails like incomplete race motion", () => {
  const [label, result] = runSender(false, true, () => undefined)[0] as [string, unknown];
  assert.deepEqual([label, result], ["first", "Distance cadence requires full race motion"]);
});
