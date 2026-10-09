/**
 * The shop (server-go/ECONOMY.md 7.6 and 8), rebuilt after the original CN
 * mall screen stage_mqShop.rho (MqShopStage, stage_window@cn) as the PC
 * client draws it: every window at its native size on a screen 1080 pixels
 * high, anchored by its BML align/adjust against that screen (center windows
 * stay centred on any aspect), the whole screen scaled into the viewport by
 * its height (shop-original shopScreen). Elements wear their original art and
 * text (shop-original.ts, shop-widgets.ts).
 *
 *  - Behind: the lobby. Over the home lobby the shop is transparent outside
 *    its windows, so the live 3D lobby and its top bar stay in view
 *    (overLobby); elsewhere it shows the lobby's last frame and draws the
 *    lobby's top bar itself (topBar). The original has no close button: Esc
 *    closes, and the taskbar the host leaves free goes elsewhere.
 *  - Left: the player's rider and kart (MqShopStage) with try-ons (a card
 *    click), panned in like camIntroAni; 初始状态 puts the current equipment
 *    back. Top left: 充值 / 输入兑奖券 (not open yet) and, under them, the
 *    累计消费活动 window (tcCashWndPos, shop-spend-event.ts).
 *  - Right, shopItems: itemCatTab (推荐 卡丁车 角色 礼包 装备 使用) and the
 *    itemSubCatTab row of the original mall (catalog shopTabs), the itemList
 *    grid of 230×194 shopCard{Cash,Lucci,Koin} cards, 3 per row and 3 rows,
 *    scrolled one line at a time (linePaging) by the wheel or the itemListBar
 *    scrollbar, and 搜索.
 *  - A card shows the original card's single price (displayOfferId), its
 *    discount (struck price → price, N折 flag) and mark (新品, 人气, 限购).
 *    Hovering it shows 兑换 / 赠送 and the shopCardTip tooltip; 兑换 opens the
 *    dialog2_buyItem purchase dialog (shop-buy-dialog.ts).
 * Only the visible window of cards is rendered.
 */
import {
  currentAccountSession, type AccountSession, type Currency, type InventoryItem,
} from "../account/account-session";
import { fetchShopCatalog, isShopApiError, ShopPurchaser, shopErrorMessage } from "./shop-api";
import { imageVar, isShopArtLibrary, loadShopArt, loadShopFont } from "./shop-assets";
import { BuyDialogController, BuyDialogView, trapFocus, type BuyDialogState } from "./shop-buy-dialog";
import type { ShopCatalog, ShopItem, ShopOffer } from "./shop-catalog";
import { artGroup, kindIconMarkup } from "./shop-icons";
import {
  ALL_SUB_TAB, catalogTabId, clampSearch, CURRENCY_LABELS, defaultShopQuery, displayOffer,
  engineLabel, formatAmount, formatExpRequirement, formatOfferTerm, inventoryIndex, kindLabel,
  lineWindowOf, normalizeSearch, orderedOffers, ownedForGood, ownershipLabel, ownershipOf,
  queryShop, RECOMMEND_TAB, SEARCH_MAX_CHARS, ShopIndex, type OfferContext, type ShopEntry,
  type ShopOwnership, type ShopQuery, type ShopTabEntry,
} from "./shop-model";
import {
  attr, camIntroPan, find, findAll, screenRect, SHOP_CARD_TIP, SHOP_CARDS, SHOP_SCREEN_HEIGHT,
  SHOP_SCREEN_WIDTH, SHOP_STRINGS, ShopLayout, shopScreen, STAGE_WINDOW, withAttributes,
  type ShopNode, type ShopRect, type ShopScreen,
} from "./shop-original";
import { fetchSpendEvent, SpendEventPanel, type SpendEventReward } from "./shop-spend-event";
import { SHOP_STYLES } from "./shop-styles";
import { BmlTree, createNodeElement, editInput, element, place, setFrame, setText } from "./shop-widgets";

export type ShopTab = "recommand" | "kartBody" | "character" | "equip";

/** What a preview renderer is asked to draw. */
export interface ShopPreviewRequest {
  readonly category: number;
  readonly itemId: number;
  readonly kind: string;
  readonly internalId: string;
  readonly name: string;
  /**
   * card: the 180×115 card item window; detail: the 125×125 tooltip window;
   * dialog: 220×150; reward: a 累计消费活动 slot's 70×70 rewardStockItem.
   */
  readonly size: "card" | "detail" | "dialog" | "reward";
}

/**
 * The MqShopStage rider: the player's character and kart, drawn into the
 * host the shop gives it, with items tried on.
 */
export interface ShopStage {
  /** Shows the item on the rider or kart; false when it cannot be shown. */
  tryOn(item: ShopPreviewRequest): boolean;
  /** Puts the current equipment back in the item's slot. */
  takeOff(item: ShopPreviewRequest): void;
  /** Puts all current equipment back (初始状态). */
  reset(): void;
  /** Turns the rider by a horizontal drag of `pixels` screen pixels. */
  rotate?(pixels: number): void;
  /** Resolves when the rider is first drawn (the camera intro starts then). */
  readonly ready?: Promise<void>;
  dispose(): void;
}

/**
 * Optional item pictures, e.g. a garage card/model renderer. It draws into
 * host (sized by the shop) and may return a cleanup; it is called for the
 * visible cards only and aborted when the card leaves them. Without one,
 * cards show the item kind.
 */
export interface ShopPreviewRenderer {
  render(item: ShopPreviewRequest, host: HTMLElement, signal: AbortSignal):
    void | (() => void) | Promise<void | (() => void)>;
  /** The 3D rider on the left of the stage; the shop disposes it when it closes. */
  stage?(host: HTMLElement): ShopStage | undefined;
}

