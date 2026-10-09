/**
 * My Room careers (成就) and emblems (徽章) on the data service: the signed-in
 * rider's own lists (GET /api/careers, /api/emblems), completing a career
 * (点击完成) and choosing representative emblems, and a visitor's read-only
 * view of another rider's lists behind the room's 车库/徽章/图鉴/成就是否公开
 * password (POST /api/myroom/careers, /api/myroom/emblems). The 道具图鉴 (item
 * dictionary): the collection (GET /api/dictionary), its K币 reward (POST
 * /api/dictionary/reward) and a visitor's 浏览图鉴 (POST /api/myroom/dictionary).
 */

export type CareerState = "playing" | "complete" | "rewarded";

export interface CareerProgress {
  id: number;
  value: number;
  state: CareerState;
  /** Its previous stage is not completed yet. */
  locked: boolean;
  /** The service cannot measure this condition; it never completes. */
  untracked: boolean;
  /** When a rewarded career was completed (Unix ms). */
  completedAt?: number;
}

export interface CareerSummary {
  nickname: string;
  /** The signed-in rider's own lists. */
  owner: boolean;
  points: number;
  level: number;
  /** Level glove icon name (etc_/level/<glove>.png). */
  glove: string;
  careers: CareerProgress[];
  recent: Array<{ id: number; completedAt: number }>;
}

export interface CareerCompletion {
  career: CareerProgress;
  point: number;
  points: number;
  /** The emblem the career granted, if any. */
  emblem?: number;
}

export interface EmblemSummary {
  nickname: string;
  owner: boolean;
  /** Newest first. */
  emblems: Array<{ id: number; acquiredAt: number }>;
  /** Representative emblems by slot; 0 is an empty slot. */
  main: [number, number];
}

export interface DictionaryCategory {
  /** Item category: 1 character, 2 paint, 3 kart, 8 goggle, 9 balloon, 11 headband, 21 pet,
   * 26 aura, 27 skid mark, 52 flying pet. */
  category: number;
  name: string;
  /** Items the dictionary lists now, in the release order. */
  items: number[];
  /** The listed items the rider has collected. */
  collected: number[];
}

export interface DictionarySummary {
  nickname: string;
  owner: boolean;
  categories: DictionaryCategory[];
  /** Kart engine grades (kartBodyGrade 1-13) by kart item id. */
  kartGrades: Map<number, number>;
  /** What each newly collected item pays (56:1, the K币). */
  reward: { category: number; item: number; count: number };
  total: number;
  collected: number;
  /** Owner only: items already rewarded and items whose reward can be claimed. */
  rewarded: number;
  claimable: number;
}

export interface DictionaryClaim {
  items: number;
  koin: number;
  wallet: { coupon: number; lucci: number; koin: number };
  dictionary: DictionarySummary;
}

const ids = (value: unknown): number[] =>
  Array.isArray(value) ? value.flatMap(item => {
    const id = integer(item);
    return id !== undefined && id >= 0 ? [id] : [];
  }) : [];

export function parseDictionarySummary(value: unknown): DictionarySummary {
  if (!record(value) || typeof value.nickname !== "string" || !Array.isArray(value.categories))
    invalid("道具图鉴");
  const categories = value.categories.map(row => {
    if (!record(row)) invalid("道具图鉴");
    const category = integer(row.category);
    if (category === undefined || category <= 0) invalid("道具图鉴");
    return { category, name: typeof row.name === "string" ? row.name : "", items: ids(row.items),
      collected: ids(row.collected) };
  });
  const kartGrades = new Map<number, number>();
  if (record(value.kartGrades)) {
    for (const [key, grade] of Object.entries(value.kartGrades)) {
      const id = Number(key);
      const parsed = integer(grade);
      if (Number.isSafeInteger(id) && parsed !== undefined) kartGrades.set(id, parsed);
    }
  }
  const reward = record(value.reward) ? value.reward : {};
  return {
    nickname: value.nickname,
    owner: value.owner === true,
    categories,
    kartGrades,
    reward: { category: integer(reward.category) ?? 0, item: integer(reward.item) ?? 0,
      count: integer(reward.count) ?? 0 },
    total: integer(value.total) ?? 0,
    collected: integer(value.collected) ?? 0,
    rewarded: integer(value.rewarded) ?? 0,
    claimable: integer(value.claimable) ?? 0,
  };
}

/** The part of BrowserAccountSession the API needs. */
export interface MyRoomSession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalid(what: string): never {
  throw new Error(`小屋服务返回了无效的${what}。`);
}

const integer = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;

