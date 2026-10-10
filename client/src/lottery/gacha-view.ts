/**
 * The 精品道具场 (通用扭蛋): the release GachaUseStage (stage_/gachaUse
 * stage_window@zz) as DOM. It uses a lottery item the account holds (any
 * box, gem or gear of lottery.xml) or one an original pack sells: the item
 * name and period on top, 可获得道具 on the left, the drawn items on the
 * right, the mileage (保底) box and bar when the lottery has one, and
 * 1 个使用 / N 个使用 / 兑换 at the bottom. The arrows beside the name and the
 * 选择 button switch between the lotteries (the release's 限量道具 list).
 *
 * The release background is a 3D scene (가챠바탕_1920); its 2D still
 * (통합가챠BG_<size>) stands in for it, and items show the shop's garage
 * snapshots.
 */
import { imageVar, loadLayoutArt, type ShopArt } from "../shop/shop-assets";
import type { ShopNode, ShopRect } from "../shop/shop-original";
import { screenRect, ShopLayout } from "../shop/shop-original";
import { BmlTree, element, setText } from "../shop/shop-widgets";
import { lotteryErrorMessage, type DrawResult, type GachaDetail, type GachaEntry,
  type LotteryItem } from "./lottery-api";
import { findIn, GACHA_ROOTS, isLotteryLibrary, loadLotteryStage, loadStageArt, patch, prune,
  type LotteryStage } from "./lottery-layout";
import { fillString, grantedItems, itemLine, itemsLine, periodLine, stopMessage } from "./lottery-model";
import { dialogButton, LOTTERY_ICON_IMAGES, LotteryPictures, LotteryShell,
  type LotteryScreenOptions } from "./lottery-shell";

/** The most uses of one 精品道具场 request (the server's bound). */
const MAX_USES = 10;
/** Drawn items kept in the right list. */
const HISTORY = 60;
const ICON_ROOTS = ["stage_/treasureHunt", "stage_/mqShop", "stage_/mainMenu", "stage_/common"];
const ARROW_ROOTS = ["stage_/shuffleGacha"];
const ARROW_IMAGES = [1, 2, 3, 4].flatMap(state => [`왼쪽화살_0${state}`, `오른화살_0${state}`]);
const BACKGROUNDS = [["통합가챠BG_1920", 1920, 1080], ["통합가챠BG_1600", 1600, 900], ["통합가챠BG_1400", 1400, 1050]] as const;
/** The num sprite of the use buttons (CharPanel fontStr 0123456789, 16×28 glyphs). */
const GLYPH = { width: 16, height: 28 };

