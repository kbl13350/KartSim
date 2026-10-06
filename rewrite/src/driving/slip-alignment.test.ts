import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applySlipSurfaceAlignment, type SlipAlignmentContext } from "./slip-alignment";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  applySlipAlignment(", classStart);
const end = release.indexOf("  integrateStandardOrientation(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function VG("), release.indexOf("function Ri(")),
  release.slice(release.indexOf("function c9("), release.indexOf("function bt(")),
  release.slice(release.indexOf("function t1("), release.indexOf("function dd(")),
  release.slice(release.indexOf("function V9("), release.indexOf("function ri0(")),
  release.slice(release.indexOf("function fd("), release.indexOf("function Tn(")),
  release.slice(release.indexOf("function Mt("), release.indexOf("function _n(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
const OriginalSlip = new Function("m", `${helpers}\nreturn class OriginalSlip { ${method} };`)(
  Math.fround,
) as new () => { applySlipAlignment(this: SlipAlignmentContext): void };
const original = new OriginalSlip();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
function scenario(): SlipAlignmentContext {
  return {
    runtime: { forwardOneShot: true, driftLifecycleB44: 1 },
    wheels: {
      roadDescriptor: { road: { attributes: [{ name: "surface", value: "slip" }] } },
      averageNormal: vector(0.15, 0.98, 0.25),
    },
    body: { right: vector(0.8, 0.3, -0.1), linearVelocity: vector(7.31, -0.2, 4.17) },
    scratch: { v0: vector() },
  };
}

function compare(label: string, edit: (state: SlipAlignmentContext) => void = () => {}): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  original.applySlipAlignment.call(expected);
  applySlipSurfaceAlignment(actual);
  assert.deepEqual(actual, expected, label);
}

test("slip alignment matches the released vehicle method", () => {
  compare("slip with tilted normal");
  compare("flat normal", state => { state.wheels.averageNormal = vector(0, 1, 0); });
  compare("zero velocity", state => { state.body.linearVelocity = vector(); });
  compare("no road", state => { state.wheels.roadDescriptor = undefined; });
  compare("ordinary road", state => {
    state.wheels.roadDescriptor = { road: { attributes: [{ name: "surface", value: "normal" }] } };
  });
  compare("no drift", state => { state.runtime.driftLifecycleB44 = 0; });
  compare("one-shot flag off", state => { state.runtime.forwardOneShot = false; });
});
