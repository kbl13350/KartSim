import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garageExceedChoice, garageFiniteScore, garageRadarAttribute,
  garageRadarBaseline, garageRadarFinite, garageScoreNumber,
  garageSkillScoreInteger } from "./garage-native-values";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["ee", "ye", "ha", "ua", "is", "xe", "re"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

function run(released: boolean): unknown {
  const events: unknown[] = [];
  const convertRadar = (value: number) => Math.fround(value);
  const convertScore = (value: number) => Math.fround(value);
  const attribute = (source: Record<string, string>, name: string) =>
    source[name];
  const normalize = (configuration: Record<string, unknown>,
    stage: unknown, version: number) => {
    events.push(["normalize", configuration, stage, version]);
    return { ...configuration, normalized: true };
  };
  const calculate = (configuration: unknown, weights: unknown) => {
    events.push(["calculate", configuration, weights]);
    return { speed: 9, bonus: 3 };
  };
  const choices = ["speed", "drift", "boost"];
  const original = new Function("H", "U", "L", "Ks", "Us", "Ye",
    `${originalSource}\nreturn {ee,ye,ha,ua,is,xe,re};`)(
    convertRadar, convertScore, attribute, normalize, calculate,
    choices) as {
      ee(value: number): unknown;
      ye(source: Record<string, string>, name: string,
        fallback?: number): unknown;
      ha(values: Record<string, unknown>, defaults: Record<string, unknown>,
        weights: unknown, stage: unknown): unknown;
      ua(value: string, random?: () => number): unknown;
      is(text: string | undefined): unknown;
      xe(value: number): unknown;
      re(text: string): unknown;
    };
  const capture = (callback: () => unknown) => {
    try { return { value: callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  const radar = [0, 1.2, Infinity, NaN].map(value =>
    capture(() => released ? original.ee(value) :
      garageRadarFinite(value, convertRadar)));
  const attributes = [
    [{ speed: "5.25" }, "speed", undefined],
    [{}, "speed", 7], [{}, "speed", undefined],
    [{ speed: " " }, "speed", 3], [{ speed: "bad" }, "speed", 3],
  ] as Array<[Record<string, string>, string, number | undefined]>;
  const parsedAttributes = attributes.map(([source, name, fallback]) =>
    capture(() => released ? original.ye(source, name, fallback) :
      garageRadarAttribute(source, name, fallback, attribute, convertRadar)));
  const base = released ? original.ha({ speed: 5 }, { speed: 2,
    defaultExceedType: 7 }, "weights", "stage") :
    garageRadarBaseline({ speed: 5 }, { speed: 2,
      defaultExceedType: 7 }, "weights", "stage", { normalize, calculate });
  const randomChoices = [-2, 0, 0.49, 0.99, 2].map(value =>
    released ? original.ua("random", () => value) :
      garageExceedChoice("random", choices, () => value));
  const directChoice = released ? original.ua("fixed") :
    garageExceedChoice("fixed", choices);
  const skillIntegers = [undefined, "", "3", "3.2", "9007199254740992"]
    .map(value => capture(() => released ? original.is(value) :
      garageSkillScoreInteger(value)));
  const finiteScores = [0, 4.5, Infinity, NaN].map(value =>
    capture(() => released ? original.xe(value) :
      garageFiniteScore(value, convertScore)));
  const scoreNumbers = ["3.25", "", " ", "bad", "100000"]
    .map(value => capture(() => released ? original.re(value) :
      garageScoreNumber(value, convertScore)));
  return { radar, parsedAttributes, base, randomChoices, directChoice,
    skillIntegers, finiteScores, scoreNumbers, events };
}

test("Garage radar, skill and score scalars match release", () => {
  assert.deepEqual(run(false), run(true));
});
