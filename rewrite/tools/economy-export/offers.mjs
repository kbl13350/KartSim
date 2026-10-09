// Offer selection and price estimation (server-go/ECONOMY.md 3.2). Pure
// functions over parsed shop tables, so the rules can be tested in isolation.

export const CURRENCY_BY_PRICE_TYPE = new Map([[0, "coupon"], [1, "lucci"], [3, "koin"]]);
export const CURRENCY_ORDER = ["coupon", "lucci", "koin"];
/** Placeholder prices that mean "not for sale" in the original data. */
export const LUCCI_PLACEHOLDER_MIN = 1_000_000;
export const COUPON_PLACEHOLDER_MIN = 100_000;
/**
 * Lucci prices below this are event tokens, not prices: 111 stocks cost
 * 1 lucci with onBuyOk='setEventTemp..' hooks (e.g. "棉花糖 X(30 天)" for 1),
 * plus one 8-lucci one-time VIP giveaway. Real lucci prices start at 100.
 * This extends ECONOMY.md 3.2's placeholder list (lucci 0 / >= 1,000,000).
 */
export const LUCCI_TOKEN_MAX = 9;
/**
 * Event redemptions in coupon and koin. A stock with an event hook
 * (onBuyOk='setEventTemp..') priced below this share of the median ordinary
 * (hook-less) price for the same category, currency, days and count is an
 * event token like the 1-lucci stocks, e.g. "[彩虹周]终极部件 X" permanent
 * for 10 coupon, the "9"-series karts for 11 koin, or 30-day karts for 10.
 */
export const EVENT_TOKEN_RATIO = 0.25;
export const EVENT_HOOK = /^setEventTemp/;
/** Restriction tokens that do not limit who may buy (luccon is unsupported anyway). */
export const HARMLESS_RESTRICTIONS = new Set(["notLucconBuy", "notrefundable"]);
export const ESTIMATED_RENTAL_DAYS = 30;

const currencyRank = currency => CURRENCY_ORDER.indexOf(currency);

export function median(values) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Why a stock cannot become an offer, or undefined when it can. */
export function stockRejection(stock) {
  if (stock.items.length !== 1) return "bundle";
  if (!stock.isOnSale) return "notOnSale";
  if (stock.price === undefined || stock.priceType === undefined) return "noPrice";
  if (stock.priceType === 2) return "luccon";
  if (!CURRENCY_BY_PRICE_TYPE.has(stock.priceType)) return `priceType${stock.priceType}`;
  if (stock.price <= 0) return "zeroPrice";
  if (stock.priceType === 1 && stock.price >= LUCCI_PLACEHOLDER_MIN) return "lucciPlaceholder";
  if (stock.priceType === 1 && stock.price <= LUCCI_TOKEN_MAX) return "lucciTokenPrice";
  if (stock.priceType === 0 && stock.price >= COUPON_PLACEHOLDER_MIN) return "couponPlaceholder";
  if (stock.isOnceADay) return "onceADay";
  if (stock.restriction && !stock.restriction.split("|").every(token =>
    HARMLESS_RESTRICTIONS.has(token.trim()))) {
    return stock.restriction.startsWith("couple") ? "coupleRestriction" : "specialRestriction";
  }
  if (stock.items[0].count < 1) return "zeroCount";
  return undefined;
}

/** shopCat.xml ShopCats named recommand<N> are the dated 推荐 pages. */
export const RECOMMEND_GROUP = /^recommand\d*$/;

/**
 * The 推荐 page the shop shows: the recommand ShopCat whose salePeriod is
 * open-ended ("from~*"), the latest start among several; when none is
 * open-ended, the one with the latest start. Choosing by the data instead of
 * the clock keeps the export deterministic (the earlier pages have ended).
 */
export function latestRecommendGroup(shopCatRefs) {
  const pages = new Map();
  for (const ref of shopCatRefs)
    if (RECOMMEND_GROUP.test(ref.group) && !pages.has(ref.group)) pages.set(ref.group, ref.salePeriod ?? "");
  const ranked = [...pages].map(([group, period]) => {
    const [from = "", to = ""] = period.split("~").map(part => part.trim());
    return { group, from, open: to === "*" };
  }).sort((a, b) => Number(b.open) - Number(a.open) || (a.from < b.from ? 1 : a.from > b.from ? -1 : 0) ||
    (a.group < b.group ? 1 : a.group > b.group ? -1 : 0));
  return ranked[0]?.group;
}

/**
 * Cards visible in the current shop: referenced from the latest 推荐 page
 * (latestRecommendGroup) or a ShopCat other than "hide" and the older
 * recommand pages, present in stockCard.xml, on sale, and not saleFlag 1
 * ("cannot buy"). Card salePeriod dates are ignored so the export is
 * deterministic; the shipped file is treated as the current snapshot.
 */
