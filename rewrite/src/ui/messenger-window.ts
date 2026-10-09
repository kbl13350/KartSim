/**
 * 好友聊天系统: the release stage_messengerSystem window (messenger@zz),
 * docked above the taskbar's tray like the original, with its 好友 page
 * (friend list, 邮箱 and 管理) and 对话 page (room slots, the selected room's
 * log and chatInput), the right-click quick menus, the status drop box and
 * the unread chain (tab, mailbox and room alerts). Built from the original
 * layouts and art (messenger-art / messenger-dom); the data comes from the
 * signed-in account's messenger service (messenger/messenger-runtime).
 */
import { errorCode } from "../account/account-api";
import type { Friend, OutgoingRequest, Presence } from "../messenger/messenger-api";
import { newClientId } from "../messenger/messenger-connection";
import {
  currentMessenger, onMessengerChange, setMessengerKeyTarget, setMessengerViewer, type MessengerService,
} from "../messenger/messenger-runtime";
import type { ChatLine, ChatRoom } from "../messenger/messenger-store";
import { loadLevelGloveArt, type TopBarArtLibrary } from "./lobby-top-bar-assets";
import {
  attr, BmlLayout, chatRuns, findNode, formatString, loadMessengerArt, loadMessengerEmoticons,
  withAttributes, type BmlNode, type MessengerArt, type MessengerEmoticons, type MessengerLibrary, type Rect,
} from "./messenger-art";
import { openAddFriendDialog, openMessengerMessage } from "./messenger-dialogs";
import {
  BmlDom, editInput, element, part, place, RowTemplate, setImageSeries, setText, setTexture,
} from "./messenger-dom";
import { MESSENGER_STYLES } from "./messenger-styles";

export interface MessengerWindowOptions {
  library: MessengerLibrary & TopBarArtLibrary;
  root: HTMLElement;
  onHover?(): void;
  onActivate?(): void;
}

type MainTab = "friendPage" | "chatPage";
type FriendTab = "friendListPage" | "mailBoxPage" | "settingPage";
type MailTab = "receivePage" | "sendPage";
type SettingTab = "normalSettingPage" | "blockSettingPage";
type GroupKey = "favorite" | "online" | "offline";

interface Row {
  key: string;
  create(): HTMLElement;
  update(row: HTMLElement): void;
}

const DAY_MS = 86_400_000;
const ROW_FRIEND = 34;
const SLOT_PITCH = 40;

const PRESENCE_IMAGE: Record<Presence, string> = {
  online: "msg_condition_online", inGame: "msg_condition_ingame", offline: "msg_condition_offline",
};

/** Release strings for the data service's error codes. */
function errorText(art: MessengerArt, error: unknown): string {
  const s = (key: string, fallback: string) => art.strings.get(key) ?? fallback;
  switch (errorCode(error)) {
    case "PLAYER_NOT_FOUND": return "无法找到该车手。";
    case "FRIEND_REQUESTS_BLOCKED": return s("blockRequsetUser", "对方车手已关闭好友请求功能。");
    case "FRIEND_LIMIT":
    case "TARGET_FRIEND_LIMIT": return s("userHaveMaxFriend", "对方或我的好友数量已达上限，无法添加好友。");
    case "ALREADY_FRIENDS":
    case "REQUEST_PENDING": return s("alreadyFriend", "已发送好友申请或已经是好友了。");
    case "REQUEST_LIMIT": return s("overMaxRequestNum", "已超过请求好友数量上限，无法再发送好友请求。");
    case "REQUEST_COOLDOWN": return "对方已拒绝好友请求，|到次日上午6点前无法再次申请。";
    case "CANNOT_ADD_SELF": return "不能将自己添加为好友。";
    case "CANNOT_BLOCK_SELF": return "不能屏蔽自己。";
    case "BLOCKED_TARGET": return "已屏蔽该车手。|请先在管理 → 屏蔽管理中解除屏蔽。";
    case "BLOCK_LIMIT": return "屏蔽人数已达上限。";
    case "REQUEST_NOT_FOUND":
    case "FRIEND_NOT_FOUND":
    case "BLOCK_NOT_FOUND": return s("informExpireMsg3", "该请求已过期或无法处理，将删除此信息");
    case "NOT_FRIENDS": return s("nobodyChat2", "没有可进行对话的对象。");
    case "CHAT_FLOOD": return s("chat_warn10secBlock", "为防止刷屏，聊天禁止10秒。");
    case "TOO_MANY_ATTEMPTS":
    case "RATE_LIMITED": return "操作过于频繁，请稍后再试。";
    case "DATA_SERVICE_UNAVAILABLE":
    case "MESSENGER_OFFLINE": return "无法连接数据服务，请稍后重试。";
    default: return s("normalError", "发生错误。|请重试。");
  }
}

function daysLeft(until: number, now: number): number {
  return Math.max(1, Math.ceil((until - now) / DAY_MS));
}

function byNickname(a: { nickname: string }, b: { nickname: string }): number {
  return a.nickname.localeCompare(b.nickname, "zh-Hans-CN");
}

/** Keeps a list's rows by key, so hover and focus survive updates. */
function reconcile(container: HTMLElement, rows: readonly Row[]): void {
  const existing = new Map<string, HTMLElement>();
  for (const child of [...container.children] as HTMLElement[])
    if (child.dataset.rowKey) existing.set(child.dataset.rowKey, child);
  const next = rows.map(row => {
    let target = existing.get(row.key);
    if (!target) {
      target = row.create();
      target.dataset.rowKey = row.key;
    }
    existing.delete(row.key);
    row.update(target);
    return target;
  });
  const extras = [...container.children].filter(child => !(child as HTMLElement).dataset.rowKey);
  const current = [...container.children].filter(child => (child as HTMLElement).dataset.rowKey);
  if (current.length !== next.length || current.some((child, index) => child !== next[index]))
    container.replaceChildren(...extras, ...next);
}

/** A GridSelector made a scrolling list, with its original ScrollBar beside it. */
class ScrollList {
  readonly thumb: HTMLElement;
  private drag?: { pointer: number; startY: number; startTop: number };

  constructor(readonly art: MessengerArt, readonly list: HTMLElement, readonly bar: HTMLElement | undefined,
    private readonly buttonFrame = "MixVerticalScrollButton", areaFrame = "MixVerticalScrollArea",
    private readonly minThumb = 50) {
    list.classList.add("ks-m-list");
    this.thumb = element("div", "ks-m-thumb");
    if (bar) {
      bar.classList.add("ks-m-scroll");
      const url = art.frameUrl(areaFrame, 0, bar.offsetWidth || parseFloat(bar.style.width),
        parseFloat(bar.style.height));
      if (url) bar.style.setProperty("--f0", `url("${url}")`);
      bar.append(this.thumb);
      this.thumb.addEventListener("pointerdown", event => this.startDrag(event));
      this.thumb.addEventListener("pointermove", event => this.moveDrag(event));
      this.thumb.addEventListener("pointerup", event => this.endDrag(event));
      this.thumb.addEventListener("pointercancel", event => this.endDrag(event));
      bar.addEventListener("pointerdown", event => {
        if (event.target !== bar) return;
        const rect = bar.getBoundingClientRect();
        const thumbRect = this.thumb.getBoundingClientRect();
        list.scrollTop += (event.clientY < thumbRect.top ? -1 : 1) * list.clientHeight * (rect.height ? 1 : 0);
      });
    }
    list.addEventListener("scroll", () => this.sync());
  }

  private get trackHeight(): number {
    return this.bar ? parseFloat(this.bar.style.height) : 0;
  }

