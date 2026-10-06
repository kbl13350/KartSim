class Bf0 {
  constructor(e) {
    ((this.root = e),
      (this.renderer.domElement.className = "game-canvas"),
      (this.renderer.domElement.dataset.uiLayer = "world"),
      (this.renderer.domElement.tabIndex = 0),
      (this.renderer.outputColorSpace = qe),
      (this.renderer.info.autoReset = !1),
      this.root.append(this.renderer.domElement),
      (this.kartView = new Vg(this.scene)),
      (this.scene.matrixWorldAutoUpdate = !1),
      (this.scene.matrixAutoUpdate = !1),
      (this.scene.matrixWorldNeedsUpdate = !1),
      (this.hud = new $o0(this.root, {
        returnToReady: () => {
          this.returnToReady();
        },
        collectEngineDiagnostics: () =>
          jo0({
            network: this.readyCoordinator?.networkDiagnostics(),
            renderer: this.renderer,
            scene:
              this.presenter.multiplayerDiagnosticsView?.scene ?? this.scene,
            camera:
              this.presenter.multiplayerDiagnosticsView?.camera ?? this.camera,
            drawingBufferSize: this.drawingBufferSize,
            renderStats: this.engineRenderStats,
            raceStartProgramCount: this.raceStartProgramCount,
            maxRafDelayMs: this.maxRafDelayMs,
            active: {
              multiplayer: !!this.presenter.multiplayerDiagnosticsView,
              physics:
                !!this.session.physics ||
                !!this.presenter.multiplayerDiagnosticsView,
              track:
                !!this.session.track ||
                !!this.presenter.multiplayerDiagnosticsView,
              vehicle:
                !!this.session.vehicleRender ||
                !!this.presenter.multiplayerDiagnosticsView,
              character: !!this.session.characterRender,
              linkedCharacter: !!this.session.linkedCharacterRender,
              exhaust: !!this.session.exhaustEffect,
              trails: !!this.session.kartTrails,
              drift: !!this.session.kartDriftEffects,
              zetAir: !!this.session.zetAirEffect,
              shockWave: !!this.session.shockWaveEffect,
              crash: !!this.session.crashEffect,
              charger: !!this.session.chargerEffect,
              trackEvents: !!this.session.trackEventEffects,
              motionBlur: !!this.session.kartMotionBlur,
              lampFlares: !!this.session.lampFlares,
              tachometer: !!this.session.tachometer,
              gameplayUi: !!this.presenter.raceInterface?.gameplayUi,
              rain: !!this.session.rain,
              snow: !!this.session.snow,
              simpleShadow: !!this.session.simpleShadow,
            },
            options: {
              boostBlur: this.gameOptions.boostBlur,
              toonLine: this.gameOptions.toonLine,
              shadow: this.gameOptions.shadow,
              dualBoostAuto: this.gameOptions.dualBoostAuto,
            },
          }),
      })),
      (this.assets = new Jo0(this.hud)),
      (this.input = new jl0()),
      this.input.setKeyMap(this.gameOptions.keyMap),
      (this.canvasDiagnostics = new qs0(
        this.root,
        this.renderer.domElement,
        () => this.shell.current,
        (t, i) => {
          (this.hud.showDebugText(t, i ? "error" : "info"),
            i ? console.error(t) : console.info(t));
        },
      )),
      this.input.setEnabled(!1),
      (this.touchControls = new l60(
        this.root,
        (t, i) => this.input.setTouchAction(t, i),
        () => this.togglePause(),
        (t) => this.setAutoForwardEnabled(t),
        (t) => this.setNitroSeamlessMode(t),
      )),
      this.touchControls.setKeyMap(this.gameOptions.keyMap),
      this.setNitroSeamlessMode(this.touchControls.getNitroSeamlessMode()),
      (this.activeBlackBar = new yr0({ root: this.root })),
      (this.session.warpBlackBar = this.activeBlackBar),
      (this.session.warpHud = this.warpHudGate),
      this.cameras.configureP3528ResolutionMode(),
      this.configureBackbuffer(),
      (this.viewportResizeObserver = new ResizeObserver(this.onViewportResize)),
      this.viewportResizeObserver.observe(this.root),
      window.addEventListener("resize", this.onViewportResize),
      window.addEventListener("keydown", this.onGlobalKeyDown),
      this.presenter.changeStage("TimeAttackReadyStage"),
      this.presenter.start(),
      this.mountDevTools(),
      this.restoreTimeAttackRecords(),
      this.loadVersionedResources());
  }
  root;
  scene = new D1();
  camera = new Z9(62, 1, 0.1, 700);
  renderer = new I4({ powerPreference: "high-performance" });
  importer = new Tr();
  hud;
  canvasDiagnostics;
  input;
  touchControls;
  shell = new Qo0();
  assets;
  drivingInput = new sG();
  autoForward = new Xl0();
  nitroSeamless = new Zl0();
  gamepad = new Ql0();
  kartView;
  warpNext = new Qk();
  warpHudGate = Ar0();
  activeBlackBar;
  targetRandom = new rP();
  lightFactor = new sP(this.targetRandom);
  cameraEffectAnchor = { value: 0 };
  cameraShake = new nP(this.targetRandom, this.cameraEffectAnchor);
  cameraWave = new iP(this.cameraEffectAnchor);
  cameras = new Mf0(this.cameraShake, this.cameraWave, this.warpNext);
  toonStageBinding = new ha();
  readyCoordinator;
  raceSession;
  get session() {
    return this.raceSession ?? (this.raceSession = new Bd0());
  }
  ghostRecorder;
  currentPlayerSlot = 0;
  tachometerGaugePreserve = new tP();
  gameOptions = la0();
  audioDirector;
  get audio() {
    return this.audioDirector ?? (this.audioDirector = new bf0());
  }
  userProfile = gr();
  replayLibraryInstance;
  get replayLibrary() {
    return (
      this.replayLibraryInstance ?? (this.replayLibraryInstance = new Pt())
    );
  }
  recordsInstance;
  newRiderDialog;
  timeAttackReadyOptions = {
    speed: ga0,
    booster: 0,
    showGhost: !0,
    version: ze,
    settingSpeed: E4,
  };
  ghostSamplingMode = Kh0();
  localNickname = im();
  presenterInitialPreviousRenderTime = performance.now() / 1e3;
  viewportResizeObserver;
  onViewportResize = () => this.configureBackbuffer();
  paused = !1;
  racePageTransition = !1;
  drawingBufferSize = new B2();
  engineRenderStats = { calls: 0, triangles: 0, lines: 0, points: 0, frame: 0 };
  raceStartProgramCount = 0;
  workProfiler = void 0;
  racePresenter;
  raceBuilderInstance;
  devToolsHandle;
  devToolsOverlayHandle;
  devToolsObjectsOverlayHandle;
  devToolsCollectorInstance;
  devToolsTrackObjectSelection;
  drivingPipelineInstance;
  get previousRenderTime() {
    return this.presenter.previousRenderTime;
  }
  set previousRenderTime(e) {
    this.presenter.previousRenderTime = e;
  }
  get lastUpdateMs() {
    return this.presenter.lastUpdateMs;
  }
  set lastUpdateMs(e) {
    this.presenter.lastUpdateMs = e;
  }
  get presentationClockMs() {
    return this.presenter.presentationClockMs;
  }
  set presentationClockMs(e) {
    this.presenter.presentationClockMs = e;
  }
  get fps() {
    return this.presenter.fps;
  }
  set fps(e) {
    this.presenter.fps = e;
  }
  get maxRafDelayMs() {
    return this.presenter.maxRafDelayMs;
  }
  set maxRafDelayMs(e) {
    this.presenter.maxRafDelayMs = e;
  }
  get presenter() {
    return (this.racePresenter ??= new vf0(
      this.createPresenterHost(),
      this.presenterInitialPreviousRenderTime,
    ));
  }
  get raceBuilder() {
    return (this.raceBuilderInstance ??= new if0(this.createRaceBuilderHost()));
  }
  createRaceBuilderHost() {
    const e = this;
    return {
      get importer() {
        return e.importer;
      },
      get targetRandom() {
        return e.targetRandom;
      },
      get toonStageBinding() {
        return e.toonStageBinding;
      },
      get renderer() {
        return e.renderer;
      },
      get scene() {
        return e.scene;
      },
      get userProfile() {
        return e.userProfile;
      },
      get shadow() {
        return e.gameOptions.shadow;
      },
      get hud() {
        return e.hud;
      },
      get root() {
        return e.root;
      },
      get kartView() {
        return e.kartView;
      },
      get ghostStore() {
        return e.replayLibrary.store;
      },
      get timeAttackRecords() {
        return e.replayLibrary.records;
      },
      get gameOptions() {
        return e.gameOptions;
      },
      get audio() {
        return e.audio;
      },
      get webTimeAttackAiDyeId() {
        return _f0;
      },
      get ghostSamplingMode() {
        return e.ghostSamplingMode;
      },
      getLibrary: () => e.rhoLibrary,
      generationValue: () => e.assets.generationValue,
      isGenerationCurrent: (t) => e.assets.isCurrent(t),
      requireAsset: (t) => e.assets.require(t),
      preloadContainers: (t, i, r, s) => e.assets.preloadContainers(t, i, r, s),
      setVehicleTitle: (t) => {
        e.session.vehicleTitle = t;
      },
      togglePause: () => e.togglePause(),
      restartRaceFromPause: () => e.restartRaceFromPause(),
      returnToReady: () => e.returnToReady(),
      timeAttackRecordKey: (t, i) => Pt.recordKey(t, i),
    };
  }
  get drivingPipeline() {
    return (this.drivingPipelineInstance ??= new n60(
      this.createDrivingPipelineHost(),
    ));
  }
  createDrivingPipelineHost() {
    const e = this;
    return {
      get input() {
        return e.input;
      },
      get drivingInput() {
        return e.drivingInput;
      },
      get autoForward() {
        return e.autoForward;
      },
      get nitroSeamless() {
        return e.nitroSeamless;
      },
      get gamepad() {
        return e.gamepad;
      },
      getGamepadPads: () => navigator.getGamepads?.() ?? [],
      getGamepadMap: () => e.gameOptions.gamepadMap,
      resumeGamepadAutoForward: () =>
        e.touchControls.resumeAutoForwardForGamepad(),
      getPhysics: () => e.physics,
      getLifecycle: () => e.session.lifecycle,
      getTachometer: () => e.session.tachometer,
      getLampFlares: () => e.session.lampFlares,
      handleSpeedReset: (t) => e.initiateSpeedReset(t),
    };
  }
  get rhoLibrary() {
    return this.assets.current;
  }
  get ready() {
    return (
      (this.readyCoordinator ??= new ql0(this.createReadyHost())),
      this.readyCoordinator
    );
  }
  get activeWindowNotice() {
    return this.ready.getWindowNotice();
  }
  set activeWindowNotice(e) {
    this.ready.setWindowNotice(e);
  }
  createReadyHost() {
    const e = this;
    return {
      multiplayerRaceLoader: Hs0({
        clientFramerate: e.presenter.clientFramerate,
        renderer: e.renderer,
        input: e.input,
        autoForward: e.autoForward,
        touchControls: e.touchControls,
        assets: () => e.createRaceBuilderHost(),
        profile: () => e.userProfile,
        audio: () => e.audio.context,
        flyingPetVisible: () => e.gameOptions.inGameFlyingPetVisible,
        raceAnonymous: () => e.gameOptions.raceAnonymous,
        raceTimeGap: () => e.gameOptions.raceTimeGap,
        classicHud: () => e.gameOptions.classicHud,
        bgm: () => e.audio.bgm,
        playSlotChanger: () => e.audio.interfaceAudio?.playSlotChanger(),
        publish: (t) => {
          ((e.raceStartProgramCount = e.renderer.info.programs?.length ?? 0),
            e.hud.beginPerformanceRace(),
            e.presenter.publishMultiplayer(t));
        },
        release: (t) => {
          (e.hud.finishPerformanceRace(), e.presenter.releaseMultiplayer(t));
        },
        status: (t, i) => {
          i && e.hud.showDebugText(t, "error");
        },
      }),
      get root() {
        return e.root;
      },
      get shell() {
        return e.shell;
      },
      get toonStageBinding() {
        return e.toonStageBinding;
      },
      get hud() {
        return e.hud;
      },
      getLibrary: () => e.rhoLibrary,
      getProfile: () => e.userProfile,
      setProfile: (t) => {
        e.userProfile = t;
      },
      getGameOptions: () => e.gameOptions,
      setGameOptions: (t) => {
        e.gameOptions = t;
      },
      applyInputKeyMap: (t) => {
        (e.input.setKeyMap(t.keyMap), e.touchControls.setKeyMap(t.keyMap));
      },
      applyAudioOptions: (t) => {
        e.audio.context && Qc(e.audio.context, t);
      },
      getSelection: () => e.session.selection,
      setSelection: (t) => {
        e.session.selection = t;
      },
      getVehicleTitle: () => e.session.vehicleTitle,
      setVehicleTitle: (t) => {
        e.session.vehicleTitle = t;
      },
      getReadyOptions: () => e.timeAttackReadyOptions,
      setReadyOptions: (t) => {
        e.timeAttackReadyOptions = t;
      },
      getBgm: () => e.audio.bgm,
      getAudioContext: () => e.audio.context,
      getInterfaceAudio: () => e.audio.interfaceAudio,
      getRecordFor: (t) => {
        const i = e.session.selection;
        if (i?.trackId) return e.replayLibrary.record(Pt.recordKey(i, t));
      },
      saveProfile: () => {
        cT(e.userProfile);
      },
      releaseRaceForReady: () => e.releaseRaceForReady(),
      startRace: (t) => e.startRace(t),
      enterRaceStart: () => e.shell.beginRaceStart(),
      endRaceStart: () => {
        e.shell.endRaceStart();
      },
      enterTimeAttackReady: (t) => e.enterTimeAttackReady(t),
      selectReadyGarage: (t, i, r) => e.selectReadyGarage(t, i, r),
      previewSettings: (t) => e.previewSettings(t),
      confirmSettings: (t, i, r) => e.confirmSettings(t, i, r),
      closeSettings: () => e.closeSettings(),
      saveGameOptions: () => e.saveGameOptions(),
    };
  }
  createPresenterHost() {
    const e = this;
    return {
      get clientFramerate() {
        return e.presenter.clientFramerate;
      },
      get resourceVersion() {
        return e.assets?.opfs?.version;
      },
      get renderer() {
        return e.renderer;
      },
      get scene() {
        return e.scene;
      },
      get camera() {
        return e.camera;
      },
      get hud() {
        return e.hud;
      },
      get input() {
        return e.input;
      },
      get touchControls() {
        return e.touchControls;
      },
      get kartView() {
        return e.kartView;
      },
      get lightFactor() {
        return e.lightFactor;
      },
      get autoForward() {
        return e.autoForward;
      },
      get nitroSeamless() {
        return e.nitroSeamless;
      },
      get drivingInput() {
        return e.drivingInput;
      },
      get toonStageBinding() {
        return e.toonStageBinding;
      },
      get tachometerGaugePreserve() {
        return e.tachometerGaugePreserve;
      },
      get workProfiler() {
        return e.workProfiler;
      },
      get gameOptions() {
        return e.gameOptions;
      },
      get shell() {
        return e.shell;
      },
      get session() {
        return e.session;
      },
      get audio() {
        return e.audio;
      },
      get ready() {
        return e.ready;
      },
      get driveCameraman() {
        return e.cameras.drive;
      },
      get surroundCameraman() {
        return e.cameras.surround;
      },
      get warpNext() {
        return e.warpNext;
      },
      get cameraShake() {
        return e.cameraShake;
      },
      get cameraWave() {
        return e.cameraWave;
      },
      get paused() {
        return e.paused;
      },
      get frameTimeSeconds() {
        return e.presenter.frameTimeSeconds;
      },
      get presentationClockMs() {
        return e.presenter.presentationClockMs;
      },
      set presentationClockMs(t) {
        e.presenter.presentationClockMs = t;
      },
      get engineRenderStats() {
        return e.engineRenderStats;
      },
      get drawingBufferSize() {
        return e.drawingBufferSize;
      },
      get ghostRecorder() {
        return e.ghostRecorder;
      },
      set ghostRecorder(t) {
        e.ghostRecorder = t;
      },
      currentGhostEquipment: () => e.records.currentEquipment(),
      get currentPlayerSlot() {
        return e.currentPlayerSlot;
      },
      set currentPlayerSlot(t) {
        e.currentPlayerSlot = t;
      },
      get raceStartProgramCount() {
        return e.raceStartProgramCount;
      },
      set raceStartProgramCount(t) {
        e.raceStartProgramCount = t;
      },
      getPhysics: () => e.physics,
      getTrack: () => e.track,
      drainDrivingInput: (t, i) => e.drainDrivingInput(t, i),
      getDrivingSnapshot: () => e.getDrivingSnapshot(),
      updateKartBoosterState: (t, i, r) => e.updateKartBoosterState(t, i, r),
      haltRuntime: (t, i) => e.haltRuntime(t, i),
      updateHud: () => e.updateHud(),
      setPaused: (t) => {
        e.paused = t;
      },
      get previousRenderTime() {
        return e.presenter.previousRenderTime;
      },
      set previousRenderTime(t) {
        e.presenter.previousRenderTime = t;
      },
      get maxRafDelayMs() {
        return e.presenter.maxRafDelayMs;
      },
      set maxRafDelayMs(t) {
        e.presenter.maxRafDelayMs = t;
      },
      handleTimeAttackActions: (t, i) => e.handleTimeAttackActions(t, i),
      handleTimeAttackActionAudio: (t, i) =>
        e.handleTimeAttackActionAudio(t, i),
      updateTimeAttackRoute: (t, i, r) => e.updateTimeAttackRoute(t, i, r),
      updateActiveRaceCamera: (t) => e.updateActiveRaceCamera(t),
      updateDevToolsTrackObjects: (t, i, r) =>
        e.devToolsObjectsOverlayHandle?.update(t, e.camera, i, r),
      advanceResetCompletion: (t) => e.advanceResetCompletion(t),
      applyWarpNextActions: (t) => e.applyWarpNextActions(t),
      promoteTimeAttackRecord: (t, i) => e.promoteTimeAttackRecord(t, i),
      returnToReady: () => e.returnToReady(),
    };
  }
  canReloadForUpdate() {
    return (
      this.shell.current === "Ready" &&
      !this.shell.readyModalBusy &&
      !this.racePageTransition
    );
  }
  dispose() {
    (this.canvasDiagnostics.dispose(),
      this.devToolsHandle?.dispose(),
      (this.devToolsHandle = void 0),
      this.devToolsOverlayHandle?.dispose(),
      (this.devToolsOverlayHandle = void 0),
      this.devToolsObjectsOverlayHandle?.dispose(),
      (this.devToolsObjectsOverlayHandle = void 0),
      this.shell.dispose(),
      Pp(!0),
      this.assets.invalidate(),
      this.presenter.dispose(),
      this.activeBlackBar?.dispose(),
      (this.activeBlackBar = void 0),
      this.viewportResizeObserver.disconnect(),
      window.removeEventListener("keydown", this.onGlobalKeyDown),
      window.removeEventListener("resize", this.onViewportResize),
      this.touchControls.dispose(),
      this.input.dispose(),
      this.session.coordinator?.dispose(),
      this.session.flyingPet?.dispose(),
      (this.session.flyingPet = void 0),
      this.session.vehicleRender?.dispose(),
      this.session.characterRender?.dispose(),
      this.session.linkedCharacterRender?.dispose(),
      this.session.kartEffects?.dispose());
    for (const e of this.session.ghosts) e.view.dispose();
    ((this.session.ghosts = []),
      this.session.outlineBatch?.dispose(),
      (this.session.outlineBatch = void 0),
      this.session.balloonDecoration?.dispose(),
      this.session.characterDecorations.forEach(({ render: e }) => e.dispose()),
      (this.session.raceAura = void 0),
      this.session.kartTrails?.dispose(),
      this.session.kartDriftEffects?.dispose(),
      this.session.kartMotionBlur?.dispose(),
      this.session.zetAirEffect?.dispose(),
      this.session.shockWaveEffect?.dispose(),
      this.session.exhaustEffect?.dispose(),
      this.session.crashEffect?.dispose(),
      this.session.chargerEffect?.dispose(),
      this.session.particleModification?.dispose(),
      (this.session.particleModification = void 0),
      this.session.particleModificationBanner?.dispose(),
      (this.session.particleModificationBanner = void 0),
      (this.session.particleModificationBannerRequest = void 0),
      this.session.trackEventEffects?.dispose(),
      this.session.trackEventAudio?.dispose(),
      this.session.trackDummyAudio?.dispose(),
      this.session.lampFlares?.dispose(),
      this.kartView.dispose(),
      this.session.simpleShadow?.dispose(),
      this.session.tachometer?.dispose(),
      this.presenter.disposeRaceInterface(),
      this.ready.dispose(),
      this.session.pause?.dispose(),
      this.session.rain?.dispose(),
      this.session.rainAudio?.dispose(),
      this.session.snow?.dispose(),
      this.audio.interfaceAudio?.dispose(),
      this.audio.bgm?.dispose(),
      this.audio.countdownAudio?.dispose(),
      this.audio.kartAudio?.dispose(!1),
      this.audio.context &&
        this.audio.context.state !== "closed" &&
        this.audio.context.close(),
      this.releaseReadyToonEnvironment(),
      this.session.toonEnvironment &&
        this.toonStageBinding.retain(this.session.toonEnvironment),
      this.session.toonEnvironment?.dispose(),
      this.toonStageBinding.dispose(),
      this.session.track?.dispose(),
      this.hud.dispose(),
      this.renderer.dispose(),
      this.renderer.domElement.remove());
  }
  mountDevTools() {}
  devToolsTrackOwner() {
    const e = this.session.track;
    if (!e) return;
    const t = this.session.physics;
    let i;
    if (t)
      try {
        i = e.getRouteState(t);
      } catch {
        i = void 0;
      }
    return {
      data: e.data,
      routeState: i,
      trackObjects: this.devToolsTrackObjects(),
      visibleKinds: this.devToolsTrackObjectSelection ?? Gf0,
    };
  }
  devToolsTrackObjects() {
    const e = this.session.admission?.parsed.root;
    return !e || e.kind !== "track" ? [] : e.trackObjects;
  }
  setDevToolsTrackObjectKind(e, t) {}
  devToolsTrackObjectsSource() {
    const e = this.devToolsTrackOwner();
    if (!e) return;
    const t = this.devToolsCollectorInstance,
      i = this.rhoLibrary,
      r = this.session.trackMetadata,
      s = this.session.toonEnvironment;
    return {
      objects: t ? t.trackObjectSnapshots(e.trackObjects) : [],
      visibleKinds: e.visibleKinds,
      itemCube:
        i && r && s
          ? {
              library: i,
              metadata: r,
              environment: s,
              stageBinding: this.toonStageBinding,
              generation: this.assets.generationValue,
              isGenerationCurrent: (o) => this.assets.isCurrent(o),
            }
          : void 0,
    };
  }
  mountDevToolsTrackOverlay() {}
  mountDevToolsTrackObjectsOverlay() {}
  get physics() {
    if (!this.session.physics) throw new Error("尚未选择车辆资源。");
    return this.session.physics;
  }
  get track() {
    if (!this.session.track) throw new Error("尚未选择赛道资源。");
    return this.session.track;
  }
  frame(e) {
    this.presenter.frame(e);
  }
  updateAndRender(e) {
    this.presenter.updateAndRender(e);
  }
  renderGameplayUi(e, t) {
    this.presenter.renderGameplayUi(e, t);
  }
  updateKartBoosterState(e, t, i) {
    if (
      !this.session.kartEffects?.setState(
        this.physics.audioState(),
        this.physics.dualBoosterMode(),
        this.physics.dualBoosterTeam(),
        t,
        e,
      )
    )
      return i;
    const r = this.kartView.enterDualUse();
    return (r !== void 0 && this.physics.setAnimationSlot(r), r);
  }
  haltRuntime(e, t) {
    ((this.paused = !0),
      this.shell.halt(),
      this.audio.kartAudio?.setPaused(!0),
      this.input.setEnabled(!1),
      this.drivingInput.cancel(),
      this.autoForward.cancel(),
      this.session.physics?.hardCancelControls(),
      this.session.physics?.synchronizeClock(t),
      this.hud.setPaused(!0),
      this.hud.showDebugText(
        `运行时 fail-closed：${e instanceof Error ? e.message : String(e)}`,
        "error",
      ));
  }
  updateDriving(e) {
    this.presenter.updateDriving(e);
  }
  updateTimeAttackRoute(e, t, i) {
    this.presenter.updateTimeAttackRoute(e, t, i);
  }
  handleTimeAttackActions(e, t) {
    this.presenter.handleTimeAttackActions(e, t);
  }
  handleTimeAttackActionAudio(e, t) {
    return this.presenter.handleTimeAttackActionAudio(e, t);
  }
  get records() {
    return (this.recordsInstance ??= new Nh0({
      library: this.replayLibrary,
      getSelection: () => this.session.selection,
      getVehicleTitle: () => this.session.vehicleTitle,
      getTrackId: () => this.session.track?.data.trackId,
      getReadyOptions: () => this.timeAttackReadyOptions,
      getProfile: () => this.userProfile,
      getLocalNickname: () => this.localNickname,
      getPlayerSlot: () => this.currentPlayerSlot,
      getRecorder: () => this.ghostRecorder,
      reportError: (e) => this.hud.showDebugText(e, "error"),
    }));
  }
  promoteTimeAttackRecord(e, t) {
    return this.records.promote(e, t);
  }
  restoreTimeAttackRecords() {
    return this.records.restore();
  }
  mountGhostMenu() {
    return this.ghostRecordMenu().mount(this.touchControls.ghostMenuSlot);
  }
  ghostRecordMenu() {
    return new vd0({
      library: this.replayLibrary,
      getLibrary: () => this.rhoLibrary,
      getSelection: () => this.session.selection,
      currentKey: () => this.currentGhostRecordKey(),
      selectTrack: (e, t, i, r) => this.selectGhostTrack(e, t, i, r),
      speedVersion: () => this.timeAttackReadyOptions.version ?? "国服",
      refreshRecord: () => this.ready.refreshRecord(),
      reportError: (e) => this.hud.showDebugText(e, "error"),
      samplingMode: () => this.ghostSamplingMode,
      changeSamplingMode: (e) => {
        this.ghostSamplingMode = e;
      },
      resetNickname: () => {
        (bl0(),
          (this.localNickname = ""),
          this.applyNewRiderRegistration().catch((e) =>
            this.hud.showDebugText(
              e instanceof Error ? e.message : String(e),
              "error",
            ),
          ));
      },
    });
  }
  async selectGhostTrack(e, t, i, r) {
    ((this.timeAttackReadyOptions = {
      ...this.timeAttackReadyOptions,
      speed: t === 4 ? 4 : 7,
      version: r,
      settingSpeed: r === "国服" && (t === 4 || t === 7) ? 7 : t,
      booster: i,
    }),
      (this.session.selection = { ...e }),
      await this.enterTimeAttackReady());
  }
  currentGhostRecordKey() {
    const e = this.session.selection;
    if (e?.trackId) return Pt.recordKey(e, this.timeAttackReadyOptions);
  }
  enterTimeAttackReady(e) {
    return this.ready.enterTimeAttackReady(e);
  }
  openTrackSelect(e, t) {
    return this.ready.openTrackSelect(e, t);
  }
  selectReadyTrack(e, t, i) {
    this.ready.selectReadyTrack(e, t, i);
  }
  openGarage(e, t) {
    return this.ready.openGarage(e, t);
  }
  selectReadyGarage(e, t, i) {
    return this.ready.selectReadyGarage(e, t, i);
  }
  readyModalBusy() {
    return this.ready.readyModalBusy();
  }
  previewSettings(e) {
    this.ready.previewSettings(e);
  }
  confirmSettings(e, t, i) {
    this.ready.confirmSettings(e, t, i);
  }
  saveGameOptions() {
    this.ready.saveGameOptions();
  }
  closeSettings() {
    this.ready.closeSettings();
  }
  releaseRaceForReady() {
    this.presenter.releaseRaceForReady();
  }
  releaseReadyToonEnvironment() {
    this.ready.releaseReadyToonEnvironment();
  }
  drainDrivingInput(e, t) {
    this.drivingPipeline.drainDrivingInput(e, t);
  }
  setAutoForwardEnabled(e) {
    this.drivingPipeline.setAutoForwardEnabled(e);
  }
  setNitroSeamlessMode(e) {
    this.drivingPipeline.setNitroSeamlessMode(e);
  }
  getDrivingSnapshot() {
    return this.drivingPipeline.getDrivingSnapshot();
  }
  applyWarpNextActions(e) {
    this.presenter.applyWarpNextActions(e);
  }
  initiateSpeedReset(e) {
    this.presenter.initiateSpeedReset(e);
  }
  advanceResetCompletion(e) {
    this.presenter.advanceResetCompletion(e);
  }
  updateHud() {
    this.hud.update(this.physics.state, this.fps);
  }
  updateActiveRaceCamera(e) {
    this.cameras.update(e, this.camera, this.session, this.physics, this.track);
  }
  async loadVersionedResources() {
    const e = this.assets.beginGeneration();
    try {
      const t = io0()
        ? ((await ro0()) ?? (await this.hud.chooseResourceSource(so0)))
        : void 0;
      if (!this.assets.isCurrent(e)) return;
      const i = await uo0(
        Bt("p3553"),
        (l) => {
          this.hud.setLoadingProgress(
            `resource:${l.file.toLowerCase()}`,
            l.loadedBytes,
            l.totalBytes,
            `正在加载 ${l.file}`,
          );
        },
        t,
      );
      if (!this.assets.isCurrent(e)) return;
      const r = await Sw.load(i.sources, void 0, i.archiveIndexes);
      if (!this.assets.isCurrent(e)) return;
      if (r.files.length === 0)
        throw new Error(r.errors[0] ?? "没有成功读取任何资源文件。");
      const [s, o] = await Promise.all([
        r.timeAttackGarageCatalog(),
        r.mapCatalog(),
      ]);
      if (!this.assets.isCurrent(e)) return;
      this.userProfile = Ta0() ?? gr();
      const a = Rf0(s, o, this.userProfile);
      if (
        (this.assets.install(r, i),
        await this.prepareStartupReady(r, a.selection, a.vehicleTitle),
        !this.assets.isCurrent(e))
      )
        return;
      (r.errors[0]
        ? this.hud.showDebugText(r.errors[0], "error")
        : r.warnings[0] && this.hud.showDebugText(r.warnings[0]),
        this.hud.showDebugText(
          `已读取资源：${r.archives.length} 个容器，${r.files.length} 个文件`,
        ),
        this.hud.showDebugText("已加载发布版档案索引，物理容器按需缓存"),
        t &&
          this.hud.showDebugText(
            `优先读取本地 ${t.name}，不匹配的容器使用在线资源`,
          ));
      const c = this.userProfile.equipment.itemIds[3];
      (n3(c) &&
        a.selection.vehicleItemId !== c &&
        this.hud.showDebugText(
          `${Mw(c)} 本次使用${a.vehicleTitle}启动，未修改保存资料。`,
        ),
        this.hud.finishLoading(),
        im() === "" && (await this.applyNewRiderRegistration()));
    } catch (t) {
      this.assets.isCurrent(e) &&
        this.hud.showLoadingError(t instanceof Error ? t.message : String(t));
    }
  }
  async applyNewRiderRegistration() {
    const e = this.rhoLibrary;
    if (!e) return;
    const t = await e.timeAttackGarageCatalog(),
      i = this.session.selection?.vehicleItemId,
      r = t.karts.find((o) => o.itemId === i);
    if (r === void 0)
      throw new Error(`车手注册预览缺少启动车辆 ItemKart ${i}。`);
    const s = await rn.load(e);
    try {
      this.newRiderDialog ??= await Fy.load(
        e,
        this.root,
        {
          characters: t.characters.map(({ itemId: l, title: u }) => ({
            itemId: l,
            title: u,
          })),
          paints: t.equipment
            .filter((l) => l.kind === "color")
            .map(({ itemId: l, title: u }) => ({ itemId: l, title: u })),
          dyes: t.equipment
            .filter((l) => l.kind === "dye")
            .map(({ itemId: l, title: u }) => ({ itemId: l, title: u })),
          defaults: {
            character: this.userProfile.equipment.itemIds[1],
            paint: this.userProfile.equipment.itemIds[2],
            dye: this.userProfile.equipment.itemIds[70],
          },
        },
        {
          library: e,
          environment: s,
          stageBinding: this.toonStageBinding,
          kartItem: r,
          characterItems: t.characters,
          profile: this.userProfile,
        },
      );
      const o = await this.newRiderDialog.open(),
        a = this.userProfile;
      ((this.userProfile = {
        ...a,
        equipment: {
          ...a.equipment,
          itemIds: {
            ...a.equipment.itemIds,
            1: o.characterItemId,
            2: o.paintItemId,
            70: o.dyeItemId,
          },
        },
      }),
        cT(this.userProfile),
        EF(o.name),
        (this.localNickname = o.name));
      const c = t.characters.find((l) => l.itemId === o.characterItemId);
      c &&
        this.session.selection?.characterPath !== void 0 &&
        ((this.session.selection = {
          ...this.session.selection,
          characterPath: c.path,
          characterItemId: c.itemId,
        }),
        await this.enterTimeAttackReady());
    } finally {
      (this.newRiderDialog?.dispose(),
        (this.newRiderDialog = void 0),
        this.toonStageBinding.retain(s),
        s.dispose());
    }
  }
  async prepareStartupReady(e, t, i) {
    const r = await e.trackMetadata(t.trackId);
    if (!r) throw new Error(`${t.mapPath} 缺少权威 track metadata。`);
    const s = new AudioContext();
    Qc(s, this.gameOptions);
    let o, a;
    try {
      ((o = await P7.load(e, r, this.targetRandom, s)),
        (a = await Ny.load(e, s)),
        (this.session.selection = { ...t }),
        (this.session.vehicleTitle = i),
        (this.audio.context = s),
        (this.audio.bgm = o),
        (this.audio.bgmTrackId = t.trackId),
        (this.audio.interfaceAudio = a),
        await this.enterTimeAttackReady());
    } catch (c) {
      throw (
        a?.dispose(),
        o?.dispose(),
        this.audio.bgm === o &&
          ((this.audio.bgm = void 0), (this.audio.bgmTrackId = void 0)),
        this.audio.interfaceAudio === a && (this.audio.interfaceAudio = void 0),
        this.audio.context === s && (this.audio.context = void 0),
        s.state !== "closed" && s.close(),
        (this.session.selection = void 0),
        (this.session.vehicleTitle = ""),
        c
      );
    }
  }
  startRace(e) {
    const t = this.toonStageBinding.prepareCoatingStage();
    return Af0(
      {
        session: this.session,
        audio: this.audio,
        cameras: this.cameras,
        scene: this.scene,
        toonStageBinding: this.toonStageBinding,
        tachometerGaugePreserve: this.tachometerGaugePreserve,
        hud: this.hud,
        input: this.input,
        shell: this.shell,
        ready: this.ready,
        presenter: this.presenter,
        library: this.replayLibrary,
        getRaceBuilder: () => this.raceBuilder,
        getReadyOptions: () => this.timeAttackReadyOptions,
        getLocalNickname: () => this.localNickname,
        replaceTrack: (i) => this.replaceTrack(i),
        applyRaceOptions: (i) => this.applyRaceOptions(i),
        setPaused: (i) => {
          this.paused = i;
        },
      },
      e,
      t,
    ).finally(() => t.dispose());
  }
  replaceTrack(e) {
    this.presenter.replaceTrack(e);
  }
  togglePause() {
    if (this.shell.current === "MultiplayerRacing" || this.racePageTransition)
      return;
    if (this.shell.halted) {
      this.hud.showDebugText(
        "运行时已 fail-closed；请重新开始或返回菜单。",
        "error",
      );
      return;
    }
    const e = performance.now(),
      t = this.session.lifecycle.togglePause(e);
    t.length !== 0 &&
      ((this.paused = this.session.lifecycle.phase === Ne.Paused),
      this.session.pause?.setVisible(this.paused),
      this.audio.kartAudio?.setPaused(this.paused),
      this.handleTimeAttackActions(t, e),
      this.session.physics?.synchronizeClock(
        this.session.lifecycle.effectiveTime(e),
      ),
      (this.previousRenderTime = e / 1e3));
  }
  async restartRaceFromPause() {
    if (this.racePageTransition) return;
    this.racePageTransition = !0;
    let e;
    try {
      const t = this.session.selection ? { ...this.session.selection } : void 0;
      if (!t) throw new Error("TimeAttack Retry 缺少当前资源身份。");
      ((e = await this.presenter.afterNextFrame(() => eT(this.root))),
        this.session.pause?.setVisible(!1),
        await this.audio.context?.resume(),
        this.releaseRaceForReady(),
        await this.startRace(t),
        await this.presenter.afterNextFrame(() => {}));
    } catch (t) {
      this.haltRuntime(t, performance.now());
    } finally {
      (e?.(), (this.racePageTransition = !1));
    }
  }
  async returnToReady() {
    if (this.racePageTransition) return;
    this.racePageTransition = !0;
    let e;
    try {
      (this.shell.started &&
        (e = await this.presenter.afterNextFrame(() => eT(this.root))),
        await this.audio.context?.resume(),
        await this.enterTimeAttackReady());
    } catch (t) {
      this.hud.showDebugText(
        `Ready stage fail-closed：${t instanceof Error ? t.message : String(t)}`,
        "error",
      );
    } finally {
      (e?.(), (this.racePageTransition = !1));
    }
  }
  onGlobalKeyDown = (e) => {
    if (this.racePageTransition) {
      e.preventDefault();
      return;
    }
    if (this.shell.current === "MultiplayerRacing") {
      e.code === "Escape" && e.preventDefault();
      return;
    }
    this.handleGlobalShortcut(e) ||
      !this.shell.started ||
      e.code !== "Escape" ||
      (e.preventDefault(), this.togglePause());
  };
  handleGlobalShortcut(e) {
    if (this.shell.modal === "settings" || this.handleReadyShortcut(e))
      return !0;
    const t = BP[e.code];
    return t
      ? (e.preventDefault(),
        (this.gameOptions = { ...this.gameOptions, [t]: !this.gameOptions[t] }),
        t !== "enableRoadSound" && this.saveGameOptions(),
        this.applySavedAudioOptions(),
        !0)
      : e.repeat;
  }
  applyRaceOptions(e) {
    this.presenter.applyRaceOptions(e);
  }
  applySavedAudioOptions() {
    this.audio.context && Qc(this.audio.context, this.gameOptions);
  }
  handleReadyShortcut(e) {
    return this.ready.handleReadyShortcut(e);
  }
  configureBackbuffer() {
    this.activeBlackBar?.setViewportHeight(
      this.root.getBoundingClientRect().height,
    );
    const e = this.root.getBoundingClientRect(),
      t = EX(e.width, e.height, window.devicePixelRatio, H2, $2);
    (this.renderer.setDrawingBufferSize(H2, $2, t),
      (this.camera.aspect = H2 / $2),
      this.session.cameraMode === "drive" && this.session.driveCameraState
        ? this.cameras.drive.apply(this.camera, this.session.driveCameraState)
        : this.session.cameraMode === "surround" &&
            this.session.surroundCameraState
          ? this.cameras.surround.apply(
              this.camera,
              this.session.surroundCameraState,
            )
          : this.camera.updateProjectionMatrix());
  }
}
function Rf0(n, e, t) {
  const i = (p, v) => p.toLowerCase() === v.toLowerCase(),
    r = (t ?? gr()).equipment,
    { itemIds: s } = r,
    o = s[3],
    a = s[1],
    c =
      o === 0 && r.systemKartVariant
        ? `kart_/${r.systemKartVariant}/model.1s`
        : void 0,
    l = c
      ? b4(n.karts, o, c, r.systemKart)
      : n.karts.find((p) =>
          o === 0
            ? p.itemId === 0 && p.systemKey === r.systemKart
            : p.itemId === o,
        ),
    u = n3(o),
    h = u
      ? n.karts.find(
          (p) => p.itemId === gr().equipment.itemIds[3] && !n3(p.itemId),
        )
      : l;
  if (u && !h) throw new Error(`${Mw(o)} 当前目录中没有可用的启动替代车辆。`);
  if (!h) throw new Error(`启动车辆不在当前车库目录：ItemKart ${o}。`);
  const d = n.characters.find((p) => p.itemId === a);
  if (!d) throw new Error(`启动角色不在当前车库目录：ItemCharacter ${a}。`);
  const f = e.find((p) => i(p.path, jf.mapPath));
  if (!f) throw new Error(`已验证启动赛道不在准入 catalog：${jf.mapPath}。`);
  return {
    selection: {
      vehiclePath: h.path,
      vehicleItemId: h.itemId,
      vehicleSystemKey: h.systemKey,
      characterPath: d.path,
      characterItemId: d.itemId,
      mapPath: f.path,
      trackId: jf.trackId,
    },
    vehicleTitle: h.title,
  };
}
function If0(n) {
  const e = document.querySelector('script[type="module"][src]')?.src;
  if (!e) return () => {};
  let t = !1,
    i = !1;
  const r = async () => {
      if (!(t || i || !n())) {
        t = !0;
        try {
          const a = new URL("/", window.location.href);
          a.searchParams.set("kart-update-check", String(Date.now()));
          const c = await fetch(a, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!c.ok || !c.headers.get("content-type")?.includes("text/html"))
            return;
          const l = new DOMParser()
              .parseFromString(await c.text(), "text/html")
              .querySelector('script[type="module"][src]')
              ?.getAttribute("src"),
            u = l ? new URL(l, c.url).href : void 0;
          if (!u || u === e || !n() || i) return;
          const h = `kart-frontend-reload:${u}`;
          if (sessionStorage.getItem(h)) return;
          (sessionStorage.setItem(h, "1"), window.location.reload());
        } catch {
        } finally {
          t = !1;
        }
      }
    },
    s = () => {
      r();
    },
    o = () => {
      document.visibilityState === "visible" && r();
    };
  return (
    window.addEventListener("pageshow", s),
    document.addEventListener("visibilitychange", o),
    r(),
    () => {
      ((i = !0),
        window.removeEventListener("pageshow", s),
        document.removeEventListener("visibilitychange", o));
    }
  );
}
function kf0(n, e, t) {
  if (![n, e, t].every((c) => Number.isFinite(c) && c > 0))
    throw new Error(
      "Viewport dimensions and pixel ratio must be positive and finite.",
    );
  const i = Math.max(1, Math.floor(Math.min((n * t) / 16, (e * t) / 9))),
    r = i * 16,
    s = i * 9,
    o = Math.floor((n * t - r) / 2),
    a = Math.floor((e * t - s) / 2);
  return {
    width: r / t,
    height: s / t,
    left: o / t,
    top: a / t,
    physicalWidth: r,
    physicalHeight: s,
  };
}
function Lf0(n) {
  const e = {
    width: n.style.width,
    height: n.style.height,
    left: n.style.left,
    top: n.style.top,
  };
  let t;
  const i = () => {
      const o = kf0(window.innerWidth, window.innerHeight, xe());
      ((n.style.width = `${o.width}px`),
        (n.style.height = `${o.height}px`),
        (n.style.left = `${o.left}px`),
        (n.style.top = `${o.top}px`));
    },
    r = () => {
      (t?.removeEventListener("change", s),
        (t = window.matchMedia(`(resolution: ${xe()}dppx)`)),
        t.addEventListener("change", s));
    },
    s = () => {
      (i(), r());
    };
  return (
    i(),
    r(),
    window.addEventListener("resize", i),
    () => {
      (window.removeEventListener("resize", i),
        t?.removeEventListener("change", s),
        Object.assign(n.style, e));
    }
  );
}
const Oy = document.querySelector("#app");
if (!Oy) throw new Error("Application root #app was not found.");
Lf0(Oy);
const ZD = new Bf0(Oy);
ZD.mountGhostMenu();
If0(() => ZD.canReloadForUpdate());
export {
  Ox as $,
  $f0 as A,
  Of0 as B,
  Nf0 as C,
  C9 as D,
  i7 as E,
  Kf0 as F,
  Ow as G,
  Hf0 as H,
  qf0 as I,
  CI as J,
  p3 as K,
  xe as L,
  f20 as M,
  pQ as N,
  jc as O,
  Z9 as P,
  PR as Q,
  un as R,
  D1 as S,
  Wf0 as T,
  E9 as U,
  n3 as V,
  SI as W,
  jf0 as X,
  _I as Y,
  Xf0 as Z,
  uT as _,
  x1 as a,
  j6 as a0,
  Ma0 as a1,
  ep0 as a2,
  FR as a3,
  E7 as a4,
  Jf0 as a5,
  y20 as a6,
  C20 as a7,
  Yf0 as a8,
  ze as a9,
  N3 as aa,
  JI as ab,
  p5 as ac,
  S20 as ad,
  a20 as ae,
  Uf0 as af,
  Vf0 as ag,
  TI as ah,
  Zf0 as ai,
  h20 as aj,
  IR as ak,
  wk as al,
  cv as am,
  h6 as an,
  p20 as ao,
  aT as ap,
  zw as aq,
  KP as ar,
  Ka0 as as,
  m9 as at,
  Kv as au,
  ja0 as av,
  t3 as aw,
  tp0 as ax,
  np0 as ay,
  T as b,
  Hv as c,
  pe0 as d,
  Me0 as e,
  f5 as f,
  V0 as g,
  G1 as h,
  Jl as i,
  x20 as j,
  e6 as k,
  Qf0 as l,
  zx as m,
  T20 as n,
  y9 as o,
  s2 as p,
  W1 as q,
  we as r,
  $p as s,
  Ft as t,
  pZ as u,
  u20 as v,
  g20 as w,
  j0 as x,
  zf0 as y,
  sg as z,
};