const STYLES = `
.ks-gacha-bg{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform:translate(-50%,-50%);
  background:center/cover no-repeat;pointer-events:none}
.ks-gacha-preview{position:absolute;inset:0}
.ks-gacha-preview .ks-lottery-pic{inset:0}
.ks-gacha-digits{position:absolute;display:flex;pointer-events:none}
.ks-gacha-digit{width:16px;height:28px;background:var(${imageVar("num")}) no-repeat}
.ks-gacha-list{position:absolute;overflow:auto;pointer-events:auto;scrollbar-width:thin}
.ks-gacha-row{position:relative;height:26px;margin:0 0 1px;padding:0 10px;background:var(${imageVar("labelbox_2")}) 0 0/100% 100% no-repeat;
  color:#fff;font-size:15px;line-height:26px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ks-gacha-row[data-notice]{color:#ffd84a}
.ks-gacha-row[data-prize]{color:#7dffb0}
.ks-gacha-summary{position:absolute;overflow:auto;pointer-events:auto;scrollbar-width:thin;color:#edf1f7;font-size:16px;line-height:1.55}
.ks-gacha-summary div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ks-gacha-summary div[data-notice]{color:#ffd84a}
.ks-gacha-arrow{position:absolute;width:30px;height:110px;border:0;background:center/contain no-repeat;pointer-events:auto;cursor:pointer}
.ks-gacha-arrow:hover{filter:brightness(1.25)}
.ks-gacha-select{position:absolute;height:34px;padding:0 16px;border:0;border-radius:17px;pointer-events:auto;cursor:pointer;
  background:rgba(20,40,80,.8);box-shadow:inset 0 0 0 2px #4aa3ff;color:#fff;font:inherit;font-size:16px}
.ks-gacha-select:hover{background:rgba(40,80,150,.9)}
.ks-gacha-key{position:absolute;color:#cfe3ff;font-size:16px;text-align:center;pointer-events:none;white-space:nowrap}
.ks-gacha-mileage-pic{position:absolute;left:104px;top:40px;width:100px;height:100px}
.ks-gacha-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ks-gacha-pick{display:grid;grid-template-columns:64px 1fr;align-items:center;gap:10px;padding:8px;border:0;border-radius:8px;
  background:#fff;box-shadow:inset 0 0 0 1px #c3cfdd;text-align:left;font:inherit;color:#1d3150;cursor:pointer}
.ks-gacha-pick:hover,.ks-gacha-pick[aria-current=true]{box-shadow:inset 0 0 0 2px #2f7fe0}
.ks-gacha-pick-pic{position:relative;width:64px;height:64px;border-radius:6px;background:linear-gradient(#2b4f7d,#18304f)}
.ks-gacha-pick small{display:block;font-weight:400;color:#5c6b82;font-size:13px}
.ks-gacha-get{position:absolute;color:#fff;font-size:22px;text-align:center;pointer-events:none;
  text-shadow:0 0 3px #000,1px 1px 0 #000,-1px -1px 0 #000;animation:ks-gacha-get .5s ease-out both}
@keyframes ks-gacha-get{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.ks-gacha-pop{animation:ks-gacha-pop .45s ease-out both}
@keyframes ks-gacha-pop{0%{transform:scale(.2) rotate(-12deg);opacity:0}70%{transform:scale(1.08)}100%{transform:none;opacity:1}}
`;

/**
 * The 3D panels (background scene, VIP badge) go; the 2D still replaces the
 * scene. The release sizes the name, period and use lines to their text at
 * run time; here they get room for the longest names.
 */
function prepareWindow(window: ShopNode): ShopNode {
  let node = prune(window, child => child.name === "Play1SPanel");
  node = patch(node, "itemName", { leftTopWH: "0 0 760 60" });
  node = patch(node, "itemUsePeriod", { leftTopWH: "0 54 760 30" });
  node = patch(node, "itemUseDesc", { windowSize: "760 30" });
  node = patch(node, "itemBuyDesc", { leftTopWH: "0 4 760 40" });
  node = patch(node, "buyCont", { leftTopWH: "0 -10 760 50" });
  return node;
}

export class GachaView {
  readonly shell: LotteryShell;
  readonly layoutWindow: ShopNode;
  private tree: BmlTree;
  private readonly pictures: LotteryPictures;
  private readonly cleanups = new Map<HTMLElement, () => void>();
  private readonly background = element("div", "ks-gacha-bg");
  private readonly preview = element("div", "ks-gacha-preview");
  private readonly summary = element("div", "ks-gacha-summary");
  private readonly history = element("div", "ks-gacha-list");
  private readonly key = element("div", "ks-gacha-key");
  private readonly got = element("div", "ks-gacha-get");
  private readonly prev = element("button", "ks-gacha-arrow");
  private readonly next = element("button", "ks-gacha-arrow");
  private readonly select = element("button", "ks-gacha-select", "选择扭蛋");
  private readonly oneDigits = element("div", "ks-gacha-digits");
  private readonly multiDigits = element("div", "ks-gacha-digits");
  private entries: GachaEntry[] = [];
  private detail?: GachaDetail;
  private current?: number;
  private obtained = 0;
  private busy = false;

