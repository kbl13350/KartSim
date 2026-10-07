import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garageAllowsEquipment, garageEngineName, garageGradeName,
  garageKartTypeTexture, garageLayoutForEngineGrade,
  garagePageBackground, garagePartCardBackground, garagePartQuality,
  garagePreviewHitTest, garageProgressionKind,
  garageShowsVehicleInformation, garageText, previewGaragePart,
  type GaragePreviewElement } from "./garage-vehicle-presentation";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["ue", "pe", "Xi", "Ge", "pt", "ft", "Et", "Sn",
  "In", "Nn", "ds", "mt", "Rn"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

function run(released: boolean): unknown {
  const events: unknown[] = [];
  const layouts = { classic: "classic-layout", v1: "v1-layout",
    xun: "xun-layout" };
  const strings = new Map([
    ["partsEngine12", "引擎"], ["engineGrade9", "迅引擎"],
    ["quality1", "稀有"], ["quality2", "优质"],
  ]);
  const qualityKeys = ["unused", "quality1", "quality2", "quality3",
    "quality4"];
  const qualityFallbacks = ["unused", "普通", "优良", "稀有", "独特"];
  const calculate = (_vehicle: unknown, _equipment: unknown,
    configuration: Record<string, unknown>, version: number) => {
    events.push(["calculate", configuration, version]);
    return { configuration, version };
  };
  const family = () => "xun";
  const slotLocked = (_vehicle: unknown, slot: string) => slot === "body";
  const original = new Function("Ki", "Vi", "Hi", "te", "me", "fe",
    "bn", "Cn", `${originalSource}\nreturn {ue,pe,Xi,Ge,pt,ft,Et,Sn,In,Nn,ds,mt,Rn};`)(
      layouts.classic, layouts.v1, layouts.xun,
      calculate, family, slotLocked, qualityKeys, qualityFallbacks) as {
    ue(grade: number | undefined): unknown;
    pe(grade: number | undefined): unknown;
    Xi(vehicle: unknown, equipment: unknown,
      configuration: Record<string, unknown>, part: unknown,
      version?: number): unknown;
    Ge(strings: Map<string, string>, key: string, fallback: string): unknown;
    pt(strings: Map<string, string>, grade: number, fallback: string): unknown;
    ft(grade: number, strings: Map<string, string>): unknown;
    Et(part: unknown): unknown;
    Sn(part: unknown, fallback: string): unknown;
    In(kind: number): unknown;
    Nn(page: string, layout: unknown): unknown;
    ds(page: string, grade: number): unknown;
    mt(locked: boolean, blocked?: boolean): unknown;
    Rn(container: unknown, x: number, y: number,
      elementFromPoint: (x: number, y: number) => GaragePreviewElement | null,
      cards: Map<GaragePreviewElement, string>): unknown;
  };
  const capture = (callback: () => unknown): unknown => {
    try { return { value: callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  const grades = [-1, 0, 6, 7, 8, 9, 10, 2.5, undefined]
    .map(grade => ({ layout: released ? original.ue(grade) :
      garageLayoutForEngineGrade(grade, layouts),
      progression: released ? original.pe(grade) :
        garageProgressionKind(grade) }));
  const configuration = { engine: "old" };
  const parts = [undefined, { family: "xun", slot: "engine" },
    { family: "v1", slot: "engine" },
    { family: "xun", slot: "body" }];
  const preview = parts.map(part => capture(() => released ?
    original.Xi("vehicle", "equipment", configuration, part) :
    previewGaragePart("vehicle", "equipment", configuration,
      part, 7, { calculate, family, slotLocked })));
  const words = {
    plain: released ? original.Ge(strings, "missing", "fallback") :
      garageText(strings, "missing", "fallback"),
    engine: released ? original.pt(strings, 9, "迅引擎") :
      garageEngineName(strings, 9, "迅引擎"),
    quality: [1, 2, 3, 4, 0].map(grade => released ?
      original.ft(grade, strings) : garageGradeName(grade, strings,
        qualityKeys, qualityFallbacks)),
  };
  const qualityParts = [
    { family: "classic", grade: 1 },
    { family: "legacy", grade: 2, legacyRarity: 4 },
    { family: "legacy", grade: 2, legacyRarity: 7 },
  ];
  const qualities = qualityParts.map(part => ({
    quality: released ? original.Et(part) : garagePartQuality(part),
    background: released ? original.Sn(part, "fallback") :
      garagePartCardBackground(part, "fallback"),
  }));
  const pages = ["parts", "level", "factory"].flatMap(page =>
    [8, 9].map(grade => ({
      background: released ? original.Nn(page, {
        backgroundTexture: "texture" }) : garagePageBackground(page,
        { backgroundTexture: "texture" }),
      information: released ? original.ds(page, grade) :
        garageShowsVehicleInformation(page, grade),
    })));
  const kartTypes = [1, 2, 9].map(kind => released ? original.In(kind) :
    garageKartTypeTexture(kind));
  const equipment = [[false, false], [true, false], [false, true]]
    .map(([locked, blocked]) => released ? original.mt(locked!, blocked!) :
      garageAllowsEquipment(locked!, blocked!));
  const card: GaragePreviewElement = { closest(selector) {
    assert.equal(selector, ".garage-part-preview"); return this;
  } };
  const child: GaragePreviewElement = { closest(selector) {
    assert.equal(selector, ".garage-part-preview"); return card;
  } };
  const previewCards = new Map([[card, "selected-part"]]);
  const container = { contains(element: GaragePreviewElement) {
    return element === card;
  } };
  const hits = [child, null].map(element => released ? original.Rn(
    container, 10, 20, () => element, previewCards) :
    garagePreviewHitTest(container, 10, 20, () => element, previewCards));
  return { grades, preview, words, qualities, pages, kartTypes,
    equipment, hits, events };
}

test("Garage vehicle layouts, part preview, labels, quality and page rules match release", () => {
  assert.deepEqual(run(false), run(true));
});
