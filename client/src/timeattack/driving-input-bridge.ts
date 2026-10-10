/** Routes keyboard, touch, and gamepad actions into the time-attack vehicle. */

import { activeLicenseItems } from "../license/license-item-race";

export interface DrivingCommand {
  kind: string;
}

interface InputTransition {
  sourceKind?: string;
  down?: boolean;
  action?: unknown;
}

interface DrivingSnapshot {
  [key: string]: unknown;
}

interface PhysicsInputOwner {
  cancelControls(): void;
  handleDrivingCommand(command: DrivingCommand, snapshot: DrivingSnapshot): void;
  startRaceBooster(): void;
  startPlayBooster(snapshot: DrivingSnapshot): void;
}

interface LifecycleInputOwner {
  phase: unknown;
  isStartBoosterWindow(nowMs: number): boolean;
}

export interface DrivingInputBridgeHost {
  host: {
    input: { drain(): { cancelled: boolean; transitions: InputTransition[] } };
    drivingInput: {
      cancel(): void;
      snapshot(): DrivingSnapshot;
      dispatch(transitions: InputTransition[],
        accept: (transition: InputTransition, state: unknown) => void): void;
    };
    autoForward: {
      cancel(): void;
      setRaceState(active: boolean, moving: boolean): void;
      dispatch(transition: InputTransition, state: unknown,
        snapshot: DrivingSnapshot,
        accept: (command: DrivingCommand) => void): void;
      isActive(snapshot: DrivingSnapshot): boolean;
      setEnabled(enabled: boolean): void;
      apply(snapshot: DrivingSnapshot): DrivingSnapshot;
    };
    nitroSeamless: {
      cancel(): void;
      setMode(mode: unknown): void;
      press(physics: PhysicsInputOwner, snapshot: DrivingSnapshot,
        nowMs: number): boolean;
    };
    gamepad: {
      reset(): void;
      poll(pads: unknown, mapping: unknown): InputTransition[];
    };
    getPhysics(): PhysicsInputOwner;
    getLampFlares(): {
      resetInputVisibility(): void;
      setInputPair(which: string, down: boolean): void;
    } | undefined;
    getLifecycle(): LifecycleInputOwner;
    getGamepadPads(): unknown;
    getGamepadMap(): unknown;
    resumeGamepadAutoForward(): void;
    getTachometer(): unknown;
    handleSpeedReset(allowCurrentSpeed: boolean): void;
  };
  handleDrivingCommand(command: DrivingCommand, nowMs: number,
    inputTime: number): void;
  handleBaseDrivingCommand(command: DrivingCommand): void;
  handleTimeAttackDrivingCommand(command: DrivingCommand, nowMs: number,
    inputTime: number): void;
  getDrivingSnapshot(): DrivingSnapshot;
  resetTacho1InputMode(inputTime: number): void;
}

export interface DrivingInputBridgeDependencies {
  racingPhase: unknown;
  forwardAction: unknown;
  acceptsTimeAttackInput(lifecycle: LifecycleInputOwner): boolean;
  activeRace(lifecycle: LifecycleInputOwner): boolean;
  isTachometer(value: unknown): value is { resetMode(mode: number): void };
}

export function drainTimeAttackDrivingInput(bridge: DrivingInputBridgeHost,
  nowMs: number, inputTime: number,
  dependencies: DrivingInputBridgeDependencies): void {
  const host = bridge.host;
  const drained = host.input.drain();
  // 驾照考试 item steps: the race's item race (license-item-race.ts).
  const items = activeLicenseItems();
  if (drained.cancelled) {
    host.drivingInput.cancel();
    host.autoForward.cancel();
    host.nitroSeamless.cancel();
    host.getPhysics().cancelControls();
    host.getLampFlares()?.resetInputVisibility();
    host.gamepad.reset();
    items?.cancelInput();
  }
  const phase = host.getLifecycle().phase;
  const active = dependencies.activeRace(host.getLifecycle());
  host.autoForward.setRaceState(active,
    phase === dependencies.racingPhase &&
      !host.getLifecycle().isStartBoosterWindow(nowMs));
  const gamepad = host.gamepad.poll(host.getGamepadPads(), host.getGamepadMap());
  const all = gamepad.length === 0 ? drained.transitions
    : [...drained.transitions, ...gamepad];
  // 驾照考试 item steps: Ctrl, Alt and Z are item keys (道具赛), not the nitro.
  const transitions = items
    ? items.routeInput(all, nowMs, phase === dependencies.racingPhase) : all;
  if (transitions.some(transition => transition.sourceKind === "gamepad" &&
    transition.down && transition.action === dependencies.forwardAction)) {
    host.resumeGamepadAutoForward();
  }
  host.drivingInput.dispatch(transitions, (transition, state) =>
    host.autoForward.dispatch(items ? items.reverseEffect(transition) : transition, state,
      host.drivingInput.snapshot(), command =>
        bridge.handleDrivingCommand(command, nowMs, inputTime)));
}

