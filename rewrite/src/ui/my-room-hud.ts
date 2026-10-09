import { CanvasHitController, type CanvasHitRegion } from "./canvas-hit-controller";
import { G1, T, V0, ct, f5, m9, p2, s2, st } from "../generated/formats.js";
import { U1 } from "../generated/library.js";

/**
 * The release MyRoomStage monocoque overlay: owner menu, rider list and chat box
 * from stage_myRoom.rho/mq_window@zz.bml, drawn with its own textures and strings.
 */

export interface MyRoomHudNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: MyRoomHudNode[];
}

interface Texture { image: CanvasImageSource; width: number; height: number }

interface ResourceFile { bytes(): Promise<Uint8Array> }

/** The release resource library's canonical lookup used by every stage window. */
export interface MyRoomHudLibrary {
  canonicalCandidates(path: string): ResourceFile[];
}

export interface MyRoomHudAssets {
  root: MyRoomHudNode;
  textures: Map<MyRoomHudNode, Texture[]>;
  strings: Map<string, string>;
  font: FontFace;
}

/** A rider on the release rider list (riderCard0..7). */
export interface MyRoomHudRider {
  accountId: string;
  nickname: string;
  /** riderCard index: 0 the owner, 1..7 visitors. */
  slot: number;
  /** Level glove icon name (etc_/level/<glove>.png). */
  glove?: string;
}

/** Who is in the room shown, and as whom the player sees it. */
export interface MyRoomHudRoom {
  /** The player visits another rider's room (menuGroupVisiter). */
  visitor: boolean;
  ownerName: string;
  riders: readonly MyRoomHudRider[];
}

export interface MyRoomHudOptions {
  room(): MyRoomHudRoom;
  /** Whether the player may chat here (roomAdmin "允许聊天" binds visitors). */
  chatAllowed(): boolean;
  onOpenInventory(): void;
  onOpenAdmin(): void;
  onCareer(): void;
  onEmblem(): void;
  /** 图鉴 (the owner) and 浏览图鉴 (a visitor): the 道具图鉴 window. */
  onDictionary(): void;
  /** 探险队 (the owner): the 赛车探险队 window. */
  onExpedition(): void;
  onFindRider(): void;
  onRandomVisit(): void;
  /** The owner removes a visitor (the rider card's kick button). */
  onKick(accountId: string): void;
  /**
   * Sends a chat line; true when the room echoes it back (it then arrives
   * through addChatLine), false to show it locally.
   */
  onChat(text: string): boolean;
  /** The level glove icon, once loaded. */
  gloveImage(glove: string): CanvasImageSource | undefined;
  /** Walking and wheel zoom belong to the 3D scene under the overlay. */
  sceneCanvas: HTMLCanvasElement;
}

const FOLDERS = ["stage_/myRoom", "stage_/common"];
const FONT_FAMILY = "KartSim My Room";
/** The stage is laid out at 1600x900; the bottom 7.333% is the shared taskbar. */
const STAGE = { x: 0, y: 0, width: 1600, height: 900 };
const VISIBLE_HEIGHT = 900 * (1 - 0.07333333);
/**
 * Menu buttons with a Web feature. The others (道具组合, 查看道具, 查看信息) are
 * drawn in their disabled state. 随机进入 is enabled here although the
 * release BML ships it disabled.
 */
const OWNER_BUTTONS = new Set(["garageOpen", "myCareerOpen", "myEmblemOpen", "roomAdminOpen",
  "findRiderOpen", "randomVisitOpen", "itemDictionary", "expeditionOpen"]);
const VISITOR_BUTTONS = new Set(["garageOpen", "careerOpen", "emblemOpen", "findRiderOpen",
  "randomVisitOpen", "itemDictionaryVisit"]);
const CHAT_BUTTONS = new Set(["hideChat", "openChat"]);
const SKIPPED = new Set(["ScreenUI", "newItem", "userListButton", "info", "chatHistoryBar"]);
const CHAT_LIMIT = 6;
const CHAT_KEPT = 50;
const RIDER_CARD = /^riderCard(\d)$/;

const attribute = (node: MyRoomHudNode, name: string): string | undefined =>
  T(node, name) as string | undefined;

/** `%s` / `%d` placeholders in the release string bag. */
export function formatMyRoomString(template: string, value: string | number): string {
  return template.replace(/%[sd]/, String(value));
}

/** Release `textColor` is a name or an "A R G B" byte list. */
export function myRoomHudColor(value: string | undefined, fallback = "white"): string {
  if (!value) return fallback;
  const channels = value.trim().split(/\s+/).map(Number);
  if (channels.length === 4 && channels.every(Number.isFinite)) {
    const [a, r, g, b] = channels as [number, number, number, number];
    return `rgba(${r},${g},${b},${a / 255})`;
  }
  return value;
}

