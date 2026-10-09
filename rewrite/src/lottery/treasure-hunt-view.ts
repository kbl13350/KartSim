/**
 * The 寻宝 (treasure hunt) screen: the release RouletteStage
 * (stage_/treasureHunt stage_window@zz) as DOM. Nine board slots show the
 * table's summary rewards in their rarity art and the tenth the 神秘魔方 (the
 * rest of the pool); the left column lists the 保底 rewards with the draws
 * left; the bar at the top right counts the 寻宝放大镜 and 幸运藏宝图. 1 个使用,
 * 10 个使用 and 10 个使用(连续) draw on the data service (server-go
 * LOTTERY.md 3); 兑换 sells the original material packs; the daily free
 * materials are claimed when the screen opens.
 *
 * The release draws its slot effects and the item models with 3D scenes
 * (Play1SPanel); here the slots light up in turn and items show the shop's
 * garage snapshots over the 2D effect art (아이템출현광원_<rarity>).
 */
import type { ShopNode, ShopRect } from "../shop/shop-original";
import { attr, screenRect, ShopLayout } from "../shop/shop-original";
import { imageVar } from "../shop/shop-assets";
import { BmlTree, element, setText } from "../shop/shop-widgets";
import { lotteryErrorMessage, type DrawResult, type HuntSlot, type LotteryDraw,
  type TreasureHuntState } from "./lottery-api";
import { findIn, isLotteryLibrary, loadLotteryStage, loadStageArt, prune, TREASURE_ROOTS,
  type LotteryStage } from "./lottery-layout";
import { chanceText, fillString, itemLine, itemsLine, stopMessage } from "./lottery-model";
import { LOTTERY_ICON_IMAGES, LotteryPictures, LotteryShell, nameLabel, RARITY_EFFECTS,
  type LotteryScreenOptions } from "./lottery-shell";
import { loadLayoutArt } from "../shop/shop-assets";

const SLOT_COUNT = 10;
const PITY_CARDS = 5;
const RARITIES = ["normal", "rare", "epic", "unique", "legend", "special", "ultimate"] as const;
/** How long the board lights up before the result (unless 跳过动画). */
const SPIN_MS = 1_400;
/** Pause between rounds of 10 个使用(连续). */
const AUTO_PAUSE_MS = 1_600;
const SKIP_KEY = "kartsim.treasureHunt.skipAnimation";
const ICON_ROOTS = ["stage_/treasureHunt", "stage_/mqShop", "stage_/mainMenu", "stage_/common"];

/** Effect art drawn instead of the release's 3D scenes. */
const EFFECT_IMAGES = [
  ...Object.values(RARITY_EFFECTS).map(name => `아이템출현광원_${name}`),
  "확정아이템획득_bg", "확정아이템획득_링", "newgacha_slot_epic", "newgacha_LeftSlot_epic",
];

const STYLES = `
.ks-hunt-slot-light{position:absolute;inset:-6%;border-radius:50%;pointer-events:none;opacity:0;
  box-shadow:0 0 30px 12px #fff6a8,inset 0 0 26px 8px #fff6a8;transition:opacity .12s}
.ks-hunt-slot-light[data-on]{opacity:1}
.ks-hunt-slot-pic{position:absolute;left:24%;top:20%;width:52%;height:52%}
.ks-hunt-card-pic{position:absolute;left:62px;top:34px;width:90px;height:90px}
.ks-hunt-popup{position:absolute;inset:0;pointer-events:auto;cursor:pointer}
.ks-hunt-cell{position:absolute;width:120px;height:150px}
.ks-hunt-cell-glow{position:absolute;left:-40px;top:-40px;width:200px;height:200px;background:center/contain no-repeat;
  animation:ks-hunt-pop .35s ease-out both}
.ks-hunt-cell-pic{position:absolute;left:13px;top:13px;width:94px;height:94px;animation:ks-hunt-pop .35s ease-out both}
.ks-hunt-cell[data-pity] .ks-hunt-cell-glow{filter:hue-rotate(-20deg) brightness(1.2)}
.ks-hunt-single{position:absolute;width:250px;height:250px}
.ks-hunt-single-glow{position:absolute;left:-90px;top:-90px;width:430px;height:430px;background:center/contain no-repeat;
  animation:ks-hunt-pop .4s ease-out both}
.ks-hunt-fixed-bg,.ks-hunt-fixed-ring{position:absolute;inset:-56px;background:center/contain no-repeat}
.ks-hunt-fixed-ring{animation:ks-hunt-spin 6s linear infinite}
@keyframes ks-hunt-pop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
@keyframes ks-hunt-spin{to{transform:rotate(360deg)}}
.ks-hunt-check[aria-pressed=true]{background-image:var(${imageVar("newgacha_check_04")})!important}
.ks-hunt-closed{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:18px 40px;border-radius:12px;
  background:rgba(0,0,0,.7);color:#fff;font-size:30px;pointer-events:none}
`;

