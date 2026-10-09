export interface RiderNode {
  name: string;
  children: RiderNode[];
}

export interface RiderResource {
  bytes(): Promise<Uint8Array>;
}

export interface RiderResourceLibrary {
  exactCanonicalCandidates(path: string): RiderResource[];
}

export interface RiderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RiderFrame {
  texture: string;
  [key: string]: unknown;
}

export interface RiderAssetDependencies {
  parseBml(bytes: Uint8Array): RiderNode;
  attribute(node: RiderNode, name: string): string | undefined;
  frameState(node: RiderNode): RiderFrame;
  windowRect(node: RiderNode, parent: RiderRect,
    frame?: RiderFrame): RiderRect;
  frameInset(frame: RiderFrame, rect: RiderRect): RiderRect;
  captionOffset(dialog: RiderNode, config: RiderNode): unknown;
  captionRect(frame: RiderFrame, rect: RiderRect, offset: unknown): RiderRect;
  loadImage(bytes: Uint8Array): Promise<CanvasImageSource & { close(): void }>;
}

export const RIDER_VIEW_WIDTH = 1600;
export const RIDER_VIEW_HEIGHT = 900;
export const RIDER_FONT = "P3528 Source Han Sans CN Ready";
export const RIDER_GRID_COLUMNS = 4;
export const RIDER_GRID_ROWS = 2;
export const RIDER_GRID_PAGE_SIZE = RIDER_GRID_COLUMNS * RIDER_GRID_ROWS;
export const RIDER_CONFIRM_TEXT = "确定";

export const riderImagePaths = {
  background: "stage_/newRider/createCharacter_bg.png",
  info: "stage_/newRider/createCha_infoIcon.png",
  sectionIcons: [
    "stage_/newRider/createCharacter_icon_1.png",
    "stage_/newRider/createCharacter_icon_2.png",
    "stage_/newRider/createCharacter_icon_3.png",
  ],
} as const;

const blueprintPaths = [
  "stage_/newRider/stage_window@zz.bml",
  "stage_/newRider/stage_stringBag.bml",
  "gui_/monocoque/frame.bml",
  "gui_/monocoque/config.bml",
] as const;
const whitelistPaths = [
  "stage_/newRider/newRiderItem@cn.bml",
  "stage_/newRider/newRiderItem@zz.bml",
] as const;

export interface RiderBlueprint {
  dialog: RiderNode;
  bg: RiderNode;
  previewPanel: RiderNode;
  step1: RiderNode;
  step2: RiderNode;
  itemWhitelist: { characters: number[]; paints: number[]; dyes: number[] };
  descPlane: RiderNode;
  infoIcon: RiderNode;
  warningTitle: RiderNode;
  warningDetailBoxes: RiderNode[];
  warningDetails: RiderNode[];
  itemSelect: RiderNode;
  grids: RiderNode[];
  sectionLabels: RiderNode[];
  sectionIcons: RiderNode[];
  nameBox: RiderNode;
  inputPrompt: RiderNode;
  edit: RiderNode;
  step1ButtonBox: RiderNode;
  step1Button: RiderNode;
  step2Intro: RiderNode;
  traineeLabel: RiderNode;
  riderIdLabel: RiderNode;
  step2ButtonBox: RiderNode;
  step2Button: RiderNode;
  frames: Map<string, Map<string, RiderFrame>>;
  config: RiderNode;
  texts: {
    caption: string;
    warningTitle: string;
    warningDetails: string[];
    inputPrompt: string;
    nextStep: string;
    trainee: string;
    sectionLabels: string[];
  };
  maxChar: number;
}

export interface RiderLayout {
  window: RiderRect;
  bg: RiderRect;
  preview: RiderRect;
  captionText: RiderRect;
  infoIcon: RiderRect;
  warningTitle: RiderRect;
  warningDetails: RiderRect[];
  sectionLabels: RiderRect[];
  sectionIcons: RiderRect[];
  grids: RiderRect[];
  inputPrompt: RiderRect;
  edit: RiderRect;
  step1Button: RiderRect;
  trainee: RiderRect;
  riderId: RiderRect;
  step2Button: RiderRect;
}

export function riderNodeByName(node: RiderNode, name: string,
  attribute: RiderAssetDependencies["attribute"]): RiderNode {
  const found = node.children.find(child => attribute(child, "name") === name);
  if (!found) throw new Error(`原车手注册窗口缺少 ${name}。`);
  return found;
}

