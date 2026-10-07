/** Roadblock race HUD and result panels built from the original BML assets. */

import type { ResultNode } from "./multiplayer-result-view";

export interface RoadblockRace {
  roadblock?: { limitMs: number; runnerId: unknown; noRunnerManualReset?: boolean };
  roster: Array<{ playerId: unknown; team: number | null; slot: number; name: string }>;
  roadblockOutcome?: { reason: string; runnerWon: boolean; endAt: number };
  startAt: number;
}

export interface RoadblockView {
  element: { style: { pointerEvents: string } };
  show(): void;
  hide(): void;
  render(): void;
  dispose(): void;
}

export interface RoadblockDependencies {
  loadBml(library: unknown, folder: string, name: string): Promise<ResultNode>;
  attribute(node: ResultNode, name: string): string | undefined;
  cloneNode(node: ResultNode, attributes: Record<string, string>, children?: ResultNode[]): ResultNode;
  rectangle(node: ResultNode, parent: { x: number; y: number; width: number; height: number }):
    { x: number; y: number; width: number; height: number };
  numberTokens(text: string | undefined, count: number, label: string): number[];
  loadView(options: {
    library: unknown; root: unknown; definition: ResultNode; roots: string[];
    label: string; projectTexture?: unknown;
    state(node: ResultNode): Record<string, unknown>;
  }): Promise<RoadblockView>;
  projectTexture?: unknown;
}

const hudFolder = "stage_/mqRoadBlockSpeedGame";
const resultFolder = "stage_/mqRoadBlockGameFinal";

function childNamed(node: ResultNode, name: string, deps: RoadblockDependencies): ResultNode | undefined {
  return node.children.find(child => deps.attribute(child, "name") === name);
}

export class RoadblockResultView {
  view!: RoadblockView;
  remainingMs = 0;
  runnerLap?: number;
  totalLaps?: number;
  race?: RoadblockRace;
  resultRoster: RoadblockRace["roster"] = [];
  shownAt?: number;
  disposed = false;

  static async loadHud(library: unknown, root: unknown, race: RoadblockRace,
    localPlayerId: unknown, deps: RoadblockDependencies): Promise<RoadblockResultView> {
    if (!race.roadblock) throw new Error("挡人HUD缺少冻结参数。");
    const screen = new this();
    screen.remainingMs = race.roadblock.limitMs;
    const score = await deps.loadBml(library, hudFolder, "scoreUi");
    const time = await deps.loadBml(library, hudFolder, "timeUi");
    const isRunner = race.roadblock.runnerId === localPlayerId;
    const lapText = childNamed(time, "lapText", deps);
    const lapInfo = childNamed(time, "lapinfo", deps);
    if (!lapText || !lapInfo) throw new Error("挡人HUD缺少角色图或圈数。");
    const handicap = childNamed(lapText, "runnerHandicap", deps);
    const rankBoard = await deps.loadBml(library, hudFolder, "rankBoard");
    const role = childNamed(rankBoard, "roleText", deps);
    if (!handicap || !role) throw new Error("挡人HUD缺少原版身份或禁 R 标识。");
    const lapNumber = childNamed(await deps.loadBml(library,
      "stage_/speedIndiGame", "timeInfo@cn"), "lapinfo", deps);
    if (!lapNumber) throw new Error("挡人HUD缺少当前数字图集的圈数模板。");

    const viewport = { ...deps.rectangle(time, { x: 0, y: 0, width: 1600, height: 900 }), x: 0, y: 0 };
    const lapInfoRect = deps.rectangle(lapInfo, viewport);
    const numberRect = deps.rectangle(lapNumber, viewport);
    const gap = deps.rectangle(lapText, viewport).y - lapInfoRect.y - lapInfoRect.height;
    const [left] = deps.numberTokens(deps.attribute(lapText, "leftTopTex"), 2, "lapText.leftTopTex");
    const top = numberRect.y + numberRect.height + gap;
    const definition: ResultNode = {
      name: "Container", text: "",
      attributes: [{ name: "windowRect", value: "fullscreen" }],
      children: [
        score,
        { ...time, children: [
          deps.cloneNode(lapText, {
            texture: isRunner ? "lap_RunnerText@cn" : "lap_BlockerText@cn",
            leftTopTex: `${left} ${top}`,
          }, [deps.cloneNode(handicap, {
            texture: "lap_HandicapText@cn",
            visible: String(isRunner && race.roadblock.noRunnerManualReset),
          })]),
          lapNumber,
        ] },
        { ...rankBoard, children: [deps.cloneNode(role, {
          texture: isRunner ? "rank_RunnerText@cn" : "rank_BlockerText@cn",
        })] },
      ],
    };
    screen.view = await deps.loadView({
      library, root, definition,
      roots: [hudFolder, "stage_/common", "stage_/speedIndiGame", "stage_/itemIndiGame"],
      label: isRunner ? "跑者：到达终点" : "挡人方：阻止跑者",
      projectTexture: deps.projectTexture,
      state: node => {
        const name = deps.attribute(node, "name");
        const ms = screen.remainingMs;
        if (name === "min") return { text: String(Math.floor(ms / 60000)).padStart(2, "0") };
        if (name === "sec") return { text: String(Math.floor(ms / 1000) % 60).padStart(2, "0") };
        if (name === "mil") return { text: String(Math.floor(ms / 10) % 100).padStart(2, "0") };
        if (name === "myLap") return { text: screen.runnerLap === undefined ? "" : String(screen.runnerLap) };
        if (name === "totalLap") return { text: screen.totalLaps === undefined ? "" : String(screen.totalLaps) };
        return {};
      },
    });
    screen.view.element.style.pointerEvents = "none";
    screen.view.show();
    return screen;
  }

