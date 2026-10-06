import type { LocalProfile } from "./local-profile";
import {
  ITEM_INVENTORY_GROUPS, filterItemInventory, itemInventoryCanUnequip, itemInventoryEntries,
  itemInventoryGroup, itemInventoryIsEquipped, itemInventoryIsFavorite,
  itemInventoryKey, toggleItemInventoryFavorite, type ItemInventoryCatalog,
  type ItemInventoryGroup, type ItemInventoryItem,
} from "./item-inventory";

export interface ItemInventoryViewOptions {
  root: HTMLElement;
  catalog: ItemInventoryCatalog;
  profile: LocalProfile;
  onProfileChange(profile: LocalProfile): void;
  onEquip(item: ItemInventoryItem, action?: "equip" | "unequip"):
    Promise<LocalProfile | void> | LocalProfile | void;
  onClose(): void;
}

const PAGE_SIZE = 30;
const KIND_LABELS: Record<string, string> = {
  kart: "卡丁车", character: "角色", flyingPet: "飞行宠物",
  headBand: "头饰", balloon: "气球", goggle: "护目镜", handGearL: "手部装备",
  aura: "光环", color: "喷漆", dye: "染色", skidMark: "轮胎印", plate: "车牌",
};
const KIND_ORDER = ["kart", "character", "flyingPet", "headBand", "balloon",
  "goggle", "handGearL", "aura", "color", "dye", "skidMark", "plate"];

const STYLE = `
.item-inventory-overlay{position:absolute;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(2,12,25,.76);color:#f1f6ff;font:15px/1.4 system-ui,-apple-system,"Microsoft YaHei",sans-serif;box-sizing:border-box}
.item-inventory-overlay *{box-sizing:border-box}
.item-inventory-window{width:min(1120px,100%);max-height:min(800px,calc(100% - 40px));display:flex;flex-direction:column;overflow:hidden;border:2px solid #65b7e7;border-radius:18px;background:linear-gradient(145deg,#244d75 0%,#122a48 45%,#0a1d35 100%);box-shadow:0 28px 80px #000a,0 0 0 3px #153b62 inset}
.item-inventory-header{display:flex;align-items:center;gap:16px;padding:18px 22px;background:#3a75a5;border-bottom:2px solid #85d6fa}
.item-inventory-header h2{font-size:25px;line-height:1.1;margin:0;color:#fff;text-shadow:0 2px #1c4770}
.item-inventory-header p{margin:4px 0 0;color:#e2f5ff;font-size:12px}
.item-inventory-spacer{flex:1}
.item-inventory-button{border:1px solid #95ccec;border-radius:8px;background:linear-gradient(#3877aa,#21547d);color:#fff;padding:8px 12px;font:inherit;cursor:pointer}
.item-inventory-button:hover:not(:disabled),.item-inventory-button:focus-visible{background:linear-gradient(#4799d2,#286b9e);outline:2px solid #ffe38b;outline-offset:1px}
.item-inventory-button:disabled{opacity:.48;cursor:default}
.item-inventory-close{font-size:19px;min-width:40px;padding:4px 8px}
.item-inventory-tools{display:flex;flex-wrap:wrap;gap:10px;padding:13px 20px 10px;border-bottom:1px solid #4e83a8}
.item-inventory-tabs{display:flex;flex-wrap:wrap;gap:6px;flex:1}
.item-inventory-tabs .item-inventory-button[aria-selected="true"]{background:linear-gradient(#ffdf74,#e99b33);color:#39220c;border-color:#ffe6a5;font-weight:700}
.item-inventory-search,.item-inventory-kind{border:1px solid #7db8d8;border-radius:8px;background:#eaf5fc;color:#122840;padding:8px 10px;font:inherit}
.item-inventory-search{width:min(260px,100%)}
.item-inventory-kind{min-width:138px}
.item-inventory-content{display:grid;grid-template-columns:minmax(0,1fr) 245px;min-height:0;flex:1}
.item-inventory-main{display:flex;flex-direction:column;min-width:0;min-height:0;padding:12px 16px 16px}
.item-inventory-count{font-size:12px;color:#b9d5eb;margin-bottom:10px}
.item-inventory-grid{overflow:auto;min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));align-content:start;gap:10px;padding:1px 4px 6px 1px}
.item-inventory-card{border:1px solid #5689b0;border-radius:10px;padding:10px;background:linear-gradient(#264d75,#183653);min-height:142px;display:flex;flex-direction:column;gap:7px}
.item-inventory-card[data-selected="true"]{border-color:#ffdc78;box-shadow:0 0 0 2px #d6a23d inset}
.item-inventory-card-title{border:0;background:transparent;color:#fff;text-align:left;padding:0;font:inherit;font-size:15px;font-weight:700;line-height:1.35;cursor:pointer;overflow-wrap:anywhere}
.item-inventory-card-title:hover,.item-inventory-card-title:focus-visible{text-decoration:underline;outline:none}
.item-inventory-card-meta{font-size:12px;color:#b8d8ec}
.item-inventory-card-actions{display:flex;gap:6px;margin-top:auto}
.item-inventory-card-actions .item-inventory-button{font-size:12px;padding:5px 8px;flex:1}
.item-inventory-card-actions .item-inventory-favorite{flex:0 0 36px;padding:5px}
.item-inventory-equipped{color:#ffe59b;font-weight:700}
.item-inventory-empty{grid-column:1/-1;border:1px dashed #6695b5;border-radius:12px;padding:32px;text-align:center;color:#cfe3f2}
.item-inventory-pagination{display:flex;align-items:center;justify-content:center;gap:12px;padding-top:12px;color:#cee5f3}
.item-inventory-detail{border-left:1px solid #4e83a8;padding:18px;overflow:auto;background:#112b49}
.item-inventory-detail h3{font-size:20px;line-height:1.35;margin:0 0 12px;overflow-wrap:anywhere}
.item-inventory-detail p{margin:8px 0;color:#bfd7e9;overflow-wrap:anywhere}
.item-inventory-detail .item-inventory-button{width:100%;margin-top:9px}
.item-inventory-status{min-height:28px;padding:5px 20px 12px;color:#ffe6a1;font-size:13px}
@media(max-width:700px){.item-inventory-overlay{padding:8px}.item-inventory-window{max-height:calc(100% - 16px)}.item-inventory-header{padding:12px}.item-inventory-tools{padding:9px}.item-inventory-content{grid-template-columns:1fr}.item-inventory-detail{display:none}.item-inventory-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.item-inventory-search{flex:1;min-width:130px}}
`;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function button(label: string, onClick: () => void, className = ""): HTMLButtonElement {
  const result = node("button", `item-inventory-button ${className}`, label);
  result.type = "button";
  result.addEventListener("click", onClick);
  return result;
}

