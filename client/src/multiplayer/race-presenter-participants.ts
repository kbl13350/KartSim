/** Updates each racer presentation after the multiplayer camera is positioned. */
import { drivenPose, type KartPoseVectors } from "../item/item-kart-motion";
import { Frustum, Matrix4, Object3D, Sphere, Vector3, type Camera } from "three";
import { applyItemKartPresentation } from "../item/item-kart-presentation";
import { updateRacePresenterItems, type RacePresenterItemsHost } from "./race-presenter-items";
import { roadSound } from "../resources/track-road-descriptor";
import { groundRoadDust, PoseSpeed, vehicleRoadDust, type RoadDustTrack,
  type RoadDustVehicle } from "../vehicle/road-dust-effect";

interface Vec3 { x: number; y: number; z: number }
interface RacePose { position: Vec3; visualScale?: unknown; [key: string]: unknown }
interface RaceMotion {
  boosterState: number;
  instantAccelerationActive: boolean;
  [key: string]: unknown;
}
interface RacerPresentation {
  motion: RaceMotion;
  animation?: unknown;
  frontLamp: unknown;
  rearLamp: unknown;
}
interface SceneUpdater {
  /** 50人乱斗 karts away from the camera skip their Toon outlines (library.js brawl patch). */
  setOutlinesSkipped?(skip: boolean): void;
  update(...args: unknown[]): void;
}
interface VehicleAsset {
  imported: { renderScene?: SceneUpdater };
  lampFlares: {
    setInputPair(pair: string, input: unknown): void;
    update(nowMs: number, camera: unknown, imported: boolean): void;
  };
  trails: {
    /** The trail effects, outside the racer view root (hidden with an invisible kart). */
    object?: { visible: boolean };
    setState(boost: number, nowMs: number): void;
    update(nowMs: number, camera: unknown, imported: boolean): void;
  };
  accessories: Array<{
    kind: string;
    render: {
      setOwnerState?(boost: number, nowMs: number): void;
      scene: SceneUpdater;
    };
  }>;
  decoration?: { scene: SceneUpdater & { object?: { visible: boolean } } };
  /** The booster effects (kart-booster-effects.ts), magnet state look included. */
  effects?: { setMagnetSuppressed?(suppressed: boolean, nowMs: number): void };
  /** 沙尘/水花 behind the wheels (road-dust-effect.ts). */
  roadDust?: { update(nowMs: number, name: string | undefined, camera: unknown,
    width: number, height: number): void };
  /** The kart's KartAudioRuntime: only the local racer's plays. */
  audio?: { updateRoad?(name: string | undefined, speed: number, elapsedSeconds: number): void };
}
interface RacerAsset {
  playerId: unknown;
  vehicle: VehicleAsset;
  draftEffect?: {
    update(nowMs: number, visible: boolean, burst: boolean,
      camera: unknown, width: number, height: number): void;
  };
  characters: {
    linked?: { scene: SceneUpdater };
    ordinary?: { scene: SceneUpdater };
  };
}
interface RacerView {
  root: { visible: boolean; updateMatrixWorld(force: boolean): void };
  update(state: Record<string, unknown>, nowMs: number,
    animationInput: unknown): unknown;
  updateRemote(pose: Record<string, unknown>, nowMs: number,
    animation: unknown): void;
  updatePose(pose: Record<string, unknown>): void;
}
interface LocalPhysics {
  body: {
    position: Vec3;
    right: unknown;
    forward: unknown;
    up: unknown;
  };
  state: Record<string, unknown>;
  wheels?: { roadDescriptor?: Parameters<typeof roadSound>[0] };
  runtime?: { contactWorking: boolean };
  displaySpeedKmh?(): number;
  giant?: { main: number; extra: unknown };
  consumeKartAnimationInput(): unknown;
  setAnimationSlot(slot: unknown): void;
}
interface RacerRemoteRuntime {
  consumePresentation(playerId: unknown): RacerPresentation | undefined;
  copyWebPose(playerId: unknown): RacePose | undefined;
  presentationVisible(playerId: unknown, nowMs: number): boolean;
  hasDeparted(playerId: unknown): boolean;
  giant(playerId: unknown): { main: number; extra: unknown } | undefined;
}

