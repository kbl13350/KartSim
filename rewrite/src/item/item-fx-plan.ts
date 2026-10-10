import { ITEM_RULES, ItemIdx, SPECIAL_ITEM_REGISTRY, type ItemCatalog, type ItemDefinition, type ItemState } from "./item-catalog";

/**
 * What the item race presenter shows and plays for each item (ITEM_MODE.md
 * appendix B), resolved from the original base-0 `item.bml` states. The data
 * follows one convention throughout: a state's `firing` model plays on the
 * user's kart, its `fired` model on the victim's kart and its `item` model is
 * the item object itself (projectile, thrown or placed object); `firingFx`,
 * `firedFx` and `itemFx` are the matching sounds, and the state's `life` is
 * how long the model shows. Models are authored around a kart origin in
 * client space (z up, the kart's nose at -y), so the presenter mounts every
 * one of them on a kart-like basis.
 */

/** Reconstruction constants of the presenter ([还原]: no original source). */
export const ITEM_FX_TUNING = Object.freeze({
  /** Projectiles fly this high above the kart origins they leave and reach. */
  projectileLiftM: 1,
  /** Peak height of the slight flight arc of missiles and water flies. */
  rocketArcM: 2.5,
  flyerArcM: 1.5,
  /** A projectile that reached its victim waits this long for the hit report. */
  projectileHoldMs: 1000,
  /** A trap that starts this soon after a hit uses that item's bubble (waterFly has its own). */
  trapCauseWindowMs: 1500,
  /** The time bomb's water balloon rides this high above the user's kart and pulses. */
  timeBombLiftM: 2.2,
  timeBombPulseScale: 0.18,
  timeBombPulseStartMs: 600,
  timeBombPulseEndMs: 160,
  /** Positional sounds: full volume within near, silent beyond far, linear between. */
  soundNearM: 15,
  soundFarM: 150,
  /** Stereo spread of positional sounds (1 = hard left/right like the track dummies). */
  soundPan: 0.7,
  /** A sound that could not start within this long after its time is dropped. */
  soundLateMs: 300,
  /** At most this many item sounds at once; a new one stops the oldest one-shot. */
  maxSounds: 24,
  /**
   * Model copies: preloaded per model, at most this many per model (8 racers).
   * Models that often show on several karts in the same instant (explosions,
   * shield blocks, bubbles, the angel's team cover) preload `preloadShared`.
   */
  preloadInstances: 1,
  preloadShared: 2,
  maxInstances: 8,
  /**
   * Copies of a placed object (`FxModel.placed`): every banana on the track
   * stays live for its 30 s and the server does not cap them, so its pool
   * grows far past the racer count; past this the newest waits for a copy.
   */
  placedMaxInstances: 64,
  /** Uses are forgotten after the server's use lifetime. */
  useLifetimeMs: 60_000,
});

/** A model the presenter can show; `key` names its instance pool. */
export interface FxModel {
  readonly key: string;
  /** Canonical `.1s` path (also the texture lookup directory). */
  readonly path: string;
  /** The state's life: how long the model normally shows. */
  readonly lifeMs: number;
  /** A model built from part of another one (see `derive` in item-fx-assets). */
  readonly derive?: "carriedBalloon";
  /** Copies assembled at load when not `preloadInstances`. */
  readonly preload?: number;
  /**
   * An object set on the track for its whole life (the thrown items' Set):
   * up to `placedMaxInstances` copies, and a shown one is never taken over by
   * a newer visual of the model, which waits for a free copy instead.
   */
  readonly placed?: true;
}

export type FxSound = string;

/** How a blocked hit of this item looks and sounds on the victim. */
export interface BlockFx { readonly model?: FxModel; readonly sound?: FxSound }

interface Common { readonly idx: number; readonly name: string; readonly block: BlockFx }

/** rocket, guideRocket, randomRocket, waterFly: a homing projectile, one per target. */
export interface ProjectileFx extends Common {
  readonly kind: "projectile";
  readonly flight: FxModel;
  readonly speed: number;
  readonly arcM: number;
  readonly launchSound?: FxSound;
  /** Shown on the victim when it hits (rocket 미사일폭발, water fly splash). */
  readonly impact?: FxModel;
  readonly impactSound?: FxSound;
  /** The victim's bubble while trapped (waterFly fired01). */
  readonly trap?: FxModel;
}

/** ufo: departs from the user, arrives over the victim, hovers while it slows, leaves. */
export interface UfoFx extends Common {
  readonly kind: "ufo";
  readonly depart: FxModel;
  readonly departSound?: FxSound;
  readonly approach: FxModel;
  readonly arriveSound?: FxSound;
  readonly hover: FxModel;
  readonly leave: FxModel;
}

