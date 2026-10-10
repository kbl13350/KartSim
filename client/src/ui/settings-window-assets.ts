import { addGraphicsPresentationOptions } from "./graphics-presentation-options";

/** Binary XML node shape used by the settings BML definitions. */
export interface SettingsWindowNode {
  name: string;
  text: string;
  attributes: Array<{ name: string; value: string }>;
  children: SettingsWindowNode[];
}

export interface SettingsWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SettingsWindowFrame {
  texture: string;
  caption: SettingsWindowRect;
  left: SettingsWindowRect;
  right: SettingsWindowRect;
  client: SettingsWindowRect;
  bottom: SettingsWindowRect;
  captionLeftMargin: number;
  captionRightMargin: number;
  bottomLeftMargin: number;
  bottomRightMargin: number;
  clientType: "fill" | "transFill" | "none";
}

export interface SettingsWindowButtonStyle {
  frameName: string;
  states: Array<{
    frame: SettingsWindowFrame;
    textRender: string;
    textColor: string;
    textColor2: string;
  }>;
}

export interface SettingsWindowScrollbar {
  areaFrame: SettingsWindowFrame;
  buttonFrames: SettingsWindowFrame[];
  minButtonHeight: number;
}

export interface SettingsWindowImage {
  image: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface SettingsWindowAssets {
  definition: SettingsWindowNode;
  graphics: SettingsWindowNode;
  game: SettingsWindowNode;
  keyboard: SettingsWindowNode;
  keymapScrollbar: SettingsWindowScrollbar | undefined;
  keyMessageBox: SettingsWindowNode;
  config: SettingsWindowNode;
  frames: Map<string, SettingsWindowFrame[]>;
  styles: Map<SettingsWindowNode, SettingsWindowButtonStyle>;
  images: Map<string, SettingsWindowImage>;
  strings: Map<string | null | undefined, string | undefined>;
  font: unknown;
}

export interface SettingsWindowResource {
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface SettingsWindowResourceLibrary {
  canonicalCandidates(path: string): SettingsWindowResource[];
}

export interface SettingsWindowAssetDependencies {
  parseBml(bytes: Uint8Array): SettingsWindowNode;
  decodePng(bytes: Uint8Array): Promise<{
    width: number; height: number; pixels: Uint8Array;
  }>;
  attribute(node: SettingsWindowNode, name: string): string | undefined;
  frameState(node: SettingsWindowNode): SettingsWindowFrame;
  buttonStyle(node: SettingsWindowNode, config: SettingsWindowNode,
    frames: SettingsWindowNode): SettingsWindowButtonStyle;
  loadAutoImage(library: SettingsWindowResourceLibrary,
    caption: SettingsWindowNode, directory: string):
    Promise<SettingsWindowNode | undefined>;
  registerFont(family: string, bytes: Uint8Array): Promise<unknown> | unknown;
  scrollbarAssets(node: SettingsWindowNode,
    frames: SettingsWindowNode): SettingsWindowScrollbar;
}

export interface OfficialBgmChoice { id: number; label: string; path: string }

const fontFamily = "P3528 Settings";
const dialogDirectory = "dialog/optionDialog";
const speedVersionName = "raceSpeedVersion";
const speedVersionContainer = "raceSpeedVersionCont";
const speedChannelName = "raceSpeedChannel";
const speedChannelContainer = "raceSpeedCont";
const speedHintName = "raceSpeedHint";
const comboLineHeight = 21;
const speedChoiceCount = 7;
const versionChoiceCount = 3;
const speedVersionRect = "36 217 868 26";
const speedChannelRect = "36 247 868 26";
const speedHintRect = "36 324 904 344";

/** Parse the official BGM table and its Chinese labels. */
export function parseOfficialBgmChoices(
  bgmListXml: string, stringBagXml: string,
): OfficialBgmChoice[] {
  const bgmList = new DOMParser().parseFromString(bgmListXml, "application/xml");
  const strings = new DOMParser().parseFromString(stringBagXml, "application/xml");
  if (bgmList.querySelector("parsererror") || strings.querySelector("parsererror"))
    throw Error("官服音乐列表无效。");
  const names = new Map(Array.from(strings.querySelectorAll("StringBag > k")).map(entry => [
    entry.getAttribute("n"),
    Array.from(entry.children).find(local => local.getAttribute("c") === "cn")
      ?.getAttribute("v"),
  ]));
  return Array.from(bgmList.querySelectorAll("bgmList > bgm")).flatMap(entry => {
    const id = Number(entry.getAttribute("id"));
    const theme = entry.getAttribute("theme");
    const name = entry.getAttribute("name");
    return !Number.isInteger(id) || id < 1 || !theme || !name ||
      !/^[-\w]+$/.test(theme) || !/^[-\w]+$/.test(name)
      ? [] : [{ id, label: names.get(name) || name,
        path: `sound_/bgm/${theme}/${name}.ogg` }];
  });
}

/** Extend the native game tab with the four browser settings. */
function addWebSettings(root: SettingsWindowNode,
  attribute: SettingsWindowAssetDependencies["attribute"]): SettingsWindowNode {
  const autoReady = root.children.find(child =>
    attribute(child, "name") === "onAutoReadyCont");
  const receiveHeading = root.children.find(child => child.children.some(label =>
    attribute(label, "text") === "#sb(receiveOption)"));
  const ignoreFriend = root.children.find(child =>
    attribute(child, "name") === "onIgnoreRequestFriendMsgCont");
  if (!autoReady || !receiveHeading || !ignoreFriend)
    throw new Error("游戏设置缺少自定义区域的原版模板。");
  const [left, top, , height] = (attribute(ignoreFriend, "leftTopWH") ?? "")
    .split(/\s+/).map(Number);
  const [, , width] = (attribute(root, "windowRect") ?? "")
    .split(/\s+/).map(Number);
  if (![left, top, height, width].every(Number.isFinite))
    throw new Error("游戏设置布局不支持自定义区域。");
  const changed = (node: SettingsWindowNode, values: Record<string, string>):
    SettingsWindowNode => ({
      ...node,
      attributes: [
        ...node.attributes.filter(entry => !(entry.name in values)),
        ...Object.entries(values).map(([name, value]) => ({ name, value })),
      ],
    });
  const settings = [
    ["webFlyingPetSetting", "inGameFlyingPetVisible", "局内显示自己的飞行宠物"],
    ["webRaceAnonymousSetting", "raceAnonymous", "比赛匿名（比赛期间隐藏其他玩家ID）"],
    ["webRaceTimeGapSetting", "raceTimeGap", "多人比赛时间差提示（估算）"],
    ["webClassicHudSetting", "classicHud", "老车使用经典码表与氮气条"],
  ];
  const replaced = new Set([
    "onIgnoreRequestFriendMsgCont", "onIgnoreInviteMsgCont", "recOption",
  ]);
  return {
    ...root,
    children: [
      ...root.children.filter(child => !replaced.has(attribute(child, "name") ?? ""))
        .map(child => child === receiveHeading ? {
          ...receiveHeading,
          children: receiveHeading.children.map(label =>
            attribute(label, "text") === "#sb(receiveOption)"
              ? changed(label, { text: "自定义设置" }) : label),
        } : child === autoReady ? {
          ...autoReady,
          children: autoReady.children.map(button =>
            attribute(button, "name") === "onAutoReady"
              ? changed(button, { enable: "true" }) : button),
        } : child),
      ...settings.map(([containerName, controlName, label], index) => {
        const setting = changed(autoReady, {
          name: containerName!,
          leftTopWH: `${left} ${top! + index * (height! + 10)} ${width! - left! * 2} ${height}`,
        });
        return {
          ...setting,
          children: setting.children.map(child => child.name === "PlaneCheckButton"
            ? changed(child, { name: controlName!, enable: "true" })
            : changed(child, { text: label! })),
        };
      }),
    ],
  };
}

function speedCombo(containerName: string, controlName: string, label: string,
  rect: string, choices: number): SettingsWindowNode {
  return {
    name: "Container", text: "",
    attributes: [{ name: "name", value: containerName },
      { name: "leftTopWH", value: rect }],
    children: [
      {
        name: "Label", text: "", attributes: [
          { name: "windowRect", value: "0 0 40 12" },
          { name: "align", value: "vcenter" },
          { name: "text", value: label },
          { name: "textAlign", value: "left" },
          { name: "autoSizing", value: "true" },
          { name: "textRender", value: "bold16" },
          { name: "textColor", value: "255 42 55 80" },
        ], children: [],
      },
      {
        name: "ComboBox", text: "", attributes: [
          { name: "name", value: controlName },
          { name: "windowSize", value: "256 26" },
          { name: "frame", value: "DefaultEdit" },
          { name: "listFrame", value: "DefaultEdit" },
          { name: "comboListLength", value: String(choices * comboLineHeight) },
          { name: "align", value: "right,vcenter" },
          { name: "adjust", value: "5 0" },
        ], children: [],
      },
    ],
  };
}

function withAttribute(node: SettingsWindowNode, name: string,
  value: string): SettingsWindowNode {
  const attributes = node.attributes.some(entry => entry.name === name)
    ? node.attributes.map(entry => entry.name === name ? { name, value } : entry)
    : [...node.attributes, { name, value }];
  return { ...node, attributes };
}

function transformTree(node: SettingsWindowNode,
  transform: (node: SettingsWindowNode) => SettingsWindowNode | undefined):
  SettingsWindowNode {
  const replacement = transform(node);
  return replacement || { ...node,
    children: node.children.map(child => transformTree(child, transform)) };
}

/** Replace unused information rows with speed channel selectors. */
function addSpeedSelectors(root: SettingsWindowNode,
  attribute: SettingsWindowAssetDependencies["attribute"]): SettingsWindowNode {
  const replaced = ["vipCont", "riderSchoolCont", "tierGradeCont"];
  const index = root.children.findIndex(child =>
    attribute(child, "name") === replaced[0]);
  if (index < 0)
    throw new Error("P3528 变更设置页缺少「信息公开设置」区块（vipCont），速度频道行无处安放。");
  const inserted = new Map([
    [index, speedCombo(speedVersionContainer, speedVersionName,
      "速度版本", speedVersionRect, versionChoiceCount)],
    [index + 1, speedCombo(speedChannelContainer, speedChannelName,
      "速度频道", speedChannelRect, speedChoiceCount)],
  ]);
  const children: SettingsWindowNode[] = [];
  root.children.forEach((child, position) => {
    const name = attribute(child, "name") ?? "";
    if (replaced.includes(name)) {
      const replacement = inserted.get(position);
      if (replacement) children.push(replacement);
      return;
    }
    children.push(child);
  });
  return transformTree({ ...root, children }, node => {
    if (node.name === "Label" && attribute(node, "text") === "#sb(infoOption)")
      return withAttribute(node, "text", "速度频道设置");
    if (node.name === "Label" && attribute(node, "text") === "#sb(premiumHideDesc)") {
      let changed = withAttribute(node, "text", "");
      changed = withAttribute(changed, "windowRect", speedHintRect);
      return withAttribute(changed, "name", speedHintName);
    }
  });
}

function walk(root: SettingsWindowNode, visit: (node: SettingsWindowNode) => void): void {
  visit(root);
  root.children.forEach(child => walk(child, visit));
}

function uniqueResource(library: SettingsWindowResourceLibrary,
  path: string): SettingsWindowResource {
  const candidates = library.canonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`P3528 设置资源 ${path} 不唯一或缺失。`);
  return candidates[0]!;
}

function imageResource(library: SettingsWindowResourceLibrary,
  name: string): SettingsWindowResource {
  for (const directory of [dialogDirectory, "dialog2_/customMessageBox",
    "stage_/common", "gui_/monocoque"]) {
    const path = `${directory}/${name}.png`;
    if (library.canonicalCandidates(path).length) return uniqueResource(library, path);
  }
  throw new Error(`P3528 设置缺少图片 ${name}。`);
}

async function loadImage(source: SettingsWindowResource,
  decodePng: SettingsWindowAssetDependencies["decodePng"]):
  Promise<SettingsWindowImage> {
  const decoded = await decodePng(await source.bytes());
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建设置图片 Canvas。");
  context.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels),
    decoded.width, decoded.height), 0, 0);
  return { image: canvas, width: canvas.width, height: canvas.height };
}