/** Independent My Items window, backed by the local garage catalog and profile. */
export class ItemInventoryView {
  readonly element = node("div", "item-inventory-overlay");
  readonly items: ItemInventoryItem[];
  readonly window = node("section", "item-inventory-window");
  readonly tabs = node("div", "item-inventory-tabs");
  readonly kind = node("select", "item-inventory-kind");
  readonly search = node("input", "item-inventory-search");
  readonly count = node("div", "item-inventory-count");
  readonly grid = node("div", "item-inventory-grid");
  readonly detail = node("aside", "item-inventory-detail");
  readonly pagination = node("div", "item-inventory-pagination");
  readonly status = node("div", "item-inventory-status");
  profile: LocalProfile;
  group: ItemInventoryGroup = "all";
  kindFilter = "all";
  page = 0;
  selectedKey?: string;
  busy = false;
  disposed = false;
  previousFocus: Element | null = null;

  constructor(readonly options: ItemInventoryViewOptions) {
    this.items = itemInventoryEntries(options.catalog);
    this.profile = options.profile;
    this.element.setAttribute("role", "presentation");
    this.window.setAttribute("role", "dialog");
    this.window.setAttribute("aria-modal", "true");
    this.window.setAttribute("aria-label", "我的道具");
    const style = node("style");
    style.textContent = STYLE;
    this.element.append(style);

    const header = node("header", "item-inventory-header");
    const title = node("div");
    title.append(node("h2", undefined, "我的道具"),
      node("p", undefined, "本地可用道具 · 装备与收藏保存在当前档案"));
    header.append(title, node("div", "item-inventory-spacer"),
      button("×", () => this.close(), "item-inventory-close"));
    const tools = node("div", "item-inventory-tools");
    this.tabs.setAttribute("role", "tablist");
    this.tabs.setAttribute("aria-label", "道具分类");
    this.search.type = "search";
    this.search.placeholder = "搜索道具名称或编号";
    this.search.setAttribute("aria-label", "搜索道具");
    this.search.addEventListener("input", () => { this.page = 0; this.render(); });
    this.kind.setAttribute("aria-label", "细分类别");
    this.kind.addEventListener("change", () => {
      this.kindFilter = this.kind.value;
      this.page = 0;
      this.render();
    });
    tools.append(this.tabs, this.kind, this.search);
    const main = node("div", "item-inventory-main");
    main.append(this.count, this.grid, this.pagination);
    const content = node("div", "item-inventory-content");
    content.append(main, this.detail);
    this.status.setAttribute("role", "status");
    this.window.append(header, tools, content, this.status);
    this.element.append(this.window);
    this.element.addEventListener("pointerdown", event => {
      if (event.target === this.element) this.close();
    });
  }

