import { Group, type Camera, type Matrix4, type Object3D } from "three";
import { ITEM_EFFECT_TUNING, VehicleItemEffects, type ItemEffectVehicle } from "../driving/item-effects";
import { DrivingAction } from "../input/driving-input";
import { carriedHazards } from "./hazard-scenery-items";
import { ItemIdx, type ItemCatalogLibrary } from "./item-catalog";
import type { ItemTrackObject } from "./item-cube-source";
import type { ItemPairWorld, ItemWorldMatrix } from "./item-cubes";
import type { ItemFxOps } from "./item-fx-assets";
import {
  createItemHazardField, createItemHazardSource, type ItemHazardField, type ItemHazardHit,
  type ItemHazardSource,
} from "./item-hazards";
import { itemCatalogFor } from "./item-race-map";
import { loadItemRacePresenter, type ItemPresenterPose, type ItemRacePresenter } from "./item-race-presenter";

/**
 * Speed races and time attack: the water mines the scenery carriers hold
 * (hazard-scenery-items.ts, factory robots and the like) trap karts the way a
 * track water mine does in an item race. Not in the release, whose speed
 * races have no hazards at all.
 *
 * - The local kart: the hazard field pairs with the race coordinator; a touch
 *   starts the physics bubble (`VehicleItemEffects` "trap", Affect.life, then
 *   the EscapeAffect blue shield), left/right mashing shortens it. No escape
 *   booster: speed rooms have no item boosts to explain one.
 * - Remote karts: speed rooms carry no item events, so each client shows a
 *   bubble on a racer that stops dead (from speed to still at once) right
 *   after running into a water mine, and ends it when that racer drives off
 *   (an early escape) or Affect.life runs out.
 * - Bare water mines (only a hidden marker, no carrier) stay item-race only,
 *   like their look.
 * - Legacy factory forceZone anchors retain their Set model and apply the
 *   existing item knockback with the source BML's Affect duration. They share
 *   the same trigger field/cooldown; they never enter the water-bubble heuristic.
 */

/**
 * Outside item races (no item input router): a left or right press shortens
 * the local kart's water bubble while it lasts.
 */
export function pressTrapEscape(
  effects: { readonly active?: ReadonlySet<string>; escapePress(): boolean } | undefined,
  transitions: readonly { action?: unknown; down?: boolean }[], racing: boolean): void {
  if (!racing || !effects?.active?.has("trap")) return;
  for (const transition of transitions)
    if (transition.down && (transition.action === DrivingAction.SteerLeft ||
        transition.action === DrivingAction.SteerRight)) effects.escapePress();
}

/** Items whose looks a trap needs; the effect plan always wants the shield and the water bomb. */
const TRAP_LOOK_ITEMS: ReadonlySet<number> = new Set([ItemIdx.waterMine, ItemIdx.waterBomb, ItemIdx.shield, ItemIdx.forceZone]);

/** [还原] Remote bubbles: how still a racer must be, and how soon after touching a mine. */
export const REMOTE_TRAP_TUNING = Object.freeze({
  /** Movement over `stillWindowMs` below which a racer counts as stopped. */
  stillDistanceM: 0.3,
  stillWindowMs: 250,
  /**
   * A bubble stops a kart dead: just before it stood still it was going at
   * least this fast (over `approachWindowMs`), unlike a kart braking to a halt.
   */
  approachSpeedMps: 5,
  approachWindowMs: 150,
  /** A stop this long after touching a mine is its bubble. */
  touchWindowMs: 800,
  /** A trapped racer this far from where it stopped has broken out. */
  escapeDistanceM: 1,
});

export interface HazardTrapMap {
  hazardSceneryObjects?: readonly ItemTrackObject[];
  renderScene?: { clientWorldElements?(node: object): ArrayLike<number> | undefined };
  environment: unknown;
  stageBinding: unknown;
}

/** The kart physics a trap acts on: `itemEffects` is added when the race has none. */
export type HazardTrapPhysics = ItemEffectVehicle & { itemEffects?: VehicleItemEffects };

