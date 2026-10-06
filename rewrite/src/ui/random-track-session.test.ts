import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RandomTrackSession, randomGroupAcceptsGameType,
  type RandomTrackCandidate, type RandomTrackGroup,
} from "./random-track-session";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Tc0 {");
const classEnd = source.indexOf("const wF =", classStart);
const predicateStart = source.indexOf("function LR(n, e) {");
const predicateEnd = source.indexOf("class Sw {", predicateStart);
assert.ok(classStart > 0 && classEnd > classStart && predicateStart > 0 && predicateEnd > predicateStart);
const release = new Function(`${source.slice(predicateStart, predicateEnd)}
  ${source.slice(classStart, classEnd)}
  return { Tc0, LR };`)() as {
    Tc0: typeof RandomTrackSession;
    LR: typeof randomGroupAcceptsGameType;
  };

test("random card game type compatibility matches release", () => {
  for (const group of [
    { id: "a", trackIds: [], gameType: "speed" },
    { id: "b", trackIds: [], gameType: "item", selectionGameTypes: ["item", "speed"] },
    { id: "c", trackIds: [], gameType: "speed", selectionGameTypes: [] },
  ]) for (const mode of ["speed", "item", "other"]) {
    assert.equal(randomGroupAcceptsGameType(group, mode), release.LR(group, mode));
  }
});

test("random pools avoid repeats, reset on group changes and clamp random samples like Tc0", () => {
  const tracks: RandomTrackCandidate[] = [
    { id: "city", gameType: "speed" }, { id: "forest", gameType: "speed" },
    { id: "desert", gameType: "item" }, { id: "other", gameType: "speed" },
  ];
  const mixed: RandomTrackGroup = {
    id: "mixed", trackIds: ["city", "forest", "desert"],
    gameType: "speed", selectionGameTypes: ["speed", "item"],
  };
  const speed: RandomTrackGroup = {
    id: "speed", trackIds: ["city", "forest"], gameType: "speed",
  };
  const unavailable: RandomTrackGroup = {
    id: "empty", trackIds: ["other"], gameType: "item",
  };
  const samples = [0, 0.9, 1, -0.5, 0.4, 0.2, 0.7, 0.1, 0.99];
  const run = (Session: typeof RandomTrackSession) => {
    let next = 0;
    const session = new Session(() => samples[next++] ?? 0);
    const states: unknown[] = [];
    const capture = (label: string, selection?: unknown) => states.push({
      label, selection, activeGroupId: session.activeGroupId,
      used: [...session.used], sampleCount: next,
    });
    for (let index = 0; index < 5; index++) {
      const selected = session.pick(mixed, tracks);
      capture(`mixed-${index}`, {
        track: selected,
        sameReference: tracks.includes(selected),
      });
    }
    session.selectGroup("mixed"); capture("same-group");
    capture("speed-group", session.pick(speed, tracks));
    try { session.pick(unavailable, tracks); }
    catch (error) { capture("unavailable", String(error)); }
    session.clear(); capture("clear");
    session.clear(); capture("clear-again");
    capture("mixed-after-clear", session.pick(mixed, tracks));
    return states;
  };
  assert.deepEqual(run(RandomTrackSession), run(release.Tc0));
});
