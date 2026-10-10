/** Multiplayer finish screen assembled from the game's original BML panels. */
import {
  formatRaceReward, formatRaceRewardLines, parseRaceRewards, type RaceReward,
} from "../account/rewards";

export interface ResultNode {
  name: string;
  text: string;
  attributes: Array<{ name: string; value: string }>;
  children: ResultNode[];
}

export interface ResultEntry {
  playerId: unknown;
  points: number;
  elapsedMs: number | null;
  rank: number;
  /** Item race result titles (ITEM_MODE.md C.9), internal keys. */
  titles?: readonly string[];
}

export interface ResultRace {
  roster: Array<{ playerId: unknown; team?: number | null; name: string }>;
  /** The room's gameplay and channel: item races show the result titles. */
  gameplay?: unknown;
  channelName?: unknown;
}

/**
 * The item race result titles (stage_mqGameFinal title_icons/namemap@zz, in
 * its order): the server's internal key, the condition of the namemap row it
 * matches, and the Chinese name ([还原]: the data has no CN string,
 * ITEM_MODE.md C.9). 백발백중 has no icon in the archive.
 */
export const ITEM_RESULT_TITLES: ReadonlyArray<{
  key: string; match: Record<string, string>; korean: string; chinese: string; icon: boolean;
}> = [
  { key: "perfectAim", match: { fail: "0" }, korean: "백발백중", chinese: "百发百中", icon: false },
  { key: "ironWall", match: { item: "angel" }, korean: "철벽방어", chinese: "铁壁防御", icon: true },
  { key: "turret", match: { item: "rocket" }, korean: "터렛모드", chinese: "炮台模式", icon: true },
  { key: "flyKing", match: { item: "waterFly" }, korean: "파리대왕", chinese: "苍蝇之王", icon: true },
  { key: "carpetBomb", match: { item: "waterBomb" }, korean: "융단폭격", chinese: "地毯式轰炸", icon: true },
  { key: "cloudyDay", match: { item: "cloud" }, korean: "구름낀날", chinese: "阴云密布", icon: true },
  { key: "magnetic", match: { item: "magnet" }, korean: "왠지끌려", chinese: "莫名吸引", icon: true },
  { key: "invasion", match: { item: "ufo" }, korean: "지구침공", chinese: "入侵地球", icon: true },
  { key: "speedWar", match: { item: "booster" }, korean: "스피드전", chinese: "速度战", icon: true },
  { key: "perfectStart", match: { custom: "1" }, korean: "완벽출발", chinese: "完美起步", icon: true },
  { key: "onlyOne", match: { custom: "2" }, korean: "유아독존", chinese: "唯我独尊", icon: true },
  { key: "safetyFirst", match: { custom: "3" }, korean: "안전제일", chinese: "安全第一", icon: true },
];

/** PopList titleCont focusTick: the title name changes every 1600 ms. */
export const ITEM_RESULT_TITLE_TICK_MS = 1600;
/** viewIcons (0 5 90 40, right aligned, listGap 1) holds four 20×20 icons. */
const TITLE_ICON_SIZE = 20;
const TITLE_ICON_STEP = TITLE_ICON_SIZE + 1;
const TITLE_LIST_WIDTH = 90;
const TITLE_FRAME_WIDTH = 70;

function isItemResultRace(race: ResultRace): boolean {
  return race.gameplay === "item" ||
    (typeof race.channelName === "string" && /^item/.test(race.channelName));
}

export interface ResultView {
  show(): void;
  hide(): void;
  render(): void;
  dispose(): void;
}

export interface ResultViewDependencies {
  loadBml(library: unknown, folder: string, name: string): Promise<ResultNode>;
  attribute(node: ResultNode, name: string): string | undefined;
  cloneNode(node: ResultNode, attributes: Record<string, string>, children?: ResultNode[]): ResultNode;
  loadTeams(library: unknown): Promise<Array<{ alias: string; dyeId: number }>>;
  loadDye(library: unknown, id: number): Promise<number>;
  loadView(options: {
    library: unknown; root: unknown; definition: ResultNode; roots: string[];
    smoothImages: boolean; preserveDisplayPixels: boolean; label: string;
    modulateTextures: boolean; state(node: ResultNode): Record<string, unknown>;
  }): Promise<ResultView>;
  smoothImages(): boolean;
  stageHeight: number;
  formatTime(milliseconds: number): { min: string; sec: string; mil: string };
  newPageClock(time: number): {
    update(time: number): { offset: number; complete: boolean };
  };
  /**
   * Add a "+经验 +金币" label to each row for `race.rewards` (ECONOMY.md 2.1).
   * Off keeps the release page exactly.
   */
  showRewards?: boolean;
}

