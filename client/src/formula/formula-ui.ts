import { tr } from "../i18n/locale";
import { FONT, ImageCache, drawFitted, node, nodeName, paintText,
  type BmlLibrary, type Node, type NodeState, type Rect, type WindowView } from "../ui/bml-kit";
import { TEXT, button, drawLabel, loadWindow } from "../ui/resource-window";
import type { FormulaDifficulty } from "./formula-data";

/** The old F1 mode's own illustrations, title cards and boost gauge. All are
 * resolved from the installed resource library, never from the research export. */
const TUTORIAL_ROOT = ["gui_/windowTemplate"];
const RESULT_ROOT = ["stage_/f1GameFinal", "stage_/common"];
const GAUGE_ROOT = ["stage_/f1Game", "stage_/speedTeamGame", "stage_/common"];
const DIFFICULTIES: ReadonlyArray<{ id: FormulaDifficulty; label: string; description: string }> = [
  { id: "veasy", label: "极易", description: "熟悉跟车充能与激进加速器，挑战极易档 NPC。" },
  { id: "easy", label: "容易", description: "保持跟车节奏，挑战容易档 NPC。" },
  { id: "normal", label: "普通", description: "把握超车时机，挑战普通档 NPC。" },
  { id: "hard", label: "困难", description: "合理利用激进加速和维修区，挑战困难档 NPC。" },
];
const TUTORIALS = [
  { title: "跟车充能", text: "追随前方 NPC 行驶，积攒激进加速器能量。" },
  { title: "激进加速", text: "能量充满后按 Space，或点击比赛中的激进加速按钮。加速期间撞击 NPC，可使对手短暂眩晕。" },
] as const;

export interface FormulaWindowHandle { readonly element: HTMLElement; dispose(): void }

export interface FormulaSetupOptions {
  root: HTMLElement;
  library: BmlLibrary;
  /** Names in the same order as the actual three-round schedule. */
  tracks?: readonly string[];
  difficulty?: FormulaDifficulty;
  onStart(difficulty: FormulaDifficulty): void;
  onClose(): void;
}

function label(name: string, x: number, y: number, width: number, height: number): Node {
  return node("Label", { name, leftTopWH: `${x} ${y} ${width} ${height}` });
}

function action(name: string, x: number, y: number, width: number, height = 34): Node {
  return node("TextButton", { name, leftTopWH: `${x} ${y} ${width} ${height}`, textRender: "bold16" });
}

function definition(title: string, width: number, height: number, children: Node[]): Node {
  return node("Panel", { windowRect: "fullscreen", color: "150 0 0 0", alphaBlend: "true" }, [
    node("CaptionWindow", { name: "formulaDialog", windowSize: `${width} ${height}`, frame: "CaptionDialog",
      caption: tr(title), captionPos: "0 1", align: "center", setCloseButton: "closeButton", textRender: "bold" }, children),
  ]);
}

/** Uses the release CaptionDialog and TextButton frame definitions. */
export function formulaSetupDefinition(): Node {
  return definition("极速方程 · 单人挑战", 1020, 694, [
    label("subtitle", 14, 4, 950, 34),
    label("difficultyTitle", 16, 50, 450, 24),
    ...DIFFICULTIES.map((difficulty, index) => action(`difficulty_${difficulty.id}`, 16 + index * 112, 82, 102)),
    label("difficultyDetail", 16, 127, 440, 54),
    label("scheduleTitle", 16, 193, 440, 26),
    label("schedule", 16, 233, 440, 118),
    label("rules", 16, 367, 440, 136),
    node("Window", { frame: "VSection", leftTopWH: "478 50 1 464" }),
    label("tutorialTitle", 504, 50, 450, 26),
    ...TUTORIALS.map((_tutorial, index) => action(`tutorial_${index}`, 504 + index * 230, 86, 218, 30)),
    label("tutorialImage", 504, 132, 450, 232),
    label("tutorialText", 516, 383, 426, 105),
    label("controls", 16, 526, 938, 32),
    action("cancelButton", 294, 577, 150, 38),
    action("startButton", 464, 577, 230, 38),
  ]);
}

