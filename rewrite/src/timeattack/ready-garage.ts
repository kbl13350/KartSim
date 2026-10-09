import { garageViewCatalog } from "../account/garage-ownership";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import { garageStuffSupport } from "./garage-stuff";

interface GarageChoice {
  kart: { path: string; itemId: number; systemKey: string; title: string };
  character: { path: string; itemId: number };
  equipment: unknown;
  garage?: unknown;
}

interface GarageView {
  dispose(): void;
  show(): void;
}

interface ReadyView {
  freeze(): void;
  unfreeze(): void;
  dispose(): void;
}

interface Notice {
  show(message: unknown, kind: unknown, details: unknown): void;
}

export interface ReadyGarageController {
  host: {
    root: HTMLElement;
    toonStageBinding: unknown;
    hud: { showDebugText(message: string, level: string): void };
    shell: {
      current: string;
      modal?: string;
      openModal(name: string): boolean;
      closeModal(name: string): void;
    };
    getLibrary(): { timeAttackGarageCatalog(): Promise<unknown> } | undefined;
    getSelection(): ReadySelection | undefined;
    setSelection(selection: ReadySelection): void;
    getReadyOptions(): ReadyOptions;
    setReadyOptions(options: ReadyOptions): void;
    getVehicleTitle(): string;
    setVehicleTitle(title: string): void;
    getProfile(): { equipment?: unknown; garage?: unknown; [key: string]: unknown };
    setProfile(profile: { equipment?: unknown; garage?: unknown; [key: string]: unknown }): void;
    saveProfile(): void;
    enterTimeAttackReady(profile: unknown): Promise<unknown>;
    selectReadyGarage(selection: ReadySelection, options: ReadyOptions,
      choice: GarageChoice): void;
    getInterfaceAudio(): { playHover(): void; playClick(): void } | undefined;
    getAudioContext(): { resume(): Promise<unknown> } | undefined;
    getBgm(): { playGarage(): void } | undefined;
  };
  disposed: boolean;
  multiplayer?: { hasModal: boolean; leaveRoom(reason: string): Promise<boolean> };
  activeSettings?: unknown;
  settingsOpening: boolean;
  readyToonEnvironment?: { dispose(): void };
  activeTimeAttackReady?: ReadyView;
  activeTaskbar?: unknown;
  activeGarage?: GarageView;
  activeWindowNotice?: Notice;
  readyModalBusy(): boolean;
  closeMultiplayer(openReady?: boolean, restoreReady?: boolean): void;
  enterTimeAttackReady(): Promise<unknown>;
  showGarageError(error: unknown): void;
  changeFavoriteItems(items: unknown): void;
  applyImmediateGarageSelection(selection: ReadySelection, options: ReadyOptions,
    choice: GarageChoice): void;
}

export interface ReadyGarageDependencies {
  loadGarage(options: Record<string, unknown>): Promise<GarageView>;
  loadGarageX(options: Record<string, unknown>): Promise<GarageView>;
  createNotice(root: HTMLElement): Notice;
  speed(options: ReadyOptions): number;
  defaultVersion: string;
}

/** The equipped kart and rider every garage view must list (it fails closed otherwise). */
export function selectionKeep(selection: ReadySelection | undefined): {
  kartItemId?: number; kartSystemKey?: string; characterItemId?: number;
} {
  return { kartItemId: selection?.vehicleItemId, kartSystemKey: selection?.vehicleSystemKey,
    characterItemId: selection?.characterItemId };
}

function showNotice(controller: ReadyGarageController, deps: ReadyGarageDependencies,
  message: unknown, kind: unknown, details: unknown): void {
  controller.activeWindowNotice ??= deps.createNotice(controller.host.root);
  controller.activeWindowNotice.show(message, kind, details);
}

