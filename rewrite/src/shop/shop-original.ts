/**
 * The original CN shop screen as data: the stage_mqShop / dialog2_buyItem
 * layouts (shop-original-data.ts, verbatim copies of the decoded BML), the
 * monocoque window frames they use, their CN strings and the shop camera's
 * intro animation. Rectangles are resolved with the release BML layout
 * functions the rest of the rewrite uses (generated/formats.js V0 for
 * leftTopWH / windowRect / windowSize + align + adjust / leftTopTex, E9 for a
 * frame's client area, Ft for frame states, m4 for TextButton styles), so the
 * DOM shop is placed exactly where the original puts it.
 *
 * The PC client draws its windows at native size on a screen 1080 pixels
 * high (SHOP_SCREEN_HEIGHT): the shop resolves its layouts on a virtual
 * screen of that height and the viewport's aspect (shopScreen), so the
 * align/adjust anchors (center, right, bottom) land where the original's do,
 * and scales that screen into the viewport. ShopLayout's default frame stays
 * the 1600×900 stage the release layout walker (generated jc) is checked on.
 */
import { E9, Ft, m4, T, V0 } from "../generated/formats.js";
import {
  BUY_DIALOG_XML, CAM_INTRO_XML, CARD_CASH_XML, CARD_KOIN_XML, CARD_LUCCI_XML, CARD_TIP_XML,
  DIALOG_CLOSE_BUTTON_XML, MONOCOQUE_CONFIG_XML, MONOCOQUE_FRAMES_XML, STAGE_WINDOW_XML,
  STOCK_COMBO_ITEM_XML, TC_CASH_SLOT_XML, TC_CASH_WINDOW_XML,
} from "./shop-original-data";
import type { Currency } from "../account/account-session";

/** The release layout walker's stage (ShopLayout's default frame). */
export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 900;

/** The PC client's screen height: its UI is drawn 1:1 on a 1920×1080 screen. */
export const SHOP_SCREEN_HEIGHT = 1080;
/** The reference screen (16:9) the original screenshots were taken on. */
export const SHOP_SCREEN_WIDTH = 1920;

export interface ShopScreen {
  /** Virtual screen pixels; height is always SHOP_SCREEN_HEIGHT. */
  readonly width: number;
  readonly height: number;
  /** Viewport pixels per screen pixel. */
  readonly scale: number;
}

/**
 * The virtual screen for a viewport: SHOP_SCREEN_HEIGHT high, as wide as the
 * viewport's aspect allows, scaled by viewportHeight / 1080 (the original
 * scales its UI by height).
 */
export function shopScreen(viewportWidth: number, viewportHeight: number): ShopScreen {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : SHOP_SCREEN_HEIGHT;
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : height * 16 / 9;
  const scale = Math.max(0.05, height / SHOP_SCREEN_HEIGHT);
  return { width: Math.max(1, Math.round(width / scale)), height: SHOP_SCREEN_HEIGHT, scale };
}

/** The frame a top-level window is laid out in on a screen. */
export function screenRect(screen: Pick<ShopScreen, "width" | "height">): ShopRect {
  return { x: 0, y: 0, width: screen.width, height: screen.height };
}

// --- Nodes ----------------------------------------------------------------

/** A decoded BML element (the shape generated/formats.js works on). */
export interface ShopNode {
  name: string;
  text: string;
  attributes: Array<{ name: string; value: string }>;
  children: ShopNode[];
}

export interface ShopRect { x: number; y: number; width: number; height: number }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

function unescape(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_whole, entity: string) => {
    if (entity[0] !== "#") return ENTITIES[entity.toLowerCase()]!;
    const code = entity[1] === "x" || entity[1] === "X"
      ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return String.fromCodePoint(code);
  });
}

/**
 * Parses the element-and-attribute XML that decoded BML files are made of
 * (no text content, no namespaces). Throws on anything else.
 */
