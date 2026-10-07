import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  loadGarageUpgradeAssets, type GarageUpgradeAssetsDependencies,
  type GarageUpgradeAssetsLibrary,
} from "./garage-upgrade-assets";
import type { GarageAssetNode } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "ia");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

interface TestNode extends GarageAssetNode { children: TestNode[] }
const node = (name: string, properties: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, children,
    attributes: Object.entries(properties).map(([key, value]) => ({ name: key, value })) });
const attribute = (source: GarageAssetNode, name: string): string | undefined =>
  source.attributes.find(value => value.name === name)?.value;

type Variant = "normal" | "with-font" | "missing-focused" |
  "missing-item-panel" | "missing-background" | "missing-skill" |
  "bitmap-failure";

async function run(released: boolean, mode: "tuning" | "kartune",
  variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const directory = `stage_/${mode}/`;
  const definition = node("root", {}, [
    node("Panel", { name: "menuTab", texture: "skipped" }),
    node("Panel", { name: "main", image: "custom-image" }, [
      node("Label", { text: "#sb(tuneState)", frame: "NoFrame" }),
      node("Panel", { name: "SomePopup", texture: "popup" }),
    ]),
  ]);
  const frames = node("frame", {}, [
    node("DefaultAlphaStaticButton", {}, [node("normal", { texture: "frame-img" })]),
    ...(variant === "missing-focused" ? [] :
      [node("DefaultFocusedButton", {},
        [node("Normal", { texture: "focus-img" })])]),
  ]);
  const itemCard = node("card", {}, [node("Image", { image: "card-img" })]);
  const resources = new Map<string, unknown>([
    [`${directory}stage_1600.bml`, definition],
    [`${directory}stage_stringBag.bml`, node("strings", {}, [
      node("String", { n: "status" }, [node("Locale", { c: "cn", v: "状态" })]),
    ])],
    ["gui_/monocoque/frame.bml", frames],
    ["gui_/windowTemplate/tuneItemCard.bml", itemCard],
    ["gui_/windowTemplate/itemPanels.bml", node("root", {},
      variant === "missing-item-panel" ? [] : [node("Kart", { name: "default" })])],
    ["etc_/baseStringBag.xml", { root: node("root", {}, [
      node("String", { n: "base" }, [node("Locale", { c: "cn", v: "基本" })]),
    ]) }],
    ["etc_/itemInfoColorByLevel.xml", { root: node("root", {}, [
      node("Colors", { name: "itemNameLabel" }, [
        node("Color", { grade: "3", color: "255 1 2 3" }),
      ]),
    ]) }],
    ["zeta_/cn/enchant/desc.xml", { root: node("TuneAbility") }],
    ["zeta_/cn/engine/exceedTypeChange.xml", { root: node("exceed") }],
    [`${directory}${mode === "tuning" ? "garage_img_floterBG_1600" :
      "garage_img_tuningBG_1600"}.png`, new Uint8Array([1, 2, 3])],
    [`${directory}custom-image.png`, new Uint8Array([4])],
    [`${directory}skill-icon.png`, new Uint8Array([5])],
    [`${directory}exceed-icon.png`, new Uint8Array([6])],
  ]);
  if (variant === "missing-background")
    resources.delete(`${directory}${mode === "tuning" ?
      "garage_img_floterBG_1600" : "garage_img_tuningBG_1600"}.png`);
  if (variant === "missing-skill") resources.delete(`${directory}skill-icon.png`);
  if (variant === "with-font") resources.set("gui_/font/SourceHanSansCN-Bold.otf",
    new Uint8Array(12));
  const entry = (path: string) => ({ sourceName: path,
    async bytes(): Promise<Uint8Array> {
      events.push(["bytes", path]);
      return resources.get(path) as Uint8Array;
    } });
  const library: GarageUpgradeAssetsLibrary = {
    exactCanonicalCandidates(path) {
      return resources.has(path) ? [entry(path)] : [];
    },
  };
  let urlId = 0;
  const dependencies: GarageUpgradeAssetsDependencies = {
    normalizeStage: width => ({ width, height: 900 }),
    parseBml: bytes => bytes as unknown as GarageAssetNode,
    parseXml: bytes => bytes as unknown as { root: GarageAssetNode },
    attribute, xmlAttribute: attribute,
    frameStyle: source => ({ texture: attribute(source, "texture") ?? "" }),
    parseEnchantDescriptions: () => new Map([[101, "skill"]]),
    parseExceedChange: () => ({ types: new Map([[1, "exceed"]]) }),
    nativeStatePath: (base, state) => `${base}_${state}`,
    skillTextures: ["skill-icon"], exceedTextures: ["exceed-icon"],
    loadFont: async () => { events.push("font-load"); return "font-token"; },
    unloadFont: font => { events.push(["font-unload", font]); },
    createBitmap: async () => {
      if (variant === "bitmap-failure") throw new Error("bitmap decode failed");
      const id = `bitmap:${events.filter(value => Array.isArray(value) &&
        value[0] === "bitmap").length}`;
      events.push(["bitmap", id]);
      return { close() { events.push(["bitmap-close", id]); } };
    },
    createObjectUrl: () => { const url = `blob:${urlId++}`;
      events.push(["url", url]); return url; },
    revokeObjectUrl: url => { events.push(["url-revoke", url]); },
    childRect: (source, parent) => ({ x: parent.x + 2, y: parent.y + 3,
      width: Math.max(0, parent.width - 1),
      height: Math.max(0, parent.height - 1),
      node: source.name }),
  };
  const original = new Function(
    "_t", "j", "Z", "y", "L", "ve", "ea", "sa", "se", "Vt", "Ht",
    "St", "createImageBitmap", "URL", "Blob", "Y", "Ce",
    `return (${originalSource});`,
  )(
    dependencies.normalizeStage, dependencies.parseBml, dependencies.parseXml,
    attribute, attribute, dependencies.frameStyle,
    dependencies.parseEnchantDescriptions, dependencies.parseExceedChange,
    dependencies.nativeStatePath, dependencies.skillTextures,
    dependencies.exceedTextures, dependencies.loadFont,
    dependencies.createBitmap, {
      createObjectURL: dependencies.createObjectUrl,
      revokeObjectURL: dependencies.revokeObjectUrl,
    }, Blob, dependencies.childRect, dependencies.unloadFont,
  ) as (library: GarageUpgradeAssetsLibrary, mode: string, width: number) =>
    Promise<Awaited<ReturnType<typeof loadGarageUpgradeAssets>>>;
  let error: string | undefined;
  let snapshot: unknown;
  try {
    const assets = released ? await original(library, mode, 1600) :
      await loadGarageUpgradeAssets(library, mode, 1600, dependencies);
    snapshot = {
      stage: assets.stage, rects: [...assets.rects],
      nodes: [...assets.nodes.keys()], images: [...assets.images.keys()],
      urls: [...assets.urls], strings: [...assets.strings],
      actionFrames: [...assets.actionFrames], windowFrames: [...assets.windowFrames],
      qualityColors: [...assets.qualityColors],
      enchantDescriptions: assets.enchantDescriptions,
      exceedTypes: assets.exceedTypes,
      exceedTypeChange: assets.exceedTypeChange,
      fontFamily: assets.fontFamily, fontLineScale: assets.fontLineScale,
    };
    assets.dispose();
  } catch (cause) { error = String(cause); }
  return { error, snapshot, events };
}

test("tuning and kartune layouts, strings, skins, textures and cleanup match release ia", async () => {
  const cases: Array<["tuning" | "kartune", Variant]> = [
    ["tuning", "normal"], ["tuning", "with-font"],
    ["tuning", "missing-focused"], ["tuning", "missing-item-panel"],
    ["tuning", "missing-background"], ["tuning", "bitmap-failure"],
    ["kartune", "normal"], ["kartune", "missing-skill"],
    ["kartune", "missing-background"],
  ];
  for (const [mode, variant] of cases)
    assert.deepEqual(await run(false, mode, variant),
      await run(true, mode, variant), `${mode}/${variant}`);
});
