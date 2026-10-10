import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { LocalRaceController } from "../src/multiplayer/local-race-controller.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body.find(item =>
  item.type === "ClassDeclaration" && item.id.name === "Ci0");
assert.ok(node);
const originalSource = release.slice(node.start, node.end);
const RACING = 3;
const visible = (state, value) => state.phase === value;
const Original = new Function("X2", "gL", `${originalSource}\nreturn Ci0;`)(
  { Racing: RACING }, visible);

function fixture(Type) {
  const log = [];
  const host = Object.create(Type.prototype);
  host.dependencies = { runtime: { states: { Racing: RACING } }, resetVisible: visible };
  host.disposed = false;
  host.lifecycle = { state: RACING };
  host.resetState = { phase: 0, startMs: 0 };
  host.warpNext = {
    blocksDriving: () => false,
    reset() { log.push(["warpReset"]); },
  };
  host.physics = {
    lteDodgeAvailable: () => true,
    clearGiantRaceEffects() { log.push(["clearGiant"]); },
    hardCancelControls() { log.push(["cancelControls"]); },
    setRaceMotionLocked(value) { log.push(["motionLocked", value]); },
  };
  host.lte = {
    dispatch(command, time, allowed) { log.push(["dispatch", command, time, allowed]); return allowed; },
    cancel() { log.push(["cancel"]); },
    dispose() { log.push(["lteDispose"]); },
  };
  host.giant = { dispose() { log.push(["giantDispose"]); } };
  host.coordinator = {
    queueRemoteKart(kart, callback) { log.push(["remoteKart", kart, !!callback]); },
    dispose() { log.push(["coordinatorDispose"]); },
  };
  host.track = { group: {
    removeFromParent() { log.push(["trackRemove"]); },
    clear() { log.push(["trackClear"]); },
  } };
  host.pendingRouteTags = ["flash:in:next", "rail:out:prev"];
  host.pendingWarpActions = [{ kind: "teleport" }];
  host.resetSoundPending = true;
  host.roadBlockResetNoticePending = true;
  return { host, log };
}

function exercise(Type) {
  const { host, log } = fixture(Type);
  const values = {
    routeTags: host.consumeLocalRouteTags(),
    routeTagsAfter: host.consumeLocalRouteTags(),
    warpActions: host.consumeWarpActions(),
    available: host.lteAvailable(),
    command: host.handleModeDrivingCommand("jump", 10),
    resetSound: host.consumeResetSound(),
    notice: host.consumeRoadBlockResetNotice(),
    resetStartedAtBefore: host.resetStartedAt,
    resetVisibleBefore: host.resetVisible(0),
    resetSuspendedBefore: host.resetSuspended,
  };
  host.cancelModeDrivingInput();
  host.resetState = { phase: 1, startMs: 123 };
  values.resetStartedAtAfter = host.resetStartedAt;
  values.resetVisibleAfter = host.resetVisible(1);
  values.resetSuspendedAfter = host.resetSuspended;
  host.queueRemoteKart("kart", () => {});
  host.dispose();
  host.dispose();
  values.disposed = host.disposed;
  values.noticeAfter = host.roadBlockResetNoticePending;
  return { values, log };
}

test("local race input, notification queues and disposal match release", () => {
  assert.deepEqual(exercise(LocalRaceController), exercise(Original));
});
