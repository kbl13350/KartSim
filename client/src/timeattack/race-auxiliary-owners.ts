/** Reports completed samples in one-second windows using the game's u32 clock. */
export class FrameRateCounter {
  lastTick?: number;
  count = 0;
  published = 0;

  get fps(): number { return this.published; }

  sample(timestampMs: number): void {
    const tick = Math.trunc(timestampMs) >>> 0;
    this.lastTick ??= tick;
    if (((tick - this.lastTick) >>> 0) > 1000) {
      this.published = this.count;
      this.lastTick = (this.lastTick + 1000) >>> 0;
      this.count = 0;
    }
    this.count = (this.count + 1) >>> 0;
  }
}

export interface DisposableInterfaceOwner { dispose(): void }

export interface TimeAttackInterfaceOwnerSet {
  gameplayUi?: DisposableInterfaceOwner;
  action2D?: DisposableInterfaceOwner;
  result?: DisposableInterfaceOwner;
  trackInfoCard?: DisposableInterfaceOwner;
}

/** Disposes the four UI owners at most once when a race exits. */
export class TimeAttackInterfaceOwners {
  disposed = false;

  constructor(readonly owners: TimeAttackInterfaceOwnerSet) {}

  get gameplayUi(): DisposableInterfaceOwner | undefined {
    return this.owners.gameplayUi;
  }
  get action2D(): DisposableInterfaceOwner | undefined {
    return this.owners.action2D;
  }
  get result(): DisposableInterfaceOwner | undefined {
    return this.owners.result;
  }
  get trackInfoCard(): DisposableInterfaceOwner | undefined {
    return this.owners.trackInfoCard;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.owners.gameplayUi?.dispose();
    this.owners.action2D?.dispose();
    this.owners.result?.dispose();
    this.owners.trackInfoCard?.dispose();
  }
}
