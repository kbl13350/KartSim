import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  TimeAttackRaceState, TimeAttackResultOverlay,
} from "../src/timeattack/race-display-state.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const classSource = name => {
  const node = declarations.find(item =>
    item.type === "ClassDeclaration" && item.id.name === name);
  assert.ok(node, `${name} is present in the release`);
  return release.slice(node.start, node.end);
};

function raceState(readable) {
  const calls = [];
  const dependencies = {
    createLifecycle: () => { calls.push("lifecycle"); return { kind: "lifecycle" }; },
    createSpeedResetState: () => {
      calls.push("reset"); return { kind: "reset" };
    },
  };
  const OriginalState = new Function("GF", "pr",
    `${classSource("Bd0")}; return Bd0;`)(
      class { constructor() { return dependencies.createLifecycle(); } },
      dependencies.createSpeedResetState);
  const state = readable
    ? new TimeAttackRaceState(dependencies)
    : new OriginalState();
  const values = Object.fromEntries(Object.entries(state)
    .sort(([left], [right]) => left.localeCompare(right)));
  return { calls, values };
}

function resultOverlay(readable) {
  const calls = [];
  class Renderer {
    constructor() { calls.push(["new renderer"]); }
    update(...args) { calls.push(["update", ...args]); }
    render(...args) { calls.push(["render", ...args]); }
    dispose() { calls.push(["dispose"]); }
  }
  const buildItems = (definition, values, width, height) =>
    [{ definition, values, width, height }];
  const dependencies = {
    createRenderer: () => new Renderer(), buildItems,
  };
  const OriginalOverlay = new Function("fn", "gX",
    `${classSource("Rd0")}; return Rd0;`)(Renderer, buildItems);
  const overlay = readable
    ? new TimeAttackResultOverlay("result-definition", dependencies)
    : new OriginalOverlay("result-definition");
  overlay.render("canvas", 1600, 900);
  overlay.show({ time: 123, rank: 1 });
  overlay.render("canvas", 1600, 900);
  overlay.render("canvas", 1600, 900);
  overlay.render("canvas", 1280, 720);
  overlay.hide();
  overlay.show({ time: 456 });
  overlay.render("canvas", 1280, 720);
  overlay.dispose();
  return {
    calls, values: overlay.values,
    width: overlay.width, height: overlay.height,
  };
}

test("solo race owner fields and initialization match release", () => {
  assert.deepEqual(raceState(true), raceState(false));
});

test("result overlay cache, render and cleanup match release", () => {
  assert.deepEqual(resultOverlay(true), resultOverlay(false));
});