const STATES = new Set<CareerState>(["playing", "complete", "rewarded"]);

export function parseCareerProgress(value: unknown): CareerProgress {
  if (!record(value)) invalid("成就");
  const id = integer(value.id);
  const progress = integer(value.value);
  if (id === undefined || id <= 0 || progress === undefined ||
      !STATES.has(value.state as CareerState)) invalid("成就");
  const completedAt = integer(value.completedAt);
  return { id, value: progress, state: value.state as CareerState,
    locked: value.locked === true, untracked: value.untracked === true,
    ...(completedAt ? { completedAt } : {}) };
}

export function parseCareerSummary(value: unknown): CareerSummary {
  if (!record(value) || typeof value.nickname !== "string" || !Array.isArray(value.careers))
    invalid("成就列表");
  const progress = record(value.progress) ? value.progress : {};
  return {
    nickname: value.nickname,
    owner: value.owner === true,
    points: integer(value.points) ?? 0,
    level: integer(progress.level) ?? 1,
    glove: typeof progress.glove === "string" ? progress.glove : "",
    careers: value.careers.map(parseCareerProgress),
    recent: (Array.isArray(value.recent) ? value.recent : []).flatMap(item => {
      if (!record(item)) return [];
      const id = integer(item.id);
      const completedAt = integer(item.completedAt);
      return id !== undefined && completedAt !== undefined ? [{ id, completedAt }] : [];
    }),
  };
}

export function parseEmblemSummary(value: unknown): EmblemSummary {
  if (!record(value) || typeof value.nickname !== "string" || !Array.isArray(value.emblems))
    invalid("徽章列表");
  const main = Array.isArray(value.main) ? value.main : [];
  return {
    nickname: value.nickname,
    owner: value.owner === true,
    emblems: value.emblems.flatMap(item => {
      if (!record(item)) return [];
      const id = integer(item.id);
      return id !== undefined && id > 0 ? [{ id, acquiredAt: integer(item.acquiredAt) ?? 0 }] : [];
    }),
    main: [integer(main[0]) ?? 0, integer(main[1]) ?? 0],
  };
}

export class MyRoomApi {
  constructor(readonly session: MyRoomSession) {}

  private post(path: string, body: unknown): Promise<unknown> {
    return this.session.requestJson(path, { method: "POST", body: JSON.stringify(body) });
  }

  /** The signed-in rider's careers, or another rider's (a visitor view). */
  async careers(visit?: { nickname: string; password?: string }): Promise<CareerSummary> {
    return parseCareerSummary(visit
      ? await this.post("/api/myroom/careers", { nickname: visit.nickname, password: visit.password ?? "" })
      : await this.session.requestJson("/api/careers"));
  }

  async completeCareer(careerId: number): Promise<CareerCompletion> {
    const body = await this.post("/api/careers/complete", { careerId });
    if (!record(body)) invalid("成就结果");
    const emblem = integer(body.emblem);
    return { career: parseCareerProgress(body.career), point: integer(body.point) ?? 0,
      points: integer(body.points) ?? 0, ...(emblem ? { emblem } : {}) };
  }

  async emblems(visit?: { nickname: string; password?: string }): Promise<EmblemSummary> {
    return parseEmblemSummary(visit
      ? await this.post("/api/myroom/emblems", { nickname: visit.nickname, password: visit.password ?? "" })
      : await this.session.requestJson("/api/emblems"));
  }

  async setMainEmblems(main: [number, number]): Promise<EmblemSummary> {
    return parseEmblemSummary(await this.post("/api/emblems/main", { main }));
  }

  /** The signed-in rider's 道具图鉴, or another rider's (浏览图鉴). */
  async dictionary(visit?: { nickname: string; password?: string }): Promise<DictionarySummary> {
    return parseDictionarySummary(visit
      ? await this.post("/api/myroom/dictionary", { nickname: visit.nickname, password: visit.password ?? "" })
      : await this.session.requestJson("/api/dictionary"));
  }

  /** 领取奖励: 1 K币 for each collected item not rewarded before. */
  async claimDictionaryReward(): Promise<DictionaryClaim> {
    const body = await this.post("/api/dictionary/reward", {});
    if (!record(body) || !record(body.wallet)) invalid("图鉴奖励");
    return {
      items: integer(body.items) ?? 0,
      koin: integer(body.koin) ?? 0,
      wallet: { coupon: integer(body.wallet.coupon) ?? 0, lucci: integer(body.wallet.lucci) ?? 0,
        koin: integer(body.wallet.koin) ?? 0 },
      dictionary: parseDictionarySummary(body.dictionary),
    };
  }
}