  constructor(readonly options: LotteryScreenOptions, private readonly stage: LotteryStage,
    private readonly initialItem?: number) {
    this.shell = new LotteryShell(options, "精品道具场", () => this.relayout(), () => this.close());
    this.pictures = new LotteryPictures(options);
    this.layoutWindow = prepareWindow(stage.window);
    this.tree = new BmlTree(new ShopLayout(this.layoutWindow, screenRect(this.shell.screen)));
    const style = element("style");
    style.textContent = STYLES;
    this.shell.stage.prepend(style, this.tree.element);
    // Over the release's full-screen black panel, under everything else.
    const black = this.tree.element.firstElementChild;
    if (black) black.after(this.background);
    else this.tree.element.prepend(this.background);
    this.build();
    this.place();
  }

  private el(name: string, parent?: string): HTMLElement | undefined {
    const node = findIn(this.layoutWindow, name, parent);
    return node ? this.tree.elements.get(node) : undefined;
  }

  private rect(name: string, parent?: string): ShopRect | undefined {
    const node = findIn(this.layoutWindow, name, parent);
    return node ? this.tree.layout.rect(node) : undefined;
  }

  private relayout(): void {
    this.tree.relayout(new ShopLayout(this.layoutWindow, screenRect(this.shell.screen)));
    this.place();
  }

  private build(): void {
    const button = (name: string, label: string, onClick: () => void) => {
      const target = this.el(name);
      if (target instanceof HTMLButtonElement) {
        target.setAttribute("aria-label", label);
        target.addEventListener("click", onClick);
      }
      return target;
    };
    button("quitButton", "关闭", () => this.close());
    button("oneUse", "使用1个", () => void this.use(1));
    button("multiUse", "使用多个", () => void this.use(this.multiCount()));
    button("buyButton", "兑换", () => void this.openPacks());
    for (const name of ["limitedFirstItemInfo", "mileagePrizeItemInfo", "mileagePrizeItemListInfo",
      "gachaBoxItemWindow", "itemSummaryInfoVerLimitedGacha", "stopButton", "itemGet", "itemAllUse", "itemNotExist",
      "itemBonusWarning", "itemMileagePrizeConfirmed"]) {
      const target = this.el(name);
      if (target) target.hidden = true;
    }
    const defaultItem = this.el("defaultItemWindow");
    if (defaultItem) defaultItem.hidden = false;
    this.el("itemPreview1", "defaultItemWindow")?.append(this.preview);
    // The multiUse button's own number (multiCountContain) and the oneUse CharPanel show digits from the num sprite.
    for (const [name, digits] of [["oneNum", this.oneDigits], ["multiCount", this.multiDigits]] as const) {
      const panel = this.el(name);
      if (!panel) continue;
      // The CharPanel's texture is the whole digit strip: only the glyphs are drawn.
      panel.classList.remove("ks-tex");
      panel.style.removeProperty("--i0");
      panel.replaceChildren(digits);
    }
    this.prev.type = this.next.type = this.select.type = "button";
    this.prev.setAttribute("aria-label", "上一个扭蛋");
    this.next.setAttribute("aria-label", "下一个扭蛋");
    this.prev.style.backgroundImage = `var(${imageVar("왼쪽화살_01")})`;
    this.next.style.backgroundImage = `var(${imageVar("오른화살_01")})`;
    this.prev.addEventListener("click", () => this.step(-1));
    this.next.addEventListener("click", () => this.step(1));
    this.select.addEventListener("click", () => void this.pick());
    this.got.hidden = true;
    this.tree.element.append(this.summary, this.history, this.key, this.got, this.prev, this.next, this.select);
  }

