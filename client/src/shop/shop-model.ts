/**
 * Pure shop logic: tabs and sub-tabs, search, sorting, paging, ownership,
 * offer selection and price formatting. The view renders only one page of
 * the result; every list here is computed once per query, and sorted lists
 * are cached per catalog so typing in the search box only filters.
 */
import type { Currency, InventoryItem } from "../account/account-session";
import { remainingLabel } from "../account/ownership";
import {
  SHOP_CURRENCIES, type ShopCatalog, type ShopItem, type ShopMallTab, type ShopOffer,
} from "./shop-catalog";

// --- Labels -------------------------------------------------------------

/** Wallet names as the lobby top bar shows them (ECONOMY.md 0). */
export const CURRENCY_LABELS: Readonly<Record<Currency, string>> = {
  coupon: "点券", lucci: "金币", koin: "K币",
};

export const RECOMMEND_TAB = "recommend";
export const ALL_SUB_TAB = "all";

/** Original stage_mqShop / itemCatTab names, used when the catalog omits one. */
const TAB_NAMES: Record<string, string> = {
  recommend: "推荐", kartBody: "卡丁车", character: "角色", equip: "装备",
};

const SUB_TAB_NAMES: Record<string, string> = {
  itemKart: "道具车", speedKart: "竞速车", character: "角色", pet: "宠物",
  flyingPet: "飞行宠物", balloon: "气球", headBand: "头饰", goggle: "眼镜",
  handGear: "手套", color: "喷漆", dye: "染色", aura: "光环", skidMark: "轨迹",
  plate: "车牌", etc: "其他",
};

/** stage_stringBag "total". */
const ALL_SUB_TAB_NAME = "全部";

const KIND_LABELS: Record<string, string> = {
  kart: "卡丁车", character: "角色", pet: "宠物", flyingPet: "飞行宠物",
  balloon: "气球", headBand: "头饰", goggle: "眼镜", handGearL: "手套",
  color: "喷漆", dye: "染色", aura: "光环", skidMark: "轨迹", plate: "车牌",
  uniform: "服装", decal: "贴花", ridColor: "车手颜色", slotBg: "车手栏背景",
  headPhone: "耳机", rpLucciBonus: "经验金币加成卡", goItemSkinCard: "道具皮肤卡",
  tachometer: "仪表盘",
};

/** etc_ engineGrade<N> strings of the CN garage. */
const ENGINE_NAMES: Record<number, string> = {
  1: "PRO引擎以下", 2: "SR引擎", 3: "Z7引擎", 4: "HT引擎", 5: "HT+引擎",
  6: "JIU引擎", 7: "X引擎", 8: "V1引擎", 9: "迅引擎",
};

export function kindLabel(item: Pick<ShopItem, "kind" | "kartType">): string {
  if (item.kind === "kart") return item.kartType === 1 ? "道具车" : item.kartType === 2 ? "竞速车" : "卡丁车";
  return KIND_LABELS[item.kind] ?? "道具";
}

export function engineLabel(item: Pick<ShopItem, "kind" | "engineGrade">): string | undefined {
  return item.kind === "kart" && item.engineGrade !== undefined ? ENGINE_NAMES[item.engineGrade] : undefined;
}

// --- Formatting ---------------------------------------------------------

export function formatAmount(value: number): string {
  return Math.floor(Number.isFinite(value) ? value : 0).toLocaleString("en-US");
}

/** "1,200 点券". */
export function formatPrice(price: number, currency: Currency): string {
  return `${formatAmount(price)} ${CURRENCY_LABELS[currency]}`;
}

/** "永久" or "30天". */
export function formatPeriod(days: number): string {
  return days === 0 ? "永久" : `${days}天`;
}

/** The term an offer grants: "30天", "永久", "100个", "50个·30天". */
export function formatOfferTerm(offer: Pick<ShopOffer, "days" | "count">,
  item?: Pick<ShopItem, "isAdditional">): string {
  if (offer.count > 1 || item?.isAdditional) {
    const count = `${offer.count}个`;
    return offer.days === 0 ? count : `${count}·${formatPeriod(offer.days)}`;
  }
  return formatPeriod(offer.days);
}

