import assert from "node:assert/strict";
import test from "node:test";

import { disposeClient, type ClientControlHost } from "./client-control";
import { ClockSynchronizer, MotionRoundTripTracker } from "./network-timing";
import { GameMotionDecoder } from "./payload";
import { forgetConnectedClient, measureGameServerLatency,
  rememberConnectedClient } from "./server-latency";

test("the newest game connection answers a clock request", async () => {
  let clock = 1_000;
  const requests: unknown[] = [];
  const older = { request: async () => { throw new Error("older connection used"); } };
  const newer = {
    request: async (message: unknown) => { requests.push(message); clock += 23; return {}; },
  };
  rememberConnectedClient(older);
  rememberConnectedClient(newer);
  try {
    assert.equal(await measureGameServerLatency(() => clock), 23);
    assert.deepEqual(requests, [{ type: "clock", clientTick: 1_000 }]);
  } finally {
    forgetConnectedClient(newer);
    forgetConnectedClient(older);
  }
});

test("without a game connection there is no latency, and failed requests reject", async () => {
  assert.equal(await measureGameServerLatency(() => 0), undefined);
  const busy = { request: async () => { throw new Error("Connection busy"); } };
  rememberConnectedClient(busy);
  try {
    await assert.rejects(measureGameServerLatency(() => 0), /Connection busy/);
  } finally {
    forgetConnectedClient(busy);
  }
});

test("disposing a client stops it being probed", async () => {
  const host = {
    peer: { close() {} }, control: undefined, motion: undefined,
    decoder: new GameMotionDecoder(), nextId: 0, pending: new Map(),
    clock: new ClockSynchronizer(), raceLatencies: new Map(),
    motionListeners: new Set(), echoRtt: new MotionRoundTripTracker(),
    listeners: new Set(), closeListeners: new Set(),
    request: async () => { throw new Error("disposed connection used"); },
  } satisfies ClientControlHost & { request(): Promise<unknown> };
  rememberConnectedClient(host);
  disposeClient(host);
  assert.equal(await measureGameServerLatency(() => 0), undefined);
});