  /** Places the elements this view adds at their original neighbours' rectangles. */
  private place(): void {
    const at = (target: HTMLElement, rect: ShopRect | undefined, dx = 0, dy = 0, width?: number, height?: number) => {
      if (!rect) return;
      target.style.left = `${rect.x + dx}px`;
      target.style.top = `${rect.y + dy}px`;
      target.style.width = `${width ?? rect.width}px`;
      if (height !== undefined || target !== this.got) target.style.height = `${height ?? rect.height}px`;
    };
    const summary = this.rect("itemSummary", "itemSummaryInfo");
    const box = this.rect("itemSummaryInfo");
    if (summary && box) at(this.summary, summary, 0, 0, box.width - 30, Math.max(60, box.y + box.height - summary.y - 40));
    const list = this.rect("listRewardItems");
    if (list) at(this.history, list);
    const name = this.rect("itemNameInfo");
    if (name) {
      at(this.prev, name, -40, -5, 30, 110);
      at(this.next, name, name.width + 10, -5, 30, 110);
      at(this.select, name, name.width / 2 - 60, name.height + 26, 120, 34);
    }
    const useful = this.rect("itemUseful");
    if (useful) at(this.key, useful, 0, -34, useful.width, 26);
    const preview = this.rect("defaultItemWindow");
    if (preview) at(this.got, preview, -160, preview.height - 20, preview.width + 320);
  }

  private picture(host: HTMLElement, item: Pick<LotteryItem, "category" | "itemId" | "name">): void {
    this.cleanups.get(host)?.();
    this.cleanups.set(host, this.pictures.draw(host, item));
  }

  /** Loads the lottery list (claiming the daily items first) and the first lottery. */
  async load(): Promise<void> {
    try {
      let list = await this.options.api.gachaList();
      if (list.daily.available) {
        try {
          const claim = await this.options.api.claimDaily("gacha");
          this.shell.showNotice(`今日免费扭蛋道具已发放：${claim.items.map(itemLine).join("、")}`);
          list = await this.options.api.gachaList();
          void this.options.session.refresh().catch(() => undefined);
        } catch (error) {
          this.shell.showNotice(lotteryErrorMessage(error));
        }
      }
      if (this.shell.disposed) return;
      this.entries = list.lotteries;
      const first = this.entries.find(entry => entry.itemId === this.initialItem) ?? this.entries[0];
      if (!first) {
        this.shell.showNotice("暂时没有可以使用的扭蛋。", 6_000);
        return;
      }
      await this.show(first.itemId);
    } catch (error) {
      this.shell.showNotice(`精品道具场读取失败：${lotteryErrorMessage(error)}`, 6_000);
    }
  }

  private async show(itemId: number): Promise<void> {
    this.current = itemId;
    try {
      const detail = await this.options.api.gacha(itemId);
      if (this.shell.disposed || this.current !== itemId) return;
      this.render(detail);
    } catch (error) {
      this.shell.showNotice(lotteryErrorMessage(error));
    }
  }

  private step(delta: number): void {
    if (this.busy || this.entries.length < 2) return;
    const index = this.entries.findIndex(entry => entry.itemId === this.current);
    const next = this.entries[(index + delta + this.entries.length) % this.entries.length]!;
    void this.show(next.itemId);
  }

  private async pick(): Promise<void> {
    if (this.busy || this.entries.length === 0) return;
    const cleanups: Array<() => void> = [];
    const chosen = await this.shell.dialog<number | undefined>("选择扭蛋", (body, foot, done) => {
      const grid = element("div", "ks-gacha-picker");
      for (const entry of this.entries) {
        const option = element("button", "ks-gacha-pick");
        option.type = "button";
        if (entry.itemId === this.current) option.setAttribute("aria-current", "true");
        const pic = element("div", "ks-gacha-pick-pic");
        cleanups.push(this.pictures.draw(pic, { category: 24, itemId: entry.itemId, name: entry.name }));
        const label = element("div", undefined, entry.name);
        label.append(element("small", undefined, entry.owned > 0 ? `持有 ${entry.owned} 个` :
          entry.open ? "可兑换" : "未开放"));
        option.append(pic, label);
        option.addEventListener("click", () => done(entry.itemId));
        grid.append(option);
      }
      body.append(grid);
      foot.append(dialogButton("关闭", () => done(undefined), "secondary"));
    }, undefined);
    for (const cleanup of cleanups) cleanup();
    if (chosen !== undefined && chosen !== this.current) await this.show(chosen);
  }