/** Open the classic garage dialog from Ready. */
export async function openReadyGarage(controller: ReadyGarageController,
  selection: ReadySelection, options: ReadyOptions,
  deps: ReadyGarageDependencies): Promise<void> {
  if (controller.readyModalBusy()) return;
  const host = controller.host;
  const library = host.getLibrary();
  const environment = controller.readyToonEnvironment;
  if (!library || !environment || !selection.vehiclePath ||
      selection.vehicleItemId === undefined || !selection.characterPath ||
      !selection.characterItemId) {
    controller.showGarageError("GarageDialog 缺少资源库或当前装备身份。");
    return;
  }
  host.shell.openModal("garage");
  try {
    // Only owned, unexpired items; the current selection stays listed.
    const ownedCatalog = async () => garageViewCatalog(await library.timeAttackGarageCatalog(),
      selectionKeep(selection));
    const catalog = await ownedCatalog();
    let view!: GarageView;
    // 精品道具: boxes open here.
    const stuff = await garageStuffSupport({ library, root: host.root,
      view: () => view as unknown as { options: { catalog: Record<string, unknown> }; render(): void } | undefined,
      refreshCatalog: ownedCatalog as unknown as () => Promise<Record<string, unknown>> });
    const close = () => {
      stuff.dispose();
      view.dispose();
      if (controller.activeGarage === view) controller.activeGarage = undefined;
      if (host.shell.modal === "garage") host.shell.closeModal("garage");
    };
    view = await deps.loadGarage({
      library, root: host.root, stageBinding: host.toonStageBinding,
      environment, catalog: { ...(catalog as object), stuff: stuff.stuff }, profile: host.getProfile(),
      stuffIcon: stuff.stuffIcon, onUseItem: stuff.onUseItem,
      selectedKartItemId: selection.vehicleItemId,
      // System karts (the starter practice kart) all have item id 0.
      selectedKartSystemKey: selection.vehicleSystemKey,
      selectedKartPath: selection.vehiclePath,
      selectedCharacterItemId: selection.characterItemId,
      onConfirm: (choice: GarageChoice) => {
        close();
        host.selectReadyGarage(selection, options, choice);
      },
      onCancel: close,
      onFavoriteChange: (items: unknown) => controller.changeFavoriteItems(items),
      onHover: () => host.getInterfaceAudio()?.playHover(),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
      onInteraction: () => { host.getAudioContext()?.resume(); },
      onNotice: (message: unknown, kind: unknown, details: unknown) =>
        showNotice(controller, deps, message, kind, details),
    });
    controller.activeGarage = view;
    view.show();
  } catch (error) {
    controller.showGarageError(error);
    if (host.shell.modal === "garage") host.shell.closeModal("garage");
  }
}

/** Commit a classic garage choice only after Ready successfully reloads. */
export async function selectReadyGarage(controller: ReadyGarageController,
  selection: ReadySelection, options: ReadyOptions,
  choice: GarageChoice): Promise<void> {
  const host = controller.host;
  const previousTitle = host.getVehicleTitle();
  const previousOptions = host.getReadyOptions();
  const profile = { ...host.getProfile(), equipment: choice.equipment };
  host.setReadyOptions({ ...options });
  host.setSelection({
    ...selection,
    vehiclePath: choice.kart.path,
    vehicleItemId: choice.kart.itemId,
    vehicleSystemKey: choice.kart.systemKey,
    characterPath: choice.character.path,
    characterItemId: choice.character.itemId,
  });
  host.setVehicleTitle(choice.kart.title);
  try {
    await host.enterTimeAttackReady(profile);
  } catch (error) {
    host.setSelection(selection);
    host.setVehicleTitle(previousTitle);
    host.setReadyOptions(previousOptions);
    controller.showGarageError(error);
    return;
  }
  host.setProfile(profile);
  try {
    host.saveProfile();
  } catch (error) {
    host.hud.showDebugText(`本次装备选择未保存：${String(error)}`, "error");
  }
}