export function parseLayoutXml(source: string): ShopNode {
  const text = source.replace(/^\s*<\?xml[^>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "");
  const tag = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
  const attribute = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const stack: ShopNode[] = [];
  let root: ShopNode | undefined;
  let position = 0;
  for (;;) {
    while (position < text.length && /\s/.test(text[position]!)) position++;
    if (position >= text.length) break;
    tag.lastIndex = position;
    const match = tag.exec(text);
    if (!match) throw new Error(`商店布局 XML 在 ${position} 处无效。`);
    position = tag.lastIndex;
    const [, closing, name, rawAttributes, selfClosing] = match as unknown as [string, string, string, string, string];
    if (closing) {
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error(`商店布局 XML 的 </${name}> 不匹配。`);
      continue;
    }
    const node: ShopNode = { name, text: "", attributes: [], children: [] };
    for (const entry of rawAttributes.matchAll(attribute))
      node.attributes.push({ name: entry[1]!, value: unescape(entry[2] ?? entry[3] ?? "") });
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else if (root) throw new Error("商店布局 XML 有多个根元素。");
    else root = node;
    if (!selfClosing) stack.push(node);
  }
  if (!root || stack.length) throw new Error("商店布局 XML 未闭合。");
  return root;
}

export function attr(node: ShopNode | undefined, name: string): string | undefined {
  return node ? T(node, name) as string | undefined : undefined;
}

/** A copy of node with some attributes replaced (undefined removes one). */
export function withAttributes(node: ShopNode, changes: Record<string, string | undefined>,
  children = node.children): ShopNode {
  const attributes = node.attributes.filter(entry => !(entry.name in changes));
  for (const [name, value] of Object.entries(changes))
    if (value !== undefined) attributes.push({ name, value });
  return { ...node, attributes, children };
}

/** Depth-first nodes named `name` (BML names are not unique: e.g. two shopGCoinCharge). */
export function findAll(node: ShopNode, name: string, found: ShopNode[] = []): ShopNode[] {
  if (attr(node, "name") === name) found.push(node);
  for (const child of node.children) findAll(child, name, found);
  return found;
}

export function find(node: ShopNode, name: string): ShopNode {
  const found = findAll(node, name)[0];
  if (!found) throw new Error(`原版商店布局缺少 ${name}。`);
  return found;
}

// --- Frames -------------------------------------------------------------

/** One frame state as generated/formats.js Ft reads it. */
export interface ShopFrame {
  texture: string;
  caption: ShopRect; left: ShopRect; right: ShopRect; client: ShopRect; bottom: ShopRect;
  captionLeftMargin: number; captionRightMargin: number;
  bottomLeftMargin: number; bottomRightMargin: number;
  clientType: "fill" | "transFill" | "none";
}

const FRAME_TREE = parseLayoutXml(MONOCOQUE_FRAMES_XML);
const CONFIG = parseLayoutXml(MONOCOQUE_CONFIG_XML);

/** Frame states in file order (Normal/MouseOn/Clicked/Disabled or Activated/Deactivated). */
export const SHOP_FRAMES: ReadonlyMap<string, readonly ShopFrame[]> = new Map(
  FRAME_TREE.children.map(frame => [frame.name, frame.children.map(state => Ft(state) as ShopFrame)]));

export function shopFrame(name: string | undefined, state = 0): ShopFrame | undefined {
  if (!name) return undefined;
  const states = SHOP_FRAMES.get(name);
  return states?.[Math.min(state, states.length - 1)];
}

/** The frame a node draws: its frame attribute; Edit and ComboBox default to DefaultEdit. */
export function frameName(node: ShopNode): string | undefined {
  return attr(node, "frame") ?? (node.name === "Edit" ? "DefaultEdit" : undefined);
}

export interface ButtonStyleState { frame: ShopFrame; textRender: string; textColor: string; textColor2: string }

/** generated m4: a TextButton's four states from the monocoque config (focus frame for 确定). */
export function textButtonStyle(node: ShopNode): { frameName: string; states: ButtonStyleState[] } {
  return m4(node, CONFIG, FRAME_TREE) as { frameName: string; states: ButtonStyleState[] };
}

/** The monocoque CaptionWindow caption offset (config dialogCaptionPosOffset + captionPos). */
export function captionOffset(node: ShopNode): { x: number; y: number } {
  const frame = attr(node, "frame");
  const config = CONFIG.children.find(child => child.name === "CaptionWindow")
    ?.children.find(child => child.name === frame);
  const [x, y] = (attr(node, "captionPos") ?? "0 0").trim().split(/\s+/).map(Number);
  const [offsetX, offsetY] = ((config && attr(config, "dialogCaptionPosOffset")) || "0 0")
    .trim().split(/\s+/).map(Number);
  return { x: x! + offsetX!, y: y! + offsetY! };
}

// --- Layout ---------------------------------------------------------------

/**
 * Natural sizes of the images placed with leftTopTex (BML lays those out at
 * the texture's size). The browser checks them against the loaded art.
 */
export const TEXTURE_SIZES: Readonly<Record<string, { width: number; height: number }>> = {
  img_currencyBG: { width: 186, height: 38 },
  img_lucciBG: { width: 126, height: 38 },
  common_icon_battery: { width: 34, height: 34 },
  common_icon_cash: { width: 34, height: 34 },
  common_icon_lucci: { width: 34, height: 34 },
  common_icon_koin: { width: 34, height: 34 },
  btn_chargeKoin_1: { width: 30, height: 30 },
};

/** The natural size BML gives a leftTopTex node (its texture's, or its _1 state's). */
export function textureSize(node: ShopNode): { width: number; height: number } | undefined {
  const series = attr(node, "autoLoadImage");
  const name = series ? `${series.replace(/(@zz)?$/, "1$1")}` : attr(node, "texture");
  return name ? TEXTURE_SIZES[name] : undefined;
}

/** A node's rectangle inside its parent's client rectangle (generated V0). */
export function nodeRect(node: ShopNode, parent: ShopRect): ShopRect {
  return V0(node, parent, shopFrame(frameName(node)), textureSize(node)) as ShopRect;
}

/** The rectangle children of a framed node are laid out in (generated E9). */
export function clientRect(node: ShopNode, rect: ShopRect): ShopRect {
  const frame = shopFrame(frameName(node));
  return frame ? E9(frame, rect) as ShopRect : rect;
}

/** Every node of a layout tree with its absolute rectangle; hidden nodes included. */
export class ShopLayout {
  private readonly rects = new Map<ShopNode, ShopRect>();

  constructor(readonly root: ShopNode, origin: ShopRect = { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT }) {
    const visit = (node: ShopNode, parent: ShopRect) => {
      const rect = nodeRect(node, parent);
      this.rects.set(node, rect);
      const inner = clientRect(node, rect);
      for (const child of node.children) visit(child, inner);
    };
    visit(root, origin);
  }

  rect(node: ShopNode): ShopRect {
    const rect = this.rects.get(node);
    if (!rect) throw new Error(`商店布局节点 ${node.name} 不在此布局中。`);
    return rect;
  }

  /** The rectangle of node relative to ancestor's rectangle. */
  relative(node: ShopNode, ancestor: ShopNode): ShopRect {
    const rect = this.rect(node), base = this.rect(ancestor);
    return { ...rect, x: rect.x - base.x, y: rect.y - base.y };
  }

  named(name: string): ShopNode { return find(this.root, name); }
}

// --- Original screens ---------------------------------------------------

export const STAGE_WINDOW = parseLayoutXml(STAGE_WINDOW_XML);
export const SHOP_CARD_TIP = parseLayoutXml(CARD_TIP_XML);
/** tcCashEvent/tcCashWindow@zz (550×184): the 累计消费活动 window at stage_window tcCashWndPos. */
export const TC_CASH_WINDOW = parseLayoutXml(TC_CASH_WINDOW_XML);
/** tcCashEvent/tcCashSlotCard: one step of the window's stepWindow (80×80 reward slot and its value). */
export const TC_CASH_SLOT = parseLayoutXml(TC_CASH_SLOT_XML);
export const STOCK_COMBO_ITEM = parseLayoutXml(STOCK_COMBO_ITEM_XML);
export const DIALOG_CLOSE_BUTTON = parseLayoutXml(DIALOG_CLOSE_BUTTON_XML);

/** shopCardCash / shopCardLucci / shopCardKoin@cn: the card for a price currency (ECONOMY.md 0). */
export const SHOP_CARDS: Readonly<Record<Currency, ShopNode>> = {
  coupon: parseLayoutXml(CARD_CASH_XML),
  lucci: parseLayoutXml(CARD_LUCCI_XML),
  koin: parseLayoutXml(CARD_KOIN_XML),
};

/**
 * mqBuyItem@cn with the CaptionDialog close button the release adds for
 * setCloseButton (generated library ma: stage_common dialogCloseButton,
 * renamed to the cancel button it stands for). The hidden off-screen pool
 * (windowRect "fullwidth fullheight 2048 2048": luccon/cash payment-method
 * buttons and 电池兑换) holds nothing the CN dialog shows and is left out.
 */
export const BUY_DIALOG: ShopNode = (() => {
  const root = parseLayoutXml(BUY_DIALOG_XML);
  const caption = root.children.find(child => child.name === "CaptionWindow")!;
  const close = withAttributes(DIALOG_CLOSE_BUTTON, { name: "closeButton" });
  return { ...root, children: root.children
    .filter(child => child === caption || attr(child, "visible") !== "false")
    .map(child => child === caption ? { ...caption, children: [...caption.children, close] } : child) };
})();

// --- Strings ------------------------------------------------------------

/**
 * CN strings the layouts name with #sb(key): stage_mqShop stage_stringBag,
 * then etc_/baseStringBag (and dialog2_buyItem buyItem_stringBag for the
 * dialog). shop-original.test.ts checks each against the decoded bags.
 */
export const SHOP_STRINGS = {
  // stage_mqShop.rho stage_stringBag
  trade: "兑换", giveGift: "赠送", reset: "初始状态", buyAll: "兑换预览道具",
  recommand: "推荐", kartBody: "卡丁车", shopCoupon: "输入兑奖券", rechargeGCoin: "充值",
  gcoinCharge: "充值", charge: "充值", search: "搜索", searchTooltip: "请输入道具名称",
  kItemPrice: "道具价格", notAllowEnchant: "不可改装", new: "新商品", selected: "目前装备中",
  headBand: "电磁波头带", color: "喷漆", etc: "其它", gachaUseResult: "精品道具全服记录",
  discount: "折", tcCashEvent1: "累计消费活动", tcCashPoint1: "累计消费电池数",
  tcCashEventHelp1: "活动期间消费一定电池，即可获得相应奖励！",
  tcCashEventPeriod: "活动期间 : %s", tcCashEventRewardPeriod: "奖励领取期间 : %s",
  tcCashEventClose1: "累计消费活动已结束。",
  // etc_/baseStringBag
  character: "角色", package: "礼包", equip: "装备", useful: "使用", whole: "全部",
  itemKart: "道具", speedkart: "竞速", hotItem: "热门商品", event: "活动", balloon: "气球",
  goggle: "防尘眼镜", dye: "染色剂", pet: "宠物", flyingPet: "飞行宠物", aura: "炫光",
  skidMark: "漂移痕迹", plate: "车牌", ok: "确定", cancel: "取消", close: "关闭",
  unlimited: "无限制", countFormat: "%d 个", periodFormat: "%d 天",
  // dialog2_buyItem.rho buyItem_stringBag
  itemName: "道具名称", itemPrice: "道具价格", selectStr: "选择期限",
  selectError: "请选择要兑换道具的使用期限",
} as const satisfies Record<string, string>;

export type ShopStringKey = keyof typeof SHOP_STRINGS;

/** Resolves #sb(key) references; unknown keys stay empty like the release renderer. */
export function shopText(value: string | undefined): string {
  return (value ?? "").replace(/#sb\(([^)]+)\)/g, (_whole, key: string) =>
    (SHOP_STRINGS as Record<string, string>)[key] ?? "");
}

// --- Text styles --------------------------------------------------------

export interface ShopTextStyle {
  /** CSS pixels at stage scale. */
  size: number;
  /** gui_/font font@cn: FtFont Bold/Medium, or the 12 px NSimSun bitmap default. */
  face: "bold" | "medium" | "default";
  /** outline* renders: a one pixel textColor2 outline. */
  stroke: boolean;
}

/**
 * gui_/font/font@cn.bml: default/bold/outline are the 12 px NSimSun bitmap
 * font (bold and outline filtered), boldNN/outlineNN SourceHanSansCN-Bold at
 * NN px (outline with a 1 px stroke), medium16/default16 the Medium face.
 */
export function textRenderStyle(render: string | undefined): ShopTextStyle {
  const value = (render ?? "default").trim();
  const match = /^(bold|outline|medium|default|bigbold)(\d+)?$/.exec(value);
  if (!match) return { size: 12, face: "default", stroke: false };
  const [, kind, digits] = match;
  const size = digits ? Number(digits) : 12;
  if (!digits) return { size, face: kind === "default" ? "default" : "bold", stroke: kind === "outline" };
  return {
    size,
    face: kind === "medium" || kind === "default" ? "medium" : "bold",
    stroke: kind === "outline" || kind === "default",
  };
}

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff", black: "#000000", yellow: "#ffff00", skyblue: "#87ceeb", gray: "#808080",
  red: "#ff0000", green: "#00ff00", blue: "#0000ff",
};