export interface RacePresenterParticipantsHost {
  playerId: unknown;
  camera: unknown;
  assets: RacePresenterItemsHost["assets"] & {
    map: { stageBinding: { beginFrame(nowMs: number): void } };
    lteCoins?: SceneUpdater;
    rain?: SceneUpdater;
    snow?: SceneUpdater;
    participants: RacerAsset[];
  };
  runtime: RacePresenterItemsHost["runtime"] & {
    deathmatch?: { opacity(playerId: string): number };
    local: {
      physics: LocalPhysics;
      track: { updateRender(nowMs: number, camera: unknown,
        width: number, height: number): void } & Partial<RoadDustTrack>;
      resetVisible(nowMs: number): boolean;
      warpNext: { presentationVisible(nowMs: number): boolean };
    };
    localPresentation: RacerPresentation | undefined;
    remotes: RacerRemoteRuntime;
    finishSnapshot(): unknown;
    resultSnapshot(): Array<{ playerId: unknown; elapsedMs: number | null }> | undefined;
    draftPresentationVisible(playerId: unknown): boolean;
    draftBurstActive(playerId: unknown): boolean;
  };
  views: Map<unknown, RacerView>;
  initialPoses: Map<unknown, RacePose>;
  linkedPresentations: Map<unknown, {
    updateSpeedRace(boost: number, nowMs: number): unknown;
    simpleShadowEnabled(): boolean;
  }>;
  giantAppearances: Map<unknown, { update(main: number, extra: unknown): void }>;
  retiredCharacterIds: Set<unknown>;
  localRetirePending: boolean;
  winnerMotion: {
    consume(playerId: unknown, localId: unknown, finishSnapshot: unknown,
      retired: boolean): unknown;
  };
}

export interface RacePresenterParticipantDependencies {
  updateRemoteVehicleEffects(vehicle: VehicleAsset, view: RacerView,
    camera: unknown, nowMs: number, animation: unknown,
    instantAccelerationActive: boolean, width: number, height: number): void;
  updateLocalVehicleEffects(vehicle: VehicleAsset,
    local: RacePresenterParticipantsHost["runtime"]["local"],
    view: RacerView, camera: unknown, nowMs: number, animationSlot: unknown,
    simpleShadowEnabled: boolean): void;
}

const stoppedMotion = {
  forwardSpeed: 0,
  rawSteer: 0,
  tireTransient: 0,
  boosterState: 0,
  instantAccelerationActive: false,
  motorcycle: false,
  landingTrigger: false,
  collisionHit: false,
  collisionStrength: 0,
  visualScaleMode: 0,
};

