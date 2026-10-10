/**
 * Pure rules of the local item race controller (道具赛, ITEM_MODE.md §6,
 * appendix B): coordinates, timelines, defences, aiming and the HUD stage
 * projection. Every value without an original source is a named [还原]
 * constant in ITEM_RACE_TUNING.
 */
import type { ItemBehaviour, ItemEffectKind } from "./item-catalog";
import { ItemIdx } from "./item-catalog";
import type { ItemRaceKartEffect } from "./item-race-p3-contract";
import type { ItemPresenterPose, ItemPresenterVec3 } from "./item-race-presenter-contract";

export type Vec3 = ItemPresenterVec3;

/** Reconstruction constants of the controller ([还原] in ITEM_MODE.md). */
export const ITEM_RACE_TUNING = Object.freeze({
  /** Aiming (rocket, magnet): opponents ahead within this range and half-angle are candidates. */
  aimRangeM: 150,
  aimConeHalfAngleDegrees: 25,
  /** The same candidate must stay in the cone this long before the lock (inrange → ontarget). */
  aimLockMs: 600,
  /** With no candidate the green reticle sits this far ahead of the kart. */
  aimReticleAheadM: 40,
  /** The reticle aims at this height above a target kart's origin. */
  aimReticleLiftM: 0.6,
  /** The aiming sounds (`Aim` auxFx) loop until the phase changes or the key is released. */
  aimSoundsLoop: true,
  /** A banana cannot catch its own user until this long after it appears. */
  bananaOwnerGraceMs: 1000,
  /** Barricade landing distance ahead of its target when item.bml lacks StateUse size. */
  barricadeAheadM: 70,
  /** A place event that arrives after its blast window still checks once within this grace. */
  areaLateGraceMs: 500,
  /** The item description balloon shows this long after a new item reaches slot 0. */
  infoCardMs: 3000,
  /** The item box abuse message (multiplay_itemCubeAbusing) shows this long. */
  abuseNoticeMs: 2000,
  /** Alt swap animation, the HUD's slot reorder duration. */
  slotReorderMs: 350,
  /** Hit notices and log rows are kept this long (the HUD fades them earlier). */
  noticeKeepMs: 3000,
  logKeepMs: 3500,
  /** Victims of one use reported within this window share one "good" notice. */
  goodNoticeMergeMs: 1000,
  noticeRows: 6,
  logRows: 6,
  /** Uses are forgotten after the server's use lifetime. */
  useLifetimeMs: 60_000,
  /**
   * Swept area, hazard and cube checks: a move between two frames faster than
   * this (plus the slack) is a reset or warp jump, not a drive, and only its
   * end point counts.
   */
  sweepMaxSpeedMps: 120,
  sweepSlackM: 1,
  /** The 迅 start item's slot flash and the in-race lucci notice stay in the HUD state this long. */
  startItemFlashKeepMs: 3000,
  lucciNoticeMs: 3000,
  /** Talisman QTE: arrows to press in order (uiEffect.bml has panels 0–4). */
  talismanArrows: 5,
});

/** Inverse of W's clientToThree (x, z, -y): three.js → client z-up coordinates. */
export function threeToClient(point: Vec3): Vec3 {
  return { x: point.x, y: -point.z === 0 ? 0 : -point.z, z: point.y };
}