/** A still of the lobby world (the mq stages' 3D scene) shown behind the shop stage. */
export interface ShopBackdrop {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

/** What the shop offers the top bar it hosts. */
export interface ShopTopBarActions {
  /** A short notice in the shop (e.g. 商城充值暂未开放 for the "+" buttons). */
  notice(message: string): void;
}

/** A top bar the host drew into the shop; disposed with the shop. */
export interface ShopTopBar {
  dispose(): void;
}

export interface ShopOpenOptions {
  /** Full-screen mount point. */
  root: HTMLElement;
  /** Resource library for stage_mqShop / dialog2_buyItem art and 3D previews. */
  library: unknown;
  session: AccountSession;
  initialTab?: ShopTab;
  onPurchased?(item: InventoryItem): void;
  /** The player closed the shop (Esc) or the session ended; not called for close(). */
  onClose(): void;
  /** Item pictures for cards and dialogs (and the 3D rider); the kind icon is shown otherwise. */
  preview?: ShopPreviewRenderer;
  /**
   * Screen pixels (of SHOP_SCREEN_HEIGHT, 1080) at the bottom left
   * uncovered for the host's taskbar, like the original stage keeps its tray
   * under the shop. 0 covers the whole screen.
   */
  taskbarHeight?: number;
  /**
   * The host's lobby (its live 3D scene and its top bar) stays visible
   * behind the shop: the shop draws no backdrop and no top bar of its own.
   */
  overLobby?: boolean;
  /** The lobby world behind the stage when it is not overLobby; a plain sky otherwise. */
  backdrop?: ShopBackdrop;
  /**
   * Draws the lobby top bar into host (the lobby area of the shop's screen,
   * above its backdrop) when the lobby's own is not in view.
   */
  topBar?(host: HTMLElement, actions: ShopTopBarActions): ShopTopBar | undefined | void;
  /** Interface sounds. */
  onHover?(): void;
  onActivate?(): void;
}

const SEARCH_DEBOUNCE_MS = 150;
const SESSION_POLL_MS = 3_000;
const TOAST_MS = 2_600;
/** Wheel distance (CSS px) per scrolled line; a mouse notch is about 100. */
const WHEEL_LINE = 60;
const INTRO_MS = 2_000;
/** The lobby covers the screen above the taskbar (ui/lobby-home-view .ks-lobby, 7.333% tray). */
export const SHOP_LOBBY_HEIGHT = Math.round(SHOP_SCREEN_HEIGHT * (1 - 0.0733333) * 10) / 10;

/** stage_window@cn itemCatTab buttons and the shop tab each one shows. */
const CATEGORY_TABS: readonly { node: string; tab: string }[] = [
  { node: "recommand", tab: RECOMMEND_TAB }, { node: "kartBody", tab: "kartBody" },
  { node: "character", tab: "character" }, { node: "package", tab: "package" },
  { node: "equip", tab: "equip" }, { node: "useful", tab: "useful" },
];

/** Older catalogs' sub-tab ids shown with the original CN string (base/stage string bags). */
const SUB_TAB_STRINGS: Record<string, keyof typeof SHOP_STRINGS> = {
  [ALL_SUB_TAB]: "whole", itemKart: "itemKart", speedKart: "speedkart", character: "character",
  pet: "pet", flyingPet: "flyingPet", balloon: "balloon", headBand: "headBand", goggle: "goggle",
  color: "color", dye: "dye", aura: "aura", skidMark: "skidMark", plate: "plate", etc: "etc",
  new: "new", hot: "hotItem",
};

/** A card's eventTag sprite: two frames side by side, each width × height. */
interface CardMark { mark: string; image: string; width: number; height: number; label?: string }

/** 新品, 人气 and 限购 stand at the card's eventTag (8, 42). */
const MARK_IMAGES: Record<string, Omit<CardMark, "mark">> = {
  new: { image: "new@cn", width: 40, height: 30 },
  hot: { image: "hot@cn", width: 36, height: 34 },
  limited: { image: "eventbuycount@cn", width: 34, height: 34 },
};

/**
 * The discount flag: blue discount10 under 30% off, red discount30, purple
 * discount60 from 60% (the original's three flags), _long for labels such as
 * 5.6折. The original draws it 14 px left of and 3 px above the eventTag.
 */
export function discountMark(offer: Pick<ShopOffer, "price" | "originalPrice" | "discountPercent" |
  "discountLabel">): CardMark | undefined {
  if (!offer.originalPrice || offer.originalPrice <= offer.price) return undefined;
  const percent = offer.discountPercent ??
    Math.round((1 - offer.price / offer.originalPrice) * 100);
  const label = offer.discountLabel ??
    `${Math.round((100 - percent) / 10 * 10) / 10}${SHOP_STRINGS.discount}`;
  const tier = percent >= 60 ? 60 : percent >= 30 ? 30 : 10;
  const long = [...label].length > 2;
  return { mark: "discount", image: `discount${tier}${long ? "_long" : ""}@cn`,
    width: long ? 85 : 67, height: 32, label };
}

/** The one mark a card shows: discount, else 新品, 人气, 限购 (catalog marks). */
export function cardMark(item: Pick<ShopItem, "marks" | "offers">, shown: ShopOffer): CardMark | undefined {
  const marks = item.marks ?? [];
  if (marks.includes("discount")) {
    const offer = shown.originalPrice ? shown : item.offers.find(candidate => candidate.originalPrice);
    const discount = offer && discountMark(offer);
    if (discount) return discount;
  }
  for (const mark of ["new", "hot", "limited"]) {
    if (marks.includes(mark)) return { mark, ...MARK_IMAGES[mark]! };
  }
  return undefined;
}

/** Cards with the title bar's "i" (detailBtn): the 点券 kart cards, as the original mall shows them. */
export function cardHasDetail(item: Pick<ShopItem, "kind">, shown: Pick<ShopOffer, "currency">): boolean {
  return item.kind === "kart" && shown.currency === "coupon";
}

/**
 * Game keys of the page behind the shop (F5 ready/start, F6–F8 sound
 * toggles). The shop stops every key from reaching the page; these are also
 * kept from the browser (F5 would reload the game) as the page would have.
 */
const PAGE_FUNCTION_KEYS: ReadonlySet<string> = new Set(["F5", "F6", "F7", "F8"]);

function isPageFunctionKey(event: KeyboardEvent): boolean {
  return PAGE_FUNCTION_KEYS.has(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey;
}

// --- Original layout ------------------------------------------------------

/**
 * stage_window@cn as the shop builds it:
 *  - the search button shown at the right end of the sub-tab row (CN hides
 *    searchBtn; its adjust "419 2" falls on the sixth of eight 85 px
 *    sub-tabs; 672 = the TabBoxLarge client width 732 − the 60 px button);
 *  - without its own currency bar (curCash … curKoin): the lobby top bar,
 *    which the original keeps over the shop, shows the wallet.
 */
const STAGE_NODE: ShopNode = (() => {
  const currencyBar = (node: ShopNode) => node.name === "Container" && findAll(node, "curCash").length > 0;
  const map = (node: ShopNode): ShopNode => {
    const children = node.children.filter(child => !currencyBar(child)).map(map);
    return attr(node, "name") === "searchBtn"
      ? withAttributes(node, { adjust: "672 2", visible: undefined }, children)
      : { ...node, children };
  };
  return map(STAGE_WINDOW);
})();

const layouts = new Map<number, ShopLayout>();

/** stage_window laid out on a screen `width` wide and 1080 high. */
function stageLayout(width: number): ShopLayout {
  let layout = layouts.get(width);
  if (!layout) {
    layout = new ShopLayout(STAGE_NODE, screenRect({ width, height: SHOP_SCREEN_HEIGHT }));
    if (layouts.size > 8) layouts.clear();
    layouts.set(width, layout);
  }
  return layout;
}

const CARD_RECT: ShopRect = { x: 0, y: 0, width: 230, height: 194 };
const CARD_LAYOUTS: Readonly<Record<Currency, ShopLayout>> = {
  coupon: new ShopLayout(SHOP_CARDS.coupon, CARD_RECT),
  lucci: new ShopLayout(SHOP_CARDS.lucci, CARD_RECT),
  koin: new ShopLayout(SHOP_CARDS.koin, CARD_RECT),
};
const TIP_LAYOUT = new ShopLayout(SHOP_CARD_TIP, { x: 0, y: 0, width: 300, height: 300 });

/** itemList GridSelectorDivLoad: alignSize, maxLine, alignMargin and the selector's default clientMargin. */
export const SHOP_GRID = (() => {
  const list = find(STAGE_NODE, "itemList");
  const [gapX, gapY] = (attr(list, "alignMargin") ?? "2 2").split(/\s+/).map(Number);
  const [left, top] = (attr(list, "clientMargin") ?? "3 3 3 3").split(/\s+/).map(Number);
  return {
    columns: Number(attr(list, "alignSize") ?? 3), rows: Number(attr(list, "maxLine") ?? 3),
    gapX: gapX!, gapY: gapY!, left: left!, top: top!, card: CARD_RECT,
  };
})();

/** Where a card of the visible window stands inside itemList. */
export function shopGridCell(index: number): { x: number; y: number } {
  const column = index % SHOP_GRID.columns, row = Math.floor(index / SHOP_GRID.columns);
  return {
    x: SHOP_GRID.left + column * (SHOP_GRID.card.width + SHOP_GRID.gapX),
    y: SHOP_GRID.top + row * (SHOP_GRID.card.height + SHOP_GRID.gapY),
  };
}

/**
 * The 3D rider's viewport on the 1920×1080 reference screen: the lower left,
 * below the 累计消费活动 window, where the original's camera intro
 * (camIntroAni) ends with the rider and kart (about x 100–620, y 460–855).
 * Like the 3D scene it stays centred on other aspects (riderRect).
 */
export const SHOP_RIDER_RECT: ShopRect = { x: 25, y: 245, width: 740, height: 640 };

/** The rider's viewport on a screen. */
export function riderRect(screen: Pick<ShopScreen, "width">): ShopRect {
  return { ...SHOP_RIDER_RECT, x: SHOP_RIDER_RECT.x + Math.round((screen.width - SHOP_SCREEN_WIDTH) / 2) };
}

/** Rider pan per unit of camIntroPan: the viewport's focal length in screen pixels. */
const RIDER_FOCAL = SHOP_RIDER_RECT.width * 0.66;

// --- Helpers --------------------------------------------------------------

const indexes = new WeakMap<ShopCatalog, ShopIndex>();

function shopIndex(catalog: ShopCatalog): ShopIndex {
  let index = indexes.get(catalog);
  if (!index) indexes.set(catalog, index = new ShopIndex(catalog));
  return index;
}

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

function previewRequest(item: Pick<ShopItem, "category" | "itemId" | "kind" | "internalId" | "name">,
  size: ShopPreviewRequest["size"]): ShopPreviewRequest {
  return { category: item.category, itemId: item.itemId, kind: item.kind,
    internalId: item.internalId, name: item.name, size };
}

/** Draws the item art into host; returns a cleanup for a pending or drawn preview. */
function renderArt(host: HTMLElement, item: Pick<ShopItem, "category" | "itemId" | "kind" |
  "internalId" | "name" | "tab" | "kartType">, size: ShopPreviewRequest["size"],
  preview: ShopPreviewRenderer | undefined, withKind: boolean): () => void {
  host.dataset.group = artGroup(item);
  host.insertAdjacentHTML("beforeend", kindIconMarkup(item.kind));
  if (withKind) host.append(element("span", "ks-shop-art-kind", kindLabel(item)));
  return drawPreview(host, previewRequest(item, size), preview);
}

/** Asks the renderer for a picture in host; returns the cleanup. */
function drawPreview(host: HTMLElement, request: ShopPreviewRequest,
  preview: ShopPreviewRenderer | undefined): () => void {
  if (!preview) return () => {};
  const abort = new AbortController();
  let cleanup: (() => void) | undefined;
  void Promise.resolve()
    .then(() => abort.signal.aborted ? undefined : preview.render(request, host, abort.signal))
    .then(result => {
      if (typeof result === "function") cleanup = result;
      if (abort.signal.aborted) { cleanup?.(); cleanup = undefined; return; }
      if (host.querySelector(":scope > canvas, :scope > img, :scope > [data-shop-preview]"))
        host.dataset.preview = "ready";
    })
    .catch(() => { /* Keep the kind icon. */ });
  return () => {
    abort.abort();
    cleanup?.();
    cleanup = undefined;
  };
}

/** The slot a try-on occupies: the item's category (1 character, 3 kart, …). */
function tryOnSlot(item: Pick<ShopItem, "category">): number {
  return item.category;
}

/** "30天 120点券" lines for the tooltip and the dialog's term list. */
export function stockLine(offer: { days: number; count: number; price: number; currency: Currency },
  item?: Pick<ShopItem, "isAdditional">): string {
  return `${formatOfferTerm(offer, item)} ${formatAmount(offer.price)}${CURRENCY_LABELS[offer.currency]}`;
}

/** The card's price label: the plain number like the original (9900, 10000). */
function priceText(price: number): string {
  return String(Math.max(0, Math.floor(price)));
}

interface CardRecord {
  entry: ShopEntry;
  element: HTMLElement;
  face: HTMLButtonElement;
  buy: HTMLButtonElement;
  gift: HTMLButtonElement;
  detail: HTMLButtonElement;
  selected: HTMLElement;
  price: HTMLElement;
  cleanup: () => void;
}

/** The screen the shop starts on, from the root's size (window size before layout). */
function initialScreen(root: HTMLElement): ShopScreen {
  return shopScreen(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
}

class ShopView {
  readonly element = element("div", "ks-shop");
  private readonly stage = element("div", "ks-shop-stage");
  private readonly scene = element("div", "ks-shop-scene");
  private readonly rider = element("div", "ks-shop-rider");
  private readonly riderView = element("div", "ks-shop-rider-view");
  private readonly topBarHost = element("div", "ks-shop-topbar");
  private screen: ShopScreen;
  private layout: ShopLayout;
  private readonly tree: BmlTree;
  private readonly tip = new BmlTree(TIP_LAYOUT);
  private readonly tipFlow = element("div", "ks-shop-tip-flow");
  private readonly tipOwned = element("div", "ks-shop-tip-owned");
  private readonly tabButtons = new Map<string, HTMLButtonElement>();
  private readonly subTabRow: HTMLElement;
  private readonly subTabTemplates: ShopNode[];
  private readonly grid: HTMLElement;
  private readonly scroll: HTMLElement;
  private readonly thumb = element("div", "ks-shop-scroll-thumb ks-bml");
  private readonly searchButton: HTMLButtonElement;
  private readonly searchBox: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly searchHint: HTMLElement;
  private readonly spend: SpendEventPanel;
  private readonly status = element("div", "ks-shop-status");
  private readonly modalLayer = element("div", "ks-shop-modal-layer");
  private readonly toast = element("div", "ks-shop-toast ks-bml");
  private readonly toastText = element("span");
  private readonly cards = new Map<string, CardRecord>();
  private readonly tried = new Map<number, string>();
  private readonly unsubscribe: () => void;
  private readonly previousFocus: Element | null;
  private readonly wasCurrent: boolean;
  private topBar?: ShopTopBar;
  private resizeObserver?: ResizeObserver;
  private sessionTimer?: ReturnType<typeof setInterval>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private loadAbort?: AbortController;
  private spendAbort?: AbortController;
  private index?: ShopIndex;
  private query: ShopQuery;
  private line = 0;
  private results: readonly ShopEntry[] = [];
  private inventory = new Map<string, InventoryItem>();
  private activeKey?: string;
  private pinnedKey?: string;
  private tipKey?: string;
  private tipCleanup?: () => void;
  private stagePreview?: ShopStage;
  private dialog?: BuyDialogView;
  private dialogController?: BuyDialogController;
  private hadSummary: boolean;
  private afterDialog?: "logout" | "reload";
  private loadError?: string;
  private disposed = false;
  private wheelDistance = 0;
  private searchOpen = false;
  /** Enter is down (seen pressed, not yet released) while the shop is open. */
  private enterDown = false;

  constructor(private readonly options: ShopOpenOptions) {
    this.query = defaultShopQuery(catalogTabId(options.initialTab));
    this.previousFocus = document.activeElement;
    this.wasCurrent = currentAccountSession() === options.session;
    this.hadSummary = options.session.summary() !== undefined;
    this.screen = initialScreen(options.root);
    this.layout = stageLayout(this.screen.width);
    this.tree = new BmlTree(this.layout);
    this.subTabRow = this.tree.named("itemSubCatTab");
    this.subTabTemplates = find(STAGE_NODE, "itemSubCatTab").children;
    this.grid = this.tree.named("itemList");
    this.scroll = this.tree.named("itemListBar");
    this.searchButton = this.tree.named("searchBtn") as HTMLButtonElement;
    this.searchBox = this.tree.named("searchEdit");
    this.searchInput = editInput(this.searchBox);
    this.searchHint = this.tree.named("searchEditTooltip");
    this.spend = new SpendEventPanel((reward, host) => this.rewardPicture(reward, host));
    this.build();
    this.readInventory();
    options.root.append(this.element);
    this.fit();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(options.root);
    } else {
      window.addEventListener("resize", this.fit);
    }
    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("keyup", this.onKeyUp, true);
    this.unsubscribe = options.session.subscribe(this.onSession);
    this.sessionTimer = setInterval(() => { if (this.sessionEnded()) this.closeByUser(); }, SESSION_POLL_MS);
    if (!this.hadSummary) void options.session.refresh().catch(() => {});
    this.loadArt();
    this.mountTopBar();
    this.mountStage();
    void this.load();
    void this.loadSpendEvent();
    this.element.tabIndex = -1;
    this.element.focus({ preventScroll: true });
  }

  // --- Construction -------------------------------------------------------

  private build(): void {
    const { element: root, stage } = this;
    root.dataset.uiLayer = "dialog";
    // Keys typed in the shop stay in the shop (after its own handlers ran).
    root.addEventListener("keydown", event => {
      event.stopPropagation();
      if (isPageFunctionKey(event)) event.preventDefault();
    });
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "商城");
    const taskbar = Math.max(0, Math.min(SHOP_SCREEN_HEIGHT, Math.floor(this.options.taskbarHeight ?? 0)));
    root.style.setProperty("--ks-shop-taskbar", `${taskbar}px`);
    const style = element("style");
    style.textContent = SHOP_STYLES;
    root.append(style, stage);

    this.buildScene();
    this.topBarHost.setAttribute("role", "presentation");
    this.topBarHost.style.height = `${SHOP_LOBBY_HEIGHT}px`;
    const desktop = this.tree.element;
    desktop.classList.add("ks-shop-desktop");
    stage.append(this.scene, this.topBarHost, desktop);
    this.buildButtons();
    this.buildTabs();
    this.buildGrid();
    this.buildSearch();
    this.buildTooltip();
    desktop.append(this.spend.element);

    this.status.setAttribute("role", "status");
    this.status.hidden = true;

    setFrame(this.toast, "BlackEdit", 0);
    this.toast.append(this.toastText);
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    stage.append(this.status, this.tip.element, this.toast, this.modalLayer);
    this.placeScreen();
  }

  private buildScene(): void {
    const { backdrop, overLobby } = this.options;
    this.scene.dataset.backdrop = overLobby ? "lobby" : "sky";
    if (!overLobby && backdrop && backdrop.width > 0 && backdrop.height > 0) {
      try {
        // The lobby's last frame, where the lobby drew it (above the tray), unblurred.
        const canvas = element("canvas", "ks-shop-backdrop");
        canvas.width = Math.max(1, Math.round(backdrop.width));
        canvas.height = Math.max(1, Math.round(backdrop.height));
        canvas.getContext("2d")?.drawImage(backdrop.image, 0, 0, canvas.width, canvas.height);
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.height = `${SHOP_LOBBY_HEIGHT}px`;
        this.scene.append(canvas);
        this.scene.dataset.backdrop = "still";
      } catch { /* The plain sky stays. */ }
    }
    this.rider.append(this.riderView);
    this.rider.setAttribute("aria-hidden", "true");
    this.scene.append(this.rider);
    let dragX: number | undefined;
    this.rider.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      dragX = event.clientX;
      this.rider.setPointerCapture?.(event.pointerId);
    });
    this.rider.addEventListener("pointermove", event => {
      if (dragX === undefined || !this.stagePreview?.rotate) return;
      this.stagePreview.rotate((event.clientX - dragX) / this.screen.scale);
      dragX = event.clientX;
    });
    const end = () => { dragX = undefined; };
    this.rider.addEventListener("pointerup", end);
    this.rider.addEventListener("pointercancel", end);
  }

  /** The lobby top bar the host draws when the lobby's own is not in view. */
  private mountTopBar(): void {
    if (this.options.overLobby || !this.options.topBar) {
      this.topBarHost.hidden = true;
      return;
    }
    try {
      this.topBar = this.options.topBar(this.topBarHost, { notice: message => this.showToast(message) }) ??
        undefined;
    } catch {
      this.topBar = undefined;
    }
    this.topBarHost.hidden = !this.topBarHost.firstElementChild;
  }

  private buildButtons(): void {
    const notice = (target: HTMLElement, message: string) => {
      target.addEventListener("click", () => {
        this.options.onActivate?.();
        this.showToast(message);
      });
    };
    // The big 充值 (and 输入兑奖券) buttons: not open yet.
    for (const target of this.tree.all("shopGCoinCharge")) {
      target.setAttribute("aria-label", SHOP_STRINGS.rechargeGCoin);
      target.title = SHOP_STRINGS.rechargeGCoin;
      notice(target, "商城充值暂未开放");
    }
    notice(this.tree.named("shopCoupon"), "兑奖券暂未开放");
    const gacha = this.tree.named("gachaOpenResult");
    gacha.setAttribute("aria-label", SHOP_STRINGS.gachaUseResult);
    gacha.title = SHOP_STRINGS.gachaUseResult;
    notice(gacha, `${SHOP_STRINGS.gachaUseResult}暂未开放`);
    const reset = this.tree.named("reset");
    reset.title = "试穿的道具恢复为当前装备";
    reset.addEventListener("click", () => {
      this.options.onActivate?.();
      this.resetTryOn();
    });
    for (const target of this.element.querySelectorAll<HTMLElement>("button.ks-bml"))
      target.addEventListener("pointerenter", () => { if (!(target as HTMLButtonElement).disabled) this.options.onHover?.(); });
  }

  private buildTabs(): void {
    const row = this.tree.named("itemCatTab");
    row.setAttribute("role", "tablist");
    row.setAttribute("aria-label", "商品分类");
    for (const { node, tab } of CATEGORY_TABS) {
      const button = this.tree.named(node) as HTMLButtonElement;
      button.classList.add("ks-shop-tab");
      button.setAttribute("role", "tab");
      button.dataset.tabId = `tab:${tab}`;
      button.addEventListener("click", () => this.selectTab(tab, button));
      button.addEventListener("keydown", event => this.moveAmongTabs(event, row));
      this.tabButtons.set(tab, button);
    }
    // The template sub-tab buttons are replaced by the current tab's.
    this.subTabRow.replaceChildren();
    this.subTabRow.setAttribute("role", "tablist");
    this.subTabRow.setAttribute("aria-label", "子分类");
  }

  private buildGrid(): void {
    const window = this.tree.named("shopItems");
    window.setAttribute("role", "region");
    window.setAttribute("aria-label", "商品列表");
    this.grid.classList.add("ks-shop-grid");
    this.grid.setAttribute("aria-label", "商品");
    window.addEventListener("wheel", event => {
      if (this.dialog || Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      this.wheelDistance += event.deltaMode === 1 ? event.deltaY * WHEEL_LINE
        : event.deltaMode === 2 ? event.deltaY * WHEEL_LINE * SHOP_GRID.rows : event.deltaY;
      let lines = Math.trunc(this.wheelDistance / WHEEL_LINE);
      if (!lines) return;
      this.wheelDistance -= lines * WHEEL_LINE;
      lines = Math.max(-SHOP_GRID.rows, Math.min(SHOP_GRID.rows, lines));
      if (!this.scrollLines(lines)) this.wheelDistance = 0;
    }, { passive: false });

    // itemListBar: the monocoque vertical scroll area and button.
    this.scroll.classList.add("ks-shop-scroll");
    setFrame(this.scroll, "DefaultVerticalScrollArea", 0);
    for (let state = 0; state < 4; state++) setFrame(this.thumb, "DefaultVerticalScrollButton", state, state);
    this.thumb.setAttribute("aria-hidden", "true");
    this.scroll.append(this.thumb);
    this.scroll.setAttribute("aria-hidden", "true");
    let drag: { y: number; line: number } | undefined;
    this.thumb.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.stopPropagation();
      drag = { y: event.clientY, line: this.line };
      this.thumb.dataset.pressed = "true";
      this.thumb.setPointerCapture?.(event.pointerId);
    });
    this.thumb.addEventListener("pointermove", event => {
      if (!drag) return;
      const { track, lineCount } = this.scrollGeometry();
      if (lineCount <= 1 || track <= 0) return;
      const line = Math.round(drag.line + ((event.clientY - drag.y) / this.screen.scale) / (track / (lineCount - 1)));
      this.scrollTo(line);
    });
    const end = () => { drag = undefined; delete this.thumb.dataset.pressed; };
    this.thumb.addEventListener("pointerup", end);
    this.thumb.addEventListener("pointercancel", end);
    this.scroll.addEventListener("pointerdown", event => {
      if (event.target !== this.scroll || event.button !== 0) return;
      // Track clicks page by the visible rows, like a scrollbar.
      const thumbTop = this.thumb.getBoundingClientRect?.().top ?? 0;
      this.scrollLines(event.clientY < thumbTop ? -SHOP_GRID.rows : SHOP_GRID.rows);
    });
  }

  /**
   * itemList's windowSize (766×800 at y 248 of the screen) runs past
   * itemListCont and the screen's bottom; the original clips a child to its
   * parent. The grid takes the pointer, so unclipped it covered the taskbar
   * strip the shop leaves free: 商店, 车库 and part of 小屋 could not be clicked.
   */
  private placeGrid(): void {
    const list = this.layout.rect(find(STAGE_NODE, "itemList"));
    const container = this.layout.rect(find(STAGE_NODE, "itemListCont"));
    place(this.grid, {
      ...list,
      width: Math.min(list.width, container.x + container.width - list.x),
      height: Math.min(list.height, container.y + container.height - list.y),
    }, container);
  }

  /** Places what the shop positions itself on the current screen. */
  private placeScreen(): void {
    this.placeGrid();
    place(this.rider, riderRect(this.screen));
    place(this.status, this.layout.rect(find(STAGE_NODE, "itemListCont")));
    this.spend.place(this.layout.rect(find(STAGE_NODE, "tcCashWndPos")));
    // The toast over the middle of the item window.
    const items = this.layout.rect(find(STAGE_NODE, "shopItems"));
    this.toast.style.left = `${Math.round(items.x + (items.width - 520) / 2)}px`;
    this.toast.style.top = `${Math.round(items.y + items.height / 2 - 26)}px`;
  }

  private buildSearch(): void {
    const button = this.searchButton;
    button.setAttribute("aria-label", "搜索道具");
    button.setAttribute("aria-expanded", "false");
    // The edit and its talk balloon hang below the button (searchBtn children).
    this.searchBox.hidden = true;
    this.searchHint.hidden = true;
    const input = this.searchInput;
    input.maxLength = SEARCH_MAX_CHARS;
    input.enterKeyHint = "search";
    input.setAttribute("aria-label", SHOP_STRINGS.searchTooltip);
    button.addEventListener("click", () => {
      this.options.onActivate?.();
      if (!this.searchOpen) { this.openSearch(); return; }
      if (input.value.trim()) this.applySearch();
      else this.closeSearch();
    });
    // Chinese names are typed through an IME: search once a composition ends.
    let composing = false;
    const onInput = () => {
      this.updateSearchHint();
      if (composing) return;
      const clamped = clampSearch(input.value);
      if (clamped !== input.value) input.value = clamped;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.applySearch(), SEARCH_DEBOUNCE_MS);
    };
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => { composing = false; onInput(); });
    input.addEventListener("input", onInput);
    input.addEventListener("focus", () => this.updateSearchHint());
    input.addEventListener("blur", () => { this.searchHint.hidden = true; });
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      this.applySearch();
    });
  }

  private buildTooltip(): void {
    const tip = this.tip.element;
    tip.classList.add("ks-shop-tooltip");
    tip.hidden = true;
    tip.setAttribute("role", "tooltip");
    // itemDesc, seperator and itemEffect are stacked under the picture at run
    // time (vertAutoSizing labels); keep the original order and width.
    const desc = this.tip.named("itemDesc");
    const rect = TIP_LAYOUT.rect(find(SHOP_CARD_TIP, "itemDesc"));
    place(this.tipFlow, { ...rect, height: 0 });
    this.tipFlow.style.height = "auto";
    this.tipFlow.style.width = `${rect.width}px`;
    this.tipOwned.className = "ks-shop-tip-owned ks-bml";
    for (const target of [desc, this.tip.named("seperator"), this.tip.named("itemEffect")])
      this.tipFlow.append(target);
    this.tipFlow.append(this.tipOwned);
    this.tip.named("stocks").classList.add("ks-shop-tip-stocks");
    tip.append(this.tipFlow);
  }

  /** The virtual screen follows the root: 1080 high, as wide as its aspect; anchors move with it. */
  private fit = (): void => {
    const screen = shopScreen(this.options.root.clientWidth || window.innerWidth,
      this.options.root.clientHeight || window.innerHeight);
    this.element.style.setProperty("--ks-shop-scale", String(screen.scale));
    this.element.style.setProperty("--ks-shop-w", `${screen.width}px`);
    const moved = screen.width !== this.screen.width;
    this.screen = screen;
    if (!moved) return;
    this.layout = stageLayout(screen.width);
    this.tree.relayout(this.layout);
    this.placeScreen();
    this.hideTooltip();
    this.dialog?.relayout(screen);
  };

  private loadArt(): void {
    const library = this.options.library;
    if (!isShopArtLibrary(library)) return;
    void loadShopArt(library).then(art => {
      if (this.disposed) return;
      for (const [name, value] of art.properties) this.element.style.setProperty(name, value);
      this.element.dataset.art = String(art.properties.size);
    }).catch(() => { /* Plain CSS stays. */ });
    // The 8 MB font arrives later; system CJK fonts stand in until then.
    void loadShopFont(library).then(family => {
      if (!this.disposed && family) this.element.dataset.font = family;
    }).catch(() => undefined);
  }

  /** The 3D rider (MqShopStage), panned in like camIntroAni. */
  private mountStage(): void {
    const preview = this.options.preview;
    if (!preview?.stage) return;
    try {
      this.stagePreview = preview.stage(this.riderView) ?? undefined;
    } catch {
      this.stagePreview = undefined;
    }
    const stage = this.stagePreview;
    if (!stage || typeof this.riderView.animate !== "function") return;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const frame = (time: number): Keyframe => {
      const pan = camIntroPan(time);
      return { transform: `translate(${(pan.x * RIDER_FOCAL).toFixed(1)}px, ${(pan.y * RIDER_FOCAL).toFixed(1)}px) scale(${pan.scale.toFixed(4)})`,
        offset: time / INTRO_MS };
    };
    // The models load after the shop opens: pan in once the rider is drawn.
    void Promise.resolve(stage.ready).then(() => {
      if (this.disposed || this.stagePreview !== stage) return;
      try {
        this.riderView.animate([frame(0), frame(INTRO_MS / 2), frame(INTRO_MS)],
          { duration: INTRO_MS, easing: "linear" });
      } catch { /* No intro. */ }
    }, () => undefined);
  }

  // --- Data ---------------------------------------------------------------

  private async load(): Promise<void> {
    this.loadAbort?.abort();
    const abort = new AbortController();
    this.loadAbort = abort;
    if (!this.index) this.showStatus("loading", "正在加载商城…");
    try {
      const catalog = await fetchShopCatalog(this.options.session, { signal: abort.signal });
      if (this.disposed || abort.signal.aborted) return;
      const reloaded = this.index !== undefined && this.index.catalog !== catalog;
      if (reloaded) {
        // Cards hold entries of the old catalog.
        for (const record of this.cards.values()) record.cleanup();
        this.cards.clear();
        this.hideTooltip();
        this.tried.clear();
        this.stagePreview?.reset();
      }
      this.loadError = undefined;
      this.index = shopIndex(catalog);
      this.validateTab();
      this.update();
      if (reloaded) this.showToast("商城目录已更新");
      // First load: move focus from the overlay to the selected tab.
      if (document.activeElement === this.element || !this.element.contains(document.activeElement))
        this.tabButtons.get(this.query.tab)?.focus({ preventScroll: true });
    } catch (error) {
      if (this.disposed || isAbort(error)) return;
      const code = isShopApiError(error) ? error.code : "NETWORK_ERROR";
      const message = isShopApiError(error) ? error.message : shopErrorMessage(code);
      this.loadError = message;
      if (code === "LOGIN_REQUIRED") {
        this.showStatus("error", shopErrorMessage(code), SHOP_STRINGS.close, () => this.closeByUser());
      } else if (!this.index) {
        this.showStatus("error", message, "重试", () => void this.load());
      } else {
        this.showToast(message);
      }
    }
  }

  /** The 累计消费活动 window: shown while the service reports an event on display. */
  private async loadSpendEvent(): Promise<void> {
    this.spendAbort?.abort();
    const abort = new AbortController();
    this.spendAbort = abort;
    const status = await fetchSpendEvent(this.options.session, abort.signal);
    if (this.disposed || abort.signal.aborted) return;
    try { this.spend.render(status); } catch { this.spend.render(undefined); }
  }

  /** A reward's picture: the item preview where the renderer has one (the kind icon stays otherwise). */
  private rewardPicture(reward: SpendEventReward, host: HTMLElement): () => void {
    return drawPreview(host, { category: reward.category, itemId: reward.itemId, kind: reward.iconHint,
      internalId: "", name: reward.name, size: "reward" }, this.options.preview);
  }

  private tabEntry(tab = this.query.tab): ShopTabEntry | undefined {
    return this.index?.tabs.find(entry => entry.id === tab);
  }

  private validateTab(): void {
    const index = this.index!;
    const tab = this.tabEntry() ?? index.tabs[0]!;
    this.query.tab = tab.id;
    // An empty 推荐 page would greet the player with nothing; open the first stocked tab.
    if (tab.id === RECOMMEND_TAB && !index.list(RECOMMEND_TAB).length)
      this.query.tab = index.tabs.find(entry => index.list(entry.id).length)?.id ?? tab.id;
    const current = this.tabEntry();
    if (!current?.subTabs.some(sub => sub.id === this.query.subTab))
      this.query.subTab = current?.defaultSubTab ?? ALL_SUB_TAB;
  }

  private readInventory(): void {
    try {
      this.inventory = inventoryIndex(this.options.session.inventory(), this.now());
    } catch {
      this.inventory = new Map();
    }
  }

  private ownership(item: ShopItem, now = this.now()): ShopOwnership {
    const session = this.options.session;
    return ownershipOf(item, this.inventory, now, (category, itemId) => {
      try { return session.owns(category, itemId, undefined, now); } catch { return false; }
    });
  }

  private offerContext(item: ShopItem): OfferContext {
    const summary = this.options.session.summary();
    return {
      ...(summary ? { wallet: summary.wallet, exp: summary.progress.exp } : {}),
      ownership: this.ownership(item),
    };
  }

  /** Logged out, expired or replaced; optional flags of the browser session are honoured. */
  private sessionEnded(): boolean {
    const session = this.options.session as AccountSession & { isClosed?: unknown; expired?: unknown };
    if (session.isClosed === true || session.expired === true) return true;
    if (this.wasCurrent && currentAccountSession() !== session) return true;
    return this.hadSummary && session.summary() === undefined;
  }

  /** The data service clock when the session offers one, for rental expiry. */
  private now(): number {
    const session = this.options.session as AccountSession & { serverNow?: () => number };
    try {
      const value = typeof session.serverNow === "function" ? session.serverNow() : Date.now();
      return Number.isFinite(value) ? value : Date.now();
    } catch {
      return Date.now();
    }
  }

  private onSession = (): void => {
    if (this.disposed) return;
    if (this.sessionEnded()) { this.closeByUser(); return; }
    if (this.options.session.summary()) this.hadSummary = true;
    this.readInventory();
    this.refreshCards();
    if (this.tipKey) this.renderTooltip(true);
    this.dialogController?.refresh();
  };

  // --- Queries and scrolling ------------------------------------------------

  private update(): void {
    if (!this.index) return;
    this.results = queryShop(this.index, this.query);
    this.renderTabs();
    this.renderWindow();
  }

  private selectTab(tab: string, button: HTMLElement): void {
    this.options.onActivate?.();
    const entry = this.tabEntry(tab);
    if (!entry || !this.index?.list(entry.id).length) {
      // 礼包 has nothing in this catalog.
      if (this.index) this.showToast(`${button.textContent ?? ""}暂未开放`);
      return;
    }
    const searching = normalizeSearch(this.query.search) !== "";
    if (tab === this.query.tab && !searching) return;
    this.clearSearch(false);
    this.query.tab = tab;
    this.query.subTab = entry.defaultSubTab;
    this.line = 0;
    this.update();
  }

  private selectSubTab(subTab: string): void {
    if (subTab !== ALL_SUB_TAB && this.index && !this.index.list(this.query.tab, subTab).length) return;
    this.options.onActivate?.();
    if (subTab === this.query.subTab && !normalizeSearch(this.query.search)) return;
    if (normalizeSearch(this.query.search)) this.clearSearch(false);
    this.query.subTab = subTab;
    this.line = 0;
    this.update();
  }

  private openSearch(): void {
    this.searchOpen = true;
    this.searchBox.hidden = false;
    this.searchButton.setAttribute("aria-expanded", "true");
    this.searchInput.focus({ preventScroll: true });
    this.updateSearchHint();
  }

  private closeSearch(): void {
    this.clearSearch(true);
    this.searchOpen = false;
    this.searchBox.hidden = true;
    this.searchHint.hidden = true;
    this.searchButton.setAttribute("aria-expanded", "false");
  }

  /** searchEditTooltip: the talk balloon while the focused edit is empty. */
  private updateSearchHint(): void {
    this.searchHint.hidden = !this.searchOpen || this.searchInput.value !== "" ||
      document.activeElement !== this.searchInput;
  }

  private applySearch(): void {
    clearTimeout(this.searchTimer);
    const search = clampSearch(this.searchInput.value);
    if (search === this.query.search) return;
    this.query.search = search;
    this.line = 0;
    this.update();
  }

  private clearSearch(update: boolean): void {
    clearTimeout(this.searchTimer);
    this.searchInput.value = "";
    this.updateSearchHint();
    if (!this.query.search) return;
    this.query.search = "";
    this.line = 0;
    if (update) this.update();
  }

  private scrollTo(line: number): boolean {
    const { lineCount } = lineWindowOf(this.results, this.line);
    const next = Math.min(lineCount - 1, Math.max(0, line));
    if (next === this.line) return false;
    this.line = next;
    this.renderWindow();
    return true;
  }

  private scrollLines(delta: number): boolean {
    const moved = this.scrollTo(this.line + delta);
    if (moved) this.options.onActivate?.();
    return moved;
  }

  private scrollGeometry(): { track: number; thumb: number; lineCount: number } {
    const height = this.layout.rect(find(STAGE_NODE, "itemListBar")).height;
    const { lineCount } = lineWindowOf(this.results, this.line);
    const lines = lineCount + SHOP_GRID.rows - 1;
    const thumb = Math.min(height, Math.max(25, Math.round(height * SHOP_GRID.rows / Math.max(lines, 1))));
    return { track: height - thumb, thumb, lineCount };
  }

  // --- Rendering ----------------------------------------------------------

  private renderTabs(): void {
    const index = this.index!;
    const searching = normalizeSearch(this.query.search) !== "";
    const focused = document.activeElement instanceof HTMLElement &&
      (this.tree.named("itemCatTab").contains(document.activeElement) || this.subTabRow.contains(document.activeElement))
      ? document.activeElement.dataset.tabId : undefined;
    for (const [tab, button] of this.tabButtons) {
      const entry = index.tabs.find(candidate => candidate.id === tab);
      const stocked = !!entry && index.list(tab).length > 0;
      const selected = !searching && tab === this.query.tab;
      button.setAttribute("aria-selected", String(selected));
      if (stocked) button.removeAttribute("aria-disabled");
      else button.setAttribute("aria-disabled", "true");
      button.tabIndex = selected || (searching && tab === RECOMMEND_TAB) ? 0 : -1;
    }
    this.renderSubTabs(searching ? undefined : this.tabEntry());
    if (focused) {
      const list = focused.startsWith("tab:") ? this.tree.named("itemCatTab") : this.subTabRow;
      (list.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(focused)}"]`) ??
        list.querySelector<HTMLElement>("[aria-selected=true]"))?.focus({ preventScroll: true });
    }
  }

  /**
   * itemSubCatTab: the original eight ComboSelectButton2 slots (85 px, 84 px
   * apart) when the tab's sub-tabs fit before the search button; more are
   * narrowed to their text so they still fit the row. Tabs without SubCats
   * (角色, 礼包) leave the row empty; empty SubCats are shown but disabled.
   */
  private renderSubTabs(tab: ShopTabEntry | undefined): void {
    const template = this.subTabTemplates[0]!;
    const rowNode = find(STAGE_NODE, "itemSubCatTab");
    const rowRect = this.layout.rect(rowNode);
    const slots = this.subTabTemplates.map(node => this.layout.relative(node, rowNode));
    const searchLeft = this.layout.rect(find(STAGE_NODE, "searchBtn")).x - rowRect.x - 4;
    const index = this.index;
    const mall = !!index?.mall;
    const entries: Array<{ id: string; name: string; selected: boolean; empty: boolean }> = tab
      ? tab.subTabs.map(sub => ({ id: sub.id,
        name: !mall && SUB_TAB_STRINGS[sub.id] ? SHOP_STRINGS[SUB_TAB_STRINGS[sub.id]!] : sub.name,
        selected: sub.id === this.query.subTab,
        empty: !!index && sub.id !== ALL_SUB_TAB && !index.list(tab.id, sub.id).length }))
      : [{ id: "search", name: `搜索结果 ${formatAmount(this.results.length)}`, selected: true, empty: false }];
    // Older catalogs: a tab without sub-tabs still shows 全部.
    if (tab && !tab.subTabs.length && !mall)
      entries.push({ id: ALL_SUB_TAB, name: SHOP_STRINGS.whole, selected: true, empty: false });
    if (!entries.length) {
      this.subTabRow.replaceChildren();
      return;
    }
    // bold16: CJK characters are 16 px wide, Latin digits and letters about 9.
    const textWidth = (text: string) => [...text].reduce((sum, character) =>
      sum + (character.charCodeAt(0) < 0x2e80 ? 9 : 16), 0);
    const fits = entries.length <= slots.length &&
      slots[entries.length - 1]!.x + slots[entries.length - 1]!.width <= searchLeft + 6 &&
      entries.every((entry, position) => textWidth(entry.name) + 4 <= slots[position]!.width);
    const widths = entries.map(entry => fits ? slots[0]!.width : textWidth(entry.name) + 14);
    const room = searchLeft - slots[0]!.x;
    const total = widths.reduce((sum, width) => sum + width - 1, 1);
    const shrink = !fits && total > room ? room / total : 1;
    let x = slots[0]!.x;
    this.subTabRow.replaceChildren(...entries.map((entry, position) => {
      const button = createNodeElement(template) as HTMLButtonElement;
      delete button.dataset.name;
      button.classList.add("ks-shop-subtab");
      setText(button, entry.name);
      const width = fits ? slots[position]!.width : Math.floor(widths[position]! * shrink);
      place(button, fits ? slots[position]! : { x, y: slots[0]!.y, width, height: slots[0]!.height });
      x += width - 1;
      button.setAttribute("role", "tab");
      button.dataset.tabId = `sub:${entry.id}`;
      button.setAttribute("aria-selected", String(entry.selected));
      if (entry.empty) button.setAttribute("aria-disabled", "true");
      button.tabIndex = entry.selected ? 0 : -1;
      button.title = entry.empty ? `${entry.name}（暂无道具）` : entry.name;
      if (entry.id === "search") button.addEventListener("click", () => this.closeSearch());
      else button.addEventListener("click", () => this.selectSubTab(entry.id));
      button.addEventListener("pointerenter", () => { if (!entry.empty) this.options.onHover?.(); });
      button.addEventListener("keydown", event => this.moveAmongTabs(event, this.subTabRow));
      return button;
    }));
  }

  /** Arrow keys move between tabs and activate them (WAI-ARIA tabs). */
  private moveAmongTabs(event: KeyboardEvent, list: HTMLElement): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = [...list.querySelectorAll<HTMLButtonElement>("[role=tab]")]
      .filter(tab => tab.getAttribute("aria-disabled") !== "true");
    const current = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = tabs[(current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]!;
    next.focus({ preventScroll: true });
    next.click();
  }

  private renderWindow(): void {
    const view = lineWindowOf(this.results, this.line, SHOP_GRID.columns, SHOP_GRID.rows);
    this.line = view.line;
    const visible = new Set(view.items.map(entry => entry.key));
    for (const [key, record] of this.cards) {
      if (!visible.has(key)) { record.cleanup(); this.cards.delete(key); }
    }
    if (this.tipKey && !visible.has(this.tipKey)) this.hideTooltip();
    const now = this.now();
    const focused = document.activeElement;
    const nodes = view.items.map((entry, position) => {
      const record = this.cards.get(entry.key) ?? this.createCard(entry);
      this.updateCard(record, now);
      const cell = shopGridCell(position);
      record.element.style.left = `${cell.x}px`;
      record.element.style.top = `${cell.y}px`;
      return record.element;
    });
    const children = this.grid.children;
    if (children.length !== nodes.length || nodes.some((node, position) => children[position] !== node)) {
      this.grid.replaceChildren(...nodes);
      if (focused instanceof HTMLElement && nodes.some(node => node.contains(focused)))
        focused.focus({ preventScroll: true });
    }
    this.renderScrollbar(view.lineCount);
    if (!view.total) {
      const searching = normalizeSearch(this.query.search) !== "";
      this.showStatus("empty", searching ? "没有找到符合条件的道具，请换个名称试试。" : "暂无道具。");
    } else {
      this.showStatus();
    }
  }

  /** itemListBar: always shown beside the grid, like the original's; the button fills it on one page. */
  private renderScrollbar(lineCount: number): void {
    this.scroll.hidden = false;
    const { track, thumb } = this.scrollGeometry();
    this.thumb.style.height = `${thumb}px`;
    this.thumb.style.top = `${lineCount <= 1 ? 0 : Math.round(track * this.line / (lineCount - 1))}px`;
    this.scroll.dataset.lines = String(lineCount);
  }

  private createCard(entry: ShopEntry): CardRecord {
    const item = entry.item;
    const shown = displayOffer(entry) ?? item.offers[0]!;
    const currency = shown.currency;
    const layout = CARD_LAYOUTS[currency];
    const tree = new BmlTree(layout);
    const card = tree.element;
    const face = tree.elements.get(layout.root) as HTMLButtonElement;
    card.classList.add("ks-shop-card");
    card.dataset.key = entry.key;
    card.dataset.currency = currency;
    card.setAttribute("role", "group");
    // The slot image (autoLoadImage slotYellow_ / slotBlue_ / slotGreen_) is the card's background.
    for (let state = 1; state <= 4; state++)
      card.style.setProperty(`--i${state}`, face.style.getPropertyValue(`--i${state}`));
    face.classList.remove("ks-ib");
    face.classList.add("ks-shop-card-face");
    setText(face, item.name);
    const named = (name: string) => tree.named(name);
    const art = element("span", "ks-shop-art");
    named("item").append(art);

    // eventTag: the card's one mark; a discount flag carries its N折 label (discountVal).
    const mark = cardMark(item, shown);
    const tag = named("eventTag");
    const label = named("discountVal");
    label.hidden = true;
    if (mark) {
      const sprite = element("span", "ks-shop-mark");
      sprite.dataset.mark = mark.mark;
      sprite.style.width = `${mark.width}px`;
      sprite.style.height = `${mark.height}px`;
      sprite.style.setProperty("--mark", `var(${imageVar(mark.image)})`);
      if (mark.mark === "discount") {
        // 14 px left of and 3 px above the eventTag, as the original draws the flag.
        sprite.style.left = "-14px";
        sprite.style.top = "-3px";
        label.hidden = false;
        label.classList.add("ks-shop-mark-label");
        setText(label, mark.label ?? "");
        label.style.left = "-14px";
        label.style.top = "1px";
        label.style.width = `${mark.width - 23}px`;
      }
      sprite.title = mark.label ?? { new: "新品", hot: "人气", limited: "限购" }[mark.mark] ?? "";
      tag.prepend(sprite);
    }

    // The price row: the shown offer's price, or the struck original price → the price.
    const price = named("price");
    (price.parentElement as HTMLElement).classList.add("ks-card-price-row");
    const discounted = !!shown.originalPrice && shown.originalPrice > shown.price;
    price.hidden = discounted;
    setText(price, priceText(shown.price));
    const before = named("preprice"), after = named("discprice"), arrow = named("discount");
    for (const target of [before, after, arrow]) target.hidden = !discounted;
    if (discounted) {
      setText(before, priceText(shown.originalPrice!));
      setText(after, priceText(shown.price));
      before.classList.add("ks-shop-preprice");
    }
    named("priceType").title = CURRENCY_LABELS[currency];

    const buy = named("buy") as HTMLButtonElement;
    const gift = named("giveGift") as HTMLButtonElement;
    const detail = named("detailBtn") as HTMLButtonElement;
    for (const action of [buy, gift]) {
      action.hidden = false;
      action.classList.add("ks-card-action");
    }
    // The title bar's "i" where the original shows it; it pins the tooltip.
    detail.hidden = !cardHasDetail(item, shown);
    detail.classList.add("ks-card-detail");
    detail.setAttribute("aria-label", "道具详情");
    detail.setAttribute("aria-pressed", "false");
    const selected = named("selected");
    selected.setAttribute("aria-hidden", "true");
    selected.title = SHOP_STRINGS.selected;
    const cleanup = renderArt(art, item, "card", this.options.preview, true);

    face.addEventListener("click", event => {
      // The rest of a double-click repeats nothing.
      if (event.detail > 1) return;
      this.options.onActivate?.();
      this.toggleTryOn(entry);
    });
    face.addEventListener("pointerdown", () => { card.dataset.pressed = "true"; });
    const release = () => { delete card.dataset.pressed; };
    face.addEventListener("pointerup", release);
    face.addEventListener("pointerleave", release);
    buy.addEventListener("click", event => {
      // The rest of a double-click belongs to the dialog the first click opened.
      if (event.detail > 1) return;
      this.options.onActivate?.();
      this.openBuy(entry);
    });
    gift.addEventListener("click", () => {
      this.options.onActivate?.();
      this.showToast("赠送暂未开放");
    });
    detail.addEventListener("click", () => {
      this.options.onActivate?.();
      this.pinnedKey = this.pinnedKey === entry.key ? undefined : entry.key;
      for (const record of this.cards.values())
        record.detail.setAttribute("aria-pressed", String(record.entry.key === this.pinnedKey));
      if (this.pinnedKey) this.setActive(entry.key);
      else this.setActive(this.activeKey === entry.key ? undefined : this.activeKey);
    });
    card.addEventListener("pointerenter", () => {
      if (this.activeKey !== entry.key) this.options.onHover?.();
      this.setActive(entry.key);
    });
    card.addEventListener("pointerleave", () => {
      // A card focused by the keyboard keeps its buttons and tooltip; one focused by a click does not.
      const focused = document.activeElement;
      const keyboard = card.contains(focused) && typeof (focused as HTMLElement).matches === "function" &&
        (focused as HTMLElement).matches(":focus-visible");
      if (this.activeKey === entry.key && !keyboard) this.setActive(undefined);
    });
    card.addEventListener("focusin", () => this.setActive(entry.key));
    card.addEventListener("focusout", event => {
      const next = (event as FocusEvent).relatedTarget;
      if (!(next instanceof Node && card.contains(next)) && this.activeKey === entry.key) this.setActive(undefined);
    });
    face.addEventListener("keydown", event => this.onCardKey(event, face));
    for (const target of [face, buy, gift, detail])
      target.addEventListener("pointerenter", () => { if (target !== face) this.options.onHover?.(); });
    const record: CardRecord = { entry, element: card, face, buy, gift, detail, selected, price, cleanup };
    this.cards.set(entry.key, record);
    return record;
  }

  private updateCard(record: CardRecord, now: number): void {
    const { entry, element: card } = record;
    const item = entry.item;
    const offer = displayOffer(entry) ?? item.offers[0]!;
    const ownership = this.ownership(item, now);
    const forever = ownedForGood(item, ownership);
    // Ownership stays off the card face (tooltip and dialog say it); 兑换 is off for good.
    card.dataset.owned = forever ? "forever" : ownership.owned ? "yes" : "no";
    const owned = ownershipLabel(item, ownership, now);
    record.buy.disabled = forever;
    record.buy.title = forever ? "已永久拥有" : "";
    const tried = this.tried.get(tryOnSlot(item)) === entry.key;
    card.dataset.selected = String(tried);
    record.selected.hidden = !tried;
    record.face.setAttribute("aria-pressed", String(tried));
    const terms = orderedOffers(item).map(choice => stockLine(choice, item));
    const was = offer.originalPrice && offer.originalPrice > offer.price
      ? `原价${formatAmount(offer.originalPrice)}，` : "";
    record.face.setAttribute("aria-label", [item.name, kindLabel(item),
      `${was}${formatAmount(offer.price)}${CURRENCY_LABELS[offer.currency]}/${formatOfferTerm(offer, item)}`,
      owned, tried ? "试穿中" : ""].filter(Boolean).join("，"));
    record.buy.setAttribute("aria-label", `${SHOP_STRINGS.trade} ${item.name}`);
    record.face.title = [item.name, ...terms].join("\n");
  }

  private refreshCards(): void {
    const now = this.now();
    for (const record of this.cards.values()) this.updateCard(record, now);
  }

  private setActive(key: string | undefined): void {
    const shown = this.pinnedKey ?? key;
    this.activeKey = key;
    for (const record of this.cards.values())
      record.element.dataset.active = String(record.entry.key === shown);
    if (!shown) { this.hideTooltip(); return; }
    if (shown !== this.tipKey) this.renderTooltip(false, shown);
  }

  // --- Tooltip (shopCardTip) -------------------------------------------------

  private renderTooltip(force: boolean, key = this.tipKey): void {
    const record = key ? this.cards.get(key) : undefined;
    if (!record) { this.hideTooltip(); return; }
    const item = record.entry.item;
    const tip = this.tip.element;
    if (force || key !== this.tipKey) {
      if (key !== this.tipKey) {
        this.tipCleanup?.();
        const window = this.tip.named("itemWindow");
        window.replaceChildren();
        const art = element("span", "ks-shop-art");
        window.append(art);
        this.tipCleanup = renderArt(art, item, "detail", this.options.preview, false);
      }
      this.tipKey = key;
      setText(tip, item.name);
      const now = this.now();
      const context = this.offerContext(item);
      const lines = orderedOffers(item).map(offer =>
        `${stockLine(offer, item)}${offer.minExp ? `（${formatExpRequirement(offer.minExp)}）` : ""}`);
      setText(this.tip.named("stocks"), lines.join("\n"));
      setText(this.tip.named("itemDesc"), item.desc ?? "");
      this.tip.named("itemDesc").hidden = !item.desc;
      setText(this.tip.named("itemEffect"), [kindLabel(item), engineLabel(item)].filter(Boolean).join(" · "));
      const owned = ownershipLabel(item, context.ownership, now);
      this.tipOwned.textContent = owned;
      this.tipOwned.hidden = !owned;
      tip.setAttribute("aria-label", `${item.name} ${SHOP_STRINGS.kItemPrice}`);
    }
    tip.hidden = false;
    this.positionTooltip(record);
  }

  /** Beside the card (to its left, or right when there is no room), inside the screen. */
  private positionTooltip(record: CardRecord): void {
    const tip = this.tip.element;
    const stocks = this.tip.named("stocks");
    const stocksRect = TIP_LAYOUT.rect(find(SHOP_CARD_TIP, "stocks"));
    const flowTop = Math.max(TIP_LAYOUT.rect(find(SHOP_CARD_TIP, "itemDesc")).y,
      stocksRect.y + (stocks.scrollHeight || stocksRect.height) + 8);
    this.tipFlow.style.top = `${flowTop}px`;
    const height = Math.max(flowTop + (this.tipFlow.offsetHeight || 0) + 12, 180);
    tip.style.height = `${height}px`;
    const grid = this.layout.rect(find(STAGE_NODE, "itemList"));
    const cardX = grid.x + (parseFloat(record.element.style.left) || 0);
    const cardY = grid.y + (parseFloat(record.element.style.top) || 0);
    const width = TIP_LAYOUT.rect(SHOP_CARD_TIP).width;
    let x = cardX - width - 6;
    if (x < 4) x = cardX + SHOP_GRID.card.width + 6;
    const bottom = SHOP_SCREEN_HEIGHT - (this.options.taskbarHeight ?? 0) - 4;
    const y = Math.max(50, Math.min(cardY, bottom - height));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  private hideTooltip(): void {
    this.tipCleanup?.();
    this.tipCleanup = undefined;
    this.tipKey = undefined;
    this.tip.element.hidden = true;
  }

  // --- Try-on (the 3D stage) ------------------------------------------------

  private toggleTryOn(entry: ShopEntry): void {
    const item = entry.item;
    const slot = tryOnSlot(item);
    const request = previewRequest(item, "card");
    if (this.tried.get(slot) === entry.key) {
      this.tried.delete(slot);
      this.stagePreview?.takeOff(request);
    } else {
      let accepted = true;
      try { accepted = this.stagePreview ? this.stagePreview.tryOn(request) : true; } catch { accepted = false; }
      if (!accepted) {
        this.showToast("该道具暂时无法试穿预览");
        return;
      }
      this.tried.set(slot, entry.key);
    }
    this.refreshCards();
  }

  private resetTryOn(): void {
    this.tried.clear();
    try { this.stagePreview?.reset(); } catch { /* The rider keeps its look. */ }
    this.refreshCards();
  }

  // --- Status and notices -----------------------------------------------------

  private showStatus(kind?: "loading" | "error" | "empty", message?: string,
    action?: string, onAction?: () => void): void {
    if (!kind) {
      this.status.hidden = true;
      this.grid.hidden = false;
      return;
    }
    this.status.hidden = false;
    this.status.dataset.kind = kind;
    this.grid.hidden = kind !== "empty";
    const children: Node[] = [];
    if (kind === "loading") children.push(element("div", "ks-shop-spinner"));
    children.push(element("p", "ks-shop-status-text", message ?? ""));
    if (action && onAction) {
      const button = element("button", "ks-shop-status-button ks-bml");
      button.type = "button";
      for (let state = 0; state < 4; state++) setFrame(button, "DefaultFocusedButton", state, state);
      button.style.setProperty("--c0", "#ffffff");
      setText(button, action);
      button.dataset.align = "center";
      button.dataset.valign = "center";
      button.addEventListener("click", () => { this.options.onActivate?.(); onAction(); });
      children.push(button);
    }
    this.status.replaceChildren(...children);
    if (kind === "error" && action) this.status.querySelector<HTMLButtonElement>("button")?.focus();
  }

  private showToast(message: string): void {
    this.toastText.textContent = message;
    this.toast.dataset.show = "true";
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast.dataset.show = "false"; }, TOAST_MS);
  }

  // --- Purchase -----------------------------------------------------------

  private openBuy(entry: ShopEntry): void {
    if (this.dialog || this.disposed) return;
    this.pinnedKey = undefined;
    this.setActive(undefined);
    // One purchaser per dialog: 重试 inside it repeats the same requestId, a
    // later dialog never replays an earlier unknown outcome.
    const purchaser = new ShopPurchaser(this.options.session);
    const controller = new BuyDialogController({
      entry,
      currency: displayOffer(entry)?.currency ?? "all",
      now: () => this.now(),
      context: () => this.offerContext(entry.item),
      purchase: offer => purchaser.purchase(offer),
      afterPurchase: async result => {
        try { await this.options.session.refresh(); } catch { /* Shown on the next refresh. */ }
        this.options.onPurchased?.(result.item);
        // 点券 spent counts toward the 累计消费活动.
        if (!this.disposed) void this.loadSpendEvent();
      },
      onFailure: error => {
        const code = isShopApiError(error) ? error.code : "NETWORK_ERROR";
        if (code === "LOGIN_REQUIRED") this.afterDialog = "logout";
        // Offer gone or price changed: the catalog is reloaded when the dialog closes.
        else if (isShopApiError(error) && error.staleCatalog) this.afterDialog = "reload";
        // Balances, ownership or an unknown outcome: re-read the account.
        if (code !== "LOGIN_REQUIRED") void this.options.session.refresh().catch(() => {});
      },
    });
    this.dialogController = controller;
    this.dialog = new BuyDialogView({
      layer: this.modalLayer,
      screen: this.screen,
      controller,
      renderPreview: host => renderArt(host, entry.item, "dialog", this.options.preview, false),
      onClose: state => this.onDialogClosed(state),
      onActivate: () => this.options.onActivate?.(),
      onHover: () => this.options.onHover?.(),
      enterHeld: this.enterDown,
    });
  }

  private onDialogClosed(state: BuyDialogState): void {
    // Left after an unknown outcome: the purchase may still complete, re-read the account.
    if (state.phase === "error" && state.retryable && this.afterDialog !== "logout")
      void this.options.session.refresh().catch(() => {});
    const key = this.dialogController?.entry.key;
    this.dialogController?.dispose();
    this.dialogController = undefined;
    this.dialog = undefined;
    const next = this.afterDialog;
    this.afterDialog = undefined;
    if (next === "logout") { this.closeByUser(); return; }
    if (next === "reload") void this.load();
    const record = key ? this.cards.get(key) : undefined;
    (record && !record.buy.disabled ? record.buy : record?.face ??
      this.tabButtons.get(this.query.tab))?.focus({ preventScroll: true });
  }

  // --- Keyboard -----------------------------------------------------------

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed) return;
    if (event.key === "Enter") this.enterDown = true;
    // Keys aimed inside the shop stop at its element; the rest (focus on the
    // page, e.g. body) stop here, so the page never acts behind the shop.
    if (!this.element.contains(event.target as Node | null)) {
      event.stopPropagation();
      if (isPageFunctionKey(event)) event.preventDefault();
    }
    if (event.defaultPrevented || event.isComposing) return;
    if (this.dialog) {
      this.dialog.handleKey(event);
      if (["Escape", "Enter", "Tab"].includes(event.key)) event.stopPropagation();
      return;
    }
    const target = event.target as HTMLElement | null;
    const typing = target instanceof HTMLInputElement;
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        if (target === this.searchInput) {
          if (this.searchInput.value) this.clearSearch(true);
          else { this.closeSearch(); this.searchButton.focus({ preventScroll: true }); }
        } else if (this.pinnedKey) {
          this.pinnedKey = undefined;
          for (const record of this.cards.values()) record.detail.setAttribute("aria-pressed", "false");
          this.setActive(this.activeKey);
        } else {
          this.closeByUser();
        }
        return;
      case "Tab":
        if (this.element.contains(target) || target === document.body) {
          trapFocus(this.element, event);
          event.stopPropagation();
        }
        return;
      case "PageUp":
      case "PageDown":
        if (typing) return;
        event.preventDefault();
        event.stopPropagation();
        this.scrollLines(event.key === "PageDown" ? SHOP_GRID.rows : -SHOP_GRID.rows);
        this.focusCard(0);
        return;
      default:
        return;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.disposed) return;
    if (event.key === "Enter") this.enterDown = false;
    this.dialog?.handleKeyUp(event);
  };

  private faces(): HTMLElement[] {
    return [...this.grid.querySelectorAll<HTMLElement>(".ks-shop-card-face")];
  }

  private focusCard(index: number): void {
    const faces = this.faces();
    faces[Math.max(0, Math.min(faces.length - 1, index))]?.focus({ preventScroll: true });
  }

  /** Arrow keys move among the card faces; past the window they scroll a line. */
  private onCardKey(event: KeyboardEvent, face: HTMLElement): void {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SHOP_GRID.columns,
      ArrowDown: SHOP_GRID.columns }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const faces = this.faces();
    const current = faces.indexOf(face);
    const next = current + step;
    if (next >= 0 && next < faces.length) { faces[next]!.focus({ preventScroll: true }); return; }
    const column = current % SHOP_GRID.columns;
    if (step > 0 && this.scrollLines(1)) {
      this.focusCard(event.key === "ArrowRight" ? (SHOP_GRID.rows - 1) * SHOP_GRID.columns
        : (SHOP_GRID.rows - 1) * SHOP_GRID.columns + column);
    } else if (step < 0 && this.scrollLines(-1)) {
      this.focusCard(event.key === "ArrowLeft" ? SHOP_GRID.columns - 1 : column);
    }
  }

  // --- Lifecycle ----------------------------------------------------------

  closeByUser = (): void => {
    if (this.disposed) return;
    this.dispose();
    this.options.onClose();
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadAbort?.abort();
    this.spendAbort?.abort();
    this.unsubscribe();
    clearInterval(this.sessionTimer);
    clearTimeout(this.searchTimer);
    clearTimeout(this.toastTimer);
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("keyup", this.onKeyUp, true);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.fit);
    this.dialog?.dispose();
    this.dialogController?.dispose();
    this.dialog = undefined;
    for (const record of this.cards.values()) record.cleanup();
    this.cards.clear();
    this.tipCleanup?.();
    this.spend.dispose();
    try { this.topBar?.dispose(); } catch { /* Best effort. */ }
    this.topBar = undefined;
    try { this.stagePreview?.dispose(); } catch { /* Best effort. */ }
    this.stagePreview = undefined;
    this.element.remove();
    if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected)
      this.previousFocus.focus({ preventScroll: true });
  }
}

