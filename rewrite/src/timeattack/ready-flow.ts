import { openReadyHouse } from "./ready-house";
import type { ReadyShopController } from "./ready-shop";
import { openShopUnlessRacing } from "./ready-shop-guard";
import { goReadyHome, openReadyHome, preloadReadyHome, syncReadyHome,
  type ReadyHomeController } from "./ready-home";

/** The selection carried from the Ready screen into a single-player race. */
export interface ReadySelection {
  mapPath?: string;
  trackId?: string;
  vehiclePath?: string;
  vehicleItemId?: number;
  vehicleSystemKey?: string;
  characterPath?: string;
  characterItemId?: number;
  [key: string]: unknown;
}

export interface ReadyOptions {
  showGhost?: boolean;
  speed?: number;
  version?: string;
  settingSpeed?: number;
  [key: string]: unknown;
}

export interface ReadyTrack {
  id: string;
  path: string;
  gameType?: unknown;
}

export interface RandomTrackGroup {
  id: string;
  trackIds: string[];
  [key: string]: unknown;
}

export type TrackChoice =
  | { kind: "track"; track: ReadyTrack }
  | { kind: "random"; group: RandomTrackGroup };

interface ReadyLibrary {
  timeAttackGarageCatalog(): Promise<{
    karts: unknown[];
    characters: Array<{ itemId: number; path: string }>;
  }>;
  timeAttackTrackCatalog(): Promise<ReadyTrack[]>;
  timeAttackRandomTrackGroups(): Promise<RandomTrackGroup[]>;
  timeAttackRandomTrackNames(): Promise<Map<string, string>>;
}

interface ReadyView {
  show(): void;
  freeze(): void;
  unfreeze(): void;
  dispose(): void;
}

interface Taskbar {
  setVisible(visible: boolean): void;
}

interface GarageView {
  freeze(): void;
  unfreeze(): void;
  dispose(): void;
}

interface NoticeWindow {
  show(message: unknown, kind: unknown, details: unknown, durationMs: number): void;
}

/** Only the host operations used by this flow cross the generated-code boundary. */
export interface ReadyFlowController {
  host: {
    root: HTMLElement;
    toonStageBinding: unknown;
    hud: {
      beginLoading(): void;
      finishLoading(): void;
      showDebugText(message: string, kind: string): void;
    };
    shell: {
      isReadyStageOpening: boolean;
      started: boolean;
      current: string;
      modal?: string;
      beginReadyStage(): void;
      endReadyStage(): void;
      openModal(name: string): boolean;
      closeModal(name: string): void;
    };
    getSelection(): ReadySelection | undefined;
    setSelection(selection: ReadySelection): void;
    getReadyOptions(): ReadyOptions;
    setReadyOptions(options: ReadyOptions): void;
    getLibrary(): ReadyLibrary | undefined;
    getBgm(): { playReady(): void } | undefined;
    getProfile(): unknown;
    setProfile(profile: unknown): void;
    saveProfile(): void;
    getRecordFor(key: unknown): unknown;
    getAudioContext(): { resume(): Promise<unknown> } | undefined;
    getInterfaceAudio(): { playHover(): void; playClick(): void; playStart(): void } | undefined;
    enterRaceStart(): boolean;
    endRaceStart(): void;
    startRace(selection: ReadySelection): Promise<unknown>;
    enterTimeAttackReady(): Promise<unknown>;
    releaseRaceForReady(): void;
  };
  disposed: boolean;
  multiplayer?: unknown;
  activeGarage?: GarageView;
  activeTrackSelect?: ReadyView;
  activeTimeAttackReady?: ReadyView;
  activeTaskbar?: Taskbar;
  activeWindowNotice?: NoticeWindow;
  readyToonEnvironment?: { dispose(): void };
  activeRandomGroup?: RandomTrackGroup;
  randomTrackCatalog?: ReadyTrack[];
  randomTrackSession: {
    selectGroup(id: string | undefined): void;
    pick(group: RandomTrackGroup, catalog: ReadyTrack[]): ReadyTrack;
  };
  readyStageContext(): ReadyStageContext;
  acquireReadyToonEnvironment(library: ReadyLibrary): Promise<{ dispose(): void } | undefined>;
  startRaceFromReady(selection: ReadySelection, options: ReadyOptions): Promise<void>;
  openTrackSelect(selection: ReadySelection, options: ReadyOptions): Promise<void>;
  openGarage(selection: ReadySelection, options: ReadyOptions): void;
  openGarageX(selection: ReadySelection, options: ReadyOptions): void;
  openSettings(): void;
  openMultiplayer(): void;
  returnMultiplayerToSinglePlayer(): void;
  returnGarageToReady(): void;
  readyModalBusy(): boolean;
  showTrackSelectError(error: unknown): void;
  changeFavoriteTrack(track: ReadyTrack | undefined, favorite: boolean): void;
  selectReadyChoice(
    selection: ReadySelection,
    options: ReadyOptions,
    choice: TrackChoice,
    catalog: ReadyTrack[],
  ): void;
  selectReadyTrack(selection: ReadySelection, options: ReadyOptions, track: ReadyTrack): void;
  resolveRandomSelection(selection: ReadySelection): Promise<ReadySelection>;
}

