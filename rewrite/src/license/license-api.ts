/**
 * The data service's 驾照考试 endpoints (server-go/RIDER_SCHOOL.md): the rider
 * school table and the account's standing (GET /api/license), a cleared step
 * (POST /api/license/run), taking a license (POST /api/license/take), a PRO
 * qualification time trial (POST /api/license/qualify) and the PRO
 * qualification emblem (POST /api/license/emblem). Responses are validated
 * here; failures are AccountServiceErrors, worded by licenseErrorMessage.
 */
import { AccountServiceError, errorCode, parseAccountSummary } from "../account/account-api";
import type { AccountSummary } from "../account/account-session";

export interface LicenseSession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
  applySummary?(summary: AccountSummary): void;
}

/** License levels: 1 新手, 2 初级, 3 L3, 4 L2, 5 L1, 6 PRO. */
export const PRO_LEVEL = 6;
export const LICENSE_NAMES = ["新手", "初级", "L3", "L2", "L1", "PRO"] as const;

/** time: inside timeMs (0 none); rival: before the rival ghost; finish: reach the goal. */
export type LicenseRule = "time" | "rival" | "finish";

export interface LicenseStep {
  step: number;
  /** The release mission id (20 time trial, 21 duel, 0/22 driving, others item missions). */
  mission: number;
  rule: LicenseRule;
  name: string;
  /** Step card icon: stage_mainMenu riderSchool/<icon>_1…4. */
  icon: string;
  track: string;
  /** 0: the track's own laps. */
  laps: number;
  speed: number;
  timeMs: number;
  stockId: number;
  rival?: { kartId: number; characterId: number; ksv: string };
  rivalMs?: number;
}

export interface LicenseDefinition {
  level: number;
  name: string;
  steps: LicenseStep[];
}

export interface LicenseQualify { track: string; speed: number; timeMs: number }

export interface LicenseTable {
  licenses: LicenseDefinition[];
  pro: { emblemId: number; qualify: LicenseQualify[] };
  proDays: number;
  /** Reward stock names by stock id. */
  rewards: Map<number, string>;
}

export interface LicenseClear { step: number; bestMs: number; clearedAt: number }

export interface LicenseState {
  /** The license held now (PRO while it lasts). */
  level: number;
  /** The highest of 新手 … L1 taken. */
  baseLevel: number;
  tryLevel: number;
  proUntil: number;
  proPeriod: string;
  proCount: number;
  qualified: boolean;
  period: string;
  periodEnd: number;
  proSteps: number[];
  cleared: Map<number, LicenseClear>;
  records: Map<string, number>;
}

export interface LicenseRewardItem {
  category: number;
  itemId: number;
  name: string;
  count: number;
  days: number;
  currency?: string;
  owned?: boolean;
}

export interface LicenseRunResult {
  step: number;
  first: boolean;
  newBest: boolean;
  bestMs: number;
  reward?: { stockId: number; name: string; items: LicenseRewardItem[] };
}

const MESSAGES: Record<string, string> = {
  LOGIN_REQUIRED: "请先登录。",
  LICENSE_LOCKED: "还不能挑战这一项。请先完成前面的任务或驾照，并达到所需的等级手套。",
  MISSION_FAILED: "没有达成任务条件，任务失败。",
  TOO_MANY_ATTEMPTS: "提交过于频繁，请稍后再试。",
  LICENSE_INCOMPLETE: "完成所有任务后才能获得驾照。",
  LICENSE_HELD: "已经获得了这个驾照。",
  PRO_NOT_QUALIFIED: "还没有获得PRO等级挑战资格。",
  INVALID_STEP: "任务不存在。",
  INVALID_LEVEL: "驾照不存在。",
  INVALID_TRACK: "赛道不在资格审核范围内。",
  INVALID_ELAPSED_MS: "比赛时间无效。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  DATA_SERVICE_UNAVAILABLE: "服务暂时不可用，请稍后再试。",
};

export function licenseErrorMessage(error: unknown): string {
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

function integer(value: unknown, what: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) invalid(what);
  return value;
}

function optionalInteger(value: unknown, what: string): number {
  return value === undefined || value === null ? 0 : integer(value, what);
}

function text(value: unknown, what: string): string {
  if (typeof value !== "string") invalid(what);
  return value;
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) invalid(what);
  return value;
}

const RULES = new Set(["time", "rival", "finish"]);

function parseStep(value: unknown): LicenseStep {
  const row = record(value, "license step");
  const rule = text(row.rule, "step rule");
  if (!RULES.has(rule)) invalid("step rule");
  const step: LicenseStep = {
    step: integer(row.step, "step", 1), mission: integer(row.mission, "step mission"),
    rule: rule as LicenseRule, name: text(row.name, "step name"), icon: typeof row.icon === "string" ? row.icon : "",
    track: text(row.track, "step track"),
    laps: optionalInteger(row.laps, "step laps"), speed: optionalInteger(row.speed, "step speed"),
    timeMs: optionalInteger(row.timeMs, "step time"), stockId: integer(row.stockId, "step stock", 1),
  };
  if (row.rival !== undefined) {
    const rival = record(row.rival, "step rival");
    step.rival = { kartId: integer(rival.kartId, "rival kart"),
      characterId: integer(rival.characterId, "rival character"), ksv: text(rival.ksv, "rival ksv") };
    step.rivalMs = integer(row.rivalMs, "rival time", 1);
  }
  return step;
}

