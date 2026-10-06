import type { ReadyOptions, ReadySelection } from "./ready-flow";

interface Profile {
  favoriteTracks: unknown[];
  initial?: unknown;
  equipment?: unknown;
  [key: string]: unknown;
}

interface GarageChoice {
  kart: { path: string; itemId: number; systemKey: string; title: string };
  character: { path: string; itemId: number };
  equipment: unknown;
}

interface Lobby {
  open(): Promise<unknown>;
  dispose(): void;
  leaveRoom(reason: string): Promise<boolean>;
  networkDiagnostics(): unknown[];
}

interface Notice {
  show(message: unknown, kind: unknown, details: unknown, durationMs?: number): void;
}

/** Operations the Ready controller needs when moving to the multiplayer lobby. */
export interface ReadyMultiplayerController {
  host: {
    root: HTMLElement;
    toonStageBinding: unknown;
    hud: { showDebugText(message: string, kind: string): void };
    shell: {
      current: string;
      modal?: string;
      enterMultiplayerLobby(from: string): boolean;
      restoreGarageFromMultiplayerLobby(): void;
      leaveMultiplayerLobby(): void;
    };
    multiplayerRaceLoader?: unknown;
    getLibrary(): { timeAttackGarageCatalog(): Promise<unknown> } | undefined;
    getReadyOptions(): ReadyOptions;
    setReadyOptions(options: ReadyOptions): void;
    getGameOptions(): { autoReady: boolean; mainMenuBgmPath: string; [key: string]: unknown };
    setGameOptions(options: { autoReady: boolean; mainMenuBgmPath: string;
      [key: string]: unknown }): void;
    saveGameOptions(): void;
    getSelection(): ReadySelection | undefined;
    setSelection(selection: ReadySelection): void;
    setVehicleTitle(title: string): void;
    getProfile(): Profile;
    setProfile(profile: Profile): void;
    saveProfile(): void;
    getBgm(): {
      prepareMultiplayer(library: unknown, path: string): Promise<unknown>;
      playMultiplayer(page: string): void;
    } | undefined;
    getAudioContext(): { resume(): Promise<unknown> } | undefined;
    getInterfaceAudio(): { playHover(): void; playStart(): void; playClick(): void } | undefined;
  };
  disposed: boolean;
  multiplayer?: Lobby;
  activeGarage?: { freeze(): void; unfreeze(): void; dispose(): void };
  activeTimeAttackReady?: { freeze(): void; unfreeze(): void; hide(): void; show(): void };
  activeSettings?: { setRoomSpeed(speed: number, version: string): void };
  activeTaskbar?: { setVisible(visible: boolean): void };
  activeWindowNotice?: Notice;
  readyToonEnvironment?: unknown;
  closeMultiplayer(openReady?: boolean, restoreReady?: boolean): void;
  multiplayerGarageOptions(): Promise<unknown>;
  applyMultiplayerGarage(choice: GarageChoice): void;
  changeFavoriteTrack(track: unknown, favorite: boolean): void;
  changeFavoriteItems(items: unknown): void;
  showGarageError(error: unknown): void;
  enterTimeAttackReady(): Promise<unknown>;
}

export interface ReadyMultiplayerDependencies {
  sanitizeReadyOptions(options: ReadyOptions): ReadyOptions;
  nickname(): string | undefined;
  version(id: string): string;
  initialEquipment(profile: Profile): unknown;
  favoriteTrackIds(favorites: unknown[], scope: unknown): unknown;
  createNotice(root: HTMLElement): Notice;
  createLobby(options: Record<string, unknown>): Lobby;
}

