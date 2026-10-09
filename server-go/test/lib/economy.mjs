// Account-economy rules mirrored from internal/shared/rewards and
// internal/data/economy (server-go/ECONOMY.md 1, 2 and 4), so the end-to-end
// scripts can predict exact rewards, levels and level-up gifts and check
// the services against them. Pure functions; the level table is read from
// the committed internal/data/economy/levels.json (the same file kart-data
// embeds). Unit tests: node --test test/lib/economy.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The three wallet currencies (ECONOMY.md 0). */
export const CURRENCIES = ["coupon", "lucci", "koin"];

/** New-rider whitelist and the free practice kart (ECONOMY.md 4). */
export const STARTER = Object.freeze({
  kart: Object.freeze({ category: 3, itemId: 0, systemKey: "practiceKart" }),
  characters: Object.freeze([2, 3]),
  paints: Object.freeze([6, 4, 5, 7]),
  dyes: Object.freeze([6, 4, 5, 7]),
});
export const CATEGORY = Object.freeze({ character: 1, paint: 2, kart: 3, dye: 70 });

/** Rewards of ECONOMY.md 2 (internal/shared/rewards). */
export const RACE = Object.freeze({
  finishedExpBase: 30, finishedExpPlace: 50, finishedExpPerRacer: 5,
  finishedLucciBase: 40, finishedLucciPlace: 80, finishedLucciPerRacer: 10,
  unfinishedExp: 10, unfinishedLucci: 10, combineExpBonus: 1.1, winningTeamBonus: 1.2,
  dailyExpCap: 20_000, dailyLucciCap: 30_000,
  // Anti-farming (game node, internal/game/lobby): a finish counts only after
  // 10 s of server-observed racing and with an elapsedMs at most 3 s shorter
  // than that; otherwise the racer earns the unfinished reward.
  minRewardedRaceMs: 10_000, finishToleranceMs: 3_000,
  // The largest base entry the data service credits (8 racers, *Combine,
  // winning team, rank 1); larger entries are dropped.
  maxEntryExp: 145, maxEntryLucci: 216,
  // Settlements finished longer ago than this are stored without rewards.
  staleSettlementMs: 86_400_000,
});
export const TIME_ATTACK = Object.freeze({
  exp: 10, lucci: 20, newRecordExtraExp: 20, newRecordExtraLucci: 50,
  minElapsedMs: 10_000, dailyRewardedRuns: 50,
  // Pacing (store.SettleTimeAttack): a run is refused with 429
  // TOO_MANY_ATTEMPTS less than minIntervalMs, or less than its own time
  // minus toleranceMs, after the account's previous settled run.
  minIntervalMs: 10_000, toleranceMs: 3_000,
});

/**
 * How long after the previous settled time-attack run a run of `elapsedMs`
 * may be settled (ECONOMY.md 2.2 pacing).
 */
export function timeAttackPacingMs(elapsedMs) {
  return Math.max(TIME_ATTACK.minIntervalMs, elapsedMs - TIME_ATTACK.toleranceMs);
}

/**
 * Whether a finish counts as finished for the rewards (ECONOMY.md 2.1):
 * `observedMs` is the race time the game node saw (finish arrival − startAt).
 */
export function finishCounts(observedMs, elapsedMs) {
  return observedMs >= RACE.minRewardedRaceMs && elapsedMs >= observedMs - RACE.finishToleranceMs;
}
export const STARTING_LUCCI = 10_000;

const defaultLevelsPath = join(dirname(fileURLToPath(import.meta.url)),
  "../../internal/data/economy/levels.json");

/** Reads levels.json: {levels:[{level,nextExp,glove,gloveName}], rpLimit, koinRewards}. */
export function loadLevels(path = defaultLevelsPath) {
  const document = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(document.levels) || document.levels.length < 2 ||
      !Number.isSafeInteger(document.rpLimit)) {
    throw new Error(`${path} is not a levels.json document`);
  }
  return {
    levels: document.levels,
    rpLimit: document.rpLimit,
    koinRewards: Object.fromEntries(Object.entries(document.koinRewards ?? {})
      .map(([level, koin]) => [Number(level), koin])),
    version: document.version,
  };
}

/** The highest displayed level. */
export const maxLevel = table => table.levels.length - 1;

/**
 * economy.Levels.LevelForExp: the table level L is the largest with
 * exp >= nextExp[L-1] (nextExp[-1] = 0), displayed as max(1, L); exp is
 * clamped to [0, rpLimit]. Returns the /api/account "progress" fields.
 */
export function levelForExp(table, exp) {
  const clamped = Math.min(Math.max(exp, 0), table.rpLimit);
  const last = maxLevel(table);
  let tableLevel = last;
  for (let index = 0; index < last; index++) {
    if (table.levels[index].nextExp > clamped) { tableLevel = index; break; }
  }
  const level = Math.max(1, tableLevel);
  return {
    level, exp: clamped,
    levelExp: level > 1 ? table.levels[level - 1].nextExp : 0,
    nextLevelExp: level < last ? table.levels[level].nextExp : table.rpLimit,
    glove: table.levels[level].glove, gloveName: table.levels[level].gloveName, maxLevel: last,
  };
}

