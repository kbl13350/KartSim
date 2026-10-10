import assert from "node:assert/strict";
import test from "node:test";

import { acceptGameMotion, acceptServerMotion, captureNetworkClock,
  networkDiagnostics, sendGameMotion, subscribeGameMotion,
  type ClientMotionHost } from "./client-motion";
import { decodeMotionFrame } from "./motion";
import { ClockSynchronizer } from "./network-timing";
import { GameMotionDecoder, GameMotionEncoder, resolveGameMotion,
  type GameMotionSample } from "./payload";

// Protocol 40 frames name racers by slot, so these paths no longer match the
// release's LT byte for byte; the scenarios are LT's.
const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const otherRaceId = "33333333-3333-4333-8333-333333333333";
const self = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sample: GameMotionSample = { kind: "kinematic", tick: 7,
  position: [1, 2, 3], quaternion: [0, 0, 0, 1],
  linearVelocity: [4, 0, 0], angularVelocity: [0, 0, 0],
  vector5C: [0, 0, 0], vector68: [0, 0, 0] };

function fixture() {
  const sent: Uint8Array[] = [];
  const received: number[] = [];
  const relayed: string[] = [];
  let disposed = 0;
  let direct = { relayMask: 0, sent: true };
  const clock = new ClockSynchronizer();
  clock.record(0, 5, 10);
  const host: ClientMotionHost = {
    playerId: self,
    motionScope: { roomId, raceId, members: new Set([self, other]),
      slot: 0, players: new Map([[0, self], [2, other]]),
      sequence: 0, received: new Map(), enabled: true, recipientMask: 4 },
    motion: { readyState: "open", bufferedAmount: 0,
      send: (bytes: Uint8Array<ArrayBuffer>) => { sent.push(bytes.slice()); } } as unknown as RTCDataChannel,
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

test("direct, relay and invalid send paths", () => {
  const { host, sent, setDirect } = fixture();
  const results = [sendGameMotion(host, sample), sendGameMotion(host, sample, 0)];
  assert.equal(sent.length, 0, "a direct send needs no relay");
  setDirect({ relayMask: 4, sent: true });
  results.push(sendGameMotion(host, sample, 4), sendGameMotion(host, sample, 256));
  assert.deepEqual(results, [true, false, true, false]);
  assert.equal(host.motionScope?.sequence, 2);
  assert.equal(sent.length, 1);
  const frame = decodeMotionFrame(sent[0]!);
  assert.deepEqual({ slot: frame.slot, raceTag: frame.raceTag, recipientMask: frame.recipientMask,
    sequence: frame.sequence, kind: frame.kind, bytes: sent[0]!.length },
  { slot: 0, raceTag: 0x22, recipientMask: 4, sequence: 2, kind: 2, bytes: 8 + 80 });
});

test("the encoder follows a slot change", () => {
  const { host, sent, setDirect } = fixture();
  setDirect({ relayMask: 4, sent: false });
  sendGameMotion(host, sample);
  host.motionScope!.slot = 5;
  sendGameMotion(host, sample);
  assert.deepEqual(sent.map(bytes => decodeMotionFrame(bytes).slot), [0, 5]);
});

test("server decoding names the sender by slot, filters sequences and delivers", () => {
  const { host, received, relayed, disposed } = fixture();
  const message = new GameMotionEncoder({ raceId, slot: 2 }).encode(sample, 9);
  acceptServerMotion(host, message.buffer);
  acceptServerMotion(host, message.buffer);
  // Well-formed frames of another race, an empty slot or our own slot are dropped, not fatal.
  acceptServerMotion(host, new GameMotionEncoder({ raceId: otherRaceId, slot: 2 }).encode(sample, 50).buffer);
  acceptServerMotion(host, new GameMotionEncoder({ raceId, slot: 5 }).encode(sample, 51).buffer);
  acceptServerMotion(host, new GameMotionEncoder({ raceId, slot: 0 }).encode(sample, 52).buffer);
  assert.equal(disposed(), 0);
  acceptServerMotion(host, "wrong");
  assert.equal(disposed(), 1);
  const truncated = message.slice(0, message.length - 1);
  acceptServerMotion(host, truncated.buffer);
  assert.equal(disposed(), 2, "a malformed frame retires the connection");

  const decoded = resolveGameMotion(new GameMotionDecoder().decode(message)!, host.motionScope!)!;
  assert.equal(decoded.playerId, other);
  acceptGameMotion(host, { ...decoded, sequence: 10 });
  const unsubscribe = subscribeGameMotion(host, () => received.push(20));
  acceptGameMotion(host, { ...decoded, sequence: 11 });
  unsubscribe();
  assert.deepEqual(received, [9, 10, 11, 20]);
  assert.deepEqual(relayed, [other]);
  assert.equal(host.motionScope?.received.get(other), 11);
  assert.deepEqual(networkDiagnostics(host), []);
  assert.ok(captureNetworkClock(host));
});
