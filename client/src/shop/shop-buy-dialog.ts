/**
 * The purchase dialog, rebuilt after the original dialog2_buyItem.rho
 * mqBuyItem@cn (CaptionDialog 524×465): the item picture (img_slot2), 道具名称,
 * 道具价格 as the cmbStock combo box of the item's offers (选择期限), the wallet
 * before and after in the offer's currency (cashPanel / lucciPanel /
 * koinPanel), the * note (lblAskBuy), then 确定 / 取消 and the caption's close
 * button. The controller holds the state machine (choose → busy → success |
 * error) and is DOM-free.
 *
 * The view ignores input meant for what was under the pointer or the key
 * when it opened: clicks and offer changes during the first
 * DIALOG_INPUT_GUARD_MS (the second click of a double-click on a card), a
 * backdrop click whose press began before that, and an Enter held since
 * opening (auto-repeat, or no Enter release seen yet).
 */
import type { Currency } from "../account/account-session";
import { isShopApiError, shopErrorMessage, type ShopPurchaseResult } from "./shop-api";
import type { ShopItem, ShopOffer } from "./shop-catalog";
import {
  CURRENCY_LABELS, defaultOffer, engineLabel, formatAmount, formatDateTime, formatExpRequirement,
  formatOfferTerm, kindLabel, offerAvailability, orderedOffers, ownedRental, renewalNote,
  type OfferAvailability, type OfferContext, type ShopCurrencyFilter, type ShopEntry,
  type ShopOwnership,
} from "./shop-model";
import {
  attr, BUY_DIALOG, find, screenRect, SHOP_SCREEN_HEIGHT, SHOP_SCREEN_WIDTH, SHOP_STRINGS, ShopLayout,
  STOCK_COMBO_ITEM,
} from "./shop-original";
import { BmlTree, createNodeElement, element, place, setFrame, setText } from "./shop-widgets";

export type BuyPhase = "choose" | "busy" | "success" | "error";

export interface BuyDialogState {
  readonly phase: BuyPhase;
  /** Every offer in display order with its availability. */
  readonly offers: readonly OfferAvailability[];
  readonly selected: OfferAvailability;
  /** Error, progress or success text. */
  readonly message?: string;
  /** The last failure may be repeated with the same requestId. */
  readonly retryable?: boolean;
  /** The last failure's code. */
  readonly errorCode?: string;
  /** The last failure says the catalog is out of date (price changed, offer gone): 购买 stays off. */
  readonly stale?: boolean;
  readonly result?: ShopPurchaseResult;
  /** The item's ownership: live before the purchase, as it was before buying on success. */
  readonly ownership: ShopOwnership;
}

export interface BuyDialogDependencies {
  readonly entry: ShopEntry;
  /** Live wallet, exp and ownership of the item. */
  context(): OfferContext;
  /** ShopPurchaser.purchase: one requestId per offer until it settles. */
  purchase(offer: ShopOffer): Promise<ShopPurchaseResult>;
  /** Refresh the session and notify the host; failures here do not undo success. */
  afterPurchase?(result: ShopPurchaseResult, offer: ShopOffer): Promise<void> | void;
  onFailure?(error: unknown, offer: ShopOffer): void;
  /** The card's currency, preferred for the initial offer. */
  currency?: ShopCurrencyFilter;
  /** Clock for rental expiry (the data service's when known); Date.now by default. */
  now?(): number;
}

export const PURCHASE_SUCCESS_MESSAGE = "兑换成功，已放入车库";
export const PURCHASE_BUSY_MESSAGE = "正在兑换…";

/**
 * The note under a successful purchase: "* 已获得 尖锋6.5（30天）。", or for
 * an owned rental "* 已续期 尖锋6.5，到期 2026-11-06 14:30。" /
 * "* 尖锋6.5 已变为永久。".
 */
