import { gameLocale, tr } from "../i18n/locale";
import { setLobbyHomeBackdrop, setLobbyShopBackdrop } from "./lobby-home-backdrop";
import { LobbyTopBar, type LobbyAccountInfo, type LobbyExperience,
  type LobbyWallet } from "./lobby-top-bar";
import type { LobbyTopBarArt } from "./lobby-top-bar-assets";
import { openLobbyLink, type LobbyBanner, type LobbyBoard, type LobbyPromos } from "./lobby-promos";
import { te } from "../generated/library.js";
import { node as bmlNode, nodeName, paintText, prepare, type Node, type NodeState, type Rect,
  type WindowView } from "./bml-kit";
import { gameWindowLibrary, popupLayer, showGameToast, trapPopupKeys } from "./game-popups";
import { coverCrop } from "./main-menu-view";
import type { MyRoomEnvironment } from "./my-room-catalog";
import {
  MyRoomSceneView, myRoomShowcasePose, type MyRoomSceneLibrary,
  type MyRoomSceneSubject,
} from "./my-room-scene";

/**
 * The lobby home: the rider and the equipped kart in the rider's own My Room
 * scene, a status bar across the top (lobby-top-bar.ts), the 快速进入 list on
 * the left and the promotion boards on the right. The release 单人游戏 page
 * stays a separate view. The shop opens over it (enterShop): the scene and
 * the status bar stay, the rest steps aside.
 */

export type { LobbyAccountInfo, LobbyExperience, LobbyWallet } from "./lobby-top-bar";
export type { LobbyBanner, LobbyBoard, LobbyPromos } from "./lobby-promos";

export interface LobbyImage { image: CanvasImageSource; width: number; height: number }

export type QuickEntryKind = "multiplayer" | "timeAttack" | "editor" | "unavailable";

export interface QuickEntry {
  id: string;
  title: string;
  kind: QuickEntryKind;
  channel?: string;
  gameplay?: string;
}

export const QUICK_ENTRIES: readonly QuickEntry[] = [
  // 卡丁城 (design/open-world/PLAN.md): the open-world city, entered from home.
  { id: "city", title: "卡丁城", kind: "multiplayer", channel: "speedIndiCombine", gameplay: "city" },
  { id: "speedIndi", title: "竞速个人赛", kind: "multiplayer", channel: "speedIndiCombine" },
  { id: "speedIndiInfinit", title: "无限加速个人赛", kind: "multiplayer",
    channel: "speedIndiInfinit" },
  { id: "timeAttack", title: "计时挑战赛", kind: "timeAttack" },
  // 地图工坊 (client/editor.html): build a track from the official tracks' pieces.
  { id: "mapEditor", title: "地图工坊", kind: "editor" },
  { id: "trackDuel", title: "赛道对决", kind: "unavailable" },
  { id: "speedTeam", title: "竞速组队赛", kind: "multiplayer", channel: "speedTeamCombine" },
  { id: "speedTeamInfinit", title: "无限加速组队赛", kind: "multiplayer",
    channel: "speedTeamInfinit" },
  { id: "itemIndi", title: "个人道具赛", kind: "multiplayer", channel: "itemIndiCombine",
    gameplay: "item" },
  { id: "itemTeam", title: "组队道具赛", kind: "multiplayer", channel: "itemTeamCombine",
    gameplay: "item" },
  { id: "grip", title: "抓地模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "grip" },
  { id: "shadow", title: "幽灵模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "shadow" },
  { id: "brave", title: "勇者组队竞速赛", kind: "multiplayer", channel: "speedTeamCombine",
    gameplay: "brave" },
  { id: "roadblock", title: "挡人模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "roadblock" },
  { id: "giant", title: "巨人模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "giant" },
  { id: "rp", title: "RP竞速", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "rp" },
];

/** One 活动 button: its id, label and the four release states (normal, over, pressed, disabled). */
export interface LobbyEvent {
  id: string;
  label: string;
  states: readonly LobbyImage[];
}

export const DEFAULT_QUICK_ENTRIES = ["city", "speedIndi", "speedIndiInfinit", "timeAttack", "mapEditor"];
export const MAX_QUICK_ENTRIES = 5;

const SETTINGS_ROOTS = ["stage_/common"];
const SETTINGS = { width: 480, top: 46, step: 32, columns: 2 };

/** 快速进入设置: the hint, then the modes in two columns of check rows. */
function quickSettingsDefinition(): Node {
  const rows = Math.ceil(QUICK_ENTRIES.length / SETTINGS.columns);
  const column = (SETTINGS.width - 70) / SETTINGS.columns;
  const children: Node[] = [bmlNode("Label", { name: "quickHint", leftTopWH: `24 12 ${SETTINGS.width - 90} 26` })];
  QUICK_ENTRIES.forEach((_entry, index) => {
    const x = 24 + Math.floor(index / rows) * column;
    const y = SETTINGS.top + (index % rows) * SETTINGS.step;
    children.push(
      bmlNode("PlaneCheckButton", { name: `quickCheck${index}`, leftTopWH: `${x} ${y + 7} 16 16` }),
      bmlNode("TextButton", { name: `quickPick${index}`, leftTopWH: `${x} ${y} ${column - 10} 30`, frame: "NoFrame" }),
    );
  });
  const bottom = SETTINGS.top + rows * SETTINGS.step + 10;
  children.push(
    bmlNode("Window", { leftTopWH: `0 0 ${SETTINGS.width - 60} 1`, frame: "HSection", align: "hcenter;bottom", adjust: "0 63" }),
    bmlNode("TextButton", { name: "okButton", leftTopWH: "0 0 132 42", align: "hcenter;bottom", adjust: "-70 6",
      textRender: "bold16" }),
    bmlNode("TextButton", { name: "cancelButton", leftTopWH: "0 0 132 42", align: "hcenter;bottom", adjust: "70 6",
      textRender: "bold16" }),
  );
  return bmlNode("Panel", { windowRect: "fullscreen" }, [
    bmlNode("CaptionWindow", { name: "quickDialog", windowRect: `0 0 ${SETTINGS.width} ${bottom + 118}`,
      frame: "CaptionDialog", caption: tr("快速进入设置"), captionPos: "0 1", align: "center", textRender: "bold" }, children),
  ]);
}
const QUICK_ENTRY_KEY = "kartsim.lobbyQuickEntries";

interface EntryStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

function browserStorage(): EntryStorage | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; }
  catch { return undefined; }
}

/** Saved 快速进入 choice; unknown or duplicate ids are dropped. */
export function loadQuickEntries(storage = browserStorage()): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(QUICK_ENTRY_KEY) ?? "null");
    if (Array.isArray(value)) {
      const ids = [...new Set(value.filter((id): id is string =>
        typeof id === "string" && QUICK_ENTRIES.some(entry => entry.id === id)))]
        .slice(0, MAX_QUICK_ENTRIES);
      if (ids.length) return ids;
    }
  } catch { /* Fall back to the default list. */ }
  return [...DEFAULT_QUICK_ENTRIES];
}

