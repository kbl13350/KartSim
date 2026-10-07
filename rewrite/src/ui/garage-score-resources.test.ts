import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  loadGarageScoreSource, parseGarageFactoryAbilityScores,
  parseGarageWeightTable, parseGarageXunPartValues,
  type GarageScoreResourceDependencies, type GarageScoreSourceDependencies,
  type GarageScoreResourceLibrary,
} from "./garage-score-resources";
import type { GarageScoreXmlNode } from "./garage-score-data";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["nn", "ns", "gn", "cs"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

const node = (name: string, properties: Record<string, string> = {},
  children: GarageScoreXmlNode[] = []): GarageScoreXmlNode & {
    attributes: Array<{ name: string; value: string }>;
  } => ({ name, children,
    attributes: Object.entries(properties).map(([key, value]) => ({ name: key, value })) });
const attribute = (source: GarageScoreXmlNode, name: string): string | undefined =>
  (source as ReturnType<typeof node>).attributes.find(entry =>
    entry.name === name)?.value;

const normalize = (value: unknown): unknown => value instanceof Map ?
  [...value].map(([key, item]) => [key, normalize(item)]) :
  Array.isArray(value) ? value.map(normalize) :
    value && typeof value === "object" ? Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)])) : value;

type Variant = "normal" | "missing-tune" | "bad-tune-value" |
  "missing-weight" | "zero-denominator" | "duplicate-part" |
  "missing-resource" | "duplicate-resource";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const fields = ["DriftEscapeForce", "TransAccelFactor"];
  const weights = ["weight", "weightKart", "weightParts"].flatMap(kind =>
    fields.map((field, index) => node(kind, {
      name: field, value: index === 0 ? "1,2" : "3", default: "4",
    })));
  if (variant === "missing-weight")
    weights.splice(weights.findIndex(item => item.name === "weightKart" &&
      attribute(item, "name") === "TransAccelFactor"), 1);
  if (variant === "zero-denominator")
    weights.find(item => item.name === "weightKart" &&
      attribute(item, "name") === "DriftEscapeForce")!.attributes
      .find(item => item.name === "value")!.value = "0,2";
  const parts = [node("parts", {
    partsCatId: "100", partsItemId: "5", value: "7",
  })];
  if (variant === "duplicate-part") parts.push(node("parts", {
    partsCatId: "100", partsItemId: "5", value: "8",
  }));
  const root = node("partsConst", {}, [
    node("weightConst", {}, weights),
    node("partsValue", {}, parts),
  ]);
  const ability = node("TuneAbilityList", {}, [
    node("TuneGroup", { id: "1" }, [
      ...variant === "missing-tune" ? [] : [node("Tune", { id: "1" }, [
        node("EnchanterAddSpec", { drift: variant === "bad-tune-value" ?
          "NaN" : "1.25", accel: "2.5" }, [node("UiValue")]),
      ])],
    ]),
  ]);
  const resources = new Map<string, GarageScoreXmlNode>([
    ["zeta_/cn/engine/partsConst.xml", root],
    ["zeta_/cn/parts/partsConst.xml", root],
  ]);
  if (variant === "missing-resource") resources.clear();
  const library: GarageScoreResourceLibrary = {
    exactCanonicalCandidates(path) {
      events.push(["find", path]);
      const value = resources.get(path);
      const entries = value ? [{ async bytes() {
        events.push(["read", path]);
        return value as unknown as Uint8Array;
      } }] : [];
      return variant === "duplicate-resource" ? [...entries, ...entries] : entries;
    },
  };
  const common: GarageScoreResourceDependencies = {
    attribute, scoreFields: fields,
    weightLengths: {
      "x-v1": [2, 1], "xun-body": [2, 1], "xun-parts": [2, 1],
    },
    partScoreFields: new Map([[100, "TransAccelFactor"]]),
    parseNumber: value => Number(value),
    projectPartScore: (_field, value) => value * 2,
    scoreInteger: value => Math.round(value),
    abilityDescriptions: [{ id: 101 }],
    abilityFields: { DriftEscapeForce: "drift",
      TransAccelFactor: "accel" },
    zeroAbilityScore: () => ({ DriftEscapeForce: 0,
      TransAccelFactor: 0 }),
  };
  const cache = new WeakMap<object, Map<string, Promise<unknown>>>();
  const dependencies: GarageScoreSourceDependencies = {
    ...common,
    cache: cache as GarageScoreSourceDependencies["cache"],
    parseXml: bytes => ({ root: bytes as unknown as GarageScoreXmlNode }),
    parseWeights: (source, kind) => parseGarageWeightTable(source, kind, common),
    parseParts: (source, table) => parseGarageXunPartValues(source, table, common),
    parseGradeGrid: () => "grid",
    async loadSkills() { events.push("load-skills"); return "skills"; },
    async loadFactory() { events.push("load-factory"); return "factory"; },
    async loadVehicle(_library, vehicle) {
      events.push(["load-vehicle", vehicle]);
      return { value: { body: "body" } };
    },
    normalizeBody: body => { events.push(["normalize", body]);
      return `normalized:${body}`; },
  };
  const original = new Function(
    "ms", "L", "ks", "tt", "Se", "Lt", "re", "Is", "Nt", "_s",
    "os", "Z", "ps", "ln", "an", "rn", "on",
    `${originalSource}\nreturn { nn, ns, gn, cs };`,
  )(common.abilityDescriptions, common.attribute, common.zeroAbilityScore,
    common.abilityFields, common.scoreFields, common.weightLengths,
    common.parseNumber, common.partScoreFields, common.scoreInteger,
    common.projectPartScore, cache, dependencies.parseXml,
    dependencies.loadVehicle, dependencies.parseGradeGrid,
    dependencies.loadSkills, dependencies.loadFactory,
    dependencies.normalizeBody) as {
      nn(source: GarageScoreXmlNode): unknown;
      ns(source: GarageScoreXmlNode, kind: string): unknown;
      gn(source: GarageScoreXmlNode, table: unknown): unknown;
      cs(library: GarageScoreResourceLibrary, vehicle: unknown,
        kind: string): Promise<unknown>;
    };
  const outcome = (operation: () => unknown): unknown => {
    try { return { value: normalize(operation()) }; }
    catch (error) { return { error: String(error) }; }
  };
  const abilityResult = outcome(() => released ? original.nn(ability) :
    parseGarageFactoryAbilityScores(ability, common));
  const weightResult = outcome(() => released ? original.ns(root, "xun-body") :
    parseGarageWeightTable(root, "xun-body", common));
  const partResult = outcome(() => released ? original.gn(root,
    original.ns(root, "xun-parts")) :
    parseGarageXunPartValues(root,
      parseGarageWeightTable(root, "xun-parts", common), common));
  let source: unknown;
  try {
    const load = () => released ? original.cs(library, "kart", "xun-body") :
      loadGarageScoreSource(library, "kart", "xun-body", dependencies);
    const first = normalize(await load());
    const second = normalize(await load());
    const classic = normalize(released ?
      await original.cs(library, "kart", "x-v1") :
      await loadGarageScoreSource(library, "kart", "x-v1", dependencies));
    source = { first, second, classic };
  } catch (error) { source = { error: String(error) }; }
  return { abilityResult, weightResult, partResult, source, events };
}

test("Garage Factory abilities, weights, Xun parts and source cache match release", async () => {
  for (const variant of ["normal", "missing-tune", "bad-tune-value",
    "missing-weight", "zero-denominator", "duplicate-part",
    "missing-resource", "duplicate-resource"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
