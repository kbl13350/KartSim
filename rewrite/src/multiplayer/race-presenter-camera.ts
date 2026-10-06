/** Chooses and updates the multiplayer race camera for one frame. */

interface Vec3 { x: number; y: number; z: number }

interface Body {
  position: Vec3;
  [key: string]: unknown;
}

interface GiantState { main: number; [key: string]: unknown }

export interface RacePresenterCameraHost {
  warpCameraFrozen: boolean;
  cameraMode: string;
  camera: unknown;
  playerId: unknown;
  assets: {
    map: { readyCamera: { apply(camera: unknown, nowMs: number,
      body: Body): void } };
    participants: Array<{ playerId: unknown }>;
  };
  runtime: {
    giantEffectsEnded: boolean;
    local: {
      physics: {
        body: Body;
        giant?: GiantState;
        driveCameraRuntime(): { eventScaleSecondary: { z: number } } &
          Record<string, unknown>;
      };
      track: {
        currentRouteSurface(physics: unknown): unknown;
        cameraFar?: number;
      };
      lifecycle: { state: unknown };
      warpNext: { fairyFovFactor(): number | undefined };
    };
    remotes: {
      giant(playerId: unknown): GiantState | undefined;
      copyWebPose(playerId: unknown): { position: Vec3 } | undefined;
    };
  };
  cameraShake: {
    setGiantGate(value: number | false): void;
    update(nowMs: number, routeSurface: unknown): Vec3;
  };
  giantPresentation?: { setThreatSound(nearby: boolean): void };
  cameraWave: {
    update(nowMs: number, routeSurface: unknown,
      body: Body, shakenPosition: Vec3): void;
  };
  drive: {
    update(input: Record<string, unknown>): {
      horizontalFovDegrees: number;
      far: number;
      [key: string]: unknown;
    };
    apply(camera: unknown, view: Record<string, unknown>): void;
  };
  surround: {
    update(nowMs: number, body: Body, scale: number): unknown;
    apply(camera: unknown, view: unknown): void;
  };
  applyWarpCamera(): void;
}

export function updateRacePresenterCamera(host: RacePresenterCameraHost,
  nowMs: number, racingState: unknown): void {
  if (host.warpCameraFrozen) {
    host.applyWarpCamera();
    return;
  }
  const { physics, track } = host.runtime.local;
  if (host.cameraMode === "ready") {
    host.assets.map.readyCamera.apply(host.camera, nowMs, physics.body);
    return;
  }
  if (host.cameraMode === "surround") {
    host.surround.apply(host.camera, host.surround.update(nowMs,
      physics.body, physics.driveCameraRuntime().eventScaleSecondary.z));
    return;
  }

  const routeSurface = track.currentRouteSurface(physics);
  const body = physics.body;
  if (physics.giant && !host.runtime.giantEffectsEnded) {
    let nearby = false;
    if (physics.giant.main !== 4 &&
      host.runtime.local.lifecycle.state === racingState) {
      for (const participant of host.assets.participants) {
        const giant = host.runtime.remotes.giant(participant.playerId);
        const pose = host.runtime.remotes.copyWebPose(participant.playerId);
        if (!giant || giant.main !== 4 || !pose) continue;
        const dx = Math.fround(pose.position.x - body.position.x);
        const dy = Math.fround(pose.position.y - body.position.y);
        const dz = Math.fround(pose.position.z - body.position.z);
        const squaredDistance = Math.fround(
          Math.fround(Math.fround(dx * dx) + Math.fround(dz * dz)) +
          Math.fround(dy * dy));
        if (squaredDistance < 900) {
          nearby = true;
          break;
        }
      }
    }
    host.cameraShake.setGiantGate(nearby
      ? Math.fround(1000 - physics.giant.main * 100) : false);
    host.giantPresentation?.setThreatSound(nearby);
  }
  const shake = host.cameraShake.update(nowMs, routeSurface);
  const position = {
    x: Math.fround(body.position.x + shake.x),
    y: Math.fround(body.position.y + shake.y),
    z: Math.fround(body.position.z + shake.z),
  };
  host.cameraWave.update(nowMs, routeSurface, body, position);
  const view = host.drive.update({
    timestampMs: nowMs,
    body: { ...body, position },
    routeSurface,
    ...physics.driveCameraRuntime(),
  });
  const factor = host.runtime.local.warpNext.fairyFovFactor();
  host.drive.apply(host.camera, {
    ...view,
    horizontalFovDegrees: factor === undefined
      ? view.horizontalFovDegrees
      : Math.max(Math.fround(view.horizontalFovDegrees * factor), 65),
    far: track.cameraFar ?? view.far,
  });
}
