export interface GarageAssetNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: GarageAssetNode[];
}

export interface GarageAssetEntry {
  sourceName: string;
  bytes(): Promise<Uint8Array>;
}

export interface GarageAssetLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
  canonicalCandidates(prefix: string): GarageAssetEntry[];
}

export interface GarageAssetRect {
  x: number; y: number; width: number; height: number;
}

export interface GarageAssetBitmap {
  close(): void;
}

export interface GarageAssetDependencies {
  normalizeStage(width: number): { width: number; height: number };
  stageDirectory: string;
  parseBml(bytes: Uint8Array): GarageAssetNode;
  parseXml(bytes: Uint8Array): { root: GarageAssetNode };
  attribute(node: GarageAssetNode, name: string): string | undefined;
  xmlAttribute(node: GarageAssetNode, name: string): string | undefined;
  alignPair(value: string | undefined): number[];
  partCardLayout(node: GarageAssetNode, gapX: number, gapY: number): unknown;
  partScrollbar(node: GarageAssetNode, frame: GarageAssetNode): {
    areaFrame: { texture: string };
    buttonFrames: Array<{ texture: string }>;
  };
  loadCosmetics(library: GarageAssetLibrary, lookup: unknown): Promise<Array<{
    icon?: string;
  }>>;
  cosmeticLookup(library: GarageAssetLibrary): Promise<unknown>;
  loadCoatings(library: GarageAssetLibrary): Promise<Array<{ icon?: string }>>;
  partSlots: readonly string[];
  collectParts(table: GarageAssetNode, shop: GarageAssetNode,
    materials: GarageAssetNode | undefined,
    localization: GarageAssetNode): unknown[];
  partIconKey(part: unknown): string;
  builtInTextures: readonly string[];
  nativeStatePath(base: string, state: number): string;
  lampTexture: string;
  fontResourcePrefix: string;
  fontResourceName: string;
  fontFamily: string;
  canLoadFont(): boolean;
  loadFont(family: string, bytes: Uint8Array): Promise<unknown>;
  unloadFont(font: unknown): void;
  bitmapMeta(bitmap: GarageAssetBitmap): Promise<GarageAssetBitmap>;
  createBitmap(blob: Blob): Promise<GarageAssetBitmap>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  childRect(node: GarageAssetNode, parent: GarageAssetRect,
    frame: undefined, image: GarageAssetBitmap | undefined): GarageAssetRect;
}

const VISIBLE_LAYOUT_NODES = new Set([
  "backGround_1920", "backGround_12", "kartPreview", "karts",
  "kartSelector", "kartKeyword", "directionArrows", "resetKeyword",
  "partsListBoard", "menuTab", "selectedKartName", "selectedKartType",
  "textPerformList", "textPerformList_12", "equipedParts", "equipedParts_12",
  "partsReinforceGrp",
]);

const EXCLUDED_LAYOUT_NODES = new Set([
  "partsDisassemble", "partsComposite", "growthAlert", "growthLock",
]);

function namedDescendant(node: GarageAssetNode, name: string,
  attribute: GarageAssetDependencies["attribute"]): GarageAssetNode | undefined {
  if (attribute(node, "name") === name) return node;
  return node.children.map(child => namedDescendant(child, name, attribute)).find(Boolean);
}

