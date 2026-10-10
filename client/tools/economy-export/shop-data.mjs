// Parsers for the CN shop tables. Input nodes come from parseResourceXml
// ({name, attributes:[{name,value}], children, text}) or the BML parser,
// which uses the same node shape.

export function attr(node, name) {
  return node.attributes.find(item => item.name === name)?.value;
}

function integer(raw, label, { min = 0, optional = false } = {}) {
  if (raw === undefined || raw.trim() === "") {
    if (optional) return undefined;
    throw new Error(`${label}: missing integer`);
  }
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) throw new Error(`${label}: invalid integer ${JSON.stringify(raw)}`);
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${label}: out of range ${raw}`);
  return value;
}

function flag(raw) {
  return raw !== undefined && raw.trim().toLowerCase() === "true";
}

/** zeta_/cn/shop/data/stock.kml: <stockList><stock ...><item .../>...</stock> */
export function parseStocks(root) {
  if (root.name !== "stockList") throw new Error(`stock.kml root is ${root.name}, not stockList`);
  const stocks = new Map();
  for (const node of root.children) {
    if (node.name !== "stock") continue;
    const stockId = integer(attr(node, "stockId"), "stock.stockId", { min: 1 });
    if (stocks.has(stockId)) throw new Error(`stock.kml: duplicate stockId ${stockId}`);
    const label = `stock ${stockId}`;
    const items = node.children.filter(child => child.name === "item").map(child => ({
      category: integer(attr(child, "itemCatId"), `${label} itemCatId`),
      itemId: integer(attr(child, "itemId"), `${label} itemId`),
      count: integer(attr(child, "itemCount") ?? "1", `${label} itemCount`),
      days: integer(attr(child, "expireDay") ?? "0", `${label} expireDay`),
    }));
    stocks.set(stockId, {
      stockId,
      name: attr(node, "stockName") ?? "",
      price: integer(attr(node, "salePrice"), `${label} salePrice`, { optional: true }),
      priceType: integer(attr(node, "priceType"), `${label} priceType`, { optional: true }),
      isOnSale: flag(attr(node, "isOnSale")),
      isOnceADay: flag(attr(node, "isOnceADay")),
      restriction: (attr(node, "restriction") ?? "").trim(),
      onBuyOk: (attr(node, "onBuyOk") ?? "").trim(),
      rpLimit: integer(attr(node, "rpLimit"), `${label} rpLimit`, { optional: true }) ?? 0,
      items,
    });
  }
  return stocks;
}

/** zeta_/cn/shop/data/stockCard.xml: <stockCardList><stockCard ...><stock stockId/>... */
export function parseStockCards(root) {
  if (root.name !== "stockCardList") throw new Error(`stockCard.xml root is ${root.name}`);
  const cards = new Map();
  for (const node of root.children) {
    if (node.name !== "stockCard") continue;
    const cardId = integer(attr(node, "stockCardId"), "stockCard.stockCardId", { min: 1 });
    if (cards.has(cardId)) throw new Error(`stockCard.xml: duplicate stockCardId ${cardId}`);
    cards.set(cardId, {
      cardId,
      isOnSale: (attr(node, "isOnSale") ?? "").trim() === "1",
      saleFlag: (attr(node, "saleFlag") ?? "").trim(),
      // 限购: how many times one account may buy the card in its sale period.
      eventBuyCount: integer(attr(node, "eventBuyCount"), `stockCard ${cardId} eventBuyCount`,
        { optional: true }) ?? 0,
      stockIds: node.children.filter(child => child.name === "stock")
        .map(child => integer(attr(child, "stockId"), `stockCard ${cardId} stockId`, { min: 1 })),
    });
  }
  return cards;
}

/**
 * zeta_/cn/shop/data/shopCat.xml: <Shop><ShopCat name salePeriod><SubCat name>
 * <stockCard stockCardId shopMark originalPrice/>. One ref per stockCard
 * element, in file order; salePeriod is the ShopCat's ("" or "from~to", "*"
 * for an open end).
 */
export function parseShopCats(root) {
  if (root.name !== "Shop") throw new Error(`shopCat.xml root is ${root.name}`);
  const refs = [];
  for (const shopCat of root.children.filter(node => node.name === "ShopCat")) {
    const group = attr(shopCat, "name") ?? "";
    const salePeriod = (attr(shopCat, "salePeriod") ?? "").trim();
    const visit = (node, subCat) => {
      for (const child of node.children) {
        if (child.name === "SubCat") visit(child, attr(child, "name") ?? "");
        else if (child.name === "stockCard") {
          const label = `shopCat ${group}/${subCat}`;
          refs.push({
            group, subCat, salePeriod,
            cardId: integer(attr(child, "stockCardId"), `${label} stockCardId`, { min: 1 }),
            shopMark: (attr(child, "shopMark") ?? "").trim(),
            originalPrice: integer(attr(child, "originalPrice"), `${label} originalPrice`,
              { min: 1, optional: true }),
          });
        }
      }
    };
    visit(shopCat, "");
  }
  return refs;
}

/**
 * A StringBag (<StringBag><k n><m c v/>...) as a Map key -> the `locale`
 * value. Keys without that locale are left out; a key repeated with the same
 * value is fine (stage_mqShop lists "lucci" twice), a conflicting repeat
 * throws.
 */
export function parseStringBag(root, locale = "cn") {
  if (root.name !== "StringBag") throw new Error(`string bag root is ${root.name}`);
  const strings = new Map();
  for (const node of root.children.filter(child => child.name === "k")) {
    const key = attr(node, "n");
    const value = node.children.find(child => child.name === "m" && attr(child, "c") === locale);
    if (key === undefined || value === undefined) continue;
    const text = attr(value, "v") ?? "";
    if (strings.has(key) && strings.get(key) !== text)
      throw new Error(`string bag key ${key}: ${JSON.stringify(strings.get(key))} != ${JSON.stringify(text)}`);
    strings.set(key, text);
  }
  return strings;
}

/**
 * zeta_/cn/content/tcCashEvent.xml: <tcCashEventList><tcCashEvent eventPeriod
 * rewardPeriod eventType><reward step value stockId/>... (the shop's 累计充值/
 * 累计消费 event). Periods stay the raw "from~to" text.
 */
export function parseTcCashEvents(root) {
  if (root.name !== "tcCashEventList") throw new Error(`tcCashEvent.xml root is ${root.name}`);
  return root.children.filter(node => node.name === "tcCashEvent").map((node, index) => {
    const label = `tcCashEvent ${index}`;
    return {
      eventPeriod: (attr(node, "eventPeriod") ?? "").trim(),
      rewardPeriod: (attr(node, "rewardPeriod") ?? "").trim(),
      eventType: (attr(node, "eventType") ?? "").trim(),
      steps: node.children.filter(child => child.name === "reward").map(child => ({
        step: integer(attr(child, "step"), `${label} step`, { min: 1 }),
        value: integer(attr(child, "value"), `${label} value`, { min: 1 }),
        stockId: integer(attr(child, "stockId"), `${label} stockId`, { min: 1 }),
      })),
    };
  });
}

/** zeta_/cn/shop/data/item.kml: <itemList><item itemCatId itemId itemName itemDesc isAdditional/> */
export function parseShopItems(root) {
  if (root.name !== "itemList") throw new Error(`item.kml root is ${root.name}`);
  const items = new Map();
  for (const node of root.children) {
    if (node.name !== "item") continue;
    const category = integer(attr(node, "itemCatId"), "item.itemCatId");
    const itemId = integer(attr(node, "itemId"), "item.itemId");
    const key = `${category}:${itemId}`;
    const entry = {
      name: (attr(node, "itemName") ?? "").trim(),
      desc: (attr(node, "itemDesc") ?? "").trim(),
      isAdditional: flag(attr(node, "isAdditional")),
    };
    const previous = items.get(key);
    if (!previous) { items.set(key, entry); continue; }
    // Keep the first row; a later row only fills a missing description and
    // can only turn isAdditional on (both rows describe the same kind).
    items.set(key, {
      name: previous.name || entry.name,
      desc: previous.desc || entry.desc,
      isAdditional: previous.isAdditional || entry.isAdditional,
    });
  }
  return items;
}
