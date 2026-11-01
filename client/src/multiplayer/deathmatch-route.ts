import type { TrackCourseGraph } from "../resources/track-course-graph";
import { isDeathmatchState, isDeathmatchTrack, type DeathmatchState } from "./deathmatch-rules";

type Vec3 = TrackCourseGraph["start"]["position"];
interface NativeDummy {
  kind: string;
  name: string;
  transform?: { position: number[]; basis: number[][] };
}
export interface DeathmatchMapRoute {
  ruleset: DeathmatchState["ruleset"];
  starts: TrackCourseGraph["start"][];
}

export function validateDeathmatchRoute(state: DeathmatchState | undefined,
  trackId: string): asserts state is DeathmatchState {
  if (!isDeathmatchTrack(trackId) || !isDeathmatchState(state))
    throw new Error("死斗地图缺少有效的冻结赛道与规则。");
}

function vector(value: number[] | undefined, direction = false): Vec3 {
  if (!value || value.length !== 3 || !value.every(Number.isFinite))
    throw new Error("死斗原版出生点坐标或朝向无效。");
  const length = direction ? Math.hypot(...value) : 1;
  if (length < 1e-8) throw new Error("死斗原版出生点朝向为空。");
  return { x: value[0]! / length, y: value[2]! / length, z: -value[1]! / length };
}

function samePoint(a: Vec3, b: Vec3): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.001;
}

/** Each arena owns eight original sp00–sp07 poses, rather than a staggered race grid. */
export function deathmatchMapRoute(state: DeathmatchState,
  model: { root: { kind: string; trackObjects: NativeDummy[] } }, trackId: string): DeathmatchMapRoute {
  validateDeathmatchRoute(state, trackId);
  if (model.root.kind !== "track") throw new Error("死斗地图缺少 TrackContainer。");
  const dummies = model.root.trackObjects.filter(object => object.kind === "ToDummy" && /^sp0[0-7]$/.test(object.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (dummies.length !== 8 || dummies.some((dummy, slot) => dummy.name !== `sp0${slot}`))
    throw new Error("死斗地图缺少八个原版出生点。");
  const starts = dummies.map((dummy, slot) => {
    const frame = { position: vector(dummy.transform?.position),
      forward: vector(dummy.transform?.basis[1], true), up: vector(dummy.transform?.basis[2], true) };
    const frozen = state.spawns[slot]!;
    if (!samePoint(frame.position, frozen.position) || !samePoint(frame.forward, frozen.forward))
      throw new Error("死斗冻结出生点与原版赛道不一致。");
    return frame;
  });
  return { ruleset: state.ruleset, starts };
}
