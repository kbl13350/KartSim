import { C8, te } from "../generated/library.js";
import type { AccountSession } from "../account/account-session";
import { attribute, clone, drawFitted, FONT, ImageCache, indexRows, loadBml, loadStrings, mapTree, node, nodeName, paintText,
  prepare, resolveStrings, withAttributes, type BmlLibrary, type Node, type NodeState, type Rect,
  type WindowView } from "../ui/bml-kit";
import { ItemIcons } from "./item-icons";
import { QUEST_DISTANCE, type MenusApi, type Quest, type QuestReward } from "./menus-api";

/**
 * 任务 (dialog2_questInfo2 questInfo2@cn, the QuestUX2nd dialog): 进行中
 * and 完成 lists of QuestUX2ndButton rows on the left, the selected quest's
 * period, description, 可进行状态, 任务详情 with its progress gauge and the
 * QuestUX2ndReward slots on the right. The quests are the server's
 * (server-go MENUS.md 2); rewards go to the 奖励箱.
 */

const FOLDER = "dialog2_/questInfo2";
const ROOTS = [FOLDER, "stage_/common"];
const ROW = { width: 285, height: 26, gap: 3 };
const LIST_CAPTION = 30;
const LIST_GAP = 8;
const REWARD = { width: 168, height: 60, gapX: 10, gapY: 7 };
const MAX_REWARDS = 4;
const RESET_KEYS: Record<string, string> = { daily: "daily", weekly: "weekly", none: "none" };

type ListName = "doing" | "done";
type Rows = Record<ListName | "reward", WeakMap<Node, number>>;

export interface QuestScreenOptions {
  library: BmlLibrary;
  root: HTMLElement;
  api: MenusApi;
  session?: AccountSession;
  now?(): number;
  onClose(): void;
  onActivate?(): void;
}

