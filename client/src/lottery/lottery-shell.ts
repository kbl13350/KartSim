/**
 * What the two lottery screens share: a full-screen original stage (the
 * 1080-high virtual screen of the shop, scaled to the viewport, covering
 * the taskbar like the release RouletteStage and GachaUseStage), item
 * pictures (the shop's garage snapshots for catalog items, original icons
 * otherwise), a notice line, a confirm dialog and the 兑换 pack dialog.
 */
import type { AccountSession } from "../account/account-session";
import { fetchShopCatalog } from "../shop/shop-api";
import type { ShopArt } from "../shop/shop-assets";
import { imageVar } from "../shop/shop-assets";
import { kindIconMarkup } from "../shop/shop-icons";
import { shopScreen, type ShopScreen } from "../shop/shop-original";
import { SHOP_STYLES } from "../shop/shop-styles";
import { element, setFrame } from "../shop/shop-widgets";
import { lotteryErrorMessage, type LotteryApi, type LotteryItem, type LotteryPack } from "./lottery-api";
import { affordable, itemLine, itemsLine, packPrice } from "./lottery-model";

/** Item pictures: the garage snapshot renderer the 道具图鉴 uses. */
export interface LotteryPictureSource {
  picture(category: number, itemId: number, internalId: string, signal: AbortSignal):
    Promise<HTMLCanvasElement | undefined>;
  dispose(): void;
}

export interface LotteryScreenOptions {
  root: HTMLElement;
  library: unknown;
  session: AccountSession;
  api: LotteryApi;
  /** Garage snapshots of catalog items; without it items show their icon. */
  pictures?: LotteryPictureSource;
  /** The player closed the screen (its close button, Esc) or the session ended. */
  onClose(): void;
  onHover?(): void;
  onActivate?(): void;
}

const NOTICE_MS = 3_200;

/** Rarity names of the treasure-hunt effect art (아이템출현광원_<name>). */
export const RARITY_EFFECTS: Readonly<Record<string, string>> = {
  normal: "일반", rare: "레어", epic: "에픽", unique: "유니크", legend: "레전드", special: "스페셜", ultimate: "얼티밋",
};

/** Kind of a catalog category for the fallback icons (shop-icons). */
const CATEGORY_KINDS: Readonly<Record<number, string>> = {
  1: "character", 2: "color", 3: "kart", 4: "plate", 8: "goggle", 9: "balloon", 11: "headBand", 16: "handGearL",
  18: "uniform", 20: "decal", 21: "pet", 26: "aura", 27: "skidMark", 52: "flyingPet", 70: "dye", 71: "slotBg",
};