/** "需要经验 600". */
export function formatExpRequirement(minExp: number): string {
  return `需要经验 ${formatAmount(minExp)}`;
}

const DAY = 86_400_000;

/**
 * Remaining rental time, the same text the garage shows (account/ownership
 * remainingLabel): "剩余 3 天", "剩余 5 小时", "剩余 20 分钟", "已过期".
 */
export function formatRemaining(expiresAt: number, now: number): string {
  return remainingLabel(expiresAt, now) ?? "";
}

/** Local date and time of an expiry: "2026-11-06 14:30". */
export function formatDateTime(ms: number): string {
  const date = new Date(ms);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
    `${two(date.getHours())}:${two(date.getMinutes())}`;
}

// --- Tabs ---------------------------------------------------------------

export interface ShopSubTabEntry { readonly id: string; readonly name: string }

export interface ShopTabEntry {
  readonly id: string;
  readonly name: string;
  /**
   * The itemSubCatTab row: the original mall's SubCats after its 全部 (none
   * on 推荐); older catalogs: 全部 then the catalog's sub-tabs.
   */
  readonly subTabs: readonly ShopSubTabEntry[];
  /** The sub-tab the tab opens on: 全部, or the first SubCat where there is none (推荐: 新商品). */
  readonly defaultSubTab: string;
}

/** The original mall's ShopCat id for 推荐 (shopCat.xml, catalog shopTabs). */
export const MALL_RECOMMEND_TAB = "recommand";

/** The contract's ShopTab uses the original "recommand" key; the shop calls the tab "recommend". */
export function catalogTabId(tab: string | undefined): string {
  return !tab || tab === MALL_RECOMMEND_TAB ? RECOMMEND_TAB : tab;
}

/**
 * 推荐 sub-tabs after the original shopCat.xml recommand sub-categories
 * (new / hotItem / event): the card marks the catalog carries.
 */
export const RECOMMEND_MARK_TABS: readonly { mark: string; name: string }[] = [
  { mark: "new", name: "新商品" }, { mark: "hot", name: "热门商品" }, { mark: "discount", name: "折扣" },
];

/**
 * Tabs in catalog order, 推荐 first, each sub-tab row starting with 全部; 推荐
 * gets one sub-tab per card mark present.
 */
export function shopTabEntries(catalog: Pick<ShopCatalog, "tabs" | "items">): ShopTabEntry[] {
  const marks = new Set(catalog.items.flatMap(item => item.marks ?? []));
  const markTabs = RECOMMEND_MARK_TABS.filter(tab => marks.has(tab.mark))
    .map(tab => ({ id: tab.mark, name: tab.name }));
  const tabs = catalog.tabs.map(tab => ({
    id: tab.id,
    name: tab.name || TAB_NAMES[tab.id] || tab.id,
    subTabs: tab.subTabs.length
      ? [{ id: ALL_SUB_TAB, name: ALL_SUB_TAB_NAME },
        ...tab.subTabs.map(sub => ({ id: sub.id, name: sub.name || SUB_TAB_NAMES[sub.id] || sub.id }))]
      : [],
  }));
  // Items may name a tab the tab list lacks; give them a tab rather than hide them.
  for (const item of catalog.items) {
    if (!tabs.some(tab => tab.id === item.tab))
      tabs.push({ id: item.tab, name: TAB_NAMES[item.tab] ?? item.tab, subTabs: [] });
  }
  if (!tabs.some(tab => tab.id === RECOMMEND_TAB))
    tabs.unshift({ id: RECOMMEND_TAB, name: TAB_NAMES.recommend!, subTabs: [] });
  const recommend = tabs.findIndex(tab => tab.id === RECOMMEND_TAB);
  if (recommend > 0) tabs.unshift(...tabs.splice(recommend, 1));
  if (!tabs[0]!.subTabs.length && markTabs.length)
    tabs[0] = { ...tabs[0]!, subTabs: [{ id: ALL_SUB_TAB, name: ALL_SUB_TAB_NAME }, ...markTabs] };
  return tabs.map(tab => ({ ...tab, defaultSubTab: ALL_SUB_TAB }));
}

/**
 * The original mall's tabs (catalog shopTabs, ECONOMY.md 3.2.1) in file
 * order: 推荐 (recommend) with its SubCats and no 全部, opening on its
 * defaultSubTab (新商品); the others with 全部 first when they have SubCats.
 */
