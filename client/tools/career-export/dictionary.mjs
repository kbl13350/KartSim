// Rows of server-go/internal/data/career/dictionary.json: the CN 道具图鉴
// content table (zeta_/cn/content/itemDictionary.xml).
//
// kartGrades is each listed kart's kartBodyGrade (the engine grade the kart
// list filters by: 1 C1 ... 13 迅, text engineGradeN).

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

/** "2026-09-17T06:00:00" Beijing time as Unix milliseconds. */
export function beijingMillis(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(text ?? "");
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h - 8, mi, s);
}

/**
 * The dictionary's category lists (display order), the dated embargo rows
 * (items hidden until their date), the kart engine grades and the reward
 * per newly collected item.
 */
export function dictionaryRows(root, problem) {
  const categories = [];
  const embargo = [];
  const kartGrades = {};
  let reward;
  const listed = new Set();
  for (const node of root.children) {
    if (node.name === "rewardItem") {
      reward = { category: Number(attr(node, "rewardItemCatId")), item: Number(attr(node, "rewardItemId")),
        count: Number(attr(node, "rewardItemCount")) };
      if (!Object.values(reward).every(value => Number.isSafeInteger(value) && value > 0))
        problem(`dictionary reward ${JSON.stringify(reward)}`);
    } else if (node.name === "item") {
      const category = Number(attr(node, "catId"));
      const items = (attr(node, "values") ?? "").split(",").map(value => Number(value.trim()));
      if (!Number.isSafeInteger(category) || category <= 0 || items.some(id => !Number.isSafeInteger(id) || id < 0)) {
        problem(`dictionary category ${attr(node, "name")}: bad ids`);
        continue;
      }
      for (const id of items) {
        const key = `${category}-${id}`;
        if (listed.has(key)) problem(`dictionary item ${key} is listed twice`);
        listed.add(key);
      }
      categories.push({ name: attr(node, "name"), category, items });
    } else if (node.name === "embargoItem") {
      const [from] = (attr(node, "period") ?? "").split("~");
      const since = beijingMillis(from);
      const items = (attr(node, "values") ?? "").split(",").map(value => value.trim().split("-").map(Number));
      if (since === undefined || items.some(pair => pair.length !== 2 || !listed.has(pair.join("-")))) {
        problem(`dictionary embargo ${attr(node, "id")}: bad period or unknown item`);
        continue;
      }
      embargo.push({ since, items });
    } else if (node.name === "kartBody") {
      const id = Number(attr(node, "id"));
      const grade = Number(attr(node, "kartBodyGrade"));
      if (!listed.has(`3-${id}`) || !Number.isSafeInteger(grade) || grade < 1 || grade > 13 || id in kartGrades) {
        problem(`dictionary kartBody ${id}: unlisted, repeated or bad grade ${grade}`);
        continue;
      }
      kartGrades[id] = grade;
    }
  }
  if (!reward) problem("dictionary has no rewardItem");
  if (categories.length === 0) problem("dictionary has no categories");
  return { categories, embargo, kartGrades, reward };
}
