import { p2, s2 } from "../generated/formats.js";
import { U1, te } from "../generated/library.js";
import { attribute, clone, fillRows, FONT, indexRows, mapTree, nodeName, nodesUnder, paintText, prepare,
  resolveStrings, withAttributes, type BmlLibrary, type Node, type NodeState, type Rect, type ResourceFile,
  type Texture, type WindowView } from "../ui/bml-kit";
import { readMainMenuStrings, type MainMenuNode } from "../ui/main-menu-view";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import { ClubApi, clubErrorMessage, formatClubDate, formatLucci, gradeName, GRADE_FIRST, GRADE_MANAGER,
  GRADE_MASTER, GRADE_MEMBER, onlineText, type ClubHouse, type ClubInfo, type ClubMember, type ClubRules,
  type ClubState } from "./club-api";

/**
 * The release 俱乐部 pages over the lobby, drawn by the shared BML window
 * renderer from their 1600×900 layouts: ClubMainStage (我的俱乐部),
 * ClubListStage (俱乐部目录), ClubCreateStage (创建俱乐部) and
 * ClubHouseStage (俱乐部基地), with the dialog.rho club dialogs
 * (clubWaitingCrew, clubCrewModify, clubUpgrade, clubNameChange). Every
 * change goes through the data service (server-go/CLUB.md).
 */

export type ClubLibrary = BmlLibrary;
export type ClubPage = "main" | "list" | "create" | "house";

export interface ClubScreenOptions {
  library: ClubLibrary;
  root: HTMLElement;
  api: ClubApi;
  /** The rider's level (club.CreateLevel gates creating a club). */
  level(): number;
  /** The rider's nickname, to find its own row. */
  nickname?(): string | undefined;
  onClose(): void;
  onActivate?(): void;
}

const PAGES: Record<ClubPage, { folder: string; roots: string[]; label: string }> = {
  main: { folder: "stage_/clubMain", roots: ["stage_/clubMain", "stage_/common"], label: "我的俱乐部" },
  list: { folder: "stage_/clubList", roots: ["stage_/clubList", "stage_/common", "stage_/clubMain"], label: "俱乐部目录" },
  create: { folder: "stage_/clubCreate", roots: ["stage_/clubCreate", "stage_/common", "stage_/clubMain"],
    label: "创建俱乐部" },
  house: { folder: "stage_/clubHouse", roots: ["stage_/clubHouse", "stage_/common", "stage_/clubMain"],
    label: "俱乐部基地" },
};
const MEMBERS_PER_PAGE = 10;
const APPLICANTS_PER_PAGE = 10;
/** Menu tab captions (stage_club* string bags: myClub, clubList, clubHouse, createClub). */
const TAB_CAPTIONS: Record<string, string> = { myClub: "我的俱乐部", clubList: "俱乐部目录", clubHouse: "俱乐部基地",
  createClub: "创建俱乐部" };
/** The 周活跃度 gauge's full mark. */
const WEEKLY_TARGET = 1000;

/** A close button on a page's background (stage_common kick_1…4). */
const CLOSE: Node = { name: "ImageButton", children: [], attributes: [
  { name: "name", value: "clubClose" }, { name: "leftTopWH", value: "1556 14 30 30" },
  { name: "autoLoadImage", value: "kick_" }, { name: "alphaBlend", value: "true" }] };

function addClose(definition: Node): Node {
  return mapTree(definition, node =>
    nodeName(node) === "backGround" ? { ...node, children: [...node.children, CLOSE] } : undefined);
}

export class ClubScreen {
  private view?: WindowView;
  private dialog?: WindowView;
  private message?: AbortController;
  private disposed = false;
  private busy = false;
  page: ClubPage = "list";
  private state?: ClubState;
  private rules?: ClubRules;
  private memberPage = 0;
  private list: { name: string; master: string; page: number; total: number; perPage: number; clubs: ClubInfo[];
    selected?: ClubInfo } = { name: "", master: "", page: 0, total: 0, perPage: 15, clubs: [] };
  private create = { name: "", intro: "", mark: 0, frame: 0 };
  private house?: ClubHouse;
  private facility = 0;
  private donation = 0;
  private readonly textures = new Map<string, Promise<Texture | undefined>>();
  private readonly loaded = new Map<string, Texture | null>();

  private constructor(readonly options: ClubScreenOptions) {}

  /** Open on 我的俱乐部 for a member, else on the 俱乐部目录. */
  static async open(options: ClubScreenOptions): Promise<ClubScreen> {
    const screen = new ClubScreen(options);
    await screen.reload();
    await screen.show(screen.state?.club ? "main" : "list");
    return screen;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.message?.abort();
    this.dialog?.dispose();
    this.view?.dispose();
  }

  private async reload(): Promise<void> {
    const state = await this.options.api.state();
    this.state = state;
    if (state.rules) this.rules = state.rules;
  }

  private apply(state: ClubState): void {
    this.state = state;
    if (state.rules) this.rules = state.rules;
  }

  private render(): void {
    this.view?.render();
    this.dialog?.render();
  }

  // -------------------------------------------------------------------------
  // Art