/** Request authored Garage resources, then derive layouts, images, model paths and text. */
export async function loadGarageAssetBundle(library: GarageAssetLibrary,
  stageWidth: number, dependencies: GarageAssetDependencies) {
  const stage = dependencies.normalizeStage(stageWidth);
  const required = (path: string): GarageAssetEntry => {
    const entries = library.exactCanonicalCandidates(path);
    if (entries.length !== 1)
      throw new Error(`车库资源缺失或不唯一：${path}`);
    return entries[0]!;
  };
  const optional = (path: string): GarageAssetEntry | undefined => {
    const entries = library.exactCanonicalCandidates(path);
    if (entries.length > 1) throw new Error(`车库资源重复：${path}`);
    return entries[0];
  };
  const [definition, stageStrings, baseStrings, itemTable, localizedItems,
    shopItems, materialItems, itemPanels, kartCard, classicPartCard,
    xunPartCard, frame] = await Promise.all([
    required(`${dependencies.stageDirectory}stage_${stage.width}.bml`)
      .bytes().then(dependencies.parseBml),
    required(`${dependencies.stageDirectory}stage_stringBag.bml`)
      .bytes().then(dependencies.parseBml),
    required("etc_/baseStringBag.xml").bytes().then(dependencies.parseXml),
    required("etc_/itemTable.kml").bytes().then(dependencies.parseXml),
    required("etc_/itemTable@cn.xml").bytes().then(dependencies.parseXml),
    required("zeta_/cn/shop/data/item.kml").bytes().then(dependencies.parseXml),
    optional("zeta_/cn/enchant/enchantMaterials.xml")?.bytes()
      .then(dependencies.parseXml),
    required("gui_/windowTemplate/itemPanels.bml").bytes().then(dependencies.parseBml),
    required("gui_/windowTemplate/garageXKartCard.bml").bytes()
      .then(dependencies.parseBml),
    required("gui_/windowTemplate/mqPartsCard.bml").bytes()
      .then(dependencies.parseBml),
    required("gui_/windowTemplate/mqParts12Card.bml").bytes()
      .then(dependencies.parseBml),
    required("gui_/monocoque/frame.bml").bytes().then(dependencies.parseBml),
  ]);

  const kartSelector = namedDescendant(definition, "kartSelector",
    dependencies.attribute);
  if (!kartSelector) throw new Error("P3543 车库布局缺少 kartSelector。");
  const [, , cardWidth, cardHeight] =
    (dependencies.attribute(kartCard, "windowRect") ?? "0 0 0 0")
      .split(/\s+/).map(Number);
  const [kartGapX] = dependencies.alignPair(
    dependencies.attribute(kartSelector, "alignMargin"));
  const pageSize = Number(dependencies.attribute(kartSelector, "alignSize"));
  const defaultKart = itemPanels.children.find(node => node.name === "Kart" &&
    dependencies.attribute(node, "name") === "default");
  if (!defaultKart) throw new Error("P3543 ItemPanel 布局缺少 Kart/default。");
  const kartCardLayout = {
    width: cardWidth, height: cardHeight, gapX: kartGapX,
    pageSize, contentAdjustX: 3, contentAdjustY: 4,
    kartZoom: Number(dependencies.attribute(defaultKart, "zoom")),
    texture: dependencies.attribute(kartCard, "texture") ?? "",
    selectedTexture: dependencies.attribute(kartCard, "selectedTexture") ?? "",
  };
  const partList = namedDescendant(definition, "partList", dependencies.attribute);
  if (!partList) throw new Error("P3543 车库布局缺少 partList。");
  const [partGapX, partGapY] = dependencies.alignPair(
    dependencies.attribute(partList, "alignMargin"));
  const partGridLayout = {
    columns: Number(dependencies.attribute(partList, "alignSize")),
    rows: Number(dependencies.attribute(partList, "maxLine")),
  };
  if (!Number.isInteger(partGridLayout.columns) || partGridLayout.columns < 1 ||
      !Number.isInteger(partGridLayout.rows) || partGridLayout.rows < 1)
    throw new Error("P3543 车库 partList 网格尺寸无效。");
  const partCardLayouts = new Map([
    ["classic", dependencies.partCardLayout(classicPartCard, partGapX!, partGapY!)],
    ["xun", dependencies.partCardLayout(xunPartCard, partGapX!, partGapY!)],
  ]);
  const scrollbarNode = namedDescendant(definition, "partListBar",
    dependencies.attribute);
  if (!scrollbarNode) throw new Error("P3543 车库布局缺少 partListBar。");
  const partScrollbar = dependencies.partScrollbar(scrollbarNode, frame);
  const strings = new Map<string | undefined, string>();
  const cosmetics = await dependencies.loadCosmetics(library,
    await dependencies.cosmeticLookup(library));
  const coatings = await dependencies.loadCoatings(library);
  const partModels = new Map<string, string>();
  for (const slot of dependencies.partSlots) {
    const tag = `parts${slot[0]!.toUpperCase()}${slot.slice(1)}12`;
    for (const item of itemTable.root.children.filter(node => node.name === tag)) {
      const model = dependencies.xmlAttribute(item, "name");
      if (model)
        partModels.set(`${slot}:${dependencies.xmlAttribute(item, "id")}`,
          `stuff2_/parts/${model}.1s`);
    }
  }
  for (const entry of stageStrings.children) {
    const localized = entry.children.find(node =>
      dependencies.attribute(node, "c") === "cn");
    if (localized)
      strings.set(dependencies.attribute(entry, "n"),
        dependencies.attribute(localized, "v") ?? "");
  }
  for (const entry of baseStrings.root.children) {
    const key = dependencies.xmlAttribute(entry, "n");
    const localized = entry.children.find(node =>
      dependencies.xmlAttribute(node, "c") === "cn");
    if (key && localized && !strings.has(key))
      strings.set(key, dependencies.xmlAttribute(localized, "v") ?? "");
  }

  const textures = new Map<string, GarageAssetBitmap>();
  const imageUrls = new Map<string, string>();
  const names = new Set<string>([
    `garage_img_baseBG_${stage.width}`,
    `garage_img_baseBG_2_${stage.width}`,
    "garage_img_baseBG_list", "garage_img_baseBG_list_2",
    "garage_img_partsBG1_lock", "img_selectedKart_Normal",
    "garage_img_textCarType2", "garage_kartFuncSlotBg",
    "img_itemTooltopBoxBG",
    ...[1, 2, 3, 4, 5].map(index => `unique${index}_x`),
    ...[1, 2, 3, 4].flatMap(index => [
      `garage_btn_menuTab1_${index}`, `garage_btn_equip_${index}`,
      `garage_btn_preview_${index}`, `garage_btn_partsTab_${index}`,
      `garage_btn_partsDelete_${index}`,
      `garage_btn_partsDelete_2_${index}@zz`, `buttonRed_${index}`,
      `garage_btn_arrowLeft_${index}`, `garage_btn_arrowRight_${index}`,
      `garage_btn_listTab_${index}`,
    ]),
    partScrollbar.areaFrame.texture,
    ...partScrollbar.buttonFrames.map(button => button.texture),
    ...[0, 1, 2, 3, 4, 5].flatMap(index => [
      `uniqueLevel_${index}`, `uniqueLevel_${index}_50x50`,
    ]),
    "turning_enhancedBG",
    ...[1, 2, 3, 4, 5].map(index => `tuning_mark_s_${index}`),
  ]);
  dependencies.builtInTextures.forEach(name => names.add(name));
  for (let state = 1; state <= 5; state++)
    names.add(dependencies.nativeStatePath("garage_check_0", state));
  names.add(dependencies.lampTexture);
  names.add(kartCardLayout.texture);
  names.add(kartCardLayout.selectedTexture);

  const collectTextures = (node: GarageAssetNode, inherited = false): void => {
    const name = dependencies.attribute(node, "name") ?? "";
    const frameName = dependencies.attribute(node, "frame");
    if (EXCLUDED_LAYOUT_NODES.has(name) ||
        (frameName && frameName !== "NoFrame")) return;
    const visible = inherited || VISIBLE_LAYOUT_NODES.has(name);
    if (visible) {
      for (const key of ["image", "texture"]) {
        const texture = dependencies.attribute(node, key);
        if (texture) names.add(texture);
      }
      const loadImage = dependencies.attribute(node, "autoLoadImage");
      if (loadImage)
        for (let state = 1; state <= 4; state++)
          names.add(dependencies.nativeStatePath(loadImage, state));
      const autoImage = dependencies.attribute(node, "autoImage");
      if (autoImage)
        for (let state = 1; state <= 5; state++)
          names.add(dependencies.nativeStatePath(autoImage, state));
    }
    node.children.forEach(child => collectTextures(child, visible));
  };
  collectTextures(definition);

  const parts = dependencies.collectParts(itemTable.root, shopItems.root,
    materialItems?.root, localizedItems.root);
  for (const part of parts) names.add(dependencies.partIconKey(part));
  for (const item of [...cosmetics, ...coatings])
    if (item.icon) names.add(`parts:${item.icon.slice(14, -4)}`);
  names.add("parts:partsTailLamp_0");
  names.add("parts:partsTailLamp12_0");

  let font: unknown;
  try {
    const fontResource = library.canonicalCandidates(dependencies.fontResourcePrefix)
      .find(entry => entry.sourceName.toLowerCase() ===
        dependencies.fontResourceName);
    if (fontResource && dependencies.canLoadFont())
      font = await dependencies.loadFont(dependencies.fontFamily,
        await fontResource.bytes());
    const loaded = await Promise.allSettled([...names].map(async name => {
      const localizedName = name.replace(/@zz$/, "@cn");
      const cardTexture = name === kartCardLayout.texture ||
        name === kartCardLayout.selectedTexture;
      const tuningTexture = name === "turning_enhancedBG" ||
        /^tuning_mark_s_[1-5]$/.test(name);
      const paths = name === dependencies.lampTexture ?
        ["gui_/windowTemplate/unique5_x.png"] :
        name.startsWith("parts:") ?
          [`stuff2_/parts/${name.slice(6)}.png`] :
          name.startsWith("legacy:") ? [`${name.slice(7)}.png`] :
            cardTexture || tuningTexture ? [
              `gui_/windowTemplate/${localizedName}.png`,
              `gui_/windowTemplate/${name}.png`,
            ] : [
              `${dependencies.stageDirectory}${localizedName}.png`,
              `${dependencies.stageDirectory}${name}.png`,
              `stage_/common/${localizedName}.png`,
              `stage_/common/${name}.png`,
              `gui_/monocoque/${localizedName}.png`,
              `gui_/monocoque/${name}.png`,
            ];
      const entry = paths.map(path => library.exactCanonicalCandidates(path)[0])
        .find(Boolean);
      if (!entry) return;
      const blob = new Blob([new Uint8Array(await entry.bytes())],
        { type: "image/png" });
      textures.set(name, await dependencies.bitmapMeta(
        await dependencies.createBitmap(blob)));
      imageUrls.set(name, dependencies.createObjectUrl(blob));
    }));
    const failed = loaded.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    if (!textures.has(`garage_img_baseBG_${stage.width}`))
      throw new Error("P3543 车库背景缺失。");

    const rects = new Map<string, GarageAssetRect>();
    const nodes = new Map<string, GarageAssetNode>();
    const containsVisibleNode = (node: GarageAssetNode): boolean =>
      VISIBLE_LAYOUT_NODES.has(dependencies.attribute(node, "name") ?? "") ||
      node.children.some(containsVisibleNode);
    const collectRects = (node: GarageAssetNode, parent: GarageAssetRect,
      parentPath: string, inherited = false): void => {
      const name = dependencies.attribute(node, "name");
      const frameName = dependencies.attribute(node, "frame");
      if (EXCLUDED_LAYOUT_NODES.has(name ?? "") ||
          (frameName && frameName !== "NoFrame") ||
          (!inherited && !containsVisibleNode(node))) return;
      const visible = inherited || VISIBLE_LAYOUT_NODES.has(name ?? "");
      const texture = dependencies.attribute(node, "image") ??
        dependencies.attribute(node, "texture") ??
        dependencies.nativeStatePath(
          dependencies.attribute(node, "autoLoadImage") ?? "", 1);
      const rectNode = frameName === "NoFrame" ? {
        ...node,
        attributes: node.attributes.filter(entry => entry.name !== "frame"),
      } : node;
      const rect = dependencies.childRect(rectNode, parent, undefined,
        textures.get(texture));
      const path = name ? `${parentPath}/${name}` : parentPath;
      if (name) {
        rects.set(path, rect);
        nodes.set(path, node);
        if (!rects.has(name)) {
          rects.set(name, rect);
          nodes.set(name, node);
        }
      }
      node.children.forEach(child => collectRects(child, rect, path, visible));
    };
    collectRects(definition, { x: 0, y: 0,
      width: stage.width, height: stage.height }, "");
    return {
      stage, definition, strings, textures, imageUrls, nodes, rects,
      parts, partModels, cosmetics, coatings, kartCardLayout,
      partCardLayouts, partGridLayout, partScrollbar,
      fontFamily: font ? dependencies.fontFamily : undefined,
      dispose() {
        if (font) { dependencies.unloadFont(font); font = undefined; }
        textures.forEach(bitmap => bitmap.close());
        textures.clear();
        imageUrls.forEach(url => dependencies.revokeObjectUrl(url));
        imageUrls.clear();
      },
    };
  } catch (error) {
    if (font) dependencies.unloadFont(font);
    textures.forEach(bitmap => bitmap.close());
    imageUrls.forEach(url => dependencies.revokeObjectUrl(url));
    throw error;
  }
}