function collectStyles(node: SettingsWindowNode, imageNames: Set<string>,
  styles: Map<SettingsWindowNode, SettingsWindowButtonStyle>,
  config: SettingsWindowNode, frames: SettingsWindowNode,
  dependencies: SettingsWindowAssetDependencies): void {
  const texture = dependencies.attribute(node, "texture");
  if (texture) imageNames.add(texture);
  if (node.name === "TextButton")
    styles.set(node, dependencies.buttonStyle(node, config, frames));
  const auto = dependencies.attribute(node, "autoLoadImage") ??
    dependencies.attribute(node, "autoImage");
  if (auto) [1, 2, 3, 4].forEach(index => imageNames.add(`${auto}${index}`));
}

function mergeStrings(xml: string, dialogStrings: SettingsWindowNode,
  attribute: SettingsWindowAssetDependencies["attribute"]):
  Map<string | null | undefined, string | undefined> {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error("P3528 baseStringBag 不是有效 XML。");
  const strings = new Map<string | null | undefined, string | undefined>();
  for (const entry of Array.from(document.documentElement.children)) {
    const value = Array.from(entry.children)
      .find(local => local.getAttribute("c") === "cn")?.getAttribute("v");
    if (value != null) strings.set(entry.getAttribute("n"), value);
  }
  for (const entry of dialogStrings.children) {
    const local = entry.children.find(child => attribute(child, "c") === "cn");
    if (local) strings.set(attribute(entry, "n"), attribute(local, "v"));
  }
  return strings;
}

