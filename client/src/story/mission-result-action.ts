import { OrthographicCamera, PerspectiveCamera, Scene, Vector2, Vector4, type Camera, type Object3D,
  type WebGLRenderer } from "three";
import { we } from "../generated/formats.js";
import { aI, Q9, S9 } from "../generated/library.js";
import type { LicenseScenes } from "../license/license-scenes";
import type { MissionTimerPanel } from "../license/mission-timer-panel";
import { loadRequiredInterfaceAudio, type InterfaceAudioLibrary } from "../timeattack/interface-audio";
import { giantControllerDuration } from "../ui/giant-boost-hud-model";
import { applyReadyCameraMatrix, type ReadyCameraData } from "../vehicle/ready-camera";

/**
 * The release mission result at a story race's finish line:
 * stage_common action/missionSuccess@zz.1s or missionFail@zz.1s (成功 / 失败
 * with smoke, 3 s) and sound_fx_etc missionSuccess / missionFail. The scenes
 * are .1s models, loaded with the same scene loader as the giant boost HUD.
 */

type Outcome = "success" | "fail";
const MODEL = { success: "stage_/common/action/missionSuccess@zz.1s",
  fail: "stage_/common/action/missionFail@zz.1s" } as const;
const SOUND = { success: "sound_/fx/etc/missionSuccess@zz.ogg",
  fail: "sound_/fx/etc/missionFail@zz.ogg" } as const;
/** The action stage the release lays these scenes out in. */
const STAGE = { width: 800, height: 600 };

interface MissionNode { className?: string; name?: string; camera?: ReadyCameraData; children: MissionNode[] }
export interface MissionModel {
  parsed: { root: MissionNode };
  scene: { object: Object3D; reset(timeMs: number): void; update(timeMs: number): void;
    clientWorldElements(node: MissionNode): ArrayLike<number> | undefined; dispose(): void };
}
interface MissionClip extends ActionSceneClip {
  sound: AudioBuffer;
}
interface Disposable { dispose(): void }

/** An action scene (stage_common action/*.1s) ready to play: its model, camera and length. */
export interface ActionSceneClip {
  model: MissionModel;
  cameraNode: MissionNode & { camera: ReadyCameraData };
  durationMs: number;
  /** projectionMode 1 (the HUD prompts, e.g. 앞으로1): an orthographic view of the 800×600 stage. */
  orthographic?: boolean;
}

