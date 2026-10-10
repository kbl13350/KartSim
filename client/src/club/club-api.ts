/**
 * The data service's 俱乐部 endpoints (server-go/CLUB.md): the account's club
 * and members, the 俱乐部目录, applications, member management and the
 * 俱乐部基地 (facilities, donations, welfare). Responses are validated here;
 * failures are AccountServiceErrors, worded by clubErrorMessage.
 */
import { AccountServiceError, errorCode, parseAccountSummary } from "../account/account-api";
import type { AccountSummary } from "../account/account-session";

export interface ClubSession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
  applySummary?(summary: AccountSummary): void;
}

/** Grades: 1 会长, 2 管理层, 3 优秀会员, 4 会员. */
export const GRADE_MASTER = 1;
export const GRADE_MANAGER = 2;
export const GRADE_FIRST = 3;
export const GRADE_MEMBER = 4;
/** Facilities: 0 总部, 1 赛事中心, 2 车手中心, 3 银行. */
export const FACILITIES = 4;

export interface ClubInfo {
  id: number;
  name: string;
  intro: string;
  mark: number;
  frame: number;
  level: number;
  facilities: number[];
  master: string;
  members: number;
  maxMembers: number;
  cs: number;
  csWeek: number;
  budget: number;
  autoJoin: boolean;
  breakAt: number;
  createdAt: number;
}

export interface ClubMember {
  accountId: string;
  nickname: string;
  grade: number;
  joinedAt: number;
  csWeek: number;
  csTotal: number;
  level: number;
  glove: string;
  online: boolean;
}

export interface ClubMe {
  clubId: number;
  grade: number;
  applied?: { id: number; name: string };
  cooldownUntil: number;
}

export interface ClubUpgrade { level: number; cs: number; lucci: number; members: number }
export interface ClubWelfare { slot: number; level: number; name: string; currency: string; amount: number }
export interface ClubMark { id: number; level: number; rank: number; order: number; basic: boolean }

export interface ClubRules {
  createLevel: number;
  createLucci: number;
  nameMin: number;
  nameMax: number;
  introMax: number;
  memberCaps: number[];
  budgetCaps: number[];
  donations: number[];
  upgrades: ClubUpgrade[];
  welfares: ClubWelfare[];
  nameChangeLucci: number;
  markChangeLucci: number;
  marks: ClubMark[];
  frames: ClubMark[];
}

export interface ClubState {
  me: ClubMe;
  club?: ClubInfo;
  members: ClubMember[];
  rules?: ClubRules;
}

export interface ClubDonation { nickname: string; amount: number; createdAt: number }

export interface ClubHouse {
  club: ClubInfo;
  grade: number;
  donations: ClubDonation[];
  topDonor: string;
  myDonations: number;
  donatedToday: boolean;
  welfareToday: number[];
}

