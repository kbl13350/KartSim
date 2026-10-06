import type { ReadyOptions } from "./ready-flow";

interface GameOptions {
  mainMenuBgmPath: string;
  enableRoadSound?: boolean;
  [key: string]: unknown;
}

interface SettingsView {
  dispose(): void;
  setRoomSpeed(speed: number, version: string): void;
}

interface ReadyView {
  setSpeedChannel(channel: { version: string; settingSpeed: number }): void;
  activateTrainingShortcut(): void;
}

interface Lobby {
  hasModal: boolean;
  isInRoom: boolean;
  refreshAutoReady(): void;
  handleRoomShortcut(event: KeyboardEvent): boolean;
  quickJoinShortcut(): void;
}

export interface ReadySettingsController {
  host: {
    root: HTMLElement;
    hud: { showDebugText(message: string, level: string): void };
    shell: {
      modal?: string;
      openModal(name: string): boolean;
      closeModal(name: string): void;
    };
    toonStageBinding: { retain(environment: unknown): void };
    getLibrary(): unknown;
    getAudioContext(): { resume(): Promise<unknown> } | undefined;
    getInterfaceAudio(): { playClick(): void } | undefined;
    getBgm(): {
      prepareMultiplayer(library: unknown, path: string): Promise<unknown>;
      playMultiplayer(page: string): void;
    } | undefined;
    getGameOptions(): GameOptions;
    setGameOptions(options: GameOptions): void;
    saveGameOptions(): void;
    applyInputKeyMap(options: GameOptions): void;
    applyAudioOptions(options: GameOptions): void;
    getReadyOptions(): ReadyOptions;
    setReadyOptions(options: ReadyOptions): void;
    previewSettings(options: GameOptions): void;
    confirmSettings(options: GameOptions, speed: number, version: string): void;
    closeSettings(): void;
  };
  disposed: boolean;
  settingsOpening: boolean;
  multiplayer?: Lobby;
  activeSettings?: SettingsView;
  activeGarage?: unknown;
  activeTimeAttackReady?: ReadyView;
  activeWindowNotice?: { dispose(): void };
  readyToonEnvironment?: { dispose(): void };
  readyStageContext(): { library: unknown };
  readyModalBusy(): boolean;
  publishRaceSpeedChannel(): void;
  returnGarageToReady(): void;
  closeSettings(): void;
  showTrackSelectError(error: unknown): void;
}

export interface ReadySettingsDependencies {
  loadSettings(options: Record<string, unknown>): Promise<SettingsView>;
  speedLabel(options: ReadyOptions): number;
  chooseSpeed(version: string, speed: number): number;
  defaultSpeed: number;
  defaultVersion: string;
  persistGameOptions(options: GameOptions): void;
}

/** Open settings from Ready or the lobby with the proper speed lock. */
export async function openReadySettings(controller: ReadySettingsController,
  deps: ReadySettingsDependencies): Promise<void> {
  const lobby = controller.multiplayer;
  if (controller.settingsOpening || controller.activeSettings || controller.disposed ||
      lobby?.hasModal || (!lobby && (controller.readyModalBusy() ||
        !controller.activeTimeAttackReady))) return;
  const { library } = controller.readyStageContext();
  if (!lobby) controller.host.shell.openModal("settings");
  controller.settingsOpening = true;
  try {
    await controller.host.getAudioContext()?.resume();
    controller.host.getInterfaceAudio()?.playClick();
    const view = await deps.loadSettings({
      library,
      root: controller.host.root,
      initial: controller.host.getGameOptions(),
      initialSpeed: lobby
        ? deps.speedLabel(controller.host.getReadyOptions())
        : controller.host.getReadyOptions().settingSpeed ?? deps.defaultSpeed,
      initialVersion: controller.host.getReadyOptions().version ?? deps.defaultVersion,
      speedLocked: !!lobby,
      onPreview: (options: GameOptions) => controller.host.previewSettings(options),
      onConfirm: (options: GameOptions, speed: number, version: string) =>
        controller.host.confirmSettings(options, speed, version),
      onCancel: () => controller.host.closeSettings(),
      onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
    });
    if (controller.disposed || lobby !== controller.multiplayer) {
      view.dispose();
      return;
    }
    if (lobby) view.setRoomSpeed(
      deps.speedLabel(controller.host.getReadyOptions()),
      controller.host.getReadyOptions().version ?? deps.defaultVersion);
    controller.activeSettings = view;
  } catch (error) {
    controller.host.hud.showDebugText(`设置窗口：${String(error)}`, "error");
    if (controller.host.shell.modal === "settings")
      controller.host.shell.closeModal("settings");
  } finally {
    controller.settingsOpening = false;
  }
}

