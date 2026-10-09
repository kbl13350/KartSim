/**
 * The data service's friends and private chat API (server-go/DESIGN.md
 * 好友与私聊): the JSON shapes, their validation and the Bearer requests.
 * Every failure is an AccountServiceError whose code the window maps to the
 * release strings (messenger-text.ts).
 */
import { AccountServiceError } from "../account/account-api";

export type Presence = "online" | "inGame" | "offline";

export interface MessengerPerson {
  accountId: string;
  nickname: string;
  level: number;
  /** etc_/level/<glove>.png (the account summary's progress.glove). */
  glove: string;
}

export interface MessengerMe extends MessengerPerson {}

export interface MessengerSettings {
  blockFriendRequests: boolean;
  blockGameInvites: boolean;
  /** 离线 in the status drop box: friends see the account offline. */
  invisible: boolean;
}

export interface Friend extends MessengerPerson {
  favorite: boolean;
  since: number;
  presence: Presence;
}

export interface IncomingRequest extends MessengerPerson {
  createdAt: number;
  /** When the request is refused automatically. */
  expiresAt: number;
}

export type OutgoingState = "pending" | "accepted" | "refused";

export interface OutgoingRequest extends MessengerPerson {
  state: OutgoingState;
  createdAt: number;
  resolvedAt: number | null;
  /** Pending: the automatic refusal; answered: when the card is deleted. */
  expiresAt: number;
}

export interface BlockedPerson extends MessengerPerson {
  since: number;
}

export interface Conversation {
  accountId: string;
  nickname: string;
  lastMessageId: number;
  lastMessageAt: number;
  unread: number;
  lastReadId: number;
}

export interface ChatMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  sentAt: number;
  clientId: string;
}

export interface MessengerLimits {
  friends: number;
  pendingOutgoing: number;
  blocks: number;
  messageLength: number;
  requestDays: number;
  resultDays: number;
}

export interface MessengerState {
  me: MessengerMe;
  settings: MessengerSettings;
  friends: Friend[];
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
  blocks: BlockedPerson[];
  conversations: Conversation[];
  limits: MessengerLimits;
  serverTime: number;
}

export const DEFAULT_LIMITS: MessengerLimits = {
  friends: 100, pendingOutgoing: 30, blocks: 100, messageLength: 30, requestDays: 7, resultDays: 7,
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function invalid(what: string): never {
  throw new AccountServiceError(`INVALID_MESSENGER_${what}`);
}

function person(value: Record<string, unknown>): MessengerPerson | undefined {
  const accountId = text(value.accountId);
  const nickname = text(value.nickname);
  if (!accountId || !nickname) return undefined;
  return { accountId, nickname, level: Math.max(1, Math.floor(number(value.level, 1))),
    glove: text(value.glove) };
}

function list<T>(value: unknown, parse: (entry: Record<string, unknown>) => T | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    const parsed = record(entry) ? parse(entry) : undefined;
    return parsed ? [parsed] : [];
  });
}

const PRESENCES = new Set<Presence>(["online", "inGame", "offline"]);
const OUTGOING_STATES = new Set<OutgoingState>(["pending", "accepted", "refused"]);

export function parsePresence(value: unknown): Presence {
  return PRESENCES.has(value as Presence) ? value as Presence : "offline";
}

export function parseFriend(value: Record<string, unknown>): Friend | undefined {
  const base = person(value);
  return base && { ...base, favorite: value.favorite === true, since: number(value.since),
    presence: parsePresence(value.presence) };
}

export function parseMessage(value: unknown): ChatMessage | undefined {
  if (!record(value)) return undefined;
  const id = number(value.id, -1);
  const from = text(value.from), to = text(value.to);
  if (!Number.isInteger(id) || id <= 0 || !from || !to || typeof value.text !== "string") return undefined;
  return { id, from, to, text: value.text, sentAt: number(value.sentAt), clientId: text(value.clientId) };
}

function parseSettings(value: unknown): MessengerSettings {
  const settings = record(value) ? value : {};
  return {
    blockFriendRequests: settings.blockFriendRequests === true,
    blockGameInvites: settings.blockGameInvites === true,
    invisible: settings.invisible === true,
  };
}

function parseOutgoing(entry: Record<string, unknown>): OutgoingRequest | undefined {
  const base = person(entry);
  if (!base || !OUTGOING_STATES.has(entry.state as OutgoingState)) return undefined;
  return { ...base, state: entry.state as OutgoingState, createdAt: number(entry.createdAt),
    resolvedAt: typeof entry.resolvedAt === "number" ? entry.resolvedAt : null,
    expiresAt: number(entry.expiresAt) };
}

