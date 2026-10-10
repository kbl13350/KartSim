import { formatMultiplayerError } from "./errors";
import { isPlayableGameplay } from "./gameplay-admission";
import type { ActiveRoom } from "./room-state";

export type Gameplay = "ordinary" | "grip" | "shadow" | "roadblock" | "lte" | "giant" | "rp" |
  "item";

export interface RoomSummary {
  roomId: string;
  locked: boolean;
  gaming?: boolean;
  count: number;
  capacity: number;
  [key: string]: unknown;
}

export interface LobbyRoom extends ActiveRoom {
  hostId: string;
  mode: string;
  gameplay?: Gameplay;
  speed: number;
  trackId?: string;
  randomTrackCode?: number;
  raceError?: string;
  resourceVersion?: string;
  race?: ActiveRoom["race"] & { returnedIds?: string[] };
  kickVote?: {
    voteId: string;
    targetId: string;
    eligibleIds: string[];
    yesIds: string[];
    noIds: string[];
  };
}

export interface LobbyControllerHost {
  options: {
    version?: string;
    status(message: string, error?: boolean): void;
    beforeLeaveRoom?: (context: { reason: string; room: LobbyRoom }) => Promise<boolean> | boolean;
    /** Gear as it is now; it may have changed outside a room since connecting. */
    currentEquipment?(): unknown;
    /**
     * A game node refused equipment the account no longer owns (403
     * ITEM_NOT_OWNED, ECONOMY.md 6): re-read the inventory, replace unowned
     * items and return `command` with owned equipment to send once more
     * (undefined: nothing to resend).
     */
    repairEquipment?(command: Record<string, unknown>):
      Promise<Record<string, unknown> | undefined>;
  };
  client: { request(message: Record<string, unknown>): Promise<unknown>; dispose(): void };
  state: { room?: LobbyRoom; allowJoin(roomId: string): void };
  lobby?: { setRooms(channel: string, page: number, total: number,
    rooms: RoomSummary[], gameplay: Gameplay): void };
  connected: boolean;
  disposed: boolean;
  busy: boolean;
  leaving: boolean;
  raceVisible: boolean;
  hasModal: boolean;
  channelName?: string;
  gameplay: Gameplay;
  page: number;
  rooms: RoomSummary[];
  selection: number;
  playerId: string;
  roomSettingsRoomId?: string;
  dialogGeneration: number;
  manualStartAfter: number;
  render(): void;
  receive(message: unknown): void;
  list(channel: string, page: number, quiet?: boolean, gameplay?: Gameplay): Promise<void>;
  mutate(message: Record<string, unknown>): Promise<boolean>;
  join(room: RoomSummary): Promise<void>;
  /** Room creation, opened by 快速开始 when no listed room can be joined. */
  create?(): Promise<void>;
  confirmLeaveRoom(roomId: string): Promise<boolean>;
  cancelDialog(closeChanging?: boolean): void;
  openDialog(factory: () => unknown): Promise<void>;
  dialogOptions(): unknown;
}

const gameplayNames: Record<Gameplay, string> = {
  ordinary: "普通竞速", grip: "抓地模式", shadow: "幽灵模式",
  roadblock: "挡人模式", lte: "LTE Web试玩", giant: "巨人模式", rp: "RP竞速",
  item: "道具赛",
};
const startRuleErrors = new Set([
  "NOT_ENOUGH_PLAYERS", "ROADBLOCK_NEEDS_FIVE", "TRACK_REQUIRED",
  "EQUIPMENT_REQUIRED", "PLAYERS_NOT_READY", "TEAM_REQUIRED", "CLIENT_RACE_UNAVAILABLE",
]);

function supportedGameplay(gameplay: Gameplay): boolean {
  return isPlayableGameplay(gameplay);
}

