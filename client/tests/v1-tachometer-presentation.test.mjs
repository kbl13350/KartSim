import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  V1TachometerPresentation, tachometerSpeedLayer, advanceRoadBlink,
  collisionPresentation, initialFeatureVisibility, exceedPresentation, checkedGaugeRatio,
} from "../src/vehicle/v1-tachometer-presentation.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = declarations.find(item =>
    (item.type === "FunctionDeclaration" || item.type === "ClassDeclaration") && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
function originalConst(name) {
  const node = declarations.find(item => item.type === "VariableDeclaration" &&
    item.declarations.some(decl => decl.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const source = ["cn0", "ln0", "q8", "Ag", "Nk", "un0", "hn0", "dn0", "pn0", "K8", "Ok"]
  .map(original).join("\n") + "\n" + ["AC", "j1"].map(originalConst).join("\n") + "\n" + original("gn0");
const Original = new Function("deps", `with (deps) { ${source}; return { gn0, Ag, Nk, ln0, un0, dn0, K8 }; }`);

function panel(name, visible = true, children = []) {
  return { attrs: { name, visible: String(visible) }, children };
}
function fixture(type, options = {}) {
  const log = [];
  const names = ["kmh", "kmh2", "kmh3", "bg_engineIcon1", "bg_engineIcon2",
    "xungen_bg1", "xungen_bg2", "v1gen_bg1", "v1gen_bg2", "v1gen_bg1_alt",
    "v1gen_bg2_alt", "n2o_always", "draft", "incGauge", "blinkRoad1",
    "blinkRoad2", "blinkRoad3", "infinite", "teamBoost", "boostGauegeBg_Team",
    "teamBoostGauge", "teamBoostFullFrame", "indiBoostFullFrame", "boostGauegeBg_Indi",
    "charger_bg", "charger", "charger2", "incCharger_none"];
  const root = panel("root", true, names.map(name => panel(name)));
  const definition = {
    type, root,
    play1SPanels: ["playWarnBg", "playCrashBg", "playCrashBg_Inside", "playFull", "playUsing"]
      .map(name => ({ name, node: panel(name) })),
    blinkButtons: [{ name: "resetting", node: panel("resetting") }],
    featureBindings: {
      boostFeatures: options.boostFeatures ?? true,
      collisionFeatures: options.collisionFeatures ?? true,
      exceedFeatures: options.exceedFeatures ?? true,
    },
  };
  const deps = {
    T(node, name) { log.push(["attribute", node.attrs?.name, name]); return node.attrs?.[name]; },
    Jp() { log.push(["make pulse"]); return { count: 0 }; },
    TJ(seed) { log.push(["make charger", seed]); return { count: 0, ratio: 0, active: false }; },
    _J(state, tick, wall, charger, bindings) {
      log.push(["charger", state.count, tick, wall, charger.count, bindings]);
      return { state: { count: charger.count, ratio: charger.count / charger.capacity,
        active: charger.active }, commands: charger.count > state.count
          ? [{ kind: "play", name: "chargerPulse", durationMs: 150, sourceTickMs: tick }]
          : [{ kind: "show", name: "charger" }] };
    },
    GJ(previous, commands) {
      log.push(["charger visibility", previous, commands]);
      return { ...previous, charger: commands.some(command => command.kind === "play") };
    },
    jR(state, tick, main, instant, type) {
      log.push(["pulse", state.count, tick, main, instant, type]);
      return { state: { count: state.count + 1 }, alpha: main > instant ? 0.5 : 1 };
    },
    F50(binding, state, tick, visible) {
      log.push(["blink", binding.name, state?.visible ?? null, tick, visible]);
      return { visible, button: { frame: tick % 3 } };
    },
    vg(elapsed) { log.push(["alpha", elapsed]); return 1 - elapsed / 1000; },
  };
  const ops = {
    attribute: deps.T, makeGaugePulse: deps.Jp, makeCharger: deps.TJ,
    updateCharger: deps._J, chargerVisibility: deps.GJ,
    updateGaugePulse: deps.jR, updateResettingBlink: deps.F50, frameAlpha: deps.vg,
  };
  return { definition, deps, ops, log };
}

function frame(overrides = {}) {
  return {
    frameTickMs: 100, wallClockMs: 200, sourceTickMs: 50, stateCode: 1,
    speed: { displaySpeed: 80, layerThreshold: 100 },
    gauges: { mainRatio: 0.5, instantRatio: 0.2, teamBooster: false, teamRatio: 0,
      wallCompensationRatio: 0, wallCompensationEventId: 0, instantInterpolationMs: 300 },
    collision: { crash: false, charging: false, timerEnabled: false,
      collisionAnchorMs: 0, refillAnchorMs: 0, cooldownMs: 800 },
    exceed: { active: false, usable: false, full: false, usableThresholdRatio: 0.7 },
    charger: { count: 0, capacity: 3, active: false },
    draftOn: false, boosterUnlimited: false, teamSettledAtMs: 0,
    ...overrides,
  };
}

function normalize(value) {
  if (value instanceof Map) return [...value].map(([key, item]) => [key?.attrs?.name ?? key, normalize(item)]);
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value.map(normalize);
  if (value === undefined) return "[undefined]";
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}
function snapshot(owner) {
  const fields = ["road", "collision", "exceed", "charger", "gaugePulse", "chargerVisibility",
    "mainFullActive", "mainFullAnchorMs", "instantGaugeInitialized", "instantGaugeDisplayed",
    "instantGaugeAnchor", "instantGaugeTarget", "instantGaugeElapsedMs", "instantGaugeAnimating",
    "instantGaugeLastMs", "instantGaugeWallObserved", "instantGaugeWallEventObserved",
    "resetting", "names", "visible", "play1SPanelNames", "featureVisibility",
    "hasBlinkRoadLayers", "chargerBindings", "collisionSource", "exceedSource",
    "emptyBlinkButtons", "resettingBlinkButtons"];
  return Object.fromEntries(fields.map(name => [name, normalize(owner[name])]));
}

function runPresentation(kind, type = "XunGenTacho", options = {}, makeFrames = () => []) {
  const f = fixture(type, options);
  const legacy = Original(f.deps);
  try {
    const owner = kind === "original" ? new legacy.gn0(f.definition, "seed")
      : new V1TachometerPresentation(f.definition, "seed", f.ops);
    const states = [snapshot(owner)];
    const results = [];
    owner.startMainGaugeDrain(); states.push(snapshot(owner));
    for (const item of makeFrames()) {
      results.push(normalize(owner.update(item)));
      states.push(snapshot(owner));
    }
    return { states, results, log: f.log };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("V1 and Xun tachometer presentation matches release across business state transitions", () => {
  const frames = () => [
    frame(),
    frame({ frameTickMs: 250, wallClockMs: 350, stateCode: 3,
      speed: { displaySpeed: 185, layerThreshold: 100 },
      gauges: { mainRatio: 1, instantRatio: 0.6, teamBooster: true, teamRatio: 1,
        wallCompensationRatio: 0.1, wallCompensationEventId: 1, instantInterpolationMs: 300 },
      collision: { crash: true, charging: true, timerEnabled: true,
        collisionAnchorMs: 250, refillAnchorMs: 250, cooldownMs: 800 },
      exceed: { active: false, usable: true, full: false, usableThresholdRatio: 0.5 },
      charger: { count: 1, capacity: 3, active: false }, teamSettledAtMs: 200 }),
    frame({ frameTickMs: 520, wallClockMs: 620, stateCode: 10,
      speed: { displaySpeed: 320, layerThreshold: 100 },
      gauges: { mainRatio: 1, instantRatio: 1, teamBooster: true, teamRatio: 1,
        wallCompensationRatio: 0.5, wallCompensationEventId: 2, instantInterpolationMs: 300 },
      collision: { crash: true, charging: false, timerEnabled: true,
        collisionAnchorMs: 250, refillAnchorMs: 250, cooldownMs: 800 },
      exceed: { active: true, usable: true, full: true, usableThresholdRatio: 0.5 },
      charger: { count: 2, capacity: 3, active: true }, boosterUnlimited: true,
      teamSettledAtMs: 200, draftOn: true }),
    frame({ frameTickMs: 1300, wallClockMs: 1400,
      speed: { displaySpeed: 0, layerThreshold: 100 },
      gauges: { mainRatio: 0.3, instantRatio: 0.1, teamBooster: false, teamRatio: 0,
        wallCompensationRatio: 0.1, wallCompensationEventId: 3, instantInterpolationMs: 0 },
      charger: { count: 0, capacity: 3, active: false } }),
  ];
  for (const type of ["V1GenTacho", "XunGenTacho"])
    for (const options of [{}, { boostFeatures: false },
      { collisionFeatures: false, exceedFeatures: false }])
      assert.deepEqual(runPresentation("rewritten", type, options, frames),
        runPresentation("original", type, options, frames), `${type} ${JSON.stringify(options)}`);
});

test("presentation validation and float32 helper branches match release", () => {
  for (const type of ["Classic", "V1GenTacho"])
    assert.deepEqual(runPresentation("rewritten", type, {}, () => [
      frame({ speed: { displaySpeed: NaN, layerThreshold: 100 } }),
    ]), runPresentation("original", type, {}, () => [
      frame({ speed: { displaySpeed: NaN, layerThreshold: 100 } }),
    ]));
  const f = fixture("V1GenTacho");
  const legacy = Original(f.deps);
  for (const [speed, threshold] of [[0, 100], [300, 80], [-1, 80], [100, NaN]]) {
    const args = ["XunGenTacho", speed, threshold];
    const left = () => tachometerSpeedLayer(...args);
    const right = () => legacy.Ag(...args);
    try { assert.deepEqual(left(), right()); }
    catch (error) { assert.equal(assert.throws(left)?.message, assert.throws(right)?.message); }
  }
  for (const [state, now, speed] of [
    [{ anchorMs: 0 }, 100, 0], [{ anchorMs: 100, visibleLayer: "blinkRoad1" }, 1200, 180],
    [{ anchorMs: -1 }, 100, 2],
  ]) {
    try { assert.deepEqual(advanceRoadBlink(state, now, speed), legacy.Nk(state, now, speed)); }
    catch { assert.equal(assert.throws(() => advanceRoadBlink(state, now, speed))?.message,
      assert.throws(() => legacy.Nk(state, now, speed))?.message); }
  }
  assert.deepEqual(initialFeatureVisibility({ boostFeatures: false, hasAltBackgroundPair: true }),
    legacy.un0({ boostFeatures: false, hasAltBackgroundPair: true }));
  assert.deepEqual(collisionPresentation({ refillDeadlineMs: 0, collisionDeadlineMs: 0, cooldownDeadlineMs: 0 },
    200, { crash: true, charging: true, timerEnabled: true, collisionAnchorMs: 200,
      refillAnchorMs: 200, cooldownMs: 800, playWarnBgVisible: false,
      playCrashBgVisible: false, playCrashBgInsideVisible: false }),
  legacy.ln0({ refillDeadlineMs: 0, collisionDeadlineMs: 0, cooldownDeadlineMs: 0 },
    200, { crash: true, charging: true, timerEnabled: true, collisionAnchorMs: 200,
      refillAnchorMs: 200, cooldownMs: 800, playWarnBgVisible: false,
      playCrashBgVisible: false, playCrashBgInsideVisible: false }));
  assert.deepEqual(exceedPresentation("V1GenTacho", { active: false, usable: false,
    mode: 0, fullSessionActive: false }, { active: true, usable: true,
    displayFull: true, full: true, physicalUsable: true }),
  legacy.dn0("V1GenTacho", { active: false, usable: false,
    mode: 0, fullSessionActive: false }, { active: true, usable: true,
    displayFull: true, full: true, physicalUsable: true }));
  for (const ratio of [-1, 0.42, 1.2, NaN]) {
    try { assert.equal(checkedGaugeRatio(ratio), legacy.K8(ratio)); }
    catch { assert.equal(assert.throws(() => checkedGaugeRatio(ratio))?.message,
      assert.throws(() => legacy.K8(ratio))?.message); }
  }
});