/** Open the full-screen garage, leaving a multiplayer room first if needed. */
export async function openReadyGarageX(controller: ReadyGarageController,
  selection: ReadySelection, options: ReadyOptions,
  deps: ReadyGarageDependencies): Promise<void> {
  const lobby = controller.multiplayer;
  const restoreReady = () => {
    if (lobby) void controller.enterTimeAttackReady().catch(
      error => controller.showGarageError(error));
  };
  if (lobby) {
    if (controller.disposed || controller.activeSettings || controller.settingsOpening ||
        lobby.hasModal || controller.host.shell.current !== "MultiplayerLobby" ||
        !(await lobby.leaveRoom("garage")) || controller.disposed ||
        controller.multiplayer !== lobby) return;
    controller.closeMultiplayer(false, false);
    if (controller.disposed) return;
    options = controller.host.getReadyOptions();
  }
  // Callers may hold an older selection (the taskbar is built once); GarageX
  // fails closed unless it opens on the equipment Ready shows now.
  selection = controller.host.getSelection() ?? selection;
  if (controller.readyModalBusy()) {
    restoreReady();
    return;
  }
  const host = controller.host;
  const library = host.getLibrary();
  const environment = controller.readyToonEnvironment;
  if (!library || !environment || selection.vehicleItemId === undefined ||
      selection.characterItemId === undefined) {
    restoreReady();
    return;
  }
  if (!host.shell.openModal("garage")) {
    restoreReady();
    return;
  }
  const ready = controller.activeTimeAttackReady;
  ready?.freeze();
  try {
    const view = await deps.loadGarageX({
      library, taskbar: controller.activeTaskbar, environment,
      catalog: garageViewCatalog(await library.timeAttackGarageCatalog(),
        selectionKeep(selection)), root: host.root,
      stageBinding: host.toonStageBinding, profile: host.getProfile(),
      speed: deps.speed(options), version: options.version ?? deps.defaultVersion,
      selectedKartItemId: selection.vehicleItemId,
      selectedCharacterItemId: selection.characterItemId,
      onChange: (choice: GarageChoice) =>
        controller.applyImmediateGarageSelection(selection, options, choice),
      onNotice: (message: unknown, kind: unknown, details: unknown) =>
        showNotice(controller, deps, message, kind, details),
      onInteraction: () => { host.getAudioContext()?.resume(); },
      onHover: () => host.getInterfaceAudio()?.playHover(),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
    });
    if (environment !== controller.readyToonEnvironment) {
      view.dispose();
      throw new Error("车库环境在页面切换期间已失效。");
    }
    ready?.dispose();
    if (controller.activeTimeAttackReady === ready) controller.activeTimeAttackReady = undefined;
    controller.activeGarage = view;
    view.show();
    host.getBgm()?.playGarage();
  } catch (error) {
    ready?.unfreeze();
    controller.showGarageError(error);
    if (host.shell.modal === "garage") host.shell.closeModal("garage");
    void controller.enterTimeAttackReady();
  }
}

export function returnReadyGarage(controller: ReadyGarageController): void {
  const shell = controller.host.shell;
  if (shell.modal === "garage") shell.closeModal("garage");
  void controller.enterTimeAttackReady().catch(error => controller.showGarageError(error));
}

/** Full-screen garage applies each equipment change immediately. */
export function applyImmediateReadyGarageSelection(controller: ReadyGarageController,
  selection: ReadySelection, options: ReadyOptions, choice: GarageChoice): void {
  const host = controller.host;
  host.setReadyOptions({ ...options });
  host.setSelection({
    ...selection,
    vehiclePath: choice.kart.path,
    vehicleItemId: choice.kart.itemId,
    vehicleSystemKey: choice.kart.systemKey,
    characterPath: choice.character.path,
    characterItemId: choice.character.itemId,
  });
  host.setVehicleTitle(choice.kart.title);
  host.setProfile({
    ...host.getProfile(), equipment: choice.equipment,
    garage: choice.garage ?? host.getProfile().garage,
  });
  try {
    host.saveProfile();
  } catch (error) {
    host.hud.showDebugText(`本次车库变更未保存：${String(error)}`, "error");
  }
}

export function showReadyGarageError(controller: ReadyGarageController, error: unknown): void {
  controller.host.hud.showDebugText(
    `GarageDialog fail-closed：${error instanceof Error ? error.message : String(error)}`,
    "error");
}
