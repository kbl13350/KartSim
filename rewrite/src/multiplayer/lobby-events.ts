import { formatMultiplayerError } from "./errors";
import type { Gameplay, LobbyControllerHost, LobbyRoom } from "./lobby-actions";

export interface LobbyEvent {
  type: string;
  requestId?: string;
  roomId?: string;
  room?: LobbyRoom;
  message?: unknown;
  [key: string]: unknown;
}

export interface LobbyEventHost extends LobbyControllerHost {
  state: LobbyControllerHost["state"] & {
    apply(event: LobbyEvent, playerId: string): boolean;
    appendChat(event: LobbyEvent): boolean;
  };
  client: LobbyControllerHost["client"] & { bindMotionScope(room?: LobbyRoom): void };
  options: LobbyControllerHost["options"] & {
    speed(speed: number, version: string): void;
    onPageAudio?(page: string): void;
  };
  lobby?: LobbyControllerHost["lobby"] & { show(): void };
  roomView?: { dispose(): void };
  startCoordinator?: { reset(): void; update(room: LobbyRoom): void };
  autoReadyRoom?: string;
  autoReadyConsumed: boolean;
  roomLoading: boolean;
  generation: number;
  dialog?: unknown;
  leaveConfirmation?: { roomId: string };
  voteDialogId?: string;
  garage?: unknown;
  garageLoading: boolean;
  trackSelect?: unknown;
  modalLoading: boolean;
  changingModal?: { kind: string };
  cancelCountdownModals(): void;
  maybeAutoReady(): void;
  showRoom(): Promise<void>;
  syncKickVoteDialog(): void;
}

export interface RoomSpeed {
  speed: number;
  version: string;
}

const gameplaySet = new Set<Gameplay>([
  "ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp",
]);

/** Called after a validated server event reaches the lobby controller. */
export function receiveLobbyEvent(host: LobbyEventHost, event: LobbyEvent,
  roomSpeed: (room: LobbyRoom) => RoomSpeed): void {
  if (event.type === "chat") {
    if (!host.disposed && host.state.appendChat(event)) host.render();
    return;
  }

  const previous = host.state.room;
  if (host.disposed || !host.state.apply(event, host.playerId)) return;
  const current = host.state.room;
  host.client.bindMotionScope(current);

  if (!current) {
    host.autoReadyRoom = undefined;
    host.autoReadyConsumed = false;
    host.manualStartAfter = 0;
    host.startCoordinator?.reset();
    ++host.generation;
    host.roomLoading = false;
    host.cancelDialog();
    host.roomView?.dispose();
    host.roomView = undefined;
    host.lobby?.show();
    host.render();
    host.options.onPageAudio?.("lobby");
    host.options.status(event.type === "left" && !event.requestId
      ? "你已被移出房间。" : "已返回多人大厅。");
    if (host.channelName) void host.list(host.channelName, host.page);
    return;
  }

  const gameplay = current.gameplay ?? "ordinary";
  if (!gameplaySet.has(gameplay)) throw new Error("未知的房间玩法");
  host.gameplay = gameplay;
  if (host.autoReadyRoom !== current.roomId) {
    host.autoReadyRoom = current.roomId;
    host.manualStartAfter = 0;
    host.autoReadyConsumed = current.hostId === host.playerId;
  }
  if (previous?.roomId === current.roomId && current.phase === "open" &&
      current.hostId === host.playerId &&
      (previous.trackId !== current.trackId ||
        previous.randomTrackCode !== current.randomTrackCode)) {
    host.manualStartAfter = performance.now() + 3_000;
  }
  if (current.phase !== "open") host.cancelDialog(false);

  if (current.race?.returnedIds?.includes(host.playerId)) {
    host.startCoordinator?.reset();
    host.options.status("已返回原房间，等待其他玩家结束结算；全部返回后可重新准备。");
  } else {
    host.startCoordinator?.update(current);
  }
  if (current.phase === "loading" && !host.startCoordinator) {
    host.options.status(`正在加载比赛，${current.race?.loadedIds.length ?? 0}/${current.members.length} 人已就绪…`);
  } else if (current.phase === "countdown") {
    host.options.status("已加载玩家等待统一起跑；超时玩家已按掉线处理。");
  } else if (current.phase === "open" && current.raceError) {
    host.options.status(formatMultiplayerError(new Error(current.raceError)), true);
  }

  const speed = roomSpeed(current);
  host.options.speed(speed.speed, speed.version);
  if (host.roomSettingsRoomId &&
      (current.roomId !== host.roomSettingsRoomId || current.hostId !== host.playerId)) {
    host.cancelDialog();
  }
  if (!host.roomSettingsRoomId &&
      ((host.dialog && !host.leaveConfirmation && !host.voteDialogId) ||
        (!host.dialog && !host.garage && !host.garageLoading && !host.trackSelect &&
          !host.modalLoading && !host.voteDialogId))) {
    host.cancelDialog();
  }
  if (host.leaveConfirmation &&
      (current.roomId !== host.leaveConfirmation.roomId || current.phase !== "open")) {
    host.cancelDialog();
  }
  if ((host.trackSelect || host.changingModal?.kind === "track") &&
      current.hostId !== host.playerId) {
    host.cancelDialog();
  }
  host.render();
  host.cancelCountdownModals();
  host.maybeAutoReady();
  if (!host.roomView && !host.roomLoading) void host.showRoom();
  host.syncKickVoteDialog();
}
