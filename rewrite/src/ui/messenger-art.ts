/**
 * Release art and layouts of 好友聊天系统 (stage_messengerSystem): the
 * window and row templates as decoded BML, their images (autoLoadImage
 * _1.._4 states, textures, and the ones the release code switches in), the
 * gui_monocoque frames painted with the release frame painter (generated
 * C9) at the sizes the window uses, the CN strings and the CN bold face.
 * Missing images are skipped: an ImageButton without its 3rd or 4th state
 * shows its 1st, like the release does for the many 2- and 3-state buttons
 * of this window. Loaded once per resource library.
 */
import { C9, E9, Ft, T, V0, p2 } from "../generated/formats.js";
import { F9, U1 } from "../generated/library.js";
import { loadShopFont } from "../shop/shop-assets";

export interface MessengerResource { bytes(): Promise<Uint8Array> }
export interface MessengerLibrary { canonicalCandidates(path: string): readonly MessengerResource[] }

/** A decoded BML element (generated s2). */
export interface BmlNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: BmlNode[];
}

export interface Rect { x: number; y: number; width: number; height: number }

/** One frame state as generated Ft reads it. */
export interface BmlFrame {
  texture: string;
  caption: Rect; left: Rect; right: Rect; client: Rect; bottom: Rect;
  captionLeftMargin: number; captionRightMargin: number;
  bottomLeftMargin: number; bottomRightMargin: number;
  clientType: string;
}

export interface MessengerImage { url: string; width: number; height: number }

/** stage.bml addResFolder order of the messenger stage (stage_common last). */
export const MESSENGER_ROOTS = ["stage_/messengerSystem", "stage_/globalChatSystem", "stage_/common"] as const;
export const MESSENGER_FOLDER = "stage_/messengerSystem";

export interface MessengerLayouts {
  window: BmlNode;
  friend: BmlNode;
  receiveSend: BmlNode;
  setting: BmlNode;
  chatRoom: BmlNode;
  chatInvite: BmlNode;
}

export interface MessengerArt {
  layouts: MessengerLayouts;
  frames: ReadonlyMap<string, readonly BmlFrame[]>;
  /** stage_messengerSystem stringBag (cn), first definition of a key. */
  strings: ReadonlyMap<string, string>;
  /** The second definitions (blockFriend 屏蔽好友, deleteFriend): the confirm titles. */
  confirmStrings: ReadonlyMap<string, string>;
  images: ReadonlyMap<string, MessengerImage>;
  /** The face for bold text, or undefined (the CSS fallbacks apply). */
  font?: string;
  /** A frame state painted at a size, as a data URL (cached). */
  frameUrl(name: string, state: number, width: number, height: number): string | undefined;
}

export function attr(node: BmlNode | undefined, name: string): string | undefined {
  return node ? T(node, name) as string | undefined : undefined;
}

/** A copy of node with some attributes replaced (undefined removes one). */
export function withAttributes(node: BmlNode, changes: Record<string, string | undefined>,
  children = node.children): BmlNode {
  const attributes = node.attributes.filter(entry => !(entry.name in changes));
  for (const [name, value] of Object.entries(changes))
    if (value !== undefined) attributes.push({ name, value });
  return { ...node, attributes, children };
}

/** Depth-first nodes named `name` (names repeat: a TabMenu button and its TabPage share one). */
export function findAll(node: BmlNode, name: string, found: BmlNode[] = []): BmlNode[] {
  if (attr(node, "name") === name) found.push(node);
  for (const child of node.children) findAll(child, name, found);
  return found;
}

export function findNode(node: BmlNode, name: string, type?: string): BmlNode {
  const found = findAll(node, name).find(candidate => !type || candidate.name === type);
  if (!found) throw new Error(`好友聊天系统布局缺少 ${name}。`);
  return found;
}

/** autoLoadImage state names ("msg_list_" → msg_list_1..4; "eraser_0" → eraser_01..04). */
export function imageSeries(series: string, count = 4): string[] {
  return Array.from({ length: count }, (_unused, index) => series.replace(/(@zz)?$/, `${index + 1}$1`));
}

