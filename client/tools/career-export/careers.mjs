// Rows of server-go/internal/data/career/careers.json (export-career-data.mjs).

/**
 * Career themeId of each track theme (TrackTheme.cpp TrackThemeEntity), as
 * the newCareer@cn.xml theme careers name them: 1 森林 forest … 35 封神
 * fengshen. Checked against the career titles (5 墓地, 7 太空 northeu,
 * 11 夜间 moonhill, 22 1920工业革命 steam, 26 像素 nemo, 33 洛奇 mabi).
 */
export const THEME_IDS = {
  forest: 1, desert: 2, village: 3, ice: 4, tomb: 5, mine: 6, northeu: 7, factory: 8,
  pirate: 9, fairy: 10, moonhill: 11, gold: 12, china: 13, castle: 14, nymph: 15,
  mechanic: 16, xyy: 17, wkc: 18, brodi: 19, park: 20, beach: 21, steam: 22,
  transFormer: 23, jurassic: 24, world: 25, nemo: 26, sword: 27, god: 28, abyss: 29,
  camelot: 30, olympos: 31, korea: 32, mabi: 33, maple: 34, fengshen: 35,
};

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

function integer(text, where, problem, { min = 0 } = {}) {
  const value = Number(text?.trim());
  if (!Number.isSafeInteger(value) || value < min) {
    problem(`${where}: ${JSON.stringify(text)} is not an integer >= ${min}`);
    return undefined;
  }
  return value;
}

function integerList(text, where, problem) {
  if (text === undefined) return undefined;
  const values = text.split(",").map(part => integer(part, where, problem, { min: 1 }));
  return values.every(value => value !== undefined) && values.length > 0 ? values : undefined;
}

const truthy = text => text?.trim().toLowerCase() === "true";

/** Emblem ids of emblem@cn.xml, in file order. */
export function emblemIds(root, problem) {
  const ids = [];
  const seen = new Set();
  for (const node of root.children) {
    if (node.name !== "emblem") continue;
    const id = integer(attr(node, "id"), "emblem id", problem, { min: 1 });
    if (id === undefined) continue;
    if (seen.has(id)) problem(`emblem ${id} is listed twice`);
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) problem("emblem table is empty");
  return ids;
}

/**
 * newCareer@cn.xml rows with the judging and reward fields. Disabled rows
 * (enable="false") are left out. Reward emblems outside the CN emblem table
 * are reported, since a granted emblem must be one the client can show.
 * Repeated ids keep their first row; the repeats are pushed to duplicates.
 */
export function careerRows(root, emblems, problem, duplicates = []) {
  const rows = [];
  const ids = new Set();
  for (const node of root.children) {
    if (node.name !== "careerItem") continue;
    const id = integer(attr(node, "id"), "careerItem id", problem, { min: 1 });
    if (id === undefined) continue;
    if (attr(node, "enable") !== undefined && !truthy(attr(node, "enable"))) continue;
    const where = `career ${id}`;
    // 1293 星座飞行宠物收藏家！ is repeated without its countItemId list;
    // the first, complete row is the one kept.
    if (ids.has(id)) {
      duplicates.push(id);
      continue;
    }
    ids.add(id);
    const row = {
      id,
      main: integer(attr(node, "mainType"), `${where} mainType`, problem, { min: 1 }),
      sub: integer(attr(node, "subType"), `${where} subType`, problem, { min: 1 }),
      type: integer(attr(node, "careerType"), `${where} careerType`, problem, { min: 1 }),
      clear: integer(attr(node, "clearValue"), `${where} clearValue`, problem),
      point: integer(attr(node, "rewardPoint") ?? "0", `${where} rewardPoint`, problem),
    };
    const optional = (key, value) => { if (value !== undefined) row[key] = value; };
    const number = name => attr(node, name) === undefined ? undefined
      : integer(attr(node, name), `${where} ${name}`, problem, { min: 1 });
    optional("emblem", number("rewardEmblemId"));
    optional("theme", number("themeId"));
    optional("gameType", number("careerGameType"));
    optional("pre", number("preClearCareerId"));
    optional("itemCat", number("countItemCatId"));
    optional("items", integerList(attr(node, "countItemId"), `${where} countItemId`, problem));
    optional("emblems", integerList(attr(node, "countEmblemId"), `${where} countEmblemId`, problem));
    if (truthy(attr(node, "isMulti")))
      optional("multi", integerList(attr(node, "multiId"), `${where} multiId`, problem));
    if (truthy(attr(node, "isHidden"))) row.hidden = true;
    if (truthy(attr(node, "isLucciCheckZero"))) row.lucciZero = true;
    const date = attr(node, "achievementDate");
    if (date !== undefined) {
      const match = /^\d{4}-(\d{2})-(\d{2})T/.exec(date);
      if (match) row.date = `${match[1]}-${match[2]}`;
      else problem(`${where} achievementDate ${JSON.stringify(date)}`);
    }
    if (row.emblem !== undefined && !emblems.has(row.emblem))
      problem(`${where} rewards emblem ${row.emblem}, which emblem@cn.xml does not list`);
    rows.push(row);
  }
  for (const row of rows) {
    if (row.pre !== undefined && !ids.has(row.pre)) problem(`career ${row.id}: unknown preClearCareerId ${row.pre}`);
    for (const id of row.multi ?? []) if (!ids.has(id)) problem(`career ${row.id}: unknown multiId ${id}`);
    if (row.type === 49 && !row.multi) problem(`career ${row.id}: multi career without multiId`);
  }
  if (rows.length === 0) problem("career table is empty");
  return rows;
}

/** trackId -> career themeId over the time-attack track catalog. */
export function trackThemes(choices, problem) {
  const themes = {};
  for (const choice of choices) {
    const theme = THEME_IDS[choice.theme];
    if (theme === undefined) {
      problem(`track ${choice.id}: theme ${JSON.stringify(choice.theme)} has no career themeId`);
      continue;
    }
    themes[choice.id] = theme;
  }
  if (Object.keys(themes).length === 0) problem("track theme table is empty");
  return themes;
}
