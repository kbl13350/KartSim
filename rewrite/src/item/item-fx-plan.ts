import { ITEM_RULES, ItemIdx, type ItemBml, type ItemCatalog, type ItemDefinition, type ItemState } from "./item-catalog";

/**
 * What the item race presenter shows and plays for each item (ITEM_MODE.md
 * appendix B and C.4), resolved from the original `item.bml` states of each
 * item's own folder and variant (base). The data follows one convention
 * throughout: a state's `firing` model plays on the user's kart, its `fired`
 * model on the victim's kart and its `item` model is the item object itself
 * (projectile, thrown or placed object); `firingFx`, `firedFx` and `itemFx`
 * are the matching sounds, and the state's `life` is how long the model
 * shows. Models are authored around a kart origin in client space (z up, the
 * kart's nose at -y), so the presenter mounts every one of them on a
 * kart-like basis.
 *
 * Which presentation an item gets is its family (`ITEM_FX_FAMILY`, by idx,
 * after the families of appendix C.4); the models and sounds always come
 * from the item's own definition (`ItemCatalog.get(idx)`: folder, base and
 * the states of that base), never from base 0 of another item.
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
  /**
   * A kart effect that starts this soon after a hit takes that item's look
   * (the bubble of the water fly, the lockdown's hold, a tiger missile's slow
   * without the UFO); later or without a hit it takes the default look.
   */
  trapCauseWindowMs: 1500,
  /** The second missile of a two-missile kart (useTwoRocket, ITEM_MODE.md C.2). */
  secondShotDelayMs: 200,
  /** The time bomb's water balloon rides this high above the user's kart and pulses. */
  timeBombLiftM: 2.2,
  timeBombPulseScale: 0.18,
  timeBombPulseStartMs: 600,
  timeBombPulseEndMs: 160,
  /** An invisible (tigerGhost) kart as its teammates and its own racer see it. */
  ghostOpacity: 0.35,
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

/** The kart effects of the presenter contract (`ItemRacePresenter.kartEffect`). */
export type ItemKartEffect = "trap" | "spin" | "launch" | "reverse" | "slow" | "shrink" |
  "barrier" | "pull" | "shield" | "angel" | "emp" | "escapeShield" | "timeBomb" |
  "invincible" | "invisible" | "hold" | "knockback";

/** How one kart effect looks: on the kart for its duration, plus a tail after it. */
export interface KartVisual {
  readonly model?: FxModel;
  /** At the effect's start, on the kart. */
  readonly sound?: FxSound;
  /** After the effect (UFO PostAffect, devil Escape, the infected bombs' item lock). */
  readonly after?: FxModel;
  readonly afterSound?: FxSound;
  /** The time bomb's balloon: lifted above the kart and pulsing. */
  readonly pulse?: true;
}

/** Kart effects an item causes; a kind it does not list keeps the default look. */
export type KartVisuals = Partial<Readonly<Record<ItemKartEffect, KartVisual>>>;

/** How a blocked hit of this item looks and sounds on the victim. */
export interface BlockFx { readonly model?: FxModel; readonly sound?: FxSound }

/** A one-off look on the victim at a hit. */
export interface ImpactFx { readonly model?: FxModel; readonly sound?: FxSound }

/**
 * Presentation family by item idx (ITEM_MODE.md appendix B and C.4). The
 * catalog's definition gives the folder, base and states; the family only
 * picks how those states are staged.
 */
export type ItemFxFamily =
  | "rocket" | "blindRocket" | "lockdown" | "fly" | "bombFly" | "ufo" | "magnet"
  | "drop" | "throw" | "timeBomb" | "barricade" | "cloud" | "curse" | "lock"
  | "shield" | "angel" | "emp" | "scan" | "invincible" | "invisible" | "siren"
  | "beam" | "booster";