export function mallTabEntries(shopTabs: readonly ShopMallTab[]): ShopTabEntry[] {
  return shopTabs.map(tab => {
    const subTabs = [
      ...(tab.allSubTab && tab.subTabs.length ? [{ id: ALL_SUB_TAB, name: tab.allSubTab }] : []),
      ...tab.subTabs.map(sub => ({ id: sub.id, name: sub.name || SUB_TAB_NAMES[sub.id] || sub.id })),
    ];
    const fallback = subTabs[0]?.id ?? ALL_SUB_TAB;
    const defaultSubTab = subTabs.some(sub => sub.id === ALL_SUB_TAB) ? ALL_SUB_TAB
      : subTabs.some(sub => sub.id === tab.defaultSubTab) ? tab.defaultSubTab! : fallback;
    return { id: catalogTabId(tab.id), name: tab.name || TAB_NAMES[catalogTabId(tab.id)] || tab.id,
      subTabs, defaultSubTab };
  });
}

// --- Index --------------------------------------------------------------

export interface ShopEntry {
  readonly item: ShopItem;
  /** `${category}:${itemId}`, the inventory key. */
  readonly key: string;
  /** Position in the catalog document. */
  readonly order: number;
  /** Lower-cased name and internal id for search. */
  readonly search: string;
  /** item.kml has a CN name (otherwise the name is "internalId (itemId)"). */
  readonly named: boolean;
  /** At least one offer comes from an original stock. */
  readonly original: boolean;
  /** Currency of the first offer: the card's currency without a filter. */
  readonly primaryCurrency: Currency;
  /** The cheapest offer in each currency the item sells for. */
  readonly cheapest: Readonly<Partial<Record<Currency, ShopOffer>>>;
  /**
   * The offer the card shows (the catalog's displayOfferId, the original
   * card's single price); the cheapest in the first offer's currency otherwise.
   */
  readonly shown: ShopOffer;
}

export type ShopSort = "default" | "priceAsc" | "priceDesc" | "name" | "newest";
export type ShopCurrencyFilter = Currency | "all";

export const SHOP_SORTS: readonly { id: ShopSort; name: string }[] = [
  { id: "default", name: "默认排序" },
  { id: "newest", name: "最新上架" },
  { id: "priceAsc", name: "价格从低到高" },
  { id: "priceDesc", name: "价格从高到低" },
  { id: "name", name: "按名称" },
];

export function itemKey(category: number, itemId: number): string {
  return `${category}:${itemId}`;
}

function cheapestOffers(offers: readonly ShopOffer[]): Partial<Record<Currency, ShopOffer>> {
  const result: Partial<Record<Currency, ShopOffer>> = {};
  for (const offer of offers) {
    const current = result[offer.currency];
    if (!current || offer.price < current.price ||
        (offer.price === current.price && offer.days === 0 && current.days !== 0))
      result[offer.currency] = offer;
  }
  return result;
}

function markRank(item: ShopItem): number {
  const marks = item.marks ?? [];
  if (marks.includes("new")) return 0;
  if (marks.includes("hot")) return 1;
  if (marks.includes("discount")) return 2;
  return item.recommend?.length ? 3 : 4;
}

const collator = typeof Intl !== "undefined" ? new Intl.Collator("zh-CN") : undefined;

/** The shop catalog with lists per tab and lazily cached sort orders. */
export class ShopIndex {
  readonly entries: readonly ShopEntry[];
  readonly tabs: readonly ShopTabEntry[];
  /** Lists come from the original mall layout (catalog shopTabs) and are already in card order. */
  readonly mall: boolean;
  private readonly byKey = new Map<string, ShopEntry>();
  private readonly lists = new Map<string, ShopEntry[]>();
  private readonly sorted = new Map<string, ShopEntry[]>();

