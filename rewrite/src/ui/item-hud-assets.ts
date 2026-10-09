/**
 * Original templates and textures of the item race HUD, laid out once on the
 * 1600×900 stage. The item stages (stage_itemIndiGame / stage_itemTeamGame)
 * ship no textures of their own: everything comes from the shared folders
 * their addResFolder lists plus gui_/windowTemplate and item.rho.
 */

import type { ItemAimPhase, ItemTeamColor } from "./item-hud-state";
import type { SlotImage, SlotNode, SlotRect } from "./item-slot-hud";

export type HudNode = SlotNode;
export type HudImage = SlotImage;
export type HudRect = SlotRect;

export interface HudResourceFile { bytes(): Promise<Uint8Array> }

export interface ItemHudAssetDependencies {
  attribute(node: HudNode, name: string): string | undefined;
  numbers(text: string, count: number, label: string): number[];
  parseBml(bytes: Uint8Array): HudNode;
  decodeTexture(bytes: Uint8Array): Promise<HudImage>;
  /** Release U1: the first root holding `name` (an @zz name tries @cn first). */
  findResource(library: unknown, roots: readonly string[], name: string,
    extension?: string): HudResourceFile;
  /** Release lt: a node's authored geometry. */
  geometry(node: HudNode, textures: Map<string, HudImage>,
    options: { viewport: { width: number; height: number } }): unknown;
  /** Release l5: a geometry placed in its parent rect. */
  place(geometry: unknown, parent: HudRect): HudRect;
}

export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 900;
export const STAGE_RECT: HudRect = { left: 0, top: 0, right: STAGE_WIDTH, bottom: STAGE_HEIGHT };

const windowTemplate = "gui_/windowTemplate";
const speedIndiGame = "stage_/speedIndiGame";
/** stage_itemIndiGame addResFolder, in order, then the template folders. */
const hudRoots = ["stage_/common", "stage_/common/icon", "stage_/common/mission",
  speedIndiGame, "stage_/itemIndiGame", windowTemplate];

export interface PlacedNode { node: HudNode; rect: HudRect }

export interface TextStyle {
  /** CSS color of the glyphs. */
  color: string;
  /** CSS color of the 1 px outline (outline14/16), or undefined. */
  outline?: string;
  size: number;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
}

export interface PlacedLabel extends PlacedNode { style: TextStyle }

export interface NoticeRow {
  icon: PlacedNode;
  label: PlacedLabel;
  state: PlacedNode;
}

export interface LogRow {
  root: PlacedNode;
  background: PlacedNode;
  attacker: PlacedLabel;
  victim: PlacedLabel;
  icon: PlacedNode;
  failIcon: PlacedNode;
}

export interface ChangerRow {
  key: PlacedNode;
  card: PlacedNode;
  number: PlacedNode;
  infinity: PlacedNode;
  /** FocusCard uv (pixels, l t r b) when usable and when not. */
  keyUv: { enabled: HudRect; disabled: HudRect };
  cardUv: { enabled: HudRect; disabled: HudRect };
  /** time_num glyphs and their advance (fontSize + spaceOffset). */
  glyphWidth: number;
  glyphHeight: number;
  glyphAdvance: number;
  glyphs: string;
}

export interface ItemHudAssets {
  textures: Map<string, HudImage>;
  crosshairs: Record<ItemAimPhase, { node: HudNode; texture: HudImage; name: string }>;
  warning: { node: HudNode; rect: HudRect; rocket: HudImage; waterfly: HudImage };
  teamWarn: { lamp: PlacedNode; light: PlacedNode };
  notices: {
    bad: NoticeRow[];
    good: NoticeRow[];
    lifeTimeMs: number;
    affectTimeMs: number;
  };
  log: { rows: LogRow[]; colors: Record<ItemTeamColor, { attacker: string; victim: string }> };
  infoCard: { root: HudRect; balloons: Record<2 | 3, PlacedNode>; text: PlacedLabel };
  changers: { slot: ChangerRow; item: ChangerRow };
  abuse: { node: HudNode; texture: HudImage; text: HudNode };
  scanning: { node: HudNode; texture: HudImage };
}

