import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { prepareRacePresenterTrackEvents,
  type RacePresenterTrackEventsHost } from "./race-presenter-track-events";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Scenario = "empty" | "full" | "no-sound" | "disposed-before" |
  "missing-root" | "missing-world" | "effects-fail" | "audio-fail" |
  "dummy-fail" | "disposed-during";

async function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const resources = {
    effects: { dispose() { events.push(["dispose-effects"]); } },
    audio: { dispose() { events.push(["dispose-audio"]); } },
    dummy: { dispose() { events.push(["dispose-dummy"]); } },
  };
  let host: RacePresenterTrackEventsHost;
  const dependencies = {
    async loadEffects(_library: unknown, _projections: unknown,
      root: unknown, environment: unknown, binding: unknown,
      context: unknown) {
      events.push(["load-effects", root, environment, binding, context]);
      if (scenario === "effects-fail") throw new Error("effects failed");
      return resources.effects;
    },
    async loadAudio(_library: unknown, _projections: unknown,
      world: unknown, context: unknown) {
      events.push(["load-audio", world, context]);
      if (scenario === "audio-fail") throw new Error("audio failed");
      return resources.audio;
    },
    async loadDummyAudio(_library: unknown, sounds: unknown[], context: unknown) {
      events.push(["load-dummy", sounds, context]);
      if (scenario === "dummy-fail") throw new Error("dummy failed");
      if (scenario === "disposed-during") host.disposed = true;
      return resources.dummy;
    },
  };
  const Original = new Function("b7", "v7", "m7",
    `${originalClass}\nreturn jr0;`)(
    { load: dependencies.loadEffects }, { load: dependencies.loadAudio },
    { load: dependencies.loadDummyAudio },
  ) as new () => { prepareTrackEvents(library: unknown,
    audioContext: unknown): Promise<void> };
  host = Object.create(Original.prototype) as RacePresenterTrackEventsHost;
  const projections = scenario === "empty" ? [] : [{ get sound() {
    events.push(["sound-check"]);
    return scenario !== "no-sound";
  } }];
  Object.assign(host, {
    disposed: scenario === "disposed-before",
    playerId: "local",
    assets: { map: {
      eventProjections: projections,
      environment: "environment",
      stageBinding: "binding",
      renderScene: scenario === "missing-world" ? undefined
        : { clientWorldElements: "world-elements" },
      dummySounds: scenario === "empty" ? [] : ["dummy-sound"],
    } },
    views: scenario === "missing-root" ? new Map() : new Map([
      ["local", { presentationRoot() { events.push(["presentation-root"]);
        return "local-root"; } }],
    ]),
  });
  let error: string | undefined;
  try {
    if (rewritten) await prepareRacePresenterTrackEvents(host, "library",
      "audio-context", dependencies);
    else await (host as unknown as InstanceType<typeof Original>)
      .prepareTrackEvents("library", "audio-context");
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, disposed: host.disposed,
    effects: host.trackEventEffects === resources.effects,
    audio: host.trackEventAudio === resources.audio,
    dummy: host.trackDummyAudio === resources.dummy };
}

test("multiplayer track event loading and every cleanup failure match release", async () => {
  const scenarios: Scenario[] = ["empty", "full", "no-sound", "disposed-before",
    "missing-root", "missing-world", "effects-fail", "audio-fail",
    "dummy-fail", "disposed-during"];
  for (const scenario of scenarios) {
    assert.deepEqual(await observe(true, scenario), await observe(false, scenario),
      scenario);
  }
});
