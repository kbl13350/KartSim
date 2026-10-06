/** Runs one multiplayer session tick, from controls through result transition. */

export interface RaceSessionCommand { kind: string; [key: string]: unknown }
export interface RaceSessionAction { kind: string; [key: string]: unknown }
interface InputBatch { transitions: unknown[]; cancelled: boolean }

export interface RaceSessionUpdateHost {
  active: boolean;
  disposed: boolean;
  resultVisible: boolean;
  now: number;
  runtime: {
    local: {
      physics: {
        speedRaceMode?: { kind: string };
        hardCancelControls(): void;
        handleDrivingCommand(command: RaceSessionCommand, applied: unknown): void;
        startRaceBooster(): void;
        startPlayBooster(applied: unknown): void;
        consumeSpeedSlotReordered(): boolean;
      };
      lifecycle: { state: number; countdownStep: number };
      cancelModeDrivingInput(): void;
      isStartBoosterWindow(nowMs: number): boolean;
      requestReset(): void;
      consumeRoadBlockResetNotice(): boolean;
      handleModeDrivingCommand(command: RaceSessionCommand, nowMs: number): boolean;
      boostGaugeFull: boolean;
    };
    update(nowMs: number, applied: unknown, suspended: boolean): RaceSessionAction[];
  };
  host: {
    input: {
      drain(keyMap?: unknown): InputBatch;
      cancelAll(): void;
    };
    autoForward: {
      cancel(): void;
      setRaceState(active: boolean, pendingStart: boolean): void;
      dispatch(code: unknown, pressed: unknown, snapshot: unknown,
        handle: (command: RaceSessionCommand) => void): void;
      apply(snapshot: unknown): unknown;
      isActive(snapshot: unknown): boolean;
    };
    clientFramerate: { sample(nowMs: number): void };
    touchControls: { setAutoForwardActive(active: boolean): void };
    playSlotChanger(): void;
    renderer: unknown;
    status(message: string): void;
  };
  controls: {
    cancel(): void;
    dispatch(transitions: unknown[], handle: (code: unknown,
      pressed: unknown) => void): void;
    snapshot(): unknown;
  };
  notice?: {
    visible: boolean;
    showRoadBlockReset(nowMs: number): void;
    hide(): void;
  };
  chat?: { setAllowed(allowed: boolean): void };
  scene: {
    awardInput(transitions: unknown[], cancelled: boolean): void;
    startBoostGaugeFull(): void;
    update(renderer: unknown, nowMs: number, actions: RaceSessionAction[]): void;
    resultComplete: boolean;
  };
  requestLeave(): void;
  fail(error: unknown): void;
}

export interface RaceSessionUpdateDependencies {
  nowMs(): number;
  lteKeyMap: unknown;
  states: {
    Ready: number;
    Countdown: number;
    Racing: number;
    PostFinish: number;
    Result: number;
  };
}

function cancelDriving(host: RaceSessionUpdateHost): void {
  host.controls.cancel();
  host.host.autoForward.cancel();
  host.runtime.local.physics.hardCancelControls();
}

function applyDrivingCommand(host: RaceSessionUpdateHost,
  command: RaceSessionCommand,
  dependencies: RaceSessionUpdateDependencies): void {
  const local = host.runtime.local;
  const physics = local.physics;
  if (command.kind === "reset") {
    local.requestReset();
    if (local.consumeRoadBlockResetNotice()) {
      host.notice?.showRoadBlockReset(host.now);
      if (host.notice?.visible) {
        cancelDriving(host);
        host.host.input.cancelAll();
      }
    }
    return;
  }
  const state = local.lifecycle.state;
  if (state === dependencies.states.Result ||
    (state !== dependencies.states.Racing &&
      (command.kind === "instant-acceleration" ||
        command.kind === "reorder-items"))) return;
  const applied = host.host.autoForward.apply(host.controls.snapshot());
  if (command.kind === "unsupported-action" &&
    local.handleModeDrivingCommand(command, host.now)) return;
  physics.handleDrivingCommand(command, applied);
  if (command.kind === "forward-down" || command.kind === "forward-up") {
    if (local.isStartBoosterWindow(host.now)) physics.startRaceBooster();
    if (command.kind === "forward-down") physics.startPlayBooster(applied);
  }
}

export function updateRaceSession(host: RaceSessionUpdateHost,
  dependencies: RaceSessionUpdateDependencies): void {
  if (!host.active || host.disposed) return;
  host.now = dependencies.nowMs();
  try {
    const local = host.runtime.local;
    const physics = local.physics;
    const input = host.host.input.drain(
      physics.speedRaceMode?.kind === "lte" ? dependencies.lteKeyMap : undefined);
    if (input.cancelled) {
      cancelDriving(host);
      local.cancelModeDrivingInput();
    }
    const lifecycle = local.lifecycle;
    host.host.autoForward.setRaceState(
      !host.resultVisible && lifecycle.state < dependencies.states.PostFinish,
      lifecycle.state === dependencies.states.Racing &&
        !local.isStartBoosterWindow(host.now));
    if (host.resultVisible) host.scene.awardInput(
      input.transitions, input.cancelled);
    host.controls.dispatch(host.resultVisible || host.notice?.visible
      ? [] : input.transitions, (code, pressed) => {
      if (host.notice?.visible) return;
      host.host.autoForward.dispatch(code, pressed, host.controls.snapshot(),
        command => applyDrivingCommand(host, command, dependencies));
    });
    if (host.notice?.visible) {
      host.controls.cancel();
      host.host.autoForward.cancel();
    }
    const snapshot = host.controls.snapshot();
    const sampleFramerate = !host.resultVisible &&
      lifecycle.state !== dependencies.states.Result;
    const actions = host.runtime.update(host.now,
      host.host.autoForward.apply(snapshot), false);
    if (sampleFramerate) host.host.clientFramerate.sample(host.now);
    host.host.touchControls.setAutoForwardActive(
      host.host.autoForward.isActive(snapshot));
    if (host.disposed) return;
    if (physics.consumeSpeedSlotReordered()) host.host.playSlotChanger();
    host.chat?.setAllowed(
      lifecycle.state === dependencies.states.Ready ||
      (lifecycle.state === dependencies.states.Countdown &&
        lifecycle.countdownStep < 4) ||
      lifecycle.state >= dependencies.states.PostFinish);
    if (local.boostGaugeFull) host.scene.startBoostGaugeFull();
    host.scene.update(host.host.renderer, host.now, actions);
    if (host.resultVisible && host.scene.resultComplete) host.requestLeave();
    if (!host.resultVisible && actions.some(action =>
      action.kind === "publish-result")) {
      host.notice?.hide();
      host.resultVisible = true;
      cancelDriving(host);
      host.host.input.cancelAll();
      host.host.status("成绩展示结束后自动返回原房间。");
    }
  } catch (error) {
    host.fail(error);
  }
}