export async function openFormulaSetup(options: FormulaSetupOptions): Promise<FormulaWindowHandle> {
  let selected = options.difficulty ?? "normal";
  let tutorial = 0;
  let view: WindowView | undefined;
  let disposed = false;
  const images = new ImageCache(options.library, () => { if (!disposed) view?.render(); });
  const dispose = (): void => { if (disposed) return; disposed = true; view?.dispose(); };
  const close = (): void => { if (disposed) return; dispose(); options.onClose(); };
  const state = (entry: Node): NodeState => {
    const key = nodeName(entry);
    if (key.startsWith("difficulty_")) {
      const difficulty = DIFFICULTIES.find(item => key === `difficulty_${item.id}`)!;
      return button(`${selected === difficulty.id ? "✓ " : ""}${difficulty.label}`, () => {
        selected = difficulty.id; view?.render();
      });
    }
    if (key.startsWith("tutorial_")) {
      const index = Number(key.slice("tutorial_".length));
      return button(`${tutorial === index ? "● " : ""}${TUTORIALS[index]!.title}`, () => {
        tutorial = index; view?.render();
      });
    }
    switch (key) {
      case "subtitle": return paintText(tr("1 名玩家 + 19 名 NPC  ·  连续三回合  ·  累计积分争夺冠军"),
        { size: 20, bold: true, color: TEXT, middle: true });
      case "difficultyTitle": return paintText(tr("选择难度"), { size: 19, bold: true });
      case "difficultyDetail": return paintText(tr(DIFFICULTIES.find(item => item.id === selected)!.description),
        { size: 16, lineGap: 8 });
      case "scheduleTitle": return paintText(tr("三回合赛程"), { size: 19, bold: true });
      case "schedule": return paintText([0, 1, 2].map(index =>
        `${tr(`第 ${index + 1} 回合`)}   ${options.tracks?.[index] ?? tr("WKC 赛道")}`).join("\n"),
      { size: 17, lineGap: 18 });
      case "rules": return paintText(tr("每回合按完赛名次计分。\n三回合积分累加，决定最终排名。\n激进加速时可撞晕 NPC；驶入维修区加快充能。"),
        { size: 16, lineGap: 10 });
      case "tutorialTitle": return paintText(tr("原版玩法教程"), { size: 19, bold: true });
      case "tutorialImage": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        context.fillStyle = "#101b2c";
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        const texture = images.named(TUTORIAL_ROOT, `F1Tuto0${tutorial + 1}@zz`);
        if (texture) drawFitted(context, texture,
          { x: rect.x + 14, y: rect.y + 14, width: rect.width - 28, height: rect.height - 28 }, 1.8);
        else drawLabel(context, tr(TUTORIALS[tutorial]!.title), rect.x + rect.width / 2, rect.y + rect.height / 2,
          { color: "white", align: "center", size: 20 });
      } };
      case "tutorialText": return paintText(tr(TUTORIALS[tutorial]!.text), { size: 18, lineGap: 12 });
      case "controls": return paintText(tr("方向键驾驶  ·  Shift 漂移  ·  Ctrl 氮气  ·  Space 激进加速  ·  Esc 暂停"),
        { size: 16, bold: true, align: "center", middle: true });
      case "startButton": return button("开始三回合挑战", () => {
        if (disposed) return; dispose(); options.onStart(selected);
      });
      case "cancelButton": return button("返回单人游戏", close);
      case "closeButton": return { label: tr("关闭"), action: close };
      default: return {};
    }
  };
  view = await loadWindow(options.library, options.root, formulaSetupDefinition(), tr("极速方程 · 单人挑战"), close, state);
  view.element.dataset.uiPage = "formula-setup";
  view.show();
  view.focus("startButton");
  return { element: view.element, dispose };
}

export interface FormulaResultRow {
  id: string;
  name: string;
  rank: number;
  points: number;
  totalPoints?: number;
  elapsedMs?: number;
  dnf?: boolean;
  isPlayer?: boolean;
  crashes?: number;
}

export interface FormulaResultsOptions {
  root: HTMLElement;
  library: BmlLibrary;
  round: number;
  rows: readonly FormulaResultRow[];
  totals: readonly FormulaResultRow[];
  final: boolean;
  onNext(): void;
  onClose(): void;
}

