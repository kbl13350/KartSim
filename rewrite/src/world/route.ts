/** Client coordinate system used by RouteSection, road collision and vehicle motion. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RouteFrame {
  position: Vec3;
  forward: Vec3;
  up: Vec3;
}

export interface RouteGate {
  triangles: readonly [readonly Vec3[], readonly Vec3[]];
  normal: Vec3;
  final: boolean;
  name: string;
}

export interface RouteEdge {
  gate: RouteGate;
  section: number;
}

export interface RouteSection {
  frames: readonly RouteFrame[];
  length: number;
  surface: string;
  outgoing: readonly RouteEdge[];
  incoming: readonly RouteEdge[];
}

export interface RouteState {
  section: number;
  lap: number;
  localDistance: number;
  completedDistance: number;
  distance: number;
  resetAux68: number;
  resetAux74: number;
  resetAux80: number;
  resetAux8C: number;
}

export type RouteSample =
  | { surface: string; sampled: false }
  | { surface: string; sampled: true; point: Vec3; direction: Vec3; up: Vec3 };

const f32 = Math.fround;

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: f32(a.x + b.x), y: f32(a.y + b.y), z: f32(a.z + b.z) };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: f32(a.x - b.x), y: f32(a.y - b.y), z: f32(a.z - b.z) };
}

export function scale(a: Vec3, factor: number): Vec3 {
  return { x: f32(a.x * factor), y: f32(a.y * factor), z: f32(a.z * factor) };
}

export function copy(a: Vec3): Vec3 {
  return { x: f32(a.x), y: f32(a.y), z: f32(a.z) };
}

/** The release adds x, z, then y after rounding each product to float32. */
export function routeDot(a: Vec3, b: Vec3): number {
  const x = f32(a.x * b.x);
  const z = f32(f32(-a.z) * f32(-b.z));
  const y = f32(a.y * b.y);
  return f32(f32(x + z) + y);
}

export function routeLength(vector: Vec3): number {
  const x2 = f32(vector.x * vector.x);
  const z2 = f32(vector.z * vector.z);
  const y2 = f32(vector.y * vector.y);
  return f32(Math.sqrt(f32(f32(x2 + z2) + y2)));
}

export function frameDistance(a: Vec3, b: Vec3): number {
  return routeLength(subtract(b, a));
}

function routeUnit(vector: Vec3): Vec3 {
  const length = routeLength(vector);
  if (length === 0) return { x: 1, y: 1, z: -1 };
  const negativeZ = f32(-vector.z);
  return {
    x: f32(vector.x / length),
    y: f32(vector.y / length),
    z: f32(-f32(negativeZ / length)),
  };
}

function interpolate(a: Vec3, b: Vec3, fraction: number): Vec3 {
  return add(a, scale(subtract(b, a), fraction));
}

/** Projects a vehicle onto the section's original frame polyline. */
export function projectSectionDistance(position: Vec3, section: RouteSection): number {
  const frames = section.frames;
  if (frames.length === 0) return 0;
  let after = 0;
  while (after < frames.length &&
    !(routeDot(subtract(position, frames[after]!.position), frames[after]!.forward) < 0)) {
    after += 1;
  }
  if (after === 0) return 0;
  let distance = 0;
  let before = 0;
  while (before + 1 < after) {
    distance = f32(distance + f32(frameDistance(frames[before]!.position,
      frames[before + 1]!.position)));
    before += 1;
  }
  let local: number;
  if (after === frames.length) {
    local = routeDot(subtract(position, frames[before]!.position), frames[before]!.forward);
  } else {
    const segment = subtract(frames[after]!.position, frames[before]!.position);
    if (routeLength(segment) > f32(0.10000000149011612)) {
      local = routeDot(subtract(position, frames[before]!.position), routeUnit(segment));
      if (local < 0) local = 0;
    } else {
      local = routeDot(subtract(position, frames[before]!.position), frames[before]!.forward);
    }
  }
  distance = f32(distance + f32(local));
  return distance > section.length ? section.length : distance;
}

/** Follows outgoing edges, then samples the target section's frame polyline. */
export function sampleRoute(
  sections: readonly RouteSection[],
  state: Pick<RouteState, "section" | "localDistance">,
  lookahead: number,
  outgoingChoice = 0,
): RouteSample {
  let sectionIndex = state.section;
  let localDistance = state.localDistance;
  let remaining = f32(Math.max(0, lookahead));
  const zeroProgressVisited = new Set<number>();
  while (remaining > 0) {
    const section = sections[sectionIndex]!;
    if (f32(localDistance + remaining) <= section.length) break;
    const sectionRemainder = f32(section.length - localDistance);
    const nextRemaining = f32(remaining - sectionRemainder);
    if (nextRemaining < remaining) zeroProgressVisited.clear();
    else {
      if (zeroProgressVisited.has(sectionIndex)) {
        throw new Error("rail route lookahead 遇到无距离进展的循环。");
      }
      zeroProgressVisited.add(sectionIndex);
    }
    remaining = nextRemaining;
    if (section.outgoing.length === 0) {
      throw new Error("rail route lookahead 缺少 outgoing edge。");
    }
    sectionIndex = section.outgoing[(outgoingChoice >>> 0) % section.outgoing.length]!.section;
    localDistance = 0;
  }
  localDistance = f32(localDistance + remaining);
  const section = sections[sectionIndex]!;
  let precedingDistance = 0;
  for (let i = 0; i + 1 < section.frames.length; i += 1) {
    const current = section.frames[i]!;
    const next = section.frames[i + 1]!;
    const segmentLength = frameDistance(current.position, next.position);
    const endDistance = f32(precedingDistance + segmentLength);
    if (localDistance >= precedingDistance && localDistance <= endDistance) {
      const fraction = f32(f32(localDistance - precedingDistance) / segmentLength);
      return {
        surface: section.surface,
        sampled: true,
        point: interpolate(current.position, next.position, fraction),
        direction: interpolate(current.forward, next.forward, fraction),
        up: interpolate(current.up, next.up, fraction),
      };
    }
    precedingDistance = endDistance;
  }
  return { surface: section.surface, sampled: false };
}
