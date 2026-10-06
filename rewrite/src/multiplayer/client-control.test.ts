import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { disposeClient, onClientClose, sameOriginOfferUrl,
  sendControlRequest, subscribeControl, type ClientControlHost } from "./client-control";
import { ClockSynchronizer, MotionRoundTripTracker } from "./network-timing";
import { GameMotionDecoder } from "./payload";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class LT {");
assert.ok(start > 0);
const names = ["  static sameOriginUrl(", "  async connect(", "  request(",
  "  subscribe(", "  onClose(", "  dispose(", "\n}\nconst ml0"];
const spans = names.map(name => source.indexOf(name, start));
assert.ok(spans.every((value, index) => value > start && (!index || value > spans[index - 1]!)));
const Original = new Function("d6", `return class {
  ${source.slice(spans[0], spans[1])}
  ${source.slice(spans[2], spans[6])}
};`)(GameMotionDecoder) as new () => ClientControlHost & {
  sameOriginUrl(url: string): string;
  request(message: { type: string; clientTick?: number }): Promise<unknown>;
  subscribe(listener: (message: unknown) => void): () => void;
  onClose(listener: () => void): () => void;
  dispose(): void;
};

function fixture() {
  const events: string[] = [];
  const wire: string[] = [];
  const host: ClientControlHost = {
    peer: { close: () => { events.push("peer-close"); } },
    control: { readyState: "open", bufferedAmount: 0,
      send: (value: string) => { wire.push(value); },
      close: () => { events.push("control-close"); } } as unknown as RTCDataChannel,
    motion: { close: () => { events.push("motion-close"); } },
    abort: new AbortController(),
    peerTransport: { dispose: () => { events.push("mesh-dispose"); } },
    decoder: new GameMotionDecoder(),
    nextId: 0, pending: new Map(),
    clock: new ClockSynchronizer(),
    raceLatencies: new Map([["peer", 12]]),
    playerId: "self", motionListeners: new Set([() => {}]),
    echoRtt: new MotionRoundTripTracker(),
    listeners: new Set(), closeListeners: new Set(),
  };
  return { host, events, wire };
}

test("same-origin offer URL and request envelope match LT", async () => {
  const originalUrl = (Original as unknown as { sameOriginUrl(url: string): string }).sameOriginUrl;
  for (const url of ["https://example.org/play?a=1#b", "http://localhost:8780/"]) {
    assert.equal(sameOriginOfferUrl(url), originalUrl(url));
  }
  assert.throws(() => sameOriginOfferUrl("file:///tmp/game"), /HTTP/);

  const run = async (released: boolean) => {
    const { host, wire } = fixture();
    const old = Object.assign(new Original(), host);
    const target = released ? old : host;
    const pending = released ? old.request({ type: "clock", clientTick: 100.5 })
      : sendControlRequest(target, { type: "clock", clientTick: 100.5 });
    const snapshot = { wire, nextId: target.nextId,
      pending: [...target.pending].map(([id, request]) =>
        ({ id, clockTick: request.clockTick })),
      sent: target.echoRtt.sent, replied: target.echoRtt.replied };
    target.pending.get("1")!.resolve("ok");
    assert.equal(await pending, "ok");
    clearTimeout(target.pending.get("1")!.timer);
    target.pending.clear();
    return snapshot;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("unsubscribe and disposal order match LT", () => {
  const run = (released: boolean) => {
    const { host, events } = fixture();
    const old = Object.assign(new Original(), host);
    const target = released ? old : host;
    const unsubscribe = released ? old.subscribe(() => events.push("message"))
      : subscribeControl(target, () => events.push("message"));
    const removeClose = released ? old.onClose(() => events.push("closed"))
      : onClientClose(target, () => events.push("closed"));
    const before = { listeners: target.listeners.size, closeListeners: target.closeListeners.size };
    unsubscribe();
    target.pending.set("7", { resolve: () => {},
      reject: () => events.push("reject"),
      timer: setTimeout(() => {}, 10_000) });
    if (released) old.dispose(); else disposeClient(target);
    removeClose();
    return { before, events, peer: target.peer, playerId: target.playerId,
      pending: target.pending.size, listeners: target.listeners.size,
      closeListeners: target.closeListeners.size };
  };
  assert.deepEqual(run(false), run(true));
});