const MESSAGES: Record<string, string> = {
  LOGIN_REQUIRED: "请先登录。",
  CLUB_NOT_FOUND: "申请的俱乐部已解散。",
  NOT_IN_CLUB: "尚未加入俱乐部。",
  ALREADY_IN_CLUB: "已有加入的俱乐部。",
  CLUB_NAME_TAKEN: "该俱乐部名已存在，无法使用。",
  INVALID_CLUB_NAME: "无法使用该名称。需最少输入2字，最多可输入10字。",
  INVALID_CLUB_INTRO: "无法使用该俱乐部简介。",
  INVALID_CLUB_MARK: "无法使用该俱乐部徽章。",
  CLUB_COOLDOWN: "退出24小时后才可以重新加入或创建俱乐部。",
  CLUB_FULL: "申请加入俱乐部失败。已超过俱乐部人数上限。",
  CLUB_APPLICANTS_FULL: "申请加入俱乐部失败。已超过申请人数上限。",
  CLUB_BREAKING: "该俱乐部处于申请解散期间。",
  NO_CLUB_APPLICATION: "没有申请记录。",
  CLUB_PERMISSION: "没有权限进行此操作。",
  CLUB_MASTER_CANNOT_LEAVE: "会长不能退出俱乐部，请解散俱乐部。",
  CLUB_BUDGET_LOW: "俱乐部预算不足。",
  CLUB_BUDGET_FULL: "已超出俱乐部预算上限。请下次再进行捐助。",
  CLUB_DONATED_TODAY: "每日限捐1次。",
  INVALID_DONATION: "捐助金额无效。",
  CLUB_MAX_LEVEL: "已达到最高等级。",
  CLUB_HQ_LEVEL: "请先升级俱乐部总部。",
  CLUB_CS_LOW: "俱乐部活跃度不足。",
  CLUB_MEMBERS_LOW: "俱乐部会员人数不足。",
  CLUB_WELFARE_LOCKED: "赛事中心等级不足。",
  CLUB_WELFARE_CLAIMED: "已发放今天的福利道具。",
  CLUB_SAME_NAME: "该俱乐部名称与变更前俱乐部名称相同，请重新输入。",
  CLUB_SAME_MARK: "该俱乐部徽章与变更前的俱乐部徽章相同，请重新选择。",
  CLUB_LEVEL_REQUIRED: "七彩色星星手套以上玩家可创建俱乐部。",
  INSUFFICIENT_FUNDS: "您的金币不足。",
  CLUB_MEMBER_NOT_FOUND: "该车手已不在俱乐部中。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  DATA_SERVICE_UNAVAILABLE: "服务暂时不可用，请稍后再试。",
};

export function clubErrorMessage(error: unknown): string {
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
  if (typeof value !== "string") invalid(what);
  return value;
}

function list(value: unknown, what: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalid(what);
  return value;
}

export function parseClubInfo(value: unknown): ClubInfo {
  const row = record(value, "club");
  const facilities = list(row.facilities, "facilities").map(level => number(level, "facility"));
  return {
    id: number(row.id, "club id"), name: text(row.name, "club name"), intro: text(row.intro ?? "", "intro"),
    mark: number(row.mark, "mark"), frame: number(row.frame, "frame"), level: number(row.level, "level"),
    facilities: facilities.length === FACILITIES ? facilities : [1, 1, 1, 1],
    master: text(row.master ?? "", "master"), members: number(row.members, "members"),
    maxMembers: number(row.maxMembers, "max members"), cs: number(row.cs, "cs"), csWeek: number(row.csWeek, "cs week"),
    budget: number(row.budget, "budget"), autoJoin: row.autoJoin === true, breakAt: number(row.breakAt, "break at"),
    createdAt: number(row.createdAt, "created"),
  };
}

export function parseClubMember(value: unknown): ClubMember {
  const row = record(value, "member");
  return {
    accountId: text(row.accountId, "member id"), nickname: text(row.nickname, "nickname"),
    grade: number(row.grade, "grade"), joinedAt: number(row.joinedAt, "joined"), csWeek: number(row.csWeek, "cs week"),
    csTotal: number(row.csTotal, "cs total"), level: number(row.level, "level"),
    glove: typeof row.glove === "string" ? row.glove : "", online: row.online === true,
  };
}

