import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { bindGarageHoverPreview, loadGarageDefaultPreviews,
  planGarageDrawOrder, type GarageDefaultPreviewOptions } from
  "./garage-view-support";
import type { GarageAssetNode } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["An", "Fn", "Mn"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");
const node = (name: string, children: GarageAssetNode[] = []): GarageAssetNode => ({
  name: "Panel", children, attributes: [{ name: "name", value: name }],
});
const attribute = (source: GarageAssetNode, name: string): string | undefined =>
  source.attributes.find(entry => entry.name === name)?.value;

async function run(released: boolean, failSpecification: boolean): Promise<unknown> {
  const events: unknown[] = [];
  const cache = new WeakMap<GarageAssetNode, string[]>();
  const loadSpecification = async (_library: unknown, path: string,
    systemKey: string) => {
    events.push(["load", path, systemKey]);
    if (failSpecification && systemKey === "default-b")
      throw new Error("spec missing");
    return { parameter: { value: `${path}:parameter` } };
  };
  const previewKey = (kart: { itemId: number; systemKey: string }) => {
    events.push(["key", kart.systemKey]);
    return kart.systemKey;
  };
  const createPreview = (kart: { itemId: number; systemKey: string },
    speed: unknown, parameter: unknown, version: unknown) => {
    events.push(["preview", kart.systemKey, speed, parameter, version]);
    return `preview:${kart.systemKey}:${version}`;
  };
  const original = new Function("hs", "y", "bi", "bs", "xs", "vs",
    `${originalSource}\nreturn {An,Fn,Mn};`)(
    cache, attribute, loadSpecification, previewKey, createPreview,
    "default-version") as {
      An(root: GarageAssetNode, visible: string[]): unknown;
      Fn(options: GarageDefaultPreviewOptions): Promise<Map<string, unknown>>;
      Mn(target: { disabled: boolean;
        addEventListener(type: string, callback: () => void): void },
        value: unknown, current: () => unknown,
        select: (value: unknown) => void): void;
    };
  const drawRoot = node("root", [node("background"),
    node("kartPreview"), node("overlay", [node("button")])]);
  const draw = (visible: string[]): unknown => {
    try { return { value: released ? original.An(drawRoot, visible) :
      planGarageDrawOrder(drawRoot, visible, { attribute, cache }) }; }
    catch (error) { return { error: String(error) }; }
  };
  const firstOrder = draw(["button", "background", "overlay"]);
  const missingOrder = draw(["not-present"]);
  drawRoot.children.push(node("added-after-cache"));
  const cachedOrder = draw(["added-after-cache"]);

  const options: GarageDefaultPreviewOptions = {
    catalog: { karts: [
      { itemId: 0, systemKey: "default-a", path: "a" },
      { itemId: 10, systemKey: "other", path: "ignore" },
      { itemId: 0, systemKey: "default-b", path: "b" },
    ] },
    library: {}, speed: "fast",
  };
  let previews: unknown;
  try {
    const result = released ? await original.Fn(options) :
      await loadGarageDefaultPreviews(options, { defaultVersion: "default-version",
        loadSpecification, previewKey, createPreview });
    previews = [...result];
  } catch (error) { previews = { error: String(error) }; }

  const listeners = new Map<string, () => void>();
  const target = { disabled: false,
    addEventListener(type: string, callback: () => void) {
      listeners.set(type, callback);
      events.push(["listen", type]);
    } };
  let current: unknown;
  const select = (value: unknown) => {
    current = value; events.push(["select", value]);
  };
  if (released) original.Mn(target, "part", () => current, select);
  else bindGarageHoverPreview(target, "part", () => current, select);
  listeners.get("pointerenter")!();
  listeners.get("pointerleave")!();
  target.disabled = true;
  listeners.get("focus")!();
  select("other");
  listeners.get("blur")!();
  return { firstOrder, missingOrder, cachedOrder, previews, events };
}

test("Garage draw ordering, default kart previews and hover interaction match release", async () => {
  assert.deepEqual(await run(false, false), await run(true, false));
  assert.deepEqual(await run(false, true), await run(true, true));
});
