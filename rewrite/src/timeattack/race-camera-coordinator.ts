export interface RaceCameraDependencies {
  versionTag(tag: string): string;
  processState: unknown;
  createDrive(processState: unknown): any;
  createSurround(): any;
}

/** Chooses and updates the ready, driving, and surround cameras for a race. */
export class RaceCameraCoordinator {
  driveCameraman: any;
  surroundCameraman: any;
  readonly p3553ProcessState: unknown;

  constructor(
    readonly cameraShake: any,
    readonly cameraWave: any,
    readonly warpNext: any,
    options: { p3553ProcessState?: unknown; drive?: any; surround?: any } = {},
    readonly dependencies: RaceCameraDependencies,
  ) {
    this.p3553ProcessState = options.p3553ProcessState ??
      (dependencies.versionTag("p3553") === "p3553"
        ? dependencies.processState : undefined);
    this.driveCameraman = options.drive ??
      dependencies.createDrive(this.p3553ProcessState);
    this.surroundCameraman = options.surround ??
      dependencies.createSurround();
  }

  get drive(): any { return this.driveCameraman; }
  get surround(): any { return this.surroundCameraman; }

  configureP3528ResolutionMode(): void {
    this.driveCameraman.configureP3528ResolutionMode();
    this.surroundCameraman.configureP3528ResolutionMode();
  }

  beginNewStage(): void {
    this.driveCameraman = this.dependencies.createDrive(this.p3553ProcessState);
    this.driveCameraman.configureP3528ResolutionMode();
  }

  reset(): void {
    this.driveCameraman.reset();
    this.surroundCameraman.reset();
  }

  update(timestampMs: number, camera: any, session: any,
    vehicle: any, track: any): void {
    if (session.cameraMode === "ready")
      session.readyCamera?.apply(camera, timestampMs, vehicle.body);
    else if (session.cameraMode === "drive")
      this.updateDrive(timestampMs, camera, session, vehicle, track);
    else if (session.cameraMode === "surround")
      this.updateSurround(timestampMs, camera, session, vehicle);
  }

  updateDrive(timestampMs: number, camera: any, session: any,
    vehicle: any, track: any): void {
    const routeSurface = track.currentRouteSurface(vehicle);
    const body = vehicle.body;
    const shake = this.cameraShake.update(timestampMs, routeSurface);
    const shakenPosition = {
      x: Math.fround(body.position.x + shake.x),
      y: Math.fround(body.position.y + shake.y),
      z: Math.fround(body.position.z + shake.z),
    };
    this.cameraWave.update(timestampMs, routeSurface, body, shakenPosition);
    const driveState = this.driveCameraman.update({
      timestampMs,
      body: { ...body, position: shakenPosition },
      routeSurface,
      ...vehicle.driveCameraRuntime(),
    });
    const fairyFov = this.warpNext.fairyFovFactor();
    const horizontalFovDegrees = fairyFov === undefined
      ? driveState.horizontalFovDegrees
      : Math.max(Math.fround(Math.fround(
        driveState.horizontalFovDegrees) * fairyFov), 65);
    session.driveCameraState = {
      ...driveState,
      horizontalFovDegrees,
      far: track.cameraFar ?? driveState.far,
    };
    this.driveCameraman.apply(camera, session.driveCameraState);
  }

  updateSurround(timestampMs: number, camera: any, session: any,
    vehicle: any): void {
    const secondaryScale = vehicle.driveCameraRuntime().eventScaleSecondary.z;
    session.surroundCameraState = this.surroundCameraman.update(
      timestampMs, vehicle.body, secondaryScale);
    this.surroundCameraman.apply(camera, session.surroundCameraState);
  }
}