export interface ReadyStageContext {
  selection: ReadySelection;
  library: ReadyLibrary;
  bgm: { playReady(): void };
}

export interface ReadyViewDependencies {
  findKart(karts: unknown[], itemId: number, path: string, systemKey?: string): unknown;
  loadTaskbar(options: Record<string, unknown>): Promise<Taskbar>;
  loadReadyView(options: Record<string, unknown>): Promise<ReadyView>;
}

export interface TrackSelectDependencies {
  loadTrackSelect(options: Record<string, unknown>): Promise<ReadyView>;
  favoriteTrackIds(favorites: unknown, tracks: ReadyTrack[]): unknown;
  createWindowNotice(root: HTMLElement): NoticeWindow;
}

/** Validate all assets and owners needed before opening the Ready screen. */
export function readyStageContext(controller: ReadyFlowController): ReadyStageContext {
  const selection = controller.host.getSelection();
  if (
    !selection?.mapPath ||
    !selection.trackId ||
    !selection.vehiclePath ||
    selection.vehicleItemId === undefined ||
    !selection.characterPath ||
    !selection.characterItemId
  ) {
    throw new Error("Ready 缺少当前赛道、车辆或人物身份。 ");
  }
  const library = controller.host.getLibrary();
  if (!library) throw new Error("Ready 缺少资源库。 ");
  const bgm = controller.host.getBgm();
  if (!bgm) throw new Error("Ready 缺少全局 BGM owner。 ");
  return { selection, library, bgm };
}

/** Load the Ready toon scene once, disposing a late load after the race begins. */
export async function acquireReadyToonEnvironment(
  controller: ReadyFlowController,
  library: ReadyLibrary,
  loadEnvironment: (library: ReadyLibrary) => Promise<{ dispose(): void }>,
): Promise<{ dispose(): void } | undefined> {
  if (controller.readyToonEnvironment) return controller.readyToonEnvironment;
  const environment = await loadEnvironment(library);
  if (controller.host.shell.started) {
    environment.dispose();
    return undefined;
  }
  controller.readyToonEnvironment = environment;
  return environment;
}