  private render(detail: GachaDetail): void {
    this.detail = detail;
    const strings = this.stage.strings;
    const lottery = detail.lottery;
    const name = this.el("itemName");
    if (name) setText(name, lottery.caption || lottery.name);
    const period = this.el("itemUsePeriod");
    if (period) setText(period, detail.activity.open ? periodLine(detail.activity) : "活动未开放");
    const useful = this.el("itemUseful");
    const effectLines = lottery.effect.split("|").map(line => line.trim()).filter(Boolean);
    if (useful) setText(useful, effectLines.find(line => line.includes("获得")) ??
      (lottery.sets > 1 ? `可同时获得${lottery.sets}种道具` : "可获得构成道具中的1种"));
    this.picture(this.preview, { category: 24, itemId: lottery.itemId, name: lottery.name });
    this.preview.classList.remove("ks-gacha-pop");
    this.got.hidden = true;

    this.summary.replaceChildren(...detail.summary.map(row => {
      const line = element("div", undefined, itemsLine(row.items));
      if (row.notice) line.dataset.notice = "true";
      return line;
    }));
    const more = this.el("getItemDesc", "itemSummaryInfo");
    if (more) more.hidden = detail.summary.length >= lottery.rewards;
    this.summary.title = `共 ${lottery.rewards} 种道具` + (lottery.sets > 1 ? `，每次从 ${lottery.sets} 个奖池各获得 1 种` : "");

    const keyName = detail.key?.name;
    const useDesc = this.el("itemUseDesc");
    if (useDesc) setText(useDesc, keyName
      ? fillString(strings.get("itemUseDesc_needOther") ?? "使用时消耗1个%s和%s。", lottery.name, keyName)
      : fillString(strings.get("itemUseDesc") ?? "使用时%s消耗1个。", lottery.name));
    this.key.textContent = `持有 ${lottery.name} ${detail.owned} 个` +
      (detail.key ? `　${detail.key.name} ${detail.key.owned} 个` : "");
    const buyDesc = this.el("itemBuyDesc");
    if (buyDesc) setText(buyDesc, detail.packs.length > 0
      ? fillString(strings.get("itemBuyDesc") ?? "通过兑换按钮进行%s的兑换。", lottery.name) : "");
    const buy = this.el("buyButton");
    if (buy) buy.hidden = detail.packs.length === 0;
    this.renderMileage(detail);
    this.renderButtons();
    const single = this.entries.length < 2;
    this.prev.hidden = this.next.hidden = single;
  }

  private renderMileage(detail: GachaDetail): void {
    const mileage = detail.mileage;
    const box = this.el("mileagePrizeItemInfo");
    const bar = this.el("mileagePrizeItemListInfo");
    if (box) box.hidden = !mileage;
    if (bar) bar.hidden = !mileage;
    if (!mileage) return;
    const strings = this.stage.strings;
    const next = mileage.prizes.find(prize => prize.points > mileage.points) ?? mileage.prizes.at(-1)!;
    const last = mileage.prizes.at(-1)!;
    const prizeName = this.el("prizeItemName");
    if (prizeName) setText(prizeName, itemsLine(next.items));
    const info = this.el("prizeInfo", "mileagePrizeItemInfo");
    if (info) setText(info, mileage.event ? "[活动]道具不累计保底次数"
      : fillString(strings.get("prizeInfoString") ?? "%d次以内必得", next.points - mileage.points));
    if (box) {
      let pic = box.querySelector<HTMLElement>(":scope > .ks-gacha-mileage-pic");
      if (!pic) {
        pic = element("div", "ks-gacha-mileage-pic");
        box.append(pic);
      }
      if (next.items[0]) this.picture(pic, next.items[0]);
    }
    const barInfo = this.el("prizeInfo", "mileagePrizeItemListInfo");
    if (barInfo) setText(barInfo, fillString(strings.get("prizeInfoStringNew") ?? "剩余%d次", next.points - mileage.points));
    const fill = this.el("mileageBar");
    if (fill) {
      fill.hidden = false;
      fill.style.width = `${Math.round(356 * Math.min(1, mileage.points / last.points))}px`;
    }
  }

