/**
 * The 赛车探险队 (racing expedition) on the data service: the week's
 * missions (GET /api/expedition), what the account can send (GET
 * /api/expedition/crew), departing, 探险币 actions and rewards. The bonus
 * functions mirror server-go/internal/data/expedition/bonus.go so a crew's
 * effect shows before it departs; the server decides.
 */
import type { InventoryItem } from "../account/account-session";
import type { MyRoomSession } from "./myroom-api";

export type ExpeditionState = "ready" | "blocked" | "running" | "done";

export interface ExpeditionPair { character: number; kart: number; kartKey?: string }

export interface ExpeditionItem { category: number; itemId: number; count: number; days: number; name: string }

export interface ExpeditionBonus { time: number; reward: number; points: number }

export interface ExpeditionMission {
  slot: number;
  mission: number;
  /** Attribute 0-7 (都市 世界 大地 森林 海洋 传说 神秘 特殊). */
  specific: number;
  trackId: string;
  theme: number;
  /** 0 exp, 1 lucci, 2 both. */
  bonusType: number;
  difficulty: number;
  hours: number;
  added: boolean;
  state: ExpeditionState;
  started: number;
  ends: number;
  crew: ExpeditionPair[];
  friend: string;
  bonus: ExpeditionBonus;
  exp: number;
  lucci: number;
  reward: { stockId: number; name: string; items: ExpeditionItem[] };
  completeCost: number;
}

export interface ExpeditionRules {
  basic: { weeklyMissions: number; buyableMissions: number; addMissionTokens: number; reduceTimeTokens: number;
    reduceMinutes: number; changeMissionTokens: number; token: { category: number; item: number } };
  constants: { rp: number; lucci: number; rpLucci: number; character: number; characterMatched: number;
    characterUnmatched: number };
  kartTuning: Map<number, number[]>;
  parts: Map<number, number[]>;
  rewards: Map<number, number>;
  maxTimeBonus: number;
  weeklyTokens: number;
}

export interface ExpeditionView {
  missions: ExpeditionMission[];
  started: number;
  limit: number;
  added: number;
  canAdd: boolean;
  tokens: number;
  weekStart: number;
  weekEnds: number;
  dayEnds: number;
  serverTime: number;
  rules: ExpeditionRules;
}

export interface ExpeditionCharacter { itemId: number; specific: number }
export interface ExpeditionKart { itemId: number; kartKey?: string; specific: number; level: number; parts: number }
export interface ExpeditionFriend {
  accountId: string; nickname: string; specific: number; character: number; kart: number; usedToday: boolean;
}
export interface ExpeditionCrew {
  characters: ExpeditionCharacter[];
  karts: ExpeditionKart[];
  friends: ExpeditionFriend[];
}

export interface ExpeditionClaim {
  expedition: ExpeditionView;
  exp: number;
  lucci: number;
  items: ExpeditionItem[];
  inventory: InventoryItem[];
}

export type ExpeditionTokenAction = "reduce" | "complete" | "change" | "add";

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const int = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
const text = (value: unknown): string => typeof value === "string" ? value : "";
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter(record) : [];

function invalid(what: string): never {
  throw new Error(`探险队服务返回了无效的${what}。`);
}

const STATES = new Set<ExpeditionState>(["ready", "blocked", "running", "done"]);

function items(value: unknown): ExpeditionItem[] {
  return rows(value).map(item => ({ category: int(item.category), itemId: int(item.itemId),
    count: int(item.count, 1), days: int(item.days), name: text(item.name) }));
}

function table(value: unknown): Map<number, number[]> {
  const out = new Map<number, number[]>();
  if (record(value)) for (const [key, row] of Object.entries(value)) {
    if (Array.isArray(row) && row.length === 5 && row.every(cell => Number.isSafeInteger(cell)))
      out.set(Number(key), row as number[]);
  }
  return out;
}

