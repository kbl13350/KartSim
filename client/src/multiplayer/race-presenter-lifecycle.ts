/** Prepares GPU scenes and releases all multiplayer presentation owners. */

interface Disposable { dispose(): void }
interface Detachable { removeFromParent(): void }
interface ParticipantAsset {
  playerId: unknown;
  characters: {
    ordinary?: { scene: { object: Detachable } };
    linked?: { scene: { object: Detachable } };
  };
  vehicle: {
    effects: { warmDetachedScenes(renderer: unknown, scene: unknown): void };
    accessories: Array<{ render: { scene: { object: Detachable } } }>;
    decoration?: { scene: { object: Detachable } };
  };
}

export interface RacePresenterLifecycleHost {
  disposed: boolean;
  scene: { clear(): void };
  assets: {
    map: { readyCamera: { start(): void } };
    participants: ParticipantAsset[];
  };
  runtime: { local: { track: { skydome?: unknown } } };
  views: Map<unknown, {
    root: unknown;
    releaseBorrowedModel(): void;
  }>;
  linkedPresentations: Map<unknown, unknown>;
  initialPoses: Map<unknown, unknown>;
  hud: Disposable;
  rankRoster: Disposable;
  flyingPet?: Disposable;
  trackEventEffects?: Disposable;
  trackEventAudio?: Disposable;
  trackDummyAudio?: Disposable;
  roadblockFlag?: Disposable;
  roadblockHud?: Disposable;
  roadblockResult?: Disposable;
  award?: Disposable;
  resultView?: Disposable;
  banner?: Disposable;
  trackInfoCard?: Disposable;
  countdown?: Disposable;
  finishBlackBar: Disposable;
  warpBlackBar: Disposable;
  action2d: Disposable;
  audioStarted: boolean;
  bgm?: { silence(): void };
  size: { x: number; y: number };
  update(renderer: unknown, nowMs: number, actions: unknown[]): void;
  render(renderer: unknown, nowMs: number): void;
  releaseShadowPresentations(): void;
  clearGiant(): void;
}

export interface RacePresenterLifecycleDependencies {
  warmScene(renderer: unknown, object: unknown, scene: unknown,
    recursive?: boolean): void;
  createRenderTarget(width: number, height: number): Disposable;
  vehicleParts(vehicle: ParticipantAsset["vehicle"]): Detachable[];
}

export interface RacePresenterWarmRenderer {
  getDrawingBufferSize(size: { x: number; y: number }): void;
  getRenderTarget(): unknown;
  setRenderTarget(target: unknown): void;
}

export function warmRacePresenter(host: RacePresenterLifecycleHost,
  renderer: RacePresenterWarmRenderer, nowMs: number,
  dependencies: RacePresenterLifecycleDependencies): void {
  host.assets.map.readyCamera.start();
  host.update(renderer, nowMs, []);
  dependencies.warmScene(renderer, host.scene, host.scene);
  for (const participant of host.assets.participants) {
    dependencies.warmScene(renderer,
      host.views.get(participant.playerId)!.root, host.scene, true);
    participant.vehicle.effects.warmDetachedScenes(renderer, host.scene);
  }
  if (host.runtime.local.track.skydome) {
    dependencies.warmScene(renderer, host.runtime.local.track.skydome,
      host.scene);
  }
  renderer.getDrawingBufferSize(host.size);
  const target = dependencies.createRenderTarget(host.size.x, host.size.y);
  const previousTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    host.render(renderer, nowMs);
  } finally {
    renderer.setRenderTarget(previousTarget);
    target.dispose();
  }
}

export function disposeRacePresenter(host: RacePresenterLifecycleHost,
  dependencies: RacePresenterLifecycleDependencies): void {
  host.releaseShadowPresentations();
  if (host.disposed) return;
  host.disposed = true;
  host.clearGiant();
  host.flyingPet?.dispose();
  host.flyingPet = undefined;
  host.trackEventEffects?.dispose();
  host.trackEventEffects = undefined;
  host.trackEventAudio?.dispose();
  host.trackEventAudio = undefined;
  host.trackDummyAudio?.dispose();
  host.trackDummyAudio = undefined;
  if (host.audioStarted) host.bgm?.silence();

  for (const participant of host.assets.participants) {
    for (const part of dependencies.vehicleParts(participant.vehicle)) {
      part.removeFromParent();
    }
    participant.characters.ordinary?.scene.object.removeFromParent();
    participant.characters.linked?.scene.object.removeFromParent();
    for (const accessory of participant.vehicle.accessories) {
      accessory.render.scene.object.removeFromParent();
    }
    participant.vehicle.decoration?.scene.object.removeFromParent();
  }
  for (const view of host.views.values()) view.releaseBorrowedModel();
  host.views.clear();
  host.linkedPresentations.clear();
  host.hud.dispose();
  host.initialPoses.clear();
  host.rankRoster.dispose();
  host.roadblockFlag?.dispose();
  host.roadblockFlag = undefined;
  host.roadblockHud?.dispose();
  host.roadblockResult?.dispose();
  host.award?.dispose();
  host.resultView?.dispose();
  host.banner?.dispose();
  host.trackInfoCard?.dispose();
  host.countdown?.dispose();
  host.finishBlackBar.dispose();
  host.warpBlackBar.dispose();
  host.action2d.dispose();
  host.scene.clear();
}