export function purchaseSuccessNote(item: Pick<ShopItem, "name" | "isAdditional">,
  offer: Pick<ShopOffer, "days" | "count">, before: ShopOwnership, result?: ShopPurchaseResult): string {
  if (ownedRental(item, before)) {
    const expiresAt = result ? result.item.expiresAt : offer.days === 0 ? null : undefined;
    if (expiresAt === null) return `* ${item.name} 已变为永久。`;
    return expiresAt === undefined ? `* 已续期 ${item.name}。` :
      `* 已续期 ${item.name}，到期 ${formatDateTime(expiresAt)}。`;
  }
  return `* 已获得 ${item.name}（${formatOfferTerm(offer, item)}）。`;
}

/** The message for a failed purchase of this offer. */
export function purchaseFailureMessage(error: unknown, offer: Pick<ShopOffer, "currency" | "minExp">): string {
  if (!isShopApiError(error)) return shopErrorMessage("NETWORK_ERROR");
  if (error.code === "INSUFFICIENT_FUNDS")
    return `${CURRENCY_LABELS[offer.currency]}不足，无法兑换该道具。`;
  if (error.code === "EXP_REQUIRED" && offer.minExp)
    return `经验不足，${formatExpRequirement(offer.minExp)}。`;
  if (error.retryable && error.code !== "TOO_MANY_ATTEMPTS")
    return `${error.message}重试不会重复扣费。`;
  return error.message;
}

export class BuyDialogController {
  private current: BuyDialogState;
  private readonly listeners = new Set<() => void>();
  private disposed = false;

  constructor(private readonly dependencies: BuyDialogDependencies) {
    const context = dependencies.context();
    const offers = this.availability(context);
    const initial = defaultOffer(dependencies.entry, context, dependencies.currency ?? "all");
    this.current = {
      phase: "choose", offers, ownership: context.ownership,
      selected: offers.find(entry => entry.offer.offerId === initial.offerId) ?? offers[0]!,
    };
  }

  get state(): BuyDialogState { return this.current; }
  get entry(): ShopEntry { return this.dependencies.entry; }

  now(): number {
    const value = this.dependencies.now?.() ?? Date.now();
    return Number.isFinite(value) ? value : Date.now();
  }