export function parseExpeditionView(value: unknown): ExpeditionView {
  if (!record(value) || !Array.isArray(value.missions) || !record(value.rules)) invalid("探险队任务");
  const rules = value.rules;
  const basic = record(rules.basic) ? rules.basic : {};
  const token = record(basic.token) ? basic.token : {};
  const constants = record(rules.constants) ? rules.constants : {};
  const rewards = new Map<number, number>();
  if (record(rules.rewards)) for (const [key, reward] of Object.entries(rules.rewards)) rewards.set(Number(key), int(reward));
  return {
    missions: rows(value.missions).map(row => {
      const state = row.state as ExpeditionState;
      if (!STATES.has(state) || int(row.slot) <= 0) invalid("探险队任务");
      const bonus = record(row.bonus) ? row.bonus : {};
      const reward = record(row.reward) ? row.reward : {};
      return {
        slot: int(row.slot), mission: int(row.mission), specific: int(row.specific), trackId: text(row.trackId),
        theme: int(row.theme), bonusType: int(row.bonusType), difficulty: int(row.difficulty, 1),
        hours: int(row.hours), added: row.added === true, state, started: int(row.started), ends: int(row.ends),
        crew: rows(row.crew).map(pair => ({ character: int(pair.character), kart: int(pair.kart),
          ...(text(pair.kartKey) ? { kartKey: text(pair.kartKey) } : {}) })),
        friend: text(row.friend),
        bonus: { time: int(bonus.time), reward: int(bonus.reward), points: int(bonus.points) },
        exp: int(row.exp), lucci: int(row.lucci),
        reward: { stockId: int(reward.stockId), name: text(reward.name), items: items(reward.items) },
        completeCost: int(row.completeCost),
      };
    }),
    started: int(value.started), limit: int(value.limit), added: int(value.added), canAdd: value.canAdd === true,
    tokens: int(value.tokens), weekStart: int(value.weekStart), weekEnds: int(value.weekEnds),
    dayEnds: int(value.dayEnds), serverTime: int(value.serverTime),
    rules: {
      basic: {
        weeklyMissions: int(basic.weeklyMissions, 10), buyableMissions: int(basic.buyableMissions, 10),
        addMissionTokens: int(basic.addMissionTokens, 3), reduceTimeTokens: int(basic.reduceTimeTokens, 1),
        reduceMinutes: int(basic.reduceMinutes, 30), changeMissionTokens: int(basic.changeMissionTokens, 2),
        token: { category: int(token.category, 34), item: int(token.item, 879) },
      },
      constants: { rp: int(constants.rp), lucci: int(constants.lucci), rpLucci: int(constants.rpLucci),
        character: int(constants.character), characterMatched: int(constants.characterMatched),
        characterUnmatched: int(constants.characterUnmatched) },
      kartTuning: table(rules.kartTuning), parts: table(rules.parts), rewards,
      maxTimeBonus: int(rules.maxTimeBonus, 500), weeklyTokens: int(rules.weeklyTokens),
    },
  };
}

export function parseExpeditionCrew(value: unknown): ExpeditionCrew {
  if (!record(value)) invalid("探险队编队");
  return {
    characters: rows(value.characters).map(row => ({ itemId: int(row.itemId), specific: int(row.specific) })),
    karts: rows(value.karts).map(row => ({ itemId: int(row.itemId), specific: int(row.specific),
      level: int(row.level), parts: int(row.parts), ...(text(row.kartKey) ? { kartKey: text(row.kartKey) } : {}) })),
    friends: rows(value.friends).map(row => ({ accountId: text(row.accountId), nickname: text(row.nickname),
      specific: int(row.specific), character: int(row.character, 1), kart: int(row.kart),
      usedToday: row.usedToday === true })),
  };
}

export class ExpeditionApi {
  constructor(readonly session: MyRoomSession) {}

  private post(path: string, body: unknown): Promise<unknown> {
    return this.session.requestJson(path, { method: "POST", body: JSON.stringify(body) });
  }

  async view(): Promise<ExpeditionView> {
    return parseExpeditionView(await this.session.requestJson("/api/expedition"));
  }

  async crew(): Promise<ExpeditionCrew> {
    return parseExpeditionCrew(await this.session.requestJson("/api/expedition/crew"));
  }

  async start(slot: number, crew: ExpeditionPair[], friend?: string): Promise<ExpeditionView> {
    return parseExpeditionView(await this.post("/api/expedition/start", { slot, crew, friend: friend ?? "" }));
  }

