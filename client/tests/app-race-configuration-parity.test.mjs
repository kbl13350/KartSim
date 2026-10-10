import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { applyRaceOptions, replaceRaceTrack } from "../src/app/race-configuration.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "vf0");
assert.ok(declaration);
const names = new Set(["replaceTrack", "applyRaceOptions"]);
const methods = declaration.body.body.filter(node =>
  node.type === "ClassMethod" && names.has(node.key.name));
assert.equal(methods.length, 2);
const context = {};
runInNewContext(`class ReleasedPresenter { ${methods.map(method =>
  source.slice(method.start, method.end)).join("\n")} }
globalThis.ReleasedPresenter = ReleasedPresenter;`, context);

function run(kind, options) {
  const trace = [];
  const dependencies = {
    applyTrackFog: (scene, track) => trace.push(`fog:${scene.id}:${track.id}`),
    setToonLinesEnabled: enabled => trace.push(`toon:${enabled}`),
    isManualBoostTachometer: value => value instanceof ManualBoostTachometer,
  };
  class ManualBoostTachometer {
    setManualBoostAlarm(enabled) { trace.push(`alarm:${enabled}`); }
  }
  Object.assign(context, {
    kv: dependencies.applyTrackFog,
    Pp: dependencies.setToonLinesEnabled,
    Gr: ManualBoostTachometer,
  });
  const track = id => ({
    id,
    group: { removeFromParent: () => trace.push(`remove:${id}`) },
    dispose: () => trace.push(`dispose:${id}`),
  });
  const oldTrack = options.existingTrack ? track("old") : undefined;
  const newTrack = track("new");
  const session = {
    track: oldTrack,
    tachometer: options.manualTachometer
      ? new ManualBoostTachometer()
      : { setManualBoostAlarm: () => trace.push("unexpected alarm") },
  };
  const host = {
    session,
    scene: { id: "scene", add: group => trace.push(`add:${group === newTrack.group}`) },
    gameOptions: { toonLine: options.toonLine, dualBoostAuto: options.dualBoostAuto },
    getPhysics: () => ({
      setDualBoostAuto: (enabled, itemId) => trace.push(`dualBoost:${enabled}:${itemId}`),
    }),
  };
  const presenter = kind === "release" ? new context.ReleasedPresenter() : {};
  presenter.host = host;
  if (kind === "rewrite") {
    presenter.replaceTrack = value => replaceRaceTrack(presenter, value, dependencies);
    presenter.applyRaceOptions = itemId => applyRaceOptions(presenter, itemId, dependencies);
  }
  presenter.replaceTrack(newTrack);
  presenter.applyRaceOptions(options.kartItemId);
  return { trace, trackReplaced: session.track === newTrack };
}

test("track replacement matches release with and without a previous track", () => {
  for (const existingTrack of [false, true]) {
    const options = {
      existingTrack, manualTachometer: false, toonLine: true,
      dualBoostAuto: false, kartItemId: 1000,
    };
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});

test("toon lines and kart-specific dual-boost alarms match release", () => {
  for (const kartItemId of [1096, 1106, 1097, 1000]) {
    for (const dualBoostAuto of [false, true]) {
      for (const manualTachometer of [false, true]) {
        const options = {
          existingTrack: false, manualTachometer, toonLine: false,
          dualBoostAuto, kartItemId,
        };
        assert.deepEqual(run("rewrite", options), run("release", options));
      }
    }
  }
});