/** magnet: the magnetic field on the user, pointed at the target. */
export interface MagnetFx extends Common { readonly kind: "magnet"; readonly field: FxModel }

/** banana, waterBomb: thrown to the use point, then set there. */
export interface ThrowFx extends Common {
  readonly kind: "throw";
  readonly flight: FxModel;
  readonly launchSound?: FxSound;
  readonly set: FxModel;
  readonly setSound?: FxSound;
  /** The banana's drop distance behind (negative) or the bomb's throw ahead. */
  readonly fallbackDistanceM: number;
  readonly hitSound?: FxSound;
  readonly trap?: FxModel;
}

/** timeBomb: a balloon on the user's kart, then a burst where it explodes. */
export interface TimeBombFx extends Common {
  readonly kind: "timeBomb";
  readonly carried: FxModel;
  readonly launchSound?: FxSound;
  readonly burst: FxModel;
  readonly burstSound?: FxSound;
  readonly hitSound?: FxSound;
  readonly trap?: FxModel;
}

/** barricade: thrown up by the user, then falls, stands and breaks at the placed point. */
export interface BarricadeFx extends Common {
  readonly kind: "barricade";
  readonly launch: FxModel;
  readonly launchSound?: FxSound;
  readonly rise: FxModel;
  readonly riseSound?: FxSound;
  readonly active: FxModel;
  readonly end: FxModel;
  readonly endSound?: FxSound;
}

/** cloud2: thrown up by the user; the screen cover is the HUD's. */
export interface CloudFx extends Common {
  readonly kind: "cloud";
  readonly launch: FxModel;
  readonly bornSound?: FxSound;
  /** The cover lasts Use + Set; Remove plays its sound for each covered racer. */
  readonly coverMs: number;
  readonly removeSound?: FxSound;
}

/** thunderbolt and devil: thrown by the user, a warning then a strike or curse on each target. */
export interface CurseFx extends Common {
  readonly kind: "curse";
  readonly launch: FxModel;
  readonly launchSound?: FxSound;
  readonly warning: FxModel;
  readonly warningSound?: FxSound;
  /** thunderbolt's Preaffect strike right before the effect (devil has none). */
  readonly strike?: FxModel;
  readonly strikeSound?: FxSound;
  /** On the victim while the kart effect lasts. */
  readonly affect: FxModel;
  readonly affectSound?: FxSound;
  /** devil's Escape after the effect. */
  readonly after?: FxModel;
  readonly afterSound?: FxSound;
}

/** slotLock: thrown by the user, a lock on each target. */
export interface LockFx extends Common {
  readonly kind: "lock";
  readonly launch: FxModel;
  readonly launchSound?: FxSound;
  readonly affect: FxModel;
  readonly affectSound?: FxSound;
}

/** shield, angel, emp, scanning: a model on the protected karts. */
export interface AuraFx extends Common {
  readonly kind: "aura";
  readonly effect: "shield" | "angel" | "emp" | "scan";
  readonly model: FxModel;
  readonly durationMs: number;
  readonly useSound?: FxSound;
  readonly startSound?: FxSound;
  /** angel covers the whole team (the use's targets); the others only the user. */
  readonly onTargets: boolean;
}

/** Track hazards (mine, waterMine): the track draws them, the presenter the hit. */
export interface HazardFx extends Common {
  readonly kind: "hazard";
  readonly impact?: FxModel;
  readonly impactSound?: FxSound;
  readonly burst?: FxModel;
  readonly burstSound?: FxSound;
  readonly hitSound?: FxSound;
  readonly trap?: FxModel;
}

/** booster: the kart's own booster flame and sound (physics state 3). */
export interface NoFx extends Common { readonly kind: "none" }

export type ItemFx = ProjectileFx | UfoFx | MagnetFx | ThrowFx | TimeBombFx | BarricadeFx |
  CloudFx | CurseFx | LockFx | AuraFx | HazardFx | NoFx;

/** Kart effect visuals shared by several items. */
export interface SharedFx {
  /** The water bubble of a trapped kart (common 물방울갇힘_일반). */
  readonly trap: FxModel;
  /** The blue shield after a bubble (common 파란방패). */
  readonly escapeShield: FxModel;
}

export interface ItemFxPlan {
  readonly items: ReadonlyMap<number, ItemFx>;
  readonly shared: SharedFx;
  /** Every model the plan can show, deduplicated by pool key. */
  readonly models: readonly FxModel[];
  /** Every sound the plan plays plus the aim sounds the controller asks for. */
  readonly sounds: readonly FxSound[];
  /** Resolve a sound stem of an item (the controller's `sound()`); undefined if missing. */
  sound(idx: number, stem: string): FxSound | undefined;
}

