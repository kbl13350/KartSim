/** Original DeathMatchTeam (58) identity; UI only, server rules remain authoritative. */
export const DEATHMATCH_GAMEPLAY = "deathmatch";
export const DEATHMATCH_CHANNEL = "speedTeamCombine";
export const DEATHMATCH_GAME_TYPE = 58;
export const DEATHMATCH_LABEL = "死斗模式";
export const DEATHMATCH_CAPACITY = 8;
export const DEATHMATCH_TRACK_IDS = ["ice_D01", "factory_D01", "god_D01", "northeu_D01", "wkc_D01"] as const;
export const DEATHMATCH_RANDOM_GROUP = "death:all:0";
export const DEATHMATCH_RANDOM_LABEL = "全部随机（死斗模式限定5张）";
export const DEATHMATCH_RULES_HINT = "红蓝各4人，把对手撞落赛道得分。先到20分或180秒结束，3秒后复活，复活保护2秒；这些时限与分数为Web重建规则。原版createSpeed1暂按当前标准速度频道运行。";

export function isDeathmatchTrack(trackId: unknown): boolean {
  return typeof trackId === "string" && (DEATHMATCH_TRACK_IDS as readonly string[]).includes(trackId);
}
