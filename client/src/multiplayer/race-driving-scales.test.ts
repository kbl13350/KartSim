import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  chargerDurationScale, computeCatchupScales, SlipstreamBoost,
  type RaceProgressPeer, type RacePoint, type SlipstreamPeer,
} from "./race-driving-scales";

// Evaluate the fixed, inspected release implementation, not the generated copy.
const releaseSource = readFileSync(
  new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8",
);
const start = releaseSource.indexOf("const M9 = Math.fround,");
const end = releaseSource.indexOf("class Ui0 {", start);
assert.ok(start > 0 && end > start);
const release = new Function(`${releaseSource.slice(start, end)}\nreturn { Oi0, zi0, fE };`)() as {
  Oi0: typeof computeCatchupScales;
  zi0: typeof chargerDurationScale;
  fE: new () => SlipstreamBoost;
};

function point(x: number, y = 0, z = 0): RacePoint {
  return { x, y, z };
}

function peer(id: string, position: RacePoint, forward = point(1)): SlipstreamPeer {
  return { playerId: id, position, forward };
}

function boostState(boost: SlipstreamBoost) {
  return {
    history: [...boost.history].map(([id, samples]) => [id, samples.map(sample => ({ ...sample }))]),
    chargeStart: boost.chargeStart,
    activeStart: boost.activeStart,
    cooldownStart: boost.cooldownStart,
    presentationVisible: boost.presentationVisible,
    hudActive: boost.hudActive,
    windowActive: boost.windowActive,
  };
}

test("catchup and charger scale thresholds match the fixed release", () => {
  const distances = [NaN, Infinity, -1, 0, 0.125, 1_000];
  const gaps = [-2, 0, 0.0001, 10, 40, 200.99, 201, 299.99, 300,
    400.99, 401, 700.99, 701, 10_000];
  for (const distance of distances) {
    for (const gap of gaps) {
      const peers: RaceProgressPeer[] = [
        { progress: { distance: distance + gap } },
        { progress: { distance: distance - 50 } },
        { progress: { distance: NaN } },
        {},
      ];
      assert.deepEqual(computeCatchupScales(distance, peers), release.Oi0(distance, peers),
        `catchup distance ${distance}, gap ${gap}`);
      assert.equal(chargerDurationScale(distance, peers), release.zi0(distance, peers),
        `charger distance ${distance}, gap ${gap}`);
    }
  }
});

test("slipstream charge, burst, cooldown, and peer departure match release", () => {
  const actual = new SlipstreamBoost();
  const original = new release.fE();
  const local = point(0);
  const leading = (x: number, id = "peer-a") => [peer(id, point(x))];
  const steps: Array<[number, number, SlipstreamPeer[], number, number, boolean?]> = [
    [0, 120, leading(8), 1_000, 1.75],
    [10, 120, leading(1), 1_000, 1.75],
    [2_510, 120, leading(1), 1_000, 1.75],
    [2_511, 120, leading(1), 1_000, 1.75],
    [3_000, 40, leading(1), 1_000, 1.75, true],
    [3_512, 120, leading(1), 1_000, 1.75],
    [6_511, 120, leading(1), 1_000, 1.75],
    [6_512, 120, leading(1), 1_000, 1.75],
    [9_013, 120, leading(1), 1_000, 1.75],
    [10_500, 120, [], 1_000, 1.75],
    [11_000, 120, leading(8, "peer-b"), 1_000, 1.75],
    [11_010, 120, leading(1, "peer-b"), 1_000, 1.75],
  ];
  for (const [now, speed, peers, duration, multiplier, suspended] of steps) {
    const arguments_: [number, RacePoint, number, SlipstreamPeer[], number, number, boolean?] =
      [now, local, speed, peers, duration, multiplier, suspended];
    assert.equal(actual.update(...arguments_), original.update(...arguments_), `boost at ${now}`);
    assert.deepEqual(boostState(actual), boostState(original), `state at ${now}`);
  }
  actual.reset(); original.reset();
  assert.deepEqual(boostState(actual), boostState(original));
});

test("slipstream direction, invalid peers, sample cap, and invalid settings match release", () => {
  const actual = new SlipstreamBoost();
  const original = new release.fE();
  const cases: Array<[number, RacePoint, number, SlipstreamPeer[], number, number, boolean?]> = [
    [100, point(0), 120, [peer("a", point(8))], 1_000, 1.2],
    [200, point(0), 120, [peer("a", point(1), point(-1))], 1_000, 1.2],
    [300, point(0), 120, [peer("a", point(9))], 1_000, 1.2],
    [400, point(0), 120, [peer("a", point(1))], 1_000, 1.2],
    [500, point(0), 120, [peer("a", point(1)), peer("b", point(NaN))], 1_000, 1.2],
    [600, point(0), 99, [peer("a", point(1))], 1_000, 1.2],
    [700, point(0), 120, [peer("a", point(1))], 0, 1.2],
    [800, point(0), 120, [peer("a", point(1))], 1_000, 4.01],
    [900, point(0), 120, [peer("a", point(1))], 1_000, 1.2, true],
    [1_000, point(0), 120, [peer("a", point(1))], 1_000, 1.2],
    [1_100, point(0), 120, [peer("a", point(10))], 1_000, 1.2],
    [1_200, point(0), 120, [peer("a", point(2))], 1_000, 1.2],
    [1_300, point(0), 120, [peer("a", point(11))], 1_000, 1.2],
    [1_400, point(0), 120, [peer("a", point(3))], 1_000, 1.2],
    [1_500, point(0), 120, [peer("a", point(12))], 1_000, 1.2],
    [1_600, point(0), 120, [peer("a", point(4))], 1_000, 1.2],
  ];
  for (const arguments_ of cases) {
    assert.equal(actual.update(...arguments_), original.update(...arguments_));
    assert.deepEqual(boostState(actual), boostState(original));
  }
  assert.equal(actual.history.get("a")?.length, 5);
});
