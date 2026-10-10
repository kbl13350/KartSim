interface ResultScene {
  object: unknown;
  reset(time: number): void;
  update(time: number, camera: unknown, width: number, height: number): void;
  dispose(): void;
}

export interface RoadblockResultDependencies {
  parseScene(bytes: Uint8Array): any;
  attribute(node: unknown, name: string): string | undefined;
  buildScene(parsed: unknown, library: unknown, name: string,
    resolve: (reference: unknown) => unknown, options: unknown): Promise<ResultScene>;
  resolveSource(library: unknown, path: string, reference: unknown): unknown;
  validateStand(root: unknown): void;
  createGroup(): any;
  createCameraPublisher(): { apply(camera: unknown, pose: unknown): void };
  createDistance(): { reset(time: number): void; update(time: number): unknown };
  startBasis(start: unknown, reversePodium: boolean): any;
  nativePoint(point: unknown): { x: number; y: number; z: number };
  createVector(x: number, y: number, z: number): unknown;
  runnerPose(basis: unknown, ground: unknown): unknown;
  cameraPose(basis: unknown, ground: unknown, distance: unknown): unknown;
}

const STAND_PATH = "stuff/award/stand/indi.1s";
const CONFETTI_PATH = "stuff/award/effect/ob_award_efect_a.1s";

/** Load the exact native podium and confetti assets for the result screen. */
export async function loadRoadblockResultParts(library: any, raceAssets: any,
  ops: RoadblockResultDependencies): Promise<{
    stand: ResultScene; confetti: ResultScene; reversePodium: boolean;
  }> {
  const exactBytes = async (path: string) => {
    const matches = library.exactCanonicalCandidates(path);
    if (matches.length !== 1) throw new Error(`挡人结算资源不唯一：${path}`);
    return matches[0].bytes();
  };
  const track = ops.parseScene(await exactBytes(raceAssets.map.path));
  if (track.root.kind !== "track") throw new Error("挡人结算赛道没有 course owner。");
  const course = track.root.trackObjects
    .find((object: any) => object.kind === "TrackObject" && object.name === "track")
    ?.property?.children.find((child: any) => child.name === "course");
  if (!course) throw new Error("挡人结算赛道缺少 course。");
  const reversePodium = /^(?:1|true|on)$/i.test((ops.attribute(course, "reversePodium") ?? "").trim());
  const parsedStand = ops.parseScene(await exactBytes(STAND_PATH));
  if (parsedStand.root.kind !== "node") throw new Error("挡人奖台不是 Relement。");
  const options = {
    environment: raceAssets.map.environment,
    stageBinding: raceAssets.map.stageBinding,
    advanceEnvironment: false,
  };
  const stand = await ops.buildScene(parsedStand, library, "RoadBlockFinalStand",
    reference => ops.resolveSource(library, STAND_PATH, reference), options);
  let confetti: ResultScene | undefined;
  try {
    ops.validateStand(parsedStand.root);
    confetti = await ops.buildScene(
      ops.parseScene(await exactBytes(CONFETTI_PATH)), library, "RoadBlockFinalConfetti",
      reference => ops.resolveSource(library, CONFETTI_PATH, reference), options,
    );
    return { stand, confetti, reversePodium };
  } catch (error) {
    confetti?.dispose();
    stand.dispose();
    throw error;
  }
}

/** Owns the podium animation and camera during a roadblock result. */
export class RoadblockResultPresentation {
  readonly root: any;
  readonly effectRoot: any;
  readonly cameraPublisher: { apply(camera: unknown, pose: unknown): void };
  readonly distance: { reset(time: number): void; update(time: number): unknown };
  basis: any;
  ground: any;
  runner: any;
  runnerView: any;
  disposed = false;