/**
 * Models without meshes: kart-motion tracks (one animated `firedkart` node)
 * that the physics effects already perform (banana spin, rocket AffectSmall).
 */
export const KART_MOTION_MODELS: ReadonlySet<string> = new Set(["item/common/당함.1s", "item/rocket/fired03.1s"]);

class PlanBuilder {
  readonly models = new Map<string, FxModel>();
  readonly sounds = new Set<FxSound>();
  readonly missing: string[] = [];

  constructor(readonly catalog: ItemCatalog) {}

  state(def: ItemDefinition, name: string): ItemState | undefined {
    return def.states.get(name);
  }

  life(def: ItemDefinition, name: string): number {
    return this.state(def, name)?.lifeMs ?? 0;
  }

  /** A model of a state attribute (`item`, `firing`, `fired`), resolved with the item/common fallback. */
  model(def: ItemDefinition, stateName: string, attribute: "item" | "firing" | "fired",
    lifeMs?: number): FxModel | undefined {
    const state = this.state(def, stateName);
    const stem = state?.[attribute];
    if (!state || !stem) return undefined;
    return this.path(def, stem, lifeMs ?? state.lifeMs);
  }

  path(def: Pick<ItemDefinition, "folder" | "name">, stem: string, lifeMs: number,
    derive?: FxModel["derive"]): FxModel | undefined {
    const path = this.catalog.resolveModel(def as ItemDefinition, stem);
    if (!path) {
      this.missing.push(`item/${def.folder}/${stem}.1s`);
      return undefined;
    }
    if (KART_MOTION_MODELS.has(path)) return undefined;
    const key = derive ? `${path}#${derive}` : path;
    const known = this.models.get(key);
    // One pool per model: the first state that names it gives the default life.
    if (known) return { ...known, lifeMs };
    const model: FxModel = derive ? { key, path, lifeMs, derive } : { key, path, lifeMs };
    this.models.set(key, model);
    return model;
  }

  /** A sound of a state attribute (`itemFx`, `firingFx`, `firedFx`), with the catalog's fallbacks. */
  sound(def: ItemDefinition, stateName: string,
    attribute: "itemFx" | "firingFx" | "firedFx"): FxSound | undefined {
    const stem = this.state(def, stateName)?.[attribute];
    return stem ? this.stem(def, stem) : undefined;
  }

  stem(def: ItemDefinition, stem: string): FxSound | undefined {
    const path = this.catalog.resolveSound(def, stem);
    if (!path) {
      this.missing.push(`sound_/fx/item/${def.folder}/${stem}`);
      return undefined;
    }
    this.sounds.add(path);
    return path;
  }

  require<T>(value: T | undefined, what: string): T {
    if (value === undefined) throw Error(`道具表现缺少 ${what}。`);
    return value;
  }

  /** The blocked look: the item's own Shield/StateShield/RocketShield (or SpecialShield) model, else the shield's 쉴드방어. */
  block(def: ItemDefinition, shield: ItemDefinition): BlockFx {
    for (const name of ["Shield", "StateShield", "RocketShield", "SpecialShield"]) {
      const state = this.state(def, name);
      if (!state) continue;
      const stem = state.fired ?? state.firing;
      if (!stem && name === "SpecialShield") continue;
      const model = stem ? this.path(def, stem, state.lifeMs) : undefined;
      const fx = state.firedFx ?? state.firingFx;
      return {
        model: model ?? this.model(shield, "Shield", "firing"),
        sound: (fx ? this.stem(def, fx) : undefined) ?? this.sound(shield, "Shield", "firingFx"),
      };
    }
    return { model: this.model(shield, "Shield", "firing"), sound: this.sound(shield, "Shield", "firingFx") };
  }
}