/** The reward label sits between the name and the time columns of both row layouts. */
const REWARD_LABEL = {
  leftTopWH: "300 15 196 30", textAlign: "right,vcenter", textColor: "255 255 222 0",
};
/**
 * Item races: titleCont (270 0 210 40) draws the title name and icons up to
 * x 360 (viewIcons 0 5 90 40, right aligned), so the reward takes the column
 * from there to the time, in the titles' 16 px font: one line before the
 * individual row's time label (549), two (exp over lucci) before the team
 * row's centred time text (about 510 in time 500 0 615 66).
 */
const ITEM_REWARD_LABEL = { ...REWARD_LABEL, leftTopWH: "362 15 184 30", textRender: "outline16" };
const ITEM_TEAM_REWARD_LINES = [
  { ...ITEM_REWARD_LABEL, leftTopWH: "362 11 131 20" },
  { ...ITEM_REWARD_LABEL, leftTopWH: "362 31 131 20" },
];

const folder = "stage_/mqGameFinal";

/**
 * Result layout: individual (`false`), speed team (`true`) or item team. 组队道具赛
 * is won by the team of the first finisher without points, like the original
 * item result line (item_line_template@zz has no TP column and itemResultPanel
 * no score box), so it keeps the team rows and win icon but drops the TP
 * column and the TP board.
 */
export type ResultTeamMode = boolean | "item-team";

function named(node: ResultNode, name: string, deps: ResultViewDependencies): ResultNode | undefined {
  return node.children.find(child => deps.attribute(child, "name") === name);
}

function prefixedCopy(node: ResultNode, prefix: string, deps: ResultViewDependencies): ResultNode {
  return deps.cloneNode(node, { name: prefix + (deps.attribute(node, "name") ?? "") },
    node.children.map(child => prefixedCopy(child, prefix, deps)));
}

export class MultiplayerResultView {
  results: ResultEntry[] = [];
  view!: ResultView;
  page?: ReturnType<ResultViewDependencies["newPageClock"]>;
  pageOffset = 0;
  pageWidth = 0;
  teamScores?: Record<number, number>;
  winningTeam?: number;
  /** 组队道具赛 results show no team points. */
  hidePoints = false;
  rewards = new Map<string, RaceReward>();
  /** Item races: the result titles (internal key → namemap row), in namemap order. */
  titles?: Array<(typeof ITEM_RESULT_TITLES)[number]>;
  /** The page clock's time of the last update and the show time (the title cycle). */
  nowMs = 0;
  shownAtMs = 0;
  private newPageClock!: ResultViewDependencies["newPageClock"];

