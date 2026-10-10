import { Matrix4, Quaternion, Vector3 } from "three";
import {
  applyTrackPrs, createPrsRuntime, defaultTrackTransform, isTrackPrs, playPrs, validatePrs,
  type ParsedTrackPrs, type PrsRuntime, type TrackTransform,
} from "../resources/track-prs-animation";

/**
 * How an item hit moves the victim's kart (原版: the kart rides the hit
 * model's `firedkart` node). The original's hit models carry the kart on a
 * node named `firedkart` under an animated pivot: the water bubbles lift it
 * 2–3.6 m into the bubble and wobble it, the missile explosion throws it
 * ~11 m with three forward flips, the banana's 당함 spins it eight turns,
 * the abyss barricade throws it 10 m. The bubble meshes are children of
 * `firedkart`, so the kart must follow it to sit inside them.
 *
 * The motion is visual: D(t) = F(t)·F_rest⁻¹ of the chain from the model's
 * root to `firedkart` is applied to the kart's drawn pose (physics, the
 * network and the effect models keep the undriven pose).
 */

interface ModelNode {
  readonly name?: string;
  readonly children?: readonly ModelNode[];
  readonly position?: ArrayLike<number>;
  readonly transform?: ArrayLike<ArrayLike<number>>;
  readonly scale?: ArrayLike<number>;
  readonly slotOccurrences?: ReadonlyArray<{ readonly value?: unknown } | undefined>;
}

interface ChainLink {
  readonly prs?: ParsedTrackPrs;
  readonly rest: TrackTransform;
}

/** A model's kart motion: the PRS chain to its `firedkart` node. */
export interface KartMotionTrack {
  readonly path: string;
  readonly chain: readonly ChainLink[];
  /** F_rest⁻¹ in the model's (client, z-up) frame. */
  readonly restInverse: Matrix4;
}

const KART_NODE = "firedkart";

/** Below these a motion that ended counts as back on the road. */
const REST_HEIGHT_M = 0.02;
const REST_ANGLE = 0.01;
const GRAVITY = 9.8;

/** Lowering a kart left in the air when its effect ends: [还原] a fall under gravity, clamped. */
export const KART_MOTION_TUNING = Object.freeze({ minimumFallMs: 150, maximumFallMs: 900 });

function restOf(node: ModelNode): TrackTransform {
  const fallback = defaultTrackTransform();
  const basis = node.transform
    ? [0, 1, 2].map(row => [0, 1, 2].map(column => Number(node.transform![row]?.[column] ?? (row === column ? 1 : 0))))
    : fallback.basis;
  return {
    position: node.position ? [0, 1, 2].map(index => Number(node.position![index] ?? 0)) : fallback.position,
    basis,
    scale: node.scale ? [0, 1, 2].map(index => Number(node.scale![index] ?? 1)) : fallback.scale,
  };
}

/** basis · diag(scale) plus position, as the model assembler composes a node. */
function nodeMatrix(transform: TrackTransform, out = new Matrix4()): Matrix4 {
  const { basis: b, scale: s, position: p } = transform;
  return out.set(
    b[0]![0]! * s[0]!, b[0]![1]! * s[1]!, b[0]![2]! * s[2]!, p[0]!,
    b[1]![0]! * s[0]!, b[1]![1]! * s[1]!, b[1]![2]! * s[2]!, p[1]!,
    b[2]![0]! * s[0]!, b[2]![1]! * s[1]!, b[2]![2]! * s[2]!, p[2]!,
    0, 0, 0, 1,
  );
}

function findChain(node: ModelNode, ancestors: ModelNode[]): ModelNode[] | undefined {
  const path = [...ancestors, node];
  if (node.name === KART_NODE) return path;
  for (const child of node.children ?? []) {
    const found = findChain(child, path);
    if (found) return found;
  }
  return undefined;
}

/**
 * The kart motion of a decoded `.1s` model, or undefined when it has no
 * `firedkart` node or nothing on its chain is animated (a static one never
 * moves the kart).
 */
export function kartMotionTrack(path: string, model: { root?: unknown }): KartMotionTrack | undefined {
  const root = model.root as ModelNode | undefined;
  if (!root) return undefined;
  const nodes = findChain(root, []);
  if (!nodes) return undefined;
  const chain: ChainLink[] = nodes.map(node => {
    const value = node.slotOccurrences?.[1]?.value;
    const prs = isTrackPrs(value) && validatePrs(value) === undefined ? value : undefined;
    return prs ? { prs, rest: restOf(node) } : { rest: restOf(node) };
  });
  if (!chain.some(link => link.prs)) return undefined;
  const rest = new Matrix4();
  const local = new Matrix4();
  for (const link of chain) rest.multiply(nodeMatrix(link.rest, local));
  return { path, chain, restInverse: rest.clone().invert() };
}

/** The model frame (client: x right, y back, z up) as the kart's three.js frame (right, up, forward). */
const CLIENT_TO_KART = new Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
);
const KART_TO_CLIENT = CLIENT_TO_KART.clone().invert();