/** Resolve the presenter's models and sounds for the catalog's item set. */
export function buildItemFxPlan(catalog: ItemCatalog): ItemFxPlan {
  const b = new PlanBuilder(catalog);
  const item = (idx: number) => b.require(catalog.get(idx), `道具 ${idx}`);
  const shield = item(ItemIdx.shield);
  const waterBomb = item(ItemIdx.waterBomb);
  const shared: SharedFx = {
    trap: b.require(b.model(waterBomb, "Affect", "fired"), "waterBomb Affect fired"),
    escapeShield: b.require(b.model(waterBomb, "EscapeAffect", "item"), "waterBomb EscapeAffect item"),
  };
  const items = new Map<number, ItemFx>();
  for (const def of catalog.items) {
    const common = { idx: def.idx, name: def.name, block: b.block(def, shield) };
    const fx = buildOne(b, def, common, waterBomb);
    items.set(def.idx, fx);
  }
  // The controller's aim sounds (Aim auxFx0..3) are preloaded too.
  for (const def of catalog.items) {
    const aim = def.states.get("Aim");
    for (const stem of aim?.auxFx ?? []) b.stem(def, stem);
  }
  const shared2 = [shared.trap, shared.escapeShield,
    (items.get(ItemIdx.rocket) as ProjectileFx | undefined)?.impact,
    items.get(ItemIdx.rocket)?.block.model,
    (items.get(ItemIdx.angel) as AuraFx | undefined)?.model];
  for (const model of shared2) if (model) b.models.set(model.key,
    { ...b.models.get(model.key)!, preload: ITEM_FX_TUNING.preloadShared });
  // Thrown objects stay where they were set (a banana for 30 s), as many as were thrown.
  for (const fx of items.values()) if (fx.kind === "throw")
    b.models.set(fx.set.key, { ...b.models.get(fx.set.key)!, placed: true });
  if (b.missing.length > 0) console.warn(`道具表现资源缺失：${[...new Set(b.missing)].join("、")}`);
  return {
    items,
    shared,
    models: [...b.models.values()],
    sounds: [...b.sounds],
    sound: (idx, stem) => {
      const def = catalog.get(idx);
      return def ? catalog.resolveSound(def, stem) : undefined;
    },
  };
}

