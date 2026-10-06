import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { acceptGameMotion, acceptServerMotion, captureNetworkClock,
  networkDiagnostics, sendGameMotion, subscribeGameMotion,
  type ClientMotionHost } from "./client-motion";
import { ClockSynchronizer } from "./network-timing";
import { GameMotionDecoder, GameMotionEncoder,
  type DecodedGameMotion, type GameMotionSample } from "./payload";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const first = source.indexOf("class LT {");
assert.ok(first > 0);
const boundaries = ["  acceptMotion(", "  acceptMotionMessage(", "  sendMotion(",
  "  networkDiagnostics(", "  subscribeMotion(", "  clock = new L40();"];
const methods = boundaries.slice(0, -1).map((start, index) => {
  const begin = source.indexOf(start, first);
  const end = source.indexOf(boundaries[index + 1]!, begin);
  assert.ok(begin > first && end > begin);
  return source.slice(begin, end);
});
const Original = new Function("S40", "No", `return class {
  ${methods.join("\n")}
  captureClock() { return this.clock.capture(performance.now()); }
};`)(GameMotionEncoder,
  (candidate: number, previous: number) => {
    const delta = (candidate - previous) >>> 0;
    return delta > 0 && delta < 0x8000_0000;
  }) as new () => ClientMotionHost & {
    acceptMotion(input: unknown): void;
    acceptMotionMessage(message: DecodedGameMotion, server?: boolean): void;
    sendMotion(sample: GameMotionSample, mask?: number): boolean;
    networkDiagnostics(): unknown;
    subscribeMotion(listener: (message: DecodedGameMotion) => void): () => void;
    captureClock(): unknown;
  };

const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const self = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sample: GameMotionSample = { kind: "kinematic", tick: 7,
  position: [1, 2, 3], quaternion: [0, 0, 0, 1],
  linearVelocity: [4, 0, 0], angularVelocity: [0, 0, 0],
  vector5C: [0, 0, 0], vector68: [0, 0, 0] };

function fixture() {
  const sent: number[][] = [];
  const received: number[] = [];
  const relayed: string[] = [];
  let disposed = 0;
  let direct = { relayMask: 0, sent: true };
  const clock = new ClockSynchronizer();
  clock.record(0, 5, 10);
  const host: ClientMotionHost = {
    playerId: self,
    motionScope: { roomId, raceId, members: new Set([self, other]),
      sequence: 0, received: new Map(), enabled: true, recipientMask: 4 },
    motion: { readyState: "open", bufferedAmount: 0,
      send: (bytes: Uint8Array<ArrayBuffer>) => { sent.push(Array.from(bytes)); } } as unknown as RTCDataChannel,
    decoder: new GameMotionDecoder(),
    peerTransport: {
      send: () => direct,
      receivedFromServer: message => { relayed.push(message.playerId); },
      diagnostics: () => [],
    },
    motionListeners: new Set([message => { received.push(message.sequence); }]),
    clock,
    dispose: () => { disposed++; },
  };
  return { host, sent, received, relayed,
    setDirect: (value: typeof direct) => { direct = value; },
    disposed: () => disposed };
}

test("direct, relay and invalid send paths match LT", () => {
  const run = (released: boolean) => {
    const { host, sent, setDirect } = fixture();
    const old = Object.assign(new Original(), host);
    const target = released ? old : host;
    const send = (mask?: number) => released
      ? old.sendMotion(sample, mask) : sendGameMotion(target, sample, mask);
    const results = [send(), send(0)];
    setDirect({ relayMask: 4, sent: true });
    results.push(send(4));
    results.push(send(256));
    return { results, sent, sequence: target.motionScope?.sequence };
  };
  assert.deepEqual(run(false), run(true));
});

test("server decoding, sequence filtering and subscriber delivery match LT", () => {
  const run = (released: boolean) => {
    const { host, received, relayed, disposed } = fixture();
    const old = Object.assign(new Original(), host);
    const target = released ? old : host;
    const accept = (input: unknown) => released
      ? old.acceptMotion(input) : acceptServerMotion(target, input);
    const message = new GameMotionEncoder({ roomId, raceId, playerId: other }).encode(sample, 9);
    accept(message.buffer);
    accept(message.buffer);
    accept("wrong");
    const decoded = new GameMotionDecoder().decode(message)!;
    if (released) old.acceptMotionMessage({ ...decoded, sequence: 10 });
    else acceptGameMotion(target, { ...decoded, sequence: 10 });
    const unsubscribe = released
      ? old.subscribeMotion(() => received.push(20))
      : subscribeGameMotion(target, () => received.push(20));
    if (released) old.acceptMotionMessage({ ...decoded, sequence: 11 });
    else acceptGameMotion(target, { ...decoded, sequence: 11 });
    unsubscribe();
    return { received, relayed, disposed: disposed(),
      previous: target.motionScope?.received.get(other),
      diagnostic: released ? old.networkDiagnostics() : networkDiagnostics(target),
      clock: released ? old.captureClock() : captureNetworkClock(target) };
  };
  assert.deepEqual(run(false), run(true));
});
