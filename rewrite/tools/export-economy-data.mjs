#!/usr/bin/env node
// Export the account-economy data (server-go/ECONOMY.md 3.1) from the P3553
// resources into server-go/internal/data/economy/{catalog.json,levels.json,
// tracks.json,events.json}.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-economy-data.mjs            write all four files
//   node --import tsx tools/export-economy-data.mjs --check    exit 1 if the files are stale
//   node --import tsx tools/export-economy-data.mjs --out DIR  write elsewhere
//
// The sellable item set is computed by the browser's own garage catalog
// (src/resources/garage-catalog.ts loadTimeAttackGarageCatalog via the
// generated Sw library), run in Node over mirror/p3553, so the shop sells
// exactly what the garage can show and equip. The time-attack track list is
// the browser's timeAttackTrackCatalog (src/resources/track-catalog.ts) over
// the same library, so the data service accepts exactly the trackIds the
// ready flow can settle. The shop layout (ShopCat / SubCat, 推荐 pages,
// badges, discounts, the card price) follows the original mall
// (economy-export/shop-layout.mjs); events.json is the shop's tcCash spend
// event. Exits non-zero on any inconsistency.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { diffRewards, koinRewardsByRule, koinRewardsFromData, parseLevelTable } from "./economy-export/levels.mjs";
import { compareOffers, currentCardRefs, CURRENCY_ORDER, dominates, ESTIMATED_RENTAL_DAYS, estimateOffers,
  EVENT_TOKEN_RATIO, selectOriginalOffers } from "./economy-export/offers.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { attr, parseShopCats, parseShopItems, parseStockCards, parseStocks, parseStringBag,
  parseTcCashEvents } from "./economy-export/shop-data.mjs";
import { coupleItems, layoutShop } from "./economy-export/shop-layout.mjs";
import { spendEvents } from "./economy-export/events.mjs";
import { timeAttackTrackRows } from "./economy-export/tracks.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/data/economy");

const problems = [];
const warnings = [];
const problem = message => problems.push(message);

/* ---------- category, kind and tab layout ---------- */

// Category numbers of every kind the garage can equip. Karts and characters
// are fixed by garage-catalog.ts (3 and 1); the rest must agree with its
// EQUIPMENT_CATEGORY, which is checked against every equipment entry below.
const KIND_CATEGORY = {
  character: 1, kart: 3,
  color: 2, plate: 4, dye: 70, goggle: 8, balloon: 9, headBand: 11, handGearL: 16,
  aura: 26, skidMark: 27, flyingPet: 52, pet: 21, uniform: 18, decal: 20, ridColor: 31,
  slotBg: 71, headPhone: 12, rpLucciBonus: 32, goItemSkinCard: 58, tachometer: 61,
};

// Shop layout from ECONOMY.md 3.2. "recommend" lists items flagged
// recommend:true (on a current shopCat.xml card), it has no sub-tabs.
const TABS = [
  { id: "recommend", name: "推荐", subTabs: [] },
  { id: "kartBody", name: "卡丁车", subTabs: [
    { id: "itemKart", name: "道具车" }, { id: "speedKart", name: "竞速车" }] },
  { id: "character", name: "角色", subTabs: [
    { id: "character", name: "角色" }, { id: "pet", name: "宠物" }, { id: "flyingPet", name: "飞行宠物" }] },
  { id: "equip", name: "装备", subTabs: [
    { id: "balloon", name: "气球" }, { id: "headBand", name: "头饰" }, { id: "goggle", name: "眼镜" },
    { id: "handGear", name: "手套" }, { id: "color", name: "喷漆" }, { id: "dye", name: "染色" },
    { id: "aura", name: "光环" }, { id: "skidMark", name: "轨迹" }, { id: "plate", name: "车牌" },
    { id: "etc", name: "其他" }] },
];
const KIND_TAB = {
  character: ["character", "character"], pet: ["character", "pet"], flyingPet: ["character", "flyingPet"],
  balloon: ["equip", "balloon"], headBand: ["equip", "headBand"], goggle: ["equip", "goggle"],
  handGearL: ["equip", "handGear"], color: ["equip", "color"], dye: ["equip", "dye"],
  aura: ["equip", "aura"], skidMark: ["equip", "skidMark"], plate: ["equip", "plate"],
  uniform: ["equip", "etc"], decal: ["equip", "etc"], ridColor: ["equip", "etc"], slotBg: ["equip", "etc"],
  headPhone: ["equip", "etc"], rpLucciBonus: ["equip", "etc"], goItemSkinCard: ["equip", "etc"],
  tachometer: ["equip", "etc"], slotChanger: ["equip", "etc"],
};

