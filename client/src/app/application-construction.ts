export interface ApplicationConstructionOps {
  outputColorSpace: any;
  makeKartView(scene: any): any;
  makeHud(root: HTMLElement, actions: {
    returnToReady(): void;
    collectEngineDiagnostics(): any;
  }): any;
  collectEngineDiagnostics(snapshot: any): any;
  makeAssets(hud: any): any;
  makeInput(): any;
  makeCanvasDiagnostics(root: HTMLElement, canvas: HTMLCanvasElement,
    shellName: () => any, report: (message: string, error: boolean) => void): any;
  makeTouchControls(root: HTMLElement,
    touch: (action: any, pressed: any) => void,
    pause: () => void,
    autoForward: (enabled: boolean) => void,
    nitroSeamless: (enabled: boolean) => void): any;
  makeBlackBar(root: HTMLElement): any;
  makeResizeObserver(callback: () => void): ResizeObserver;
}

function engineDiagnostics(owner: any, ops: ApplicationConstructionOps): any {
  const multiplayer = owner.presenter.multiplayerDiagnosticsView;
  return ops.collectEngineDiagnostics({
    network: owner.readyCoordinator?.networkDiagnostics(),
    renderer: owner.renderer,
    scene: multiplayer?.scene ?? owner.scene,
    camera: multiplayer?.camera ?? owner.camera,
    drawingBufferSize: owner.drawingBufferSize,
    renderStats: owner.engineRenderStats,
    raceStartProgramCount: owner.raceStartProgramCount,
    maxRafDelayMs: owner.maxRafDelayMs,
    active: {
      multiplayer: !!multiplayer,
      physics: !!owner.session.physics || !!multiplayer,
      track: !!owner.session.track || !!multiplayer,
      vehicle: !!owner.session.vehicleRender || !!multiplayer,
      character: !!owner.session.characterRender,
      linkedCharacter: !!owner.session.linkedCharacterRender,
      exhaust: !!owner.session.exhaustEffect,
      trails: !!owner.session.kartTrails,
      drift: !!owner.session.kartDriftEffects,
      zetAir: !!owner.session.zetAirEffect,
      shockWave: !!owner.session.shockWaveEffect,
      crash: !!owner.session.crashEffect,
      charger: !!owner.session.chargerEffect,
      trackEvents: !!owner.session.trackEventEffects,
      motionBlur: !!owner.session.kartMotionBlur,
      lampFlares: !!owner.session.lampFlares,
      tachometer: !!owner.session.tachometer,
      gameplayUi: !!owner.presenter.raceInterface?.gameplayUi,
      rain: !!owner.session.rain,
      snow: !!owner.session.snow,
      simpleShadow: !!owner.session.simpleShadow,
    },
    options: {
      boostBlur: owner.gameOptions.boostBlur,
      toonLine: owner.gameOptions.toonLine,
      shadow: owner.gameOptions.shadow,
      dualBoostAuto: owner.gameOptions.dualBoostAuto,
      verticalSync: owner.gameOptions.verticalSync === true,
    },
  });
}

/** Wires the application-owned canvas, controls, HUD and startup observers. */
export function initializeApplication(owner: any, root: HTMLElement,
  ops: ApplicationConstructionOps): void {
  owner.root = root;
  (window as any).__kartRenderQaApp = owner;
  const canvas = owner.renderer.domElement as HTMLCanvasElement;
  canvas.className = "game-canvas";
  canvas.dataset.uiLayer = "world";
  canvas.tabIndex = 0;
  owner.renderer.outputColorSpace = ops.outputColorSpace;
  owner.renderer.info.autoReset = false;
  root.append(canvas);
  owner.kartView = ops.makeKartView(owner.scene);
  owner.scene.matrixWorldAutoUpdate = false;
  owner.scene.matrixAutoUpdate = false;
  owner.scene.matrixWorldNeedsUpdate = false;
  owner.hud = ops.makeHud(root, {
    returnToReady: () => { owner.returnToReady(); },
    collectEngineDiagnostics: () => engineDiagnostics(owner, ops),
  });
  owner.assets = ops.makeAssets(owner.hud);
  owner.input = ops.makeInput();
  owner.input.setKeyMap(owner.gameOptions.keyMap);
  owner.canvasDiagnostics = ops.makeCanvasDiagnostics(root, canvas,
    () => owner.shell.current,
    (message, error) => {
      owner.hud.showDebugText(message, error ? "error" : "info");
      if (error) console.error(message);
      else console.info(message);
    });
  owner.input.setEnabled(false);
  owner.touchControls = ops.makeTouchControls(root,
    (action, pressed) => owner.input.setTouchAction(action, pressed),
    () => owner.togglePause(),
    enabled => owner.setAutoForwardEnabled(enabled),
    enabled => owner.setNitroSeamlessMode(enabled));
  owner.touchControls.setKeyMap(owner.gameOptions.keyMap);
  owner.setNitroSeamlessMode(owner.touchControls.getNitroSeamlessMode());
  owner.activeBlackBar = ops.makeBlackBar(root);
  owner.session.warpBlackBar = owner.activeBlackBar;
  owner.session.warpHud = owner.warpHudGate;
  owner.cameras.configureP3528ResolutionMode();
  owner.configureBackbuffer();
  owner.viewportResizeObserver = ops.makeResizeObserver(owner.onViewportResize);
  owner.viewportResizeObserver.observe(root);
  window.addEventListener("resize", owner.onViewportResize);
  window.addEventListener("keydown", owner.onGlobalKeyDown);
  owner.presenter.changeStage("TimeAttackReadyStage");
  owner.presenter.start();
  owner.mountDevTools();
  owner.restoreTimeAttackRecords();
  owner.loadVersionedResources();
}