/** Load and adapt the original option dialog resources. */
export async function loadSettingsWindowAssets(
  library: SettingsWindowResourceLibrary,
  dependencies: SettingsWindowAssetDependencies,
): Promise<SettingsWindowAssets> {
  const loadBml = async (path: string): Promise<SettingsWindowNode> =>
    dependencies.parseBml(await uniqueResource(library, path).bytes());
  const [dialog, graphics, game, keyboard, config, frameTree,
    dialogStrings, baseStrings, messageDialog] = await Promise.all([
    loadBml(`${dialogDirectory}/mq_dialog@zz.bml`),
    loadBml(`${dialogDirectory}/view_graphicsOption@zz.bml`),
    loadBml(`${dialogDirectory}/view_gameOption@cn.bml`),
    loadBml(`${dialogDirectory}/view_keyboardMap@zz.bml`),
    loadBml("gui_/monocoque/config.bml"),
    loadBml("gui_/monocoque/frame.bml"),
    loadBml(`${dialogDirectory}/dialog_stringBag.bml`),
    uniqueResource(library, "etc_/baseStringBag.xml").text(),
    loadBml("dialog2_/customMessageBox/mq_dialog@zz.bml"),
  ]);
  const gameWithWebSettings = addWebSettings(addSpeedSelectors(game!,
    dependencies.attribute), dependencies.attribute);
  const caption = dialog!.children.find(child => child.name === "CaptionWindow");
  // The release passes an absent caption to loadAutoImage and lets the helper throw.
  const closeButton = await dependencies.loadAutoImage(library, caption!, dialogDirectory);
  const captionWithClose = { ...caption!, children: [...caption!.children,
    ...(closeButton ? [closeButton] : [])] };
  const definition = { ...dialog!, children: dialog!.children.map(child =>
    child === caption ? captionWithClose : child) };
  const styles = new Map<SettingsWindowNode, SettingsWindowButtonStyle>();
  const frames = new Map(frameTree!.children.map(child =>
    [child.name, child.children.map(dependencies.frameState)] as const));
  const imageNames = new Set(["대화상자정보", "대화상자경고"]);
  const keyMessageBox = messageDialog!.children[0]!;
  let keymapScrollbar: SettingsWindowScrollbar | undefined;
  walk(keyboard!, node => {
    if (dependencies.attribute(node, "name") === "keymapScroll")
      keymapScrollbar = dependencies.scrollbarAssets(node, frameTree!);
  });
  for (const root of [definition, gameWithWebSettings, graphics!, keyboard!, keyMessageBox])
    walk(root, node => collectStyles(node, imageNames, styles, config!, frameTree!,
      dependencies));
  for (const name of ["CaptionDialog", "TabBoxLarge", "GrayInnerFrame",
    "GrayInputBox", "DefaultEdit", "SelectBtn", "VSection",
    "DefaultCheckButton", "NewHorizonScrollButton", "NewHorizonScrollArea",
    "BulletLeftButton", "BulletRightButton", "DefaultVerticalScrollArea",
    "DefaultVerticalScrollButton", "HSection"])
    frames.get(name)?.forEach(frame => { if (frame.texture) imageNames.add(frame.texture); });
  styles.forEach(style => style.states.forEach(state => {
    if (state.frame.texture) imageNames.add(state.frame.texture);
  }));
  const images = new Map(await Promise.all([...imageNames].map(async name =>
    [name, await loadImage(imageResource(library, name), dependencies.decodePng)] as const)));
  const strings = mergeStrings(baseStrings!, dialogStrings!, dependencies.attribute);
  const font = await dependencies.registerFont(fontFamily,
    await uniqueResource(library, "gui_/font/SourceHanSansCN-Bold.otf").bytes());
  return {
    definition, graphics: addGraphicsPresentationOptions(graphics!),
    game: gameWithWebSettings, keyboard: keyboard!, keymapScrollbar,
    keyMessageBox, config: config!, frames, styles, images, strings, font,
  };
}
