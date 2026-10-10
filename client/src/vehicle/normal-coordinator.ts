export interface NormalObject {
  name: string;
  category: number;
  active: boolean;
  removeRequested: boolean;
  slot12(timeMs: number): void;
  slot13(peer: NormalObject, timeMs: number): void;
  commit(): void;
  destroy(): void;
}

/** Runs the legacy normal object pipeline: update, pairs, removal, commit. */
export class NormalObjectCoordinator {
  pairEligible: (source: NormalObject, target: NormalObject) => boolean;
  pending: NormalObject[] = [];
  active: NormalObject[] = [];
  owned = new Set<NormalObject>();

  constructor(pairEligible: (source: NormalObject, target: NormalObject) => boolean) {
    this.pairEligible = pairEligible;
  }

  queue(object: NormalObject): void {
    if (this.owned.has(object))
      throw new Error(`${object.name} 已由 normal coordinator 持有。`);
    this.owned.add(object);
    this.pending.push(object);
  }

  run(timeMs: number): void {
    const newlyQueued = this.pending.splice(0);
    this.active.push(...newlyQueued);
    this.active.forEach(object => {
      if (object.active) object.slot12(timeMs);
    });
    const ordered = this.categoryOrderedActive();
    this.active.forEach(object => {
      if (!object.active) return;
      ordered.forEach(peer => {
        if (object !== peer && peer.active && this.pairEligible(object, peer))
          object.slot13(peer, timeMs);
      });
    });
    for (let index = 0; index < this.active.length;) {
      const object = this.active[index]!;
      if (!object.removeRequested) { index += 1; continue; }
      this.active.splice(index, 1);
      this.owned.delete(object);
      object.destroy();
    }
    this.active.forEach(object => object.commit());
  }

  dispose(): void {
    const objects = [...this.pending, ...this.active];
    this.pending.length = 0;
    this.active.length = 0;
    objects.forEach(object => {
      if (this.owned.delete(object)) object.destroy();
    });
  }

  categoryOrderedActive(): NormalObject[] {
    return [0, 1, 2, 3].flatMap(category =>
      this.active.filter(object => object.category === category));
  }
}

/** Best completed lap and current lap start in unsigned game milliseconds. */
export class LapTiming {
  bestLapMs = 0;
  timedLap = 0;
  lapStartedAtMs = 0;

  reset(): void {
    this.bestLapMs = this.timedLap = this.lapStartedAtMs = 0;
  }

  update(nowMs: number, lap: number): boolean {
    if (lap !== this.timedLap + 1) return false;
    const completed = this.timedLap !== 0;
    if (completed) {
      const duration = (nowMs - this.lapStartedAtMs) >>> 0;
      this.bestLapMs = this.bestLapMs === 0 ? duration : Math.min(this.bestLapMs, duration);
    }
    this.lapStartedAtMs = nowMs;
    this.timedLap = lap;
    return completed;
  }
}