function storedSkip(): boolean {
  try { return localStorage.getItem(SKIP_KEY) === "1"; } catch { return false; }
}

function storeSkip(skip: boolean): void {
  try { localStorage.setItem(SKIP_KEY, skip ? "1" : "0"); } catch { /* Not remembered. */ }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * The zz board has no epic panels (the newer theme layouts add them): an
 * epic panel joins every slot and 保底 card, after the copied normal one.
 */
function withEpic(children: ShopNode[]): ShopNode[] {
  if (children.some(child => attr(child, "name") === "epic")) return children;
  const normal = children.findIndex(child => attr(child, "name") === "normal" && child.name === "Panel");
  if (normal < 0) return children;
  const source = children[normal]!;
  const texture = (attr(source, "texture") ?? "").replace(/_normal$/, "_epic");
  const epic: ShopNode = { ...source, attributes: [...source.attributes.filter(entry =>
    entry.name !== "name" && entry.name !== "texture" && entry.name !== "visible"),
  { name: "name", value: "epic" }, { name: "texture", value: texture }, { name: "visible", value: "false" }] };
  return [...children.slice(0, normal + 1), epic, ...children.slice(normal + 1)];
}

/** The release's ImageCheckButton (跳过动画) as an ImageButton with its check states. */
function prepareWindow(window: ShopNode): ShopNode {
  const visit = (node: ShopNode): ShopNode => {
    let next: ShopNode = { ...node, children: withEpic(node.children) };
    if (node.name === "ImageCheckButton") {
      next = { ...next, name: "ImageButton", attributes: [...node.attributes.filter(entry => entry.name !== "autoImage"),
        { name: "autoLoadImage", value: attr(node, "autoImage") ?? "newgacha_check_0" }] };
    }
    if (attr(node, "name") === "buyButton") {
      // 兑换 is always offered (the release shows it once a material runs out).
      next = { ...next, attributes: next.attributes.filter(entry => entry.name !== "visible") };
    }
    return { ...next, children: next.children.map(visit) };
  };
  return visit(prune(window, child => child.name === "Play1SPanel"));
}

export class TreasureHuntView {
  readonly shell: LotteryShell;
  readonly layoutWindow: ShopNode;
  private tree: BmlTree;
  private readonly pictures: LotteryPictures;
  private readonly cleanups = new Map<HTMLElement, () => void>();
  private readonly lights: HTMLElement[] = [];
  private state?: TreasureHuntState;
  private busy = false;
  private auto = false;
  private stopRequested = false;
  private skip = storedSkip();
  private popupDone?: () => void;
  private readonly closedNote = element("div", "ks-hunt-closed", "活动当前未开放");

  constructor(readonly options: LotteryScreenOptions, private readonly stage: LotteryStage) {
    this.shell = new LotteryShell(options, "寻宝活动", () => this.relayout(), () => this.close());
    this.pictures = new LotteryPictures(options);
    this.layoutWindow = prepareWindow(stage.window);
    this.tree = new BmlTree(new ShopLayout(this.layoutWindow, screenRect(this.shell.screen)));
    const style = element("style");
    style.textContent = STYLES;
    this.closedNote.hidden = true;
    this.shell.stage.prepend(style, this.tree.element);
    this.shell.stage.append(this.closedNote);
    this.build();
  }

  private el(name: string, parent?: string): HTMLElement | undefined {
    const node = findIn(this.layoutWindow, name, parent);
    return node ? this.tree.elements.get(node) : undefined;
  }

  private relayout(): void {
    this.tree.relayout(new ShopLayout(this.layoutWindow, screenRect(this.shell.screen)));
  }

  private rect(name: string, parent?: string): ShopRect | undefined {
    const node = findIn(this.layoutWindow, name, parent);
    return node ? this.tree.layout.rect(node) : undefined;
  }

  private build(): void {
    const button = (name: string, onClick: () => void) => {
      const target = this.el(name);
      if (target instanceof HTMLButtonElement) target.addEventListener("click", onClick);
      return target;
    };
    button("quitButton", () => this.close())?.setAttribute("aria-label", "关闭");
    button("oneUse", () => void this.draw(1))?.setAttribute("aria-label", "1个使用");
    button("multiUse", () => void this.draw(10))?.setAttribute("aria-label", "10个使用");
    button("multiAutoUse", () => void this.drawAuto())?.setAttribute("aria-label", "10个使用（连续）");
    button("buyButton", () => void this.openPacks())?.setAttribute("aria-label", "兑换");
    button("stopAutoButton", () => { this.stopRequested = true; })?.setAttribute("aria-label", "停止连抽");
    const info = this.el("itemInfo");
    if (info) info.title = (this.stage.strings.get("requiredItemDesc") ?? "").replaceAll("|", "\n");
    const check = button("animationSkipButton", () => {
      this.skip = !this.skip;
      storeSkip(this.skip);
      check?.setAttribute("aria-pressed", String(this.skip));
    });
    if (check) {
      check.classList.add("ks-hunt-check");
      check.setAttribute("aria-label", "跳过动画");
      check.setAttribute("aria-pressed", String(this.skip));
    }
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const host = this.el(`summarySlot${slot}`);
      if (!host) continue;
      const light = element("div", "ks-hunt-slot-light");
      host.append(light);
      this.lights.push(light);
    }
    for (const name of ["rewardBg", "singleReward", "multiReward", "fixedReward"]) {
      const popup = this.el(name);
      if (popup) popup.hidden = true;
    }
  }

  /** Loads the board; claims the daily materials first when they are waiting. */
  async load(): Promise<void> {
    try {
      let state = await this.options.api.treasureHunt();
      if (state.daily.available) {
        try {
          const claim = await this.options.api.claimDaily("treasureHunt");
          this.shell.showNotice(`今日免费寻宝道具已发放：${claim.items.map(itemLine).join("、")}`);
          state = await this.options.api.treasureHunt();
          void this.options.session.refresh().catch(() => undefined);
        } catch (error) {
          this.shell.showNotice(lotteryErrorMessage(error));
        }
      }
      if (this.shell.disposed) return;
      this.render(state);
    } catch (error) {
      this.shell.showNotice(`寻宝读取失败：${lotteryErrorMessage(error)}`, 6_000);
    }
  }

  private picture(host: HTMLElement, item: Parameters<LotteryPictures["draw"]>[1]): void {
    this.cleanups.get(host)?.();
    this.cleanups.set(host, this.pictures.draw(host, item));
  }

  private slotPicture(slotHost: HTMLElement, key: string): HTMLElement {
    let pic = slotHost.querySelector<HTMLElement>(`:scope > .ks-hunt-slot-pic[data-key="${key}"]`);
    if (!pic) {
      slotHost.querySelectorAll(":scope > .ks-hunt-slot-pic, :scope > .ks-lottery-name").forEach(old => old.remove());
      pic = element("div", "ks-hunt-slot-pic");
      pic.dataset.key = key;
      slotHost.append(pic);
    }
    return pic;
  }

  private render(state: TreasureHuntState): void {
    this.state = state;
    this.closedNote.hidden = state.activity.open;
    const slots = new Map(state.slots.map(slot => [slot.slot, slot]));
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const host = this.el(`summarySlot${slot}`);
      if (!host) continue;
      const reward = slots.get(slot);
      const rarity = slot === SLOT_COUNT ? "normal" : reward?.rarity ?? "normal";
      for (const kind of RARITIES) {
        const panel = this.el(kind, `summarySlot${slot}`);
        if (panel) panel.hidden = kind !== rarity;
      }
      if (slot === SLOT_COUNT) {
        const pic = this.slotPicture(host, "cube");
        if (!pic.firstChild) {
          pic.classList.add("ks-lottery-pic");
          pic.append(element("div", "ks-lottery-cube"));
          host.append(nameLabel(this.stage.strings.get("treasureHuntMysticCube") ?? "寻宝神秘魔方", 150));
        }
        host.title = `${(this.stage.strings.get("treasureHuntMysticCube_tooltip") ?? "").replaceAll("|", "\n")}\n` +
          `共 ${state.others.rewards} 种道具，合计概率 ${chanceText(state.others.chance)}`;
        continue;
      }
      if (!reward) continue;
      const item = reward.items[0];
      const pic = this.slotPicture(host, String(reward.stockId));
      if (item && !pic.hasChildNodes()) {
        this.picture(pic, item);
        host.append(nameLabel(item.name, 150));
      }
      host.title = `${itemsLine(reward.items)}\n概率 ${chanceText(reward.chance)}` +
        (reward.acquireCount ? `\n${reward.acquireCount}次以内必得（还需${reward.remaining}次）` : "");
    }
    this.renderPity(state.slots);
    this.renderMaterials(state);
  }

  private renderPity(slots: readonly HuntSlot[]): void {
    const pity = slots.filter(slot => slot.acquireCount).sort((a, b) => a.slot - b.slot);
    const template = this.stage.strings.get("chanceCount") ?? "%d次以内可获得";
    for (let index = 1; index <= PITY_CARDS; index++) {
      const card = this.el(`rewardStockCard${index}`);
      if (!card) continue;
      const slot = pity[index - 1];
      card.hidden = !slot;
      if (!slot) continue;
      for (const kind of RARITIES) {
        const panel = this.el(kind, `rewardStockCard${index}`);
        if (panel) panel.hidden = kind !== slot.rarity;
      }
      const name = this.el("stockName", `rewardStockCard${index}`);
      if (name) setText(name, slot.items[0]?.name ?? "");
      const count = this.el("chanceCount", `rewardStockCard${index}`);
      if (count) setText(count, fillString(template, slot.remaining ?? slot.acquireCount ?? 0));
      let pic = card.querySelector<HTMLElement>(":scope > .ks-hunt-card-pic");
      if (!pic) {
        pic = element("div", "ks-hunt-card-pic");
        card.append(pic);
      }
      if (pic.dataset.key !== String(slot.stockId) && slot.items[0]) {
        pic.dataset.key = String(slot.stockId);
        this.picture(pic, slot.items[0]);
      }
      card.title = `${itemsLine(slot.items)}\n${slot.acquireCount}次以内必得，还需${slot.remaining}次\n` +
        "使用[活动]放大镜不累计保底次数";
    }
  }

  private magnifiers(state = this.state): number {
    if (!state) return 0;
    return state.materials.material.owned + (state.materials.eventMaterial?.owned ?? 0);
  }

  private renderMaterials(state: TreasureHuntState): void {
    const count = this.stage.strings.get("count") ?? "%d 个";
    const magnifiers = this.magnifiers(state);
    const maps = state.materials.other.owned;
    const material = this.el("materialCount");
    if (material) setText(material, fillString(count, magnifiers));
    const other = this.el("needOtherCount");
    if (other) setText(other, fillString(count, maps));
    const icon = this.el("materialImg");
    if (icon) icon.title = `${state.materials.material.name} ${state.materials.material.owned} 个` +
      (state.materials.eventMaterial ? `\n${state.materials.eventMaterial.name} ${state.materials.eventMaterial.owned} 个（优先使用，不累计保底）` : "");
    const otherIcon = this.el("otherMaterialImg");
    if (otherIcon) otherIcon.title = `${state.materials.other.name} ${maps} 个`;
    const available = this.el("availableCount");
    if (available) setText(available, fillString(this.stage.strings.get("availableCount") ?? "可使用%d次",
      Math.min(magnifiers, maps)));
    const guide = this.el("rouletteGuide");
    if (guide) setText(guide, fillString(this.stage.strings.get("rouletteGuide_1") ?? "",
      state.materials.material.name, state.materials.other.name));
    this.updateButtons();
  }

  private updateButtons(): void {
    const open = !!this.state?.activity.open;
    for (const name of ["oneUse", "multiUse", "multiAutoUse"]) {
      const target = this.el(name);
      if (target instanceof HTMLButtonElement) {
        target.disabled = this.busy;
        target.setAttribute("aria-disabled", String(!open));
      }
    }
  }

  /** Materials for one draw, or the buy prompt. */
  private async ready(): Promise<boolean> {
    const state = this.state;
    if (!state) return false;
    if (!state.activity.open) {
      this.shell.showNotice(lotteryErrorMessage("LOTTERY_CLOSED"));
      return false;
    }
    const missing = this.magnifiers() < 1 ? state.materials.material
      : state.materials.other.owned < 1 ? state.materials.other : undefined;
    if (!missing) return true;
    const message = [fillString(this.stage.strings.get("mileageAlertDlgMsg1") ?? "%s持有数量不足。", missing.name),
      "要打开兑换吗？"].join("\n");
    if (await this.shell.confirm("提示", message, "兑换")) await this.openPacks();
    return false;
  }

  private async openPacks(): Promise<void> {
    const state = this.state;
    if (!state || this.busy) return;
    const bought = await this.shell.packs(state.packs, this.pictures, () => { /* reloaded below */ });
    if (bought) await this.reload();
  }

  private async reload(): Promise<void> {
    try {
      this.render(await this.options.api.treasureHunt());
    } catch (error) {
      this.shell.showNotice(lotteryErrorMessage(error));
    }
  }

  private async spin(): Promise<void> {
    const lights = this.lights;
    if (this.skip || lights.length === 0) return;
    const started = performance.now();
    let index = 0;
    while (performance.now() - started < SPIN_MS && !this.shell.disposed) {
      lights.forEach((light, at) => light.toggleAttribute("data-on", at === index % lights.length));
      index += 1 + Math.floor(Math.random() * 3);
      await wait(70 + (performance.now() - started) / 12);
    }
    lights.forEach(light => light.removeAttribute("data-on"));
  }

  /** Applies a result's counts and 保底 progress to the screen. */
  private apply(result: DrawResult): void {
    const state = this.state;
    if (!state) return;
    const owned = (ref: { category: number; itemId: number; owned: number }) => {
      const value = result.holdings.get(`${ref.category}:${ref.itemId}`);
      if (value !== undefined) ref.owned = value;
    };
    owned(state.materials.material);
    owned(state.materials.other);
    if (state.materials.eventMaterial) owned(state.materials.eventMaterial);
    if (result.slots) state.slots = result.slots;
    this.render(state);
    void this.options.session.refresh().catch(() => undefined);
  }

  private async draw(count: 1 | 10, fromAuto = false): Promise<DrawResult | undefined> {
    if ((this.busy && !fromAuto) || this.shell.disposed || this.shell.dialogOpen) return undefined;
    if (!(await this.ready())) return undefined;
    this.busy = true;
    this.updateButtons();
    try {
      const [result] = await Promise.all([this.options.api.treasureDraw(count), this.spin()]);
      if (this.shell.disposed) return result;
      this.apply(result);
      if (result.draws.length > 0) await this.showResult(result, count, fromAuto);
      const stopped = stopMessage(result);
      if (stopped) this.shell.showNotice(stopped);
      return result;
    } catch (error) {
      this.shell.showNotice(lotteryErrorMessage(error));
      return undefined;
    } finally {
      this.busy = false;
      this.updateButtons();
    }
  }

  /** 10 个使用(连续): rounds of ten until stopped, out of materials or interrupted. */
  private async drawAuto(): Promise<void> {
    if (this.busy || this.auto) return;
    this.auto = true;
    this.stopRequested = false;
    try {
      for (;;) {
        const result = await this.draw(10, true);
        if (!result || result.stopped || result.draws.length < 10 || this.stopRequested || this.shell.disposed) break;
        await wait(AUTO_PAUSE_MS);
        if (this.stopRequested || this.shell.disposed) break;
      }
    } finally {
      // The last round's results stay until dismissed.
      this.auto = false;
      this.hideStop();
    }
  }

  private hideStop(): void {
    const stop = this.el("stopAutoButton");
    if (stop) stop.hidden = true;
  }

  private closePopup(): void {
    this.popupDone?.();
  }

  /**
   * The result window: the 保底 grant (fixedReward), one draw (singleReward)
   * or ten (multiReward over newgachaPopupBg). Resolves when dismissed, or at
   * once during 连续 (the next round replaces it).
   */
  private showResult(result: DrawResult, count: number, auto: boolean): Promise<void> {
    this.closePopup();
    const background = this.el("rewardBg");
    const fixed = result.draws.find(draw => draw.pity);
    const names = { single: this.el("singleReward"), multi: this.el("multiReward"), fixed: this.el("fixedReward") };
    const kind = fixed && !auto ? "fixed" : count === 1 ? "single" : "multi";
    const popup = names[kind];
    if (!popup) return Promise.resolve();
    const layer = element("div", "ks-hunt-popup");
    const built: HTMLElement[] = [];
    if (kind === "single") this.buildSingle(result.draws[0]!, built);
    else if (kind === "fixed") this.buildFixed(fixed!, built);
    else this.buildMulti(result.draws, built);
    popup.append(...built, layer);
    if (background) background.hidden = false;
    popup.hidden = false;
    const stop = this.el("stopAutoButton");
    if (stop) stop.hidden = !auto;
    return new Promise<void>(resolve => {
      const done = () => {
        if (this.popupDone !== done) return;
        this.popupDone = undefined;
        layer.remove();
        for (const node of built) {
          node.querySelectorAll<HTMLElement>(".ks-lottery-pic").forEach(pic => {
            this.cleanups.get(pic)?.();
            this.cleanups.delete(pic);
          });
          node.remove();
        }
        popup.hidden = true;
        if (background) background.hidden = true;
        resolve();
      };
      this.popupDone = done;
      layer.addEventListener("click", done);
      const confirm = this.el("fixedRewardConfirmButton");
      if (kind === "fixed" && confirm) confirm.addEventListener("click", done, { once: true });
      if (auto) resolve(); // the popup stays until the next round or the end
    });
  }

  private glow(rarity: string | undefined): string {
    return `var(${imageVar(`아이템출현광원_${RARITY_EFFECTS[rarity ?? "normal"] ?? "일반"}`)})`;
  }

  private buildSingle(draw: LotteryDraw, built: HTMLElement[]): void {
    const rect = this.rect("itemPanel", "singleReward");
    const cell = element("div", "ks-hunt-single");
    const base = this.rect("singleReward");
    if (rect && base) {
      cell.style.left = `${rect.x - base.x}px`;
      cell.style.top = `${rect.y - base.y}px`;
    }
    const glow = element("div", "ks-hunt-single-glow");
    glow.style.backgroundImage = this.glow(draw.rarity);
    const pic = element("div", "ks-lottery-pic");
    pic.style.inset = "18%";
    if (draw.items[0]) this.picture(pic, draw.items[0]);
    cell.append(glow, pic, nameLabel(itemsLine(draw.items), 270));
    built.push(cell);
  }

  private buildFixed(draw: LotteryDraw, built: HTMLElement[]): void {
    const base = this.rect("fixedReward");
    const cell = element("div", "ks-hunt-single");
    if (base) {
      cell.style.left = `${Math.round(base.width / 2 - 125)}px`;
      cell.style.top = `${Math.round(base.height / 2 - 185)}px`;
    }
    const bg = element("div", "ks-hunt-fixed-bg");
    bg.style.backgroundImage = `var(${imageVar("확정아이템획득_bg")})`;
    const ring = element("div", "ks-hunt-fixed-ring");
    ring.style.backgroundImage = `var(${imageVar("확정아이템획득_링")})`;
    const pic = element("div", "ks-lottery-pic");
    pic.style.inset = "16%";
    if (draw.items[0]) this.picture(pic, draw.items[0]);
    cell.append(bg, ring, pic, nameLabel(`保底获得：${itemsLine(draw.items)}`, 300));
    built.push(cell);
  }

  private buildMulti(draws: readonly LotteryDraw[], built: HTMLElement[]): void {
    const list = this.rect("rewardList", "multiReward");
    const base = this.rect("multiReward");
    if (!list || !base) return;
    const gap = 140;
    const perRow = Math.min(draws.length, 10);
    const left = list.x - base.x + list.width / 2 - (perRow * gap - 20) / 2;
    const top = list.y - base.y + list.height / 2 - 75;
    draws.forEach((draw, index) => {
      const cell = element("div", "ks-hunt-cell");
      cell.style.left = `${Math.round(left + (index % perRow) * gap)}px`;
      cell.style.top = `${Math.round(top + Math.floor(index / perRow) * 170)}px`;
      cell.style.animationDelay = `${index * 60}ms`;
      if (draw.pity) cell.dataset.pity = "true";
      const glow = element("div", "ks-hunt-cell-glow");
      glow.style.backgroundImage = this.glow(draw.rarity);
      glow.style.animationDelay = `${index * 60}ms`;
      const pic = element("div", "ks-hunt-cell-pic ks-lottery-pic");
      pic.style.animationDelay = `${index * 60}ms`;
      if (draw.items[0]) this.picture(pic, draw.items[0]);
      cell.title = itemsLine(draw.items) + (draw.pity ? "（保底）" : "") + (draw.event ? "\n使用了[活动]放大镜" : "");
      cell.append(glow, pic, nameLabel(draw.items[0] ? itemLine(draw.items[0]) : "", 118));
      built.push(cell);
    });
  }

  close(): void {
    if (this.shell.disposed) return;
    this.stopRequested = true;
    this.dispose();
    this.options.onClose();
  }

  dispose(): void {
    this.stopRequested = true;
    for (const cleanup of this.cleanups.values()) cleanup();
    this.cleanups.clear();
    this.shell.dispose();
  }
}

/** Opens the 寻宝 screen over root. */
export async function openTreasureHunt(options: LotteryScreenOptions): Promise<{ close(): void }> {
  const library = options.library;
  if (!isLotteryLibrary(library)) throw new Error("寻宝缺少原版资源库。");
  const stage = await loadLotteryStage(library, TREASURE_ROOTS, "stage_window@zz");
  const view = new TreasureHuntView(options, stage);
  view.shell.mount();
  void loadStageArt(library, TREASURE_ROOTS, [view.layoutWindow], EFFECT_IMAGES)
    .then(art => { if (!view.shell.disposed) view.shell.applyArt(art); }).catch(() => undefined);
  void loadLayoutArt(library, ICON_ROOTS, LOTTERY_ICON_IMAGES)
    .then(art => { if (!view.shell.disposed) view.shell.applyArt(art); }).catch(() => undefined);
  void view.load();
  return { close: () => view.dispose() };
}

