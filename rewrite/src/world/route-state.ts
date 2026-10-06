import { routeGateCrossing } from "./gates";
import {
  add, copy, projectSectionDistance, scale, subtract,
  type RouteFrame, type RouteSection, type RouteState, type Vec3,
} from "./route";

export interface RouteWorldHost {
  sections: readonly RouteSection[];
  data: { firstSection: number; lastSection: number; lapTarget?: number };
  routeStates: WeakMap<object, RouteState>;
}

export type RouteTag = (tag: string, frame: RouteFrame) => void;

function firstFrame(section: RouteSection): RouteFrame {
  const frame = section.frames[0];
  if (!frame) throw new Error("route surface event 缺少 section frame 0。");
  return frame;
}

export function requireRouteState(world: RouteWorldHost, vehicle: object): RouteState {
  const state = world.routeStates.get(vehicle);
  if (!state) throw new Error("该车辆尚未建立路线状态。");
  return state;
}

export function resetRouteState(world: RouteWorldHost, vehicle: object,
  position: Vec3): void {
  const last = world.sections[world.data.lastSection]!;
  const localDistance = projectSectionDistance(position, last);
  world.routeStates.set(vehicle, {
    section: world.data.lastSection, lap: 0, localDistance,
    completedDistance: -last.length,
    distance: Math.fround(-last.length + localDistance),
    resetAux68: 0, resetAux74: 0, resetAux80: 0, resetAux8C: 0,
  });
}

export function refreshRouteProjection(world: RouteWorldHost, vehicle: object,
  position: Vec3): RouteState {
  const previous = requireRouteState(world, vehicle);
  const localDistance = projectSectionDistance(position, world.sections[previous.section]!);
  const updated = { ...previous, localDistance,
    distance: Math.fround(previous.completedDistance + localDistance) };
  world.routeStates.set(vehicle, updated);
  return updated;
}

export function warpRouteToSection(world: RouteWorldHost, vehicle: object,
  sectionIndex: number): void {
  if (!world.sections[sectionIndex]) throw new Error(`路线段 ${sectionIndex} 不存在。`);
  const state = requireRouteState(world, vehicle);
  world.routeStates.set(vehicle, { ...state, section: sectionIndex,
    localDistance: 0, distance: Math.fround(state.completedDistance) });
}

export function currentRouteSurface(world: RouteWorldHost, vehicle: object): string {
  return world.sections[requireRouteState(world, vehicle).section]!.surface;
}

export function prepareCurrentSectionReset(world: RouteWorldHost, vehicle: object):
  { position: Vec3; forward: Vec3; up: Vec3; surface: string } {
  const section = world.sections[requireRouteState(world, vehicle).section]!;
  const first = section.frames[0];
  if (!first) throw new Error("当前路线段缺少 reset frame 0。");
  return {
    position: add(first.position, scale(first.forward, Math.fround(0.10000000149011612))),
    forward: copy(first.forward), up: copy(first.up), surface: section.surface,
  };
}

export function commitCurrentSectionReset(world: RouteWorldHost, vehicle: object): void {
  const state = requireRouteState(world, vehicle);
  world.routeStates.set(vehicle, { ...state,
    resetAux68: 0, resetAux74: 0, resetAux80: 0, resetAux8C: 0 });
}

