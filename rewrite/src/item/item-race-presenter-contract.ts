import type { Camera, Object3D } from "three";

/**
 * The item race presenter contract (道具赛表现层, ITEM_MODE.md §7) as the item
 * race controller calls it. The presenter itself (projectiles, placed objects,
 * kart effects, sounds; `item-race-presenter.ts`) is created with the race
 * assets as `assets.itemPresenter` and is undefined outside item races.
 *
 * Coordinates are three.js world space (y-up), the space of the physics
 * `body.position` and of the cube field. Times are local milliseconds on the
 * race presenter clock: the clock of `toLocalTick(serverMs, mapping)` and of
 * the presenter's `nowMs`.
 */

export interface ItemPresenterVec3 { x: number; y: number; z: number }

export interface ItemPresenterPose {
  position: ItemPresenterVec3;
  right: ItemPresenterVec3;
  forward: ItemPresenterVec3;
  up: ItemPresenterVec3;
}

export interface ItemPresenterFrame {
  nowMs: number;
  camera: Camera;
  width: number;
  height: number;
  /** Local and remote karts; undefined for a racer without a pose yet. */
  pose(playerId: string): ItemPresenterPose | undefined;
  localPlayerId: string;
}

export type ItemKartEffect = "trap" | "spin" | "launch" | "reverse" | "slow" | "shrink" |
  "barrier" | "pull" | "shield" | "angel" | "emp" | "escapeShield" | "timeBomb";

export interface ItemPresenterUse {
  useId: number;
  itemId: number;
  userId: string;
  targets: readonly string[];
  startMs: number;
  etaMs: number;
  point?: ItemPresenterVec3;
}

export interface ItemPresenterPlacement {
  useId: number;
  itemId: number;
  userId: string;
  point: ItemPresenterVec3;
  startMs: number;
}

export interface ItemPresenterHit {
  useId: number;
  itemId: number;
  victimId: string;
  userId?: string;
  result: "hit" | "blocked";
  by?: string;
  atMs: number;
  position?: ItemPresenterVec3;
}

export interface ItemRacePresenter {
  /** Added to the track group once. */
  readonly object: Object3D;
  /** Every `used` event, the local racer's own uses included. */
  used(event: ItemPresenterUse): void;
  placed(event: ItemPresenterPlacement): void;
  hit(event: ItemPresenterHit): void;
  /** A placed object is gone (a banana that was run over). */
  removed(useId: number): void;
  kartEffect(playerId: string, kind: ItemKartEffect, startMs: number, durationMs: number): void;
  endKartEffect(playerId: string, kind: ItemKartEffect): void;
  sound(itemId: number, stem: string,
    options?: { position?: ItemPresenterVec3; key?: string; loop?: boolean }): void;
  stopSound(key: string): void;
  update(frame: ItemPresenterFrame): void;
  /** Forget all transient visuals (e.g. on race restart). */
  reset(): void;
  dispose(): void;
}