export function updateRacePresenterParticipants(host: RacePresenterParticipantsHost,
  nowMs: number, width: number, height: number,
  dependencies: RacePresenterParticipantDependencies):
  Array<{ playerId: unknown; pose: RacePose }> {
  const { assets, camera, runtime } = host;
  const { physics, track } = runtime.local;
  assets.map.stageBinding.beginFrame(nowMs);
  track.updateRender(nowMs, camera, width, height);
  updateRacePresenterItems(host, nowMs, width, height);
  assets.lteCoins?.update(nowMs, camera, width, height);
  assets.rain?.update(nowMs, camera, width, height);
  assets.snow?.update(nowMs, camera, width, height);

  const finishes = runtime.finishSnapshot();
  const remotePoses: Array<{ playerId: unknown; pose: RacePose }> = [];
  const inView = assets.participants.length > CULL_MIN_RACERS
    ? remoteRacerCulling(camera as Camera) : undefined;
  lodFrame = (lodFrame + 1) % 0x10000;
  // Thresholds from last frame's distances: the nearest few karts keep full
  // detail, and only the nearest MAX_DRAWN_REMOTES are drawn at all.
  const fullDetailWithin = Math.min(LOD_NEAR, nthSmallest(lastDistances, FULL_DETAIL_KARTS));
  const drawnWithin = nthSmallest(lastDistances, MAX_DRAWN_REMOTES);
  lastDistances.length = 0;
  for (const [index, racer] of assets.participants.entries()) {
    let lod: RiderLod | undefined;
    const view = host.views.get(racer.playerId);
    if (!view) continue;
    const isLocal = racer.playerId === host.playerId;
    const presentation = isLocal
      ? runtime.localPresentation
      : runtime.remotes.consumePresentation(racer.playerId);
    let animationSlot: unknown;
    // item-mode(fx): an item hit moves the drawn kart (its firedkart motion); physics stays put.
    const hitMotion = assets.itemPresenter?.kartMotion?.call(assets.itemPresenter, String(racer.playerId), nowMs);
    if (isLocal) {
      const body = physics.body;
      const drawn = hitMotion ? drivenPose(body as unknown as KartPoseVectors, hitMotion) : body;
      animationSlot = view.update({
        ...physics.state,
        x: drawn.position.x,
        y: drawn.position.y,
        z: drawn.position.z,
        right: drawn.right,
        forward: drawn.forward,
        up: drawn.up,
      }, nowMs, physics.consumeKartAnimationInput());
      if (animationSlot !== undefined) physics.setAnimationSlot(animationSlot);
    } else {
      const pose = runtime.remotes.copyWebPose(racer.playerId) ??
        host.initialPoses.get(racer.playerId);
      if (pose) {
        // Not in the release: no minimap marker for a racer who left the room, nor for an
        // invisible (tigerGhost) one on the other teams' maps (敌人暂时看不见自己).
        const unseen = assets.itemPresenter?.kartPresentation?.call(assets.itemPresenter,
          String(racer.playerId), nowMs)?.opacity === 0;
        if (!runtime.remotes.hasDeparted(racer.playerId) && !unseen)
          remotePoses.push({ playerId: racer.playerId, pose });
        const distance = inView?.(pose.position);
        if (distance !== undefined) lastDistances.push(distance);
        if (inView && (distance === undefined || distance > drawnWithin)) {
          // 50人乱斗: a kart off screen or far away is neither drawn nor animated.
          cullRemoteRacer(racer, view, nowMs, camera, width, height);
          continue;
        }
        if (distance !== undefined) lod = riderLod(distance, lodFrame + index, fullDetailWithin);
        const trails = racer.vehicle.trails.object;
        if (trails && culledTrails.delete(trails)) trails.visible = true;
        const drawn = hitMotion ? { ...pose, ...drivenPose(pose as unknown as KartPoseVectors, hitMotion) } : pose;
        const projectedPose = {
          x: drawn.position.x,
          y: drawn.position.y,
          z: drawn.position.z,
          ...drawn,
          visualScale: "visualScale" in pose
            ? pose.visualScale : { x: 1, y: 1, z: 1 },
        };
        if (presentation?.animation) {
          view.updateRemote(projectedPose, nowMs, presentation.animation);
        } else {
          view.updatePose(projectedPose);
        }
      }
    }

    view.root.visible = isLocal
      ? runtime.local.resetVisible(nowMs) &&
        runtime.local.warpNext.presentationVisible(nowMs)
      : runtime.remotes.presentationVisible(racer.playerId, nowMs);
    // item-mode(fx): an invisible (tigerGhost) kart and a popping balloon.
    const itemLook = assets.itemPresenter?.kartPresentation;
    if (itemLook) applyItemKartPresentation({
      root: view.root as unknown as Object3D,
      extras: [racer.vehicle.trails.object],
      balloon: racer.vehicle.decoration?.scene.object,
    }, itemLook.call(assets.itemPresenter, String(racer.playerId), nowMs));
    if (runtime.deathmatch) applyItemKartPresentation({
      root: view.root as unknown as Object3D, extras: [racer.vehicle.trails.object],
    }, { opacity: runtime.deathmatch.opacity(String(racer.playerId)), balloonVisible: true });
    const motion = presentation?.motion;
    const linked = host.linkedPresentations.get(racer.playerId);
    const linkedMotion = motion
      ? linked?.updateSpeedRace(motion.boosterState, nowMs) : undefined;
    // 50人乱斗: only the drawn part of the kart (most of its tree is hidden
    // booster effects); what its effects show this frame is placed below.
    if (inView) updateVisibleWorldMatrices(view.root as unknown as Object3D);
    else view.root.updateMatrixWorld(true);
    const giant = isLocal ? physics.giant : runtime.remotes.giant(racer.playerId);
    if (giant) host.giantAppearances.get(racer.playerId)?.update(giant.main, giant.extra);
    racer.vehicle.imported.renderScene?.setOutlinesSkipped?.(lod ? !lod.outlines : false);
    if (inView && !isLocal) setSmallPartsDrawn(view.root as unknown as Object3D, lod?.minimumPartRadius ?? 0);
    racer.vehicle.imported.renderScene?.update(camera, width, height);
    racer.draftEffect?.update(nowMs,
      view.root.visible && runtime.draftPresentationVisible(racer.playerId),
      view.root.visible && runtime.draftBurstActive(racer.playerId),
      camera, width, height);

    const retired = isLocal ? host.localRetirePending
      : runtime.resultSnapshot()?.some(result =>
        result.playerId === racer.playerId && result.elapsedMs === null);
    const firstRetirement = retired && !host.retiredCharacterIds.has(racer.playerId);
    if (firstRetirement) host.retiredCharacterIds.add(racer.playerId);
    const finishMotion = host.winnerMotion.consume(racer.playerId,
      host.playerId, finishes, !!retired);
    const characterMotion = firstRetirement || finishMotion
      ? {
          ...stoppedMotion,
          ...motion,
          linkedPresentationMotion: linkedMotion,
          finishMotion: firstRetirement ? 13 : finishMotion,
        }
      : motion ? { ...motion, linkedPresentationMotion: linkedMotion } : undefined;
    (racer.characters.linked ?? racer.characters.ordinary)?.scene.update(
      nowMs, camera, width, height, characterMotion,
      // A finish (or retirement) motion arrives once: never skip its frame.
      lod && characterMotion && "finishMotion" in characterMotion ? { ...lod, animate: true } : lod);

    if (presentation) {
      racer.vehicle.lampFlares.setInputPair("front", presentation.frontLamp);
      racer.vehicle.lampFlares.setInputPair("rear", presentation.rearLamp);
    }
    const imported = racer.vehicle.imported.renderScene !== undefined;
    racer.vehicle.lampFlares.update(nowMs, camera, imported);
    // A magnet item's field (item presenter) replaces the kart's own magnet state look (MZ roads).
    racer.vehicle.effects?.setMagnetSuppressed?.(assets.itemPresenter?.pulling?.call(assets.itemPresenter,
      String(racer.playerId), nowMs) === true, nowMs);
    if (!isLocal && presentation) {
      // 50人乱斗: a kart away from the camera moves its effects with its rider's frames.
      if (presentation.animation && (!lod || lod.animate)) {
        dependencies.updateRemoteVehicleEffects(racer.vehicle, view, camera,
          nowMs, presentation.animation,
          presentation.motion.instantAccelerationActive, width, height);
      }
      racer.vehicle.trails.setState(presentation.motion.boosterState, nowMs);
      racer.vehicle.trails.update(nowMs, camera, imported);
    }
    for (const accessory of racer.vehicle.accessories) {
      if (accessory.kind === "headBand" && presentation) {
        accessory.render.setOwnerState?.(presentation.motion.boosterState, nowMs);
      }
      accessory.render.scene.update(nowMs, camera, width, height);
    }
    if (isLocal) {
      dependencies.updateLocalVehicleEffects(racer.vehicle, runtime.local,
        view, camera, nowMs, animationSlot,
        linked?.simpleShadowEnabled() ?? true);
      updateLocalRoadAudio(racer.vehicle, physics, nowMs);
      if (physics.runtime && physics.wheels && physics.displaySpeedKmh)
        racer.vehicle.roadDust?.update(nowMs,
          vehicleRoadDust(physics as RoadDustVehicle, view.root.visible),
          camera, width, height);
    } else if (racer.vehicle.roadDust) {
      updateRemoteRoadDust(racer.vehicle, view.root.visible,
        runtime.remotes.copyWebPose(racer.playerId), track, nowMs, camera, width, height);
    }
    racer.vehicle.decoration?.scene.update(nowMs, camera, width, height);
    if (inView) updateVisibleWorldMatrices(view.root as unknown as Object3D);
  }
  return remotePoses;
}