/** Release textColor "A R G B" (or a name) as a CSS color. */
export function hudColor(value: string | undefined, fallback = "white"): string {
  if (!value) return fallback;
  const channels = value.trim().split(/\s+/).map(Number);
  if (channels.length === 4 && channels.every(Number.isFinite)) {
    const [a, r, g, b] = channels as [number, number, number, number];
    return `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})`;
  }
  return value;
}

/** textRender (outline16, gulim14 …) and textAlign of a Label. */
export function labelStyle(node: HudNode, attribute: ItemHudAssetDependencies["attribute"]): TextStyle {
  const render = attribute(node, "textRender") ?? "";
  const size = Number(/\d+/.exec(render)?.[0] ?? 14);
  const align = (attribute(node, "textAlign") ?? "").split(/[;|,\s]+/);
  return {
    color: hudColor(attribute(node, "textColor")),
    outline: render.startsWith("outline") ? hudColor(attribute(node, "textColor2"), "black") : undefined,
    size,
    align: align.includes("right") ? "right"
      : align.includes("center") || align.includes("hcenter") ? "center" : "left",
    verticalAlign: align.includes("vcenter") || align.includes("center") ? "center"
      : align.includes("bottom") ? "bottom" : "top",
  };
}

/**
 * Every node's rect, children inside their parent. An `anchor` the release
 * layout ignores (itemStateTotalNotice "0 0.2") places the unaligned axis at
 * that fraction of the parent.
 */
export function layoutTemplate(root: HudNode, parent: HudRect, textures: Map<string, HudImage>,
  deps: ItemHudAssetDependencies): Map<HudNode, HudRect> {
  const rects = new Map<HudNode, HudRect>();
  const visit = (node: HudNode, outer: HudRect) => {
    const width = outer.right - outer.left;
    const height = outer.bottom - outer.top;
    const local = deps.place(deps.geometry(node, textures, { viewport: { width, height } }),
      { left: 0, top: 0, right: width, bottom: height });
    let rect = { left: outer.left + local.left, top: outer.top + local.top,
      right: outer.left + local.right, bottom: outer.top + local.bottom };
    const anchor = deps.attribute(node, "anchor");
    if (anchor !== undefined) {
      const [x, y] = deps.numbers(anchor, 2, "anchor");
      const align = deps.attribute(node, "align") ?? "";
      const dx = /left|right|hcenter|(^|[;\s])center/.test(align) ? 0 : Math.round(x! * width);
      const dy = /top|bottom|vcenter|(^|[;\s])center/.test(align) ? 0 : Math.round(y! * height);
      rect = { left: rect.left + dx, top: rect.top + dy, right: rect.right + dx,
        bottom: rect.bottom + dy };
    }
    rects.set(node, rect);
    for (const child of node.children) visit(child, rect);
  };
  visit(root, parent);
  return rects;
}

export function findNode(root: HudNode, name: string,
  attribute: ItemHudAssetDependencies["attribute"]): HudNode {
  const hits: HudNode[] = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (attribute(node, "name") === name) hits.push(node);
    stack.push(...node.children);
  }
  if (hits.length !== 1) throw new Error(`道具 HUD 模板 ${name} 数量必须为 1，实际 ${hits.length}。`);
  return hits[0]!;
}

function childNamed(node: HudNode, name: string,
  attribute: ItemHudAssetDependencies["attribute"]): HudNode {
  const child = node.children.find(entry => attribute(entry, "name") === name);
  if (!child) throw new Error(`道具 HUD 模板 ${attribute(node, "name")} 缺少 ${name}。`);
  return child;
}

class AssetLoader {
  readonly textures = new Map<string, HudImage>();

  constructor(readonly library: unknown, readonly deps: ItemHudAssetDependencies) {}

  async bml(folder: string, name: string): Promise<HudNode> {
    return this.deps.parseBml(await this.deps.findResource(this.library, [folder], name,
      ".bml").bytes());
  }

  /** A texture by its BML name, stored under that name. */
  async texture(name: string, roots: readonly string[] = hudRoots): Promise<HudImage> {
    const cached = this.textures.get(name);
    if (cached) return cached;
    const image = await this.deps.decodeTexture(await this.deps.findResource(this.library,
      roots, name).bytes());
    this.textures.set(name, image);
    return image;
  }