/** The image names a node draws. */
export function nodeImages(node: BmlNode): string[] {
  const series = attr(node, "autoLoadImage");
  if (series) return imageSeries(series);
  const checks = attr(node, "autoImage");
  if (checks) return imageSeries(checks, 5);
  const texture = attr(node, "texture") ?? attr(node, "image");
  return texture ? [texture] : [];
}

/** The rectangle of every node (hidden ones too), absolute on the 1600×900 stage. */
export class BmlLayout {
  private readonly rects = new Map<BmlNode, Rect>();

  constructor(readonly root: BmlNode, frames: ReadonlyMap<string, readonly BmlFrame[]>,
    sizes: (node: BmlNode) => { width: number; height: number } | undefined,
    origin: Rect = { x: 0, y: 0, width: 1600, height: 900 }) {
    const visit = (node: BmlNode, parent: Rect) => {
      const frameName = attr(node, "frame");
      const frame = frameName ? frames.get(frameName)?.[0] : undefined;
      const rect = V0(node, parent, frame, sizes(node)) as Rect;
      this.rects.set(node, rect);
      const inner = frame ? E9(frame, rect) as Rect : rect;
      for (const child of node.children) visit(child, inner);
    };
    visit(root, origin);
  }

  rect(node: BmlNode): Rect {
    const rect = this.rects.get(node);
    if (!rect) throw new Error(`好友聊天系统布局节点 ${node.name} 不在此布局中。`);
    return rect;
  }

  /** node's rectangle relative to ancestor's. */
  relative(node: BmlNode, ancestor: BmlNode): Rect {
    const rect = this.rect(node), base = this.rect(ancestor);
    return { ...rect, x: rect.x - base.x, y: rect.y - base.y };
  }
}

/** Images the release code sets at run time (not named by the layouts). */
const RUNTIME_IMAGES = [
  "msg_tab_message_bg",
  "msg_condition_online", "msg_condition_offline", "msg_condition_ingame", "msg_condition_away",
  "msg_icon_friend_0", "msg_icon_friend_1", "msg_icon_friend_2",
  "msg_list_new_1", "msg_list_new_2",
  "emoticonPopup_bg",
];

/** Frames painted outside the layouts' frame attributes (ScrollBar parts, the tooltip, the tray alert). */
const RUNTIME_FRAMES = ["MixVerticalScrollButton", "MixVerticalScrollArea", "DefaultTooltipNew", "AlertLabel"];

interface Decoded { canvas: HTMLCanvasElement; width: number; height: number }

function find(library: MessengerLibrary, roots: readonly string[], name: string,
  extension = ".png"): MessengerResource | undefined {
  try {
    return U1(library, [...roots], name, extension) as MessengerResource;
  } catch {
    return undefined;
  }
}

