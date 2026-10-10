import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { NormalRaceCoordinator, makeNormalObject } from "../src/vehicle/normal-race-coordinator.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const names = ["U40", "yL", "as", "J8"];
const nodes = parse(source, { sourceType: "module" }).program.body.filter(node =>
  (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
  names.includes(node.id.name));
assert.deepEqual(nodes.map(node => node.id.name).sort(), [...names].sort());
const originalText = nodes.map(node => source.slice(node.start, node.end)).join("\n");
const Original = new Function("Q30", "e40",
  `${originalText}; return yL;`)(token => token === "solo", token => token === "multi");

function fixture(options = {}) {
  const calls = [];
  const record = (...args) => calls.push(args);
  const kart = {
    body: { position: { x: 1, y: 2, z: 3 } },
    state: { trackProgress: 0 },
    update(time, input) {
      record("kart update", time, input);
      this.body.position.x += 1;
      return options.noSchedule ? undefined : { tick: time };
    },
    handleRouteSurfaceTag(tag) { record("tag", tag); },
    contactRailId: () => options.rail ? "rail" : undefined,
  };
  const track = {
    updateObstacles: (...args) => record("obstacle update", ...args),
    registerObstaclePair: (...args) => record("obstacle pair", ...args),
    commitObstacleSnapshot: () => record("obstacle commit"),
    updateEvents: (...args) => record("event update", ...args),
    registerEventPairs: (...args) => record("event pair", ...args),
    commitEventSnapshot: () => record("event commit"),
    runOuterRoutePass: (_kart, previous, current, onTag) => {
      record("route", previous, current);
      onTag("road", "outer");
      return options.noRoute ? undefined : { distance: 10 };
    },
    getRouteState: () => { record("get route"); return { distance: 20 }; },
    completeRailContactLanding: (_kart, position, onTag) => {
      record("rail landing", position);
      onTag("rail", "contact");
      return !!options.rail;
    },
    completeWarpNextRailLanding: (_kart, onTag) => {
      record("warp landing");
      onTag("warp", "next");
      return !!options.warp;
    },
  };
  return { calls, kart, track };
}

function exercise(Type, options) {
  const { calls, kart, track } = fixture(options);
  let coordinator;
  try {
    coordinator = Type === Original
      ? new Original(options.mode ?? "solo", track, kart,
        (tag, detail) => calls.push(["sink", tag, detail]))
      : new NormalRaceCoordinator(options.mode ?? "solo", track, kart,
        (tag, detail) => calls.push(["sink", tag, detail]), {
          isSoloMode: token => token === "solo",
          isMultiplayerMode: token => token === "multi",
        });
  } catch (error) { return { error: error.message, calls }; }
  const remote = makeNormalObject("remote", true);
  remote.slot12 = time => calls.push(["remote update", time]);
  remote.commit = () => calls.push(["remote commit"]);
  coordinator.queueRemoteKart(remote, time => calls.push(["remote pair", time]));
  const item = makeNormalObject("item", true, 2);
  item.slot13 = (peer, time) => calls.push(["item pair", peer.name, time]);
  coordinator.queueKartPairObject(item);
  if (options.defer) coordinator.deferWarpNextRailLanding();
  let result;
  try { result = coordinator.run(100, { accelerate: true }); }
  catch (error) { result = error.message; }
  coordinator.synchronizePositionAnchor();
  const completed = coordinator.completeWarpNextRailLanding();
  const peer = coordinator.isKartPeer(coordinator.kartObject);
  coordinator.dispose();
  return JSON.parse(JSON.stringify({ result, completed, peer, calls,
    progress: kart.state.trackProgress,
    previous: coordinator.previousPosition,
    active: coordinator.core.active.length }));
}

test("normal race coordinator stages, tags, peers, rail and warp match release", () => {
  for (const options of [
    {}, { mode: "multi", rail: true }, { defer: true, warp: true },
    { mode: "invalid" }, { noSchedule: true }, { noRoute: true },
  ]) assert.deepEqual(exercise(NormalRaceCoordinator, options),
    exercise(Original, options), JSON.stringify(options));
});
