/**
 * The shop catalog served by GET /api/shop/catalog (server-go/ECONOMY.md 3.3)
 * and its strict validation. The document is generated from the original CN
 * shop data (stock.kml, shopCat.xml, item.kml) over the rewrite garage
 * catalog; the browser only displays it, the data service prices purchases.
 */
import type { Currency } from "../account/account-session";

export const SHOP_CURRENCIES: readonly Currency[] = ["coupon", "lucci", "koin"];

export interface ShopOffer {
  /** "s<stockId>" (original stock) or "e<category>-<itemId>-<days>" (estimated). */
  readonly offerId: string;
  readonly currency: Currency;
  readonly price: number;
  /** Rental length in days; 0 = permanent. */
  readonly days: number;
  /** Quantity granted (packs of count-based items such as balloons). */
  readonly count: number;
  /** The buyer needs exp >= minExp (original rpLimit). */
  readonly minExp?: number;
  /** "original" or "estimated"; both sell normally and the source is never shown. */
  readonly source: string;
  /**
   * Display only (the purchase charges `price`): a discounted card's
   * struck-through price, its discount<NN> percent off and its "9折" label.
   */
  readonly originalPrice?: number;
  readonly discountPercent?: number;
  readonly discountLabel?: string;
  /** 限购 card stock (stockCard eventBuyCount); buyLimit is the count when given. Not enforced. */
  readonly limited?: boolean;
  readonly buyLimit?: number;
}

export interface ShopItem {
  readonly category: number;
  readonly itemId: number;
  readonly kind: string;
  /** CN name, or "internalId (itemId)" when item.kml has none. */
  readonly name: string;
  readonly desc?: string;
  readonly internalId: string;
  readonly tab: string;
  readonly subTab: string;
  /**
   * The original mall (catalog shopTabs): ShopCat kartBody / character /
   * equip / useful and its SubCat (engineXun, balloon, couple, card, ...;
   * none in character). Couple equipment lists both of its SubCats in
   * shopSubCategories (absent = just shopSubCategory).
   */
  readonly shopCategory?: string;
  readonly shopSubCategory?: string;
  readonly shopSubCategories?: readonly string[];
  /** The offer the original card shows. */
  readonly displayOfferId?: string;
  readonly engineGrade?: number;
  /** Karts only: 1 item kart, 2 speed kart. */
  readonly kartType?: number;
  readonly isAdditional?: boolean;
  /** The 推荐 SubCats (new / hotItem / event) whose cards list the item. */
  readonly recommend?: readonly string[];
  /** Card badges: "new" | "hot" | "discount" | "limited" (限购). */
  readonly marks?: readonly string[];
  readonly offers: readonly ShopOffer[];
}

export interface ShopCatalogSubTab { readonly id: string; readonly name: string }

/** A SubCat of the original mall; cardItems are "category:itemId" keys in card order. */
export interface ShopMallSubTab { readonly id: string; readonly name: string; readonly cardItems: readonly string[] }

/** A ShopCat of the original mall (recommand, kartBody, character, package, equip, useful). */
export interface ShopMallTab {
  readonly id: string;
  readonly name: string;
  /** Label of the leading 全部 sub-tab, absent when there is none. */
  readonly allSubTab?: string;
  /** The sub-tab opened first when there is no 全部 (推荐: new). */
  readonly defaultSubTab?: string;
  readonly subTabs: readonly ShopMallSubTab[];
  /** Card-listed items of a tab without SubCats. */
  readonly cardItems?: readonly string[];
}

export interface ShopCatalogTab {
  readonly id: string;
  readonly name: string;
  readonly subTabs: readonly ShopCatalogSubTab[];
}

export interface ShopCurrencyInfo {
  readonly id: Currency;
  readonly name: string;
  readonly priceType: number;
}

export interface ShopCatalog {
  readonly version: string;
  readonly currencies: readonly ShopCurrencyInfo[];
  readonly tabs: readonly ShopCatalogTab[];
  /** The original mall layout; empty for catalogs that predate it. */
  readonly shopTabs: readonly ShopMallTab[];
  readonly items: readonly ShopItem[];
}

/** A catalog document that does not have the agreed shape. */
export class ShopCatalogError extends Error {
  constructor(readonly path: string, detail: string) {
    super(`商店目录 ${path} ${detail}`);
    this.name = "ShopCatalogError";
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown, path: string): Json {
  if (!isObject(value)) throw new ShopCatalogError(path, "必须是对象");
  return value;
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new ShopCatalogError(path, "必须是数组");
  return value;
}

function text(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0))
    throw new ShopCatalogError(path, "必须是非空字符串");
  return value;
}