function buildOne(b: PlanBuilder, def: ItemDefinition, common: Common, waterBomb: ItemDefinition): ItemFx {
  const need = <T>(value: T | undefined, what: string) => b.require(value, `${def.name} ${what}`);
  switch (def.name) {
    case "rocket":
    case "guideRocket":
    case "randomRocket":
      return { ...common, kind: "projectile",
        flight: need(b.model(def, "Use", "item"), "Use item"),
        speed: ITEM_RULES.rocketSpeed, arcM: ITEM_FX_TUNING.rocketArcM,
        launchSound: b.sound(def, "Use", "itemFx"),
        impact: b.model(def, "Affect", "fired"), impactSound: b.sound(def, "Affect", "itemFx") };
    case "waterFly":
      return { ...common, kind: "projectile",
        flight: need(b.model(def, "Use", "item"), "Use item"),
        speed: ITEM_RULES.flyerSpeed, arcM: ITEM_FX_TUNING.flyerArcM,
        launchSound: b.sound(def, "Use", "itemFx"),
        impact: b.model(def, "Affect", "item"), impactSound: b.sound(def, "Affect", "firedFx"),
        trap: b.model(def, "Affect", "fired") };
    case "ufo":
      return { ...common, kind: "ufo",
        depart: need(b.model(def, "Use", "firing"), "Use firing"),
        departSound: b.sound(def, "Use", "firingFx"),
        approach: need(b.model(def, "Use", "fired"), "Use fired"),
        arriveSound: b.sound(def, "Use", "firedFx"),
        hover: need(b.model(def, "Affect", "fired"), "Affect fired"),
        leave: need(b.model(def, "PostAffect", "fired"), "PostAffect fired") };
    case "magnet":
      return { ...common, kind: "magnet", field: need(b.model(def, "Use", "item"), "Use item") };
    case "banana":
    case "waterBomb":
      return { ...common, kind: "throw",
        flight: need(b.model(def, "Use", "item"), "Use item"),
        launchSound: b.sound(def, "Use", "itemFx"),
        set: need(b.model(def, "Set", "item"), "Set item"),
        setSound: b.sound(def, "Set", "itemFx"),
        fallbackDistanceM: def.name === "banana"
          ? -(def.behaviour.distance ?? ITEM_RULES.bananaDropDistance)
          : def.behaviour.distance ?? ITEM_RULES.waterBombForwardDistance,
        hitSound: b.sound(def, "Affect", "firedFx"),
        trap: b.model(def, "Affect", "fired") };
    case "timeBomb":
      return { ...common, kind: "timeBomb",
        // [还原] The data has no model for the bomb riding on the kart (Use only
        // has its sound); the water bomb's own thrown balloon stands in for it.
        carried: need(b.path(waterBomb, need(waterBomb.states.get("Use")?.item, "carried balloon"),
          b.life(def, "Use"), "carriedBalloon"), "carried balloon"),
        launchSound: b.sound(def, "Use", "itemFx"),
        burst: need(b.model(def, "Set", "item"), "Set item"),
        burstSound: b.sound(def, "Set", "itemFx"),
        hitSound: b.sound(def, "Affect", "firedFx"),
        trap: b.model(def, "Affect", "fired") };
    case "barricade":
      return { ...common, kind: "barricade",
        launch: need(b.model(def, "StateUse", "firing"), "StateUse firing"),
        launchSound: b.sound(def, "StateUse", "firingFx"),
        rise: need(b.model(def, "StateSet", "item"), "StateSet item"),
        riseSound: b.sound(def, "StateSet", "itemFx"),
        active: need(b.model(def, "StateActive", "item"), "StateActive item"),
        end: need(b.model(def, "StateEnd", "item"), "StateEnd item"),
        endSound: b.sound(def, "StateEnd", "itemFx") };
    case "cloud2":
      return { ...common, kind: "cloud",
        launch: need(b.model(def, "Use", "firing"), "Use firing"),
        bornSound: b.sound(def, "Use", "itemFx"),
        coverMs: b.life(def, "Use") + b.life(def, "Set"),
        removeSound: b.sound(def, "Remove", "itemFx") };
    case "thunderbolt":
      return { ...common, kind: "curse",
        launch: need(b.model(def, "Use", "firing"), "Use firing"),
        launchSound: b.sound(def, "Use", "itemFx"),
        warning: need(b.model(def, "Warning", "fired"), "Warning fired"),
        warningSound: b.sound(def, "Warning", "firedFx"),
        strike: need(b.model(def, "Preaffect", "fired"), "Preaffect fired"),
        strikeSound: b.sound(def, "Preaffect", "firedFx"),
        affect: need(b.model(def, "Affect", "fired"), "Affect fired"),
        affectSound: b.sound(def, "Affect", "firedFx") };
    case "devil":
      return { ...common, kind: "curse",
        launch: need(b.model(def, "Use", "firing"), "Use firing"),
        launchSound: b.sound(def, "Use", "itemFx"),
        warning: need(b.model(def, "Preaffect", "fired"), "Preaffect fired"),
        warningSound: b.sound(def, "Preaffect", "firedFx"),
        affect: need(b.model(def, "Affect", "fired"), "Affect fired"),
        after: b.model(def, "Escape", "fired"),
        afterSound: b.sound(def, "Escape", "firedFx") };
    case "slotLock":
      return { ...common, kind: "lock",
        launch: need(b.model(def, "Use", "firing"), "Use firing"),
        launchSound: b.sound(def, "Use", "itemFx"),
        affect: need(b.model(def, "Affect", "fired"), "Affect fired"),
        affectSound: b.sound(def, "Affect", "firedFx") };
    case "shield":
      return { ...common, kind: "aura", effect: "shield", onTargets: false,
        model: need(b.model(def, "Use", "firing"), "Use firing"),
        durationMs: def.behaviour.effectMs };
    case "angel":
      return { ...common, kind: "aura", effect: "angel", onTargets: true,
        model: need(b.model(def, "Affect", "fired"), "Affect fired"),
        durationMs: def.behaviour.effectMs,
        useSound: b.sound(def, "Use", "itemFx"), startSound: b.sound(def, "Affect", "firedFx") };
    case "emp":
      return { ...common, kind: "aura", effect: "emp", onTargets: false,
        model: need(b.model(def, "Affect", "fired"), "Affect fired"),
        durationMs: def.behaviour.effectMs,
        useSound: b.sound(def, "Use", "itemFx"), startSound: b.sound(def, "Affect", "firedFx") };
    case "scanning":
      return { ...common, kind: "aura", effect: "scan", onTargets: false,
        model: need(b.model(def, "Affect", "fired"), "Affect fired"),
        durationMs: def.behaviour.effectMs, startSound: b.sound(def, "Affect", "firedFx") };
    case "mine":
      return { ...common, kind: "hazard",
        impact: b.model(def, "Affect", "fired"), impactSound: b.sound(def, "Affect", "itemFx") };
    case "waterMine":
      return { ...common, kind: "hazard",
        burst: b.model(def, "Explode", "item"), burstSound: b.sound(def, "Explode", "itemFx"),
        hitSound: b.sound(def, "Affect", "firedFx"), trap: b.model(def, "Affect", "fired") };
    case "booster":
    case "teamBooster":
      return { ...common, kind: "none" };
    default:
      // item-mode(p3c): the special items of ITEM_MODE.md C.4 are in the catalog
      // now; until the phase-3 presenter plans them they show nothing here.
      if (SPECIAL_ITEM_REGISTRY.some(entry => entry.name === def.name)) return { ...common, kind: "none" };
      throw Error(`道具 ${def.name} 尚无表现定义。`);
  }
}