  /** etc_/clubMark/clubMark_<id>.png and clubFrame/clubFrame_<id>.png, drawn once loaded. */
  private image(path: string): Texture | undefined {
    const ready = this.loaded.get(path);
    if (ready !== undefined) return ready ?? undefined;
    if (!this.textures.has(path)) {
      const pending = Promise.resolve().then(async () => {
        const file = this.options.library.canonicalCandidates(path)[0];
        if (!file) return undefined;
        const decoded = await p2(await file.bytes()) as { width: number; height: number; pixels: ArrayLike<number> };
        const canvas = document.createElement("canvas");
        canvas.width = decoded.width;
        canvas.height = decoded.height;
        canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels),
          decoded.width, decoded.height), 0, 0);
        return { image: canvas, width: decoded.width, height: decoded.height };
      }).catch(() => undefined);
      this.textures.set(path, pending);
      void pending.then(texture => {
        this.loaded.set(path, texture ?? null);
        if (texture && !this.disposed) this.render();
      });
    }
    return undefined;
  }

  /** A club's mark in its frame, centred in rect (small: the _s images). */
  private paintMark(mark: number, frame: number, small = false) {
    return { visible: true, paint: (context: CanvasRenderingContext2D, rect: Rect) => {
      const suffix = small ? "_s" : "";
      const markImage = this.image(`etc_/clubMark/clubMark_${mark}${suffix}.png`);
      const frameImage = this.image(`etc_/clubMark/clubFrame/clubFrame_${frame}${suffix}.png`);
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      if (markImage) {
        const scale = Math.min(rect.width / markImage.width, rect.height / markImage.height);
        context.drawImage(markImage.image, cx - markImage.width * scale / 2, cy - markImage.height * scale / 2,
          markImage.width * scale, markImage.height * scale);
      }
      if (frameImage) {
        // The frame (150 wide around a 100 mark; 24 around 20) is centred on the mark.
        const width = rect.width * (small ? 1.2 : 1.5);
        const height = frameImage.height * width / frameImage.width;
        context.drawImage(frameImage.image, cx - width / 2, cy - height / 2, width, height);
      }
    } };
  }

  // -------------------------------------------------------------------------
  // Messages and confirmations

  private notice(text: string): Promise<boolean> {
    return this.ask(text, false);
  }

  private ask(text: string, confirm = true): Promise<boolean> {
    this.message?.abort();
    const abort = new AbortController();
    this.message = abort;
    return openMessengerMessage(this.options.library as never, this.options.root, "俱乐部", text,
      confirm ? { yes: "确定", no: "取消" } : {}, abort.signal).catch(() => false);
  }

  /** Run a club request: busy guard, errors as release messages. */
  private async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (this.busy || this.disposed) return undefined;
    this.busy = true;
    try {
      return await action();
    } catch (error) {
      void this.notice(clubErrorMessage(error));
      return undefined;
    } finally {
      this.busy = false;
    }
  }

  // -------------------------------------------------------------------------
  // Pages

  async show(page: ClubPage): Promise<void> {
    if (this.disposed) return;
    this.options.onActivate?.();
    this.page = page;
    if (page === "list" && !this.list.clubs.length) await this.search(false);
    if (page === "house") {
      const loaded = await this.run(() => this.options.api.house());
      if (!loaded) return;
      this.house = loaded.house;
      if (loaded.rules) this.rules = loaded.rules;
    }
    if (page === "create" && this.rules && !this.create.mark) {
      const basic = this.rules.marks.filter(mark => mark.basic).sort((a, b) => b.order - a.order);
      this.create.mark = basic[0]?.id ?? 0;
      this.create.frame = this.rules.frames.filter(frame => frame.basic).sort((a, b) => b.order - a.order)[0]?.id ?? 0;
    }
    const config = PAGES[page];
    const library = this.options.library;
    const bml = async (name: string): Promise<Node> =>
      s2(await (U1(library, [config.folder], name, ".bml") as ResourceFile).bytes()) as Node;
    const rows = new WeakMap<Node, number>();
    let definition = prepare(library, addClose(await bml("stage_1600")), config.roots);
    if (page === "main") {
      definition = fillRows(definition, "crew_", prepare(library, await bml("labelTemplate_1600"), config.roots));
      indexRows(definition, "crew_", rows);
      this.myInfoNodes = nodesUnder(definition, "myInfo");
    } else if (page === "list") {
      definition = fillRows(definition, "clubInfo_", prepare(library, await bml("clubInfoTemplate_1600"), config.roots));
      indexRows(definition, "clubInfo_", rows);
    } else if (page === "house") {
      indexRows(definition, "slot", this.slotOf);
    } else if (page === "create") {
      // GridSelector storageGridSelector: five 180×180 slots a row, 16 px apart.
      definition = mapTree(definition, node => {
        const match = /^club(?:Mark|Frame)Slot_(\d)$/.exec(nodeName(node));
        if (!match) return undefined;
        const index = Number(match[1]);
        return withAttributes(node, { leftTopWH: `${(index % 5) * 196} ${Math.floor(index / 5) * 196} 180 180` });
      });
    }
    if (this.disposed) return;
    const state = page === "main" ? (node: Node) => this.mainState(node, rows)
      : page === "list" ? (node: Node) => this.listState(node, rows)
        : page === "create" ? (node: Node) => this.createState(node) : (node: Node) => this.houseState(node);
    const view = await te.load({
      library, root: this.options.root, definition, roots: config.roots, smoothImages: true, modal: true,
      label: config.label, onCancel: () => this.options.onClose(), state,
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return;
    }
    this.view?.dispose();
    this.view = view;
    view.show();
  }

  /** The menu tabs and close shared by the pages. */
  private tabState(node: Node, name: string): NodeState | undefined {
    const member = !!this.state?.club;
    switch (name) {
      case "clubClose": return { label: "关闭", action: () => this.options.onClose() };
      case "myClub": return this.tabLabel(node, name, this.page === "main", member && this.page !== "main"
        ? { action: () => void this.show("main") } : { disabled: !member });
      case "clubList": return this.tabLabel(node, name, this.page === "list", this.page !== "list"
        ? { action: () => void this.show("list") } : {});
      case "clubHouse": return this.tabLabel(node, name, this.page === "house", member && this.page !== "house"
        ? { action: () => void this.show("house") } : { disabled: !member });
      case "createClub": return this.tabLabel(node, name, this.page === "create", !member && this.page !== "create"
        ? { action: () => void this.openCreate() } : {});
      case "clubSeason": return { text: "" };
    }
    return undefined;
  }

  /**
   * A menu tab's caption at its stringPos (right of the tab's icon), in
   * the release colours: grey, blue on hover, white when pressed or current.
   */
  private tabLabel(node: Node, name: string, current: boolean, state: NodeState): NodeState {
    const caption = TAB_CAPTIONS[name] ?? "";
    const [dx = 0, dy = 0] = (attribute(node, "stringPos") ?? "0 0").trim().split(/\s+/).map(Number);
    return { ...state, label: caption, text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) => {
      const view = this.view as unknown as { hovered?: unknown; pressed?: unknown } | undefined;
      const color = current || view?.pressed === node ? "white"
        : view?.hovered === node ? "rgb(6,172,255)" : "rgb(135,141,146)";
      context.save();
      context.font = `16px ${FONT}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillStyle = color;
      context.fillText(caption, rect.x + dx, rect.y + rect.height / 2 + dy);
      context.restore();
    } };
  }

  private async openCreate(): Promise<void> {
    const rules = this.rules;
    if (rules && this.options.level() < rules.createLevel) {
      void this.notice("七彩色星星手套以上玩家|可创建俱乐部。");
      return;
    }
    const applied = this.state?.me.applied;
    if (applied && !await this.ask(`已申请加入[${applied.name}]俱乐部，|取消后要创建俱乐部吗？`)) return;
    void this.show("create");
  }

  // ----- 我的俱乐部

  private mainState(node: Node, rows: WeakMap<Node, number>): NodeState {
    const name = nodeName(node);
    const tab = this.tabState(node, name);
    if (tab) return tab;
    const club = this.state?.club;
    const me = this.state?.me;
    if (!club || !me) return {};
    const row = rows.get(node);
    if (row !== undefined) return this.memberRow(node, name, row);
    const manage = me.grade === GRADE_MASTER || me.grade === GRADE_MANAGER;
    const pages = Math.max(1, Math.ceil(this.state!.members.length / MEMBERS_PER_PAGE));
    const nickname = this.options.nickname?.();
    const self = this.state!.members.find(member => member.nickname === nickname);
    switch (name) {
      case "clubName": return { text: club.name };
      case "clubMark": return this.paintMark(club.mark, club.frame);
      case "clubFrame": return { visible: false };
      case "clubLevel": return { text: `Lv.${club.level}` };
      case "clubMasterName": return { text: club.master };
      case "memberCount": return { text: `${club.members} / ${club.maxMembers}` };
      case "clubCreateDate": return { text: formatClubDate(club.createdAt) };
      case "currClubAp": return { text: String(club.csWeek) };
      case "maxClubAp": return { text: String(WEEKLY_TARGET) };
      case "activityPointGauge": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const ratio = Math.min(1, club.csWeek / WEEKLY_TARGET);
        context.fillStyle = "rgba(20,30,50,.6)";
        context.fillRect(rect.x + rect.width * ratio, rect.y, rect.width * (1 - ratio), rect.height);
      } };
      case "clubIntroStr": return paintText(club.intro || "点击[修改]按钮，|用文字来展示你的俱乐部吧。",
        { size: 16, color: "rgb(42,55,80)" });
      case "editClubIntroBtn": return manage ? { action: () => void this.editIntro() } : { visible: false };
      case "clubIntroEdit": return { visible: false };
      case "autoJoinCont": return { visible: manage };
      case "autoJoin": return { checked: club.autoJoin, label: "自动加入俱乐部", action: () => void this.toggleAutoJoin() };
      case "recruitCrewLbl": return { visible: !manage, text: club.autoJoin ? "俱乐部会员招募中（自动加入）" : "俱乐部会员招募中" };
      case "clubLeave": return me.grade !== GRADE_MASTER ? { visible: true, action: () => void this.leave() }
        : { visible: false };
      case "clubBreak": return me.grade === GRADE_MASTER && !club.breakAt ? { visible: true, action: () => void this.breakClub() }
        : { visible: false };
      case "clubBreakCancel": return me.grade === GRADE_MASTER && club.breakAt
        ? { visible: true, action: () => void this.cancelBreak() } : { visible: false };
      case "pauseClubBreakReserve": return { visible: !!club.breakAt };
      case "speedClubRaceScore":
      case "itemClubRaceScore": return { text: "0场  0胜  0败" };
      case "speedClubRaceRate":
      case "itemClubRaceRate": return { text: "胜率  0%" };
      case "acceptJoin": return me.grade >= GRADE_MASTER && me.grade <= GRADE_FIRST
        ? { action: () => void this.openApplicants() } : { disabled: true };
      case "acceptJoinEnable": return { visible: me.grade <= GRADE_FIRST };
      case "acceptJoinDisable": return { visible: me.grade > GRADE_FIRST };
      case "page": return { text: String(this.memberPage + 1) };
      case "divPage": return { text: `/ ${pages}` };
      case "prevPage": return this.memberPage > 0 ? { label: "上一页", action: () => { this.memberPage--; this.render(); } }
        : { disabled: true };
      case "nextPage": return this.memberPage + 1 < pages
        ? { label: "下一页", action: () => { this.memberPage++; this.render(); } } : { disabled: true };
    }
    if (self && this.myInfoNodes.has(node)) return this.memberText(name, self) ?? {};
    return {};
  }

  private myInfoNodes = new WeakSet<Node>();

  private memberText(name: string, member: ClubMember): NodeState | undefined {
    switch (name) {
      case "level": return { text: `Lv.${member.level}` };
      case "rid": return { text: member.nickname };
      case "crewGrade": return { text: gradeName(member.grade) };
      case "weekActivityPoint": return { text: String(member.csWeek) };
      case "totalActivityPoint": return { text: String(member.csTotal) };
      case "joinDate": return { text: formatClubDate(member.joinedAt) };
      case "onlineState": return { text: onlineText(member),
        textColor: member.online ? "rgb(50,170,50)" : "rgb(135,146,167)" };
    }
    return undefined;
  }

  private memberRow(node: Node, name: string, row: number): NodeState {
    const member = this.state?.members[this.memberPage * MEMBERS_PER_PAGE + row];
    if (!member) return { visible: false };
    const me = this.state!.me;
    const canModify = me.grade === GRADE_MASTER ? member.grade !== GRADE_MASTER
      : me.grade === GRADE_MANAGER && member.grade > GRADE_MANAGER;
    if (name === "backPanel") return { visible: false };
    if (name === "modify") return canModify ? { visible: true, label: `管理 ${member.nickname}`,
      action: () => void this.openCrewModify(member) } : { visible: false };
    if (name === "oid") return { visible: false };
    return this.memberText(name, member) ?? {};
  }

  private async editIntro(): Promise<void> {
    const club = this.state?.club;
    if (!club) return;
    const intro = await this.prompt("俱乐部简介", club.intro, this.rules?.introMax ?? 150);
    if (intro === undefined) return;
    const state = await this.run(() => this.options.api.update({ intro }));
    if (!state) return;
    this.apply(state);
    this.render();
    void this.notice("俱乐部简介已变更。");
  }

  private async toggleAutoJoin(): Promise<void> {
    const club = this.state?.club;
    if (!club) return;
    if (!club.autoJoin && !await this.ask("开启自动加入俱乐部设置时，|所有车手都可自由加入俱乐部。|是否继续开启自动加入俱乐部设置？"))
      return;
    const state = await this.run(() => this.options.api.update({ autoJoin: !club.autoJoin }));
    if (!state) return;
    this.apply(state);
    this.render();
    void this.notice("自动加入状态已变更。");
  }

  private async leave(): Promise<void> {
    if (!await this.ask("确认要退出俱乐部吗？|退出后24小时内无法加入俱乐部。")) return;
    const state = await this.run(() => this.options.api.leave());
    if (!state) return;
    this.apply(state);
    await this.show("list");
  }

  private async breakClub(): Promise<void> {
    if (!await this.ask("确认要解散俱乐部吗？|单人俱乐部申请解散后会立即解散。|其他情况在7天后解散。")) return;
    const result = await this.run(() => this.options.api.breakClub());
    if (!result) return;
    this.apply(result.state);
    if (result.immediate) {
      await this.show("list");
      void this.notice("俱乐部已解散。");
    } else {
      this.render();
      void this.notice("已提交俱乐部的解散申请。");
    }
  }

  private async cancelBreak(): Promise<void> {
    if (!await this.ask("确认要取消解散俱乐部吗？")) return;
    const state = await this.run(() => this.options.api.cancelBreak());
    if (!state) return;
    this.apply(state);
    this.render();
  }

  // ----- dialogs

  private closeDialog(): void {
    this.dialog?.dispose();
    this.dialog = undefined;
    this.view?.focus();
  }

  /** A dialog.rho layout with its own string bag's texts filled in. */
  private async dialogDefinition(folder: string, file: string, bag: string): Promise<Node> {
    const raw = s2(await (U1(this.options.library, [folder], file, ".bml") as ResourceFile).bytes()) as Node;
    return resolveStrings(raw, await this.dialogStrings(folder, bag));
  }

  private async dialogStrings(folder: string, bag: string): Promise<Map<string, string>> {
    try {
      return readMainMenuStrings(s2(await (U1(this.options.library, [folder], bag, ".bml") as ResourceFile)
        .bytes()) as MainMenuNode);
    } catch {
      // Texts the stage string bags hold resolve in the window loader.
      return new Map();
    }
  }

  /** A dialog over the page; index sees the final tree (row lookups by node). */
  private async openDialog(definition: Node, roots: string[], label: string,
    state: (node: Node) => NodeState, index?: (prepared: Node) => void): Promise<void> {
    const prepared = prepare(this.options.library, definition, roots);
    index?.(prepared);
    const view = await te.load({
      library: this.options.library, root: this.options.root, definition: prepared,
      roots, smoothImages: true, modal: true, label, onCancel: () => this.closeDialog(), state,
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return;
    }
    this.dialog?.dispose();
    this.dialog = view;
    view.show();
  }

  /** A one-line text prompt in a release CaptionDialog (an Edit and 确定 / 取消). */
  private prompt(title: string, value: string, maxLength: number, info = ""): Promise<string | undefined> {
    return new Promise(resolve => {
      let text = value;
      let done = false;
      const finish = (result: string | undefined): void => {
        if (done) return;
        done = true;
        this.closeDialog();
        resolve(result);
      };
      const node = (name: string, attributes: Record<string, string>, children: Node[] = []): Node =>
        ({ name, attributes: Object.entries(attributes).map(([key, entry]) => ({ name: key, value: entry })), children });
      const definition = node("Panel", { windowRect: "fullscreen", color: "160 0 0 0", alphaBlend: "true" }, [
        node("CaptionWindow", { leftTopWH: "0 0 520 230", frame: "CaptionDialog", align: "center", caption: title,
          setCloseButton: "cancel" }, [
          node("Edit", { name: "edit", leftTopWH: "24 30 472 34", frame: "DefaultEdit", textRender: "bold16" }),
          node("Label", { name: "info", leftTopWH: "24 76 472 40", textRender: "bold14", textColor: "255 72 106 163" }),
          node("Window", { leftTopWH: "0 0 470 1", frame: "HSection", align: "hcenter;bottom", adjust: "0 63" }),
          node("TextButton", { name: "ok", leftTopWH: "0 0 132 40", align: "hcenter;bottom", adjust: "-72 12",
            textRender: "bold16", text: "确定" }),
          node("TextButton", { name: "cancel", leftTopWH: "0 0 132 40", align: "hcenter;bottom", adjust: "72 12",
            textRender: "bold16", text: "取消" }),
        ]),
      ]);
      void this.openDialog(definition, ["stage_/common"], title, entry => {
        switch (nodeName(entry)) {
          case "edit": return { input: { value: text, maxLength, change: (next: string) => { text = next; },
            submit: () => finish(text) }, label: title };
          case "info": return paintText(info || `最多可输入${maxLength}字`, { size: 14, color: "rgb(72,106,163)" });
          case "ok": return { label: "确定", action: () => finish(text) };
          case "cancel": return { label: "取消", action: () => finish(undefined) };
        }
        return {};
      }).then(() => this.dialog?.focus("edit")).catch(error => {
        finish(undefined);
        void this.notice(clubErrorMessage(error));
      });
    });
  }

  private async openApplicants(): Promise<void> {
    const applicants = await this.run(() => this.options.api.applicants());
    if (!applicants) return;
    let list = applicants;
    let page = 0;
    const rows = new WeakMap<Node, number>();
    const library = this.options.library;
    const template = resolveStrings(s2(await (U1(library, ["dialog/clubWaitingCrew"], "labelTemplate", ".bml") as
      ResourceFile).bytes()) as Node, await this.dialogStrings("dialog/clubWaitingCrew", "clubWaitingCrew_stringBag"));
    const definition = fillRows(await this.dialogDefinition("dialog/clubWaitingCrew", "clubWaitingCrew@zz",
      "clubWaitingCrew_stringBag"), "waitingCrew_", template);
    const decide = async (applicant: ClubMember, accept: boolean): Promise<void> => {
      const result = await this.run(() => this.options.api.decide(applicant.accountId, accept));
      if (!result) return;
      this.apply(result.state);
      list = result.applicants;
      page = Math.min(page, Math.max(0, Math.ceil(list.length / APPLICANTS_PER_PAGE) - 1));
      this.render();
    };
    await this.openDialog(definition, ["dialog/clubWaitingCrew", "stage_/common"], "申请加入俱乐部", node => {
      const name = nodeName(node);
      const row = rows.get(node);
      if (row !== undefined) {
        const applicant = list[page * APPLICANTS_PER_PAGE + row];
        if (!applicant) return { visible: false };
        switch (name) {
          case "glove": return { visible: false };
          case "level": return { text: `Lv.${applicant.level}` };
          case "rid": return { text: applicant.nickname, size: undefined };
          case "accept": return { label: `同意 ${applicant.nickname}`, action: () => void decide(applicant, true) };
          case "rejection": return { label: `拒绝 ${applicant.nickname}`, action: () => void decide(applicant, false) };
        }
        return {};
      }
      const pages = Math.max(1, Math.ceil(list.length / APPLICANTS_PER_PAGE));
      switch (name) {
        case "waitingCrewLists": return list.length ? {} : { ...paintText("无申请加入人员。", { size: 16, align: "center",
          middle: true }) };
        case "page": return { text: `${page + 1} / ${pages}` };
        case "prevPage": return page > 0 ? { label: "上一页", action: () => { page--; this.render(); } } : { disabled: true };
        case "nextPage": return page + 1 < pages ? { label: "下一页", action: () => { page++; this.render(); } }
          : { disabled: true };
        case "ok": return { label: "确定", action: () => this.closeDialog() };
      }
      return {};
    }, prepared => indexRows(prepared, "waitingCrew_", rows));
  }

  private async openCrewModify(member: ClubMember): Promise<void> {
    let grade = member.grade;
    const me = this.state?.me;
    if (!me) return;
    const definition = await this.dialogDefinition("dialog/clubCrewModify", "clubCrewModify@zz",
      "clubCrewModify_stringBag");
    const radio = (value: number) => ({
      checked: grade === value, label: gradeName(value),
      ...(me.grade === GRADE_MASTER ? { action: () => { grade = value; this.render(); } } : { disabled: true }),
      paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        context.save();
        context.strokeStyle = "rgb(84,100,129)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, 0, Math.PI * 2);
        context.stroke();
        if (grade === value) {
          context.fillStyle = "rgb(36,129,255)";
          context.beginPath();
          context.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2 - 3, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      },
    });
    await this.openDialog(definition, ["dialog/clubCrewModify", "stage_/common"], "俱乐部会员等级变更", node => {
      switch (nodeName(node)) {
        case "rid": return { text: member.nickname };
        case "crewGrade": return { text: `现在是${gradeName(member.grade)}` };
        case "managerGradeBtn": return radio(GRADE_MANAGER);
        case "firstMemberGradeBtn": return radio(GRADE_FIRST);
        case "memberGradeBtn": return radio(GRADE_MEMBER);
        case "kickOut": return { label: "踢除", action: () => void (async () => {
          if (!await this.ask(`确认要踢除[${member.nickname}]会员吗？`)) return;
          const state = await this.run(() => this.options.api.member(member.accountId, { kick: true }));
          if (!state) return;
          this.apply(state);
          this.closeDialog();
          this.render();
        })() };
        case "ok": return { label: "确定", action: () => void (async () => {
          if (grade === member.grade) {
            this.closeDialog();
            return;
          }
          const state = await this.run(() => this.options.api.member(member.accountId, { grade }));
          if (!state) return;
          this.apply(state);
          this.closeDialog();
          this.render();
        })() };
        case "cancel": return { label: "取消", action: () => this.closeDialog() };
      }
      return {};
    });
  }

  // ----- 俱乐部目录

  private async search(render = true): Promise<void> {
    const result = await this.run(() => this.options.api.list({ name: this.list.name.trim(),
      master: this.list.master.trim(), page: this.list.page }));
    if (!result) return;
    Object.assign(this.list, { clubs: result.clubs, total: result.total, page: result.page, perPage: result.perPage });
    if (render) this.render();
  }

  private listState(node: Node, rows: WeakMap<Node, number>): NodeState {
    const name = nodeName(node);
    const tab = this.tabState(node, name);
    if (tab) return tab;
    const me = this.state?.me;
    const mine = this.state?.club;
    const row = rows.get(node);
    if (row !== undefined) return this.clubRow(node, name, row);
    const shown = this.list.selected ?? mine;
    const pages = Math.max(1, Math.ceil(this.list.total / this.list.perPage));
    switch (name) {
      case "menuTab_join": return { visible: !!mine };
      case "menuTab_none": return { visible: !mine };
      case "clubName": return { text: shown?.name ?? "" };
      case "clubMark": return shown ? this.paintMark(shown.mark, shown.frame) : { visible: false };
      case "clubFrame": return { visible: false };
      case "clubLevel": return { text: shown ? `Lv.${shown.level}` : "" };
      case "clubMasterName": return { text: shown?.master ?? "" };
      case "memberCount": return { text: shown ? `${shown.members} / ${shown.maxMembers}` : "" };
      case "clubCreateDate": return { text: shown ? formatClubDate(shown.createdAt) : "" };
      case "currClubAp": return { text: shown ? String(shown.csWeek) : "" };
      case "maxClubAp": return { text: shown ? String(WEEKLY_TARGET) : "" };
      case "divClubAp": return { visible: !!shown };
      case "activityPointGauge": return shown ? { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const ratio = Math.min(1, shown.csWeek / WEEKLY_TARGET);
        context.fillStyle = "rgba(20,30,50,.6)";
        context.fillRect(rect.x + rect.width * ratio, rect.y, rect.width * (1 - ratio), rect.height);
      } } : { visible: false };
      case "clubIntroStr": return paintText(shown?.intro ?? "选择俱乐部后显示俱乐部简介。", { size: 16 });
      case "clubJoinState": return { text: shown ? shown.breakAt ? "申请解散中" : shown.autoJoin
        ? "俱乐部会员招募中（自动加入）" : "俱乐部会员招募中" : "" };
      case "clubJoin": {
        const can = !!shown && !mine && shown.id !== me?.applied?.id && !shown.breakAt;
        return can ? { action: () => void this.applyTo(shown!) } : { disabled: true };
      }
      case "clubNameEdit": return { input: { value: this.list.name, maxLength: 10,
        change: (value: string) => { this.list.name = value; }, submit: () => { this.list.page = 0; void this.search(); } },
      label: "俱乐部名称" };
      case "clubMasterEdit": return { input: { value: this.list.master, maxLength: 20,
        change: (value: string) => { this.list.master = value; }, submit: () => { this.list.page = 0; void this.search(); } },
      label: "俱乐部会长名" };
      case "clubSearch": return { label: "搜索", action: () => { this.list.page = 0; void this.search(); } };
      case "storageGridSelector": return this.list.clubs.length ? {}
        : paintText("无满足搜索条件的俱乐部，|请确认搜索条件。", { size: 16, align: "center", middle: true, color: "rgb(84,100,129)" });
      case "page": return { text: String(this.list.page + 1) };
      case "divTotalPage": return { text: `/ ${pages}` };
      case "prevPage": return this.list.page > 0
        ? { label: "上一页", action: () => { this.list.page--; void this.search(); } } : { disabled: true };
      case "nextPage": return this.list.page + 1 < pages
        ? { label: "下一页", action: () => { this.list.page++; void this.search(); } } : { disabled: true };
      case "myClubInfo_empty": return { visible: !mine && !me?.applied };
      case "myClubInfo_wait": return { visible: !mine && !!me?.applied };
      case "myClubInfo_Joined": return { visible: !!mine };
      case "myClub_clubMark": return mine ? this.paintMark(mine.mark, mine.frame, true) : { visible: false };
      case "myClub_Name": return { text: mine?.name ?? me?.applied?.name ?? "" };
      case "myClub_Level": return { text: mine ? `Lv.${mine.level}` : "" };
      case "myClub_APTotal": return { text: mine ? String(mine.cs) : "" };
      case "myClub_APWeekly": return { text: mine ? String(mine.csWeek) : "" };
      case "myClub_MasterRid": return { text: mine?.master ?? "" };
      case "myClub_RealCrewCount": return { text: mine ? String(mine.members) : "" };
      case "myClub_MaxCrewCount": return { text: mine ? String(mine.maxMembers) : "" };
      case "myClub_CreateDate": return { text: mine ? formatClubDate(mine.createdAt) : "" };
      case "clubJoinCancel": return { label: "取消加入", action: () => void this.cancelApplication() };
    }
    return {};
  }

  private clubRow(node: Node, name: string, row: number): NodeState {
    const info = this.list.clubs[row];
    if (!info) return { visible: false };
    switch (name) {
      case "clickPanel": return { visible: this.list.selected?.id === info.id };
      case "backPanel": return { visible: false };
      case "clubMark": return this.paintMark(info.mark, info.frame, true);
      case "clubFrame": return { visible: false };
      case "clubName": return { text: info.name };
      case "clubLevel": return { text: `Lv.${info.level}` };
      case "clubActivityPointTotal": return { text: String(info.cs) };
      case "clubActivityPointWeekly": return { text: String(info.csWeek) };
      case "masterRid": return { text: info.master };
      case "realCrewCount": return { text: String(info.members) };
      case "maxCrewCount": return { text: String(info.maxMembers) };
      case "createDate": return { text: formatClubDate(info.createdAt) };
      case "invisibleCover": return { label: info.name, action: () => { this.list.selected = info; this.render(); } };
    }
    return {};
  }

  private async applyTo(info: ClubInfo): Promise<void> {
    const applied = this.state?.me.applied;
    if (applied && applied.id !== info.id &&
        !await this.ask(`已申请加入[${applied.name}]俱乐部，|取消后要重新申请加入吗？`)) return;
    const result = await this.run(() => this.options.api.apply(info.id));
    if (!result) return;
    this.apply(result.state);
    if (result.joined) {
      await this.show("main");
      void this.notice(`恭喜您，成功加入[${info.name}]俱乐部。`);
    } else {
      this.render();
      void this.notice("申请加入俱乐部成功。|请耐心等待批准。");
    }
  }

  private async cancelApplication(): Promise<void> {
    if (!await this.ask("确认要取消申请吗？")) return;
    const state = await this.run(() => this.options.api.cancelApplication());
    if (!state) return;
    this.apply(state);
    this.render();
  }

  // ----- 创建俱乐部

  private createState(node: Node): NodeState {
    const name = nodeName(node);
    const tab = this.tabState(node, name);
    if (tab) return tab;
    const basic = (this.rules?.marks ?? []).filter(mark => mark.basic).sort((a, b) => b.order - a.order);
    const slot = /^clubMarkSlot_(\d)$/.exec(name);
    if (slot) {
      const mark = basic[Number(slot[1])];
      if (!mark) return { visible: false };
      const selected = this.create.mark === mark.id;
      return { label: `俱乐部徽章 ${mark.id}`, action: () => { this.create.mark = mark.id; this.render(); },
        paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          context.save();
          context.fillStyle = selected ? "rgba(36,129,255,.25)" : "rgba(255,255,255,.08)";
          context.strokeStyle = selected ? "rgb(36,129,255)" : "rgba(255,255,255,.3)";
          context.lineWidth = selected ? 4 : 2;
          context.beginPath();
          context.roundRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 12);
          context.fill();
          context.stroke();
          context.restore();
          this.paintMark(mark.id, this.create.frame).paint(context,
            { x: rect.x + 40, y: rect.y + 40, width: rect.width - 80, height: rect.height - 80 });
        } };
    }
    const frames = (this.rules?.frames ?? []).filter(frame => frame.basic).sort((a, b) => b.order - a.order);
    switch (name) {
      case "clubFrameSlotList": return { visible: false };
      case "selectedClubMark": return { ...this.paintMark(this.create.mark, this.create.frame),
        label: "切换标志框", action: () => {
          const index = frames.findIndex(frame => frame.id === this.create.frame);
          this.create.frame = frames[(index + 1) % Math.max(1, frames.length)]?.id ?? 0;
          this.render();
        } };
      case "selectedClubFrame": return { visible: false };
      case "clubNameEdit": return { input: { value: this.create.name, maxLength: this.rules?.nameMax ?? 10,
        change: (value: string) => { this.create.name = value; this.render(); } }, label: "俱乐部名称" };
      case "clubNameGuide": return { visible: !this.create.name };
      case "clubInfoEdit": return { input: { value: this.create.intro, maxLength: this.rules?.introMax ?? 150,
        change: (value: string) => { this.create.intro = value; this.render(); } }, label: "俱乐部简介" };
      case "clubInfoGuide": return { visible: !this.create.intro };
      case "createClubBtn": return { label: "创建俱乐部", action: () => void this.submitCreate() };
    }
    return {};
  }

  private async submitCreate(): Promise<void> {
    const rules = this.rules;
    if (!this.create.name.trim()) {
      void this.notice("需要输入俱乐部名称才能进行创建。");
      return;
    }
    if (!this.create.intro.trim()) {
      void this.notice("需要输入俱乐部简介才能进行创建。");
      return;
    }
    if (!await this.ask(`创建俱乐部需要${(rules?.createLucci ?? 100_000).toLocaleString("en-US")}金币。|确认要创建[${this.create.name.trim()}]俱乐部吗？`))
      return;
    const state = await this.run(() => this.options.api.create({ name: this.create.name, intro: this.create.intro,
      mark: this.create.mark, frame: this.create.frame }));
    if (!state) return;
    this.apply(state);
    this.create = { name: "", intro: "", mark: 0, frame: 0 };
    // Notices go over the new page, so it opens first.
    await this.show("main");
    void this.notice("俱乐部创建成功！");
  }

  // ----- 俱乐部基地

  private houseState(node: Node): NodeState {
    const name = nodeName(node);
    const tab = this.tabState(node, name);
    if (tab) return tab;
    const house = this.house;
    const rules = this.rules;
    if (!house || !rules) return {};
    const club = house.club;
    const manage = house.grade === GRADE_MASTER || house.grade === GRADE_MANAGER;
    const facility = this.facility;
    const next = club.facilities[facility]! + 1;
    const upgrade = rules.upgrades.find(entry => entry.level === next);
    const reward = /^rewardButton(\d)$/.exec(name);
    if (reward) {
      const welfare = rules.welfares.find(entry => entry.slot === Number(reward[1]));
      const open = !!welfare && club.facilities[1]! >= welfare.level;
      const taken = !!welfare && house.welfareToday.includes(welfare.slot);
      return open && !taken ? { visible: true, label: welfare!.name, action: () => void this.claimWelfare(welfare!.slot) }
        : { visible: false };
    }
    switch (name) {
      case "house": return { visible: true };
      case "commonInfo": return { visible: true };
      case "facility0":
      case "facility1":
      case "facility2":
      case "facility3": return { visible: name === `facility${facility}` };
      case "btn_clubHQ": return { label: "俱乐部总部", action: () => this.selectFacility(0) };
      case "btn_racingCenter": return { label: "赛事中心", action: () => this.selectFacility(1) };
      case "btn_riderCenter": return { label: "车手中心", action: () => this.selectFacility(2) };
      case "btn_clubBank": return { label: "俱乐部银行", action: () => this.selectFacility(3) };
      case "toolTip": return { visible: true };
      case "toolTip_lv": return { text: "" };
      case "clubLv": return { text: `Lv.${club.level}` };
      case "clubName": return { text: club.name };
      case "clubMark": return this.paintMark(club.mark, club.frame, true);
      case "clubMarksub": return this.paintMark(club.mark, club.frame);
      case "clubFrame": return { visible: false };
      case "crewCount": return { text: String(club.members) };
      case "maxCrewCount": return { text: `/ ${club.maxMembers}` };
      case "clubCS": return { text: facility === 3 || !upgrade ? String(club.cs) : `${club.cs} / ${upgrade.cs}` };
      case "clubCapitalLucci": return { text: club.budget.toLocaleString("en-US") };
      case "clubCapital": return { text: facility === 3 ? club.budget.toLocaleString("en-US")
        : upgrade ? `${formatLucci(club.budget)} / ${formatLucci(upgrade.lucci)}` : formatLucci(club.budget) };
      case "clubCrew": return { text: upgrade && facility === 0 ? `${club.members} / ${upgrade.members}` : "-" };
      case "upgrade": {
        const allowed = manage && !!upgrade && (facility === 0 || next <= club.level);
        return allowed ? { label: "升级", action: () => void this.upgrade() } : { disabled: true };
      }
      case "clubInfoChangeTitle": return { text: "俱乐部信息变更" };
      case "changeClubName": return manage ? { action: () => void this.rename() } : { disabled: true };
      case "changeClubMark": return manage ? { action: () => void this.changeMark() } : { disabled: true };
      case "facilityName": return { text: ["俱乐部总部", "赛事中心", "车手中心", "俱乐部银行"][facility]! +
        `  Lv.${club.facilities[facility]}` };
      case "facilityInfo": return { text: ["管理俱乐部名称，等级，徽章设施", "管理俱乐部福利道具的设施", "管理俱乐部会员的设施",
        "管理俱乐部预算的设施"][facility] };
      case "facilityUse": return { text: facility % 2 === 0 ? "俱乐部管理层以上职位可使用。" : "俱乐部会员以上职位可使用。" };
      case "facilityImg": return { visible: false };
      case "supportRankRid": return { text: house.topDonor || "-" };
      case "totalSupportLucci": return { text: house.myDonations.toLocaleString("en-US") };
      case "support": return house.donatedToday ? { disabled: true } : { label: "进行捐助", action: () => void this.donate() };
    }
    const check = /^checkBtn(\d)$/.exec(name);
    if (check) {
      const index = Number(check[1]);
      return { checked: this.donation === index, label: formatLucci(rules.donations[index] ?? 0),
        action: () => { this.donation = index; this.render(); },
        paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          context.save();
          context.strokeStyle = "white";
          context.lineWidth = 2;
          context.beginPath();
          context.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2 - 1, 0, Math.PI * 2);
          context.stroke();
          if (this.donation === index) {
            context.fillStyle = "rgb(255,214,64)";
            context.beginPath();
            context.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2 - 4, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();
        } };
    }
    const amount = /^supportLucci(\d)$/.exec(name);
    if (amount) return { text: formatLucci(rules.donations[Number(amount[1])] ?? 0) };
    const date = /^supportDate(\d)$/.exec(name);
    if (date) {
      const donation = house.donations[Number(date[1])];
      return { text: donation ? formatClubDate(donation.createdAt).slice(5) : "" };
    }
    const donor = /^supportRid(\d)$/.exec(name);
    if (donor) {
      const donation = house.donations[Number(donor[1])];
      return donation ? { visible: true, text: `${donation.nickname}  ${formatLucci(donation.amount)}` } : { visible: false };
    }
    if (name === "stockName" || name === "item" || name === "received" || name === "closed")
      return this.welfareSlot(node, name);
    return {};
  }

  /** Slot contents: which slot a node belongs to is read from its parent's name in the tree. */
  private welfareSlot(node: Node, name: string): NodeState {
    const slot = this.slotOf.get(node);
    const rules = this.rules;
    const house = this.house;
    if (slot === undefined || !rules || !house) return {};
    const welfare = rules.welfares.find(entry => entry.slot === slot);
    const open = !!welfare && house.club.facilities[1]! >= welfare.level;
    switch (name) {
      case "stockName": return { text: welfare?.name ?? "活动道具（暂无）" };
      case "item": return { visible: false };
      case "received": return { visible: open && house.welfareToday.includes(slot) };
      case "closed": return { visible: !open };
    }
    return {};
  }

  private readonly slotOf = new WeakMap<Node, number>();

  private selectFacility(index: number): void {
    this.facility = index;
    this.render();
  }

  private async upgrade(): Promise<void> {
    const house = this.house;
    const rules = this.rules;
    if (!house || !rules) return;
    const facility = this.facility;
    const names = ["俱乐部总部", "赛事中心", "车手中心", "俱乐部银行"];
    const next = house.club.facilities[facility]! + 1;
    const cost = rules.upgrades.find(entry => entry.level === next);
    if (!cost) return;
    const effect = facility === 0 ? `可以使用Lv${next}俱乐部徽章。`
      : facility === 1 ? `Lv${next} 赛事中心将会添加福利道具。`
        : facility === 2 ? `会员人数上限增加到${rules.memberCaps[next - 1]}人。`
          : `俱乐部预算上限增加到${formatLucci(rules.budgetCaps[next - 1] ?? 0)}金币。`;
    if (!await this.ask(`${names[facility]} 升级|LV${next} 升级费用：活跃度 ${cost.cs}，预算 ${formatLucci(cost.lucci)}金币|* ${effect}|确认要进行升级吗？`))
      return;
    const updated = await this.run(() => this.options.api.upgrade(facility));
    if (!updated) return;
    this.house = updated;
    this.render();
    void this.notice(`升级至LV ${next} ${names[facility]}！`);
  }

  private async rename(): Promise<void> {
    const house = this.house;
    if (!house || !this.rules) return;
    const name = await this.prompt("俱乐部名称变更", house.club.name, this.rules.nameMax,
      `变更时消耗俱乐部预算 ${formatLucci(this.rules.nameChangeLucci)}金币。最少2字，最多10字。`);
    if (name === undefined) return;
    const updated = await this.run(() => this.options.api.rename(name));
    if (!updated) return;
    this.house = updated;
    this.render();
    void this.notice("俱乐部名称已变更。");
  }

  private async changeMark(): Promise<void> {
    const house = this.house;
    const rules = this.rules;
    if (!house || !rules) return;
    const marks = rules.marks.filter(mark => mark.level > 0 && mark.level <= house.club.level)
      .sort((a, b) => b.level - a.level || b.order - a.order);
    const frames = rules.frames.filter(frame => frame.level > 0 && frame.level <= house.club.level);
    let mark = house.club.mark;
    let frame = house.club.frame;
    let page = 0;
    const perPage = 24;
    const definition: Node = { name: "Panel", attributes: [{ name: "windowRect", value: "fullscreen" },
      { name: "color", value: "200 0 0 0" }, { name: "alphaBlend", value: "true" }], children: [{
      name: "CaptionWindow", attributes: [{ name: "leftTopWH", value: "0 0 900 640" }, { name: "frame", value: "CaptionDialog" },
        { name: "align", value: "center" }, { name: "caption", value: "俱乐部徽章变更" }, { name: "setCloseButton", value: "cancel" }],
      children: [
        { name: "Window", attributes: [{ name: "name", value: "markGrid" }, { name: "leftTopWH", value: "20 20 600 500" }], children: [] },
        { name: "Window", attributes: [{ name: "name", value: "preview" }, { name: "leftTopWH", value: "660 40 200 200" }], children: [] },
        { name: "TextButton", attributes: [{ name: "name", value: "frameNext" }, { name: "leftTopWH", value: "690 260 140 40" },
          { name: "text", value: "切换标志框" }, { name: "textRender", value: "bold16" }], children: [] },
        { name: "Label", attributes: [{ name: "name", value: "info" }, { name: "leftTopWH", value: "640 320 240 120" }], children: [] },
        { name: "TextButton", attributes: [{ name: "name", value: "prevPage" }, { name: "leftTopWH", value: "20 530 140 36" },
          { name: "text", value: "上一页" }, { name: "textRender", value: "bold16" }], children: [] },
        { name: "Label", attributes: [{ name: "name", value: "page" }, { name: "leftTopWH", value: "240 530 140 36" },
          { name: "textAlign", value: "center" }, { name: "textRender", value: "bold16" },
          { name: "textColor", value: "255 42 55 80" }], children: [] },
        { name: "TextButton", attributes: [{ name: "name", value: "nextPage" }, { name: "leftTopWH", value: "480 530 140 36" },
          { name: "text", value: "下一页" }, { name: "textRender", value: "bold16" }], children: [] },
        { name: "TextButton", attributes: [{ name: "name", value: "ok" }, { name: "leftTopWH", value: "640 560 110 40" },
          { name: "text", value: "变更" }, { name: "textRender", value: "bold16" }], children: [] },
        { name: "TextButton", attributes: [{ name: "name", value: "cancel" }, { name: "leftTopWH", value: "760 560 110 40" },
          { name: "text", value: "取消" }, { name: "textRender", value: "bold16" }], children: [] },
      ],
    }] };
    const grid = definition.children[0]!.children[0]!;
    for (let index = 0; index < perPage; index++) {
      const x = (index % 6) * 100;
      const y = Math.floor(index / 6) * 125;
      grid.children.push({ name: "Window", attributes: [{ name: "name", value: `markSlot_${index}` },
        { name: "leftTopWH", value: `${x} ${y} 96 120` }], children: [] });
    }
    const pages = Math.max(1, Math.ceil(marks.length / perPage));
    await this.openDialog(definition, ["stage_/common", "stage_/clubHouse"], "俱乐部徽章变更", node => {
      const name = nodeName(node);
      const slot = /^markSlot_(\d+)$/.exec(name);
      if (slot) {
        const entry = marks[page * perPage + Number(slot[1])];
        if (!entry) return { visible: false };
        return { label: `徽章 ${entry.id}`, action: () => { mark = entry.id; this.render(); },
          paint: (context: CanvasRenderingContext2D, rect: Rect) => {
            context.save();
            context.fillStyle = mark === entry.id ? "rgba(36,129,255,.25)" : "rgba(42,55,80,.08)";
            context.fillRect(rect.x, rect.y, rect.width, rect.height);
            context.restore();
            this.paintMark(entry.id, frame).paint(context, { x: rect.x + 13, y: rect.y + 6, width: 70, height: 70 });
            paintText(`Lv${entry.level}`, { size: 14, align: "center" }).paint(context,
              { x: rect.x, y: rect.y + 90, width: rect.width, height: 20 });
          } };
      }
      switch (name) {
        case "preview": return this.paintMark(mark, frame);
        case "frameNext": return { label: "切换标志框", action: () => {
          const index = frames.findIndex(entry => entry.id === frame);
          frame = frames[(index + 1) % Math.max(1, frames.length)]?.id ?? frame;
          this.render();
        } };
        case "info": return paintText(`变更时消耗俱乐部预算 ${formatLucci(rules.markChangeLucci)}金币。|当前预算 ${formatLucci(house.club.budget)}金币。`,
          { size: 14 });
        case "page": return { text: `${page + 1} / ${pages}` };
        case "prevPage": return page > 0 ? { action: () => { page--; this.render(); } } : { disabled: true };
        case "nextPage": return page + 1 < pages ? { action: () => { page++; this.render(); } } : { disabled: true };
        case "ok": return { label: "变更", action: () => void (async () => {
          const updated = await this.run(() => this.options.api.changeMark(mark, frame));
          if (!updated) return;
          this.house = updated;
          this.closeDialog();
          this.render();
          void this.notice("俱乐部徽章已变更。");
        })() };
        case "cancel": return { label: "取消", action: () => this.closeDialog() };
      }
      return {};
    });
  }

  private async donate(): Promise<void> {
    const amount = this.rules?.donations[this.donation];
    if (!amount) return;
    if (!await this.ask(`确认要向俱乐部捐助${formatLucci(amount)}金币吗？`)) return;
    const updated = await this.run(() => this.options.api.donate(amount));
    if (!updated) return;
    this.house = updated;
    this.render();
    void this.notice(`已向俱乐部捐助${formatLucci(amount)}金币。`);
  }

  private async claimWelfare(slot: number): Promise<void> {
    const result = await this.run(() => this.options.api.welfare(slot));
    if (!result) return;
    this.house = result.house;
    this.render();
    void this.notice(`已获得[${result.welfare.name}]。`);
  }

}
