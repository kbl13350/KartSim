import type { RacePoint } from "./race-driving-scales";

export interface CadenceParticipant {
  playerId: string;
  slot: number;
  equipment?: { itemIds: readonly number[] };
}

export interface CadenceRace {
  raceId: string;
  roster: readonly CadenceParticipant[];
}

export interface CadenceRoom {
  race?: { raceId: string; loadedIds: readonly string[] };
  members: readonly { playerId: string; slot: number }[];
}

export interface CadenceMotion {
  kind: string;
  /** observedSlot names a racer by room slot (protocol 40; the release sent its player ID). */
  routing?: { observedSlot?: number; motionMode?: number };
  resetStartedAt?: number;
}

export interface CadencePeerState {
  slot: number;
  fixed: boolean;
  tier: number;
  collisionMode: number;
  loaded: boolean;
  lastReceipt: number;
  gap: number;
  target?: string;
  motionMode?: number;
  resetting?: boolean;
}

/** Selects distant peer motion recipients and scales stale collision contact. */
export class RacePeerCadence {
  localId: string;
  localSlot: number | undefined;
  peers = new Map<string, CadencePeerState>();
  lastTick = 0;
  previousMode: number | undefined;
  previousSuspended: boolean | undefined;
  disposed = false;
  raceId: string;
  special: boolean;

  constructor(race: CadenceRace, localId: string, specialMode: boolean) {
    this.localId = localId;
    this.raceId = race.raceId;
    this.special = specialMode;
    for (const participant of race.roster) {
      if (participant.playerId === localId) {
        this.localSlot = participant.slot;
        continue;
      }
      const itemId = participant.equipment?.itemIds[12];
      if (typeof itemId !== "number" || !Number.isInteger(itemId) ||
        itemId < 0 || itemId > 65_535 || this.peers.has(participant.playerId)) {
        throw new Error("Distance cadence requires frozen participant equipment");
      }
      const fixed = itemId !== 0;
      this.peers.set(participant.playerId, {
        slot: participant.slot,
        fixed,
        tier: fixed ? 1 : 2,
        collisionMode: 0,
        loaded: false,
        lastReceipt: 0,
        gap: 0,
      });
    }
  }

  updateRoom(room: CadenceRoom): void {
    if (this.disposed) return;
    if (room.race?.raceId !== this.raceId ||
      !room.members.some(member => member.playerId === this.localId)) {
      this.dispose();
      return;
    }
    this.localSlot = room.members.find(member => member.playerId === this.localId)!.slot;
    for (const [id, peer] of this.peers) {
      const member = room.members.find(candidate => candidate.playerId === id);
      if (!member) {
        this.peers.delete(id);
        continue;
      }
      if (peer.slot !== member.slot) {
        peer.slot = member.slot;
        peer.tier = peer.fixed ? 1 : 2;
        peer.collisionMode = 0;
      }
      peer.loaded = room.race.loadedIds.includes(id);
    }
  }

  recordReceipt(id: string, tick: number): void {
    const peer = this.peers.get(id);
    if (!peer || this.disposed) return;
    const receipt = Math.trunc(tick) >>> 0;
    peer.gap = peer.lastReceipt ? (receipt - peer.lastReceipt) >>> 0 : 0;
    peer.lastReceipt = receipt;
  }

  observe(id: string, motion: CadenceMotion): void {
    const peer = this.peers.get(id);
    if (!peer || this.disposed) return;
    const routing = motion.kind === "kinematic" ? motion.routing : undefined;
    peer.target = this.playerAt(routing?.observedSlot);
    peer.motionMode = routing?.motionMode;
    peer.resetting = motion.kind === "kinematic" && motion.resetStartedAt !== undefined;
  }

  /** The room slot of a racer (the local one included), as motion routing names it. */
  slotOf(id: string): number | undefined {
    return id === this.localId ? this.localSlot : this.peers.get(id)?.slot;
  }

  private playerAt(slot: number | undefined): string | undefined {
    if (slot === undefined) return undefined;
    if (slot === this.localSlot) return this.localId;
    for (const [id, peer] of this.peers) if (peer.slot === slot) return id;
    return undefined;
  }

