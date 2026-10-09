import { PerspectiveCamera, Scene, Vector2, Vector4, type Object3D, type WebGLRenderer } from "three";
import { we } from "../generated/formats.js";
import { aI, Q9, S9 } from "../generated/library.js";
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
interface MissionModel {
  parsed: { root: MissionNode };
  scene: { object: Object3D; reset(timeMs: number): void; update(timeMs: number): void;
    clientWorldElements(node: MissionNode): ArrayLike<number> | undefined; dispose(): void };
}
interface MissionClip {
  model: MissionModel;
  cameraNode: MissionNode & { camera: ReadyCameraData };
  durationMs: number;
  sound: AudioBuffer;
}
interface Disposable { dispose(): void }

function findCamera(node: MissionNode): MissionNode | undefined {
  if (node.className === "ReCamera") return node;
  for (const child of node.children) {
    const found = findCamera(child);
    if (found) return found;
  }
  return undefined;
}

async function loadClip(library: unknown, context: AudioContext, outcome: Outcome,
  textures: Map<string, Disposable>): Promise<MissionClip> {
  // false: the scene resolver tries @cn first, so the text reads 成功 / 失败.
  const model = await aI(library, MODEL[outcome], textures, {}, false) as MissionModel;
  try {
    const cameraNode = findCamera(model.parsed.root);
    const data = cameraNode?.camera as (ReadyCameraData & { projectionMode?: number;
      fieldOfViewController?: unknown; nearClipController?: unknown;
      farClipController?: unknown }) | undefined;
    if (!cameraNode || !data || data.projectionMode !== 0 || data.fieldOfViewController ||
        data.nearClipController || data.farClipController)
      throw new Error(`${MODEL[outcome]} ReCamera 不是 perspective mode 0。`);
    const durationMs = giantControllerDuration(model.parsed) as number;
    if (!(durationMs > 0)) throw new Error(`${MODEL[outcome]} 缺少控制器时长。`);
    const sound = await loadRequiredInterfaceAudio(library as InterfaceAudioLibrary, context,
      SOUND[outcome], { decode: Q9, route: S9 } as never);
    return { model, cameraNode: cameraNode as MissionClip["cameraNode"], durationMs, sound };
  } catch (error) {
    model.scene.dispose();
    throw error;
  }
}

export class MissionResultAction {
  private active?: { clip: MissionClip; startMs: number };
  private source?: AudioBufferSourceNode;
  private readonly camera = new PerspectiveCamera();
  private readonly world = new Scene();
  private readonly size = new Vector2();
  private readonly viewport = new Vector4();
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
    const { model, cameraNode } = active.clip;
    model.scene.update(now);
    const elements = model.scene.clientWorldElements(cameraNode);
    if (!elements) throw new Error("mission ReCamera 缺少 world matrix。");
    renderer.getSize(this.size);
    const scale = Math.min(this.size.x / STAGE.width, this.size.y / STAGE.height);
    const width = STAGE.width * scale;
    const height = STAGE.height * scale;
    this.camera.aspect = width / height;
    applyReadyCameraMatrix(this.camera, elements, cameraNode.camera, we);
    renderer.getViewport(this.viewport);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.world.add(model.scene.object);
    try {
      renderer.clearDepth();
      renderer.setViewport((this.size.x - width) / 2, (this.size.y - height) / 2, width, height);
      renderer.render(this.world, this.camera);
      renderer.clearDepth();
    } finally {
      model.scene.object.removeFromParent();
      renderer.setViewport(this.viewport);
      renderer.autoClear = autoClear;
    }
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
  reset(): void;
  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void;
  dispose(): void;
}

/** The race's release Action2D plus the mission result; story races only. */
export class StoryAction2D {
  constructor(readonly release: ReleaseAction2D, readonly mission: MissionResultAction) {}
  scheduleStart(atMs: number): void { this.release.scheduleStart(atMs); }
  showLap(lap: number, nowMs: number): void { this.release.showLap(lap, nowMs); }
  showFinalLap(nowMs: number): void { this.release.showFinalLap(nowMs); }
  showFinish(nowMs: number): void { this.release.showFinish(nowMs); }
  showNewRecord(nowMs: number): void { this.release.showNewRecord(nowMs); }
  showMissionResult(success: boolean, nowMs: number): void { this.mission.show(success, nowMs); }
  reset(): void {
    this.release.reset();
    this.mission.reset();
  }
  render(renderer: WebGLRenderer, nowMs: number, width: number, height: number): void {
    this.release.render(renderer, nowMs, width, height);
    this.mission.render(renderer, nowMs);
  }
  dispose(): void {
    this.release.dispose();
    this.mission.dispose();
  }
}
