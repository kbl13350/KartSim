/** Initial lobby ownership and modal state before connecting to a room. */

export interface LobbyShellFactories {
  createAbortController(): unknown;
  createClient(): unknown;
  createState(): { room?: unknown };
}

export function initializeLobbyShellState(host: Record<string, unknown>,
  options: unknown, factories: LobbyShellFactories): void {
  // The released class defines fields before its constructor assigns options.
  host.options = undefined;
  host.accountAbort = factories.createAbortController();
  host.accountNickname = undefined;
  host.client = factories.createClient();
  host.state = factories.createState();
  host.lobby = undefined;
  host.roomView = undefined;
  host.loadingView = undefined;
  host.loadingViewPending = undefined;
  host.loadingViewFailed = false;
  host.startMission = undefined;
  host.rpNotice = undefined;
  host.startPresentation = undefined;
  host.dialog = undefined;
  host.roomSettingsRoomId = undefined;
  host.manualStartAfter = 0;
  host.trackSelect = undefined;
  host.garage = undefined;
  host.garageLoading = false;
  host.dialogGeneration = 0;
  host.changingModal = undefined;
  host.favoriteTracks = new Set();
  host.playerId = "";
  host.connected = false;
  host.busy = false;
  host.leaving = false;
  host.leaveConfirmation = undefined;
  host.voteDialogId = undefined;
  host.disposed = false;
  host.raceVisible = false;
  host.autoReadyRoom = undefined;
  host.autoReadyConsumed = false;
  host.modalLoading = false;
  host.roomLoading = false;
  host.selection = 0;
  host.generation = 0;
  host.channelName = undefined;
  host.gameplay = "ordinary";
  host.page = 0;
  host.rooms = [];
  host.refresh = undefined;
  host.startCoordinator = undefined;
  host.options = options;
}

export function lobbyHasModal(host: {
  leaving: boolean; busy: boolean; modalLoading: boolean;
  dialog: unknown; trackSelect: unknown; garage: unknown;
}): boolean {
  return host.leaving || host.busy || host.modalLoading || !!host.dialog ||
    !!host.trackSelect || !!host.garage;
}

export function lobbyIsInRoom(host: { state: { room?: unknown } }): boolean {
  return !!host.state.room;
}
