// Rows of server-go/internal/data/license/license.json: the CN 驾照考试
// (reformed rider school, zeta_/cn/content/config.xml reformedRiderSchool)
// from DataPack1 etc_/riderSchool, and the shop stocks its steps reward.
//
// Each step keeps its mission id and the clear rule the Web build judges:
//   time   finish inside timeMs (0: no limit): driving missions 0, 20, 22
//   rival  finish before the rival ghost (rivalMs, its .ksv best time): 21
//   finish finish the course: the item missions (1-9, 11-13), whose items,
//          targets and AI the Web build does not run yet

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

export const LICENSE_NAMES = ["新手", "初级", "L3", "L2", "L1", "PRO"];
const DRIVING = new Set([0, 20, 22]);
const RIVAL = 21;

function integer(node, name, problem, { min = 0, optional = false } = {}) {
  const raw = attr(node, name);
  if (raw === undefined && optional) return undefined;
  const value = Number(raw);
  if (raw === undefined || raw.trim() === "" || !Number.isSafeInteger(value) || value < min) {
    problem(`${node.name}.${name}: bad value ${JSON.stringify(raw)}`);
    return 0;
  }
  return value;
}

export function ruleOf(mission) {
  if (DRIVING.has(mission)) return "time";
  if (mission === RIVAL) return "rival";
  return "finish";
}

/** riderSchool@cn.xml <item step id icon track time lap …/> by step. */
export function missionRows(root, problem) {
  const missions = new Map();
  for (const node of root.children) {
    if (node.name !== "item") continue;
    const step = integer(node, "step", problem, { min: 1 });
    if (missions.has(step)) problem(`riderSchool step ${step} repeated`);
    missions.set(step, {
      step,
      mission: integer(node, "id", problem),
      icon: (attr(node, "icon") ?? "").trim(),
      track: (attr(node, "track") ?? "").trim(),
      timeMs: integer(node, "time", problem, { optional: true }) ?? 0,
      laps: integer(node, "lap", problem, { min: 1, optional: true }) ?? 0,
      speed: integer(node, "speed", problem, { optional: true }) ?? 7,
    });
  }
  return missions;
}

/**
 * riderSchoolLocale@cn.xml: <category catLevel> rows (catLevel 0, the
 * creation tutorial, is skipped) and <proCategory emblemId> qualification.
 */
export function localeRows(root, problem) {
  const categories = [];
  let pro;
  for (const node of root.children) {
    if (node.name === "category") {
      const level = integer(node, "catLevel", problem);
      if (level === 0) continue;
      categories.push({ level, steps: node.children.filter(child => child.name === "item").map(child => ({
        step: integer(child, "step", problem, { min: 1 }),
        name: (attr(child, "name") ?? "").replace(/\s+/g, " ").trim(),
        stockId: integer(child, "rewardStockId", problem, { min: 1 }),
      })) });
    } else if (node.name === "proCategory") {
      pro = {
        emblemId: integer(node, "emblemId", problem, { min: 1 }),
        qualify: node.children.filter(child => child.name === "item").map(child => ({
          track: (attr(child, "track") ?? "").trim(),
          speed: integer(child, "gameSpeed", problem),
          timeMs: integer(child, "timeLimit", problem, { min: 1 }),
        })),
      };
    }
  }
  return { categories, pro };
}

/** outRun<step>@zz.xml: <OutRun kartId characterId track gameSpeed><LevelContent level ksv/>. */
export function outRunRow(root, problem) {
  if (root.name !== "OutRun") problem(`outRun root is ${root.name}`);
  const content = root.children.find(child => child.name === "LevelContent");
  return {
    kartId: integer(root, "kartId", problem),
    characterId: integer(root, "characterId", problem),
    track: (attr(root, "track") ?? "").trim(),
    speed: integer(root, "gameSpeed", problem),
    ksv: (content && attr(content, "ksv") || "").trim(),
  };
}

/**
 * The license table. outRuns maps a duel step to its outRun row with
 * rivalMs filled in; stocks is stock.kml by id.
 */
export function licenseRows({ missions, locale, outRuns, stocks, tracks }, problem) {
  const licenses = [];
  const rewardStocks = {};
  for (const category of locale.categories) {
    if (category.level < 1 || category.level > LICENSE_NAMES.length) {
      problem(`riderSchoolLocale catLevel ${category.level}`);
      continue;
    }
    const steps = category.steps.map(row => {
      const mission = missions.get(row.step);
      if (!mission) {
        problem(`riderSchoolLocale step ${row.step} has no mission`);
        return undefined;
      }
      const rule = ruleOf(mission.mission);
      const step = { step: row.step, mission: mission.mission, rule, name: row.name, icon: mission.icon,
        track: mission.track,
        laps: mission.laps, speed: mission.speed, timeMs: rule === "time" ? mission.timeMs : 0,
        stockId: row.stockId };
      if (!step.track) problem(`step ${row.step}: no track`);
      if (!tracks.has(step.track.toLowerCase())) problem(`step ${row.step}: track ${step.track} has no track.1s`);
      if (rule === "rival") {
        const outRun = outRuns.get(row.step);
        if (!outRun || !outRun.ksv || !(outRun.rivalMs > 0)) problem(`step ${row.step}: no rival ghost`);
        else {
          if (outRun.track.toLowerCase() !== step.track.toLowerCase())
            problem(`step ${row.step}: outRun track ${outRun.track} is not ${step.track}`);
          step.speed = outRun.speed;
          step.rival = { kartId: outRun.kartId, characterId: outRun.characterId, ksv: outRun.ksv };
          step.rivalMs = outRun.rivalMs;
        }
      }
      const stock = stocks.get(row.stockId);
      if (!stock || stock.items.length === 0) problem(`step ${row.step}: reward stock ${row.stockId} is not in stock.kml`);
      else rewardStocks[row.stockId] = { name: stock.name, items: stock.items };
      return step;
    }).filter(Boolean);
    licenses.push({ level: category.level, name: LICENSE_NAMES[category.level - 1], steps });
  }
  licenses.sort((a, b) => a.level - b.level);
  licenses.forEach((license, index) => {
    if (license.level !== index + 1) problem(`license levels are not 1..${licenses.length}`);
  });
  if (!locale.pro || locale.pro.qualify.length === 0) problem("riderSchoolLocale: no proCategory");
  const pro = locale.pro && {
    emblemId: locale.pro.emblemId,
    qualify: locale.pro.qualify.map(row => {
      if (!tracks.has(row.track.toLowerCase())) problem(`pro qualification track ${row.track} has no track.1s`);
      return row;
    }),
  };
  return { licenses, pro, rewardStocks };
}