export const LOTTERY_STYLES = `
.ks-lottery{pointer-events:auto;z-index:5;background:#000}
.ks-lottery .ks-lottery-stage{position:absolute;left:0;top:0;width:var(--ks-shop-w,1920px);height:1080px;
  transform-origin:0 0;transform:scale(var(--ks-shop-scale,1));overflow:hidden}
.ks-lottery button.ks-bml:not(:disabled){cursor:pointer}
.ks-lottery button.ks-bml[aria-disabled=true]{filter:grayscale(.6) brightness(.8);cursor:default}
.ks-lottery-pic{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.ks-lottery-pic>canvas,.ks-lottery-pic>img{position:absolute;max-width:100%;max-height:100%;object-fit:contain}
.ks-lottery-pic>canvas{width:100%;height:100%}
.ks-lottery-pic>svg{width:46%;height:46%;opacity:.85;color:#fff;filter:drop-shadow(0 2px 2px #0008)}
.ks-lottery-pic[data-preview=ready]>svg{display:none}
.ks-lottery-pic>.ks-lottery-icon{position:absolute;inset:18%;background:center/contain no-repeat}
.ks-lottery-pic>.ks-lottery-cube{position:absolute;left:14%;top:14%;width:72%;height:72%;
  background:var(${imageVar("확정가챠꽝아이템")}) no-repeat;background-size:290.9% 145.5%;background-position:28% 4%;border-radius:8%}
.ks-lottery-name{position:absolute;left:-30px;right:-30px;text-align:center;color:#fff;font-size:15px;line-height:1.2;
  text-shadow:0 0 2px #000,1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;pointer-events:none;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ks-lottery-notice{position:absolute;left:50%;top:16%;transform:translate(-50%,-50%);max-width:1100px;padding:16px 30px;
  border-radius:10px;background:rgba(8,20,40,.92);border:2px solid rgba(255,255,255,.4);color:#fff;font-size:22px;
  text-align:center;white-space:pre-line;pointer-events:none;z-index:40;box-shadow:0 8px 30px #0009}
.ks-lottery-notice[hidden]{display:none}
.ks-lottery-modal{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(0,0,0,.55);pointer-events:auto}
.ks-lottery-modal[hidden]{display:none}
.ks-lottery-dialog{position:relative;min-width:560px;max-width:920px;max-height:860px;display:flex;flex-direction:column;
  border-radius:10px;background:linear-gradient(#f4f8fd,#dfe8f3);color:#2a3750;box-shadow:0 18px 60px #000a;overflow:hidden;
  font-weight:700}
.ks-lottery-dialog-head{display:flex;align-items:center;gap:12px;padding:14px 20px;background:linear-gradient(#3c86d6,#2361a8);
  color:#fff;font-size:22px;text-shadow:0 1px 2px #0006}
.ks-lottery-dialog-head span{flex:1}
.ks-lottery-dialog-body{padding:16px 20px;overflow:auto;font-size:18px;line-height:1.45;white-space:pre-line}
.ks-lottery-dialog-foot{display:flex;justify-content:center;gap:18px;padding:12px 20px 18px}
.ks-lottery-btn{min-width:130px;height:44px;padding:0 18px;border:0;border-radius:8px;font:inherit;font-size:19px;color:#fff;
  background:linear-gradient(#45a2f5,#1f6fd0);box-shadow:0 2px 0 #134c96,inset 0 1px 0 #ffffff70;cursor:pointer}
.ks-lottery-btn:hover:not(:disabled){filter:brightness(1.1)}
.ks-lottery-btn:disabled{filter:grayscale(1);opacity:.6;cursor:default}
.ks-lottery-btn[data-kind=secondary]{background:linear-gradient(#b8c3d1,#8592a6);box-shadow:0 2px 0 #5a6577}
.ks-lottery-btn[data-kind=gold]{background:linear-gradient(#ffd84a,#f0a417);color:#4a2a00;box-shadow:0 2px 0 #b06f00}
.ks-lottery-close{width:40px;height:40px;border:0;border-radius:6px;background:rgba(255,255,255,.18);color:#fff;font-size:26px;cursor:pointer}
.ks-lottery-packs{display:flex;flex-direction:column;gap:10px}
.ks-lottery-pack{display:grid;grid-template-columns:96px 1fr auto;align-items:center;gap:14px;padding:10px 12px;border-radius:8px;
  background:#fff;box-shadow:inset 0 0 0 1px #c3cfdd}
.ks-lottery-pack-pic{position:relative;width:96px;height:96px;border-radius:6px;background:linear-gradient(#2b4f7d,#18304f)}
.ks-lottery-pack-name{font-size:19px;color:#1d3150}
.ks-lottery-pack-items{font-size:14px;font-weight:400;color:#56657c;margin-top:4px}
.ks-lottery-pack-buy{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.ks-lottery-price{font-size:18px;color:#c45a00;white-space:nowrap}
.ks-lottery-price[data-currency=lucci]{color:#1e73c8}
.ks-lottery-price[data-currency=koin]{color:#2a9a3c}
.ks-lottery-wallet{font-size:15px;font-weight:400}
.ks-lottery-empty{padding:30px;text-align:center;color:#6b7a90}
`;

/** The pictures of item keys shown by catalog internal id (karts, characters, equipment). */
export class LotteryPictures {
  private catalog?: Promise<Map<string, { internalId: string; kind: string }>>;

  constructor(private readonly options: Pick<LotteryScreenOptions, "session" | "pictures">) {}

  private catalogItems(): Promise<Map<string, { internalId: string; kind: string }>> {
    this.catalog ??= fetchShopCatalog(this.options.session).then(catalog => new Map(catalog.items.map(item =>
      [`${item.category}:${item.itemId}`, { internalId: item.internalId, kind: item.kind }])))
      .catch(() => new Map());
    return this.catalog;
  }

  /**
   * Draws an item into host (positioned, sized by the caller): the
   * category icon at once, then the garage snapshot of a catalog item, or
   * the original icon of a lottery material. Returns the cleanup.
   */
  draw(host: HTMLElement, item: Pick<LotteryItem, "category" | "itemId" | "name">): () => void {
    host.classList.add("ks-lottery-pic");
    host.replaceChildren();
    host.removeAttribute("data-preview");
    const icon = materialIcon(item);
    if (icon) {
      const image = element("div", "ks-lottery-icon");
      image.style.backgroundImage = `var(${imageVar(icon)})`;
      host.append(image);
      host.dataset.preview = "ready";
      return () => {};
    }
    host.insertAdjacentHTML("beforeend", kindIconMarkup(CATEGORY_KINDS[item.category] ?? "etc"));
    const source = this.options.pictures;
    if (!source || !CATEGORY_KINDS[item.category]) return () => {};
    const abort = new AbortController();
    void this.catalogItems().then(async items => {
      const known = items.get(`${item.category}:${item.itemId}`);
      if (!known || abort.signal.aborted) return;
      const canvas = await source.picture(item.category, item.itemId, known.internalId, abort.signal);
      if (!canvas || abort.signal.aborted) return;
      host.append(canvas);
      host.dataset.preview = "ready";
    }).catch(() => { /* The icon stays. */ });
    return () => abort.abort();
  }
}

