import type { LobbyRoom } from "./lobby-actions";

interface Disposable { dispose(): void }

export interface LobbyLifecycleHost {
  options: {
    status(message: string, error?: boolean): void;
    toggleAutoReady?: () => boolean | undefined;
    autoReadyEnabled?: () => boolean;
  };
  client: {
    subscribe(listener: (event: unknown) => void): () => void;
    onClose(listener: () => void): () => void;
    dispose(): void;
  };
  state: { room?: LobbyRoom };
  lobby?: Disposable & { setEnabled(enabled: boolean): void; setInert(inert: boolean): void };
  roomView?: Disposable & {
    update(room: LobbyRoom, busy: boolean, connected: boolean): void;
    activateReadyShortcut(): void;
  };
  dialog?: Disposable & { setBusy(busy: boolean): void };
  trackSelect?: Disposable;
  garage?: Disposable;
  loadingView?: Disposable;
  startMission?: Disposable;
  rpNotice?: Disposable;
  startCoordinator?: Disposable & { reset(): void };
  accountAbort: AbortController;
  refresh?: ReturnType<typeof setInterval>;
  leaveConfirmation?: { resolve(value: boolean): void };
  playerId: string;
  connected: boolean;
  busy: boolean;
  leaving: boolean;
  modalLoading: boolean;
  raceVisible: boolean;
  hasModal: boolean;
  disposed: boolean;
  autoReadyConsumed: boolean;
  generation: number;
  dialogGeneration: number;
  receive(event: unknown): void;
  render(): void;
  syncLoadingView(): void;
  cancelDialog(): void;
  quickJoin(): Promise<void>;
}

export function bindLobbyClient(host: LobbyLifecycleHost): void {
  const client = host.client;
  client.subscribe(event => host.receive(event));
  client.onClose(() => {
    if (host.disposed || host.client !== client || !host.connected) return;
    host.connected = false;
    host.startCoordinator?.reset();
    host.cancelDialog();
    host.render();
    host.options.status("联机服务已断开。请返回单人游戏，再重新进入多人游戏。", true);
  });
}

export function disposeLobby(host: LobbyLifecycleHost): void {
  if (host.disposed) return;
  host.disposed = true;
  host.accountAbort.abort();
  host.startCoordinator?.dispose();
  ++host.generation;
  clearInterval(host.refresh);
  host.startMission?.dispose();
  host.startMission = undefined;
  host.rpNotice?.dispose();
  host.rpNotice = undefined;
  ++host.dialogGeneration;
  host.leaveConfirmation?.resolve(false);
  host.leaveConfirmation = undefined;
  host.client.dispose();
  host.dialog?.dispose();
  host.trackSelect?.dispose();
  host.garage?.dispose();
  host.roomView?.dispose();
  host.lobby?.dispose();
  host.loadingView?.dispose();
  host.loadingView = undefined;
}

export function renderLobby(host: LobbyLifecycleHost): void {
  host.syncLoadingView();
  host.lobby?.setEnabled(host.connected && !host.busy && !host.leaving && !host.state.room);
  host.lobby?.setInert(!!host.dialog || host.modalLoading || host.busy || host.leaving);
  if (host.state.room) {
    host.roomView?.update(host.state.room,
      host.busy || host.leaving || !!host.dialog || !!host.trackSelect ||
        !!host.garage || host.modalLoading,
      host.connected);
  }
  host.dialog?.setBusy(host.busy || (!host.connected && !host.leaveConfirmation));
}

export function lobbyNetworkDiagnostics(host: {
  client: { networkDiagnostics(): unknown };
}): unknown {
  return host.client.networkDiagnostics();
}

export function refreshLobbyAutoReady(host: LobbyLifecycleHost): void {
  host.render();
}

export function maybeAutoReadyInRoom(host: LobbyLifecycleHost): void {
  const room = host.state.room;
  if (!room || !host.roomView || !host.options.autoReadyEnabled?.() ||
      !host.connected || host.disposed || host.raceVisible || room.phase !== "open" ||
      room.hostId === host.playerId || host.autoReadyConsumed) return;
  const member = room.members.find(candidate => candidate.playerId === host.playerId);
  if (member) {
    host.autoReadyConsumed = true;
    if (!member.ready && !host.hasModal) host.roomView.activateReadyShortcut();
  }
}

export function quickJoinShortcut(host: LobbyLifecycleHost): void {
  if (!host.disposed && host.connected && !host.state.room && !host.busy &&
      !host.dialog && !host.trackSelect && !host.modalLoading) void host.quickJoin();
}

export interface RoomShortcutEvent {
  code: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  target?: { matches?(selector: string): boolean } | null;
  preventDefault(): void;
  stopPropagation(): void;
}

export function handleRoomShortcut(host: LobbyLifecycleHost,
  event: RoomShortcutEvent): boolean {
  const room = host.state.room;
  if (!room || !host.roomView || host.raceVisible || host.disposed ||
      !host.connected || host.hasModal || host.busy || room.phase !== "open" ||
      (event.code !== "F5" && event.code !== "KeyP") || event.repeat ||
      event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
      event.target?.matches?.("input, textarea, [contenteditable], [contenteditable] *")) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.code === "KeyP") {
    const enabled = host.options.toggleAutoReady?.();
    if (enabled !== undefined) {
      host.options.status(`自动准备已${enabled ? "开启" : "关闭"}。`);
      host.render();
    }
    return true;
  }
  host.roomView.activateReadyShortcut();
  return true;
}