async function decode(entry: MessengerResource): Promise<Decoded> {
  const image = await p2(await entry.bytes()) as { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(
    new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return { canvas, width: image.width, height: image.height };
}

async function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  return blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png");
}

function readStringBag(bag: BmlNode): { strings: Map<string, string>; repeated: Map<string, string> } {
  const strings = new Map<string, string>();
  const repeated = new Map<string, string>();
  for (const entry of bag.children) {
    const key = attr(entry, "n");
    const local = entry.children.find(child => attr(child, "c") === "cn");
    if (!key || !local) continue;
    const value = attr(local, "v") ?? "";
    if (strings.has(key)) repeated.set(key, value);
    else strings.set(key, value);
  }
  return { strings, repeated };
}

function collect(nodes: readonly BmlNode[]): { images: Set<string>; frames: Set<string> } {
  const images = new Set<string>(RUNTIME_IMAGES);
  const frames = new Set<string>(RUNTIME_FRAMES);
  const visit = (node: BmlNode) => {
    for (const name of nodeImages(node)) images.add(name);
    const frame = attr(node, "frame");
    if (frame) frames.add(frame);
    for (const name of ["scrollButton", "scrollArea"]) {
      const value = attr(node, name);
      if (value) frames.add(value);
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return { images, frames };
}

const cache = new WeakMap<object, Promise<MessengerArt>>();

export function loadMessengerArt(library: MessengerLibrary): Promise<MessengerArt> {
  let pending = cache.get(library);
  if (!pending) {
    pending = load(library);
    cache.set(library, pending);
    pending.catch(() => cache.delete(library));
  }
  return pending;
}

async function load(library: MessengerLibrary): Promise<MessengerArt> {
  const bml = (name: string) => F9(library, MESSENGER_FOLDER, name) as Promise<BmlNode>;
  const [window, friend, receiveSend, setting, chatRoom, chatInvite, bag, frameTree, font] = await Promise.all([
    bml("messenger@zz"), bml("friendTemplate"), bml("receiveSendTemplate"), bml("settingTemplate"),
    bml("chatRoomTemplate"), bml("chatInviteTemplate"), bml("stringBag"),
    F9(library, "gui_/monocoque", "frame") as Promise<BmlNode>,
    loadShopFont(library),
  ]);
  const layouts = { window, friend, receiveSend, setting, chatRoom, chatInvite };
  const { strings, repeated } = readStringBag(bag);
  const frames = new Map<string, BmlFrame[]>();
  for (const entry of frameTree.children) {
    try {
      frames.set(entry.name, entry.children.map(state => Ft(state) as BmlFrame));
    } catch { /* A clientType the painter does not know: not used here. */ }
  }
  const wanted = collect(Object.values(layouts));
  const images = new Map<string, MessengerImage>();
  await Promise.all([...wanted.images].map(async name => {
    const entry = find(library, MESSENGER_ROOTS, name);
    if (!entry) return;
    try {
      const decoded = await decode(entry);
      images.set(name, { url: await canvasUrl(decoded.canvas), width: decoded.width, height: decoded.height });
    } catch { /* The plain look stays for this image. */ }
  }));
  const textures = new Map<string, HTMLCanvasElement>();
  await Promise.all([...new Set([...wanted.frames].flatMap(name =>
    (frames.get(name) ?? []).map(state => state.texture)))].map(async texture => {
    const entry = texture ? find(library, ["gui_/monocoque"], texture) : undefined;
    if (!entry) return;
    try { textures.set(texture, (await decode(entry)).canvas); } catch { /* Frame stays plain. */ }
  }));
  const painted = new Map<string, string | undefined>();
  const frameUrl = (name: string, state: number, width: number, height: number) => {
    const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
    const key = `${name}:${state}:${w}x${h}`;
    if (painted.has(key)) return painted.get(key);
    const states = frames.get(name);
    const frame = states?.[Math.min(state, states.length - 1)];
    const texture = frame && textures.get(frame.texture);
    let url: string | undefined;
    if (frame && texture) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      try {
        C9(canvas.getContext("2d")!, frame, texture, { x: 0, y: 0, width: w, height: h });
        url = canvas.toDataURL("image/png");
      } catch { url = undefined; }
    }
    painted.set(key, url);
    return url;
  };
  return { layouts, frames, strings, confirmStrings: repeated, images, font, frameUrl };
}

/** "%s" / "%d" / "%02d" in order, like the release's sprintf. */
export function formatString(template: string, ...values: Array<string | number>): string {
  let index = 0;
  return template.replace(/%(0?\d*)([sd])/g, (_whole, width: string, kind: string) => {
    const value = values[index++];
    if (value === undefined) return "";
    if (kind === "d") {
      const number = String(Math.trunc(Number(value)));
      return width ? number.padStart(Number(width), width.startsWith("0") ? "0" : " ") : number;
    }
    return String(value);
  });
}

export interface ColorRun { text: string; color?: string }

/** A ColorLabel's text: [color:A R G B]…[/color] runs ("|" breaks lines). */
export function colorRuns(text: string): ColorRun[] {
  const runs: ColorRun[] = [];
  const pattern = /\[color:(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\]([\s\S]*?)\[\/color\]/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) runs.push({ text: text.slice(last, match.index) });
    const [, a, r, g, b, inner] = match;
    runs.push({ text: inner!, color: `rgba(${r}, ${g}, ${b}, ${Math.round(Number(a) / 255 * 1000) / 1000})` });
    last = match.index! + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.map(run => ({ ...run, text: run.text.replaceAll("|", "\n") }));
}

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff", black: "#000000", yellow: "#ffff00", skyblue: "#87ceeb", gray: "#808080",
  red: "#ff0000", green: "#00ff00", blue: "#0000ff",
};

/** A BML colour ("a r g b" or a name) as CSS. */
export function bmlColor(value: string | undefined, fallback = "#ffffff"): string {
  if (!value) return fallback;
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    const [a, r, g, b] = parts as [number, number, number, number];
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  }
  return NAMED_COLORS[value.trim().toLowerCase()] ?? value.trim();
}

