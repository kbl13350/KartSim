import { formatMultiplayerError } from "./errors";
import type { LobbyRoom } from "./lobby-actions";
import type { ChangingModal } from "./lobby-dialogs";

export interface LobbyChangingHost {
  options: { status(message: string, error?: boolean): void };
  state: { room?: LobbyRoom };
  client: { request(message: Record<string, unknown>): Promise<unknown>; dispose(): void };
  playerId: string;
  connected: boolean;
  disposed: boolean;
  modalLoading: boolean;
  garageLoading: boolean;
  dialogGeneration: number;
  changingModal?: ChangingModal;
  roomView?: { countdownLocked?: boolean };
  cancelDialog(): void;
  endChangingModal(modal: ChangingModal, releaseAllowed?: boolean): void;
  releaseChanging(roomId: string): Promise<void>;
  render(): void;
  receive(message: unknown): void;
}

/** Check that a garage or track modal still belongs to the same editable room. */
export function isChangingModalCurrent(host: LobbyChangingHost,
  modal: ChangingModal): boolean {
  const room = host.state.room;
  return !host.disposed && host.connected && host.changingModal === modal &&
    modal.generation === host.dialogGeneration && room?.roomId === modal.roomId &&
    room.phase === "open" &&
    (modal.kind === "track" ? room.hostId === host.playerId :
      room.hostId === host.playerId ||
      !room.members.find(member => member.playerId === host.playerId)?.ready) &&
    !(room.hostId === host.playerId && host.roomView?.countdownLocked);
}

/** Release server-side editing only after an entered modal has truly ended. */
export function endChangingModal(host: LobbyChangingHost,
  modal: ChangingModal, releaseAllowed = true): void {
  if (!releaseAllowed) modal.releaseAllowed = false;
  if (!modal.entered || modal.released || !modal.releaseAllowed) return;
  modal.released = true;
  const next = host.changingModal;
  if (next && next !== modal && next.roomId === modal.roomId) {
    next.entered = true;
    return;
  }
  void host.releaseChanging(modal.roomId);
}

export function cancelCountdownModals(host: LobbyChangingHost): void {
  const room = host.state.room;
  if (room?.phase === "open" && room.hostId === host.playerId &&
      host.roomView?.countdownLocked && host.changingModal) host.cancelDialog();
}

export function finishChangingLoad(host: LobbyChangingHost,
  modal: ChangingModal, loaded: boolean): void {
  if (host.changingModal === modal) {
    if (!loaded) {
      host.cancelDialog();
      return;
    }
    host.modalLoading = false;
    host.garageLoading = false;
    if (!host.disposed) host.render();
  } else {
    host.endChangingModal(modal);
  }
}

/** Tell the server the player closed the equipment or track editor. */
export async function releaseChanging(host: LobbyChangingHost,
  roomId: string): Promise<void> {
  const room = host.state.room;
  if (host.disposed || !host.connected || room?.phase !== "open" ||
      room.roomId !== roomId ||
      !room.members.find(member => member.playerId === host.playerId)?.changing) return;
  try {
    host.receive(await host.client.request({ type: "changing", roomId: room.roomId,
      changing: false }));
  } catch (error) {
    if (!host.disposed) {
      host.options.status(formatMultiplayerError(error), true);
      host.client.dispose();
    }
  }
}