// Consumables the shop sells although the garage cannot equip them, by
// itemTable kind: the item changer cards (category 7, <slotChanger>;
// rewrite/ITEM_MODE.md C.6). Only the ones the original sells on a current
// card are listed (the 使用券 vouchers, stockCard.xml 3975/3976: 1/7/30
// days for 10/45/140 点券); they never get estimated prices.
const CONSUMABLE_CATEGORY = { slotChanger: 7 };
// itemCat2ShopCat.bml shopCat groups -> our tab (pcCafe/event groups 99xx are ignored).
const BML_GROUP_TAB = { 8001: "character", 8002: "kartBody", 8003: "equip", 8004: "equip",
  8005: "equip", 8007: "equip" };

const CURRENCIES = [
  { id: "coupon", priceType: 0, name: "点券" },
  { id: "lucci", priceType: 1, name: "金币" },
  { id: "koin", priceType: 3, name: "K币" },
];

function tabOf(item) {
  if (item.kind === "kart") {
    if (item.kartType === 1) return ["kartBody", "itemKart"];
    if (item.kartType === 2) return ["kartBody", "speedKart"];
    problem(`kart ${item.itemId}: kartType ${item.kartType} is neither 1 (item) nor 2 (speed)`);
    return ["kartBody", "speedKart"];
  }
  const tab = KIND_TAB[item.kind];
  if (!tab) { problem(`${item.kind} ${item.itemId}: no shop tab`); return ["equip", "etc"]; }
  return tab;
}

/** Cross-check KIND_TAB against the original kind -> shop group table. */
function checkShopGroups(bmlRoot, T) {
  let checked = 0;
  for (const node of bmlRoot.children.filter(child => child.name === "Category")) {
    const tab = BML_GROUP_TAB[Number(T(node, "shopCat"))];
    if (!tab) continue;
    for (const kind of (T(node, "itemCat") ?? "").split(";").map(value => value.trim())) {
      if (kind === "kart") { checked++; if (tab !== "kartBody") problem(`itemCat2ShopCat: kart in ${tab}`); continue; }
      if (!KIND_TAB[kind]) continue;
      checked++;
      if (KIND_TAB[kind][0] !== tab)
        problem(`itemCat2ShopCat puts ${kind} under ${tab}, catalog uses ${KIND_TAB[kind][0]}`);
    }
  }
  if (checked < 10) problem(`itemCat2ShopCat.bml: only ${checked} kinds matched, expected the full table`);
  return checked;
}

/* ---------- load ---------- */