  private multiCount(): number {
    const detail = this.detail;
    if (!detail) return 1;
    const limit = detail.key ? Math.min(detail.owned, detail.key.owned) : detail.owned;
    return Math.max(1, Math.min(MAX_USES, limit));
  }

  private digits(host: HTMLElement, value: number): void {
    host.replaceChildren(...String(value).split("").map(digit => {
      const glyph = element("div", "ks-gacha-digit");
      glyph.style.backgroundPosition = `-${Number(digit) * GLYPH.width}px 0`;
      return glyph;
    }));
  }

  private renderButtons(): void {
    const detail = this.detail;
    const open = !!detail?.activity.open;
    this.digits(this.oneDigits, 1);
    const one = this.el("oneNum");
    if (one) {
      one.style.width = `${GLYPH.width}px`;
      one.style.height = `${GLYPH.height}px`;
      one.style.top = "19px";
    }
    const count = this.multiCount();
    this.digits(this.multiDigits, count);
    // The multiUse button: number, 个, 使用 side by side in its middle (the release lays them out at run time).
    const parts = [this.el("multiCount"), this.el("multiCountPanel"), this.el("multiDefaultPanel")];
    const widths = [String(count).length * GLYPH.width, 26, 50];
    const total = widths.reduce((sum, width) => sum + width, 0) + 8;
    let x = Math.round((258 - total) / 2);
    parts.forEach((part, index) => {
      if (!part) return;
      part.style.left = `${x}px`;
      part.style.top = "19px";
      part.style.width = `${widths[index]}px`;
      part.style.height = "28px";
      x += widths[index]! + 4;
    });
    for (const name of ["oneUse", "multiUse"]) {
      const target = this.el(name);
      if (target instanceof HTMLButtonElement) {
        target.disabled = this.busy;
        target.setAttribute("aria-disabled", String(!open));
      }
    }
  }

  private async openPacks(): Promise<void> {
    const detail = this.detail;
    if (!detail || this.busy) return;
    const bought = await this.shell.packs(detail.packs, this.pictures, () => { /* reloaded below */ });
    if (bought && this.current !== undefined) await this.refreshList(this.current);
  }

  private async refreshList(itemId: number): Promise<void> {
    try {
      this.entries = (await this.options.api.gachaList()).lotteries;
    } catch { /* Keep the old list. */ }
    await this.show(itemId);
  }

  private async use(count: number): Promise<void> {
    const detail = this.detail;
    if (!detail || this.busy || this.shell.dialogOpen) return;
    if (!detail.activity.open) {
      this.shell.showNotice(lotteryErrorMessage("LOTTERY_CLOSED"));
      return;
    }
    const missing = detail.owned < 1 ? detail.lottery.name : detail.key && detail.key.owned < 1 ? detail.key.name : undefined;
    if (missing) {
      const message = `${missing}持有数量不足，无法使用。` + (detail.packs.length > 0 ? "\n要打开兑换吗？" : "");
      if (detail.packs.length > 0 && await this.shell.confirm("提示", message, "兑换")) await this.openPacks();
      else if (detail.packs.length === 0) this.shell.showNotice(message);
      return;
    }
    this.busy = true;
    this.renderButtons();
    try {
      const result = await this.options.api.gachaDraw(detail.lottery.itemId, count);
      if (this.shell.disposed) return;
      this.showResult(result);
      void this.options.session.refresh().catch(() => undefined);
      const stopped = stopMessage(result);
      if (stopped) this.shell.showNotice(stopped);
      this.entries = (await this.options.api.gachaList().catch(() => undefined))?.lotteries ?? this.entries;
      const fresh = await this.options.api.gacha(detail.lottery.itemId);
      if (!this.shell.disposed && this.current === fresh.lottery.itemId) {
        this.busy = false;
        this.render(fresh);
        this.showLast(result);
      }
    } catch (error) {
      this.shell.showNotice(lotteryErrorMessage(error));
    } finally {
      this.busy = false;
      this.renderButtons();
    }
  }

