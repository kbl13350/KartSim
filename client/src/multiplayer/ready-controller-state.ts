/** Ready controller windows and random track session ownership. */

export function initializeReadyControllerState(host: Record<string, unknown>,
  application: unknown, createRandomTrackSession: () => unknown): void {
  host.host = undefined;
  host.activeTimeAttackReady = undefined;
  host.activeTaskbar = undefined;
  host.activeSettings = undefined;
  host.activeTrackSelect = undefined;
  host.activeGarage = undefined;
  host.activeWindowNotice = undefined;
  host.readyToonEnvironment = undefined;
  host.multiplayer = undefined;
  host.disposed = false;
  host.settingsOpening = false;
  host.activeRandomGroup = undefined;
  host.randomTrackCatalog = undefined;
  host.randomTrackSession = createRandomTrackSession();
  host.host = application;
}
