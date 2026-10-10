/** Authored SelectTrackEx resources and release-compatible archive lookup. */

import type { BinaryXmlNode } from "../codecs/binary-xml";
import { attribute } from "../codecs/binary-xml";
import type { UiRectangle } from "./scrollbar";

export const trackPickerFontFamily = "P3528 Source Han Sans CN Track Select";

const selectTrackDirectory = "dialog2_/selectTrackEx";
const selectTrackOwner = "dialog2_selectTrackEx.rho";
const monocoqueOwner = "gui_monocoque.rho";
const fontOwner = "gui_font.rho";

export interface TrackPickerResource {
  virtualPath: string;
  canonicalPath?: string;
  sourceKind: string;
  sourceName: string;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface TrackPickerResourceLibrary {
  canonicalCandidates(path: string): TrackPickerResource[];
  get(path: string): TrackPickerResource | undefined;
  resolveContainerPath(originPath: string, targetPath: string):
    | { status: "found"; entry: TrackPickerResource }
    | { status: "ambiguous"; entries: TrackPickerResource[] }
    | { status: "missing"; authoritative?: boolean };
}

export interface TrackPickerImage {
  width: number;
  height: number;
  image: HTMLCanvasElement;
}

export interface TrackPickerFrame {
  texture: string;
  caption: UiRectangle;
  left: UiRectangle;
  right: UiRectangle;
  client: UiRectangle;
  bottom: UiRectangle;
  captionLeftMargin: number;
  captionRightMargin: number;
  bottomLeftMargin: number;
  bottomRightMargin: number;
  clientType: "fill" | "transFill" | "none";
}

export interface TrackPickerButtonStyle {
  frameName: string;
  states: Array<{
    frame: TrackPickerFrame;
    textRender: string;
    textColor: string;
    textColor2: string;
  }>;
}

export interface TrackPickerScrollbar {
  areaFrame: TrackPickerFrame;
  buttonFrames: TrackPickerFrame[];
  minButtonHeight: number;
}

export interface TrackPickerWindowAssets {
  definition: BinaryXmlNode;
  radioDefinition: BinaryXmlNode;
  themeDefinition: BinaryXmlNode;
  cardDefinition: BinaryXmlNode;
  buttons: Map<string, { definition: BinaryXmlNode; style: TrackPickerButtonStyle }>;
  frames: Map<string, TrackPickerFrame>;
  checkFrames: TrackPickerFrame[];
  scrollbars: Map<string, TrackPickerScrollbar>;
  notice: {
    definition: BinaryXmlNode;
    frame: TrackPickerFrame;
    captionOffset: { x: number; y: number };
    frameImage: HTMLCanvasElement;
    iconImage: HTMLCanvasElement;
  };
  main: TrackPickerImage;
  themeButton: TrackPickerImage[];
  selectedThemeButton: TrackPickerImage[];
  favoriteButton: TrackPickerImage[];
  selectedFavoriteButton: TrackPickerImage[];
  cardFrame: TrackPickerImage[];
  selectedCard: TrackPickerImage;
  selectedTheme: TrackPickerImage;
  favoriteMark: TrackPickerImage[];
  difficultyLabel: TrackPickerImage;
  difficulty: TrackPickerImage;
  reverseStamp: TrackPickerImage;
  frame: TrackPickerImage;
  textButtonFrame: TrackPickerImage;
  closeButton: TrackPickerImage[];
  randomRadioButton?: TrackPickerImage[];
  randomCards?: Map<string, TrackPickerImage>;
  randomDescriptionDefinition?: BinaryXmlNode;
  randomDescriptionBackground?: TrackPickerImage;
  randomDescriptionTitle?: TrackPickerImage;
  themes: Array<{ id: string; title: string; icon: TrackPickerImage }>;
  strings: Map<string, string>;
  font: FontFace;
}

/** Stable names consumed by the standalone picker window module. */
export type TrackPickerWindowNode = BinaryXmlNode;
export type TrackPickerWindowImage = TrackPickerImage;
export type TrackPickerWindowFrame = TrackPickerFrame;
export type TrackPickerWindowLibrary = TrackPickerResourceLibrary;

export interface TrackPickerAssetDependencies {
  parseBml(bytes: Uint8Array): BinaryXmlNode;
  decodePng(bytes: Uint8Array): Promise<{
    width: number; height: number; pixels: Uint8Array | Uint8ClampedArray;
  }>;
  frame(node: BinaryXmlNode): TrackPickerFrame;
  buttonStyle(node: BinaryXmlNode, config: BinaryXmlNode,
    frames: BinaryXmlNode): TrackPickerButtonStyle;
  scrollbar(node: BinaryXmlNode, frames: BinaryXmlNode): TrackPickerScrollbar;
  captionOffset(node: BinaryXmlNode, config: BinaryXmlNode): { x: number; y: number };
  loadFont(family: string, bytes: Uint8Array): Promise<FontFace>;
}

export interface TrackPickerRandomGroupAsset {
  cardToken: string;
}

/** `nt`: search the secondary radio tree first, as the release does. */
export function findTrackPickerNode(root: BinaryXmlNode, name: string,
  secondary?: BinaryXmlNode): BinaryXmlNode {
  const stack = secondary ? [root, secondary] : [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (attribute(node, "name") === name) return node;
    stack.push(...node.children);
  }
  throw new Error(`P3528 SelectTrackEx 缺少布局节点 ${name}。`);
}

function uniqueResource(library: TrackPickerResourceLibrary, path: string): TrackPickerResource {
  const candidates = library.canonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量必须为 1，实际 ${candidates.length}。`);
  return candidates[0]!;
}

function ownedResource(library: TrackPickerResourceLibrary, path: string,
  owner: string): TrackPickerResource {
  const source = uniqueResource(library, path);
  if (source.sourceKind !== "rho" || source.sourceName.toLowerCase() !== owner.toLowerCase())
    throw new Error(`${path} 必须来自 ${owner}。`);
  return source;
}

function optionalOwnedResource(library: TrackPickerResourceLibrary, path: string,
  owner: string): TrackPickerResource | undefined {
  const candidates = library.canonicalCandidates(path).filter(source =>
    source.sourceKind === "rho" && source.sourceName.toLowerCase() === owner.toLowerCase());
  if (candidates.length > 1) throw new Error(`${path} 在 ${owner} 内不唯一。`);
  return candidates[0];
}

function imageResource(library: TrackPickerResourceLibrary, token: string): TrackPickerResource {
  const candidates = token.endsWith("@zz") ? [token.slice(0, -3) + "@cn", token] : [token];
  for (const name of candidates) {
    const source = optionalOwnedResource(library,
      `${selectTrackDirectory}/${name}.png`, selectTrackOwner);
    if (source) return source;
  }
  throw new Error(`P3528 SelectTrackEx 缺少图片 ${token}。`);
}

/** `o4`: decode authored PNG pixels into the same Canvas shape as the release. */
export async function decodeTrackPickerImage(source: TrackPickerResource,
  dependencies: Pick<TrackPickerAssetDependencies, "decodePng">): Promise<TrackPickerImage> {
  const decoded = await dependencies.decodePng(await source.bytes());
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`浏览器无法创建 ${source.virtualPath} 的 Canvas。`);
  const pixels = new Uint8ClampedArray(decoded.pixels.length);
  pixels.set(decoded.pixels);
  context.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0);
  return { width: decoded.width, height: decoded.height, image: canvas };
}

function loadImage(library: TrackPickerResourceLibrary, token: string,
  dependencies: TrackPickerAssetDependencies): Promise<TrackPickerImage> {
  return decodeTrackPickerImage(imageResource(library, token), dependencies);
}

function imageName(token: string, state: number, contiguous: boolean): string {
  if (contiguous && token.endsWith("@zz")) return `${token.slice(0, -3)}${state}@zz`;
  if (token.endsWith("@zz")) return `${token.slice(0, -3)}_${state}@zz`;
  return token.endsWith("_") ? `${token}${state}` : `${token}_${state}`;
}

function loadImageStates(library: TrackPickerResourceLibrary, token: string,
  contiguous: boolean, dependencies: TrackPickerAssetDependencies): Promise<TrackPickerImage[]> {
  return Promise.all([1, 2, 3, 4].map(state =>
    loadImage(library, imageName(token, state, contiguous), dependencies)));
}

function loadOwnedImageStates(library: TrackPickerResourceLibrary, prefix: string,
  owner: string, dependencies: TrackPickerAssetDependencies): Promise<TrackPickerImage[]> {
  return Promise.all([1, 2, 3, 4].map(state =>
    decodeTrackPickerImage(ownedResource(library, `${prefix}${state}.png`, owner), dependencies)));
}

/** `pc0`: the preview card must come from the selected track's own container. */
export function resolveTrackCardResource(library: TrackPickerResourceLibrary,
  trackPath: string): TrackPickerResource {
  const track = library.get(trackPath);
  if (!track) throw new Error(`P3528 SelectTrackEx 找不到赛道 ${trackPath}。`);
  const normalized = (track.canonicalPath ?? track.virtualPath)
    .replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const separator = normalized.lastIndexOf("/");
  const cardPath = `${separator < 0 ? "" : normalized.slice(0, separator + 1)}xt_trackCard.png`;
  const result = library.resolveContainerPath(trackPath, cardPath);
  if (result.status === "found") return result.entry;
  throw result.status === "ambiguous"
    ? new Error(`${cardPath} 在赛道 container 内不唯一。`)
    : new Error(`${cardPath} 不在赛道的同一 container 内。`);
}

export function loadTrackCard(library: TrackPickerResourceLibrary, trackPath: string,
  dependencies: Pick<TrackPickerAssetDependencies, "decodePng">): Promise<TrackPickerImage> {
  return decodeTrackPickerImage(resolveTrackCardResource(library, trackPath), dependencies);
}

function localStrings(root: BinaryXmlNode): Map<string, string> {
  const result = new Map<string, string>();
  for (const entry of root.children) {
    const key = attribute(entry, "n");
    const chinese = entry.children.find(child => attribute(child, "c") === "cn");
    const value = chinese && attribute(chinese, "v");
    if (key !== undefined && value !== undefined) result.set(key, value);
  }
  return result;
}

function baseStrings(xml: string): Map<string, string> {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error("P3528 baseStringBag.xml 不是有效 XML。");
  const result = new Map<string, string>();
  for (const entry of Array.from(document.documentElement.children)) {
    const key = entry.getAttribute("n");
    const value = Array.from(entry.children).find(child => child.getAttribute("c") === "cn")
      ?.getAttribute("v");
    if (key !== null && value !== null && value !== undefined) result.set(key, value);
  }
  return result;
}

interface ThemeConfig { id: string; title: string; icon: string }

function themeStringKey(node: BinaryXmlNode, id: string): string {
  return attribute(node, "stringKey") ??
    ({ mabi: "themeMabinogi", maple: "themeMapleStory" } as Record<string, string>)[id] ??
    `theme${id[0]!.toUpperCase()}${id.slice(1)}`;
}

function configuredThemes(config: BinaryXmlNode, strings: Map<string, string>): ThemeConfig[] {
  const order = config.children.find(node => node.name === "themeTabOrder");
  if (!order) throw new Error("P3528 SelectTrackEx config 缺少 themeTabOrder。");
  return order.children.flatMap(node => {
    const id = attribute(node, "id");
    if (!id || id === "1025") return [];
    const key = themeStringKey(node, id);
    return [{ id, title: strings.get(key) ?? id, icon: attribute(node, "icon") ?? id }];
  });
}

async function loadDefinitions(library: TrackPickerResourceLibrary,
  dependencies: TrackPickerAssetDependencies) {
  const directory = selectTrackDirectory;
  const [definition, radioDefinition, themeDefinition, cardDefinition,
    config, frames, noticeDefinition] = await Promise.all([
    `${directory}/selectTrackEx@zz.bml`, `${directory}/radioButton.bml`,
    `${directory}/themeTemplate.bml`, `${directory}/trackThumbCard@zz.bml`,
    "gui_/monocoque/config.bml", "gui_/monocoque/frame.bml",
    "gui_/windowTemplate/blinkMessageWindow.bml",
  ].map((path, index) => ownedResource(library, path, index < 4 ? selectTrackOwner :
    index < 6 ? monocoqueOwner : "gui_windowTemplate.rho")
    .bytes().then(dependencies.parseBml)));
  const dialog = definition!.children.find(node => attribute(node, "name") === "selectTrackEx");
  if (!dialog) throw new Error("P3528 SelectTrackEx 缺少主窗口定义。");
  const buttons = new Map<string, { definition: BinaryXmlNode; style: TrackPickerButtonStyle }>();
  for (const name of ["ok", "cancel"]) {
    const button = dialog.children.find(node => node.name === "TextButton" &&
      attribute(node, "name") === name);
    if (!button) throw new Error(`P3528 SelectTrackEx 缺少 TextButton ${name}。`);
    buttons.set(name === "ok" ? "confirm" : "cancel", {
      definition: button, style: dependencies.buttonStyle(button, config!, frames!),
    });
  }
  const frame = (name: string): TrackPickerFrame => {
    const node = frames!.children.find(child => child.name === name)?.children[0];
    if (!node) throw new Error(`P3528 SelectTrackEx 缺少窗口帧 ${name}。`);
    return dependencies.frame(node);
  };
  const checkGroup = frames!.children.find(node => node.name === "DefaultCheckButton")!;
  const scrollbars = new Map<string, TrackPickerScrollbar>();
  for (const name of ["selectThemeListBar", "thumbListBar"])
    scrollbars.set(name, dependencies.scrollbar(findTrackPickerNode(definition!, name), frames!));
  return {
    definition: definition!, radioDefinition: radioDefinition!,
    themeDefinition: themeDefinition!, cardDefinition: cardDefinition!,
    buttons,
    frames: new Map(["NoFrame", "DefaultCheckButton"].map(name =>
      [name, frame(name)] as const)),
    checkFrames: checkGroup.children.map(dependencies.frame), scrollbars,
    notice: {
      definition: noticeDefinition!, frame: frame("CaptionDialog"),
      captionOffset: dependencies.captionOffset(noticeDefinition!, config!),
    },
  };
}

async function loadRandomAssets(library: TrackPickerResourceLibrary,
  groups: readonly TrackPickerRandomGroupAsset[], definitions: Awaited<ReturnType<typeof loadDefinitions>>,
  randomTheme: ThemeConfig, dependencies: TrackPickerAssetDependencies) {
  const descriptionDefinition = findTrackPickerNode(definitions.definition, "randomTrackDesc");
  const [radioButton, cards, descriptionBackground, descriptionTitle, themeIcon] =
    await Promise.all([
      loadImageStates(library, "trackSelect_btn_radio_", false, dependencies),
      Promise.all([...new Set(groups.map(group => group.cardToken))].map(async token =>
        [token, await loadImage(library, token, dependencies)] as const)),
      loadImage(library, "popup_bg_tracklist_bg", dependencies),
      loadImage(library, "popup_bg_tracklist_title", dependencies),
      loadImage(library, imageName(randomTheme.icon, 1, false), dependencies),
    ]);
  return {
    radioButton, cards: new Map(cards), descriptionDefinition,
    descriptionBackground, descriptionTitle,
    theme: { id: randomTheme.id, title: randomTheme.title, icon: themeIcon },
  };
}

/** `ac0`: load the native SelectTrackEx tree and all eagerly used images. */
export async function loadTrackPickerWindowAssets(library: TrackPickerResourceLibrary,
  randomGroups: readonly TrackPickerRandomGroupAsset[],
  dependencies: TrackPickerAssetDependencies): Promise<{
    randomAvailable: boolean;
    randomError: unknown;
    assets: TrackPickerWindowAssets;
  }> {
  const [config, localBag, baseBag, main, themeButton, selectedThemeButton,
    favoriteButton, selectedFavoriteButton, cardFrame, selectedCard,
    selectedTheme, favoriteMark, difficultyLabel, difficulty,
    reverseStamp, frame, textButtonFrame, closeButton, definitions, noticeIcon] =
    await Promise.all([
      ownedResource(library, `${selectTrackDirectory}/config@cn.bml`, selectTrackOwner)
        .bytes().then(dependencies.parseBml),
      ownedResource(library, `${selectTrackDirectory}/selectTrackEx_stringBag.bml`, selectTrackOwner)
        .bytes().then(dependencies.parseBml),
      uniqueResource(library, "etc_/baseStringBag.xml").text(),
      loadImage(library, "trackSelect_img_mainBG", dependencies),
      loadImageStates(library, "themeSelect_btn_slot_", false, dependencies),
      loadImageStates(library, "themeSelected_btn_slot_", false, dependencies),
      loadImageStates(library, "favTrSelect_btn_slot_", false, dependencies),
      loadImageStates(library, "favTrSelected_btn_slot_", false, dependencies),
      loadImageStates(library, "trackthumbcard@zz", true, dependencies),
      loadImage(library, "trackthumbcard4@zz", dependencies),
      loadImage(library, "img_trackSelectIcon", dependencies),
      loadImageStates(library, "trackSelect_btn_thumbcardFavorite_", false, dependencies),
      loadImage(library, "난이도text@zz", dependencies),
      loadImage(library, "난이도원", dependencies),
      decodeTrackPickerImage(ownedResource(library,
        "stage_/common/작은리버스트랙.png", "stage_common.rho"), dependencies),
      decodeTrackPickerImage(ownedResource(library,
        "gui_/monocoque/frame01.png", monocoqueOwner), dependencies),
      decodeTrackPickerImage(ownedResource(library,
        "gui_/monocoque/frame_new01.png", monocoqueOwner), dependencies),
      loadOwnedImageStates(library, "stage_/common/close_", "stage_common.rho", dependencies),
      loadDefinitions(library, dependencies),
      decodeTrackPickerImage(ownedResource(library,
        "stage_/common/대화상자정보.png", "stage_common.rho"), dependencies),
    ]);
  const strings = new Map([...baseStrings(baseBag), ...localStrings(localBag)]);
  const configured = configuredThemes(config, strings);
  const normalThemes = await Promise.all(configured.filter(theme => theme.id !== "1024")
    .map(async theme => ({ id: theme.id, title: theme.title,
      icon: await loadImage(library, imageName(theme.icon, 1, false), dependencies) })));
  let random: Awaited<ReturnType<typeof loadRandomAssets>> | undefined;
  let randomError: unknown;
  if (randomGroups.length > 0) {
    try {
      const randomTheme = configured.find(theme => theme.id === "1024");
      if (!randomTheme) throw new Error("P3528 SelectTrackEx 配置缺少随机主题 1024。");
      random = await loadRandomAssets(library, randomGroups, definitions, randomTheme, dependencies);
    } catch (error) {
      randomError = error;
    }
  }
  const themes = configured.flatMap(theme => theme.id === "1024"
    ? random ? [random.theme] : [] : normalThemes.filter(other => other.id === theme.id));
  const font = await dependencies.loadFont(trackPickerFontFamily,
    await ownedResource(library, "gui_/font/SourceHanSansCN-Bold.otf", fontOwner).bytes());
  return {
    randomAvailable: random !== undefined,
    randomError,
    assets: {
      ...definitions,
      main, themeButton, selectedThemeButton, favoriteButton,
      selectedFavoriteButton, cardFrame, selectedCard, selectedTheme,
      favoriteMark, difficultyLabel, difficulty, reverseStamp, frame,
      textButtonFrame, closeButton,
      randomRadioButton: random?.radioButton,
      randomCards: random?.cards,
      randomDescriptionDefinition: random?.descriptionDefinition,
      randomDescriptionBackground: random?.descriptionBackground,
      randomDescriptionTitle: random?.descriptionTitle,
      themes, strings, font,
      notice: { ...definitions.notice, frameImage: frame.image, iconImage: noticeIcon.image },
    },
  };
}
