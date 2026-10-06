interface Point3 { x: number; y: number; z: number }
interface StartFrame { position: Point3 }

interface StartPhysics {
  body: {
    position: Point3;
    right: Point3;
    forward: Point3;
    up: Point3;
  };
  state: { trackProgress: number };
  resetFromRouteFrame(frame: StartFrame): void;
}

interface StartTrack {
  getStart(): StartFrame;
  resetRouteState(physics: StartPhysics, position: Point3): void;
  getRouteState(physics: StartPhysics): { distance: number };
}

interface StartGhost {
  startSlot: number;
  view: { seedStart(position: Point3, right: Point3, forward: Point3, up: Point3): void };
}

interface GhostRouteProgress {
  seed(ghost: StartGhost, position: Point3): void;
}

export interface StartGridStage {
  host: {
    currentPlayerSlot: number;
    session: {
      ghosts: StartGhost[];
      coordinator?: { synchronizePositionAnchor(): void };
    };
    getTrack(): StartTrack;
    getPhysics(): StartPhysics;
  };
  ghostRouteProgress: GhostRouteProgress;
  ghostPoses: unknown[];
  traceGround(origin: Point3, direction: Point3): Point3 | undefined;
  snapStartToGround(point: Point3): Point3 | undefined;
  seedGhostStart(frame: StartFrame): void;
}

export interface StartGridDependencies {
  slotOffset(slot: number): number;
  createGhostRouteProgress(track: StartTrack): GhostRouteProgress;
}

/** Place the local kart in its slot and reset route progress. */
export function placeAtStart(
  stage: StartGridStage,
  dependencies: Pick<StartGridDependencies, "slotOffset">,
): void {
  const { host } = stage;
  const start = host.getTrack().getStart();
  host.getPhysics().resetFromRouteFrame(start);
  const body = host.getPhysics().body;
  const offset = dependencies.slotOffset(host.currentPlayerSlot);
  body.position = {
    x: Math.fround(Math.fround(body.right.x * offset) + body.position.x),
    y: Math.fround(Math.fround(body.right.y * offset) + body.position.y),
    z: Math.fround(Math.fround(body.right.z * offset) + body.position.z),
  };
  body.position = stage.snapStartToGround(body.position) ?? body.position;
  host.getTrack().resetRouteState(host.getPhysics(), body.position);
  host.session.coordinator?.synchronizePositionAnchor();
  host.getPhysics().state.trackProgress = host.getTrack()
    .getRouteState(host.getPhysics()).distance;
  stage.seedGhostStart(start);
}

/** Cast downward from ten units above the slot to find road height. */
export function snapStartToGround(stage: StartGridStage, point: Point3): Point3 | undefined {
  const origin = { x: point.x, y: Math.fround(point.y + 10), z: point.z };
  return stage.traceGround(origin, { x: 0, y: -100, z: 0 });
}

/** Seed each Ghost in its own start slot and initialize route tracking. */
export function seedGhostStart(
  stage: StartGridStage,
  frame: StartFrame,
  dependencies: StartGridDependencies,
): void {
  const { host } = stage;
  stage.ghostRouteProgress = dependencies.createGhostRouteProgress(host.getTrack());
  stage.ghostPoses = [];
  if (host.session.ghosts.length === 0) return;
  const body = host.getPhysics().body;
  for (const ghost of host.session.ghosts) {
    const offset = dependencies.slotOffset(ghost.startSlot);
    let position = {
      x: Math.fround(Math.fround(body.right.x * offset) + frame.position.x),
      y: Math.fround(Math.fround(body.right.y * offset) + frame.position.y),
      z: Math.fround(Math.fround(body.right.z * offset) + frame.position.z),
    };
    position = stage.snapStartToGround(position) ?? position;
    ghost.view.seedStart(position, body.right, body.forward, body.up);
    stage.ghostRouteProgress.seed(ghost, position);
  }
}
