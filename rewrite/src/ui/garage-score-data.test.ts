import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  parseGaragePartGradeGrid, parseGarageSkillScoreTable,
  type GarageScoreXmlNode,
} from "./garage-score-data";

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

interface TestNode extends GarageScoreXmlNode {
  attributes: Record<string, string>;
  children: TestNode[];
}
const node = (name: string, attributes: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, attributes, children });
const attribute = (source: GarageScoreXmlNode, name: string): string | undefined =>
  (source as TestNode).attributes[name];

const skillFields = releaseConstant("Ct") as Record<string, string>;
const zero = releaseConstant("Pt") as () => Record<string, number>;
const skillInteger = original("is", [], []);
const releasedSkills = original("tn", ["L", "is", "Ct", "Pt"],
  [attribute, skillInteger, skillFields, zero]) as (
  tuning: GarageScoreXmlNode, abilities: GarageScoreXmlNode) => unknown;

function skillXml(): [TestNode, TestNode] {
  const skillRows: TestNode[] = [];
  const groups: TestNode[] = [];
  for (let skill = 1; skill <= 9; skill++) {
    skillRows.push(node("Skill", { idx: String(skill), tuneGroupId: String(skill + 100) }));
    const tunes: TestNode[] = [];
    for (let level = 1; level <= 5; level++) {
      const value = node("UiValue", {
        transAccelFactor: String(skill * level), driftEscapeForce: String(level),
        normalBoosterTime: "-2", driftMaxGauge: "3",
      });
      tunes.push(node("Tune", { id: String(level) },
        [node("EnchanterAddSpec", {}, [value])]));
    }
    groups.push(node("TuneGroup", { id: String(skill + 100) }, tunes));
  }
  return [node("kart12TuningData", {},
    [node("tuningSkillSet", {}, skillRows)]), node("TuneAbilityList", {}, groups)];
}

test("nine XUN skill score groups and invalid rows match release tn", () => {
  const cases: Array<[TestNode, TestNode]> = [skillXml()];
  {
    const value = skillXml();
    value[0].children[0]!.children.pop();
    cases.push(value);
  }
  {
    const value = skillXml();
    value[1].children[0]!.children[0]!.children[0]!.name = "UnknownEffect";
    cases.push(value);
  }
  {
    const value = skillXml();
    value[1].children[0]!.children[0]!.children[0]!.children.push(node("UiValue"));
    cases.push(value);
  }
  {
    const value = skillXml();
    value[1].children[0]!.children[0]!.children[0]!.children[0]!
      .attributes.transAccelFactor = "Infinity";
    cases.push(value);
  }
  cases.push([node("wrong"), node("TuneAbilityList")]);
  for (const [index, [tuning, abilities]] of cases.entries()) {
    const run = (released: boolean) => {
      try { return { value: released ? releasedSkills(tuning, abilities) :
        parseGarageSkillScoreTable(tuning, abilities, attribute) }; }
      catch (cause) { return { error: String(cause) }; }
    };
    assert.deepEqual(run(false), run(true), `skill case ${index}`);
  }
});

const scoreFields = releaseConstant("Se") as string[];
const finite = original("xe", ["U"], [Math.fround]);
const scoreNumber = original("re", ["xe"], [finite]);
const releasedGrid = original("ln", ["L", "re", "Se"],
  [attribute, scoreNumber, scoreFields]) as (root: GarageScoreXmlNode) => unknown;

function gradeXml(): TestNode {
  const sections = scoreFields.slice(0, 4).map(field => node("section", { param: field },
    ["normal", "rare", "legend", "unique"].map((quality, index) =>
      node(quality, { min: String(100 + index * 100),
        max: String(190 + index * 100), unit: "10" }))));
  return node("root", {}, [node("gradeSection", {},
    [node("grade", { engineGrade: "7" }, sections)])]);
}

test("part score grade ranges and validation match release ln", () => {
  const cases = [gradeXml(), node("root")];
  {
    const value = gradeXml();
    value.children[0]!.children.push(value.children[0]!.children[0]!);
    cases.push(value);
  }
  {
    const value = gradeXml();
    value.children[0]!.children[0]!.children[0]!.children[0]!.attributes.max = "195";
    cases.push(value);
  }
  {
    const value = gradeXml();
    value.children[0]!.children[0]!.children[0]!.children.pop();
    cases.push(value);
  }
  {
    const value = gradeXml();
    value.children[0]!.children[0]!.attributes.engineGrade = "NaN";
    cases.push(value);
  }
  for (const [index, root] of cases.entries()) {
    const run = (released: boolean) => {
      try { return { value: released ? releasedGrid(root) :
        parseGaragePartGradeGrid(root, attribute) }; }
      catch (cause) { return { error: String(cause) }; }
    };
    assert.deepEqual(run(false), run(true), `grade case ${index}`);
  }
});
