/**
 * The time attack result panel's reward slots (stage_/timeAttack
 * mq_window@zz reward_timeAttack: CharPanel RP and Lucci). The release always
 * drew " +0"; a signed-in account shows what the data service credited.
 */

export interface TimeAttackRewardValues {
  rewardExp?: unknown;
  rewardLucci?: unknown;
}

/** " +N" in the CharPanel font ("0123456789+"); missing or invalid amounts read 0. */
export function timeAttackRewardText(value: unknown): string {
  const amount = typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value : 0;
  return ` +${amount}`;
}