  /** Adds the drawn items to the right list and announces premium wins and prizes. */
  private showResult(result: DrawResult): void {
    const rows: HTMLElement[] = [];
    for (const draw of result.draws) {
      for (const item of draw.items) {
        const row = element("div", "ks-gacha-row", `获得 ${itemLine(item)}`);
        if (draw.notice) row.dataset.notice = "true";
        rows.push(row);
        this.obtained++;
      }
    }
    for (const prize of result.prizes) {
      for (const item of prize.items) {
        const row = element("div", "ks-gacha-row", `保底 ${itemLine(item)}`);
        row.dataset.prize = "true";
        rows.push(row);
      }
    }
    this.history.prepend(...rows.reverse());
    while (this.history.childElementCount > HISTORY) this.history.lastElementChild?.remove();
    const count = this.el("getItemCount");
    if (count) setText(count, fillString(this.stage.strings.get("getItemCount") ?? "已获得%d个道具", this.obtained));
    if (result.draws.some(draw => draw.notice))
      this.shell.showNotice(`恭喜你！获得了精品道具：${itemsLine(result.draws.filter(draw => draw.notice).flatMap(draw => draw.items))}`);
    if (result.prizes.length > 0)
      this.shell.showNotice(`保底奖励：${itemsLine(result.prizes.flatMap(prize => prize.items))}`);
  }

  /** The last drawn item in the middle with 获得…！ */
  private showLast(result: DrawResult): void {
    const items = grantedItems(result);
    const last = items.at(-1);
    if (!last) return;
    this.picture(this.preview, last);
    this.preview.classList.remove("ks-gacha-pop");
    void this.preview.offsetWidth;
    this.preview.classList.add("ks-gacha-pop");
    const template = this.stage.strings.get("getItem") ?? "获得%s！";
    this.got.textContent = result.draws.length > 1
      ? `${fillString(template, itemLine(last))}（共 ${result.draws.length} 次）` : fillString(template, itemsLine(result.draws[0]?.items ?? [last]));
    this.got.hidden = false;
  }

  close(): void {
    if (this.shell.disposed) return;
    this.dispose();
    this.options.onClose();
  }

  dispose(): void {
    for (const cleanup of this.cleanups.values()) cleanup();
    this.cleanups.clear();
    this.shell.dispose();
  }

  /** Picks the 2D still nearest the screen's aspect. */
  backgroundImage(): string {
    const aspect = this.shell.screen.width / this.shell.screen.height;
    const [name] = [...BACKGROUNDS].sort((a, b) => Math.abs(a[1] / a[2] - aspect) - Math.abs(b[1] / b[2] - aspect))[0]!;
    return name;
  }

  setBackground(): void {
    this.background.style.backgroundImage = `var(${imageVar(this.backgroundImage())})`;
  }
}

/** Opens the 精品道具场 over root, on itemId when given. */
export async function openGacha(options: LotteryScreenOptions, itemId?: number): Promise<{ close(): void }> {
  const library = options.library;
  if (!isLotteryLibrary(library)) throw new Error("精品道具场缺少原版资源库。");
  const stage = await loadLotteryStage(library, GACHA_ROOTS, "stage_window@zz");
  const view = new GachaView(options, stage, itemId);
  view.shell.mount();
  view.setBackground();
  const apply = (pending: Promise<ShopArt>) => void pending
    .then(art => { if (!view.shell.disposed) view.shell.applyArt(art); }).catch(() => undefined);
  apply(loadStageArt(library, GACHA_ROOTS, [view.layoutWindow], [...BACKGROUNDS.map(([name]) => name), "num", "labelbox_2"]));
  apply(loadLayoutArt(library, ICON_ROOTS, LOTTERY_ICON_IMAGES));
  apply(loadLayoutArt(library, ARROW_ROOTS, ARROW_IMAGES));
  void view.load();
  return { close: () => view.dispose() };
}