  constructor(readonly catalog: ShopCatalog) {
    this.mall = catalog.shopTabs.length > 0;
    this.tabs = this.mall ? mallTabEntries(catalog.shopTabs) : shopTabEntries(catalog);
    this.entries = catalog.items.map((item, order) => {
      const cheapest = cheapestOffers(item.offers);
      const primaryCurrency = item.offers[0]!.currency;
      const entry: ShopEntry = {
        item, key: itemKey(item.category, item.itemId), order,
        search: `${item.name}\n${item.internalId}`.toLowerCase(),
        named: item.name !== `${item.internalId} (${item.itemId})`,
        original: item.offers.some(offer => offer.source === "original"),
        primaryCurrency, cheapest,
        shown: item.offers.find(offer => offer.offerId === item.displayOfferId) ??
          cheapest[primaryCurrency] ?? item.offers[0]!,
      };
      this.byKey.set(entry.key, entry);
      return entry;
    });
    if (this.mall) this.indexMall(catalog.shopTabs);
    else this.indexTabs();
  }

  /** Older catalogs: the rewrite's tab/subTab, 推荐 by recommend flags and card marks. */
  private indexTabs(): void {
    for (const entry of this.entries) {
      this.add(entry.item.tab, entry);
      this.add(`${entry.item.tab}/${entry.item.subTab}`, entry);
      if (entry.item.recommend?.length ||
          entry.item.marks?.some(mark => RECOMMEND_MARK_TABS.some(tab => tab.mark === mark)))
        this.add(RECOMMEND_TAB, entry);
      for (const mark of entry.item.marks ?? []) this.add(`${RECOMMEND_TAB}/${mark}`, entry);
    }
  }

  /**
   * The original mall (ECONOMY.md 3.2.1): each (sub-)tab lists its cards'
   * items in card order, then the rest of its items (current cards and named
   * items first, newest first); 全部 lists every SubCat's cards first. 推荐
   * shows its cards only.
   */
  private indexMall(shopTabs: readonly ShopMallTab[]): void {
    const rest = new Map<string, ShopEntry[]>();
    for (const entry of [...this.entries].sort(comparator("default", "all"))) {
      const tab = entry.item.shopCategory;
      if (!tab) continue;
      let list = rest.get(tab);
      if (!list) rest.set(tab, list = []);
      list.push(entry);
    }
    const cards = (keys: readonly string[] | undefined) =>
      [...new Set(keys ?? [])].flatMap(key => this.byKey.get(key) ?? []);
    const inSub = (entry: ShopEntry, sub: string) =>
      entry.item.shopSubCategories?.includes(sub) ?? entry.item.shopSubCategory === sub;
    /** first, then the others not in it; each entry once. */
    const join = (first: readonly ShopEntry[], others: readonly ShopEntry[]) => {
      const seen = new Set<string>();
      return [...first, ...others].filter(entry => !seen.has(entry.key) && !!seen.add(entry.key));
    };
    for (const tab of shopTabs) {
      const id = catalogTabId(tab.id);
      const recommend = id === RECOMMEND_TAB;
      const items = recommend ? [] : rest.get(tab.id) ?? [];
      if (!tab.subTabs.length) {
        this.lists.set(id, join(cards(tab.cardItems), items));
        continue;
      }
      const all: ShopEntry[] = [];
      for (const sub of tab.subTabs) {
        const subCards = cards(sub.cardItems);
        all.push(...subCards);
        this.lists.set(`${id}/${sub.id}`, join(subCards, items.filter(entry => inSub(entry, sub.id))));
      }
      this.lists.set(id, join(all, items));
    }
  }

  private add(key: string, entry: ShopEntry): void {
    let list = this.lists.get(key);
    if (!list) this.lists.set(key, list = []);
    list.push(entry);
  }

  entry(category: number, itemId: number): ShopEntry | undefined {
    return this.byKey.get(itemKey(category, itemId));
  }

  /** The entry for an inventory key `${category}:${itemId}`. */
  get(key: string): ShopEntry | undefined {
    return this.byKey.get(key);
  }

  /** Items of a tab (all sub-tabs) or one sub-tab (推荐: one mark), in catalog order. */
  list(tab: string, subTab = ALL_SUB_TAB): readonly ShopEntry[] {
    const key = subTab === ALL_SUB_TAB ? tab : `${tab}/${subTab}`;
    return this.lists.get(key) ?? [];
  }