  async treeTextures(root: HudNode, roots: readonly string[] = hudRoots,
    skip: ReadonlySet<string> = new Set()): Promise<void> {
    const names = new Set<string>();
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      const texture = this.deps.attribute(node, "texture");
      if (texture && !skip.has(texture)) names.add(texture);
      stack.push(...node.children);
    }
    await Promise.all([...names].map(name => this.texture(name, roots)));
  }
}

function uvRect(text: string | undefined, label: string,
  deps: ItemHudAssetDependencies): HudRect {
  if (text === undefined) throw new Error(`道具 HUD ${label} 缺少 uv。`);
  const [left, top, right, bottom] = deps.numbers(text, 4, label);
  return { left: left!, top: top!, right: right!, bottom: bottom! };
}

function noticeRows(container: HudNode, prefix: string, rects: Map<HudNode, HudRect>,
  deps: ItemHudAssetDependencies): NoticeRow[] {
  return [0, 1, 2].map(index => {
    const row = childNamed(container, `${prefix}_${index}`, deps.attribute);
    const placed = (name: string) => {
      const node = childNamed(row, name, deps.attribute);
      return { node, rect: rects.get(node)! };
    };
    const label = placed("itemStateLabel");
    return { icon: placed("itemImagePanel"), state: placed("ItemStatePanel"),
      label: { ...label, style: labelStyle(label.node, deps.attribute) } };
  });
}

function changerRow(root: HudNode, origin: HudRect, loader: AssetLoader): ChangerRow {
  const deps = loader.deps;
  const rects = layoutTemplate(root, origin, loader.textures, deps);
  const placed = (name: string) => {
    const node = childNamed(root, name, deps.attribute);
    return { node, rect: rects.get(node)! };
  };
  const key = placed("keyDisp");
  const card = placed("exist");
  const number = placed("changerNum");
  const [glyphWidth, glyphHeight] = deps.numbers(deps.attribute(number.node, "fontSize") ?? "",
    2, "changerNum.fontSize");
  const spacing = Number(deps.attribute(number.node, "spaceOffset") ?? 0);
  return {
    key, card, number, infinity: placed("infinity"),
    keyUv: { enabled: uvRect(deps.attribute(key.node, "focusedUv"), "keyDisp.focusedUv", deps),
      disabled: uvRect(deps.attribute(key.node, "disableUv"), "keyDisp.disableUv", deps) },
    cardUv: { enabled: uvRect(deps.attribute(card.node, "focusedUv"), "exist.focusedUv", deps),
      disabled: uvRect(deps.attribute(card.node, "disableUv"), "exist.disableUv", deps) },
    glyphWidth: glyphWidth!, glyphHeight: glyphHeight!,
    glyphAdvance: glyphWidth! + (Number.isFinite(spacing) ? spacing : 0),
    glyphs: deps.attribute(number.node, "fontStr") ?? "",
  };
}

/** mq_window "item" container (0 0 280 75): changerinfo and retryInfo. */
export const CHANGER_CONTAINER: HudRect = { left: 0, top: 0, right: 280, bottom: 75 };

/**
 * Where the item stages' "item" container sits. The native stage placed it;
 * here it goes beside the slot row, vertically centred on the 92 px slot [还原].
 */
export function changerOffset(slotRowRight: number): { x: number; y: number } {
  return { x: slotRowRight + 8, y: 24 + Math.floor((92 - 72) / 2) };
}

/** Synthetic nodes for HUD parts the original drew in native code. */
function syntheticNode(name: string, attributes: Record<string, string> = {}): HudNode {
  return { name: "Panel", attributes: [["name", name], ["alphaBlend", "true"],
    ...Object.entries(attributes)].map(([key, value]) => ({ name: key!, value: value! })),
  children: [] };
}