export function routeTimeAttackDrivingCommand(bridge: DrivingInputBridgeHost,
  command: DrivingCommand, nowMs: number, inputTime: number,
  dependencies: DrivingInputBridgeDependencies): void {
  bridge.handleBaseDrivingCommand(command);
  if (dependencies.acceptsTimeAttackInput(bridge.host.getLifecycle())) {
    bridge.handleTimeAttackDrivingCommand(command, nowMs, inputTime);
  }
}

export function setTimeAttackAutoForward(bridge: DrivingInputBridgeHost,
  enabled: boolean): void {
  const active = bridge.host.autoForward.isActive(
    bridge.host.drivingInput.snapshot());
  bridge.host.autoForward.setEnabled(enabled);
  if (!enabled && active) {
    bridge.handleBaseDrivingCommand({ kind: "forward-up" });
  }
}

export function setTimeAttackNitroSeamlessMode(bridge: DrivingInputBridgeHost,
  mode: unknown): void {
  bridge.host.nitroSeamless.setMode(mode);
}

export function timeAttackDrivingSnapshot(bridge: DrivingInputBridgeHost): DrivingSnapshot {
  return bridge.host.autoForward.apply(bridge.host.drivingInput.snapshot());
}

export function routeBaseDrivingCommand(bridge: DrivingInputBridgeHost,
  command: DrivingCommand): void {
  switch (command.kind) {
    case "drift-start":
    case "drift-stop":
      bridge.host.getPhysics().handleDrivingCommand(command,
        bridge.getDrivingSnapshot());
      return;
    case "forward-down":
    case "forward-up":
      bridge.host.getPhysics().handleDrivingCommand(command,
        bridge.getDrivingSnapshot());
      bridge.host.getLampFlares()?.setInputPair("front",
        command.kind === "forward-down");
      return;
    case "reverse-down":
    case "reverse-up":
      bridge.host.getPhysics().handleDrivingCommand(command,
        bridge.getDrivingSnapshot());
      bridge.host.getLampFlares()?.setInputPair("rear",
        command.kind === "reverse-down");
      return;
  }
}

export function routeTimeAttackRaceCommand(bridge: DrivingInputBridgeHost,
  command: DrivingCommand, nowMs: number, inputTime: number,
  dependencies: DrivingInputBridgeDependencies): void {
  const host = bridge.host;
  switch (command.kind) {
    case "forward-up":
      if (host.getLifecycle().isStartBoosterWindow(nowMs)) {
        host.getPhysics().startRaceBooster();
      }
      bridge.resetTacho1InputMode(inputTime);
      return;
    case "reverse-down":
      bridge.resetTacho1InputMode(inputTime);
      return;
    case "reset":
      if (host.getLifecycle().phase === dependencies.racingPhase) {
        host.handleSpeedReset(true);
      }
      return;
    case "instant-acceleration":
    case "reorder-items":
      if (host.getLifecycle().phase === dependencies.racingPhase) {
        host.getPhysics().handleDrivingCommand(command,
          bridge.getDrivingSnapshot());
      }
      return;
    case "forward-down":
      if (host.getLifecycle().isStartBoosterWindow(nowMs)) {
        host.getPhysics().startRaceBooster();
      }
      host.getPhysics().startPlayBooster(bridge.getDrivingSnapshot());
      return;
    case "use-item-or-booster": {
      const physics = host.getPhysics();
      const snapshot = bridge.getDrivingSnapshot();
      if (!host.nitroSeamless.press(physics, snapshot, nowMs)) {
        physics.handleDrivingCommand(command, snapshot);
      }
      return;
    }
  }
}

export function resetTimeAttackTachometerInput(bridge: DrivingInputBridgeHost,
  inputTime: number,
  dependencies: DrivingInputBridgeDependencies): void {
  const tachometer = bridge.host.getTachometer();
  if (dependencies.isTachometer(tachometer)) {
    tachometer.resetMode(Math.trunc(inputTime) >>> 0);
  }
}