/** Build the single-player menu and commit it only after its assets are ready. */
export async function enterTimeAttackReady(
  controller: ReadyFlowController,
  profile: unknown,
  dependencies: ReadyViewDependencies,
): Promise<void> {
  const { host } = controller;
  if (host.shell.isReadyStageOpening) return;
  const { selection, library, bgm } = controller.readyStageContext();
  let readyShown = false;
  preloadReadyHome(controller as unknown as ReadyHomeController);
  host.shell.beginReadyStage();
  const garage = controller.activeGarage;
  try {
    garage?.freeze();
    controller.activeTrackSelect?.dispose();
    controller.activeTrackSelect = undefined;
    host.releaseRaceForReady();

    const environment = await controller.acquireReadyToonEnvironment(library);
    if (!environment) return;
    const catalog = await library.timeAttackGarageCatalog();
    const kart = dependencies.findKart(
      catalog.karts,
      selection.vehicleItemId!,
      selection.vehiclePath!,
      selection.vehicleSystemKey,
    );
    if (!kart) throw new Error(`${selection.vehiclePath} 缺少精确 Ready 车辆身份。`);
    const character = catalog.characters.find(
      item => item.itemId === selection.characterItemId &&
        item.path.toLowerCase() === selection.characterPath!.toLowerCase(),
    );
    if (!character) throw new Error(`${selection.characterPath} 缺少精确 Ready 人物身份。`);

    controller.activeTaskbar ??= await dependencies.loadTaskbar({
      library,
      root: host.root,
      onSettings: () => controller.openSettings(),
      onHover: () => host.getInterfaceAudio()?.playHover(),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
      // The taskbar outlives this Ready build: read the equipment at click time
      // (onboarding, purchases and expiry repairs replace the selection).
      onGarage: () => controller.openGarageX(host.getSelection() ?? selection,
        host.getReadyOptions()),
      onHouse: () => { void openReadyHouse(controller); },
      onSinglePlayer: () => {
        // The release 单人游戏 page; its 练习计时赛 card opens time attack.
        void goReadyHome(controller as unknown as ReadyHomeController, () => {
          if (controller.multiplayer) return controller.returnMultiplayerToSinglePlayer();
          if (controller.activeGarage) controller.returnGarageToReady();
        }, "single");
      },
      onMultiplayer: () => controller.openMultiplayer(),
      onShop: () => openShopUnlessRacing(controller as unknown as ReadyShopController),
      onHome: () => {
        const home = controller as unknown as ReadyHomeController;
        void goReadyHome(home, () => {
          if (controller.multiplayer) return controller.returnMultiplayerToSinglePlayer();
          if (controller.activeGarage) controller.returnGarageToReady();
        });
      },
    });

    const view = await dependencies.loadReadyView({
      library,
      root: host.root,
      stageBinding: host.toonStageBinding,
      environment,
      trackPath: selection.mapPath,
      trackId: selection.trackId,
      randomGroup: controller.activeRandomGroup,
      kart,
      character,
      profile,
      initialOptions: host.getReadyOptions(),
      recordFor: (key: unknown) =>
        controller.activeRandomGroup ? undefined : host.getRecordFor(key),
      onTraining: (options: ReadyOptions) => controller.startRaceFromReady(selection, options),
      onTrackSelect: (options: ReadyOptions) => controller.openTrackSelect(selection, options),
      onItemSelect: (options: ReadyOptions) => controller.openGarage(selection, options),
      // The window's close button returns to the 单人游戏 page it opened from.
      onExit: () => {
        void openReadyHome(controller as unknown as ReadyHomeController, "single");
      },
      onInteraction: () => host.getAudioContext()?.resume(),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
      onHover: () => host.getInterfaceAudio()?.playHover(),
      onStartActivate: () => host.getInterfaceAudio()?.playStart(),
    });
    if (environment !== controller.readyToonEnvironment) {
      view.dispose();
      return;
    }
    try {
      view.show();
    } catch (error) {
      view.dispose();
      throw error;
    }
    controller.activeTimeAttackReady?.dispose();
    controller.activeTimeAttackReady = view;
    garage?.dispose();
    if (controller.activeGarage === garage) controller.activeGarage = undefined;
    controller.activeTaskbar.setVisible(true);
    bgm.playReady();
    readyShown = true;
  } finally {
    host.shell.endReadyStage();
    // Home needs the Ready-opening lock released before it can cover Ready.
    if (readyShown) syncReadyHome(controller as unknown as ReadyHomeController);
    if (garage && controller.activeGarage === garage && !host.shell.started) {
      garage.unfreeze();
      if (!host.shell.modal) host.shell.openModal("garage");
    }
  }
}

/** Open the track menu, including random pools and favorites. */
export async function openTrackSelect(
  controller: ReadyFlowController,
  selection: ReadySelection,
  options: ReadyOptions,
  dependencies: TrackSelectDependencies,
): Promise<void> {
  if (controller.readyModalBusy()) return;
  const { host } = controller;
  const library = host.getLibrary();
  if (!library || !selection.trackId) {
    host.hud.showDebugText("SelectTrackEx 缺少资源库或当前赛道身份。", "error");
    return;
  }
  host.shell.openModal("track-select");
  try {
    const tracks = await library.timeAttackTrackCatalog();
    let groups: RandomTrackGroup[] = [];
    let randomTrackNames = new Map<string, string>();
    try {
      groups = await library.timeAttackRandomTrackGroups();
      if (groups.length > 0) randomTrackNames = await library.timeAttackRandomTrackNames();
    } catch (error) {
      controller.showTrackSelectError(new Error(
        `随机赛道功能不可用：${error instanceof Error ? error.message : String(error)}`,
      ));
    }
    controller.randomTrackCatalog = tracks;
    let view: ReadyView;
    const close = () => {
      view.dispose();
      if (controller.activeTrackSelect === view) controller.activeTrackSelect = undefined;
      if (host.shell.modal === "track-select") host.shell.closeModal("track-select");
    };
    view = await dependencies.loadTrackSelect({
      library,
      root: host.root,
      tracks,
      selectedTrackId: selection.trackId,
      randomGroups: groups,
      randomTrackNames,
      selectedRandomGroupId: controller.activeRandomGroup?.id,
      favoriteTrackIds: dependencies.favoriteTrackIds(
        (host.getProfile() as { favoriteTracks: unknown }).favoriteTracks,
        tracks,
      ),
      getFavoriteCount: () =>
        (host.getProfile() as { favoriteTracks: unknown[] }).favoriteTracks.length,
      onFavoriteChange: (trackId: string, favorite: boolean) => {
        const track = tracks.find(item => item.id === trackId);
        controller.changeFavoriteTrack(track, favorite);
      },
      onConfirm: (choice: TrackChoice) => {
        close();
        controller.selectReadyChoice(selection, options, choice, tracks);
      },
      onCancel: close,
      onInteraction: () => host.getAudioContext()?.resume(),
      onError: (error: unknown) => controller.showTrackSelectError(error),
      onNotice: (message: unknown, kind: unknown, details: unknown) => {
        controller.activeWindowNotice ??= dependencies.createWindowNotice(host.root);
        controller.activeWindowNotice.show(message, kind, details, 2000);
      },
    });
    controller.activeTrackSelect = view;
    view.show();
  } catch (error) {
    controller.showTrackSelectError(error);
    if (host.shell.modal === "track-select") host.shell.closeModal("track-select");
  }
}