export async function loadItemHudAssets(library: unknown,
  deps: ItemHudAssetDependencies): Promise<ItemHudAssets> {
  const loader = new AssetLoader(library, deps);
  const attribute = deps.attribute;
  const [screenUi, slotChanger, itemChanger, firingWarning, notice, totalNotice, infoCard] =
    await Promise.all([
      loader.bml(speedIndiGame, "screenui"),
      loader.bml(speedIndiGame, "slotChanger"),
      loader.bml(speedIndiGame, "itemChanger"),
      loader.bml(windowTemplate, "firingWarning"),
      loader.bml(windowTemplate, "itemStateNotice"),
      loader.bml(windowTemplate, "itemStateTotalNotice"),
      loader.bml(windowTemplate, "itemInfoCard"),
    ]);
  const placeholderIcons = new Set(["item4", "item10"]);
  await Promise.all([
    loader.treeTextures(findNode(screenUi, "teamWarn", attribute)),
    loader.treeTextures(slotChanger), loader.treeTextures(itemChanger),
    loader.treeTextures(firingWarning),
    loader.texture("warning_waterfly"),
    loader.treeTextures(notice, hudRoots, placeholderIcons),
    loader.treeTextures(totalNotice, hudRoots, placeholderIcons),
    loader.texture("itemInfo_BG_teamGreen"), loader.texture("itemInfo_BG_teamYellow"),
    loader.treeTextures(infoCard),
    loader.texture("itemCubeAbusingMsgBg"),
    loader.texture("crosshaira", ["item/common"]),
    loader.texture("crosshairb", ["item/common"]),
    loader.texture("crosshairc", ["item/common"]),
    loader.texture("slot_scanning", ["item/slot"]),
  ]);
  const textures = loader.textures;

  const teamWarnNode = findNode(screenUi, "teamWarn", attribute);
  const screenRects = layoutTemplate({ ...screenUi, children: [teamWarnNode] }, STAGE_RECT,
    textures, deps);
  const light = childNamed(teamWarnNode, "light", attribute);

  const warningNode = findNode(firingWarning, "firingWarningPanel", attribute);

  const noticeRects = layoutTemplate(notice, STAGE_RECT, textures, deps);
  const lifeTimeMs = Number(attribute(notice, "lifeTime"));
  const affectTimeMs = Number(attribute(notice, "affectTime"));
  if (!(lifeTimeMs > 0) || !(affectTimeMs >= 0) || affectTimeMs > lifeTimeMs)
    throw new Error("itemStateNotice lifeTime/affectTime 无效。");

  const logRects = layoutTemplate(totalNotice, STAGE_RECT, textures, deps);
  const logRows = [0, 1, 2].map(index => {
    const row = childNamed(totalNotice, `itemStateLog_${index}`, attribute);
    const placed = (name: string) => {
      const node = childNamed(row, name, attribute);
      return { node, rect: logRects.get(node)! };
    };
    const attacker = placed("rid0");
    const victim = placed("rid1");
    return {
      root: { node: row, rect: logRects.get(row)! },
      background: placed("bg"), icon: placed("icon"), failIcon: placed("subIcon"),
      attacker: { ...attacker, style: labelStyle(attacker.node, attribute) },
      victim: { ...victim, style: labelStyle(victim.node, attribute) },
    } satisfies LogRow;
  });
  // The template's three rows show the solo, blue and red colours.
  const logColors = {
    solo: { attacker: logRows[0]!.attacker.style.color, victim: logRows[0]!.victim.style.color },
    blue: { attacker: logRows[1]!.attacker.style.color, victim: logRows[1]!.victim.style.color },
    red: { attacker: logRows[2]!.attacker.style.color, victim: logRows[2]!.victim.style.color },
  };

  const infoRects = layoutTemplate(infoCard, STAGE_RECT, textures, deps);
  const balloon = (name: string) => {
    const node = findNode(infoCard, name, attribute);
    return { node, rect: infoRects.get(node)! };
  };
  const desc = balloon("itemDesc");

  const abuseNode = syntheticNode("itemCubeAbusingMsg", { texture: "itemCubeAbusingMsgBg" });

  return {
    textures,
    crosshairs: {
      aiming: { node: syntheticNode("crosshair", { texture: "crosshaira" }),
        texture: textures.get("crosshaira")!, name: "crosshaira" },
      inrange: { node: syntheticNode("crosshair", { texture: "crosshairb" }),
        texture: textures.get("crosshairb")!, name: "crosshairb" },
      ontarget: { node: syntheticNode("crosshair", { texture: "crosshairc" }),
        texture: textures.get("crosshairc")!, name: "crosshairc" },
    },
    warning: { node: warningNode, rect: STAGE_RECT,
      rocket: textures.get("warning_rocket")!, waterfly: textures.get("warning_waterfly")! },
    teamWarn: { lamp: { node: teamWarnNode, rect: screenRects.get(teamWarnNode)! },
      light: { node: light, rect: screenRects.get(light)! } },
    notices: {
      bad: noticeRows(findNode(notice, "goodCon", attribute), "itemStateNoticeBad",
        noticeRects, deps),
      good: noticeRows(findNode(notice, "badCon", attribute), "itemStateNoticeGood",
        noticeRects, deps),
      lifeTimeMs, affectTimeMs,
    },
    log: { rows: logRows, colors: logColors },
    infoCard: {
      root: infoRects.get(infoCard)!,
      balloons: { 2: balloon("itemDescPanel1"), 3: balloon("itemDescPanel2") },
      text: { ...desc, style: labelStyle(desc.node, attribute) },
    },
    changers: {
      slot: changerRow(slotChanger, CHANGER_CONTAINER, loader),
      item: changerRow(itemChanger, CHANGER_CONTAINER, loader),
    },
    abuse: { node: abuseNode, texture: textures.get("itemCubeAbusingMsgBg")!,
      text: syntheticNode("itemCubeAbusingText") },
    scanning: { node: syntheticNode("scanning", { texture: "slot_scanning" }),
      texture: textures.get("slot_scanning")! },
  };
}

