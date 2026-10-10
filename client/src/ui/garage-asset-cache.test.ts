import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garageAssetsForWidth, garageDialogAssets,
  garageUpgradeAssetsForMode } from "./garage-asset-cache";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["zi", "Wt", "Ts", "Ha"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

async function run(released: boolean): Promise<unknown> {
  const calls: unknown[] = [];
  const library = {};
  const widthCache = new WeakMap<object, Map<number, Promise<string>>>();
  const upgradeCache = new WeakMap<object, Map<string, Promise<string>>>();
  const skillCache = new WeakMap<object, Promise<string>>();
  const preparationCache = new WeakMap<object, Promise<string>>();
  let failWidth = true;
  let failUpgrade = true;
  let failSkill = true;
  let failPreparation = true;
  const loadWidth = async (_library: object, width: number) => {
    calls.push(["width", width]);
    if (width === 800 && failWidth) {
      failWidth = false; throw new Error("width failure");
    }
    return `width:${width}`;
  };
  const loadUpgrade = async (_library: object, mode: string, width: number) => {
    calls.push(["upgrade", mode, width]);
    if (mode === "fail" && failUpgrade) {
      failUpgrade = false; throw new Error("upgrade failure");
    }
    return `upgrade:${mode}:${width}`;
  };
  const loadSkill = async () => {
    calls.push("skill");
    if (failSkill) { failSkill = false; throw new Error("skill failure"); }
    return "skill:loaded";
  };
  const loadPreparation = async () => {
    calls.push("preparation");
    if (failPreparation) {
      failPreparation = false; throw new Error("preparation failure");
    }
    return "preparation:loaded";
  };
  const original = new Function("Ot", "Ui", "jt", "ia", "He", "Ba",
    "je", "ja", `${originalSource}\nreturn {zi,Wt,Ts,Ha};`)(
    widthCache, loadWidth, upgradeCache, loadUpgrade,
    skillCache, loadSkill, preparationCache, loadPreparation) as {
      zi(library: object, width?: number): Promise<string>;
      Wt(library: object, mode?: string, width?: number): Promise<string>;
      Ts(library: object): Promise<string>;
      Ha(library: object): Promise<string>;
    };
  const width = (value = 1600) => released ? original.zi(library, value) :
    garageAssetsForWidth(library, value, widthCache, loadWidth);
  const upgrade = (mode = "kartune", value = 1600) => released ?
    original.Wt(library, mode, value) : garageUpgradeAssetsForMode(
      library, mode, value, upgradeCache, loadUpgrade);
  const skill = () => released ? original.Ts(library) : garageDialogAssets(
    library, skillCache, loadSkill);
  const preparation = () => released ? original.Ha(library) :
    garageDialogAssets(library, preparationCache, loadPreparation);
  const firstWidth = width();
  const widthIdentity = firstWidth === width();
  const firstUpgrade = upgrade();
  const upgradeIdentity = firstUpgrade === upgrade();
  const settle = async (promise: Promise<string>) => {
    try { return { value: await promise }; }
    catch (error) { return { error: String(error) }; }
  };
  const successful = [await settle(firstWidth), await settle(width(1280)),
    await settle(firstUpgrade), await settle(upgrade("kartune", 1280))];
  const failures = [await settle(width(800)),
    await settle(upgrade("fail", 1600)),
    await settle(skill()), await settle(preparation())];
  const retries = [await settle(width(800)),
    await settle(upgrade("fail", 1600)),
    await settle(skill()), await settle(preparation())];
  return { widthIdentity, upgradeIdentity, successful,
    failures, retries, calls };
}

test("Garage asset promise caches and rejected-load eviction match release", async () => {
  assert.deepEqual(await run(false), await run(true));
});