export function riderString(node: RiderNode, name: string,
  attribute: RiderAssetDependencies["attribute"]): string {
  const entry = node.children.find(child => attribute(child, "n") === name);
  const localized = entry?.children.find(child => attribute(child, "c") === "cn")
    ?? entry?.children.find(child => attribute(child, "c") === "kr");
  const value = localized ? attribute(localized, "v") : undefined;
  if (!value) throw new Error(`原车手注册串袋缺少 ${name}。`);
  return value;
}

export function riderLabels(node: RiderNode): RiderNode[] {
  return node.children.filter(child => child.name === "Label");
}

export function riderFrame(blueprint: RiderBlueprint, frame: string,
  state: string): RiderFrame {
  return blueprint.frames.get(frame)!.get(state)!;
}

function uniqueResource(library: RiderResourceLibrary, path: string,
  label: string): RiderResource {
  const matches = library.exactCanonicalCandidates(path);
  if (matches.length !== 1) throw new Error(`${label}：${path}`);
  return matches[0]!;
}

function listedItems(node: RiderNode, kind: string,
  attribute: RiderAssetDependencies["attribute"]): number[] {
  return node.children.filter(child => child.name === kind)
    .map(child => Number(attribute(child, "id")))
    .filter(id => Number.isInteger(id) && id > 0);
}

/** Parse the exact original BML tree used by first-rider registration. */
export async function loadRiderBlueprint(library: RiderResourceLibrary,
  ops: RiderAssetDependencies): Promise<RiderBlueprint> {
  const attribute = ops.attribute;
  const [window, strings, frameLayout, config] = await Promise.all(
    blueprintPaths.map(async path => ops.parseBml(await uniqueResource(
      library, path, "车手注册资源缺失或不唯一").bytes())));
  const [characters, colors] = await Promise.all(whitelistPaths.map(async path =>
    ops.parseBml(await uniqueResource(library, path,
      "车手注册白名单资源缺失或不唯一").bytes())));
  for (const list of [characters, colors]) {
    if (list!.name !== "newRiderItem")
      throw new Error("newRiderItem 根节点不是 newRiderItem。");
  }
  // The CN list names both the characters (皮蛋 2, 黑妞 3) and the colors
  // (6/4/5/7); the generic @zz colors (1/4/5/7) apply only when @cn has none.
  const cnColors = listedItems(characters!, "color", attribute);
  const starterColors = cnColors.length ? cnColors : listedItems(colors!, "color", attribute);
  const itemWhitelist = {
    characters: listedItems(characters!, "character", attribute),
    paints: starterColors,
    dyes: [...starterColors],
  };
  const dialog = window!.children.find(child => child.name === "CaptionWindow");
  if (!dialog) throw new Error("原车手注册窗口缺少 CaptionWindow。");
  const bg = riderNodeByName(dialog, "bg", attribute);
  const step1 = riderNodeByName(bg, "step1", attribute);
  const step2 = riderNodeByName(bg, "step2", attribute);
  const panels: Array<{ node: RiderNode; parent: RiderNode }> = [];
  const collectPanels = (node: RiderNode, parent: RiderNode): void => {
    if (node.name === "RenderPanel") panels.push({ node, parent });
    node.children.forEach(child => collectPanels(child, node));
  };
  collectPanels(dialog, dialog);
  if (panels.length !== 1)
    throw new Error(`原车手注册窗口的 RenderPanel 数量必须为 1，实际 ${panels.length}。`);
  if (panels[0]!.parent !== step1)
    throw new Error("原车手注册窗口的 RenderPanel 未按原生挂在 step1 下。");
  const descPlane = riderNodeByName(step1, "descPlane", attribute);
  const warningBox = (text: string): RiderNode | undefined =>
    step1.children.find(child => child.name === "Container" &&
      child.children.some(entry => attribute(entry, "text") === text));
  const warningFirst = warningBox("#sb(warningDetail0)");
  const warningLast = warningBox("#sb(warningDetail4)");
  const nameBox = riderNodeByName(step1, "라이더이름", attribute);
  const edit = riderNodeByName(nameBox, "라이더이름입력", attribute);
  const step1ButtonBox = step1.children.find(child =>
    child.name === "Container" && child.children.some(entry =>
      attribute(entry, "name") === "완료"));
  const step2Intro = step2.children.find(child =>
    child.name === "Window" && child.children.some(entry =>
      attribute(entry, "name") === "riderId"));
  const step2ButtonBox = step2.children.find(child =>
    child.name === "Container" && child.children.some(entry =>
      attribute(entry, "name") === "nextStep"));
  if (!warningFirst || !warningLast || !step1ButtonBox || !step2Intro ||
      !step2ButtonBox)
    throw new Error("原车手注册窗口缺少警告、按钮或确认区。");
  const itemSelect = riderNodeByName(step1, "itemSelect", attribute);
  const containers = ["characterCont", "dyeCont", "colorCont"]
    .map(name => riderNodeByName(itemSelect, name, attribute));
  const grids = ["characterList", "dyeList", "colorList"]
    .map((name, index) => riderNodeByName(containers[index]!, name, attribute));
  const sectionLabels = ["#sb(selectCharacter)", "#sb(selectDye)",
    "#sb(selectPaint)"].map((text, index) => containers[index]!.children.find(
      child => child.name === "Label" && attribute(child, "text") === text));
  const sectionIcons = containers.map(container =>
    riderNodeByName(container, "iconPanel", attribute));
  if (sectionLabels.some(label => label === undefined))
    throw new Error("原车手注册窗口缺少选择区标题。");
  const maxChar = Number(attribute(edit, "maxChar"));
  if (!Number.isInteger(maxChar) || maxChar <= 0)
    throw new Error("原车手注册输入框缺少有效 maxChar。");
  const frames = new Map<string, Map<string, RiderFrame>>();
  for (const frame of frameLayout!.children) {
    if (frame.children.length)
      frames.set(frame.name, new Map(frame.children.map(state =>
        [state.name, ops.frameState(state)])));
  }
  for (const frameName of [attribute(dialog, "frame"),
    attribute(edit, "frame") ?? "DefaultEdit", "DefaultFocusedButton",
    "DefaultScrollUpButton", "DefaultScrollDownButton"]) {
    if (!frames.has(frameName!))
      throw new Error(`车手注册窗口缺少 ${frameName} 原版皮肤。`);
  }
  const inputPrompt = riderLabels(nameBox);
  if (!inputPrompt.length)
    throw new Error("原车手注册窗口缺少名称提示 Label。");
  const warningTitles = riderLabels(descPlane);
  if (!warningTitles.length)
    throw new Error("原车手注册窗口缺少警告标题 Label。");
  const confirmationLabels = riderLabels(step2Intro);
  if (!confirmationLabels.length)
    throw new Error("原车手注册窗口缺少确认页 Label。");
  const localized = (key: string) => riderString(strings!, key, attribute);
  return {
    dialog, bg, previewPanel: panels[0]!.node, step1, step2,
    itemWhitelist, descPlane,
    infoIcon: riderNodeByName(descPlane, "iconPanel", attribute),
    warningTitle: warningTitles[0]!,
    warningDetailBoxes: [warningFirst, warningLast],
    warningDetails: [...riderLabels(warningFirst), ...riderLabels(warningLast)],
    itemSelect, grids, sectionLabels: sectionLabels as RiderNode[],
    sectionIcons, nameBox, inputPrompt: inputPrompt[0]!, edit,
    step1ButtonBox, step1Button: riderNodeByName(step1ButtonBox, "완료", attribute),
    step2Intro, traineeLabel: confirmationLabels[0]!,
    riderIdLabel: riderNodeByName(step2Intro, "riderId", attribute),
    step2ButtonBox,
    step2Button: riderNodeByName(step2ButtonBox, "nextStep", attribute),
    frames, config: config!,
    texts: {
      caption: localized("newRiderCaption"),
      warningTitle: localized("warningBold"),
      warningDetails: ["warningDetail0", "warningDetail1",
        "warningDetail2_3", "warningDetail4"].map(localized),
      inputPrompt: localized("inputRiderId"),
      nextStep: localized("nextStep"),
      trainee: localized("trainee"),
      sectionLabels: ["selectCharacter", "selectDye", "selectPaint"]
        .map(localized),
    },
    maxChar,
  };
}