function optionalText(value: unknown, path: string): string | undefined {
  return value === undefined || value === null ? undefined : text(value, path, true);
}

function integer(value: unknown, path: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
    throw new ShopCatalogError(path, `必须是不小于 ${minimum} 的整数`);
  return value;
}

function optionalInteger(value: unknown, path: string, minimum: number): number | undefined {
  return value === undefined || value === null ? undefined : integer(value, path, minimum);
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new ShopCatalogError(path, "必须是布尔值");
  return value;
}

function optionalTexts(value: unknown, path: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return array(value, path).map((entry, index) => text(entry, `${path}[${index}]`));
}

export function isShopCurrency(value: unknown): value is Currency {
  return value === "coupon" || value === "lucci" || value === "koin";
}

function parseOffer(value: unknown, path: string): ShopOffer | undefined {
  const raw = object(value, path);
  const offerId = text(raw.offerId, `${path}.offerId`);
  if (offerId.length > 64) throw new ShopCatalogError(`${path}.offerId`, "过长");
  const currency = text(raw.currency, `${path}.currency`);
  const price = integer(raw.price, `${path}.price`, 1);
  const days = integer(raw.days, `${path}.days`, 0);
  const count = integer(raw.count, `${path}.count`, 1);
  const minExp = optionalInteger(raw.minExp, `${path}.minExp`, 0);
  const source = text(raw.source, `${path}.source`);
  const originalPrice = optionalInteger(raw.originalPrice, `${path}.originalPrice`, 1);
  const discountPercent = optionalInteger(raw.discountPercent, `${path}.discountPercent`, 1);
  const discountLabel = optionalText(raw.discountLabel, `${path}.discountLabel`);
  const limited = optionalBoolean(raw.limited, `${path}.limited`);
  const buyLimit = optionalInteger(raw.buyLimit, `${path}.buyLimit`, 0);
  // A wallet the browser does not know (e.g. a future 幸运币) cannot be shown.
  if (!isShopCurrency(currency)) return undefined;
  return {
    offerId, currency, price, days, count, source,
    ...(minExp ? { minExp } : {}),
    ...(originalPrice && originalPrice > price
      ? { originalPrice, ...(discountPercent ? { discountPercent } : {}), ...(discountLabel ? { discountLabel } : {}) }
      : {}),
    ...(limited ? { limited } : {}),
    ...(limited && buyLimit ? { buyLimit } : {}),
  };
}

function parseItem(value: unknown, path: string, offerIds: Set<string>): ShopItem | undefined {
  const raw = object(value, path);
  const category = integer(raw.category, `${path}.category`, 1);
  const itemId = integer(raw.itemId, `${path}.itemId`, 0);
  const offers: ShopOffer[] = [];
  array(raw.offers, `${path}.offers`).forEach((entry, index) => {
    const offer = parseOffer(entry, `${path}.offers[${index}]`);
    if (!offer) return;
    if (offerIds.has(offer.offerId))
      throw new ShopCatalogError(`${path}.offers[${index}].offerId`, `重复：${offer.offerId}`);
    offerIds.add(offer.offerId);
    offers.push(offer);
  });
  const marksValue = raw.marks;
  const marks = marksValue === undefined || marksValue === null ? undefined :
    array(marksValue, `${path}.marks`).map((mark, index) => text(mark, `${path}.marks[${index}]`));
  const item: ShopItem = {
    category, itemId,
    kind: text(raw.kind, `${path}.kind`),
    name: text(raw.name, `${path}.name`),
    internalId: text(raw.internalId, `${path}.internalId`, true),
    tab: text(raw.tab, `${path}.tab`),
    subTab: text(raw.subTab, `${path}.subTab`),
    offers,
  };
  const desc = optionalText(raw.desc, `${path}.desc`);
  const engineGrade = optionalInteger(raw.engineGrade, `${path}.engineGrade`, 0);
  const kartType = optionalInteger(raw.kartType, `${path}.kartType`, 0);
  const isAdditional = optionalBoolean(raw.isAdditional, `${path}.isAdditional`);
  // An older catalog said recommend: true (on any current card); it names no 推荐 page.
  const recommend = typeof raw.recommend === "boolean" ? undefined
    : optionalTexts(raw.recommend, `${path}.recommend`);
  const shopCategory = optionalText(raw.shopCategory, `${path}.shopCategory`);
  const shopSubCategory = optionalText(raw.shopSubCategory, `${path}.shopSubCategory`);
  const shopSubCategories = optionalTexts(raw.shopSubCategories, `${path}.shopSubCategories`);
  const displayOfferId = optionalText(raw.displayOfferId, `${path}.displayOfferId`);
  // Items whose only offers use an unknown currency have nothing to sell.
  if (!offers.length) return undefined;
  return {
    ...item,
    ...(desc ? { desc } : {}),
    ...(shopCategory ? { shopCategory } : {}),
    ...(shopSubCategory ? { shopSubCategory } : {}),
    ...(shopSubCategories?.length ? { shopSubCategories } : {}),
    // The shown offer may be in a currency this browser dropped.
    ...(displayOfferId && offers.some(offer => offer.offerId === displayOfferId) ? { displayOfferId } : {}),
    ...(engineGrade !== undefined ? { engineGrade } : {}),
    ...(kartType !== undefined ? { kartType } : {}),
    ...(isAdditional ? { isAdditional } : {}),
    ...(recommend?.length ? { recommend } : {}),
    ...(marks?.length ? { marks } : {}),
  };
}