function parseRules(value: unknown): ClubRules | undefined {
  if (value === undefined) return undefined;
  const row = record(value, "rules");
  const marks = (entries: unknown) => list(entries, "marks").map(entry => {
    const mark = record(entry, "mark");
    return { id: number(mark.id, "mark id"), level: number(mark.level, "mark level"), rank: number(mark.rank, "rank"),
      order: number(mark.order, "order"), basic: mark.basic === true };
  });
  return {
    createLevel: number(row.createLevel, "create level"), createLucci: number(row.createLucci, "create lucci"),
    nameMin: number(row.nameMin, "name min"), nameMax: number(row.nameMax, "name max"),
    introMax: number(row.introMax, "intro max"),
    memberCaps: list(row.memberCaps, "caps").map(cap => number(cap, "cap")),
    budgetCaps: list(row.budgetCaps, "budget caps").map(cap => number(cap, "budget cap")),
    donations: list(row.donations, "donations").map(amount => number(amount, "donation")),
    upgrades: list(row.upgrades, "upgrades").map(entry => {
      const upgrade = record(entry, "upgrade");
      return { level: number(upgrade.level, "upgrade level"), cs: number(upgrade.cs, "upgrade cs"),
        lucci: number(upgrade.lucci, "upgrade lucci"), members: number(upgrade.members, "upgrade members") };
    }),
    welfares: list(row.welfares, "welfares").map(entry => {
      const welfare = record(entry, "welfare");
      return { slot: number(welfare.slot, "slot"), level: number(welfare.level, "welfare level"),
        name: text(welfare.name, "welfare name"), currency: text(welfare.currency, "currency"),
        amount: number(welfare.amount, "amount") };
    }),
    nameChangeLucci: number(row.nameChangeLucci, "name change"), markChangeLucci: number(row.markChangeLucci, "mark change"),
    marks: marks(row.marks), frames: marks(row.frames),
  };
}

export function parseClubState(value: unknown): ClubState {
  const body = record(value, "club state");
  const me = record(body.me, "me");
  const applied = me.applied === undefined ? undefined : record(me.applied, "applied");
  const state: ClubState = {
    me: { clubId: number(me.clubId, "club id"), grade: number(me.grade, "grade"),
      cooldownUntil: number(me.cooldownUntil, "cooldown"),
      ...(applied ? { applied: { id: number(applied.id, "applied id"), name: text(applied.name, "applied name") } } : {}) },
    members: list(body.members, "members").map(parseClubMember),
  };
  if (body.club !== undefined) state.club = parseClubInfo(body.club);
  const rules = parseRules(body.rules);
  if (rules) state.rules = rules;
  return state;
}

export function parseClubHouse(value: unknown): ClubHouse {
  const row = record(value, "house");
  return {
    club: parseClubInfo(row.club), grade: number(row.grade, "grade"),
    donations: list(row.donations, "donations").map(entry => {
      const donation = record(entry, "donation");
      return { nickname: text(donation.nickname, "donor"), amount: number(donation.amount, "amount"),
        createdAt: number(donation.createdAt, "donated") };
    }),
    topDonor: typeof row.topDonor === "string" ? row.topDonor : "", myDonations: number(row.myDonations, "my donations"),
    donatedToday: row.donatedToday === true,
    welfareToday: list(row.welfareToday, "welfare today").map(slot => number(slot, "welfare slot")),
  };
}

function applyAccount(session: ClubSession, body: Json): void {
  if (body.account === undefined) return;
  try {
    session.applySummary?.(parseAccountSummary(body.account));
  } catch {
    // The club answer is still valid; the summary refreshes on the next read.
  }
}

async function send(session: ClubSession, path: string, method: string, payload?: unknown): Promise<Json> {
  const body = await session.requestJson(path, payload === undefined ? { method }
    : { method, body: JSON.stringify(payload) });
  const value = record(body, path);
  applyAccount(session, value);
  return value;
}

/** The club API over a session. */
export class ClubApi {
  constructor(readonly session: ClubSession) {}

