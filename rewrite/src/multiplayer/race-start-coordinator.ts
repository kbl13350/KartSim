import type { LobbyRoom } from "./lobby-actions";

export interface CoordinatedRace {
  raceId: string;
  loadedIds: string[];
  channelName: string;
  startAt?: number;
  returnedIds?: string[];
  roadblock?: unknown;
  lte?: unknown;
  rp?: unknown;
  [key: string]: unknown;
}

export interface CoordinatedRoom extends LobbyRoom {
  channelName: string;
  speedVersion: string;
  resourceVersion: string;
  race?: CoordinatedRace;
}

export interface PreparedRace {
  dispose(): void;
  updateRoom?(room: CoordinatedRoom): void;
  presentingResults?(): boolean;
  scheduleStart(localTick: number): void;
  bindClock?(mapping: Record<string, unknown>): void;
  showWaiting?(): void;
}

export interface RaceStartOptions {
  loader: { prepare(room: CoordinatedRoom, race: CoordinatedRace,
    signal: AbortSignal): Promise<PreparedRace> };
  captureClock(): Record<string, unknown> | undefined;
  send(message: Record<string, unknown>): Promise<unknown>;
  onError(error: unknown): void;
}

export interface RaceStartRules {
  gameplay(value: CoordinatedRoom | CoordinatedRace): string;
  sameRoadblock(a: unknown, b: unknown): boolean;
  sameLte(a: unknown, b: unknown): boolean;
  sameRp(a: unknown, b: unknown): boolean;
  toLocalStartTick(serverStart: number, mapping: Record<string, unknown>): number;
}

interface ActiveRace {
  roomId: string;
  raceId: string;
  abort: AbortController;
  scheduled: boolean;
  failed: boolean;
  room: CoordinatedRoom;
  value?: PreparedRace;
  mapping?: Readonly<Record<string, unknown>>;
}

/** Coordinates one loading race, local start clock, and cancellation. */
export class RaceStartCoordinator {
  active?: ActiveRace;
  revision = 0;
  roomId?: string;
  disposed = false;

  constructor(public options: RaceStartOptions, private rules: RaceStartRules) {}

  update(room: CoordinatedRoom): void {
    if (this.disposed) return;
    if (room.roomId !== this.roomId) {
      this.reset();
      this.roomId = room.roomId;
    }
    if (room.revision <= this.revision) return;
    this.revision = room.revision;
    const race = room.race;
    if (room.phase === "open" || !race) {
      const active = this.active;
      if (active && !active.failed) {
        try {
          active.value?.updateRoom?.(structuredClone(room));
        } catch (error) {
          this.fail(active, error);
          return;
        }
        if (active.value?.presentingResults?.()) return;
      }
      this.release();
      return;
    }
    if (this.active?.raceId !== race.raceId) {
      this.release();
      const active: ActiveRace = { roomId: room.roomId, raceId: race.raceId,
        abort: new AbortController(), scheduled: false, failed: false,
        room: structuredClone(room) };
      this.active = active;
      if (room.phase !== "loading") {
        this.fail(active, new Error("Missed race loading phase"));
        return;
      }
      void this.prepare(active, structuredClone(room), structuredClone(race));
      return;
    }

    const active = this.active;
    const original = active.room;
    const originalRace = original.race;
    if (room.channelName !== original.channelName ||
        race.channelName !== originalRace?.channelName ||
        this.rules.gameplay(room) !== this.rules.gameplay(original) ||
        this.rules.gameplay(race) !== this.rules.gameplay(originalRace!) ||
        !this.rules.sameRoadblock(race.roadblock, originalRace?.roadblock) ||
        !this.rules.sameLte(race.lte, originalRace?.lte) ||
        !this.rules.sameRp(race.rp, originalRace?.rp) ||
        room.mode !== original.mode || room.speed !== original.speed ||
        room.resourceVersion !== original.resourceVersion ||
        room.name !== original.name || room.speedVersion !== original.speedVersion) {
      this.fail(active, new Error("比赛加载期间频道配置发生变化。"));
      return;
    }
    active.room = structuredClone(room);
    if (!active.failed) {
      try {
        active.value?.updateRoom?.(structuredClone(room));
      } catch (error) {
        this.fail(active, error);
        return;
      }
    }
    if (active.failed || active.scheduled || race.startAt === undefined) return;
    if (!active.value || !active.mapping) {
      this.fail(active, new Error("Start arrived before race preparation"));
      return;
    }
    active.scheduled = true;
    try {
      active.value.scheduleStart(this.rules.toLocalStartTick(race.startAt, active.mapping));
    } catch (error) {
      this.fail(active, error);
    }
  }

  async prepare(active: ActiveRace, room: CoordinatedRoom,
    race: CoordinatedRace): Promise<void> {
    try {
      const prepared = await this.options.loader.prepare(room, race, active.abort.signal);
      if (this.active !== active || active.abort.signal.aborted) {
        prepared.dispose();
        return;
      }
      active.value = prepared;
      const sample = this.options.captureClock();
      active.mapping = sample ? Object.freeze({ ...sample }) : undefined;
      if (!active.mapping) throw new Error("Server clock sample expired during loading");
      prepared.bindClock?.(active.mapping);
      prepared.updateRoom?.(structuredClone(active.room));
      prepared.showWaiting?.();
      await this.options.send({ type: "loaded", roomId: active.roomId, raceId: active.raceId });
    } catch (error) {
      if (this.active === active && !active.abort.signal.aborted) this.fail(active, error);
    }
  }

  fail(active: ActiveRace, error: unknown): void {
    if (active.failed) return;
    active.failed = true;
    active.abort.abort();
    active.value?.dispose();
    active.value = undefined;
    this.options.onError(error);
    void this.options.send({ type: "load-failed", roomId: active.roomId,
      raceId: active.raceId }).catch(sendError => {
      if (this.active === active && !this.disposed) this.options.onError(sendError);
    });
  }

  release(): void {
    const active = this.active;
    this.active = undefined;
    if (active) {
      active.abort.abort();
      active.value?.dispose();
    }
  }

  reset(): void {
    this.release();
    this.revision = 0;
    this.roomId = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
  }

  releasePresentedRace(): void {
    const active = this.active;
    if (!active || active.failed || active.value?.presentingResults?.()) return;
    this.release();
  }
}