export function saveQuickEntries(ids: readonly string[], storage = browserStorage()): void {
  try { storage?.setItem(QUICK_ENTRY_KEY, JSON.stringify(ids)); }
  catch { /* Storage may be disabled; the choice lasts for this page. */ }
}

export function quickEntry(id: string): QuickEntry | undefined {
  return QUICK_ENTRIES.find(entry => entry.id === id);
}

export interface LobbyHomeOptions {
  riderName: string;
  /** The account level; Lv.1 before one is known. */
  level?: number;
  wallet?: Partial<LobbyWallet>;
  experience?: LobbyExperience;
  /** Clicking the rider glove, level or name (the account panel). */
  onAccount?(): void;
  /** Shown after the wallet in the top bar (the 资源下载 button). */
  topBarExtra?: HTMLElement;
  /** Promotion carousel pictures until setPromos brings the admin-set ones. */
  banners: readonly LobbyBanner[];
  /** Shown until the 3D lobby has been drawn. */
  backdrop?: LobbyImage;
  /** Mode card art for the two small promotion boards. */
  boardArt?: readonly [string, string];
  fontFamily?: string;
  /** The 活动 buttons (main-menu-view LOBBY_EVENTS) under the promotion boards. */
  events?: ReadonlyArray<LobbyEvent>;
  onEvent?(id: string): void;
  onEntry(entry: QuickEntry): void;
  onHover?(): void;
  onActivate?(): void;
}

/** A promotion board's parts and what it shows (setPromos). */
interface PromoBoard {
  element: HTMLButtonElement;
  text: HTMLSpanElement;
  picture: HTMLCanvasElement;
  promo: LobbyBoard;
}

const BANNER_INTERVAL_MS = 5_000;
const NOTICE_MS = 2_600;
/** Freshly placed karts draw a few frames of motion effects; fade in after them. */
const REVEAL_DELAY_MS = 350;
const SNAPSHOT_DELAY_MS = 700;
let styleInstalled = false;

