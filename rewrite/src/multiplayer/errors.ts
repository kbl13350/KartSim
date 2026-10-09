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
  // Data service and game server split: entry tickets, server choice and capacity.
  NICKNAME_TAKEN: "该昵称已被使用或已在游戏中。",
  LOGIN_REQUIRED: "登录已失效，请重新登录后再进入多人游戏。",
  TICKET_REQUIRED: "游戏服务器需要入场票据，请重新进入多人游戏。",
  TICKET_INVALID: "入场票据无效，请重新进入多人游戏。",
  TICKET_EXPIRED: "入场票据已过期，请重新进入多人游戏。",
  TICKET_REUSED: "入场票据已被使用，请重新进入多人游戏。",
  TICKET_WRONG_NODE: "入场票据不属于该游戏服务器，请重新选择服务器。",
  DATA_NODE_MISMATCH: "游戏服务器与数据服务不匹配，请联系服务器管理员。",
  GAME_SERVER_NOT_FOUND: "所选游戏服务器已下线，请重新选择服务器。",
  GAME_SERVER_FULL: "所选游戏服务器已满，请选择其他服务器。",
  SERVER_FULL: "游戏服务器人数已满，请稍后再试或选择其他服务器。",
  SERVER_BUSY: "游戏服务器繁忙，请稍后再试或选择其他服务器。",
  SERVER_SHUTTING_DOWN: "游戏服务器正在关闭，请重新进入多人游戏并选择其他服务器。",
  ROOM_LIMIT_REACHED: "该游戏服务器的房间数量已达上限，请加入已有房间或选择其他服务器。",
  DATA_SERVICE_UNAVAILABLE: "数据服务暂时不可用，请稍后再试。",
  // Account economy (server-go/ECONOMY.md 6): accounts only, owned equipment.
  REGISTRATION_CLOSED: "当前服务器已关闭注册，请联系管理员。",
  TOO_MANY_ATTEMPTS: "尝试过于频繁，请稍后再试。",
  ONBOARDING_REQUIRED: "请先完成新车手注册，领取新手礼包后再进入多人游戏。",
  ITEM_NOT_OWNED: "装备中有未拥有或已过期的物品，请在「选择赛车」或车库中更换后再试。",
  INSUFFICIENT_FUNDS: "余额不足。",
  ALREADY_OWNED: "已经永久拥有该物品。",
  EXP_REQUIRED: "经验不足，暂时无法购买该物品。",
  OFFER_NOT_FOUND: "该商品已下架，请刷新商店。",
  // Game nodes throttle create/join/equipment/ready/start/hello (429).
  RATE_LIMITED: "操作太频繁，请稍后再试。",
  STORAGE_QUOTA_EXCEEDED: "存储空间已满，请清理后再试。",
  PRICE_CHANGED: "价格已变化，请刷新商店后重试。",
  REQUEST_ID_CONFLICT: "请求编号与之前的请求冲突，请重试。",
  // One live session per account across all game nodes (hello and tickets, 409).
  ACCOUNT_ONLINE: "该账号已在其他地方在线，请先退出另一处登录。",
  // A game node can be on another build than the data service during a rollout.
  PROTOCOL_MISMATCH: "游戏服务器版本与前端不一致，请选择其他服务器或联系服务器管理员。",
  // Game nodes refuse the WebSocket upgrade (503 full/busy/shutting down, 403
  // untrusted page) before the browser can read a code; see client-websocket.ts.
  "WebSocket connection failed":
    "无法连接所选游戏服务器（可能已下线、已满、繁忙、正在关闭或不信任本网页），请稍后再试或选择其他服务器。",
  "WebSocket connection timeout": "连接游戏服务器超时，请稍后再试或选择其他服务器。",
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