  static async load(library: unknown, root: unknown, race: ResultRace,
    localPlayerId: unknown, layout: ResultTeamMode = false,
    deps: ResultViewDependencies): Promise<MultiplayerResultView> {
    const screen = new this();
    screen.newPageClock = deps.newPageClock;
    const teamMode = layout !== false;
    screen.hidePoints = layout === "item-team";
    const teamStyles = teamMode ? await deps.loadTeams(library) : undefined;
    const localTeam = race.roster.find(player => player.playerId === localPlayerId)?.team;
    const localDye = teamStyles && localTeam
      ? await deps.loadDye(library, teamStyles[localTeam - 1]!.dyeId)
      : undefined;
    const localDyeChannels = localDye === undefined ? undefined
      : [24, 16, 8, 0].map(shift => (localDye >>> shift) & 255).join(" ");

    const rowTemplate = await deps.loadBml(library, folder,
      teamMode ? "speedTeam_page1_line@zz" : "default_page1_line@zz");
    const listTemplate = await deps.loadBml(library, folder,
      teamMode ? "speedTeam_page1@zz" : "default_page1@zz");
    const list = deps.attribute(listTemplate, "name") === "resultList"
      ? listTemplate : named(listTemplate, "resultList", deps);
    if (!list) throw Error("缺少成绩列表。");
    screen.pageWidth = Number(deps.attribute(list, "leftTopWH")!.split(" ")[2]);

    const stage = await deps.loadBml(library, folder, "stage_window@zz");
    const stageResults = named(stage, "resultCon", deps);
    if (!stageResults) throw new Error("多人结果缺少 resultCon。");
    const rowHeight = Number(deps.attribute(rowTemplate, "windowRect")!.split(" ")[3]);
    const listMargin = deps.attribute(list, "listMargin")!.split(" ").map(Number);

    if (isItemResultRace(race)) screen.titles = await itemResultTitles(library, deps);
    const rows = race.roster.map((_, index) => {
      const left = listMargin[0]!;
      const top = listMargin[1]! + index * rowHeight;
      const copy = withTitleIcons(prefixedCopy(rowTemplate, `row${index}/`, deps), index,
        screen.titles, deps);
      const nameLabel = deps.showRewards
        ? copy.children.find(child => deps.attribute(child, "name") === `row${index}/id`)
        : undefined;
      const rewardLabels = !screen.titles ? [{ ...REWARD_LABEL, name: `row${index}/reward` }]
        : !teamMode ? [{ ...ITEM_REWARD_LABEL, name: `row${index}/reward` }]
        : ITEM_TEAM_REWARD_LINES.map((label, line) => ({ ...label, name: `row${index}/reward${line}` }));
      const row = nameLabel ? deps.cloneNode(copy, {}, [...copy.children,
        ...rewardLabels.map(label => deps.cloneNode(nameLabel, label))]) : copy;
      const rectangle = { windowRect: `${left} ${top} ${left + 664} ${top + rowHeight}` };
      if (!teamStyles) {
        return deps.cloneNode(row, rectangle, row.children.map(child =>
          deps.attribute(child, "name") === `row${index}/bg`
            ? deps.cloneNode(child, { image: index === 0 ? "bgTop_1" : "bgMid_1" })
            : child));
      }
      return deps.cloneNode(row, rectangle, row.children.flatMap(child => {
        const name = deps.attribute(child, "name");
        if (name === `row${index}/colorBg` && localDyeChannels) {
          return [deps.cloneNode(child, {}, child.children.map(part =>
            deps.cloneNode(part, { color: localDyeChannels })))];
        }
        if (name === `row${index}/bg` || name === `row${index}/team`) {
          return teamStyles.map((team, teamIndex) => deps.cloneNode(child, {
            name: `row${index}/${name.endsWith("/bg") ? "bg" : "team"}${teamIndex + 1}`,
            image: `${team.alias}Bg`,
          }));
        }
        return [child];
      }));
    });

    const otherPanels: ResultNode[] = [];
    const winIcons: ResultNode[] = [];
    if (teamStyles && !screen.hidePoints) {
      const scorePage = await deps.loadBml(library, folder, "speedTeam_RightPage1@zz");
      const background = named(scorePage, "background", deps);
      const scoreBox = named(scorePage, "scoreBox", deps);
      const scoreTemplate = scoreBox!.children[0]!;
      const scoreWidth = Number(deps.attribute(scoreTemplate, "leftTopWH")!.split(" ")[2]);
      const scorePanels = ["blue", "red"].map((alias, order) => {
        const teamNumber = teamStyles.findIndex(team => team.alias === alias) + 1;
        if (teamNumber < 1) throw Error("双队积分板缺少红蓝队映射。");
        const panel = prefixedCopy(scoreTemplate, `score${teamNumber}/`, deps);
        return deps.cloneNode(panel, { leftTopWH: `${order * scoreWidth} 0 ${scoreWidth} 58` },
          panel.children.map(child => child.name === "TpBoard"
            ? { ...deps.cloneNode(child, { centerAlign: "true" }), name: "CharPanel" }
            : child));
      });
      otherPanels.push(deps.cloneNode(scorePage, {
        name: "teamRight", align: "right",
        windowSize: deps.attribute(scorePage, "windowSize")!
          .replace("fullheight", String(deps.stageHeight)),
      }, [
        { ...background!, name: "Container" },
        { ...scoreBox!, name: "Container", children: scorePanels },
      ]));
    }
    if (teamStyles) {
      const winIcon = named(await deps.loadBml(library, folder, "team_RightPage2@cn"),
        "resultWinteam", deps);
      if (!winIcon) throw Error("组队赛结果缺少 resultWinteam。");
      const iconHeight = Number(deps.attribute(winIcon, "windowSize")!.split(" ")[1]);
      if (!Number.isFinite(iconHeight)) throw Error("组队赛胜利图标高度无效。");
      for (const teamNumber of [1, 2]) {
        winIcons.push(deps.cloneNode(winIcon, {
          name: `teamWin${teamNumber}`,
          texture: teamNumber === 1 ? "redWin@cn" : "blueWin@cn",
          align: "right,top", adjust: `0 -${iconHeight}`,
        }));
      }
    }

    const definition: ResultNode = {
      name: "Container", text: "",
      attributes: [{ name: "windowRect", value: "fullscreen" }],
      children: [stageResults, { ...list, name: "Container", children: [...rows, ...winIcons] },
        ...otherPanels],
    };
    screen.view = await deps.loadView({
      library, root, definition,
      roots: [folder, "stage_/common", "gui_/windowTemplate"],
      smoothImages: deps.smoothImages(),
      preserveDisplayPixels: deps.smoothImages(),
      label: "比赛结果", modulateTextures: true,
      state: node => screen.nodeState(node, race, localPlayerId, deps),
    });
    return screen;
  }

