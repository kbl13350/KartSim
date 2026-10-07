/** Owns the visible stage, frame scheduling and race presentation facade. */
export interface PresentationControllerServices {
  createFrameRateCounter(): unknown;
  createStageManager(): {
    register(name: string, factory: () => unknown): void;
    changeStage(name: string, value?: unknown): unknown;
    currentName?: string;
  };
  createReadyStage(host: unknown): unknown;
  createRaceStage(host: unknown): unknown;
  startLoop(owner: PresentationController): unknown;
  stopLoop(owner: PresentationController): unknown;
  advanceFrame(owner: PresentationController, scheduledAtMs: number): unknown;
  renderFrame(owner: PresentationController, startedAtMs: number): unknown;
  releaseRace(owner: PresentationController): unknown;
  replaceTrack(owner: PresentationController, track: unknown): unknown;
  applyRaceOptions(owner: PresentationController, kartItemId: unknown): unknown;
}

export class PresentationController {
  private readonly services: PresentationControllerServices;
  host: any;
  clientFramerate: unknown;
  animationFrame = 0;
  lastUpdateMs = 0;
  maxRafDelayMs = 0;
  previousRenderTime: number;
  presentationClockMs = 0;
  fps = 60;
  frameTimeSeconds = 0;
  stages: ReturnType<PresentationControllerServices["createStageManager"]>;
  currentRaceStage: any;
  multiplayerStage: any;
  nextFrameCallbacks: Array<{ run(): void; reject(error: unknown): void }> = [];

  constructor(host: any, previousRenderTime: number | undefined,
    services: PresentationControllerServices) {
    this.services = services;
    this.clientFramerate = services.createFrameRateCounter();
    this.stages = services.createStageManager();
    this.host = host;
    this.previousRenderTime = previousRenderTime ?? 0;
    this.frame = this.frame.bind(this);
    this.stages.register("TimeAttackReadyStage", () => {
      this.currentRaceStage = undefined;
      return services.createReadyStage(this.host);
    });
    this.stages.register("MultiplayerDrivingStage", () => {
      this.currentRaceStage = undefined;
      if (!this.multiplayerStage) throw new Error("多人比赛尚未准备。");
      return this.multiplayerStage;
    });
    this.stages.register("TimeAttackStage", () => {
      const stage = services.createRaceStage(this.host);
      this.currentRaceStage = stage;
      return stage;
    });
  }

  get multiplayerDiagnosticsView(): unknown {
    return this.multiplayerStage?.diagnosticsView;
  }

  publishMultiplayer(stage: unknown): void {
    if (this.multiplayerStage) throw new Error("已有多人比赛。");
    this.host.shell.enterMultiplayerRace();
    this.multiplayerStage = stage;
    this.stages.changeStage("MultiplayerDrivingStage");
  }

  releaseMultiplayer(stage: unknown): void {
    if (this.multiplayerStage !== stage) return;
    this.multiplayerStage = undefined;
    if (this.host.shell.current === "MultiplayerRacing")
      this.host.shell.leaveMultiplayerRace();
    this.stages.changeStage("TimeAttackReadyStage");
  }

  start(): unknown { return this.services.startLoop(this); }
  dispose(): unknown { return this.services.stopLoop(this); }

  afterNextFrame<T>(callback: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      this.nextFrameCallbacks.push({
        run: () => {
          try { resolve(callback()); }
          catch (error) { reject(error); }
        },
        reject,
      });
    });
  }

  changeStage(name: string, value?: unknown): unknown {
    return this.stages.changeStage(name, value);
  }
  get stageName(): string | undefined { return this.stages.currentName; }
  handleRouteSurfaceTag(tag: unknown, time: unknown): void {
    this.currentRaceStage?.handleRouteSurfaceTag(tag, time);
  }
  applyWarpNextActions(actions: unknown): void {
    this.currentRaceStage?.applyWarpNextActions(actions);
  }
  warpToCheckpoint(value: unknown): void {
    this.currentRaceStage?.warpToCheckpoint(value);
  }
  warpToPoint(value: unknown): void { this.currentRaceStage?.warpToPoint(value); }
  frame(scheduledAtMs: number): unknown {
    return this.services.advanceFrame(this, scheduledAtMs);
  }
  updateAndRender(startedAtMs: number): unknown {
    return this.services.renderFrame(this, startedAtMs);
  }
  renderGameplayUi(context: unknown, frame: unknown): void {
    this.currentRaceStage?.renderGameplayUi(context, frame);
  }
  disposeRaceInterface(): void { this.currentRaceStage?.disposeInterface(); }
  get raceInterface(): unknown { return this.currentRaceStage?.interface; }
  initiateSpeedReset(value: unknown): void {
    this.currentRaceStage?.initiateSpeedReset(value);
  }
  advanceResetCompletion(value: unknown): void {
    this.currentRaceStage?.advanceResetCompletion(value);
  }
  updateDriving(value: unknown): void { this.currentRaceStage?.updateDriving(value); }
  updateTimeAttackRoute(route: unknown, time: unknown, mode: unknown): void {
    this.currentRaceStage?.updateTimeAttackRoute(route, time, mode);
  }
  handleTimeAttackActions(actions: unknown, time: unknown): void {
    this.currentRaceStage?.handleTimeAttackActions(actions, time);
  }
  handleTimeAttackActionAudio(action: unknown, time: unknown): boolean {
    return this.currentRaceStage?.handleTimeAttackActionAudio(action, time) ?? false;
  }
  handleTimeAttackFinishAction(action: unknown, time: unknown): boolean {
    return this.currentRaceStage?.handleTimeAttackFinishAction(action, time) ?? false;
  }
  showTimeAttackResult(result: unknown, time: unknown): void {
    this.currentRaceStage?.showTimeAttackResult(result, time);
  }
  releaseRaceForReady(): unknown { return this.services.releaseRace(this); }
  replaceTrack(track: unknown): unknown { return this.services.replaceTrack(this, track); }
  applyRaceOptions(kartItemId: unknown): unknown {
    return this.services.applyRaceOptions(this, kartItemId);
  }
}
