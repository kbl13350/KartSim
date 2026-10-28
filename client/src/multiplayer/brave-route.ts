import { buildTrackCourseGraph, type TrackCourseGraph } from "../resources/track-course-graph";

type Team = 1 | 2;
type Vec3 = TrackCourseGraph["start"]["position"];

/** A race freezes its direction assignment; the client never draws it again. */
export interface BraveRouteSelection {
  ruleset: "web-brave-v1";
  forwardTeam: Team;
  localTeam: Team;
}

export interface BraveMapRoute extends BraveRouteSelection {
  starts: Record<Team, TrackCourseGraph["start"]>;
}

export interface BraveStartPose {
  position: Vec3;
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}
export type BraveStartPoses = Record<Team, BraveStartPose>;

const team = (value: unknown): value is Team => value === 1 || value === 2;

/** Called at the generated loadRaceAssets boundary with its frozen race. */
export function braveRouteSelection(race: any, playerId: PropertyKey): BraveRouteSelection {
  const rules = race?.brave;
  const localTeam = race?.roster?.find((entry: any) => entry.playerId === playerId)?.team;
  if (race?.trackId !== "village_R07" || rules?.ruleset !== "web-brave-v1" ||
      !team(rules.forwardTeam) || !team(localTeam))
    throw new Error("勇者竞速缺少冻结赛道、方向或本机红蓝队身份。");
  return { ruleset: "web-brave-v1", forwardTeam: rules.forwardTeam, localTeam };
}

export function validateBraveRoute(selection: BraveRouteSelection | undefined,
  trackId: string): asserts selection is BraveRouteSelection {
  if (trackId !== "village_R07" || selection?.ruleset !== "web-brave-v1" ||
      !team(selection.forwardTeam) || !team(selection.localTeam))
    throw new Error("勇者竞速地图缺少本局冻结方向。");
}

/**
 * Only the other team's course graph is extracted here. Both teams use the
 * same track.1s scenery and collision triangles; the reverse decoration
 * variant would give the clients different collision worlds.
 */
export function braveMapRoute(selection: BraveRouteSelection,
  model: { root: { trackObjects: unknown[] } }, localRoute: TrackCourseGraph): BraveMapRoute {
  const otherTeam = selection.localTeam === 1 ? 2 : 1;
  const otherRoute = buildTrackCourseGraph(model.root.trackObjects as
    Parameters<typeof buildTrackCourseGraph>[0], otherTeam !== selection.forwardTeam);
  const starts = {
    [selection.localTeam]: localRoute.start,
    [otherTeam]: otherRoute.start,
  } as Record<Team, TrackCourseGraph["start"]>;
  return { ...selection, starts };
}

/** Use the actual physics reset to keep both teams' bases float32-identical. */
export function captureBraveStartPoses(map: BraveMapRoute, physics: {
  resetFromRouteFrame(frame: TrackCourseGraph["start"]): void;
  body: BraveStartPose;
}): BraveStartPoses {
  const poses = {} as BraveStartPoses;
  for (const value of [1, 2] as const) {
    physics.resetFromRouteFrame(map.starts[value]);
    const { position, right, forward, up } = physics.body;
    poses[value] = structuredClone({ position, right, forward, up });
  }
  // The final reset belongs to the local route, including its reset state.
  physics.resetFromRouteFrame(map.starts[map.localTeam]);
  return poses;
}

/**
 * The server assigns red slots 0..3 and blue slots 4..7. Each team uses the
 * first four columns at its own start, regardless of which team is forward.
 * Local physics and every remote presentation call this same mapping.
 */
export function bravePlayerStart(race: any, playerId: PropertyKey,
  poses: BraveStartPoses): { pose: BraveStartPose; slot: number } {
  const selection = braveRouteSelection(race, playerId);
  const value = race.startSlots?.[playerId];
  const base = selection.localTeam === 1 ? 0 : 4;
  if (!Number.isInteger(value) || value < base || value >= base + 4)
    throw new Error("勇者竞速起跑位与红蓝队不一致。");
  const pose = poses[selection.localTeam];
  if (!pose) throw new Error("勇者竞速缺少该队起跑姿态。");
  return { pose, slot: value - base };
}