export const ITEM_FX_FAMILY: ReadonlyMap<number, ItemFxFamily> = new Map<number, ItemFxFamily>([
  // Missiles and their reskins: 7 rocket, 33 guide, 127 random; 32/102/107/126 gold
  // family, 30 coke (C.4 导弹换皮).
  ...[7, 33, 127, 32, 102, 107, 126, 30].map(idx => [idx, "rocket"] as const),
  // Slow-and-blind missiles 99/136/131/108 and the lion mask missile 134: no
  // explosion (their Affect has no model), the HUD covers the screen.
  ...[99, 136, 131, 108, 134].map(idx => [idx, "blindRocket"] as const),
  [104, "lockdown"], [117, "lockdown"],
  // Water flies (4, 118, 119) and the honey bee (132) fly at the flyer speed.
  ...[4, 118, 119, 132].map(idx => [idx, "fly"] as const),
  [120, "bombFly"],
  [3, "ufo"],
  [5, "magnet"], [103, "magnet"],
  // Dropped behind the kart (banana, giant banana, mines, water mine, force zone, oil).
  ...[8, 85, 17, 45, 82, 83, 129, 130, 37, 25, 46].map(idx => [idx, "drop"] as const),
  // Thrown ahead (water bomb and its variants).
  ...[9, 34, 20, 47, 27, 44].map(idx => [idx, "throw"] as const),
  ...[13, 21, 35, 28].map(idx => [idx, "timeBomb"] as const),
  [113, "barricade"], [135, "barricade"],
  [114, "cloud"], [1, "cloud"], [115, "cloud"],
  [2, "curse"], [38, "curse"], [23, "curse"], [111, "curse"],
  [110, "lock"],
  [10, "shield"], [18, "shield"],
  [11, "angel"], [12, "emp"], [109, "scan"],
  [36, "invincible"], [81, "invincible"],
  [101, "invisible"],
  [24, "siren"], [106, "siren"],
  [112, "beam"], [137, "beam"],
  [6, "booster"], [14, "booster"], [31, "booster"],
]);

interface Common {
  readonly idx: number;
  readonly name: string;
  readonly family: ItemFxFamily;
  /** Blocked by the shield item, the angel or another protection. */
  readonly block: BlockFx;
  /** Blocked by an equipment passive (`by:"kart"|"pet"`): the item's SpecialShield. */
  readonly special: BlockFx;
  /** The kart effects this item causes; kinds it does not list keep the default look. */
  readonly kart: KartVisuals;
  /** The kart effects of a `variant:"headband"` hit (the UFO's HeadBandAffect). */
  readonly headband?: KartVisuals;
  /** A `variant:"small"` or `"balloon"` hit: AffectSmall instead of the impact. */
  readonly small?: ImpactFx;
  /** A `variant:"bonus"` hit (UFO BonusAffect, lucci). */
  readonly bonus?: ImpactFx;
  /** Eaten by an equipment passive (`by:"eat"`): Eat, and EatBonus's lucci. */
  readonly eat?: { readonly model?: FxModel; readonly sound?: FxSound; readonly bonus?: FxModel };
  /** On the victim at every hit. */
  readonly hitSound?: FxSound;
}