/** DNF remains distinct from a valid zero-time/unknown-time result. */
export function formulaResultTime(row: Pick<FormulaResultRow, "dnf" | "elapsedMs">): string {
  if (row.dnf) return "DNF";
  if (row.elapsedMs === undefined || !Number.isFinite(row.elapsedMs) || row.elapsedMs < 0) return "—";
  const ms = Math.floor(row.elapsedMs);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

export function formulaResultsDefinition(final: boolean): Node {
  return definition(final ? "极速方程 · 三回合总成绩" : "极速方程 · 回合成绩", 1170, 760, [
    label("roundArt", 330, 0, 470, 58),
    label("summary", 16, 66, 1098, 34),
    action("roundTab", 16, 110, 160), action("totalTab", 188, 110, 160),
    label("resultHelp", 370, 110, 744, 34),
    label("header0", 16, 160, 542, 32), label("header1", 576, 160, 542, 32),
    ...Array.from({ length: 20 }, (_unused, index) => label(`resultRow${index}`,
      index < 10 ? 16 : 576, 197 + (index % 10) * 37, 542, 34)),
    label("footer", 16, 584, 1098, 28),
    action("cancelButton", 354, 634, 160, 38), action("nextButton", 536, 634, 240, 38),
  ]);
}

export async function openFormulaResults(options: FormulaResultsOptions): Promise<FormulaWindowHandle> {
  let total = options.final;
  let view: WindowView | undefined;
  let disposed = false;
  const images = new ImageCache(options.library, () => { if (!disposed) view?.render(); });
  const dispose = (): void => { if (disposed) return; disposed = true; view?.dispose(); };
  const close = (): void => { if (disposed) return; dispose(); options.onClose(); };
  const roundById = new Map(options.rows.map(row => [row.id, row]));
  const totalsById = new Map(options.totals.map(row => [row.id, row]));
  const player = options.rows.find(row => row.isPlayer);
  const playerTotal = options.totals.find(row => row.isPlayer);
  const ordered = (rows: readonly FormulaResultRow[]) => [...rows].sort((a, b) => a.rank - b.rank);
  const roundRows = ordered(options.rows);
  const totalRows = ordered(options.totals);
  const state = (entry: Node): NodeState => {
    const key = nodeName(entry);
    const match = /^resultRow(\d+)$/.exec(key);
    if (match) {
      const row = (total ? totalRows : roundRows)[Number(match[1])];
      if (!row) return { visible: false };
      const roundRow = roundById.get(row.id) ?? row;
      const totalPoints = totalsById.get(row.id)?.totalPoints ?? totalsById.get(row.id)?.points ?? row.totalPoints ?? row.points;
      const score = `${roundRow.points} / ${totalPoints}`;
      return { label: `${row.rank}. ${row.name} ${formulaResultTime(roundRow)} ${score}`, paint:
        (context: CanvasRenderingContext2D, rect: Rect) => {
          context.fillStyle = row.isPlayer ? "#ffdc7c" : row.rank % 2 ? "#e9eef5" : "#f7f9fc";
          context.fillRect(rect.x, rect.y, rect.width, rect.height);
          const color = row.isPlayer ? "#623700" : TEXT;
          const y = rect.y + rect.height / 2;
          drawLabel(context, String(row.rank), rect.x + 22, y, { size: 16, bold: true, align: "center", color });
          drawLabel(context, `${row.isPlayer ? "▶ " : ""}${row.name}`, rect.x + 52, y,
            { size: 16, bold: !!row.isPlayer, width: 215, color });
          drawLabel(context, formulaResultTime(roundRow), rect.x + 355, y,
            { size: 15, align: "right", color: roundRow.dnf ? "#b33630" : color });
          drawLabel(context, score, rect.x + 524, y, { size: 16, bold: true, align: "right", color });
        } };
    }
    switch (key) {
      case "roundArt": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const texture = images.named(RESULT_ROOT, `${options.round === 1 ? "1st" : options.round === 2 ? "2nd" : "final"}@zz`);
        if (texture) drawFitted(context, texture, rect, 1.25);
        else drawLabel(context, tr(`第 ${options.round} / 3 回合`), rect.x + rect.width / 2, rect.y + rect.height / 2,
          { size: 26, bold: true, align: "center" });
      } };
      case "summary": return paintText(player
        ? tr(`本轮 ${player.dnf ? "DNF 未完赛" : `第 ${player.rank} 名`}  ·  获得 ${player.points} 分  ·  累计 ${playerTotal?.totalPoints ?? playerTotal?.points ?? player.totalPoints ?? player.points} 分${playerTotal ? `  ·  总排名第 ${playerTotal.rank} 名` : ""}`)
        : tr("20 位车手成绩"), { size: 19, bold: true, align: "center", middle: true });
      case "roundTab": return button(`${total ? "" : "✓ "}本轮排名`, () => { total = false; view?.render(); });
      case "totalTab": return button(`${total ? "✓ " : ""}累计排名`, () => { total = true; view?.render(); });
      case "resultHelp": return paintText(tr(total ? "按累计积分排名 · 金色行是你的成绩" : "按本轮完赛顺序排名 · 金色行是你的成绩"),
        { size: 15, align: "right", middle: true });
      case "header0": case "header1": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        context.fillStyle = "#374f6f"; context.fillRect(rect.x, rect.y, rect.width, rect.height);
        const y = rect.y + rect.height / 2;
        for (const [caption, x, align] of [["名次", 24, "center"], ["车手", 52, "left"],
          ["本轮用时", 355, "right"], ["本轮 / 总分", 524, "right"]] as const)
          drawLabel(context, tr(caption), rect.x + x, y, { size: 15, color: "white", bold: true, align });
      } };
      case "footer": return paintText(tr(options.final ? "三回合挑战结束。重新挑战将从第一回合开始。" :
        `已完成 ${options.round} / 3 回合；下一回合保留所有车手的累计积分。`),
      { size: 15, middle: true, align: "center" });
      case "cancelButton": return button("返回单人游戏", close);
      case "closeButton": return { label: tr("关闭"), action: close };
      case "nextButton": return button(options.final ? "重新挑战" : `开始第 ${options.round + 1} 回合`, () => {
        if (disposed) return; dispose(); options.onNext();
      });
      default: return {};
    }
  };
  view = await loadWindow(options.library, options.root, formulaResultsDefinition(options.final), tr("极速方程成绩"), close, state);
  view.element.dataset.uiPage = "formula-results";
  view.show();
  view.focus("nextButton");
  return { element: view.element, dispose };
}