/** Resolve every registration control from the original BML layout tree. */
export function riderLayout(blueprint: RiderBlueprint,
  ops: RiderAssetDependencies): RiderLayout {
  const attribute = ops.attribute;
  const captionFrame = riderFrame(blueprint,
    attribute(blueprint.dialog, "frame")!, "Activated");
  const viewport = {
    x: 0, y: 0, width: RIDER_VIEW_WIDTH, height: RIDER_VIEW_HEIGHT,
  };
  const window = ops.windowRect(blueprint.dialog, viewport, captionFrame);
  const interior = ops.frameInset(captionFrame, window);
  const bg = ops.windowRect(blueprint.bg, interior);
  const first = ops.windowRect(blueprint.step1, bg);
  const second = ops.windowRect(blueprint.step2, bg);
  const description = ops.windowRect(blueprint.descPlane, first);
  const itemSelect = ops.windowRect(blueprint.itemSelect, first);
  const containers = ["characterCont", "dyeCont", "colorCont"]
    .map(name => ops.windowRect(riderNodeByName(blueprint.itemSelect,
      name, attribute), itemSelect));
  const nameBox = ops.windowRect(blueprint.nameBox, first);
  const step1ButtonBox = ops.windowRect(blueprint.step1ButtonBox, first);
  const step2Intro = ops.windowRect(blueprint.step2Intro, second);
  const step2ButtonBox = ops.windowRect(blueprint.step2ButtonBox, second);
  return {
    window, bg,
    preview: ops.windowRect(blueprint.previewPanel, first),
    captionText: ops.captionRect(captionFrame, window,
      ops.captionOffset(blueprint.dialog, blueprint.config)),
    infoIcon: ops.windowRect(blueprint.infoIcon, description),
    warningTitle: ops.windowRect(blueprint.warningTitle, description),
    warningDetails: blueprint.warningDetailBoxes.flatMap(box => {
      const rect = ops.windowRect(box, first);
      return riderLabels(box).map(label => ops.windowRect(label, rect));
    }),
    sectionLabels: blueprint.sectionLabels.map((label, index) =>
      ops.windowRect(label, containers[index]!)),
    sectionIcons: blueprint.sectionIcons.map((icon, index) =>
      ops.windowRect(icon, containers[index]!)),
    grids: blueprint.grids.map((grid, index) =>
      ops.windowRect(grid, containers[index]!)),
    inputPrompt: ops.windowRect(blueprint.inputPrompt, nameBox),
    edit: ops.windowRect(blueprint.edit, nameBox,
      riderFrame(blueprint,
        attribute(blueprint.edit, "frame") ?? "DefaultEdit", "Activated")),
    step1Button: ops.windowRect(blueprint.step1Button, step1ButtonBox,
      riderFrame(blueprint,
        attribute(blueprint.step1Button, "frame")!, "Normal")),
    trainee: ops.windowRect(blueprint.traineeLabel, step2Intro),
    riderId: ops.windowRect(blueprint.riderIdLabel, step2Intro),
    step2Button: ops.windowRect(blueprint.step2Button, step2ButtonBox,
      riderFrame(blueprint,
        attribute(blueprint.step2Button, "frame")!, "Normal")),
  };
}