/** Applies gate transitions before projecting the kart onto the active route. */
export function updateRoute(world: RouteWorldHost, vehicle: object,
  previousPosition: Vec3, currentPosition: Vec3, onTag?: RouteTag): RouteState {
  const initial = requireRouteState(world, vehicle);
  let sectionIndex = initial.section;
  let lap = initial.lap;
  let completedDistance = initial.completedDistance;
  let movedForward = false;
  let transitions = 0;
  let selfLoop = false;

  for (;;) {
    let crossed = false;
    const section = world.sections[sectionIndex]!;
    for (const edge of section.outgoing) {
      let crossing = routeGateCrossing(edge.gate, previousPosition, currentPosition) > 0;
      if (!crossing) {
        const following = world.sections[edge.section]!.outgoing;
        for (let i = 0; i < following.length; i += 1) {
          if (routeGateCrossing(following[i]!.gate,
            previousPosition, currentPosition) > 0) {
            crossing = true;
            break;
          }
        }
      }
      if (!crossing) continue;
      completedDistance = Math.fround(completedDistance + section.length);
      const from = sectionIndex;
      const to = edge.section;
      const oldSurface = world.sections[from]!.surface;
      const newSurface = world.sections[to]!.surface;
      if (oldSurface !== newSurface && oldSurface) {
        onTag?.(`${oldSurface}:out:next`, firstFrame(world.sections[from]!));
      }
      sectionIndex = to;
      if (to === world.data.firstSection ||
          (edge.gate.final && world.data.lapTarget !== undefined &&
            initial.lap === world.data.lapTarget)) lap += 1;
      world.routeStates.set(vehicle, { ...initial,
        section: sectionIndex, lap, localDistance: 0,
        completedDistance, distance: completedDistance });
      if (oldSurface !== newSurface && newSurface) {
        onTag?.(`${newSurface}:in:next`, firstFrame(world.sections[to]!));
      }
      movedForward = true;
      crossed = true;
      if (from === sectionIndex) selfLoop = true;
      break;
    }
    if (!crossed || selfLoop) break;
    if (transitions++ > world.sections.length * 2) {
      throw new Error("route forward transition cycle 未收敛。");
    }
  }

  if (!movedForward) {
    for (;;) {
      let crossed = false;
      const section = world.sections[sectionIndex]!;
      for (const edge of section.incoming) {
        if (routeGateCrossing(edge.gate, previousPosition, currentPosition) >= 0) continue;
        const from = sectionIndex;
        const to = edge.section;
        const oldSurface = world.sections[from]!.surface;
        const newSurface = world.sections[to]!.surface;
        if (oldSurface !== newSurface && oldSurface) {
          onTag?.(`${oldSurface}:out:prev`, firstFrame(world.sections[from]!));
        }
        sectionIndex = to;
        completedDistance = Math.fround(completedDistance - world.sections[to]!.length);
        if (from === world.data.firstSection) lap = lap > 0 ? lap - 1 : 0;
        world.routeStates.set(vehicle, { ...initial,
          section: sectionIndex, lap, localDistance: 0,
          completedDistance, distance: completedDistance });
        if (oldSurface !== newSurface && newSurface) {
          onTag?.(`${newSurface}:in:prev`, firstFrame(world.sections[to]!));
        }
        crossed = true;
        if (from === sectionIndex) selfLoop = true;
        break;
      }
      if (!crossed || selfLoop) break;
      if (transitions++ > world.sections.length * 2) {
        throw new Error("route reverse transition cycle 未收敛。");
      }
    }
  }

  const localDistance = projectSectionDistance(currentPosition,
    world.sections[sectionIndex]!);
  const updated = { ...initial, section: sectionIndex, lap, localDistance,
    completedDistance,
    distance: Math.fround(completedDistance + localDistance) };
  world.routeStates.set(vehicle, updated);
  return updated;
}

const f32 = Math.fround;
const railStep = f32(0.20000000298023224);
const routeTolerance = f32(0.10000000149011612);

/** Physics vector product; unlike routeDot, this accumulates x, y, then z. */
function physicsDot(a: Vec3, b: Vec3): number {
  return f32(f32(f32(a.x * b.x) + f32(a.y * b.y)) + f32(a.z * b.z));
}

/** Finds the closest admissible RouteSection when a kart leaves its current path. */
export function associateRoute(world: RouteWorldHost, vehicle: object,
  position: Vec3): boolean {
  const state = requireRouteState(world, vehicle);
  let selected: number | null = null;
  let bestSquared = 999999;
  const rejectOutsideSegment = (squared: number, up: Vec3, delta: Vec3): void => {
    if (squared < bestSquared &&
        physicsDot(up, add(delta, scale(up, railStep))) > -routeTolerance) {
      bestSquared = squared;
      selected = null;
    }
  };
  world.sections.forEach((section, sectionIndex) => {
    for (let index = 0; index + 1 < section.frames.length; index += 1) {
      const start = section.frames[index]!;
      const end = section.frames[index + 1]!;
      const reverseSegment = subtract(start.position, end.position);
      const fromEnd = subtract(position, end.position);
      const alongEnd = physicsDot(reverseSegment, fromEnd);
      if (alongEnd < 0) {
        rejectOutsideSegment(physicsDot(fromEnd, fromEnd), end.up, fromEnd);
        continue;
      }
      const fromStart = subtract(position, start.position);
      if (physicsDot(scale(reverseSegment, -1), fromStart) < 0) {
        rejectOutsideSegment(physicsDot(fromStart, fromStart), start.up, fromStart);
        continue;
      }
      const fraction = alongEnd / physicsDot(reverseSegment, reverseSegment);
      const foot = add(end.position, scale(reverseSegment, fraction));
      const delta = subtract(position, foot);
      const squared = physicsDot(delta, delta);
      if (squared < bestSquared &&
          physicsDot(end.up, add(delta, scale(end.up, railStep))) > -routeTolerance) {
        bestSquared = squared;
        selected = sectionIndex;
      }
    }
  });
  if (selected === null) return false;
  const localDistance = projectSectionDistance(position, world.sections[selected]!);
  world.routeStates.set(vehicle, { ...state, section: selected, localDistance,
    distance: f32(state.completedDistance + localDistance) });
  return true;
}