/** Missiles and flies: a homing projectile per target (and per shot). */
export interface ProjectileFx extends Common {
  readonly kind: "projectile";
  readonly flight: FxModel;
  readonly speed: number;
  readonly arcM: number;
  readonly launchSound?: FxSound;
  /** On the user while it throws (lockdown EMP투척_01). */
  readonly launch?: FxModel;
  /** Shown on the victim when it hits (rocket 미사일폭발, water fly splash). */
  readonly impact?: FxModel;
  readonly impactSound?: FxSound;
  /** The lockdown missile's field: CountDown, then SetEmp around the target. */
  readonly field?: {
    readonly countdownMs: number;
    readonly countdownSound?: FxSound;
    readonly model?: FxModel;
    readonly sound?: FxSound;
  };
  /** waterbombFly: a ticking balloon on the target (CountDown), then the burst (Active). */
  readonly attach?: {
    readonly carried: FxModel;
    readonly countdownMs: number;
    readonly burst?: FxModel;
    readonly burstSound?: FxSound;
  };
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

/** snowman, talisman: thrown by the user, landing on the target (no projectile model). */
export interface BeamFx extends Common {
  readonly kind: "beam";
  readonly depart?: FxModel;
  readonly departSound?: FxSound;
  /** On the target, ending at the arrival (talisman Use fired00). */
  readonly approach?: FxModel;
  readonly arriveSound?: FxSound;
}

/** magnet: the magnetic field on the user, pointed at the target. */
export interface MagnetFx extends Common { readonly kind: "magnet"; readonly field: FxModel }

/** Thrown or dropped: flies to the use point, then is set there. */
export interface ThrowFx extends Common {
  readonly kind: "throw";
  readonly flight: FxModel;
  readonly launchSound?: FxSound;
  readonly set: FxModel;
  readonly setSound?: FxSound;
  /** The drop distance behind (negative) or the throw ahead. */
  readonly fallbackDistanceM: number;
  /** On the victim at a hit (the mines' 미사일폭발). */
  readonly impact?: FxModel;
  readonly impactSound?: FxSound;
  /** At the object at a hit (the force zone's push). */
  readonly itemImpact?: FxModel;
  /** At the object at a hit, over its trigger area (the water mine's Explode). */
  readonly burst?: FxModel;
  readonly burstSound?: FxSound;
  /** Mines and the water mine go off at their first hit. */
  readonly consumed: boolean;
}

/** timeBomb and its variants: a balloon on the user's kart, then a burst where it explodes. */
export interface TimeBombFx extends Common {
  readonly kind: "timeBomb";
  readonly carried: FxModel;
  readonly launchSound?: FxSound;
  readonly burst: FxModel;
  readonly burstSound?: FxSound;
}

/** barricade and abyssBarricade: thrown up by the user, then falls, stands and breaks at the placed point. */
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

/** cloud2 and the dark clouds: thrown up by the user; the screen cover is the HUD's. */
export interface CloudFx extends Common {
  readonly kind: "cloud";
  readonly launch?: FxModel;
  readonly bornSound?: FxSound;
  /** The cover lasts Use + Set; Remove plays its sound for each covered racer. */
  readonly coverMs: number;
  readonly removeSound?: FxSound;
}

/** thunderbolt and the devils: thrown by the user, a warning then a strike or curse on each target. */
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

export type AuraEffect = "shield" | "angel" | "emp" | "scan" | "invincible" | "invisible" | "siren";

/** Self items: a model on the protected (or boosted, or hidden) karts. */
export interface AuraFx extends Common {
  readonly kind: "aura";
  readonly effect: AuraEffect;
  readonly model?: FxModel;
  /** Before the model, on the user (sirenShield 라쳇쉴드_시작, tigerGhost effect_tigerEye). */
  readonly intro?: FxModel;
  readonly introSound?: FxSound;
  /** The model starts this long after the use (an Affect after its Use state). */
  readonly delayMs: number;
  readonly durationMs: number;
  readonly useSound?: FxSound;
  readonly startSound?: FxSound;
  /** angel covers the whole team (the use's targets); the others only the user. */
  readonly onTargets: boolean;
  /**
   * The use itself starts the model. EMP only plays on the racers it really
   * freed from a UFO and invisibility depends on who looks: those come from
   * the controller's `kartEffect` (ITEM_MODE.md C.1).
   */
  readonly fromUse: boolean;
}

/** booster: the kart's own booster flame and sound (physics state 3). */
export interface NoFx extends Common { readonly kind: "none" }

export type ItemFx = ProjectileFx | UfoFx | BeamFx | MagnetFx | ThrowFx | TimeBombFx | BarricadeFx |
  CloudFx | CurseFx | LockFx | AuraFx | NoFx;

/** Kart effect visuals shared by several items. */
export interface SharedFx {
  /** The water bubble of a trapped kart (common 물방울갇힘_일반). */
  readonly trap: FxModel;
  /** The blue shield after a bubble (common 파란방패). */
  readonly escapeShield: FxModel;
  /**
   * A balloon (equipment slot 9) that took a missile: `item/balloon/item.bml`
   * base 0, Affect (the pop) then Reborn (루찌획득, the lucci it pays).
   */
  readonly balloon?: {
    readonly popMs: number;
    readonly popSound?: FxSound;
    readonly rebornMs: number;
    readonly reborn?: FxModel;
    readonly rebornSound?: FxSound;
    readonly eatenSound?: FxSound;
  };
  /** The XUN start item's slot charger (`sound_/fx/charger`, 05_기타_슬롯차저_Large). */
  readonly chargerSound?: FxSound;
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
 * that the physics effects perform or stand in for (banana spin, rocket
 * AffectSmall, the abyss barricade's twist, the talisman's hit jolt). The
 * missile folders carry their own copies of fired03.
 */
export const KART_MOTION_MODELS: ReadonlySet<string> = new Set([
  "item/common/당함.1s", "item/common/fired03.1s", "item/rocket/fired03.1s",
  "item/goldRocket/fired03.1s", "item/cokeRocket/fired03.1s", "item/lockdownRocket/fired03.1s",
  "item/abyssBarricade/fired02_abyss.1s", "item/mine/fired02_abyss.1s", "item/talisman/fired00.1s",
]);

/**
 * Model stems that no state names but that the item ships for one purpose
 * ([还原]): waterbombFly's burst `item01` (물파리폭파중심, 1000 ms, the
 * length of its Active state) and the slow-and-blind missiles' victim cues
 * `rocketuse`/`rocketend` (sounds of their own folders).
 */
export const UNREFERENCED_ITEM_FILES = Object.freeze({
  waterbombFlyBurst: "item01",
  blindStartSound: "rocketuse",
  blindEndSound: "rocketend",
  headbandSound: "headBandAffecting",
});

/** sound_fx_charger.rho, mounted at `sound_/fx/charger/`. */
export const CHARGER_SOUND = "sound_/fx/charger/05_기타_슬롯차저_Large.ogg";

const SHIELD_STATES = ["Shield", "StateShield", "RocketShield"];

class PlanBuilder {
  readonly models = new Map<string, FxModel>();
  readonly sounds = new Set<FxSound>();
  readonly missing: string[] = [];