  constructor(
    readonly stand: ResultScene,
    readonly confetti: ResultScene,
    readonly reversePodium: boolean,
    readonly dependencies: RoadblockResultDependencies,
  ) {
    this.root = dependencies.createGroup();
    this.effectRoot = dependencies.createGroup();
    this.cameraPublisher = dependencies.createCameraPublisher();
    this.distance = dependencies.createDistance();
    this.root.add(stand.object);
    this.effectRoot.add(confetti.object);
  }

  show(time: number, world: any, raceAssets: any, views: Map<unknown, any>, result: any): void {
    if (this.disposed || this.runner) return;
    if (!result.roadblock || !result.roadblockOutcome)
      throw new Error("挡人结算缺少跑者和胜负。");
    const participant = raceAssets.participants.find((entry: any) =>
      entry.playerId === result.roadblock.runnerId);
    const view = views.get(result.roadblock.runnerId);
    if (!participant || !view || !participant.characters.ordinary?.award ||
      participant.characters.linked) {
      throw new Error("挡人结算跑者人车未就绪。");
    }
    const start = world.track.getStart();
    const ground = world.track.rayQuery(
      { x: start.position.x, y: Math.fround(start.position.y + 10), z: start.position.z },
      { x: 0, y: -60, z: 0 }, false,
    )?.point;
    if (!ground) throw new Error("挡人结算基准未命中原生地面。");
    this.basis = this.dependencies.startBasis(start, this.reversePodium);
    this.ground = ground;
    const [right, forward, up] = this.basis;
    const basisRight = this.dependencies.nativePoint({ x: right.x, y: forward.x, z: up.x });
    const basisUp = this.dependencies.nativePoint({ x: right.z, y: forward.z, z: up.z });
    const basisForward = this.dependencies.nativePoint({ x: -right.y, y: -forward.y, z: -up.y });
    this.root.matrixAutoUpdate = false;
    this.root.matrix.makeBasis(
      this.dependencies.createVector(basisRight.x, basisRight.y, basisRight.z),
      this.dependencies.createVector(basisUp.x, basisUp.y, basisUp.z),
      this.dependencies.createVector(basisForward.x, basisForward.y, basisForward.z),
    ).setPosition(ground.x, ground.y, ground.z);
    this.root.matrixWorldNeedsUpdate = true;
    this.effectRoot.matrixAutoUpdate = false;
    this.effectRoot.matrix.copy(this.root.matrix);
    this.effectRoot.matrixWorldNeedsUpdate = true;
    const startTime = Math.trunc(time) >>> 0;
    this.stand.reset(startTime);
    this.confetti.reset(startTime);
    this.distance.reset(startTime);
    for (const [id, candidate] of views) candidate.root.visible = id === participant.playerId;
    view.resetAnimation();
    participant.characters.ordinary.scene.reset();
    view.updatePose(this.dependencies.runnerPose(this.basis, ground));
    view.root.updateMatrixWorld(true);
    participant.characters.ordinary.award.enterResult(result.roadblockOutcome.runnerWon ? 12 : 13);
    this.runner = participant;
    this.runnerView = view;
  }

  update(time: number, camera: unknown, width: number, height: number): void {
    if (this.disposed || !this.runner || !this.basis || !this.ground) return;
    this.cameraPublisher.apply(camera,
      this.dependencies.cameraPose(this.basis, this.ground,
        this.distance.update(Math.trunc(time) >>> 0)));
    this.runnerView.root.updateMatrixWorld(true);
    this.stand.update(time, camera, width, height);
    this.confetti.update(time, camera, width, height);
    const runner = this.runner;
    runner.vehicle.imported.renderScene?.update(camera, width, height);
    runner.characters.ordinary.scene.update(time, camera, width, height, undefined);
    for (const accessory of runner.vehicle.accessories)
      accessory.render.scene.update(time, camera, width, height);
    runner.vehicle.decoration?.scene.update(time, camera, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runner = undefined;
    this.runnerView = undefined;
    this.root.removeFromParent();
    this.effectRoot.removeFromParent();
    this.confetti.dispose();
    this.stand.dispose();
  }
}
