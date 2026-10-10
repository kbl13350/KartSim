import type { WebGLRenderer } from "three";
import { ActionSceneView, loadActionScene, type ActionSceneClip } from "../story/mission-result-action";

/**
 * The stage_common action scenes a 驾照考试 step shows over the race: the
 * key prompts of 行驶练习 (앞으로1 向前, 뒤로1 向后, 오른쪽1 右转, 왼쪽1 左转,
 * ok 成功) and the tutorial hints a course's <eventList> names for its
 * event:* points (좌회전, 우회전, 좌드립, 아이템…). One scene plays at a
 * time; a prompt loops until it is answered.
 */

interface Disposable { dispose(): void }

const ROOT = "stage_/common/action";
/** How long a still scene (a prompt or 成功 without controllers) shows when not looped [还原]. */
export const STILL_SCENE_MS = 1_500;

/** The scene file of a name: localized prompts carry @zz (resolved @cn first). */
export function licenseScenePath(name: string): string {
  return `${ROOT}/${name}.1s`;
}

interface SceneLibrary { canonicalCandidates?(path: string): readonly unknown[] }

/** The Chinese file of a localized scene when the archive has one (앞으로1@cn.1s for 앞으로1@zz). */
function localizedPath(library: unknown, name: string): string {
  const path = licenseScenePath(name);
  if (!name.endsWith("@zz")) return path;
  const chinese = licenseScenePath(name.replace(/@zz$/, "@cn"));
  const candidates = (library as SceneLibrary).canonicalCandidates?.(chinese);
  return candidates && candidates.length === 1 ? chinese : path;
}

export class LicenseScenes {
  private active?: { name: string; clip: ActionSceneClip; startMs: number; loop: boolean };
  private readonly view = new ActionSceneView();
  private disposed = false;

  private constructor(private readonly clips: Map<string, ActionSceneClip>,
    private readonly textures: Map<string, Disposable>) {}

  /** Loads what it can of `names` (a missing or unsupported scene is left out). */
  static async load(library: unknown, names: Iterable<string>,
    warn: (message: string) => void = () => undefined): Promise<LicenseScenes> {
    const textures = new Map<string, Disposable>();
    const clips = new Map<string, ActionSceneClip>();
    for (const name of new Set(names)) {
      try {
        // The prompts and hints are HUD scenes with an orthographic ReCamera.
        clips.set(name, await loadActionScene(library, localizedPath(library, name), textures,
          { orthographic: true, staticMs: STILL_SCENE_MS }));
      } catch (error) {
        warn(`驾照提示动画 ${name} 未能载入：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return new LicenseScenes(clips, textures);
  }

  has(name: string): boolean { return this.clips.has(name); }

  /** The scene's length in ms (0 when it is not loaded). */
  duration(name: string): number { return this.clips.get(name)?.durationMs ?? 0; }

  /** Starts a scene (replacing the one playing); false when it is not loaded. */
  play(name: string, nowMs: number, loop = false): boolean {
    const clip = this.clips.get(name);
    if (this.disposed || !clip) return false;
    const startMs = Math.trunc(nowMs) >>> 0;
    clip.model.scene.reset(startMs);
    this.active = { name, clip, startMs, loop };
    return true;
  }

  /** The scene playing now, if any. */
  get playing(): string | undefined { return this.active?.name; }

  stop(name?: string): void {
    if (!name || this.active?.name === name) this.active = undefined;
  }

  render(renderer: WebGLRenderer, nowMs: number): void {
    const active = this.active;
    if (this.disposed || !active) return;
    const now = Math.trunc(nowMs) >>> 0;
    if (((now - active.startMs) >>> 0) > active.clip.durationMs) {
      if (!active.loop) {
        this.active = undefined;
        return;
      }
      active.startMs = now;
      active.clip.model.scene.reset(now);
    }
    this.view.draw(renderer, active.clip, now);
  }

  reset(): void { this.active = undefined; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = undefined;
    for (const clip of this.clips.values()) clip.model.scene.dispose();
    for (const texture of this.textures.values()) texture.dispose();
    this.clips.clear();
    this.textures.clear();
  }
}
