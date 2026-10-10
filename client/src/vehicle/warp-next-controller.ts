export interface WarpFrame {
  position: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
}

export interface WarpConfig {
  inType?: string;
  outType?: string;
  outTime?: number;
  outFovAdjust?: boolean;
  outFovBase?: number;
}

export type WarpAction =
  | { kind: "start-warp-presentation" | "freeze-camera" | "finish-warp-presentation" |
      "finish-warp-letterbox" | "reset-drive-camera" }
  | { kind: "teleport"; frame: WarpFrame; clearMotion: boolean };

const fadeMs = 375;
const finishMs = 4000;
const blinkEndsMs = 500;

export function warpPresentationBlinkVisible(elapsedMs: number): boolean {
  return Math.floor(Math.max(0, elapsedMs) / 100) % 2 === 0;
}

function copyFrame(frame: WarpFrame): WarpFrame {
  return {
    position: { ...frame.position },
    forward: { ...frame.forward },
    up: { ...frame.up },
  };
}

/** Fade into and out of the black letterbox used by a standard warp. */
export function warpLetterboxRatio(elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs < fadeMs) return elapsedMs / fadeMs;
  if (elapsedMs < finishMs) return 1;
  if (elapsedMs < finishMs + fadeMs) return 1 - (elapsedMs - finishMs) / fadeMs;
  return 0;
}

/** One warp-next transition. The game consumes actions to update camera and kart. */
export class WarpNextController {
  phase = 0;
  startMs = 0;
  destination: WarpFrame | undefined;
  config: WarpConfig | undefined;
  fairyFovFactorValue = Math.fround(1);
  fairyCameraResetPending = false;
  warpFinishNotified = false;

  enter(tag: string, frame: WarpFrame, nowMs: number, config?: WarpConfig): WarpAction[] {
    if (tag !== "warpnext:in:next" || this.phase !== 0) return [];
    this.startMs = Math.trunc(nowMs) >>> 0;
    this.destination = copyFrame(frame);
    this.config = config;
    if (config?.inType === "fairy") {
      this.phase = 6;
      this.fairyCameraResetPending = true;
      return [{ kind: "teleport", frame: copyFrame(frame), clearMotion: false }];
    }
    this.phase = 1;
    return [{ kind: "start-warp-presentation" }];
  }

  tick(nowMs: number): WarpAction[] {
    const destination = this.destination;
    if (!destination) return [];
    const elapsed = (Math.trunc(nowMs) - this.startMs) >>> 0;
    return this.phase === 6 ? this.tickFairy(elapsed) : this.tickStandard(elapsed, destination);
  }

  blackBarRatio(nowMs: number): number {
    if (this.phase < 1 || this.phase > 4) return 0;
    return warpLetterboxRatio((Math.trunc(nowMs) - this.startMs) >>> 0);
  }

  presentationVisible(nowMs: number): boolean {
    if (this.phase !== 1) return true;
    const elapsed = (Math.trunc(nowMs) - this.startMs) >>> 0;
    return elapsed >= blinkEndsMs || warpPresentationBlinkVisible(elapsed);
  }

  blocksDriving(): boolean { return this.phase >= 1 && this.phase <= 4; }
  fairyFovFactor(): number | undefined {
    return this.phase === 6 ? this.fairyFovFactorValue : undefined;
  }

  reset(): void {
    this.phase = 0;
    this.startMs = 0;
    this.destination = undefined;
    this.config = undefined;
    this.fairyFovFactorValue = Math.fround(1);
    this.fairyCameraResetPending = false;
    this.warpFinishNotified = false;
  }

  tickStandard(elapsedMs: number, destination: WarpFrame): WarpAction[] {
    if (this.phase === 1 && elapsedMs >= 500) {
      this.phase = 2;
      return [{ kind: "freeze-camera" }];
    }
    if (this.phase === 2 && elapsedMs >= 2500) {
      this.phase = 3;
      return [];
    }
    if (this.phase === 3 && elapsedMs >= 3000) {
      this.phase = 4;
      return [{ kind: "teleport", frame: copyFrame(destination), clearMotion: true }];
    }
    if (this.phase === 4) {
      const actions: WarpAction[] = [];
      if (elapsedMs >= finishMs && !this.warpFinishNotified) {
        this.warpFinishNotified = true;
        actions.push({ kind: "finish-warp-presentation" });
      }
      if (elapsedMs >= finishMs + fadeMs) {
        this.reset();
        actions.push({ kind: "finish-warp-letterbox" });
      }
      return actions;
    }
    return [];
  }

  tickFairy(elapsedMs: number): WarpAction[] {
    if (this.config?.outType !== "fairy") return [];
    if (elapsedMs > this.config.outTime!) {
      this.reset();
      return [];
    }
    if (this.config.outFovAdjust) {
      this.fairyFovFactorValue = Math.fround(Math.fround(elapsedMs) / this.config.outFovBase!);
    }
    if (this.fairyCameraResetPending) {
      this.fairyCameraResetPending = false;
      return [{ kind: "reset-drive-camera" }];
    }
    return [];
  }
}
