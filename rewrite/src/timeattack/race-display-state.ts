export interface RaceStateDependencies {
  createLifecycle(): unknown;
  createSpeedResetState(): unknown;
}

/** Owned runtime objects for one solo race; new races get a fresh state bag. */
export class TimeAttackRaceState {
  flyingPet: unknown = undefined;
  vehicleRender: unknown = undefined;
  characterRender: unknown = undefined;
  pendingCharacterFinishMotion = 0;
  linkedCharacterRender: unknown = undefined;
  linkedCharacterPresentation: unknown = undefined;
  balloonDecoration: unknown = undefined;
  characterDecorations: unknown[] = [];
  raceAura: unknown = undefined;
  ghosts: unknown[] = [];
  rankColors: unknown[] = [];
  localName = "";
  outlineBatch: unknown = undefined;
  warpBlackBar: unknown = undefined;
  warpHud: unknown = undefined;
  kartEffects: unknown = undefined;
  kartTrails: unknown = undefined;
  kartDriftEffects: unknown = undefined;
  kartMotionBlur: unknown = undefined;
  zetAirEffect: unknown = undefined;
  shockWaveEffect: unknown = undefined;
  exhaustEffect: unknown = undefined;
  crashEffect: unknown = undefined;
  chargerEffect: unknown = undefined;
  particleModification: unknown = undefined;
  particleModificationBanner: unknown = undefined;
  particleModificationBannerRequest: unknown = undefined;
  lampFlares: unknown = undefined;
  simpleShadow: unknown = undefined;
  track: unknown = undefined;
  coordinator: unknown = undefined;
  trackEventEffects: unknown = undefined;
  trackEventAudio: unknown = undefined;
  trackDummyAudio: unknown = undefined;
  rain: unknown = undefined;
  rainAudio: unknown = undefined;
  snow: unknown = undefined;
  admission: unknown = undefined;
  physics: unknown = undefined;
  lifecycle: unknown;
  selection: unknown = undefined;
  vehicleTitle = "";
  speedResetState: unknown;
  toonEnvironment: unknown = undefined;
  trackMetadata: unknown = undefined;
  tachometer: unknown = undefined;
  pause: unknown = undefined;
  readyCamera: unknown = undefined;
  warpNextCamera: unknown = undefined;
  driveCameraState: unknown = undefined;
  surroundCameraState: unknown = undefined;
  cameraMode = "ready";
  warpCameraFrozen = false;

  constructor(dependencies: RaceStateDependencies) {
    this.lifecycle = dependencies.createLifecycle();
    this.speedResetState = dependencies.createSpeedResetState();
  }
}

export interface ResultDisplayRenderer {
  update(items: unknown[], timeMs: number): void;
  render(context: CanvasRenderingContext2D, width: number, height: number): void;
  dispose(): void;
}

export interface ResultOverlayDependencies {
  createRenderer(): ResultDisplayRenderer;
  buildItems(definition: unknown, values: Record<string, unknown>,
    width: number, height: number): unknown[];
}

/** Rebuilds the result card only when its viewport dimensions change. */
export class TimeAttackResultOverlay {
  readonly renderer: ResultDisplayRenderer;
  values?: Record<string, unknown>;
  width = -1;
  height = -1;

  constructor(readonly definition: unknown,
    readonly dependencies: ResultOverlayDependencies) {
    this.renderer = dependencies.createRenderer();
  }

  show(values: Record<string, unknown>): void {
    this.values = { ...values };
    this.width = -1;
    this.height = -1;
  }

  hide(): void {
    this.values = undefined;
    this.width = -1;
    this.height = -1;
    this.renderer.update([], 0);
  }

  render(context: CanvasRenderingContext2D,
    width: number, height: number): void {
    if (!this.values) return;
    if (width !== this.width || height !== this.height)
      this.update(this.values, width, height);
    this.renderer.render(context, width, height);
  }

  dispose(): void {
    this.hide();
    this.renderer.dispose();
  }

  update(values: Record<string, unknown>, width: number,
    height: number): void {
    this.renderer.update(
      this.dependencies.buildItems(this.definition, values, width, height), 0);
    this.width = width;
    this.height = height;
  }
}