const started = Date.now();
const { library, formats, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;
const parseBmlAt = async canonical => formats.s2(await uniqueBytes(library, canonical));
const textAt = async canonical => {
  const candidates = library.exactCanonicalCandidates(canonical);
  if (candidates.length !== 1) throw new Error(`${canonical}: expected 1 resource, found ${candidates.length}`);
  return candidates[0].text();
};

const SOURCES = {
  items: "zeta_/cn/shop/data/item.kml",
  stocks: "zeta_/cn/shop/data/stock.kml",
  cards: "zeta_/cn/shop/data/stockCard.xml",
  shopCat: "zeta_/cn/shop/data/shopCat.xml",
  shopGroups: "stage_/shop/itemCat2ShopCat.bml",
  newRider: "stage_/newRider/newRiderItem@cn.bml",
  newRiderDefaults: "etc_/newRiderItem@cn.xml",
  levelTable: "etc_/level/leveltable@cn.xml",
  levelRewards: "etc_/level/levelupreward@cn.xml",
  tracks: "track_/common/track@zz.bml",
  shopStrings: "stage_/mqShop/stage_stringBag.bml",
  baseStrings: "etc_/baseStringBag.xml",
  tcCashEvents: "zeta_/cn/content/tcCashEvent.xml",
  itemTable: "etc_/itemTable.kml",
};

const garage = await library.timeAttackGarageCatalog();
const timeAttackTracks = await library.timeAttackTrackCatalog();
const [stocks, cards, shopCatRefs, shopItems, shopGroups, newRider, newRiderDefaults, levelTableRoot,
  levelRewardText, shopStrings, baseStrings, tcCashEvents, itemTable] = await Promise.all([
  parseXmlAt(SOURCES.stocks).then(parseStocks),
  parseXmlAt(SOURCES.cards).then(parseStockCards),
  parseXmlAt(SOURCES.shopCat).then(parseShopCats),
  parseXmlAt(SOURCES.items).then(parseShopItems),
  parseBmlAt(SOURCES.shopGroups),
  parseBmlAt(SOURCES.newRider),
  parseXmlAt(SOURCES.newRiderDefaults),
  parseXmlAt(SOURCES.levelTable),
  textAt(SOURCES.levelRewards),
  parseBmlAt(SOURCES.shopStrings).then(root => parseStringBag(root)),
  parseXmlAt(SOURCES.baseStrings).then(root => parseStringBag(root)),
  parseXmlAt(SOURCES.tcCashEvents).then(parseTcCashEvents),
  parseXmlAt(SOURCES.itemTable),
]);
// #sb(key) in the stage_mqShop layouts: the stage's own bag first, then the base bag.
const shopLabel = key => shopStrings.get(key) || baseStrings.get(key) || undefined;
const bmlGroupsChecked = checkShopGroups(shopGroups, formats.T);

/* ---------- sellable set ---------- */

const sellable = new Map();
const systemKarts = [];
function addSellable(entry) {
  const key = `${entry.category}:${entry.itemId}`;
  if (sellable.has(key)) problem(`duplicate garage catalog key ${key}`);
  sellable.set(key, entry);
}
for (const kart of garage.karts) {
  if (kart.itemId === 0) { systemKarts.push(kart); continue; }
  addSellable({ category: 3, itemId: kart.itemId, kind: "kart", internalId: kart.internalId,
    name: kart.title, engineGrade: kart.engineGrade, kartType: kart.kartType });
}
for (const character of garage.characters) {
  if (character.itemId <= 0) { problem(`character with itemId ${character.itemId}`); continue; }
  addSellable({ category: 1, itemId: character.itemId, kind: "character",
    internalId: character.internalId, name: character.title });
}
for (const entry of garage.equipment) {
  if (KIND_CATEGORY[entry.kind] !== entry.category)
    problem(`garage kind ${entry.kind} has category ${entry.category}, exporter expects ${KIND_CATEGORY[entry.kind]}`);
  if (entry.itemId <= 0) { problem(`${entry.kind} with itemId ${entry.itemId}`); continue; }
  addSellable({ category: entry.category, itemId: entry.itemId, kind: entry.kind,
    internalId: entry.internalId, name: entry.title });
}
const garageKinds = new Set([...sellable.values()].map(item => item.kind));
for (const kind of Object.keys(KIND_CATEGORY))
  if (!garageKinds.has(kind)) problem(`garage catalog has no ${kind} items`);
for (const kind of garageKinds)
  if (!(kind in KIND_CATEGORY)) problem(`garage catalog kind ${kind} has no category mapping`);

// The consumables with an original offer on a current card.
const currentRefs = currentCardRefs(shopCatRefs, cards);
const consumables = new Map();
for (const node of itemTable.children) {
  const category = CONSUMABLE_CATEGORY[node.name];
  const itemId = Number(attr(node, "id"));
  if (category === undefined || !Number.isSafeInteger(itemId) || itemId <= 0) continue;
  const key = `${category}:${itemId}`;
  consumables.set(key, { category, itemId, kind: node.name, internalId: attr(node, "name")?.trim(),
    name: shopItems.get(key)?.name });
}
const consumableOffers = selectOriginalOffers(consumables, stocks, currentRefs).offers;
const soldConsumables = new Set();
for (const [key, entry] of consumables) {
  // Only what a current card sells: the old 道具换位卡 / 道具变更卡 packs are
  // on sale in stock.kml but on no card (the cards come from boxes).
  if (!(consumableOffers.get(key) ?? []).some(offer => offer.carded)) continue;
  if (!entry.internalId || !entry.name) { problem(`${key}: consumable without a name`); continue; }
  if (shopItems.get(key)?.isAdditional) { problem(`${key}: a counted consumable on a card`); continue; }
  addSellable(entry);
  soldConsumables.add(key);
}
if (soldConsumables.size === 0) problem("no item changer voucher on sale");

// Balloons are the count-based (isAdditional) kind: the original sells them
// only in packs. Every item of such a category is treated as count-based,
// including rows item.kml does not describe.
const countBasedCategories = new Set([...sellable].filter(([key]) =>
  shopItems.get(key)?.isAdditional).map(([, item]) => item.category));
const isCountBased = key => countBasedCategories.has(sellable.get(key).category);

// Categories the original only ever rents: stock.kml has rows for them (on
// sale or not, bundles included) but none with expireDay 0. Estimates there
// copy the original rental terms instead of inventing a permanent price.
const stockDaysByCategory = new Map();
for (const stock of stocks.values())
  for (const item of stock.items)
    stockDaysByCategory.set(item.category, (stockDaysByCategory.get(item.category) ?? new Set()).add(item.days));
const rentalOnlyCategories = new Set([...new Set([...sellable.values()].map(item => item.category))]
  .filter(category => stockDaysByCategory.has(category) && !stockDaysByCategory.get(category).has(0))
  .sort((a, b) => a - b));
for (const category of rentalOnlyCategories)
  if (countBasedCategories.has(category)) problem(`category ${category} is both count-based and rental-only`);
const isRentalOnly = key => rentalOnlyCategories.has(sellable.get(key).category);

/* ---------- offers ---------- */

const missingCards = new Set(shopCatRefs.filter(ref => !cards.has(ref.cardId)).map(ref => ref.cardId));
const original = selectOriginalOffers(sellable, stocks, currentRefs);
const poolOf = key => {
  const item = sellable.get(key);
  const [tab, subTab] = tabOf(item);
  return [
    ...(item.kind === "kart" ? [`grade:${item.engineGrade}`] : []),
    `cat:${item.category}`, `sub:${tab}/${subTab}`, `tab:${tab}`, "all",
  ];
};
// Consumables neither get nor shape estimated prices.
const equippable = new Map([...sellable].filter(([key]) => !soldConsumables.has(key)));
const estimated = estimateOffers({ sellable: equippable,
  originalOffers: new Map([...original.offers].filter(([key]) => !soldConsumables.has(key))), poolOf, isCountBased,
  isRentalOnly });

const finalOffers = new Map();
for (const key of sellable.keys()) {
  // A consumable is sold on the terms of its current cards only (ITEM_MODE.md C.6).
  const offers = (original.offers.get(key) ?? estimated.estimates.get(key) ?? [])
    .filter(offer => !soldConsumables.has(key) || offer.carded).map(offer => ({
    offerId: offer.offerId, currency: offer.currency, price: offer.price, days: offer.days,
    count: offer.count, source: offer.source, minExp: offer.minExp > 0 ? offer.minExp : undefined,
  })).sort(compareOffers);
  if (offers.length === 0) problem(`${key}: no offers`);
  finalOffers.set(key, offers);
}

/* ---------- original mall layout ---------- */

const couple = coupleItems(sellable, stocks);
const layout = layoutShop({ sellable, stocks, cards, shopCatRefs, offers: finalOffers, couple,
  label: shopLabel, problem });

const items = [];
for (const [key, entry] of sellable) {
  const [tab, subTab] = tabOf(entry);
  const shop = shopItems.get(key);
  const placement = layout.placements.get(key) ?? {};
  const offers = finalOffers.get(key).map(offer => ({ ...offer, ...layout.offerNotes.get(offer.offerId) }));
  items.push({
    category: entry.category, itemId: entry.itemId, kind: entry.kind, internalId: entry.internalId,
    name: entry.name, desc: shop?.desc || undefined, tab, subTab,
    shopCategory: placement.shopCategory, shopSubCategory: placement.shopSubCategory,
    shopSubCategories: placement.shopSubCategories,
    engineGrade: entry.kind === "kart" ? entry.engineGrade : undefined,
    kartType: entry.kind === "kart" ? entry.kartType : undefined,
    isAdditional: shop?.isAdditional || countBasedCategories.has(entry.category) || undefined,
    marks: layout.marks.get(key),
    recommend: layout.recommend.get(key),
    displayOfferId: layout.displayOffers.get(key),
    offers,
  });
}
items.sort((a, b) => a.category - b.category || a.itemId - b.itemId);

/* ---------- consistency ---------- */

const offerIds = new Set();
for (const item of items) {
  const groups = new Set();
  for (const offer of item.offers) {
    if (offerIds.has(offer.offerId)) problem(`duplicate offerId ${offer.offerId}`);
    offerIds.add(offer.offerId);
    if (!CURRENCY_ORDER.includes(offer.currency)) problem(`${offer.offerId}: currency ${offer.currency}`);
    if (!Number.isSafeInteger(offer.price) || offer.price < 1) problem(`${offer.offerId}: price ${offer.price}`);
    if (!Number.isSafeInteger(offer.days) || offer.days < 0) problem(`${offer.offerId}: days ${offer.days}`);
    if (!Number.isSafeInteger(offer.count) || offer.count < 1) problem(`${offer.offerId}: count ${offer.count}`);
    const group = `${offer.currency}|${offer.days}|${offer.count}`;
    if (groups.has(group)) problem(`${item.category}:${item.itemId}: two offers for ${group}`);
    groups.add(group);
    const by = item.offers.find(other => other !== offer && dominates(other, offer));
    if (by) problem(`${offer.offerId} is dominated by ${by.offerId}`);
  }
  if (rentalOnlyCategories.has(item.category) && item.offers.some(offer => offer.days === 0))
    problem(`${item.category}:${item.itemId}: permanent offer in rental-only category`);
  if (!item.name) problem(`${item.category}:${item.itemId}: empty name`);
  if (!item.shopCategory) problem(`${item.category}:${item.itemId}: no shopCategory`);
  if (!item.offers.some(offer => offer.offerId === item.displayOfferId))
    problem(`${item.category}:${item.itemId}: displayOfferId ${item.displayOfferId} is not one of its offers`);
}

/* ---------- starter ---------- */

const T = formats.T;
const listed = kind => newRider.children.filter(node => node.name === kind)
  .map(node => Number(T(node, "id"))).filter(id => Number.isSafeInteger(id) && id > 0);
const practice = systemKarts.find(kart => kart.systemKey === "practiceKart");
if (!practice) problem("garage catalog has no practiceKart system kart");
// etc_/newRiderItem@cn.xml only supplies the defaults (its spelling
// "defalutId"); its own color list (1/4/5/7) is the older one, the
// whitelist is the stage_ bml (6/4/5/7) per ECONOMY.md 3.2.
const defaultOf = name => {
  const node = newRiderDefaults.children.find(child => child.name === name);
  return Number(node && attr(node, "defalutId"));
};
const starter = {
  kart: practice && { category: 3, itemId: 0, systemKey: practice.systemKey,
    internalId: practice.internalId, name: practice.title },
  characters: listed("character"),
  defaultCharacter: defaultOf("character"),
  paints: listed("color"),
  defaultPaint: defaultOf("color"),
  dyes: listed("color"),
  defaultDye: defaultOf("dye"),
};
for (const [field, category, defaultField] of [["characters", 1, "defaultCharacter"],
  ["paints", 2, "defaultPaint"], ["dyes", 70, "defaultDye"]]) {
  if (starter[field].length === 0) problem(`starter ${field} is empty`);
  for (const itemId of starter[field])
    if (!sellable.has(`${category}:${itemId}`)) problem(`starter ${field} ${itemId} is not a catalog item`);
  if (!starter[field].includes(starter[defaultField]))
    problem(`starter ${defaultField} ${starter[defaultField]} is not in ${field}`);
}

/* ---------- levels ---------- */

const levelTable = parseLevelTable(levelTableRoot);
const maxLevel = levelTable.levels.length - 1;
const koinData = koinRewardsFromData(levelRewardText, stocks);
koinData.issues.forEach(issue => (issue.includes("!=") ? problem : warnings.push.bind(warnings))(issue));
const koinRule = koinRewardsByRule(maxLevel);
const koinFromData = Object.keys(koinData.rewards).length > 0;
const koinRewards = koinFromData ? koinData.rewards : koinRule;
const koinRuleDiff = diffRewards(koinData.rewards, koinRule);
if (koinFromData && koinRuleDiff.length > 0)
  warnings.push(`koin rewards differ from the ECONOMY.md 1 table (data wins): ${koinRuleDiff.join(", ")}`);
for (const level of Object.keys(koinRewards).map(Number))
  if (level < 1 || level > maxLevel) problem(`koin reward for level ${level} outside 1..${maxLevel}`);

/* ---------- time-attack tracks ---------- */

const trackRows = timeAttackTrackRows(timeAttackTracks, problem);

/* ---------- tcCash spend event ---------- */

const events = spendEvents(tcCashEvents, { stocks, shopItems, sellable, problem });

/* ---------- write ---------- */

const generatedFrom = `rewrite/tools/export-economy-data.mjs over mirror/${manifest.version} ` +
  `revision ${manifest.revision}: sellable set = rewrite garage catalog ` +
  `(loadTimeAttackGarageCatalog), offers from ${SOURCES.stocks}, ${SOURCES.cards}, ` +
  `${SOURCES.shopCat}, names ${SOURCES.items}, tabs checked against ${SOURCES.shopGroups}, ` +
  `plus the item changer vouchers (${SOURCES.itemTable} <slotChanger>) on sale on a current card, ` +
  `shop layout from ${SOURCES.shopCat} (${layout.latest} for 推荐) with labels from ${SOURCES.shopStrings} ` +
  `and ${SOURCES.baseStrings}, starter from ${SOURCES.newRider} and ${SOURCES.newRiderDefaults}. ` +
  "Do not edit by hand.";
const catalogDoc = formatDocument({
  generatedFrom, currencies: CURRENCIES, tabs: TABS, shopTabs: layout.tabs, starter, items,
});
const levelsDoc = formatDocument({
  generatedFrom: `rewrite/tools/export-economy-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.levelTable}; koinRewards from ${SOURCES.levelRewards} ` +
    `(category-56 koin stocks in ${SOURCES.stocks})${koinFromData ? "" : " - FALLBACK: ECONOMY.md rule"}. ` +
    "Do not edit by hand.",
  rpLimit: levelTable.rpLimit,
  levels: levelTable.levels,
  koinRewards,
});

const tracksDoc = formatDocument({
  generatedFrom: `rewrite/tools/export-economy-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: the rewrite time-attack track catalog (timeAttackTrackCatalog: ` +
    `${SOURCES.tracks} rows with a track model, plus their _rvs reverse models). Do not edit by hand.`,
  tracks: trackRows,
});

const eventsDoc = formatDocument({
  generatedFrom: `rewrite/tools/export-economy-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.tcCashEvents} (periods are Beijing time), rewards resolved ` +
    `through ${SOURCES.stocks} and ${SOURCES.items}. Display only: the data service grants no reward. ` +
    "Do not edit by hand.",
  tcCashEvents: events,
});

const outputs = [["catalog.json", catalogDoc], ["levels.json", levelsDoc], ["tracks.json", tracksDoc],
  ["events.json", eventsDoc]];
let stale = [];
if (problems.length === 0) {
  if (checkOnly) {
    stale = outputs.filter(([name, doc]) => {
      const file = path.join(outDir, name);
      return !existsSync(file) || readFileSync(file, "utf8") !== doc.text;
    }).map(([name]) => name);
  } else {
    mkdirSync(outDir, { recursive: true });
    for (const [name, doc] of outputs) writeFileSync(path.join(outDir, name), doc.text);
  }
}

/* ---------- summary ---------- */

const table = (rows, headers) => {
  const widths = headers.map((header, index) =>
    Math.max(String(header).length, ...rows.map(row => String(row[index]).length)));
  const line = row => row.map((cell, index) =>
    typeof cell === "number" ? String(cell).padStart(widths[index]) : String(cell).padEnd(widths[index])).join("  ");
  console.log(line(headers));
  console.log(widths.map(width => "-".repeat(width)).join("  "));
  rows.forEach(row => console.log(line(row)));
};

const byCategory = new Map();
for (const item of items) {
  const row = byCategory.get(item.category) ?? { kind: item.kind, items: 0, original: 0, estimated: 0,
    permanent: 0, onlyTimed: 0, unnamed: 0, offers: 0, recommend: 0 };
  row.items++;
  row.offers += item.offers.length;
  if (item.offers[0].source === "original") row.original++; else row.estimated++;
  if (item.offers.some(offer => offer.days === 0)) row.permanent++; else row.onlyTimed++;
  if (!shopItems.get(`${item.category}:${item.itemId}`)?.name) row.unnamed++;
  if (item.recommend) row.recommend++;
  byCategory.set(item.category, row);
}
console.log(`\nEconomy export (${((Date.now() - started) / 1000).toFixed(1)} s, mirror ${manifest.version} ${manifest.revision.slice(0, 12)})`);
console.log(`garage catalog: ${garage.karts.length} karts (${systemKarts.length} system, not sold: ` +
  `${systemKarts.map(kart => kart.systemKey).join(", ")}), ${garage.characters.length} characters, ` +
  `${garage.equipment.length} equipment\n`);
const rows = [...byCategory].sort((a, b) => a[0] - b[0]).map(([category, row]) =>
  [category, row.kind, row.items, row.original, row.estimated, row.permanent, row.onlyTimed,
    row.offers, row.recommend, row.unnamed]);
const totals = rows.reduce((sum, row) => sum.map((value, index) => index < 2 ? value : value + row[index]),
  ["", "TOTAL", 0, 0, 0, 0, 0, 0, 0, 0]);
table([...rows, totals], ["cat", "kind", "items", "original", "estimated", "permanent", "timedOnly",
  "offers", "recommend", "noCnName"]);

const offerCounts = {};
for (const item of items)
  for (const offer of item.offers) {
    const row = offerCounts[offer.currency] ??= { original: 0, estimated: 0, permanent: 0 };
    row[offer.source]++;
    if (offer.days === 0) row.permanent++;
  }
console.log("");
table(CURRENCY_ORDER.map(currency => [currency, offerCounts[currency]?.original ?? 0,
  offerCounts[currency]?.estimated ?? 0, offerCounts[currency]?.permanent ?? 0]),
["currency", "original", "estimated", "permanentOffers"]);

const totalItems = items.length;
const withPermanent = items.filter(item => item.offers.some(offer => offer.days === 0)).length;
const estimatedItems = items.filter(item => item.offers[0].source === "estimated").length;
console.log(`\nitems ${totalItems}; original-priced ${totalItems - estimatedItems}; estimated ${estimatedItems}; ` +
  `permanent option ${withPermanent} (${(100 * withPermanent / totalItems).toFixed(1)}%); offers ${offerIds.size}`);
console.log(`estimate: ${ESTIMATED_RENTAL_DAYS}-day/permanent ratio ${estimated.rentalRatio.toFixed(4)} ` +
  `(median of ${estimated.ratioSamples} items); count-based categories ${[...countBasedCategories].join(", ")}`);
const poolUse = {};
for (const pool of estimated.pools.values()) {
  const kind = pool.split(":")[0];
  poolUse[kind] = (poolUse[kind] ?? 0) + 1;
}
console.log(`estimate price pools used: ${JSON.stringify(poolUse)}`);
console.log(`stock filtering (single-item stocks of sellable items): ${JSON.stringify(original.rejections)}; ` +
  `(currency, days, count) groups with several stocks resolved: ${original.duplicateGroups}`);
console.log(`event tokens (hooked stocks < ${EVENT_TOKEN_RATIO} x ordinary median): ${original.eventTokens.length}: ` +
  original.eventTokens.map(({ key, offer, reference }) =>
    `${key} ${offer.offerId} ${offer.price} ${offer.currency}/${offer.days}d (median ${reference})`).join("; "));
const dominatedKinds = {};
for (const { offer, by } of original.dominated) {
  const kind = by.days === 0 && offer.days > 0 ? "rentalNotCheaperThanPermanent"
    : by.count > offer.count ? "smallerPack" : "shorterNotCheaper";
  dominatedKinds[kind] = (dominatedKinds[kind] ?? 0) + 1;
}
console.log(`dominated original offers dropped: ${original.dominated.length} on ` +
  `${new Set(original.dominated.map(entry => entry.key)).size} items ${JSON.stringify(dominatedKinds)}`);
console.log(`rental-only categories (no permanent stock row ever): ${[...rentalOnlyCategories].join(", ")}; ` +
  `estimated there: ${[...estimated.estimates].filter(([key]) => isRentalOnly(key))
    .map(([key, offers]) => `${key} ${offers.map(o => `${o.price}/${o.days}d`).join(",")}`).join("; ")}`);
console.log(`shopCat.xml: ${shopCatRefs.length} card refs, ${currentRefs.length} current, ` +
  `${missingCards.size} referenced cards missing from stockCard.xml; itemCat2ShopCat kinds checked: ${bmlGroupsChecked}`);
console.log(`starter: kart ${starter.kart?.systemKey}/${starter.kart?.internalId}, characters ` +
  `${starter.characters.join("/")} (default ${starter.defaultCharacter}), paints/dyes ${starter.paints.join("/")} ` +
  `(defaults ${starter.defaultPaint}/${starter.defaultDye})`);
console.log(`levels: ${levelTable.levels.length} (0..${maxLevel}), rpLimit ${levelTable.rpLimit}; koin rewards ` +
  `${koinFromData ? "from data" : "from ECONOMY.md rule"}: ${Object.entries(koinRewards)
    .map(([level, koin]) => `${level}:${koin}`).join(" ")}`);
console.log(`time-attack tracks: ${trackRows.length} (${trackRows.filter(row => row.reverse).length} reverse)`);

const placementCounts = {};
for (const item of items) {
  const key = `${item.shopCategory}/${item.shopSubCategory ?? "-"}`;
  placementCounts[key] = (placementCounts[key] ?? 0) + 1;
}
console.log(`\nshop layout (${layout.latest} is the 推荐 page; ${layout.stats.cardRefs} current card refs list ` +
  `${layout.stats.listedItems} sellable items; ${couple.size} couple items):`);
table(Object.entries(placementCounts).sort().map(([key, count]) => [key, count]), ["shopCategory/shopSubCategory", "items"]);
console.log(`couple equipment listed twice: ${items.filter(item => item.shopSubCategories).length}; ` +
  `karts on kartBody cards by engineGrade: ${JSON.stringify(layout.stats.engineCards)}`);
for (const tab of layout.tabs) {
  const lists = tab.subTabs.length > 0
    ? tab.subTabs.map(sub => `${sub.id} ${sub.name} [${sub.cardItems.join(" ")}]`).join("; ")
    : `[${tab.cardItems.join(" ")}]`;
  console.log(`  ${tab.id} ${tab.name}${tab.allSubTab ? ` (+${tab.allSubTab})` : ""}: ${lists}`);
}
const recommendCounts = {};
for (const item of items) for (const sub of item.recommend ?? []) recommendCounts[sub] = (recommendCounts[sub] ?? 0) + 1;
const markCounts = {};
for (const item of items) for (const mark of item.marks ?? []) markCounts[mark] = (markCounts[mark] ?? 0) + 1;
console.log(`recommend: ${JSON.stringify(recommendCounts)}; marks: ${JSON.stringify(markCounts)}; discounted offers: ` +
  items.flatMap(item => item.offers.filter(offer => offer.originalPrice).map(offer =>
    `${item.category}:${item.itemId} ${offer.offerId} ${offer.originalPrice}->${offer.price} ${offer.discountLabel}`)).join(", ") +
  `; limited offers ${layout.stats.limitedOffers}; displayOfferId rules ${JSON.stringify(layout.stats.displayRules)}`);
for (const event of events)
  console.log(`tcCash ${event.eventType} event ${event.eventPeriod.start} ~ ${event.eventPeriod.end} (rewards until ` +
    `${event.rewardPeriod.end}): ${event.steps.map(step => `${step.value} -> ${step.reward.name} x${step.reward.count}` +
      `${step.reward.days ? ` ${step.reward.days}d` : ""}`).join("; ")}`);
for (const warning of warnings) console.log(`WARNING: ${warning}`);
if (problems.length === 0) {
  for (const [name, doc] of outputs) {
    console.log(`${checkOnly ? "checked" : "wrote"} ${path.relative(projectRoot, path.join(outDir, name))}: ` +
      `${Buffer.byteLength(doc.text)} bytes, version ${doc.version}`);
  }
}
if (stale.length > 0) console.error(`STALE: ${stale.join(", ")} differ from a fresh export`);
for (const message of problems) console.error(`INCONSISTENCY: ${message}`);
process.exitCode = problems.length > 0 || stale.length > 0 ? 1 : 0;