function findCamera(node: MissionNode): MissionNode | undefined {
  if (node.className === "ReCamera") return node;
  for (const child of node.children) {
    const found = findCamera(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * Loads one action scene. `path` is a stage_ path; an @zz name resolves @cn
 * first, so the text reads in Chinese. Throws when the scene has no
 * perspective ReCamera or no controller length.
 */
export async function loadActionScene(library: unknown, path: string,
  textures: Map<string, Disposable>, options: { orthographic?: boolean; staticMs?: number } = {}):
  Promise<ActionSceneClip> {
  // false: the scene resolver tries @cn first, so the text reads 成功 / 失败.
  const model = await aI(library, path, textures, {}, false) as MissionModel;
  try {
    const cameraNode = findCamera(model.parsed.root);
    const data = cameraNode?.camera as (ReadyCameraData & { projectionMode?: number;
      fieldOfViewController?: unknown; nearClipController?: unknown;
      farClipController?: unknown }) | undefined;
    const mode = data?.projectionMode;
    const supported = mode === 0 || (options.orthographic === true && mode === 1);
    if (!cameraNode || !data || !supported || data.fieldOfViewController ||
        data.nearClipController || data.farClipController)
      throw new Error(`${path} ReCamera 不是 perspective mode 0${options.orthographic ? " 或 orthographic mode 1" : ""}。`);
    // A still scene (no controllers, e.g. the 앞으로1 prompt) shows for staticMs.
    const durationMs = (giantControllerDuration(model.parsed) as number) || (options.staticMs ?? 0);
    if (!(durationMs > 0)) throw new Error(`${path} 缺少控制器时长。`);
    return { model, cameraNode: cameraNode as ActionSceneClip["cameraNode"], durationMs,
      ...(mode === 1 ? { orthographic: true } : {}) };
  } catch (error) {
    model.scene.dispose();
    throw error;
  }
}

async function loadClip(library: unknown, context: AudioContext, outcome: Outcome,
  textures: Map<string, Disposable>): Promise<MissionClip> {
  const clip = await loadActionScene(library, MODEL[outcome], textures);
  try {
    const sound = await loadRequiredInterfaceAudio(library as InterfaceAudioLibrary, context,
      SOUND[outcome], { decode: Q9, route: S9 } as never);
    return { ...clip, sound };
  } catch (error) {
    clip.model.scene.dispose();
    throw error;
  }
}

/** Reusable three.js objects for drawing action scenes over the race. */
export class ActionSceneView {
  private readonly camera = new PerspectiveCamera();
  /** projectionMode 1 scenes: the ReCamera's pose with a parallel projection. */
  private readonly flatCamera = new OrthographicCamera();
  private readonly world = new Scene();
  private readonly size = new Vector2();
  private readonly viewport = new Vector4();

  /** Draws `clip` at `now` (scene time already set) on the 800×600 action stage, centred. */
  draw(renderer: WebGLRenderer, clip: ActionSceneClip, now: number): void {
    const { model, cameraNode } = clip;
    model.scene.update(now);
    const elements = model.scene.clientWorldElements(cameraNode);
    if (!elements) throw new Error("mission ReCamera 缺少 world matrix。");
    renderer.getSize(this.size);
    const scale = Math.min(this.size.x / STAGE.width, this.size.y / STAGE.height);
    const width = STAGE.width * scale;
    const height = STAGE.height * scale;
    let camera: Camera = this.camera;
    this.camera.aspect = width / height;
    applyReadyCameraMatrix(this.camera, elements, cameraNode.camera, we);
    if (clip.orthographic) {
      // The release's parallel extent (giant boost HUD frameGiantModelCamera): tan(fov/2)·323.221
      // stage units across, 800 for the 136° prompts, and the stage's aspect down.
      const across = Math.tan(cameraNode.camera.fieldOfViewDegrees * Math.PI / 360) * 323.221;
      const flat = this.flatCamera;
      flat.left = -across / 2;
      flat.right = across / 2;
      flat.top = across / 2 * height / width;
      flat.bottom = -flat.top;
      flat.near = cameraNode.camera.nearClip;
      flat.far = cameraNode.camera.farClip;
      flat.position.copy(this.camera.position);
      flat.quaternion.copy(this.camera.quaternion);
      flat.updateProjectionMatrix();
      flat.updateMatrixWorld(true);
      camera = flat;
    }
    renderer.getViewport(this.viewport);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.world.add(model.scene.object);
    try {
      renderer.clearDepth();
      renderer.setViewport((this.size.x - width) / 2, (this.size.y - height) / 2, width, height);
      renderer.render(this.world, camera);
      renderer.clearDepth();
    } finally {
      model.scene.object.removeFromParent();
      renderer.setViewport(this.viewport);
      renderer.autoClear = autoClear;
    }
  }
}

export class MissionResultAction {
  private active?: { clip: MissionClip; startMs: number };
  private source?: AudioBufferSourceNode;
  private readonly view = new ActionSceneView();
  private disposed = false;

  private constructor(readonly clips: Record<Outcome, MissionClip>,
    readonly textures: Map<string, Disposable>, readonly context: AudioContext) {}

  static async load(library: unknown, context: AudioContext): Promise<MissionResultAction> {
    const textures = new Map<string, Disposable>();
    const loaded: MissionClip[] = [];
    try {
      const success = await loadClip(library, context, "success", textures);
      loaded.push(success);
      const fail = await loadClip(library, context, "fail", textures);
      loaded.push(fail);
      return new MissionResultAction({ success, fail }, textures, context);
    } catch (error) {
      for (const clip of loaded) clip.model.scene.dispose();
      for (const texture of textures.values()) texture.dispose();
      throw error;
    }
  }

  show(success: boolean, nowMs: number): void {
    if (this.disposed) return;
    const clip = this.clips[success ? "success" : "fail"];
    const startMs = Math.trunc(nowMs) >>> 0;
    clip.model.scene.reset(startMs);
    this.active = { clip, startMs };
    this.stopSound();
    const source = this.context.createBufferSource();
    source.buffer = clip.sound;
    // The "fx" group: sound effect volume and mute.
    S9(this.context, source);
    source.onended = () => {
      source.disconnect();
      if (this.source === source) this.source = undefined;
    };
    this.source = source;
    source.start();
  }

  render(renderer: WebGLRenderer, nowMs: number): void {
    const active = this.active;
    if (this.disposed || !active) return;
    const now = Math.trunc(nowMs) >>> 0;
    if (((now - active.startMs) >>> 0) > active.clip.durationMs) {
      this.active = undefined;
      return;
    }
    this.view.draw(renderer, active.clip, now);
  }

  reset(): void {
    this.active = undefined;
    this.stopSound();
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.clips.success.model.scene.dispose();
    this.clips.fail.model.scene.dispose();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }

  private stopSound(): void {
    const source = this.source;
    this.source = undefined;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Already ended.
    }
    source.disconnect();
  }
}

interface ReleaseAction2D {
  scheduleStart(atMs: number): void;
  showLap(lap: number, nowMs: number): void;
  showFinalLap(nowMs: number): void;
  showFinish(nowMs: number): void;
  showNewRecord(nowMs: number): void;
  /** Loaded with the multiplayer banners (winner, retire, race over). */
  definition?: { retire?: unknown };
  showRetire?(nowMs: number): void;
  reset(): void;
  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void;
  dispose(): void;
}

/** The race's release Action2D plus the mission result; story races only. */
export class StoryAction2D {
  constructor(readonly release: ReleaseAction2D, readonly mission: MissionResultAction,
    readonly timer?: MissionTimerPanel, readonly licenseScenes?: LicenseScenes) {}
  scheduleStart(atMs: number): void { this.release.scheduleStart(atMs); }
  showLap(lap: number, nowMs: number): void { this.release.showLap(lap, nowMs); }
  showFinalLap(nowMs: number): void { this.release.showFinalLap(nowMs); }
  showFinish(nowMs: number): void { this.release.showFinish(nowMs); }
  /** retire@zz (未完成), when the banners loaded with it; false otherwise. */
  showRetire(nowMs: number): boolean {
    if (!this.release.definition?.retire || !this.release.showRetire) return false;
    this.release.showRetire(nowMs);
    return true;
  }
  showNewRecord(nowMs: number): void { this.release.showNewRecord(nowMs); }
  showMissionResult(success: boolean, nowMs: number): void { this.mission.show(success, nowMs); }
  /** 驾照考试: the time a step has left (undefined hides the timer). */
  setMissionTime(remainingMs: number | undefined): void { this.timer?.set(remainingMs); }
  reset(): void {
    this.release.reset();
    this.mission.reset();
    this.timer?.reset();
    this.licenseScenes?.reset();
  }
  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void {
    this.timer?.render(renderer, nowMs, width, height);
    this.release.render(renderer, nowMs, width, height);
    // 驾照考试 prompts and tutorial hints, under the mission result.
    this.licenseScenes?.render(renderer, nowMs);
    this.mission.render(renderer, nowMs);
  }
  dispose(): void {
    this.timer?.dispose();
    this.release.dispose();
    this.mission.dispose();
    this.licenseScenes?.dispose();
  }
}