/** Original icons of items without a 3D picture. */
function materialIcon(item: Pick<LotteryItem, "category" | "itemId">): string | undefined {
  if (item.category === 34 && (item.itemId === 883 || item.itemId === 884)) return "newgacha_goodsicon_1";
  if (item.category === 34 && item.itemId === 834) return "newgacha_goodsicon_2";
  if (item.category === 56 && item.itemId === 1) return "common_icon_koin";
  if (item.category === 62 && item.itemId === 1) return "common_icon_cash";
  if (item.category === 24) return "limitedGacha_01";
  return undefined;
}

/** Icons materialIcon names, to load with a screen's art. */
export const LOTTERY_ICON_IMAGES = ["newgacha_goodsicon_1", "newgacha_goodsicon_2", "common_icon_koin",
  "common_icon_cash", "limitedGacha_01", "확정가챠꽝아이템"] as const;

/** The full-screen stage both screens are built on. */
export class LotteryShell {
  readonly element = element("div", "ks-shop ks-lottery");
  readonly stage = element("div", "ks-lottery-stage");
  readonly modal = element("div", "ks-lottery-modal");
  private readonly notice = element("div", "ks-lottery-notice");
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private resizeObserver?: ResizeObserver;
  private readonly previousFocus: Element | null;
  private closeDialog?: () => void;
  screen: ShopScreen;
  disposed = false;

  constructor(readonly options: LotteryScreenOptions, label: string,
    private readonly onResize: (screen: ShopScreen) => void, private readonly onEscape: () => void) {
    this.previousFocus = document.activeElement;
    this.screen = this.measure();
    const root = this.element;
    root.dataset.uiLayer = "dialog";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", label);
    root.tabIndex = -1;
    const style = element("style");
    style.textContent = SHOP_STYLES + LOTTERY_STYLES;
    this.notice.hidden = true;
    this.notice.setAttribute("role", "status");
    this.modal.hidden = true;
    this.stage.append(this.notice, this.modal);
    root.append(style, this.stage);
    root.addEventListener("keydown", this.onKeyDown);
    root.addEventListener("pointerover", event => {
      if (event.target instanceof Element && event.target.closest("button:not(:disabled)")) options.onHover?.();
    });
    root.addEventListener("click", event => {
      if (event.target instanceof Element && event.target.closest("button:not(:disabled)")) options.onActivate?.();
    }, true);
  }

  private measure(): ShopScreen {
    const { root } = this.options;
    return shopScreen(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
  }

  /** Mounts the screen and starts following the viewport. */
  mount(): void {
    this.options.root.append(this.element);
    this.fit();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(this.options.root);
    } else {
      window.addEventListener("resize", this.fit);
    }
    this.element.focus({ preventScroll: true });
  }

  private fit = (): void => {
    const screen = this.measure();
    this.element.style.setProperty("--ks-shop-scale", String(screen.scale));
    this.element.style.setProperty("--ks-shop-w", `${screen.width}px`);
    const moved = screen.width !== this.screen.width;
    this.screen = screen;
    if (moved) this.onResize(screen);
  };

  /** Installs loaded art (CSS custom properties) on the screen. */
  applyArt(art: ShopArt): void {
    for (const [name, value] of art.properties) this.element.style.setProperty(name, value);
    this.element.dataset.art = String(art.properties.size);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (this.closeDialog) this.closeDialog();
    else this.onEscape();
  };

