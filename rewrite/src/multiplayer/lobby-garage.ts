import { formatMultiplayerError } from "./errors";
import type { LobbyRoom } from "./lobby-actions";
import type { ChangingModal } from "./lobby-dialogs";

export interface GarageChoice {
  equipment: unknown;
  [key: string]: unknown;
}

export interface GarageView {
  show(): void;
  dispose(): void;
  freeze(): void;
  unfreeze(): void;
}

export interface GarageViewOptions {
  profile: { equipment: unknown; [key: string]: unknown };
  onCancel(): void;
  onConfirm(choice: GarageChoice): void;
  [key: string]: unknown;
}

export interface LobbyGarageHost {
  options: {
    garage?: {
      options(): Promise<GarageViewOptions>;
      apply(choice: GarageChoice): void;
    };
    status(message: string, error?: boolean): void;
  };
  state: { room?: LobbyRoom };
  playerId: string;
  roomView?: { countdownLocked?: boolean };
  connected: boolean;
  disposed: boolean;
  busy: boolean;
  modalLoading: boolean;
  garageLoading: boolean;
  dialogGeneration: number;
  changingModal?: ChangingModal;
  dialog?: unknown;
  trackSelect?: unknown;
  garage?: GarageView;
  render(): void;
  mutate(message: Record<string, unknown>): Promise<boolean>;
  isChangingModalCurrent(modal: ChangingModal): boolean;
  cancelDialog(releaseAllowed?: boolean): void;
  finishChangingLoad(modal: ChangingModal, loaded: boolean): void;
  confirmGarage(choice: GarageChoice, roomId: string, modal: ChangingModal): Promise<void>;
}

export interface LoadGarageView {
  (options: GarageViewOptions): Promise<GarageView>;
}

/** Enter the server's changing state before opening the local garage view. */
export async function chooseLobbyGarage(host: LobbyGarageHost,
  load: LoadGarageView,
  normalizeEquipment: (profile: { equipment: unknown }, choice: GarageChoice) => unknown):
  Promise<void> {
  const room = host.state.room;
  const garage = host.options.garage;
  if (!room || room.phase !== "open" ||
      (room.hostId === host.playerId && host.roomView?.countdownLocked) ||
      (room.hostId !== host.playerId &&
        room.members.find(member => member.playerId === host.playerId)?.ready) ||
      !garage || host.disposed || host.busy || host.dialog || host.trackSelect ||
      host.garage || host.modalLoading || !host.connected) return;
  host.modalLoading = true;
  host.garageLoading = true;
  const modal: ChangingModal = { kind: "garage", roomId: room.roomId,
    generation: ++host.dialogGeneration, entered: false,
    released: false, releaseAllowed: true };
  host.changingModal = modal;
  host.render();
  let loaded = false;
  try {
    if (!(await host.mutate({ type: "changing", roomId: room.roomId, changing: true })) ||
        ((modal.entered = true), !host.isChangingModalCurrent(modal))) return;
    const options = await garage.options();
    if (!host.isChangingModalCurrent(modal)) return;
    const view = await load({ ...options,
      onCancel: () => {
        if (host.isChangingModalCurrent(modal)) host.cancelDialog();
      },
      onConfirm: choice => {
        if (!host.isChangingModalCurrent(modal) || host.busy) return;
        const equipment = normalizeEquipment(options.profile, choice);
        void host.confirmGarage({ ...choice, equipment }, room.roomId, modal);
      },
    });
    if (!host.isChangingModalCurrent(modal)) {
      view.dispose();
      return;
    }
    host.garage = view;
    loaded = true;
    view.show();
  } catch (error) {
    if (!host.disposed) host.options.status(`选择赛车：${formatMultiplayerError(error)}`, true);
  } finally {
    host.finishChangingLoad(modal, loaded);
  }
}

/** Save equipment and apply it locally only after the room accepts the change. */
export async function confirmLobbyGarage(host: LobbyGarageHost,
  choice: GarageChoice, roomId: string, modal: ChangingModal): Promise<void> {
  const room = host.state.room;
  if (!room || (room.hostId !== host.playerId &&
      room.members.find(member => member.playerId === host.playerId)?.ready) ||
      room.roomId !== roomId || !host.connected || host.disposed ||
      !host.isChangingModalCurrent(modal)) return;
  host.garage?.freeze();
  const accepted = await host.mutate({ type: "equipment", roomId,
    revision: room.revision, equipment: choice.equipment });
  if (host.changingModal !== modal) return;
  if (!accepted) {
    host.garage?.unfreeze();
    return;
  }
  host.cancelDialog(false);
  if (!host.disposed && host.state.room?.roomId === roomId) {
    host.options.garage?.apply(choice);
  }
}
