/** Early result-screen branch of the multiplayer race presenter frame. */

export interface RacePresenterResultHost {
  disposed: boolean;
  runtime: {
    giantEffectsEnded: boolean;
    local: {
      scheduledStartAtMs: number;
      lifecycle: { state: unknown };
      track: {
        updateRender(nowMs: number, camera: unknown,
          width: number, height: number): void;
        skydome?: unknown;
      };
    };
  };
  trackInfoCard?: { update(nowMs: number): void };
  banner?: { update(nowMs: number, startAtMs: number,
    countdown: boolean, request: unknown): void };
  bannerRequest: unknown;
  size: { x: number; y: number };
  camera: { aspect: number };
  scene: unknown;
  resultVisible: boolean;
  resultComplete: unknown;
  resultView: { update(nowMs: number): unknown };
  hud: { hideTimeGap(): void };
  assets: {
    map: { stageBinding: { beginFrame(nowMs: number): void } };
    lteCoins?: { update(nowMs: number, camera: unknown,
      width: number, height: number): void };
  };
  award?: { update(nowMs: number, camera: unknown,
    local: unknown, assets: unknown, views: unknown): void };
  roadblockResult?: { update(nowMs: number, camera: unknown,
    width: number, height: number): void };
  views: unknown;
  clearGiant(): void;
  showResult(nowMs: number): void;
}

export interface RacePresenterResultDependencies {
  countdownState: unknown;
  render(scene: unknown, camera: unknown, clear?: boolean): void;
}

export function presentRaceResultFrame(host: RacePresenterResultHost,
  renderer: { getDrawingBufferSize(size: { x: number; y: number }): void },
  nowMs: number, events: Array<{ kind: string }>,
  dependencies: RacePresenterResultDependencies): boolean {
  if (host.disposed) return true;
  if (host.runtime.giantEffectsEnded) host.clearGiant();
  host.trackInfoCard?.update(nowMs);
  host.banner?.update(nowMs, host.runtime.local.scheduledStartAtMs,
    host.runtime.local.lifecycle.state === dependencies.countdownState,
    host.bannerRequest);
  renderer.getDrawingBufferSize(host.size);
  const width = host.size.x;
  const height = host.size.y;
  host.camera.aspect = width / height;
  if (!host.resultVisible && events.some(event => event.kind === "publish-result")) {
    host.showResult(nowMs);
  }
  if (!host.resultVisible) return false;
  host.hud.hideTimeGap();
  host.resultComplete = host.resultView.update(nowMs);
  host.assets.map.stageBinding.beginFrame(nowMs);
  host.award?.update(nowMs, host.camera, host.runtime.local,
    host.assets, host.views);
  host.roadblockResult?.update(nowMs, host.camera, width, height);
  host.runtime.local.track.updateRender(nowMs, host.camera, width, height);
  host.assets.lteCoins?.update(nowMs, host.camera, width, height);
  dependencies.render(host.scene, host.camera, false);
  if (host.runtime.local.track.skydome) {
    dependencies.render(host.runtime.local.track.skydome, host.camera);
  }
  return true;
}
