/**
 * The data service's taskbar menu endpoints: 奖励箱 (server-go
 * MENUS.md 1), 任务 (MENUS.md 2), 迷你提示窗 (MENUS.md 3) and 查找车手's
 * rider card. Responses are validated here; failures are
 * AccountServiceErrors, worded by menuErrorMessage.
 */
import { AccountServiceError, errorCode, parseAccountSummary } from "../account/account-api";
import type { AccountSummary } from "../account/account-session";

export interface MenuSession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
  applySummary?(summary: AccountSummary): void;
}

/** Reward sources (rewardMajorType 任务 4, 俱乐部基地 9, 游戏活动 3). */
export type RewardSource = "quest" | "club" | "admin";

export interface RewardBoxEntry {
  id: number;
  source: RewardSource | string;
  message: string;
  name: string;
  category: number;
  itemId: number;
  count: number;
  /** Rental days of the item; 0 for good. */
  days: number;
  currency?: string;
  createdAt: number;
  expiresAt: number;
}

export interface RewardBox {
  entries: RewardBoxEntry[];
  /** Storage days ("保管时间"). */
  days: number;
  /** Entries a claim may take. */
  page: number;
}

export interface ClaimedItem { name: string; count: number; currency?: string; days?: number }

export interface RewardBoxClaim {
  claimed: RewardBoxEntry[];
  items: ClaimedItem[];
  entries: RewardBoxEntry[];
}

export interface QuestReward {
  name: string;
  category: number;
  itemId: number;
  count: number;
  days: number;
  currency?: string;
  emblem?: number;
}

/** Quest kinds (QuestAutomation type). */
export const QUEST_DRIVE = 1;
export const QUEST_FINISH = 2;
export const QUEST_DISTANCE = 3;
export const QUEST_RANK = 4;
export const QUEST_WIN = 8;

export interface Quest {
  id: number;
  reset: "daily" | "weekly" | "none" | string;
  kind: number;
  target: number;
  rank: number;
  channels: string[];
  pre: number;
  title: string;
  desc: string;
  mission: string;
  rewards: QuestReward[];
  value: number;
  completedAt: number;
  locked: boolean;
  periodStart: number;
  periodEnd: number;
}

export interface QuestList { quests: Quest[]; resetHour: number }

export interface MiniNotice { title: string; message: string; kind: "notice" | "quest" | "rewardBox" | string }

export interface RiderCard {
  nickname: string;
  level: number;
  glove: string;
  gloveName: string;
  license: number;
  proUntil: number;
  createdAt: number;
  stats: { races: number; wins: number; podiums: number; points: number };
  mainEmblems: number[];
  /** online, offline or ingame. */
  presence: string;
  self: boolean;
  club?: { id: number; name: string; mark: number; frame: number; level: number; grade: number };
}

const MESSAGES: Record<string, string> = {
  LOGIN_REQUIRED: "请先登录。",
  REWARD_BOX_EMPTY: "没有可以领取的道具。",
  INVALID_CLAIM: "领取道具失败。",
  UNKNOWN_RIDER: "找不到该车手。",
  INVALID_NICKNAME: "请输入车手名称。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  DATA_SERVICE_UNAVAILABLE: "服务暂时不可用，请稍后再试。",
};

export function menuErrorMessage(error: unknown): string {
  const code = typeof error === "string" ? error : errorCode(error) ?? "";
  return MESSAGES[code] ?? `操作失败（${code || "未知错误"}），请稍后再试。`;
}

type Json = Record<string, unknown>;

function invalid(what: string): never {
  throw new AccountServiceError("INVALID_RESPONSE", 0, what);
}

function record(value: unknown, what: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(what);
  return value as Json;
}

function number(value: unknown, what: string): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(what);
  return value;
}

function text(value: unknown, what: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") invalid(what);
  return value;
}

function list(value: unknown, what: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(what);
  return value;
}

export function parseRewardBoxEntry(value: unknown): RewardBoxEntry {
  const row = record(value, "reward box entry");
  const currency = text(row.currency, "currency");
  return {
    id: number(row.id, "id"), source: text(row.source, "source"), message: text(row.message, "message"),
    name: text(row.name, "name"), category: number(row.category, "category"), itemId: number(row.itemId, "item id"),
    count: number(row.count, "count"), days: number(row.days, "days"), ...(currency ? { currency } : {}),
    createdAt: number(row.createdAt, "created"), expiresAt: number(row.expiresAt, "expires"),
  };
}

function parseReward(value: unknown): QuestReward {
  const row = record(value, "reward");
  const currency = text(row.currency, "currency");
  const emblem = number(row.emblem, "emblem");
  return {
    name: text(row.name, "reward name"), category: number(row.category, "category"),
    itemId: number(row.itemId, "item id"), count: number(row.count, "count"), days: number(row.days, "days"),
    ...(currency ? { currency } : {}), ...(emblem ? { emblem } : {}),
  };
}