/** A BML colour ("a r g b" or a name) as CSS (generated E8 / fM). */
export function shopColor(value: string | undefined, fallback = "#ffffff"): string {
  if (!value) return fallback;
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    const [a, r, g, b] = parts as [number, number, number, number];
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  }
  return NAMED_COLORS[value.trim().toLowerCase()] ?? value.trim();
}

export type ShopAlign = "left" | "center" | "right";
export type ShopVerticalAlign = "top" | "center";

/** textAlign tokens; buttons and captions centre by default (generated drawNode). */
export function textAlignment(node: ShopNode): { align: ShopAlign; valign: ShopVerticalAlign } {
  const centered = node.name.includes("Button") || node.name === "CaptionWindow";
  const value = attr(node, "textAlign") ?? (centered ? "center" : "left");
  const tokens = value.split(/[|,.;\s]+/).filter(Boolean);
  const align: ShopAlign = tokens.includes("center") || tokens.includes("hcenter") ? "center"
    : tokens.includes("right") ? "right" : "left";
  const valign: ShopVerticalAlign = tokens.includes("center") || tokens.includes("vcenter")
    ? "center" : "top";
  return { align, valign };
}

// --- Shop camera intro (camIntroAni.bml) -----------------------------------

export interface CamIntroKey {
  time: number;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
}