  private nodeState(node: ResultNode, race: ResultRace, localPlayerId: unknown,
    deps: ResultViewDependencies): Record<string, unknown> {
    const name = deps.attribute(node, "name") ?? "";
    const row = /^row(\d+)\/(.*)$/.exec(name);
    if (name === "resultList") return { offsetX: this.pageOffset };
    if (name === "teamRight") return { offsetX: -this.pageOffset };
    if (name === "teamWin1" || name === "teamWin2")
      return { visible: this.winningTeam === Number(name.at(-1)) };
    const score = /^score([12])\/board$/.exec(name);
    if (score) return { text: String(this.teamScores?.[Number(score[1])] ?? 0) };
    if (!row) return name === "riderRankCon" ? { visible: false } : {};
    const result = this.results[Number(row[1])];
    const part = row[2];
    if (!result) return { visible: false };
    if (part === "timeCon1" || part === "bg") return { visible: true };
    const teamPart = /^(bg|team)([12])$/.exec(part!);
    if (teamPart) return {
      visible: race.roster.find(player => player.playerId === result.playerId)?.team ===
        Number(teamPart[2]),
    };
    if (part === "tp") return this.hidePoints
      ? { visible: false } : { text: String(result.points) };
    const rewardLine = /^reward([01]?)$/.exec(part!);
    if (rewardLine) {
      const reward = this.rewards.get(String(result.playerId));
      if (!reward) return { visible: false };
      return { visible: true, text: rewardLine[1] ? formatRaceRewardLines(reward)[Number(rewardLine[1])]
        : formatRaceReward(reward) };
    }
    const title = this.titleState(part!, result);
    if (title) return title;
    if (["timeCon2", "titleCont", "team"].includes(part!)) return { visible: false };
    if (part === "colorBg" || part === "meLine")
      return { visible: result.playerId === localPlayerId };
    if (part === "rank")
      return { text: result.elapsedMs === null ? "x" : String(result.rank) };
    if (part === "id")
      return { text: race.roster.find(player => player.playerId === result.playerId)!.name };
    if (part === "time") {
      if (result.elapsedMs === null) return { text: "未完成" };
      const time = deps.formatTime(result.elapsedMs);
      return { text: `${time.min}:${time.sec}:${time.mil}` };
    }
    return {};
  }