let active: ShopView | undefined;

/**
 * Opens the shop over options.root and resolves once it is shown; the
 * catalog loads inside (with its own loading, error and retry states).
 * close() removes it without calling onClose; a second openShop replaces
 * an open shop the same way.
 */
export async function openShop(options: ShopOpenOptions): Promise<{ close(): void }> {
  if (!options?.root || typeof options.root.append !== "function")
    throw new Error("商店缺少挂载容器。");
  if (!options.session) throw new Error("请先登录后再打开商店。");
  active?.dispose();
  const view: ShopView = new ShopView({
    ...options,
    onClose: () => {
      if (active === view) active = undefined;
      options.onClose();
    },
  });
  active = view;
  return {
    close: () => {
      view.dispose();
      if (active === view) active = undefined;
    },
  };
}

/** Warms the catalog cache (e.g. after login) so the shop opens at once. */
export function prefetchShopCatalog(session: AccountSession): Promise<void> {
  return fetchShopCatalog(session).then(() => undefined, () => undefined);
}

/**
 * The stage_window@cn variant the shop builds (search button moved, no
 * currency bar), laid out on a screen `width` wide (1920 by default).
 */
export function shopStageLayout(width = SHOP_SCREEN_WIDTH): ShopLayout { return stageLayout(width); }
