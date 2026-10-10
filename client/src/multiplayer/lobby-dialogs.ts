import { formatMultiplayerError } from "./errors";
import type { LobbyRoom } from "./lobby-actions";

export interface LobbyDialogView {
  dispose(): void;
}

export interface ChangingModal {
  roomId: string;
  generation: number;
  kind: "track" | "garage";
  entered: boolean;
  released: boolean;
  releaseAllowed: boolean;
}

export interface LobbyDialogHost {
  options: { status(message: string, error?: boolean): void; [key: string]: unknown };
  state: { room?: LobbyRoom };
  client: { request(message: Record<string, unknown>): Promise<unknown>; dispose(): void };
  playerId: string;
  connected: boolean;
  disposed: boolean;
  busy: boolean;
  raceVisible: boolean;
  modalLoading: boolean;
  garageLoading: boolean;
  dialogGeneration: number;
  changingModal?: ChangingModal;
  roomSettingsRoomId?: string;
  voteDialogId?: string;
  leaveConfirmation?: { roomId: string; resolve(value: boolean): void };
  dialog?: LobbyDialogView;
  trackSelect?: LobbyDialogView;
  garage?: LobbyDialogView;
  roomView?: { countdownLocked?: boolean };
  render(): void;
  syncKickVoteDialog(): void;
  cancelDialog(closeChanging?: boolean): void;
  endChangingModal(modal: ChangingModal, releaseAllowed?: boolean): void;
  openDialog(factory: () => Promise<LobbyDialogView> | LobbyDialogView,
    allowDisconnected?: boolean): Promise<void>;
  dialogOptions(): Record<string, unknown>;
  castKickVote(approve: boolean): void;
  mutate(message: Record<string, unknown>): Promise<boolean>;
  receive(message: unknown): void;
}

export type ConfirmDialogFactory = (options: Record<string, unknown>, title: string,
  message: string, onConfirm: () => void,
  labels?: { yes: string; no: string }) => Promise<LobbyDialogView> | LobbyDialogView;

/** Close any visible modal and reconcile the server-side changing state. */
export function cancelLobbyDialog(host: LobbyDialogHost, releaseAllowed = true): void {
  const changing = host.changingModal;
  host.changingModal = undefined;
  ++host.dialogGeneration;
  if (changing) {
    host.modalLoading = false;
    host.garageLoading = false;
  }
  host.roomSettingsRoomId = undefined;
  host.voteDialogId = undefined;
  host.leaveConfirmation?.resolve(false);
  host.leaveConfirmation = undefined;
  host.dialog?.dispose();
  host.dialog = undefined;
  host.trackSelect?.dispose();
  host.trackSelect = undefined;
  host.garage?.dispose();
  host.garage = undefined;
  host.render();
  if (changing) host.endChangingModal(changing, releaseAllowed);
}

/** Mount a dialog only while its room and generation remain current. */
export async function openLobbyDialog(host: LobbyDialogHost,
  create: () => Promise<LobbyDialogView> | LobbyDialogView,
  allowDisconnected = false): Promise<void> {
  if (host.disposed || host.busy || host.dialog || host.trackSelect || host.garage ||
      host.modalLoading || (!host.connected && !allowDisconnected)) return;
  host.modalLoading = true;
  host.render();
  const generation = ++host.dialogGeneration;
  try {
    const view = await create();
    if (host.disposed || generation !== host.dialogGeneration ||
        (!host.connected && !allowDisconnected)) {
      view.dispose();
      return;
    }
    host.dialog = view;
  } catch (error) {
    if (!host.disposed) host.options.status(formatMultiplayerError(error), true);
  } finally {
    host.modalLoading = false;
    if (!host.disposed) {
      host.render();
      host.syncKickVoteDialog();
    }
  }
}

export function lobbyDialogOptions(host: LobbyDialogHost): Record<string, unknown> {
  return { ...host.options, cancel: () => host.cancelDialog() };
}

export async function confirmLeaveLobbyRoom(host: LobbyDialogHost, roomId: string,
  confirm: ConfirmDialogFactory): Promise<boolean> {
  let resolve!: (accepted: boolean) => void;
  const answer = new Promise<boolean>(finish => { resolve = finish; });
  host.leaveConfirmation = { roomId, resolve };
  await host.openDialog(() => confirm(host.dialogOptions(), "提示", "确定要离开队友退出房间吗", () => {
    const pending = host.leaveConfirmation;
    host.leaveConfirmation = undefined;
    host.cancelDialog();
    pending?.resolve(true);
  }), true);
  if (!host.dialog && host.leaveConfirmation) host.cancelDialog();
  return answer;
}

/** Keep the active vote prompt tied to the current vote and eligible member. */
export function syncKickVoteDialog(host: LobbyDialogHost,
  confirm: ConfirmDialogFactory): void {
  const room = host.state.room;
  const vote = room?.kickVote;
  if (host.voteDialogId && (!vote || vote.voteId !== host.voteDialogId ||
      vote.yesIds.includes(host.playerId) || vote.noIds.includes(host.playerId))) {
    host.cancelDialog();
  }
  if (!vote || host.voteDialogId || host.leaveConfirmation ||
      !vote.eligibleIds.includes(host.playerId) ||
      vote.yesIds.includes(host.playerId) || vote.noIds.includes(host.playerId) ||
      !host.connected || host.raceVisible) return;
  if (host.dialog || host.trackSelect || host.garage) host.cancelDialog();
  if (host.busy || host.modalLoading || host.garageLoading) return;
  const target = room.members.find(member => member.playerId === vote.targetId);
  if (!target) return;
  host.voteDialogId = vote.voteId;
  void host.openDialog(() => confirm(
    { ...host.options, cancel: () => host.castKickVote(false) },
    "踢人投票", `是否同意将 ${target.name} 移出房间？`,
    () => host.castKickVote(true), { yes: "同意", no: "反对" }));
}

export function castLobbyKickVote(host: LobbyDialogHost, approve: boolean): void {
  const voteId = host.voteDialogId;
  host.cancelDialog();
  const room = host.state.room;
  if (voteId && room?.kickVote?.voteId === voteId) {
    void host.mutate({ type: "kick-vote", roomId: room.roomId,
      revision: room.revision, voteId, approve });
  }
}