  /**
   * `list` (or every item when tab is undefined) in the given order; cached.
   * The original mall's lists keep their card order for the default order.
   */
  sortedList(tab: string | undefined, subTab: string, sort: ShopSort,
    currency: ShopCurrencyFilter): readonly ShopEntry[] {
    if (this.mall && tab !== undefined && sort === "default") return this.list(tab, subTab);
    const priceSort = sort === "priceAsc" || sort === "priceDesc";
    const key = `${tab ?? "*"}|${tab === undefined ? "" : subTab}|${sort}|${priceSort ? currency : ""}`;
    let list = this.sorted.get(key);
    if (!list) {
      const base = tab === undefined ? this.entries : this.list(tab, subTab);
      list = [...base].sort(comparator(sort, currency));
      this.sorted.set(key, list);
    }
    return list;
  }
}

/**
 * The offer a card shows: the catalog's displayOfferId (the original card's
 * price) without a currency filter, else the cheapest in the filtered currency.
 */
export function displayOffer(entry: ShopEntry, currency: ShopCurrencyFilter = "all"): ShopOffer | undefined {
  return currency === "all" ? entry.shown : entry.cheapest[currency];
}

function newest(a: ShopEntry, b: ShopEntry): number {
  return b.item.itemId - a.item.itemId || a.item.category - b.item.category || a.order - b.order;
}

function comparator(sort: ShopSort, currency: ShopCurrencyFilter): (a: ShopEntry, b: ShopEntry) => number {
  switch (sort) {
    case "newest": return newest;
    case "name": return (a, b) => Number(b.named) - Number(a.named) ||
      (collator ? collator.compare(a.item.name, b.item.name) :
        a.item.name < b.item.name ? -1 : a.item.name > b.item.name ? 1 : 0) || a.order - b.order;
    case "priceAsc":
    case "priceDesc": {
      const direction = sort === "priceAsc" ? 1 : -1;
      return (a, b) => {
        const left = displayOffer(a, currency), right = displayOffer(b, currency);
        if (!left || !right) return Number(!left) - Number(!right) || a.order - b.order;
        return SHOP_CURRENCIES.indexOf(left.currency) - SHOP_CURRENCIES.indexOf(right.currency) ||
          direction * (left.price - right.price) || a.order - b.order;
      };
    }
    default:
      // Current shop cards (new, hot, discount, recommended) first, then items
      // with a CN name and an original price, newest first.
      return (a, b) => markRank(a.item) - markRank(b.item) ||
        Number(b.named) - Number(a.named) || Number(b.original) - Number(a.original) ||
        newest(a, b);
  }
}

// --- Query --------------------------------------------------------------

/** The original search box takes at most 10 characters (stage_window maxChar). */
export const SEARCH_MAX_CHARS = 10;

export function clampSearch(text: string): string {
  return [...text].slice(0, SEARCH_MAX_CHARS).join("");
}

export function normalizeSearch(text: string): string {
  return clampSearch(text.trim()).trim().toLowerCase();
}

export interface ShopQuery {
  tab: string;
  subTab: string;
  /** Non-empty searches cover the whole catalog, like a shop-wide search. */
  search: string;
  sort: ShopSort;
  currency: ShopCurrencyFilter;
  hideOwned: boolean;
}

export function defaultShopQuery(tab = RECOMMEND_TAB): ShopQuery {
  return { tab, subTab: ALL_SUB_TAB, search: "", sort: "default", currency: "all", hideOwned: false };
}

/** Every entry the query shows, in order. `owned` is consulted only for hideOwned. */
export function queryShop(index: ShopIndex, query: ShopQuery,
  owned?: (entry: ShopEntry) => boolean): readonly ShopEntry[] {
  const search = normalizeSearch(query.search);
  const base = index.sortedList(search ? undefined : query.tab, query.subTab, query.sort, query.currency);
  if (!search && query.currency === "all" && !(query.hideOwned && owned)) return base;
  return base.filter(entry =>
    (!search || entry.search.includes(search)) &&
    (query.currency === "all" || entry.cheapest[query.currency] !== undefined) &&
    !(query.hideOwned && owned?.(entry)));
}

// --- Paging -------------------------------------------------------------

/** stage_window itemList: alignSize 3 cards per row, maxLine 3 rows. */
export const SHOP_COLUMNS = 3;
export const SHOP_ROWS = 3;
export const SHOP_PAGE_SIZE = SHOP_COLUMNS * SHOP_ROWS;

