import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { vehiclePhysicsParameters, type PhysicsParameterSpec } from "../driving/physics-parameters";
import { bundledVehicleSpecCatalog } from "./bundled";
import {
  ITEM_RACE_TUNING_SOURCES, extractItemRaceTuning, formatItemRaceTuning,
} from "./extract-item-race-tuning.mjs";
import {
  flyingPetItemBoosterBonusMs, itemRaceTuningData, itemRaceVehicleSpec, kartItemBoosterAccelFactor,
} from "./item-race-tuning";

const project = new URL("../../../", import.meta.url);
const read = (relative: string) => readFileSync(new URL(relative, project), "utf8");
const f32 = Math.fround;
const itemMode = { kind: "item", team: false };

/** A BodyParam start tag as attributes (single or double quotes, spaces around `=`). */
function bodyParam(xml: string): Record<string, string> {
  const tag = /<BodyParam\b([\s\S]*?)\/?>/.exec(xml)?.[1] ?? "";
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w.]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g))
    attributes[match[1]!] ??= match[2] ?? match[3]!;
  return attributes;
}

/** The kart's own parameter file as the race loader picks it: param@cn, else param. */
function kartParameter(folder: string): Record<string, string> | undefined {
  for (const name of ["param@cn.xml", "param.xml"]) {
    const relative = `recovered/data-full/DataPack2/kart_/${folder}/${name}`;
    if (existsSync(new URL(relative, project))) return bodyParam(read(relative));
  }
  return undefined;
}

test("the flying-pet tune groups are exported from the original CN item table and enchant data", () => {
  const extracted = extractItemRaceTuning(read(ITEM_RACE_TUNING_SOURCES.itemTable),
    read(ITEM_RACE_TUNING_SOURCES.enchant));
  assert.equal(read("client/src/physics/data/item-race-tuning.json"), formatItemRaceTuning(extracted),
    "run node src/physics/extract-item-race-tuning.mjs");
  const data = itemRaceTuningData();
  assert.deepEqual(data.tuneGroupSpecs["204"], { itemBoosterTime: 250 });
  const itemPets = Object.entries(data.flyingPetTuneGroups)
    .filter(([, group]) => group === 204).map(([id]) => Number(id));
  assert.deepEqual(itemPets, [5, 11, 17]);
  // The shop texts of the 玄武 pets promise the longer item booster (17 可乐棒棒糖
  // carries only the generic 棒棒糖 text).
  const catalog = read("server-go/internal/data/economy/catalog.json");
  for (const id of [5, 11]) {
    const line = catalog.split("\n").find(row =>
      row.includes('"category":52,') && row.includes(`"itemId":${id},`))!;
    assert.match(line, /在道具赛中使用加速时间更长/, `flying pet ${id}`);
  }
});

test("only tune group 204 adds item booster time", () => {
  assert.equal(flyingPetItemBoosterBonusMs(5), 250);
  assert.equal(flyingPetItemBoosterBonusMs(11), 250);
  assert.equal(flyingPetItemBoosterBonusMs(17), 250);
  for (const id of [undefined, 0, -1, 1, 2, 3, 4, 6, 12, 27, 1.5, 99_999])
    assert.equal(flyingPetItemBoosterBonusMs(id), 0, String(id));
});

test("every catalog kart's item booster factor comes from its own parameter file", () => {
  const catalog = bundledVehicleSpecCatalog();
  const karts = read("server-go/internal/data/economy/catalog.json").split("\n")
    .filter(row => row.trimStart().startsWith('{"category":3,'))
    .map(row => JSON.parse(row.trim().replace(/,$/, "")) as { itemId: number; internalId: string });
  assert.ok(karts.length > 1000);
  const factors = new Map<string, number>();
  let overlaid = 0;
  for (const kart of karts) {
    let spec: PhysicsParameterSpec;
    try { spec = catalog.lookup(kart.itemId, 7).spec as unknown as PhysicsParameterSpec; }
    catch { continue; }
    assert.equal(spec.boostAccelFactorOnlyItem, 1.5, `${kart.itemId} table value`);
    const parameter = kartParameter(kart.internalId);
    const result = itemRaceVehicleSpec(spec, itemMode, parameter, 0);
    const raw = parameter?.BoostAccelFactorOnlyItem ?? parameter?.BoosterAccelFactorItem;
    if (raw === undefined) {
      assert.equal(result, spec, `${kart.itemId} keeps the table`);
      continue;
    }
    overlaid += 1;
    assert.equal(result.boostAccelFactorOnlyItem, f32(Number(raw)), `${kart.itemId}`);
    assert.equal(result.itemBoosterTime, spec.itemBoosterTime);
    factors.set(raw, (factors.get(raw) ?? 0) + 1);
    // Speed and time-attack races never see the overlay.
    assert.equal(itemRaceVehicleSpec(spec, { kind: "speed" }, parameter, 5), spec);
    assert.equal(itemRaceVehicleSpec(spec, undefined, parameter, 5), spec);
  }
  assert.ok(overlaid > 300, `${overlaid} karts`);
  assert.ok((factors.get("1.7") ?? 0) > 200 && (factors.get("1.65") ?? 0) > 50,
    JSON.stringify([...factors]));
});

test("the overlay reaches the AL tuning record of an item kart", () => {
  const spec = bundledVehicleSpecCatalog().lookup(1513, 7).spec as unknown as PhysicsParameterSpec;
  const parameter = kartParameter("protoXUN_item")!;
  assert.equal(parameter.BoosterAccelFactorItem, "1.7");
  const document = { body: { attributes: Object.entries(parameter)
    .map(([name, value]) => ({ name, value })) } };
  assert.equal(kartItemBoosterAccelFactor(document), f32(1.7));
  assert.equal(kartItemBoosterAccelFactor(undefined), undefined);
  assert.equal(kartItemBoosterAccelFactor({ BoostAccelFactorOnlyItem: "1.8", BoosterAccelFactorItem: "1.6" }),
    f32(1.8), "the BodyParam precedence");
  assert.throws(() => kartItemBoosterAccelFactor({ BoosterAccelFactorItem: "fast" }), /有限数/);
  const tuning = vehiclePhysicsParameters(itemRaceVehicleSpec(spec, itemMode, document, 11),
    { autoChargeLowSpeed: 100, driftGaugeReset: true, wheelPosition: 0.85 }, 5);
  assert.equal(tuning.boostAccelFactorOnlyItem, f32(1.7));
  assert.equal(tuning.itemBoosterTime, 3250);
  assert.equal(tuning.animalBoosterTime, 4000, "the special booster has no pet bonus");
  assert.equal(tuning.superBoosterTime, 3500);
  assert.equal(tuning.useExtendedAfterBoosterMore, true);
});

test("the race loader (A40) applies the overlay after the flying-pet parameters", () => {
  const vehicle = readFileSync(new URL("../generated/vehicle.js", import.meta.url), "utf8");
  const line = "E0 = itemRaceVehicleSpec(E0, vI(SX(e)), R2, r0.itemIds[52]); // item-mode(p3p)";
  assert.equal(vehicle.split(line).length, 2);
  const petStats = vehicle.indexOf("D0 = z || t.rp ? await Ma(g, r0.itemIds[52]) : void 0;");
  const loaded = vehicle.indexOf("R = await B.loadVehicleAsset(");
  const overlay = vehicle.indexOf(line);
  assert.ok(petStats > 0 && petStats < overlay && overlay < loaded);
  assert.ok(vehicle.includes("drivingMode: vI(SX(e)),"), "the same driving mode the race gets");
});
