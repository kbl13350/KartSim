/** Multiplayer finish screen assembled from the game's original BML panels. */
import { formatRaceReward, parseRaceRewards, type RaceReward } from "../account/rewards";

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
}

export interface ResultRace {
  roster: Array<{ playerId: unknown; team?: number | null; name: string }>;
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

const folder = "stage_/mqGameFinal";

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
  rewards = new Map<string, RaceReward>();
  private newPageClock!: ResultViewDependencies["newPageClock"];

  static async load(library: unknown, root: unknown, race: ResultRace,
    localPlayerId: unknown, teamMode: boolean = false,
    deps: ResultViewDependencies): Promise<MultiplayerResultView> {
    const screen = new this();
    screen.newPageClock = deps.newPageClock;
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

    const rows = race.roster.map((_, index) => {
      const left = listMargin[0]!;
      const top = listMargin[1]! + index * rowHeight;
      const copy = prefixedCopy(rowTemplate, `row${index}/`, deps);
      const nameLabel = deps.showRewards
        ? copy.children.find(child => deps.attribute(child, "name") === `row${index}/id`)
        : undefined;
      const row = nameLabel ? deps.cloneNode(copy, {}, [...copy.children,
        deps.cloneNode(nameLabel, { ...REWARD_LABEL, name: `row${index}/reward` })]) : copy;
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
    if (teamStyles) {
      const scorePage = await deps.loadBml(library, folder, "speedTeam_RightPage1@zz");
      const background = named(scorePage, "background", deps);
      const scoreBox = named(scorePage, "scoreBox", deps);
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
    if (part === "tp") return { text: String(result.points) };
    if (part === "reward") {
      const reward = this.rewards.get(String(result.playerId));
      return reward ? { visible: true, text: formatRaceReward(reward) } : { visible: false };
    }
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

  show(results: ResultEntry[], time = performance.now(),
    outcome?: { teamScores?: Record<number, number>; winningTeam?: number;
      rewards?: unknown }): void {
    this.teamScores = outcome?.teamScores;
    this.winningTeam = outcome?.winningTeam;
    this.rewards = parseRaceRewards(outcome?.rewards);
    this.results = results.map(result => ({ ...result }));
    this.page = this.newPageClock(time);
    this.pageOffset = -this.pageWidth;
    this.view.show();
  }

  update(time: number): boolean {
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