const STYLES = `
.ks-lobby{position:absolute;inset:0 0 7.333333%;z-index:2;overflow:hidden;container-type:size;
  user-select:none;color:#fff;font-family:var(--ks-lobby-font,"PingFang SC"),"PingFang SC","Microsoft YaHei",sans-serif;
  background:#0b1426}
.ks-lobby[hidden]{display:none}
:where(.ks-lobby button){font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
:where(.ks-lobby button):focus-visible{outline:.3cqh solid #ffe66b;outline-offset:.2cqh}
.ks-lobby-scene,.ks-lobby-scene>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ks-lobby-scene>canvas.ks-lobby-3d{opacity:0;transition:opacity .45s ease}
.ks-lobby-scene>canvas.ks-lobby-3d.ks-ready{opacity:1}
.ks-lobby-scene>[role=status]{display:none}
.ks-lobby-shade{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(4,14,36,.42),rgba(4,14,36,0) 30%),
  linear-gradient(180deg,rgba(4,14,36,.2),rgba(4,14,36,0) 14%)}
.ks-lobby-quick{position:absolute;left:2.2cqw;top:33cqh;width:26cqw;z-index:1}
.ks-lobby-quick-head{display:inline-flex;align-items:center;gap:.8cqh;padding:.55cqh .55cqh .55cqh 1.1cqh;
  border-radius:.4cqh;background:rgba(20,28,46,.82);font-size:1.75cqh}
.ks-lobby-gear{width:2.4cqh;height:2.4cqh;display:grid;place-items:center;border-radius:.3cqh}
.ks-lobby-gear:hover,.ks-lobby-gear[aria-expanded=true]{background:rgba(255,255,255,.18)}
.ks-lobby-gear svg{width:2cqh;height:2cqh}
.ks-lobby-entries{list-style:none;margin:2cqh 0 0;padding:0}
.ks-lobby-entry{position:relative;display:flex;align-items:center;gap:.6cqw;height:5.3cqh;
  width:100%;text-align:left;font-size:2.9cqh;letter-spacing:.02em;white-space:nowrap;
  text-shadow:0 0 .25cqh #142038,.12cqh .12cqh 0 #142038,-.12cqh -.12cqh 0 #142038,
  .12cqh -.12cqh 0 #142038,-.12cqh .12cqh 0 #142038,0 .3cqh .5cqh rgba(0,0,0,.45)}
.ks-lobby-entry::before{content:"";position:absolute;left:-2.2cqw;top:.2cqh;bottom:.2cqh;width:0;
  background:linear-gradient(90deg,rgba(40,150,255,.78),rgba(40,150,255,.35) 70%,rgba(40,150,255,0));
  transition:width .16s ease;z-index:-1}
.ks-lobby-entry .ks-lobby-arrow{opacity:0;color:#ffffff;font-size:2.6cqh;transform:translateX(-.6cqw);
  transition:opacity .16s ease,transform .16s ease}
.ks-lobby-entry{transition:font-size .16s ease}
.ks-lobby-entry.ks-active{font-size:3.35cqh}
.ks-lobby[data-locale=en] .ks-lobby-entry{font-size:2.4cqh}
.ks-lobby[data-locale=en] .ks-lobby-entry.ks-active{font-size:2.7cqh}
.ks-lobby-entry.ks-active::before{width:21cqw}
.ks-lobby-entry.ks-active .ks-lobby-arrow{opacity:1;transform:none}
.ks-lobby-entry[data-kind=unavailable]{color:rgba(255,255,255,.88)}
.ks-lobby-promo{position:absolute;right:1.4cqw;top:8.6cqh;width:35cqh;display:flex;flex-direction:column;gap:.9cqh}
.ks-lobby-carousel{position:relative;height:20.2cqh;border-radius:.5cqh;overflow:hidden;
  box-shadow:0 .4cqh 1.2cqh rgba(0,0,0,.35);background:#16305e}
.ks-lobby-carousel canvas{position:absolute;inset:0;width:100%;height:100%}
.ks-lobby-carousel.ks-link canvas{cursor:pointer}
.ks-lobby-carousel canvas:focus-visible{outline:.3cqh solid #ffe66b;outline-offset:-.3cqh}
.ks-lobby-dots{position:absolute;left:0;right:0;bottom:.9cqh;display:flex;justify-content:center;gap:.9cqh;z-index:2}
.ks-lobby-dot{width:1cqh;height:1cqh;border-radius:50%;background:rgba(255,255,255,.55);
  box-shadow:0 0 .3cqh rgba(0,0,0,.5)}
.ks-lobby-dot[aria-current=true]{background:#1f8fff;outline:.15cqh solid #fff}
.ks-lobby-board{position:relative;height:7.8cqh;border-radius:.4cqh;overflow:hidden;text-align:left;
  box-shadow:0 .3cqh .9cqh rgba(0,0,0,.3);border:.15cqh solid rgba(255,255,255,.55);
  font-family:"Arial Black","Helvetica Neue",Arial,sans-serif;font-weight:900;font-size:2.9cqh;
  letter-spacing:.02em;padding-left:1.4cqh;text-shadow:0 .2cqh .3cqh rgba(0,0,0,.35)}
.ks-lobby-board.ks-blue{background:linear-gradient(90deg,#1868e6,#1f94fb 55%,#56c8ff)}
.ks-lobby-board.ks-purple{background:linear-gradient(90deg,#7a35e8,#a45af2 55%,#e27bff)}
.ks-lobby-board canvas{position:absolute;right:0;top:0;height:100%}
.ks-lobby-board canvas.ks-lobby-board-picture{inset:0;width:100%}
.ks-lobby-board span{position:relative}
.ks-lobby-board.ks-picture span,.ks-lobby-board.ks-picture canvas:not(.ks-lobby-board-picture){display:none}
.ks-lobby-board:hover{filter:brightness(1.08)}
.ks-lobby-events{margin-top:.6cqh;border-radius:.5cqh;background:rgba(10,22,44,.72);box-shadow:0 .3cqh .9cqh rgba(0,0,0,.3);
  padding:0 0 1cqh}
.ks-lobby-events h2{margin:0;padding:.7cqh 1.4cqh;font-size:2cqh;font-weight:700;border-bottom:.15cqh solid rgba(255,255,255,.25);
  text-shadow:0 .15cqh .3cqh rgba(0,0,0,.5)}
.ks-lobby-event-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.8cqh;padding:1cqh 1cqh 0}
.ks-lobby-event{display:flex;flex-direction:column;align-items:center;gap:.3cqh;font-size:1.55cqh;
  text-shadow:0 .12cqh .2cqh #000,0 0 .3cqh #000}
.ks-lobby-event canvas{width:8.4cqh;height:8.2cqh;display:block}
.ks-lobby-shop :is(.ks-lobby-shade,.ks-lobby-quick,.ks-lobby-promo){display:none!important}
`;

