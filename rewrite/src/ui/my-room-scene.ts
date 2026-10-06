import {
  Box3, Color, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from "three";
import { W1, sn, y9 } from "../generated/formats.js";
import type { MyRoomEnvironment, MyRoomResourceLibrary } from "./my-room-catalog";

type RoomFile = MyRoomResourceLibrary["files"][number];

/** The release resource library also supplies the indexes used by its texture resolver. */
export interface MyRoomSceneLibrary extends MyRoomResourceLibrary {
  get(path: string): unknown;
  exactCanonicalCandidates(path: string): unknown[];
  entriesUnderCanonicalPrefix(prefix: string): unknown[];
  hasManifestMount(path: string): boolean;
  manifestAvailable: boolean;
}

export interface MyRoomSceneAssets { track: RoomFile; skydome: RoomFile }

/** Keep model and sky in the same original myRoom.rho room folder. */
export function findMyRoomSceneAssets(library: MyRoomResourceLibrary,
  environment: MyRoomEnvironment): MyRoomSceneAssets {
  if (!/^[A-Za-z0-9_]+$/.test(environment.resourceName)) {
    throw new Error("小屋场景目录名无效。");
  }
  const find = (name: string): RoomFile => {
    const suffix = `/${environment.resourceName}/${name}`.toLowerCase();
    const matches = library.files.filter(file =>
      file.sourceName.toLowerCase() === "myroom.rho" &&
      file.virtualPath.toLowerCase().endsWith(suffix));
    if (matches.length !== 1) {
      throw new Error(`${environment.title} 缺少唯一的原版 ${name} 资源。`);
    }
    return matches[0]!;
  };
  return { track: find("track.1s"), skydome: find("skydome.1s") };
}

type ParsedRoom = ReturnType<typeof y9>;
type RenderedRoom = Awaited<ReturnType<typeof W1>>;

export interface MyRoomSceneFrame {
  target: Vector3;
  distance: number;
}

/** The original room track places riders and displayed karts at ToDummy anchors. */
export function myRoomSceneFrame(model: ParsedRoom): MyRoomSceneFrame {
  if (model.root.kind !== "track") throw new Error("小屋 track.1s 缺少 TrackContainer。");
  const objects = model.root.trackObjects as Array<{
    kind: string; name: string; transform: { position: [number, number, number] };
  }>;
  const points = objects.filter(object =>
    object.kind === "ToDummy" && /^(?:rider|parking)\d\d$/.test(object.name))
    .map(object => object.transform.position);
  if (!points.length) throw new Error("小屋场景缺少车手和卡丁车站位点。");
  const bounds = new Box3();
  for (const [x, y, z] of points) bounds.expandByPoint(new Vector3(x, z, -y));
  const size = bounds.getSize(new Vector3());
  return {
    target: bounds.getCenter(new Vector3()).add(new Vector3(0, 3, 0)),
    distance: Math.max(24, Math.max(size.x, size.z) * 1.7),
  };
}

function resolveRoomTexture(library: MyRoomSceneLibrary, path: string,
  resource: Parameters<typeof sn>[3]): ReturnType<typeof sn> {
  const resolved = sn(library, path, undefined, resource);
  if (resolved.status !== "missing" || resource.name !== "V_backs") return resolved;
  // Twelve shipped skydomes share this texture from theme_village.rho.
  const shared = library.exactCanonicalCandidates("theme_/village/texture/V_backs.dds");
  return shared.length === 1
    ? sn(library, "theme_/village/texture/V_backs.dds", undefined, resource)
    : resolved;
}

/** Renders the original MyRoom 3D track and skydome in an isolated preview. */
export class MyRoomSceneView {
  readonly canvas = document.createElement("canvas");
  readonly status = document.createElement("div");
  readonly camera = new PerspectiveCamera(52, 1, 0.1, 4000);
  readonly scene = new Scene();
  readonly skyScene = new Scene();
  private renderer?: WebGLRenderer;
  private room?: RenderedRoom;
  private sky?: RenderedRoom;
  private frame?: MyRoomSceneFrame;
  private environmentId?: number;
  private generation = 0;
  private animationFrame = 0;
  private startTime = 0;
  private yaw = 0;
  private pitch = Math.PI * 0.15;
  private zoom = 1;
  private pointer?: { id: number; x: number; y: number };
  private disposed = false;
  private readonly resizeObserver?: ResizeObserver;

  constructor(readonly root: HTMLElement, readonly library: MyRoomSceneLibrary) {
    this.canvas.setAttribute("aria-label", "原版小屋三维场景，可拖动旋转，滚轮缩放");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    this.canvas.style.touchAction = "none";
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "position:absolute;left:12px;top:12px;z-index:2;padding:6px 10px;max-width:calc(100% - 24px);border-radius:6px;background:#102b49d9;color:#fff;font:13px/1.4 system-ui,sans-serif;pointer-events:none";
    this.status.textContent = "等待载入原版小屋场景…";
    root.append(this.canvas, this.status);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(root);
    }
  }

  async setEnvironment(environment: MyRoomEnvironment): Promise<boolean> {
    if (this.disposed) return false;
    if (environment.id === this.environmentId && this.room) return true;
    const generation = ++this.generation;
    this.setStatus(`正在加载${environment.title}…`);
    let nextRoom: RenderedRoom | undefined;
    let nextSky: RenderedRoom | undefined;
    try {
      const { track, skydome } = findMyRoomSceneAssets(this.library, environment);
      const [trackBytes, skyBytes] = await Promise.all([track.bytes(), skydome.bytes()]);
      if (this.disposed || generation !== this.generation) return false;
      const trackModel = y9(trackBytes);
      const skyModel = y9(skyBytes);
      const frame = myRoomSceneFrame(trackModel);
      // W1 is the same .1s scene/material/texture owner used by the race renderer.
      const resolveTrackTexture = (resource: Parameters<typeof sn>[3]) =>
        resolveRoomTexture(this.library, track.virtualPath, resource);
      const resolveSkyTexture = (resource: Parameters<typeof sn>[3]) =>
        resolveRoomTexture(this.library, skydome.virtualPath, resource);
      nextRoom = await W1(trackModel, this.library,
        `MyRoom:${environment.resourceName}`, resolveTrackTexture);
      nextSky = await W1(skyModel, this.library,
        `MyRoomSky:${environment.resourceName}`, resolveSkyTexture,
        { cameraCentered: true, scale: 0.01 });
      if (this.disposed || generation !== this.generation) return false;
      this.ensureRenderer();
      const previousRoom = this.room;
      const previousSky = this.sky;
      if (previousRoom) this.scene.remove(previousRoom.object);
      if (previousSky) this.skyScene.remove(previousSky.object);
      this.room = nextRoom;
      this.sky = nextSky;
      nextRoom = nextSky = undefined;
      this.scene.add(this.room.object);
      this.skyScene.add(this.sky.object);
      this.frame = frame;
      this.environmentId = environment.id;
      this.zoom = 1;
      this.positionCamera();
      this.room.reset(0);
      this.sky.reset(0);
      previousRoom?.dispose();
      previousSky?.dispose();
      this.setStatus("拖动旋转 · 滚轮缩放", false);
      this.startTime = performance.now();
      this.resize();
      this.startRendering();
      return true;
    } catch (error) {
      if (!this.disposed && generation === this.generation) {
        const message = error instanceof Error ? error.message : String(error);
        this.setStatus(`原版小屋场景加载失败：${message}`, true);
      }
      return false;
    } finally {
      nextRoom?.dispose();
      nextSky?.dispose();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.room?.dispose();
    this.sky?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas.remove();
    this.status.remove();
  }

  private ensureRenderer(): void {
    if (this.renderer) return;
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true,
      alpha: false, powerPreference: "low-power" });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(new Color("#8dc5e9"));
    this.renderer.autoClear = false;
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.setAttribute("role", error ? "alert" : "status");
  }

  private positionCamera(): void {
    if (!this.frame) return;
    const { target, distance } = this.frame;
    const horizontal = Math.cos(this.pitch) * distance * this.zoom;
    this.camera.position.set(
      target.x + Math.sin(this.yaw) * horizontal,
      target.y + Math.sin(this.pitch) * distance * this.zoom,
      target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(target);
  }

  private resize(): void {
    if (!this.renderer || this.disposed) return;
    const width = Math.max(1, Math.floor(this.root.clientWidth));
    const height = Math.max(1, Math.floor(this.root.clientHeight));
    if (!this.root.clientWidth || !this.root.clientHeight) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private startRendering(): void {
    if (this.animationFrame || this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  private readonly renderFrame = (now: number): void => {
    this.animationFrame = 0;
    if (this.disposed || !this.renderer || !this.room || !this.sky) return;
    if (this.root.isConnected && this.root.clientWidth && this.root.clientHeight) {
      const elapsed = Math.max(0, Math.trunc(now - this.startTime)) >>> 0;
      this.positionCamera();
      try {
        this.sky.update(elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
        this.room.update(elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
        this.renderer.clear(true, true, true);
        this.renderer.render(this.skyScene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        this.setStatus(`原版小屋场景渲染失败：${error instanceof Error ? error.message : String(error)}`, true);
        return;
      }
    }
    this.startRendering();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.yaw += dx * 0.008;
    this.pitch = Math.max(-0.1, Math.min(1.15, this.pitch + dy * 0.008));
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointer?.id !== event.pointerId) return;
    this.pointer = undefined;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.zoom = Math.max(0.5, Math.min(2.5, this.zoom * Math.exp(event.deltaY * 0.001)));
  };
}
