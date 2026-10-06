/** Messages shown by the multiplayer UI for server and client failures. */
const errorMessages: Record<string, string> = {
  GUEST_NAME_TAKEN: "昵称已被使用，请换一个昵称。",
  INVALID_GUEST_NAME: "昵称格式不正确，请重新输入。",
  RACE_IN_PROGRESS: "比赛正在准备或进行中，无法修改房间。",
  NOT_ENOUGH_PLAYERS: "至少需要两名玩家。",
  TRACK_REQUIRED: "请房主先选择赛道。",
  EQUIPMENT_REQUIRED: "有玩家的装备尚未同步。",
  PLAYERS_NOT_READY: "请等待其他玩家准备，并关闭我的物品。",
  TEAM_REQUIRED: "红蓝两队都需要有玩家。",
  CLIENT_RACE_UNAVAILABLE: "有玩家尚未接入多人驾驶功能。",
  STALE_RACE: "该局比赛已经结束或取消。",
  LOAD_TIMEOUT: "有玩家加载超时，本次开赛已取消，请重新准备。",
  LOAD_FAILED: "有玩家加载失败，本次开赛已取消。",
  MEMBER_LEFT: "有玩家在开赛前离开，本次开赛已取消。",
  HOST_CANCELLED: "房主已取消本次开赛。",
  WRONG_PASSWORD: "房间密码错误，请重新输入。",
  ROOM_FULL: "房间已满，请选择其他房间。",
  ROOM_NOT_FOUND: "房间已经关闭，请刷新列表。",
  TEAM_FULL: "该队伍人数已满，请选择另一队。",
  STALE_REVISION: "房间刚刚发生变化，已刷新，请再操作一次。",
  HOST_REQUIRED: "只有房主可以执行此操作。",
  PLAYER_NOT_FOUND: "该玩家已经离开房间。",
  RESOURCE_VERSION_MISMATCH: "游戏资源版本不同，无法加入该房间。",
  ROOM_LIMIT: "房间数量已达上限，请稍后再试。",
  NOT_IN_ROOM: "你已经不在该房间中。",
  ALREADY_IN_ROOM: "你已经加入一个房间，请先退出。",
  SLOT_OUTSIDE_CAPACITY: "该席位不在本房间的人数范围内。",
  SLOT_OCCUPIED: "该席位已有玩家，不能关闭。",
  VOTE_IN_PROGRESS: "已有移出投票正在进行。",
  VOTE_NOT_FOUND: "这次投票已经结束。",
  VOTE_NOT_ELIGIBLE: "你不能参与这次投票，或已经投过票。",
  PLAYER_CHANGING: "请先关闭我的物品，再准备。",
  HOST_HAS_START_BUTTON: "房主通过开始按钮发起比赛，无需准备。",
  PLAYER_READY: "请先取消准备，再更换队伍或道具。",
  READY_COUNTDOWN_LOCKED: "房间倒数已进入最后三秒，不能取消准备。",
  CHAT_RATE_LIMIT: "发送过快，请稍后重试。",
  VERSION_MISMATCH: "联机前端与后端版本不一致，请同步更新。",
};

/** Preserve the release's special Error-only translations. */
export function formatMultiplayerError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "ROADBLOCK_NEEDS_FIVE") return "挡人模式至少需要五名玩家。";
    if (error.message === "TRACK_UNAVAILABLE") return "该赛道未开放当前玩法。";
    if (error.message === "RUNNER_REQUIRED") return "只有本局跑者可以上报到达终点。";
  }
  const code = error instanceof Error ? error.message : String(error);
  return errorMessages[code] ?? code;
}