/**
 * Road sounds (sand, water, bridges...) for the local kart. Not in the
 * release: its multiplayer frame (Mr0) never called updateRoad, so only time
 * attack had them. Same inputs as the time attack frame (stage-update.ts).
 */
const roadAudioClock = new WeakMap<object, number>();
function updateLocalRoadAudio(vehicle: VehicleAsset, physics: LocalPhysics, nowMs: number): void {
  const audio = vehicle.audio;
  if (!audio?.updateRoad) return;
  const previous = roadAudioClock.get(audio);
  roadAudioClock.set(audio, nowMs);
  const elapsedSeconds = previous === undefined ? 0
    : Math.min(0.5, Math.max(0, (nowMs - previous) / 1000));
  const descriptor = physics.wheels?.roadDescriptor;
  const { vx, vy, vz } = physics.state as { vx: number; vy: number; vz: number };
  audio.updateRoad(descriptor ? roadSound(descriptor) : undefined,
    Math.hypot(vx, vy, vz), elapsedSeconds);
}

/** 沙尘/水花 behind a remote kart, from the road under its drawn pose. */
const remoteSpeeds = new WeakMap<object, PoseSpeed>();
function updateRemoteRoadDust(vehicle: VehicleAsset, visible: boolean,
  pose: RacePose | undefined, track: Partial<RoadDustTrack>, nowMs: number,
  camera: unknown, width: number, height: number): void {
  const dust = vehicle.roadDust!;
  let speed = remoteSpeeds.get(dust);
  if (!speed) remoteSpeeds.set(dust, speed = new PoseSpeed());
  const kmh = pose ? speed.update(nowMs, pose.position) : 0;
  const name = visible && pose && track.rayQuery
    ? groundRoadDust(track as RoadDustTrack, pose.position, kmh) : undefined;
  dust.update(nowMs, name, camera, width, height);
}

