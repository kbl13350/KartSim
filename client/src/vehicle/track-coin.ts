export interface CoinPosition { x: number; y: number; z: number }

export interface CoinView {
  stay(rotation: number): void;
  eaten(position: CoinPosition, atMs: number): void;
  hide(): void;
  destroy(): void;
}

export interface CoinResources {
  radius: number;
  eatenLifeMs: number;
}

/** Category-2 contact object for a collectible LTE track coin. */
export class TrackCoinContact {
  category = 2;
  active = true;
  removeRequested = false;
  state: "stay" | "pending" | "eaten" | "removed" = "stay";
  eatenAt = 0;
  target: CoinPosition | undefined;
  destroyed = false;

  constructor(
    public name: string,
    public position: CoinPosition,
    public resources: CoinResources,
    public view: CoinView,
    public kartPeer: (candidate: unknown) => boolean,
    public kartPosition: () => CoinPosition,
    public canCollect: () => boolean,
  ) {}

  /** Called by the track contact owner once per frame. */
  slot12(nowMs: number): void {
    if (this.destroyed) return;
    const now = nowMs >>> 0;
    if (this.state === "pending") {
      this.state = "eaten";
      this.eatenAt = now;
      this.view.eaten(this.kartPosition(), now);
      return;
    }
    if (this.state === "eaten") {
      if (((now - this.eatenAt) >>> 0) >= this.resources.eatenLifeMs) {
        this.state = "removed";
        this.removeRequested = true;
        this.active = false;
        this.target = undefined;
        this.view.hide();
      } else if (this.target) {
        this.view.eaten(this.kartPosition(), this.eatenAt);
      }
      return;
    }
    if (this.state === "stay") {
      const spin = Math.fround(
        Math.fround(Math.fround(now % 4000) * Math.fround(0.00050000002)) * Math.fround(3.141592),
      );
      this.view.stay(spin);
    }
  }

  /** Pair collision callback; mark an eligible nearby coin for collection. */
  slot13(candidate: unknown, _contact: unknown): void {
    if (this.destroyed || this.state !== "stay" || !this.kartPeer(candidate) || !this.canCollect()) return;
    const kart = this.kartPosition();
    const dx = Math.fround(kart.x - this.position.x);
    const dy = Math.fround(kart.y - this.position.y);
    const dz = Math.fround(kart.z - this.position.z);
    const distance = Math.fround(Math.sqrt(Math.fround(
      Math.fround(Math.fround(dx * dx) + Math.fround(dy * dy)) + Math.fround(dz * dz),
    )));
    if (!Number.isFinite(distance) || distance > this.resources.radius) return;
    this.state = "pending";
    this.target = kart;
  }

  commit(): void {}

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.removeRequested = true;
    this.target = undefined;
    this.view.destroy();
  }
}