  /** A short notice over the stage. */
  showNotice(message: string, ms = NOTICE_MS): void {
    if (this.disposed) return;
    this.notice.textContent = message;
    this.notice.hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice.hidden = true; }, ms);
  }

  get dialogOpen(): boolean { return !!this.closeDialog; }

  /** Shows a dialog in the modal layer; resolves with its result when closed. */
  dialog<T>(title: string, build: (body: HTMLElement, foot: HTMLElement, done: (value: T) => void) => void,
    fallback: T): Promise<T> {
    this.closeDialog?.();
    return new Promise<T>(resolve => {
      const box = element("div", "ks-lottery-dialog");
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-label", title);
      const head = element("div", "ks-lottery-dialog-head");
      const close = element("button", "ks-lottery-close", "×");
      close.type = "button";
      close.setAttribute("aria-label", "关闭");
      head.append(element("span", undefined, title), close);
      const body = element("div", "ks-lottery-dialog-body");
      const foot = element("div", "ks-lottery-dialog-foot");
      box.append(head, body, foot);
      let finished = false;
      const done = (value: T) => {
        if (finished) return;
        finished = true;
        this.closeDialog = undefined;
        this.modal.hidden = true;
        this.modal.replaceChildren();
        resolve(value);
        this.element.focus({ preventScroll: true });
      };
      close.addEventListener("click", () => done(fallback));
      this.closeDialog = () => done(fallback);
      build(body, foot, done);
      this.modal.replaceChildren(box);
      this.modal.hidden = false;
      (foot.querySelector("button") ?? close).focus({ preventScroll: true });
    });
  }

  /** 确定 / 取消. */
  confirm(title: string, message: string, ok = "确定"): Promise<boolean> {
    return this.dialog<boolean>(title, (body, foot, done) => {
      body.textContent = message;
      foot.append(dialogButton(ok, () => done(true)), dialogButton("取消", () => done(false), "secondary"));
    }, false);
  }

  /** A message with one 确定. */
  alert(title: string, message: string): Promise<void> {
    return this.dialog<void>(title, (body, foot, done) => {
      body.textContent = message;
      foot.append(dialogButton("确定", () => done()));
    }, undefined);
  }

  /**
   * The 兑换 dialog: the original packs with their price; buying one asks
   * for confirmation and reports the items. Resolves true when something
   * was bought.
   */
  async packs(packs: readonly LotteryPack[], pictures: LotteryPictures, onBought: () => void): Promise<boolean> {
    let bought = false;
    const cleanups: Array<() => void> = [];
    await this.dialog<void>("兑换", (body, foot, done) => {
      const listing = element("div", "ks-lottery-packs");
      const wallet = element("div", "ks-lottery-wallet");
      const showWallet = () => {
        const summary = this.options.session.summary();
        wallet.textContent = summary
          ? `持有：${summary.wallet.coupon.toLocaleString()} 点券　${summary.wallet.lucci.toLocaleString()} 金币　${summary.wallet.koin.toLocaleString()} K币`
          : "";
      };
      showWallet();
      if (packs.length === 0) listing.append(element("div", "ks-lottery-empty", "暂时没有可兑换的礼包。"));
      for (const pack of packs) {
        const row = element("div", "ks-lottery-pack");
        const pic = element("div", "ks-lottery-pack-pic");
        if (pack.items[0]) cleanups.push(pictures.draw(pic, pack.items[0]));
        const info = element("div");
        info.append(element("div", "ks-lottery-pack-name", pack.name),
          element("div", "ks-lottery-pack-items", itemsLine(pack.items)));
        const buy = element("div", "ks-lottery-pack-buy");
        const price = element("div", "ks-lottery-price", packPrice(pack));
        price.dataset.currency = pack.currency;
        const button = dialogButton("兑换", () => void this.buy(pack, button, showWallet).then(ok => {
          if (!ok) return;
          bought = true;
          onBought();
        }), "gold");
        buy.append(price, button);
        row.append(pic, info, buy);
        listing.append(row);
      }
      body.append(listing);
      foot.append(wallet, dialogButton("关闭", () => done(), "secondary"));
    }, undefined);
    for (const cleanup of cleanups) cleanup();
    return bought;
  }

  private async buy(pack: LotteryPack, button: HTMLButtonElement, showWallet: () => void): Promise<boolean> {
    const wallet = this.options.session.summary()?.wallet;
    if (!affordable(pack, wallet)) {
      this.showNotice(lotteryErrorMessage("INSUFFICIENT_FUNDS"));
      return false;
    }
    button.disabled = true;
    try {
      const result = await this.options.api.buyPack(pack);
      await this.options.session.refresh().catch(() => undefined);
      showWallet();
      const got = result.items.filter(item => !item.owned).map(itemLine).join("、");
      this.showNotice(`兑换成功！获得 ${got || pack.name}`);
      return true;
    } catch (error) {
      this.showNotice(lotteryErrorMessage(error));
      return false;
    } finally {
      button.disabled = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.noticeTimer);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.fit);
    this.closeDialog?.();
    this.element.remove();
    if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected)
      this.previousFocus.focus({ preventScroll: true });
  }
}

export function dialogButton(label: string, onClick: () => void, kind?: "secondary" | "gold"): HTMLButtonElement {
  const button = element("button", "ks-lottery-btn", label);
  button.type = "button";
  if (kind) button.dataset.kind = kind;
  button.addEventListener("click", onClick);
  return button;
}

/** A name label under a picture. */
export function nameLabel(text: string, top: number): HTMLElement {
  const label = element("div", "ks-lottery-name", text);
  label.style.top = `${top}px`;
  return label;
}

/** Frames a plain element with a monocoque frame, like the shop's toast. */
export { setFrame };
