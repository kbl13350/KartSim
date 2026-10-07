import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { applyGarageFactoryScores, garageScoreGrade, garageScoreTrend,
  loadGarageFactoryScores, loadGarageSkillScores, normalizeGarageBodyScore,
  type GarageScoreApplicationDependencies, type GarageScoreLibrary,
  type GarageFactoryDraft } from "./garage-score-application";
import type { GarageScoreXmlNode } from "./garage-score-data";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["an", "rn", "as", "on", "dn", "wn"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");
const node = (name: string, properties: Record<string, string> = {}):
  GarageScoreXmlNode & { attributes: Array<{ name: string; value: string }> } => ({
    name, children: [], attributes: Object.entries(properties)
      .map(([key, value]) => ({ name: key, value })),
  });
const attribute = (source: GarageScoreXmlNode, name: string): string | undefined =>
  (source as ReturnType<typeof node>).attributes.find(entry =>
    entry.name === name)?.value;
type Variant = "normal" | "missing-tuning" | "missing-enchant" |
  "duplicate-enchant";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const tuningPath = "zeta_/cn/engine/kart12TuningData.xml";
  const enchantPath = "zeta_/cn/enchant/enchant.xml";
  const resources = new Map<string, GarageScoreXmlNode>([
    [tuningPath, node("tuning")], [enchantPath, node("enchant")],
  ]);
  if (variant === "missing-tuning") resources.delete(tuningPath);
  if (variant === "missing-enchant") resources.delete(enchantPath);
  const library: GarageScoreLibrary = {
    exactCanonicalCandidates(path) {
      events.push(["find", path]);
      const resource = resources.get(path);
      if (!resource) return [];
      const entry = { async bytes() {
        events.push(["read", path]);
        return resource as unknown as Uint8Array;
      } };
      return variant === "duplicate-enchant" && path === enchantPath ?
        [entry, entry] : [entry];
    },
  };
  const dependencies: GarageScoreApplicationDependencies = {
    parseXml: bytes => ({ root: bytes as unknown as GarageScoreXmlNode }),
    attribute, parseNumber: Number,
    fields: ["speed", "boost"],
    abilityFields: { speed: "speed", boost: "boost" },
    zeroAbilityScore: () => ({ speed: 0, boost: 0 }),
    validateFactory(factory) {
      events.push(["validate", factory.active, factory.abilities]);
      if (factory.abilities.length > 2) throw new Error("invalid factory");
    },
    parseSkills(tuning, enchant) {
      events.push(["parse-skills", tuning.name, enchant.name]);
      return `${tuning.name}:${enchant.name}`;
    },
    parseFactory(enchant) {
      events.push(["parse-factory", enchant.name]);
      return enchant.name;
    },
  };
  const original = new Function("Z", "tn", "nn", "Tt", "ks", "tt",
    "Se", "L", "re", `${originalSource}\nreturn {an,rn,as,on,dn,wn};`)(
    dependencies.parseXml, dependencies.parseSkills,
    dependencies.parseFactory, dependencies.validateFactory,
    dependencies.zeroAbilityScore, dependencies.abilityFields,
    dependencies.fields, attribute, dependencies.parseNumber) as {
      an(library: GarageScoreLibrary): Promise<unknown>;
      rn(library: GarageScoreLibrary): Promise<unknown>;
      as(base: Record<string, number | undefined>,
        scores: Map<number, Record<string, number>> | undefined,
        factory: GarageFactoryDraft | undefined,
        includeInactive?: boolean): unknown;
      on(body: GarageScoreXmlNode): unknown;
      dn(grid: Map<number, Map<string, Array<{ min: number }>>>,
        grade: number, field: string, score: number): unknown;
      wn(before: number, after: number, base: number): unknown;
    };
  const loadResult = async (callback: () => Promise<unknown>) => {
    try { return { value: await callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  const skills = await loadResult(() => released ? original.an(library) :
    loadGarageSkillScores(library, dependencies));
  const factory = await loadResult(() => released ? original.rn(library) :
    loadGarageFactoryScores(library, dependencies));
  const base = { speed: 10, boost: undefined };
  const scores = new Map([[101, { speed: 1.25, boost: 3 }],
    [102, { speed: 2.5, boost: 4 }]]);
  const outcomes = [
    undefined,
    { active: false, abilities: [101] },
    { active: true, abilities: [101, 102] },
    { active: true, abilities: [999] },
    { active: true, abilities: [101, 102, 101] },
  ].map((config, index) => {
    try {
      const result = released ? original.as(base, scores, config,
        index === 1) : applyGarageFactoryScores(base, scores, config,
          index === 1, dependencies);
      return { result, same: result === base };
    } catch (error) { return { error: String(error) }; }
  });
  const body = node("body", { speed: "14.5", boost: "-100000" });
  const normalized = released ? original.on(body) :
    normalizeGarageBodyScore(body, dependencies);
  const grid = new Map([[2, new Map([["speed", [
    { min: 10 }, { min: 20 }, { min: 30 }, { min: 40 },
  ]]])]]);
  const grades = [0, 10, 21, 35, 40, 41, NaN].map(score =>
    released ? original.dn(grid, 2, "speed", score) :
      garageScoreGrade(grid, 2, "speed", score));
  const trends = [[1, 2, 0], [4, 4, 5], [3, 1, 2]].map(([before, after, total]) =>
    released ? original.wn(before!, after!, total!) :
      garageScoreTrend(before!, after!, total!));
  return { skills, factory, outcomes, normalized, grades, trends, events };
}

test("Garage score XML, Factory deltas, body values and trends match release", async () => {
  for (const variant of ["normal", "missing-tuning", "missing-enchant",
    "duplicate-enchant"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
