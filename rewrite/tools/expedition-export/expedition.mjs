// Rows of server-go/internal/data/expedition/expedition.json: the CN 赛车探险队
// table (zeta_/cn/content/racingExpedition/racingExpeditionMission.xml) and
// the shop stocks its missions reward (stock.kml).
//
// The canonical JSON holds integers only: the bonus constants are kept in
// thousandths (bonusConstLucci 8 -> 8000, bonusConstChar 0.05 -> 50) and the
// kart tuning table in tenths of a percent (4.5% -> 45). The reinforced
// parts table is kept as is: whole reward points (about 22% of the
// difficulty's basicReward at total 40).

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;
const child = (node, name) => node.children.find(item => item.name === name);

function number(node, name, problem, { min = 0, integer = true } = {}) {
  const raw = attr(node, name);
  const value = Number(raw);
  if (raw === undefined || raw.trim() === "" || !Number.isFinite(value) || value < min ||
      (integer && !Number.isSafeInteger(value))) {
    problem(`racingExpedition ${node.name}.${name}: bad value ${JSON.stringify(raw)}`);
    return 0;
  }
  return value;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** value × scale as an integer (the table's decimals are exact at these scales). */
function scaled(value, scale, label, problem) {
  const result = Math.round(value * scale);
  if (Math.abs(result - value * scale) > 1e-6) problem(`${label}: ${value} has more decimals than 1/${scale}`);
  return result;
}

/** Bonus rows keyed by a level, each with one value per difficulty 1-5, times scale. */
function bonusTable(list, rowName, keyName, cellName, scale, problem) {
  const table = {};
  for (const row of list?.children.filter(item => item.name === rowName) ?? []) {
    const key = number(row, keyName, problem);
    const cells = row.children.filter(item => item.name === cellName);
    const values = [1, 2, 3, 4, 5].map(difficulty => {
      const cell = cells.find(item => Number(attr(item, "difficulty")) === difficulty);
      if (!cell) problem(`racingExpedition ${rowName} ${key}: no difficulty ${difficulty}`);
      return cell ? scaled(number(cell, "bonus", problem, { integer: false }), scale, `${rowName} ${key}`, problem) : 0;
    });
    if (String(key) in table) problem(`racingExpedition ${rowName} ${key} repeated`);
    table[key] = values;
  }
  return table;
}

export function expeditionRows(root, stocks, problem) {
  if (root.name !== "racingExpedition") problem(`racingExpeditionMission.xml root is ${root.name}`);
  const info = child(root, "basicInfo");
  const constants = child(root, "basicBonusConst");
  if (!info || !constants) {
    problem("racingExpedition: basicInfo or basicBonusConst missing");
    return undefined;
  }
  const resetDay = WEEKDAYS.indexOf((attr(info, "resetDayOfWeek") ?? "").trim().toLowerCase());
  if (resetDay < 0) problem(`racingExpedition resetDayOfWeek ${attr(info, "resetDayOfWeek")}`);
  const basic = {
    resetWeekday: resetDay,
    resetHour: number(info, "resetHour", problem),
    friendResetHour: number(info, "resetHourFriendList", problem),
    weeklyMissions: number(info, "defaultMissionMaxCount", problem, { min: 1 }),
    buyableMissions: number(info, "buyableMissionMaxCount", problem),
    addMissionTokens: number(info, "buyMissionTokenCount", problem, { min: 1 }),
    reduceTimeTokens: number(info, "reduceMissionTimeTokenCount", problem, { min: 1 }),
    reduceMinutes: number(info, "reduceMissionTimeUnit", problem, { min: 1 }),
    changeMissionTokens: number(info, "changeMissionTokenCount", problem, { min: 1 }),
    token: { category: number(info, "tokenItemCatId", problem, { min: 1 }),
      item: number(info, "tokenItemId", problem, { min: 1 }) },
  };
  const milli = name => scaled(number(constants, name, problem, { integer: false }), 1000, name, problem);
  const bonus = {
    rp: milli("bonusConstRp"),
    lucci: milli("bonusConstLucci"),
    rpLucci: milli("bonusConstRpLucci"),
    kartBody: milli("bonusConstKartBody"),
    character: milli("bonusConstChar"),
    characterUnmatched: milli("bonusConstCharSpecific0"),
    characterMatched: milli("bonusConstCharSpecific1"),
  };
  const rewards = {};
  for (const row of child(root, "basicRewardList")?.children.filter(item => item.name === "basicReward") ?? [])
    rewards[number(row, "difficulty", problem, { min: 1 })] = number(row, "reward", problem, { min: 1 });
  for (const difficulty of [1, 2, 3, 4, 5])
    if (!(difficulty in rewards)) problem(`racingExpedition basicReward difficulty ${difficulty} missing`);
  const specifics = {};
  for (const row of child(root, "specificList")?.children.filter(item => item.name === "specific") ?? [])
    specifics[number(row, "specificType", problem)] = number(row, "bonusType", problem);
  const kartTuning = bonusTable(child(root, "kartBodyTuningBonusList"), "kartBodyTuning", "tuninglevel",
    "tuningBonus", 10, problem);
  const parts = bonusTable(child(root, "reinforcePartsBonusList"), "partsLevel", "total", "reinforcePart", 1,
    problem);

  const missions = [];
  const stockIds = new Set();
  for (const row of child(root, "missionList")?.children.filter(item => item.name === "mission") ?? []) {
    const mission = {
      id: number(row, "id", problem, { min: 1 }),
      specific: number(row, "specificType", problem),
      trackId: (attr(row, "trackId") ?? "").trim(),
      theme: number(row, "trackThemeId", problem),
      bonusType: number(row, "bonusType", problem),
      stockId: number(row, "rewardStockId", problem, { min: 1 }),
      difficulty: number(row, "difficulty", problem, { min: 1 }),
      hours: number(row, "runningTime", problem, { min: 1 }),
    };
    if (!mission.trackId) problem(`racingExpedition mission ${mission.id}: no trackId`);
    if (!(mission.specific in specifics)) problem(`racingExpedition mission ${mission.id}: unknown specificType`);
    if (!(mission.difficulty in rewards)) problem(`racingExpedition mission ${mission.id}: unknown difficulty`);
    if (missions.some(other => other.id === mission.id)) problem(`racingExpedition mission ${mission.id} repeated`);
    missions.push(mission);
    stockIds.add(mission.stockId);
  }
  const rewardStocks = {};
  for (const stockId of [...stockIds].sort((a, b) => a - b)) {
    const stock = stocks.get(stockId);
    if (!stock || stock.items.length === 0) {
      problem(`racingExpedition reward stock ${stockId} is not in stock.kml`);
      continue;
    }
    rewardStocks[stockId] = { name: stock.name, items: stock.items };
  }
  return { basic, bonus, rewards, specifics, kartTuning, parts, missions, rewardStocks };
}
