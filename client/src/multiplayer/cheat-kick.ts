/**
 * The game node's anti-cheat kick (server-go/ANTICHEAT.md 3): an unsolicited
 * {"type":"error","code":"CHEAT_DETECTED","check":…} right before the
 * server closes the connection.
 */
export interface CheatKick {
  /** The check the racer failed (TELEPORT, SPEED, …); "" when unknown. */
  check: string;
}

const CHECK_LABELS: Readonly<Record<string, string>> = {
  TELEPORT: "坐标瞬移",
  SPEED: "移动速度异常",
  CLOCK: "游戏时钟加速",
  PROGRESS: "赛道进度异常",
  LAP: "圈数异常",
  FINISH_TIME: "完赛时间异常",
  FINISH_EARLY: "未跑完赛道就完赛",
  CUBE_RATE: "道具箱拾取过快",
};

/** The kick an event announces, or undefined for any other event. */
export function cheatKickOf(event: unknown): CheatKick | undefined {
  if (typeof event !== "object" || event === null) return undefined;
  const value = event as Record<string, unknown>;
  if (value.type !== "error" || value.code !== "CHEAT_DETECTED" || value.requestId !== undefined) {
    return undefined;
  }
  const check = typeof value.check === "string" && /^[A-Z_]{1,32}$/.test(value.check) ? value.check : "";
  return { check };
}

/** What the player is told after the kick. */
export function cheatKickMessage(kick: CheatKick): string {
  const label = CHECK_LABELS[kick.check] ?? "数据异常";
  return `服务器检测到异常操作（${label}），你已被移出比赛并断开联机。如有疑问请联系管理员。`;
}
