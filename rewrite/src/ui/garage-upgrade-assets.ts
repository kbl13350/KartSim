import type { GarageAssetNode, GarageAssetRect, GarageAssetEntry,
  GarageAssetBitmap } from "./garage-asset-bundle";

export interface GarageUpgradeAssetsLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
}

export interface GarageUpgradeAssetsDependencies {
  normalizeStage(width: number): { width: number; height: number };
  parseBml(bytes: Uint8Array): GarageAssetNode;
  parseXml(bytes: Uint8Array): { root: GarageAssetNode };
  attribute(node: GarageAssetNode, key: string): string | undefined;
  xmlAttribute(node: GarageAssetNode, key: string): string | undefined;
  frameStyle(node: GarageAssetNode): { texture: string };
  parseEnchantDescriptions(root: GarageAssetNode): unknown;
  parseExceedChange(root: GarageAssetNode): { types: unknown };
  nativeStatePath(base: string, state: number): string;
  skillTextures: readonly string[];
  exceedTextures: readonly string[];
  loadFont(family: string, bytes: Uint8Array): Promise<unknown>;
  unloadFont(font: unknown): void;
  createBitmap(blob: Blob): Promise<GarageAssetBitmap>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  childRect(node: GarageAssetNode, parent: GarageAssetRect,
    frame: undefined, image: GarageAssetBitmap | undefined): GarageAssetRect;
}

const SKIPPED_TEXTURE_SUBTREES = new Set(["menuTab", "backGround_1920"]);

