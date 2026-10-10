import { C8, te } from "../generated/library.js";
import { errorCode } from "../account/account-api";
import { gradeName } from "../club/club-api";
import { licenseName } from "../license/license-model";
import { gloveIconPath } from "../myroom/myroom-data";
import { drawFitted, FONT, ImageCache, loadBml, loadStrings, mapTree, nodeName, prepare, resolveStrings,
  withAttributes, type BmlLibrary, type Node, type NodeState, type Rect, type WindowView } from "../ui/bml-kit";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import type { RiderCard } from "./menus-api";

/**
 * 车手信息 (dialog2_userInfo userInfo@zz) of a rider found with 查找车手:
 * level glove, nickname, club mark and representative emblems on the
 * header, the race record where the release shows the rider's 3D preview,
 * the club where it shows the VIP grades, and the 申请好友 / 访问小屋
 * buttons.
 */

const FOLDER = "dialog2_/userInfo";
const ROOTS = [FOLDER, "stage_/common"];
const HIDDEN = new Set(["joinRoom", "inviteRoom", "inviteCouple", "coupleInfo", "itemTier", "speedTier", "careerInfo",
  "versusModeInfo", "userInfo2", "userRankInfo", "editIntroBtn", "introEdit", "rp", "pr"]);
const PRESENCE: Record<string, string> = { online: "inLobby", ingame: "inGame", inGame: "inGame", offline: "offline" };

export interface RiderCardOptions {
  library: BmlLibrary;
  root: HTMLElement;
  card: RiderCard;
  /** 申请好友; resolves when the request was sent (rejects with the service error). */
  requestFriend?(nickname: string): Promise<{ accepted: boolean }>;
  /** 访问小屋. */
  visitRoom?(nickname: string): void;
  onClose(): void;
  onActivate?(): void;
}

