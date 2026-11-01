import { deathmatchIdentity, type DeathmatchPlayer, type DeathmatchState } from "./deathmatch-rules";

const contacts = new WeakMap<object, (targetId: string) => void>();
/** Called by the existing solver only after a kart-pair impulse was actually applied. */
export function noteDeathmatchKartContact(physics: object, targetId: unknown): void {
  if (typeof targetId === "string") contacts.get(physics)?.(targetId);
}
export class DeathmatchRuntime {
  state: DeathmatchState;
  private readonly identity: string | undefined;
  private lifeSeq = 0;
  private contactSequence = 0;
  private readonly contactTimes = new Map<string, number>();
  private nowMs = 0;
  private offsetMs = 0;
  private racing = false;
  private disposed = false;
  private pendingFall = false;
  private ended = false;
  private startAt = 0;
  constructor(private readonly local: any, private readonly remotes: any,
    private readonly connection: { playerId: string; sendDeathmatchContact(targetId: string,
      sequence: number, lifeSeq: number, targetLifeSeq: number): Promise<unknown> },
    race: { deathmatch: DeathmatchState; roster: Array<{ playerId: string; team: number }> }) {
    this.state = structuredClone(race.deathmatch);
    this.identity = deathmatchIdentity(this.state);
    if (!this.identity) throw new Error("死斗冻结名单无效。");
    this.lifeSeq = this.self.lifeSeq;
    this.teams = new Map(race.roster.map(p => [p.playerId, p.team]));
    contacts.set(local.physics, id => this.contact(id));
    remotes.collisionAllowed = (id: string) => this.collidable(id);
    local.deathmatch = this;
  }
  private readonly teams: Map<string, number>;
  get self(): DeathmatchPlayer {
    const player = this.state.players[this.connection.playerId];
    if (!player) throw new Error("死斗冻结名单缺少本机车手。");
    return player;
  }
  get serverNow(): number { return this.nowMs + this.offsetMs; }
  get suspended(): boolean { return this.pendingFall || !this.self.alive || this.ended; }
  get protected(): boolean { return this.self.alive && this.serverNow < this.self.protectedUntil; }
  bindClock(mapping: { offsetMs: number }): void { this.offsetMs = mapping.offsetMs; }
  updateRoom(race: { deathmatch: DeathmatchState; startAt?: number }, phase: string): void {
    if (deathmatchIdentity(race.deathmatch) !== this.identity) throw new Error("死斗比赛规则或出生点发生变化。");
    if (race.deathmatch.eventSequence < this.state.eventSequence) return;
    this.state = structuredClone(race.deathmatch);
    this.startAt = race.startAt ?? this.startAt;
    this.ended = phase === "finished" || !!this.state.outcome;
    if (this.self.lifeSeq > this.lifeSeq) {
      this.lifeSeq = this.self.lifeSeq;
      this.pendingFall = false;
      this.contactTimes.clear();
      const frame = this.local.deathmatchStartPoses?.[this.self.spawnSlot];
      if (!frame) throw new Error("死斗原版出生点缺失。");
      this.local.physics.completeCheckpointPose(frame, true);
      this.local.track.resetRouteState(this.local.physics, this.local.physics.body.position);
      this.local.coordinator.synchronizePositionAnchor();
    }
    this.applyLock();
  }
  update(nowMs: number): void {
    this.nowMs = nowMs;
    this.racing = this.local.lifecycle.state === 2 && !this.ended;
    // Hold the body at the death plane until the reliable server life update arrives.
    // The frame sender still publishes this fallen position for server verification.
    if (this.racing && this.self.alive && this.local.physics.body.position.y <= this.state.fallY)
      this.pendingFall = true;
    this.applyLock();
  }
  private applyLock(): void {
    if (!this.suspended) {
      this.local.physics.setFullPhysicsBypass(false);
      if (this.local.lifecycle.state === 2) this.local.physics.setRaceMotionLocked(false);
      return;
    }
    this.local.physics.hardCancelControls();
    this.local.physics.setRaceMotionLocked(true);
    this.local.physics.setFullPhysicsBypass(true);
  }
  collidable(id: string): boolean {
    const p = this.state.players[id];
    return !this.disposed && this.racing && !this.suspended && !this.protected &&
      !!p?.alive && this.serverNow >= p.protectedUntil;
  }
  private contact(id: string): void {
    const target = this.state.players[id];
    if (!target || !this.collidable(id) || this.teams.get(id) === this.teams.get(this.connection.playerId) ||
        this.nowMs - (this.contactTimes.get(id) ?? -Infinity) < 350) return;
    this.contactTimes.set(id, this.nowMs);
    void this.connection.sendDeathmatchContact(id, ++this.contactSequence,
      this.self.lifeSeq, target.lifeSeq).catch(() => {});
  }
  opacity(id: string): number {
    const p = this.state.players[id];
    return !p?.alive || (id === this.connection.playerId && this.pendingFall) ? 0
      : this.serverNow < p.protectedUntil ? 0.4 : 1;
  }
  hudState(nowMs: number) {
    const serverNow = nowMs + this.offsetMs, self = this.self;
    return { scores: this.state.scores,
      remainingMs: Math.max(0, this.state.timeLimitMs - (serverNow - this.startAt)),
      respawnRemainingMs: self.alive ? 0 : Math.max(0, (self.respawnAt ?? serverNow) - serverNow),
      protectedRemainingMs: Math.max(0, self.protectedUntil - serverNow),
      kills: self.kills, deaths: self.deaths, team: this.teams.get(this.connection.playerId) as 1 | 2,
      finished: this.ended, outcome: this.state.outcome };
  }
  dispose(): void {
    this.disposed = true;
    contacts.delete(this.local.physics);
    this.remotes.collisionAllowed = undefined;
  }
}
