import assert from "node:assert/strict";
import test from "node:test";
import { resolveRandomSelection, type ReadyFlowController } from "./ready-flow";
import { RandomTrackSession } from "../ui/random-track-session";

test("single-player random start refreshes a stale policy while scripted/manual selections retain their IDs", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldFetch = globalThis.fetch, oldNow = Date.now;
  let calls = 0, now = 100_000, disabled = ["closed", "old_closed"];
  const tracks = [{ id: "closed", path: "track_/closed", gameType: "speed",
    duplicateAliases: [{ id: "old_closed", path: "track_/old_closed", gameType: "speed" }] },
    { id: "open", path: "track_/open", gameType: "speed" }];
  const controller = {
    host: { getLibrary: () => ({ timeAttackTrackCatalog: async () => tracks }) },
    activeRandomGroup: { id: "all", trackIds: ["closed", "old_closed", "open"], gameType: "speed" },
    randomTrackCatalog: tracks,
    randomTrackSession: new RandomTrackSession(() => 0),
  } as unknown as ReadyFlowController;
  const selection = { trackId: "old_closed", mapPath: "track_/old_closed", vehicleItemId: 7 };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://singleplayer-policy.example" },
  } });
  Date.now = () => now;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ disabledTrackIds: disabled, version: String(calls), updatedAt: now }));
  };
  try {
    const resolved = await resolveRandomSelection(controller, selection);
    assert.deepEqual(resolved, { ...selection, trackId: "open", mapPath: "track_/open" });
    assert.equal(selection.trackId, "old_closed");
    assert.equal(calls, 1);
    await resolveRandomSelection(controller, selection);
    assert.equal(calls, 1);
    now += 30_001;
    disabled = ["closed", "old_closed", "open"];
    await assert.rejects(resolveRandomSelection(controller, selection), /当前随机池没有开放的地图/);
    assert.equal(calls, 2);
    const story = { ...selection, story: {} };
    assert.equal(await resolveRandomSelection(controller, story), story);
    controller.activeRandomGroup = undefined;
    assert.equal(await resolveRandomSelection(controller, selection), selection);
    assert.equal(calls, 2);
    assert.equal(controller.randomTrackCatalog, tracks);
  } finally {
    globalThis.fetch = oldFetch; Date.now = oldNow;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