export function currentCardRefs(shopCatRefs, cards) {
  const latest = latestRecommendGroup(shopCatRefs);
  return shopCatRefs.filter(ref => {
    if (ref.group === "hide" || (RECOMMEND_GROUP.test(ref.group) && ref.group !== latest)) return false;
    const card = cards.get(ref.cardId);
    return card !== undefined && card.isOnSale && card.saleFlag !== "1";
  }).map(ref => ({ ...ref, card: cards.get(ref.cardId) }));
}

/**
 * Card badge (stage_mqShop eventTag image) for a shopCat.xml shopMark:
 * new -> new@cn 新品, hot -> hot@cn 人气 (yellow star), discount<NN> ->
 * discount10/30/60@cn with the 折 label, eventBuyCount -> eventbuycount@cn
 * 限购 ("limited"). Unknown marks are undefined.
 */
export function markFor(shopMark) {
  if (shopMark === "new" || shopMark === "hot") return shopMark;
  if (shopMark === "eventBuyCount") return "limited";
  if (discountPercentOf(shopMark) !== undefined) return "discount";
  return undefined;
}

/** The NN of a discount<NN> shopMark: percent off (discount10 = 10% off), 1..99. */
export function discountPercentOf(shopMark) {
  const match = /^discount(\d+)$/.exec(shopMark ?? "");
  if (!match) return undefined;
  const percent = Number(match[1]);
  return percent >= 1 && percent <= 99 ? percent : undefined;
}

/**
 * The card's 折 label: (100 - NN) / 10 followed by the stage_mqShop string
 * "discount" (CN "折"), one decimal only when needed: discount10 -> "9折",
 * discount40 -> "6折", discount44 -> "5.6折".
 */
export function discountLabel(percent, suffix = "折") {
  const tenths = 100 - percent;
  return `${tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1)}${suffix}`;
}

/**
 * One offer per (item, currency, days, count): a stock on a current card
 * first, then the highest stockId.
 * @param entries [{key, offer}] where offer has stockId and carded
 * @returns {offers: Map key -> offer[], duplicateGroups}
 */
