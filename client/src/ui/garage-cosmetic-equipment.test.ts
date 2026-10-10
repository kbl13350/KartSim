import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  equipGarageCoating, equipGarageCosmetic, requestGarageCoating, requestGarageCosmetic,
  type GarageCosmeticChoice, type GarageCosmeticEquipmentDependencies,
  type GarageCosmeticEquipmentHost,
} from "./garage-cosmetic-equipment";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

type TestHost = GarageCosmeticEquipmentHost & {
  requestCoating(choice?: GarageCosmeticChoice): void;
  requestCosmetic(choice?: GarageCosmeticChoice): void;
};
const coating: GarageCosmeticChoice = { id: "blue", title: "蓝色车膜", family: "xun" };
const lamp: GarageCosmeticChoice = { id: 7, title: "霓虹车灯", family: "xun" };

function fixture(released: boolean) {
  const events: unknown[] = [];
  let confirmation: (() => void) | undefined;
  let failValidation = false;
  let failResources = false;
  const coatingChecks: Array<() => void> = [];
  const vehicleLoads: Array<() => void> = [];
  const dependencies: GarageCosmeticEquipmentDependencies = {
    currentConfiguration: (configuration, itemId, serial) => {
      events.push(["read", itemId, serial]);
      return (configuration as { current: { cosmetics: Record<string, unknown> } }).current;
    },
    vehicleFamily: (_vehicle, grade) => grade === 9 ? "xun" : "classic",
    validateConfiguration: (_vehicle, grade, equipment, speed) => {
      events.push(["validate", grade, structuredClone(equipment), speed]);
      if (failValidation) throw new Error("invalid setup");
    },
    writeConfiguration: (_configuration, itemId, serial, equipment) => {
      events.push(["write", itemId, serial]);
      return { current: equipment };
    },
    loadVehicle: (library, path) => {
      events.push(["load-vehicle", library, path]);
      return new Promise(resolve => {
        vehicleLoads.push(() => resolve({ parameter: { value: { kart: path } } }));
      });
    },
    cosmeticParameters: value => {
      events.push(["parameters", value]);
      return { parsed: value };
    },
    validateCosmeticResources: async (library, parameters, cosmetics) => {
      events.push(["validate-assets", library, parameters, structuredClone(cosmetics)]);
      if (failResources) throw new Error("asset unavailable");
    },
  };
  const Original = new Function("K", "rt", "te", "hi", "di", "gi", "ie",
    `${classSource}; return As;`)(
      dependencies.currentConfiguration, dependencies.vehicleFamily,
      dependencies.validateConfiguration, dependencies.loadVehicle,
      dependencies.validateCosmeticResources, dependencies.cosmeticParameters,
      dependencies.writeConfiguration,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { itemId: 101, path: "kart/alpha", engineGrade: 9 };
  host.configuration = { current: { cosmetics: { family: "xun", tailLamp: 1, boosterEffect: 3 } } };
  host.options = { speed: "fast", library: "archive" };
  host.cosmeticSlot = "tailLamp";
  host.cosmeticBusy = false;
  host.cosmeticResetToken = {};
  host.coatingMode = true;
  host.coatingPreview = "preview coating";
  host.cosmeticPreview = "preview lamp";
  host.disposed = false;
  host.status = { textContent: "initial" };
  host.panels = { validateCoatingEquipment: (itemId, choice) => {
    events.push(["validate-coating", itemId, choice.id]);
    return new Promise(resolve => { coatingChecks.push(() => resolve(undefined)); });
  } };
  host.confirmation = { open: (message, callback) => {
    events.push(["confirm", message]);
    confirmation = callback;
  } };
  host.requireCustomization = () => {
    const allowed = host.selected.itemId !== 0;
    events.push(["customizable", allowed]);
    return allowed;
  };
  host.serial = () => { events.push("serial"); return 42; };
  host.base = () => { events.push("base"); return { id: host.selected.itemId }; };
  host.publishCurrentState = () => { events.push("publish"); };
  host.updateControls = () => { events.push("controls"); };
  if (!released) {
    host.requestCoating = choice => requestGarageCoating(host, choice);
    host.equipCoating = choice => equipGarageCoating(host, choice, dependencies);
    host.requestCosmetic = choice => requestGarageCosmetic(host, choice);
    host.equipCosmetic = choice => equipGarageCosmetic(host, choice, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events),
    configuration: structuredClone(host.configuration),
    selected: host.selected.itemId,
    cosmeticSlot: host.cosmeticSlot,
    cosmeticBusy: host.cosmeticBusy,
    coatingMode: host.coatingMode,
    coatingPreview: host.coatingPreview,
    cosmeticPreview: host.cosmeticPreview,
    status: host.status.textContent,
  });
  return {
    host, events, snapshot, coatingChecks, vehicleLoads,
    confirm: () => { assert.ok(confirmation); confirmation(); },
    failValidation: (value: boolean) => { failValidation = value; },
    failResources: (value: boolean) => { failResources = value; },
  };
}