export function previewReadySettings(controller: ReadySettingsController,
  options: GameOptions): void {
  if (!controller.host.getAudioContext()) return;
  controller.host.applyAudioOptions({
    ...options,
    enableRoadSound: controller.host.getGameOptions().enableRoadSound,
  });
}

/** Commit settings and refresh lobby music or the Ready speed channel. */
export function confirmReadySettings(controller: ReadySettingsController,
  options: GameOptions, speed: number, version: string,
  deps: ReadySettingsDependencies): void {
  const host = controller.host;
  if (controller.multiplayer) {
    const bgmChanged = host.getGameOptions().mainMenuBgmPath !== options.mainMenuBgmPath;
    host.setGameOptions({ ...options });
    host.applyInputKeyMap(options);
    host.saveGameOptions();
    host.closeSettings();
    controller.multiplayer.refreshAutoReady();
    if (bgmChanged) {
      const library = host.getLibrary();
      const bgm = host.getBgm();
      const lobby = controller.multiplayer;
      if (library && bgm && lobby) void bgm.prepareMultiplayer(
        library, options.mainMenuBgmPath).then(() => {
        if (controller.multiplayer === lobby && !lobby.isInRoom)
          bgm.playMultiplayer("lobby");
      }).catch(error =>
        host.hud.showDebugText(`主页面音乐：${String(error)}`, "error"));
    }
    return;
  }
  const settingSpeed = deps.chooseSpeed(version, speed);
  host.setGameOptions({ ...options });
  host.applyInputKeyMap(options);
  host.saveGameOptions();
  const previous = host.getReadyOptions();
  const next = { ...previous, version, settingSpeed };
  const speedChanged = deps.speedLabel(next) !== deps.speedLabel(previous);
  host.setReadyOptions(next);
  host.closeSettings();
  if (speedChanged) controller.publishRaceSpeedChannel();
}

export function publishReadyRaceSpeed(controller: ReadySettingsController,
  deps: ReadySettingsDependencies): void {
  if (controller.activeGarage) {
    controller.returnGarageToReady();
    return;
  }
  const options = controller.host.getReadyOptions();
  controller.activeTimeAttackReady?.setSpeedChannel({
    version: options.version ?? deps.defaultVersion,
    settingSpeed: options.settingSpeed ?? deps.defaultSpeed,
  });
}

export function saveReadyGameOptions(controller: ReadySettingsController,
  persist: ReadySettingsDependencies["persistGameOptions"]): void {
  try {
    persist(controller.host.getGameOptions());
  } catch (error) {
    controller.host.hud.showDebugText(`本次游戏设置未保存：${String(error)}`, "error");
  }
}

export function closeReadySettings(controller: ReadySettingsController): void {
  const host = controller.host;
  if (host.getAudioContext()) host.applyAudioOptions(host.getGameOptions());
  controller.activeSettings?.dispose();
  controller.activeSettings = undefined;
  if (host.shell.modal === "settings") host.shell.closeModal("settings");
}

export function showReadyTrackSelectError(controller: ReadySettingsController,
  error: unknown): void {
  controller.host.hud.showDebugText(
    `SelectTrackEx fail-closed：${error instanceof Error ? error.message : String(error)}`,
    "error");
}

export function handleReadyShortcut(controller: ReadySettingsController,
  event: KeyboardEvent): boolean {
  if (controller.multiplayer?.handleRoomShortcut(event)) return true;
  if (event.code !== "F5" || !controller.activeTimeAttackReady) return false;
  event.preventDefault();
  if (controller.multiplayer) {
    if (!controller.activeSettings && !controller.settingsOpening)
      controller.multiplayer.quickJoinShortcut();
  } else if (!controller.readyModalBusy()) {
    controller.activeTimeAttackReady.activateTrainingShortcut();
  }
  return true;
}

/** Release the shared toon scene after Ready or garage leaves the stage. */
export function releaseReadyToonEnvironment(controller: ReadySettingsController): void {
  controller.activeWindowNotice?.dispose();
  controller.activeWindowNotice = undefined;
  const environment = controller.readyToonEnvironment;
  if (!environment) return;
  controller.host.toonStageBinding.retain(environment);
  environment.dispose();
  controller.readyToonEnvironment = undefined;
}
