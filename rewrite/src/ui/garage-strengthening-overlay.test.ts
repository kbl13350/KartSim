import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  renderGarageStrengtheningOverlay,
  type GarageOverlayPanels, type GarageStrengtheningOverlayDependencies,
  type GarageStrengtheningOverlayHost,
} from "./garage-strengthening-overlay";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view && view.type === "ClassDeclaration");
const method = view.body.body.find(node => node.type === "ClassMethod" &&
  node.key.type === "Identifier" && node.key.name === "renderStrengtheningOverlay");
assert.ok(method);
const originalMethod = release.slice(method.start!, method.end!);

type TestHost = GarageStrengtheningOverlayHost & {
  renderStrengtheningOverlay(time: number): void;
};

function run(released: boolean, variant: "normal" | "preparation" | "factory" |
  "xun-fallback" | "cosmetic" | "missing-panels" | "missing-character") {
  const events: unknown[] = [];
  const composeEquipment = (_profile: unknown, kartId: number, characterId: number) => {
    events.push(["compose", kartId, characterId]); return { kartId, characterId };
  };
  const currentConfiguration = (_configuration: unknown, itemId: number, serial: number) => {
    events.push(["current", itemId, serial]); return { cosmetics: { coating: 3 } };
  };
  const writeConfiguration = (_configuration: unknown, itemId: number, serial: number,
    value: { cosmetics: Record<string, unknown> }) => {
    events.push(["write", itemId, serial, value]); return { edited: value };
  };
  const dependencies: GarageStrengtheningOverlayDependencies = {
    composeEquipment, currentConfiguration, writeConfiguration,
  };
  const Original = new Function("ot", "K", "ie", `return class Original { ${originalMethod} };`)(
    composeEquipment, currentConfiguration, writeConfiguration,
  ) as new () => TestHost;
  const host = new Original();
  const rect = { x: 5, y: 6, width: 320, height: 180 };
  const selected = { itemId: 7, engineGrade: variant === "xun-fallback" ? 9 : 0 };
  const panels = {
    isPreviewReady: false,
    setPreviewSize: (width: number, height: number, owner: string) => {
      events.push(["size", width, height, owner]);
    },
    render: (...args: unknown[]) => { events.push(["render", ...args]); },
    renderKartSnapshot: (...args: unknown[]) => {
      events.push(["kart-snapshot", ...args]);
      return variant === "xun-fallback" ? undefined : "kart-snapshot";
    },
    renderPreviewSnapshot: (...args: unknown[]) => {
      events.push(["preview-snapshot", ...args]); return "preview-snapshot";
    },
  } as unknown as GarageOverlayPanels;
  host.panels = variant === "missing-panels" ? undefined : panels;
  host.options = { catalog: { characters: variant === "missing-character" ? [] :
    [{ itemId: 15 }] }, selectedCharacterItemId: 15, profile: { name: "profile" } };
  host.preparation = variant === "preparation" ? {
    previewRect: { x: 10, y: 20, width: 300, height: 200 },
    selected: { itemId: 8, engineGrade: 0 }, cards: ["prepared-card"],
    previewCard: "hovered-card",
    draw: () => { events.push("preparation-draw"); },
  } : undefined;
  host.upgrade = { capturePreview: (_panels, bounds) => {
    events.push(["capture-preview", bounds]);
  }, render: (time, _panels) => { events.push(["upgrade-render", time]); } };
  host.pageMode = variant === "factory" ? "factory" : "parts";
  host.selected = selected;
  host.visibleCards = ["card-one"];
  host.configuration = { garage: "original" };
  host.cosmeticPreview = variant === "cosmetic"
    ? { family: "classic", slot: "tailLamp", id: 12 } : undefined;
  host.assets = { stage: { width: 1024, height: 768 } };
  host.renderPixelRatio = 2;
  host.serial = () => 42;
  host.activePreviewRect = () => { events.push("active-rect"); return rect; };
  host.nativeFactoryAllowed = () => { events.push("factory-allowed"); return false; };
  if (!released) host.renderStrengtheningOverlay = time =>
    renderGarageStrengtheningOverlay(host, time, dependencies);
  host.renderStrengtheningOverlay(1234);
  return { events: structuredClone(events), configuration: host.configuration };
}

test("strengthening overlay renders selected and prepared kart scenes like As", () => {
  for (const variant of ["normal", "preparation", "factory", "xun-fallback",
    "cosmetic", "missing-panels", "missing-character"] as const)
    assert.deepEqual(run(false, variant), run(true, variant), variant);
});