/** "10-09 06:00" in Beijing time. */
function shortTime(ms: number): string {
  const date = new Date(ms + 8 * 60 * 60 * 1000);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

/** missionTextDefault / missionTextDistance: "目前 2回 / 目标 3回", "目前 3.4km / 目标 10.0km". */
export function questProgressText(quest: Pick<Quest, "kind" | "value" | "target">, strings: Map<string, string>): string {
  if (quest.kind === QUEST_DISTANCE) {
    return (strings.get("missionTextDistance") ?? "目前 %.1fkm / 目标 %.1fkm")
      .replace("%.1f", (quest.value / 10).toFixed(1)).replace("%.1f", (quest.target / 10).toFixed(1));
  }
  return (strings.get("missionTextDefault") ?? "目前 %d回 / 目标 %d回")
    .replace("%d", String(quest.value)).replace("%d", String(quest.target));
}

/** The 进行中 and 完成 lists: done quests are completed in this period; locked ones stay in 进行中. */
export function questLists(quests: Quest[]): Record<ListName, Quest[]> {
  return { doing: quests.filter(quest => !quest.completedAt), done: quests.filter(quest => !!quest.completedAt) };
}

function rewardText(reward: QuestReward): string {
  if (reward.currency || reward.emblem) return reward.name;
  return reward.count > 1 ? `${reward.name} ×${reward.count}` : reward.name;
}

/** Text sizes (textRender) of the release labels, which default to 16 px. */
const TEXT_SIZES: Record<string, string> = {
  period: "bold12", thisQuestStatus: "bold12", lblEmptyConditions: "bold14", QuestHowTo: "bold14",
  btn_questTipGuide: "bold12", okButton: "bold14", resetType: "bold13", title: "bold13",
  daily: "bold13", weekly: "bold13", repeat: "bold13", onlyPCRoom: "bold13",
  dailyDesc: "12", weeklyDesc: "12", repeatDesc: "12", onlyPCRoomDesc: "12",
};

/**
 * The release layout with this game's type sizes: captions draw at a fixed
 * 20 px, so the list and 可进行状态 captions become labels in a smaller
 * face; the other labels take the sizes above; 任务详情 and 奖励 shrink; the
 * empty-list line sits inside its list.
 */
function restyle(definition: Node, strings: Map<string, string>): Node {
  const smaller = new Map([[strings.get("mission") ?? "任务详情", "bold14"], [strings.get("reward") ?? "奖励", "bold13"]]);
  return mapTree(definition, entry => {
    const name = nodeName(entry);
    const list = /^captionList_(doing|done)$/.exec(name)?.[1];
    if (list) return { ...withAttributes(entry, { caption: undefined }), children: [
      node("Label", { name: `captionText_${list}`, windowSize: "240 26", adjust: "8 -26", textRender: "bold15",
        textColor: "white", textAlign: "left|vcenter" }), ...entry.children] };
    if (name === "CaptionQuestStatus") return { ...withAttributes(entry, { caption: undefined }), children: [
      node("Label", { name: "statusCaptionText", windowSize: "200 20", adjust: "10 -21", textRender: "bold14",
        textColor: "white", textAlign: "left|vcenter", text: strings.get("enableState") ?? "可进行状态" }),
      ...entry.children] };
    if (/^lblEmpltyList_(doing|done)$/.test(name)) return withAttributes(entry, { windowSize: undefined, adjust: undefined,
      leftTopWH: "0 2 288 29", textRender: "bold13", textAlign: "center" });
    if (TEXT_SIZES[name]) return withAttributes(entry, { textRender: TEXT_SIZES[name] });
    const text = attribute(entry, "text");
    if (entry.name === "Label" && !name && text && smaller.has(text)) return withAttributes(entry, { textRender: smaller.get(text) });
    return undefined;
  });
}

export class QuestScreen {
  private view?: WindowView;
  private quests: Quest[] = [];
  private selected?: number;
  private collapsed: Record<ListName, boolean> = { doing: false, done: false };
  private guide = false;
  private disposed = false;
  private strings = new Map<string, string>();
  private readonly icons: ItemIcons;
  private readonly images: ImageCache;
  private templates?: { dialog: Node; row: Node; reward: Node };

  private constructor(readonly options: QuestScreenOptions) {
    this.icons = new ItemIcons(options.library, options.session, () => this.view?.render());
    this.images = new ImageCache(options.library, () => this.view?.render());
  }

  static async open(options: QuestScreenOptions): Promise<QuestScreen> {
    const screen = new QuestScreen(options);
    try {
      const [list, strings] = await Promise.all([options.api.quests(),
        loadStrings(options.library, FOLDER, "questInfo2_stringBag")]);
      screen.quests = list.quests;
      screen.strings = strings;
      const lists = questLists(list.quests);
      screen.selected = (lists.doing.find(quest => !quest.locked) ?? lists.doing[0] ?? lists.done[0])?.id;
      await screen.build();
    } catch (error) {
      screen.dispose();
      throw error;
    }
    return screen;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.view?.dispose();
    this.icons.dispose();
  }

  private quest(): Quest | undefined {
    return this.quests.find(quest => quest.id === this.selected);
  }

  private async loadTemplates(): Promise<{ dialog: Node; row: Node; reward: Node }> {
    if (this.templates) return this.templates;
    const { library } = this.options;
    const [dialog, row, reward] = await Promise.all([loadBml(library, FOLDER, "questInfo2@cn"),
      loadBml(library, FOLDER, "QuestUX2ndButton@cn"), loadBml(library, FOLDER, "QuestUX2ndReward")]);
    this.templates = { dialog: resolveStrings(dialog, this.strings), row: resolveStrings(row, this.strings),
      reward: resolveStrings(reward, this.strings) };
    return this.templates;
  }

  /** The dialog with list sizes for the current quests (rebuilt when a list opens or closes). */
  private async build(): Promise<void> {
    const { library } = this.options;
    const templates = await this.loadTemplates();
    const lists = questLists(this.quests);
    const height = (list: ListName) => LIST_CAPTION + (this.collapsed[list] ? 0
      : Math.max(1, lists[list].length) * (ROW.height + ROW.gap) + 6);
    const doingHeight = height("doing");
    // QuestUX2ndButton: its ImageButton is painted (the selected, done and locked looks).
    const rowChildren = templates.row.children.map(child => child.name === "ImageButton"
      ? withAttributes(child, { windowRect: undefined, leftTopWH: `0 0 ${ROW.width} ${ROW.height}` }) : child);
    let definition = mapTree(templates.dialog, entry => {
      const name = nodeName(entry);
      if (name === "container_doingList" || name === "container_doneList") {
        const list: ListName = name === "container_doingList" ? "doing" : "done";
        const top = list === "doing" ? 0 : doingHeight + LIST_GAP;
        return withAttributes({ ...entry, children: entry.children.map(child => {
          if (child.name === "CaptionWindow") return withAttributes({ ...child, children: child.children.map(inner =>
            inner.name !== "GridSelectorEx" ? withAttributes(inner, { name: `${nodeName(inner)}_${list}` }) : {
              ...withAttributes(inner, { name: `questList_${list}` }), name: "Container",
              children: lists[list].map((_quest, index) => node("Window", { name: `${list}Row${index}`,
                leftTopWH: `0 ${index * (ROW.height + ROW.gap)} ${ROW.width} ${ROW.height}` }, rowChildren.map(clone))),
            }) }, { windowRect: `0 0 296 ${height(list)}`, name: `captionList_${list}` });
          // The open / close tab buttons sit on the caption bar.
          return withAttributes(child, { name: `${nodeName(child)}_${list}`, align: undefined, adjust: undefined,
            leftTopTex: "273 4" });
        }) }, { windowRect: `0 ${top} 298 ${height(list)}` });
      }
      if (entry.name === "GridSelectorEx" && name === "rewardList") {
        return { ...entry, name: "Container", children: Array.from({ length: MAX_REWARDS }, (_unused, index) =>
          node("Window", { name: `reward${index}`, leftTopWH: `${(index % 2) * (REWARD.width + REWARD.gapX)} ${
            Math.floor(index / 2) * (REWARD.height + REWARD.gapY)} ${REWARD.width} ${REWARD.height}` },
          templates.reward.children.map(clone))) };
      }
      return undefined;
    });
    definition = await this.decorate(restyle(definition, this.strings));
    const prepared = prepare(library, definition, ROOTS);
    const rows: Rows = { doing: new WeakMap(), done: new WeakMap(), reward: new WeakMap() };
    indexRows(prepared, "doingRow", rows.doing);
    indexRows(prepared, "doneRow", rows.done);
    indexRows(prepared, "reward", rows.reward);
    if (this.disposed) return;
    const view = await te.load({
      library, root: this.options.root, definition: prepared, roots: ROOTS, smoothImages: true, modal: true,
      label: this.strings.get("questInfo") ?? "任务信息", onCancel: () => this.options.onClose(),
      state: (entry: Node) => this.state(entry, rows),
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return;
    }
    const previous = this.view;
    this.view = view;
    view.show();
    previous?.dispose();
  }

  private async decorate(definition: Node): Promise<Node> {
    if (definition.name === "CaptionWindow" && definition.attributes.some(entry => entry.name === "setCloseButton"))
      return await C8(this.options.library, definition, FOLDER) as Node;
    return { ...definition, children: await Promise.all(definition.children.map(child => this.decorate(child))) };
  }

  private toggle(list: ListName): void {
    this.collapsed[list] = !this.collapsed[list];
    this.options.onActivate?.();
    void this.build();
  }

  private state(entry: Node, rows: Rows): NodeState {
    const name = nodeName(entry);
    for (const list of ["doing", "done"] as const) {
      const index = rows[list].get(entry);
      if (index !== undefined) return this.rowState(entry, name, list, index);
    }
    const reward = rows.reward.get(entry);
    if (reward !== undefined) return this.rewardState(name, reward);
    const lists = questLists(this.quests);
    const quest = this.quest();
    switch (name) {
      case "cancelButton":
      case "okButton": return { label: this.strings.get("ok") ?? "确认", action: () => this.options.onClose() };
      case "captionText_doing": return { text: (this.strings.get("doing") ?? "进行中(%d)").replace("%d",
        String(lists.doing.length)) };
      case "captionText_done": return { text: (this.strings.get("done") ?? "完成(%d)").replace("%d",
        String(lists.done.length)) };
      case "lblEmpltyList_doing": return { visible: !this.collapsed.doing && !lists.doing.length };
      case "lblEmpltyList_done": return { visible: !this.collapsed.done && !lists.done.length };
      case "openListBtn_doing": return { visible: this.collapsed.doing, label: "展开", action: () => this.toggle("doing") };
      case "closeListBtn_doing": return { visible: !this.collapsed.doing, label: "收起", action: () => this.toggle("doing") };
      case "openListBtn_done": return { visible: this.collapsed.done, label: "展开", action: () => this.toggle("done") };
      case "closeListBtn_done": return { visible: !this.collapsed.done, label: "收起", action: () => this.toggle("done") };
      case "QuestTitleCaption": return { text: quest?.title ?? "" };
      case "period": return { text: !quest ? "" : quest.reset === "none" ? "无期限"
        : `${shortTime(quest.periodStart)} ~ ${shortTime(quest.periodEnd)}` };
      case "QuestDesc": return paintText(quest?.desc ?? "", { size: 13, color: "black", lineGap: 3 });
      case "thisQuestStatus": return { text: !quest ? "" : quest.completedAt
        ? this.strings.get("questComplete") ?? "完成"
        : quest.locked ? this.strings.get("questDisable") ?? "不可以" : this.strings.get("questEnable") ?? "可以" };
      case "lblEmptyConditions": return { visible: !!quest && !quest.locked };
      case "emptyContainer": return quest?.locked ? this.lockedCondition(quest) : {};
      case "QuestHowTo": return { text: quest?.mission ?? "" };
      case "questGageBG":
      case "questGageOn":
      case "questGageBGDisable":
      case "questGageOnDisable": return { visible: false };
      case "questProgressLabel": return quest ? this.gauge(quest) : {};
      case "challengeShadow":
      case "btn_trackInfo": return { visible: false };
      case "btn_questTipGuide": return { label: this.strings.get("questTypeGuide") ?? "任务种类说明",
        action: () => { this.guide = !this.guide; this.view?.render(); } };
      case "img_questTipGuide": return { visible: this.guide };
      case "title":
      case "daily":
      case "weekly":
      case "dailyDesc":
      case "weeklyDesc": return { visible: this.guide };
      // This server's third kind is 一般: one reward, never reset.
      case "repeat": return { visible: this.guide, text: this.strings.get("none") ?? "一般" };
      case "repeatDesc": return { visible: this.guide, text: "完成后可获得1次奖励（不初始化）" };
      case "onlyPCRoom":
      case "onlyPCRoomDesc": return { visible: false };
    }
    return {};
  }

  private rowState(entry: Node, name: string, list: ListName, index: number): NodeState {
    const quest = questLists(this.quests)[list][index];
    if (/^(doing|done)Row\d+$/.test(name)) return { visible: !!quest };
    if (!quest) return {};
    switch (name) {
      case "questBtn": return { label: quest.title, action: () => {
        this.selected = quest.id;
        this.view?.render();
      }, paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const look = quest.completedAt ? "btn_완료_" : quest.locked ? "btn_진행불가_" : "btn_진행중_";
        const hovered = (this.view as unknown as { hovered?: Node } | undefined)?.hovered === entry;
        const image = this.images.named(ROOTS, `${look}${quest.id === this.selected ? 5 : hovered ? 2 : 1}`);
        if (image) context.drawImage(image.image, rect.x, rect.y, rect.width, rect.height);
      } };
      case "resetType": return { text: this.strings.get(RESET_KEYS[quest.reset] ?? "none") ?? "" };
      case "title": return { text: quest.title };
      case "clearIcon": return { visible: !!quest.completedAt };
      case "newButton": return { visible: !quest.completedAt && !quest.locked && quest.value === 0 };
      case "pc": return { visible: false };
    }
    return {};
  }

  private rewardState(name: string, index: number): NodeState {
    const reward = this.quest()?.rewards[index];
    if (/^reward\d$/.test(name)) return { visible: !!reward };
    if (!reward) return {};
    switch (name) {
      case "rewardEmpty": return { visible: false };
      case "rewardLucci":
      case "rewardCS": return { visible: false };
      case "rewardEmblem": return { visible: false };
      case "rewardStock": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const icon = this.icons.icon(reward);
        if (icon) drawFitted(context, icon, { x: rect.x + 6, y: rect.y + 6, width: rect.width - 12,
          height: rect.height - 12 }, reward.currency ? 1.4 : 1);
      } };
      case "rewardLabel": return paintText(rewardText(reward), { size: 13, color: "black", middle: true, bold: true,
        lineGap: 2 });
    }
    return {};
  }

  private lockedCondition(quest: Quest): NodeState {
    const pre = this.quests.find(entry => entry.id === quest.pre);
    const text = (this.strings.get("kPrevQuestComplete") ?? "[%s] 完成任务").replace("%s", pre?.title ?? String(quest.pre));
    return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
      const dot = this.images.named(ROOTS, "img_pointImposible");
      if (dot) context.drawImage(dot.image, rect.x + 6, rect.y + 6);
      context.save();
      context.font = `14px ${FONT}`;
      context.textBaseline = "top";
      context.fillStyle = "black";
      context.fillText(text, rect.x + 22, rect.y + 3);
      context.restore();
    } };
  }

  /** The progress gauge (img_questGageBG / On, 비활성 when done or locked) and its text. */
  private gauge(quest: Quest): NodeState {
    return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) => {
      const inactive = quest.locked || !!quest.completedAt ? "_비활성" : "";
      const back = this.images.named(ROOTS, `img_questGageBG${inactive}`);
      const fill = this.images.named(ROOTS, `img_questGageOn${inactive}`);
      if (back) context.drawImage(back.image, rect.x, rect.y, rect.width, rect.height);
      const ratio = quest.completedAt ? 1 : Math.min(1, quest.value / Math.max(1, quest.target));
      if (fill && ratio > 0) {
        context.drawImage(fill.image, 0, 0, fill.width * ratio, fill.height, rect.x, rect.y, rect.width * ratio,
          rect.height);
      }
      const text = questProgressText(quest.completedAt ? { ...quest, value: quest.target } : quest, this.strings);
      context.save();
      context.font = `bold 12px ${FONT}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 3;
      context.strokeStyle = "rgba(0,0,0,.75)";
      context.strokeText(text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
      context.fillStyle = "white";
      context.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
      context.restore();
    } };
  }
}