function parseTabs(value: unknown): ShopCatalogTab[] {
  const ids = new Set<string>();
  return array(value, "tabs").map((entry, index) => {
    const path = `tabs[${index}]`;
    const raw = object(entry, path);
    const id = text(raw.id, `${path}.id`);
    if (ids.has(id)) throw new ShopCatalogError(`${path}.id`, `重复：${id}`);
    ids.add(id);
    const subTabs = raw.subTabs === undefined || raw.subTabs === null ? [] :
      array(raw.subTabs, `${path}.subTabs`).map((sub, subIndex) => {
        const subRaw = object(sub, `${path}.subTabs[${subIndex}]`);
        return {
          id: text(subRaw.id, `${path}.subTabs[${subIndex}].id`),
          name: text(subRaw.name, `${path}.subTabs[${subIndex}].name`, true),
        };
      });
    return { id, name: text(raw.name, `${path}.name`, true), subTabs };
  });
}

function parseShopTabs(value: unknown): ShopMallTab[] {
  if (value === undefined || value === null) return [];
  const ids = new Set<string>();
  return array(value, "shopTabs").map((entry, index) => {
    const path = `shopTabs[${index}]`;
    const raw = object(entry, path);
    const id = text(raw.id, `${path}.id`);
    if (ids.has(id)) throw new ShopCatalogError(`${path}.id`, `重复：${id}`);
    ids.add(id);
    const subTabs = array(raw.subTabs ?? [], `${path}.subTabs`).map((sub, subIndex) => {
      const subPath = `${path}.subTabs[${subIndex}]`;
      const subRaw = object(sub, subPath);
      return {
        id: text(subRaw.id, `${subPath}.id`),
        name: text(subRaw.name, `${subPath}.name`, true),
        cardItems: optionalTexts(subRaw.cardItems, `${subPath}.cardItems`) ?? [],
      };
    });
    const allSubTab = optionalText(raw.allSubTab, `${path}.allSubTab`);
    const defaultSubTab = optionalText(raw.defaultSubTab, `${path}.defaultSubTab`);
    const cardItems = optionalTexts(raw.cardItems, `${path}.cardItems`);
    return {
      id, name: text(raw.name, `${path}.name`, true), subTabs,
      ...(allSubTab ? { allSubTab } : {}),
      ...(defaultSubTab ? { defaultSubTab } : {}),
      ...(cardItems ? { cardItems } : {}),
    };
  });
}

function parseCurrencies(value: unknown): ShopCurrencyInfo[] {
  if (value === undefined || value === null) return [];
  return array(value, "currencies").flatMap((entry, index) => {
    const raw = object(entry, `currencies[${index}]`);
    const id = text(raw.id, `currencies[${index}].id`);
    const name = text(raw.name, `currencies[${index}].name`, true);
    const priceType = integer(raw.priceType, `currencies[${index}].priceType`, 0);
    return isShopCurrency(id) ? [{ id, name, priceType }] : [];
  });
}

/**
 * Validates a parsed /api/shop/catalog body. Malformed fields throw
 * ShopCatalogError; offers in a currency the wallet does not have are
 * dropped (and items left without offers). Unknown extra fields are ignored.
 */
export function parseShopCatalog(value: unknown): ShopCatalog {
  const raw = object(value, "根");
  const version = text(raw.version, "version");
  const offerIds = new Set<string>();
  const keys = new Set<string>();
  const items: ShopItem[] = [];
  array(raw.items, "items").forEach((entry, index) => {
    const item = parseItem(entry, `items[${index}]`, offerIds);
    if (!item) return;
    const key = `${item.category}:${item.itemId}`;
    if (keys.has(key)) throw new ShopCatalogError(`items[${index}]`, `物品重复：${key}`);
    keys.add(key);
    items.push(item);
  });
  return { version, currencies: parseCurrencies(raw.currencies), tabs: parseTabs(raw.tabs),
    shopTabs: parseShopTabs(raw.shopTabs), items };
}
