// The original CN mall layout (zeta_/cn/shop/data/shopCat.xml as the
// stage_mqShop window shows it) applied to the sellable items
// (server-go/ECONOMY.md 3.2): the ShopCat / SubCat each item belongs to, the
// items the original cards list (and in which order), the 推荐 sub-pages,
// card badges, discounts, 限购 and the one price a card shows. Pure functions
// over the parsed shop tables.
import { compareOffers, currentCardRefs, CURRENCY_ORDER, discountLabel, discountPercentOf, latestRecommendGroup,
  markFor, RECOMMEND_GROUP } from "./offers.mjs";

/** The shown 推荐 tab: whichever recommand<N> page is current, under one id. */
export const RECOMMEND_TAB = "recommand";
/** ShopCats the window has no tab for: hidden cards and the kart pass page. */
export const HIDDEN_SHOP_CATS = new Set(["hide", "kartPass"]);
export const COUPLE_SUB_CATEGORY = "couple";
/** Badge kinds in display priority. */
export const MARK_ORDER = ["new", "hot", "discount", "limited"];
/**
 * A discount<NN> card may round: price / originalPrice must be within this
 * many percentage points of NN% off (card 4365: 499 / 558 = 10.6% off,
 * discount10).
 */
export const DISCOUNT_TOLERANCE_POINTS = 2;

/**
 * kind -> [ShopCat, SubCat] for everything but karts. The mall's ShopCats
 * are recommand / kartBody / character / package / equip / useful; the
 * SubCats come from the current shopCat.xml cards where the original lists
 * the kind (balloon, headband, goggle, color, dye; handGearL under equip/etc;
 * rpLucciBonus under useful/card; headPhone under useful/etc; characters in
 * character, which has no SubCats). Kinds no current card lists follow
 * itemCat2ShopCat.bml: pets and flying pets are character-tab kinds (8001),
 * the 8004 decoration kinds go to equip/etc (the mall has no decoration
 * page), and the item-skin and tachometer cards ("...카드" internal ids) join
 * the other cards under useful/card.
 */
export const KIND_SHOP_CATEGORY = {
  character: ["character"], pet: ["character"], flyingPet: ["character"],
  balloon: ["equip", "balloon"], headBand: ["equip", "headband"], goggle: ["equip", "goggle"],
  color: ["equip", "color"], dye: ["equip", "dye"],
  handGearL: ["equip", "etc"], aura: ["equip", "etc"], skidMark: ["equip", "etc"], plate: ["equip", "etc"],
  uniform: ["equip", "etc"], decal: ["equip", "etc"], ridColor: ["equip", "etc"], slotBg: ["equip", "etc"],
  rpLucciBonus: ["useful", "card"], goItemSkinCard: ["useful", "card"], tachometer: ["useful", "card"],
  headPhone: ["useful", "etc"],
};

/**
 * Kart engine family -> kartBody SubCat. itemTable.kml <kart engineGrade>
 * (the value garage-catalog.ts carries, and the one GarageX uses for its
 * XUN / V1 part families): 9 = 迅 (XUN) -> engineXun, 8 = V1 -> engineV1,
 * every older engine (0-7: classic .. X) -> engineEtc 其他引擎.
 */
export function kartEngineSubCategory(engineGrade) {
  return engineGrade === 9 ? "engineXun" : engineGrade === 8 ? "engineV1" : "engineEtc";
}

/** A stock.kml restriction that limits the stock to couples (couple, couple2..couple5). */
export function isCoupleRestriction(restriction) {
  return (restriction ?? "").split("|").some(token => /^couple\d*$/.test(token.trim()));
}

/** Sellable items the original sells in a couple-restricted single-item stock. */
export function coupleItems(sellable, stocks) {
  const keys = new Set();
  for (const stock of stocks.values()) {
    if (stock.items.length !== 1 || !isCoupleRestriction(stock.restriction)) continue;
    const key = `${stock.items[0].category}:${stock.items[0].itemId}`;
    if (sellable.has(key)) keys.add(key);
  }
  return keys;
}

/**
 * The ShopCat and SubCat(s) of a sellable item. Couple equipment is listed
 * twice by the original (its kind's SubCat and couple); shopSubCategory is
 * then "couple" and shopSubCategories lists both in the ShopCat's SubCat
 * order. Couple karts and pets stay in their own ShopCat.
 * @param subCatOrder Map ShopCat -> SubCat names in shopCat.xml order
 */
