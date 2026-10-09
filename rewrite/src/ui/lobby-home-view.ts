import { setLobbyHomeBackdrop, setLobbyShopBackdrop } from "./lobby-home-backdrop";
import { LobbyTopBar, type LobbyAccountInfo, type LobbyChargeCurrency, type LobbyExperience,
  type LobbyWallet } from "./lobby-top-bar";
import type { LobbyTopBarArt } from "./lobby-top-bar-assets";
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

export type { LobbyAccountInfo, LobbyChargeCurrency, LobbyExperience, LobbyWallet } from "./lobby-top-bar";

export interface LobbyImage { image: CanvasImageSource; width: number; height: number }

export type QuickEntryKind = "multiplayer" | "timeAttack" | "unavailable";

export interface QuickEntry {
  id: string;
  title: string;
  kind: QuickEntryKind;
  channel?: string;
  gameplay?: string;
}

export const QUICK_ENTRIES: readonly QuickEntry[] = [
  { id: "speedIndi", title: "竞速个人赛", kind: "multiplayer", channel: "speedIndiCombine" },
  { id: "speedIndiInfinit", title: "无限加速个人赛", kind: "multiplayer",
    channel: "speedIndiInfinit" },
  { id: "timeAttack", title: "计时挑战赛", kind: "timeAttack" },
  { id: "trackDuel", title: "赛道对决", kind: "unavailable" },
  { id: "speedTeam", title: "竞速组队赛", kind: "multiplayer", channel: "speedTeamCombine" },
  { id: "speedTeamInfinit", title: "无限加速组队赛", kind: "multiplayer",
    channel: "speedTeamInfinit" },
  { id: "grip", title: "抓地模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "grip" },
  { id: "shadow", title: "幽灵模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "shadow" },
  { id: "roadblock", title: "挡人模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "roadblock" },
  { id: "giant", title: "巨人模式", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "giant" },
  { id: "rp", title: "RP竞速", kind: "multiplayer", channel: "speedIndiCombine",
    gameplay: "rp" },
];

export const DEFAULT_QUICK_ENTRIES = ["speedIndi", "speedIndiInfinit", "timeAttack", "trackDuel"];
export const MAX_QUICK_ENTRIES = 5;
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
  /** The "+" beside 点券 and K币; without it they say the shop is closed. */
  onCharge?(currency: LobbyChargeCurrency): void;
  /** Clicking the rider glove, level or name (the account panel). */
  onAccount?(): void;
  /** Promotion carousel pictures. */
  banners: readonly LobbyImage[];
  /** Shown until the 3D lobby has been drawn. */
  backdrop?: LobbyImage;
  /** Mode card art for the two small promotion boards. */
  boardArt?: readonly [string, string];
  fontFamily?: string;
  onEntry(entry: QuickEntry): void;
  onHover?(): void;
  onActivate?(): void;
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
.ks-lobby-entry.ks-active::before{width:21cqw}
.ks-lobby-entry.ks-active .ks-lobby-arrow{opacity:1;transform:none}
.ks-lobby-entry[data-kind=unavailable]{color:rgba(255,255,255,.88)}
.ks-lobby-promo{position:absolute;right:1.4cqw;top:8.6cqh;width:35cqh;display:flex;flex-direction:column;gap:.9cqh}
.ks-lobby-carousel{position:relative;height:20.2cqh;border-radius:.5cqh;overflow:hidden;
  box-shadow:0 .4cqh 1.2cqh rgba(0,0,0,.35);background:#16305e}
.ks-lobby-carousel canvas{position:absolute;inset:0;width:100%;height:100%}
.ks-lobby-dots{position:absolute;left:0;right:0;bottom:.9cqh;display:flex;justify-content:center;gap:.9cqh}
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
.ks-lobby-board span{position:relative}
.ks-lobby-board:hover{filter:brightness(1.08)}
.ks-lobby-notice{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);padding:1.6cqh 3cqh;
  border-radius:.8cqh;background:rgba(8,20,40,.9);border:.15cqh solid rgba(255,255,255,.35);
  font-size:2.3cqh;white-space:nowrap;pointer-events:none}
.ks-lobby-notice[hidden]{display:none}
.ks-lobby-settings{position:absolute;left:2.2cqw;top:calc(33cqh + 4.4cqh);width:31cqh;padding:1.4cqh;z-index:2;
  border-radius:.6cqh;background:rgba(14,28,56,.96);border:.15cqh solid rgba(120,170,240,.6);
  box-shadow:0 .6cqh 1.8cqh rgba(0,0,0,.45);font-size:1.8cqh}
.ks-lobby-settings[hidden]{display:none}
.ks-lobby-settings h2{margin:0 0 .4cqh;font-size:2cqh}
.ks-lobby-settings p{margin:0 0 1cqh;font-size:1.45cqh;color:#a9bddf;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
.ks-lobby-settings label{display:flex;align-items:center;gap:1cqh;padding:.45cqh .3cqh;border-radius:.3cqh;cursor:pointer}
.ks-lobby-settings label:hover{background:rgba(255,255,255,.08)}
.ks-lobby-settings input{width:1.9cqh;height:1.9cqh;margin:0;accent-color:#2a9df4}
.ks-lobby-settings label[data-disabled]{color:rgba(255,255,255,.4);cursor:default}
.ks-lobby-settings-actions{display:flex;justify-content:flex-end;gap:1cqh;margin-top:1.2cqh}
.ks-lobby-settings-actions button{padding:.6cqh 1.4cqh;border-radius:.35cqh;
  background:rgba(255,255,255,.12);font-size:1.7cqh}
.ks-lobby-settings-actions button:last-child{background:#1f8fff}
.ks-lobby-shop :is(.ks-lobby-shade,.ks-lobby-quick,.ks-lobby-promo,.ks-lobby-notice,.ks-lobby-settings){display:none!important}
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
  private readonly settings = element("div", "ks-lobby-settings");
  private readonly carousel = element("canvas");
  private readonly dots = element("div", "ks-lobby-dots");
  private readonly notice = element("div", "ks-lobby-notice");
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
  private banner = 0;
  private bannerTimer = 0;
  private noticeTimer = 0;
  private snapshotTimer = 0;
  private readyFrame = 0;
  private disposed = false;

  constructor(readonly root: HTMLElement, readonly options: LobbyHomeOptions) {
    installStyles();
    this.entries = loadQuickEntries();
    const node = this.element;
    node.dataset.uiLayer = "stage";
    node.setAttribute("role", "region");
    node.setAttribute("aria-label", "大厅");
    if (options.fontFamily) node.style.setProperty("--ks-lobby-font", `"${options.fontFamily}"`);
    this.fallback.setAttribute("aria-hidden", "true");
    this.sceneRoot.append(this.fallback);
    this.topBar = new LobbyTopBar({
      riderName: options.riderName,
      ...(options.level !== undefined ? { level: options.level } : {}),
      ...(options.wallet ? { wallet: options.wallet } : {}),
      ...(options.experience ? { experience: options.experience } : {}),
      ...(options.onCharge ? { onCharge: options.onCharge } : {}),
      ...(options.onAccount ? { onAccount: options.onAccount } : {}),
      onNotice: message => this.showNotice(message),
      onHover: () => this.options.onHover?.(),
      onActivate: () => this.options.onActivate?.(),
    });
    node.append(this.sceneRoot, element("div", "ks-lobby-shade"), this.topBar.element,
      this.buildQuickEntries(), this.buildPromo(), this.notice, this.settings);
    this.notice.hidden = true;
    this.notice.setAttribute("role", "status");
    this.settings.hidden = true;
    this.settings.setAttribute("role", "dialog");
    this.settings.setAttribute("aria-label", "快速进入设置");
    node.addEventListener("keydown", this.onKeyDown);
    root.append(node);
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.paint());
      this.observer.observe(node);
    }
    if (options.banners.length > 1)
      this.bannerTimer = window.setInterval(() => this.showBanner(this.banner + 1),
        BANNER_INTERVAL_MS);
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
    this.notice.hidden = true;
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

  showNotice(message: string): void {
    if (this.disposed) return;
    this.notice.textContent = message;
    this.notice.hidden = false;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.notice.hidden = true; }, NOTICE_MS);
  }

  showBanner(index: number): void {
    const count = this.options.banners.length;
    if (!count) return;
    this.banner = ((index % count) + count) % count;
    this.paintCarousel();
  }

  dispose(): void {
    if (this.disposed) return;
    this.captureBackdrop();
    this.disposed = true;
    window.clearInterval(this.bannerTimer);
    window.clearTimeout(this.noticeTimer);
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
    nav.setAttribute("aria-label", "快速进入");
    const head = element("div", "ks-lobby-quick-head");
    head.append(element("span", undefined, "快速进入"));
    this.gear.type = "button";
    this.gear.setAttribute("aria-label", "快速进入设置");
    this.gear.setAttribute("aria-expanded", "false");
    this.gear.append(svg(ICONS.gear));
    this.bindSound(this.gear);
    this.gear.addEventListener("click", () => {
      this.options.onActivate?.();
      if (this.settings.hidden) this.openSettings(); else this.closeSettings();
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
      button.append(element("span", undefined, entry.title),
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
      this.showNotice(`${entry.title}暂未开放`);
      return;
    }
    this.captureBackdrop();
    this.options.onEntry(entry);
  }

  private openSettings(): void {
    const chosen = new Set(this.entries);
    const heading = element("h2", undefined, "快速进入设置");
    const hint = element("p", undefined, `选择显示在大厅左侧的模式（最多 ${MAX_QUICK_ENTRIES} 个）`);
    const list = element("div");
    const sync = (): void => {
      list.querySelectorAll("label").forEach(label => {
        const input = label.querySelector("input")!;
        const disabled = !input.checked && chosen.size >= MAX_QUICK_ENTRIES;
        input.disabled = disabled;
        label.toggleAttribute("data-disabled", disabled);
      });
    };
    for (const entry of QUICK_ENTRIES) {
      const label = element("label");
      const input = element("input");
      input.type = "checkbox";
      input.checked = chosen.has(entry.id);
      input.addEventListener("change", () => {
        if (input.checked) chosen.add(entry.id);
        else if (chosen.size > 1) chosen.delete(entry.id);
        else input.checked = true;
        sync();
      });
      label.append(input, element("span", undefined,
        entry.kind === "unavailable" ? `${entry.title}（暂未开放）` : entry.title));
      list.append(label);
    }
    const actions = element("div", "ks-lobby-settings-actions");
    const reset = element("button", undefined, "恢复默认");
    reset.type = "button";
    reset.addEventListener("click", () => {
      chosen.clear();
      DEFAULT_QUICK_ENTRIES.forEach(id => chosen.add(id));
      list.querySelectorAll("input").forEach((input, index) => {
        input.checked = chosen.has(QUICK_ENTRIES[index]!.id);
      });
      sync();
    });
    const done = element("button", undefined, "完成");
    done.type = "button";
    done.addEventListener("click", () => {
      // Keep the catalogue order so the list reads the same each time.
      this.entries = QUICK_ENTRIES.map(entry => entry.id).filter(id => chosen.has(id));
      saveQuickEntries(this.entries);
      this.renderEntries();
      this.closeSettings();
    });
    for (const button of [reset, done]) this.bindSound(button);
    actions.append(reset, done);
    this.settings.replaceChildren(heading, hint, list, actions);
    sync();
    this.settings.hidden = false;
    this.gear.setAttribute("aria-expanded", "true");
    list.querySelector("input")?.focus({ preventScroll: true });
  }

  private closeSettings(restoreFocus = true): void {
    if (this.settings.hidden) return;
    this.settings.hidden = true;
    this.gear.setAttribute("aria-expanded", "false");
    if (restoreFocus) this.gear.focus({ preventScroll: true });
  }

  private buildPromo(): HTMLElement {
    const promo = element("aside", "ks-lobby-promo");
    promo.setAttribute("aria-label", "活动");
    const carousel = element("div", "ks-lobby-carousel");
    this.carousel.setAttribute("role", "img");
    this.carousel.setAttribute("aria-label", "活动宣传图");
    carousel.append(this.carousel, this.dots);
    this.options.banners.forEach((_, index) => {
      const dot = element("button", "ks-lobby-dot");
      dot.type = "button";
      dot.setAttribute("aria-label", `宣传图 ${index + 1}`);
      dot.addEventListener("click", () => {
        this.options.onActivate?.();
        this.showBanner(index);
      });
      this.dots.append(dot);
    });
    if (this.options.banners.length < 2) this.dots.hidden = true;
    promo.append(carousel, this.board("ks-blue", this.options.boardArt?.[0]),
      this.board("ks-purple", this.options.boardArt?.[1]));
    return promo;
  }

  private board(tone: string, art: string | undefined): HTMLElement {
    const board = element("button", `ks-lobby-board ${tone}`);
    board.type = "button";
    board.setAttribute("aria-label", "即将推出");
    board.append(element("span", undefined, "COMING SOON"));
    this.bindSound(board);
    board.addEventListener("click", () => {
      this.options.onActivate?.();
      this.showNotice("敬请期待");
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

  private bindSound(button: HTMLElement): void {
    button.addEventListener("mouseenter", () => this.options.onHover?.());
  }

  private paint(): void {
    if (this.disposed || this.element.hidden) return;
    this.paintFallback();
    this.paintCarousel();
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
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    const banner = this.options.banners[this.banner];
    if (!context) return;
    context.fillStyle = "#16305e";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (banner) {
      context.imageSmoothingQuality = "high";
      const crop = coverCrop(banner, canvas);
      context.drawImage(banner.image, crop.x, crop.y, crop.width, crop.height,
        0, 0, canvas.width, canvas.height);
    }
    this.dots.querySelectorAll("button").forEach((dot, index) =>
      dot.setAttribute("aria-current", String(index === this.banner)));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && !this.settings.hidden) {
      event.preventDefault();
      event.stopPropagation();
      this.closeSettings();
      return;
    }
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