export interface Emoticon { id: number; text: string; x: number; y: number }
export interface MessengerEmoticons {
  /** set_1.png (5 columns of 20×18 icons). */
  url: string;
  width: number;
  height: number;
  cell: { width: number; height: number };
  list: Emoticon[];
}

const emoticonCache = new WeakMap<object, Promise<MessengerEmoticons | undefined>>();

/** etc_/emoticon emoticon@cn.xml and its set_1 sheet ("/微笑/" … typed into chat). */
export function loadMessengerEmoticons(library: MessengerLibrary): Promise<MessengerEmoticons | undefined> {
  let pending = emoticonCache.get(library);
  if (!pending) {
    pending = (async () => {
      const definition = find(library, ["etc_/emoticon"], "emoticon@cn", ".xml");
      if (!definition) return undefined;
      const xml = new DOMParser().parseFromString(new TextDecoder().decode(await definition.bytes()),
        "application/xml");
      const set = xml.querySelector("set");
      const sheet = set && find(library, ["etc_/emoticon"], set.getAttribute("texture") ?? "set_1");
      if (!set || !sheet) return undefined;
      const [cellWidth, cellHeight] = (set.getAttribute("size") ?? "20 18").split(/\s+/).map(Number);
      const decoded = await decode(sheet);
      const list = [...set.querySelectorAll("emo")].flatMap(emo => {
        const [row, column] = (emo.getAttribute("posIdx") ?? "").split(/\s+/).map(Number);
        const text = emo.getAttribute("str") ?? "";
        if (!text || !Number.isInteger(row) || !Number.isInteger(column)) return [];
        return [{ id: Number(emo.getAttribute("id")), text, x: column! * cellWidth!, y: row! * cellHeight! }];
      });
      return { url: await canvasUrl(decoded.canvas), width: decoded.width, height: decoded.height,
        cell: { width: cellWidth!, height: cellHeight! }, list };
    })().catch(() => undefined);
    emoticonCache.set(library, pending);
  }
  return pending;
}

export type ChatRun = { text: string } | { emoticon: Emoticon };

/** Splits a chat line into text and emoticon runs. */
export function chatRuns(text: string, emoticons: readonly Emoticon[] | undefined): ChatRun[] {
  if (!emoticons?.length) return [{ text }];
  const byText = new Map(emoticons.map(emoticon => [emoticon.text, emoticon]));
  const runs: ChatRun[] = [];
  let plain = "";
  for (let index = 0; index < text.length;) {
    let matched: Emoticon | undefined;
    if (text[index] === "/") {
      const end = text.indexOf("/", index + 1);
      if (end > index) matched = byText.get(text.slice(index, end + 1));
    }
    if (matched) {
      if (plain) runs.push({ text: plain });
      plain = "";
      runs.push({ emoticon: matched });
      index += matched.text.length;
    } else {
      plain += text[index];
      index++;
    }
  }
  if (plain) runs.push({ text: plain });
  return runs;
}
