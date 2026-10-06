import { formatMultiplayerError } from "./errors";
import type { LobbyRoom } from "./lobby-actions";

export interface RoomView {
  show(): void;
  dispose(): void;
}

export interface RoomViewPlayer { playerId: string; name: string }

export interface RoomViewCallbacks {
  leave(): void;
  ready(ready: boolean): void;
  start?: () => void;
  canStart(): boolean;
  onCountdownLocked(): void;
  settings(): void;
  captureClock(): unknown;
  team(): void;
  track(): void;
  garage?: () => void;
  chat(text: string): Promise<boolean>;
  onError(error: unknown): void;
  kick(player: RoomViewPlayer): void;
  slot(slot: number, closed: boolean): void;
  transfer(player: RoomViewPlayer): void;
}

export interface RoomViewHost {
  options: {
    library: unknown;
    root: unknown;
    raceLoader?: unknown;
    garage?: unknown;
    audioContext?(): unknown;
    onPageAudio?(page: string): void;
    status(message: string, error?: boolean): void;
    [key: string]: unknown;
  };
  state: { room?: LobbyRoom };
  client: { captureClock(): unknown; dispose(): void };
  lobby?: { hide(): void };
  roomView?: RoomView;
  playerId: string;
  generation: number;
  manualStartAfter: number;
  roomLoading: boolean;
  disposed: boolean;
  raceVisible: boolean;
  leaveRoom(reason: string): Promise<boolean>;
  mutate(message: Record<string, unknown>): Promise<boolean>;
  cancelCountdownModals(): void;
  changeRoomInfo(): Promise<void>;
  team(): Promise<void>;
  chooseTrack(): Promise<void>;
  chooseGarage(): Promise<void>;
  sendChat(text: string): Promise<boolean>;
  confirm(title: string, message: string, action: () => void): Promise<void>;
  render(): void;
  maybeAutoReady(): void;
}

export type LoadRoomView = (library: unknown, root: unknown, room: LobbyRoom,
  playerId: string, callbacks: RoomViewCallbacks & Record<string, unknown>,
  audioContext: unknown) => Promise<RoomView>;

/** Load the current room UI and bind commands to its current room revision. */
export async function showLobbyRoom(host: RoomViewHost, load: LoadRoomView): Promise<void> {
  const room = host.state.room;
  if (!room) return;
  const generation = ++host.generation;
  host.roomLoading = true;
  try {
    const view = await load(host.options.library, host.options.root, room,
      host.playerId, {
        ...host.options,
        leave: () => { void host.leaveRoom("lobby"); },
        ready: ready => {
          const current = host.state.room;
          if (current) void host.mutate({ type: "ready", roomId: current.roomId,
            revision: current.revision, ready });
        },
        start: host.options.raceLoader ? () => {
          const current = host.state.room;
          if (current && performance.now() > host.manualStartAfter) {
            void host.mutate({ type: "start", roomId: current.roomId,
              revision: current.revision });
          }
        } : undefined,
        canStart: () => performance.now() > host.manualStartAfter,
        onCountdownLocked: () => host.cancelCountdownModals(),
        settings: () => { void host.changeRoomInfo(); },
        captureClock: () => host.client.captureClock(),
        team: () => { void host.team(); },
        track: () => { void host.chooseTrack(); },
        garage: host.options.garage ? () => { void host.chooseGarage(); } : undefined,
        chat: text => host.sendChat(text),
        onError: error => host.options.status(formatMultiplayerError(error), true),
        kick: player => {
          void host.confirm("发起移出投票", `对 ${player.name} 发起移出投票？`, () => {
            const current = host.state.room;
            if (current) void host.mutate({ type: "kick", roomId: current.roomId,
              revision: current.revision, playerId: player.playerId });
          });
        },
        slot: (slot, closed) => {
          const current = host.state.room;
          if (current) void host.mutate({ type: "slot", roomId: current.roomId,
            revision: current.revision, slot, closed });
        },
        transfer: player => {
          void host.confirm("移交房主", `将房主移交给 ${player.name}？`, () => {
            const current = host.state.room;
            if (current) void host.mutate({ type: "transfer-host", roomId: current.roomId,
              revision: current.revision, playerId: player.playerId });
          });
        },
      }, host.options.audioContext?.());
    if (host.disposed || generation !== host.generation ||
        host.state.room?.roomId !== room.roomId) {
      view.dispose();
      return;
    }
    host.roomView = view;
    if (!host.raceVisible) view.show();
    host.lobby?.hide();
    host.render();
    host.maybeAutoReady();
    if (!host.raceVisible) host.options.onPageAudio?.("room");
    host.options.status(host.options.raceLoader
      ? "已进入房间。支持个人和组队竞速，可使用本地车库改装。"
      : "已进入房间。可选车、选图、聊天、准备和管理成员；比赛尚未接入。");
  } catch (error) {
    if (!host.disposed && generation === host.generation) {
      host.options.status(`房间界面加载失败：${formatMultiplayerError(error)}。已断开房间，请返回单人游戏重试。`, true);
      host.client.dispose();
    }
  } finally {
    if (generation === host.generation) host.roomLoading = false;
  }
}
