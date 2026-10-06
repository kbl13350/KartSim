import { formatMultiplayerError } from "./errors";
import type { Gameplay, LobbyRoom } from "./lobby-actions";

export interface RoomSettings {
  type: string;
  roomId: string;
  name: string;
  password: string;
  [key: string]: unknown;
}

export interface LobbySettingsHost {
  options: {
    nickname?: string;
    status(message: string, error?: boolean): void;
    [key: string]: unknown;
  };
  state: { room?: LobbyRoom };
  client: { request(message: Record<string, unknown>): Promise<unknown> };
  gameplay: Gameplay;
  channelName?: string;
  accountNickname?: string;
  playerId: string;
  disposed: boolean;
  connected: boolean;
  busy: boolean;
  hasModal: boolean;
  modalLoading: boolean;
  dialogGeneration: number;
  roomSettingsRoomId?: string;
  dialog?: { dispose(): void };
  render(): void;
  syncKickVoteDialog(): void;
  cancelDialog(): void;
  dialogOptions(): unknown;
  openDialog(factory: () => unknown): Promise<void>;
  mutate(message: Record<string, unknown>): Promise<boolean>;
  submitRoomSettings(settings: Record<string, unknown>, generation: number): Promise<void>;
}

export type LoadRoomSettingsDialog = (options: unknown, mode: string,
  settings: RoomSettings, submit: (settings: { name: string; password: string;
    [key: string]: unknown }) => void) => Promise<{ dispose(): void }>;

/** Fetch the authoritative settings before offering the host an edit dialog. */
export async function changeLobbyRoomInfo(host: LobbySettingsHost,
  loadDialog: LoadRoomSettingsDialog): Promise<void> {
  const room = host.state.room;
  if (!room || room.phase !== "open" || room.hostId !== host.playerId ||
      host.hasModal || !host.connected || host.disposed) return;
  host.roomSettingsRoomId = room.roomId;
  host.modalLoading = true;
  const generation = ++host.dialogGeneration;
  const current = () => !host.disposed && host.connected &&
    generation === host.dialogGeneration && host.state.room?.roomId === room.roomId &&
    host.state.room.hostId === host.playerId && host.state.room.phase === "open";
  host.render();
  try {
    const response = await host.client.request({ type: "get-room-settings", roomId: room.roomId });
    if (!current()) return;
    const settings = response as RoomSettings;
    if (settings.type !== "room-settings" || settings.roomId !== room.roomId) {
      throw new Error("房间设置响应不一致。");
    }
    const dialog = await loadDialog(host.dialogOptions(), room.mode, settings, update => {
      if (!current() || host.busy) return;
      if (update.name === settings.name && update.password === settings.password) {
        host.cancelDialog();
      } else {
        void host.submitRoomSettings(update, generation);
      }
    });
    if (!current()) {
      dialog.dispose();
      return;
    }
    host.dialog = dialog;
  } catch (error) {
    if (current()) host.options.status(formatMultiplayerError(error), true);
  } finally {
    host.modalLoading = false;
    if (generation === host.dialogGeneration && !host.dialog) {
      host.roomSettingsRoomId = undefined;
    }
    if (!host.disposed) {
      host.render();
      host.syncKickVoteDialog();
    }
  }
}

export interface CreateRoomForm {
  channelName: string;
  [key: string]: unknown;
}

export type LoadCreateDialog = (options: unknown, gameplay: Gameplay,
  channel: string, nickname: string | undefined,
  submit: (form: CreateRoomForm) => void) => unknown;

/** Create an ordinary or game-mode room using the selected channel rules. */
export async function createLobbyRoom(host: LobbySettingsHost,
  channels: Record<string, { mode: string; speed: number }>,
  loadDialog: LoadCreateDialog): Promise<void> {
  const gameplay = host.gameplay;
  if (!["ordinary", "grip", "shadow", "roadblock", "giant", "rp"].includes(gameplay)) {
    host.options.status("LTE 模式暂未开放。", true);
    return;
  }
  const channel = host.channelName;
  if (!channel) {
    host.options.status("请先选择比赛频道。");
    return;
  }
  await host.openDialog(() => loadDialog(host.dialogOptions(), gameplay,
    channel, host.accountNickname ?? host.options.nickname, form => {
      const { mode, speed } = channels[form.channelName]!;
      host.channelName = form.channelName;
      void host.mutate({ type: "create", ...form,
        ...(gameplay === "ordinary" ? { gameplay: "ordinary" } : {}),
        mode, speed, speedVersion: "国服" });
    }));
}

export async function confirmLobbyAction(host: LobbySettingsHost,
  title: string, message: string, action: () => void,
  confirm: (options: unknown, title: string, message: string,
    accept: () => void) => unknown): Promise<void> {
  await host.openDialog(() => confirm(host.dialogOptions(), title, message, () => {
    host.cancelDialog();
    action();
  }));
}