/** Create the lobby, bind its UI callbacks, then open its login/connection flow. */
export async function openReadyMultiplayer(controller: ReadyMultiplayerController,
  deps: ReadyMultiplayerDependencies): Promise<void> {
  if (controller.disposed || controller.multiplayer) return;
  const host = controller.host;
  const library = host.getLibrary();
  if (!library) return;

  const garage = host.shell.modal === "garage" ? controller.activeGarage : undefined;
  if (!host.shell.enterMultiplayerLobby(garage ? "garage" : "ready")) return;
  host.setReadyOptions(deps.sanitizeReadyOptions(host.getReadyOptions()));
  garage?.freeze();

  let becameVisible = false;
  const lobby = deps.createLobby({
    library,
    root: host.root,
    nickname: deps.nickname() ?? "",
    version: deps.version("p3553"),
    raceLoader: host.multiplayerRaceLoader,
    prepareAudio: async () => {
      const bgm = host.getBgm();
      if (!bgm) throw new Error("多人缺少 BGM owner。");
      await bgm.prepareMultiplayer(library, host.getGameOptions().mainMenuBgmPath);
    },
    audioContext: () => host.getAudioContext(),
    onPageAudio: (page: string) => host.getBgm()?.playMultiplayer(page),
    onRaceVisibility: (visible: boolean) => controller.activeTaskbar?.setVisible(!visible),
    initialTrackId: host.getSelection()?.trackId,
    initialEquipment: deps.initialEquipment(host.getProfile()),
    initial: host.getProfile().initial,
    garage: {
      options: () => controller.multiplayerGarageOptions(),
      apply: (choice: GarageChoice) => controller.applyMultiplayerGarage(choice),
    },
    speed: (speed: number, version: string) => {
      host.setReadyOptions({
        ...host.getReadyOptions(),
        speed: version === "国服" && speed === 4 ? 4 : 7,
        version,
        settingSpeed: speed,
      });
      controller.activeSettings?.setRoomSpeed(speed, version);
    },
    status: (message: string, error: boolean) => {
      if (error) host.hud.showDebugText(message, "error");
    },
    autoReadyEnabled: () => host.getGameOptions().autoReady,
    toggleAutoReady: () => {
      const current = host.getGameOptions();
      const autoReady = !current.autoReady;
      host.setGameOptions({ ...current, autoReady });
      host.saveGameOptions();
      return autoReady;
    },
    onVisible: () => {
      becameVisible = true;
      controller.activeTimeAttackReady?.hide();
      if (garage && controller.activeGarage === garage) {
        garage.dispose();
        controller.activeGarage = undefined;
      }
    },
    trackFavorites: {
      ids: (scope: unknown) => deps.favoriteTrackIds(host.getProfile().favoriteTracks, scope),
      count: () => host.getProfile().favoriteTracks.length,
      change: (track: unknown, favorite: boolean) =>
        controller.changeFavoriteTrack(track, favorite),
    },
    onNotice: (message: unknown, kind: unknown, details: unknown) => {
      controller.activeWindowNotice ??= deps.createNotice(host.root);
      controller.activeWindowNotice.show(message, kind, details, 2_000);
    },
    onHover: () => host.getInterfaceAudio()?.playHover(),
    onStartActivate: () => host.getInterfaceAudio()?.playStart(),
    onActivate: () => host.getInterfaceAudio()?.playClick(),
  });
  controller.multiplayer = lobby;
  controller.activeTimeAttackReady?.freeze();

  try {
    await lobby.open();
    if (controller.multiplayer !== lobby || controller.disposed) return;
  } catch (error) {
    if (controller.multiplayer !== lobby) return;
    const cancelled = error instanceof Error && error.message === "ACCOUNT_CANCELLED";
    if (garage && !becameVisible) {
      controller.multiplayer = undefined;
      lobby.dispose();
      host.shell.restoreGarageFromMultiplayerLobby();
      garage.unfreeze();
      controller.activeTimeAttackReady?.unfreeze();
    } else if (becameVisible) {
      controller.closeMultiplayer();
    } else {
      controller.multiplayer = undefined;
      lobby.dispose();
      host.shell.leaveMultiplayerLobby();
      controller.activeTimeAttackReady?.unfreeze();
      controller.activeTimeAttackReady?.show();
    }
    if (!cancelled) host.hud.showDebugText(
      `多人游戏：${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

/** Build the same garage session used in the lobby from current Ready equipment. */
export async function readyMultiplayerGarageOptions(controller: ReadyMultiplayerController,
  createNotice: (root: HTMLElement) => Notice): Promise<Record<string, unknown>> {
  const host = controller.host;
  const library = host.getLibrary();
  const environment = controller.readyToonEnvironment;
  const selection = host.getSelection();
  if (!library || !environment || selection?.vehicleItemId === undefined ||
      !selection.characterItemId) {
    throw new Error("房间选车缺少资源或当前装备身份。");
  }
  return {
    library,
    environment,
    root: host.root,
    stageBinding: host.toonStageBinding,
    catalog: await library.timeAttackGarageCatalog(),
    profile: host.getProfile(),
    selectedKartItemId: selection.vehicleItemId,
    selectedKartSystemKey: selection.vehicleSystemKey,
    selectedKartPath: selection.vehiclePath,
    selectedCharacterItemId: selection.characterItemId,
    onFavoriteChange: (items: unknown) => controller.changeFavoriteItems(items),
    onHover: () => host.getInterfaceAudio()?.playHover(),
    onActivate: () => host.getInterfaceAudio()?.playClick(),
    onInteraction: () => { host.getAudioContext()?.resume(); },
    onNotice: (message: unknown, kind: unknown, details: unknown) => {
      controller.activeWindowNotice ??= createNotice(host.root);
      controller.activeWindowNotice.show(message, kind, details);
    },
  };
}

/** Keep Ready selection and persisted equipment aligned after a lobby garage choice. */
export function applyReadyMultiplayerGarage(controller: ReadyMultiplayerController,
  choice: GarageChoice): void {
  const host = controller.host;
  const selection = host.getSelection();
  if (!selection) return;
  host.setSelection({
    ...selection,
    vehiclePath: choice.kart.path,
    vehicleItemId: choice.kart.itemId,
    vehicleSystemKey: choice.kart.systemKey,
    characterPath: choice.character.path,
    characterItemId: choice.character.itemId,
  });
  host.setVehicleTitle(choice.kart.title);
  host.setProfile({ ...host.getProfile(), equipment: choice.equipment });
  try {
    host.saveProfile();
  } catch (error) {
    host.hud.showDebugText(`本次装备选择未保存：${String(error)}`, "error");
  }
}