export interface ShopPage<T> {
  readonly items: readonly T[];
  /** Zero-based, clamped into range. */
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
}

export interface ShopLineWindow<T> {
  readonly items: readonly T[];
  /** First visible line (row), clamped into range. */
  readonly line: number;
  /** Scroll positions: rows - visible rows + 1 (at least 1). */
  readonly lineCount: number;
  readonly total: number;
}

/**
 * The visible window of a line-paged grid (stage_window itemList
 * GridSelectorDivLoad linePaging="true", like the garage's grid selector):
 * scrolling moves by one row of `columns`, showing `rows` rows at a time.
 */
export function lineWindowOf<T>(list: readonly T[], line: number, columns = SHOP_COLUMNS,
  rows = SHOP_ROWS): ShopLineWindow<T> {
  const lines = Math.ceil(list.length / columns);
  const lineCount = Math.max(1, lines - rows + 1);
  const current = Math.min(lineCount - 1, Math.max(0, Math.floor(Number.isFinite(line) ? line : 0)));
  return {
    items: list.slice(current * columns, (current + rows) * columns),
    line: current, lineCount, total: list.length,
  };
}

export function pageOf<T>(list: readonly T[], page: number, pageSize = SHOP_PAGE_SIZE): ShopPage<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(pageCount - 1, Math.max(0, Math.floor(Number.isFinite(page) ? page : 0)));
  return { items: list.slice(current * size, (current + 1) * size), page: current, pageCount, total: list.length };
}

// --- Ownership ----------------------------------------------------------

export interface ShopOwnership {
  readonly owned: boolean;
  /** Owned without an expiry. */
  readonly permanent: boolean;
  /** Unix ms of a rental's end; null when permanent or not owned. */
  readonly expiresAt: number | null;
  readonly quantity: number;
}

export const NOT_OWNED: ShopOwnership = { owned: false, permanent: false, expiresAt: null, quantity: 0 };

/** Unexpired inventory rows by `${category}:${itemId}` (system karts excluded). */
export function inventoryIndex(inventory: readonly InventoryItem[], now: number): Map<string, InventoryItem> {
  const index = new Map<string, InventoryItem>();
  for (const row of inventory) {
    if (row.systemKey || (row.expiresAt !== null && row.expiresAt <= now)) continue;
    const key = itemKey(row.category, row.itemId);
    const current = index.get(key);
    // Keep the longest-lasting row if the server ever lists two.
    if (!current || (current.expiresAt !== null &&
        (row.expiresAt === null || row.expiresAt > current.expiresAt)))
      index.set(key, row);
  }
  return index;
}

export function ownershipOf(item: Pick<ShopItem, "category" | "itemId">,
  inventory: ReadonlyMap<string, InventoryItem>, now: number,
  owns?: (category: number, itemId: number) => boolean): ShopOwnership {
  const row = inventory.get(itemKey(item.category, item.itemId));
  if (row && (row.expiresAt === null || row.expiresAt > now)) {
    return { owned: true, permanent: row.expiresAt === null, expiresAt: row.expiresAt,
      quantity: row.quantity };
  }
  // The session may know about ownership the inventory snapshot lacks.
  if (owns?.(item.category, item.itemId)) return { owned: true, permanent: false, expiresAt: null, quantity: 0 };
  return NOT_OWNED;
}

/** Card/detail badge: "已永久拥有", "已拥有 100个", "剩余3天", or "" when not owned. */
export function ownershipLabel(item: Pick<ShopItem, "isAdditional">, ownership: ShopOwnership,
  now: number): string {
  if (!ownership.owned) return "";
  if (item.isAdditional && ownership.quantity > 0) {
    const count = `已拥有 ${formatAmount(ownership.quantity)}个`;
    return ownership.expiresAt === null ? count : `${count}·${formatRemaining(ownership.expiresAt, now)}`;
  }
  if (ownership.permanent) return "已永久拥有";
  if (ownership.expiresAt !== null) return formatRemaining(ownership.expiresAt, now);
  return "已拥有";
}

/** A permanently owned single item cannot be bought again (409 ALREADY_OWNED). */
export function ownedForGood(item: Pick<ShopItem, "isAdditional">, ownership: ShopOwnership): boolean {
  return ownership.owned && ownership.permanent && !item.isAdditional;
}