/** Client z-up coordinates (`point` of the item protocol) → three.js. */
export function clientToThreePoint(point: Vec3): Vec3 {
  return { x: point.x, y: point.z, z: -point.y === 0 ? 0 : -point.y };
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Distance from `point` to the segment from `a` to `b`. */
export function segmentDistance(a: Vec3, b: Vec3, point: Vec3): number {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const t = lengthSquared > 0 ? Math.min(1, Math.max(0,
    ((point.x - a.x) * dx + (point.y - a.y) * dy + (point.z - a.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y, a.z + dz * t - point.z);
}

/**
 * The previous frame's kart position when the move to `to` in `elapsedMs`
 * could have been driven; undefined without one or after a reset or warp jump.
 */
export function sweepOrigin(from: Vec3 | undefined, to: Vec3, elapsedMs: number): Vec3 | undefined {
  if (!from || !(elapsedMs >= 0)) return undefined;
  const reach = ITEM_RACE_TUNING.sweepMaxSpeedMps * elapsedMs / 1000 + ITEM_RACE_TUNING.sweepSlackM;
  return distance(from, to) <= reach ? from : undefined;
}

/**
 * Area, hazard and cube checks run once per frame. A kart that started the
 * frame outside a radius and crossed it on its way to `to` touched it too,
 * although both samples are outside (a fast kart or a long frame stepping
 * over a 4 m banana). A start already inside was checked last frame.
 */
export function sweptThrough(from: Vec3 | undefined, to: Vec3, point: Vec3, radius: number): boolean {
  if (!from || !(distance(from, point) > radius)) return false;
  return segmentDistance(from, to, point) <= radius;
}

const add = (a: Vec3, b: Vec3, scale = 1): Vec3 =>
  ({ x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale });

/** Banana drop point: `bananaDropDistance` behind the kart (appendix B). */
export function bananaPoint(pose: Pick<ItemPresenterPose, "position" | "forward">,
  behaviour: ItemBehaviour): Vec3 {
  return add(pose.position, pose.forward, -(behaviour.distance ?? 4));
}

/** Water bomb landing point: position + velocity × lead + forward × distance (appendix B). */
export function waterBombPoint(pose: Pick<ItemPresenterPose, "position" | "forward">,
  velocity: Vec3, behaviour: ItemBehaviour, leadMs: number): Vec3 {
  return add(add(pose.position, velocity, leadMs / 1000), pose.forward, behaviour.distance ?? 20);
}

/**
 * When an attack takes effect on its victim, counted from `startAt`: tracking
 * projectiles fly for the server's `etaMs`, the others wait `delayMs`; both
 * then add the warning phase.
 */
export function effectStartOffsetMs(behaviour: ItemBehaviour, etaMs: number): number {
  const flight = behaviour.maxEtaMs !== undefined
    ? Math.max(0, Math.min(etaMs, behaviour.maxEtaMs)) : behaviour.delayMs;
  return flight + behaviour.warningMs;
}

/** Physics effects of `physics.itemEffects` (phase 3 adds knockback and hold). */
export type PhysicsItemEffect = "spin" | "trap" | "launch" | "reverse" | "slow" | "shrink" |
  "barrier" | "pull" | "knockback" | "hold";

const PHYSICS_EFFECTS: ReadonlySet<string> = new Set(
  ["spin", "trap", "launch", "reverse", "slow", "shrink", "barrier", "pull", "knockback", "hold"]);

export function physicsEffect(effect: ItemEffectKind): PhysicsItemEffect | undefined {
  return PHYSICS_EFFECTS.has(effect) ? effect as PhysicsItemEffect : undefined;
}

/** The presenter's kart effect of an item effect (the victim's bubble, stars, …). */
export function kartEffectOf(effect: ItemEffectKind): ItemRaceKartEffect | undefined {
  return physicsEffect(effect);
}

/**
 * HUD warning while a projectile flies at me ([还原]: the UFO, the talisman
 * and the aimed specials use the rocket vignette, the flies and the bee the
 * water-fly one); the lion mask rocket gives none (itemDescList.xml:1148).
 */
export function warningOf(itemId: number, behaviour?: ItemBehaviour): "rocket" | "waterfly" | undefined {
  if (behaviour) {
    if (behaviour.noWarning) return undefined;
    switch (behaviour.family) {
      case "rocket": case "blindRocket": case "lockdownRocket": case "snowman": case "ufo": case "talisman":
        return "rocket";
      case "waterFly": case "waterbombFly": case "honeyBee":
        return "waterfly";
      default:
        return undefined;
    }
  }
  switch (itemId) {
    case ItemIdx.rocket:
    case ItemIdx.guideRocket:
    case ItemIdx.randomRocket:
    case ItemIdx.ufo:
      return "rocket";
    case ItemIdx.waterFly:
      return "waterfly";
    default:
      return undefined;
  }
}

export interface DefenceState {
  /** Trapped or under the blue shield after a bubble. */
  immune: boolean;
  shield: boolean;
  angel: boolean;
  /** Gold shield / protect shield (黄金盾牌, 保护盾): every attack but clouds and the slot lock. */
  invincible?: boolean;
  /** A reset or a warp holds the kart: nothing lands. */
  suspended: boolean;
}

export type ItemHitBy = "shield" | "angel" | "emp" | "escape" | "kart" | "pet" | "eat";
export type ItemHitVariant = "small" | "headband" | "bonus" | "quick" | "balloon";

export interface HitDecision {
  result: "hit" | "blocked";
  by?: ItemHitBy;
  variant?: ItemHitVariant;
  /** Blocked by the gold / protect shield (reported as `shield`, the shield item is kept). */
  invincible?: true;
}

/** Equipment outcomes of one hit (item-passives.ts), already rolled. */
export interface EquipmentOutcome {
  /** A full defence: the kart or pet blocks it, or the kart eats the banana/mine. */
  block?: { by: "kart" | "pet" | "eat"; bonus?: boolean };
  /** A partial outcome when nothing else stops the hit. */
  variant?: "balloon" | "headband" | "bonus";
}

/**
 * Whether an attack lands (ITEM_MODE.md §6, C.2), in the order reset/warp →
 * escape blue shield → equipment full defence → shield items (the invincible
 * gold/protect shield, then the one-hit shield) → angel → partial equipment
 * outcomes (balloon, headband, 奇奇) → hit. The slot lock is enforced by the
 * server: it always lands, except on an invincible racer (the node does not
 * lock a racer under a gold shield). Clouds are a screen cover nothing but the
 * escape shield stops. An invincible block is reported as `shield` (the node
 * accepts it while the victim's gold or protect shield lasts).
 */
export function decideHit(_itemId: number, behaviour: ItemBehaviour,
  defences: DefenceState, equipment: EquipmentOutcome = {}): HitDecision {
  if (behaviour.effect === "lock") {
    return defences.invincible ? { result: "blocked", by: "shield", invincible: true } : { result: "hit" };
  }
  if (defences.suspended) return { result: "blocked" };
  if (defences.immune) return { result: "blocked", by: "escape" };
  if (equipment.block) {
    return { result: "blocked", by: equipment.block.by,
      ...(equipment.block.bonus ? { variant: "bonus" as const } : {}) };
  }
  if (defences.invincible && behaviour.effect !== "cloud") return { result: "blocked", by: "shield", invincible: true };
  if (defences.shield && behaviour.shieldBlocks) return { result: "blocked", by: "shield" };
  if (defences.angel && behaviour.angelBlocks) return { result: "blocked", by: "angel" };
  return equipment.variant ? { result: "hit", variant: equipment.variant } : { result: "hit" };
}

export interface AimCandidate { playerId: string; position: Vec3 }

/**
 * The aim candidate: the nearest opponent ahead of the kart inside the aiming
 * cone and range ([还原] constants).
 */
export function chooseAimTarget(pose: Pick<ItemPresenterPose, "position" | "forward">,
  candidates: readonly AimCandidate[],
  tuning: Pick<typeof ITEM_RACE_TUNING, "aimRangeM" | "aimConeHalfAngleDegrees"> = ITEM_RACE_TUNING):
  AimCandidate | undefined {
  const forwardLength = Math.hypot(pose.forward.x, pose.forward.y, pose.forward.z) || 1;
  const cos = Math.cos(tuning.aimConeHalfAngleDegrees * Math.PI / 180);
  let best: AimCandidate | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const dx = candidate.position.x - pose.position.x;
    const dy = candidate.position.y - pose.position.y;
    const dz = candidate.position.z - pose.position.z;
    const length = Math.hypot(dx, dy, dz);
    if (!(length > 0) || length > tuning.aimRangeM) continue;
    const along = (dx * pose.forward.x + dy * pose.forward.y + dz * pose.forward.z) / forwardLength;
    if (along <= 0 || along / length < cos) continue;
    if (length < bestDistance) {
      best = candidate;
      bestDistance = length;
    }
  }
  return best;
}

/** The camera part the stage projection reads (three.js column-major matrices). */
export interface ProjectionCamera {
  matrixWorldInverse: { elements: ArrayLike<number> };
  projectionMatrix: { elements: ArrayLike<number> };
}

export const HUD_STAGE_WIDTH = 1600;
export const HUD_STAGE_HEIGHT = 900;

/** Project a world point onto the 1600×900 HUD stage; undefined behind the camera. */
export function projectToStage(camera: ProjectionCamera, point: Vec3): { x: number; y: number } | undefined {
  const v = camera.matrixWorldInverse.elements;
  const p = camera.projectionMatrix.elements;
  const transform = (m: ArrayLike<number>, x: number, y: number, z: number, w: number) => [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]! * w,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]! * w,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]! * w,
    m[3]! * x + m[7]! * y + m[11]! * z + m[15]! * w,
  ];
  const view = transform(v, point.x, point.y, point.z, 1);
  const clip = transform(p, view[0]!, view[1]!, view[2]!, view[3]!);
  const w = clip[3]!;
  if (!(w > 1e-6)) return undefined;
  const x = clip[0]! / w;
  const y = clip[1]! / w;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x: (x + 1) / 2 * HUD_STAGE_WIDTH, y: (1 - y) / 2 * HUD_STAGE_HEIGHT };
}

/** Log row background: the attacker's team, or solo in individual races. */
export function teamColor(team: 1 | 2 | null | undefined, teamRace: boolean): "solo" | "red" | "blue" {
  if (!teamRace) return "solo";
  return team === 1 ? "red" : team === 2 ? "blue" : "solo";
}

/** "车手A" or "车手A 等N人" for one use's victims. */
export function victimsText(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names[0]} 等${names.length}人`;
}