  sync(): void {
    if (!this.bar) return;
    const content = this.list.scrollHeight, view = this.list.clientHeight;
    const track = this.trackHeight;
    if (content <= view + 1 || track <= 0) {
      this.thumb.hidden = true;
      return;
    }
    this.thumb.hidden = false;
    const height = Math.round(Math.min(track, Math.max(this.minThumb, track * view / content)));
    const top = Math.round((track - height) * this.list.scrollTop / Math.max(1, content - view));
    this.thumb.style.top = `${top}px`;
    this.thumb.style.height = `${height}px`;
    const width = parseFloat(this.bar.style.width);
    for (const state of [0, 1]) {
      const url = this.art.frameUrl(this.buttonFrame, state, width, height);
      if (url) this.thumb.style.setProperty(`--t${state}`, `url("${url}")`);
    }
  }

  private scale(): number {
    const rect = this.bar!.getBoundingClientRect();
    return rect.height / Math.max(1, this.trackHeight);
  }

  private startDrag(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.thumb.setPointerCapture(event.pointerId);
    this.drag = { pointer: event.pointerId, startY: event.clientY, startTop: parseFloat(this.thumb.style.top) || 0 };
    this.thumb.dataset.drag = "true";
  }

  private moveDrag(event: PointerEvent): void {
    if (!this.drag || this.drag.pointer !== event.pointerId) return;
    const track = this.trackHeight, height = parseFloat(this.thumb.style.height) || 0;
    const top = Math.min(track - height, Math.max(0, this.drag.startTop + (event.clientY - this.drag.startY) / this.scale()));
    const content = this.list.scrollHeight, view = this.list.clientHeight;
    this.list.scrollTop = (content - view) * top / Math.max(1, track - height);
  }

  private endDrag(event: PointerEvent): void {
    if (!this.drag || this.drag.pointer !== event.pointerId) return;
    this.drag = undefined;
    delete this.thumb.dataset.drag;
  }
}

interface Templates {
  subtitle: RowTemplate;
  subtitleOpen: RowTemplate;
  friend: RowTemplate;
  receive: RowTemplate;
  send: RowTemplate;
  optTitle0: RowTemplate;
  optTitle1: RowTemplate;
  optTitle2: RowTemplate;
  optSubtitle: RowTemplate;
  optSubtitleOpen: RowTemplate;
  normalOpt: RowTemplate;
  blockOpt: RowTemplate;
  chatRoom: RowTemplate;
  inviteSubtitleOpen: RowTemplate;
  invite: RowTemplate;
}

function buildTemplates(art: MessengerArt): Templates {
  const sizes = (node: BmlNode) => {
    const name = attr(node, "texture") ?? attr(node, "image");
    const image = name ? art.images.get(name) : undefined;
    return image && { width: image.width, height: image.height };
  };
  const from = (root: BmlNode, name: string) => {
    const layout = new BmlLayout(root, art.frames, sizes);
    return new RowTemplate(art, layout, findNode(root, name));
  };
  const { friend, receiveSend, setting, chatRoom, chatInvite } = art.layouts;
  // chatHistory is the window's own log; the slot keeps its panels.
  const slot = withAttributes(chatRoom, {}, chatRoom.children.filter(child => attr(child, "name") !== "chatHistory"));
  return {
    subtitle: from(friend, "friendSubtitle"),
    subtitleOpen: from(friend, "friendSubtitleOpen"),
    friend: from(friend, "friendComponent"),
    receive: from(receiveSend, "friendReceiveComponent"),
    send: from(receiveSend, "friendSendComponent"),
    optTitle0: from(setting, "optTitle0"),
    optTitle1: from(setting, "optTitle1"),
    optTitle2: from(setting, "optTitle2"),
    optSubtitle: from(setting, "optSubtitle"),
    optSubtitleOpen: from(setting, "optSubtitleOpen"),
    normalOpt: from(setting, "normalOptCompoenet"),
    blockOpt: from(setting, "blockOptComponent"),
    chatRoom: new RowTemplate(art, new BmlLayout(slot, art.frames, sizes), slot),
    inviteSubtitleOpen: from(chatInvite, "chatInviteSubtitleOpen"),
    invite: from(chatInvite, "chatInviteComponent"),
  };
}

export class MessengerWindow {
  readonly layer: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly layout: BmlLayout;
  private readonly dom: BmlDom;
  private readonly win: HTMLElement;
  private readonly windowRect: Rect;
  private readonly templates: Templates;
  private readonly lists: Record<string, ScrollList> = {};
  private readonly chatLog: HTMLElement;
  private readonly tooltip: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private service?: MessengerService;
  private unsubscribe?: () => void;
  private readonly releaseService: () => void;
  private readonly gloves = new Map<string, string | undefined>();
  private emoticons?: MessengerEmoticons;
  private emoticonPanel?: HTMLElement;
  private visibleValue = false;
  private suspended = false;
  private disposed = false;
  private renderQueued = false;

  private mainTab: MainTab = "friendPage";
  private friendTab: FriendTab = "friendListPage";
  private mailTab: MailTab = "receivePage";
  private settingTab: SettingTab = "normalSettingPage";
  private readonly collapsed = new Set<string>();
  private search = "";
  private dockLeft = false;
  private menu?: HTMLElement;
  private inviteSelection?: string;
  private readonly readSent = new Map<string, number>();
  private readonly greeted = new Set<string>();
  private focusedInput?: HTMLInputElement;
  private busy = 0;

  static async load(options: MessengerWindowOptions): Promise<MessengerWindow> {
    const [art, emoticons] = await Promise.all([
      loadMessengerArt(options.library), loadMessengerEmoticons(options.library),
    ]);
    return new MessengerWindow(options, art, emoticons);
  }

  constructor(readonly options: MessengerWindowOptions, readonly art: MessengerArt,
    emoticons?: MessengerEmoticons) {
    this.emoticons = emoticons;
    const sizes = (node: BmlNode) => {
      const name = attr(node, "texture") ?? attr(node, "image");
      const image = name ? art.images.get(name) : undefined;
      return image && { width: image.width, height: image.height };
    };
    this.layout = new BmlLayout(art.layouts.window, art.frames, sizes);
    this.dom = new BmlDom(art, this.layout, art.layouts.window);
    this.templates = buildTemplates(art);

    this.layer = element("div", "ks-msgr");
    this.layer.dataset.uiLayer = "dialog";
    this.layer.dataset.art = "true";
    this.layer.setAttribute("role", "dialog");
    this.layer.setAttribute("aria-label", art.strings.get("messenger") ?? "好友聊天系统");
    if (art.font) this.layer.style.setProperty("--ks-msgr-font",
      `"${art.font}","Source Han Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif`);
    const style = element("style");
    style.textContent = MESSENGER_STYLES;
    this.stage = element("div", "ks-msgr-stage");
    this.layer.append(style, this.stage);
    this.layer.hidden = true;

    this.win = this.dom.element;
    this.win.classList.add("ks-msgr-window");
    this.windowRect = this.layout.rect(art.layouts.window);
    place(this.win, this.windowRect);
    this.stage.append(this.win);
    // mainBlock (406×670 behind everything) keeps clicks off the lobby under the window.
    const block = this.dom.named("mainBlock");
    this.win.prepend(block);
    this.dom.named("mainview").hidden = true;
    this.dom.named("tooltip").hidden = true;
    this.dom.named("addFriend2Chat").hidden = true;

    this.tooltip = element("div", "ks-m-tooltip");
    this.tooltip.hidden = true;
    this.win.append(this.tooltip);

    // Lists.
    const list = (name: string, bar?: string) => {
      const scroll = new ScrollList(art, this.dom.named(name), bar ? this.dom.named(bar) : undefined);
      this.lists[name] = scroll;
      return scroll;
    };
    list("friendList", "friendScrollBar");
    list("receiveList", "receiveScrollBar");
    list("sendList", "sendScrollBar");
    list("normalOptList", "normalOptScrollBar");
    list("blockOptList", "blockOptScrollBar");
    list("addInviteList", "addInviteListScrollBar");
    const chatList = this.dom.named("chatList");
    chatList.style.height = `${SLOT_PITCH * 10}px`;
    chatList.style.width = "96px";
    // chatHistory: the selected room's log, at the first slot's List (98,3 307×468).
    const chatListRect = this.layout.relative(findNode(art.layouts.window, "chatList"),
      findNode(art.layouts.window, "existChat"));
    this.chatLog = element("div", "ks-m ks-m-chatlog");
    place(this.chatLog, { x: chatListRect.x + 98, y: chatListRect.y + 3, width: 307, height: 468 });
    this.dom.named("existChat").append(this.chatLog);
    new ScrollList(art, this.chatLog, undefined);

    this.wire();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.root);
    options.root.append(this.layer);
    this.resize();

