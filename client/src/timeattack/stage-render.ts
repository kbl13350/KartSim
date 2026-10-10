interface Renderer {
  getDrawingBufferSize(target: unknown): void;
  render(scene: unknown, camera: unknown): void;
}

interface RenderPhysics {
  consumeTimeAttackTachometerGaugePreserve(): unknown;
  consumeTimeAttackTachometerNormalBooster(): unknown;
}

interface RenderLifecycle {
  pausedTotalMs: number;
  effectiveTime(nowMs: number): number;
}

export interface TimeAttackRenderStage {
  released: boolean;
  milliseconds: number;
  effectiveNowMs: number;
  ghostPoses: unknown;
  host: {
    renderer: Renderer;
    drawingBufferSize: unknown;
    session: {
      lifecycle: RenderLifecycle;
      warpHud?: { hidden: boolean };
      tachometer?: unknown;
      outlineBatch?: { flush(): void };
      kartMotionBlur?: { render(renderer: Renderer, nowMs: number): void };
    };
    workProfiler?: { mark(name: string, nowMs: number): void };
    tachometerGaugePreserve: { update(nowMs: number, request: unknown): unknown };
    scene: unknown;
    camera: unknown;
    getPhysics(): RenderPhysics;
    getTrack(): { skydome?: unknown };
  };
  ui?: {
    result?: { render(renderer: Renderer, worldAxis: unknown, depthAxis: unknown): void };
    action2D?: {
      render(renderer: Renderer, nowMs: number, worldAxis: unknown, depthAxis: unknown): void;
    };
  };
  renderGameplayUi(nowMs: number, ghostPoses: unknown): void;
}

export interface TimeAttackRenderDependencies {
  nowMs(): number;
  isRaceFinished(lifecycle: RenderLifecycle): boolean;
  compose(
    renderer: Renderer,
    renderUi: () => void,
    renderWorld: () => void,
    renderSkydome: (() => void) | undefined,
    renderPost: () => void,
  ): void;
  updateTachometer(
    tachometer: unknown,
    physics: RenderPhysics,
    effectiveNowMs: number,
    normalizedNowMs: number,
    rawNowMs: number,
    pausedTotalMs: number,
    preserve: unknown,
    booster: unknown,
  ): void;
  renderTachometer(tachometer: unknown, renderer: Renderer): void;
  prepareWorldScene(scene: unknown, camera: unknown, skydome?: boolean,
    mark?: (name: string) => void): void;
  renderWithColorPipeline(renderer: Renderer, draw: () => void): void;
  worldAxis: unknown;
  depthAxis: unknown;
}

/** Submit UI, world, sky and post-processing passes in release order. */
export function renderTimeAttackStage(
  stage: TimeAttackRenderStage,
  dependencies: TimeAttackRenderDependencies,
): void {
  if (stage.released) return;
  const { host } = stage;
  const rawNowMs = stage.milliseconds;
  const effectiveNowMs = stage.effectiveNowMs;
  const ghostPoses = stage.ghostPoses;
  const mark = host.workProfiler
    ? (name: string) => host.workProfiler!.mark(name, dependencies.nowMs())
    : undefined;

  dependencies.compose(
    host.renderer,
    () => {
      host.renderer.getDrawingBufferSize(host.drawingBufferSize);
      const gameplayVisible = !dependencies.isRaceFinished(host.session.lifecycle) &&
        !host.session.warpHud?.hidden;
      stage.renderGameplayUi(effectiveNowMs, ghostPoses);
      host.workProfiler?.mark("ui", dependencies.nowMs());
      const preserveRequest = host.getPhysics().consumeTimeAttackTachometerGaugePreserve();
      const normalizedNowMs = Math.trunc(rawNowMs) >>> 0;
      const preserve = host.tachometerGaugePreserve.update(effectiveNowMs, preserveRequest);
      if (host.session.tachometer) {
        const booster = host.getPhysics().consumeTimeAttackTachometerNormalBooster();
        dependencies.updateTachometer(
          host.session.tachometer,
          host.getPhysics(),
          host.session.lifecycle.effectiveTime(rawNowMs),
          host.session.lifecycle.effectiveTime(normalizedNowMs),
          normalizedNowMs,
          host.session.lifecycle.pausedTotalMs,
          preserve,
          booster,
        );
        host.workProfiler?.mark("tacho-update", dependencies.nowMs());
        if (gameplayVisible) {
          dependencies.renderTachometer(host.session.tachometer, host.renderer);
        }
        host.workProfiler?.mark("tacho-render", dependencies.nowMs());
      }
      stage.ui?.result?.render(host.renderer, dependencies.worldAxis, dependencies.depthAxis);
      stage.ui?.action2D?.render(host.renderer, effectiveNowMs,
        dependencies.worldAxis, dependencies.depthAxis);
      host.workProfiler?.mark("ui-action2d", dependencies.nowMs());
    },
    () => {
      host.session.outlineBatch?.flush();
      dependencies.prepareWorldScene(host.scene, host.camera, false, mark);
      host.workProfiler?.mark("rw-keys", dependencies.nowMs());
      dependencies.renderWithColorPipeline(host.renderer,
        () => host.renderer.render(host.scene, host.camera));
      host.workProfiler?.mark("rw-render", dependencies.nowMs());
      host.workProfiler?.mark("render-world", dependencies.nowMs());
    },
    host.getTrack().skydome
      ? () => {
          dependencies.prepareWorldScene(host.getTrack().skydome, host.camera);
          dependencies.renderWithColorPipeline(host.renderer,
            () => host.renderer.render(host.getTrack().skydome, host.camera));
          host.workProfiler?.mark("render-skydome", dependencies.nowMs());
        }
      : undefined,
    () => {
      host.session.kartMotionBlur?.render(host.renderer, effectiveNowMs);
      host.workProfiler?.mark("render-post", dependencies.nowMs());
    },
  );
}