  /** What buying the selected offer does to an owned rental, if the item is one. */
  renewal(): string | undefined {
    const { phase, selected, ownership } = this.current;
    if (phase === "success") return undefined;
    return renewalNote(this.dependencies.entry.item, selected.offer, ownership, this.now());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private availability(context: OfferContext): OfferAvailability[] {
    const item = this.dependencies.entry.item;
    return orderedOffers(item).map(offer => offerAvailability(item, offer, context));
  }

  private set(next: BuyDialogState): void {
    this.current = next;
    if (!this.disposed) for (const listener of [...this.listeners]) listener();
  }

  /** Re-read the wallet and ownership (session updates). */
  refresh(): void {
    if (this.current.phase === "busy") return;
    const context = this.dependencies.context();
    const offers = this.availability(context);
    const selected = offers.find(entry => entry.offer.offerId === this.current.selected.offer.offerId) ??
      offers[0]!;
    // After a purchase the note describes the change from the ownership before it.
    const ownership = this.current.phase === "success" ? this.current.ownership : context.ownership;
    this.set({ ...this.current, offers, selected, ownership });
  }

  select(offerId: string): void {
    if (this.current.phase === "busy" || this.current.phase === "success") return;
    const selected = this.current.offers.find(entry => entry.offer.offerId === offerId);
    if (!selected || selected === this.current.selected) return;
    this.set({ phase: "choose", offers: this.current.offers, selected, ownership: this.current.ownership });
  }

  /** 购买 (or 重试) is enabled. */
  canConfirm(): boolean {
    const { phase, selected, stale } = this.current;
    return (phase === "choose" || (phase === "error" && !stale)) && !selected.blocked;
  }

  async confirm(): Promise<void> {
    if (!this.canConfirm()) return;
    const offer = this.current.selected.offer;
    const before = this.current.ownership;
    this.set({ phase: "busy", offers: this.current.offers, selected: this.current.selected,
      ownership: before, message: PURCHASE_BUSY_MESSAGE });
    let result: ShopPurchaseResult;
    try {
      result = await this.dependencies.purchase(offer);
    } catch (error) {
      this.dependencies.onFailure?.(error, offer);
      const context = this.dependencies.context();
      const offers = this.availability(context);
      this.set({
        phase: "error", offers, ownership: context.ownership,
        selected: offers.find(entry => entry.offer.offerId === offer.offerId) ?? offers[0]!,
        message: purchaseFailureMessage(error, offer),
        retryable: isShopApiError(error) ? error.retryable : true,
        errorCode: isShopApiError(error) ? error.code : "NETWORK_ERROR",
        ...(isShopApiError(error) && error.staleCatalog ? { stale: true } : {}),
      });
      return;
    }
    try {
      await this.dependencies.afterPurchase?.(result, offer);
    } catch { /* The purchase stands; the next session refresh catches up. */ }
    this.set({ phase: "success", offers: this.current.offers, selected: this.current.selected,
      ownership: before, message: PURCHASE_SUCCESS_MESSAGE, result });
  }
}

/** Clicks and offer changes this soon after opening belong to what opened the dialog. */
export const DIALOG_INPUT_GUARD_MS = 500;

// --- DOM ----------------------------------------------------------------

export interface BuyDialogViewOptions {
  /** The shop's modal layer (its screen: SHOP_SCREEN_HEIGHT high). */
  layer: HTMLElement;
  /** The shop's screen; the 1920×1080 reference screen by default. */
  screen?: { width: number; height: number };
  controller: BuyDialogController;
  /** Draw the item picture into the item window (220×150). */
  renderPreview(host: HTMLElement): (() => void) | void;
  onClose(state: BuyDialogState): void;
  onActivate?(): void;
  onHover?(): void;
  /**
   * Enter was down when the dialog opened (it was opened with Enter): Enter
   * confirms only after it is released. Defaults to true, so a dialog that
   * does not know needs a release first.
   */
  enterHeld?: boolean;
  /** Milliseconds clock for the input guard; performance.now by default. */
  clock?(): number;
}

/** Sizes and offsets inside the dialog (the same on every screen). */
const BUY_LAYOUT = new ShopLayout(BUY_DIALOG);
const COMBO_ITEM_HEIGHT = 22;
const REFERENCE_SCREEN = { width: SHOP_SCREEN_WIDTH, height: SHOP_SCREEN_HEIGHT };

/** mqBuyItem@cn on a screen: the CaptionDialog stays centred on it (align center). */
function dialogLayout(screen: { width: number; height: number } = REFERENCE_SCREEN): ShopLayout {
  return new ShopLayout(BUY_DIALOG, screenRect(screen));
}

/** The wallet panel mqBuyItem@cn shows for an offer currency. */
const WALLET_PANELS: Record<Currency, string> = { coupon: "cashPanel", lucci: "lucciPanel", koin: "koinPanel" };

/** The modal dialog; Esc cancels, Enter confirms, Tab stays inside. */
export class BuyDialogView {
  readonly element: HTMLElement;
  private readonly tree: BmlTree;
  private readonly dialog: HTMLElement;
  private readonly combo: HTMLButtonElement;
  private readonly comboList = element("div", "ks-shop-combo-list ks-bml");
  private readonly note: HTMLElement;
  private readonly message = element("div", "ks-shop-dialog-message ks-bml");
  private readonly okButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly panels = new Map<Currency, { panel: HTMLElement; labels: HTMLElement[] }>();
  private readonly previewCleanup?: () => void;
  private readonly unsubscribe: () => void;
  private readonly listId = `ks-shop-stock-${Math.random().toString(36).slice(2)}`;
  private closed = false;
  private renderedOffers?: readonly OfferAvailability[];
  private renderedPhase?: BuyPhase;
  private listOpen = false;
  private highlighted = 0;
  private readonly clock: () => number;
  private readonly openedAt: number;
  /** An Enter release was seen since opening (or Enter was not down then). */
  private enterReleased: boolean;
  /** The current press began on the backdrop after the guard. */
  private backdropPress = false;