export function shopPlacement(item, couple, subCatOrder) {
  if (item.kind === "kart") {
    return { shopCategory: "kartBody", shopSubCategory: kartEngineSubCategory(item.engineGrade) };
  }
  const placement = KIND_SHOP_CATEGORY[item.kind];
  if (!placement) return undefined;
  const [shopCategory, subCategory] = placement;
  if (!subCategory) return { shopCategory };
  if (!couple || shopCategory !== "equip") return { shopCategory, shopSubCategory: subCategory };
  const order = subCatOrder.get(shopCategory) ?? [];
  const rank = name => (order.indexOf(name) + 1 || order.length + 1);
  const shopSubCategories = [subCategory, COUPLE_SUB_CATEGORY].sort((a, b) => rank(a) - rank(b));
  return { shopCategory, shopSubCategory: COUPLE_SUB_CATEGORY, shopSubCategories };
}

/** Single-item stocks of sellable items on a card, in card order: [{key, stockId}]. */
export function cardListing(card, stocks, sellable) {
  return card.stockIds.flatMap(stockId => {
    const stock = stocks.get(stockId);
    if (!stock || stock.items.length !== 1) return [];
    const key = `${stock.items[0].category}:${stock.items[0].itemId}`;
    return sellable.has(key) ? [{ key, stockId }] : [];
  });
}

const cheapestFirst = (a, b) => CURRENCY_ORDER.indexOf(a.currency) - CURRENCY_ORDER.indexOf(b.currency) ||
  a.price - b.price || compareOffers(a, b);

/**
 * Lay the sellable items out like the original mall.
 *
 * @param sellable Map key -> {kind, engineGrade, ...}
 * @param stocks Map stockId -> parsed stock
 * @param cards Map cardId -> parsed stockCard
 * @param shopCatRefs parseShopCats output (every ShopCat, file order)
 * @param offers Map key -> the item's final offers ({offerId, currency, price, days, count})
 * @param couple Set of couple item keys (coupleItems)
 * @param label (stringKey) -> CN label or undefined (stage_mqShop bag, then the base bag)
 * @param problem (message) -> void
 * @returns {tabs, placements: Map key -> placement, recommend: Map key -> [SubCat],
 *   marks: Map key -> [mark], offerNotes: Map offerId -> {originalPrice?, discountPercent?,
 *   discountLabel?, limited?, buyLimit?}, displayOffers: Map key -> offerId, stats}
 */