  show(): void {
    if (this.disposed) throw new Error("道具窗口已关闭。");
    if (!this.element.isConnected) {
      this.previousFocus = document.activeElement;
      this.options.root.append(this.element);
      document.addEventListener("keydown", this.onKeyDown, true);
    }
    this.render();
    this.search.focus();
  }

  refresh(profile: LocalProfile): void {
    this.profile = profile;
    if (!this.disposed) this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.element.remove();
    if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected)
      this.previousFocus.focus();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  };

  private close(): void {
    if (this.disposed) return;
    this.dispose();
    this.options.onClose();
  }

  private setStatus(message: string): void { this.status.textContent = message; }

  private kindOptions(): string[] {
    const relevant = this.items.filter(item => this.group === "all" ||
      this.group === "favorite" ?
      (this.group !== "favorite" || itemInventoryIsFavorite(item, this.profile)) :
      itemInventoryGroup(item) === this.group);
    const kinds = new Set(relevant.map(item => item.kind));
    return KIND_ORDER.filter(kind => kinds.has(kind));
  }

  private renderTabs(): void {
    this.tabs.replaceChildren(...ITEM_INVENTORY_GROUPS.map(group => {
      const tab = button(group.label, () => {
        this.group = group.key;
        this.kindFilter = "all";
        this.page = 0;
        this.render();
      });
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(this.group === group.key));
      return tab;
    }));
    const kinds = this.kindOptions();
    if (this.kindFilter !== "all" && !kinds.includes(this.kindFilter)) this.kindFilter = "all";
    this.kind.replaceChildren(node("option", undefined, "全部细类"),
      ...kinds.map(kind => {
        const option = node("option", undefined, KIND_LABELS[kind] ?? kind);
        option.value = kind;
        return option;
      }));
    this.kind.firstElementChild?.setAttribute("value", "all");
    this.kind.value = this.kindFilter;
  }

  private renderCard(item: ItemInventoryItem): HTMLElement {
    const key = itemInventoryKey(item);
    const card = node("article", "item-inventory-card");
    card.dataset.selected = String(this.selectedKey === key);
    const title = button(item.title, () => {
      this.selectedKey = key;
      this.render();
    }, "item-inventory-card-title");
    const meta = node("div", "item-inventory-card-meta",
      `${KIND_LABELS[item.kind] ?? item.kind} · #${item.itemId}`);
    const equipped = itemInventoryIsEquipped(item, this.profile);
    const state = node("div", "item-inventory-card-meta",
      equipped ? "● 已装备" : "本地可用");
    if (equipped) state.classList.add("item-inventory-equipped");
    const actions = node("div", "item-inventory-card-actions");
    const favorite = button(itemInventoryIsFavorite(item, this.profile) ? "★" : "☆",
      () => this.toggleFavorite(item), "item-inventory-favorite");
    favorite.title = itemInventoryIsFavorite(item, this.profile) ? "取消收藏" : "收藏";
    favorite.setAttribute("aria-label", `${favorite.title} ${item.title}`);
    favorite.disabled = item.itemId === 0 && item.kind !== "kart";
    const canUnequip = equipped && itemInventoryCanUnequip(item);
    const equip = button(canUnequip ? "卸下" : equipped ? "已装备" : "装备",
      () => void this.equip(item, canUnequip ? "unequip" : "equip"));
    equip.disabled = (equipped && !canUnequip) || this.busy ||
      (item.itemId === 0 && item.kind !== "kart");
    actions.append(favorite, equip);
    card.append(title, meta, state, actions);
    return card;
  }

  private renderDetail(item: ItemInventoryItem | undefined): void {
    this.detail.replaceChildren();
    if (!item) {
      this.detail.append(node("h3", undefined, "道具详情"),
        node("p", undefined, "选择一件道具查看详情。"));
      return;
    }
    this.detail.append(node("h3", undefined, item.title),
      node("p", undefined, `类别：${KIND_LABELS[item.kind] ?? item.kind}`),
      node("p", undefined, `道具编号：${item.itemId}`),
      node("p", undefined, `资源名称：${item.internalId}`),
      node("p", undefined, itemInventoryIsEquipped(item, this.profile) ? "当前已装备" : "本地可用"));
    const favorite = button(itemInventoryIsFavorite(item, this.profile) ? "取消收藏" : "加入收藏",
      () => this.toggleFavorite(item));
    favorite.disabled = item.itemId === 0 && item.kind !== "kart";
    const equipped = itemInventoryIsEquipped(item, this.profile);
    const canUnequip = equipped && itemInventoryCanUnequip(item);
    const equip = button(canUnequip ? "卸下这件道具" : equipped ? "已装备" : "装备这件道具",
      () => void this.equip(item, canUnequip ? "unequip" : "equip"));
    equip.disabled = (equipped && !canUnequip) || this.busy ||
      (item.itemId === 0 && item.kind !== "kart");
    this.detail.append(favorite, equip);
  }

  private render(): void {
    this.renderTabs();
    const filtered = filterItemInventory(this.items, this.profile,
      this.group, this.search.value, this.kindFilter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    this.page = Math.min(this.page, totalPages - 1);
    this.count.textContent = `共 ${filtered.length} 件本地可用道具`;
    const pageItems = filtered.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    this.grid.replaceChildren(...(pageItems.length > 0 ? pageItems.map(item => this.renderCard(item)) :
      [node("div", "item-inventory-empty", "当前分类没有可显示的道具。")]));
    const previous = button("上一页", () => { this.page--; this.render(); });
    previous.disabled = this.page === 0;
    const next = button("下一页", () => { this.page++; this.render(); });
    next.disabled = this.page >= totalPages - 1;
    this.pagination.replaceChildren(previous,
      node("span", undefined, `${this.page + 1} / ${totalPages}`), next);
    const selected = this.items.find(item => itemInventoryKey(item) === this.selectedKey);
    this.renderDetail(selected);
  }

  private toggleFavorite(item: ItemInventoryItem): void {
    if (this.busy) return;
    try {
      const next = toggleItemInventoryFavorite(this.profile, item);
      if (next === this.profile) return;
      this.options.onProfileChange(next);
      this.profile = next;
      this.setStatus(itemInventoryIsFavorite(item, next) ? `已收藏 ${item.title}` :
        `已取消收藏 ${item.title}`);
      this.render();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private async equip(item: ItemInventoryItem, action: "equip" | "unequip"): Promise<void> {
    const equipped = itemInventoryIsEquipped(item, this.profile);
    if (this.busy || (action === "equip" && equipped) ||
        (action === "unequip" && (!equipped || !itemInventoryCanUnequip(item)))) return;
    this.busy = true;
    this.setStatus(`正在${action === "unequip" ? "卸下" : "装备"} ${item.title}…`);
    this.render();
    try {
      const profile = await this.options.onEquip(item, action);
      if (this.disposed) return;
      if (profile) this.profile = profile;
      this.setStatus(`已${action === "unequip" ? "卸下" : "装备"} ${item.title}`);
    } catch (error) {
      if (!this.disposed)
        this.setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
      if (!this.disposed) this.render();
    }
  }
}