export function selectReadyTrack(
  controller: ReadyFlowController,
  selection: ReadySelection,
  options: ReadyOptions,
  track: ReadyTrack,
): void {
  controller.activeRandomGroup = undefined;
  controller.randomTrackSession.selectGroup(undefined);
  controller.host.setReadyOptions({ ...options });
  controller.host.setSelection({ ...selection, mapPath: track.path, trackId: track.id });
  controller.host.enterTimeAttackReady().catch(error => controller.showTrackSelectError(error));
}

export function selectReadyChoice(
  controller: ReadyFlowController,
  selection: ReadySelection,
  options: ReadyOptions,
  choice: TrackChoice,
  catalog: ReadyTrack[],
  belongsToGroup: (group: RandomTrackGroup, gameType: unknown) => boolean,
): void {
  if (choice.kind === "track") {
    controller.selectReadyTrack(selection, options, choice.track);
    return;
  }
  const preview = catalog.find(track =>
    choice.group.trackIds.includes(track.id) && belongsToGroup(choice.group, track.gameType),
  );
  if (!preview) {
    controller.showTrackSelectError(
      new Error(`随机池 ${choice.group.id} 没有可加载的预览赛道。`),
    );
    return;
  }
  controller.activeRandomGroup = choice.group;
  controller.randomTrackSession.selectGroup(choice.group.id);
  controller.randomTrackCatalog = catalog;
  controller.host.setReadyOptions({ ...options, showGhost: false });
  controller.host.setSelection({ ...selection, mapPath: preview.path, trackId: preview.id });
  controller.host.enterTimeAttackReady().catch(error => controller.showTrackSelectError(error));
}

/** Resolve a random pool only when the player starts the race. */
export async function resolveRandomSelection(
  controller: ReadyFlowController,
  selection: ReadySelection,
): Promise<ReadySelection> {
  const group = controller.activeRandomGroup;
  // A story race keeps its own track and leaves the time attack pool alone.
  if (!group || selection.story) return selection;
  const library = controller.host.getLibrary();
  if (!library) throw new Error("随机赛道启动缺少资源库。");
  const catalog = controller.randomTrackCatalog ?? await library.timeAttackTrackCatalog();
  controller.randomTrackCatalog = catalog;
  const track = controller.randomTrackSession.pick(group, catalog);
  return { ...selection, mapPath: track.path, trackId: track.id };
}

/** Prevent duplicate starts and release the loading screen on every settled path. */
export async function startRaceFromReady(
  controller: ReadyFlowController,
  selection: ReadySelection,
  options: ReadyOptions,
): Promise<void> {
  const { host } = controller;
  if (!host.enterRaceStart()) return;
  host.setReadyOptions({ ...options });
  host.hud.beginLoading();
  try {
    await host.getAudioContext()?.resume();
    const resolvedSelection = await controller.resolveRandomSelection(selection);
    if (controller.disposed) return;
    host.setSelection(resolvedSelection);
    await host.startRace(resolvedSelection);
  } catch (error) {
    if (!controller.disposed) {
      host.hud.showDebugText(error instanceof Error ? error.message : String(error), "error");
    }
  } finally {
    if (!controller.disposed) {
      host.hud.finishLoading();
      host.endRaceStart();
    }
  }
}