export function layoutShop({ sellable, stocks, cards, shopCatRefs, offers, couple, label, problem }) {
  const latest = latestRecommendGroup(shopCatRefs);
  if (!latest) problem("shopCat.xml has no recommand ShopCat");
  const tabIdOf = group => (RECOMMEND_GROUP.test(group) ? RECOMMEND_TAB : group);
  const shown = group => !HIDDEN_SHOP_CATS.has(group) && (!RECOMMEND_GROUP.test(group) || group === latest);

  // Tabs and SubCats in shopCat.xml order (including refs to missing cards).
  const tabs = [];
  const tabById = new Map();
  for (const ref of shopCatRefs) {
    if (!shown(ref.group)) continue;
    const id = tabIdOf(ref.group);
    let tab = tabById.get(id);
    if (!tab) tabById.set(id, tab = { id, group: ref.group, subCats: [], direct: false, keys: [] });
    if (tab.group !== ref.group) problem(`two shown ShopCats map to tab ${id}: ${tab.group}, ${ref.group}`);
    if (!ref.subCat) { tab.direct = true; continue; }
    if (!tab.subCats.some(sub => sub.id === ref.subCat)) tab.subCats.push({ id: ref.subCat, keys: [] });
  }
  for (const tab of tabById.values()) {
    if (tab.direct && tab.subCats.length > 0) problem(`ShopCat ${tab.group} mixes SubCats and direct cards`);
    tabs.push(tab);
  }
  const subCatOrder = new Map(tabs.map(tab => [tab.id, tab.subCats.map(sub => sub.id)]));

  const placements = new Map();
  for (const [key, item] of sellable) {
    const placement = shopPlacement(item, couple.has(key), subCatOrder);
    if (!placement) { problem(`${key} (${item.kind}): no ShopCat for this kind`); continue; }
    const tab = tabById.get(placement.shopCategory);
    if (!tab) { problem(`${key}: ShopCat ${placement.shopCategory} is not in shopCat.xml`); continue; }
    for (const sub of placement.shopSubCategories ?? [placement.shopSubCategory].filter(Boolean))
      if (!tab.subCats.some(entry => entry.id === sub)) problem(`${key}: SubCat ${placement.shopCategory}/${sub} is not in shopCat.xml`);
    if (!placement.shopSubCategory && tab.subCats.length > 0) problem(`${key}: ShopCat ${tab.id} needs a SubCat`);
    placements.set(key, placement);
  }

  // Card membership, 推荐 pages, badges, 限购 and discounts from the current cards.
  const offerById = new Map();
  for (const [key, list] of offers) for (const offer of list) offerById.set(offer.offerId, { key, offer });
  const recommend = new Map();
  const shopMarks = new Map();
  const offerNotes = new Map();
  const firstCards = new Map(); // key -> [listings of the cards listing it, file order]
  const stats = { cardRefs: 0, listedItems: 0, discounts: 0, limitedOffers: 0, engineCards: {} };
  const note = (offerId, fields) => {
    const previous = offerNotes.get(offerId) ?? {};
    for (const [field, value] of Object.entries(fields))
      if (previous[field] !== undefined && previous[field] !== value && field !== "buyLimit")
        problem(`${offerId}: ${field} ${previous[field]} and ${value} from two cards`);
    const merged = { ...previous, ...fields };
    if (previous.buyLimit && fields.buyLimit) merged.buyLimit = Math.min(previous.buyLimit, fields.buyLimit);
    offerNotes.set(offerId, merged);
  };

  for (const ref of currentCardRefs(shopCatRefs, cards)) {
    if (!shown(ref.group)) continue;
    stats.cardRefs++;
    const tab = tabById.get(tabIdOf(ref.group));
    const listing = cardListing(ref.card, stocks, sellable);
    const mark = markFor(ref.shopMark);
    if (ref.shopMark && !mark) problem(`shopCat ${ref.group}/${ref.subCat} card ${ref.cardId}: unknown shopMark ${ref.shopMark}`);
    const keys = [...new Set(listing.map(entry => entry.key))];
    const target = ref.subCat ? tab.subCats.find(sub => sub.id === ref.subCat) : tab;
    for (const key of keys) {
      if (!target.keys.includes(key)) target.keys.push(key);
      if (tab.id === RECOMMEND_TAB) {
        recommend.set(key, [...new Set([...(recommend.get(key) ?? []), ref.subCat])]);
      } else {
        // The original lists the item here: the derived placement must agree.
        const placement = placements.get(key);
        const subs = placement?.shopSubCategories ?? [placement?.shopSubCategory].filter(Boolean);
        if (!placement || placement.shopCategory !== tab.id || (ref.subCat && !subs.includes(ref.subCat)))
          problem(`${key} (${sellable.get(key).kind}) is on card ${ref.cardId} in ${tab.id}/${ref.subCat}, ` +
            `derived ${placement?.shopCategory}/${subs.join("+")}`);
        if (tab.id === "kartBody") {
          const grades = stats.engineCards[ref.subCat] ??= {};
          const grade = sellable.get(key).engineGrade;
          grades[grade] = (grades[grade] ?? 0) + 1;
        }
      }
      if (mark === "new" || mark === "hot") shopMarks.set(key, new Set([...(shopMarks.get(key) ?? []), mark]));
      firstCards.set(key, [...(firstCards.get(key) ?? []), listing.filter(entry => entry.key === key)]);
    }

    // 限购: the card's eventBuyCount (or an eventBuyCount shopMark) applies to its stocks.
    if (ref.card.eventBuyCount > 0 || mark === "limited") {
      let annotated = 0;
      for (const { stockId } of listing) {
        if (!offerById.has(`s${stockId}`)) continue;
        note(`s${stockId}`, { limited: true, ...(ref.card.eventBuyCount > 0 ? { buyLimit: ref.card.eventBuyCount } : {}) });
        annotated++;
      }
      if (annotated === 0 && listing.length > 0)
        stats.limitedWithoutOffer = (stats.limitedWithoutOffer ?? 0) + 1;
    }

    // Discount: originalPrice is the struck-through price of the stock the card shows.
    const percent = discountPercentOf(ref.shopMark);
    if (percent !== undefined && listing.length > 0) {
      const shownStock = listing.find(entry => offerById.has(`s${entry.stockId}`));
      if (ref.originalPrice === undefined) {
        problem(`card ${ref.cardId} (${ref.shopMark}) has no originalPrice`);
      } else if (!shownStock) {
        problem(`discounted card ${ref.cardId}: none of its stocks ${listing.map(entry => entry.stockId)} is an offer`);
      } else {
        const { offer } = offerById.get(`s${shownStock.stockId}`);
        const actual = 100 * (1 - offer.price / ref.originalPrice);
        if (offer.price >= ref.originalPrice || Math.abs(actual - percent) > DISCOUNT_TOLERANCE_POINTS)
          problem(`card ${ref.cardId}: ${offer.offerId} costs ${offer.price}, originalPrice ${ref.originalPrice} is ` +
            `${actual.toFixed(1)}% off, ${ref.shopMark} says ${percent}%`);
        note(offer.offerId, { originalPrice: ref.originalPrice, discountPercent: percent,
          discountLabel: discountLabel(percent, label("discount") ?? "折") });
      }
    }
  }

  // Badges: new/hot from the 推荐 page, discount and limited from the offers.
  const marks = new Map();
  for (const key of sellable.keys()) {
    const set = new Set(shopMarks.get(key) ?? []);
    for (const offer of offers.get(key) ?? []) {
      const notes = offerNotes.get(offer.offerId);
      if (notes?.originalPrice) set.add("discount");
      if (notes?.limited) set.add("limited");
    }
    if (set.size > 0) marks.set(key, MARK_ORDER.filter(mark => set.has(mark)));
  }
  for (const [key, subs] of recommend) {
    const order = subCatOrder.get(RECOMMEND_TAB) ?? [];
    subs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  stats.discounts = [...offerNotes.values()].filter(entry => entry.originalPrice).length;
  stats.limitedOffers = [...offerNotes.values()].filter(entry => entry.limited).length;

  // The one price a card shows: the first stock of the item's first current
  // card that is an offer; else the cheapest permanent offer; else the
  // cheapest offer (cheapest = lowest price in the first currency of
  // coupon, lucci, koin that has one).
  const displayOffers = new Map();
  const displayRules = { card: 0, cardFallback: 0, permanent: 0, cheapest: 0 };
  for (const [key, list] of offers) {
    const ids = new Set(list.map(offer => offer.offerId));
    const listings = firstCards.get(key) ?? [];
    let chosen;
    for (const [index, listing] of listings.entries()) {
      const entry = listing.find(candidate => ids.has(`s${candidate.stockId}`));
      if (!entry) continue;
      chosen = `s${entry.stockId}`;
      displayRules[index === 0 && listing[0].stockId === entry.stockId ? "card" : "cardFallback"]++;
      break;
    }
    if (!chosen) {
      const permanent = list.filter(offer => offer.days === 0).sort(cheapestFirst)[0];
      chosen = (permanent ?? [...list].sort(cheapestFirst)[0])?.offerId;
      displayRules[permanent ? "permanent" : "cheapest"]++;
    }
    if (chosen) displayOffers.set(key, chosen);
  }
  stats.displayRules = displayRules;
  stats.listedItems = new Set([...firstCards.keys()]).size;

  // The tabs document: labels from the string bags, card order kept.
  const named = (key, what) => {
    const text = label(key);
    if (!text) problem(`no CN string for ${what} ${key}`);
    return text ?? key;
  };
  const shopTabs = tabs.map(tab => {
    const doc = { id: tab.id, name: named(tab.id, "ShopCat"), subTabs: tab.subCats.map(sub => ({
      id: sub.id, name: named(sub.id, "SubCat"), cardItems: sub.keys })) };
    if (tab.subCats.length > 0 && tab.id !== RECOMMEND_TAB) doc.allSubTab = named("whole", "the 全部 sub-tab");
    if (tab.id === RECOMMEND_TAB) doc.defaultSubTab = tab.subCats[0]?.id;
    if (tab.subCats.length === 0) doc.cardItems = tab.keys;
    return doc;
  });
  return { tabs: shopTabs, placements, recommend, marks, offerNotes, displayOffers, stats, latest };
}