function chooseOffers(entries) {
  const groups = new Map();
  for (const { key, offer } of entries) {
    const groupKey = `${key}|${offer.currency}|${offer.days}|${offer.count}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), offer]);
  }
  const offers = new Map();
  let duplicateGroups = 0;
  for (const [groupKey, candidates] of groups) {
    if (candidates.length > 1) duplicateGroups++;
    candidates.sort((a, b) => Number(b.carded) - Number(a.carded) || b.stockId - a.stockId);
    const key = groupKey.slice(0, groupKey.indexOf("|"));
    offers.set(key, [...(offers.get(key) ?? []), candidates[0]]);
  }
  return { offers, duplicateGroups };
}

const termsKey = (key, offer) =>
  `${key.slice(0, key.indexOf(":"))}|${offer.currency}|${offer.days}|${offer.count}`;

/**
 * True when `other` is at least as good a buy as `offer`: same currency, no
 * higher price, at least as long (permanent beats any rental), at least as
 * many items, and no higher exp requirement. Offers of one item never tie on
 * all terms (one offer per currency, days and count), so this is a strict
 * order and removing every dominated offer keeps the best ones.
 */
export function dominates(other, offer) {
  const covers = other.days === 0 || (offer.days !== 0 && other.days >= offer.days);
  return other !== offer && other.currency === offer.currency && other.price <= offer.price &&
    covers && other.count >= offer.count && (other.minExp ?? 0) <= (offer.minExp ?? 0);
}

/**
 * Pick original offers for every sellable item.
 *  1. single-item stocks that pass stockRejection;
 *  2. minus event tokens: event-hook stocks priced below EVENT_TOKEN_RATIO of
 *     the median ordinary price for the same category, currency, days and
 *     count (median over items, one chosen ordinary offer per item);
 *  3. one offer per (item, currency, days, count) (chooseOffers);
 *  4. minus offers another offer of the item dominates (e.g. a 30-day rental
 *     that costs as much as permanent, an old 7-day price next to a 15-day
 *     one at the same price, or a 30-balloon pack dearer than the 50-pack).
 * Card layout, badges and discounts are shop-layout.mjs.
 * @param sellable Map key "cat:id" -> item (any shape)
 * @param stocks Map stockId -> parsed stock
 * @param currentRefs output of currentCardRefs
 * @returns {offers: Map key -> offer[], rejections, duplicateGroups,
 *   dominated: [{key, offer, by}], eventTokens}
 */
export function selectOriginalOffers(sellable, stocks, currentRefs) {
  const carded = new Set(currentRefs.flatMap(ref => ref.card.stockIds));
  const rejections = {};
  const reject = reason => { rejections[reason] = (rejections[reason] ?? 0) + 1; };
  const usable = [];
  for (const stock of stocks.values()) {
    if (stock.items.length !== 1) continue;
    const item = stock.items[0];
    const key = `${item.category}:${item.itemId}`;
    if (!sellable.has(key)) continue;
    const reason = stockRejection(stock);
    if (reason) { reject(reason); continue; }
    usable.push({ key, event: EVENT_HOOK.test(stock.onBuyOk ?? ""), offer: {
      offerId: `s${stock.stockId}`,
      stockId: stock.stockId,
      currency: CURRENCY_BY_PRICE_TYPE.get(stock.priceType),
      price: stock.price,
      days: item.days,
      count: item.count,
      source: "original",
      minExp: stock.rpLimit,
      carded: carded.has(stock.stockId),
    } });
  }

  const ordinary = new Map();
  for (const [key, offers] of chooseOffers(usable.filter(entry => !entry.event)).offers)
    for (const offer of offers) {
      const terms = termsKey(key, offer);
      ordinary.set(terms, [...(ordinary.get(terms) ?? []), offer.price]);
    }
  const eventTokens = [];
  const kept = usable.filter(entry => {
    if (!entry.event) return true;
    const reference = median(ordinary.get(termsKey(entry.key, entry.offer)) ?? []);
    if (reference === undefined || entry.offer.price >= EVENT_TOKEN_RATIO * reference) return true;
    reject("eventTokenPrice");
    eventTokens.push({ key: entry.key, offer: entry.offer, reference });
    return false;
  });

  const { offers: chosen, duplicateGroups } = chooseOffers(kept);
  const offers = new Map();
  const dominated = [];
  for (const [key, list] of chosen) {
    const best = [];
    for (const offer of list) {
      const by = list.find(other => dominates(other, offer));
      if (by) dominated.push({ key, offer, by });
      else best.push(offer);
    }
    offers.set(key, best);
  }

  return { offers, rejections, duplicateGroups, dominated, eventTokens };
}

function mostFrequentCurrency(offerLists) {
  const counts = new Map();
  for (const offers of offerLists)
    for (const offer of offers) counts.set(offer.currency, (counts.get(offer.currency) ?? 0) + 1);
  if (counts.size === 0) return undefined;
  return [...counts].sort((a, b) => b[1] - a[1] || currencyRank(a[0]) - currencyRank(b[0]))[0][0];
}

function roundPrice(value) {
  return Math.max(1, Math.round(value));
}

/**
 * Estimated offers for items without any usable original offer.
 *
 * Pricing pools are tried from narrow to wide: (karts only) same engineGrade,
 * then the category, then the item's shop sub-tab, then its tab, then every
 * category. Within a pool only original offers in the chosen currency count,
 * one price per item.
 *
 *  - currency: most frequent original offer currency of the narrowest pool
 *    (category, sub-tab, tab, all) that has any offer; ties prefer
 *    coupon > lucci > koin.
 *  - permanent price: median permanent price (days 0) in that currency. For
 *    count-based categories (isAdditional, e.g. balloons) the permanent
 *    offers are packs; the estimate uses the pool's most frequent pack size
 *    and the median price for that size.
 *  - 30-day price: permanent x the median 30-day/permanent ratio over items
 *    that have both offers (count 1) in the same currency, all categories.
 *    Count-based categories get no rental estimate: the original never
 *    rents them.
 *  - When a pool has timed offers but no permanent ones, the permanent price
 *    is the pool's median 30-day price divided by the ratio.
 *  - Rental-only categories (isRentalOnly: no stock in stock.kml ever grants
 *    the category permanently, e.g. the rpLucciBonus exp/lucci cards) get no
 *    permanent and no 30-day estimate. They get one rental of the pool's
 *    most common rental length (ties: the longer one) at the median price
 *    for that length.
 */
export function estimateOffers({ sellable, originalOffers, poolOf, isCountBased,
  isRentalOnly = () => false }) {
  const priced = [...originalOffers].filter(([, offers]) => offers.length > 0);
  const ratios = [];
  for (const [, offers] of priced) {
    for (const permanent of offers.filter(offer => offer.days === 0 && offer.count === 1)) {
      const rental = offers.find(offer => offer.days === ESTIMATED_RENTAL_DAYS &&
        offer.count === 1 && offer.currency === permanent.currency);
      if (rental) ratios.push(rental.price / permanent.price);
    }
  }
  const rentalRatio = median(ratios);
  if (rentalRatio === undefined) throw new Error("no item has both a 30-day and a permanent offer");

  // pools: list of pool ids from narrow to wide, per item key.
  const members = new Map();
  for (const key of sellable.keys())
    for (const pool of poolOf(key)) members.set(pool, [...(members.get(pool) ?? []), key]);
  const poolOffers = pool => (members.get(pool) ?? []).map(key => originalOffers.get(key) ?? []);

  const estimates = new Map();
  const notes = new Map();
  for (const [key, item] of sellable) {
    if ((originalOffers.get(key) ?? []).length > 0) continue;
    const pools = poolOf(key);
    // The kart engine-grade pool is a price pool only; currency comes from the category up.
    const currencyPools = pools.filter(pool => !pool.startsWith("grade:"));
    let currency;
    for (const pool of currencyPools) {
      currency = mostFrequentCurrency(poolOffers(pool));
      if (currency) break;
    }
    if (!currency) throw new Error(`${key}: no currency source in any pool`);
    const [category, itemId] = key.split(":");
    if (isRentalOnly(key)) {
      const rental = estimateRental(pools.map(pool => [pool, poolOffers(pool)]), currency);
      if (!rental) throw new Error(`${key}: rental-only, but no rental price in any pool`);
      estimates.set(key, [{
        offerId: `e${category}-${itemId}-${rental.days}`,
        currency, price: roundPrice(rental.price), days: rental.days, count: 1, source: "estimated",
      }]);
      notes.set(key, rental.pool);
      continue;
    }
    const countBased = isCountBased(key);

    let permanent;
    let count = 1;
    let usedPool;
    for (const pool of pools) {
      const lists = poolOffers(pool);
      if (countBased) {
        const packs = lists.flatMap(offers => offers.filter(offer =>
          offer.days === 0 && offer.currency === currency));
        if (packs.length === 0) continue;
        const sizes = new Map();
        for (const offer of packs) sizes.set(offer.count, (sizes.get(offer.count) ?? 0) + 1);
        count = [...sizes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
        permanent = median(packs.filter(offer => offer.count === count).map(offer => offer.price));
      } else {
        const prices = lists.flatMap(offers => {
          const offer = offers.find(entry => entry.days === 0 && entry.count === 1 &&
            entry.currency === currency);
          return offer ? [offer.price] : [];
        });
        permanent = median(prices);
        if (permanent === undefined) {
          const rentals = lists.flatMap(offers => {
            const offer = offers.find(entry => entry.days === ESTIMATED_RENTAL_DAYS &&
              entry.count === 1 && entry.currency === currency);
            return offer ? [offer.price] : [];
          });
          const rental = median(rentals);
          if (rental !== undefined) permanent = rental / rentalRatio;
        }
      }
      if (permanent !== undefined) { usedPool = pool; break; }
    }
    if (permanent === undefined) throw new Error(`${key}: no price source in any pool`);
    const offers = [{
      offerId: `e${category}-${itemId}-0`,
      currency, price: roundPrice(permanent), days: 0, count, source: "estimated",
    }];
    if (!countBased) {
      offers.push({
        offerId: `e${category}-${itemId}-${ESTIMATED_RENTAL_DAYS}`,
        currency, price: roundPrice(roundPrice(permanent) * rentalRatio),
        days: ESTIMATED_RENTAL_DAYS, count: 1, source: "estimated",
      });
    }
    estimates.set(key, offers);
    notes.set(key, usedPool);
  }
  return { estimates, rentalRatio, ratioSamples: ratios.length, pools: notes };
}

/** Most common single-item rental length in the first pool that has one, and its median price. */
function estimateRental(pools, currency) {
  for (const [pool, lists] of pools) {
    const byDays = new Map();
    for (const offers of lists)
      for (const offer of offers)
        if (offer.days > 0 && offer.count === 1 && offer.currency === currency)
          byDays.set(offer.days, [...(byDays.get(offer.days) ?? []), offer.price]);
    if (byDays.size === 0) continue;
    const [days, prices] = [...byDays].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0];
    return { pool, days, price: median(prices) };
  }
  return undefined;
}

/** Display order: currency, then rentals by length, permanent last, then pack size. */
export function compareOffers(a, b) {
  const days = value => (value === 0 ? Number.MAX_SAFE_INTEGER : value);
  return currencyRank(a.currency) - currencyRank(b.currency) ||
    days(a.days) - days(b.days) || a.count - b.count ||
    (a.offerId < b.offerId ? -1 : a.offerId > b.offerId ? 1 : 0);
}
