import type { GameplayTransition } from "./gameplay-input-queue";

export interface ForwardSnapshot {
  forward: number;
  reverse: number;
  [key: string]: unknown;
}

export interface ForwardEffect { kind: string }

/** Touch forward hold that releases as soon as keyboard driving takes over. */
export class AutoForwardAssist {
  enabled = false;
  armed = false;
  ready = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  setRaceState(racing: boolean, ready: boolean): void {
    this.ready = racing && ready;
    if (!racing) this.cancel();
  }

  cancel(): void { this.armed = false; }

  isActive(snapshot: ForwardSnapshot): boolean {
    return this.isEngaged() && snapshot.reverse === 0;
  }

  apply<T extends ForwardSnapshot>(snapshot: T): T {
    return this.isEngaged()
      ? { ...snapshot, forward: snapshot.reverse > 0 ? 0 : 1 }
      : snapshot;
  }

  dispatch(effect: ForwardEffect, transition: GameplayTransition,
    snapshot: ForwardSnapshot, emit: (effect: ForwardEffect) => void): void {
    if (transition.sourceKind === "keyboard" && transition.down) this.cancel();
    if (effect.kind === "forward-down") {
      this.pressForward(transition, snapshot, emit);
      return;
    }
    this.dispatchRelease(effect, snapshot, emit);
  }

  dispatchRelease(effect: ForwardEffect, snapshot: ForwardSnapshot,
    emit: (effect: ForwardEffect) => void): void {
    if (effect.kind === "reverse-down" && this.isEngaged()) emit({ kind: "forward-up" });
    if (!(effect.kind === "forward-up" && this.isActive(snapshot))) emit(effect);
  }

  pressForward(transition: GameplayTransition, snapshot: ForwardSnapshot,
    emit: (effect: ForwardEffect) => void): void {
    if (transition.sourceKind !== "keyboard" && this.enabled) this.armed = true;
    if (!(this.isEngaged() && snapshot.reverse > 0)) emit({ kind: "forward-down" });
  }

  isEngaged(): boolean { return this.enabled && this.armed && this.ready; }
}