/**
 * 50人乱斗 (server-go/BRAWL.md): with more racers than a release room holds,
 * a remote kart outside the camera's view or further than
 * BRAWL_DRAW_DISTANCE is hidden and its per-frame presentation (world
 * matrices, character animation, effects) skipped: with 49 AI racers that
 * work, not drawing, held the frame rate down. Its pose still reaches the
 * minimap and the rank board.
 */
const CULL_MIN_RACERS = 8;
/** Meters from the camera beyond which a remote kart is not drawn. */
export const BRAWL_DRAW_DISTANCE = 180;
/** A kart with its rider and effects fits in this radius (m) around its position. */
const KART_RADIUS = 6;
const cullScratch = {
  frustum: new Frustum(), matrix: new Matrix4(),
  sphere: new Sphere(new Vector3(), KART_RADIUS), camera: new Vector3(),
};
const culledTrails = new WeakSet<object>();

/** A drawn remote kart's distance from the camera this frame, undefined when it is not drawn. */
export function remoteRacerCulling(camera: Camera): (position: Vec3) => number | undefined {
  // The race camera writes its matrices directly (no position/quaternion),
  // so they are read as they are.
  const { frustum, matrix, sphere, camera: eye } = cullScratch;
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,
    camera.matrixWorldInverse));
  eye.setFromMatrixPosition(camera.matrixWorld);
  return position => {
    sphere.center.set(position.x, position.y, position.z);
    const squared = sphere.center.distanceToSquared(eye);
    return squared <= BRAWL_DRAW_DISTANCE * BRAWL_DRAW_DISTANCE && frustum.intersectsSphere(sphere)
      ? Math.sqrt(squared) : undefined;
  };
}

/** How much of a drawn remote kart's presentation is updated this frame. */
export interface RiderLod {
  /** Toon outlines of the kart and its rider. */
  outlines: boolean;
  /** The rider's animation and skin, and the kart's booster effects. */
  animate: boolean;
  /** Parts of the kart and rider smaller than this radius (m) are not drawn. */
  minimumPartRadius: number;
}

/**
 * The radius (m) per meter of distance below which a part covers less than
 * about two and a half pixels of a 900 px high, 60° view: not drawn on a kart
 * away from the camera (a wheel nut, a lamp), one draw call each.
 */
export const SMALL_PART_RATIO = 0.003;
const partRadii = new WeakMap<Object3D, Array<{ mesh: Object3D; radius: number }>>();