export interface FormulaHudState {
  round: number;
  rank: number;
  /** Filled fraction, from 0 to 1. */
  energy: number;
  boosting: boolean;
  hits: number;
  inPit: boolean;
  paused?: boolean;
  finished?: boolean;
  /** Seconds left after the first finisher starts the end-of-round deadline. */
  countdown?: number;
}

export interface FormulaHudOptions { root: HTMLElement; library: BmlLibrary; onActivate?(): void }

/** The energy fill uses the exact 53,5,148,14 crop in the original
 * stage_/f1Game/teamBoostGaugeNine.bml, over its nine_n2o_team frame. */
export class FormulaHud {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly activate: HTMLButtonElement;
  private readonly images: ImageCache;
  private disposed = false;
  private state: FormulaHudState = { round: 1, rank: 20, energy: 0, boosting: false, hits: 0, inPit: false };

  constructor(private readonly options: FormulaHudOptions) {
    const document = options.root.ownerDocument;
    this.element = document.createElement("div");
    this.element.dataset.uiPage = "formula-hud";
    Object.assign(this.element.style, { position: "absolute", left: "50%", bottom: "82px", transform: "translateX(-50%)",
      width: "min(360px, 48vw)", pointerEvents: "none", zIndex: "12", fontFamily: FONT });
    this.canvas = document.createElement("canvas");
    this.canvas.width = 720;
    this.canvas.height = 190;
    this.canvas.style.width = "100%";
    this.canvas.style.display = "block";
    this.activate = document.createElement("button");
    this.activate.type = "button";
    Object.assign(this.activate.style, { display: "block", margin: "0 auto", padding: "7px 17px", borderRadius: "5px",
      border: "1px solid #f5cb68", background: "#15283de8", color: "#ffe59e", font: `bold 14px ${FONT}`,
      pointerEvents: "auto", touchAction: "manipulation", cursor: "pointer", whiteSpace: "nowrap" });
    this.activate.addEventListener("click", this.onActivate);
    this.element.append(this.canvas, this.activate);
    this.images = new ImageCache(options.library, () => this.render());
    options.root.append(this.element);
    this.render();
  }