  async state(): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club", "GET"));
  }

  async list(query: { name?: string; master?: string; page: number }):
    Promise<{ clubs: ClubInfo[]; total: number; page: number; perPage: number }> {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.name) params.set("name", query.name);
    if (query.master) params.set("master", query.master);
    const body = await send(this.session, `/api/club/list?${params}`, "GET");
    return { clubs: list(body.clubs, "clubs").map(parseClubInfo), total: number(body.total, "total"),
      page: number(body.page, "page"), perPage: Math.max(1, number(body.perPage, "per page")) };
  }

  async info(id: number): Promise<ClubInfo> {
    return parseClubInfo(await send(this.session, `/api/club/info/${id}`, "GET"));
  }

  async create(input: { name: string; intro: string; mark: number; frame: number }): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club/create", "POST", input));
  }

  async apply(clubId: number): Promise<{ state: ClubState; joined: boolean }> {
    const body = await send(this.session, "/api/club/apply", "POST", { clubId });
    return { state: parseClubState(body), joined: body.joined === true };
  }

  async cancelApplication(): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club/apply/cancel", "POST", {}));
  }

  async applicants(): Promise<ClubMember[]> {
    const body = await send(this.session, "/api/club/applicants", "GET");
    return list(body.applicants, "applicants").map(parseClubMember);
  }

  async decide(accountId: string, accept: boolean): Promise<{ state: ClubState; applicants: ClubMember[] }> {
    const body = await send(this.session, "/api/club/applicants/decide", "POST", { accountId, accept });
    return { state: parseClubState(body), applicants: list(body.applicants, "applicants").map(parseClubMember) };
  }

  async leave(): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club/leave", "POST", {}));
  }

  async member(accountId: string, change: { grade: number } | { kick: true }): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club/members", "POST", { accountId, ...change }));
  }

  async update(change: { intro?: string; autoJoin?: boolean }): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club", "PUT", change));
  }

  async breakClub(): Promise<{ state: ClubState; immediate: boolean }> {
    const body = await send(this.session, "/api/club/break", "POST", {});
    return { state: parseClubState(body), immediate: body.immediate === true };
  }

  async cancelBreak(): Promise<ClubState> {
    return parseClubState(await send(this.session, "/api/club/break/cancel", "POST", {}));
  }

  async house(): Promise<{ house: ClubHouse; rules?: ClubRules }> {
    const body = await send(this.session, "/api/club/house", "GET");
    const rules = parseRules(body.rules);
    return { house: parseClubHouse(body.house), ...(rules ? { rules } : {}) };
  }

  async donate(amount: number): Promise<ClubHouse> {
    return parseClubHouse((await send(this.session, "/api/club/donate", "POST", { amount })).house);
  }

  async upgrade(facility: number): Promise<ClubHouse> {
    return parseClubHouse((await send(this.session, "/api/club/upgrade", "POST", { facility })).house);
  }

  async rename(name: string): Promise<ClubHouse> {
    return parseClubHouse((await send(this.session, "/api/club/name", "POST", { name })).house);
  }

  async changeMark(mark: number, frame: number): Promise<ClubHouse> {
    return parseClubHouse((await send(this.session, "/api/club/mark", "POST", { mark, frame })).house);
  }

  async welfare(slot: number): Promise<{ house: ClubHouse; welfare: ClubWelfare }> {
    const body = await send(this.session, "/api/club/welfare", "POST", { slot });
    const welfare = record(body.welfare, "welfare");
    return { house: parseClubHouse(body.house), welfare: { slot: number(welfare.slot, "slot"),
      level: number(welfare.level, "level"), name: text(welfare.name, "name"),
      currency: text(welfare.currency, "currency"), amount: number(welfare.amount, "amount") } };
  }
}

/** Grade names of stage_clubMain (clubMaster, manager, firstMember, member). */
export function gradeName(grade: number): string {
  return ["", "俱乐部会长", "俱乐部管理层", "俱乐部优秀会员", "俱乐部会员"][grade] ?? "";
}

/** "在线", "%d 分钟前"… from the member's online flag (no last-seen time here). */
export function onlineText(member: Pick<ClubMember, "online">): string {
  return member.online ? "在线" : "离线";
}

export function formatClubDate(ms: number): string {
  if (!ms) return "";
  const date = new Date(ms);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

/** "%d万" for whole ten-thousands, else the grouped number. */
export function formatLucci(amount: number): string {
  return amount % 10_000 === 0 && amount >= 10_000 ? `${amount / 10_000}万` : amount.toLocaleString("en-US");
}