/** Fetch one room-list page, discarding responses superseded by a newer selection. */
export async function listLobbyRooms(host: LobbyControllerHost, channel: string,
  page: number, quiet = false, gameplay: Gameplay = host.gameplay): Promise<void> {
  if (!host.connected || host.state.room || host.disposed) return;
  if (!supportedGameplay(gameplay)) {
    host.options.status("未知的房间玩法。", true);
    return;
  }
  if (gameplay !== "ordinary" && host.options.version !== "p3553") {
    host.options.status(gameplay === "item" ? "道具赛暂时仅开放 P3553 资源版本。"
      : "娱乐模式暂时仅开放 P3553 资源版本。", true);
    return;
  }
  if (channel !== host.channelName || page !== host.page || gameplay !== host.gameplay) {
    host.rooms = [];
    host.lobby?.setRooms(channel, page, 0, [], gameplay);
  }
  host.channelName = channel;
  host.page = page;
  host.gameplay = gameplay;
  const selection = ++host.selection;

  try {
    const response = await host.client.request(gameplay === "ordinary"
      ? { type: "list-ordinary", page }
      : { type: "list-gameplay", gameplay, page });
    const list = response as { type: string; rooms: RoomSummary[]; total: number };
    if (host.disposed || selection !== host.selection || host.state.room || list.type !== "rooms") return;
    if (page > 0 && list.rooms.length === 0) {
      await host.list(channel, Math.max(0, Math.ceil(list.total / 10) - 1), quiet, gameplay);
      return;
    }
    host.rooms = list.rooms;
    host.lobby?.setRooms(channel, page, list.total, list.rooms, gameplay);
    if (!quiet) host.options.status(gameplay === "lte"
      ? "LTE Web试玩：三张专用地图全部随机，Z/X左右躲闪；自动补氮气与香蕉事件尚未实现。"
      : list.total
        ? `找到 ${list.total} 个房间，点击房间即可加入。`
        : `${gameplayNames[gameplay]}大厅暂无房间，可以创建房间邀请其他玩家加入。`);
  } catch (error) {
    if (!host.disposed && selection === host.selection && !quiet) {
      host.options.status(formatMultiplayerError(error), true);
    }
  }
}

/** Ask for confirmation and leave only the same open room that was confirmed. */
export async function leaveLobbyRoom(host: LobbyControllerHost, reason: string): Promise<boolean> {
  if (host.disposed || host.hasModal || host.raceVisible) return false;
  const room = host.state.room;
  if (!room) return true;
  if (room.phase !== "open") return false;
  host.leaving = true;
  host.render();
  try {
    if ((host.options.beforeLeaveRoom &&
        !(await host.options.beforeLeaveRoom({ reason, room }))) ||
        !(await host.confirmLeaveRoom(room.roomId)) || host.disposed) return false;
    const current = host.state.room;
    if (!current) return true;
    if (current.roomId !== room.roomId || current.phase !== "open") return false;
    if (host.connected) {
      return (await host.mutate({ type: "leave", roomId: current.roomId,
        revision: current.revision })) && !host.state.room;
    }
    host.receive({ type: "left", roomId: current.roomId });
    return true;
  } catch (error) {
    if (!host.disposed) host.options.status(formatMultiplayerError(error), true);
    return false;
  } finally {
    host.leaving = false;
    if (!host.disposed) host.render();
  }
}

/** Commands that carry the player's equipment; game nodes verify it against the inventory. */
const EQUIPMENT_COMMANDS = new Set(["create", "join", "equipment"]);

/**
 * ITEM_NOT_OWNED on commands without equipment: a member's confirmed gear ran
 * out (the game node un-readies them); `ready` concerns this player only.
 */
const UNOWNED_COMMAND_MESSAGES: Record<string, string> = {
  ready: "你的装备中有已过期或未拥有的物品，已换回默认装备。请在「选择赛车」中确认装备后再准备。",
  start: "有玩家的装备中有已过期或未拥有的物品，已取消其准备。请等待更换装备后再开始比赛。",
};

function commandErrorMessage(command: Record<string, unknown>, error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  return code === "ITEM_NOT_OWNED" && UNOWNED_COMMAND_MESSAGES[String(command.type)]
    || formatMultiplayerError(error);
}

/**
 * Send a room command. When create/join/equipment is refused for unowned
 * equipment (an item expired since it was equipped), repair the profile and
 * send the command once more with owned items.
 */
async function requestWithOwnedEquipment(host: LobbyControllerHost,
  command: Record<string, unknown>): Promise<unknown> {
  try {
    return await host.client.request(command);
  } catch (error) {
    // ready/start: a member's gear expired (the node un-readied them); this
    // player's own profile is repaired too in case it is theirs.
    const repair = host.options.repairEquipment;
    if (!repair || host.disposed || !(error instanceof Error) ||
        error.message !== "ITEM_NOT_OWNED") throw error;
    let resend: Record<string, unknown> | undefined;
    try {
      resend = await repair(command);
    } catch {
      resend = undefined;
    }
    if (!resend || host.disposed || !EQUIPMENT_COMMANDS.has(String(command.type))) throw error;
    const room = host.state.room;
    if ("revision" in resend && room && room.roomId === resend.roomId)
      resend = { ...resend, revision: room.revision };
    return host.client.request(resend);
  }
}