  update(state: FormulaHudState): void {
    if (this.disposed) return;
    this.state = { ...state, energy: Number.isFinite(state.energy) ? Math.max(0, Math.min(1, state.energy)) : 0 };
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.activate.removeEventListener("click", this.onActivate);
    this.element.remove();
  }

  private readonly onActivate = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.activate.disabled) this.options.onActivate?.();
    this.activate.blur();
  };

  private render(): void {
    if (this.disposed) return;
    const state = this.state;
    const context = this.canvas.getContext("2d");
    if (!context) return;
    context.setTransform(2, 0, 0, 2, 0, 0);
    context.clearRect(0, 0, 360, 95);
    context.fillStyle = "rgba(8,20,37,.78)";
    context.fillRect(0, 0, 360, 95);
    drawLabel(context, tr(`第 ${state.round} / 3 回合`), 12, 18, { size: 15, color: "white", bold: true });
    drawLabel(context, tr(`${state.rank} / 20 名`), 348, 18, { size: 16, color: "#ffe08a", bold: true, align: "right" });
    const frame = this.images.named(GAUGE_ROOT, "nine_n2o_team");
    const bar = this.images.named(GAUGE_ROOT, "nine_n2o_team_bar");
    const full = state.energy >= 1 ? this.images.named(GAUGE_ROOT, "nine_n2o_team_full") : undefined;
    const x = 52, y = 35;
    if (frame) context.drawImage(frame.image, x, y, 255, 26);
    else {
      context.fillStyle = "#04080d"; context.fillRect(x, y, 255, 26);
      drawLabel(context, "CRUSH", x + 4, y + 13, { size: 12, bold: true, color: "white" });
    }
    context.fillStyle = state.boosting ? "#ff9a38" : "#ffcf49";
    context.fillRect(x + 53, y + 5, 148 * state.energy, 14);
    if (bar && state.energy > 0) context.drawImage(bar.image, 53, 5, 148 * state.energy, 14,
      x + 53, y + 5, 148 * state.energy, 14);
    if (full) context.drawImage(full.image, x, y, 255, 26);
    drawLabel(context, `${Math.floor(state.energy * 100)}%`, 341, y + 13,
      { color: "#ffe08a", size: 14, bold: true, align: "right" });
    const remaining = state.countdown === undefined ? "" : ` ${Math.max(0, Math.ceil(state.countdown))} 秒`;
    const status = state.paused ? "已暂停" : state.finished ? `已完赛 · 等待其他车手${remaining}` : state.boosting ? "激进加速中 · 撞击 NPC" :
      state.inPit ? "PIT · 维修区充能" : state.energy >= 1 ? "能量已满 · 可以释放" : "跟随前车积攒能量";
    drawLabel(context, tr(status), 12, 79, { size: 14, bold: true, color: state.inPit ? "#83f4d4" : "white" });
    drawLabel(context, tr(`撞晕 ${state.hits}`), 348, 79, { size: 14, color: "#ffe08a", align: "right" });
    this.activate.disabled = !this.options.onActivate || state.energy < 1 || state.boosting || !!state.paused || !!state.finished;
    this.activate.textContent = tr(state.boosting ? "激进加速中" : "激进加速  [Space]") +
      (remaining && !state.finished ? tr(` · 剩余${remaining}`) : "");
    this.activate.style.opacity = this.activate.disabled ? ".7" : "1";
    this.element.setAttribute("aria-label", tr(`极速方程，第 ${state.round} 回合，第 ${state.rank} 名，能量 ${Math.floor(state.energy * 100)}%，撞晕 ${state.hits} 次，${status}`));
  }
}