/** camIntroAni.bml Position and RotByVector keys, in time order. */
export const CAM_INTRO: readonly CamIntroKey[] = (() => {
  const root = parseLayoutXml(CAM_INTRO_XML);
  const keys = (name: string) => root.children.find(child => child.name === name)!.children
    .map(key => ({ time: Number(attr(key, "time")),
      value: attr(key, "value")!.trim().split(/\s+/).map(Number) as [number, number, number] }));
  const position = keys("Position");
  const rotation = keys("RotByVector");
  return position.map((key, index) => ({
    time: key.time, position: key.value, rotation: rotation[index]!.value,
  }));
})();

/** Linear interpolation of the camera position at time (ms), clamped to the keys. */
export function camIntroPosition(time: number): [number, number, number] {
  const keys = CAM_INTRO;
  if (time <= keys[0]!.time) return [...keys[0]!.position];
  for (let index = 1; index < keys.length; index++) {
    const previous = keys[index - 1]!, next = keys[index]!;
    if (time <= next.time) {
      const t = (time - previous.time) / (next.time - previous.time);
      return previous.position.map((value, axis) => value + (next.position[axis]! - value) * t) as
        [number, number, number];
    }
  }
  return [...keys.at(-1)!.position];
}

/**
 * The rider's on-screen pan and zoom during the intro, relative to its final
 * place: the subject stands where the last camera key looks (straight ahead),
 * so earlier keys see it `dx / depth` to the side (screen fraction per unit
 * focal length) and `depth / finalDepth` larger.
 */
export function camIntroPan(time: number): { x: number; y: number; scale: number } {
  const [finalX, finalY, finalZ] = CAM_INTRO.at(-1)!.position;
  const [x, y, z] = camIntroPosition(time);
  const depth = Math.abs(y), finalDepth = Math.abs(finalY);
  return { x: (finalX - x) / depth, y: (z - finalZ) / depth, scale: finalDepth / depth };
}