/** Destination pose used by a warpnext surface leading into another section. */
export function warpNextDestination(world: RouteWorldHost, vehicle: object):
  { position: Vec3; forward: Vec3; up: Vec3 } {
  const section = world.sections[requireRouteState(world, vehicle).section]!;
  if (section.surface !== "warpnext") {
    throw new Error("warpnext destination 的当前路线段类型不匹配。");
  }
  const edge = section.outgoing[0];
  if (!edge) throw new Error("warpnext 路线段缺少原版 outgoing[0]。");
  const frame = firstFrame(world.sections[edge.section]!);
  const position = subtract(frame.position, scale(frame.forward, railStep));
  position.z = f32(-f32(f32(-frame.position.z) -
    f32(f32(-frame.forward.z) * railStep)));
  return { position, forward: copy(frame.forward), up: copy(frame.up) };
}

/** Commits a warpnext section when the next RouteSection is a rail. */
export function completeWarpNextRailLanding(world: RouteWorldHost,
  vehicle: object, onTag?: RouteTag): boolean {
  const state = requireRouteState(world, vehicle);
  const section = world.sections[state.section]!;
  if (section.surface !== "warpnext") return false;
  const edge = section.outgoing[0];
  if (!edge) throw new Error("warpnext 路线段缺少 outgoing[0]。");
  const next = world.sections[edge.section]!;
  if (!next.surface.includes("rail")) return false;
  onTag?.("warpnext:out:next", firstFrame(section));
  const completedDistance = f32(state.completedDistance + section.length);
  const lap = edge.section === world.data.firstSection ||
    (edge.gate.final && world.data.lapTarget !== undefined &&
      state.lap === world.data.lapTarget) ? state.lap + 1 : state.lap;
  world.routeStates.set(vehicle, { ...state, section: edge.section, lap,
    localDistance: 0, completedDistance, distance: completedDistance });
  onTag?.(`${next.surface}:in:next`, firstFrame(next));
  return true;
}

export interface RailWorldHost extends RouteWorldHost {
  data: RouteWorldHost["data"] & { railCaptureDistance?: number };
}

export function railCaptureDistance(world: RailWorldHost): number {
  const distance = world.data.railCaptureDistance;
  if (distance === undefined) throw new Error("rail capture distance 未安装。");
  return distance;
}

export interface RailConfig {
  id?: string;
  minVelocity: number;
  maxVelocity: number;
  accelFactor: number;
  resistFactor: number;
  gravityFactor: number;
}

export interface RailRegistryWorldHost {
  data: { railConfig?: {
    records: readonly RailConfig[];
    defaultConfig: RailConfig;
  } };
}

/** Registry resolution preserves source order when duplicate rail IDs exist. */
export function lookupRailConfig(world: RailRegistryWorldHost, id: string): RailConfig {
  const registry = world.data.railConfig;
  if (!registry) throw new Error("rail descriptor 缺少 rail.bml registry。");
  return registry.records.find(record => record.id === id) ?? registry.defaultConfig;
}

/** Selects the nearest outgoing rail polyline within the track's capture range. */
export function completeRailContactLanding(world: RailWorldHost, vehicle: object,
  position: Vec3, onTag?: RouteTag): boolean {
  const state = requireRouteState(world, vehicle);
  const section = world.sections[state.section]!;
  if (section.surface.includes("rail")) return false;
  const railEdges = section.outgoing.filter(edge =>
    world.sections[edge.section]!.surface.includes("rail"));
  if (railEdges.length === 0) return false;
  const capture = railCaptureDistance(world);
  let selected: (typeof railEdges)[number] | undefined;
  let bestSquared = f32(capture * capture);
  for (const edge of railEdges) {
    const frames = world.sections[edge.section]!.frames;
    for (let index = 0; index + 1 < frames.length; index += 1) {
      const start = frames[index]!.position;
      const segment = subtract(frames[index + 1]!.position, start);
      const lengthSquared = physicsDot(segment, segment);
      const fraction = lengthSquared > 0 ? Math.max(0,
        Math.min(1, physicsDot(subtract(position, start), segment) / lengthSquared)) : 0;
      const offset = subtract(position, add(start, scale(segment, fraction)));
      const distanceSquared = physicsDot(offset, offset);
      if (distanceSquared < bestSquared) {
        bestSquared = distanceSquared;
        selected = edge;
      }
    }
  }
  if (!selected) return false;
  const rail = world.sections[selected.section]!;
  if (section.surface) onTag?.(`${section.surface}:out:next`, firstFrame(section));
  const completedDistance = f32(state.completedDistance + section.length);
  const localDistance = projectSectionDistance(position, rail);
  const lap = selected.section === world.data.firstSection ||
    (selected.gate.final && world.data.lapTarget !== undefined &&
      state.lap === world.data.lapTarget) ? state.lap + 1 : state.lap;
  world.routeStates.set(vehicle, { ...state, section: selected.section, lap,
    localDistance, completedDistance,
    distance: f32(completedDistance + localDistance) });
  onTag?.(`${rail.surface}:in:next`, firstFrame(rail));
  return true;
}
