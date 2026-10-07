import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { XGenTachometerPresentation } from "../src/vehicle/xgen-tachometer-presentation.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = declarations.find(item =>
    (item.type === "ClassDeclaration" || item.type === "FunctionDeclaration") && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
function originalConst(name) {
  const node = declarations.find(item => item.type === "VariableDeclaration" &&
    item.declarations.some(decl => decl.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const source = ["Ag", "Nk", "zk"].map(original).join("\n") + "\n" +
  originalConst("Sn0") + "\n" + original("Cn0");
const Original = new Function("deps", `with (deps) { ${source}; return Cn0; }`);

function panel(name, visible = true, children = []) {
  return { attrs: { name, visible: String(visible) }, children };
}
function fixture(options = {}) {
  const log = [];
  const names = ["xgen_bg1", "xgen_bg2", "xgen_bg3", "dualBoostManualAlarm",
    "BoostAlarmPanel1", "BoostAlarmPanel2", "dualBoostReady", "dualboostUse",
    "kmh", "kmh2", "blinkRoad1", "blinkRoad2", "blinkRoad3"];
  const root = panel("root", true, names.map(name => panel(name,
    name === "xgen_bg1" || name === "BoostAlarmPanel1")));
  const definition = {
    type: options.type ?? "XGenTacho", root,
    xGenGauges: options.noBindings ? undefined : {
      alarmBlinkTimeMs: 80,
      individual: { id: "indi", gaugeInitiallyVisible: false,
        fullFrame: { initiallyVisible: false } },
      team: { id: "team", gaugeInitiallyVisible: false,
        fullFrame: { initiallyVisible: false } },
    },
  };
  const deps = {
    T(node, key) { log.push(["attribute", node.attrs?.name, key]); return node.attrs?.[key]; },
    jh(binding) {
      log.push(["initial gauge", binding.id]);
      return { active: false, target: 0,
        gaugeVisible: binding.gaugeInitiallyVisible,
        fullFrameVisible: binding.fullFrame.initiallyVisible };
    },
    Ei(binding, state, ratio) {
      log.push(["set target", binding.id, state.active, ratio]);
      return { ...state, target: ratio, gaugeVisible: ratio > 0 };
    },
    oC(binding, state) {
      log.push(["begin drain", binding.id, state.target]);
      return { ...state, active: true, fullFrameVisible: true };
    },
    aC(binding, state, now) {
      log.push(["advance", binding.id, state.active, now]);
      return { ...state, active: now < 700, fullFrameVisible: now < 700 };
    },
    XR(now) { log.push(["pulse alpha", now]); return now % 255; },
  };
  const ops = {
    attribute: deps.T, initialGauge: deps.jh, setGaugeTarget: deps.Ei,
    beginGaugeDrain: deps.oC, advanceGauge: deps.aC, pulseAlpha: deps.XR,
  };
  return { definition, deps, ops, log };
}
function frame(overrides = {}) {
  return {
    frameTickMs: 100, sourceTickMs: 20, stateCode: 1,
    speed: { displaySpeed: 20, layerThreshold: 100 },
    gauges: { mainRatio: 0.2, teamBooster: false, teamRatio: 0 },
    dualBoosterState: 0, dualBoosterMode: 0, draftOn: false,
    teamSettledAtMs: 0,
    ...overrides,
  };
}
function normalize(value) {
  if (value instanceof Map) return [...value];
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value.map(normalize);
  if (value === undefined) return "[undefined]";
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}
function snapshot(owner) {
  return normalize({
    bindings: owner.bindings, names: owner.names, visible: owner.visible,
    individual: owner.individual, team: owner.team,
    teamSettledAtPrev: owner.teamSettledAtPrev, road: owner.road,
    backgroundActiveAtMs: owner.backgroundActiveAtMs,
    backgroundReleaseAtMs: owner.backgroundReleaseAtMs,
    barPulseDeadlineMs: owner.barPulseDeadlineMs,
    barPulsePending: owner.barPulsePending,
    manualBoostAlarm: owner.manualBoostAlarm,
    alarmBlinkAtMs: owner.alarmBlinkAtMs,
  });
}
function run(kind, options = {}, frames = []) {
  const f = fixture(options);
  const Legacy = Original(f.deps);
  try {
    const owner = kind === "original" ? new Legacy(f.definition)
      : new XGenTachometerPresentation(f.definition, f.ops);
    const states = [snapshot(owner)];
    owner.startMainGaugeDrain(); states.push(snapshot(owner));
    owner.setManualBoostAlarm(true); states.push(snapshot(owner));
    const outputs = [];
    for (const item of frames) {
      outputs.push(normalize(owner.update(item)));
      states.push(snapshot(owner));
    }
    return { states, outputs, log: f.log };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("XGen background, dual booster, alarm, road blink, and gauge state match release", () => {
  const frames = [
    frame(),
    frame({ frameTickMs: 200, sourceTickMs: 120,
      speed: { displaySpeed: 160, layerThreshold: 100 },
      dualBoosterState: 7, dualBoosterMode: 1,
      gauges: { mainRatio: 0.6, teamBooster: true, teamRatio: 0.5 } }),
    frame({ frameTickMs: 310, sourceTickMs: 230, stateCode: 10,
      speed: { displaySpeed: 190, layerThreshold: 100 },
      dualBoosterState: 8, dualBoosterMode: 1,
      gauges: { mainRatio: 1, teamBooster: true, teamRatio: 1 },
      teamSettledAtMs: 300, draftOn: true }),
    frame({ frameTickMs: 480, sourceTickMs: 400,
      speed: { displaySpeed: 30, layerThreshold: 100 },
      gauges: { mainRatio: 0.8, teamBooster: false, teamRatio: 0 },
      teamSettledAtMs: 300 }),
    frame({ frameTickMs: 1000, sourceTickMs: 920,
      speed: { displaySpeed: 0, layerThreshold: 100 },
      gauges: { mainRatio: 0.1, teamBooster: false, teamRatio: 0 } }),
  ];
  assert.deepEqual(run("rewritten", {}, frames), run("original", {}, frames));
});

test("XGen presentation constructor and speed validation match release", () => {
  for (const options of [{ type: "V1GenTacho" }, { noBindings: true }])
    assert.deepEqual(run("rewritten", options), run("original", options));
  const invalidFrames = [frame({ speed: { displaySpeed: NaN, layerThreshold: 100 } })];
  assert.deepEqual(run("rewritten", {}, invalidFrames), run("original", {}, invalidFrames));
});
