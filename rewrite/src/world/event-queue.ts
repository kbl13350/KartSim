import type { Vec3 } from "./route";

export interface WorldEventRuntime<Overlap = unknown, Effect = unknown> {
  slot12(timeMs: number, worldElements: unknown): void;
  registerKartPair(position: Vec3): boolean;
  expireEffects(timeMs: number): Effect[];
  firstOverlap(box: unknown, filter: unknown): Overlap | undefined;
}

export interface WorldEventHost<Overlap = unknown, Effect = unknown> {
  data: { eventRuntimes?: readonly WorldEventRuntime<Overlap, Effect>[] };
  eventClientWorldElements?: unknown;
  pendingEventRuntimes?: WorldEventRuntime<Overlap, Effect>[];
  activeEventRuntimes: WorldEventRuntime<Overlap, Effect>[];
  expiredEventEffects: Effect[];
}

/** Advances event animations using the previous scene world matrices. */
export function updateWorldEvents(host: WorldEventHost, timeMs: number): void {
  host.data.eventRuntimes?.forEach(event =>
    event.slot12(timeMs, host.eventClientWorldElements));
}

/** Registers at most eight event collisions for the next physics snapshot. */
export function registerWorldEventPairs(
  host: WorldEventHost,
  position: Vec3,
  timeMs: number,
): void {
  const events = host.data.eventRuntimes;
  if (!events?.length) return;
  const pending: WorldEventRuntime[] = [];
  for (const event of events) {
    if (event.registerKartPair(position) && pending.length < 8) pending.push(event);
  }
  expireWorldEventEffects(host, timeMs);
  host.pendingEventRuntimes = pending;
}

export function expireWorldEventEffects(host: WorldEventHost, timeMs: number): void {
  host.data.eventRuntimes?.forEach(event => {
    host.expiredEventEffects.push(...event.expireEffects(timeMs));
  });
}

export function consumeExpiredWorldEventEffects<Effect>(host: WorldEventHost<unknown, Effect>): Effect[] {
  const effects = host.expiredEventEffects;
  host.expiredEventEffects = [];
  return effects;
}

/** The pending set becomes visible only after the update phase commits. */
export function commitWorldEventSnapshot(host: WorldEventHost): void {
  if (!host.data.eventRuntimes?.length) return;
  host.activeEventRuntimes = host.pendingEventRuntimes ?? [];
  host.pendingEventRuntimes = undefined;
}

export function queryWorldEventObb<Overlap>(
  host: WorldEventHost<Overlap>, box: unknown, filter: unknown,
): Overlap[] {
  const overlaps: Overlap[] = [];
  for (const event of host.activeEventRuntimes) {
    const found = event.firstOverlap(box, filter);
    if (found) overlaps.push(found);
  }
  return overlaps;
}
