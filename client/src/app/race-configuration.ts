interface Track {
  group: {
    removeFromParent(): void;
  };
  dispose(): void;
}

interface Tachometer {
  setManualBoostAlarm(enabled: boolean): void;
}

export interface RaceConfigurationPresenter<TrackType extends Track, Scene> {
  host: {
    session: {
      track?: TrackType;
      tachometer?: Tachometer;
    };
    scene: Scene & { add(group: TrackType["group"]): void };
    gameOptions: { toonLine: boolean; dualBoostAuto: boolean };
    getPhysics(): { setDualBoostAuto(enabled: boolean, kartItemId: number): void };
  };
}

export interface RaceConfigurationDependencies<TrackType extends Track, Scene> {
  applyTrackFog(scene: Scene, track: TrackType): void;
  setToonLinesEnabled(enabled: boolean): void;
  isManualBoostTachometer(value: unknown): value is Tachometer;
}

/** Replace the active track and apply its fog to the scene. */
export function replaceRaceTrack<TrackType extends Track, Scene>(
  presenter: RaceConfigurationPresenter<TrackType, Scene>,
  nextTrack: TrackType,
  dependencies: Pick<RaceConfigurationDependencies<TrackType, Scene>, "applyTrackFog">,
): void {
  presenter.host.session.track?.group.removeFromParent();
  presenter.host.session.track?.dispose();
  presenter.host.session.track = nextTrack;
  presenter.host.scene.add(presenter.host.session.track.group);
  dependencies.applyTrackFog(presenter.host.scene, nextTrack);
}

/** Apply toon lines and the kart-specific dual-boost alarm rule. */
export function applyRaceOptions<TrackType extends Track, Scene>(
  presenter: RaceConfigurationPresenter<TrackType, Scene>,
  kartItemId: number,
  dependencies: Pick<RaceConfigurationDependencies<TrackType, Scene>,
    "setToonLinesEnabled" | "isManualBoostTachometer">,
): void {
  const { host } = presenter;
  dependencies.setToonLinesEnabled(host.gameOptions.toonLine);
  host.getPhysics().setDualBoostAuto(host.gameOptions.dualBoostAuto, kartItemId);
  const tachometer = host.session.tachometer;
  if (dependencies.isManualBoostTachometer(tachometer)) {
    let alarmEnabled = !host.gameOptions.dualBoostAuto;
    if (kartItemId === 1096 || kartItemId === 1106) alarmEnabled = false;
    if (kartItemId === 1097) alarmEnabled = true;
    tachometer.setManualBoostAlarm(alarmEnabled);
  }
}