/** A single item rented until expiresAt: buying it again extends or upgrades the rental. */
export function ownedRental(item: Pick<ShopItem, "isAdditional">, ownership: ShopOwnership):
  ownership is ShopOwnership & { expiresAt: number } {
  return ownership.owned && !ownership.permanent && ownership.expiresAt !== null && !item.isAdditional;
}

/**
 * What buying offer does to an owned rental (ECONOMY.md 5: a rental is
 * extended from max(now, expiresAt), a permanent offer makes it permanent):
 * "当前剩余 3 天，兑换后到期 2026-11-06 14:30" or "当前剩余 3 天，兑换后变为永久"
 * (兑换 is the CN mall's word for buying);
 * undefined when the item is not an owned rental.
 */
export function renewalNote(item: Pick<ShopItem, "isAdditional">, offer: Pick<ShopOffer, "days">,
  ownership: ShopOwnership, now: number): string | undefined {
  if (!ownedRental(item, ownership)) return undefined;
  const current = `当前${formatRemaining(ownership.expiresAt, now)}`;
  if (offer.days === 0) return `${current}，兑换后变为永久`;
  return `${current}，兑换后到期 ${formatDateTime(Math.max(now, ownership.expiresAt) + offer.days * DAY)}`;
}

// --- Offers -------------------------------------------------------------

export type OfferBlock = "owned" | "exp" | "funds";

export interface OfferContext {
  /** Balances; undefined while the account summary is unknown (the server still checks). */
  wallet?: Readonly<Record<Currency, number>>;
  exp?: number;
  ownership: ShopOwnership;
}

export interface OfferAvailability {
  readonly offer: ShopOffer;
  readonly blocked?: OfferBlock;
  /** Why it cannot be bought, in Chinese. */
  readonly reason?: string;
  readonly balance?: number;
  readonly after?: number;
}

export function offerAvailability(item: Pick<ShopItem, "isAdditional">, offer: ShopOffer,
  context: OfferContext): OfferAvailability {
  const balance = context.wallet?.[offer.currency];
  const after = balance === undefined ? undefined : balance - offer.price;
  const base = { offer, ...(balance === undefined ? {} : { balance, after }) };
  if (ownedForGood(item, context.ownership))
    return { ...base, blocked: "owned", reason: "已永久拥有该道具，无需重复兑换" };
  if (offer.minExp && context.exp !== undefined && context.exp < offer.minExp)
    return { ...base, blocked: "exp", reason: `经验不足，${formatExpRequirement(offer.minExp)}` };
  if (after !== undefined && after < 0)
    return { ...base, blocked: "funds", reason: `${CURRENCY_LABELS[offer.currency]}不足` };
  return base;
}

/** Offers in display order: by currency (点券, 金币, K币), then longer terms last. */
export function orderedOffers(item: Pick<ShopItem, "offers">): ShopOffer[] {
  const term = (offer: ShopOffer) => offer.days === 0 ? Number.MAX_SAFE_INTEGER : offer.days;
  return [...item.offers].sort((a, b) =>
    SHOP_CURRENCIES.indexOf(a.currency) - SHOP_CURRENCIES.indexOf(b.currency) ||
    term(a) - term(b) || a.count - b.count || a.price - b.price);
}

/**
 * The offer the buy dialog starts on: the cheapest one that can be bought,
 * preferring the card's currency; otherwise the card's offer, so the dialog
 * explains why it cannot be bought.
 */
export function defaultOffer(entry: ShopEntry, context: OfferContext,
  currency: ShopCurrencyFilter = "all"): ShopOffer {
  const preferred = currency === "all" ? entry.primaryCurrency : currency;
  const buyable = entry.item.offers.filter(offer =>
    !offerAvailability(entry.item, offer, context).blocked);
  const cheapest = (offers: readonly ShopOffer[]) => offers.reduce<ShopOffer | undefined>(
    (best, offer) => !best || offer.price < best.price ? offer : best, undefined);
  return cheapest(buyable.filter(offer => offer.currency === preferred)) ??
    cheapest(buyable) ?? displayOffer(entry, preferred) ?? entry.item.offers[0]!;
}