export interface HazardTrapAttach {
  physics: HazardTrapPhysics;
  playerId: string;
  /** Racing, not resetting or warping (the item race's `collecting`). */
  canTrigger(): boolean;
}

/** Remote racers this frame (multiplayer); empty in time attack. */
export interface HazardTrapRacer { playerId: string; pose: ItemPresenterPose }

interface RemoteTrap {
  /** Recent positions (three.js), newest last. */
  trail: Array<{ atMs: number; x: number; y: number; z: number }>;
  /** When this racer last touched a water mine, by hazard id. */
  touched: Map<number, number>;
  inside: Set<number>;
  trap?: { startMs: number; untilMs: number; x: number; y: number; z: number };
  shieldUntilMs: number;
}

type Vec3 = { x: number; y: number; z: number };
let current: HazardTraps | undefined;

/** The trap layer of the race being driven (time attack's input bridge reads it, like the 驾照 items). */
export function activeHazardTraps(): HazardTraps | undefined {
  return current;
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class HazardTraps {
  readonly object: Object3D;
  private field?: ItemHazardField;
  private attached?: HazardTrapAttach;
  private readonly remotes = new Map<string, RemoteTrap>();
  private escapeShieldShown = false;
  private nowMs = 0;
  private disposed = false;

  constructor(
    readonly source: ItemHazardSource,
    private readonly worldMatrix: ItemWorldMatrix | undefined,
    private readonly trapMs: number,
    private readonly escapeShieldMs: number,
    readonly presenter?: ItemRacePresenter,
    private readonly knockbackMs = 0,
  ) {
    this.object = presenter?.object ?? new Group();
  }

  /**
   * Pair a fresh hazard field with this race's coordinator (made anew by every
   * start) and give the kart its item effects; a bubble of the last start ends.
   */
  attach(world: ItemPairWorld, options: HazardTrapAttach): void {
    if (this.disposed) return;
    this.field?.dispose();
    const physics = options.physics;
    const effects = physics.itemEffects ??= new VehicleItemEffects(physics);
    effects.clear();
    effects.consumeEvents();
    this.reset();
    this.attached = options;
    current = this;
    const field = createItemHazardField(this.source, this.worldMatrix);
    field.attach(world, () => ({ ...physics.body.position }),
      () => options.canTrigger() && !effects.immune, hit => this.trigger(hit));
    this.field = field;
  }

  private trigger(hit: ItemHazardHit): void {
    const attached = this.attached;
    const effects = attached?.physics.itemEffects;
    if (!attached || !effects || this.disposed) return;
    const applied = hit.kind === "forceZone"
      ? this.knockbackMs > 0 && effects.apply("knockback", this.knockbackMs)
      : effects.apply("trap", this.trapMs, { escapeImmunityMs: this.escapeShieldMs, afterBoost: false });
    if (!applied) return;
    this.presenter?.hit({ useId: 0, itemId: hit.itemIdx, victimId: attached.playerId, result: "hit",
      atMs: this.nowMs, position: { ...hit.position } });
  }

  /** Left/right presses of this frame shorten the local kart's bubble. */
  escapeInput(transitions: readonly { action?: unknown; down?: boolean }[], racing: boolean): void {
    pressTrapEscape(this.attached?.physics.itemEffects, transitions, racing);
  }

  /** How the local kart is drawn lifted into its bubble now (the presenter's firedkart motion). */
  kartMotion(nowMs: number): Matrix4 | undefined {
    const playerId = this.attached?.playerId;
    return playerId === undefined ? undefined : this.presenter?.kartMotion?.(playerId, nowMs);
  }

  /** One rendered frame, after the track scene update (the mines follow its matrices). */
  present(nowMs: number, camera: unknown, width: number, height: number,
    local: ItemPresenterPose | undefined, remotes: readonly HazardTrapRacer[] = []): void {
    if (this.disposed) return;
    this.nowMs = nowMs;
    this.field?.update(nowMs);
    this.presentLocal(nowMs);
    this.watchRemotes(nowMs, remotes);
    const presenter = this.presenter;
    const playerId = this.attached?.playerId;
    if (!presenter || playerId === undefined || !camera) return;
    presenter.update({
      nowMs, camera: camera as Camera, width, height, localPlayerId: playerId,
      pose: id => id === playerId ? local : remotes.find(racer => racer.playerId === id)?.pose,
    });
  }

  /** The local bubble and blue shield, from the physics effect events (the item controller's way). */
  private presentLocal(nowMs: number): void {
    const attached = this.attached;
    const effects = attached?.physics.itemEffects;
    if (!attached || !effects) return;
    const playerId = attached.playerId;
    for (const event of effects.consumeEvents()) {
      if (event.kind !== "trap" && event.kind !== "knockback") continue;
      if (event.phase === "end") {
        this.presenter?.endKartEffect(playerId, event.kind);
        continue;
      }
      const running = effects.effects.get(event.kind);
      if (running) this.presenter?.kartEffect(playerId, event.kind,
        nowMs - (effects.clockMs - running.startMs), running.endMs - running.startMs,
        event.kind === "knockback" ? { itemId: ItemIdx.forceZone } : undefined);
    }
    const shieldMs = effects.escapeShieldRemainingMs;
    if (shieldMs > 0 && !this.escapeShieldShown) {
      this.escapeShieldShown = true;
      this.presenter?.kartEffect(playerId, "escapeShield", nowMs, shieldMs);
    } else if (shieldMs <= 0 && this.escapeShieldShown) {
      this.escapeShieldShown = false;
      this.presenter?.endKartEffect(playerId, "escapeShield");
    }
  }

  /**
   * A remote racer is in a bubble when it stops dead within `touchWindowMs`
   * of touching a water mine; the bubble ends at Affect.life or when it
   * moves off, then its blue shield runs.
   */
  private watchRemotes(nowMs: number, racers: readonly HazardTrapRacer[]): void {
    const tuning = REMOTE_TRAP_TUNING;
    const seen = new Set<string>();
    for (const { playerId, pose } of racers) {
      seen.add(playerId);
      let state = this.remotes.get(playerId);
      if (!state) this.remotes.set(playerId, state = { trail: [], touched: new Map(), inside: new Set(),
        shieldUntilMs: 0 });
      const at = pose.position;
      state.trail.push({ atMs: nowMs, x: at.x, y: at.y, z: at.z });
      const keepMs = tuning.stillWindowMs + tuning.approachWindowMs;
      while (state.trail.length > 2 && nowMs - state.trail[1]!.atMs >= keepMs) state.trail.shift();
      for (const hazard of this.source.hazards) {
        // Spring hits already move the remote kart through its replicated pose;
        // the stop-to-bubble heuristic applies only to water mines.
        if (hazard.kind !== "waterMine") continue;
        const position = this.field?.position(hazard.id);
        const inside = !!position && distance(at, position) <= hazard.radius;
        if (inside && !state.inside.has(hazard.id)) state.touched.set(hazard.id, nowMs);
        if (inside) state.inside.add(hazard.id);
        else state.inside.delete(hazard.id);
      }
      const trap = state.trap;
      if (trap) {
        if (nowMs >= trap.untilMs) {
          state.trap = undefined;
          state.shieldUntilMs = trap.untilMs + this.escapeShieldMs;
          this.presenter?.kartEffect(playerId, "escapeShield", trap.untilMs, this.escapeShieldMs);
        } else if (nowMs - trap.startMs >= ITEM_EFFECT_TUNING.escapeMinimumMs &&
            distance(at, trap) > tuning.escapeDistanceM) {
          state.trap = undefined;
          state.shieldUntilMs = nowMs + this.escapeShieldMs;
          this.presenter?.endKartEffect(playerId, "trap");
          this.presenter?.kartEffect(playerId, "escapeShield", nowMs, this.escapeShieldMs);
        }
        continue;
      }
      if (nowMs < state.shieldUntilMs) continue;
      // Still since `stillWindowMs` ago, and fast in the `approachWindowMs` before that.
      const stillFrom = [...state.trail].reverse().find(point => nowMs - point.atMs >= tuning.stillWindowMs);
      const approach = state.trail[0]!;
      if (!stillFrom || distance(at, stillFrom) >= tuning.stillDistanceM ||
          stillFrom.atMs - approach.atMs < tuning.approachWindowMs * 0.5 ||
          distance(stillFrom, approach) / ((stillFrom.atMs - approach.atMs) / 1000) < tuning.approachSpeedMps) continue;
      let hazardId: number | undefined;
      for (const [id, touchedAt] of state.touched) {
        if (nowMs - touchedAt <= tuning.touchWindowMs) hazardId = id;
        else state.touched.delete(id);
      }
      if (hazardId === undefined) continue;
      state.touched.clear();
      const startMs = stillFrom.atMs;
      state.trap = { startMs, untilMs: startMs + this.trapMs, x: at.x, y: at.y, z: at.z };
      const hazard = this.source.hazards.find(entry => entry.id === hazardId)!;
      const position = this.field?.position(hazardId);
      this.presenter?.hit({ useId: 0, itemId: hazard.itemIdx, victimId: playerId, result: "hit", atMs: startMs,
        ...(position ? { position } : {}) });
      this.presenter?.kartEffect(playerId, "trap", startMs, this.trapMs, { itemId: hazard.itemIdx });
    }
    for (const playerId of [...this.remotes.keys()]) if (!seen.has(playerId)) this.remotes.delete(playerId);
  }

  /** Forget every bubble shown (a restart). */
  reset(): void {
    this.remotes.clear();
    this.escapeShieldShown = false;
    this.presenter?.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (current === this) current = undefined;
    this.field?.dispose();
    this.presenter?.dispose();
    this.object.removeFromParent();
  }
}

/**
 * The trap owner of a speed or time-attack map: carried water mines and the
 * legacy factory springs. A presenter that cannot load only costs the looks.
 */
export async function loadHazardTraps<Archive extends ItemCatalogLibrary>(
  library: Archive,
  map: HazardTrapMap,
  audioContext: unknown,
  ops: ItemFxOps<Archive>,
): Promise<HazardTraps | undefined> {
  const objects = map.hazardSceneryObjects ?? [];
  const mines = new Set(carriedHazards(objects).filter(hazard => hazard.kind === "waterMine" || hazard.kind === "forceZone")
    .map(hazard => hazard.anchor));
  const trackObjects = objects.filter(object => mines.has(object.object as object));
  if (trackObjects.length === 0) return undefined;
  const catalog = await itemCatalogFor(library);
  const source = createItemHazardSource({ root: { kind: "track", trackObjects: [...trackObjects] } }, catalog);
  if (source.hazards.length === 0) return undefined;
  const behaviour = catalog.get(ItemIdx.waterMine)?.behaviour;
  const spring = catalog.get(ItemIdx.forceZone)?.behaviour;
  if (source.hazards.some(hazard => hazard.kind === "waterMine") && !behaviour?.effectMs)
    throw Error("水雷缺少 Affect 时长。");
  if (source.hazards.some(hazard => hazard.kind === "forceZone") && !spring?.effectMs)
    throw Error("弹性陷阱缺少 Affect 时长。");
  const scene = map.renderScene;
  const worldMatrix: ItemWorldMatrix | undefined = scene?.clientWorldElements
    ? node => scene.clientWorldElements!(node) : undefined;
  let presenter: ItemRacePresenter | undefined;
  try {
    const narrowed = { ...catalog, items: catalog.items.filter(item => TRAP_LOOK_ITEMS.has(item.idx)) };
    presenter = await loadItemRacePresenter(library, narrowed, map.environment, map.stageBinding,
      audioContext as never, ops);
  } catch (error) {
    console.warn("赛道水雷特效未能载入", error);
  }
  return new HazardTraps(source, worldMatrix, behaviour?.effectMs ?? 0, behaviour?.escapeShieldMs ?? 0,
    presenter, spring?.effectMs ?? 0);
}