const flush = async () => { await new Promise<void>(resolve => setImmediate(resolve)); };

test("coating and cosmetic confirmation callbacks retain selected kart, mode, and slot", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.equipCoating = async choice => { f.events.push(["equip-coating", choice?.id]); };
    f.host.equipCosmetic = async choice => { f.events.push(["equip-cosmetic", choice?.id]); };
    f.host.requestCoating(coating);
    f.confirm();
    await flush();
    states.push(f.snapshot());
    f.host.requestCoating(undefined);
    f.host.coatingMode = false;
    f.confirm();
    states.push(f.snapshot());
    f.host.coatingMode = true;
    f.host.requestCosmetic(lamp);
    f.confirm();
    await flush();
    states.push(f.snapshot());
    f.host.requestCosmetic(undefined);
    f.host.cosmeticSlot = "boosterEffect";
    f.confirm();
    states.push(f.snapshot());
    f.host.cosmeticSlot = "tailLamp";
    f.host.requestCosmetic(lamp);
    f.host.selected = { ...f.host.selected };
    f.confirm();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("coating compatibility, async validation, stale selection and removal match As", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    await f.host.equipCoating({ ...coating, family: "classic" });
    states.push(f.snapshot());
    f.host.status.textContent = "";
    const pending = f.host.equipCoating(coating);
    assert.equal(f.coatingChecks.length, 1);
    f.coatingChecks[0]!();
    await pending;
    states.push(f.snapshot());
    const stale = f.host.equipCoating(coating);
    f.host.cosmeticResetToken = {};
    f.coatingChecks[1]!();
    await stale;
    states.push(f.snapshot());
    f.host.cosmeticResetToken = {};
    await f.host.equipCoating(undefined);
    states.push(f.snapshot());
    f.failValidation(true);
    await f.host.equipCoating(coating);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("cosmetic asset loading, concurrent edits, stale slot and failures match As", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    const first = f.host.equipCosmetic(lamp);
    assert.equal(f.vehicleLoads.length, 1);
    (f.host.configuration as { current: { cosmetics: Record<string, unknown> } })
      .current.cosmetics.boosterEffect = 99;
    f.vehicleLoads[0]!();
    await first;
    states.push(f.snapshot());
    const stale = f.host.equipCosmetic(lamp);
    f.host.cosmeticSlot = "boosterEffect";
    f.vehicleLoads[1]!();
    await stale;
    states.push(f.snapshot());
    f.host.cosmeticSlot = "tailLamp";
    f.failResources(true);
    const failed = f.host.equipCosmetic(lamp);
    f.vehicleLoads[2]!();
    await failed;
    states.push(f.snapshot());
    f.failResources(false);
    const remove = f.host.equipCosmetic(undefined);
    f.vehicleLoads[3]!();
    await remove;
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("generated GarageXView delegates cosmetic equipment methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-cosmetic-equipment\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["requestCoating", "requestGarageCoating"], ["equipCoating", "equipGarageCoating"],
    ["requestCosmetic", "requestGarageCosmetic"], ["equipCosmetic", "equipGarageCosmetic"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(this,`));
});