  static async loadResult(library: unknown, root: unknown, race: RoadblockRace,
    deps: RoadblockDependencies): Promise<RoadblockResultView> {
    if (!race?.roadblock) throw new Error("挡人结果缺少冻结参数。");
    const screen = new this();
    const stage = await deps.loadBml(library, resultFolder, "stage_window@zz");
    const gameResult = childNamed(stage, "gameResult", deps);
    if (!gameResult) throw new Error("挡人结果缺少专用界面。");
    const title = childNamed(gameResult, "gameResultTitle", deps);
    if (!title) throw new Error("挡人结果缺少胜负图片槽。");
    const outcomes = [true, false].map(won => deps.cloneNode(title, {
      name: won ? "runnerWin" : "runnerLose",
      texture: won ? "gameresult_RunnerWin@cn" : "gameresult_RunnerLose@cn",
    }));
    const shiftTimeLabel = (node: ResultNode): ResultNode =>
      deps.cloneNode(node, ["finishTime", "runnerRetire"].includes(deps.attribute(node, "name") ?? "")
        ? { windowRect: "0 34 239 60" } : {}, node.children.map(shiftTimeLabel));

    if (!race.roadblock || race.roster.some(player => player.team !== null))
      throw new Error("挡人结果名单缺少冻结的个人赛身份。");
    const runner = race.roster.find(player => player.playerId === race.roadblock!.runnerId);
    if (!runner) throw new Error("挡人结果名单缺少冻结的跑者。");
    screen.resultRoster = [structuredClone(runner),
      ...race.roster.filter(player => player !== runner)
        .sort((a, b) => a.slot - b.slot).map(player => structuredClone(player))];

    const [page, line, blank, leftRunner] = await Promise.all([
      "default_page2@zz", "default_page2_line@cn", "default_page2_nullLine@cn",
      "default_page2_leaveRunner@cn",
    ].map(name => deps.loadBml(library, resultFolder, name)));
    const list = childNamed(page!, "resultList", deps);
    if (!list) throw new Error("挡人结果缺少原版名单槽。");
    const [marginX, marginY] = deps.numberTokens(deps.attribute(list, "listMargin"),
      4, "resultList.listMargin");
    const rowHeight = (node: ResultNode) => {
      const [, y1, , y2] = deps.numberTokens(deps.attribute(node, "windowRect"),
        4, "result row.windowRect");
      return y2! - y1!;
    };
    const lineHeight = rowHeight(line!);
    const blankHeight = rowHeight(blank!);
    const placeRow = (template: ResultNode, name: string, top: number) => {
      const [x1, y1, x2, y2] = deps.numberTokens(deps.attribute(template, "windowRect"),
        4, "result row.windowRect");
      return deps.cloneNode(template, {
        name, windowRect: `${marginX} ${top} ${marginX! + x2! - x1!} ${top + y2! - y1!}`,
      });
    };
    const rows: ResultNode[] = [];
    let top = marginY!;
    for (let index = 0; index < screen.resultRoster.length; index++) {
      const upper = childNamed(line!, "upperCont", deps);
      const id = upper && childNamed(upper, "id", deps);
      const background = childNamed(line!, "bg", deps);
      if (!upper || !id || !background) throw new Error("挡人名单缺少原版身份行。");
      const row = deps.cloneNode(line!, {}, [
        deps.cloneNode(background, { texture: index === 0 ? "bgTop" : "bgMid" }),
        { ...upper, children: [deps.cloneNode(id, { name: `roadblockName${index}` })] },
      ]);
      rows.push(placeRow(row, `roadblockRow${index}`, top));
      if (index === 0) {
        rows.push(placeRow(leftRunner!, "roadblockRunnerLeft", top));
        top += lineHeight;
        rows.push(placeRow(blank!, "roadblockGap", top));
        top += blankHeight;
      } else top += lineHeight;
    }
    const [pageX, pageY, pageWidth, pageHeight] = deps.numberTokens(
      deps.attribute(page!, "leftTopWH"), 4, "result page.leftTopWH");
    const shiftedPage = deps.cloneNode(page!, {
      leftTopWH: `${pageX} ${pageY! + 50} ${pageWidth} ${pageHeight}`,
    }, page!.children.map(child => {
      const name = deps.attribute(child, "name");
      return child === list ? { ...child, name: "Container", children: rows }
        : name === "runnerHeader" || name === "blockerHeader"
          ? deps.cloneNode(child, { texture: `${name}@cn` }) : child;
    }));
    const definition = { ...stage, children: [
      deps.cloneNode(gameResult, { windowRect: "550 50 964 215" }, [
        ...outcomes,
        ...gameResult.children.filter(child => child !== title).map(shiftTimeLabel),
      ]), shiftedPage,
    ] };
    screen.view = await deps.loadView({
      library, root, definition, roots: [resultFolder, "stage_/common"],
      label: "挡人模式结果",
      state: node => {
        const name = deps.attribute(node, "name");
        const outcome = screen.race?.roadblockOutcome;
        const match = /^roadblockName(\d+)$/.exec(name ?? "");
        if (match) return { text: screen.resultRoster[Number(match[1])]!.name };
        if (name === "roadblockRow0") return { visible: outcome?.reason !== "runner-left" };
        if (name === "roadblockRunnerLeft") return { visible: outcome?.reason === "runner-left" };
        if (name === "runnerWin" || name === "runnerLose")
          return { visible: !!outcome && outcome.runnerWon === (name === "runnerWin") };
        if (name === "limitTime")
          return { text: `限制时间：${Math.floor((screen.race?.roadblock?.limitMs ?? 0) / 60000)} 分钟` };
        if (name === "finishTime") return {
          visible: !!outcome?.runnerWon,
          text: outcome?.runnerWon
            ? `完成时间：${((outcome.endAt - screen.race!.startAt) / 1000).toFixed(2)} 秒` : "",
        };
        if (name === "runnerRetire") return { visible: !!outcome && !outcome.runnerWon };
        return {};
      },
    });
    screen.view.element.style.pointerEvents = "none";
    return screen;
  }

  setRemaining(milliseconds: number): void {
    if (!this.disposed) {
      this.remainingMs = Math.max(0, milliseconds);
      this.view.render();
    }
  }

  setRunnerLaps(lap: number | undefined, total: number): void {
    if (!this.disposed) {
      this.totalLaps = total;
      this.runnerLap = lap === undefined ? undefined : Math.min(total, Math.max(1, lap));
      this.view.render();
    }
  }

  hide(): void { if (!this.disposed) this.view.hide(); }

  show(_results: unknown, time: number, race?: RoadblockRace): void {
    if (this.disposed || !race?.roadblockOutcome)
      throw new Error("挡人权威结果尚未到达。");
    this.race = structuredClone(race);
    this.shownAt = time;
    this.view.show();
  }

  update(time: number): boolean {
    return this.shownAt === undefined ? false : time - this.shownAt >= 6000;
  }

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.view.dispose();
    }
  }
}
