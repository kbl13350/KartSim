import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  loadGaragePreparationAssets, type GaragePreparationAssetDependencies,
  type GaragePreparationAssetLibrary,
} from "./garage-upgrade-preparation-assets";
import type { GarageAssetNode } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "ja");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

interface TestNode extends GarageAssetNode { children: TestNode[] }
const node = (name: string, properties: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, children,
    attributes: Object.entries(properties).map(([key, value]) => ({ name: key, value })) });
const attribute = (source: GarageAssetNode, name: string): string | undefined =>
  source.attributes.find(value => value.name === name)?.value;

type Variant = "normal" | "with-font" | "missing-main" |
  "missing-frame" | "missing-arrow-state" | "missing-rect" |
  "missing-arrow" | "missing-image" | "card-mismatch";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const layoutDirectory = "dialog2_/upgrade/";
  const cardDirectory = "gui_/windowTemplate/";
  const requiredNames = [
    "ImageBoard", "itemView", "curLevel", "nextLevel",
    "curSlotNum", "nextSlotNum", "curTp", "nextTp", "kartList",
    "kartSelector", "levelUpStart",
  ];
  const children = requiredNames.map(name => node("Panel", {
    name, ...(name === "kartSelector" ? { windowSize: "0 0 400 400" } : {}),
  }));
  children.push(node("Label", { text: "#sb(tuningSlotNum)" }),
    node("Label", { text: "#sb(tuningPoint)" }),
    node("Label", { text: "#sb(tuningTargetKart)" }),
    node("Arrow", { name: "preItemList", arrowDir: "left",
      arrowColor: "255 1 2 3", overArrowColor: "255 2 3 4",
      clickedArrowColor: "255 3 4 5", disabledArrowColor: "255 4 5 6" }),
    node("Arrow", { name: "nextItemList", arrowDir: "right",
      arrowColor: "255 1 2 3", overArrowColor: "255 2 3 4",
      clickedArrowColor: "255 3 4 5", disabledArrowColor: "255 4 5 6" }),
    node("Icon", { texture: "icon_lucci" }));
  if (variant === "missing-rect")
    children.splice(children.findIndex(child => attribute(child, "name") === "curLevel"), 1);
  if (variant === "missing-arrow")
    children.splice(children.findIndex(child => attribute(child, "name") === "nextItemList"), 1);
  const main = node("Dialog", { name: "kartLevelUp", frame: "CaptionDialog" },
    children);
  const definition = node("root", {}, variant === "missing-main" ? [] : [main]);
  const card = node("card", { texture: "normal-card" }, [
    node("Image", { name: "selected", texture: "selected-card" }),
  ]);
  const arrowStates = ["Normal", "MouseOn", "Clicked", "Disabled"]
    .filter(name => variant !== "missing-arrow-state" || name !== "Clicked")
    .map(name => node(name, { texture: "atlas" }));
  const frames = node("frame", {}, [
    ...(variant === "missing-frame" ? [] :
      [node("CaptionDialog", {}, [node("main", { texture: "atlas" })])]),
    node("BorderLineStaticButton", {}, arrowStates),
  ]);
  const resources = new Map<string, unknown>([
    [`${layoutDirectory}kart12TuningLevelUp@zz.bml`, definition],
    [`${cardDirectory}kart12TuningLevelUpCard.bml`, card],
    ["gui_/monocoque/frame.bml", frames],
    [`${layoutDirectory}background.png`, new Uint8Array([1])],
    ["gui_/monocoque/atlas.png", new Uint8Array([2])],
    [`${cardDirectory}normal-card.png`, new Uint8Array([3])],
    [`${cardDirectory}selected-card.png`, new Uint8Array([4])],
  ]);
  if (variant === "missing-image")
    resources.delete(`${cardDirectory}selected-card.png`);
  if (variant === "with-font")
    resources.set("gui_/font/SourceHanSansCN-Bold.otf", new Uint8Array([7]));
  const entry = (path: string) => ({ sourceName: path,
    async bytes(): Promise<Uint8Array> {
      events.push(["bytes", path]);
      return resources.get(path) as Uint8Array;
    } });
  const library: GaragePreparationAssetLibrary = {
    exactCanonicalCandidates(path) {
      return resources.has(path) ? [entry(path)] : [];
    },
  };
  let urlId = 0;
  const dependencies: GaragePreparationAssetDependencies = {
    layoutDirectory, cardDirectory, imageTokens: ["background"],
    parseBml: bytes => bytes as unknown as GarageAssetNode,
    attribute,
    frameStyle: source => ({ texture: attribute(source, "texture") ?? "" }),
    childRect: (source, parent) => ({
      x: parent.x + 2, y: parent.y + 3,
      width: Math.max(0, parent.width - 1),
      height: Math.max(0, parent.height - 1),
      source: source.name,
    }),
    frameInnerRect: (_frame, bounds) => ({ ...bounds,
      x: bounds.x + 1, y: bounds.y + 1 }),
    parseArrowColor: (value, label) => `${label}:${value}`,
    cardLayout: () => ({ width: 120, height: 80, zoom: 2 }),
    canLoadFont: () => variant === "with-font",
    loadFont: async () => { events.push("font-load"); return "font-token"; },
    unloadFont: font => { events.push(["font-unload", font]); },
    bitmapMeta: async bitmap => bitmap,
    createBitmap: async blob => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const id = bytes[0] ?? 0;
      events.push(["bitmap", id]);
      return { width: variant === "card-mismatch" && id === 4 ? 100 : 120,
        height: 80, close() { events.push(["bitmap-close", id]); } };
    },
    createObjectUrl: () => { const url = `blob:${urlId++}`;
      events.push(["url", url]); return url; },
    revokeObjectUrl: url => { events.push(["url-revoke", url]); },
  };
  const original = new Function(
    "ts", "dt", "j", "y", "ve", "Y", "Rt", "We", "Wa", "Va",
    "FontFace", "St", "Ce", "$t", "createImageBitmap", "URL", "Blob",
    `return (${originalSource});`,
  )(
    dependencies.layoutDirectory, dependencies.cardDirectory,
    dependencies.parseBml, attribute, dependencies.frameStyle,
    dependencies.childRect, dependencies.frameInnerRect,
    dependencies.parseArrowColor, dependencies.cardLayout,
    dependencies.imageTokens,
    variant === "with-font" ? class FontFaceStub {} : undefined,
    dependencies.loadFont, dependencies.unloadFont,
    dependencies.bitmapMeta, dependencies.createBitmap,
    { createObjectURL: dependencies.createObjectUrl,
      revokeObjectURL: dependencies.revokeObjectUrl }, Blob,
  ) as (library: GaragePreparationAssetLibrary) =>
    Promise<Awaited<ReturnType<typeof loadGaragePreparationAssets>>>;
  let error: string | undefined;
  let snapshot: unknown;
  try {
    const assets = released ? await original(library) :
      await loadGaragePreparationAssets(library, dependencies);
    snapshot = {
      frame: assets.frame, rect: assets.rect, rects: [...assets.rects],
      icons: assets.icons, cardLayout: assets.cardLayout,
      pageArrows: assets.pageArrows,
      pageButtonFrames: [...assets.pageButtonFrames],
      images: [...assets.images.keys()], urls: [...assets.urls],
      font: assets.font, fontFamily: assets.fontFamily,
    };
    assets.dispose();
  } catch (cause) { error = String(cause); }
  return { error, snapshot, events };
}

test("upgrade preparation layout, arrows, images and cleanup match release ja", async () => {
  for (const variant of ["normal", "with-font", "missing-main", "missing-frame",
    "missing-arrow-state", "missing-rect", "missing-arrow", "missing-image",
    "card-mismatch"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