export function parseLicenseTable(value: unknown): LicenseTable {
  const table = record(value, "license table");
  const pro = record(table.pro, "license pro");
  const rewards = new Map<number, string>();
  for (const [key, name] of Object.entries(record(table.rewards, "license rewards")))
    rewards.set(Number(key), text(name, "reward name"));
  return {
    licenses: list(table.licenses, "licenses").map(entry => {
      const row = record(entry, "license");
      return { level: integer(row.level, "license level", 1), name: text(row.name, "license name"),
        steps: list(row.steps, "license steps").map(parseStep) };
    }),
    pro: {
      emblemId: integer(pro.emblemId, "pro emblem", 1),
      qualify: list(pro.qualify, "pro qualify").map(entry => {
        const row = record(entry, "qualify");
        return { track: text(row.track, "qualify track"), speed: integer(row.speed, "qualify speed"),
          timeMs: integer(row.timeMs, "qualify time", 1) };
      }),
    },
    proDays: integer(table.proDays, "pro days", 1),
    rewards,
  };
}

export function parseLicenseState(value: unknown): LicenseState {
  const state = record(value, "license state");
  const cleared = new Map<number, LicenseClear>();
  for (const entry of list(state.cleared, "cleared")) {
    const row = record(entry, "clear");
    const clear = { step: integer(row.step, "clear step", 1), bestMs: integer(row.bestMs, "clear best"),
      clearedAt: integer(row.clearedAt, "clear time") };
    cleared.set(clear.step, clear);
  }
  const records = new Map<string, number>();
  for (const entry of list(state.records, "records")) {
    const row = record(entry, "record");
    records.set(text(row.track, "record track"), integer(row.bestMs, "record best"));
  }
  return {
    level: integer(state.level, "level"), baseLevel: integer(state.baseLevel, "base level"),
    tryLevel: integer(state.tryLevel, "try level"), proUntil: integer(state.proUntil, "pro until"),
    proPeriod: text(state.proPeriod, "pro period"), proCount: integer(state.proCount, "pro count"),
    qualified: state.qualified === true, period: text(state.period, "period"),
    periodEnd: integer(state.periodEnd, "period end"),
    proSteps: list(state.proSteps ?? [], "pro steps").map(step => integer(step, "pro step", 1)),
    cleared, records,
  };
}

function applyAccount(session: LicenseSession, body: Json): void {
  if (body.account === undefined) return;
  try {
    session.applySummary?.(parseAccountSummary(body.account));
  } catch {
    // The standing is still valid; the summary refreshes on the next read.
  }
}

export async function fetchLicense(session: LicenseSession):
  Promise<{ table: LicenseTable; state: LicenseState }> {
  const body = record(await session.requestJson("/api/license"), "license");
  return { table: parseLicenseTable(body.table), state: parseLicenseState(body.state) };
}

function post(session: LicenseSession, path: string, payload: unknown): Promise<Json> {
  return session.requestJson(path, { method: "POST", body: JSON.stringify(payload) })
    .then(body => record(body, path));
}

export async function runLicenseStep(session: LicenseSession,
  run: { requestId: string; step: number; elapsedMs: number }):
  Promise<{ run: LicenseRunResult; state: LicenseState }> {
  const body = await post(session, "/api/license/run", { ...run, elapsedMs: Math.round(run.elapsedMs) });
  applyAccount(session, body);
  const result = record(body.run, "run");
  const reward = result.reward === undefined ? undefined : record(result.reward, "reward");
  return {
    run: {
      step: integer(result.step, "run step", 1), first: result.first === true,
      newBest: result.newBest === true, bestMs: integer(result.bestMs, "run best"),
      reward: reward && {
        stockId: integer(reward.stockId, "reward stock", 1), name: text(reward.name, "reward name"),
        items: list(reward.items, "reward items").map(entry => {
          const item = record(entry, "reward item");
          return { category: integer(item.category, "item category"), itemId: integer(item.itemId, "item id"),
            name: text(item.name, "item name"), count: integer(item.count, "item count"),
            days: integer(item.days, "item days"),
            ...(typeof item.currency === "string" ? { currency: item.currency } : {}),
            ...(item.owned === true ? { owned: true } : {}) };
        }),
      },
    },
    state: parseLicenseState(body.state),
  };
}

export async function takeLicense(session: LicenseSession, level: number):
  Promise<{ level: number; proUntil: number; state: LicenseState }> {
  const body = await post(session, "/api/license/take", { level });
  applyAccount(session, body);
  const taken = record(body.license, "license");
  return { level: integer(taken.level, "taken level"), proUntil: optionalInteger(taken.proUntil, "pro until"),
    state: parseLicenseState(body.state) };
}

export async function qualifyLicense(session: LicenseSession,
  run: { requestId: string; track: string; elapsedMs: number }):
  Promise<{ newBest: boolean; bestMs: number; state: LicenseState }> {
  const body = await post(session, "/api/license/qualify", { ...run, elapsedMs: Math.round(run.elapsedMs) });
  applyAccount(session, body);
  const result = record(body.record, "record");
  return { newBest: result.newBest === true, bestMs: integer(result.bestMs, "record best"),
    state: parseLicenseState(body.state) };
}

export async function claimLicenseEmblem(session: LicenseSession):
  Promise<{ granted: boolean; emblemId: number; state: LicenseState }> {
  const body = await post(session, "/api/license/emblem", {});
  applyAccount(session, body);
  return { granted: body.granted === true, emblemId: integer(body.emblemId, "emblem", 1),
    state: parseLicenseState(body.state) };
}

/** "1:05.32" for a race time. */
export function formatLicenseTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10));
  const minutes = Math.floor(total / 6000);
  const seconds = Math.floor(total / 100) % 60;
  const hundredths = total % 100;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
