/**
 * Client state of 好友聊天系统: the data service's snapshot (friends,
 * requests, blocks, settings, conversations), live presence, and the chat
 * rooms of the window's 对话 page with their logs. The server is
 * authoritative; this only merges its snapshot with the pushes that arrived
 * since and with what the player is typing or sending.
 */
import type {
  ChatMessage, Conversation, Friend, MessengerState, Presence,
} from "./messenger-api";

export type ConnectionState = "connecting" | "online" | "offline" | "stopped" | "replaced";

/** One line of a room's log. */
export type ChatLine =
  | { kind: "message"; message: ChatMessage }
  | { kind: "pending"; clientId: string; text: string; failed?: boolean }
  | { kind: "system"; key: number; text: string; tone?: "notice" | "warning" };

/** A 对话 room: one friend (the release rooms hold up to 8; this service has 1:1 rooms). */
export interface ChatRoom {
  peerId: string;
  nickname: string;
  lines: ChatLine[];
  unread: number;
  lastMessageId: number;
  /** History pages read from the service. */
  loaded: boolean;
  loading: boolean;
  hasMore: boolean;
  /** 橡皮擦 (local only, like the release): lines up to here are not shown. */
  erasedUpTo: number;
  /** Text typed in chatInput for this room. */
  draft: string;
}

/** The release left column holds 10 room slots (chatList maxLine). */
export const MAX_CHAT_ROOMS = 10;

let systemKeys = 0;

export class MessengerStore {
  state?: MessengerState;
  connection: ConnectionState = "connecting";
  /** Rooms in slot order. */
  readonly rooms: ChatRoom[] = [];
  activeRoomId?: string;
  /** Chat is muted until this client time (CHAT_FLOOD). */
  mutedUntil = 0;
  /**
   * Rooms the player closed (退出) during this session, with the newest
   * message id known then: a newer message (live or in a snapshot) reopens them.
   */
  private readonly closed = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private notifying = false;
  private notifyAgain = false;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Listeners run after each change; nested changes notify once more. */
  changed(): void {
    if (this.notifying) {
      this.notifyAgain = true;
      return;
    }
    this.notifying = true;
    try {
      do {
        this.notifyAgain = false;
        for (const listener of [...this.listeners]) {
          try { listener(); } catch (error) { console.warn("好友系统界面更新失败", error); }
        }
      } while (this.notifyAgain);
    } finally {
      this.notifying = false;
    }
  }

  setConnection(connection: ConnectionState): void {
    if (this.connection === connection) return;
    this.connection = connection;
    this.changed();
  }

  get me() { return this.state?.me; }

  friend(accountId: string): Friend | undefined {
    return this.state?.friends.find(friend => friend.accountId === accountId);
  }

  isFriend(accountId: string): boolean { return this.friend(accountId) !== undefined; }

  /** A new snapshot: rooms follow its conversations, unread counts come from the service. */
  applyState(state: MessengerState): void {
    this.state = state;
    const conversations = [...state.conversations].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    for (const conversation of conversations) {
      const room = this.room(conversation.accountId);
      if (room) {
        this.syncRoom(room, conversation);
      } else {
        const closedAt = this.closed.get(conversation.accountId);
        if (closedAt !== undefined && conversation.lastMessageId > closedAt) this.closed.delete(conversation.accountId);
        if (!this.closed.has(conversation.accountId) && this.rooms.length < MAX_CHAT_ROOMS) {
          const created = this.createRoom(conversation.accountId, conversation.nickname);
          this.syncRoom(created, conversation);
          this.rooms.push(created);
        }
      }
    }
    for (const room of this.rooms) {
      const friend = this.friend(room.peerId);
      if (friend) room.nickname = friend.nickname;
      if (!conversations.some(conversation => conversation.accountId === room.peerId)) room.unread = 0;
    }
    this.changed();
  }

  private syncRoom(room: ChatRoom, conversation: Conversation): void {
    room.nickname = conversation.nickname || room.nickname;
    room.lastMessageId = Math.max(room.lastMessageId, conversation.lastMessageId);
    room.unread = conversation.unread;
  }

  setPresence(accountId: string, presence: Presence): void {
    const friend = this.friend(accountId);
    if (!friend || friend.presence === presence) return;
    friend.presence = presence;
    this.changed();
  }

  room(peerId: string): ChatRoom | undefined {
    return this.rooms.find(room => room.peerId === peerId);
  }

  private createRoom(peerId: string, nickname: string): ChatRoom {
    return { peerId, nickname, lines: [], unread: 0, lastMessageId: 0, loaded: false,
      loading: false, hasMore: false, erasedUpTo: 0, draft: "" };
  }

  /**
   * Opens (or selects) the room for a friend. Undefined when all 10 slots
   * are taken by other rooms (the release maxChatRoom notice).
   */
  openRoom(peerId: string, nickname: string): ChatRoom | undefined {
    let room = this.room(peerId);
    if (!room) {
      if (this.rooms.length >= MAX_CHAT_ROOMS) return undefined;
      room = this.createRoom(peerId, nickname);
      this.rooms.push(room);
    }
    this.closed.delete(peerId);
    this.activeRoomId = peerId;
    this.changed();
    return room;
  }

  selectRoom(peerId: string | undefined): void {
    if (this.activeRoomId === peerId) return;
    this.activeRoomId = peerId;
    this.changed();
  }

