/** Legacy system kart identities used by saved profiles and race selection. */

export interface LegacyKartState {
  level: "rookie" | "l3" | "l2" | "l1";
  resource: string;
  aliases: string[];
  parameterSource: { status: "school-spec" } | {
    status: "family-resource"; resource: string; generation: string;
  };
}
export interface LegacyKartFamily {
  key: string;
  identityClass: "legacy-system-family";
  title: string;
  defaultLevel: LegacyKartState["level"];
  engineGrade: number;
  states: LegacyKartState[];
}
export interface KartSelection {
  itemId: number;
  systemKey?: string;
  path: string;
  internalId: string;
  [key: string]: unknown;
}

const blacklineParameters = () => ({
  status: "family-resource" as const,
  resource: "practiceblack0", generation: "G3",
});

export const legacyKartFamilies: LegacyKartFamily[] = [
  {
    key: "legacyPractice", identityClass: "legacy-system-family",
    title: "旧版练习用卡丁车", defaultLevel: "l1", engineGrade: 0,
    states: [
      { level: "rookie", resource: "practice0", aliases: ["practice0"],
        parameterSource: { status: "school-spec" } },
      { level: "l3", resource: "practice1", aliases: ["practice1"],
        parameterSource: { status: "school-spec" } },
      { level: "l2", resource: "practice2", aliases: ["practice2"],
        parameterSource: { status: "school-spec" } },
      { level: "l1", resource: "practice3", aliases: ["practice3"],
        parameterSource: { status: "school-spec" } },
    ],
  },
  {
    key: "legacyPracticeBlackline", identityClass: "legacy-system-family",
    title: "旧版黑线练习用卡丁车", defaultLevel: "l1", engineGrade: 0,
    states: [
      { level: "rookie", resource: "practiceblack0",
        aliases: ["practiceblack0", "practiceblack1"],
        parameterSource: blacklineParameters() },
      { level: "l3", resource: "practiceblack2",
        aliases: ["practiceblack2"], parameterSource: blacklineParameters() },
      { level: "l2", resource: "practiceblack3",
        aliases: ["practiceblack3"], parameterSource: blacklineParameters() },
      { level: "l1", resource: "practiceblack4",
        aliases: ["practiceblack4", "practiceblack5"],
        parameterSource: blacklineParameters() },
    ],
  },
];

// This release contains no kart IDs with an unfinished race data override.
const blockedKartIds = new Set<number>();

export function isBlockedKartId(itemId: number): boolean {
  return blockedKartIds.has(itemId);
}

export function blockedKartMessage(itemId: number): string | undefined {
  return isBlockedKartId(itemId)
    ? `车辆 ItemKart ${itemId} 的比赛数据尚未补全，暂不可选择或进入相关流程。`
    : undefined;
}

export function requirePlayableKartId(itemId: number): void {
  const message = blockedKartMessage(itemId);
  if (message) throw new Error(message);
}

export function defaultLegacyKartState(family: LegacyKartFamily): LegacyKartState {
  const state = family.states.find(candidate =>
    candidate.level === family.defaultLevel);
  if (!state)
    throw new Error(`${family.key} 缺少默认等级 ${family.defaultLevel}。`);
  return state;
}

export function legacyKartStateForAlias(familyKey: string,
  alias: string): LegacyKartState | undefined {
  const wanted = alias.toLowerCase();
  return legacyKartFamilies.find(family => family.key === familyKey)
    ?.states.find(state => state.aliases.some(candidate =>
      candidate.toLowerCase() === wanted));
}

/** Resolve a profile selection to one exact catalog entry or legacy variant. */
export function resolveKartSelection<Kart extends KartSelection>(
  catalog: readonly Kart[], itemId: number, path: string,
  systemKey?: string): Kart | (Kart & { internalId: string; path: string }) | undefined {
  if (isBlockedKartId(itemId)) return undefined;
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase();
  const exact = catalog.find(kart => kart.itemId === itemId &&
    (itemId !== 0 || kart.systemKey === systemKey) &&
    kart.path.replace(/\\/g, "/").toLowerCase() === normalizedPath);
  if (exact) return exact;
  if (itemId !== 0 || !systemKey) return undefined;
  const family = legacyKartFamilies.find(candidate =>
    candidate.key === systemKey);
  const parsed = /^kart_\/([^/]+)\/model\.1s$/.exec(normalizedPath);
  const state = family && parsed
    ? legacyKartStateForAlias(family.key, parsed[1]!) : undefined;
  if (!state || normalizedPath !==
    `kart_/${state.resource.toLowerCase()}/model.1s`) return undefined;
  const base = catalog.find(kart => kart.itemId === 0 &&
    kart.systemKey === systemKey);
  return base
    ? { ...base, internalId: state.resource,
      path: `kart_/${state.resource}/model.1s` } : undefined;
}

export function stableSystemKartKey(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error("系统车辆缺少稳定身份键。");
  return trimmed;
}

export function kartCatalogIdentity(kart: KartSelection): string {
  return kart.itemId === 0
    ? `system:${stableSystemKartKey(kart.systemKey)}`
    : `catalog:3:${kart.itemId}`;
}