/**
 * Sum of the level-up gifts for every level in (fromLevel, toLevel]:
 * lucci 100 x level, koin from levelupreward@cn.xml, 50 coupons every 10th
 * level (economy.Levels.LevelUpRewards).
 */
export function levelUpRewards(table, fromLevel, toLevel) {
  const total = { lucci: 0, koin: 0, coupon: 0 };
  for (let level = Math.max(fromLevel, 1) + 1; level <= Math.min(toLevel, maxLevel(table)); level++) {
    total.lucci += 100 * level;
    total.koin += table.koinRewards[level] ?? 0;
    if (level % 10 === 0) total.coupon += 50;
  }
  return total;
}

/**
 * The wallet and progress an account should have after earning `exp` and
 * `lucci` (both already final, i.e. after rates and caps) on top of
 * `before` (an /api/account body), including level-up gifts.
 */
export function afterEarning(table, before, { exp = 0, lucci = 0, coupon = 0, koin = 0 }) {
  const oldProgress = levelForExp(table, before.progress.exp);
  const newProgress = levelForExp(table, before.progress.exp + exp);
  const gifts = levelUpRewards(table, oldProgress.level, newProgress.level);
  return {
    progress: newProgress,
    wallet: {
      coupon: before.wallet.coupon + coupon + gifts.coupon,
      lucci: before.wallet.lucci + lucci + gifts.lucci,
      koin: before.wallet.koin + koin + gifts.koin,
    },
    levelUps: newProgress.level - oldProgress.level,
    gifts,
  };
}

/** rewards.round: half up once, after every multiplier, with float tolerance. */
function roundHalfUp(value) {
  if (!(value > 0)) return 0;
  return Math.floor(Math.min(value, 1e15) + 0.5 + 1e-9);
}

const rate = value => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * rewards.ApplyRate: a base amount times a configured rate, rounded half up
 * (how the data service credits race rewards and the game node shows them).
 */
export function applyRate(amount, value) {
  return amount > 0 ? roundHalfUp(amount * rate(value)) : 0;
}

/**
 * The race.rewards a game node shows (ECONOMY.md 2.1): the base rewards of
 * rewards.RaceRewards (rounded once), scaled by `rates` with applyRate like
 * the data service credits them. racers: every racer who finished loading,
 * [{playerId, rank, finished, team}]; roadblock: {runnerId, runnerWon} for
 * roadblock races. Returns {playerId: {exp, lucci}}, the shape of
 * race.rewards in room snapshots.
 */
export function raceRewards({ channel, mode = "individual", winningTeam = 0, roadblock, racers,
  rates = { exp: 1, lucci: 1 } }) {
  const n = racers.length;
  const expBonus = channel.endsWith("Combine") ? RACE.combineExpBonus : 1;
  const result = {};
  for (const racer of racers) {
    let finished = racer.finished;
    let rank = racer.rank >= 1 && racer.rank <= n ? racer.rank : n;
    if (roadblock) {
      finished = true;
      const runner = racer.playerId === roadblock.runnerId;
      if (runner === roadblock.runnerWon) rank = 1;
      else rank = runner ? n : n / 2;
    }
    let exp = RACE.unfinishedExp;
    let lucci = RACE.unfinishedLucci;
    if (finished) {
      const p = n <= 1 ? 1 : Math.min(1, Math.max(0, (n - rank) / (n - 1)));
      const extra = Math.max(0, n - 2);
      exp = RACE.finishedExpBase + RACE.finishedExpPlace * p + RACE.finishedExpPerRacer * extra;
      lucci = RACE.finishedLucciBase + RACE.finishedLucciPlace * p + RACE.finishedLucciPerRacer * extra;
    }
    exp *= expBonus;
    if (mode === "team" && winningTeam !== 0 && racer.team === winningTeam) {
      exp *= RACE.winningTeamBonus;
      lucci *= RACE.winningTeamBonus;
    }
    result[racer.playerId] = {
      exp: applyRate(roundHalfUp(exp), rates.exp), lucci: applyRate(roundHalfUp(lucci), rates.lucci),
    };
  }
  return result;
}

/** rewards.TimeAttackRewards for one valid run (ECONOMY.md 2.2). */
export function timeAttackRewards(newRecord, rates = { exp: 1, lucci: 1 }) {
  const exp = TIME_ATTACK.exp + (newRecord ? TIME_ATTACK.newRecordExtraExp : 0);
  const lucci = TIME_ATTACK.lucci + (newRecord ? TIME_ATTACK.newRecordExtraLucci : 0);
  return { exp: roundHalfUp(exp * rate(rates.exp)), lucci: roundHalfUp(lucci * rate(rates.lucci)) };
}

/** True when an inventory entry has not expired at `now` (expiresAt null = permanent). */
export const activeItem = (item, now = Date.now()) => item.expiresAt === null || item.expiresAt > now;

/** Finds an inventory entry; systemKey undefined matches entries without one. */
export function findItem(items, category, itemId, systemKey) {
  return items.find(item => item.category === category && item.itemId === itemId &&
    (item.systemKey ?? "") === (systemKey ?? ""));
}
