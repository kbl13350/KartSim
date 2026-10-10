import { te } from "../generated/library.js";
import { errorCode } from "../account/account-api";
import type { ChatJoined, ChatLine, MessengerConnection } from "../messenger/messenger-connection";
import { guardMessengerDialog } from "../messenger/messenger-runtime";
import { clipToStage, FONT, loadBml, loadStrings, mapTree, node, nodeName, prepare, resolveStrings, withAttributes,
  wrapText, type BmlLibrary, type Node, type NodeState, type Rect, type WindowView } from "../ui/bml-kit";

/**
 * 聊天系统 (stage_globalChatSystem GCFrameInnerClient@zz, the CN client's
 * 俱乐部聊天 window): over the lobby's bottom right, its title bar holding
 * the two tabs of the release tabbed layout, 全部聊天 (every rider) and
 * 俱乐部聊天 (the rider's club), sent through the messenger socket
 * (server-go MENUS.md 4). Lines are at most 30 characters; flooding mutes
 * for 10 s. The window never blocks the page under it.
 */

const FOLDER = "stage_/globalChatSystem";
const ROOTS = [FOLDER, "stage_/common"];
/** chatWindowIn of the CN client (450×277, align right;bottom, adjust 0 70). */
const WINDOW = { x: 1600 - 450, y: 900 - 70 - 277, width: 450, height: 277 };
const KEEP = 100;
const LINE_HEIGHT = 18;
const MAX_CHARS = 30;

type Channel = "all" | "club";

interface Shown { text: string; from?: string; system?: boolean; mine?: boolean }

export interface GlobalChatOptions {
  library: BmlLibrary;
  root: HTMLElement;
  /** The signed-in rider's messenger socket, if any. */
  connection(): MessengerConnection | undefined;
  nickname(): string | undefined;
  onActivate?(): void;
  onClose?(): void;
}

export class GlobalChat {
  private view?: WindowView;
  private loading?: Promise<WindowView | undefined>;
  private strings = new Map<string, string>();
  private tab: Channel = "all";
  private draft = "";
  private readonly lines: Record<Channel, Shown[]> = { all: [], club: [] };
  private readonly seen = new Set<number>();
  private readonly scroll: Record<Channel, number> = { all: 0, club: 0 };
  private clubName = "";
  private hasClub = false;
  private connection?: MessengerConnection;
  private visible = false;
  private suspended = false;
  private disposed = false;
  private releaseKeys?: () => void;
  private historyRect?: Rect;

  constructor(readonly options: GlobalChatOptions) {}

  get open(): boolean {
    return this.visible;
  }

  async toggle(): Promise<void> {
    if (this.visible) this.hide();
    else await this.show();
  }

  async show(): Promise<void> {
    if (this.disposed) return;
    this.attach();
    const view = this.view ?? await (this.loading ??= this.load());
    if (!view || this.disposed) return;
    this.visible = true;
    view.element.hidden = this.suspended;
    if (!view.element.isConnected) view.show();
    else view.render();
    this.styleInput();
    if (!this.suspended) view.focus("input");
  }

  hide(): void {
    this.visible = false;
    if (this.view) this.view.element.hidden = true;
    this.options.onClose?.();
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (this.view) this.view.element.hidden = suspended || !this.visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.connection?.setChatListener(undefined);
    this.connection = undefined;
    this.releaseKeys?.();
    this.view?.dispose();
  }

  /** Join the channels on the current messenger socket (a new login brings a new one). */
  private attach(): void {
    const connection = this.options.connection();
    if (connection === this.connection) return;
    this.connection?.setChatListener(undefined);
    this.connection = connection;
    this.lines.all = [];
    this.lines.club = [];
    this.seen.clear();
    connection?.setChatListener({
      joined: state => this.joined(state),
      line: line => this.receive(line),
      connection: open => {
        if (!open) this.system(this.strings.get("chat_disconnectFromChatServer") ?? "断开聊天链接。");
        this.view?.render();
      },
    });
    if (!connection) this.system(this.strings.get("chat_notInSession") ?? "未连接聊天频道。");
  }

  private joined(state: ChatJoined): void {
    this.clubName = state.clubName;
    this.hasClub = state.hasClub;
    // The connection line first, then the channel's recent lines.
    this.system(this.strings.get("chat_chatServerConnect") ?? "已连接至聊天", "all");
    this.system(state.hasClub ? `已连接至“${state.clubName}”俱乐部聊天`
      : this.strings.get("chat_notFoundClub") ?? "没有可连接的聊天", "club");
    for (const line of [...state.all, ...state.club]) this.receive(line, false);
    this.view?.render();
  }

  private receive(line: ChatLine, render = true): void {
    if (this.seen.has(line.id)) return;
    this.seen.add(line.id);
    const list = this.lines[line.channel];
    list.push({ from: line.from, text: line.text, mine: line.from === this.options.nickname() });
    if (list.length > KEEP) list.splice(0, list.length - KEEP);
    if (render) this.view?.render();
  }

