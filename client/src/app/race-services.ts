/** Record persistence and Kart booster decisions owned by the game shell. */

export interface RecordServiceConfiguration {
  library: unknown;
  getSelection(): unknown;
  getVehicleTitle(): unknown;
  getTrackId(): unknown;
  getReadyOptions(): unknown;
  getProfile(): unknown;
  getLocalNickname(): unknown;
  getPlayerSlot(): unknown;
  getRecorder(): unknown;
  reportError(message: string): void;
}

export interface RecordServiceHost {
  recordsInstance?: unknown;
  replayLibrary: unknown;
  session: {
    selection?: unknown;
    vehicleTitle?: unknown;
    track?: { data: { trackId: unknown } };
  };
  timeAttackReadyOptions: unknown;
  userProfile: unknown;
  localNickname: unknown;
  currentPlayerSlot: unknown;
  ghostRecorder?: unknown;
  hud: { showDebugText(message: string, level: string): void };
}

/** Capture the library once while reading current race fields on demand. */
export function getOrCreateRecordService<Service>(
  host: RecordServiceHost,
  createService: (configuration: RecordServiceConfiguration) => Service,
): Service {
  return (host.recordsInstance ??= createService({
    library: host.replayLibrary,
    getSelection: () => host.session.selection,
    getVehicleTitle: () => host.session.vehicleTitle,
    getTrackId: () => host.session.track?.data.trackId,
    getReadyOptions: () => host.timeAttackReadyOptions,
    getProfile: () => host.userProfile,
    getLocalNickname: () => host.localNickname,
    getPlayerSlot: () => host.currentPlayerSlot,
    getRecorder: () => host.ghostRecorder,
    reportError: message => host.hud.showDebugText(message, "error"),
  })) as Service;
}

export interface KartBoosterHost {
  session: {
    kartEffects?: {
      setState(
        audioState: unknown,
        dualMode: unknown,
        dualTeam: unknown,
        visualState: unknown,
        nowMs: unknown,
      ): unknown;
    };
  };
  physics: {
    audioState(): unknown;
    dualBoosterMode(): unknown;
    dualBoosterTeam(): unknown;
    setAnimationSlot(slot: unknown): void;
  };
  kartView: { enterDualUse(): unknown };
}

/** Update the effect first; only a state transition enters dual booster use. */
export function updateKartBoosterState(
  host: KartBoosterHost,
  nowMs: unknown,
  visualState: unknown,
  previousAnimationSlot: unknown,
): unknown {
  if (!host.session.kartEffects?.setState(
    host.physics.audioState(),
    host.physics.dualBoosterMode(),
    host.physics.dualBoosterTeam(),
    visualState,
    nowMs,
  )) {
    return previousAnimationSlot;
  }
  const animationSlot = host.kartView.enterDualUse();
  if (animationSlot !== undefined) host.physics.setAnimationSlot(animationSlot);
  return animationSlot;
}