  constructor(readonly catalog: ItemCatalog) {}

  state(def: Pick<ItemDefinition, "states">, name: string): ItemState | undefined {
    return def.states.get(name);
  }

  life(def: Pick<ItemDefinition, "states">, name: string): number {
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

  /** The first model a state names, by attribute priority. */
  anyModel(def: ItemDefinition, stateName: string,
    order: ReadonlyArray<"item" | "firing" | "fired">, lifeMs?: number): FxModel | undefined {
    for (const attribute of order) {
      const model = this.model(def, stateName, attribute, lifeMs);
      if (model) return model;
    }
    return undefined;
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

  anySound(def: ItemDefinition, stateName: string,
    order: ReadonlyArray<"itemFx" | "firingFx" | "firedFx">): FxSound | undefined {
    for (const attribute of order) {
      const sound = this.sound(def, stateName, attribute);
      if (sound) return sound;
    }
    return undefined;
  }

  stem(def: Pick<ItemDefinition, "folder">, stem: string, optional = false): FxSound | undefined {
    const path = this.catalog.resolveSound(def as ItemDefinition, stem);
    if (!path) {
      if (!optional) this.missing.push(`sound_/fx/item/${def.folder}/${stem}`);
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
    for (const name of [...SHIELD_STATES, "SpecialShield"]) {
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

  /**
   * Blocked by an equipment passive: the item's SpecialShield (devil
   * 대마왕_방어효과, newDevil 강시_방어효과, …) when it has a model, else the
   * ordinary block look.
   */
  special(def: ItemDefinition, block: BlockFx): BlockFx {
    for (const name of ["SpecialShield", "StateSpecialShield", "RocketSpecialShield"]) {
      const state = this.state(def, name);
      const stem = state?.fired ?? state?.firing;
      if (!state || !stem) continue;
      const fx = state.firedFx ?? state.firingFx;
      return { model: this.path(def, stem, state.lifeMs) ?? block.model,
        sound: (fx ? this.stem(def, fx) : undefined) ?? block.sound };
    }
    return block;
  }

  /** The trap bubble of an item's Affect, with its item lock after it (PostAffect/AfterBoost). */
  trap(def: ItemDefinition, affect = "Affect"): KartVisual | undefined {
    const model = this.model(def, affect, "fired");
    if (!model) return undefined;
    const after = this.model(def, "PostAffect", "fired") ?? this.model(def, "AfterBoost", "fired");
    const afterSound = after
      ? this.sound(def, "PostAffect", "firedFx") ?? this.sound(def, "AfterBoost", "firedFx") : undefined;
    return { model, ...(after ? { after, afterSound } : {}) };
  }

  /** The blue shield after this item's trap: EscapeAffect's 파란방패, none when the state has no shield model. */
  escapeShield(def: ItemDefinition): KartVisual | undefined {
    const state = this.state(def, "EscapeAffect");
    if (!state) return undefined;
    const model = this.model(def, "EscapeAffect", "firing") ?? this.model(def, "EscapeAffect", "item");
    return model ? { model } : {};
  }
}

/** Optional definitions outside the item set (equipment items with item.bml states). */
export interface ItemFxExtras {
  /** `item/balloon/item.bml` (the balloon accessory's pop and reborn). */
  readonly balloon?: ItemBml;
}

/** Resolve the presenter's models and sounds for the catalog's item set. */
export function buildItemFxPlan(catalog: ItemCatalog, extras: ItemFxExtras = {}): ItemFxPlan {
  const b = new PlanBuilder(catalog);
  const item = (idx: number) => b.require(catalog.get(idx), `道具 ${idx}`);
  const shield = item(ItemIdx.shield);
  const waterBomb = item(ItemIdx.waterBomb);
  const timeBomb = catalog.get(ItemIdx.timeBomb);
  const shared: SharedFx = {
    trap: b.require(b.model(waterBomb, "Affect", "fired"), "waterBomb Affect fired"),
    escapeShield: b.require(b.model(waterBomb, "EscapeAffect", "item"), "waterBomb EscapeAffect item"),
    balloon: balloonFx(b, extras.balloon),
    chargerSound: catalog.has(CHARGER_SOUND) ? (b.sounds.add(CHARGER_SOUND), CHARGER_SOUND) : undefined,
  };
  const items = new Map<number, ItemFx>();
  for (const def of catalog.items) {
    const family = ITEM_FX_FAMILY.get(def.idx);
    if (!family) {
      console.warn(`道具 ${def.idx}（${def.name}）没有表现族，跳过。`);
      continue;
    }
    const block = b.block(def, shield);
    const common: Common = {
      idx: def.idx, name: def.name, family, block, special: b.special(def, block), kart: {},
    };
    items.set(def.idx, buildOne(b, def, family, common, { waterBomb, timeBomb }));
  }
  // The controller's aim sounds (Aim auxFx0..3) are preloaded too.
  for (const def of catalog.items) {
    const aim = def.states.get("Aim");
    for (const stem of aim?.auxFx ?? []) b.stem(def, stem, true);
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

function balloonFx(b: PlanBuilder, bml: ItemBml | undefined): SharedFx["balloon"] {
  const states = bml?.bases[0]?.states;
  if (!states) return undefined;
  const def = { folder: "balloon", name: "balloon", states } as unknown as ItemDefinition;
  return {
    popMs: b.life(def, "Affect"),
    popSound: b.sound(def, "Affect", "itemFx"),
    rebornMs: b.life(def, "Reborn"),
    reborn: b.model(def, "Reborn", "fired"),
    rebornSound: b.sound(def, "Reborn", "itemFx"),
    eatenSound: b.sound(def, "Reborn", "firedFx"),
  };
}

interface Bases { waterBomb: ItemDefinition; timeBomb?: ItemDefinition }

function buildOne(b: PlanBuilder, def: ItemDefinition, family: ItemFxFamily, common: Common,
  bases: Bases): ItemFx {
  const need = <T>(value: T | undefined, what: string) => b.require(value, `${def.name} ${what}`);
  const kart: Record<string, KartVisual> = {};
  const withKart = <F extends ItemFx>(fx: F): F => ({ ...fx, kart: { ...fx.kart, ...kart } });
  // Only the water-trap items (a bubble with its escape shield or item lock after it) have a trap look.
  const traps = TRAP_FAMILIES.has(family) && (def.states.has("EscapeAffect") || def.states.has("PostAffect"));
  const trap = traps ? b.trap(def) : undefined;
  if (trap) kart.trap = trap;
  const escape = b.escapeShield(def);
  if (escape) kart.escapeShield = escape;
  const hitSound = b.sound(def, "Affect", "firedFx");
  switch (family) {
    case "rocket":
    case "blindRocket":
    case "lockdown": {
      const affect = b.state(def, "Affect");
      const blind = family === "blindRocket";
      if (blind) {
        // No explosion; the victim's own cues ([还原], UNREFERENCED_ITEM_FILES).
        const look: KartVisual = {
          sound: b.stem(def, UNREFERENCED_ITEM_FILES.blindStartSound, true),
          afterSound: b.stem(def, UNREFERENCED_ITEM_FILES.blindEndSound, true),
        };
        kart.slow = look;
        kart.spin = look;
      }
      const small = family === "lockdown" ? "Balloon" : "AffectSmall";
      const smallModel = b.anyModel(def, small, ["item", "fired"]);
      const fx: ProjectileFx = {
        ...common, kind: "projectile",
        flight: need(b.model(def, "Use", "item"), "Use item"),
        speed: ITEM_RULES.rocketSpeed, arcM: ITEM_FX_TUNING.rocketArcM,
        launchSound: b.sound(def, "Use", "itemFx"),
        launch: b.model(def, "Use", "firing"),
        impact: affect ? b.model(def, "Affect", "fired") : undefined,
        impactSound: affect && !blind ? b.sound(def, "Affect", "itemFx") : undefined,
        small: smallModel || b.state(def, small)?.itemFx
          ? { model: smallModel, sound: b.sound(def, small, "itemFx") } : undefined,
      };
      if (family !== "lockdown") return withKart(fx);
      kart.hold = { model: b.model(def, "AffectMain", "fired"), sound: b.sound(def, "AffectMain", "firedFx") };
      kart.slow = { model: b.model(def, "AffectSub", "fired"), sound: b.sound(def, "AffectSub", "firedFx") };
      return withKart({ ...fx,
        field: { countdownMs: b.life(def, "CountDown"), countdownSound: b.sound(def, "CountDown", "itemFx"),
          model: b.model(def, "SetEmp", "item"), sound: b.sound(def, "SetEmp", "itemFx") } });
    }
    case "fly":
    case "bombFly": {
      const fx: ProjectileFx = {
        ...common, kind: "projectile", hitSound: undefined,
        flight: need(b.model(def, "Use", "item"), "Use item"),
        speed: ITEM_RULES.flyerSpeed, arcM: ITEM_FX_TUNING.flyerArcM,
        launchSound: b.sound(def, "Use", "itemFx"),
        impact: b.model(def, "Affect", "item"), impactSound: b.sound(def, "Affect", "firedFx"),
      };
      if (def.idx === 132) {
        // honeyBee: the slow has no kart model (the honey is the HUD's cover).
        const look: KartVisual = { sound: b.stem(def, UNREFERENCED_ITEM_FILES.blindStartSound, true) };
        kart.slow = look;
      }
      if (family === "fly") return withKart(fx);
      // waterbombFly: ticks on its target like a time bomb (waterFly AttachTimeBomb),
      // then bursts ([还原]: Active has no model; item01 is the folder's burst).
      const carried = need(b.path(bases.waterBomb, need(bases.waterBomb.states.get("Use")?.item, "carried balloon"),
        b.life(def, "CountDown"), "carriedBalloon"), "carried balloon");
      return withKart({ ...fx, impact: undefined,
        attach: { carried, countdownMs: b.life(def, "CountDown"),
          burst: b.path(def, UNREFERENCED_ITEM_FILES.waterbombFlyBurst, b.life(def, "Active")),
          burstSound: bases.timeBomb ? b.sound(bases.timeBomb, "Set", "itemFx") : undefined } });
    }
    case "ufo": {
      const hover = need(b.model(def, "Affect", "fired"), "Affect fired");
      const leave = need(b.model(def, "PostAffect", "fired"), "PostAffect fired");
      kart.slow = { model: hover, after: leave };
      const headband = b.model(def, "HeadBandAffect", "fired");
      return withKart({ ...common, kind: "ufo",
        depart: need(b.model(def, "Use", "firing"), "Use firing"),
        departSound: b.sound(def, "Use", "firingFx"),
        approach: need(b.model(def, "Use", "fired"), "Use fired"),
        arriveSound: b.sound(def, "Use", "firedFx"),
        hover, leave,
        headband: headband ? { slow: { model: headband,
          sound: b.stem(def, UNREFERENCED_ITEM_FILES.headbandSound, true) } } : undefined,
        bonus: { model: b.model(def, "BonusAffect", "item"), sound: b.sound(def, "BonusAffect", "firedFx") } });
    }
    case "beam": {
      // snowman (shrink) and talisman (hold): the Affect model rides the target.
      const look: KartVisual = { model: b.model(def, "Affect", "fired"), sound: b.sound(def, "Affect", "firedFx") };
      kart.shrink = look;
      kart.hold = look;
      return withKart({ ...common, kind: "beam",
        depart: b.model(def, "Use", "firing"),
        departSound: b.anySound(def, "Use", ["firingFx", "itemFx"]),
        approach: b.model(def, "Use", "fired"),
        arriveSound: b.sound(def, "Use", "firedFx") });
    }
    case "magnet": {
      const field = need(b.model(def, "Use", "item"), "Use item");
      kart.pull = { model: field };
      return withKart({ ...common, kind: "magnet", field });
    }
    case "drop":
    case "throw": {
      const drop = family === "drop";
      const explode = b.state(def, "Explode");
      const eat = b.state(def, "Eat");
      const eatBonus = b.state(def, "EatBonus");
      const fx: ThrowFx = {
        ...common, kind: "throw",
        flight: need(b.model(def, "Use", "item"), "Use item"),
        launchSound: b.sound(def, "Use", "itemFx"),
        set: need(b.model(def, "Set", "item"), "Set item"),
        setSound: b.sound(def, "Set", "itemFx"),
        fallbackDistanceM: drop
          ? -(def.behaviour?.distance ?? ITEM_RULES.bananaDropDistance)
          : def.behaviour?.distance ?? ITEM_RULES.waterBombForwardDistance,
        hitSound,
        // A fired model on the victim (the mines' explosion; a trap's bubble is its kart
        // look instead), else the item model at the object (forceZone fired00).
        impact: explode || traps ? undefined : b.model(def, "Affect", "fired"),
        impactSound: explode || traps ? undefined : b.sound(def, "Affect", "itemFx"),
        itemImpact: b.model(def, "Affect", "fired") ? undefined : b.model(def, "Affect", "item"),
        burst: explode ? b.model(def, "Explode", "item") : undefined,
        burstSound: explode ? b.sound(def, "Explode", "itemFx") : undefined,
        consumed: ITEM_FX_CONSUMED.has(def.idx),
        eat: eat ? {
          model: b.model(def, "Eat", "firing"), sound: b.sound(def, "Eat", "firingFx"),
          bonus: eatBonus ? b.model(def, "EatBonus", "item") : undefined,
        } : undefined,
      };
      return withKart(fx);
    }
    case "timeBomb":
      return withKart({ ...common, kind: "timeBomb", hitSound,
        // [还原] The data has no model for the bomb riding on the kart (Use only
        // has its sound); the water bomb's own thrown balloon stands in for it.
        carried: need(b.path(bases.waterBomb, need(bases.waterBomb.states.get("Use")?.item, "carried balloon"),
          b.life(def, "Use"), "carriedBalloon"), "carried balloon"),
        launchSound: b.sound(def, "Use", "itemFx"),
        burst: need(b.model(def, "Set", "item"), "Set item"),
        burstSound: b.sound(def, "Set", "itemFx") });
    case "barricade": {
      const affect = { model: b.model(def, "StateAffect", "fired"), sound: b.sound(def, "StateAffect", "itemFx") };
      if (affect.model || affect.sound) {
        kart.hold = affect;
        kart.barrier = affect;
      }
      return withKart({ ...common, kind: "barricade",
        launch: need(b.model(def, "StateUse", "firing"), "StateUse firing"),
        launchSound: b.sound(def, "StateUse", "firingFx"),
        rise: need(b.model(def, "StateSet", "item"), "StateSet item"),
        riseSound: b.sound(def, "StateSet", "itemFx"),
        active: need(b.model(def, "StateActive", "item"), "StateActive item"),
        end: need(b.model(def, "StateEnd", "item"), "StateEnd item"),
        endSound: b.sound(def, "StateEnd", "itemFx") });
    }
    case "cloud":
      return withKart({ ...common, kind: "cloud",
        launch: b.model(def, "Use", "firing"),
        bornSound: b.sound(def, "Use", "itemFx"),
        coverMs: b.life(def, "Use") + b.life(def, "Set"),
        removeSound: b.sound(def, "Remove", "itemFx") });
    case "curse": {
      // thunderbolt: Warning, then the Preaffect strike; the devils: Preaffect is the warning.
      const warned = def.states.has("Warning");
      const warning = warned ? "Warning" : "Preaffect";
      const affect = need(b.model(def, "Affect", "fired"), "Affect fired");
      const affectSound = b.sound(def, "Affect", "firedFx");
      const after = b.model(def, "Escape", "fired");
      const afterSound = b.sound(def, "Escape", "firedFx");
      const look: KartVisual = { model: affect, sound: affectSound, after, afterSound };
      if (warned) kart.shrink = look;
      else kart.reverse = look;
      return withKart({ ...common, kind: "curse",
        launch: need(b.model(def, "Use", "firing"), "Use firing"),
        launchSound: b.sound(def, "Use", "itemFx"),
        warning: need(b.model(def, warning, "fired"), `${warning} fired`),
        warningSound: b.sound(def, warning, "firedFx"),
        strike: warned ? b.model(def, "Preaffect", "fired") : undefined,
        strikeSound: warned ? b.sound(def, "Preaffect", "firedFx") : undefined,
        affect, affectSound, after, afterSound });
    }
    case "lock":
      return withKart({ ...common, kind: "lock",
        launch: need(b.model(def, "Use", "firing"), "Use firing"),
        launchSound: b.sound(def, "Use", "itemFx"),
        affect: need(b.model(def, "Affect", "fired"), "Affect fired"),
        affectSound: b.sound(def, "Affect", "firedFx") });
    case "shield":
    case "angel":
    case "emp":
    case "scan":
    case "invincible":
    case "invisible":
    case "siren":
      return withKart(aura(b, def, family, common, kart));
    case "booster":
      return { ...common, kind: "none" };
  }
}

/** Families whose items trap in a water bubble (water bombs, time bombs, flies, the water mine). */
const TRAP_FAMILIES: ReadonlySet<ItemFxFamily> = new Set(["fly", "bombFly", "throw", "timeBomb", "drop"]);

/** Mines go off at their first hit (Disappear follows Eat for the eaten ones, ITEM_MODE.md C.4). */
const ITEM_FX_CONSUMED: ReadonlySet<number> = new Set([17, 45, 82, 83, 129, 130, 37]);

function aura(b: PlanBuilder, def: ItemDefinition, effect: AuraEffect, common: Common,
  kart: Record<string, KartVisual>): AuraFx {
  const useSound = b.anySound(def, "Use", ["itemFx", "firingFx"]);
  switch (effect) {
    case "shield": {
      // shield (Use firing00, 2000) and superShield (shield base 1, GoldS, 3000).
      const model = b.model(def, "Use", "firing");
      kart.shield = { model };
      return { ...common, kind: "aura", effect, model, delayMs: 0, durationMs: b.life(def, "Use"),
        useSound, onTargets: false, fromUse: true };
    }
    case "siren": {
      // siren: Use firing00 for Use.life; sirenShield: Use 라쳇쉴드_시작, then Siren 라쳇쉴드_진행.
      const sirenState = def.states.has("Siren");
      const model = sirenState ? b.model(def, "Siren", "firing") : b.model(def, "Use", "firing");
      const intro = sirenState ? b.model(def, "Use", "firing") : undefined;
      return { ...common, kind: "aura", effect, model, intro,
        delayMs: sirenState ? b.life(def, "Use") : 0,
        durationMs: sirenState ? b.life(def, "Siren") : b.life(def, "Use"),
        useSound: sirenState ? undefined : useSound,
        startSound: sirenState ? b.sound(def, "Siren", "itemFx") : undefined,
        hitSound: b.sound(def, "Affect", "firedFx"),
        onTargets: false, fromUse: true };
    }
    case "invisible": {
      // tigerGhost (ghost base 1): effect_tigerEye on the user during Use, then Affect hides the kart.
      const intro = b.model(def, "Use", "fired");
      kart.invisible = {};
      return { ...common, kind: "aura", effect, intro, introSound: b.sound(def, "Use", "firedFx"),
        delayMs: b.life(def, "Use"), durationMs: b.life(def, "Affect"),
        onTargets: false, fromUse: false };
    }
    default: {
      // angel, emp, scanning, goldShield/protectShield: the Affect model after the Use state.
      const model = b.model(def, "Affect", "fired");
      const startSound = b.sound(def, "Affect", "firedFx");
      const kind = effect === "scan" ? undefined : effect;
      if (kind) kart[kind] = { model, sound: startSound };
      return { ...common, kind: "aura", effect, model, delayMs: b.life(def, "Use"),
        durationMs: b.life(def, "Affect"), useSound, startSound,
        onTargets: effect === "angel", fromUse: effect !== "emp" };
    }
  }
}