export interface RiderImages {
  blueprint: RiderBlueprint;
  images: Map<string, CanvasImageSource & { close(): void }>;
}

const riderAssetCache = new WeakMap<RiderResourceLibrary, Promise<RiderImages>>();

/** Decode required chrome and optional item icons once for each resource library. */
export function loadRiderImages(library: RiderResourceLibrary,
  ops: RiderAssetDependencies): Promise<RiderImages> {
  let pending = riderAssetCache.get(library);
  if (pending) return pending;
  pending = (async () => {
    const blueprint = await loadRiderBlueprint(library, ops);
    const frameNames = [
      ops.attribute(blueprint.dialog, "frame")!,
      ops.attribute(blueprint.edit, "frame") ?? "DefaultEdit",
      "DefaultFocusedButton", "DefaultScrollUpButton",
      "DefaultScrollDownButton",
    ];
    const frameImages: string[] = [];
    for (const name of frameNames) {
      for (const frame of blueprint.frames.get(name)!.values()) {
        if (frame.texture !== "")
          frameImages.push(`gui_/monocoque/${frame.texture}.png`);
      }
    }
    const required = [
      ...new Set(frameImages), riderImagePaths.background,
      riderImagePaths.info, ...riderImagePaths.sectionIcons,
    ];
    const states = [1, 2, 3, 4];
    const optional = [
      ...blueprint.itemWhitelist.characters.flatMap(id => states.map(state =>
        `stage_/newRider/1_${id}_${state}.png`)),
      ...blueprint.itemWhitelist.paints.flatMap(id => states.map(state =>
        `stage_/newRider/2_${id}_${state}.png`)),
      ...blueprint.itemWhitelist.dyes.flatMap(id => states.map(state =>
        `stage_/newRider/2_${id}_${state}.png`)),
    ];
    const images = new Map<string, CanvasImageSource & { close(): void }>();
    try {
      await Promise.all(required.map(async path => {
        const resource = uniqueResource(library, path,
          "车手注册贴图缺失或不唯一");
        images.set(path, await ops.loadImage(await resource.bytes()));
      }));
      await Promise.all(optional.map(async path => {
        const matches = library.exactCanonicalCandidates(path);
        if (matches.length === 1)
          images.set(path, await ops.loadImage(await matches[0]!.bytes()));
      }));
      return { blueprint, images };
    } catch (error) {
      images.forEach(image => image.close());
      throw error;
    }
  })();
  riderAssetCache.set(library, pending);
  void pending.catch(() => {
    if (riderAssetCache.get(library) === pending)
      riderAssetCache.delete(library);
  });
  return pending;
}

export function normalizeRiderName(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength).trim();
}
