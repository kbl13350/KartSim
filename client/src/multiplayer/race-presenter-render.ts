/** Renders the multiplayer world, HUD, black bars, and 2D race actions. */

export interface RacePresenterRenderer {
  autoClear: boolean;
  clear(): void;
  clearDepth(): void;
  setTransparentSort(sort: unknown): void;
  render(scene: unknown, camera: unknown): void;
}

export interface RacePresenterRenderHost {
  disposed: boolean;
  resultVisible: boolean;
  warpHudHidden: boolean;
  runtime: {
    local: {
      lifecycle: { state: number };
      track: { skydome?: unknown };
      warpNext: { blackBarRatio(nowMs: number): number };
    };
  };
  scene: unknown;
  camera: unknown;
  hud: { render(renderer: RacePresenterRenderer): void };
  tachometer: unknown;
  size: { y: number };
  warpBlackBar: { renderRatio(renderer: RacePresenterRenderer,
    ratio: number): void };
  finishBlackBar: { render(renderer: RacePresenterRenderer,
    nowMs: number, height: number): void };
  action2d: { render(renderer: RacePresenterRenderer,
    nowMs: number, worldAxis: unknown, depthAxis: unknown): void };
}

export interface RacePresenterRenderDependencies {
  transparentSort: unknown;
  withColorPipeline(renderer: RacePresenterRenderer, render: () => void): void;
  renderTachometer(tachometer: unknown, renderer: RacePresenterRenderer): void;
  blackBarFraction: number;
  worldAxis: unknown;
  depthAxis: unknown;
  postFinishState: number;
}

export function renderRacePresenterFrame(host: RacePresenterRenderHost,
  renderer: RacePresenterRenderer, nowMs: number,
  dependencies: RacePresenterRenderDependencies): void {
  if (host.disposed) return;
  const previousAutoClear = renderer.autoClear;
  try {
    renderer.autoClear = false;
    renderer.clear();
    renderer.setTransparentSort(dependencies.transparentSort);
    try {
      const sky = host.runtime.local.track.skydome;
      if (sky) {
        dependencies.withColorPipeline(renderer,
          () => renderer.render(sky, host.camera));
      }
      renderer.clearDepth();
      dependencies.withColorPipeline(renderer,
        () => renderer.render(host.scene, host.camera));
    } finally {
      renderer.setTransparentSort(null);
    }
    if (host.resultVisible) return;
    renderer.clearDepth();
    if (!host.warpHudHidden &&
      host.runtime.local.lifecycle.state < dependencies.postFinishState) {
      host.hud.render(renderer);
      dependencies.renderTachometer(host.tachometer, renderer);
    }
    const blackBarPixels = Math.floor(
      host.size.y * dependencies.blackBarFraction + 0.5);
    const ratio = host.size.y > 0
      ? Math.floor(blackBarPixels *
        host.runtime.local.warpNext.blackBarRatio(nowMs) + 0.5) / host.size.y
      : 0;
    host.warpBlackBar.renderRatio(renderer, ratio);
    host.finishBlackBar.render(renderer, nowMs, host.size.y);
    host.action2d.render(renderer, nowMs,
      dependencies.worldAxis, dependencies.depthAxis);
  } finally {
    renderer.autoClear = previousAutoClear;
  }
}
