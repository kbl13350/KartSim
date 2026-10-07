import type { GarageAssetNode, GarageAssetRect, GarageAssetEntry } from
  "./garage-asset-bundle";

export interface GaragePreparationAssetLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
}

export interface GaragePreparationBitmap {
  width: number; height: number; close(): void;
}

export interface GaragePreparationAssetDependencies {
  layoutDirectory: string;
  cardDirectory: string;
  imageTokens: readonly string[];
  parseBml(bytes: Uint8Array): GarageAssetNode;
  attribute(node: GarageAssetNode, name: string): string | undefined;
  frameStyle(node: GarageAssetNode): { texture: string };
  childRect(node: GarageAssetNode, parent: GarageAssetRect,
    frame?: { texture: string }): GarageAssetRect;
  frameInnerRect(frame: { texture: string }, rect: GarageAssetRect): GarageAssetRect;
  parseArrowColor(value: string | undefined, label: string): unknown;
  cardLayout(selector: GarageAssetNode, card: GarageAssetNode): {
    width: number; height: number; [key: string]: unknown;
  };
  canLoadFont(): boolean;
  loadFont(family: string, bytes: Uint8Array): Promise<unknown>;
  unloadFont(font: unknown): void;
  bitmapMeta(bitmap: GaragePreparationBitmap): Promise<GaragePreparationBitmap>;
  createBitmap(blob: Blob): Promise<GaragePreparationBitmap>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}

const REQUIRED_RECTS = [
  "ImageBoard", "tuningTargetLabel", "itemView", "curLevel", "nextLevel",
  "tuningSlotLabel", "curSlotNum", "nextSlotNum", "tuningPointLabel",
  "curTp", "nextTp", "kartList", "kartSelector", "levelUpStart",
];

