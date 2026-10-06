interface ResetLifecycle {
  phase: number;
  countdownSubstate: number;
  startAtMs: number;
}

interface ResetPhysics {
  body: { position: { y: number } };
  prepareLowHeightResetPose(): void;
  consumeAutomaticResetRequest(): boolean;
  lowSpeedAutomaticResetActive(snapshot: unknown): boolean;
  beginResetInitiation(allowCurrentSpeed: boolean): boolean;
}

export interface AutomaticResetStage {
  host: {
    resourceVersion: string;
    session: {
      lifecycle: ResetLifecycle;
      speedResetState: unknown;
      coordinator?: { synchronizePositionAnchor(): void };
    };
    audio: { kartAudio?: { playReset(): void } };
    getPhysics(): ResetPhysics;
    getDrivingSnapshot(): unknown;
  };
  lowSpeedResetStartedAtMs: number;
  initiateSpeedReset(allowCurrentSpeed: boolean): void;
}

export interface AutomaticResetDependencies {
  racingPhase: number;
  isRaceFinished(lifecycle: ResetLifecycle): boolean;
  beginResetState(previous: unknown): unknown;
}

function racingHasStarted(
  lifecycle: ResetLifecycle,
  nowMs: number,
  racingPhase: number,
): boolean {
  return lifecycle.phase === racingPhase &&
    lifecycle.countdownSubstate === 4 &&
    (nowMs >>> 0) >= (lifecycle.startAtMs >>> 0);
}

/** Reset a p3553 kart when it falls below the playable route. */
export function checkLowHeightReset(
  stage: AutomaticResetStage,
  nowMs: number,
  dependencies: Pick<AutomaticResetDependencies, "racingPhase">,
): void {
  const { host } = stage;
  if (host.resourceVersion !== "p3553" ||
      !racingHasStarted(host.session.lifecycle, nowMs, dependencies.racingPhase) ||
      !(host.getPhysics().body.position.y < -5)) return;
  host.getPhysics().prepareLowHeightResetPose();
  host.session.coordinator?.synchronizePositionAnchor();
  stage.initiateSpeedReset(false);
}

/** Honor explicit reset requests and a two-second low-speed timeout. */
export function checkAutomaticReset(
  stage: AutomaticResetStage,
  nowMs: number,
  dependencies: Pick<AutomaticResetDependencies, "racingPhase">,
): void {
  const { host } = stage;
  if (!racingHasStarted(host.session.lifecycle, nowMs, dependencies.racingPhase)) return;
  const physics = host.getPhysics();
  if (physics.consumeAutomaticResetRequest()) {
    stage.initiateSpeedReset(false);
    return;
  }
  if (!physics.lowSpeedAutomaticResetActive(host.getDrivingSnapshot())) {
    stage.lowSpeedResetStartedAtMs = 0;
    return;
  }
  const tick = nowMs >>> 0;
  if (stage.lowSpeedResetStartedAtMs === 0) stage.lowSpeedResetStartedAtMs = tick;
  if (stage.lowSpeedResetStartedAtMs !== 0 &&
      ((stage.lowSpeedResetStartedAtMs + 2000) >>> 0) < tick) {
    stage.lowSpeedResetStartedAtMs = 0;
    stage.initiateSpeedReset(false);
  }
}

/** Begin the reset transition once the physics body accepts it. */
export function initiateSpeedReset(
  stage: AutomaticResetStage,
  allowCurrentSpeed: boolean,
  dependencies: Pick<AutomaticResetDependencies, "isRaceFinished" | "beginResetState">,
): void {
  const { host } = stage;
  if (dependencies.isRaceFinished(host.session.lifecycle)) return;
  const nextState = dependencies.beginResetState(host.session.speedResetState);
  if (nextState !== host.session.speedResetState &&
      host.getPhysics().beginResetInitiation(allowCurrentSpeed)) {
    host.session.speedResetState = nextState;
    host.audio.kartAudio?.playReset();
  }
}
