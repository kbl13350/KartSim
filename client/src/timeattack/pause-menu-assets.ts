import type { PauseHit, PauseMenuAssets } from "./pause-menu-view";

export const PAUSE_VIEW_WIDTH = 1600;
export const PAUSE_VIEW_HEIGHT = 900;
export const PAUSE_FONT_FAMILY = "P3528 Source Han Sans CN Pause";

const paths = {
  retryDialog: "stage_/speedIndiGame/retryPopup_2btn.bml",
  retryArchive: "stage_speedIndiGame.rho",
  commonArchive: "stage_common.rho",
  commonImages: "stage_/common",
  frameImage: "gui_/monocoque/frame01.png",
  frameLayout: "gui_/monocoque/frame.bml",
  frameConfig: "gui_/monocoque/config.bml",
  frameArchive: "gui_monocoque.rho",
  font: "gui_/font/SourceHanSansCN-Bold.otf",
  fontArchive: "gui_font.rho",
  strings: "etc_/baseStringBag.xml",
} as const;

export interface PauseResource {
  sourceKind: string;
  sourceName: string;
  virtualPath: string;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface PauseResourceLibrary {
  canonicalCandidates(path: string): PauseResource[];
}

export interface PauseNode {
  name: string;
  children: PauseNode[];
}

export interface PauseAssetDependencies {
  parseBml(bytes: Uint8Array): PauseNode;
  decodePng(bytes: Uint8Array): Promise<{ width: number; height: number; pixels: Uint8Array }>;
  attribute(node: PauseNode, name: string): string | undefined;
  frameState(node: PauseNode): { texture: string; [key: string]: unknown };
  captionOffset(node: PauseNode, config: PauseNode): unknown;
  loadAutoImage(library: PauseResourceLibrary, caption: PauseNode,
    directory: string): Promise<PauseNode>;
  registerFont(family: string, bytes: Uint8Array): Promise<unknown> | unknown;
  frameInset(frame: unknown, dialog: PauseHit["rect"]): PauseHit["rect"];
  windowRect(node: PauseNode, parent: PauseHit["rect"],
    frame?: unknown): PauseHit["rect"];
}

/** A logical path must have one exact source, as the release requires. */
export function uniquePauseResource(
  library: PauseResourceLibrary, path: string,
): PauseResource {
  const candidates = library.canonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量必须为 1，实际 ${candidates.length}。`);
  return candidates[0]!;
}

export function pauseResourceFromArchive(
  library: PauseResourceLibrary, path: string, archive: string,
): PauseResource {
  const resource = uniquePauseResource(library, path);
  if (resource.sourceKind !== "rho" ||
      resource.sourceName.toLowerCase() !== archive.toLowerCase()) {
    throw new Error(`${path} 必须来自 ${archive}。`);
  }
  return resource;
}

export function requiredPauseChild(node: PauseNode, name: string): PauseNode {
  const matching = node.children.filter(child => child.name === name);
  if (matching.length !== 1)
    throw new Error(`P3528 pause ${node.name}/${name} 数量 ${matching.length}。`);
  return matching[0]!;
}

export function requiredPauseAttribute(
  node: PauseNode, name: string, ops: PauseAssetDependencies,
): string {
  const value = ops.attribute(node, name);
  if (value === undefined)
    throw new Error(`P3528 pause ${node.name}.${name} 缺失。`);
  return value;
}

function expectPauseNode(
  node: PauseNode, name: string, title: string, ops: PauseAssetDependencies,
): void {
  if (node.name !== name || ops.attribute(node, "name") !== title)
    throw new Error(`P3528 pause 需要 ${name} ${title}。`);
}

function expectPauseAttribute(
  node: PauseNode, name: string, value: string, ops: PauseAssetDependencies,
): void {
  const actual = requiredPauseAttribute(node, name, ops);
  if (actual !== value)
    throw new Error(`P3528 pause ${node.name}.${name}=${actual}，预期 ${value}。`);
}

function expectPauseButton(
  node: PauseNode, title: string, offset: string, iconSet: string,
  text: string, ops: PauseAssetDependencies,
): void {
  expectPauseNode(node, "StateButton", title, ops);
  for (const [name, value] of [
    ["windowSize", "104 106"], ["align", "center"], ["adjust", offset],
    ["iconSet", iconSet], ["iconAlign", "hcenter"], ["text", text],
    ["textAlign", "hcenter"], ["stringPos", "0 55"],
  ]) expectPauseAttribute(node, name!, value!, ops);
}

/** Validate the original two-button Korean layout before using it. */
export function validatePauseDialog(
  definition: PauseNode, ops: PauseAssetDependencies,
): number {
  expectPauseNode(definition, "Panel", "메뉴", ops);
  expectPauseAttribute(definition, "windowRect", "fullscreen", ops);
  expectPauseAttribute(definition, "alphaBlend", "true", ops);
  expectPauseAttribute(definition, "visible", "false", ops);
  const caption = requiredPauseChild(definition, "CaptionWindow");
  for (const [name, value] of [
    ["frame", "CaptionDialog"], ["caption", "#sb(menu)"],
    ["windowRect", "0 0 360 180"], ["align", "center"],
    ["setCloseButton", "cancelButton"],
  ]) expectPauseAttribute(caption, name!, value!, ops);
  const container = requiredPauseChild(caption, "Container");
  expectPauseAttribute(container, "windowRect", "0 15 330 120", ops);
  expectPauseAttribute(container, "align", "hcenter", ops);
  const buttons = container.children.filter(child => child.name === "StateButton");
  if (buttons.length !== 2)
    throw new Error(`P3528 retryPopup_2btn 应有 2 个按钮，实际 ${buttons.length}。`);
  expectPauseButton(buttons[0]!, "다시시도", "-57 0", "btn_singleAgain@zz",
    "#sb(retry)", ops);
  expectPauseButton(buttons[1]!, "싱글플레이", "57 0", "btn_menu@zz",
    "#sb(goToMenu)", ops);
  return pauseOverlayAlpha(requiredPauseAttribute(definition, "color", ops));
}

export function pauseOverlayAlpha(value: string): number {
  const channels = value.trim().split(/\s+/).map(Number);
  if (channels.length !== 4 || channels.some(channel => !Number.isFinite(channel)))
    throw new Error(`P3528 pause color=${value} 无效。`);
  return channels[0]! / 255;
}

export function pauseString(strings: Map<string, string>, key: string): string {
  const value = strings.get(key);
  if (value === undefined)
    throw new Error(`P3528 pause StringBag 缺少 ${key}。`);
  return value;
}

export function parsePauseStringBag(xml: string): Map<string, string> {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error(`P3528 ${paths.strings} 不是有效 XML。`);
  const strings = new Map<string, string>();
  for (const element of Array.from(document.documentElement.children)) {
    const name = element.getAttribute("n");
    const value = Array.from(element.children)
      .find(child => child.getAttribute("c") === "cn")?.getAttribute("v");
    if (name !== null && value !== null && value !== undefined)
      strings.set(name, value);
  }
  return strings;
}

async function decodePauseImage(
  resource: PauseResource, ops: PauseAssetDependencies,
): Promise<{ image: HTMLCanvasElement; width: number; height: number }> {
  const image = await ops.decodePng(await resource.bytes());
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(`浏览器无法创建 ${resource.virtualPath} 的 Canvas。`);
  const pixels = new Uint8ClampedArray(image.pixels.length);
  pixels.set(image.pixels);
  context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
  return { image: canvas, width: image.width, height: image.height };
}

function loadPauseButtonImages(
  library: PauseResourceLibrary, prefix: string, chinese: boolean,
  ops: PauseAssetDependencies,
): Promise<Array<{ image: HTMLCanvasElement; width: number; height: number }>> {
  return Promise.all([1, 2, 3, 4].map(index => {
    const filename = chinese ? `${index}@cn.png` : `${index}.png`;
    return decodePauseImage(pauseResourceFromArchive(library,
      `${paths.commonImages}/${prefix}${filename}`, paths.commonArchive), ops);
  }));
}

function checkPauseImageSize(
  image: { width: number; height: number },
  width: number, height: number, label: string,
): void {
  if (image.width !== width || image.height !== height)
    throw new Error(`P3528 pause ${label} 尺寸 ${image.width}x${image.height}，预期 ${width}x${height}。`);
}

/** Load only the exact files and source archives used by the pause dialog. */
export async function loadPauseMenuAssets(
  library: PauseResourceLibrary, ops: PauseAssetDependencies,
): Promise<PauseMenuAssets> {
  const retryResource = pauseResourceFromArchive(library,
    paths.retryDialog, paths.retryArchive);
  const stringsResource = uniquePauseResource(library, paths.strings);
  const frameResource = pauseResourceFromArchive(library,
    paths.frameImage, paths.frameArchive);
  const frameLayout = pauseResourceFromArchive(library,
    paths.frameLayout, paths.frameArchive);
  const frameConfig = pauseResourceFromArchive(library,
    paths.frameConfig, paths.frameArchive);
  const fontResource = pauseResourceFromArchive(library,
    paths.font, paths.fontArchive);
  const [definition, xml, frame, retry, menu, layout, config] =
    await Promise.all([
      retryResource.bytes().then(bytes => ops.parseBml(bytes)),
      stringsResource.text(),
      decodePauseImage(frameResource, ops),
      loadPauseButtonImages(library, "btn_singleAgain_", true, ops),
      loadPauseButtonImages(library, "btn_menu_", true, ops),
      frameLayout.bytes().then(bytes => ops.parseBml(bytes)),
      frameConfig.bytes().then(bytes => ops.parseBml(bytes)),
    ]);
  const activated = layout.children.find(child => child.name === "CaptionDialog")
    ?.children.find(child => child.name === "Activated");
  if (!activated)
    throw new Error("P3528 pause 缺少 CaptionDialog.Activated。");
  const captionFrame = ops.frameState(activated);
  const captionWindow = requiredPauseChild(config, "CaptionWindow");
  const captionDialog = requiredPauseChild(captionWindow, "CaptionDialog");
  expectPauseAttribute(captionDialog, "textRender", "bold20", ops);
  const captionOffset = ops.captionOffset(
    requiredPauseChild(definition, "CaptionWindow"), config);
  if (captionFrame.texture !== "frame01")
    throw new Error(`P3528 pause 未加载 frame ${captionFrame.texture}。`);
  const overlayAlpha = validatePauseDialog(definition, ops);
  const closeDefinition = await ops.loadAutoImage(library,
    requiredPauseChild(definition, "CaptionWindow"),
    "stage_/speedIndiGame");
  const close = await loadPauseButtonImages(library,
    requiredPauseAttribute(closeDefinition, "autoLoadImage", ops), false, ops);
  retry.forEach(image => checkPauseImageSize(image, 104, 106, "btn_singleAgain"));
  menu.forEach(image => checkPauseImageSize(image, 104, 106, "btn_menu"));
  const strings = parsePauseStringBag(xml);
  for (const key of ["menu", "retry", "goToMenu", "close"])
    pauseString(strings, key);
  const font = await ops.registerFont(PAUSE_FONT_FAMILY,
    await fontResource.bytes());
  return {
    definition, closeDefinition, captionFrame, captionOffset,
    frame, retry, menu, close, strings, font, overlayAlpha,
  };
}

export function pauseButtonHits(
  assets: PauseMenuAssets, dialog: PauseHit["rect"], ops: PauseAssetDependencies,
): PauseHit[] {
  const caption = ops.frameInset(assets.captionFrame, dialog);
  const container = requiredPauseChild(
    requiredPauseChild(assets.definition as PauseNode, "CaptionWindow"),
    "Container");
  const content = ops.windowRect(container, caption);
  const buttons = container.children.filter(child => child.name === "StateButton");
  return [
    { action: "retry", rect: ops.windowRect(buttons[0]!, content) },
    { action: "menu", rect: ops.windowRect(buttons[1]!, content) },
    { action: "resume", rect: ops.windowRect(assets.closeDefinition as PauseNode, caption) },
  ];
}
