import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  createGarageCancelPreviewButton, createGarageInventoryScroll,
  createGarageRemovePartButton, garageInventoryRowStep,
  type GaragePreviewActionHost,
} from "./garage-view-field-actions";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view && view.type === "ClassDeclaration");
function originalField(name: string, host: unknown, Scroll?: unknown): unknown {
  const member = view.body.body.find(node =>
    node.type === "ClassProperty" && node.key.type === "Identifier" &&
    node.key.name === name);
  assert.ok(member && member.type === "ClassProperty" && member.value);
  const expression = release.slice(member.value.start!, member.value.end!);
  return new Function("vn", "return (" + expression + ");").call(host, Scroll);
}

test("Garage inventory row step and lazy scroll construction match As field", () => {
  const run = (released: boolean, value: string) => {
    const events: unknown[] = [];
    const inventory = {
      style: { getPropertyValue: (name: string) => {
        events.push(["css", name]); return value;
      } },
    } as unknown as HTMLElement;
    const hit = {} as HTMLElement;
    const host = { inventory, inventoryScrollHit: hit };
    const Scroll = class {
      constructor(readonly list: HTMLElement, readonly target: HTMLElement,
        readonly step: () => number | undefined) {
        events.push(["new-scroll", list === inventory, target === hit]);
      }
    };
    const scroll = released
      ? originalField("inventoryScroll", host, Scroll) as InstanceType<typeof Scroll>
      : createGarageInventoryScroll(host,
          (list, target, step) => new Scroll(list, target, step));
    return { events, step: scroll.step(),
      directStep: garageInventoryRowStep(host) };
  };
  for (const value of ["48px", "0px", "-2px", "unset", "12.5px"])
    assert.deepEqual(run(false, value), run(true, value), value);
});

function previewFixture(released: boolean, cosmeticPreview: unknown,
  hidden: boolean, coatingMode: boolean, cosmeticSlot: unknown) {
  const events: unknown[] = [];
  const host: GaragePreviewActionHost = {
    coatingPreview: "coating",
    cosmeticPreview,
    transformPreviewStartPending: true,
    transformPreviewUiHidden: hidden,
    panels: { setTransformPreview: active => {
      events.push(["transform", active]);
    } },
    coatingMode, cosmeticSlot,
    button: (label, action) => {
      events.push(["button", label]);
      return { label, click: action };
    },
    setPartPreview: value => { events.push(["part-preview", value]); },
    syncTransformPreviewUi: () => { events.push("sync-transform"); },
    syncCosmeticPreviewActions: () => { events.push("sync-cosmetic"); },
    updatePerformance: () => { events.push("performance"); },
    requestCoating: value => { events.push(["coating", value]); },
    requestCosmetic: value => { events.push(["cosmetic", value]); },
    requestEquip: value => { events.push(["equip", value]); },
  };
  const cancel = released
    ? originalField("cancelPreview", host) as { click(): void }
    : createGarageCancelPreviewButton<{ click(): void }>(host);
  const remove = released
    ? originalField("removePart", host) as { click(): void }
    : createGarageRemovePartButton<{ click(): void }>(host);
  return { host, cancel, remove, events };
}

test("cancel preview state and callback sequence match As field", () => {
  const run = (released: boolean, cosmeticPreview: unknown, hidden: boolean) => {
    const f = previewFixture(released, cosmeticPreview, hidden, false, undefined);
    f.cancel.click();
    return { events: f.events, coating: f.host.coatingPreview,
      cosmetic: f.host.cosmeticPreview,
      pending: f.host.transformPreviewStartPending };
  };
  for (const cosmetic of [undefined, "active"]) for (const hidden of [false, true])
    assert.deepEqual(run(false, cosmetic, hidden), run(true, cosmetic, hidden));
});

test("remove part dispatches by active Garage lane like As field", () => {
  const run = (released: boolean, coating: boolean, cosmeticSlot: unknown) => {
    const f = previewFixture(released, undefined, false, coating, cosmeticSlot);
    f.remove.click();
    return f.events;
  };
  for (const [coating, slot] of [[true, "aura"], [false, "aura"],
    [false, undefined]] as Array<[boolean, unknown]>) {
    assert.deepEqual(run(false, coating, slot), run(true, coating, slot));
  }
});