function installStyles(): void {
  if (styleInstalled || typeof document === "undefined") return;
  styleInstalled = true;
  const style = document.createElement("style");
  style.dataset.kartsim = "lobby-home";
  style.textContent = STYLES;
  document.head.append(style);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(markup: string): SVGSVGElement {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = markup;
  const icon = wrapper.firstElementChild as SVGSVGElement;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

const ICONS = {
  gear: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>`,
};

/** Overlay and 3D lobby; `attachScene` adds the room once its assets are known. */
export class LobbyHomeView {
  readonly element = element("section", "ks-lobby");
  private readonly sceneRoot = element("div", "ks-lobby-scene");
  private readonly fallback = element("canvas");
  private readonly entryList = element("ul", "ks-lobby-entries");
  private readonly gear = element("button", "ks-lobby-gear");
  /** 快速进入设置, a game window while open. */
  private settings?: { close(restoreFocus?: boolean): void };
  private readonly carousel = element("canvas");
  private readonly dots = element("div", "ks-lobby-dots");
  private readonly observer?: ResizeObserver;
  /** The status bar across the top. */
  readonly topBar: LobbyTopBar;
  private scene?: MyRoomSceneView;
  /** The shop is open over the lobby (enterShop): the rider and kart step aside. */
  private shopVisits = 0;
  private sceneSubject?: MyRoomSceneSubject;
  private sceneLoaded = false;
  private entries: string[];
  private active = 0;
  private banners: readonly LobbyBanner[];
  private bannerInterval = BANNER_INTERVAL_MS;
  private banner = 0;
  private bannerTimer = 0;
  /** The blue and purple promotion boards. */
  private readonly boards: PromoBoard[] = [];
  private snapshotTimer = 0;
  private readyFrame = 0;
  private disposed = false;

  constructor(readonly root: HTMLElement, readonly options: LobbyHomeOptions) {
    installStyles();
    this.banners = options.banners;
    this.entries = loadQuickEntries();
    const node = this.element;
    node.dataset.uiLayer = "stage";
    node.dataset.locale = gameLocale();
    node.setAttribute("role", "region");
    node.setAttribute("aria-label", tr("大厅"));
    if (options.fontFamily) node.style.setProperty("--ks-lobby-font", `"${options.fontFamily}"`);
    this.fallback.setAttribute("aria-hidden", "true");
    this.sceneRoot.append(this.fallback);
    this.topBar = new LobbyTopBar({
      riderName: options.riderName,
      ...(options.level !== undefined ? { level: options.level } : {}),
      ...(options.wallet ? { wallet: options.wallet } : {}),
      ...(options.experience ? { experience: options.experience } : {}),
      ...(options.onAccount ? { onAccount: options.onAccount } : {}),
      onNotice: message => this.showNotice(message),
      onHover: () => this.options.onHover?.(),
      onActivate: () => this.options.onActivate?.(),
    });
    if (options.topBarExtra)
      (this.topBar.element.querySelector(".ks-lobby-wallet") ?? this.topBar.element).append(options.topBarExtra);
    node.append(this.sceneRoot, element("div", "ks-lobby-shade"), this.topBar.element,
      this.buildQuickEntries(), this.buildPromo());
    node.addEventListener("keydown", this.onKeyDown);
    root.append(node);
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.paint());
      this.observer.observe(node);
    }
    this.restartCarousel();
    this.paint();
  }

  get hidden(): boolean { return this.element.hidden === true; }

  set hidden(value: boolean) {
    this.element.hidden = value;
    if (value) this.closeSettings(false);
    else this.paint();
  }

  /** Show the room scene with the rider and kart; failures keep the still backdrop. */
  attachScene(library: MyRoomSceneLibrary, environment: MyRoomEnvironment,
    subject: MyRoomSceneSubject | undefined): void {
    if (this.disposed || this.scene) return;
    const scene = new MyRoomSceneView(this.sceneRoot, library,
      { showcase: myRoomShowcasePose() });
    scene.canvas.classList.add("ks-lobby-3d");
    this.scene = scene;
    if (this.shopVisits) this.setSubjectVisible(false);
    this.sceneSubject ??= subject;
    void scene.setEnvironment(environment).then(loaded => {
      if (!loaded || this.disposed || this.scene !== scene) return;
      this.sceneLoaded = true;
      if (this.sceneSubject) void scene.setSubject(this.sceneSubject);
      this.waitForScene(scene);
    });
  }

  /** The rider or kart changed under home (account onboarding, an expired rental). */
  updateSceneSubject(subject: MyRoomSceneSubject | undefined): void {
    if (this.disposed || !subject) return;
    this.sceneSubject = subject;
    if (this.scene && this.sceneLoaded) void this.scene.setSubject(subject);
  }

  /** Swap the drawn status bar icons for the release level glove, currency and "+" art. */
  setTopBarArt(art: LobbyTopBarArt): void {
    if (!this.disposed) this.topBar.setTopBarArt(art);
  }

  /** Update the rider name, level, glove, experience bar and wallet in place. */
  setAccount(account: LobbyAccountInfo): void {
    if (!this.disposed) this.topBar.setAccount(account);
  }

  /**
   * The shop opens over the lobby (ECONOMY.md 7.6): like the original mall,
   * the live 3D lobby and the status bar stay in view while the lobby's own
   * panels step aside, and so do its rider and kart (the shop's stage shows
   * them with its try-ons). Returns the restore; each call is undone once.
   */
  enterShop(): () => void {
    if (this.disposed) return () => {};
    this.shopVisits++;
    this.element.classList.add("ks-lobby-shop");
    this.closeSettings(false);
    this.setSubjectVisible(false);
    let restored = false;
    return () => {
      if (restored) return;
      restored = true;
      this.shopVisits = Math.max(0, this.shopVisits - 1);
      if (this.disposed || this.shopVisits) return;
      this.element.classList.remove("ks-lobby-shop");
      this.setSubjectVisible(true);
    };
  }

  /** Shows or hides the rider and kart in the scene. */
  private setSubjectVisible(visible: boolean): void {
    const scene = this.scene;
    if (!scene) return;
    scene.playerRoot.visible = visible;
    scene.parkedKartRoot.visible = visible;
  }

  /**
   * The scene's latest frame for the multiplayer page behind its panels, and
   * one without the rider and kart for the shop opened elsewhere (its stage
   * draws them).
   */
  captureBackdrop(): void {
    const scene = this.scene;
    if (!scene?.ready) return;
    const shown = scene.playerRoot.visible;
    const image = shown ? scene.snapshot() : undefined;
    if (image) setLobbyHomeBackdrop({ image, width: image.width, height: image.height });
    try {
      this.setSubjectVisible(false);
      // The shop shows it unblurred over the whole screen: keep it sharp.
      const empty = scene.snapshot(1920);
      if (empty) setLobbyShopBackdrop({ image: empty, width: empty.width, height: empty.height });
    } finally {
      this.setSubjectVisible(shown);
    }
  }

  /** A short notice in the game's look (ui/game-popups.ts). */
  showNotice(message: string): void {
    if (this.disposed) return;
    showGameToast(message, NOTICE_MS, { root: this.root });
  }

  showBanner(index: number): void {
    const count = this.banners.length;
    if (!count) return;
    this.banner = ((index % count) + count) % count;
    this.paintCarousel();
  }

  /**
   * 大厅宣传 (lobby-promos.ts): the admin-set carousel pictures (none keeps
   * the built-in ones) and promotion boards, with their links.
   */
  setPromos(promos: LobbyPromos): void {
    if (this.disposed) return;
    if (promos.banners.length) {
      this.banners = promos.banners;
      this.bannerInterval = promos.intervalMs;
      this.banner = 0;
      this.buildDots();
      this.restartCarousel();
    }
    promos.boards.forEach((promo, index) => {
      const board = this.boards[index];
      if (board) this.setBoard(board, promo);
    });
    this.paint();
  }

  dispose(): void {
    if (this.disposed) return;
    this.captureBackdrop();
    this.disposed = true;
    window.clearInterval(this.bannerTimer);
    window.clearTimeout(this.snapshotTimer);
    cancelAnimationFrame(this.readyFrame);
    this.observer?.disconnect();
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.scene?.dispose();
    this.scene = undefined;
    this.element.remove();
  }

  private waitForScene(scene: MyRoomSceneView): void {
    const check = (): void => {
      if (this.disposed || this.scene !== scene) return;
      if (!scene.ready) {
        this.readyFrame = requestAnimationFrame(check);
        return;
      }
      this.snapshotTimer = window.setTimeout(() => {
        if (this.disposed || this.scene !== scene) return;
        scene.canvas.classList.add("ks-ready");
        this.snapshotTimer = window.setTimeout(() => this.captureBackdrop(), SNAPSHOT_DELAY_MS);
      }, REVEAL_DELAY_MS);
    };
    this.readyFrame = requestAnimationFrame(check);
  }

  private buildQuickEntries(): HTMLElement {
    const nav = element("nav", "ks-lobby-quick");
    nav.setAttribute("aria-label", tr("快速进入"));
    const head = element("div", "ks-lobby-quick-head");
    head.append(element("span", undefined, tr("快速进入")));
    this.gear.type = "button";
    this.gear.setAttribute("aria-label", tr("快速进入设置"));
    this.gear.setAttribute("aria-expanded", "false");
    this.gear.append(svg(ICONS.gear));
    this.bindSound(this.gear);
    this.gear.addEventListener("click", () => {
      this.options.onActivate?.();
      if (!this.settings) this.openSettings(); else this.closeSettings();
    });
    head.append(this.gear);
    nav.append(head, this.entryList);
    this.entryList.addEventListener("mouseleave", () => this.setActive(0));
    this.renderEntries();
    return nav;
  }

  private renderEntries(): void {
    this.entryList.replaceChildren(...this.entries.flatMap((id, index) => {
      const entry = quickEntry(id);
      if (!entry) return [];
      const item = element("li");
      const button = element("button", "ks-lobby-entry");
      button.type = "button";
      button.dataset.kind = entry.kind;
      button.append(element("span", undefined, tr(entry.title)),
        element("span", "ks-lobby-arrow", "»"));
      button.addEventListener("mouseenter", () => {
        if (this.active !== index) this.options.onHover?.();
        this.setActive(index);
      });
      button.addEventListener("focus", () => this.setActive(index));
      button.addEventListener("click", () => this.activate(entry));
      item.append(button);
      return [item];
    }));
    this.setActive(Math.min(this.active, Math.max(0, this.entries.length - 1)));
  }

  private setActive(index: number): void {
    this.active = index;
    this.entryList.querySelectorAll(".ks-lobby-entry").forEach((button, position) =>
      button.classList.toggle("ks-active", position === index));
  }

  private activate(entry: QuickEntry): void {
    if (this.disposed) return;
    this.options.onActivate?.();
    this.closeSettings(false);
    if (entry.kind === "unavailable") {
      this.showNotice(tr("{title}暂未开放", { title: tr(entry.title) }));
      return;
    }
    this.captureBackdrop();
    this.options.onEntry(entry);
  }

  /**
   * 快速进入设置 in the game's look (CaptionDialog, a check box a mode in two
   * columns, 完成 / 恢复默认); Escape closes it unchanged.
   */
  private openSettings(): void {
    const library = gameWindowLibrary();
    if (!library || this.disposed) return;
    const chosen = new Set(this.entries);
    const layer = popupLayer(this.root);
    let view: WindowView | undefined;
    let closed = false;
    let releaseKeys: (() => void) | undefined;
    const close = (restoreFocus = true) => {
      if (closed) return;
      closed = true;
      releaseKeys?.();
      view?.dispose();
      layer.dispose();
      if (this.settings === handle) this.settings = undefined;
      this.gear.setAttribute("aria-expanded", "false");
      if (restoreFocus) this.gear.focus({ preventScroll: true });
    };
    const handle = { close };
    const toggle = (id: string) => {
      this.options.onActivate?.();
      if (chosen.has(id)) {
        if (chosen.size > 1) chosen.delete(id);
      } else if (chosen.size < MAX_QUICK_ENTRIES) chosen.add(id);
      view?.render();
    };
    const state = (entry: Node): NodeState => {
      const name = nodeName(entry);
      const item = /^quick(Check|Pick)(\d+)$/.exec(name);
      if (item) {
        const quick = QUICK_ENTRIES[Number(item[2])]!;
        const checked = chosen.has(quick.id);
        const disabled = !checked && chosen.size >= MAX_QUICK_ENTRIES;
        const title = quick.kind === "unavailable" ? tr("{title}（暂未开放）", { title: tr(quick.title) }) : tr(quick.title);
        if (item[1] === "Check") return { checked, disabled, label: title, ...disabled ? {} : { action: () => toggle(quick.id) } };
        return { text: "", label: title, checked, disabled, ...disabled ? {} : { action: () => toggle(quick.id) },
          paint: (context: CanvasRenderingContext2D, rect: Rect) => paintText(title, { size: 15, bold: true, middle: true,
            color: disabled ? "rgb(150,156,168)" : checked ? "rgb(30,110,210)" : "rgb(42,55,80)" })
            .paint(context, { ...rect, x: rect.x + 24, width: rect.width - 24 }) };
      }
      switch (name) {
        case "quickDialog": return { text: tr("快速进入设置") };
        case "quickHint": return paintText(tr("选择显示在大厅左侧的模式（最多 {count} 个）", { count: MAX_QUICK_ENTRIES }), { size: 14, bold: true,
          color: "rgb(42,55,80)", middle: true });
        case "okButton": return { text: tr("完成"), label: tr("完成"), action: () => {
          this.options.onActivate?.();
          // Keep the catalogue order so the list reads the same each time.
          this.entries = QUICK_ENTRIES.map(quick => quick.id).filter(id => chosen.has(id));
          saveQuickEntries(this.entries);
          this.renderEntries();
          close();
        } };
        case "cancelButton": return { text: tr("恢复默认"), label: tr("恢复默认"), action: () => {
          this.options.onActivate?.();
          chosen.clear();
          DEFAULT_QUICK_ENTRIES.forEach(id => chosen.add(id));
          view?.render();
        } };
      }
      return {};
    };
    this.settings = handle;
    this.gear.setAttribute("aria-expanded", "true");
    void (te.load({ library, root: layer.element, definition: prepare(library, quickSettingsDefinition(), SETTINGS_ROOTS),
      roots: SETTINGS_ROOTS, smoothImages: true, modal: true, label: tr("快速进入设置"), onCancel: () => close(), state } as never) as
      Promise<WindowView>).then(loaded => {
      if (closed) {
        loaded.dispose();
        return;
      }
      view = loaded;
      releaseKeys = trapPopupKeys(loaded.element, { cancel: () => close() });
      view.show();
      view.focus("okButton");
    }).catch(error => {
      console.warn("快速进入设置窗口打开失败", error);
      close(false);
    });
  }

  private closeSettings(restoreFocus = true): void {
    this.settings?.close(restoreFocus);
  }

  private buildPromo(): HTMLElement {
    const promo = element("aside", "ks-lobby-promo");
    promo.setAttribute("aria-label", tr("活动"));
    const carousel = element("div", "ks-lobby-carousel");
    carousel.append(this.carousel, this.dots);
    // A picture with a link opens it.
    this.carousel.addEventListener("click", () => this.openBanner());
    this.carousel.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.openBanner();
    });
    this.buildDots();
    promo.append(carousel, this.board("ks-blue", this.options.boardArt?.[0]),
      this.board("ks-purple", this.options.boardArt?.[1]));
    const events = this.options.events ?? [];
    if (events.length > 0) promo.append(this.buildEvents(events));
    return promo;
  }

  /** The release mq lobby 活动 panel (eventmenu_pop: title and a 3-column button grid). */
  private buildEvents(events: ReadonlyArray<LobbyEvent>): HTMLElement {
    const panel = element("section", "ks-lobby-events");
    panel.setAttribute("aria-label", tr("活动"));
    const grid = element("div", "ks-lobby-event-grid");
    for (const event of events) {
      const button = element("button", "ks-lobby-event");
      button.type = "button";
      button.dataset.event = event.id;
      button.setAttribute("aria-label", tr(event.label));
      const canvas = element("canvas");
      canvas.setAttribute("aria-hidden", "true");
      const draw = (state: number) => {
        const image = event.states[state] ?? event.states[0];
        if (!image) return;
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d")?.drawImage(image.image, 0, 0);
      };
      draw(0);
      button.addEventListener("mouseenter", () => { draw(1); this.options.onHover?.(); });
      button.addEventListener("mouseleave", () => draw(0));
      button.addEventListener("pointerdown", () => draw(2));
      button.addEventListener("pointerup", () => draw(1));
      button.addEventListener("click", () => {
        this.options.onActivate?.();
        this.options.onEvent?.(event.id);
      });
      button.append(canvas, element("span", undefined, tr(event.label)));
      grid.append(button);
    }
    panel.append(element("h2", undefined, tr("活动")), grid);
    return panel;
  }

  private buildDots(): void {
    this.dots.replaceChildren(...this.banners.map((_, index) => {
      const dot = element("button", "ks-lobby-dot");
      dot.type = "button";
      dot.setAttribute("aria-label", tr("宣传图 {index}", { index: index + 1 }));
      dot.addEventListener("click", () => {
        this.options.onActivate?.();
        this.showBanner(index);
        // Choosing a picture starts its full time over.
        this.restartCarousel();
      });
      return dot;
    }));
    this.dots.hidden = this.banners.length < 2;
  }

  private restartCarousel(): void {
    window.clearInterval(this.bannerTimer);
    this.bannerTimer = 0;
    if (this.banners.length > 1)
      this.bannerTimer = window.setInterval(() => this.showBanner(this.banner + 1), this.bannerInterval);
  }

  private openBanner(): void {
    const link = this.banners[this.banner]?.link;
    if (!link) return;
    this.options.onActivate?.();
    openLobbyLink(link);
  }

  private board(tone: string, art: string | undefined): HTMLElement {
    const board = element("button", `ks-lobby-board ${tone}`);
    board.type = "button";
    const text = element("span", undefined, gameLocale() === "zh-CN" ? "COMING SOON" : tr("即将推出"));
    const picture = element("canvas", "ks-lobby-board-picture");
    picture.setAttribute("aria-hidden", "true");
    picture.hidden = true;
    board.append(text, picture);
    const entry: PromoBoard = { element: board, text, picture, promo: {} };
    this.boards.push(entry);
    this.setBoard(entry, {});
    this.bindSound(board);
    board.addEventListener("click", () => {
      this.options.onActivate?.();
      if (!openLobbyLink(entry.promo.link)) this.showNotice(tr("敬请期待"));
    });
    if (art) {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        if (this.disposed) return;
        const canvas = boardArt(image);
        if (canvas) board.append(canvas);
      });
      image.src = art;
    }
    return board;
  }

  /** A board shows its picture, or the drawn board with its title (COMING SOON without one). */
  private setBoard(board: PromoBoard, promo: LobbyBoard): void {
    board.promo = promo;
    board.text.textContent = promo.title ? tr(promo.title) : gameLocale() === "zh-CN" ? "COMING SOON" : tr("即将推出");
    board.element.setAttribute("aria-label", tr(promo.title ?? (promo.link ? "宣传" : "即将推出")));
    if (promo.title) board.element.title = tr(promo.title);
    else board.element.removeAttribute("title");
    board.element.classList.toggle("ks-picture", !!promo.image);
    board.picture.hidden = !promo.image;
  }

  private bindSound(button: HTMLElement): void {
    button.addEventListener("mouseenter", () => this.options.onHover?.());
  }

  private paint(): void {
    if (this.disposed || this.element.hidden) return;
    this.paintFallback();
    this.paintCarousel();
    for (const board of this.boards) this.paintBoard(board);
  }

  private paintBoard(board: PromoBoard): void {
    const image = board.promo.image;
    const canvas = board.picture;
    const width = board.element.clientWidth;
    const height = board.element.clientHeight;
    if (!image || !width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingQuality = "high";
    const crop = coverCrop(image, canvas);
    context.drawImage(image.image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  }

  private paintFallback(): void {
    const backdrop = this.options.backdrop;
    const canvas = this.fallback;
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#0b1426";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!backdrop) return;
    const crop = coverCrop(backdrop, canvas);
    context.drawImage(backdrop.image, crop.x, crop.y, crop.width, crop.height,
      0, 0, canvas.width, canvas.height);
  }

  private paintCarousel(): void {
    const canvas = this.carousel;
    const banner = this.banners[this.banner];
    // A picture with a link is clickable (Enter too).
    const link = !!banner?.link;
    canvas.parentElement?.classList.toggle("ks-link", link);
    canvas.setAttribute("role", link ? "link" : "img");
    canvas.setAttribute("aria-label", tr(banner?.title ?? "活动宣传图"));
    if (link) canvas.tabIndex = 0;
    else canvas.removeAttribute("tabindex");
    if (banner?.title) canvas.title = tr(banner.title);
    else canvas.removeAttribute("title");
    this.dots.querySelectorAll("button").forEach((dot, index) =>
      dot.setAttribute("aria-current", String(index === this.banner)));
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#16305e";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (banner) {
      context.imageSmoothingQuality = "high";
      const crop = coverCrop(banner, canvas);
      context.drawImage(banner.image, crop.x, crop.y, crop.width, crop.height,
        0, 0, canvas.width, canvas.height);
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = [...this.entryList.querySelectorAll<HTMLButtonElement>(".ks-lobby-entry")];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]!.focus();
  };
}

/** The character half of a mode card, faded in from the left, for a promo board. */
function boardArt(image: HTMLImageElement): HTMLCanvasElement | undefined {
  const source = { x: image.naturalWidth * 0.02, y: 0, width: image.naturalWidth * 0.5,
    height: image.naturalHeight * 0.8 };
  const canvas = document.createElement("canvas");
  canvas.height = 160;
  canvas.width = Math.round(source.width * canvas.height / source.height);
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(image, source.x, source.y, source.width, source.height,
    0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "destination-in";
  const fade = context.createLinearGradient(0, 0, canvas.width, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.4, "rgba(0,0,0,1)");
  context.fillStyle = fade;
  context.fillRect(0, 0, canvas.width, canvas.height);
  canvas.setAttribute("aria-hidden", "true");
  return canvas;
}