    this.releaseService = onMessengerChange(() => this.bind());
    this.bind();
  }

  get visible(): boolean { return this.visibleValue; }

  private bind(): void {
    const service = currentMessenger();
    if (service === this.service) return;
    this.unsubscribe?.();
    this.service = service;
    this.unsubscribe = service?.store.subscribe(() => this.queueRender());
    this.readSent.clear();
    this.greeted.clear();
    this.queueRender();
  }

  private resize(): void {
    const rect = this.options.root.getBoundingClientRect();
    this.layer.style.setProperty("--ks-msgr-sx", String(rect.width / 1600 || 1));
    this.layer.style.setProperty("--ks-msgr-sy", String(rect.height / 900 || 1));
  }

  // --- Visibility -----------------------------------------------------------

  show(): void {
    if (this.disposed) return;
    this.visibleValue = true;
    // Above dialogs opened since (the release messenger is topmost).
    this.options.root.append(this.layer);
    this.applyVisibility();
    this.render();
  }

  hide(): void {
    this.visibleValue = false;
    this.closePopups();
    this.applyVisibility();
  }

  toggle(): void {
    if (this.visibleValue) this.hide();
    else this.show();
  }

  /** While the taskbar is hidden (races) the window stays closed but keeps its state. */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (suspended) this.closePopups();
    this.applyVisibility();
  }

  private applyVisibility(): void {
    const shown = this.visibleValue && !this.suspended;
    this.layer.hidden = !shown;
    if (!shown) {
      this.focusedInput?.blur();
      setMessengerViewer(undefined);
    } else {
      setMessengerViewer(room => this.viewing(room));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.releaseService();
    this.resizeObserver.disconnect();
    setMessengerKeyTarget(undefined);
    document.removeEventListener("pointerdown", this.onOutside, true);
    setMessengerViewer(undefined);
    this.layer.remove();
  }

  /** The player is reading this room now. */
  private viewing(room: ChatRoom): boolean {
    return this.visibleValue && !this.suspended && this.mainTab === "chatPage" &&
      this.service?.store.activeRoomId === room.peerId && document.visibilityState !== "hidden";
  }

  // --- Events ---------------------------------------------------------------

  /** Keys on the window (the runtime's guard already kept them from the game and the pages). */
  private readonly onKey = (event: KeyboardEvent) => {
    const target = event.target as Node | null;
    if (event.type !== "keydown" || event.isComposing || event.keyCode === 229) return;
    if (!(target instanceof HTMLInputElement)) {
      if (event.key === "Escape") this.closePopups();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (target === editInput(this.dom.named("chatInput"))) this.sendChat();
    } else if (event.key === "Escape") {
      event.preventDefault();
      target.blur();
    }
  };

  private readonly onOutside = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (this.menu && target && !this.menu.contains(target)) this.closeMenu();
    const status = this.dom.named("statusDropBox");
    if (!status.hidden && target && !status.contains(target) && !this.dom.named("myInfo").contains(target))
      status.hidden = true;
    if (this.emoticonPanel && !this.emoticonPanel.hidden && target && !this.emoticonPanel.contains(target) &&
      !this.dom.named("emoticon").contains(target)) this.emoticonPanel.hidden = true;
  };

  private click(target: HTMLElement, action: () => void): void {
    target.addEventListener("click", event => {
      event.stopPropagation();
      if ((target as HTMLButtonElement).disabled) return;
      this.options.onActivate?.();
      action();
    });
    target.addEventListener("pointerenter", () => {
      if (!(target as HTMLButtonElement).disabled) this.options.onHover?.();
    });
  }

  private tip(target: HTMLElement, text: string | undefined): void {
    if (!text) return;
    target.setAttribute("aria-label", text);
    target.addEventListener("pointerenter", () => this.showTooltip(target, text));
    target.addEventListener("pointerleave", () => { this.tooltip.hidden = true; });
  }

  private showTooltip(target: HTMLElement, text: string): void {
    this.tooltip.textContent = text;
    this.tooltip.hidden = false;
    const winBox = this.win.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const scale = winBox.width / this.windowRect.width || 1;
    const width = this.tooltip.offsetWidth, height = this.tooltip.offsetHeight;
    const x = Math.min(this.windowRect.width - width, Math.max(0, (box.left - winBox.left) / scale));
    const y = (box.top - winBox.top) / scale - height - 2;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    const url = this.art.frameUrl("DefaultTooltipNew", 0, width, height);
    if (url) this.tooltip.style.setProperty("--f0", `url("${url}")`);
  }

  private wire(): void {
    const { strings } = this.art;
    const named = (name: string, type?: string) => this.dom.named(name, type);
    setMessengerKeyTarget({ element: this.layer, handle: this.onKey });
    document.addEventListener("pointerdown", this.onOutside, true);
    // Nothing under the window reacts to what happens on it.
    for (const type of ["pointerdown", "pointerup", "click", "dblclick", "contextmenu", "wheel"] as const)
      this.win.addEventListener(type, event => {
        event.stopPropagation();
        if (type === "contextmenu") event.preventDefault();
      });

    this.click(named("hideBtn"), () => this.hide());
    this.click(named("leftMoveBtn"), () => this.dock(true));
    this.click(named("rightMoveBtn"), () => this.dock(false));
    this.click(named("myInfo"), () => {
      const box = named("statusDropBox");
      box.hidden = !box.hidden;
    });
    this.click(named("selctOnline"), () => this.setInvisible(false));
    this.click(named("selectOffline"), () => this.setInvisible(true));

    const main = (tab: MainTab) => this.click(named(tab, "ImageButton"), () => {
      this.mainTab = tab;
      this.closePopups();
      this.render();
    });
    main("friendPage");
    main("chatPage");
    (named("chatPage", "ImageButton") as HTMLButtonElement).disabled = false;
    const friend = (tab: FriendTab, tipKey: string) => {
      const button = named(tab, "ImageButton");
      this.click(button, () => {
        this.friendTab = tab;
        this.render();
      });
      this.tip(button, strings.get(tipKey));
    };
    friend("friendListPage", "friend");
    friend("mailBoxPage", "message");
    friend("settingPage", "setting");
    const mail = (tab: MailTab) => this.click(named(tab, "ImageButton"), () => {
      this.mailTab = tab;
      this.render();
    });
    mail("receivePage");
    mail("sendPage");
    const setting = (tab: SettingTab) => this.click(named(tab, "ImageButton"), () => {
      this.settingTab = tab;
      this.render();
    });
    setting("normalSettingPage");
    setting("blockSettingPage");

    const addFriend = named("addFriendBtn");
    this.click(addFriend, () => void this.addFriend());
    this.tip(addFriend, strings.get("addFriend"));
    this.click(named("bulkDeleteBtn"), () => void this.clearOutbox());

    const search = editInput(named("friendSearchEdit"));
    search.setAttribute("aria-label", strings.get("searchFriend") ?? "搜索我的好友");
    search.addEventListener("input", () => {
      this.search = search.value;
      this.render();
    });
    const chatInput = editInput(named("chatInput"));
    chatInput.setAttribute("aria-label", "聊天内容");
    chatInput.addEventListener("input", () => {
      const room = this.service?.store.activeRoom;
      if (room) room.draft = chatInput.value;
      this.render();
    });
    for (const input of [search, chatInput]) {
      input.addEventListener("focus", () => {
        this.focusedInput = input;
        this.render();
      });
      input.addEventListener("blur", () => {
        if (this.focusedInput === input) this.focusedInput = undefined;
        this.render();
      });
    }
    // The guide labels sit over the inputs; clicks go through to them.
    named("searchGuideStr").style.pointerEvents = "none";
    named("guideStr").style.pointerEvents = "none";

    const exit = named("exitChat");
    this.click(exit, () => void this.exitRoom());
    this.tip(exit, strings.get("exitChatAlt"));
    this.click(named("eraseChat"), () => {
      const room = this.service?.store.activeRoom;
      if (room) this.service!.store.erase(room.peerId);
    });
    const emoticon = named("emoticon");
    if (this.emoticons) this.click(emoticon, () => this.toggleEmoticons());
    else emoticon.hidden = true;
    this.click(named("initCreateChat"), () => this.openInvite());
    this.click(named("addInviteOk"), () => this.confirmInvite());
    this.click(named("addInviteCancel"), () => this.closeInvite());
    named("enableInviteNum").hidden = false;

    this.chatLog.addEventListener("scroll", () => {
      if (this.chatLog.scrollTop < 24) this.loadOlder();
    });
  }

  private dock(left: boolean): void {
    this.dockLeft = left;
    const x = left ? 20 : this.windowRect.x;
    this.win.style.left = `${x}px`;
    this.render();
  }

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = undefined;
  }

  private closePopups(): void {
    this.closeMenu();
    this.dom.named("statusDropBox").hidden = true;
    if (this.emoticonPanel) this.emoticonPanel.hidden = true;
    this.tooltip.hidden = true;
  }

  private queueRender(): void {
    if (this.renderQueued || this.disposed) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  // --- Actions --------------------------------------------------------------

  private async run<T>(work: (service: MessengerService) => Promise<T>): Promise<T | undefined> {
    const service = this.service;
    if (!service) return undefined;
    this.busy++;
    try {
      const result = await work(service);
      void service.connection.sync();
      return result;
    } catch (error) {
      await this.notice(errorText(this.art, error));
      void service.connection.sync();
      return undefined;
    } finally {
      this.busy--;
    }
  }

  private notice(message: string): Promise<boolean> {
    return openMessengerMessage(this.options.library, this.options.root,
      this.art.strings.get("messenger") ?? "好友聊天系统", message);
  }

  private confirm(title: string, message: string): Promise<boolean> {
    return openMessengerMessage(this.options.library, this.options.root, title, message,
      { yes: "确定", no: this.art.strings.get("cancel") ?? "取消" });
  }

  private async addFriend(): Promise<void> {
    if (!this.service) return;
    await openAddFriendDialog(this.options.library, this.options.root, (nickname, dialog) => {
      const service = this.service;
      if (!service) return;
      dialog.setBusy(true);
      void service.api.requestFriend(nickname).then(async () => {
        dialog.close();
        void service.connection.sync();
        await this.notice(this.art.strings.get("successAddFriend") ?? "已完成好友申请。");
      }, async error => {
        dialog.setBusy(false);
        await this.notice(errorText(this.art, error));
      });
    }, () => undefined);
  }

  private async respond(accountId: string, accept: boolean): Promise<void> {
    if (!accept && !await this.confirm(this.art.strings.get("refuse") ?? "拒绝",
      this.art.strings.get("refuseConfirm") ?? "")) return;
    await this.run(service => service.api.respond(accountId, accept));
  }

  private async cancelRequest(accountId: string): Promise<void> {
    await this.run(service => service.api.cancelRequest(accountId));
  }

  private async clearOutbox(): Promise<void> {
    if (!await this.confirm(this.art.strings.get("bulkDelete") ?? "整理发件箱",
      this.art.strings.get("bulkDeleteConfirm") ?? "")) return;
    const deleted = await this.run(service => service.api.clearOutbox());
    if (deleted !== undefined)
      await this.notice(formatString(this.art.strings.get("bulkDeleteResult") ?? "已删除%d条信息。", deleted));
  }

  private async block(friend: { accountId: string }): Promise<void> {
    const { confirmStrings, strings } = this.art;
    if (!await this.confirm(confirmStrings.get("blockFriend") ?? "屏蔽好友",
      strings.get("inquireBlockFriend") ?? "要屏蔽好友吗？")) return;
    await this.run(service => service.api.block(friend.accountId));
    this.service?.store.closeRoom(friend.accountId);
  }

  private async unblock(accountId: string): Promise<void> {
    const { strings } = this.art;
    if (!await this.confirm(strings.get("blockCancel") ?? "解除屏蔽",
      strings.get("inquireBlockCancel") ?? "要解除屏蔽吗？")) return;
    await this.run(service => service.api.unblock(accountId));
  }

  private async remove(friend: Friend): Promise<void> {
    const { confirmStrings, strings } = this.art;
    if (!await this.confirm(confirmStrings.get("deleteFriend") ?? "删除好友",
      strings.get("inquireDeleteFriend") ?? "要删除好友吗？")) return;
    await this.run(service => service.api.removeFriend(friend.accountId));
  }

  private async setFavorite(friend: Friend, favorite: boolean): Promise<void> {
    await this.run(service => service.api.setFavorite(friend.accountId, favorite));
  }

  private async setInvisible(invisible: boolean): Promise<void> {
    this.dom.named("statusDropBox").hidden = true;
    const settings = this.service?.store.state?.settings;
    if (!settings || settings.invisible === invisible) return;
    await this.run(service => service.api.saveSettings({ ...settings, invisible }));
  }

  private async toggleSetting(key: "blockFriendRequests" | "blockGameInvites"): Promise<void> {
    const settings = this.service?.store.state?.settings;
    if (!settings) return;
    await this.run(service => service.api.saveSettings({ ...settings, [key]: !settings[key] }));
  }

  /** Double click / 对话: the friend's room, on the 对话 page. */
  private openChat(friend: { accountId: string; nickname: string }): void {
    const service = this.service;
    if (!service) return;
    const existing = service.store.room(friend.accountId);
    const room = service.store.openRoom(friend.accountId, friend.nickname);
    if (!room) {
      void this.notice(this.art.strings.get("maxChatRoom") ?? "聊天房间已达最大数量，|无法再创建房间。");
      return;
    }
    this.mainTab = "chatPage";
    if (!existing) this.greet(room, true);
    if (!room.loaded) void service.connection.loadOlder(room.peerId);
    this.render();
    editInput(this.dom.named("chatInput")).focus();
  }

  /** The release lines of a new room: created, the four etiquette lines, and an offline peer. */
  private greet(room: ChatRoom, created: boolean): void {
    if (this.greeted.has(room.peerId)) return;
    this.greeted.add(room.peerId);
    const store = this.service!.store;
    const { strings } = this.art;
    if (created) {
      store.addSystemLine(room.peerId, strings.get("createInitChat") ?? "聊天房间已创建。", "notice");
      for (const key of ["chatAlertGuide1", "chatAlertGuide2", "chatAlertGuide3", "chatAlertGuide4"]) {
        const line = strings.get(key);
        if (line) store.addSystemLine(room.peerId, line);
      }
    }
    if (store.friend(room.peerId)?.presence === "offline")
      store.addSystemLine(room.peerId, formatString(strings.get("offlineChat") ?? "%s处于离线状态", room.nickname));
  }

  private selectRoom(room: ChatRoom): void {
    const service = this.service;
    if (!service) return;
    service.store.selectRoom(room.peerId);
    this.greet(room, false);
    if (!room.loaded) void service.connection.loadOlder(room.peerId);
    const input = editInput(this.dom.named("chatInput"));
    input.value = room.draft;
    this.render();
  }

  private async exitRoom(): Promise<void> {
    const service = this.service;
    const room = service?.store.activeRoom;
    if (!service || !room) return;
    service.store.closeRoom(room.peerId);
    this.greeted.delete(room.peerId);
    const next = service.store.activeRoom;
    editInput(this.dom.named("chatInput")).value = next?.draft ?? "";
    if (room.lastMessageId > 0) await this.run(api => api.api.hideConversation(room.peerId));
  }

  private loadOlder(): void {
    const service = this.service;
    const room = service?.store.activeRoom;
    if (!service || !room || !room.loaded || !room.hasMore || room.loading) return;
    const before = this.chatLog.scrollHeight;
    void service.connection.loadOlder(room.peerId).then(() => {
      // Keep the line the player was reading in place.
      requestAnimationFrame(() => { this.chatLog.scrollTop += this.chatLog.scrollHeight - before; });
    });
  }

  private sendChat(): void {
    const service = this.service;
    const room = service?.store.activeRoom;
    const input = editInput(this.dom.named("chatInput"));
    if (!service || !room) return;
    const text = input.value.trim();
    if (!text) {
      input.blur();
      return;
    }
    const { store } = service;
    const warn = this.art.strings.get("chat_warn10secBlock") ?? "为防止刷屏，聊天禁止10秒。";
    if (store.mutedUntil > Date.now()) {
      store.addSystemLine(room.peerId, warn, "warning");
      return;
    }
    if (!store.isFriend(room.peerId)) {
      store.addSystemLine(room.peerId, this.art.strings.get("nobodyChat1") ?? "聊天对象不在房间内，无法再进行对话。", "warning");
      return;
    }
    const clientId = newClientId();
    input.value = "";
    room.draft = "";
    store.addPending(room.peerId, clientId, text);
    this.stickToBottom = true;
    service.connection.send(room.peerId, text, clientId).then(message => {
      store.receive(message, () => true);
    }, error => {
      const code = errorCode(error);
      if (code === "CHAT_FLOOD") {
        store.mutedUntil = Date.now() + 10_000;
        store.dropPending(room.peerId, clientId);
        store.addSystemLine(room.peerId, warn, "warning");
      } else {
        store.failPending(room.peerId, clientId);
        store.addSystemLine(room.peerId, errorText(this.art, error), "warning");
      }
    });
  }

  private toggleEmoticons(): void {
    const emoticons = this.emoticons;
    if (!emoticons) return;
    if (!this.emoticonPanel) {
      const panel = element("div", "ks-m-emopanel");
      const background = this.art.images.get("emoticonPopup_bg");
      // mainview GCEmoticonSelect (220,425 218×122 in the window), selectEmoticon's emoList inside.
      place(panel, { x: 220, y: 425, width: 218, height: 122 });
      if (background) panel.style.background = `url("${background.url}") 0 0/100% 100% no-repeat`;
      emoticons.list.slice(0, 32).forEach((emoticon, index) => {
        const button = element("button");
        button.type = "button";
        button.title = emoticon.text;
        button.setAttribute("aria-label", emoticon.text);
        button.style.left = `${10 + (index % 8) * 24}px`;
        button.style.top = `${5 + Math.floor(index / 8) * 22}px`;
        const face = element("span");
        face.style.backgroundImage = `url("${emoticons.url}")`;
        face.style.backgroundPosition = `-${emoticon.x}px -${emoticon.y}px`;
        button.append(face);
        button.addEventListener("click", event => {
          event.stopPropagation();
          this.insertEmoticon(emoticon.text);
        });
        panel.append(button);
      });
      this.win.append(panel);
      this.emoticonPanel = panel;
      return;
    }
    this.emoticonPanel.hidden = !this.emoticonPanel.hidden;
  }

  private insertEmoticon(text: string): void {
    const input = editInput(this.dom.named("chatInput"));
    const room = this.service?.store.activeRoom;
    if (!room) return;
    const value = input.value;
    const start = input.selectionStart ?? value.length, end = input.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    if (next.length > input.maxLength) return;
    input.value = next;
    room.draft = next;
    if (this.emoticonPanel) this.emoticonPanel.hidden = true;
    input.focus();
    input.setSelectionRange(start + text.length, start + text.length);
    this.render();
  }

  private openInvite(): void {
    this.inviteSelection = undefined;
    this.dom.named("AddInviteChat").hidden = false;
    this.render();
  }

  private closeInvite(): void {
    this.dom.named("AddInviteChat").hidden = true;
    this.inviteSelection = undefined;
  }

  private confirmInvite(): void {
    const friend = this.inviteSelection ? this.service?.store.friend(this.inviteSelection) : undefined;
    this.closeInvite();
    if (friend) this.openChat(friend);
  }

  // --- Quick menus ------------------------------------------------------------

  /** quickMenu1 for a friend: 对话, 特别关注/取消, 屏蔽, 删除好友 (加入游戏/邀请游戏/查看信息 are not served). */
  private openFriendMenu(friend: Friend, event: MouseEvent): void {
    const source = this.dom.named("quickMenu1");
    const items: Array<[string, () => void]> = [
      ["selectChat", () => this.openChat(friend)],
      [friend.favorite ? "deleteFavorite" : "addFavorite", () => void this.setFavorite(friend, !friend.favorite)],
      ["selectBlocked", () => void this.block(friend)],
      ["selectDelete", () => void this.remove(friend)],
    ];
    this.openMenu(source, items, event);
  }

  private openMenu(source: HTMLElement, items: Array<[string, () => void]>, event: MouseEvent): void {
    this.closeMenu();
    const menu = source.cloneNode(true) as HTMLElement;
    menu.hidden = false;
    for (const child of [...menu.children] as HTMLElement[]) if (child.tagName === "BUTTON") child.hidden = true;
    items.forEach(([name, action], index) => {
      const button = menu.querySelector<HTMLButtonElement>(`[data-name="${name}"]`);
      if (!button) return;
      button.hidden = false;
      // Below the DropBoxBg frame's 1 px caption, like the BML items.
      button.style.top = `${1 + index * 28}px`;
      menu.append(button);
      button.addEventListener("click", clickEvent => {
        clickEvent.stopPropagation();
        this.options.onActivate?.();
        this.closeMenu();
        action();
      });
      button.addEventListener("pointerenter", () => this.options.onHover?.());
    });
    const width = parseFloat(source.style.width), height = items.length * 28 + 2;
    menu.style.height = `${height}px`;
    const url = this.art.frameUrl("DropBoxBg", 0, width, height);
    if (url) menu.style.setProperty("--f0", `url("${url}")`);
    const winBox = this.win.getBoundingClientRect();
    const scale = winBox.width / this.windowRect.width || 1;
    const x = Math.min(this.windowRect.width - width, Math.max(0, (event.clientX - winBox.left) / scale));
    const y = Math.min(this.windowRect.height - height, Math.max(-70, (event.clientY - winBox.top) / scale));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.zIndex = "8";
    this.win.append(menu);
    this.menu = menu;
  }

  // --- Rendering --------------------------------------------------------------

  private stickToBottom = true;

  render(): void {
    if (this.disposed) return;
    const service = this.service;
    const store = service?.store;
    const state = store?.state;
    const { strings } = this.art;
    const named = (name: string, type?: string) => this.dom.named(name, type);

    // Caption and my info.
    named("leftMoveBtn").hidden = this.dockLeft;
    named("rightMoveBtn").hidden = !this.dockLeft;
    const me = state?.me;
    this.setGlove(named("myLevelMark"), me?.glove);
    setText(named("myLevelStr"), me ? `Lv.${me.level}` : "");
    setText(named("myRid"), me?.nickname ?? (store?.connection === "replaced" ? "已在其他窗口登录" : "连接中…"));
    const invisible = state?.settings.invisible ?? false;
    const online = store?.connection === "online";
    setText(named("myStatusStr"), strings.get(online && !invisible ? "online" : "offline") ?? "");
    setTexture(this.art, named("myStatusMark"), online && !invisible ? "msg_condition_online" : "msg_condition_offline");

    // Tabs.
    setTexture(this.art, named("messenger_bg"), this.mainTab === "chatPage" ? "msg_tab_message_bg" : "msg_tab_friends_bg");
    const select = (button: HTMLElement, selected: boolean) => button.setAttribute("aria-selected", String(selected));
    for (const tab of ["friendPage", "chatPage"] as const) {
      select(named(tab, "ImageButton"), this.mainTab === tab);
      named(tab, "TabPage").hidden = this.mainTab !== tab;
    }
    for (const tab of ["friendListPage", "mailBoxPage", "settingPage"] as const) {
      select(named(tab, "ImageButton"), this.friendTab === tab);
      named(tab, "TabPage").hidden = this.friendTab !== tab;
    }
    for (const tab of ["receivePage", "sendPage"] as const) {
      select(named(tab, "ImageButton"), this.mailTab === tab);
      named(tab, "TabPage").hidden = this.mailTab !== tab;
    }
    for (const tab of ["normalSettingPage", "blockSettingPage"] as const) {
      select(named(tab, "ImageButton"), this.settingTab === tab);
      named(tab, "TabPage").hidden = this.settingTab !== tab;
    }
    const rooms = store?.rooms ?? [];
    setText(named("chatPage", "ImageButton"), formatString(strings.get("chat") ?? "对话(%d)", rooms.length));

    // The unread chain.
    const incoming = store?.incomingCount ?? 0;
    const unread = store?.unreadTotal ?? 0;
    named("friend_alert").hidden = incoming === 0;
    named("mail_alert").hidden = incoming === 0;
    named("receive_alert").hidden = incoming === 0;
    named("chat_alert").hidden = unread === 0;

    if (this.layer.hidden) return;
    if (this.mainTab === "friendPage") {
      if (this.friendTab === "friendListPage") this.renderFriends();
      else if (this.friendTab === "mailBoxPage") this.renderMail();
      else this.renderSettings();
    } else {
      this.renderChat();
    }
  }

  private setGlove(target: HTMLElement, glove: string | undefined): void {
    if (!glove) {
      target.style.removeProperty("background");
      return;
    }
    if (!this.gloves.has(glove)) {
      this.gloves.set(glove, undefined);
      void loadLevelGloveArt(this.options.library, glove).then(url => {
        this.gloves.set(glove, url);
        this.queueRender();
      });
    }
    const url = this.gloves.get(glove);
    target.style.background = url ? `url("${url}") center/contain no-repeat` : "";
  }

  private presenceText(presence: Presence): string {
    return this.art.strings.get(presence) ?? presence;
  }

  private friendGroups(): Array<{ key: GroupKey; title: string; friends: Friend[] }> {
    const friends = [...(this.service?.store.state?.friends ?? [])].sort(byNickname);
    const query = this.search.trim().toLowerCase();
    const shown = query ? friends.filter(friend => friend.nickname.toLowerCase().includes(query)) : friends;
    const { strings } = this.art;
    const favorite = shown.filter(friend => friend.favorite);
    const groups: Array<{ key: GroupKey; title: string; friends: Friend[] }> = [];
    if (favorite.length) groups.push({ key: "favorite", friends: favorite,
      title: formatString(strings.get("favoriteList") ?? "特别关注 (%d)", favorite.length) });
    const onlineFriends = shown.filter(friend => !friend.favorite && friend.presence !== "offline");
    const offlineFriends = shown.filter(friend => !friend.favorite && friend.presence === "offline");
    groups.push({ key: "online", friends: onlineFriends,
      title: formatString(strings.get("onlineList") ?? "在线好友 (%d)", onlineFriends.length) });
    groups.push({ key: "offline", friends: offlineFriends,
      title: formatString(strings.get("offlineList") ?? "离线好友 (%d)", offlineFriends.length) });
    return groups;
  }

  private headerRow(scope: string, key: string, title: string, open: boolean, settings = false): Row {
    const templates = this.templates;
    const template = settings ? (open ? templates.optSubtitleOpen : templates.optSubtitle)
      : open ? templates.subtitleOpen : templates.subtitle;
    return {
      key: `${scope}:${key}:${open ? "open" : "closed"}`,
      create: () => {
        const row = template.create();
        this.click(row, () => {
          const id = `${scope}:${key}`;
          if (this.collapsed.has(id)) this.collapsed.delete(id);
          else this.collapsed.add(id);
          this.render();
        });
        return row;
      },
      update: row => setText(row, title),
    };
  }

  private fillPerson(row: HTMLElement, person: { level: number; glove: string; nickname: string }): void {
    this.setGlove(part(row, "friendLevelMark"), person.glove);
    setText(part(row, "friendLevelStr"), `Lv.${person.level}`);
    setText(part(row, "friendRid"), person.nickname);
  }

  private renderFriends(): void {
    const searchInput = editInput(this.dom.named("friendSearchEdit"));
    this.dom.named("searchGuideStr").hidden = searchInput.value !== "" || this.focusedInput === searchInput;
    const rows: Row[] = [];
    for (const group of this.friendGroups()) {
      const open = !this.collapsed.has(`friends:${group.key}`);
      rows.push(this.headerRow("friends", group.key, group.title, open));
      if (!open) continue;
      for (const friend of group.friends) {
        rows.push({
          key: `friend:${friend.accountId}`,
          create: () => {
            const row = this.templates.friend.create();
            row.addEventListener("dblclick", () => {
              const current = this.service?.store.friend(friend.accountId);
              if (current) this.openChat(current);
            });
            row.addEventListener("contextmenu", event => {
              event.preventDefault();
              const current = this.service?.store.friend(friend.accountId);
              if (current) this.openFriendMenu(current, event);
            });
            row.addEventListener("pointerenter", () => this.options.onHover?.());
            return row;
          },
          update: row => {
            const current = this.service?.store.friend(friend.accountId) ?? friend;
            this.fillPerson(row, current);
            setText(part(row, "friendStatusStr"), this.presenceText(current.presence));
            setTexture(this.art, part(row, "friendStatusMark"), PRESENCE_IMAGE[current.presence]);
            row.title = `${current.nickname}（双击对话，右键更多）`;
          },
        });
      }
    }
    const list = this.lists.friendList!;
    reconcile(list.list, rows);
    list.sync();
  }

  private renderMail(): void {
    const state = this.service?.store.state;
    const now = this.service?.serverNow() ?? Date.now();
    const { strings } = this.art;
    if (this.mailTab === "receivePage") {
      const rows: Row[] = (state?.incoming ?? []).map(request => ({
        key: `in:${request.accountId}:${request.createdAt}`,
        create: () => {
          const row = this.templates.receive.create();
          setTexture(this.art, part(row, "icon"), "msg_icon_friend_0");
          this.click(part(row, "acceptBtn"), () => void this.respond(request.accountId, true));
          this.click(part(row, "refuseBtn"), () => void this.respond(request.accountId, false));
          part(row, "acceptBtn").setAttribute("aria-label", strings.get("accept") ?? "同意");
          part(row, "refuseBtn").setAttribute("aria-label", strings.get("refuse") ?? "拒绝");
          return row;
        },
        update: row => {
          setText(part(row, "infoStr"), formatString(strings.get("receiveFriendRequestStr") ?? "%s", request.nickname), true);
          setText(part(row, "expireTime"), formatString(strings.get("autoRefuseStr") ?? "%d",
            daysLeft(request.expiresAt, now)), true);
        },
      }));
      const list = this.lists.receiveList!;
      reconcile(list.list, rows);
      list.sync();
      return;
    }
    const outgoing = [...(state?.outgoing ?? [])].sort((a, b) =>
      (b.resolvedAt ?? b.createdAt) - (a.resolvedAt ?? a.createdAt));
    const rows: Row[] = outgoing.map(request => ({
      key: `out:${request.accountId}:${request.state}:${request.createdAt}`,
      create: () => {
        const row = this.templates.send.create();
        const cancel = part(row, "addCancelBtn");
        this.click(cancel, () => void this.cancelRequest(request.accountId));
        cancel.setAttribute("aria-label", "撤回好友请求");
        return row;
      },
      update: row => this.fillOutgoing(row, request, now),
    }));
    this.dom.named("bulkDeleteBtn").toggleAttribute("disabled",
      !outgoing.some(request => request.state !== "pending"));
    const list = this.lists.sendList!;
    reconcile(list.list, rows);
    list.sync();
  }

  private fillOutgoing(row: HTMLElement, request: OutgoingRequest, now: number): void {
    const { strings } = this.art;
    const icon = request.state === "accepted" ? 1 : request.state === "refused" ? 2 : 0;
    setTexture(this.art, part(row, "icon"), `msg_icon_friend_${icon}`);
    const key = request.state === "accepted" ? "acceptFriendStr" : request.state === "refused"
      ? "refuseFriendStr" : "sendFriendRequestStr";
    setText(part(row, "infoStr"), formatString(strings.get(key) ?? "%s", request.nickname), true);
    setText(part(row, "expireTime"), formatString(strings.get(request.state === "pending"
      ? "autoRefuseStr" : "autoDeleteStr") ?? "%d", daysLeft(request.expiresAt, now)), true);
    part(row, "addCancelBtn").hidden = request.state !== "pending";
  }

  private renderSettings(): void {
    const state = this.service?.store.state;
    const { strings } = this.art;
    const templates = this.templates;
    if (this.settingTab === "normalSettingPage") {
      const check = (row: HTMLElement, name: string, value: boolean) => {
        const button = part(row, name);
        button.setAttribute("role", "checkbox");
        button.setAttribute("aria-checked", String(value));
        (button as HTMLButtonElement).disabled = !state;
      };
      const rows: Row[] = [
        { key: "opt0", create: () => templates.optTitle0.create(), update: () => undefined },
        {
          key: "opt1",
          create: () => {
            const row = templates.optTitle1.create();
            this.click(part(row, "blockFriendRequest"), () => void this.toggleSetting("blockFriendRequests"));
            part(row, "blockFriendRequest").setAttribute("aria-label", strings.get("blockAddFriend") ?? "不接收好友请求");
            return row;
          },
          update: row => check(row, "blockFriendRequest", state?.settings.blockFriendRequests ?? false),
        },
        {
          key: "opt2",
          create: () => {
            const row = templates.optTitle2.create();
            this.click(part(row, "blockGameInvite"), () => void this.toggleSetting("blockGameInvites"));
            part(row, "blockGameInvite").setAttribute("aria-label", strings.get("bolckInviteGame") ?? "不接收游戏邀请");
            return row;
          },
          update: row => check(row, "blockGameInvite", state?.settings.blockGameInvites ?? false),
        },
      ];
      for (const group of this.friendGroups()) {
        const open = !this.collapsed.has(`settings:${group.key}`);
        rows.push(this.headerRow("settings", group.key, group.title, open, true));
        if (!open) continue;
        for (const friend of group.friends) {
          rows.push({
            key: `opt:${friend.accountId}`,
            create: () => {
              const row = templates.normalOpt.create();
              const current = () => this.service?.store.friend(friend.accountId);
              this.click(part(row, "addFavoriteOpt"), () => { const f = current(); if (f) void this.setFavorite(f, true); });
              this.click(part(row, "deleteFavoriteOpt"), () => { const f = current(); if (f) void this.setFavorite(f, false); });
              this.click(part(row, "addBlockOpt"), () => { const f = current(); if (f) void this.block(f); });
              part(row, "addFavoriteOpt").setAttribute("aria-label", strings.get("addFavorite") ?? "特别关注");
              part(row, "deleteFavoriteOpt").setAttribute("aria-label", strings.get("deleteFavorite") ?? "取消特别关注");
              part(row, "addBlockOpt").setAttribute("aria-label", strings.get("blockFriend") ?? "屏蔽");
              return row;
            },
            update: row => {
              const current = this.service?.store.friend(friend.accountId) ?? friend;
              this.fillPerson(row, current);
              part(row, "addFavoriteOpt").hidden = current.favorite;
              part(row, "deleteFavoriteOpt").hidden = !current.favorite;
              part(row, "addBlockOpt").hidden = false;
            },
          });
        }
      }
      const list = this.lists.normalOptList!;
      reconcile(list.list, rows);
      list.sync();
      return;
    }
    const blocks = [...(state?.blocks ?? [])].sort(byNickname);
    const open = !this.collapsed.has("blocks:all");
    const rows: Row[] = [this.headerRow("blocks", "all",
      formatString(strings.get("blockList") ?? "屏蔽管理 (%d)", blocks.length), open, true)];
    if (open) for (const blocked of blocks) {
      rows.push({
        key: `block:${blocked.accountId}`,
        create: () => {
          const row = templates.blockOpt.create();
          const unblock = part(row, "deleteBlockOpt");
          this.click(unblock, () => void this.unblock(blocked.accountId));
          unblock.setAttribute("aria-label", strings.get("blockCancel") ?? "解除屏蔽");
          return row;
        },
        update: row => {
          this.fillPerson(row, blocked);
          part(row, "addBlockOpt").hidden = true;
          part(row, "deleteBlockOpt").hidden = false;
        },
      });
    }
    const list = this.lists.blockOptList!;
    reconcile(list.list, rows);
    list.sync();
  }

  private renderChat(): void {
    const service = this.service;
    const store = service?.store;
    const rooms = store?.rooms ?? [];
    const { strings } = this.art;
    const exist = this.dom.named("existChat");
    const empty = this.dom.named("notExistChat");
    exist.hidden = rooms.length === 0;
    empty.hidden = rooms.length !== 0;
    if (store && rooms.length && !store.activeRoom) store.activeRoomId = rooms[0]!.peerId;
    this.renderInvite();
    if (!store || rooms.length === 0) return;
    const active = store.activeRoom!;

    // Room slots.
    reconcile(this.dom.named("chatList"), rooms.map(room => ({
      key: `room:${room.peerId}`,
      create: () => {
        const slot = this.templates.chatRoom.create();
        slot.style.marginBottom = `${SLOT_PITCH - this.templates.chatRoom.height}px`;
        slot.addEventListener("click", event => {
          event.stopPropagation();
          this.options.onActivate?.();
          const current = this.service?.store.room(room.peerId);
          if (current) this.selectRoom(current);
        });
        slot.addEventListener("pointerenter", () => {
          part(slot, "mouseOn").hidden = false;
          this.options.onHover?.();
        });
        slot.addEventListener("pointerleave", () => { part(slot, "mouseOn").hidden = true; });
        return slot;
      },
      update: slot => {
        const current = store.room(room.peerId) ?? room;
        const selected = current.peerId === active.peerId;
        part(slot, "selected").hidden = !selected;
        part(slot, "new").hidden = selected || current.unread === 0;
        part(slot, "notice_alert").hidden = current.unread === 0;
        setText(part(slot, "shortRoomName"), formatString(strings.get("shortChatTitle1") ?? "%s的对话", current.nickname));
        slot.title = current.nickname;
      },
    })));

    // Title, input and log of the selected room.
    setText(this.dom.named("fullRoomName"),
      formatString(strings.get("fullChatTitle1") ?? "%s", active.nickname), true);
    const input = editInput(this.dom.named("chatInput"));
    if (document.activeElement !== input && input.value !== active.draft) input.value = active.draft;
    this.dom.named("guideStr").hidden = input.value !== "" || this.focusedInput === input;
    this.renderLog(active);

    // Read receipts while the room is in view.
    if (this.viewing(active)) {
      store.markRead(active.peerId);
      if (active.lastMessageId > (this.readSent.get(active.peerId) ?? 0)) {
        this.readSent.set(active.peerId, active.lastMessageId);
        service!.connection.markRead(active.peerId);
      }
    }
  }

  private renderLog(room: ChatRoom): void {
    const log = this.chatLog;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 8;
    if (log.dataset.room !== room.peerId) {
      log.dataset.room = room.peerId;
      log.replaceChildren();
      this.stickToBottom = true;
    }
    const me = this.service?.store.me?.accountId;
    const rows: Row[] = [];
    if (room.hasMore) rows.push({
      key: "more",
      create: () => {
        const more = element("button", "ks-m-more", "查看更早的消息");
        more.type = "button";
        more.addEventListener("click", event => {
          event.stopPropagation();
          this.loadOlder();
        });
        return more;
      },
      update: more => { (more as HTMLButtonElement).disabled = room.loading; },
    });
    for (const line of room.lines) rows.push(this.logRow(line, room, me));
    reconcile(log, rows);
    if (this.stickToBottom || atBottom) log.scrollTop = log.scrollHeight;
    this.stickToBottom = false;
  }

  private logRow(line: ChatLine, room: ChatRoom, me: string | undefined): Row {
    const key = line.kind === "message" ? `m:${line.message.id}` : line.kind === "pending"
      ? `p:${line.clientId}` : `s:${line.key}`;
    return {
      key,
      create: () => {
        const row = element("div", "ks-m-line");
        row.dataset.kind = line.kind;
        if (line.kind === "system") {
          row.textContent = line.text.replaceAll("|", "\n");
          if (line.tone) row.dataset.tone = line.tone;
          return row;
        }
        const self = line.kind === "pending" || line.message.from === me;
        row.dataset.self = String(self);
        const name = self ? this.service?.store.me?.nickname ?? "" : room.nickname;
        const text = line.kind === "message" ? line.message.text : line.text;
        const label = element("span", "ks-m-line-name", `${name} : `);
        row.append(label, ...this.chatContent(text));
        if (line.kind === "message") {
          const time = new Date(line.message.sentAt);
          row.title = time.toLocaleString("zh-CN");
        }
        return row;
      },
      update: row => {
        if (line.kind === "pending") row.dataset.failed = String(line.failed === true);
      },
    };
  }

  private chatContent(text: string): Node[] {
    const emoticons = this.emoticons;
    return chatRuns(text, emoticons?.list).map(run => {
      if ("text" in run) return document.createTextNode(run.text);
      const face = element("span", "ks-m-emo");
      face.title = run.emoticon.text;
      face.style.backgroundImage = `url("${emoticons!.url}")`;
      face.style.backgroundPosition = `-${run.emoticon.x}px -${run.emoticon.y}px`;
      return face;
    });
  }

  private renderInvite(): void {
    const popup = this.dom.named("AddInviteChat");
    if (popup.hidden) return;
    const friends = [...(this.service?.store.state?.friends ?? [])].sort(byNickname);
    const { strings } = this.art;
    setText(this.dom.named("enableInviteNum"), formatString(strings.get("UserNum") ?? "%d人", 1));
    (this.dom.named("addInviteOk") as HTMLButtonElement).disabled = !this.inviteSelection;
    const rows: Row[] = [];
    const groups: Array<[string, Friend[]]> = [
      [formatString(strings.get("onlineList") ?? "在线好友 (%d)", friends.filter(f => f.presence !== "offline").length),
        friends.filter(f => f.presence !== "offline")],
      [formatString(strings.get("offlineList") ?? "离线好友 (%d)", friends.filter(f => f.presence === "offline").length),
        friends.filter(f => f.presence === "offline")],
    ];
    groups.forEach(([title, members], index) => {
      rows.push({
        key: `invite-group:${index}`,
        create: () => this.templates.inviteSubtitleOpen.create(),
        update: row => setText(row, title),
      });
      for (const friend of members) rows.push({
        key: `invite:${friend.accountId}`,
        create: () => {
          const row = this.templates.invite.create();
          row.addEventListener("click", event => {
            event.stopPropagation();
            this.inviteSelection = friend.accountId;
            this.render();
          });
          row.addEventListener("dblclick", event => {
            event.stopPropagation();
            this.inviteSelection = friend.accountId;
            this.confirmInvite();
          });
          return row;
        },
        update: row => {
          this.fillPerson(row, friend);
          const selected = this.inviteSelection === friend.accountId;
          row.setAttribute("aria-selected", String(selected));
          const image = this.art.images.get("msg_tab_message_popup_selected1");
          const face = row.querySelector<HTMLElement>(":scope > .ks-m-img");
          if (face && image) face.style.setProperty("--i3", `url("${image.url}")`);
        },
      });
    });
    const list = this.lists.addInviteList!;
    reconcile(list.list, rows);
    list.sync();
  }
}

/** The window over a game root, created on first use. */
let shared: { root: HTMLElement; window: Promise<MessengerWindow> } | undefined;

export function messengerWindow(options: MessengerWindowOptions): Promise<MessengerWindow> {
  if (!shared || shared.root !== options.root) {
    const pending = MessengerWindow.load(options);
    shared = { root: options.root, window: pending };
    pending.catch(() => { if (shared?.window === pending) shared = undefined; });
  }
  return shared.window;
}

/** The tray button: open or close the window. */
export async function toggleMessengerWindow(options: MessengerWindowOptions): Promise<void> {
  if (!currentMessenger()) return;
  (await messengerWindow(options)).toggle();
}

/** The taskbar was hidden (a race) or shown again. */
export function suspendMessengerWindow(suspended: boolean): void {
  void shared?.window.then(window => window.setSuspended(suspended), () => undefined);
}