function formatDate(ms: number): string {
  const date = new Date(ms + 8 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function friendError(error: unknown): string {
  switch (errorCode(error)) {
    case "PLAYER_NOT_FOUND": return "无法找到该车手。";
    case "FRIEND_REQUESTS_BLOCKED": return "对方车手已关闭好友请求功能。";
    case "FRIEND_LIMIT":
    case "TARGET_FRIEND_LIMIT": return "对方或我的好友数量已达上限，无法添加好友。";
    case "ALREADY_FRIENDS":
    case "REQUEST_PENDING": return "已发送好友申请或已经是好友了。";
    case "REQUEST_LIMIT": return "已超过请求好友数量上限，无法再发送好友请求。";
    case "REQUEST_COOLDOWN": return "对方已拒绝好友请求，|到次日上午6点前无法再次申请。";
    case "CANNOT_ADD_SELF": return "不能将自己添加为好友。";
    case "BLOCKED_TARGET": return "已屏蔽该车手。|请先在管理 → 屏蔽管理中解除屏蔽。";
    case "RATE_LIMITED": return "操作过于频繁，请稍后再试。";
    default: return "发生错误。|请重试。";
  }
}

export class RiderCardView {
  private view?: WindowView;
  private disposed = false;
  private busy = false;
  private message?: AbortController;
  private strings = new Map<string, string>();
  private readonly images: ImageCache;

  private constructor(readonly options: RiderCardOptions) {
    this.images = new ImageCache(options.library, () => this.view?.render());
  }

  static async open(options: RiderCardOptions): Promise<RiderCardView> {
    const card = new RiderCardView(options);
    try {
      await card.build();
    } catch (error) {
      card.dispose();
      throw error;
    }
    return card;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.message?.abort();
    this.view?.dispose();
  }

  private async build(): Promise<void> {
    const { library } = this.options;
    const [raw, strings] = await Promise.all([loadBml(library, FOLDER, "userInfo@zz"),
      loadStrings(library, FOLDER, "userInfo_stringBag")]);
    this.strings = strings;
    let definition = mapTree(resolveStrings(raw, strings), entry => {
      const name = nodeName(entry);
      if (HIDDEN.has(name)) return withAttributes(entry, { visible: "false" });
      // The VIP grade table: its place shows the rider's club.
      if (name === "userInfo1Right") return { ...entry, children: [] };
      return undefined;
    });
    definition = await this.decorate(definition);
    const prepared = prepare(library, definition, ROOTS);
    if (this.disposed) return;
    const view = await te.load({
      library, root: this.options.root, definition: prepared, roots: ROOTS, smoothImages: true, modal: true,
      label: "车手信息", onCancel: () => this.options.onClose(), state: (entry: Node) => this.state(entry),
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return;
    }
    this.view = view;
    view.show();
  }

  private async decorate(definition: Node): Promise<Node> {
    if (definition.name === "CaptionWindow") return await C8(this.options.library, definition, FOLDER) as Node;
    return { ...definition, children: await Promise.all(definition.children.map(child => this.decorate(child))) };
  }

  private notice(text: string): void {
    this.message?.abort();
    const abort = new AbortController();
    this.message = abort;
    void openMessengerMessage(this.options.library as never, this.options.root, "车手信息", text, {}, abort.signal)
      .catch(() => false);
  }

  private state(entry: Node): NodeState {
    const { card } = this.options;
    switch (nodeName(entry)) {
      case "":
        return entry.name === "CaptionWindow" ? { text: "车手信息" } : {};
      case "exit": return { label: "关闭", action: () => this.options.onClose() };
      case "glove": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const path = gloveIconPath(card.glove);
        const image = path ? this.images.path(path) : undefined;
        if (image) drawFitted(context, image, rect);
      } };
      case "level": return { text: `Lv.${card.level}` };
      case "rid": return { text: card.nickname };
      case "clubMark": return card.club ? { visible: true, paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const mark = this.images.path(`etc_/clubMark/clubMark_${card.club!.mark}_s.png`);
        const frame = this.images.path(`etc_/clubMark/clubFrame/clubFrame_${card.club!.frame}_s.png`);
        const inner = { x: rect.x + 6, y: rect.y + 6, width: rect.width - 12, height: rect.height - 12 };
        if (mark) drawFitted(context, mark, inner);
        if (frame) drawFitted(context, frame, { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6,
          height: rect.height - 6 });
      } } : { visible: false };
      case "clubFrame": return { visible: false };
      case "mainEmblem1":
      case "mainEmblem2": {
        const id = card.mainEmblems[nodeName(entry) === "mainEmblem1" ? 0 : 1] ?? 0;
        return id ? { visible: true, paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          const image = this.images.path(`etc_/emblem/${id}_51.png`);
          if (image) drawFitted(context, image, rect);
        } } : { visible: false };
      }
      case "tempShopPreview": return { paint: (context: CanvasRenderingContext2D, rect: Rect) =>
        this.paintRecord(context, rect) };
      case "userInfo1Right": return { paint: (context: CanvasRenderingContext2D, rect: Rect) =>
        this.paintClub(context, rect) };
      case "intro": return { text: card.self ? this.strings.get("defaultIntro") ?? "" : "这名车手还没有填写自我介绍。" };
      case "licenseInfo": return { label: "驾照", action: () => {
        const name = licenseName(card.license);
        this.notice(name ? `${card.nickname} 的驾照：${name}驾照${card.proUntil > Date.now()
          ? `|PRO驾照有效期至 ${formatDate(card.proUntil)}` : ""}` : this.strings.get("licenseWarning1") ?? "暂时没有获得驾照。");
      } };
      case "addFriend": return card.self || !this.options.requestFriend ? { visible: false }
        : { label: this.strings.get("registerFriend") ?? "申请好友", disabled: this.busy, action: () => void this.addFriend() };
      case "joinGarage": return !this.options.visitRoom ? { visible: false }
        : { label: this.strings.get("gotoMyroom") ?? "访问小屋", action: () => this.options.visitRoom!(card.nickname) };
    }
    return {};
  }

  private async addFriend(): Promise<void> {
    if (this.busy || !this.options.requestFriend) return;
    this.busy = true;
    this.view?.render();
    try {
      const result = await this.options.requestFriend(this.options.card.nickname);
      this.notice(result.accepted ? `已和 ${this.options.card.nickname} 成为好友。`
        : this.strings.get("requestFriendComplete") ?? "完成申请好友");
    } catch (error) {
      this.notice(friendError(error));
    } finally {
      this.busy = false;
      this.view?.render();
    }
  }

  /** The race record and status (where the release shows the rider in 3D). */
  private paintRecord(context: CanvasRenderingContext2D, rect: Rect): void {
    const { card } = this.options;
    const status = this.strings.get(PRESENCE[card.presence] ?? "offline") ?? "不在线";
    const winRate = card.stats.races ? `${(card.stats.wins / card.stats.races * 100).toFixed(1)}%` : "-";
    const rows: Array<[string, string]> = [
      [this.strings.get("currentStatus") ?? "目前状态", status],
      ["驾照", licenseName(card.license) ? `${licenseName(card.license)}驾照` : "暂无"],
      ["俱乐部", card.club ? card.club.name : "未加入"],
      ["注册时间", card.createdAt ? formatDate(card.createdAt) : "-"],
      ["比赛场次", `${card.stats.races.toLocaleString("en-US")}场`],
      ["胜利", `${card.stats.wins.toLocaleString("en-US")}场（胜率 ${winRate}）`],
      ["前三名", `${card.stats.podiums.toLocaleString("en-US")}场`],
      ["积分", card.stats.points.toLocaleString("en-US")],
    ];
    const left = rect.x + 40;
    const top = rect.y + 70;
    context.save();
    context.fillStyle = "rgba(10,24,48,.55)";
    context.fillRect(rect.x + 18, top - 14, rect.width - 36, rows.length * 34 + 20);
    context.font = `bold 16px ${FONT}`;
    context.textBaseline = "middle";
    rows.forEach(([label, value], index) => {
      const y = top + index * 34 + 8;
      context.fillStyle = "rgb(207,221,240)";
      context.fillText(label, left, y);
      context.fillStyle = index === 0 && card.presence !== "offline" ? "rgb(174,244,46)" : "white";
      context.fillText(value, left + 120, y, rect.width - 200);
    });
    context.restore();
  }

  /** The rider's club where the release shows the VIP grades. */
  private paintClub(context: CanvasRenderingContext2D, rect: Rect): void {
    const club = this.options.card.club;
    const centre = rect.x + rect.width / 2;
    const line = (text: string, y: number, size: number, color: string) => {
      context.font = `bold ${size}px ${FONT}`;
      context.lineWidth = 4;
      context.strokeStyle = "rgba(10,20,40,.85)";
      context.strokeText(text, centre, y);
      context.fillStyle = color;
      context.fillText(text, centre, y);
    };
    context.save();
    context.textAlign = "center";
    context.textBaseline = "top";
    line("俱乐部", rect.y + 6, 18, "white");
    if (!club) {
      line("该车手尚未加入俱乐部。", rect.y + 200, 16, "rgb(207,221,240)");
      context.restore();
      return;
    }
    const markRect = { x: centre - 75, y: rect.y + 50, width: 150, height: 150 };
    const mark = this.images.path(`etc_/clubMark/clubMark_${club.mark}.png`);
    const frame = this.images.path(`etc_/clubMark/clubFrame/clubFrame_${club.frame}.png`);
    if (mark) drawFitted(context, mark, { x: markRect.x + 25, y: markRect.y + 25, width: 100, height: 100 });
    if (frame) drawFitted(context, frame, markRect);
    line(club.name, rect.y + 222, 22, "white");
    line(`俱乐部等级 Lv.${club.level}`, rect.y + 262, 16, "rgb(170,210,255)");
    line(`会员等级：${gradeName(club.grade)}`, rect.y + 290, 16, "rgb(170,210,255)");
    context.restore();
  }
}
