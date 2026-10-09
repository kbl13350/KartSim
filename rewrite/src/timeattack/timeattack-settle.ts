/**
 * Time attack rewards (server-go/ECONOMY.md 2.2, 7.7): a finished run is
 * settled by the data service, which decides the reward and "new record"
 * itself; the result panel's RP/Lucci slots then show what was credited.
 */
import { errorCode } from "../account/account-api";
import { showAccountToast, type OverlayDocument } from "../account/account-dialogs";
import { activeBrowserSession } from "../account/account-runtime";
import { newRequestId, settleTimeAttack, type SettleSession, type TimeAttackSettlement } from "../account/rewards";
import { accountErrorMessages, formatAccountServiceError } from "../multiplayer/account-ui-support";

export interface ResultRewardTarget {
  patch?(values: Record<string, unknown>): void;
}

export interface TimeAttackSettleOptions {
  session?: SettleSession & { refresh?(): Promise<void> };
  trackId?: string;
  elapsedMs: number;
  result?: ResultRewardTarget;
  report?(message: string): void;
  notify?(message: string): void;
  /** Wait before the single retry of an unreachable service. */
  retryDelayMs?: number;
}

/**
 * Runs shorter than this earn nothing; the data service refuses them with
 * 400 INVALID_ELAPSED_MS (server-go internal/shared/rewards MinTimeAttackMs).
 */
export const MIN_REWARDED_TIME_ATTACK_MS = 10_000;

/** `POST /api/timeattack/settle` refusals beyond the shared account messages. */
const SETTLE_ERROR_MESSAGES: Record<string, string> = {
  ...accountErrorMessages,
  INVALID_ELAPSED_MS: "成绩时间无效，本次不发放奖励。",
  INVALID_TRACK: "该赛道不发放计时赛奖励。",
  INVALID_REQUEST_ID: "结算请求无效，请重新完成一次比赛。",
  TOO_MANY_ATTEMPTS: "结算过于频繁，请稍后再试。",
  REQUEST_ID_CONFLICT: "结算请求编号冲突，本次不发放奖励。",
};

/**
 * Refusals that only mean "this run earns nothing" (a run settled within 10 s
 * of the previous one or faster than its own time, a track without rewards):
 * the panel keeps the release " +0" and no error is shown.
 */
const NO_REWARD_CODES: ReadonlySet<string> = new Set(["TOO_MANY_ATTEMPTS", "INVALID_TRACK"]);

/** The Chinese text for a settle failure (the service answers with error codes). */
export function settleErrorMessage(error: unknown): string {
  return formatAccountServiceError(error, SETTLE_ERROR_MESSAGES);
}

/** Settle one finished run; resolves undefined without an account, a track or a valid time. */
export async function settleTimeAttackRun(options: TimeAttackSettleOptions):
  Promise<TimeAttackSettlement | undefined> {
  const session = options.session;
  if (!session || !options.trackId || !Number.isFinite(options.elapsedMs)) return undefined;
  // Not sent at all: the service would only answer INVALID_ELAPSED_MS, shown as an error.
  if (options.elapsedMs < MIN_REWARDED_TIME_ATTACK_MS) return undefined;
  const requestId = newRequestId();
  const run = { trackId: options.trackId, elapsedMs: options.elapsedMs, requestId };
  let settlement: TimeAttackSettlement;
  try {
    try {
      settlement = await settleTimeAttack(session, run);
    } catch (error) {
      if (errorCode(error) !== "DATA_SERVICE_UNAVAILABLE") throw error;
      // The same request ID makes the retry safe if the first one was credited.
      await new Promise(resolve => setTimeout(resolve, options.retryDelayMs ?? 1_500));
      settlement = await settleTimeAttack(session, run);
    }
  } catch (error) {
    if (NO_REWARD_CODES.has(errorCode(error) ?? "")) return undefined;
    options.report?.(`计时赛奖励结算失败：${settleErrorMessage(error)}`);
    return undefined;
  }
  options.result?.patch?.({ rewardExp: settlement.exp, rewardLucci: settlement.lucci });
  if (!settlement.summary) await session.refresh?.().catch(() => undefined);
  if (settlement.capped && settlement.exp === 0 && settlement.lucci === 0)
    options.notify?.("今日计时赛奖励次数已用完，明天再来吧。");
  return settlement;
}

/** Browser wiring for showTimeAttackResult: the signed-in account and a page toast. */
export function settleBrowserTimeAttackRun(trackId: string | undefined, elapsedMs: number,
  result: ResultRewardTarget | undefined, report: (message: string) => void):
  Promise<TimeAttackSettlement | undefined> {
  const session = activeBrowserSession();
  if (!session) return Promise.resolve(undefined);
  return settleTimeAttackRun({
    session, trackId, elapsedMs, result, report,
    notify: message => {
      if (typeof document !== "undefined")
        showAccountToast(document as unknown as OverlayDocument, message);
    },
  });
}
