/** Runs one multiplayer session tick, from controls through result transition. */
import {
  itemReverseDrivingEffect, type ItemCommand, type ItemDirectionKey, type ItemInputRouter,
} from "../input/item-input";

export interface RaceSessionCommand { kind: string; [key: string]: unknown }
export interface RaceSessionAction { kind: string; [key: string]: unknown }
interface InputBatch { transitions: Array<{ action: number; down: boolean }>; cancelled: boolean }

/** Item races (道具赛) only; absent on every other physics owner. */
interface ItemRacePhysics {
  itemMode?: boolean;
  itemEffects?: {
    /** Left/right swapped (devil 大魔王, drrMine R博士). */
    readonly steeringInverted: boolean;
    /** Forward/back swapped (newDevil 恶魔阿哥, drrMine R博士). */
    readonly forwardBackSwapped?: boolean;
    escapePress(): boolean;
    /** Arrow keys while held (the talisman 符咒 QTE). */
    directionPress?(direction: ItemDirectionKey): boolean;
  };
}

export interface RaceSessionUpdateHost {
  active: boolean;
  disposed: boolean;
  resultVisible: boolean;
  now: number;
  runtime: {
    local: {
      physics: ItemRacePhysics & {
        speedRaceMode?: { kind: string };
        hardCancelControls(): void;
        handleDrivingCommand(command: RaceSessionCommand, applied: unknown): void;
        startRaceBooster(): void;
        startPlayBooster(applied: unknown): void;
        consumeSpeedSlotReordered(): boolean;
        runtime?: { physicsState: number };
      };
      lifecycle: { state: number; countdownStep: number };
      cancelModeDrivingInput(): void;
      isStartBoosterWindow(nowMs: number): boolean;
      requestReset(): void;
      consumeRoadBlockResetNotice(): boolean;
      handleModeDrivingCommand(command: RaceSessionCommand, nowMs: number): boolean;
      boostGaugeFull: boolean;
      /** Item races: Ctrl/Alt/Z router and the item controller that receives the commands. */
      itemInput?: ItemInputRouter;
      items?: { handleCommand(command: ItemCommand, nowMs: number): void };
      /** Item races: the Alt swap sound and short notices (the Z item changer). */
      itemRace?: { consumeSlotChangerSound(): boolean; consumeStatusMessage(): string | undefined };
      /** Item races: the start booster fired (完美起步, the finish request's `perfectStart`). */
      noteStartBooster?(): void;
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
    setSteeringInverted?(enabled: boolean): void;
    setForwardReverseSwap?(enabled: boolean): void;
  };
  notice?: {
    visible: boolean;
    showRoadBlockReset(nowMs: number): void;
    hide(): void;
  };
  chat?: { setAllowed(allowed: boolean): void; notice?(text: string): void };
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

function itemRace(host: RaceSessionUpdateHost): boolean {
  return host.runtime.local.physics.itemMode === true;
}

function sendItemCommand(host: RaceSessionUpdateHost, command: ItemCommand): void {
  host.runtime.local.items?.handleCommand(command, host.now);
}

function cancelItemInput(host: RaceSessionUpdateHost): void {
  if (itemRace(host))
    host.runtime.local.itemInput?.cancel({ command: command => sendItemCommand(host, command) });
}

/**
 * In item races Ctrl (press and release), Alt and Z become item commands and
 * never reach the nitro slots; left/right presses also shorten a water bubble
 * and every arrow press feeds the talisman QTE while the kart is held.
 */
function routeItemInput<T extends { action: number; down: boolean }>(host: RaceSessionUpdateHost,
  transitions: T[], dependencies: RaceSessionUpdateDependencies): T[] {
  const local = host.runtime.local;
  if (!itemRace(host) || !local.itemInput) return transitions;
  return local.itemInput.route(transitions, {
    racing: local.lifecycle.state === dependencies.states.Racing,
    command: command => sendItemCommand(host, command),
    escape: () => { local.physics.itemEffects?.escapePress(); },
    direction: direction => { local.physics.itemEffects?.directionPress?.(direction); },
  });
}

/** Item races: the pedal and drift commands as a running reverse remaps them. */
function reverseItemEffect(host: RaceSessionUpdateHost, effect: unknown): unknown {
  const effects = host.runtime.local.physics.itemEffects;
  if (!itemRace(host) || !effects || typeof effect !== "object" || effect === null ||
      typeof (effect as { kind?: unknown }).kind !== "string") return effect;
  return itemReverseDrivingEffect(effect as { kind: string; direction?: number }, {
    steeringInverted: effects.steeringInverted === true,
    forwardBackSwapped: effects.forwardBackSwapped === true,
  });
}

function cancelDriving(host: RaceSessionUpdateHost): void {
  host.controls.cancel();
  host.host.autoForward.cancel();
  host.runtime.local.physics.hardCancelControls();
  cancelItemInput(host);
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
    if (local.isStartBoosterWindow(host.now)) {
      physics.startRaceBooster();
      // Item races: the start boost (state 1) earns the 完美起步 title.
      if (itemRace(host) && physics.runtime?.physicsState === 1) local.noteStartBooster?.();
    }
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
    // A devil (大魔王) hit swaps left and right, a newDevil (恶魔阿哥) forward and
    // back, a drrMine (R博士) both, through the input snapshot.
    if (itemRace(host)) {
      host.controls.setSteeringInverted?.(physics.itemEffects?.steeringInverted === true);
      host.controls.setForwardReverseSwap?.(physics.itemEffects?.forwardBackSwapped === true);
    }
    const lifecycle = local.lifecycle;
    host.host.autoForward.setRaceState(
      !host.resultVisible && lifecycle.state < dependencies.states.PostFinish,
      lifecycle.state === dependencies.states.Racing &&
        !local.isStartBoosterWindow(host.now));
    if (host.resultVisible) host.scene.awardInput(
      input.transitions, input.cancelled);
    host.controls.dispatch(host.resultVisible || host.notice?.visible
      ? [] : routeItemInput(host, input.transitions, dependencies), (code, pressed) => {
      if (host.notice?.visible) return;
      host.host.autoForward.dispatch(reverseItemEffect(host, code), pressed,
        host.controls.snapshot(), command => applyDrivingCommand(host, command, dependencies));
    });
    if (host.notice?.visible) {
      host.controls.cancel();
      host.host.autoForward.cancel();
      cancelItemInput(host);
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
    if (local.itemRace?.consumeSlotChangerSound()) host.host.playSlotChanger();
    const itemNotice = local.itemRace?.consumeStatusMessage();
    if (itemNotice) host.chat?.notice?.(itemNotice);
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
