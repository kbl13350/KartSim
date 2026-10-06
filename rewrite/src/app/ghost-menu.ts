/** Game-shell decisions that connect saved Ghost records to the Ready screen. */
export interface GhostReadyOptions {
  speed: number;
  booster: number;
  version: string;
  settingSpeed: number;
  [key: string]: unknown;
}

export interface GhostMenuConfiguration<Selection, Library, ReplayLibrary> {
  library: ReplayLibrary;
  getLibrary(): Library | undefined;
  getSelection(): Selection | undefined;
  currentKey(): unknown;
  selectTrack(selection: Selection, speed: number, booster: number, version: string): Promise<void>;
  speedVersion(): string;
  refreshRecord(): void;
  reportError(message: string): void;
  samplingMode(): unknown;
  changeSamplingMode(mode: unknown): void;
  resetNickname(): void;
}

export interface GhostMenuHost<Selection extends { trackId?: string }, Library, ReplayLibrary> {
  replayLibrary: ReplayLibrary;
  rhoLibrary: Library | undefined;
  session: { selection?: Selection };
  timeAttackReadyOptions: GhostReadyOptions;
  ready: { refreshRecord(): void };
  hud: { showDebugText(message: string, level: string): void };
  ghostSamplingMode: unknown;
  localNickname: string;
  touchControls: { ghostMenuSlot: unknown };
  applyNewRiderRegistration(): Promise<unknown>;
  enterTimeAttackReady(): Promise<unknown>;
  currentGhostRecordKey(): unknown;
  selectGhostTrack(selection: Selection, speed: number, booster: number, version: string): Promise<void>;
  ghostRecordMenu(): { mount(slot: unknown): unknown };
}

/** A Ghost record may point at a different track or speed profile. */
export async function selectGhostTrack<Selection extends { trackId?: string }>(
  host: GhostMenuHost<Selection, unknown, unknown>,
  selection: Selection,
  speed: number,
  booster: number,
  version: string,
): Promise<void> {
  host.timeAttackReadyOptions = {
    ...host.timeAttackReadyOptions,
    speed: speed === 4 ? 4 : 7,
    version,
    settingSpeed: version === "国服" && (speed === 4 || speed === 7) ? 7 : speed,
    booster,
  };
  host.session.selection = { ...selection };
  await host.enterTimeAttackReady();
}

export function currentGhostRecordKey<Selection extends { trackId?: string }>(
  host: GhostMenuHost<Selection, unknown, unknown>,
  recordKey: (selection: Selection, options: GhostReadyOptions) => unknown,
): unknown {
  const selection = host.session.selection;
  if (selection?.trackId) return recordKey(selection, host.timeAttackReadyOptions);
  return undefined;
}

/** The UI owns rendering; this adapter provides live game-shell state and actions. */
export function createGhostRecordMenu<Selection extends { trackId?: string }, Library, ReplayLibrary, Menu>(
  host: GhostMenuHost<Selection, Library, ReplayLibrary>,
  createMenu: (configuration: GhostMenuConfiguration<Selection, Library, ReplayLibrary>) => Menu,
  clearNickname: () => void,
): Menu {
  return createMenu({
    library: host.replayLibrary,
    getLibrary: () => host.rhoLibrary,
    getSelection: () => host.session.selection,
    currentKey: () => host.currentGhostRecordKey(),
    selectTrack: (selection, speed, booster, version) =>
      host.selectGhostTrack(selection, speed, booster, version),
    speedVersion: () => host.timeAttackReadyOptions.version ?? "国服",
    refreshRecord: () => host.ready.refreshRecord(),
    reportError: error => host.hud.showDebugText(error, "error"),
    samplingMode: () => host.ghostSamplingMode,
    changeSamplingMode: mode => { host.ghostSamplingMode = mode; },
    resetNickname: () => {
      clearNickname();
      host.localNickname = "";
      host.applyNewRiderRegistration().catch(error => host.hud.showDebugText(
        error instanceof Error ? error.message : String(error), "error",
      ));
    },
  });
}

export function mountGhostRecordMenu(
  host: Pick<GhostMenuHost<{ trackId?: string }, unknown, unknown>, "ghostRecordMenu" | "touchControls">,
): unknown {
  return host.ghostRecordMenu().mount(host.touchControls.ghostMenuSlot);
}