/**
 * Leaves a kart's parts smaller than `minimumRadius` out of the camera's
 * layer (0) and puts the rest back: its own visibility rules are untouched.
 * The parts are the meshes drawn the first time, with their world radius.
 */
export function setSmallPartsDrawn(root: Object3D, minimumRadius: number): void {
  let parts = partRadii.get(root);
  if (!parts) {
    if (minimumRadius <= 0) return;
    parts = [];
    const scale = new Vector3();
    root.traverseVisible(object => {
      const mesh = object as Object3D & { isMesh?: boolean;
        geometry?: { attributes?: Record<string, unknown>; boundingSphere?: { radius: number } | null;
          computeBoundingSphere?(): void } };
      if (!mesh.isMesh || !mesh.geometry || mesh.geometry.attributes?.positionD3D) return;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere?.();
      scale.setFromMatrixScale(mesh.matrixWorld);
      parts!.push({ mesh, radius: (mesh.geometry.boundingSphere?.radius ?? Infinity) *
        Math.max(scale.x, scale.y, scale.z) });
    });
    partRadii.set(root, parts);
  }
  for (const { mesh, radius } of parts) {
    if (radius < minimumRadius) mesh.layers.disable(0);
    else mesh.layers.enable(0);
  }
}

/** Meters from the camera beyond which a kart has no outlines and a slower rider. */
export const LOD_NEAR = 45;
/** How many of the nearest remote karts keep full detail within LOD_NEAR. */
export const FULL_DETAIL_KARTS = 6;
/** How many remote karts are drawn at most, the nearest ones. */
export const MAX_DRAWN_REMOTES = 32;
const lastDistances: number[] = [];

/** The n-th smallest of values (1-based), Infinity when there are fewer. */
export function nthSmallest(values: readonly number[], n: number): number {
  if (values.length < n) return Infinity;
  return [...values].sort((a, b) => a - b)[n - 1]!;
}
/** Meters beyond which the rider animates every fourth frame instead of every second. */
export const LOD_FAR = 100;
let lodFrame = 0;

/**
 * The detail of a remote kart `distance` meters away: everything up to
 * fullDetailWithin (LOD_NEAR, or nearer when more than FULL_DETAIL_KARTS
 * karts are that close); then no outlines (a pixel or two wide there) and
 * the rider animated every second frame, every fourth beyond LOD_FAR.
 * `turn` staggers the karts over the frames.
 */
export function riderLod(distance: number, turn: number,
  fullDetailWithin = LOD_NEAR): RiderLod | undefined {
  if (distance <= fullDetailWithin) return undefined;
  const every = distance < LOD_FAR ? 2 : 4;
  return { outlines: false, animate: turn % every === 0,
    minimumPartRadius: distance * SMALL_PART_RATIO };
}

function cullRemoteRacer(racer: RacerAsset, view: RacerView, nowMs: number,
  camera: unknown, width: number, height: number): void {
  view.root.visible = false;
  // The trail ribbon hangs from the scene, not the kart: hide it too, or a
  // stale ribbon would stay where the kart was.
  const trails = racer.vehicle.trails.object;
  if (trails?.visible) {
    trails.visible = false;
    culledTrails.add(trails);
  }
  racer.draftEffect?.update(nowMs, false, false, camera, width, height);
}

const baseUpdateMatrixWorld = Object3D.prototype.updateMatrixWorld;

/**
 * updateMatrixWorld(true) for the visible part of a tree only: a kart's tree
 * holds dozens of hidden booster effect scenes (about 3,500 of its 4,000
 * nodes), which nothing draws or reads while hidden. An object with its own
 * updateMatrixWorld (a camera, a skinned mesh) is updated the usual way.
 */
export function updateVisibleWorldMatrices(object: Object3D): void {
  if (object.updateMatrixWorld !== baseUpdateMatrixWorld) {
    object.updateMatrixWorld(true);
    return;
  }
  if (object.matrixAutoUpdate) object.updateMatrix();
  if (object.matrixWorldAutoUpdate) {
    if (object.parent) object.matrixWorld.multiplyMatrices(object.parent.matrixWorld, object.matrix);
    else object.matrixWorld.copy(object.matrix);
  }
  object.matrixWorldNeedsUpdate = false;
  for (const child of object.children) if (child.visible) updateVisibleWorldMatrices(child);
}