  select(
    tick: number,
    motionMode: number,
    suspended: boolean,
    position: RacePoint,
    remotePosition: (id: string) => RacePoint | undefined,
    directMotionAvailable: (slot: number) => boolean,
  ): number {
    if (this.disposed) return 0;

    let level = 0;
    for (let candidate = 1; candidate <= 5; candidate++) {
      if (Math.floor(this.lastTick / 2 ** (candidate + 5)) ===
        Math.floor(tick / 2 ** (candidate + 5))) {
        level = candidate - 1;
        break;
      }
      level = candidate;
    }
    this.lastTick = tick;
    const modeChanged = this.previousMode !== motionMode ||
      this.previousSuspended !== suspended;
    this.previousMode = motionMode;
    this.previousSuspended = suspended;
    if (!level) return 0;

    let recipients = 0;
    for (const peer of this.peers.values()) {
      if (!peer.loaded) continue;
      const targetPeer = peer.target ? this.peers.get(peer.target) : undefined;
      const targetPosition = peer.target === this.localId
        ? position
        : targetPeer?.loaded ? remotePosition(peer.target!) : undefined;
      if (this.special || motionMode !== 0 || suspended || modeChanged ||
        peer.motionMode !== 0 || peer.resetting || !targetPosition ||
        (peer.target !== this.localId &&
          (targetPeer?.motionMode !== 0 || targetPeer?.resetting))) {
        recipients |= 1 << peer.slot;
        peer.collisionMode = 0;
        continue;
      }
      if (peer.tier > level || ((recipients |= 1 << peer.slot), peer.fixed)) continue;

      // The release computes squared distance in float32 client coordinates.
      const dx = Math.fround(Math.fround(position.x) - Math.fround(targetPosition.x));
      const dz = Math.fround(Math.fround(-position.z) - Math.fround(-targetPosition.z));
      const dy = Math.fround(Math.fround(position.y) - Math.fround(targetPosition.y));
      const distanceSquared = Math.fround(Math.fround(
        Math.fround(dx * dx) + Math.fround(dz * dz),
      ) + Math.fround(dy * dy));
      peer.tier = distanceSquared < 1_600 && directMotionAvailable(peer.slot) ? 1
        : distanceSquared < 3_600 ? 2 : distanceSquared < 10_000 ? 3 : 4;
      peer.collisionMode = peer.tier;
    }
    return recipients;
  }

  collisionScale(id: string, rttMs: number | undefined): number {
    const peer = this.peers.get(id);
    if (this.disposed || !peer || peer.collisionMode !== 1 ||
      Math.fround(peer.gap) <= 180 || rttMs === undefined || rttMs > 100) {
      return 1;
    }
    return Math.fround(Math.pow(0.5, Math.fround(
      Math.fround(Math.fround(peer.gap) - Math.fround(180)) * Math.fround(0.025),
    )));
  }

  dispose(): void {
    this.disposed = true;
    this.peers.clear();
  }
}

/** Adjusts race collision impulses after the first contact at low frame rates. */
export class CollisionFramerateHistory {
  enabled: boolean;
  counter: { fps: number };
  previous = new Map<string, boolean>();

  constructor(enabled: boolean, opponentIds: readonly string[], counter: { fps: number }) {
    this.enabled = enabled;
    this.counter = counter;
    if (opponentIds.length > 7 || new Set(opponentIds).size !== opponentIds.length) {
      throw new Error("碰撞帧率历史缺少唯一的本局对手身份。");
    }
    for (const id of opponentIds) this.previous.set(id, false);
  }

  factor(id: string, scheduled: boolean): number {
    const wasColliding = this.previous.get(id);
    if (wasColliding === undefined) throw new Error("碰撞帧率历史收到本局之外的对手。");
    if (!this.enabled || !wasColliding) return 1;
    const fps = this.counter.fps;
    return fps < 30 ? 2
      : fps < 60 ? Math.fround(60 / fps)
        : fps === 60 || scheduled ? 1 : 0;
  }

  record(id: string, colliding: boolean): void {
    if (!this.previous.has(id)) throw new Error("碰撞帧率历史收到本局之外的对手。");
    this.previous.set(id, colliding);
  }

  dispose(): void {
    this.previous.clear();
  }
}
