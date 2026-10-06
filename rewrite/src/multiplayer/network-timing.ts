/** A bounded set of client/server clock offset measurements. */
export interface ClockSample {
  readonly offsetMs: number;
  readonly roundTripMs: number;
  readonly sampledAt: number;
}

export class ClockSynchronizer {
  private samples: ClockSample[] = [];

  record(sentAt: number, serverAt: number, receivedAt: number): boolean {
    if (![sentAt, serverAt, receivedAt].every(value => Number.isFinite(value) && value >= 0) ||
        receivedAt < sentAt || receivedAt - sentAt > 10_000 ||
        receivedAt < (this.samples.at(-1)?.sampledAt ?? 0)) return false;
    this.samples = this.samples.filter(sample => receivedAt - sample.sampledAt <= 30_000);
    this.samples.push(Object.freeze({
      offsetMs: serverAt - (sentAt + receivedAt) / 2,
      roundTripMs: receivedAt - sentAt,
      sampledAt: receivedAt,
    }));
    this.samples = this.samples.slice(-8);
    return true;
  }

  /** The freshest valid low-latency sample wins if round trips tie. */
  capture(now: number): ClockSample | undefined {
    if (!Number.isFinite(now) || now < 0) return undefined;
    return this.samples
      .filter(sample => now >= sample.sampledAt && now - sample.sampledAt <= 30_000)
      .reduce<ClockSample | undefined>((best, sample) =>
        !best || sample.roundTripMs <= best.roundTripMs ? sample : best, undefined);
  }

  reset(): void { this.samples = []; }
}

/** Tracks application-level round trip time for race motion requests. */
export class MotionRoundTripTracker {
  private pending?: { id: string; tick: number };
  private acknowledged = false;
  sent = 0;
  replied = 0;
  private latest?: number;

  get milliseconds(): number | undefined { return this.latest; }

  begin(id: string, tick: number): void {
    if (!this.acknowledged) this.latest = undefined;
    this.acknowledged = false;
    this.pending = { id, tick: Math.trunc(tick) };
    this.sent++;
  }

  reply(id: string, tick: number): void {
    if (this.pending?.id !== id) return;
    const received = Math.trunc(tick);
    if (received < this.pending.tick) return;
    this.latest = (received - this.pending.tick) >>> 0;
    this.acknowledged = true;
    this.replied++;
    this.pending = undefined;
  }

  failed(id: string): void {
    if (this.pending?.id !== id) return;
    this.pending = undefined;
    this.latest = undefined;
    this.acknowledged = false;
  }

  reportAndReset(): void {
    if (this.sent && this.replied) this.clear();
  }

  clear(): void {
    this.pending = undefined;
    this.acknowledged = false;
    this.sent = 0;
    this.replied = 0;
    this.latest = undefined;
  }
}