/** One playing motion: the track's PRS clocks anchored at the effect's start. */
export class KartMotion {
  private readonly runtimes: Array<PrsRuntime | undefined>;
  private readonly sample = defaultTrackTransform();
  private readonly local = new Matrix4();
  readonly anchorMs: number;

  constructor(readonly track: KartMotionTrack, startMs: number) {
    // The same anchor as the effect model's scene clock, so the kart and its bubble move together.
    this.anchorMs = Math.max(1, Math.trunc(startMs));
    this.runtimes = track.chain.map(link => {
      if (!link.prs) return undefined;
      const runtime = createPrsRuntime();
      playPrs(link.prs, runtime, this.anchorMs, 0);
      return runtime;
    });
  }

  /** D(t) in the kart's own three.js frame (translation in metres). */
  at(nowMs: number, out = new Matrix4()): Matrix4 {
    const forward = new Matrix4();
    this.track.chain.forEach((link, index) => {
      const runtime = this.runtimes[index];
      const transform = link.prs && runtime
        ? applyTrackPrs(this.sample, link.prs, runtime, Math.max(this.anchorMs, Math.trunc(nowMs)), link.rest)
        : link.rest;
      forward.multiply(nodeMatrix(transform, this.local));
    });
    forward.multiply(this.track.restInverse);
    return out.copy(CLIENT_TO_KART).multiply(forward).multiply(KART_TO_CLIENT);
  }
}

const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();
const IDENTITY_QUATERNION = new Quaternion();

/** A motion's pose without its scale (the kart is never scaled by it). */
export function rigidMotion(motion: Matrix4, out = new Matrix4()): Matrix4 {
  motion.decompose(scratchPosition, scratchQuaternion, scratchScale);
  return out.compose(scratchPosition, scratchQuaternion, new Vector3(1, 1, 1));
}

/** How long a kart left `heightM` up takes to come down ([还原], a fall under gravity). */
export function fallMs(heightM: number): number {
  const ms = Math.sqrt(2 * Math.max(0, heightM) / GRAVITY) * 1000;
  return Math.min(KART_MOTION_TUNING.maximumFallMs, Math.max(KART_MOTION_TUNING.minimumFallMs, ms));
}

/** Whether a motion left the kart on the road, upright (no fall needed). */
export function atRest(motion: Matrix4): boolean {
  motion.decompose(scratchPosition, scratchQuaternion, scratchScale);
  return scratchPosition.length() <= REST_HEIGHT_M &&
    scratchQuaternion.angleTo(IDENTITY_QUATERNION) <= REST_ANGLE;
}

/**
 * The kart coming down from where its motion ended: the offset falls under
 * gravity and the tilt eases out; undefined once it is back.
 */
export function fallingMotion(end: Matrix4, sinceEndMs: number, out = new Matrix4()): Matrix4 | undefined {
  end.decompose(scratchPosition, scratchQuaternion, scratchScale);
  const durationMs = fallMs(scratchPosition.y);
  if (!(sinceEndMs < durationMs)) return undefined;
  const progress = Math.max(0, sinceEndMs) / durationMs;
  const position = scratchPosition.clone().multiplyScalar(1 - progress * progress);
  const rotation = scratchQuaternion.clone().slerp(IDENTITY_QUATERNION, progress);
  return out.compose(position, rotation, new Vector3(1, 1, 1));
}

export interface KartPoseVectors {
  position: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
}

/** The pose with a kart-frame motion applied: pose · motion. */
export function drivenPose(pose: KartPoseVectors, motion: Matrix4): KartPoseVectors {
  const { right: r, up: u, forward: f, position: p } = pose;
  const world = new Matrix4().set(
    r.x, u.x, f.x, p.x,
    r.y, u.y, f.y, p.y,
    r.z, u.z, f.z, p.z,
    0, 0, 0, 1,
  ).multiply(motion);
  const e = world.elements;
  const column = (index: number) => {
    const x = e[index * 4]!, y = e[index * 4 + 1]!, z = e[index * 4 + 2]!;
    const length = Math.hypot(x, y, z) || 1;
    return { x: x / length, y: y / length, z: z / length };
  };
  return { position: { x: e[12]!, y: e[13]!, z: e[14]! }, right: column(0), up: column(1), forward: column(2) };
}

/** The world offset of a motion at a pose (the camera follows only this, never the flips). */
export function motionOffset(pose: Pick<KartPoseVectors, "right" | "up" | "forward">, motion: Matrix4):
  { x: number; y: number; z: number } {
  const e = motion.elements;
  const [x, y, z] = [e[12]!, e[13]!, e[14]!];
  return {
    x: pose.right.x * x + pose.up.x * y + pose.forward.x * z,
    y: pose.right.y * x + pose.up.y * y + pose.forward.y * z,
    z: pose.right.z * x + pose.up.z * y + pose.forward.z * z,
  };
}
