import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garageKartCardsRect, garagePartsGridRect, garagePartIconKey,
  garagePageOverlayNames, garagePointerPresence, garageXunUpgradeRows,
  isGarageMaxXunPart, styleGarageActionButton,
  type GarageCardGridAssets, type GarageUiPart } from "./garage-ui-support";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["bt", "Dt", "Ss", "Pn", "Ln", "he", "xa", "La"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

function run(released: boolean): unknown {
  const events: unknown[] = [];
  const assets: GarageCardGridAssets = {
    rects: new Map([
      ["kartSelector", { x: 10, y: 20, width: 100, height: 80 }],
      ["partsSelect", { x: 30, y: 40, width: 200, height: 160 }],
    ]),
    kartCardLayout: { contentAdjustX: 2, contentAdjustY: 3,
      pageSize: 5, width: 50, gapX: 4, height: 70 },
    partGridLayout: { columns: 4, rows: 3 },
  };
  const cardLayout = (_assets: GarageCardGridAssets, kind: string) => {
    events.push(["part-layout", kind]);
    return { width: kind === "xun" ? 48 : 44, stepY: 52 };
  };
  const legacyCategory = (slot: string) => {
    events.push(["legacy-category", slot]);
    return "engine-category";
  };
  const original = new Function("xt", "Ni",
    `${originalSource}\nreturn {bt,Dt,Ss,Pn,Ln,he,xa,La};`)(
    cardLayout, legacyCategory) as {
      bt(assets: GarageCardGridAssets): unknown;
      Dt(assets: GarageCardGridAssets, kind: string): unknown;
      Ss(part: GarageUiPart): unknown;
      Pn(part: GarageUiPart, available: GarageUiPart[]): unknown;
      Ln(page: string, xun: boolean): unknown;
      he(button: unknown, style: unknown, kind: string): void;
      xa(button: unknown): () => boolean;
      La(summary: unknown): unknown;
    };
  const rect = (callback: () => unknown) => {
    try { return { value: callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  const card = rect(() => released ? original.bt(assets) :
    garageKartCardsRect(assets));
  const parts = rect(() => released ? original.Dt(assets, "xun") :
    garagePartsGridRect(assets, "xun", cardLayout));
  assets.rects.clear();
  const missingCard = rect(() => released ? original.bt(assets) :
    garageKartCardsRect(assets));
  const missingParts = rect(() => released ? original.Dt(assets, "classic") :
    garagePartsGridRect(assets, "classic", cardLayout));
  const part = (family: string, itemId: number, value: number): GarageUiPart =>
    ({ family, slot: "engine", itemId, grade: 2, value });
  const examples: GarageUiPart[] = [
    part("classic", 15, 5), part("xun", 16, 5),
    { ...part("legacy", 17, 0), legacyCategory: "old" },
    { ...part("legacy", 18, 0), legacyImagePath: "legacy-image" },
    part("legacy", 19, 0),
  ];
  const icons = examples.map(example => released ? original.Ss(example) :
    garagePartIconKey(example, legacyCategory));
  const available = [part("xun", 20, 1), part("xun", 21, 2),
    part("xun", 22, 2), part("xun", 30, 9)];
  const highest = [available[0]!, available[3]!, part("classic", 30, 9)]
    .map(example => released ? original.Pn(example, available) :
      isGarageMaxXunPart(example, available));
  const pageNames = ["factory", "level", "parts"].flatMap(page =>
    [false, true].map(xun => released ? original.Ln(page, xun) :
      garagePageOverlayNames(page, xun)));
  const button = {
    disabled: false,
    classList: { add(...classes: string[]) {
      events.push(["class", ...classes]);
    } },
    style: { fontSize: "", setProperty(name: string, value: string) {
      events.push(["property", name, value]);
    } },
    listeners: new Map<string, () => void>(),
    addEventListener(type: string, callback: () => void) {
      this.listeners.set(type, callback);
      events.push(["listen", type]);
    },
  };
  if (released) original.he(button, { fontSize: 16,
    colors: ["red", "blue"] }, "primary");
  else styleGarageActionButton(button, { fontSize: 16,
    colors: ["red", "blue"] }, "primary");
  const presence = released ? original.xa(button) : garagePointerPresence(button);
  const pointerStates = [presence()];
  button.listeners.get("pointerenter")!();
  pointerStates.push(presence());
  button.disabled = true;
  pointerStates.push(presence());
  button.disabled = false;
  button.listeners.get("pointercancel")!();
  pointerStates.push(presence());
  const rows = released ? original.La({ beforeLevel: 2, afterLevel: 4,
    beforePoints: 3, afterPoints: 5 }) :
    garageXunUpgradeRows({ beforeLevel: 2, afterLevel: 4,
      beforePoints: 3, afterPoints: 5 });
  return { card, parts, missingCard, missingParts, icons, highest,
    pageNames, pointerStates, rows, events, fontSize: button.style.fontSize };
}

test("Garage grids, icons, page overlays, actions and Xun rows match release", () => {
  assert.deepEqual(run(false), run(true));
});
