/** Advances multiplayer track events, weather visuals, and shared race audio. */

interface SceneUpdater {
  update(nowMs: number, camera: unknown, width: number, height: number): void;
}

export interface RacePresenterEffectsHost {
  camera: unknown;
  assets: {
    drivingMode?: { kind: string };
  };
  runtime: {
    local: {
      physics: {
        body: { position: unknown };
        consumeTrackEventEffectRequests(): Array<{ effect: unknown; atMs: number }>;
        giantSourceProtected(): boolean;
      };
      track: { consumeExpiredEventEffects(): unknown[] };
    };
  };
  roadblockFlag?: SceneUpdater;
  giantPresentation?: {
    update(nowMs: number, camera: unknown, width: number,
      height: number, protectedSource: boolean): void;
  };
  shadowPresentations: Map<unknown, { update(): void }>;
  trackEventEffects?: {
    trigger(effect: unknown, atMs: number): void;
    remove(effect: unknown): void;
    update(nowMs: number, camera: unknown, width: number, height: number): void;
  };
  flyingPet?: {
    update(nowMs: number, camera: unknown, width: number, height: number,
      visible: boolean): void;
  };
  trackEventAudio?: { update(nowMs: number, position: unknown): void };
  trackDummyAudio?: { update(camera: unknown): void };
  petVisible(): boolean;
  captureRankProgress(): void;
}

export function updateRacePresenterEffects(host: RacePresenterEffectsHost,
  nowMs: number, width: number, height: number): void {
  const { physics, track } = host.runtime.local;
  const requested = physics.consumeTrackEventEffectRequests();
  host.roadblockFlag?.update(nowMs, host.camera, width, height);
  host.giantPresentation?.update(nowMs, host.camera, width, height,
    physics.giantSourceProtected());
  if (host.assets.drivingMode?.kind === "shadow") {
    for (const presentation of host.shadowPresentations.values()) {
      presentation.update();
    }
  }
  if (requested.length > 0 && !host.trackEventEffects) {
    throw new Error("多人赛道事件缺少本机效果对象。");
  }
  for (const request of requested) {
    host.trackEventEffects!.trigger(request.effect, request.atMs);
  }
  for (const effect of track.consumeExpiredEventEffects()) {
    host.trackEventEffects?.remove(effect);
  }
  host.flyingPet?.update(nowMs, host.camera, width, height, host.petVisible());
  host.trackEventEffects?.update(nowMs, host.camera, width, height);
  host.trackEventAudio?.update(nowMs, physics.body.position);
  host.trackDummyAudio?.update(host.camera);
  host.captureRankProgress();
}
