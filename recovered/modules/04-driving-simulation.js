class AL {
  constructor(e, t, i = !1, r = !1, s = !1, o, a, c, l = !1) {
    if (
      ((this.externalTeamGauge = s),
      (this.speedRaceMode = o),
      (this.lteMotion = a),
      (this.giant = c),
      (this.checkClientFramerate = l),
      (o?.kind === "lte") != !!a)
    )
      throw new Error("LTE 玩法与运动 consumer 不一致。");
    if ((o?.kind === "giant") != !!c)
      throw new Error("巨人玩法与规则 owner 不一致。");
    if (o && (Q00(o), o.team !== i))
      throw new Error("玩法与组队气量参数不一致。");
    ((this.tuning = { ...e }),
      (this.teamBooster = i),
      (this.teamBoosterDirect = r),
      (this.body = this.createBody()),
      (this.state = this.createState()),
      (this.wheels = this.createWheelRuntime()),
      (this.runtime = this.createRuntime()));
    const u = this;
    ((this.collisionShape = {
      rawHalfWidth: t.rawHalfWidth,
      rawHalfLength: t.rawHalfLength,
      get scaleX() {
        return u.runtime.eventScalePrimary.x;
      },
      get scaleY() {
        return u.runtime.eventScalePrimary.y;
      },
      get rawHeight() {
        return u.runtime.eventScalePrimary.z;
      },
    }),
      (this.runtime.eventScalePrimary = {
        x: m(t.scaleX),
        y: m(t.scaleY),
        z: m(t.rawHeight),
      }),
      l && this.clock.enableRhythmCheck());
  }
  externalTeamGauge;
  speedRaceMode;
  lteMotion;
  giant;
  checkClientFramerate;
  state;
  body;
  tuning;
  collisionShape;
  teamBooster;
  teamBoosterDirect;
  wheels;
  clock = new $40();
  flyingPetListeners = new Set();
  trackEventEffectRequests = [];
  dualBoostAuto = !0;
  dualBoostAutoArm = !0;
  nitroSeamlessRequest = !1;
  runtime;
  scratch = ni0();
  cameraRuntimeView = {
    wheelContact: !1,
    averageWheelHitNormal: F2(),
    eventScaleSecondary: F2(),
    stateCode: 0,
    motionMode: 0,
    action8: !1,
    mrContact: !1,
    hwContact: !1,
    motorcycleType: !1,
    tireTransient: 0,
    effectiveReverseScalar: 0,
    landingMotionTrigger: !1,
    landingShockAudioStrength: 0,
    collisionMotionHit: !1,
    collisionMotionStrength: 0,
    visualScaleMode: 0,
  };
  driftVisualView = {
    active: !1,
    contact: !1,
    speedKmh: 0,
    forwardSpeed: 0,
    motionMode: 0,
    roadSurface: void 0,
    rearWheelCompression: [0, 0],
    wheelCompressionBaseline: 0,
    obstacleWheelHit: !1,
    fullPhysicsBypass: !1,
    position: F2(),
    right: F2(),
    forward: F2(),
    up: F2(),
    presentationRight: F2(),
    presentationForward: F2(),
    presentationUp: F2(),
  };
  driftVisualScratch = F2();
  update(e, t, i) {
    const r = this.clock.advance(e);
    ((this.runtime.currentUpdateMs = r.nowMs),
      (this.runtime.currentReverseSnapshot = m(t.reverse)));
    const s = this.runtime.liveForwardAccel,
      o = this.runtime.liveDragFactor;
    return (
      this.applyJumpSurfaceTuning(),
      (this.runtime.collisionMotionHit = !1),
      (this.runtime.collisionMotionStrength = 0),
      (this.runtime.landingMotionTrigger = !1),
      (this.runtime.landingShockAudioStrength = 0),
      this.updateEventGravity(r.nowMs),
      this.updateInstantWallCharge(r.nowMs),
      this.runtime.fullPhysicsBypass || this.giant?.frozen
        ? (a1(this.body.linearVelocity),
          a1(this.body.angularVelocity),
          a1(this.scratch.force),
          a1(this.scratch.torque),
          a1(this.runtime.stagedExternalForce),
          a1(this.runtime.stagedExternalTorque),
          this.updateStateTimerMilliseconds(r.elapsedMs),
          this.runtime.fullPhysicsBypass &&
            r.slicesMs.forEach((a) =>
              this.updateResetGaugeRefill(m(m(a) * m(0.001)), r.nowMs),
            ),
          (this.runtime.liveForwardAccel = s),
          (this.runtime.liveDragFactor = o),
          this.updateModeScale(r.nowMs),
          this.updatePublicGauge(),
          this.updateChargerExpiry(r.nowMs),
          this.updateCachedDisplaySpeed(),
          this.updateDualBooster(),
          this.updateTeamGauge(r.nowMs),
          this.updateTeamSlotWindow(r.nowMs),
          this.settleWallCollision(r.nowMs),
          this.syncPresentationFields(),
          r)
        : (this.updateObstacleSuppressionTimer(r.elapsedMs),
          r.slicesMs.forEach((a) => {
            (this.stepSubstep(m(m(a) * m(0.001)), t, i),
              (this.runtime.landingShockAudioStrength = Math.max(
                this.runtime.landingShockAudioStrength,
                this.runtime.collisionResponseMagnitudeB6C,
              )));
          }),
          (this.runtime.liveForwardAccel = s),
          (this.runtime.liveDragFactor = o),
          this.updateModeScale(r.nowMs),
          this.updateChargerExpiry(r.nowMs),
          this.updateCachedDisplaySpeed(),
          this.updateDualBooster(),
          this.updateTeamGauge(r.nowMs),
          this.updateTeamSlotWindow(r.nowMs),
          this.settleWallCollision(r.nowMs),
          this.syncPresentationFields(),
          r)
    );
  }
  synchronizeClock(e) {
    this.clock.synchronize(e, this.checkClientFramerate);
  }
  updateLockedIngameClock(e) {
    this.checkClientFramerate
      ? this.clock.advance(e)
      : this.clock.synchronize(e);
  }
  setDualBoostAuto(e, t) {
    ((this.dualBoostAuto = e),
      (this.dualBoostAutoArm = t === 1096 || t === 1106 || (t !== 1097 && e)));
  }
  driveCameraRuntime() {
    const e = this.cameraRuntimeView;
    return (
      (e.wheelContact = this.wheels.grounded),
      qt(e.averageWheelHitNormal, this.wheels.averageNormal),
      qt(e.eventScaleSecondary, this.runtime.eventScaleSecondary),
      (e.stateCode = this.runtime.physicsState),
      (e.motionMode = this.runtime.motionMode),
      (e.action8 = this.runtime.instantAccelerationActive),
      (e.mrContact = this.runtime.mrContact),
      (e.hwContact = this.runtime.hwContact),
      (e.motorcycleType = this.tuning.motorcycleType),
      (e.tireTransient = this.runtime.tireTransient),
      (e.effectiveReverseScalar = this.runtime.currentReverseSnapshot),
      (e.landingMotionTrigger = this.runtime.landingMotionTrigger),
      (e.landingShockAudioStrength = this.runtime.landingShockAudioStrength),
      (e.collisionMotionHit = this.runtime.collisionMotionHit),
      (e.collisionMotionStrength = this.runtime.collisionMotionStrength),
      (e.visualScaleMode = this.visualScaleMode()),
      e
    );
  }
  driftVisualRuntime() {
    const e = this.driftVisualView,
      t = this.driftVisualScratch;
    return (
      qt(e.presentationUp, this.body.up),
      d1(this.body.linearVelocity) === 0
        ? (qt(e.presentationForward, this.body.forward),
          qt(e.presentationRight, this.body.right))
        : (oi0(e.presentationForward, this.body.linearVelocity),
          L2(t, e.presentationForward, -1),
          fd(e.presentationRight, t, e.presentationUp)),
      (e.active = this.state.drifting),
      (e.contact = this.runtime.contactWorking),
      (e.speedKmh = this.runtime.cachedDisplaySpeedKmh),
      (e.forwardSpeed = this.runtime.localForwardSpeed),
      (e.motionMode = this.runtime.motionMode),
      (e.roadSurface = Mt(this.wheels.roadDescriptor)),
      (e.rearWheelCompression[0] = this.wheels.compression[2]),
      (e.rearWheelCompression[1] = this.wheels.compression[3]),
      (e.wheelCompressionBaseline = x5),
      (e.obstacleWheelHit = this.wheels.obstacleRayHit),
      (e.fullPhysicsBypass = this.runtime.fullPhysicsBypass),
      qt(e.position, this.body.position),
      qt(e.right, this.body.right),
      qt(e.forward, this.body.forward),
      qt(e.up, this.body.up),
      e
    );
  }
  reset(e, t, i, r) {
    (Object.assign(this.body, this.createBody()),
      (this.body.position = { x: e, y: t, z: i }),
      ei0(this.body, r),
      Object.assign(this.state, this.createState()),
      Object.assign(this.wheels, this.createWheelRuntime()),
      (this.runtime = this.createRuntime()),
      a1(this.scratch.force),
      a1(this.scratch.torque),
      (this.trackEventEffectRequests = []),
      (this.nitroSeamlessRequest = !1),
      this.clock.reset(this.checkClientFramerate),
      this.syncPresentationFields());
  }
  resetFromRouteFrame(e) {
    this.reset(e.position.x, e.position.y, e.position.z, 0);
    const t = { x: e.forward.x, y: m(-e.forward.z), z: e.forward.y },
      i = { x: m(-t.x), y: m(-t.y), z: m(-t.z) },
      r = ZC(Tn(i, { x: 0, y: 0, z: 1 })),
      s = ZC(Tn(r, i));
    (hl(this.body, [
      { x: r.x, y: i.x, z: s.x },
      { x: r.y, y: i.y, z: s.y },
      { x: r.z, y: i.z, z: s.z },
    ]),
      this.syncPresentationFields());
  }
  handleDrivingCommand(e, t) {
    switch (e.kind) {
      case "drift-start":
        if (this.speedRaceMode?.kind === "grip") return;
        (this.runtime.driftDecay <= 0 &&
          ((this.runtime.activeDrift = !0),
          (this.runtime.triggerPhase = !0),
          (this.runtime.driftTailLatch = this.runtime.localForwardSpeed > 0),
          this.runtime.contactWorking ||
            (this.runtime.delayedDriftRequest = !0)),
          (this.state.driftDirection = e.direction));
        return;
      case "drift-stop":
        if (this.speedRaceMode?.kind === "grip") return;
        (e.active, this.stopDrift());
        return;
      case "use-item-or-booster":
        (this.startNormalBooster(t), this.armDualBooster());
        return;
      case "reorder-items":
        this.reorderSpeedSlots();
        return;
      case "instant-acceleration":
        this.tuning.instAccelGaugeLength > 0 &&
          this.runtime.instantGauge >= this.tuning.instAccelGaugeMinUsable &&
          (this.runtime.instantAccelerationActive = !0);
        return;
      case "forward-down":
        ((this.runtime.forwardOneShot = !0),
          this.runtime.driftLifecycleB50 > 0 &&
            this.speedRaceMode?.kind !== "grip" &&
            ((this.runtime.driftLifecycleB50 = 0),
            (this.runtime.driftLifecycleB44 = this.tuning.driftBoostTick
              ? m(m(this.tuning.driftBoostTick) / m(1e3))
              : m(0.5)),
            (this.runtime.physicsState = 2),
            (this.runtime.stateRemainingMs = 0),
            (this.state.boostTime = 0)));
        return;
      case "forward-up":
        (this.runtime.physicsState < 13 || this.runtime.physicsState > 16) &&
          ((this.runtime.physicsState = 0),
          (this.runtime.stateRemainingMs = 0),
          (this.state.boostTime = 0));
        return;
      case "reverse-down":
      case "reverse-up":
      case "reset":
      case "unsupported-action":
        return;
    }
  }
  tryConsumeNormalBooster(e) {
    const t = this.startNormalBooster(e);
    return (t && this.armDualBooster(), t);
  }
  queueNitroSeamless() {
    this.nitroSeamlessRequest = !0;
  }
  cancelNitroSeamless() {
    this.nitroSeamlessRequest = !1;
  }
  canHandleRouteSurfaceTag(e) {
    return Eg(Vo(e)) !== "unclosed";
  }
  handleRouteSurfaceTag(e) {
    if (!this.canHandleRouteSurfaceTag(e)) return !1;
    const t = Eg(Vo(e));
    return (
      (t !== "rail" && t !== "rail-rain") ||
        (e.includes("out:next") && this.requestMotionMode(!0, 6),
        e.includes("in:next") && this.enterRailMode()),
      !0
    );
  }
  prepareRailCheckpointReentry() {
    ((this.runtime.motionMode === 2 || this.runtime.motionMode === 3) &&
      (this.runtime.motionMode = 0),
      (this.runtime.railFrame = void 0));
  }
  contactRailId() {
    const e = this.wheels.railContactDescriptor;
    return e ? Ri(e) : void 0;
  }
  consumeRailResetRequest() {
    const e = this.runtime.railResetRequest;
    return ((this.runtime.railResetRequest = !1), e);
  }
  consumeCollisionAudioStrength() {
    const e = this.runtime.collisionAudioStrength;
    return ((this.runtime.collisionAudioStrength = 0), e);
  }
  consumeCrashEffectRequest() {
    const e = this.runtime.strongLateralCollision;
    return ((this.runtime.strongLateralCollision = !1), e);
  }
  consumeShockWaveRequest() {
    const e = this.runtime.shockWaveRequest;
    return ((this.runtime.shockWaveRequest = !1), e);
  }
  consumeTrackEventEffectRequests() {
    const e = this.trackEventEffectRequests;
    return ((this.trackEventEffectRequests = []), e);
  }
  consumeSteeringCollisionAudioGain() {
    const e = this.runtime.steeringCollisionAudioGain;
    return ((this.runtime.steeringCollisionAudioGain = 0), e);
  }
  consumeAutomaticResetRequest() {
    const e = this.runtime.automaticResetRequest;
    return ((this.runtime.automaticResetRequest = !1), e);
  }
  audioState() {
    return this.runtime.physicsState;
  }
  dualBoosterMode() {
    return this.runtime.dualBoosterMode;
  }
  dualBoosterState() {
    return this.runtime.dualBoosterState;
  }
  dualBoosterReadyRemainingMs() {
    return Math.max(0, Math.trunc(this.runtime.dualReadyRemainingMs));
  }
  dualBoosterTeam() {
    return this.runtime.physicsState === 4
      ? !0
      : this.runtime.physicsState === 10 && this.runtime.dualBoosterTeam;
  }
  displaySpeedKmh() {
    return this.runtime.cachedDisplaySpeedKmh;
  }
  copyNetworkWrench(e) {
    (Object.assign(e.force, this.scratch.force),
      Object.assign(e.torque, this.scratch.torque));
  }
  get networkMotionMode() {
    return this.runtime.motionMode;
  }
  networkCollisionState() {
    return {
      active: this.runtime.automaticResetInteractionActive,
      scaleX: this.collisionShape.scaleX,
      scaleY: this.collisionShape.scaleY,
    };
  }
  applyKartPairResponse(e, t, i) {
    for (const r of ["x", "y", "z"])
      ((this.body.linearVelocity[r] = m(this.body.linearVelocity[r] + e[r])),
        (this.body.angularVelocity[r] = m(
          this.body.angularVelocity[r] + t[r],
        )));
    ((this.runtime.collisionMotionHit = !0),
      (this.runtime.collisionMotionStrength = Math.max(
        this.runtime.collisionMotionStrength,
        i,
      )));
  }
  timeAttackTachometerSpeed() {
    return {
      displaySpeed: this.runtime.cachedDisplaySpeedKmh,
      layerThreshold: this.tuning.autoChargeLowSpeed,
    };
  }
  timeAttackTachometerGauges() {
    const e = m(this.tuning.instAccelGaugeLength),
      t = this.timeAttackBoosterUnlimited();
    return {
      mainRatio: this.mainGaugeRatio(),
      instantRatio: e === 0 ? 0 : m(m(this.runtime.instantGauge) / e),
      wallCompensationEventId: this.runtime.instantWallCooldownAnchorMs >>> 0,
      instantInterpolationMs: 500,
      teamRatio: t ? 0 : this.runtime.teamGaugeValue,
      teamBooster: t ? !1 : this.teamBooster,
    };
  }
  timeAttackSpeedSlots() {
    return this.runtime.speedSlots;
  }
  canReorderSpeedSlots() {
    if (!this.teamBooster || this.runtime.speedSlots.length < 2) return !1;
    const e = this.runtime.speedSlotReorderedAtMs;
    if (e >= 0 && this.runtime.currentUpdateMs - e <= K40) return !1;
    const [t, i] = this.runtime.speedSlots;
    return t !== -1 && i !== -1 && t !== i;
  }
  timeAttackSlotChangerActive() {
    return this.teamBooster;
  }
  reorderSpeedSlots() {
    return this.canReorderSpeedSlots()
      ? (([this.runtime.speedSlots[0], this.runtime.speedSlots[1]] = [
          this.runtime.speedSlots[1],
          this.runtime.speedSlots[0],
        ]),
        ([
          this.runtime.speedSlotDisabled[0],
          this.runtime.speedSlotDisabled[1],
        ] = [
          this.runtime.speedSlotDisabled[1],
          this.runtime.speedSlotDisabled[0],
        ]),
        (this.runtime.speedSlotReorderedEdge = !0),
        (this.runtime.speedSlotReorderedAtMs = this.runtime.currentUpdateMs),
        !0)
      : !1;
  }
  consumeSpeedSlotReordered() {
    const e = this.runtime.speedSlotReorderedEdge;
    return ((this.runtime.speedSlotReorderedEdge = !1), e);
  }
  timeAttackTachometerExceed() {
    const e = m(this.runtime.instantGauge),
      t = m(this.tuning.instAccelGaugeLength);
    return {
      active: this.runtime.instantAccelerationActive,
      usable: e >= m(this.tuning.instAccelGaugeMinUsable),
      usableThresholdRatio:
        t === 0 ? 0 : wd(m(m(this.tuning.instAccelGaugeMinUsable) / t), 0, 1),
      full: e === m(this.tuning.instAccelGaugeLength),
    };
  }
  timeAttackBoosterUnlimited() {
    return m(Math.max(m(this.tuning.driftMaxGauge), m(1))) === m(1);
  }
  timeAttackTachometerDriftMaxGauge() {
    return this.tuning.driftMaxGauge;
  }
  timeAttackTachometerIncGauge() {
    return this.runtime.tachometerIncGauge;
  }
  timeAttackTachometerCharger() {
    return {
      count: this.runtime.chargerPendingUses >>> 0,
      capacity: this.tuning.chargerSystemBoosterUseCount >>> 0,
      active: this.runtime.chargerActive,
      durationMs: this.chargerDurationMs(),
    };
  }
  timeAttackTachometerCollision() {
    const e = m(this.runtime.cachedDisplaySpeedKmh),
      t = m(this.tuning.wallCollGaugeMinVelBound);
    return {
      crash: !Number.isNaN(e) && !Number.isNaN(t) && e >= t,
      charging:
        this.runtime.wallCollisionAnchorMs !== 0 &&
        this.runtime.resetRefillAnchorMs === 0,
      timerEnabled: m(this.runtime.resetRefillRemaining) > 0,
      collisionAnchorMs: this.runtime.wallCollisionAnchorMs >>> 0,
      refillAnchorMs: this.runtime.resetRefillAnchorMs >>> 0,
      cooldownMs: this.tuning.wallCollGaugeCooldownTime >>> 0,
    };
  }
  consumeTimeAttackTachometerNormalBooster() {
    const e = this.runtime.tachometerNormalBoosterDuration;
    return ((this.runtime.tachometerNormalBoosterDuration = void 0), e);
  }
  consumeTimeAttackTachometerGaugePreserve() {
    const e = this.runtime.tachometerGaugePreserveMarker;
    return ((this.runtime.tachometerGaugePreserveMarker = !1), e);
  }
  timeAttackResultCounts() {
    return {
      crashCount: this.runtime.resultCrashCount,
      boosterCount: this.runtime.resultBoosterCount,
    };
  }
  timeAttackTachometerAnimationState() {
    return this.runtime.animationSlot;
  }
  startRaceBooster() {
    if (this.runtime.physicsState !== 0) return;
    const e = Math.max(0, Math.trunc(this.tuning.startBoosterTimeSpeed));
    ((this.runtime.physicsState = 1),
      (this.runtime.stateRemainingMs = e),
      (this.state.boostTime = e * 0.001));
  }
  setRaceMotionLocked(e) {
    this.runtime.raceMotionLocked = e;
  }
  startPlayBooster(e) {
    !this.runtime.raceMotionLocked ||
      !e.rawDriftHeld ||
      ((this.runtime.physicsState = 18),
      (this.runtime.stateRemainingMs = 1e3),
      (this.state.boostTime = 0));
  }
  lowSpeedAutomaticResetActive(e) {
    if (
      !(m(e.forward) > 0 || m(e.reverse) > 0) ||
      !this.runtime.automaticResetInteractionActive ||
      this.runtime.fullPhysicsBypass
    )
      return !1;
    const t = this.body.linearVelocity;
    return !(m(m(m(t.x * t.x) + m(t.z * t.z)) + m(t.y * t.y)) > m(1));
  }
  beginResetInitiation(e) {
    return e && this.runtime.fullPhysicsBypass
      ? !1
      : ((this.runtime.fullPhysicsBypass = !0),
        (this.runtime.automaticResetInteractionActive = !1),
        (this.runtime.interactionActive = !1),
        this.tuning.wallCollGaugeCooldownTime >>> 0
          ? ((this.runtime.wallCollisionAnchorMs = 0),
            e
              ? (this.clearResetGaugeRefill(), !0)
              : (this.runtime.driftGaugeWindow && this.commitDriftGauge(),
                (this.runtime.resetRefillAnchorMs =
                  this.runtime.currentUpdateMs),
                this.runtime.committedGauge !== m(this.tuning.driftMaxGauge)
                  ? ((this.runtime.resetRefillInitial = m(1.01)),
                    (this.runtime.resetRefillRemaining = m(1.01)))
                  : this.clearResetGaugeRefill(),
                !0))
          : !0);
  }
  prepareLowHeightResetPose() {
    ((this.body.position.y = 0),
      a1(this.body.linearVelocity),
      a1(this.body.angularVelocity),
      this.syncPresentationFields());
  }
  completeCheckpointPose(e, t) {
    ((this.body.position = O9(e.position)),
      (this.body.forward = O9(e.forward)),
      (this.body.up = O9(e.up)));
    const i = { x: e.forward.x, y: m(-e.forward.z), z: e.forward.y },
      r = { x: e.up.x, y: m(-e.up.z), z: e.up.y },
      s = Tn(i, r),
      o = { x: m(-s.x), y: m(-s.y), z: m(-s.z) };
    ((this.body.right = { x: o.x, y: o.z, z: m(-o.y) }),
      t && (a1(this.body.linearVelocity), a1(this.body.angularVelocity)),
      this.syncPresentationFields());
  }
  warpPosition(e) {
    ((this.body.position = O9(e)), this.syncPresentationFields());
  }
  restoreResetInteraction() {
    ((this.runtime.automaticResetInteractionActive = !0),
      (this.runtime.interactionActive = !0));
  }
  updateModeInventory() {
    const e = m(Math.max(this.tuning.driftMaxGauge, 1));
    if (this.runtime.committedGauge !== e) return !1;
    (this.clearResetGaugeRefill(),
      (this.runtime.committedGauge = m(this.runtime.committedGauge - e)));
    const t = this.runtime.speedSlots.findIndex((i) => i === -1);
    return (
      t >= 0 && (this.runtime.speedSlots[t] = Cs),
      (this.state.nitro = this.runtime.speedSlots.filter(ec).length),
      this.updatePublicGauge(),
      !0
    );
  }
  cancelControls() {
    (this.stopDrift(), (this.nitroSeamlessRequest = !1));
  }
  stopDrift() {
    if (
      Mt(this.wheels.roadDescriptor) === "dirt" &&
      this.runtime.activeDrift &&
      this.runtime.roadTransient <= 0
    ) {
      const e = m(this.runtime.bodySpeed / m(120));
      this.runtime.roadTransient = m(m(10) * m(e * e));
    }
    ((this.runtime.activeDrift = !1), (this.runtime.delayedDriftRequest = !1));
  }
  hardCancelControls() {
    (this.cancelControls(),
      (this.runtime.triggerPhase = !1),
      (this.runtime.oneSubstepDrift = !1),
      (this.state.drifting = !1),
      (this.state.driftDirection = 0));
  }
  setDriveSteeringSuppressed(e) {
    this.runtime.driveSteeringSuppressed = e;
  }
  isDriveSteeringSuppressed() {
    return this.runtime.driveSteeringSuppressed;
  }
  setFullPhysicsBypass(e) {
    this.runtime.fullPhysicsBypass = e;
  }
  setWarpPresentationActive(e) {
    ((this.runtime.automaticResetInteractionActive = !e),
      (this.runtime.interactionActive = !e));
  }
  isWarpPresentationActive() {
    return !this.runtime.interactionActive;
  }
  setWarpPressProtected(e) {
    this.runtime.pressProtected1C0 = e;
  }
  setRuntimeScales(e) {
    (e.drive !== void 0 && (this.runtime.driveScale = m(e.drive)),
      e.steering !== void 0 &&
        (this.runtime.steeringExponentialScale = m(e.steering)),
      e.drag !== void 0 && (this.runtime.dragScale = m(e.drag)));
  }
  setMultiplayerDrivingScales(e) {
    if (
      !Number.isFinite(e.catchupDrag) ||
      e.catchupDrag < m(0.85) ||
      e.catchupDrag > 1 ||
      !Number.isFinite(e.catchupSteering) ||
      e.catchupSteering < m(0.95) ||
      e.catchupSteering > 1 ||
      !Number.isFinite(e.draftAcceleration) ||
      e.draftAcceleration < 1 ||
      e.draftAcceleration > 4 ||
      (e.chargerDuration !== void 0 &&
        ![1, m(1.2), m(1.4), m(1.8)].includes(e.chargerDuration))
    )
      throw new Error("Invalid multiplayer driving scales");
    (e.chargerDuration !== void 0 &&
      (this.runtime.chargerDurationScale = m(e.chargerDuration)),
      (this.runtime.catchupDragScale = m(e.catchupDrag)),
      (this.runtime.catchupSteeringScale = m(e.catchupSteering)),
      (this.runtime.draftAccelerationScale = m(e.draftAcceleration)));
  }
  triggerEventScale(e) {
    if (![60, 100, 180, 320].includes(e)) return !1;
    const t = m(m(e) / m(100));
    return (
      (this.runtime.eventScaleTarget = { x: t, y: t, z: t }),
      (this.runtime.eventScaleAnchorMs = 0),
      (this.runtime.eventScaleMode = 1),
      !0
    );
  }
  triggerEventGravity(e) {
    if (![1, 1.5, 2, 3, 3.2, 5, 9].includes(e)) return !1;
    for (const t of ["x", "y", "z"])
      ((this.body.linearVelocity[t] = m(m(this.body.linearVelocity[t]) / m(4))),
        (this.body.angularVelocity[t] = m(
          m(this.body.angularVelocity[t]) / m(5),
        )));
    return ((this.runtime.gravityDivisor = m(e)), !0);
  }
  setAnimationSlot(e) {
    if (!Number.isInteger(e) || e < 0 || e > 6)
      throw new Error("ReKart 动画槽必须位于 0..6。");
    this.runtime.animationSlot = e;
  }
  consumeKartAnimationInput() {
    const e = this.runtime.animationInput;
    return ((this.runtime.animationInput = void 0), e);
  }
  addFlyingPetListener(e) {
    return (
      this.flyingPetListeners.add(e),
      () => this.flyingPetListeners.delete(e)
    );
  }
  getDebugState() {
    return {
      reverseAccumulator: this.runtime.reverseAccumulator,
      steeringAngle: this.runtime.steeringAngle,
      steeringEnvelope: this.runtime.steeringEnvelope,
      activeDrift: this.runtime.activeDrift,
      triggerPhase: this.runtime.triggerPhase,
      oneSubstepDrift: this.runtime.oneSubstepDrift,
      driftGaugeWindow: this.runtime.driftGaugeWindow,
      pendingGauge: this.runtime.pendingGauge,
      committedGauge: this.runtime.committedGauge,
      instantGauge: this.runtime.instantGauge,
      instantAccelerationActive: this.runtime.instantAccelerationActive,
      instantWallCollisionAnchorMs: this.runtime.instantWallCollisionAnchorMs,
      instantWallCooldownAnchorMs: this.runtime.instantWallCooldownAnchorMs,
      chargerEnabled: this.runtime.chargerEnabled,
      chargerActive: this.runtime.chargerActive,
      chargerBoosterUses: this.runtime.chargerBoosterUses,
      chargerActivations: this.runtime.chargerActivations,
      chargerPendingUses: this.runtime.chargerPendingUses,
      chargerExpiryMs: this.runtime.chargerExpiryMs,
      physicsState: this.runtime.physicsState,
      stateRemainingMs: this.runtime.stateRemainingMs,
      animationSlot: this.runtime.animationSlot,
      cachedDisplaySpeedKmh: this.runtime.cachedDisplaySpeedKmh,
      mrContact: this.runtime.mrContact,
      hwContact: this.runtime.hwContact,
      contactRisingEdge: this.runtime.contactRisingEdge,
      landingMotionTrigger: this.runtime.landingMotionTrigger,
      collisionMotionHit: this.runtime.collisionMotionHit,
      collisionMotionStrength: this.runtime.collisionMotionStrength,
      roadCooldown: this.runtime.roadCooldown,
      motionMode: this.runtime.motionMode,
      railCaptureTimeout: this.runtime.railCaptureTimeout,
      railCaptureDelay: this.runtime.railCaptureDelay,
      railEntryTimerA: this.runtime.railEntryTimerA,
      railEntryTimerB: this.runtime.railEntryTimerB,
      railReturnTimer: this.runtime.railReturnTimer,
      railBadGeometryTimer: this.runtime.railBadGeometryTimer,
      railConfig: this.runtime.railConfig
        ? { ...this.runtime.railConfig }
        : void 0,
      railFrame: this.runtime.railFrame ? ic(this.runtime.railFrame) : void 0,
      railRelativeOrientation: ic(this.runtime.railRelativeOrientation),
      railResetRequest: this.runtime.railResetRequest,
      fullPhysicsBypass: this.runtime.fullPhysicsBypass,
      interactionActive: this.runtime.interactionActive,
      resetRefillInitial: this.runtime.resetRefillInitial,
      resetRefillRemaining: this.runtime.resetRefillRemaining,
      resetRefillAnchorMs: this.runtime.resetRefillAnchorMs,
      wallCollisionPreSpeedKmh: this.runtime.wallCollisionPreSpeedKmh,
      wallCollisionAnchorMs: this.runtime.wallCollisionAnchorMs,
      obstacleSuppressionRemainingMs:
        this.runtime.obstacleSuppressionRemainingMs,
      obstacleSuppressionLatch: this.runtime.obstacleSuppressionLatch,
      pressState: this.runtime.pressState,
      pressProtected1C0: this.runtime.pressProtected1C0,
      automaticResetLowCollisionTime:
        this.runtime.automaticResetLowCollisionTime,
      automaticResetHighCollisionTime:
        this.runtime.automaticResetHighCollisionTime,
      automaticResetObstacleTime: this.runtime.automaticResetObstacleTime,
      automaticResetRequest: this.runtime.automaticResetRequest,
      collisionResponseMagnitudeB6C: this.runtime.collisionResponseMagnitudeB6C,
      visualScaleA: O9(this.runtime.visualScaleA),
      visualScaleRestorePending: this.runtime.visualScaleRestorePending,
      eventScalePrimary: O9(this.runtime.eventScalePrimary),
      eventScaleSecondary: O9(this.runtime.eventScaleSecondary),
      eventScaleTarget: O9(this.runtime.eventScaleTarget),
      eventScaleStart: O9(this.runtime.eventScaleStart),
      eventScaleAnchorMs: this.runtime.eventScaleAnchorMs,
      eventScaleDurationMs: this.runtime.eventScaleDurationMs,
      eventScaleMode: this.runtime.eventScaleMode,
      gravityDivisor: this.runtime.gravityDivisor,
      gravityAnchorMs: this.runtime.gravityAnchorMs,
      liveForwardAccel: this.runtime.liveForwardAccel,
      liveDragFactor: this.runtime.liveDragFactor,
      motorcycleDriftTimestampMs: this.runtime.motorcycleDriftTimestampMs,
      motorcycleTransientTorque: this.runtime.motorcycleTransientTorque,
    };
  }
  settle(e, t) {
    (this.stepSubstep(e, W40, t),
      this.updateCachedDisplaySpeed(),
      this.syncPresentationFields());
  }
  lteDodgeAvailable() {
    return (
      !!this.lteMotion &&
      !this.runtime.raceMotionLocked &&
      !this.runtime.fullPhysicsBypass &&
      !this.runtime.pressProtected1C0 &&
      this.runtime.motionMode === 0
    );
  }
  get networkCollisionScheduled() {
    return this.clock.getRhythmState().tick;
  }
  giantSourceProtected() {
    return this.runtime.pressProtected1C0;
  }
  compensateGiantBooster() {
    if (!this.giant) return;
    const e = this.runtime.speedSlots.findIndex(
      (t, i) => t === -1 && !this.runtime.speedSlotDisabled[i],
    );
    (e >= 0 && (this.runtime.speedSlots[e] = Cs),
      (this.state.nitro = this.runtime.speedSlots.filter(ec).length));
  }
  clearGiantRaceEffects() {
    this.giant &&
      (this.giant.reset(),
      (this.runtime.eventScalePrimary = { x: 1, y: 1, z: 1 }),
      (this.runtime.eventScaleSecondary = { x: 1, y: 1, z: 1 }),
      (this.runtime.visualScaleA = { x: 1, y: 1, z: 1 }),
      (this.runtime.visualScaleRestorePending = !1),
      (this.runtime.visualScaleTransitionAnchorMs = void 0),
      (this.runtime.obstacleSuppressionRemainingMs = 0),
      (this.runtime.obstacleSuppressionLatch = !1),
      (this.runtime.pressState = 0),
      (this.runtime.pressProtected1C0 = !1),
      this.flyingPetListeners.forEach((e) => e(!0)),
      this.syncPresentationFields());
  }
  stepSubstep(e, t, i) {
    if (((e = m(e)), !(e > 0) || e > ud))
      throw new Error("车辆物理子步必须位于 (0, f32(0.002)] 秒。");
    const r = this.runtime.motionMode === 2 || this.runtime.motionMode === 3,
      s = this.scratch.force,
      o = this.scratch.torque;
    if (
      (this.updateStateTimer(e),
      this.updateDriftLifecycleTimers(e),
      this.nitroSeamlessRequest &&
        this.tryConsumeNormalBooster(t) &&
        (this.nitroSeamlessRequest = !1),
      this.scanSpecialRoad(i),
      this.rebuildBodyState(s, o),
      this.probeWheels(i, r),
      this.runtime.motionMode === 0 &&
        this.wheels.railContactDescriptor &&
        this.enterRailMode(),
      this.applyResetSurfaceRequest(),
      r && this.applyFull3DRail(e, t, i, s, o),
      this.wheels.grounded || this.runtime.mrContact || this.runtime.hwContact)
    ) {
      if (!r) {
        if (this.runtime.hwContact && !this.wheels.grounded) {
          const c = s9(this.runtime.specialNormal, m(-10));
          (t1(c, this.runtime.liveForwardAccel),
            t1(c, this.runtime.driveScale),
            t1(c, m(1.5)),
            c9(s, c));
        }
        (this.applySuspension(e, s, o),
          this.runtime.driveSteeringSuppressed ||
            this.applyLongitudinal(e, t, s),
          this.runtime.delayedDriftRequest &&
            this.speedRaceMode?.kind !== "grip" &&
            ((this.runtime.delayedDriftRequest = !1),
            this.runtime.driftDecay <= 0 &&
              ((this.runtime.activeDrift = !0),
              (this.runtime.triggerPhase = !0),
              (this.runtime.driftTailLatch =
                this.runtime.localForwardSpeed > 0))),
          this.runtime.driveSteeringSuppressed ||
            this.applySteeringAndTires(e, t, s, o));
      }
      (this.applyRoadConsumers(e, s), this.applyBoosterChargeSurface());
    } else
      r ||
        (this.applyAirState(s, o),
        (this.runtime.activeDrift = !1),
        (this.runtime.oneSubstepDrift = !1),
        (this.runtime.triggerPhase = !1),
        (this.runtime.steeringEnvelope = 0));
    if (
      (this.updateTachometerIncGauge(r),
      this.applyDrag(s, o, r),
      r || (this.captureRail(e, i), this.returnToStandard(e, i)),
      this.lteMotion &&
        (r ||
        this.runtime.motionMode !== 0 ||
        this.runtime.raceMotionLocked ||
        this.runtime.fullPhysicsBypass ||
        this.runtime.pressProtected1C0
          ? this.lteMotion.interrupt()
          : this.lteMotion.step(
              e,
              this.body.right,
              this.runtime.liveForwardAccel,
              this.runtime.driveScale,
              this.state.drifting,
              s,
            )),
      this.integrateVelocity(e, s, o, this.runtime.integrationExtraForce),
      this.updateInstantAccelerationGauge(e),
      this.accumulateDriftGauge(e, r),
      this.accumulateSpeedGauge(e, r),
      this.updateResetGaugeRefill(e, this.runtime.currentUpdateMs),
      r)
    )
      this.integrateFull3D(e);
    else {
      c9(this.body.linearVelocity, this.wheels.surfaceVelocity);
      const c = this.resolvePrimaryCollision(i, t);
      this.updatePrimaryAutomaticResetTimers(c, e);
      const l = this.resolveStaticObstacles(i);
      (this.updateObstacleAutomaticResetTimer(l, e),
        this.giant &&
          (c.lowHit || this.giantObstacleLowHit) &&
          this.giant.processWallCollision(
            this.runtime.currentUpdateMs,
            this.runtime.physicsState,
            this.runtime.pressProtected1C0,
          ),
        this.resolveTrackEvents(i),
        this.applySupplementalWheelRecovery(i),
        this.applySlipAlignment(),
        this.integrateStandardOrientation(e),
        this.updateCollisionGaugeOwners(l),
        bt(this.body.linearVelocity, this.wheels.surfaceVelocity));
    }
    const a =
      this.runtime.activeDrift ||
      this.runtime.driftDecay > 0 ||
      this.runtime.oneSubstepDrift;
    ((this.state.drifting = a),
      (this.state.driftTime = a ? m(this.state.driftTime + e) : 0),
      a || (this.state.driftDirection = 0));
  }
  applyBoosterChargeSurface() {
    if (Mt(this.wheels.roadDescriptor) !== "bcharge") return;
    const e = m(Math.max(this.tuning.driftMaxGauge, 1));
    this.runtime.committedGauge = m(
      Math.min(e, m(this.runtime.committedGauge + m(1.6))),
    );
  }
  updateTachometerIncGauge(e) {
    const t = m(Math.max(m(this.tuning.driftMaxGauge), m(1)));
    this.runtime.tachometerIncGauge =
      m(this.tuning.chargeBoostBySpeed) !== 0 &&
      t !== m(1) &&
      (e || this.runtime.contactWorking) &&
      this.runtime.physicsState === 0 &&
      !this.runtime.driftGaugeWindow &&
      m(this.runtime.cachedDisplaySpeedKmh) >=
        m(this.tuning.autoChargeLowSpeed);
  }
  applyJumpSurfaceTuning() {
    !this.wheels.grounded ||
      Mt(this.wheels.roadDescriptor) !== "점프" ||
      ((this.runtime.liveForwardAccel = m(6e3)),
      (this.runtime.liveDragFactor = m(0.5)));
  }
  applyResetSurfaceRequest() {
    Mt(this.wheels.roadDescriptor) === "리셋" &&
      (this.runtime.railResetRequest = !0);
  }
  rebuildBodyState(e, t) {
    (Object.assign(e, this.runtime.stagedExternalForce),
      Object.assign(t, this.runtime.stagedExternalTorque),
      a1(this.runtime.stagedExternalForce),
      a1(this.runtime.stagedExternalTorque),
      a1(this.wheels.surfaceVelocity),
      (this.runtime.localForwardSpeed = V9(
        this.body.linearVelocity,
        this.body.forward,
      )),
      (this.runtime.localRightSpeed = V9(
        this.body.linearVelocity,
        this.body.right,
      )),
      (this.runtime.localUpSpeed = V9(this.body.linearVelocity, this.body.up)),
      (this.runtime.bodySpeed = d1(this.body.linearVelocity)));
  }
  scanSpecialRoad(e) {
    this.scanSpecialRoadPrefix(e, "MR", m(-2)) ||
      this.scanSpecialRoadPrefix(e, "HW", m(-10));
  }
  scanSpecialRoadPrefix(e, t, i) {
    const r = this.scratch.v0,
      s = this.scratch.v1,
      o = this.scratch.v2;
    ((r.x = this.body.right.x),
      (r.y = this.body.right.y),
      (r.z = this.body.right.z),
      (s.x = this.body.forward.x),
      (s.y = this.body.forward.y),
      (s.z = this.body.forward.z),
      (o.x = this.body.up.x),
      (o.y = this.body.up.y),
      (o.z = this.body.up.z));
    const a = this.scratch.v3;
    L2(a, o, x5);
    const c = this.scratch.v4;
    (L2(this.scratch.v11, s, this.collisionShape.rawHalfLength),
      L2(this.scratch.v11, this.scratch.v11, cd),
      wi(c, this.body.position, this.scratch.v11),
      c9(c, a));
    const l = this.scratch.v10;
    L2(l, a, m(-2));
    const u = e.rayQuery(c, l, !0);
    if (
      (u && (this.wheels.roadDescriptor = u.roadDescriptor),
      !(Mt(this.wheels.roadDescriptor)?.slice(0, 2) === t))
    )
      return (
        t === "MR"
          ? (this.runtime.mrContact = !1)
          : (this.runtime.hwContact = !1),
        (this.runtime.gravity = F2(0, VC.y, -0)),
        !1
      );
    ((this.runtime.contactWorking = !0),
      t === "MR"
        ? (this.runtime.mrContact = !0)
        : (this.runtime.hwContact = !0),
      (this.runtime.specialNormal = F2(0, 0, -0)));
    const d =
        this.runtime.cachedDisplaySpeedKmh <= 50
          ? 25
          : this.runtime.cachedDisplaySpeedKmh <= 100
            ? 18
            : this.runtime.cachedDisplaySpeedKmh <= 180
              ? 14
              : 10,
      f = this.scratch.v5;
    (L2(f, r, this.collisionShape.rawHalfWidth), L2(f, f, cd));
    const p = this.scratch.v6;
    (L2(p, s, this.collisionShape.rawHalfLength), L2(p, p, cd));
    const v = this.scratch.v7;
    wi(v, this.body.position, a);
    const w = this.scratch.v8;
    L2(w, a, i);
    const g = m(m(2) / m(d - 1));
    let y = 0;
    for (let b = 0; b < d; b += 1) {
      const A = m(g * m(b)),
        x = m(m(A * m(-1)) + m(1)),
        M = b % 2 === 0 ? m(A - m(1)) : x,
        E = this.scratch.v9;
      (L2(this.scratch.v10, p, x),
        wi(E, v, this.scratch.v10),
        L2(this.scratch.v11, f, M),
        c9(E, this.scratch.v11));
      const _ = e.rayQuery(E, w, !0);
      _ && (c9(this.runtime.specialNormal, _.normal), (y += 1));
    }
    return (
      y === 0 ||
        ((this.runtime.specialNormal.x = m(
          this.runtime.specialNormal.x / m(y),
        )),
        (this.runtime.specialNormal.y = m(this.runtime.specialNormal.y / m(y))),
        (this.runtime.specialNormal.z = m(this.runtime.specialNormal.z / m(y))),
        (this.body.up = O9(this.runtime.specialNormal)),
        (this.body.forward = Tn(r, this.runtime.specialNormal)),
        t === "HW" &&
          (this.body.right = si0(
            Tn(this.runtime.specialNormal, this.body.forward),
          )),
        (this.runtime.gravity = {
          x: m(m(this.runtime.specialNormal.x * ld) * m(6)),
          y: m(m(this.runtime.specialNormal.y * ld) * m(6)),
          z: m(m(this.runtime.specialNormal.z * ld) * m(6)),
        })),
      !0
    );
  }
  probeWheels(e, t) {
    const i = this.runtime.contactWorking,
      r = this.scratch.oldCompression;
    ((r[0] = this.wheels.compression[0]),
      (r[1] = this.wheels.compression[1]),
      (r[2] = this.wheels.compression[2]),
      (r[3] = this.wheels.compression[3]),
      (this.runtime.contactWorking = !1),
      (this.wheels.grounded = !1),
      this.wheels.hit.fill(!1),
      a1(this.wheels.averageNormal),
      (this.wheels.roadDescriptor = void 0),
      (this.wheels.railContactDescriptor = void 0),
      (this.wheels.auxiliaryDirection = O9(ad)),
      (this.wheels.obstacleRayHit = !1));
    let s = 0;
    const o =
        this.collisionShape.scaleX === 1 &&
        this.collisionShape.scaleY === 1 &&
        this.collisionShape.rawHeight === 1,
      a = m(
        o
          ? this.tuning.wheelPosition
          : m(this.tuning.wheelPosition) * m(this.collisionShape.scaleY),
      ),
      c = this.scratch.v0;
    (L2(this.scratch.v4, this.body.right, m(this.collisionShape.rawHalfWidth)),
      L2(c, this.scratch.v4, a));
    const l = this.scratch.v1;
    (L2(
      this.scratch.v4,
      this.body.forward,
      m(this.collisionShape.rawHalfLength),
    ),
      L2(l, this.scratch.v4, a));
    for (let u = 0; u < 4; u += 1) {
      const [h, d] = od[u],
        f = this.scratch.v2;
      (L2(this.scratch.v4, this.body.up, x5),
        wi(f, this.body.position, this.scratch.v4),
        L2(this.scratch.v4, c, h),
        c9(f, this.scratch.v4),
        L2(this.scratch.v4, l, d),
        c9(f, this.scratch.v4));
      const p = this.scratch.v3;
      L2(p, this.body.up, m(-2 * x5));
      const v = this.runtime.mrContact || this.runtime.hwContact,
        w = e.rayQuery(f, p, v ? !t : t);
      if (!w) {
        ((this.wheels.compression[u] = 0),
          (this.wheels.compressionDelta[u] = 0));
        const A = this.scratch.zeroNormals[u];
        ((A.x = 0), (A.y = 0), (A.z = 0), (this.wheels.normals[u] = A));
        continue;
      }
      ((this.wheels.hit[u] = !0),
        (this.wheels.grounded = !0),
        (this.runtime.contactWorking = !0),
        (this.wheels.obstacleRayHit = w.obstacleSource === !0),
        (s += 1),
        (this.wheels.normals[u] = O9(w.normal)),
        c9(this.wheels.averageNormal, w.normal),
        !this.wheels.railContactDescriptor &&
          w.roadDescriptor?.road &&
          Ri(w.roadDescriptor) &&
          (this.wheels.railContactDescriptor = w.roadDescriptor),
        this.wheels.roadDescriptor ||
          ((this.wheels.roadDescriptor = w.roadDescriptor),
          (this.wheels.auxiliaryDirection = O9(w.auxiliaryDirection))));
      const g = m(
          V9(w.point, this.body.up) -
            m(V9(this.body.position, this.body.up) - x5),
        ),
        y = this.visualScaleMode() === 1 ? m(g + m(0.001)) : g,
        b = wd(y, 0, m(2 * x5));
      ((this.wheels.compression[u] = b),
        (this.wheels.compressionDelta[u] = m(b - r[u])),
        u === 0 && c9(this.wheels.surfaceVelocity, w.surfaceVelocity));
    }
    (s > 0 &&
      ((this.wheels.averageNormal.x = m(this.wheels.averageNormal.x / m(s))),
      (this.wheels.averageNormal.y = m(this.wheels.averageNormal.y / m(s))),
      (this.wheels.averageNormal.z = m(this.wheels.averageNormal.z / m(s)))),
      (this.runtime.contactRisingEdge = this.wheels.grounded && !i),
      (this.runtime.landingMotionTrigger ||= this.runtime.contactRisingEdge),
      (this.runtime.shockWaveRequest ||= this.runtime.contactRisingEdge),
      s > 2 && (this.runtime.freeOrientationLatch = !1));
  }
  applySupplementalWheelRecovery(e) {
    if (!this.wheels.grounded) return;
    let t = 0;
    for (let o = 0; o < 4; o += 1) this.wheels.hit[o] && (t += 1);
    if (t === 0 || t === 4) return;
    const i = this.scratch.v0,
      r = this.scratch.v1,
      s = this.scratch.v2;
    ((s.x = 0), (s.y = m(-2)), (s.z = -0));
    for (let o = 0; o < 4; o += 1) {
      if (this.wheels.hit[o]) continue;
      const [a, c] = od[o];
      ((i.x = this.body.position.x),
        (i.y = this.body.position.y),
        (i.z = this.body.position.z),
        L2(r, this.body.right, this.collisionShape.rawHalfWidth),
        L2(r, r, a),
        L2(r, r, zC),
        c9(i, r),
        L2(r, this.body.forward, this.collisionShape.rawHalfLength),
        L2(r, r, c),
        L2(r, r, zC),
        c9(i, r),
        L2(r, this.body.up, x5),
        c9(i, r),
        (i.y = m(i.y + m(1))),
        e.rayQuery(i, s, !1) && (t += 1));
    }
    t === 4 &&
      (this.body.linearVelocity.y = m(this.body.linearVelocity.y + j40));
  }
  enterRailMode() {
    if (this.runtime.motionMode === 2 || this.runtime.motionMode === 3) return;
    ((this.runtime.motionMode = 1),
      (this.runtime.railCaptureDelay = m(0.009999999776482582)),
      (this.runtime.railCaptureTimeout = m(1.6180000305175781)));
    const e = m(this.runtime.bodySpeed * m(3.5999999046325684));
    if (e < 100) {
      const t = m(m(100) - e);
      this.runtime.railCaptureTimeout = m(
        this.runtime.railCaptureTimeout + m(m(t * t) / m(1e3)),
      );
    }
    ((this.runtime.railRelativeOrientation = ic(qC)),
      (this.runtime.railScalar0 = 0),
      (this.runtime.railScalar1 = 0),
      (this.runtime.railScalar2 = 0),
      (this.runtime.railBadGeometryTimer = 0));
  }
  requestMotionMode(e, t) {
    const i = this.runtime.motionMode;
    (e &&
      (i === 2 || i === 3) &&
      (this.runtime.stagedExternalForce = s9(this.body.up, m(6e5))),
      i !== 0 &&
        ((this.runtime.railReturnTimer = m(t === 5 ? 1 : 0.10000000149011612)),
        (this.runtime.motionMode = t)));
  }
  captureRail(e, t) {
    if (this.runtime.motionMode !== 1) return;
    let i;
    if (this.wheels.grounded)
      i = this.wheels.railContactDescriptor ?? this.wheels.roadDescriptor;
    else {
      const a = s9(this.body.up, x5);
      i = t.rayQuery(
        hd(this.body.position, a),
        s9(a, m(-2)),
        !0,
      )?.roadDescriptor;
    }
    const r = i ? Ri(i) : void 0;
    if (!r) {
      ((this.runtime.railCaptureTimeout = m(
        this.runtime.railCaptureTimeout - e,
      )),
        this.runtime.railCaptureTimeout < 0 && this.requestMotionMode(!1, 5));
      return;
    }
    if (
      ((this.runtime.railCaptureDelay = m(this.runtime.railCaptureDelay - e)),
      !(this.runtime.railCaptureDelay < 0))
    )
      return;
    const s = t.sampleRoute?.(this, 0, 0),
      o = t.railCaptureDistance?.();
    if (!s || o === void 0)
      throw new Error(
        "rail capture 缺少原版 route sampler 或 theme distance。",
      );
    if (
      s.sampled &&
      d1(Ze(this.body.position, s.point)) < o &&
      s.point.y < m(this.body.position.y + m(1))
    ) {
      if (!t.lookupRailConfig)
        throw new Error("rail capture 缺少 rail.bml lookup。");
      this.produceRailFrame(0, t) &&
        ((this.runtime.railConfig = { ...t.lookupRailConfig(r) }),
        (this.runtime.railEntryTimerA = m(
          m(this.tuning.driftTrigTime * this.runtime.bodySpeed) / m(20),
        )),
        (this.runtime.railEntryTimerB = m(this.tuning.driftTrigTime * m(0.5))),
        (this.runtime.motionMode = 2));
    }
  }
  produceRailFrame(e, t) {
    if (!t.refreshRouteProjection || !t.sampleRoute)
      throw new Error("full3D rail 缺少原版 route projection/sampler。");
    t.refreshRouteProjection(this, this.body.position);
    const i = t.sampleRoute(this, 1, 0);
    if (!i.sampled)
      throw new Error("full3D rail route sample 没有相邻 frame。");
    if (((this.runtime.railPoint = O9(i.point)), !i.surface.includes("rail")))
      return (this.requestMotionMode(!0, 6), !1);
    const r = Ze(i.point, this.body.position);
    if (d1(r) < m(0.30000001192092896) || V9(r, i.direction) < 0)
      return (
        (this.runtime.railBadGeometryTimer = m(
          this.runtime.railBadGeometryTimer + e,
        )),
        this.runtime.railBadGeometryTimer > m(0.5) &&
          (this.runtime.railResetRequest = !0),
        !1
      );
    this.runtime.railBadGeometryTimer = 0;
    const s = s9(i.direction, m(-1)),
      o = Tn(s, i.up),
      a = Tn(o, s);
    return ((this.runtime.railFrame = ML(o, i.direction, a)), !0);
  }
  applyFull3DRail(e, t, i, r, s) {
    if (!this.produceRailFrame(e, i)) {
      if (!this.runtime.railFrame)
        throw new Error("full3D rail 首次 frame 无效，拒绝使用未初始化 BF8。");
      return;
    }
    const o = this.runtime.railConfig;
    if (!o) throw new Error("full3D rail 尚未安装 rail.bml config。");
    const a = hd(
        this.runtime.railPoint,
        s9(this.body.up, this.runtime.railScalar0),
      ),
      c = Ze(a, this.body.position),
      l = V9(c, c) > 0 ? ri0(c) : O9(this.body.forward),
      u = d1(this.body.linearVelocity),
      h =
        u < o.minVelocity
          ? o.minVelocity
          : u > o.maxVelocity
            ? o.maxVelocity
            : u;
    if (
      ((this.body.linearVelocity = s9(l, h)),
      this.runtime.motionMode === 3 &&
        !this.runtime.raceMotionLocked &&
        !this.runtime.pressProtected1C0)
    ) {
      if (t.forward > 0) {
        let p;
        if (this.runtime.physicsState >= 1 && this.runtime.physicsState <= 11) {
          const w =
            this.tuning.useTransformBooster &&
            [2, 4, 5, 6].includes(this.runtime.animationSlot);
          p = m(
            w ? this.tuning.transAccelFactor : this.tuning.boostAccelFactor,
          );
        }
        const v = s9(l, t.forward);
        (t1(v, o.accelFactor),
          t1(v, this.runtime.liveForwardAccel),
          p !== void 0 && t1(v, p),
          c9(r, v));
      } else if (t.reverse !== 0) {
        const p = s9(l, o.accelFactor);
        (t1(p, this.tuning.gripBrake), bt(r, p));
      }
    }
    if (m(this.runtime.railScalar0 + this.runtime.railScalar1) < 0)
      ((this.runtime.railScalar0 = 0), (this.runtime.railScalar1 = 0));
    else if (this.runtime.railScalar2 < 0) {
      const p = m(
        m(this.runtime.railScalar0 * this.runtime.railScalar0) *
          m(-9999999747378752e-21),
      );
      ((this.runtime.railScalar1 = m(this.runtime.railScalar1 + p)),
        (this.runtime.railScalar0 = m(
          this.runtime.railScalar0 + this.runtime.railScalar1,
        )));
    } else this.runtime.railScalar2 = m(this.runtime.railScalar2 - e);
    const d = m(m(NC * m(this.tuning.maxSteerDeg)) / m(180));
    this.runtime.motionMode === 2
      ? (this.runtime.driftGaugeWindow ||
          ((this.runtime.driftGaugeWindow = !0),
          (this.runtime.driftGaugeElapsed = 0),
          (this.runtime.pendingGauge = 0)),
        (s.y = m(s.y + m(m(t.steer * d) * m(600)))),
        (this.runtime.railEntryTimerA = m(this.runtime.railEntryTimerA - e)),
        m(this.runtime.localForwardSpeed * m(0.2)) >
        Math.abs(this.runtime.localRightSpeed)
          ? ((this.runtime.railEntryTimerB = m(
              this.runtime.railEntryTimerB - e,
            )),
            this.runtime.railEntryTimerA < 0 &&
              this.runtime.railEntryTimerB < 0 &&
              ((this.runtime.motionMode = 3),
              (this.runtime.railEntryMarker = m(0.5)),
              this.commitDriftGauge()))
          : ((s.y = m(s.y + m(this.runtime.localRightSpeed * m(1.6)))),
            (s.x = m(
              s.x +
                m(
                  this.runtime.localUpSpeed *
                    (this.runtime.localForwardSpeed > 0 ? m(-2) : m(2)),
                ),
            )),
            bt(s, s9(this.body.angularVelocity, m(20)))))
      : this.runtime.motionMode === 3 &&
        ((s.z = m(s.z - m(m(t.steer * d) * m(200)))),
        bt(s, s9(this.body.angularVelocity, m(30))),
        (this.runtime.railRelativeOrientation = ui0(
          this.runtime.railRelativeOrientation,
          Math.min(m(e * m(3)), m(1)),
        )));
    const f = s9(this.runtime.gravity, this.tuning.mass);
    (t1(f, o.gravityFactor), c9(r, f));
  }
  returnToStandard(e, t) {
    if (this.runtime.motionMode !== 5 && this.runtime.motionMode !== 6) return;
    let i;
    if (this.wheels.grounded) i = this.wheels.roadDescriptor;
    else {
      const r = s9(this.body.up, x5);
      i = t.rayQuery(
        hd(this.body.position, r),
        s9(r, m(-2)),
        !1,
      )?.roadDescriptor;
    }
    !i ||
      Ri(i) ||
      ((this.runtime.railReturnTimer = m(this.runtime.railReturnTimer - e)),
      this.runtime.railReturnTimer < 0 &&
        (this.runtime.motionMode === 5 &&
          (!t.associateRoute || !t.associateRoute(this, this.body.position)) &&
          (this.runtime.railResetRequest = !0),
        (this.runtime.motionMode = 0)));
  }
  integrateFull3D(e) {
    KC(this.body.position, this.body.linearVelocity, e);
    const t = this.runtime.railFrame;
    if (!t) throw new Error("full3D integration 缺少有效 BF8 rail frame。");
    const i = xL(this.body.angularVelocity);
    if (this.runtime.motionMode === 3)
      ((this.runtime.railRelativeOrientation = Gg(
        this.runtime.railRelativeOrientation,
        i,
        e,
      )),
        hl(this.body, QC(t, this.runtime.railRelativeOrientation)));
    else {
      const r = Gg(bL(this.body), i, e);
      (hl(this.body, r),
        (this.runtime.railRelativeOrientation = QC(ci0(t), r)));
    }
  }
  applySuspension(e, t, i) {
    const r = this.runtime.suspensionSpring,
      s = this.runtime.suspensionPositiveDamping,
      o = this.runtime.suspensionNegativeDamping;
    if (r === void 0 || s === void 0 || o === void 0)
      throw new Error(
        "P3528 suspension 系数 producer 尚未由冻结运行时证据闭合。",
      );
    const a = this.scratch.v0,
      c = this.scratch.v1,
      l = this.scratch.v2;
    ((a.x = t.x),
      (a.y = m(-t.z)),
      (a.z = t.y),
      (c.x = i.x),
      (c.y = m(-i.z)),
      (c.z = i.y),
      (l.x = this.body.up.x),
      (l.y = m(-this.body.up.z)),
      (l.z = this.body.up.y));
    const u = this.scratch.v3,
      h = this.scratch.v4,
      d = this.scratch.v5,
      f = this.scratch.v6,
      p = this.scratch.v7;
    for (let w = 0; w < 4; w += 1) {
      let g = m(0);
      if (this.wheels.hit[w]) {
        const x = this.wheels.compressionDelta[w],
          M = x > 0 ? s : o;
        g = m(m(r * this.wheels.compression[w]) + m(m(x / e) * M));
      }
      let y = m(0);
      if (g > 0) {
        const x = this.wheels.normals[w];
        ((u.x = x.x), (u.y = m(-x.z)), (u.z = x.y), (y = m(ii0(u, l) * g)));
      }
      (L2(h, l, y), c9(a, h));
      const [b, A] = od[w];
      ((d.x = m(this.collisionShape.rawHalfWidth * b)),
        (d.y = m(m(-this.collisionShape.rawHalfLength) * A)),
        (d.z = m(0)),
        (f.x = m(0)),
        (f.y = m(0)),
        (f.z = y),
        XC(p, d, f),
        t1(p, m(0.10000000149011612)),
        c9(c, p));
    }
    const v = this.runtime.gravity;
    ((f.x = v.x),
      (f.y = m(-v.z)),
      (f.z = v.y),
      L2(p, f, m(this.tuning.mass)),
      c9(a, p),
      (t.x = a.x),
      (t.y = a.z),
      (t.z = m(-a.y)),
      (i.x = c.x),
      (i.y = c.z),
      (i.z = m(-c.y)));
  }
  applyAirState(e, t) {
    const i = m(this.tuning.mass);
    for (const o of ["x", "y", "z"]) {
      const a = m(this.runtime.gravity[o] * i);
      e[o] = m(e[o] + m(a / this.runtime.gravityDivisor));
    }
    if (
      (L2(this.scratch.v0, this.body.angularVelocity, m(30)),
      bt(t, this.scratch.v0),
      !this.runtime.freeOrientationLatch && this.runtime.motionMode !== 6)
    )
      return;
    const r = m(this.body.up.y);
    if (r < m(0.5)) {
      const o = m(m(m(1) - r) * (this.body.right.y > 0 ? m(90) : m(-90)));
      t.z = m(t.z - o);
    }
    const s = m(this.body.forward.y);
    s > m(0.5)
      ? (t.x = m(t.x + m(m(s + m(1)) * m(90))))
      : s < m(-0.5) && (t.x = m(t.x - m(m(m(1) - s) * m(90))));
  }
  applyLongitudinal(e, t, i) {
    const r = this.runtime.localForwardSpeed,
      s = this.runtime.localRightSpeed,
      o = this.scratch.v0;
    this.runtime.hwContact && !this.wheels.grounded
      ? L2(o, this.runtime.specialNormal, m(-10))
      : fd(o, this.body.right, this.wheels.averageNormal);
    const a = this.runtime.raceMotionLocked || this.runtime.pressProtected1C0;
    if (t.forward > 0 && !a) {
      let h = m(
        m(this.runtime.liveForwardAccel + (this.giant?.forceBonus ?? 0)) *
          m(this.runtime.driveScale),
      );
      this.runtime.physicsState === 1 &&
        (h = m(this.tuning.startForwardAccelSpeed));
      let d = m(1);
      if (this.runtime.physicsState >= 1 && this.runtime.physicsState <= 11) {
        const p =
          this.runtime.physicsState !== 2 &&
          [2, 4, 5, 6].includes(this.runtime.animationSlot);
        d =
          this.tuning.useTransformBooster && p
            ? m(this.tuning.transAccelFactor)
            : m(this.tuning.boostAccelFactor);
      }
      if (
        (this.runtime.physicsState === 2 &&
          this.speedRaceMode?.kind !== "grip" &&
          (d = m(d * m(this.tuning.driftBoostMulAccelFactor))),
        (d = m(d * m(this.runtime.draftAccelerationScale))),
        this.runtime.physicsState === 10 &&
          (d = m(d * m(this.tuning.dualMulAccelFactor))),
        this.runtime.instantAccelerationActive)
      ) {
        let p = m(this.tuning.instAccelFactor);
        (m(this.tuning.wallCollGaugeMinVelBound) >
          this.runtime.cachedDisplaySpeedKmh && (p = m(p * m(2))),
          (d = m(d * p)));
      }
      this.runtime.oneSubstepDrift && (h = m(this.tuning.driftEscapeForce));
      const f = this.scratch.v1;
      if ((L2(f, o, h), t1(f, t.forward), t1(f, d), c9(i, f), r < 0)) {
        const p =
            this.runtime.activeDrift || this.runtime.oneSubstepDrift
              ? this.runtime.bodySpeed
              : Math.min(m(5), this.runtime.bodySpeed),
          v = this.scratch.v1;
        (L2(v, this.body.forward, p),
          t1(v, this.runtime.massGravityForce),
          c9(i, v));
      }
      this.runtime.reverseAccumulator = 0;
      return;
    }
    let c = a;
    if (t.reverse > 0 || a) {
      if (((c = !0), r < 0.5)) {
        if (
          ((this.runtime.reverseAccumulator = m(
            this.runtime.reverseAccumulator + e,
          )),
          r < -0.5 && (this.runtime.reverseAccumulator = 1),
          this.runtime.reverseAccumulator > 0.2 && !a)
        ) {
          const d = this.scratch.v1;
          (L2(
            d,
            o,
            m(
              -m(
                m(this.tuning.backwardAccel + (this.giant?.forceBonus ?? 0)) *
                  m(this.runtime.driveScale),
              ),
            ),
          ),
            t1(d, t.reverse),
            c9(i, d),
            (c = !1));
        }
        const h = this.runtime.reverseAccumulator > 0.2;
        c &&
          ((!h && Math.abs(s) < 0.2) || (h && a && r >= -0.5)) &&
          (a1(this.body.linearVelocity), (c = !1));
      }
    } else
      r >= -0.5 &&
        r <= 0.5 &&
        (this.runtime.reverseAccumulator = m(
          this.runtime.reverseAccumulator + e,
        ));
    if (!c) return;
    const l = this.scratch.v2;
    (jC(l, this.body.linearVelocity),
      L2(this.scratch.v3, this.body.up, V9(l, this.body.up)),
      bt(l, this.scratch.v3));
    const u =
      V9(l, o) > m(0.800000011920929)
        ? m(this.tuning.gripBrake)
        : m(this.tuning.slipBrake);
    (L2(this.scratch.v3, l, u), bt(i, this.scratch.v3));
  }
  applySteeringAndTires(e, t, i, r) {
    if (this.runtime.driveSteeringSuppressed) return;
    const s = this.tuning.motorcycleType,
      o = this.runtime.massGravityForce,
      a = this.runtime.localForwardSpeed,
      c = this.runtime.localRightSpeed,
      l = m(Math.sqrt(m(m(a * a) + m(c * c)))),
      u = a > 0 ? m(1) : m(-1),
      h = m(t.rawSteer),
      d = m(h * (t.steeringInverted ? m(-1) : m(1))),
      f = m(m(NC * m(this.tuning.maxSteerDeg)) / m(180));
    let p = m(d * f);
    const v = m(
      Math.abs(
        m(
          m(
            m(a / m(this.tuning.steerConstraint)) *
              m(this.runtime.steeringExponentialScale),
          ) * m(this.runtime.catchupSteeringScale),
        ),
      ),
    );
    ((p = m(m(Math.exp(m(-v))) * p)),
      t.forward !== 0 &&
      m(this.runtime.steeringEnvelope * p) > 0 &&
      Math.abs(this.runtime.steeringEnvelope) < Math.abs(p)
        ? (p = this.runtime.steeringEnvelope)
        : (this.runtime.steeringEnvelope = p),
      (this.runtime.steeringAngle = p));
    let w = m(0),
      g = m(0),
      y = m(0),
      b = !1,
      A =
        Mt(this.wheels.roadDescriptor) === "dirt"
          ? 1
          : Mt(this.wheels.roadDescriptor) === "slip"
            ? 2
            : 0;
    const x = this.runtime.oneSubstepDrift,
      M = this.runtime.activeDrift || x;
    if (((this.runtime.oneSubstepDrift = !1), l > m(5))) {
      const G = m(m(this.body.angularVelocity.y * mi) / l),
        I = m(m(this.body.angularVelocity.y * mi) / l);
      let L = m(c / l);
      if (s) {
        const k = vi(
          m(Math.abs(this.runtime.tireTransient) * m(2)),
          m(0.9900000095367432),
        );
        L = m(L / m(m(m(0.9000000357627869) * k) + m(1.1399999856948853)));
      }
      if (A > 0 && this.runtime.forwardOneShot) {
        const k = tc[A * 2];
        Math.abs(L) > m(k[7]) &&
          !(this.runtime.driftLifecycleB44 > 0) &&
          this.speedRaceMode?.kind !== "grip" &&
          ((A = 0),
          (this.runtime.driftLifecycleB50 = 0),
          (this.runtime.driftLifecycleB44 = m(0.5)),
          (this.runtime.physicsState = 2),
          (this.runtime.stateRemainingMs = 0));
      }
      if (
        (!this.runtime.activeDrift &&
          !this.runtime.triggerPhase &&
          Math.abs(c) > m(Math.abs(a) * m(1.2)) &&
          l > m(15) &&
          (this.runtime.oneSubstepDrift = !0),
        this.runtime.triggerPhase)
      ) {
        ((this.runtime.tireEnvelope = 0),
          (this.runtime.tireEnvelopeRate = 0),
          (w = 0),
          (g = m(
            m(m(-o * m(this.tuning.frontGripFactor)) * m(d * f)) *
              m(this.tuning.driftTrigFactor),
          )),
          s && (g = m(g * m(1.0800000429153442))));
        const k = this.runtime.triggerTimer > 0;
        (k
          ? ((this.runtime.triggerTimer = m(this.runtime.triggerTimer - e)),
            this.runtime.triggerTimer > 0 ||
              ((this.runtime.triggerTimer = 0),
              (this.runtime.triggerPhase = !1),
              this.runtime.driftGaugeWindow ||
                ((this.runtime.driftGaugeWindow = !0),
                (this.runtime.driftGaugeElapsed = 0),
                (this.runtime.pendingGauge = 0))))
          : ((this.runtime.triggerTimer = m(this.tuning.driftTrigTime)),
            (this.runtime.driftDecay = m(this.runtime.triggerTimer * m(2))),
            (this.runtime.triggerRawSteer = h)),
          s &&
            k &&
            Math.abs(this.runtime.tireTransient) <
              m(m(6) * m(0.10999999940395355)) &&
            (this.runtime.tireTransient = m(
              this.runtime.tireTransient + m(ud * this.runtime.triggerRawSteer),
            )));
      } else if (
        this.runtime.activeDrift ||
        this.runtime.driftDecay > 0 ||
        this.runtime.oneSubstepDrift ||
        this.runtime.roadTransient > 0
      ) {
        if (
          ((this.runtime.motorcycleDriftTimestampMs =
            this.runtime.currentUpdateMs >>> 0),
          A === 1)
        ) {
          const D = tc[3],
            V = m(l / m(D[0])),
            K = vi(m(V * V), m(1));
          if (this.runtime.activeDrift) {
            ((this.runtime.tireEnvelope = m(
              m(m(m(m(1) - this.runtime.tireEnvelope) * m(1e-6)) * K) +
                this.runtime.tireEnvelope,
            )),
              (this.runtime.tireEnvelopeRate = m(
                m(m(m(1) - this.runtime.tireEnvelopeRate) * m(0.005)) +
                  this.runtime.tireEnvelopeRate,
              )),
              t1(i, m(m(1) - this.runtime.tireEnvelopeRate)),
              this.runtime.tireEnvelope > m(1) &&
                (this.runtime.tireEnvelope = m(1)));
            const P = m(m(d * f) * m(D[9])),
              q = m(m(this.tuning.frontGripFactor) + m(D[1])),
              e0 = m(
                m(this.tuning.rearGripFactor) +
                  m(D[2]) -
                  this.runtime.tireEnvelopeRate,
              );
            ((w = m(m(o * q) * m(m(m(P * u) - L) - G))),
              (g = m(m(o * e0) * m(m(-L) + I))),
              (w = m(
                m(m(this.tuning.driftSlipFactor) * this.runtime.tireEnvelope) *
                  w,
              )),
              (g = m(
                m(m(this.tuning.driftSlipFactor) * this.runtime.tireEnvelope) *
                  g,
              )));
          } else {
            ((this.runtime.tireEnvelope = m(
              m(m(1) - this.runtime.tireEnvelope) * m(0.001) +
                this.runtime.tireEnvelope,
            )),
              (this.runtime.tireEnvelopeRate = 0));
            const P = m(p * m(D[10]));
            ((w = m(
              m(o * m(m(this.tuning.frontGripFactor) + m(D[4]))) *
                m(m(m(P * u) - L) - G),
            )),
              (g = m(
                m(o * m(m(this.tuning.rearGripFactor) + m(D[5]))) *
                  m(m(-L) + I),
              )),
              (w = m(m(m(this.tuning.driftSlipFactor) * m(D[6])) * w)),
              (g = m(m(m(this.tuning.driftSlipFactor) * m(D[6])) * g)));
          }
          this.runtime.roadTransient = ls(
            m(this.runtime.roadTransient - e),
            m(0),
          );
        } else if (this.runtime.activeDrift) {
          const D = tc[A * 2 + 1];
          ((w = m(
            m(o * m(m(this.tuning.frontGripFactor) + m(D[1]))) *
              m(m(m(m(d * f) * u) - L) - G),
          )),
            (g = m(
              m(o * m(m(this.tuning.rearGripFactor) + m(D[2]))) * m(m(-L) + I),
            )),
            (w = m(m(m(this.tuning.driftSlipFactor) * m(D[3])) * w)),
            (g = m(m(m(this.tuning.driftSlipFactor) * m(D[3])) * g)));
        } else
          ((w = m(
            m(o * m(this.tuning.frontGripFactor)) * m(m(m(p * u) - L) - G),
          )),
            (g = m(m(o * m(this.tuning.rearGripFactor)) * m(m(-L) + I))),
            (w = m(m(this.tuning.driftSlipFactor) * w)),
            (g = m(m(this.tuning.driftSlipFactor) * g)));
        const k = m(w + g);
        ((y = m(m(-k) * m(this.tuning.driftLeanFactor))),
          this.runtime.bodySpeed > m(10) || (y = m(y * m(0.5))),
          s &&
            (Math.abs(this.runtime.tireTransient) <
              m(m(6) * m(0.10999999940395355)) &&
              (this.runtime.tireTransient = m(
                this.runtime.tireTransient +
                  m(ud * this.runtime.triggerRawSteer),
              )),
            (y = m(y * m(-0.3499999940395355))),
            (this.runtime.motorcycleTransientTorque = m(Math.abs(y)))),
          (this.runtime.driftDecay = ls(m(this.runtime.driftDecay - e), m(0))));
      } else {
        if (
          ((b = !0),
          this.runtime.tireTransient > 0
            ? (this.runtime.tireTransient = ls(
                m(0),
                m(this.runtime.tireTransient - m(0.002)),
              ))
            : this.runtime.tireTransient < 0 &&
              (this.runtime.tireTransient = vi(
                m(0),
                m(this.runtime.tireTransient + m(0.002)),
              )),
          A > 0)
        ) {
          const k = tc[A * 2],
            D = m(l / m(k[0])),
            V = vi(m(m(m(OC[0] * D) * D) + OC[1]), m(1)),
            K = m(A === 2 ? m(d * f) * V : m(m(1) + V) * p);
          ((w = m(
            m(o * m(this.tuning.frontGripFactor)) * m(m(m(K * u) - L) - G),
          )),
            (g = m(m(o * m(this.tuning.rearGripFactor)) * m(m(-L) + I))),
            (w = m(m(m(this.tuning.driftSlipFactor) * m(k[3])) * w)),
            (g = m(m(m(this.tuning.driftSlipFactor) * m(k[3])) * g)));
        } else
          ((w = m(
            m(o * m(this.tuning.frontGripFactor)) * m(m(m(p * u) - L) - G),
          )),
            (g = m(m(o * m(this.tuning.rearGripFactor)) * m(m(-L) + I))));
        ((y = m(m(-m(w + g)) * m(this.tuning.steerLeanFactor))),
          s &&
            ((y =
              ((this.runtime.currentUpdateMs >>> 0) -
                this.runtime.motorcycleDriftTimestampMs) >>>
                0 >
              700
                ? m(y * m(-4))
                : m(0)),
            (this.runtime.motorcycleTransientTorque = 0)),
          this.runtime.driftGaugeWindow && this.commitDriftGauge());
      }
    } else {
      (this.runtime.tireTransient > 0
        ? (this.runtime.tireTransient = ls(
            m(0),
            m(this.runtime.tireTransient - m(0.004)),
          ))
        : this.runtime.tireTransient < 0 &&
          (this.runtime.tireTransient = vi(
            m(0),
            m(this.runtime.tireTransient + m(0.004)),
          )),
        (this.runtime.activeDrift = !1),
        (this.runtime.triggerTimer = 0),
        (this.runtime.driftDecay = 0),
        (this.runtime.triggerPhase = !1),
        (this.runtime.driftTailLatch = !1),
        (this.runtime.motorcycleTransientTorque = 0),
        this.runtime.driftGaugeWindow && this.commitDriftGauge());
      const G = m(m(this.body.angularVelocity.y * mi) / m(5)),
        I = m(m(this.body.angularVelocity.y * mi) / m(5)),
        L = m(c / m(5)),
        k = l < m(0.5) ? 0 : m(p * u);
      ((w = m(m(o * m(this.tuning.frontGripFactor)) * m(m(k - L) - G))),
        (g = m(m(o * m(this.tuning.rearGripFactor)) * m(m(-L) + I))));
    }
    const E = m(w + g),
      _ = m(m(mi * w) - m(mi * g)),
      C = m(b ? m(-Math.abs(E)) * m(this.tuning.cornerDrawFactor) : 0),
      S = this.scratch.v0;
    ((S.x = m(
      m(m(this.body.right.x * E) + m(m(-this.body.forward.x) * C)) +
        m(this.body.up.x * m(0)),
    )),
      (S.y = m(
        m(m(this.body.right.y * E) + m(m(-this.body.forward.y) * C)) +
          m(this.body.up.y * m(0)),
      )),
      (S.z = m(
        m(m(this.body.right.z * E) + m(m(-this.body.forward.z) * C)) +
          m(this.body.up.z * m(0)),
      )),
      c9(i, S),
      (r.y = m(r.y + _)),
      (r.z = m(r.z - y)),
      s &&
        (this.state.motorcyclePresentation = m(
          m(this.runtime.tireTransient * m(-0.5)) * m(6),
        )),
      this.runtime.driftTailLatch &&
        M &&
        !this.runtime.activeDrift &&
        !this.runtime.oneSubstepDrift &&
        this.runtime.driftLifecycleB50 === 0 &&
        ((this.runtime.driftTailLatch = a > 0),
        (this.runtime.driftLifecycleB50 = m(0.5))));
  }
  applyRoadConsumers(e, t) {
    const i = Mt(this.wheels.roadDescriptor) ?? "";
    if (i.slice(0, 2) === "BH" && i[4] === ".") {
      const s = _n(i.slice(3, 6)),
        o = this.scratch.v0;
      ((o.x = _n(i.slice(7, 10))),
        (o.y = _n(i.slice(15, 18))),
        (o.z = m(-_n(i.slice(11, 14)))));
      const a = this.scratch.v1;
      dd(a, o, this.body.position);
      const c = d1(a),
        l = this.scratch.v2;
      c !== 0
        ? ((l.x = m(a.x / c)), (l.y = m(a.y / c)), (l.z = m(a.z / c)))
        : ((l.x = a.x), (l.y = a.y), (l.z = a.z));
      const u = this.scratch.v3;
      ((u.x = m(l.x / c)), (u.y = m(l.y / c)), (u.z = m(l.z / c)));
      const h = this.scratch.v4;
      (L2(h, u, m(s * m(25))), (h.y = 0), c9(this.body.linearVelocity, h));
    }
    if (i.slice(0, 2) === "MZ" && i[4] === ".") {
      const s = _n(i.slice(3, 6)),
        o = { x: _n(i.slice(7, 10)), y: 0, z: m(-_n(i.slice(11, 14))) },
        a = Ze(o, this.body.position);
      ((a.y = 0),
        (this.body.linearVelocity = s9(a, s)),
        this.setRoadActionState(16, 3e3));
    }
    if (i.length === 5 && i.slice(0, 2) === "BS" && i[3] === ".") {
      const s = m(m(i.charCodeAt(2) - 48) * m(1e4)),
        o = m(m(i.charCodeAt(4) - 48) * m(1e3)),
        a = m(m(s + o) * m(3)),
        c = d1(this.body.linearVelocity),
        l = this.scratch.v0;
      c > 0
        ? jC(l, this.body.linearVelocity)
        : ((l.x = 0), (l.y = 0), (l.z = 0));
      const u = this.scratch.v1;
      L2(u, this.wheels.auxiliaryDirection, a);
      const h = this.scratch.v2;
      (L2(h, l, a), t1(h, m(0.699999988079071)));
      const d = this.scratch.v3;
      (dd(d, u, h),
        (t.x = d.x),
        (t.y = d.y),
        (t.z = d.z),
        this.setRoadActionState(13, 1e3));
    }
    const r = m(e);
    if (
      ((this.runtime.roadCooldown =
        r <= this.runtime.roadCooldown ? m(this.runtime.roadCooldown - r) : 0),
      this.runtime.roadCooldown === 0)
    ) {
      if (i.length >= 5 && i.slice(0, 2) === "JM") {
        let s, o;
        (i.length === 9 && i[3] === "." && i[5] === "/" && i[7] === "."
          ? ((s = pd(i, 2, 4)), (o = pd(i, 6, 8)))
          : i[3] === "." && ((s = pd(i, 2, 4)), (o = s)),
          s !== void 0 &&
            o !== void 0 &&
            (L2(this.scratch.v0, ad, s),
            L2(this.scratch.v1, this.wheels.auxiliaryDirection, o),
            c9(this.scratch.v0, this.scratch.v1),
            c9(this.body.linearVelocity, this.scratch.v0),
            (this.runtime.roadCooldown = UC),
            this.setRoadActionState(14, 1e3),
            this.requestMotionMode(!1, 6)));
        return;
      }
      if (i.slice(0, 2) === "DJ") {
        const s = i.slice(2).split("/");
        if (s.length < 3) return;
        const o = s.slice(0, 3).map(_n);
        ((this.body.linearVelocity = { x: o[0], y: o[2], z: m(-o[1]) }),
          (this.runtime.roadCooldown = UC),
          this.setRoadActionState(15, 1e3),
          this.requestMotionMode(!1, 6));
      }
    }
  }
  applySlipAlignment() {
    if (
      this.runtime.forwardOneShot &&
      Mt(this.wheels.roadDescriptor) === "slip" &&
      this.runtime.driftLifecycleB44 > 0
    ) {
      const e = this.scratch.v0;
      (fd(e, this.body.right, this.wheels.averageNormal),
        t1(e, d1(this.body.linearVelocity)),
        t1(e, m(0.5)),
        t1(this.body.linearVelocity, m(0.5)),
        c9(this.body.linearVelocity, e));
    }
    this.runtime.forwardOneShot = !1;
  }
  integrateStandardOrientation(e) {
    (KC(this.body.position, this.body.linearVelocity, e),
      this.visualScaleMode() === 1 &&
        ((this.body.angularVelocity.x = 0), (this.body.angularVelocity.z = -0)),
      ti0(
        this.body,
        e,
        this.runtime.freeOrientationLatch || this.runtime.motionMode === 6,
      ));
  }
  setRoadActionState(e, t) {
    (this.runtime.physicsState >= 13 && this.runtime.physicsState <= 16) ||
      ((this.runtime.physicsState = e),
      (this.runtime.stateRemainingMs = t),
      (this.state.boostTime = 0));
  }
  applyDrag(e, t, i) {
    const r = m(this.tuning.airFriction),
      s = this.scratch.v0,
      o = this.scratch.v1,
      a = this.scratch.v2;
    if (
      (a1(s),
      a1(o),
      L2(a, this.body.linearVelocity, r),
      bt(s, a),
      L2(a, this.body.angularVelocity, r),
      bt(o, a),
      i || this.wheels.grounded)
    ) {
      const c = Mt(this.wheels.roadDescriptor) ?? "",
        l =
          c.length === 5 && c.slice(0, 2) === "DF" && c[3] === "."
            ? m(m(c.charCodeAt(2) - 48) + m(m(c.charCodeAt(4) - 48) * m(0.1)))
            : m(1);
      (L2(a, this.body.linearVelocity, d1(this.body.linearVelocity)),
        t1(a, m(this.runtime.liveDragFactor)),
        t1(a, m(this.runtime.dragScale)),
        t1(a, m(this.runtime.catchupDragScale)),
        t1(a, l),
        bt(s, a));
    }
    (c9(e, s), c9(t, o));
  }
  integrateVelocity(e, t, i, r) {
    (c9(t, r),
      [t.x, t.y, t.z].every(Number.isFinite) || a1(this.body.linearVelocity));
    const s = m(this.tuning.mass);
    ((this.body.linearVelocity.x = m(
      this.body.linearVelocity.x + m(m(t.x / s) * e),
    )),
      (this.body.linearVelocity.y = m(
        this.body.linearVelocity.y + m(m(t.y / s) * e),
      )),
      (this.body.linearVelocity.z = m(
        this.body.linearVelocity.z + m(m(t.z / s) * e),
      )));
    const o = m(m(12) / s),
      a = this.scratch.v0,
      c = this.scratch.v1,
      l = this.scratch.v2;
    (YC(a, this.body.angularVelocity, o),
      XC(c, this.body.angularVelocity, a),
      dd(l, i, c),
      YC(l, l, o),
      t1(l, e),
      c9(this.body.angularVelocity, l));
  }
  accumulateDriftGauge(e, t) {
    if (
      this.speedRaceMode?.kind === "grip" ||
      (!this.wheels.grounded && !t) ||
      !this.runtime.driftGaugeWindow ||
      this.runtime.localForwardSpeed < 0
    )
      return;
    const i = this.runtime.localRightSpeed;
    if (this.tuning.driftMaxGauge === 1) {
      this.runtime.pendingGauge = 1;
      return;
    }
    let r = m(m(i * i) * e);
    (t && (r = m(r * m(2))),
      (this.runtime.driftGaugeElapsed = m(this.runtime.driftGaugeElapsed + e)));
    let s;
    (this.runtime.driftGaugeElapsed < 0.2
      ? (s = m(3 * r))
      : this.runtime.driftGaugeElapsed < 0.5
        ? (s = m(1.5 * r))
        : (s = m(r / m(2 * this.runtime.driftGaugeElapsed))),
      this.runtime.chargerEnabled &&
        this.runtime.chargerActive &&
        (s = m(s * this.tuning.driftGaugeFactor)),
      (this.runtime.pendingGauge = m(this.runtime.pendingGauge + s)));
  }
  accumulateTeamGauge(e) {
    !this.teamBooster || e <= 0 || (this.runtime.teamGaugeCharge = e);
  }
  accumulateSpeedGauge(e, t) {
    if (!this.runtime.tachometerIncGauge) return;
    this.runtime.driftGaugeElapsed = m(this.runtime.driftGaugeElapsed + e);
    let i = m(this.tuning.chargeBoostBySpeed);
    this.runtime.chargerEnabled &&
      this.runtime.chargerActive &&
      (i = m(i + m(this.tuning.chargeBoostBySpeedAdded)));
    let r = m(e * i);
    t && (r = m(r * m(2)));
    const s = m(this.runtime.committedGauge + r),
      o = m(Math.max(m(this.tuning.driftMaxGauge), m(1)));
    this.runtime.committedGauge = s >= o ? o : s;
  }
  commitDriftGauge() {
    const e = m(this.runtime.committedGauge + this.runtime.pendingGauge);
    ((this.runtime.committedGauge = vi(m(this.tuning.driftMaxGauge), e)),
      (this.runtime.driftGaugeWindow = !1),
      (this.runtime.driftGaugeElapsed = 0),
      this.accumulateTeamGauge(this.runtime.pendingGauge),
      (this.runtime.lastCommittedPending = this.runtime.pendingGauge),
      (this.runtime.pendingGauge = 0));
  }
  consumeMultiplayerTeamCharge() {
    if (!this.externalTeamGauge) return 0;
    const e = this.runtime.teamGaugeCharge;
    return ((this.runtime.teamGaugeCharge = 0), e);
  }
  enqueueMultiplayerTeamTarget(e) {
    !this.externalTeamGauge ||
      !Number.isFinite(e) ||
      e < 0 ||
      e > 1 ||
      this.runtime.teamGaugeQueue.push(Math.fround(e));
  }
  updateTeamGauge(e) {
    if (
      !this.teamBooster ||
      (this.teamBoosterDirect &&
        (this.convertTeamBoosterSlots(e, !1),
        this.speedRaceMode?.kind !== "grip"))
    )
      return;
    this.speedRaceMode?.kind === "grip" &&
      !this.teamBoosterDirect &&
      this.convertTeamBoosterSlots(e, !1);
    const t = this.runtime.teamGaugeCharge;
    if (
      t > 0 &&
      !this.externalTeamGauge &&
      this.speedRaceMode?.kind !== "grip"
    ) {
      const a = Math.min(1, m(m(t / H40) + this.runtime.teamGaugeValue));
      (this.runtime.teamGaugeQueue.push(a), (this.runtime.teamGaugeCharge = 0));
    }
    const i = this.runtime.teamGaugeQueue;
    if (i.length === 0) return;
    if (this.runtime.teamGaugeTickMs < 0) {
      this.runtime.teamGaugeTickMs = e;
      return;
    }
    const r = m(m(m(e - this.runtime.teamGaugeTickMs) / 1e3) * q40),
      s = i[0],
      o = m(this.runtime.teamGaugeValue + r);
    if (s >= o) {
      this.runtime.teamGaugeValue = o;
      return;
    }
    ((this.runtime.teamGaugeValue = s),
      (this.runtime.teamGaugeTickMs = -1),
      i.shift(),
      s >= 1 &&
        ((this.runtime.teamGaugeFullPending = !0),
        (this.runtime.teamGaugeSettledAtMs = e >>> 0),
        this.convertTeamBoosterSlots(e, !0),
        (this.runtime.teamGaugeValue = 0)));
  }
  consumeTeamGaugeFullAnimation() {
    return this.runtime.teamGaugeFullPending
      ? ((this.runtime.teamGaugeFullPending = !1), !0)
      : !1;
  }
  timeAttackTeamGaugeSettledAtMs() {
    return this.runtime.teamGaugeSettledAtMs >>> 0;
  }
  convertTeamBoosterSlots(e, t) {
    const i = this.runtime.speedSlots;
    let r = !1;
    for (let s = 0; s < i.length; s += 1)
      i[s] === Cs &&
        ((i[s] = _g), t && (this.runtime.speedSlotDisabled[s] = !0), (r = !0));
    r &&
      ((this.state.nitro = i.filter(ec).length),
      t && (this.runtime.teamSlotWindowEndMs = e + 1e3));
  }
  updateTeamSlotWindow(e) {
    const t = this.runtime.teamSlotWindowEndMs;
    t === 0 ||
      e < t ||
      ((this.runtime.teamSlotWindowEndMs = 0),
      this.runtime.speedSlotDisabled.fill(!1));
  }
  timeAttackSpeedSlotDisabled() {
    return this.runtime.speedSlotDisabled;
  }
  timeAttackSpeedSlotWindowStartMs() {
    const e = this.runtime.teamSlotWindowEndMs;
    return e === 0 ? -1 : e - 1e3;
  }
  startNormalBooster(e) {
    if (
      (this.runtime.physicsState !== 0 && this.runtime.physicsState !== 18) ||
      e.forward <= 0
    )
      return !1;
    const t = this.runtime.speedSlots[0];
    if (this.runtime.speedSlotDisabled[0]) return !1;
    const i = t === _g && this.teamBooster;
    if (t !== Cs && !i) return !1;
    (this.runtime.speedSlots.shift(),
      this.runtime.speedSlots.push(-1),
      this.runtime.speedSlotDisabled.shift(),
      this.runtime.speedSlotDisabled.push(!1),
      (this.state.nitro = this.runtime.speedSlots.filter(ec).length));
    const r = Math.max(
      0,
      Math.trunc(
        i ? this.tuning.teamBoosterTime : this.tuning.normalBoosterTime,
      ),
    );
    return (
      (this.runtime.tachometerNormalBoosterDuration = r),
      (this.runtime.physicsState = i ? 4 : 3),
      (this.runtime.dualActiveSpeedLocked = !1),
      (this.runtime.stateRemainingMs = r),
      (this.state.boostTime = r * 0.001),
      this.runtime.raceMotionLocked ||
        ((this.runtime.resultBoosterCount =
          (this.runtime.resultBoosterCount + 1) >>> 0),
        (this.runtime.chargerBoosterUses += 1),
        this.runtime.chargerEnabled &&
          !this.runtime.chargerActive &&
          (this.runtime.chargerPendingUses += 1),
        this.activateChargerIfReady()),
      !0
    );
  }
  activateChargerIfReady() {
    const e = this.tuning.chargerSystemBoosterUseCount >>> 0;
    if (
      !this.runtime.chargerEnabled ||
      e === 0 ||
      this.runtime.chargerBoosterUses === 0 ||
      Math.trunc(this.runtime.chargerBoosterUses / e) <=
        this.runtime.chargerActivations ||
      this.runtime.chargerExpiryMs > this.runtime.currentUpdateMs ||
      this.runtime.chargerActive ||
      this.runtime.chargerPendingUses !== e
    )
      return;
    ((this.runtime.chargerActive = !0),
      (this.runtime.chargerActivations += 1),
      (this.runtime.chargerPendingUses = 0));
    const t = this.chargerDurationMs();
    this.runtime.chargerExpiryMs = (this.runtime.currentUpdateMs + t) >>> 0;
  }
  chargerDurationMs() {
    return Math.trunc(
      Math.max(
        1,
        m(
          m(this.tuning.chargerSystemUseTime) *
            this.runtime.chargerDurationScale,
        ),
      ),
    );
  }
  updateChargerExpiry(e) {
    this.runtime.chargerExpiryMs === 0 ||
      !this.runtime.chargerActive ||
      !this.runtime.chargerEnabled ||
      e <= this.runtime.chargerExpiryMs ||
      ((this.runtime.chargerActive = !1),
      (this.runtime.chargerExpiryMs = 0),
      (this.runtime.chargerPendingUses = 0));
  }
  updateStateTimer(e) {
    this.updateStateTimerMilliseconds(Math.round(e * 1e3));
  }
  updateDriftLifecycleTimers(e) {
    (this.runtime.driftLifecycleB50 > 0 &&
      (this.runtime.driftLifecycleB50 = ls(
        m(0),
        m(this.runtime.driftLifecycleB50 - e),
      )),
      !(
        !(this.runtime.driftLifecycleB44 > 0) && this.runtime.physicsState !== 2
      ) &&
        ((this.runtime.driftLifecycleB44 = m(
          this.runtime.driftLifecycleB44 - e,
        )),
        this.runtime.driftLifecycleB44 <= 0 &&
          ((this.runtime.driftLifecycleB44 = 0),
          this.runtime.physicsState === 2 && (this.runtime.physicsState = 0))));
  }
  updateStateTimerMilliseconds(e) {
    if (this.runtime.stateRemainingMs <= 0) {
      this.runtime.physicsState !== 0 &&
        this.runtime.physicsState !== 2 &&
        (this.runtime.physicsState = 0);
      return;
    }
    ((this.runtime.stateRemainingMs = Math.max(
      0,
      this.runtime.stateRemainingMs - e,
    )),
      this.runtime.stateRemainingMs === 0 && (this.runtime.physicsState = 0),
      (this.state.boostTime =
        this.runtime.physicsState >= 1 && this.runtime.physicsState <= 11
          ? this.runtime.stateRemainingMs * 0.001
          : 0));
  }
  updateDualBooster() {
    if (
      ((this.runtime.animationInput = {
        physicsState: this.runtime.physicsState,
        displaySpeedKmh: this.runtime.cachedDisplaySpeedKmh,
        dualMode: this.runtime.dualBoosterMode,
        dualBoosterState: this.runtime.dualBoosterState,
        dualReadyRemainingMs: this.dualBoosterReadyRemainingMs(),
      }),
      this.runtime.physicsState === 10)
    ) {
      if (
        m(this.tuning.dualTransLowSpeed) > this.runtime.cachedDisplaySpeedKmh
      ) {
        ((this.runtime.physicsState = this.runtime.dualBoosterTeam ? 4 : 3),
          (this.runtime.dualBoosterState = 4),
          (this.runtime.dualBoosterMode = 0),
          (this.runtime.dualReadyRemainingMs = 0),
          (this.runtime.dualActiveSpeedLocked = !0));
        return;
      }
      ((this.runtime.dualBoosterMode = 3),
        (this.runtime.dualReadyRemainingMs = 0));
      return;
    }
    const e = this.refreshDualBoosterReady();
    e !== void 0 &&
      (this.dualBoostAutoArm && (this.runtime.dualBoosterState = 6),
      !(this.runtime.dualBoosterState !== 6 || e > 0) &&
        ((this.runtime.dualBoosterTeam = this.runtime.physicsState === 4),
        (this.runtime.physicsState = 10),
        (this.runtime.dualBoosterState = 5),
        (this.runtime.dualBoosterMode = 3),
        (this.runtime.dualReadyRemainingMs = 0)));
  }
  armDualBooster() {
    (this.runtime.physicsState !== 3 && this.runtime.physicsState !== 4) ||
      (this.refreshDualBoosterReady() !== void 0 &&
        (this.runtime.dualBoosterState = 6));
  }
  refreshDualBoosterReady() {
    if (!this.tuning.dualBoosterEnabled) {
      this.runtime.dualReadyRemainingMs = 0;
      return;
    }
    if (
      this.runtime.dualActiveSpeedLocked &&
      (this.runtime.physicsState === 3 || this.runtime.physicsState === 4)
    ) {
      ((this.runtime.dualBoosterState = 4),
        (this.runtime.dualBoosterMode = 0),
        (this.runtime.dualReadyRemainingMs = 0));
      return;
    }
    const e = this.runtime.physicsState === 4;
    if (this.runtime.physicsState !== 3 && !e) {
      ((this.runtime.dualReadyRemainingMs = 0),
        this.clearDualBoosterReady(this.runtime.physicsState === 0 ? 0 : 1));
      return;
    }
    const t = Math.max(
        0,
        Math.trunc(
          e ? this.tuning.teamBoosterTime : this.tuning.normalBoosterTime,
        ),
      ),
      i = t - this.runtime.stateRemainingMs,
      r = m(m(t) / m(100)),
      s = Math.trunc(m(r * m(this.tuning.dualBoosterTickMin))),
      o = Math.trunc(m(r * m(this.tuning.dualBoosterTickMax)));
    if (
      ((this.runtime.dualBoosterState = this.classifyDualBoosterReady(i, s, o)),
      this.runtime.dualBoosterState < 6)
    ) {
      ((this.runtime.dualReadyRemainingMs = 0),
        this.clearDualBoosterReady(this.runtime.dualBoosterState));
      return;
    }
    return (
      (this.runtime.dualBoosterMode = 1),
      (this.runtime.dualReadyRemainingMs = Math.max(0, o - i)),
      o - i
    );
  }
  classifyDualBoosterReady(e, t, i) {
    return e > i + 50
      ? 3
      : e < t
        ? 2
        : m(this.tuning.dualTransLowSpeed) > this.runtime.cachedDisplaySpeedKmh
          ? 4
          : this.runtime.dualBoosterState === 6
            ? 6
            : this.dualBoostAuto
              ? 7
              : 8;
  }
  clearDualBoosterReady(e) {
    ((this.runtime.dualBoosterState = e),
      this.runtime.dualBoosterMode === 1 && (this.runtime.dualBoosterMode = 0));
  }
  updateObstacleSuppressionTimer(e) {
    this.runtime.obstacleSuppressionRemainingMs <= 0 ||
      ((this.runtime.obstacleSuppressionRemainingMs = Math.max(
        0,
        this.runtime.obstacleSuppressionRemainingMs -
          Math.max(0, Math.trunc(e)),
      )),
      this.runtime.obstacleSuppressionRemainingMs === 0 &&
        (this.runtime.raceMotionLocked || (this.runtime.pressProtected1C0 = !1),
        (this.runtime.pressState = 0),
        (this.runtime.obstacleSuppressionLatch = !1),
        this.visualScaleMode() !== 0 &&
          (this.runtime.visualScaleRestorePending = !0),
        this.flyingPetListeners.forEach((t) => t(!0))));
  }
  visualScaleMode() {
    return this.runtime.visualScaleA.y === m(0.2)
      ? 3
      : this.runtime.visualScaleA.x === m(0.2)
        ? 2
        : this.runtime.visualScaleA.z === m(0.2)
          ? 1
          : 0;
  }
  setVisualScaleMode(e) {
    ((this.runtime.visualScaleA =
      e === 1
        ? { x: m(1.2), y: m(1.2), z: m(0.2) }
        : { x: m(0.2), y: m(1.2), z: m(1.2) }),
      this.giant?.nativeFlattenWritten(this.runtime.visualScaleA));
  }
  updateVisualScale(e) {
    (this.runtime.visualScaleRestorePending ||
      this.runtime.visualScaleTransitionAnchorMs === 0) &&
      ((this.runtime.visualScaleRestorePending = !1),
      (this.runtime.visualScaleTransitionAnchorMs = e >>> 0));
    const t = this.runtime.visualScaleTransitionAnchorMs;
    if (t === void 0) return;
    const i = Math.min(600, Math.max(0, (e >>> 0) - t));
    let r = 0;
    for (; r + 1 < cs.length && i > cs[r + 1][0];) r += 1;
    const s = cs[r],
      o = cs[Math.min(r + 1, cs.length - 1)],
      a = o[0] - s[0],
      c = a === 0 ? 0 : m(m(i - s[0]) / m(a)),
      l = m(1 - c);
    ((this.runtime.visualScaleA = {
      x: m(m(o[1] * c) + m(s[1] * l)),
      y: m(m(o[2] * c) + m(s[2] * l)),
      z: m(m(o[3] * c) + m(s[3] * l)),
    }),
      this.runtime.visualScaleA.x >= 1 &&
        this.runtime.visualScaleA.y >= 1 &&
        this.runtime.visualScaleA.z >= 1 &&
        ((this.runtime.visualScaleA = { x: 1, y: 1, z: 1 }),
        (this.runtime.visualScaleTransitionAnchorMs = void 0)));
  }
  updateModeScale(e) {
    this.giant
      ? (this.runtime.visualScaleRestorePending &&
          ((this.runtime.visualScaleRestorePending = !1),
          this.giant.nativeRestoreRequested()),
        this.giant.updateVehicle(e, (t, i, r) => {
          ((this.runtime.eventScalePrimary = { ...t }),
            (this.runtime.eventScaleSecondary = { ...i }),
            (this.runtime.visualScaleA = { ...r }));
        }))
      : (this.updateEventScale(e), this.updateVisualScale(e));
  }
  updateEventScale(e) {
    if (this.runtime.eventScaleMode !== 1) return;
    const t = e >>> 0;
    this.runtime.eventScaleAnchorMs === 0 &&
      ((this.runtime.eventScaleAnchorMs = t),
      (this.runtime.eventScaleDurationMs = 950),
      (this.runtime.eventScaleStart = O9(this.runtime.eventScalePrimary)),
      (this.runtime.eventScaleSecondary = O9(this.runtime.eventScaleStart)));
    const i = (t - this.runtime.eventScaleAnchorMs) >>> 0,
      r = i > 950 ? 950 : Math.max(0, t - this.runtime.eventScaleAnchorMs),
      s = this.runtime.eventScaleTarget,
      o = this.runtime.eventScaleStart;
    if (r >= 950) this.runtime.eventScalePrimary = O9(s);
    else {
      let u = 0;
      for (; u + 1 < nc.length && r > nc[u + 1][0];) u += 1;
      const h = nc[u],
        d = nc[u + 1] ?? [950, 7, 7, 7],
        f = m(m(r - h[0]) / m(d[0] - h[0])),
        p = m(m(1) - f);
      this.runtime.eventScalePrimary = {
        x: md(o.x, s.x, h[1], d[1], f, p),
        y: md(o.y, s.y, h[2], d[2], f, p),
        z: md(o.z, s.z, h[3], d[3], f, p),
      };
    }
    const a = Math.min(r, 600),
      c = m(m(a) / m(600)),
      l = m(m(1) - c);
    ((this.runtime.eventScaleSecondary = {
      x: m(m(s.x * c) + m(o.x * l)),
      y: m(m(s.y * c) + m(o.y * l)),
      z: m(m(s.z * c) + m(o.z * l)),
    }),
      !(i <= 950) &&
        ((this.runtime.eventScaleAnchorMs = 0),
        (this.runtime.eventScaleMode = 0)));
  }
  updateEventGravity(e) {
    const t = e >>> 0;
    if (
      this.runtime.gravityDivisor !== 1 &&
      this.runtime.gravityAnchorMs === 0
    ) {
      this.runtime.gravityAnchorMs = t;
      return;
    }
    (t - this.runtime.gravityAnchorMs) >>> 0 <= 1e3 ||
      this.runtime.gravityDivisor === 1 ||
      !this.wheels.grounded ||
      ((this.runtime.gravityDivisor = 1), (this.runtime.gravityAnchorMs = 0));
  }
  resolvePrimaryCollision(e, t) {
    let i = !1,
      r = !1;
    const s =
        this.collisionShape.rawHeight > 1
          ? m(m(0.4) * this.collisionShape.rawHeight)
          : this.collisionShape.rawHeight,
      o = this.scratch.obb;
    (L2(this.scratch.v0, this.body.up, s),
      wi(o.center, this.body.position, this.scratch.v0),
      (o.axes[0] = this.body.right),
      (o.axes[1] = this.body.forward),
      (o.axes[2] = this.body.up),
      (o.halfExtents[0] = m(
        this.collisionShape.rawHalfWidth * this.collisionShape.scaleX,
      )),
      (o.halfExtents[1] = m(
        this.collisionShape.rawHalfLength * this.collisionShape.scaleY,
      )),
      (o.halfExtents[2] = m(m(0.699999988079071) * s)));
    for (const c of e.queryObb(o)) {
      const l = s9(c.normal, 1),
        u = V9(l, this.body.linearVelocity);
      if (u >= 0) continue;
      const h = s9(l, u),
        d = Ze(this.body.linearVelocity, h);
      if (
        ((i = !0),
        (this.runtime.steeringEnvelope = 0),
        l.y > m(0.65) || this.runtime.mrContact || this.runtime.hwContact)
      ) {
        const f = m(m(0.699999988079071) * Math.abs(V9(this.body.forward, l)));
        ((this.body.linearVelocity = Ze(d, s9(h, f))),
          (this.runtime.collisionResponseMagnitudeB6C = d1(h)),
          this.applyHighObstacleAngularResponse(l),
          this.captureRail(0, e));
      } else {
        ((r = !0),
          this.countOrdinaryResultCrash(),
          this.applyCollisionDriftGaugePreserve(!0));
        const f = d1(h);
        (f > m(10) && (this.runtime.strongLateralCollision = !0),
          (this.runtime.collisionMotionHit = !0),
          (this.runtime.collisionMotionStrength = Math.max(
            this.runtime.collisionMotionStrength,
            f,
          )),
          (this.runtime.collisionAudioStrength = Math.max(
            this.runtime.collisionAudioStrength,
            f,
          )));
        const p = d1(d),
          v = Math.min(m(m(1.5) * f), m(m(0.6000000238418579) * p)),
          w = p > 0 ? { x: m(d.x / p), y: m(d.y / p), z: m(d.z / p) } : F2(),
          g = Ze(s9(h, m(-1.5)), s9(w, v));
        if (
          ((g.y = 0),
          V9(this.body.linearVelocity, this.body.linearVelocity) < m(100) &&
            !this.runtime.activeDrift &&
            this.wheels.grounded &&
            t.forward === 1 &&
            (t.rawSteer === 1 || t.rawSteer === -1))
        ) {
          const y = s9(this.body.forward, -1),
            b = d1(y),
            A = { x: m(y.x / b), y: m(y.y / b), z: m(y.z / b) };
          let x = V9(l, A);
          const E =
              V9(l, s9(this.body.right, t.rawSteer)) >= 0
                ? m(m(x * x) * x)
                : Math.max((x = m(2 - x)), m(1.5)),
            _ = m(m(m(3) * x) + m(1)),
            C = { x: m(h.x / f), y: m(h.y / f), z: m(h.z / f) };
          bt(g, s9(C, _));
          const S = t.rawSteer * (t.steeringInverted ? -1 : 1);
          (c9(g, s9(s9(this.body.right, _), S)),
            (this.body.angularVelocity.y = m(
              this.body.angularVelocity.y + m(m(m(m(6) * E) + m(2)) * S),
            )),
            (this.runtime.steeringCollisionAudioGain = m(
              m(Math.max(x, m(1)) * m(0.30000001192092896)) +
                m(0.10000000149011612),
            )));
        }
        (c9(this.body.linearVelocity, g),
          this.applyWallObstacleAngularResponse(l));
      }
    }
    const a = this.scratch.primaryResult;
    return ((a.responseHit = i), (a.lowHit = r), a);
  }
  countOrdinaryResultCrash() {
    if (this.runtime.raceMotionLocked) return;
    const e = this.runtime.currentUpdateMs >>> 0;
    (this.runtime.resultCrashAnchorMs !== 4294967295 &&
      (e - this.runtime.resultCrashAnchorMs) >>> 0 <= 2e3) ||
      ((this.runtime.resultCrashCount =
        (this.runtime.resultCrashCount + 1) >>> 0),
      (this.runtime.resultCrashAnchorMs = e));
  }
  giantObstacleLowHit = !1;
  resolveStaticObstacles(e) {
    if (
      ((this.giantObstacleLowHit = !1),
      !e.queryObstacleObb || this.runtime.obstacleSuppressionLatch)
    )
      return !1;
    const t = this.secondaryCollisionBox();
    let i = !1,
      r = !1,
      s = !1;
    for (const o of e.queryObstacleObb(t)) {
      const a = s9(o.normal, 1),
        c = s9(o.motion, m(o.velFactor)),
        u = m(m(c.x * a.x) + m(c.z * a.z)) < -0.7,
        h = this.body.linearVelocity;
      let d, f;
      if (u) {
        if (V9(a, h) < 0) {
          const v = s9(h, 0.5);
          ((d = s9(a, V9(a, v))), (f = Ze(v, d)));
        }
      } else {
        const p = Ze(h, s9(c, 1.6180000305175781));
        V9(a, p) < 0 && ((d = s9(a, V9(a, p))), (f = Ze(h, d)));
      }
      if (d && f) {
        if (((i = !0), a.y > 0.6499999761581421)) {
          const p = m(
            m(0.699999988079071) * Math.abs(V9(a, this.body.forward)),
          );
          ((this.body.linearVelocity = Ze(f, s9(d, p))),
            (this.runtime.collisionResponseMagnitudeB6C = d1(d)),
            this.applyHighObstacleAngularResponse(a),
            this.captureRail(0, e));
        } else {
          ((this.giantObstacleLowHit = !0),
            this.applyCollisionDriftGaugePreserve(!1));
          const p = d1(d);
          (p > m(10) && (this.runtime.strongLateralCollision = !0),
            (this.runtime.collisionMotionHit = !0),
            (this.runtime.collisionMotionStrength = Math.max(
              this.runtime.collisionMotionStrength,
              p,
            )),
            (this.runtime.collisionAudioStrength = Math.max(
              this.runtime.collisionAudioStrength,
              p,
            )));
          const v = d1(f),
            w = Math.min(m(m(1.5) * p), m(m(0.6000000238418579) * v)),
            g = v > 0 ? { x: m(f.x / v), y: m(f.y / v), z: m(f.z / v) } : F2(),
            y = Ze(s9(d, m(-1.5)), s9(g, w));
          ((y.y = 0),
            c9(this.body.linearVelocity, y),
            this.applyWallObstacleAngularResponse(a));
        }
        this.runtime.steeringEnvelope = 0;
      }
      if (o.pressMode === "hard-stop") {
        this.activateHardPress();
        continue;
      }
      o.pressMode === "directional" &&
        (((c.z > 0 && c.x === 0 && c.y === 0) ||
          (c.x < 0 && c.z === 0 && c.y === 0)) &&
          (r = !0),
        ((c.z < 0 && c.x === 0 && c.y === 0) ||
          (c.x > 0 && c.z === 0 && c.y === 0)) &&
          (s = !0),
        c.y < -50 && c.x < m(0.01) && c.z === 0
          ? this.visualScaleMode() === 0 && this.activateDirectionalPress(1)
          : (Math.abs(c.x) > 0 || Math.abs(c.z) > 0) &&
            r &&
            s &&
            this.visualScaleMode() === 0 &&
            this.activateDirectionalPress(2));
    }
    return i;
  }
  resolveTrackEvents(e) {
    if (!e.queryEventObb) return;
    const t = Math.trunc(this.runtime.currentUpdateMs) >>> 0;
    for (const i of e.queryEventObb(this.secondaryCollisionBox(), t)) {
      if (i.scalePercent !== void 0 && !this.triggerEventScale(i.scalePercent))
        throw new Error(`event scale ${i.scalePercent} 不在已证 P3528 语料。`);
      if (i.gravity !== void 0 && !this.triggerEventGravity(i.gravity))
        throw new Error(`event gravity ${i.gravity} 不在已证 P3528 语料。`);
      i.effect &&
        this.trackEventEffectRequests.push({ effect: i.effect, atMs: t });
    }
  }
  secondaryCollisionBox() {
    const e = m(this.collisionShape.rawHeight),
      t = this.scratch.obb;
    return (
      L2(this.scratch.v0, this.body.up, e),
      wi(t.center, this.body.position, this.scratch.v0),
      (t.axes[0] = this.body.right),
      (t.axes[1] = this.body.forward),
      (t.axes[2] = this.body.up),
      (t.halfExtents[0] = m(
        this.collisionShape.rawHalfWidth * this.collisionShape.scaleX,
      )),
      (t.halfExtents[1] = m(
        this.collisionShape.rawHalfLength * this.collisionShape.scaleY,
      )),
      (t.halfExtents[2] = m(m(0.699999988079071) * e)),
      t
    );
  }
  updateCollisionGaugeOwners(e) {
    (!this.runtime.collisionMotionHit && !e) ||
      (this.beginWallCollision(),
      this.beginInstantWallCharge(this.runtime.currentUpdateMs));
  }
  updatePrimaryAutomaticResetTimers(e, t) {
    ((this.runtime.automaticResetLowCollisionTime =
      this.advanceAutomaticResetTimer(
        this.runtime.automaticResetLowCollisionTime,
        !e.responseHit || !e.lowHit,
        t,
        m(1),
      )),
      (this.runtime.automaticResetHighCollisionTime =
        this.advanceAutomaticResetTimer(
          this.runtime.automaticResetHighCollisionTime,
          !e.responseHit || e.lowHit,
          t,
          m(1),
        )));
  }
  updateObstacleAutomaticResetTimer(e, t) {
    this.runtime.automaticResetObstacleTime = this.advanceAutomaticResetTimer(
      this.runtime.automaticResetObstacleTime,
      !e,
      t,
      m(0.4),
    );
  }
  advanceAutomaticResetTimer(e, t, i, r) {
    if (t) return 0;
    const s = m(e + i);
    return (s > r && (this.runtime.automaticResetRequest = !0), s);
  }
  activateDirectionalPress(e) {
    ((this.runtime.pressState = e),
      this.setVisualScaleMode(e),
      this.flyingPetListeners.forEach((t) => t(!1)),
      (this.runtime.obstacleSuppressionRemainingMs = 2e3),
      (this.runtime.automaticResetRequest = !0));
  }
  activateHardPress() {
    ((this.runtime.pressState = 1),
      this.setVisualScaleMode(1),
      this.flyingPetListeners.forEach((e) => e(!1)),
      (this.runtime.obstacleSuppressionRemainingMs = 500),
      (this.runtime.pressProtected1C0 = !0),
      a1(this.body.linearVelocity),
      a1(this.body.angularVelocity),
      (this.runtime.collisionResponseMagnitudeB6C = 0),
      (this.runtime.obstacleSuppressionLatch = !0));
  }
  applyHighObstacleAngularResponse(e) {
    const t = Tn(e, this.body.up);
    ((this.body.angularVelocity.x = m(
      this.body.angularVelocity.x - m(V9(t, this.body.right) * m(0.1)),
    )),
      (this.body.angularVelocity.z = m(
        this.body.angularVelocity.z - m(V9(t, this.body.forward) * m(0.1)),
      )));
  }
  applyWallObstacleAngularResponse(e) {
    const t = V9(e, this.body.forward),
      i = V9(e, this.body.right),
      r = wd(
        Math.abs(m(V9(e, this.body.linearVelocity) * m(0.5))),
        m(1),
        m(50),
      ),
      o = {
        x: 0,
        y:
          Math.abs(m(t * m(0.8))) <= Math.abs(i)
            ? m(m(t * (i <= 0 ? m(1) : m(-1))) * r)
            : m(m(i * (t <= 0 ? m(-1) : m(1))) * r),
        z: 0,
      };
    V9(o, this.body.angularVelocity) <= 1 && c9(this.body.angularVelocity, o);
  }
  applyCollisionDriftGaugePreserve(e) {
    if (!this.tuning.driftGaugeReset) return;
    const t = m(this.tuning.driftGaguePreservePercent);
    (t === 0 &&
      ((this.runtime.driftTailLatch = !1),
      (this.runtime.driftGaugeWindow = !1),
      (this.runtime.driftGaugeElapsed = 0)),
      t !== 0 &&
        (this.runtime.tachometerGaugePreserveMarker =
          this.runtime.pendingGauge > 0));
    const i =
      e && this.runtime.chargerEnabled && this.runtime.chargerActive
        ? m(100)
        : t;
    this.runtime.pendingGauge = m(this.runtime.pendingGauge * i);
  }
  updatePublicGauge() {
    ((this.state.boostGauge = this.mainGaugeRatio()),
      (this.state.driftEnergy = this.runtime.pendingGauge));
  }
  mainGaugeRatio() {
    const e = m(Math.max(this.tuning.driftMaxGauge, 1));
    return m(
      Math.min(e, m(this.runtime.committedGauge + this.runtime.pendingGauge)) /
        e,
    );
  }
  updateInstantAccelerationGauge(e) {
    const t = m(this.tuning.instAccelGaugeLength);
    if (!(t > 0)) return;
    if (this.runtime.instantAccelerationActive) {
      ((this.runtime.instantGauge = m(
        Math.max(0, m(this.runtime.instantGauge - m(m(1e3) * e))),
      )),
        this.runtime.instantGauge > 0 ||
          (this.runtime.instantAccelerationActive = !1));
      return;
    }
    if (
      !(
        m(this.runtime.cachedDisplaySpeedKmh) >=
        m(this.tuning.autoChargeLowSpeed)
      )
    )
      return;
    let r =
      this.runtime.physicsState === 0
        ? this.tuning.chargeInstAccelGaugeByGrip
        : this.tuning.chargeInstAccelGaugeByBoost;
    this.runtime.physicsState !== 0 &&
      this.runtime.chargerEnabled &&
      this.runtime.chargerActive &&
      (r = m(r + this.tuning.chargeInstAccelGaugeByBoostAdded));
    const s = m(m(m(r) * e) * t);
    this.runtime.instantGauge = m(
      Math.min(t, m(this.runtime.instantGauge + s)),
    );
  }
  updateInstantWallCharge(e) {
    const t = this.tuning.instAccelGaugeCooldownTime >>> 0,
      i = m(this.tuning.instAccelGaugeLength);
    if (t === 0 || !(i > 0)) return;
    const r = e >>> 0,
      s = this.runtime.instantWallCollisionAnchorMs >>> 0;
    if (s === 0) {
      this.runtime.instantWallPreSpeedKmh = this.runtime.cachedDisplaySpeedKmh;
      return;
    }
    if (this.runtime.instantWallCooldownAnchorMs !== 0 || r < (s + 500) >>> 0)
      return;
    if (
      ((this.runtime.instantWallCollisionAnchorMs = 0),
      (this.runtime.instantWallCooldownAnchorMs = r),
      m(
        this.runtime.instantWallPreSpeedKmh -
          this.runtime.cachedDisplaySpeedKmh,
      ) < this.tuning.instAccelGaugeMinVelLoss)
    ) {
      this.runtime.instantWallCooldownAnchorMs = 0;
      return;
    }
    const a =
        this.runtime.chargerEnabled && this.runtime.chargerActive
          ? m(
              this.tuning.chargeInstAccelGaugeByWall +
                this.tuning.chargeInstAccelGaugeByWallAdded,
            )
          : this.tuning.chargeInstAccelGaugeByWall,
      c = m(m(a) * i);
    this.runtime.instantGauge = m(
      Math.min(i, m(this.runtime.instantGauge + c)),
    );
  }
  beginInstantWallCharge(e) {
    const t = this.tuning.instAccelGaugeCooldownTime >>> 0;
    if (
      t === 0 ||
      !(this.tuning.instAccelGaugeLength > 0) ||
      !(
        m(this.runtime.cachedDisplaySpeedKmh) >=
        m(this.tuning.instAccelGaugeMinVelBound)
      ) ||
      this.runtime.instantWallCollisionAnchorMs !== 0
    )
      return;
    const r = e >>> 0;
    r <= (this.runtime.instantWallCooldownAnchorMs + t) >>> 0 ||
      ((this.runtime.instantWallCooldownAnchorMs = 0),
      (this.runtime.instantWallCollisionAnchorMs = r));
  }
  updateResetGaugeRefill(e, t) {
    const i = this.tuning.wallCollGaugeCooldownTime >>> 0;
    if (i === 0 || !(this.runtime.resetRefillRemaining > 0)) return;
    const r = t >>> 0,
      s = this.runtime.resetRefillAnchorMs >>> 0;
    if (!(r < (s + i) >>> 0)) {
      this.clearResetGaugeRefill();
      return;
    }
    const o = m(Math.max(this.tuning.driftMaxGauge, 1));
    let a;
    if (!(r < (s + 500) >>> 0))
      ((a = m(this.runtime.resetRefillRemaining * o)),
        this.clearResetGaugeRefill());
    else {
      const c = m(m(this.runtime.resetRefillInitial * e) * m(2)),
        l = this.runtime.resetRefillRemaining;
      c < l
        ? ((a = m(c * o)), (this.runtime.resetRefillRemaining = m(l - c)))
        : ((a = m(l * o)), this.clearResetGaugeRefill());
    }
    this.runtime.committedGauge = m(
      Math.min(o, m(this.runtime.committedGauge + a)),
    );
  }
  beginWallCollision() {
    const e = this.tuning.wallCollGaugeCooldownTime >>> 0,
      t = m(Math.max(m(this.tuning.driftMaxGauge), m(1)));
    if (
      e === 0 ||
      !this.timeAttackTachometerCollision().crash ||
      t === m(1) ||
      this.runtime.wallCollisionAnchorMs !== 0
    )
      return;
    const i = this.runtime.currentUpdateMs >>> 0;
    i <= (this.runtime.resetRefillAnchorMs + e) >>> 0 ||
      ((this.runtime.resetRefillAnchorMs = 0),
      (this.runtime.wallCollisionAnchorMs = i));
  }
  settleWallCollision(e) {
    if (!(this.tuning.wallCollGaugeCooldownTime >>> 0)) return;
    const t = this.runtime.wallCollisionAnchorMs >>> 0;
    if (t === 0) {
      this.runtime.wallCollisionPreSpeedKmh =
        this.runtime.cachedDisplaySpeedKmh;
      return;
    }
    if (this.runtime.resetRefillAnchorMs !== 0 || e >>> 0 < (t + 500) >>> 0)
      return;
    ((this.runtime.wallCollisionAnchorMs = 0),
      (this.runtime.resetRefillAnchorMs = e >>> 0));
    const i = m(
        this.runtime.wallCollisionPreSpeedKmh -
          this.runtime.cachedDisplaySpeedKmh,
      ),
      r = m(this.tuning.wallCollGaugeMaxVelLoss),
      s = m(this.tuning.wallCollGaugeMinVelLoss);
    if (Number.isNaN(i) || Number.isNaN(s)) {
      this.runtime.resetRefillAnchorMs = 0;
      return;
    }
    i >= r
      ? this.setWallGaugeRefill(m(1.01))
      : i < s
        ? (this.runtime.resetRefillAnchorMs = 0)
        : this.setWallGaugeRefill(m(m(i - s) / m(r - s)));
  }
  setWallGaugeRefill(e) {
    ((this.runtime.resetRefillInitial = m(e)),
      (this.runtime.resetRefillRemaining = m(e)));
  }
  clearResetGaugeRefill() {
    ((this.runtime.resetRefillInitial = 0),
      (this.runtime.resetRefillRemaining = 0));
  }
  updateCachedDisplaySpeed() {
    this.runtime.cachedDisplaySpeedKmh = m(
      d1(this.body.linearVelocity) * m(3.5999999046325684),
    );
  }
  syncPresentationFields() {
    const e = this.runtime.localForwardSpeed,
      t = this.runtime.localRightSpeed;
    ((this.state.x = this.body.position.x),
      (this.state.y = this.body.position.y),
      (this.state.z = this.body.position.z),
      (this.state.vx = this.body.linearVelocity.x),
      (this.state.vy = this.body.linearVelocity.y),
      (this.state.vz = this.body.linearVelocity.z),
      (this.state.heading = Math.atan2(
        this.body.forward.x,
        this.body.forward.z,
      )),
      (this.state.yawRate = this.body.angularVelocity.y),
      (this.state.right = O9(this.body.right)),
      (this.state.forward = O9(this.body.forward)),
      (this.state.up = O9(this.body.up)),
      (this.state.visualScale = {
        x: m(this.runtime.visualScaleA.x * this.collisionShape.scaleX),
        y: m(this.runtime.visualScaleA.z * this.collisionShape.rawHeight),
        z: m(this.runtime.visualScaleA.y * this.collisionShape.scaleY),
      }),
      (this.state.forwardSpeed = e),
      (this.state.lateralSpeed = t),
      (this.state.slipAngle = Math.atan2(t, Math.abs(e) + 1e-4)),
      (this.state.steering = this.runtime.steeringAngle),
      (this.state.wheelCompression = [...this.wheels.compression]),
      this.updatePublicGauge());
  }
  createBody() {
    return {
      position: F2(),
      linearVelocity: F2(),
      angularVelocity: F2(),
      right: { x: 1, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
    };
  }
  createWheelRuntime() {
    return {
      hit: [!1, !1, !1, !1],
      normals: [F2(), F2(), F2(), F2()],
      compression: [0.5, 0.5, 0.5, 0.5],
      compressionDelta: [0, 0, 0, 0],
      averageNormal: F2(),
      surfaceVelocity: F2(),
      roadDescriptor: void 0,
      auxiliaryDirection: O9(ad),
      grounded: !1,
      obstacleRayHit: !1,
    };
  }
  createRuntime() {
    const e = new J40();
    return (
      (e.teamGaugeTickMs = -1),
      (e.speedSlotReorderedAtMs = -1),
      (e.resultCrashAnchorMs = 4294967295),
      (e.interactionActive = !0),
      (e.driveScale = 1),
      (e.liveForwardAccel = this.tuning.forwardAccel),
      (e.liveDragFactor = this.tuning.dragFactor),
      (e.suspensionSpring =
        this.tuning.suspensionSpring === void 0
          ? void 0
          : m(this.tuning.suspensionSpring)),
      (e.suspensionPositiveDamping =
        this.tuning.suspensionPositiveDamping === void 0
          ? void 0
          : m(this.tuning.suspensionPositiveDamping)),
      (e.suspensionNegativeDamping =
        this.tuning.suspensionNegativeDamping === void 0
          ? void 0
          : m(this.tuning.suspensionNegativeDamping)),
      (e.steeringExponentialScale = 1),
      (e.dragScale = 1),
      (e.catchupDragScale = 1),
      (e.catchupSteeringScale = 1),
      (e.draftAccelerationScale = 1),
      (e.chargerDurationScale = 1),
      (e.gravityDivisor = 1),
      (e.chargerEnabled = this.tuning.chargerEnabled),
      (e.speedSlots = Array.from(
        { length: this.tuning.speedSlotCapacity },
        () => -1,
      )),
      (e.speedSlotDisabled = Array.from(
        { length: this.tuning.speedSlotCapacity },
        () => !1,
      )),
      (e.massGravityForce = m(m(this.tuning.mass) * m(9.8))),
      (e.gravity = O9(VC)),
      (e.contactWorking = !0),
      (e.automaticResetHighCollisionTime = 0),
      (e.visualScaleA = { x: 1, y: 1, z: 1 }),
      (e.eventScalePrimary = { x: 1, y: 1, z: 1 }),
      (e.eventScaleSecondary = { x: 1, y: 1, z: 1 }),
      (e.eventScaleTarget = { x: 1, y: 1, z: 1 }),
      (e.eventScaleStart = { x: 1, y: 1, z: 1 }),
      (e.railRelativeOrientation = ic(qC)),
      e
    );
  }
  createState() {
    return {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      heading: 0,
      yawRate: 0,
      right: { x: 1, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      visualScale: { x: 1, y: 1, z: 1 },
      motorcyclePresentation: 0,
      wheelCompression: [0.5, 0.5, 0.5, 0.5],
      steering: 0,
      drifting: !1,
      driftDirection: 0,
      driftTime: 0,
      driftEnergy: 0,
      boostGauge: 0,
      nitro: 0,
      boostTime: 0,
      trackProgress: 0,
      slipAngle: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
    };
  }
}
function ei0(n, e) {
  ((n.right = { x: Math.cos(e), y: 0, z: -Math.sin(e) }),
    (n.forward = { x: Math.sin(e), y: 0, z: Math.cos(e) }),
    (n.up = { x: 0, y: 1, z: 0 }));
}
function ti0(n, e, t = !1) {
  const i = bL(n);
  for (let r = 0; r < 5; r += 1) {
    const s = Gg(i, xL(n.angularVelocity), e);
    if (t || s[2].z >= m(0.5) || r === 4) {
      hl(n, s);
      return;
    }
    r < 3
      ? ((n.angularVelocity.x = m(n.angularVelocity.x * m(0.1))),
        (n.angularVelocity.z = m(n.angularVelocity.z * m(0.1))))
      : ((n.angularVelocity.x = 0), (n.angularVelocity.z = -0));
  }
}
function ni0() {
  return {
    force: F2(),
    torque: F2(),
    v0: F2(),
    v1: F2(),
    v2: F2(),
    v3: F2(),
    v4: F2(),
    v5: F2(),
    v6: F2(),
    v7: F2(),
    v8: F2(),
    v9: F2(),
    v10: F2(),
    v11: F2(),
    oldCompression: [0, 0, 0, 0],
    zeroNormals: [F2(), F2(), F2(), F2()],
    obb: { center: F2(), axes: [F2(), F2(), F2()], halfExtents: [0, 0, 0] },
    primaryResult: { responseHit: !1, lowHit: !1 },
  };
}
function F2(n = 0, e = 0, t = 0) {
  return { x: n, y: e, z: t };
}
function O9(n) {
  return { x: n.x, y: n.y, z: n.z };
}
function qt(n, e) {
  ((n.x = e.x), (n.y = e.y), (n.z = e.z));
}
function a1(n) {
  ((n.x = 0), (n.y = 0), (n.z = 0));
}
function hd(n, e) {
  return { x: m(n.x + e.x), y: m(n.y + e.y), z: m(n.z + e.z) };
}
function Ze(n, e) {
  return { x: m(n.x - e.x), y: m(n.y - e.y), z: m(n.z - e.z) };
}
function s9(n, e) {
  return { x: m(n.x * e), y: m(n.y * e), z: m(n.z * e) };
}
function c9(n, e) {
  ((n.x = m(n.x + e.x)), (n.y = m(n.y + e.y)), (n.z = m(n.z + e.z)));
}
function bt(n, e) {
  ((n.x = m(n.x - e.x)), (n.y = m(n.y - e.y)), (n.z = m(n.z - e.z)));
}
function KC(n, e, t) {
  ((n.x = m(n.x + m(e.x * t))),
    (n.y = m(n.y + m(e.y * t))),
    (n.z = m(n.z + m(e.z * t))));
}
function t1(n, e) {
  ((n.x = m(n.x * e)), (n.y = m(n.y * e)), (n.z = m(n.z * e)));
}
function dd(n, e, t) {
  ((n.x = m(e.x - t.x)), (n.y = m(e.y - t.y)), (n.z = m(e.z - t.z)));
}
function wi(n, e, t) {
  ((n.x = m(e.x + t.x)), (n.y = m(e.y + t.y)), (n.z = m(e.z + t.z)));
}
function L2(n, e, t) {
  ((n.x = m(e.x * t)), (n.y = m(e.y * t)), (n.z = m(e.z * t)));
}
function ii0(n, e) {
  return m(m(m(n.x * e.x) + m(n.y * e.y)) + m(n.z * e.z));
}
function V9(n, e) {
  return JC(JC(gd(n.x, e.x), gd(n.z, e.z)), gd(n.y, e.y));
}
function d1(n) {
  return m(Math.sqrt(V9(n, n)));
}
function ri0(n) {
  const e = d1(n);
  return e > 0
    ? { x: m(n.x / e), y: m(n.y / e), z: m(n.z / e) }
    : { x: 1, y: 1, z: 1 };
}
function jC(n, e) {
  const t = d1(e);
  t > 0
    ? ((n.x = m(e.x / t)), (n.y = m(e.y / t)), (n.z = m(e.z / t)))
    : ((n.x = 1), (n.y = 1), (n.z = 1));
}
function si0(n) {
  const e = d1(n);
  return e === 0
    ? { x: 1, y: 1, z: 1 }
    : { x: m(n.x / e), y: m(n.y / e), z: m(n.z / e) };
}
function oi0(n, e) {
  const t = d1(e);
  t === 0
    ? qt(n, e)
    : ((n.x = m(e.x / t)), (n.y = m(e.y / t)), (n.z = m(e.z / t)));
}
function fd(n, e, t) {
  const i = e.x,
    r = m(-e.z),
    s = e.y,
    o = t.x,
    a = m(-t.z),
    c = t.y,
    l = m(m(r * c) - m(s * a)),
    u = m(m(s * o) - m(i * c)),
    h = m(m(i * a) - m(r * o));
  ((n.x = l), (n.y = h), (n.z = m(-u)));
}
function Tn(n, e) {
  return {
    x: m(m(n.y * e.z) - m(n.z * e.y)),
    y: m(m(n.z * e.x) - m(n.x * e.z)),
    z: m(m(n.x * e.y) - m(n.y * e.x)),
  };
}
function XC(n, e, t) {
  const i = m(m(e.y * t.z) - m(e.z * t.y)),
    r = m(m(e.z * t.x) - m(e.x * t.z)),
    s = m(m(e.x * t.y) - m(e.y * t.x));
  ((n.x = i), (n.y = r), (n.z = s));
}
function YC(n, e, t) {
  const i = m(m(m(t * e.x) + m(0 * e.y)) + m(0 * e.z)),
    r = m(m(m(0 * e.x) + m(t * e.y)) + m(0 * e.z)),
    s = m(m(m(0 * e.x) + m(0 * e.y)) + m(t * e.z));
  ((n.x = i), (n.y = r), (n.z = s));
}
function ai0(n) {
  const e = m(m(m(n.x * n.x) + m(n.y * n.y)) + m(n.z * n.z));
  return m(Math.sqrt(e));
}
function ZC(n) {
  const e = ai0(n);
  return e === 0
    ? { x: 1, y: 1, z: 1 }
    : { x: m(n.x / e), y: m(n.y / e), z: m(n.z / e) };
}
function bL(n) {
  return ML(n.right, n.forward, n.up);
}
function hl(n, e) {
  ((n.right = { x: e[0].x, y: e[2].x, z: m(-e[1].x) }),
    (n.forward = { x: m(-e[0].y), y: m(-e[2].y), z: e[1].y }),
    (n.up = { x: e[0].z, y: e[2].z, z: m(-e[1].z) }));
}
function ML(n, e, t) {
  return [
    { x: n.x, y: m(-e.x), z: t.x },
    { x: m(-n.z), y: e.z, z: m(-t.z) },
    { x: n.y, y: m(-e.y), z: t.y },
  ];
}
function xL(n) {
  return { x: n.x, y: m(-n.z), z: n.y };
}
function ic(n) {
  return [O9(n[0]), O9(n[1]), O9(n[2])];
}
function ci0(n) {
  return [
    { x: n[0].x, y: n[1].x, z: n[2].x },
    { x: n[0].y, y: n[1].y, z: n[2].y },
    { x: n[0].z, y: n[1].z, z: n[2].z },
  ];
}
function QC(n, e) {
  const t = (i) => ({
    x: m(m(m(i.x * e[0].x) + m(i.y * e[1].x)) + m(i.z * e[2].x)),
    y: m(m(m(i.x * e[0].y) + m(i.y * e[1].y)) + m(i.z * e[2].y)),
    z: m(m(m(i.x * e[0].z) + m(i.y * e[1].z)) + m(i.z * e[2].z)),
  });
  return [t(n[0]), t(n[1]), t(n[2])];
}
function SL(n) {
  const e = n[0].x,
    t = n[0].y,
    i = n[0].z,
    r = n[1].x,
    s = n[1].y,
    o = n[1].z,
    a = n[2].x,
    c = n[2].y,
    l = n[2].z,
    u = m(m(e + s) + l);
  if (u > 0) {
    const b = m(Math.sqrt(m(u + m(1)))),
      A = m(m(0.5) / b);
    return {
      w: m(b * m(0.5)),
      x: m(m(c - o) * A),
      y: m(m(i - a) * A),
      z: m(m(r - t) * A),
    };
  }
  const h = [e, s, l];
  let d = 0;
  (h[1] > h[d] && (d = 1), h[2] > h[d] && (d = 2));
  const f = (d + 1) % 3,
    p = (f + 1) % 3,
    v = [
      [e, t, i],
      [r, s, o],
      [a, c, l],
    ],
    w = m(Math.sqrt(m(m(m(h[d] - h[f]) - h[p]) + m(1)))),
    g = m(m(0.5) / w),
    y = [0, 0, 0];
  return (
    (y[d] = m(w * m(0.5))),
    (y[f] = m(m(v[f][d] + v[d][f]) * g)),
    (y[p] = m(m(v[p][d] + v[d][p]) * g)),
    { w: m(m(v[p][f] - v[f][p]) * g), x: y[0], y: y[1], z: y[2] }
  );
}
function CL(n) {
  const e = m(n.x * n.x),
    t = m(n.y * n.y),
    i = m(n.z * n.z),
    r = m(n.x * n.y),
    s = m(n.x * n.z),
    o = m(n.y * n.z),
    a = m(n.w * n.x),
    c = m(n.w * n.y),
    l = m(n.w * n.z),
    u = m(2);
  return [
    { x: m(m(1) - m(u * m(t + i))), y: m(u * m(r - l)), z: m(u * m(s + c)) },
    { x: m(u * m(r + l)), y: m(m(1) - m(u * m(e + i))), z: m(u * m(o - a)) },
    { x: m(u * m(s - c)), y: m(u * m(o + a)), z: m(m(1) - m(u * m(e + t))) },
  ];
}
function EL(n, e) {
  return m(m(m(m(n.x * e.x) + m(n.w * e.w)) + m(n.y * e.y)) + m(n.z * e.z));
}
function TL(n, e) {
  return { w: m(n.w * e), x: m(n.x * e), y: m(n.y * e), z: m(n.z * e) };
}
function li0(n, e, t) {
  const i = EL(e, n),
    r = m(m(1) - m(i * X40)),
    s = m(m(r * r) * Y40),
    o = (d) => m(m(m(m(m(m(d + d) - m(3)) * m(s * d)) + m(1)) + s) * d),
    a = t > m(0.5) ? m(m(1) - o(m(m(1) - t))) : m(o(t));
  let c = {
    w: m(m(m(e.w - n.w) * a) + n.w),
    x: m(m(m(e.x - n.x) * a) + n.x),
    y: m(m(m(e.y - n.y) * a) + n.y),
    z: m(m(m(e.z - n.z) * a) + n.z),
  };
  const l = m(m(m(m(c.w * c.w) + m(c.x * c.x)) + m(c.y * c.y)) + m(c.z * c.z)),
    u = (d) => m(m(m(m(m(d * d) * l) - $C) * WC) + HC);
  let h = m(m(m(l - $C) * WC) + HC);
  return (
    l <= Z40 && ((h = m(h * u(h))), l <= Q40 && (h = m(h * u(h)))),
    (c = TL(c, h)),
    c
  );
}
function ui0(n, e) {
  let t = SL(n);
  const i = { w: 1, x: 0, y: 0, z: 0 };
  return (EL(i, t) < 0 && (t = TL(t, m(-1))), CL(li0(t, i, e)));
}
function Gg(n, e, t) {
  const i = SL(n);
  let r = m(0);
  ((r = m(r - m(i.x * e.x))),
    (r = m(r - m(i.y * e.y))),
    (r = m(r - m(i.z * e.z))));
  let s = m(i.w * e.x);
  ((s = m(s + m(i.y * e.z))), (s = m(s - m(i.z * e.y))));
  let o = m(i.w * e.y);
  ((o = m(o + m(i.z * e.x))), (o = m(o - m(i.x * e.z))));
  let a = m(i.w * e.z);
  ((a = m(a + m(i.x * e.y))), (a = m(a - m(i.y * e.x))));
  const c = { w: r, x: s, y: o, z: a },
    l = m(t * m(0.5)),
    u = {
      w: m(i.w + m(c.w * l)),
      x: m(i.x + m(c.x * l)),
      y: m(i.y + m(c.y * l)),
      z: m(i.z + m(c.z * l)),
    },
    h = m(
      Math.sqrt(
        m(m(m(m(u.w * u.w) + m(u.x * u.x)) + m(u.y * u.y)) + m(u.z * u.z)),
      ),
    );
  return CL({ w: m(u.w / h), x: m(u.x / h), y: m(u.y / h), z: m(u.z / h) });
}
function F4(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setUint32(0, n, !0), t.getFloat32(0, !0));
}
function Mt(n) {
  return n ? VG(n) : void 0;
}
function _n(n) {
  const e = Number.parseFloat(n);
  return Number.isFinite(e) ? m(e) : 0;
}
function pd(n, e, t) {
  const i = m(m(n.charCodeAt(e) - 48) * m(20)),
    r = m(m(n.charCodeAt(t) - 48) * m(2));
  return m(i + r);
}
function m(n) {
  return Math.fround(n);
}
function JC(n, e) {
  return Number.isNaN(e) ? m(e) : Number.isNaN(n) ? m(n) : m(n + e);
}
function gd(n, e) {
  return Number.isNaN(e) ? m(e) : Number.isNaN(n) ? m(n) : m(n * e);
}
function vi(n, e) {
  return e < n ? e : n;
}
function ls(n, e) {
  return n < e ? e : n;
}
function md(n, e, t, i, r, s) {
  const o = m(m(e - n) / m(7)),
    a = m(m(o * m(t)) + n),
    c = m(m(o * m(i)) + n);
  return m(m(c * r) + m(a * s));
}
function wd(n, e, t) {
  return Math.min(t, Math.max(e, n));
}
const w0 = Math.fround;
function vv(n) {
  const e = w0(0.3333300054073334);
  return {
    x: w0(w0(w0(w0(n.a.x) + w0(n.b.x)) + w0(n.c.x)) * e),
    y: w0(w0(w0(w0(n.a.y) + w0(n.b.y)) + w0(n.c.y)) * e),
    z: w0(-w0(w0(w0(w0(-n.a.z) + w0(-n.b.z)) + w0(-n.c.z)) * e)),
  };
}
function Oo(n, e) {
  const [t, i, r] = e.axes,
    s = e.center,
    o = w0(w0(n.a.x) - w0(s.x)),
    a = w0(w0(-n.a.z) - w0(-s.z)),
    c = w0(w0(n.a.y) - w0(s.y)),
    l = w0(w0(n.b.x) - w0(s.x)),
    u = w0(w0(-n.b.z) - w0(-s.z)),
    h = w0(w0(n.b.y) - w0(s.y)),
    d = w0(w0(n.c.x) - w0(s.x)),
    f = w0(w0(-n.c.z) - w0(-s.z)),
    p = w0(w0(n.c.y) - w0(s.y));
  return hi0(
    S5(o, a, c, t, !1),
    S5(o, a, c, i, !0),
    S5(o, a, c, r, !1),
    S5(l, u, h, t, !1),
    S5(l, u, h, i, !0),
    S5(l, u, h, r, !1),
    S5(d, f, p, t, !1),
    S5(d, f, p, i, !0),
    S5(d, f, p, r, !1),
    w0(e.halfExtents[0]),
    w0(e.halfExtents[1]),
    w0(e.halfExtents[2]),
  );
}
function S5(n, e, t, i, r) {
  const s = w0(r ? -i.x : i.x),
    o = w0(r ? i.z : -i.z),
    a = w0(r ? -i.y : i.y);
  return w0(w0(w0(s * n) + w0(o * e)) + w0(a * t));
}
function hi0(n, e, t, i, r, s, o, a, c, l, u, h) {
  const d = w0(i - n),
    f = w0(r - e),
    p = w0(s - t),
    v = w0(o - i),
    w = w0(a - r),
    g = w0(c - s),
    y = w0(n - o),
    b = w0(e - a),
    A = w0(t - c);
  if (
    vd(f, p, e, t, a, c, u, h) ||
    yd(d, p, n, t, o, c, l, h) ||
    Ad(d, f, i, r, o, a, l, u) ||
    vd(w, g, e, t, a, c, u, h) ||
    yd(v, g, n, t, o, c, l, h) ||
    Ad(v, w, n, e, i, r, l, u) ||
    vd(b, A, e, t, r, s, u, h) ||
    yd(y, A, n, t, i, s, l, h) ||
    Ad(y, b, i, r, o, a, l, u) ||
    Math.min(n, i, o) > l ||
    -l > Math.max(n, i, o) ||
    Math.min(e, r, a) > u ||
    -u > Math.max(e, r, a) ||
    Math.min(t, s, c) > h ||
    -h > Math.max(t, s, c)
  )
    return !1;
  const x = w0(w0(f * g) - w0(p * w)),
    M = w0(w0(p * v) - w0(d * g)),
    E = w0(w0(d * w) - w0(f * v)),
    _ = -bd(x, M, E, n, e, t),
    C = x > 0 ? -l : l,
    S = M > 0 ? -u : u,
    G = E > 0 ? -h : h;
  return w0(bd(x, M, E, C, S, G) + _) > 0
    ? !1
    : w0(bd(x, M, E, -C, -S, -G) + _) >= 0;
}
function vd(n, e, t, i, r, s, o, a) {
  return yv(
    w0(w0(e * t) - w0(n * i)),
    w0(w0(e * r) - w0(n * s)),
    w0(w0(Math.abs(e) * o) + w0(Math.abs(n) * a)),
  );
}
function yd(n, e, t, i, r, s, o, a) {
  return yv(
    w0(w0(-e * t) + w0(n * i)),
    w0(w0(-e * r) + w0(n * s)),
    w0(w0(Math.abs(e) * o) + w0(Math.abs(n) * a)),
  );
}
function Ad(n, e, t, i, r, s, o, a) {
  return yv(
    w0(w0(e * t) - w0(n * i)),
    w0(w0(e * r) - w0(n * s)),
    w0(w0(Math.abs(e) * o) + w0(Math.abs(n) * a)),
  );
}
function yv(n, e, t) {
  const i = e > n ? n : e,
    r = e > n ? e : n;
  return i > t || -t > r;
}
function bd(n, e, t, i, r, s) {
  return w0(w0(w0(n * i) + w0(e * r)) + w0(t * s));
}
const f1 = Math.fround;
function di0(n, e) {
  const [t, i, r] = n.axes,
    s = f1(n.halfExtents[0]),
    o = f1(n.halfExtents[1]),
    a = f1(n.halfExtents[2]),
    c = f1(n.center.x),
    l = f1(-n.center.z),
    u = f1(n.center.y),
    h = f1(t.x),
    d = f1(-i.x),
    f = f1(r.x),
    p = f1(-t.z),
    v = f1(i.z),
    w = f1(-r.z),
    g = f1(t.y),
    y = f1(-i.y),
    b = f1(r.y);
  for (let A = 0; A < 8; A += 1) {
    const x = A & 4 ? s : -s,
      M = A & 2 ? o : -o,
      E = A & 1 ? a : -a,
      _ = Md(h, d, f, x, M, E, c),
      C = Md(p, v, w, x, M, E, l),
      S = Md(g, y, b, x, M, E, u);
    A === 0
      ? ((e[0] = e[3] = _), (e[1] = e[4] = C), (e[2] = e[5] = S))
      : (e[0] > _ && (e[0] = _),
        e[1] > C && (e[1] = C),
        e[2] > S && (e[2] = S),
        _ > e[3] && (e[3] = _),
        C > e[4] && (e[4] = C),
        S > e[5] && (e[5] = S));
  }
}
function Md(n, e, t, i, r, s, o) {
  return f1(f1(f1(f1(n * i) + f1(e * r)) + f1(t * s)) + o);
}
const dl = t0(0.3333300054),
  Bg = t0(1e-4),
  fi0 = 1e-4,
  xd = t0(0.10000000149011612),
  rc = t0(0.20000000298023224);
function pi0(n, e, t, i) {
  if (!Number.isSafeInteger(t) || t < 0 || !Number.isSafeInteger(i) || i < 0)
    throw new Error("tracked triangle timestamp 必须是非负整数毫秒。");
  const r = t >>> 0,
    s = i >>> 0,
    a = (r - (s === 0 ? r : s)) >>> 0,
    c = t0(a);
  for (const l of n) {
    const u = e(l),
      h = [I1(u[0]), I1(u[1]), I1(u[2])];
    if (a !== 0) {
      const d = Rg(h),
        f = Rg(l.previousVertices),
        p = N1(d, f),
        v = Tt(p, t0(1e3));
      l.surfaceVelocity = { x: t0(v.x / c), y: t0(v.y / c), z: t0(v.z / c) };
    }
    l.previousVertices = h;
  }
  return r;
}
