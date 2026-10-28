/** Visual notices only: the regular kart collision solver still owns impulses. */
export interface BraveRacer { playerId: string; team: 1 | 2 | null }
export interface BraveContact { playerId: string; targetId: string }
export interface BraveSignalConnection {
  sendBraveCollision(targetId: string): Promise<unknown>;
  subscribeBraveCollision(listener: (event: BraveContact) => void): () => void;
}
const observers = new WeakMap<object, (opponent: string) => void>();
/** Called only after a real kart pair impulse, never a wall or proximity test. */
export function noteBraveKartContact(physics: object, opponent: unknown): void {
  if (typeof opponent === "string") observers.get(physics)?.(opponent);
}
export class BraveSignals {
  active = false;
  selfHitAt = -Infinity;
  teamHitAt = -Infinity;
  private sentAt = -Infinity;
  private disposed = false;
  private readonly teams: Map<string, 1 | 2 | null>;
  private readonly unsubscribe: () => void;
  constructor(private readonly physics: object, private readonly playerId: string,
    roster: readonly BraveRacer[], private readonly connection: BraveSignalConnection,
    private readonly now: () => number) {
    this.teams = new Map(roster.map(racer => [racer.playerId, racer.team]));
    observers.set(physics, opponent => this.contact(opponent));
    this.unsubscribe = connection.subscribeBraveCollision(event => this.receive(event));
  }
  private enemies(first: string, second: string): boolean {
    const a = this.teams.get(first), b = this.teams.get(second);
    return (a === 1 || a === 2) && (b === 1 || b === 2) && a !== b;
  }
  private contact(opponent: string): void {
    if (this.disposed || !this.active || !this.enemies(this.playerId, opponent)) return;
    const now = this.now();
    if (now - this.selfHitAt >= 300) this.selfHitAt = now;
    if (now - this.sentAt < 350) return;
    this.sentAt = now;
    // A lost/late notice must not interrupt physics or change the result.
    void this.connection.sendBraveCollision(opponent).catch(() => {});
  }
  receive(event: BraveContact): void {
    if (this.disposed || !this.active || !this.enemies(event.playerId, event.targetId)) return;
    const now = this.now();
    if (event.playerId === this.playerId || event.targetId === this.playerId) {
      if (now - this.selfHitAt >= 300) this.selfHitAt = now;
    } else if (this.teams.get(event.playerId) === this.teams.get(this.playerId) ||
      this.teams.get(event.targetId) === this.teams.get(this.playerId)) this.teamHitAt = now;
  }
  setActive(active: boolean): void {
    this.active = active;
    if (!active) { this.selfHitAt = -Infinity; this.teamHitAt = -Infinity; }
  }
  dispose(): void {
    this.disposed = true;
    observers.delete(this.physics);
    this.unsubscribe();
  }
}