/** Serialize a room command and surface server errors in the same UI context. */
export async function mutateLobbyRoom(host: LobbyControllerHost,
  command: Record<string, unknown>, notice: (options: unknown, title: string,
    message: string) => unknown): Promise<boolean> {
  if (host.disposed || host.busy || !host.connected) return false;
  host.busy = true;
  host.render();
  let blockedMessage: string | undefined;
  let blockedTitle = "无法开始比赛";
  let completed = false;
  try {
    const response = await requestWithOwnedEquipment(host, command);
    if (host.disposed) return false;
    host.receive(response);
    completed = true;
  } catch (error) {
    if (!host.disposed) {
      const code = error instanceof Error ? error.message : String(error);
      const message = commandErrorMessage(command, error);
      if (command.type === "start" &&
          (startRuleErrors.has(code) || code === "ITEM_NOT_OWNED") &&
          host.state.room?.hostId === host.playerId) {
        blockedMessage = message;
      } else if (command.type === "ready" && code === "ITEM_NOT_OWNED") {
        // The node un-readied this player; say why in the room, not only the status line.
        blockedMessage = message;
        blockedTitle = "无法准备";
        host.options.status(message, true);
      } else {
        host.options.status(message, true);
      }
      if (error instanceof Error && error.message.startsWith("Request timeout")) {
        host.client.dispose();
      }
    }
  } finally {
    host.busy = false;
    if (!host.disposed) host.render();
  }
  if (blockedMessage && !host.disposed && host.state.room?.phase === "open") {
    await host.openDialog(() => notice(host.dialogOptions(), blockedTitle, blockedMessage));
  }
  return completed;
}

export async function sendLobbyChat(host: LobbyControllerHost, text: string): Promise<boolean> {
  const room = host.state.room;
  if (!room || !host.connected || host.disposed) return false;
  try {
    const response = await host.client.request({ type: "chat", roomId: room.roomId, text });
    host.receive(response);
    return !host.disposed && host.state.room?.roomId === room.roomId;
  } catch (error) {
    if (!host.disposed) host.options.status(formatMultiplayerError(error), true);
    return false;
  }
}

export async function joinLobbyRoom(host: LobbyControllerHost, room: RoomSummary,
  passwordDialog: (host: LobbyControllerHost, submit: (password: string) => void) =>
    Promise<void>): Promise<void> {
  if (host.busy || host.state.room || !host.connected) return;
  host.state.allowJoin(room.roomId);
  if (room.locked) {
    await passwordDialog(host, password => {
      void host.mutate({ type: "join", roomId: room.roomId, password,
        ...currentEquipmentField(host.options) });
    });
  } else {
    await host.mutate({ type: "join", roomId: room.roomId, password: "",
      ...currentEquipmentField(host.options) });
  }
}

/** Create and join send current gear so the server's race roster matches this client. */
export function currentEquipmentField(options: { currentEquipment?(): unknown }):
  { equipment?: unknown } {
  const equipment = options.currentEquipment?.();
  return equipment === undefined ? {} : { equipment };
}

/**
 * 快速开始 joins the first open public room the list shows (its category and
 * filters apply); with none, it opens room creation instead.
 */
export async function quickJoinLobbyRoom(host: LobbyControllerHost): Promise<void> {
  const shown = (host.lobby as { visibleRoomIndexes?(): number[] } | undefined)
    ?.visibleRoomIndexes?.();
  const candidates = shown
    ? shown.flatMap(index => host.rooms[index] ? [host.rooms[index]] : []) : host.rooms;
  const room = candidates.find(candidate =>
    !candidate.locked && !candidate.gaming && candidate.count < candidate.capacity);
  if (room) await host.join(room);
  else if (host.create) await host.create();
  else host.options.status("本页没有可快速加入的公开房间，请翻页或创建房间。");
}

export async function switchLobbyTeam(host: LobbyControllerHost): Promise<void> {
  const room = host.state.room;
  const member = room?.members.find(candidate => candidate.playerId === host.playerId);
  const team = member?.team;
  if (!room || !team || room.mode !== "team" || room.phase !== "open" ||
      (room.hostId !== host.playerId && member?.ready) || host.busy || host.leaving ||
      host.hasModal) return;
  await host.mutate({ type: "team", roomId: room.roomId,
    revision: room.revision, team: team === 1 ? 2 : 1 });
}

export async function submitLobbyRoomSettings(host: LobbyControllerHost,
  settings: Record<string, unknown>, dialogGeneration: number): Promise<void> {
  const room = host.state.room;
  if (host.disposed || !host.connected || host.busy ||
      dialogGeneration !== host.dialogGeneration || !room ||
      room.roomId !== host.roomSettingsRoomId || room.hostId !== host.playerId ||
      room.phase !== "open") return;
  host.manualStartAfter = performance.now() + 3_000;
  if (await host.mutate({ type: "room-settings", roomId: room.roomId,
      revision: room.revision, ...settings }) &&
      !host.disposed && dialogGeneration === host.dialogGeneration) {
    host.cancelDialog();
    host.options.status("房间设置已更新。");
  }
}
