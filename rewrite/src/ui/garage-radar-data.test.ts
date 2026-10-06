import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  loadGarageRadarParameters, parseGarageRadarInput, parseGarageRadarWeights,
  type GarageRadarXmlNode,
} from "./garage-radar-data";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name: string, bindings: string[], values: unknown[]): Function {
  const declaration = declarations.find(node => node.type === "FunctionDeclaration" &&
    node.id?.name === name);
  assert.ok(declaration && declaration.type === "FunctionDeclaration");
  return new Function(...bindings,
    `return (${release.slice(declaration.start!, declaration.end!)});`)(...values) as Function;
}
function releaseConstant(name: string): unknown {
  const declaration = declarations.filter(node => node.type === "VariableDeclaration")
    .flatMap(node => node.declarations)
    .find(node => node.id.type === "Identifier" && node.id.name === name);
  assert.ok(declaration?.init);
  return new Function(`return (${release.slice(declaration.init.start!,
    declaration.init.end!)});`)();
}

interface TestNode extends GarageRadarXmlNode {
  attributes: Record<string, string>;
  children: TestNode[];
}
const node = (name: string, attributes: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, attributes, children });
const attribute = (source: GarageRadarXmlNode, name: string): string | undefined =>
  (source as TestNode).attributes[name];
const fields = releaseConstant("et") as Record<string, string>;
const descriptors = releaseConstant("aa") as string[];
const sentinels = releaseConstant("ra") as Set<string>;
const finite = original("ee", ["H"], [Math.fround]);
const required = original("ye", ["L", "ee"], [attribute, finite]);
const releasedInput = original("oa", ["et", "ra", "aa", "ye"],
  [fields, sentinels, descriptors, required]) as (node: GarageRadarXmlNode) =>
    ReturnType<typeof parseGarageRadarInput>;
const releasedWeights = original("ca", ["et", "L", "ye"],
  [fields, attribute, required]) as (node: GarageRadarXmlNode) =>
    ReturnType<typeof parseGarageRadarWeights>;

const body = (overrides: Record<string, string> = {}): TestNode => node("Body", {
  DragFactor: "43.2", ForwardAccelForce: "37", TransAccelFactor: "-100000",
  TeamBoosterTime: "29", NormalBoosterTime: "-100000",
  StartBoosterTime: "17.5", DriftMaxGauge: "-100000",
  DriftEscapeForce: "-100000", CornerDrawFactor: "12.7",
  DescEngineGrade: "4", DescCornering: "2.5", ...overrides,
});
const weightRoot = (overrides: Record<string, string> = {}): TestNode =>
  node("weightConst", {}, Object.keys(fields).map(name => node("weight", {
    name, enchantVariable: "2", generalWeight: "1.5",
    enchantWeight: "0.75", publicCutDown: "3", ...overrides,
  })));

test("vehicle radar XML defaults, sentinel values and invalid numbers match release oa", () => {
  const cases = [body(), body({ StartBoosterTimeSpeed: "2.3", DescBalance: "30" }),
    body({ DragFactor: "" }), body({ DescEngineGrade: "Infinity" }),
    node("Body")];
  for (const [index, input] of cases.entries()) {
    const run = (released: boolean) => {
      try { return { value: released ? releasedInput(input) :
        parseGarageRadarInput(input, attribute) }; }
      catch (cause) { return { error: String(cause) }; }
    };
    assert.deepEqual(run(false), run(true), `input case ${index}`);
  }
});

test("radar weight XML completeness and float validation match release ca", () => {
  const duplicated = weightRoot();
  duplicated.children.push(duplicated.children[0]!);
  const missing = weightRoot();
  missing.children.pop();
  const cases = [weightRoot(), duplicated, missing, node("other"),
    weightRoot({ enchantVariable: "0" }),
    weightRoot({ generalWeight: "NaN" })];
  for (const [index, root] of cases.entries()) {
    const run = (released: boolean) => {
      try { return { value: released ? releasedWeights(root) :
        parseGarageRadarWeights(root, attribute) }; }
      catch (cause) { return { error: String(cause) }; }
    };
    assert.deepEqual(run(false), run(true), `weight case ${index}`);
  }
});

type LoadVariant = "normal" | "missing-weight" | "bad-weight";
async function loadRun(released: boolean, variant: LoadVariant): Promise<unknown> {
  const events: unknown[] = [];
  let resourceAvailable = variant !== "missing-weight";
  let root = variant === "bad-weight" ? node("wrong") : weightRoot();
  const library = {
    exactCanonicalCandidates(path: string) {
      events.push(["resource", path]);
      return resourceAvailable ? [{ async bytes() {
        events.push("weight-bytes");
        return root as unknown as Uint8Array;
      } }] : [];
    },
  };
  const loadVehicle = async (_library: unknown, path: string) => {
    events.push(["vehicle", path]);
    return { value: { body: body() } };
  };
  const parseXml = (bytes: Uint8Array) => {
    events.push("parse-weight");
    return { root: bytes as unknown as GarageRadarXmlNode };
  };
  const legacy = original("da", ["Xt", "lt", "ps", "ca", "Z", "oa"],
    [new WeakMap(), new WeakMap(), loadVehicle, releasedWeights,
      parseXml, releasedInput]) as (library: unknown, path: string) =>
      Promise<{ input: Record<string, number>; weights: unknown }>;
  const load = (path: string) => released ? legacy(library, path) :
    loadGarageRadarParameters(library, path, {
      attribute, parseXml, loadVehicleParameters: loadVehicle,
    });
  const first = load("kart-a");
  const second = load("kart-a");
  const samePending = first === second;
  const settled = await Promise.allSettled([first, second]);
  resourceAvailable = true;
  root = weightRoot();
  const retry = await Promise.allSettled([load("kart-a"), load("kart-b")]);
  return { samePending,
    settled: settled.map(item => item.status === "fulfilled" ? item.value :
      String(item.reason)),
    retry: retry.map(item => item.status === "fulfilled" ? item.value :
      String(item.reason)), events };
}

test("radar parameter cache, shared weights and failed-load retry match release da", async () => {
  for (const variant of ["normal", "missing-weight", "bad-weight"] as const)
    assert.deepEqual(await loadRun(false, variant), await loadRun(true, variant), variant);
});
