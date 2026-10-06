import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  equipGaragePart, requestGaragePartEquip, requireGarageCustomization,
  selectGaragePartSlot, setGaragePartPreview,
  type GarageEquipmentDependencies, type GarageEquipmentHost,
  type GarageEquipmentVehicle,
} from "./garage-equipment-actions";
import { sameGaragePart, type GaragePart, type GaragePartSlot } from "./garage-parts-business";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

type TestHost = GarageEquipmentHost & {
  requestEquip(part?: GaragePart): void;
  selectSlot(slot: GaragePartSlot): void;
  setPartPreview(part?: GaragePart): void;
};
const engine: GaragePart = { family: "xun", slot: "engine", itemId: 11, value: 4,
  grade: 2 };
const wheel: GaragePart = { family: "xun", slot: "wheel", itemId: 12, value: 3,
  grade: 4 };

function fixture(released: boolean) {
  const events: unknown[] = [];
  let locked = false;
  let invalid = false;
  let confirm: (() => void) | undefined;
  const deps: GarageEquipmentDependencies = {
    canCustomize: id => id !== 0,
    slotLocked: (_vehicle, slot) => { events.push(["locked", slot]); return locked; },
    currentConfiguration: (configuration, id, serial) => {
      events.push(["read", id, serial]);
      return (configuration as { current: Record<string, unknown> }).current;
    },
    validateConfiguration: (_vehicle, grade, equipment, speed) => {
      events.push(["validate", grade, structuredClone(equipment), speed]);
      if (invalid) throw new Error("invalid equipment");
    },
    writeConfiguration: (_configuration, id, serial, equipment) => {
      events.push(["write", id, serial]);
      return { current: equipment };
    },
    partFamily: (_vehicle, grade) => grade === 9 ? "xun" : "legacy",
    slotLabel: (slot, family) => `${family}-${slot}`,
  };
  const Original = new Function("ae", "fe", "K", "te", "ie", "me", "le", "Kt",
    `${classSource}; return As;`)(
      deps.canCustomize, deps.slotLocked, deps.currentConfiguration,
      deps.validateConfiguration, deps.writeConfiguration,
      deps.partFamily, deps.slotLabel, sameGaragePart,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { itemId: 100, engineGrade: 9 };
  host.slot = "engine";
  host.configuration = { current: { wheel } };
  host.options = { speed: "fast" };
  host.status = { textContent: "initial" };
  host.disposed = false;
  host.previewPart = wheel;
  host.coatingMode = true;
  host.coatingPreview = "coating";
  host.cosmeticSlot = "lamp";
  host.cosmeticPreview = "cosmetic";
  host.transformPreviewStartPending = true;
  host.inventory = { scrollTop: 240 };
  host.panels = { setTransformPreview: enabled => { events.push(["transform", enabled]); } };
  host.confirmation = {
    openPartEquip: (label, callback) => {
      events.push(["confirm-part", label]); confirm = callback;
    },
    open: (message, callback) => {
      events.push(["confirm-removal", message]); confirm = callback;
    },
  };
  host.base = () => { events.push("base"); return { id: host.selected.itemId }; };
  host.serial = () => { events.push("serial"); return 42; };
  host.partLabel = part => `Part ${part.itemId}`;
  host.publishCurrentState = () => { events.push("publish"); };
  host.updateControls = () => { events.push("controls"); };
  host.updatePerformance = () => { events.push("performance"); };
  if (!released) {
    host.requireCustomization = () => requireGarageCustomization(host, deps.canCustomize);
    host.equip = part => equipGaragePart(host, part, deps);
    host.requestEquip = part => requestGaragePartEquip(host, part, deps);
    host.selectSlot = slot => selectGaragePartSlot(host, slot);
    host.setPartPreview = part => setGaragePartPreview(host, part);
  }
  const snapshot = () => ({
    events: structuredClone(events), configuration: structuredClone(host.configuration),
    selected: structuredClone(host.selected), slot: host.slot,
    status: host.status.textContent, previewPart: host.previewPart,
    coatingMode: host.coatingMode, coatingPreview: host.coatingPreview,
    cosmeticSlot: host.cosmeticSlot, cosmeticPreview: host.cosmeticPreview,
    transformPreviewStartPending: host.transformPreviewStartPending,
    scrollTop: host.inventory.scrollTop,
  });
  return { host, snapshot, setLocked: (value: boolean) => { locked = value; },
    setInvalid: (value: boolean) => { invalid = value; },
    confirm: () => { assert.ok(confirm); confirm(); } };
}

test("equipping, removing, slot locks, invalid setup, and practice kart guard match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.equip(engine);
    states.push(f.snapshot());
    f.host.equip(undefined);
    states.push(f.snapshot());
    f.setLocked(true);
    assert.throws(() => f.host.equip(engine), /该部件槽已锁定/);
    states.push(f.snapshot());
    f.setLocked(false);
    f.setInvalid(true);
    assert.throws(() => f.host.equip(engine), /invalid equipment/);
    states.push(f.snapshot());
    f.host.selected = { itemId: 0, engineGrade: 9 };
    f.host.equip(engine);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("confirmation commits only for the original kart and slot, and catches errors", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.requestEquip(engine);
    states.push(f.snapshot());
    f.confirm();
    states.push(f.snapshot());
    f.host.requestEquip(undefined);
    states.push(f.snapshot());
    f.host.selected = { ...f.host.selected } as GarageEquipmentVehicle;
    f.confirm();
    states.push(f.snapshot());
    f.host.requestEquip(engine);
    f.setInvalid(true);
    f.confirm();
    states.push(f.snapshot());
    f.host.requestEquip(engine);
    f.host.slot = "wheel";
    f.confirm();
    states.push(f.snapshot());
    f.host.slot = "engine";
    f.host.requestEquip(engine);
    f.host.disposed = true;
    f.confirm();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("slot changes and structural preview equality match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.setPartPreview({ ...wheel, legacyTitle: "different label" });
    states.push(f.snapshot());
    f.host.setPartPreview(engine);
    states.push(f.snapshot());
    f.host.selectSlot("wheel");
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates five equipment methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-equipment-actions\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  assert.match(methods.get("requireCustomization") ?? "", /requireGarageCustomization\(this, ae\)/);
  assert.match(methods.get("equip") ?? "", /equipGaragePart\(this, part, garageEquipmentDependencies\)/);
  assert.match(methods.get("requestEquip") ?? "", /requestGaragePartEquip\(this, part, garageEquipmentDependencies\)/);
  assert.match(methods.get("selectSlot") ?? "", /selectGaragePartSlot\(this, slot\)/);
  assert.match(methods.get("setPartPreview") ?? "", /setGaragePartPreview\(this, part\)/);
});