export interface ItemDescription { name: string; description: string }

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  return new TextDecoder().decode(bytes);
}

function unescapeXml(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** The cn strings of an etc_ string bag (`<k n='key'><m c='cn' v='…'/></k>`). */
export function readStringBag(xml: string): Map<string, string> {
  const strings = new Map<string, string>();
  for (const match of xml.matchAll(/<k n=['"]([^'"]+)['"]>([\s\S]*?)<\/k>/g)) {
    const cn = /<m c=['"]cn['"] v=(?:'([^']*)'|"([^"]*)")/.exec(match[2]!);
    if (cn) strings.set(match[1]!, unescapeXml(cn[1] ?? cn[2] ?? ""));
  }
  return strings;
}

async function stringBag(library: unknown, name: string,
  deps: ItemHudAssetDependencies): Promise<Map<string, string>> {
  return readStringBag(decodeText(await deps.findResource(library, ["etc_"], name, ".xml").bytes()));
}

/** baseStringBag multiplay_itemCubeAbusing: "无法获取更多道具。|请移动至下个道具箱。" */
export async function loadAbuseText(library: unknown,
  deps: ItemHudAssetDependencies): Promise<string> {
  const text = (await stringBag(library, "baseStringBag", deps)).get("multiplay_itemCubeAbusing");
  if (!text) throw new Error("baseStringBag 缺少 multiplay_itemCubeAbusing。");
  return text;
}

/**
 * Item names and descriptions (etc_/itemDescList.xml `<name>` / `<name>_desc`)
 * by idx, the idx↔name pairs coming from the item race probability tables.
 */
export async function loadItemDescriptions(library: unknown,
  deps: ItemHudAssetDependencies): Promise<Map<number, ItemDescription>> {
  const [strings, ...tables] = await Promise.all([
    stringBag(library, "itemDescList", deps),
    ...["itemProb_indi@zz", "itemProb_team2@cn"].map(async name => deps.parseBml(
      await deps.findResource(library, ["item/slot"], name, ".bml").bytes())),
  ]);
  const descriptions = new Map<number, ItemDescription>();
  for (const table of tables) {
    for (const item of table.children) {
      const name = deps.attribute(item, "name");
      const idx = Number(deps.attribute(item, "idx"));
      if (!name || !Number.isInteger(idx) || descriptions.has(idx)) continue;
      // randomRocket has a cn description but an empty cn name.
      const entry = { name: strings.get(name) ?? "", description: strings.get(`${name}_desc`) ?? "" };
      if (entry.name || entry.description) descriptions.set(idx, entry);
    }
  }
  return descriptions;
}