  /** 退出: the room leaves its slot; the next one is selected. */
  closeRoom(peerId: string): void {
    const index = this.rooms.findIndex(room => room.peerId === peerId);
    if (index < 0) return;
    const conversation = this.state?.conversations.find(entry => entry.accountId === peerId);
    this.closed.set(peerId, Math.max(this.rooms[index]!.lastMessageId, conversation?.lastMessageId ?? 0));
    this.rooms.splice(index, 1);
    if (this.activeRoomId === peerId)
      this.activeRoomId = this.rooms[Math.min(index, this.rooms.length - 1)]?.peerId;
    this.changed();
  }

  get activeRoom(): ChatRoom | undefined {
    return this.activeRoomId === undefined ? undefined : this.room(this.activeRoomId);
  }

  /** A history page (oldest first): older pages go before the loaded lines. */
  addHistory(peerId: string, messages: readonly ChatMessage[], hasMore: boolean, older: boolean): void {
    const room = this.room(peerId);
    if (!room) return;
    const known = new Set(room.lines.flatMap(line => line.kind === "message" ? [line.message.id] : []));
    const fresh = messages.filter(message => message.id > room.erasedUpTo && !known.has(message.id))
      .map(message => ({ kind: "message", message }) as ChatLine);
    if (older) {
      room.lines.unshift(...fresh);
      // After 橡皮擦 nothing older is shown again.
      room.hasMore = hasMore && !(messages.length && messages[0]!.id <= room.erasedUpTo);
    } else {
      // The newest page after a (re)connect: merge by id after the loaded lines.
      for (const line of fresh) this.insertMessage(room, line as ChatLine & { kind: "message" });
      if (!room.loaded) room.hasMore = hasMore;
    }
    room.loaded = true;
    for (const message of messages) room.lastMessageId = Math.max(room.lastMessageId, message.id);
    this.changed();
  }

  private insertMessage(room: ChatRoom, line: ChatLine & { kind: "message" }): void {
    const pending = room.lines.findIndex(entry => entry.kind === "pending" &&
      entry.clientId === line.message.clientId);
    if (pending >= 0) {
      room.lines[pending] = line;
      return;
    }
    if (room.lines.some(entry => entry.kind === "message" && entry.message.id === line.message.id)) return;
    // Before my unconfirmed lines and any later message; system lines stay where they happened.
    let index = room.lines.length;
    while (index > 0) {
      const previous = room.lines[index - 1]!;
      if (previous.kind === "system" || (previous.kind === "message" && previous.message.id < line.message.id)) break;
      index--;
    }
    room.lines.splice(index, 0, line);
  }

  /**
   * A message pushed or confirmed by the service. A message from a friend
   * whose room is not open takes a free slot (or waits for the next snapshot).
   * Returns the room it went to.
   */
  receive(message: ChatMessage, viewing: (room: ChatRoom) => boolean): ChatRoom | undefined {
    const me = this.state?.me.accountId;
    const peerId = message.from === me ? message.to : message.from;
    let room = this.room(peerId);
    if (!room) {
      if (this.rooms.length >= MAX_CHAT_ROOMS) return undefined;
      this.closed.delete(peerId);
      room = this.createRoom(peerId, this.friend(peerId)?.nickname ?? "");
      this.rooms.push(room);
    }
    // A message the snapshot already counted (pushed while the welcome was on its way) counts once.
    const counted = message.id <= room.lastMessageId;
    this.insertMessage(room, { kind: "message", message });
    room.lastMessageId = Math.max(room.lastMessageId, message.id);
    if (message.from !== me && !counted && !viewing(room)) room.unread++;
    this.changed();
    return room;
  }

  addPending(peerId: string, clientId: string, text: string): void {
    const room = this.room(peerId);
    if (!room) return;
    room.lines.push({ kind: "pending", clientId, text });
    this.changed();
  }

  failPending(peerId: string, clientId: string): void {
    const room = this.room(peerId);
    const line = room?.lines.find(entry => entry.kind === "pending" && entry.clientId === clientId);
    if (!line || line.kind !== "pending") return;
    line.failed = true;
    this.changed();
  }

  dropPending(peerId: string, clientId: string): void {
    const room = this.room(peerId);
    if (!room) return;
    const index = room.lines.findIndex(entry => entry.kind === "pending" && entry.clientId === clientId);
    if (index < 0) return;
    room.lines.splice(index, 1);
    this.changed();
  }

  addSystemLine(peerId: string, text: string, tone?: "notice" | "warning"): void {
    const room = this.room(peerId);
    if (!room) return;
    room.lines.push({ kind: "system", key: ++systemKeys, text, tone });
    this.changed();
  }

  /** 橡皮擦: hide everything logged so far in this room. */
  erase(peerId: string): void {
    const room = this.room(peerId);
    if (!room) return;
    room.lines.splice(0, room.lines.length);
    room.erasedUpTo = room.lastMessageId;
    room.hasMore = false;
    this.changed();
  }

  /** The room was read up to its last message. */
  markRead(peerId: string): boolean {
    const room = this.room(peerId);
    if (!room || room.unread === 0) return false;
    room.unread = 0;
    const conversation = this.state?.conversations.find(entry => entry.accountId === peerId);
    if (conversation) conversation.unread = 0;
    this.changed();
    return true;
  }

  get unreadTotal(): number {
    return this.rooms.reduce((total, room) => total + room.unread, 0);
  }

  get incomingCount(): number {
    return this.state?.incoming.length ?? 0;
  }

  /** The tray messengerAlert: unread chat or a pending friend request. */
  get alert(): boolean {
    return this.unreadTotal > 0 || this.incomingCount > 0;
  }
}
