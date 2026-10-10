import type { WebGLRenderer } from "three";
import type { ChasePanel } from "./chase-panel";
import type { Action2DPanel, StoryResultPanels } from "./story-result-panels";

/**
 * The race's release Action2D (library.js dI, loaded with hI(library, true))
 * with what SnDriveGameStage adds for story missions: the clear@zz / retire@zz
 * result banners and, for Tracing / Escape, the distance panel.
 */

export interface ReleaseAction2D {
  readonly definition: { finish: Action2DPanel & { texture: unknown } };
  scheduleStart(atMs: number): void;
  showLap(lap: number, nowMs: number): void;
  showFinalLap(nowMs: number): void;
  showFinish(nowMs: number): void;
  showNewRecord(nowMs: number): void;
  showRetire(nowMs: number): void;
  schedule(panel: Action2DPanel, atMs: number): void;
  reset(): void;
  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void;
  dispose(): void;
}

export class StoryAction2D {
  constructor(readonly release: ReleaseAction2D, readonly panels?: StoryResultPanels,
    readonly chase?: ChasePanel) {}

  scheduleStart(atMs: number): void { this.release.scheduleStart(atMs); }
  showLap(lap: number, nowMs: number): void { this.release.showLap(lap, nowMs); }
  showFinalLap(nowMs: number): void { this.release.showFinalLap(nowMs); }
  showFinish(nowMs: number): void { this.release.showFinish(nowMs); }
  showNewRecord(nowMs: number): void { this.release.showNewRecord(nowMs); }

  /** clear@zz 完成 (KR 성공) or retire@zz 未完成 (KR 완주 실패), 100 + 2700 + 350 ms. */
  showStoryResult(success: boolean, nowMs: number): void {
    if (success && this.panels) this.release.schedule(this.panels.clear, nowMs);
    else if (success) this.release.showFinish(nowMs);
    else this.release.showRetire(nowMs);
  }

  setChaseDistance(metres: number | undefined): void {
    this.chase?.set(metres);
  }

  reset(): void {
    this.release.reset();
    this.chase?.reset();
  }

  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void {
    // The start and result banners draw over the distance panel.
    this.chase?.render(renderer, nowMs, width, height);
    this.release.render(renderer, nowMs, width, height);
  }

  dispose(): void {
    this.chase?.dispose();
    // dI's renderer owns every texture it uploaded, the clear@zz atlas included.
    this.release.dispose();
  }
}
