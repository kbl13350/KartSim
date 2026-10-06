export interface TrackEventProjection {
  rearmAnchorInitial: number | "uninitialized-target-heap";
  effect?: unknown;
  scalePercent?: number;
  gravity?: number;
  sound?: unknown;
}

export interface TrackEventHit {
  effect: unknown;
  scalePercent: number | undefined;
  gravity: number | undefined;
  sound: unknown;
}

export type EventRearmStatus =
  | "throttled" | "waiting" | "residue-cleared" | "armed" |
    "timer-started" | "rearmed";

/** One-shot track event with a three-second rearm window. */
export class EventCollisionLatch {
  armed = true;
  rearmAnchor: number | "uninitialized-target-heap";
  unresolvedResidueSince: number | undefined;

  constructor(public projection: TrackEventProjection, anchor?: number) {
    this.rearmAnchor = anchor === undefined ? projection.rearmAnchorInitial : Math.trunc(anchor) >>> 0;
  }

  isArmed(): boolean { return this.armed; }
  isCollisionReady(): boolean { return this.rearmAnchor !== "uninitialized-target-heap"; }

  firstOverlap(): TrackEventHit | undefined {
    if (!this.armed || !this.isCollisionReady()) return undefined;
    this.armed = false;
    return {
      effect: this.projection.effect,
      scalePercent: this.projection.scalePercent,
      gravity: this.projection.gravity,
      sound: this.projection.sound,
    };
  }

  slot21(nowMs: number, throttled: boolean): EventRearmStatus {
    if (throttled) return "throttled";
    const timestamp = Math.trunc(nowMs) >>> 0;
    return this.rearmAnchor === "uninitialized-target-heap"
      ? this.normalizeUnknownResidue(timestamp)
      : this.updateRearmAnchor(timestamp, this.rearmAnchor);
  }

  normalizeUnknownResidue(timestamp: number): EventRearmStatus {
    if (this.unresolvedResidueSince === undefined) {
      this.unresolvedResidueSince = timestamp;
      return "waiting";
    }
    if (((timestamp - this.unresolvedResidueSince) >>> 0) <= 3000) return "waiting";
    this.rearmAnchor = 0;
    this.unresolvedResidueSince = undefined;
    return "residue-cleared";
  }

  updateRearmAnchor(timestamp: number, anchor: number): EventRearmStatus {
    if (anchor === 0) {
      if (this.armed) return "armed";
      this.rearmAnchor = timestamp;
      return "timer-started";
    }
    if (((timestamp - anchor) >>> 0) <= 3000) return "waiting";
    const status = this.armed ? "residue-cleared" : "rearmed";
    this.armed = true;
    this.rearmAnchor = 0;
    return status;
  }
}