/** Load native tuning/kartune layouts, skins, localized text, textures and font metrics. */
export async function loadGarageUpgradeAssets(
  library: GarageUpgradeAssetsLibrary,
  mode: string,
  stageWidth: number,
  dependencies: GarageUpgradeAssetsDependencies,
) {
  const stage = dependencies.normalizeStage(stageWidth);
  const directory = `stage_/${mode}/`;
  const requiredBml = async (path: string): Promise<GarageAssetNode> => {
    const candidates = library.exactCanonicalCandidates(path);
    if (candidates.length !== 1)
      throw new Error(`车辆升级资源缺失或不唯一：${path}`);
    return dependencies.parseBml(await candidates[0]!.bytes());
  };
  const [definition, stageStrings, itemCard, frames] = await Promise.all([
    requiredBml(`${directory}stage_${stage.width}.bml`),
    requiredBml(`${directory}stage_stringBag.bml`),
    mode === "tuning" ? requiredBml("gui_/windowTemplate/tuneItemCard.bml") :
      undefined,
    requiredBml("gui_/monocoque/frame.bml"),
  ]);

  const actionFrames = new Map<string, { texture: string }>();
  const windowFrames = new Map<string, { texture: string }>();
  for (const group of ["DefaultAlphaStaticButton", "TextButton", "ComboBox",
    "ComboList"]) {
    const row = frames.children.find(node => node.name === group);
    for (const child of row?.children ?? [])
      windowFrames.set(`${group}/${child.name}`, dependencies.frameStyle(child));
  }
  const focused = frames.children.find(node =>
    node.name === "DefaultFocusedButton");
  if (!focused && mode === "tuning")
    throw new Error("改装页面缺少 DefaultFocusedButton 原版皮肤。");
  for (const child of focused?.children ?? [])
    actionFrames.set(child.name, dependencies.frameStyle(child));

  const strings = new Map<string | undefined, string>();
  const qualityColors = new Map<number, string>();
  let enchantDescriptions: unknown;
  let exceedTypes: unknown;
  let exceedTypeChange: { types: unknown } | undefined;
  if (mode === "kartune") {
    const descriptions = library.exactCanonicalCandidates(
      "zeta_/cn/enchant/desc.xml")[0];
    const changes = library.exactCanonicalCandidates(
      "zeta_/cn/engine/exceedTypeChange.xml")[0];
    if (descriptions)
      enchantDescriptions = dependencies.parseEnchantDescriptions(
        dependencies.parseXml(await descriptions.bytes()).root);
    if (changes) {
      exceedTypeChange = dependencies.parseExceedChange(
        dependencies.parseXml(await changes.bytes()).root);
      exceedTypes = exceedTypeChange.types;
    }
  }
  if (mode === "tuning") {
    const baseStrings = library.exactCanonicalCandidates(
      "etc_/baseStringBag.xml")[0];
    if (baseStrings)
      for (const row of dependencies.parseXml(await baseStrings.bytes()).root.children) {
        const localized = row.children.find(node =>
          dependencies.xmlAttribute(node, "c") === "cn");
        if (localized)
          strings.set(dependencies.xmlAttribute(row, "n"),
            dependencies.xmlAttribute(localized, "v") ?? "");
      }
    const colorTable = library.exactCanonicalCandidates(
      "etc_/itemInfoColorByLevel.xml")[0];
    if (colorTable) {
      const labels = dependencies.parseXml(await colorTable.bytes()).root.children
        .find(node => dependencies.xmlAttribute(node, "name") === "itemNameLabel");
      for (const color of labels?.children ?? [])
        qualityColors.set(Number(dependencies.xmlAttribute(color, "grade")),
          `rgb(${dependencies.xmlAttribute(color, "color")!
            .split(/\s+/).slice(1).join(",")})`);
    }
  }
  for (const row of stageStrings.children) {
    const localized = row.children.find(node =>
      dependencies.attribute(node, "c") === "cn");
    if (localized)
      strings.set(dependencies.attribute(row, "n"),
        dependencies.attribute(localized, "v") ?? "");
  }

  const rects = new Map<string, GarageAssetRect>();
  const nodes = new Map<string, GarageAssetNode>();
  if (mode === "tuning") {
    const itemPanels = await requiredBml("gui_/windowTemplate/itemPanels.bml");
    const defaultKart = itemPanels.children.find(node => node.name === "Kart" &&
      dependencies.attribute(node, "name") === "default");
    if (!defaultKart)
      throw new Error("改装页面缺少原版 Kart ItemPanel 配置。");
    nodes.set("factoryKartItemPanel", defaultKart);
  }
  const images = new Map<string, GarageAssetBitmap>();
  const urls = new Map<string, string>();
  let font: unknown;
  let fontLineScale: number | undefined;
  const imageNames = new Set<string>();
  const collectTextures = (node: GarageAssetNode): void => {
    if (SKIPPED_TEXTURE_SUBTREES.has(dependencies.attribute(node, "name") ?? ""))
      return;
    for (const key of ["texture", "image"]) {
      const image = dependencies.attribute(node, key);
      if (image) imageNames.add(image);
    }
    const loadImage = dependencies.attribute(node, "autoLoadImage");
    if (loadImage)
      for (let state = 1; state <= 4; state++)
        imageNames.add(dependencies.nativeStatePath(loadImage, state));
    node.children.forEach(collectTextures);
  };
  collectTextures(definition);
  actionFrames.forEach(frame => imageNames.add(frame.texture));
  windowFrames.forEach(frame => imageNames.add(frame.texture));
  if (itemCard) collectTextures(itemCard);
  if (mode === "kartune") {
    dependencies.skillTextures.forEach(name => imageNames.add(name));
    dependencies.exceedTextures.forEach(name => imageNames.add(name));
  }

  try {
    if (mode === "tuning") {
      const fontResource = library.exactCanonicalCandidates(
        "gui_/font/SourceHanSansCN-Bold.otf")[0];
      if (fontResource) {
        const bytes = await fontResource.bytes();
        const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let unitsPerEm = 0;
        let lineHeight = 0;
        for (let index = 0; index < data.getUint16(4); index++) {
          const offset = 12 + index * 16;
          const tag = String.fromCharCode(...bytes.slice(offset, offset + 4));
          const tableOffset = data.getUint32(offset + 8);
          if (tag === "head") unitsPerEm = data.getUint16(tableOffset + 18);
          if (tag === "hhea") lineHeight = data.getInt16(tableOffset + 4) -
            data.getInt16(tableOffset + 6) + data.getInt16(tableOffset + 8);
        }
        if (unitsPerEm && lineHeight) fontLineScale = lineHeight / unitsPerEm;
        font = await dependencies.loadFont("P3543 Factory", bytes);
      }
    }
    const settled = await Promise.allSettled([...imageNames].map(async name => {
      const candidates = [name.replace(/@zz$/, "@cn"), name];
      const entry = [directory, "stage_/common/", "stage_/garageX/",
        "gui_/windowTemplate/", "gui_/monocoque/",
        "dialog2_/exceedTypeChange/"]
        .flatMap(prefix => candidates.map(image => `${prefix}${image}.png`))
        .map(path => library.exactCanonicalCandidates(path)[0]).find(Boolean);
      if (!entry) return;
      const blob = new Blob([new Uint8Array(await entry.bytes())],
        { type: "image/png" });
      images.set(name, await dependencies.createBitmap(blob));
      urls.set(name, dependencies.createObjectUrl(blob));
    }));
    const failed = settled.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    if (mode === "kartune" &&
        dependencies.skillTextures.some(name => !images.has(name)))
      throw new Error("车辆升级技能图标或强化条缺失。");
    if (mode === "kartune" &&
        dependencies.exceedTextures.some(name => !images.has(name)))
      throw new Error("超负荷类型图标资源缺失。");
    if (!images.has(mode === "kartune" ?
      `garage_img_tuningBG_${stage.width}` :
      `garage_img_floterBG_${stage.width}`))
      throw new Error("车辆改装/升级背景缺失。");

    const collectRects = (node: GarageAssetNode, parent: GarageAssetRect,
      parentPath: string): void => {
      const name = dependencies.attribute(node, "name");
      if (SKIPPED_TEXTURE_SUBTREES.has(name ?? "") || node.name === "Dialog" ||
          /Popup|Dialog/.test(name ?? "")) return;
      const texture = dependencies.attribute(node, "image") ??
        dependencies.attribute(node, "texture") ??
        dependencies.nativeStatePath(
          dependencies.attribute(node, "autoLoadImage") ?? "", 1);
      const withoutFrame = {
        ...node,
        attributes: node.attributes.filter(attribute => attribute.name !== "frame"),
      };
      const rect = dependencies.childRect(withoutFrame, parent, undefined,
        images.get(texture));
      const path = name ? `${parentPath}/${name}` : parentPath;
      if (name) {
        rects.set(path, rect);
        nodes.set(path, node);
        if (!rects.has(name)) { rects.set(name, rect); nodes.set(name, node); }
      }
      const text = dependencies.attribute(node, "text");
      if (!name && text?.startsWith("#sb(")) {
        const textPath = `${parentPath}/@text:${text}`;
        rects.set(textPath, rect);
        nodes.set(textPath, node);
      }
      if (!name && text === "#sb(tuneState)") {
        rects.set("tuneStateCaption", rect);
        nodes.set("tuneStateCaption", node);
      }
      node.children.forEach(child => collectRects(child, rect, path));
    };
    collectRects(definition, { x: 0, y: 0,
      width: stage.width, height: stage.height }, "");
    if (itemCard)
      collectRects(itemCard, { x: 0, y: 0, width: 192, height: 114 },
        "/factoryCard");
    return {
      stage, rects, nodes, images, urls, strings, actionFrames, windowFrames,
      qualityColors, enchantDescriptions, exceedTypes, exceedTypeChange,
      fontFamily: font ? "P3543 Factory" : undefined,
      fontLineScale,
      dispose() {
        if (font) { dependencies.unloadFont(font); font = undefined; }
        images.forEach(image => image.close());
        images.clear();
        urls.forEach(url => dependencies.revokeObjectUrl(url));
        urls.clear();
      },
    };
  } catch (error) {
    if (font) dependencies.unloadFont(font);
    images.forEach(image => image.close());
    urls.forEach(url => dependencies.revokeObjectUrl(url));
    throw error;
  }
}