/** Font size and outline from `textRender` such as bold16 or outline14. */
export function myRoomHudTextRender(value: string | undefined): { size: number; stroke: number } {
  const size = Number(/\d+/.exec(value ?? "")?.[0] ?? 14);
  return { size, stroke: value?.startsWith("outline") ? 1 : 0 };
}

export function readMyRoomStringBag(bag: MyRoomHudNode): Map<string, string> {
  const strings = new Map<string, string>();
  const visit = (node: MyRoomHudNode): void => {
    if (node.name === "k") {
      const key = attribute(node, "n");
      const cn = node.children.find(child => attribute(child, "c") === "cn");
      const value = cn && attribute(cn, "v");
      if (key && value !== undefined) strings.set(key, value);
      return;
    }
    node.children.forEach(visit);
  };
  visit(bag);
  return strings;
}

async function decode(file: ResourceFile): Promise<Texture> {
  const image = await p2(await file.bytes()) as
    { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法解码小屋界面资源");
  context.putImageData(new ImageData(new Uint8ClampedArray(image.pixels),
    image.width, image.height), 0, 0);
  return { image: canvas, width: image.width, height: image.height };
}

export async function loadMyRoomHudAssets(library: MyRoomHudLibrary): Promise<MyRoomHudAssets> {
  const find = (name: string, extension = ".png"): ResourceFile =>
    U1(library, FOLDERS, name, extension) as ResourceFile;
  const root = s2(await find("mq_window@zz", ".bml").bytes()) as MyRoomHudNode;
  const strings = readMyRoomStringBag(
    s2(await find("stage_stringBag", ".bml").bytes()) as MyRoomHudNode);
  const textures = new Map<MyRoomHudNode, Texture[]>();
  const cache = new Map<string, Promise<Texture>>();
  const texture = (name: string): Promise<Texture> => {
    let pending = cache.get(name);
    if (!pending) {
      pending = decode(find(name));
      cache.set(name, pending);
    }
    return pending;
  };
  const visit = async (node: MyRoomHudNode): Promise<void> => {
    if (SKIPPED.has(attribute(node, "name") ?? "") || node.name === "ToolTipWindow") return;
    const states = attribute(node, "autoLoadImage");
    const single = attribute(node, "texture");
    try {
      if (states) textures.set(node, await Promise.all([1, 2, 3, 4].map(index =>
        texture(`${states}${index}`))));
      else if (single) textures.set(node, [await texture(single)]);
    } catch (error) {
      // A missing button image leaves that button undrawn, not the whole menu.
      console.warn(`小屋界面缺少 ${states ?? single} 贴图`, error);
    }
    await Promise.all(node.children.map(visit));
  };
  const font = await f5(FONT_FAMILY,
    await (U1(library, ["gui_/font"], "SourceHanSansCN-Bold", ".otf") as ResourceFile).bytes());
  try {
    await visit(root);
  } catch (error) {
    G1(font);
    throw error;
  }
  return { root, textures, strings, font };
}

type Rect = { x: number; y: number; width: number; height: number };

/** Canvas overlay for the release My Room menus over the 3D room scene. */
export class MyRoomHud {
  readonly canvas = document.createElement("canvas");
  readonly element = document.createElement("div");
  readonly chatInput = document.createElement("input");
  private readonly context: CanvasRenderingContext2D;
  private readonly buttons: CanvasHitController<string>;
  private readonly observer?: ResizeObserver;
  private regions: Array<CanvasHitRegion<string>> = [];
  private hovered?: string;
  private pressed?: string;
  private chatOpen = true;
  private chatting = false;
  private readonly history: string[] = [];
  private disposed = false;
  /** The rider card being drawn (its rid, glove and kick button). */
  private card?: MyRoomHudRider;

  constructor(readonly root: HTMLElement, readonly assets: MyRoomHudAssets,
    readonly options: MyRoomHudOptions) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建小屋界面");
    this.context = context;
    Object.assign(this.element.style, { position: "absolute", inset: "0", zIndex: "3",
      pointerEvents: "none" });
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%",
      height: "100%", pointerEvents: "auto" });
    this.canvas.setAttribute("aria-label", "小屋菜单");
    this.chatInput.maxLength = 60;
    this.chatInput.setAttribute("aria-label", "小屋聊天");
    Object.assign(this.chatInput.style, { position: "absolute", border: "0", outline: "0",
      background: "transparent", color: "white", padding: "0", pointerEvents: "auto",
      font: `14px "${FONT_FAMILY}"` });
    this.chatInput.addEventListener("focus", () => { this.chatting = true; this.render(); });
    this.chatInput.addEventListener("blur", () => { this.chatting = false; this.render(); });
    this.chatInput.addEventListener("input", () => this.render());
    this.chatInput.addEventListener("keydown", this.onChatKey);
    this.element.append(this.canvas, this.chatInput);
    root.append(this.element);
    this.buttons = new CanvasHitController(this.canvas, this.element,
      () => ({ width: 1600, height: VISIBLE_HEIGHT }), (hovered, pressed) => {
        this.hovered = hovered;
        this.pressed = pressed;
        this.render();
      });
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.render());
      this.observer.observe(root);
    }
    this.render();
  }

  /** Enter opens the chat line, as the release help text says. */
  beginChat(): void {
    if (this.disposed || !this.options.chatAllowed()) return;
    if (!this.chatOpen) this.chatOpen = true;
    this.chatInput.focus();
  }

  get isChatting(): boolean { return this.chatting; }

  /** Forget the chat of the previous room. */
  clearChat(): void {
    this.history.length = 0;
    this.render();
  }

  /** A room chat line or notice (进入/离开小屋). */
  addChatLine(line: string): void {
    this.history.push(line);
    if (this.history.length > CHAT_KEPT) this.history.splice(0, this.history.length - CHAT_KEPT);
    this.render();
  }

  /** A release string of the stage bag with its placeholder filled. */
  string(key: string, value?: string | number): string | undefined {
    const template = this.assets.strings.get(key);
    return template === undefined ? undefined
      : value === undefined ? template : formatMyRoomString(template, value);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.buttons.dispose();
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.element.remove();
    G1(this.assets.font);
  }

  render(): void {
    if (this.disposed) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const scaleX = width / STAGE.width;
    const scaleY = height / VISIBLE_HEIGHT;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.setTransform(scaleX * ratio, 0, 0, scaleY * ratio, 0, 0);
    this.regions = [];
    this.chatInput.disabled = !this.options.chatAllowed();
    this.draw(this.assets.root, STAGE);
    // The hit controller maps pointers into the same 1600-wide stage units.
    this.buttons.update(this.regions);
  }

  private draw(node: MyRoomHudNode, parent: Rect): void {
    const name = attribute(node, "name") ?? "";
    if (SKIPPED.has(name) || node.name === "ToolTipWindow" || node.name === "RenderPanel") return;
    const cardSlot = RIDER_CARD.exec(name)?.[1];
    const outerCard = this.card;
    if (cardSlot !== undefined)
      this.card = this.options.room().riders.find(rider => rider.slot === Number(cardSlot));
    try {
      this.drawNode(node, name, parent);
    } finally {
      this.card = outerCard;
    }
  }

  private buttonEnabled(name: string): boolean {
    if (CHAT_BUTTONS.has(name)) return true;
    if (name === "kick") return !!this.card && this.card.slot > 0 && !this.options.room().visitor;
    return (this.options.room().visitor ? VISITOR_BUTTONS : OWNER_BUTTONS).has(name);
  }

  private drawNode(node: MyRoomHudNode, name: string, parent: Rect): void {
    if (!this.visible(node, name)) return;
    const textures = this.assets.textures.get(node);
    const rect = V0(node, parent, undefined, textures?.[0]) as Rect;

    if (node.name === "ImageButton" && textures) {
      const enabled = this.buttonEnabled(name);
      const key = name === "kick" ? `kick:${this.card?.slot}` : name;
      const state = enabled ? st(key, this.hovered, this.pressed) : 3;
      ct(this.context, textures[state]!, rect);
      if (enabled) {
        const rider = this.card;
        this.regions.push({ key, rect, label: this.buttonLabel(node, name),
          activate: () => this.activate(name, rider) });
      }
    } else if (name === "glove" && this.card?.glove) {
      const image = this.options.gloveImage(this.card.glove);
      if (image) this.context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    } else if (textures) {
      const uv = attribute(node, "uvRect")?.split(/\s+/).map(Number);
      const texture = textures[0]!;
      if (uv?.length === 4)
        this.context.drawImage(texture.image, uv[0]!, uv[1]!, uv[2]! - uv[0]!,
          uv[3]! - uv[1]!, rect.x, rect.y, rect.width, rect.height);
      else this.context.drawImage(texture.image, rect.x, rect.y, rect.width, rect.height);
    }

    if (name === "chatRgn") this.placeChatInput(rect);
    if (name === "chatHistoryRgn") this.drawHistory(rect);
    const text = this.text(node, name);
    if (text) this.drawLabel(node, text, rect);
    for (const child of node.children) this.draw(child, rect);
  }

  private visible(node: MyRoomHudNode, name: string): boolean {
    if (name === "menuGroupOwner") return !this.options.room().visitor;
    if (name === "menuGroupVisiter") return this.options.room().visitor;
    if (RIDER_CARD.test(name)) return !!this.card;
    if (name === "kick") return this.buttonEnabled(name);
    if (name === "chatHistory") return this.chatOpen;
    if (name === "openChat") return !this.chatOpen;
    if (name === "hideChat") return this.chatOpen;
    if (name === "focusLine") return this.chatting;
    if (name === "chatHelp1") return !this.chatting && !this.chatInput.value;
    if (name === "chatHelp2") return this.chatting && !this.chatInput.value;
    return attribute(node, "visible") !== "false";
  }

  private text(node: MyRoomHudNode, name: string): string | undefined {
    if (name === "rid") return this.card?.nickname;
    const raw = attribute(node, "text");
    if (!raw) return undefined;
    const key = /^#sb\(([^)]+)\)$/.exec(raw)?.[1];
    const value = key ? this.assets.strings.get(key) : raw;
    if (value === undefined) return undefined;
    const room = this.options.room();
    if (name === "riderList") return formatMyRoomString(value, room.ownerName);
    if (name === "riderCount") return formatMyRoomString(value, Math.max(1, room.riders.length));
    return value;
  }

  private drawLabel(node: MyRoomHudNode, text: string, rect: Rect): void {
    const alignment = attribute(node, "textAlign") ?? "";
    const render = myRoomHudTextRender(attribute(node, "textRender"));
    m9(this.context, text, rect, {
      family: FONT_FAMILY, size: render.size, kind: "label",
      color: myRoomHudColor(attribute(node, "textColor")),
      align: alignment.includes("right") ? "right"
        : alignment.includes("center") ? "center" : "left",
      verticalAlign: alignment.includes("vcenter") || alignment === "center"
        ? "center" : "top",
      stroke: render.stroke,
      strokeColor: myRoomHudColor(attribute(node, "textColor2"), "black"),
    });
  }

  private drawHistory(rect: Rect): void {
    const lineHeight = 22;
    const lines = this.history.slice(-CHAT_LIMIT);
    lines.forEach((line, index) => {
      m9(this.context, line, {
        x: rect.x + 8, y: rect.y + rect.height - (lines.length - index) * lineHeight - 4,
        width: rect.width - 16, height: lineHeight,
      }, { family: FONT_FAMILY, size: 14, kind: "label", color: "white",
        align: "left", verticalAlign: "center", stroke: 1, strokeColor: "black" });
    });
  }

  private placeChatInput(rect: Rect): void {
    const scaleX = this.root.clientWidth / STAGE.width;
    const scaleY = this.root.clientHeight / VISIBLE_HEIGHT;
    Object.assign(this.chatInput.style, {
      left: `${rect.x * scaleX}px`, top: `${rect.y * scaleY}px`,
      width: `${rect.width * scaleX}px`, height: `${rect.height * scaleY}px`,
      fontSize: `${14 * scaleY}px`,
    });
  }

  private buttonLabel(node: MyRoomHudNode, name: string): string {
    if (name === "hideChat") return "收起聊天";
    if (name === "openChat") return "展开聊天";
    if (name === "kick") return `请${this.card?.nickname ?? ""}离开小屋`;
    const label = node.children.find(child => child.name === "Label");
    return (label && this.text(label, "")) ?? name;
  }

  private activate(name: string, rider?: MyRoomHudRider): void {
    if (name === "garageOpen") this.options.onOpenInventory();
    else if (name === "roomAdminOpen") this.options.onOpenAdmin();
    else if (name === "myCareerOpen" || name === "careerOpen") this.options.onCareer();
    else if (name === "myEmblemOpen" || name === "emblemOpen") this.options.onEmblem();
    else if (name === "itemDictionary" || name === "itemDictionaryVisit") this.options.onDictionary();
    else if (name === "expeditionOpen") this.options.onExpedition();
    else if (name === "findRiderOpen") this.options.onFindRider();
    else if (name === "randomVisitOpen") this.options.onRandomVisit();
    else if (name === "kick" && rider) this.options.onKick(rider.accountId);
    else if (name === "hideChat" || name === "openChat") {
      this.chatOpen = name === "openChat";
      this.render();
    }
  }

  private readonly onChatKey = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      const message = this.chatInput.value.trim();
      if (message && !this.options.onChat(message)) {
        const self = this.options.room().riders.find(rider => rider.slot === 0)?.nickname ??
          this.options.room().ownerName;
        this.addChatLine(`${self} : ${message}`);
      }
      this.chatInput.value = "";
      this.options.sceneCanvas.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.chatInput.value = "";
      this.options.sceneCanvas.focus();
    }
  };

  /**
   * Clicks off the menus return keyboard walking to the 3D scene. The default
   * mousedown action would otherwise move focus to the page body afterwards.
   */
  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.buttons.hit(event as PointerEvent)) return;
    event.preventDefault();
    this.options.sceneCanvas.focus();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.options.sceneCanvas.dispatchEvent(new WheelEvent("wheel", event));
  };
}
