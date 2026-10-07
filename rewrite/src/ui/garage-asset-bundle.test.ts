import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  loadGarageAssetBundle, type GarageAssetDependencies,
  type GarageAssetLibrary, type GarageAssetNode,
} from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Ui");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

type Variant = "normal" | "with-font" | "duplicate-stage" |
  "missing-selector" | "invalid-grid" | "missing-background" |
  "bitmap-failure";

interface TestNode extends GarageAssetNode { children: TestNode[] }
const node = (name: string, properties: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, children,
    attributes: Object.entries(properties).map(([key, value]) => ({ name: key, value })) });

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const stageDirectory = "stage_/garageX/";
  const definition = node("root", {}, [
    ...(variant === "missing-selector" ? [] :
      [node("Panel", { name: "kartSelector", alignMargin: "7 0", alignSize: "8",
        image: "custom-image" })]),
    node("Panel", { name: "partList", alignMargin: "5 6",
      alignSize: variant === "invalid-grid" ? "0" : "4", maxLine: "3" }),
    node("Panel", { name: "partListBar" }),
    node("Panel", { name: "menuTab", image: "custom-image" }, [
      node("Button", { name: "child", autoLoadImage: "auto_button" }),
    ]),
    node("Panel", { name: "partsDisassemble", image: "excluded-image" }),
  ]);
  const stageStrings = node("root", {}, [node("String", { n: "car" },
    [node("Locale", { c: "cn", v: "赛车" })])]);
  const baseStrings = node("root", {}, [
    node("String", { n: "car" }, [node("Locale", { c: "cn", v: "旧文案" })]),
    node("String", { n: "part" }, [node("Locale", { c: "cn", v: "部件" })]),
  ]);
  const resources = new Map<string, unknown>([
    [`${stageDirectory}stage_1600.bml`, definition],
    [`${stageDirectory}stage_stringBag.bml`, stageStrings],
    ["etc_/baseStringBag.xml", { root: baseStrings }],
    ["etc_/itemTable.kml", { root: node("root", {}, [
      node("partsEngine12", { name: "engine_body", id: "17" }),
    ]) }],
    ["etc_/itemTable@cn.xml", { root: node("root") }],
    ["zeta_/cn/shop/data/item.kml", { root: node("root") }],
    ["gui_/windowTemplate/itemPanels.bml", node("root", {}, [
      node("Kart", { name: "default", zoom: "1.25" }),
    ])],
    ["gui_/windowTemplate/garageXKartCard.bml", node("root", {
      windowRect: "0 0 240 160", texture: "card-texture",
      selectedTexture: "selected-texture",
    })],
    ["gui_/windowTemplate/mqPartsCard.bml", node("classic-card")],
    ["gui_/windowTemplate/mqParts12Card.bml", node("xun-card")],
    ["gui_/monocoque/frame.bml", node("frame")],
    [`${stageDirectory}garage_img_baseBG_1600.png`, new Uint8Array([1, 2, 3])],
    [`${stageDirectory}custom-image.png`, new Uint8Array([4, 5])],
  ]);
  if (variant === "missing-background")
    resources.delete(`${stageDirectory}garage_img_baseBG_1600.png`);
  if (variant === "with-font") resources.set("font.bin", new Uint8Array([3]));
  const entry = (path: string) => ({ sourceName: path,
    async bytes(): Promise<Uint8Array> {
      events.push(["bytes", path]);
      return resources.get(path) as Uint8Array;
    } });
  const library: GarageAssetLibrary = {
    exactCanonicalCandidates(path) {
      if (variant === "duplicate-stage" && path === `${stageDirectory}stage_1600.bml`)
        return [entry(path), entry(path)];
      return resources.has(path) ? [entry(path)] : [];
    },
    canonicalCandidates() {
      return variant === "with-font" ? [entry("font.bin")] : [];
    },
  };
  const attribute = (source: GarageAssetNode, name: string): string | undefined =>
    source.attributes.find(value => value.name === name)?.value;
  let urlId = 0;
  const dependencies: GarageAssetDependencies = {
    normalizeStage: width => ({ width, height: 900 }),
    stageDirectory,
    parseBml: bytes => bytes as unknown as GarageAssetNode,
    parseXml: bytes => bytes as unknown as { root: GarageAssetNode },
    attribute, xmlAttribute: attribute,
    alignPair: text => (text ?? "").trim().split(/\s+/).map(Number),
    partCardLayout: (source, x, y) => ({ name: source.name, x, y }),
    partScrollbar: () => ({ areaFrame: { texture: "scroll-area" },
      buttonFrames: [{ texture: "scroll-button" }] }),
    cosmeticLookup: async () => "cosmetic-lookup",
    loadCosmetics: async () => [],
    loadCoatings: async () => [],
    partSlots: ["engine", "handle", "wheel", "booster"],
    collectParts: () => [],
    partIconKey: () => "unused",
    builtInTextures: [],
    nativeStatePath: (base, state) => `${base}_${state}`,
    lampTexture: "lamp-icon",
    fontResourcePrefix: "font",
    fontResourceName: "font.bin",
    fontFamily: "Garage Font",
    canLoadFont: () => variant === "with-font",
    loadFont: async () => { events.push("font-load"); return "font-token"; },
    unloadFont: font => { events.push(["font-unload", font]); },
    bitmapMeta: async bitmap => bitmap,
    createBitmap: async () => {
      if (variant === "bitmap-failure") throw new Error("bitmap decode failed");
      const bitmap = `bitmap-${events.filter(event => Array.isArray(event) &&
        event[0] === "bitmap").length}`;
      events.push(["bitmap", bitmap]);
      return { close() { events.push(["bitmap-close", bitmap]); } };
    },
    createObjectUrl: () => { const url = `blob:${urlId++}`;
      events.push(["url", url]); return url; },
    revokeObjectUrl: url => { events.push(["url-revoke", url]); },
    childRect: (source, parent) => ({
      x: parent.x + (source.name === "Panel" ? 2 : 1),
      y: parent.y + 1, width: Math.max(0, parent.width - 1),
      height: Math.max(0, parent.height - 1),
    }),
  };
  const original = new Function(
    "_t", "Ve", "j", "Z", "y", "L", "Qe", "qt", "Ms",
    "Rs", "Fs", "Gs", "de", "Bi", "Ss", "Ri", "se", "Ze",
    "Di", "Oi", "FontFace", "St", "zt", "$t", "createImageBitmap",
    "URL", "Blob", "Y", "Ce", `return (${originalSource});`,
  )(
    dependencies.normalizeStage, dependencies.stageDirectory,
    dependencies.parseBml, dependencies.parseXml, attribute, attribute,
    dependencies.alignPair, dependencies.partCardLayout,
    dependencies.partScrollbar, dependencies.loadCosmetics,
    dependencies.cosmeticLookup, dependencies.loadCoatings,
    dependencies.partSlots, dependencies.collectParts,
    dependencies.partIconKey, dependencies.builtInTextures,
    dependencies.nativeStatePath, dependencies.lampTexture,
    dependencies.fontResourcePrefix, dependencies.fontResourceName,
    variant === "with-font" ? class FontFaceStub {} : undefined,
    dependencies.loadFont, dependencies.fontFamily,
    dependencies.bitmapMeta, dependencies.createBitmap,
    { createObjectURL: dependencies.createObjectUrl,
      revokeObjectURL: dependencies.revokeObjectUrl }, Blob,
    dependencies.childRect, dependencies.unloadFont,
  ) as (library: GarageAssetLibrary, width: number) =>
    Promise<Awaited<ReturnType<typeof loadGarageAssetBundle>>>;
  let error: string | undefined;
  let snapshot: unknown;
  try {
    const bundle = released ? await original(library, 1600) :
      await loadGarageAssetBundle(library, 1600, dependencies);
    snapshot = {
      stage: bundle.stage, strings: [...bundle.strings],
      textures: [...bundle.textures.keys()], urls: [...bundle.imageUrls],
      nodes: [...bundle.nodes.keys()], rects: [...bundle.rects],
      parts: bundle.parts, partModels: [...bundle.partModels],
      cosmetics: bundle.cosmetics, coatings: bundle.coatings,
      kartCardLayout: bundle.kartCardLayout,
      partCardLayouts: [...bundle.partCardLayouts],
      partGridLayout: bundle.partGridLayout,
      partScrollbar: bundle.partScrollbar,
      fontFamily: bundle.fontFamily,
    };
    bundle.dispose();
  } catch (cause) { error = String(cause); }
  return { error, snapshot, events };
}

test("Garage asset layout, strings, model paths, textures and cleanup match release Ui", async () => {
  for (const variant of ["normal", "with-font", "duplicate-stage",
    "missing-selector", "invalid-grid", "missing-background",
    "bitmap-failure"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