  constructor(private readonly options: BuyDialogViewOptions) {
    this.clock = options.clock ?? (() => performance.now());
    this.openedAt = this.clock();
    this.tree = new BmlTree(dialogLayout(options.screen));
    this.enterReleased = options.enterHeld === false;
    const { controller } = options;
    const item = controller.entry.item;
    const tree = this.tree;
    this.element = tree.element;
    this.element.classList.add("ks-shop-modal");
    this.element.setAttribute("role", "presentation");
    this.dialog = tree.elements.get(BUY_DIALOG.children.find(child => child.name === "CaptionWindow")!)!;
    this.dialog.classList.add("ks-shop-dialog");
    this.dialog.setAttribute("role", "dialog");
    this.dialog.setAttribute("aria-modal", "true");
    this.dialog.setAttribute("aria-label", `兑换 ${item.name}`);
    // #sb(buyItem) is 获得活动道具 in the CN bag (a mistranslation of the KR 아이템 구입).
    setText(this.dialog, "兑换道具");

    const art = element("div", "ks-shop-art ks-shop-art-large");
    tree.named("itemPanel").append(art);
    this.previewCleanup = options.renderPreview(art) ?? undefined;

    // 道具名称 / 道具价格 and their boxes (the stock container).
    const stock = find(BUY_DIALOG, "stock");
    const [, nameTitle, , , , priceTitle] = stock.children;
    setText(tree.elements.get(nameTitle!)!, SHOP_STRINGS.itemName);
    setText(tree.elements.get(priceTitle!)!, SHOP_STRINGS.itemPrice);
    const name = tree.named("itemName");
    name.classList.add("ks-shop-dialog-name");
    name.style.width = `${BUY_LAYOUT.rect(stock.children[2]!).width - 20}px`;
    setText(name, item.name);
    name.title = item.name;
    const meta = [kindLabel(item), engineLabel(item)].filter(Boolean).join(" · ");
    if (meta) name.setAttribute("aria-description", meta);

    this.combo = tree.named("cmbStock") as HTMLButtonElement;
    this.combo.classList.add("ks-shop-combo");
    this.combo.setAttribute("role", "combobox");
    this.combo.setAttribute("aria-haspopup", "listbox");
    this.combo.setAttribute("aria-controls", this.listId);
    this.combo.setAttribute("aria-expanded", "false");
    this.combo.setAttribute("aria-label", SHOP_STRINGS.selectStr);
    for (let state = 0; state < 4; state++)
      setFrame(this.combo, "DefaultEdit", state === 3 ? 1 : 0, state);
    const arrow = element("span", "ks-shop-combo-arrow ks-bml");
    for (let state = 0; state < 4; state++) setFrame(arrow, "ComboInnerDropDownButton", state, state);
    arrow.append(element("span", "ks-shop-combo-arrow-icon"));
    this.combo.append(arrow);
    this.comboList.id = this.listId;
    this.comboList.setAttribute("role", "listbox");
    this.comboList.setAttribute("aria-label", SHOP_STRINGS.selectStr);
    setFrame(this.comboList, attr(find(BUY_DIALOG, "cmbStock"), "listFrame") ?? "DefaultEdit", 0);
    this.comboList.hidden = true;
    const comboRect = BUY_LAYOUT.relative(find(BUY_DIALOG, "cmbStock"), find(BUY_DIALOG, "stock"));
    this.comboList.style.left = `${comboRect.x}px`;
    this.comboList.style.top = `${comboRect.y + comboRect.height}px`;
    this.comboList.style.width = `${comboRect.width}px`;
    tree.named("stock").append(this.comboList);

    // Wallet panels; the label texts name this server's currencies.
    for (const currency of ["coupon", "lucci", "koin"] as const) {
      const node = find(BUY_DIALOG, WALLET_PANELS[currency]);
      const panel = tree.elements.get(node)!;
      const labels = node.children.map(child => tree.elements.get(child)!);
      const label = CURRENCY_LABELS[currency];
      setText(labels[0]!, `我的${label}`);
      setText(labels[2]!, label);
      setText(labels[4]!, `剩余${label}`);
      setText(labels[6]!, label);
      labels[1]!.classList.add("ks-shop-dialog-amount");
      labels[5]!.classList.add("ks-shop-dialog-amount");
      panel.classList.add("ks-shop-dialog-wallet");
      panel.dataset.currency = currency;
      this.panels.set(currency, { panel, labels });
    }

    this.note = tree.named("lblAskBuy");
    this.note.classList.add("ks-shop-dialog-note");
    // The status line under the note (busy, failures, success).
    const noteRect = BUY_LAYOUT.relative(find(BUY_DIALOG, "lblAskBuy"), BUY_DIALOG.children[0]!);
    place(this.message, { x: noteRect.x, y: noteRect.y + noteRect.height + 2, width: noteRect.width, height: 36 });
    this.message.dataset.wrap = "true";
    this.message.style.setProperty("--fz", "14px");
    this.message.setAttribute("role", "status");
    this.message.setAttribute("aria-live", "polite");
    this.dialog.append(this.message);

    this.okButton = tree.named("okButton") as HTMLButtonElement;
    this.cancelButton = tree.named("cancelButton") as HTMLButtonElement;
    this.closeButton = tree.named("closeButton") as HTMLButtonElement;
    this.okButton.classList.add("ks-shop-button", "ks-shop-button-primary");
    this.cancelButton.classList.add("ks-shop-button");
    this.closeButton.classList.add("ks-shop-dialog-close");
    this.closeButton.setAttribute("aria-label", SHOP_STRINGS.close);
    this.closeButton.tabIndex = -1;
    setText(this.cancelButton, SHOP_STRINGS.cancel);

    this.okButton.addEventListener("click", () => { if (!this.guarded()) this.confirm(); });
    this.cancelButton.addEventListener("click", () => { if (!this.guarded()) this.close(); });
    this.closeButton.addEventListener("click", () => { if (!this.guarded()) this.close(); });
    this.combo.addEventListener("click", () => {
      if (this.guarded() || !this.canChoose()) return;
      this.options.onActivate?.();
      this.setListOpen(!this.listOpen);
    });
    this.combo.addEventListener("keydown", event => this.onComboKey(event));
    for (const target of [this.okButton, this.cancelButton, this.closeButton, this.combo])
      target.addEventListener("pointerenter", () => { if (!target.disabled) options.onHover?.(); });
    // The backdrop closes on a whole click (press and release) that began on it after the guard.
    this.element.addEventListener("pointerdown", event => {
      this.backdropPress = event.target === this.element && !this.guarded();
      if (this.listOpen && !this.comboList.contains(event.target as Node) && event.target !== this.combo &&
          !this.combo.contains(event.target as Node)) this.setListOpen(false);
    });
    this.element.addEventListener("click", event => {
      const press = this.backdropPress;
      this.backdropPress = false;
      if (event.target === this.element && press && !this.guarded()) this.close();
    });
    this.unsubscribe = controller.subscribe(() => this.render());
    options.layer.append(this.element);
    this.render();
    (this.okButton.disabled ? this.cancelButton : this.okButton).focus({ preventScroll: true });
  }