  async tokens(action: ExpeditionTokenAction, slot: number, count = 0): Promise<ExpeditionView> {
    return parseExpeditionView(await this.post("/api/expedition/tokens", { action, slot, count }));
  }

  async claim(slot: number): Promise<ExpeditionClaim> {
    const body = await this.post("/api/expedition/claim", { slot });
    if (!record(body)) invalid("探险奖励");
    return { expedition: parseExpeditionView(body.expedition), exp: int(body.exp), lucci: int(body.lucci),
      items: items(body.items), inventory: rows(body.inventory) as unknown as InventoryItem[] };
  }
}

/* ---------- bonus.go, for the preview ---------- */

export interface CrewMember { characterSpecific: number; kartSpecific: number; kartLevel: number; kartParts: number }

export function characterBonus(rules: ExpeditionRules, mission: Pick<ExpeditionMission, "specific">,
  specific: number): number {
  const factor = specific === mission.specific ? rules.constants.characterMatched : rules.constants.characterUnmatched;
  return Math.trunc(rules.constants.character * factor / 1000);
}

export function kartBonus(rules: ExpeditionRules, mission: Pick<ExpeditionMission, "difficulty">, level: number,
  parts: number): ExpeditionBonus {
  const top = Math.max(0, ...rules.kartTuning.keys());
  const row = rules.kartTuning.get(Math.min(Math.max(level, 0), top));
  return { time: row?.[mission.difficulty - 1] ?? 0, reward: 0,
    points: rules.parts.get(parts)?.[mission.difficulty - 1] ?? 0 };
}

export function friendBonus(rules: ExpeditionRules, mission: Pick<ExpeditionMission, "specific">,
  specific: number): number {
  return specific === mission.specific ? rules.constants.character : Math.trunc(rules.constants.character / 2);
}

export function crewBonus(rules: ExpeditionRules, mission: Pick<ExpeditionMission, "specific" | "difficulty">,
  members: readonly CrewMember[], friendSpecific?: number): ExpeditionBonus {
  const total: ExpeditionBonus = { time: 0, reward: 0, points: 0 };
  for (const member of members) {
    total.reward += characterBonus(rules, mission, member.characterSpecific);
    const kart = kartBonus(rules, mission, member.kartLevel, member.kartParts);
    total.time += kart.time;
    total.points += kart.points;
  }
  if (friendSpecific !== undefined) total.reward += friendBonus(rules, mission, friendSpecific);
  total.time = Math.min(total.time, rules.maxTimeBonus);
  return total;
}

/** expeditionStartCondition: a matching character and a matching kart. */
export function crewDeparts(mission: Pick<ExpeditionMission, "specific">, members: readonly CrewMember[]): boolean {
  return members.some(member => member.characterSpecific === mission.specific) &&
    members.some(member => member.kartSpecific === mission.specific);
}

export function missionPayout(rules: ExpeditionRules, mission: Pick<ExpeditionMission, "difficulty" | "bonusType">,
  bonus: ExpeditionBonus): { exp: number; lucci: number } {
  const base = (rules.rewards.get(mission.difficulty) ?? 0) + bonus.points;
  const c = rules.constants;
  let exp = 0;
  let lucci = 0;
  if (mission.bonusType === 0) exp = Math.trunc(base * c.rp / 1000);
  else if (mission.bonusType === 1) lucci = Math.trunc(base * c.lucci / 1000);
  else {
    exp = Math.trunc(base * c.rp * c.rpLucci / 1_000_000);
    lucci = Math.trunc(base * c.lucci * c.rpLucci / 1_000_000);
  }
  const scale = (value: number) => Math.trunc((value * (1000 + bonus.reward) + 500) / 1000);
  return { exp: scale(exp), lucci: scale(lucci) };
}

/** The mission's hours after a time cut, in ms. */
export function missionDuration(mission: Pick<ExpeditionMission, "hours">, bonus: ExpeditionBonus): number {
  return Math.trunc(mission.hours * 3_600_000 * (1000 - bonus.time) / 1000);
}