  /**
   * titleCont of an item race row: the row's title icons right aligned in
   * viewIcons (the focused one with its `_2` icon), and titleFrame popping
   * the focused title's name beside them, the focus moving every 1600 ms.
   */
  private titleState(part: string, result: ResultEntry): Record<string, unknown> | undefined {
    if (!this.titles) return undefined;
    const owned = this.titles.filter(title => result.titles?.includes(title.key));
    const isTitlePart = part === "titleCont" || part === "titleFrame" || part === "title" ||
      part === "viewIcons" || part.startsWith("titleIcon/");
    if (!isTitlePart) return undefined;
    if (owned.length === 0) return { visible: false };
    const focus = Math.floor(Math.max(0, this.nowMs - this.shownAtMs) / ITEM_RESULT_TITLE_TICK_MS) %
      owned.length;
    const icons = owned.filter(title => title.icon).slice(-Math.floor(TITLE_LIST_WIDTH / TITLE_ICON_STEP));
    const iconsLeft = TITLE_LIST_WIDTH - icons.length * TITLE_ICON_STEP;
    if (part === "titleCont" || part === "viewIcons") return { visible: true };
    if (part === "titleFrame") return { visible: true, offsetX: iconsLeft - TITLE_FRAME_WIDTH - 2 };
    if (part === "title") return { visible: true, text: owned[focus]!.chinese };
    const [, key, frame] = part.split("/");
    const at = icons.findIndex(title => title.key === key);
    const focused = owned[focus]!.key === key;
    if (at < 0 || (frame === "2") !== focused) return { visible: false };
    return { visible: true, offsetX: iconsLeft + at * TITLE_ICON_STEP };
  }

  show(results: ResultEntry[], time = performance.now(),
    outcome?: { teamScores?: Record<number, number>; winningTeam?: number;
      rewards?: unknown }): void {
    this.teamScores = outcome?.teamScores;
    this.winningTeam = outcome?.winningTeam;
    this.rewards = parseRaceRewards(outcome?.rewards);
    this.results = results.map(result => ({ ...result,
      ...(Array.isArray(result.titles) ? { titles: result.titles.filter(title =>
        typeof title === "string") } : {}) }));
    this.page = this.newPageClock(time);
    this.pageOffset = -this.pageWidth;
    this.nowMs = time;
    this.shownAtMs = time;
    this.view.show();
  }

  update(time: number): boolean {
    this.nowMs = time;
    if (!this.page) return false;
    const page = this.page.update(time);
    this.pageOffset = page.offset * this.pageWidth;
    if (page.complete) this.view.hide();
    else this.view.render();
    return page.complete;
  }

  dispose(): void {
    this.view.dispose();
  }
}

/** namemap@zz rows mapped to the internal title keys; the built-in table when it cannot be read. */
async function itemResultTitles(library: unknown,
  deps: ResultViewDependencies): Promise<Array<(typeof ITEM_RESULT_TITLES)[number]>> {
  try {
    const namemap = await deps.loadBml(library, `${folder}/title_icons`, "namemap@zz");
    const titles: Array<(typeof ITEM_RESULT_TITLES)[number]> = [];
    for (const row of namemap.children) {
      const title = ITEM_RESULT_TITLES.find(entry => Object.entries(entry.match)
        .every(([name, value]) => deps.attribute(row, name) === value));
      if (title) titles.push({ ...title, korean: deps.attribute(row, "name") ?? title.korean });
    }
    if (titles.length === ITEM_RESULT_TITLES.length) return titles;
  } catch {
    // The table below mirrors namemap@zz.
  }
  return [...ITEM_RESULT_TITLES];
}

/** Every title icon of the row (normal `_1` and focused `_2`), inside its titleCont. */
function withTitleIcons(row: ResultNode, index: number,
  titles: ReadonlyArray<(typeof ITEM_RESULT_TITLES)[number]> | undefined,
  deps: ResultViewDependencies): ResultNode {
  if (!titles) return row;
  const contName = `row${index}/titleCont`;
  const add = (node: ResultNode): ResultNode => deps.attribute(node, "name") === contName
    ? deps.cloneNode(node, {}, [...node.children, ...titles.filter(title => title.icon).flatMap(title =>
      ["1", "2"].map(frame => deps.cloneNode({ name: "Panel", text: "", attributes: [], children: [] }, {
        name: `row${index}/titleIcon/${title.key}/${frame}`,
        leftTopWH: `0 10 ${TITLE_ICON_SIZE} ${TITLE_ICON_SIZE}`,
        texture: `${title.korean}_${frame}`, resourceRoot: `${folder}/title_icons`,
        alphaBlend: "true", visible: "false",
      }, [])))])
    : deps.cloneNode(node, {}, node.children.map(add));
  return add(row);
}