  get isClosed(): boolean { return this.closed; }

  /** The shop's screen changed size: centre the dialog on the new one. */
  relayout(screen: { width: number; height: number }): void {
    if (!this.closed) this.tree.relayout(dialogLayout(screen));
  }

  /** Within the input guard after opening. */
  private guarded(): boolean {
    return this.clock() - this.openedAt < DIALOG_INPUT_GUARD_MS;
  }

  private canChoose(): boolean {
    const phase = this.options.controller.state.phase;
    return phase !== "busy" && phase !== "success";
  }

  private confirm(): void {
    const { controller } = this.options;
    if (controller.state.phase === "success") { this.close(); return; }
    if (!controller.canConfirm()) return;
    this.setListOpen(false);
    this.options.onActivate?.();
    void controller.confirm();
  }

  /** Close unless a purchase is in flight (its outcome must be shown). */
  close(): void {
    if (this.closed || this.options.controller.state.phase === "busy") return;
    this.dispose();
    this.options.onClose(this.options.controller.state);
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe();
    this.previewCleanup?.();
    this.element.remove();
  }

  /**
   * Keyboard routing from the shop: Esc cancels (or closes the open term
   * list), Enter confirms, Tab stays inside. An auto-repeated Enter, or one
   * held since the dialog opened, does nothing (the key that opened the
   * dialog must not also buy).
   */
  handleKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.listOpen) { this.setListOpen(false); this.combo.focus({ preventScroll: true }); }
      else this.close();
    } else if (event.key === "Enter" && !event.isComposing) {
      if (event.repeat || !this.enterReleased) {
        event.preventDefault();
        return;
      }
      if (event.target === this.cancelButton || event.target === this.closeButton) return;
      event.preventDefault();
      if (this.listOpen) { this.chooseHighlighted(); return; }
      this.confirm();
    } else if (event.key === "Tab") {
      trapFocus(this.dialog, event);
    }
  }

  /** Key releases from the shop: an Enter release arms Enter. */
  handleKeyUp(event: KeyboardEvent): void {
    if (event.key === "Enter") this.enterReleased = true;
  }

  /** ArrowUp/Down change the term (or move in the open list); Space opens the list. */
  private onComboKey(event: KeyboardEvent): void {
    const offers = this.options.controller.state.offers;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (!this.canChoose() || this.guarded()) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      if (this.listOpen) {
        this.highlighted = Math.max(0, Math.min(offers.length - 1, this.highlighted + step));
        this.syncList();
      } else {
        const current = offers.findIndex(entry => entry === this.options.controller.state.selected);
        const next = offers[Math.max(0, Math.min(offers.length - 1, current + step))];
        if (next) this.options.controller.select(next.offer.offerId);
      }
    } else if (event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (!this.guarded() && this.canChoose()) this.setListOpen(!this.listOpen);
    }
  }

  private setListOpen(open: boolean): void {
    if (open === this.listOpen) return;
    this.listOpen = open;
    this.comboList.hidden = !open;
    this.combo.setAttribute("aria-expanded", String(open));
    if (open) {
      const state = this.options.controller.state;
      this.highlighted = Math.max(0, state.offers.indexOf(state.selected));
    }
    this.syncList();
  }

  private chooseHighlighted(): void {
    const entry = this.options.controller.state.offers[this.highlighted];
    if (entry && !this.guarded()) this.options.controller.select(entry.offer.offerId);
    this.setListOpen(false);
    this.combo.focus({ preventScroll: true });
  }

  private renderOffers(state: BuyDialogState): void {
    if (this.renderedOffers === state.offers) { this.syncList(); return; }
    this.renderedOffers = state.offers;
    const item = this.options.controller.entry.item;
    const visible = Math.min(state.offers.length, Number(attr(find(BUY_DIALOG, "cmbStock"), "comboListLength") ?? 10));
    this.comboList.style.height = `${visible * COMBO_ITEM_HEIGHT + 12}px`;
    this.comboList.replaceChildren(...state.offers.map((entry, position) => {
      const option = createNodeElement(STOCK_COMBO_ITEM) as HTMLButtonElement;
      option.classList.add("ks-shop-combo-option");
      option.setAttribute("role", "option");
      option.dataset.offerId = entry.offer.offerId;
      option.dataset.blocked = entry.blocked ?? "";
      option.tabIndex = -1;
      const exp = entry.offer.minExp ? `（${formatExpRequirement(entry.offer.minExp)}）` : "";
      setText(option, `${offerLine(entry.offer, item)}${exp}`);
      if (entry.reason) option.title = entry.reason;
      option.addEventListener("click", () => {
        if (this.guarded()) return;
        this.highlighted = position;
        this.options.onActivate?.();
        this.chooseHighlighted();
      });
      option.addEventListener("pointerenter", () => { this.highlighted = position; this.syncList(); });
      return option;
    }));
    this.syncList();
  }

  /** Marks the selected and highlighted term and keeps the highlighted one in view. */
  private syncList(): void {
    const state = this.options.controller.state;
    const options = this.comboList.querySelectorAll<HTMLElement>(".ks-shop-combo-option");
    options.forEach((option, position) => {
      const selected = state.offers[position] === state.selected;
      option.setAttribute("aria-selected", String(this.listOpen ? position === this.highlighted : selected));
      option.dataset.selected = String(selected);
      if (this.listOpen && position === this.highlighted) {
        const top = position * COMBO_ITEM_HEIGHT, list = this.comboList;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (top + COMBO_ITEM_HEIGHT > list.scrollTop + list.clientHeight)
          list.scrollTop = top + COMBO_ITEM_HEIGHT - list.clientHeight + 12;
      }
    });
    if (this.listOpen) this.combo.setAttribute("aria-activedescendant", `${this.listId}-${this.highlighted}`);
    else this.combo.removeAttribute("aria-activedescendant");
    options.forEach((option, position) => { option.id = `${this.listId}-${position}`; });
  }

  private renderWallet(state: BuyDialogState): void {
    const { offer, balance, after } = state.selected;
    const resultBalance = state.result?.wallet[offer.currency];
    const before = state.phase === "success" && resultBalance !== undefined
      ? resultBalance + offer.price : balance;
    const remaining = state.phase === "success" && resultBalance !== undefined ? resultBalance : after;
    for (const [currency, { panel, labels }] of this.panels) {
      panel.hidden = currency !== offer.currency;
      if (currency !== offer.currency) continue;
      setText(labels[1]!, before === undefined ? "--" : formatAmount(before));
      setText(labels[5]!, remaining === undefined ? "--" : formatAmount(remaining));
      labels[5]!.dataset.negative = String(remaining !== undefined && remaining < 0);
    }
  }

  private render(): void {
    if (this.closed) return;
    const { controller } = this.options;
    const state = controller.state;
    const item = controller.entry.item;
    this.dialog.dataset.phase = state.phase;
    this.renderOffers(state);
    setText(this.combo, offerLine(state.selected.offer, item));
    this.combo.disabled = !this.canChoose();
    if (!this.canChoose()) this.setListOpen(false);
    this.renderWallet(state);
    const context = state.phase === "success" ? undefined : state.selected;
    const renewal = controller.renewal();
    let note: string;
    if (state.phase === "success") {
      note = purchaseSuccessNote(item, state.selected.offer, state.ownership, state.result);
    } else if (context?.reason) {
      note = context.blocked === "owned" ? `* ${context.reason}。` : `* ${context.reason}，无法兑换。`;
    } else if (renewal) {
      note = `* ${renewal}。|适当娱乐，理性消费。`;
    } else {
      note = "* 要兑换所选道具吗？|兑换后道具将放入车库。适当娱乐，理性消费。";
    }
    // The original "*" label stands before lblAskBuy.
    setText(this.note, note.replace(/^\* /, ""));
    this.note.dataset.text = note.replace("|", "");
    this.note.dataset.warning = String(Boolean(context?.reason));
    setText(this.message, state.message ?? "");
    this.message.dataset.kind = state.phase;
    setText(this.okButton, state.phase === "busy" ? "请稍候…" :
      state.phase === "error" && state.retryable && !state.stale && !state.selected.blocked ? "重试" :
        SHOP_STRINGS.ok);
    this.okButton.disabled = state.phase === "success" ? false : !controller.canConfirm();
    this.cancelButton.hidden = state.phase === "success";
    this.cancelButton.disabled = state.phase === "busy";
    this.closeButton.disabled = state.phase === "busy";
    this.dialog.setAttribute("aria-busy", String(state.phase === "busy"));
    // The combo and 确定 are disabled while busy; give focus back afterwards.
    if (state.phase !== this.renderedPhase && (state.phase === "success" || state.phase === "error"))
      (this.okButton.disabled ? this.cancelButton : this.okButton).focus({ preventScroll: true });
    this.renderedPhase = state.phase;
  }
}

/** A term with its price: "30天 120点券". */
function offerLine(offer: ShopOffer, item: Pick<ShopItem, "isAdditional">): string {
  return `${formatOfferTerm(offer, item)} ${formatAmount(offer.price)}${CURRENCY_LABELS[offer.currency]}`;
}

/** Keep Tab focus inside container. */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  const focusable = [...container.querySelectorAll<HTMLElement>(
    "button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])",
  )].filter(node => !node.hidden && node.offsetParent !== null &&
    !(node instanceof HTMLInputElement && node.type === "radio" && !node.checked));
  if (!focusable.length) { event.preventDefault(); return; }
  const first = focusable[0]!, last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