export function parseQuest(value: unknown): Quest {
  const row = record(value, "quest");
  return {
    id: number(row.id, "quest id"), reset: text(row.reset, "reset"), kind: number(row.kind, "kind"),
    target: number(row.target, "target"), rank: number(row.rank, "rank"),
    channels: list(row.channels, "channels").map(channel => text(channel, "channel")),
    pre: number(row.pre, "pre"), title: text(row.title, "title"), desc: text(row.desc, "desc"),
    mission: text(row.mission, "mission"), rewards: list(row.rewards, "rewards").map(parseReward),
    value: number(row.value, "value"), completedAt: number(row.completedAt, "completed"), locked: row.locked === true,
    periodStart: number(row.periodStart, "period start"), periodEnd: number(row.periodEnd, "period end"),
  };
}

export function parseRiderCard(value: unknown): RiderCard {
  const row = record(value, "rider");
  const progress = record(row.progress, "progress");
  const stats = row.stats === undefined ? {} : record(row.stats, "stats");
  const card: RiderCard = {
    nickname: text(row.nickname, "nickname"), level: Math.max(1, number(progress.level, "level")),
    glove: text(progress.glove, "glove"), gloveName: text(progress.gloveName, "glove name"),
    license: number(progress.license, "license"), proUntil: number(progress.proUntil, "pro until"),
    createdAt: number(row.createdAt, "created"),
    stats: { races: number(stats.races, "races"), wins: number(stats.wins, "wins"),
      podiums: number(stats.podiums, "podiums"), points: number(stats.points, "points") },
    mainEmblems: list(row.mainEmblems, "emblems").map(id => number(id, "emblem")),
    presence: text(row.presence, "presence") || "offline", self: row.self === true,
  };
  if (row.club !== undefined) {
    const club = record(row.club, "club");
    card.club = { id: number(club.id, "club id"), name: text(club.name, "club name"), mark: number(club.mark, "mark"),
      frame: number(club.frame, "frame"), level: number(club.level, "club level"), grade: number(club.grade, "grade") };
  }
  return card;
}

async function send(session: MenuSession, path: string, method: string, payload?: unknown): Promise<Json> {
  const body = await session.requestJson(path, payload === undefined ? { method }
    : { method, body: JSON.stringify(payload) });
  const value = record(body, path);
  if (value.account !== undefined) {
    try {
      session.applySummary?.(parseAccountSummary(value.account));
    } catch {
      // The answer is still valid; the summary refreshes on the next read.
    }
  }
  return value;
}

/** The taskbar menus' API over a session. */
export class MenusApi {
  constructor(readonly session: MenuSession) {}

  async rewardBox(): Promise<RewardBox> {
    const body = await send(this.session, "/api/reward-box", "GET");
    return { entries: list(body.entries, "entries").map(parseRewardBoxEntry),
      days: number(body.days, "days") || 30, page: number(body.page, "page") || 8 };
  }

  async claimRewardBox(ids: number[]): Promise<RewardBoxClaim> {
    const body = await send(this.session, "/api/reward-box/claim", "POST", { ids });
    const claim = record(body.claim, "claim");
    return {
      claimed: list(claim.claimed, "claimed").map(parseRewardBoxEntry),
      items: list(claim.items, "items").map(entry => {
        const item = record(entry, "item");
        const currency = text(item.currency, "currency");
        return { name: text(item.name, "item name"), count: number(item.count, "item count"),
          ...(currency ? { currency } : {}), days: number(item.days, "item days") };
      }),
      entries: list(body.entries, "entries").map(parseRewardBoxEntry),
    };
  }

  async quests(): Promise<QuestList> {
    const body = await send(this.session, "/api/quests", "GET");
    return { quests: list(body.quests, "quests").map(parseQuest), resetHour: number(body.resetHour, "reset hour") || 6 };
  }

  async notices(): Promise<{ notices: MiniNotice[]; rewardBox: number }> {
    const body = await send(this.session, "/api/notices", "GET");
    return {
      notices: list(body.notices, "notices").map(entry => {
        const notice = record(entry, "notice");
        return { title: text(notice.title, "title"), message: text(notice.message, "message"),
          kind: text(notice.kind, "kind") };
      }),
      rewardBox: number(body.rewardBox, "reward box"),
    };
  }

  async rider(nickname: string): Promise<RiderCard> {
    return parseRiderCard(await send(this.session, `/api/riders/${encodeURIComponent(nickname)}`, "GET"));
  }
}