/** Load the authored pre-upgrade dialog, card art and native page arrows. */
export async function loadGaragePreparationAssets(
  library: GaragePreparationAssetLibrary,
  dependencies: GaragePreparationAssetDependencies,
) {
  const required = (path: string): GarageAssetEntry => {
    const candidates = library.exactCanonicalCandidates(path);
    if (candidates.length !== 1)
      throw new Error(`强化前窗口资源缺失或不唯一：${path}`);
    return candidates[0]!;
  };
  const definition = dependencies.parseBml(await required(
    `${dependencies.layoutDirectory}kart12TuningLevelUp@zz.bml`).bytes());
  const card = dependencies.parseBml(await required(
    `${dependencies.cardDirectory}kart12TuningLevelUpCard.bml`).bytes());
  const main = definition.children.find(node =>
    dependencies.attribute(node, "name") === "kartLevelUp");
  if (!main) throw new Error("强化前窗口缺少 kartLevelUp。");
  const frameDocument = dependencies.parseBml(await required(
    "gui_/monocoque/frame.bml").bytes());
  const dialogFrame = frameDocument.children.find(node =>
    node.name === dependencies.attribute(main, "frame"))?.children[0];
  if (!dialogFrame) throw new Error("强化前窗口缺少 CaptionDialog。");
  const frame = dependencies.frameStyle(dialogFrame);
  const arrowFrames = frameDocument.children.find(node =>
    node.name === "BorderLineStaticButton");
  if (!arrowFrames)
    throw new Error("强化车辆翻页按钮缺少 BorderLineStaticButton。");
  const pageButtonFrames = new Map<string, { texture: string }>();
  for (const [nativeName, state] of [
    ["Normal", "normal"], ["MouseOn", "hover"],
    ["Clicked", "clicked"], ["Disabled", "disabled"],
  ] as const) {
    const button = arrowFrames.children.find(node => node.name === nativeName);
    if (!button)
      throw new Error(`强化车辆翻页按钮缺少 ${nativeName} 状态。`);
    const style = dependencies.frameStyle(button);
    if (style.texture !== frame.texture)
      throw new Error("强化车辆翻页按钮与窗口使用了不同图集，尚未装载。");
    pageButtonFrames.set(state, style);
  }
  const rect = dependencies.childRect(main,
    { x: 0, y: 0, width: 1600, height: 900 }, frame);
  const rects = new Map<string, GarageAssetRect>();
  const icons: Array<{ token: string; rect: GarageAssetRect }> = [];
  const pageArrows: Array<{
    name: string; direction: string; color: unknown;
    hoverColor: unknown; clickedColor: unknown; disabledColor: unknown;
  }> = [];
  let selector: GarageAssetNode | undefined;
  const collectRects = (node: GarageAssetNode, parent: GarageAssetRect): void => {
    const name = dependencies.attribute(node, "name");
    const adjusted = name === "kartSelector" &&
        dependencies.attribute(node, "windowSize") === "0 0 400 400" ? {
          ...node,
          attributes: node.attributes.map(entry => entry.name === "windowSize" ?
            { ...entry, value: "0 0" } : entry),
        } : node;
    const frameName = dependencies.attribute(node, "frame");
    const frameNode = frameName && frameDocument.children.find(group =>
      group.name === frameName)?.children[0];
    const style = frameNode ? dependencies.frameStyle(frameNode) : undefined;
    const bounds = dependencies.childRect(adjusted, parent, style);
    const text = dependencies.attribute(node, "text");
    const alias = text === "#sb(tuningSlotNum)" ? "tuningSlotLabel" :
      text === "#sb(tuningPoint)" ? "tuningPointLabel" :
        text === "#sb(tuningTargetKart)" && !rects.has("tuningTargetLabel") ?
          "tuningTargetLabel" : undefined;
    const key = name ?? alias ?? node.name;
    if (key === "kartSelector") selector = node;
    if (key === "preItemList" || key === "nextItemList") {
      const direction = dependencies.attribute(node, "arrowDir");
      if (direction !== "left" && direction !== "right")
        throw new Error(`${key} 缺少原生箭头方向。`);
      pageArrows.push({
        name: key, direction,
        color: dependencies.parseArrowColor(
          dependencies.attribute(node, "arrowColor"), `${key} arrowColor`),
        hoverColor: dependencies.parseArrowColor(
          dependencies.attribute(node, "overArrowColor"), `${key} overArrowColor`),
        clickedColor: dependencies.parseArrowColor(
          dependencies.attribute(node, "clickedArrowColor"),
          `${key} clickedArrowColor`),
        disabledColor: dependencies.parseArrowColor(
          dependencies.attribute(node, "disabledArrowColor"),
          `${key} disabledArrowColor`),
      });
    }
    const texture = dependencies.attribute(node, "texture");
    if (texture === "icon_ethisChipset" || texture === "icon_lucci")
      icons.push({ token: texture, rect: bounds });
    rects.set(key, bounds);
    node.children.forEach(child => collectRects(child,
      style ? dependencies.frameInnerRect(style, bounds) : bounds));
  };
  main.children.forEach(node => collectRects(node,
    dependencies.frameInnerRect(frame, rect)));
  for (const name of REQUIRED_RECTS)
    if (!rects.has(name)) throw new Error(`强化前窗口缺少 ${name}。`);
  if (!selector) throw new Error("强化前窗口缺少 kartSelector 定义。");
  if (pageArrows.length !== 2)
    throw new Error("强化车辆翻页箭头定义不完整。");
  const cardLayout = dependencies.cardLayout(selector, card);
  const normalTexture = dependencies.attribute(card, "texture");
  const selected = card.children.find(node =>
    dependencies.attribute(node, "name") === "selected");
  const selectedTexture = selected && dependencies.attribute(selected, "texture");
  if (!normalTexture || !selectedTexture)
    throw new Error("强化车辆卡片缺少普通或选中贴图映射。");

  const images = new Map<string, GaragePreparationBitmap>();
  const urls = new Map<string, string>();
  let font: unknown;
  const fontFamily = "P3543 Garage Upgrade";
  const dispose = () => {
    images.forEach(image => image.close());
    images.clear();
    urls.forEach(url => dependencies.revokeObjectUrl(url));
    urls.clear();
    if (font) { dependencies.unloadFont(font); font = undefined; }
  };
  try {
    const fontResource = library.exactCanonicalCandidates(
      "gui_/font/SourceHanSansCN-Bold.otf")[0];
    if (fontResource && dependencies.canLoadFont())
      font = await dependencies.loadFont(fontFamily, await fontResource.bytes());
    const requestedImages = [
      ...dependencies.imageTokens.map(token => ({
        token, path: `${dependencies.layoutDirectory}${token}.png`,
      })),
      { token: "frame", path: `gui_/monocoque/${frame.texture}.png` },
      { token: "cardNormal",
        path: `${dependencies.cardDirectory}${normalTexture}.png` },
      { token: "cardSelected",
        path: `${dependencies.cardDirectory}${selectedTexture}.png` },
    ];
    const settled = await Promise.allSettled(requestedImages.map(async image => {
      const blob = new Blob([new Uint8Array(
        await required(image.path).bytes())], { type: "image/png" });
      images.set(image.token, await dependencies.bitmapMeta(
        await dependencies.createBitmap(blob)));
      urls.set(image.token, dependencies.createObjectUrl(blob));
    }));
    const failed = settled.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    for (const token of ["cardNormal", "cardSelected"]) {
      const image = images.get(token)!;
      if (image.width !== cardLayout.width || image.height !== cardLayout.height)
        throw new Error(`强化车辆卡片 ${token} 尺寸与 BML 不一致。`);
    }
    return {
      frame, rect, rects, icons, cardLayout, pageArrows,
      pageButtonFrames, images, urls,
      font, fontFamily: font ? fontFamily : undefined,
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
