/** Live race presenter commands shared by frame, room, and audio events. */

export interface RacePresenterActionsHost {
  playerId: unknown;
  resultVisible: boolean;
  award?: { input(input: unknown, nowMs: number): void };
  warpCameraFrozen: boolean;
  warpHudHidden: boolean;
  camera: unknown;
  cameraShake: { enter(): void; leave(force: boolean): void };
  cameraWave: { enter(): void; leave(): void };
  lightFactor: { trigger(): void };
  drive: { reset(value?: number): void };
  assets: {
    map: { warpNextCamera?: (camera: unknown) => void };
    drivingMode?: { kind: string };
    participants: Array<{ playerId: unknown;
      vehicle: { audio: { start(): void; playReset(): void } } }>;
  };
  runtime: {
    local: {
      consumeWarpActions(): Array<{ kind: string }>;
      raceProgress(): unknown;
    };
    remotes: { raceProgress(playerId: unknown): unknown };
  };
  audioStarted: boolean;
  bgm?: { restart(): void; currentRaceName?: string };
  trackInfoCard?: {
    setBgmName(name: string): void;
    setVisible(visible: boolean): void;
    slideOut(): void;
  };
  countdown?: { playGo(): void };
  tachometer: unknown;
  hud: { startBoostGaugeFull(): void };
  rankRoster: {
    capture(progress: (playerId: unknown) => unknown): void;
    updatePresent(present: Set<unknown>): void;
  };
  shadowPresentations: Map<unknown, { dispose(): void }>;
  captureRankProgress(): void;
}

export interface RacePresenterActionsDependencies {
  routeTagFamily(tag: string): string;
  resetTachometer(tachometer: unknown): void;
}

export function forwardPresenterAwardInput(host: RacePresenterActionsHost,
  input: unknown, nowMs: number): void {
  if (host.resultVisible) host.award?.input(input, nowMs);
}

export function applyPresenterWarpCamera(host: RacePresenterActionsHost): void {
  if (!host.warpCameraFrozen) return;
  const warpCamera = host.assets.map.warpNextCamera;
  if (!warpCamera) {
    throw new Error("warpnextcamera_cam 缺失；多人不能沿用旧镜头。");
  }
  warpCamera(host.camera);
}

export function applyPresenterWarpActions(host: RacePresenterActionsHost): void {
  for (const action of host.runtime.local.consumeWarpActions()) {
    if (action.kind === "start-warp-presentation") host.warpHudHidden = true;
    if (action.kind === "reset-drive-camera") {
      host.drive.reset(0);
      host.warpCameraFrozen = false;
    }
    if (action.kind === "freeze-camera") host.warpCameraFrozen = true;
    if (action.kind === "teleport") host.warpCameraFrozen = false;
    if (action.kind === "finish-warp-letterbox") host.warpHudHidden = false;
  }
}

export function handlePresenterRouteTag(host: RacePresenterActionsHost,
  tag: string, dependencies: RacePresenterActionsDependencies): void {
  const family = dependencies.routeTagFamily(tag);
  if (family === "flash") host.lightFactor.trigger();
  if (family.startsWith("shake")) {
    if (tag.includes(":in:")) host.cameraShake.enter();
    else if (tag.includes(":out:")) host.cameraShake.leave(true);
  }
  if (family.startsWith("wave")) {
    if (tag.includes(":in:")) host.cameraWave.enter();
    else if (tag.includes(":out:")) host.cameraWave.leave();
  }
}

export function startPresenterAudio(host: RacePresenterActionsHost): void {
  if (host.audioStarted) return;
  host.audioStarted = true;
  host.bgm?.restart();
  host.trackInfoCard?.setBgmName(host.bgm?.currentRaceName ?? "");
  host.trackInfoCard?.setVisible(true);
  host.assets.participants.find(participant =>
    participant.playerId === host.playerId)!.vehicle.audio.start();
}

export function playPresenterGo(host: RacePresenterActionsHost): void {
  host.countdown?.playGo();
  host.trackInfoCard?.slideOut();
}

export function playPresenterReset(host: RacePresenterActionsHost): void {
  host.assets.participants.find(participant =>
    participant.playerId === host.playerId)!.vehicle.audio.playReset();
}

export function startPresenterBoostGaugeFull(host: RacePresenterActionsHost,
  dependencies: RacePresenterActionsDependencies): void {
  dependencies.resetTachometer(host.tachometer);
  host.hud.startBoostGaugeFull();
}

export function capturePresenterRankProgress(host: RacePresenterActionsHost): void {
  host.rankRoster.capture(playerId => playerId === host.playerId
    ? host.runtime.local.raceProgress()
    : host.runtime.remotes.raceProgress(playerId));
}

export function updatePresenterRoom(host: RacePresenterActionsHost,
  room: { members: Array<{ playerId: unknown }> }): void {
  if (host.resultVisible) return;
  const present = new Set(room.members.map(member => member.playerId));
  host.captureRankProgress();
  host.rankRoster.updatePresent(present);
}

export function releasePresenterShadowPresentations(
  host: RacePresenterActionsHost): void {
  if (host.assets.drivingMode?.kind !== "shadow") return;
  for (const presentation of host.shadowPresentations.values()) {
    presentation.dispose();
  }
  host.shadowPresentations.clear();
}