/** Validate `GET /api/messenger/state` (also the WebSocket welcome's state). */
export function parseMessengerState(value: unknown): MessengerState {
  if (!record(value) || !record(value.me)) invalid("STATE");
  const me = person(value.me);
  if (!me) invalid("STATE");
  const limits = record(value.limits) ? value.limits : {};
  return {
    me,
    settings: parseSettings(value.settings),
    friends: list(value.friends, parseFriend),
    incoming: list(value.incoming, entry => {
      const base = person(entry);
      return base && { ...base, createdAt: number(entry.createdAt), expiresAt: number(entry.expiresAt) };
    }),
    outgoing: list(value.outgoing, parseOutgoing),
    blocks: list(value.blocks, entry => {
      const base = person(entry);
      return base && { ...base, since: number(entry.since) };
    }),
    conversations: list(value.conversations, entry => {
      const accountId = text(entry.accountId);
      if (!accountId) return undefined;
      return { accountId, nickname: text(entry.nickname), lastMessageId: number(entry.lastMessageId),
        lastMessageAt: number(entry.lastMessageAt), unread: Math.max(0, Math.floor(number(entry.unread))),
        lastReadId: number(entry.lastReadId) };
    }),
    limits: Object.fromEntries(Object.entries(DEFAULT_LIMITS).map(([key, fallback]) =>
      [key, Math.max(0, Math.floor(number(limits[key], fallback)))])) as unknown as MessengerLimits,
    serverTime: number(value.serverTime, Date.now()),
  };
}

/** The part of BrowserAccountSession the API needs. */
export interface MessengerSession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
}

export type FriendRequestResult =
  | { accepted: false; request: OutgoingRequest }
  | { accepted: true; friend: Friend };

const BASE = "/api/messenger";

export class MessengerApi {
  constructor(readonly session: MessengerSession) {}

  private post(path: string, body: unknown = {}): Promise<unknown> {
    return this.session.requestJson(`${BASE}${path}`, { method: "POST", body: JSON.stringify(body) });
  }

  async state(): Promise<MessengerState> {
    return parseMessengerState(await this.session.requestJson(`${BASE}/state`));
  }

  async requestFriend(nickname: string): Promise<FriendRequestResult> {
    const body = await this.post("/friends/request", { nickname });
    if (record(body) && body.accepted === true && record(body.friend)) {
      const friend = parseFriend(body.friend);
      if (friend) return { accepted: true, friend };
    }
    const request = record(body) && record(body.request) ? parseOutgoing(body.request) : undefined;
    if (request) return { accepted: false, request };
    invalid("REQUEST");
  }

  async respond(accountId: string, accept: boolean): Promise<void> {
    await this.post("/friends/respond", { accountId, accept });
  }

  async cancelRequest(accountId: string): Promise<void> {
    await this.post("/friends/cancel", { accountId });
  }

  async removeFriend(accountId: string): Promise<void> {
    await this.post("/friends/remove", { accountId });
  }

  async setFavorite(accountId: string, favorite: boolean): Promise<void> {
    await this.post("/friends/favorite", { accountId, favorite });
  }

  /** 整理发件箱: the number of answered cards removed. */
  async clearOutbox(): Promise<number> {
    const body = await this.post("/outbox/clear");
    return record(body) ? Math.max(0, Math.floor(number(body.deleted))) : 0;
  }

  async block(accountId: string): Promise<void> {
    await this.post("/blocks/add", { accountId });
  }

  async unblock(accountId: string): Promise<void> {
    await this.post("/blocks/remove", { accountId });
  }

  async saveSettings(settings: MessengerSettings): Promise<MessengerSettings> {
    return parseSettings(await this.session.requestJson(`${BASE}/settings`,
      { method: "PUT", body: JSON.stringify(settings) }));
  }

  /** One page of a conversation, oldest first; `before` pages back from a message id. */
  async messages(withId: string, before?: number, limit = 30):
    Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const query = new URLSearchParams({ with: withId, limit: String(limit) });
    if (before !== undefined) query.set("before", String(before));
    const body = await this.session.requestJson(`${BASE}/messages?${query}`);
    if (!record(body)) invalid("MESSAGES");
    return { messages: list(body.messages, entry => parseMessage(entry)), hasMore: body.hasMore === true };
  }

  async send(to: string, text: string, clientId: string): Promise<ChatMessage> {
    const body = await this.post("/messages", { to, text, clientId });
    const message = record(body) ? parseMessage(body.message) : undefined;
    if (!message) invalid("MESSAGE");
    return message;
  }

  async read(withId: string, upTo: number): Promise<void> {
    await this.post("/read", { with: withId, upTo });
  }

  /** 退出: the room leaves the list and its log is cleared for this account. */
  async hideConversation(withId: string): Promise<void> {
    await this.post("/conversations/hide", { with: withId });
  }
}