  private system(text: string, channel: Channel | "both" = "both"): void {
    for (const target of channel === "both" ? ["all", "club"] as const : [channel]) {
      this.lines[target].push({ text, system: true });
      if (this.lines[target].length > KEEP) this.lines[target].shift();
    }
    this.view?.render();
  }

  private async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text) return;
    const connection = this.connection;
    if (!connection?.open) {
      this.system(this.strings.get("chat_notInSession") ?? "未连接聊天频道。", this.tab);
      return;
    }
    if (this.tab === "club" && !this.hasClub) {
      this.system(this.strings.get("chat_notFoundClub") ?? "没有可连接的聊天", "club");
      return;
    }
    this.draft = "";
    this.scroll[this.tab] = 0;
    this.view?.render();
    try {
      this.receive(await connection.sendChat(this.tab, [...text].slice(0, MAX_CHARS).join("")));
    } catch (error) {
      const code = errorCode(error);
      this.system(code === "CHAT_FLOOD" ? this.strings.get("chat_warn10secBlock") ?? "为防止刷屏，聊天禁止10秒。"
        : code === "NOT_IN_CLUB" ? this.strings.get("chat_notFoundClub") ?? "没有可连接的聊天"
          : code === "INVALID_CHAT" ? this.strings.get("chat_inputChatMsg") ?? "请输入内容"
            : this.strings.get("chat_notInSession") ?? "未连接聊天频道。", this.tab);
    }
  }

  private async load(): Promise<WindowView | undefined> {
    const { library } = this.options;
    const [raw, strings] = await Promise.all([loadBml(library, FOLDER, "GCFrameInnerClient@zz"),
      loadStrings(library, FOLDER, "stringBag")]);
    this.strings = strings;
    const adapted = mapTree(resolveStrings(raw, strings), entry => {
      switch (nodeName(entry)) {
        // The title bar's 俱乐部聊天 label becomes the two tabs.
        case "caption": return { ...entry, children: entry.children.flatMap(child => nodeName(child) !== "title"
          ? [child] : [
            node("TextButton", { name: "tabAll", leftTopWH: "18 0 84 20", frame: "NoFrame" }),
            node("TextButton", { name: "tabClub", leftTopWH: "106 0 96 20", frame: "NoFrame" }),
          ]) };
        // The release list (x 30 past the frame's client edge) ends 30 short of its width.
        case "guildChatHistory": return withAttributes(entry, { leftTopWH: "30 0 400 200" });
        // ChatInGameBox is a faint frame made for the race screen: a dark wash keeps it readable on the lobby.
        case "chatInGame": return withAttributes(entry, { color: "120 0 0 0", alphaBlend: "true" });
        case "input": return withAttributes(entry, { windowSize: "340 23" });
        case "chatWindowIn": return withAttributes(entry, { windowSize: undefined, align: undefined, adjust: undefined,
          leftTopWH: `${WINDOW.x} ${WINDOW.y} ${WINDOW.width} ${WINDOW.height}` });
        case "mainview":
        case "emoticon": return withAttributes(entry, { visible: "false" });
      }
      return undefined;
    });
    const definition = prepare(library, node("Container", { windowRect: "fullscreen" }, [adapted]), ROOTS);
    const view = await te.load({
      library, root: this.options.root, definition, roots: ROOTS, smoothImages: true, modal: false,
      label: strings.get("chat_inGame") ?? "聊天", onCancel: () => this.hide(), state: (entry: Node) => this.state(entry),
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return undefined;
    }
    view.element.dataset.uiLayer = "dialog";
    clipToStage(view.element, [{ x: WINDOW.x - 2, y: WINDOW.y - 2, width: WINDOW.width + 2, height: WINDOW.height + 4 }]);
    view.element.addEventListener("wheel", event => this.wheel(event), { passive: false });
    this.releaseKeys = guardMessengerDialog({ element: view.element, handle: event => this.key(event) });
    this.view = view;
    if (!this.lines.all.length && !this.connection) this.system(strings.get("chat_notInSession") ?? "未连接聊天频道。");
    return view;
  }

  /** The window's keys never reach the game's hotkeys; Enter sends, Esc hides. */
  private key(event: KeyboardEvent): void {
    if (event.type !== "keydown" || event.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.hide();
    } else if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void this.send();
    } else if (event.key === "Tab") {
      event.preventDefault();
      this.switchTab(this.tab === "all" ? "club" : "all");
    }
  }

  private wheel(event: WheelEvent): void {
    const rect = this.historyRect;
    if (!rect) return;
    event.preventDefault();
    const steps = Math.sign(event.deltaY) * Math.max(1, Math.round(Math.abs(event.deltaY) / 60));
    this.scroll[this.tab] = Math.max(0, this.scroll[this.tab] - steps);
    this.view?.render();
  }

  private styleInput(): void {
    const input = this.view?.element.querySelector("input");
    if (!input) return;
    Object.assign(input.style, { color: "white", caretColor: "white", font: `bold 14px ${FONT}`, outline: "none" });
    input.placeholder = this.strings.get("chat_defaultInput") ?? "请输入聊天内容";
  }

  private switchTab(tab: Channel): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.options.onActivate?.();
    this.view?.render();
    this.view?.focus("input");
  }

  private state(entry: Node): NodeState {
    switch (nodeName(entry)) {
      case "tabAll": return this.tabState("all", this.strings.get("allChat") ?? "全部聊天");
      case "tabClub": return this.tabState("club", this.strings.get("clubChat") ?? "俱乐部聊天");
      case "help": return { label: this.strings.get("chat_help") ?? "帮助", action: () => {
        this.system("按 Enter 发送，Tab 切换全部聊天 / 俱乐部聊天，每条最多30字。刷屏将被禁言10秒。", this.tab);
      } };
      case "close": return { label: this.strings.get("chat_chatHide") ?? "隐藏", action: () => this.hide() };
      case "guildChatHistory": return this.history(this.tab);
      case "input": return { label: this.strings.get("chat_defaultInput") ?? "请输入聊天内容", input: {
        value: this.draft, maxLength: MAX_CHARS, change: (value: string) => { this.draft = value; },
        submit: () => void this.send() } };
      case "clearList": return { label: this.strings.get("chat_erase") ?? "删除聊天记录", action: () => {
        this.lines[this.tab] = [];
        this.scroll[this.tab] = 0;
        this.view?.render();
      } };
    }
    return {};
  }

  private tabState(tab: Channel, caption: string): NodeState {
    const current = this.tab === tab;
    return { label: caption, text: "", action: () => this.switchTab(tab),
      paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        context.save();
        context.font = `bold 14px ${FONT}`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = current ? "white" : "rgb(150,160,180)";
        context.fillText(caption, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
        if (current) {
          context.fillStyle = "rgb(170,210,255)";
          context.fillRect(rect.x + 8, rect.y + rect.height - 2, rect.width - 16, 2);
        }
        context.restore();
      } };
  }

  private history(channel: Channel): NodeState {
    return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
      const area = { x: rect.x + 6, y: rect.y + 4, width: rect.width - 22, height: rect.height - 8 };
      this.historyRect = area;
      context.save();
      context.beginPath();
      context.rect(area.x, area.y, area.width, area.height);
      context.clip();
      context.font = `13px ${FONT}`;
      context.textBaseline = "top";
      // Each line wrapped; the newest at the bottom, scrolled back by whole rows.
      const rows: Array<{ parts: Array<{ text: string; color: string }> }> = [];
      for (const line of this.lines[channel]) {
        const prefix = line.system ? "" : `${line.from}：`;
        const color = line.system ? "rgb(255,214,102)" : line.mine ? "rgb(255,236,150)" : "white";
        const wrapped = wrapText(context, prefix + line.text, area.width);
        wrapped.forEach((text, index) => {
          if (index === 0 && prefix && text.startsWith(prefix)) {
            rows.push({ parts: [{ text: prefix, color: line.mine ? "rgb(255,200,90)" : "rgb(120,200,255)" },
              { text: text.slice(prefix.length), color }] });
          } else rows.push({ parts: [{ text, color }] });
        });
      }
      const fit = Math.max(1, Math.floor(area.height / LINE_HEIGHT));
      const maxScroll = Math.max(0, rows.length - fit);
      this.scroll[channel] = Math.min(this.scroll[channel], maxScroll);
      const end = rows.length - this.scroll[channel];
      const visible = rows.slice(Math.max(0, end - fit), end);
      const top = area.y + area.height - visible.length * LINE_HEIGHT;
      visible.forEach((row, index) => {
        let x = area.x;
        for (const part of row.parts) {
          context.lineWidth = 3;
          context.strokeStyle = "rgba(0,0,0,.6)";
          context.strokeText(part.text, x, top + index * LINE_HEIGHT);
          context.fillStyle = part.color;
          context.fillText(part.text, x, top + index * LINE_HEIGHT);
          x += context.measureText(part.text).width;
        }
      });
      context.restore();
      if (maxScroll > 0) {
        // A thin bar where the shown rows sit in the history.
        const barHeight = Math.max(12, area.height * fit / rows.length);
        const offset = (area.height - barHeight) * (1 - this.scroll[channel] / maxScroll);
        context.fillStyle = "rgba(170,210,255,.45)";
        context.fillRect(area.x + area.width + 6, area.y + offset, 4, barHeight);
      }
    } };
  }
}
