import { closeReadyHome, type ReadyHomeController } from "./ready-home";
import { closeReadyShop } from "./ready-shop";
interface Disposable { dispose(): void }

export interface FavoriteTrack { themeId: string; trackId: string }
export interface ReadyProfile {
  favoriteTracks: FavoriteTrack[];
  favoriteItems?: unknown;
  [key: string]: unknown;
}

export interface ReadyControllerStateHost {
  host: {
    shell: {
      readyModalBusy: boolean;
      current: string;
      modal?: string;
      closeModal(name: string): void;
      leaveMultiplayerLobby(): void;
    };
    hud: { showDebugText(message: string, level: string): void };
    getProfile(): ReadyProfile;
    setProfile(profile: ReadyProfile): void;
    saveProfile(): void;
    getBgm(): { playReady(): void } | undefined;
  };
  activeTimeAttackReady?: Disposable & {
    render(state: unknown): void;
    refreshRecord(): void;
    unfreeze(): void;
    show(): void;
  };
  activeTaskbar?: Disposable & { setVisible(visible: boolean): void };
  activeSettings?: Disposable;
  activeTrackSelect?: Disposable;
  activeGarage?: Disposable;
  activeHouse?: Disposable;
  activeItemInventory?: Disposable;
  inventoryOpening?: boolean;
  activeWindowNotice?: { update(value: unknown): void };
  readyToonEnvironment?: unknown;
  multiplayer?: Disposable & {
    leaveRoom(reason: string): Promise<boolean>;
    networkDiagnostics(): unknown[];
  };
  randomTrackSession: { clear(): void };
  activeRandomGroup?: unknown;
  randomTrackCatalog?: unknown;
  disposed: boolean;
  settingsOpening: boolean;
  releaseReadyToonEnvironment(): void;
  closeMultiplayer(openReady?: boolean, restoreReady?: boolean): void;
  closeSettings(): void;
  enterTimeAttackReady(): Promise<unknown>;
  showGarageError(error: unknown): void;
}

/** Release owned Ready and multiplayer UI objects. */
export function disposeReadyController(host: ReadyControllerStateHost): void {
  host.disposed = true;
  closeReadyHome(host as unknown as ReadyHomeController);
  closeReadyShop(host as unknown as { activeShop?: { close(): void } });
  host.activeItemInventory?.dispose();
  host.activeItemInventory = undefined;
  host.activeHouse?.dispose();
  host.activeHouse = undefined;
  host.multiplayer?.dispose();
  host.multiplayer = undefined;
  host.activeTimeAttackReady?.dispose();
  host.activeTaskbar?.dispose();
  host.activeSettings?.dispose();
  host.activeTrackSelect?.dispose();
  host.activeGarage?.dispose();
  host.randomTrackSession.clear();
  host.activeRandomGroup = undefined;
  host.randomTrackCatalog = undefined;
}

export function updateReadyWindowNotice(host: ReadyControllerStateHost, value: unknown): void {
  host.activeWindowNotice?.update(value);
}
export function getReadyWindowNotice(host: ReadyControllerStateHost) {
  return host.activeWindowNotice;
}
export function setReadyWindowNotice(host: ReadyControllerStateHost,
  value: ReadyControllerStateHost["activeWindowNotice"]): void {
  host.activeWindowNotice = value;
}
export function renderReadyController(host: ReadyControllerStateHost, state: unknown): void {
  host.activeTimeAttackReady?.render(state);
}
export function refreshReadyRecord(host: ReadyControllerStateHost): void {
  host.activeTimeAttackReady?.refreshRecord();
}
export function releaseReadyForRace(host: ReadyControllerStateHost): void {
  closeReadyHome(host as unknown as ReadyHomeController);
  // A race never runs under the shop (nor under one still loading).
  closeReadyShop(host as unknown as { activeShop?: { close(): void } });
  host.activeItemInventory?.dispose();
  host.activeItemInventory = undefined;
  host.activeHouse?.dispose();
  host.activeHouse = undefined;
  if (host.host.shell.modal === "house") host.host.shell.closeModal("house");
  host.activeTimeAttackReady?.dispose();
  host.activeTimeAttackReady = undefined;
  host.activeTaskbar?.setVisible(false);
  host.releaseReadyToonEnvironment();
}
export function isReadyModalBusy(host: ReadyControllerStateHost): boolean {
  return host.host.shell.readyModalBusy;
}

export async function returnMultiplayerToSinglePlayer(host: ReadyControllerStateHost): Promise<void> {
  const lobby = host.multiplayer;
  if (!lobby || host.activeSettings || host.settingsOpening) return;
  if (await lobby.leaveRoom("single-player") && !host.disposed && host.multiplayer === lobby) {
    host.closeMultiplayer();
  }
}

export function readyNetworkDiagnostics(host: ReadyControllerStateHost): unknown[] {
  return host.multiplayer?.networkDiagnostics() ?? [];
}

export function closeReadyMultiplayer(host: ReadyControllerStateHost,
  openReady = true, restoreReady = true): void {
  const lobby = host.multiplayer;
  if (!lobby) return;
  host.closeSettings();
  host.multiplayer = undefined;
  lobby.dispose();
  if (host.host.shell.current === "MultiplayerLobby") host.host.shell.leaveMultiplayerLobby();
  if (restoreReady) {
    // Leaving for 首页: Ready stays frozen under home.
    if (!(host as { activeHome?: unknown }).activeHome) host.activeTimeAttackReady?.unfreeze();
    host.activeTimeAttackReady?.show();
    host.host.getBgm()?.playReady();
  }
  if (openReady) void host.enterTimeAttackReady().catch(error => host.showGarageError(error));
}

/** Apply a track star and persist it; keep the in-memory choice on save failure. */
export function changeReadyFavoriteTrack(host: ReadyControllerStateHost,
  track: unknown, favorite: boolean,
  normalize: (track: unknown) => FavoriteTrack): void {
  const id = normalize(track);
  const profile = host.host.getProfile();
  const other = profile.favoriteTracks.filter(entry =>
    entry.themeId !== id.themeId || entry.trackId !== id.trackId);
  host.host.setProfile({ ...profile, favoriteTracks: favorite ? [...other, id] : other });
  try {
    host.host.saveProfile();
  } catch (error) {
    host.host.hud.showDebugText(`本次地图收藏变更未保存：${String(error)}`, "error");
  }
}

export function changeReadyFavoriteItems(host: ReadyControllerStateHost,
  items: unknown): void {
  host.host.setProfile({ ...host.host.getProfile(), favoriteItems: items });
  try {
    host.host.saveProfile();
  } catch (error) {
    host.host.hud.showDebugText(`本次道具星标变更未保存：${String(error)}`, "error");
  }
}
