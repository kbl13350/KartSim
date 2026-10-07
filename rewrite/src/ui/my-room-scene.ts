import {
  Box3, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
  type Material, type Object3D,
} from "three";
import { CR, SR, TR, W1, Yb, sn, xR, y9 } from "../generated/formats.js";
import { FI, Tr, p5, xa } from "../generated/library.js";
import { Jv, Lt, T4 } from "../generated/ui.js";
import { ag, pk } from "../generated/vehicle.js";
import type { GarageCatalogEntry } from "../resources/garage-catalog";
import type { LocalProfile } from "./local-profile";
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
type RoomAvatar = Awaited<ReturnType<typeof Jv>>;
type WalkingScene = Awaited<ReturnType<typeof TR>>;
type CharacterFile = RoomFile & { containerId?: string; canonicalPath?: string; name?: string };

interface WalkingAvatar {
  scene: WalkingScene;
  motion: InstanceType<typeof ag>;
}

export interface MyRoomSceneSubject {
  kart: GarageCatalogEntry;
  character: GarageCatalogEntry;
  profile: LocalProfile;
  /** The Ready-stage toon resources stay owned by Ready. */
  environment: unknown;
  stageBinding: { beginFrame(time: number): void; coatingTextures(library: unknown): unknown };
}

/** Build the selected ordinary character with its original standing and walking motions. */
async function loadWalkingAvatar(library: MyRoomSceneLibrary,
  subject: MyRoomSceneSubject,
  colors: { primary: number; high: number } | null): Promise<WalkingAvatar> {
  const source = library.get(subject.character.path) as CharacterFile | undefined;
  if (!source?.containerId) throw new Error("当前人物缺少独立模型容器。");
  const files = (library.files as readonly CharacterFile[]).filter(file =>
    file.containerId === source.containerId);
  const localName = (file: CharacterFile): string => {
    const path = (file.canonicalPath ?? file.virtualPath).replaceAll("\\", "/");
    const costume = path.toLowerCase().lastIndexOf("/costume/");
    return costume >= 0 ? path.slice(costume + 1) : path.slice(path.lastIndexOf("/") + 1);
  };
  const byName = new Map(files.map(file => [localName(file).toLowerCase(), file]));
  const identity = await pk(library, subject.character.internalId,
    subject.character.uniform ?? "1", subject.character.path);
  const costume = CR([...byName.keys()], identity);
  // The release loader uses this same local-costume-first, common-archive
  // fallback order. f10 is standing; f11 is an alternating walking stride.
  const motionFile = (name: "f10" | "f11"): CharacterFile => {
    const localPath = costume.motionFolder ? `${costume.motionFolder}/${name}.1s`
      : `${name}.1s`;
    const local = byName.get(localPath.toLowerCase());
    if (local) return local;
    const common = (library.files as readonly CharacterFile[]).find(file =>
      file.sourceName.toLowerCase() === "character_common.rho" &&
      file.name?.toLowerCase() === `${name}.1s`);
    if (!common) throw new Error(`当前人物缺少 ${name} 站立步行动作。`);
    return common;
  };
  const [idle, walk] = await Promise.all([
    FI(await motionFile("f10").bytes()),
    FI(await motionFile("f11").bytes()),
  ]);
  const motions = { 3: idle, 4: walk, 5: walk, 8: idle, 9: idle,
    10: idle, 11: idle, 14: idle };
  const motion = new ag(idle, motions);
  const required = (name: string): CharacterFile => {
    const file = byName.get(name.toLowerCase());
    if (!file) throw new Error(`当前人物缺少 ${name}。`);
    return file;
  };
  const faceFiles = SR([...byName.keys()], costume, xR([idle, walk]));
  const [modelBytes, bodyBytes, highBytes, faces] = await Promise.all([
    required(costume.model).bytes(),
    required(costume.body).bytes(),
    costume.high ? required(costume.high).bytes() : Promise.resolve(undefined),
    Promise.all([...faceFiles].map(async ([name, face]) => [name, {
      image: await required(face.kind === "direct" ? face.image : face.base).bytes(),
      overlay: face.kind === "split" ? await required(face.overlay).bytes() : undefined,
    }] as const)),
  ]);
  const scene = await TR(xa(modelBytes), bodyBytes, new Map(faces), motion,
    subject.environment, subject.stageBinding, {
      convertClientCoordinates: false,
      highTextureBytes: highBytes,
      primaryColor: colors?.primary ?? 0,
      highColor: colors?.high ?? 0,
  });
  return { scene, motion };
}

export interface MyRoomSceneAnchors {
  rider: Vector3;
  parking: Vector3;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const nativePoint = (position: [number, number, number]): Vector3 =>
  new Vector3(position[0], position[2], -position[1]);

/** The ordinary character model faces local +Z at yaw zero. */
export function myRoomFacingYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Original rider00 and parking00 define a safe plaza for the local character. */
export function myRoomSceneAnchors(model: ParsedRoom): MyRoomSceneAnchors {
  if (model.root.kind !== "track") throw new Error("小屋 track.1s 缺少 TrackContainer。");
  const objects = model.root.trackObjects as Array<{
    kind: string; name: string; transform: { position: [number, number, number] };
  }>;
  const dummy = (name: string): Vector3 => {
    const matches = objects.filter(object => object.kind === "ToDummy" && object.name === name);
    // pirate_M01 repeats these anchors in a second track layer at the same position.
    if (!matches.length || matches.some(object =>
      nativePoint(object.transform.position).distanceTo(
        nativePoint(matches[0]!.transform.position)) > 0.001)) {
      throw new Error(`小屋场景缺少一致的 ${name} 站位点。`);
    }
    return nativePoint(matches[0]!.transform.position);
  };
  const rider = dummy("rider00");
  const parking = dummy("parking00");
  const riderPoints = objects.filter(object => object.kind === "ToDummy" &&
    /^rider\d\d$/.test(object.name)).map(object => nativePoint(object.transform.position));
  const xs = [...riderPoints.map(point => point.x), parking.x];
  const zs = [...riderPoints.map(point => point.z), parking.z];
  return {
    rider, parking,
    minX: Math.min(...xs) - 0.8,
    maxX: Math.max(...xs) + 1.2,
    minZ: Math.min(...zs) - 1,
    maxZ: Math.max(...zs) + 1.5,
  };
}

/**
 * Box3.setFromObject also counts hidden meshes. Parked karts carry hidden
 * effect geometry (f01-f03, Object01-03) reaching ~56 units below the body,
 * which would push the grounding offset out of range.
 */
export function myRoomVisibleBounds(root: Object3D): Box3 {
  const bounds = new Box3();
  const part = new Box3();
  root.updateWorldMatrix(true, true);
  root.traverseVisible(object => {
    const mesh = object as Object3D & {
      geometry?: BufferGeometry; boundingBox?: Box3 | null; computeBoundingBox?: () => void;
    };
    if (!mesh.geometry) return;
    // Skinned meshes keep a pose-aware box on the object itself.
    if (mesh.boundingBox !== undefined && mesh.computeBoundingBox) {
      mesh.computeBoundingBox();
      part.copy(mesh.boundingBox!);
    } else {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) return;
      part.copy(mesh.geometry.boundingBox);
    }
    bounds.union(part.applyMatrix4(mesh.matrixWorld));
  });
  return bounds;
}

/**
 * Room triangles inside `area`, merged into one world-space mesh. Room meshes
 * share one large buffer, so per-mesh boxes cannot narrow the search. Without
 * `withTransparent`, glows and light beams are left out so they do not block;
 * floors such as ice or glass need them.
 */
export function myRoomCollider(root: Object3D, area: Box3,
  withTransparent = false): Mesh | undefined {
  root.updateWorldMatrix(true, true);
  const positions: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const triangle = new Box3();
  root.traverseVisible(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || (mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) return;
    const position = mesh.geometry.getAttribute("position");
    if (!position) return;
    const index = mesh.geometry.index;
    const total = index ? index.count : position.count;
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const ranges = Array.isArray(mesh.material) && mesh.geometry.groups.length
      ? mesh.geometry.groups.map(group => ({ ...group, material: materials[group.materialIndex ?? 0] }))
      : [{ ...mesh.geometry.drawRange, material: materials[0] }];
    for (const range of ranges) {
      if (!range.material?.visible || (range.material.transparent && !withTransparent)) continue;
      const end = Math.min(total, range.start + range.count);
      for (let i = range.start; i + 2 < end; i += 3) {
        a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
        triangle.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
        if (triangle.intersectsBox(area)) positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    }
  });
  if (!positions.length) return undefined;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const collider = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  collider.updateMatrixWorld(true);
  return collider;
}

/** Walking character footprint and the probe heights that meet scenery. */
const WALK_RADIUS = 0.45;
const WALK_PROBE_HEIGHTS = [0.4, 1.1];
/** Largest floor height change the character may step across. */
const WALK_STEP = 0.35;

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
  for (const point of points) bounds.expandByPoint(nativePoint(point));
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

/** Follow camera distance at zoom 1, close behind the walking character. */
const FOLLOW_DISTANCE = 8;
const FOLLOW_MIN_ZOOM = 0.7;
// Zoom 1 is the widest view; going further out shows the edge of smaller rooms.
const FOLLOW_MAX_ZOOM = 1;

/** Renders the original MyRoom 3D track and skydome in an isolated preview. */
export class MyRoomSceneView {
  readonly canvas = document.createElement("canvas");
  readonly status = document.createElement("div");
  readonly zoomReadout = document.createElement("div");
  readonly camera = new PerspectiveCamera(52, 1, 0.1, 4000);
  readonly scene = new Scene();
  readonly skyScene = new Scene();
  readonly playerRoot = new Group();
  readonly characterGroundRoot = new Group();
  readonly parkedKartRoot = new Group();
  readonly parkedKartContentRoot = new Group();
  private renderer?: WebGLRenderer;
  private room?: RenderedRoom;
  private sky?: RenderedRoom;
  private avatar?: RoomAvatar;
  private walkingAvatar?: WalkingAvatar;
  private avatarNeedsGrounding = false;
  private kartNeedsGrounding = false;
  private floorMeasured = false;
  private riderGroundY = 0;
  private parkingGroundY = 0;
  private subject?: MyRoomSceneSubject;
  private subjectKey?: string;
  private subjectGeneration = 0;
  private anchors?: MyRoomSceneAnchors;
  private frame?: MyRoomSceneFrame;
  private environmentId?: number;
  private environmentKartScale = 1;
  private generation = 0;
  private animationFrame = 0;
  private startTime = 0;
  private pitch = Math.PI * 0.15;
  private zoom = 1;
  private readonly cameraTarget = new Vector3();
  private readonly heldKeys = new Set<string>();
  private collider?: Mesh;
  private floorCollider?: Mesh;
  private readonly walkRay = new Raycaster();
  private lastFrameTime = 0;
  private followingPlayer = false;
  private disposed = false;
  private readonly resizeObserver?: ResizeObserver;

  constructor(readonly root: HTMLElement, readonly library: MyRoomSceneLibrary) {
    this.canvas.setAttribute("aria-label", "原版小屋三维场景，可用 WASD 行走，滚轮缩放");
    this.canvas.tabIndex = 0;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    this.canvas.style.touchAction = "none";
    // Ready's detached rider is native Z-up; its imported kart is already Y-up.
    this.characterGroundRoot.rotation.x = -Math.PI / 2;
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "position:absolute;left:12px;top:76px;z-index:2;padding:6px 10px;max-width:calc(100% - 24px);border-radius:6px;background:#102b49d9;color:#fff;font:13px/1.4 system-ui,sans-serif;pointer-events:none";
    this.status.textContent = "等待载入原版小屋场景…";
    this.zoomReadout.setAttribute("aria-live", "polite");
    this.zoomReadout.style.cssText = "position:absolute;right:12px;top:76px;z-index:2;padding:6px 10px;border-radius:6px;background:#102b49d9;color:#fff;font:13px/1.4 system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none";
    root.append(this.canvas, this.status, this.zoomReadout);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("blur", this.onCanvasBlur);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("keyup", this.onKeyUp, true);
    window.addEventListener("blur", this.onWindowBlur);
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
      const anchors = myRoomSceneAnchors(trackModel);
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
      this.anchors = anchors;
      this.floorMeasured = false;
      this.riderGroundY = anchors.rider.y;
      this.parkingGroundY = anchors.parking.y;
      this.environmentId = environment.id;
      this.environmentKartScale = environment.scaleUpOnKart ?? 1;
      this.zoom = 1;
      this.avatarNeedsGrounding = Boolean(this.avatar);
      this.kartNeedsGrounding = Boolean(this.avatar);
      this.placeSubject();
      this.positionCamera();
      this.room.reset(0);
      this.sky.reset(0);
      previousRoom?.dispose();
      this.disposeCollider();
      previousSky?.dispose();
      this.setStatus(this.avatar
        ? "WASD / 方向键行走 · 滚轮缩放"
        : "滚轮缩放", false);
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

  /** Load the same equipped model pair as Ready, then show the rider beside the parked kart. */
  async setSubject(subject: MyRoomSceneSubject): Promise<boolean> {
    if (this.disposed) return false;
    const key = JSON.stringify([subject.kart.path, subject.character.path,
      subject.profile.equipment, subject.profile.garage, subject.profile.initial]);
    if (key === this.subjectKey && this.avatar) return true;
    const generation = ++this.subjectGeneration;
    let next: RoomAvatar | undefined;
    let nextWalking: WalkingAvatar | undefined;
    if (this.room) this.setStatus("正在加载当前人物和卡丁车…");
    try {
      const equipment = subject.profile.equipment;
      const [kartColors, riderColors] = await Promise.all([
        Yb(this.library, equipment.itemIds[2] ?? 0),
        Yb(this.library, equipment.itemIds[70] ?? 0, 70),
      ]);
      if (this.disposed || generation !== this.subjectGeneration) return false;
      nextWalking = await loadWalkingAvatar(this.library, subject, riderColors);
      if (this.disposed || generation !== this.subjectGeneration) return false;
      const serial = subject.kart.itemId === equipment.itemIds[3]
        ? equipment.kartSerial ?? 0 : 0;
      next = await Jv(this.library, subject.kart, subject.character,
        subject.environment, subject.stageBinding, new Tr(), "kart-only", {
          equipment,
          initial: subject.profile.initial,
          build: p5(subject.profile.garage, subject.kart.itemId, serial),
          kartColors, riderColors,
        }, undefined, true);
      if (this.disposed || generation !== this.subjectGeneration) return false;
      const avatar = next;
      const previous = this.avatar;
      const previousWalking = this.walkingAvatar;
      this.avatar = avatar;
      this.walkingAvatar = nextWalking;
      this.subject = subject;
      this.subjectKey = key;
      next = undefined;
      nextWalking = undefined;
      this.playerRoot.clear();
      this.parkedKartRoot.clear();
      this.characterGroundRoot.clear();
      this.parkedKartContentRoot.clear();
      this.characterGroundRoot.add(this.walkingAvatar.scene.object);
      this.playerRoot.add(this.characterGroundRoot);
      this.parkedKartContentRoot.add(avatar.scene);
      this.parkedKartRoot.add(this.parkedKartContentRoot);
      this.avatarNeedsGrounding = true;
      this.kartNeedsGrounding = true;
      this.placeSubject();
      previous && Lt(previous);
      previousWalking?.scene.dispose();
      this.setStatus("WASD / 方向键行走 · 滚轮缩放");
      return true;
    } catch (error) {
      if (!this.disposed && generation === this.subjectGeneration) {
        const message = error instanceof Error ? error.message : String(error);
        this.setStatus(`小屋人物和车辆加载失败：${message}`, true);
      }
      return false;
    } finally {
      if (next) Lt(next);
      nextWalking?.scene.dispose();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    ++this.subjectGeneration;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("blur", this.onCanvasBlur);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("blur", this.onWindowBlur);
    this.heldKeys.clear();
    this.avatar && Lt(this.avatar);
    this.walkingAvatar?.scene.dispose();
    this.playerRoot.clear();
    this.parkedKartRoot.clear();
    this.room?.dispose();
    this.disposeCollider();
    this.sky?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas.remove();
    this.status.remove();
    this.zoomReadout.remove();
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
    if (this.followingPlayer)
      this.poseCamera(this.camera, this.cameraTarget, FOLLOW_DISTANCE * this.zoom);
    else this.poseCamera(this.camera, this.frame.target, this.frame.distance * this.zoom);
  }

  private poseCamera(camera: PerspectiveCamera, target: Vector3, distance: number): void {
    camera.position.set(
      target.x,
      target.y + Math.sin(this.pitch) * distance,
      target.z + Math.cos(this.pitch) * distance,
    );
    camera.lookAt(target);
  }

  private updateZoomReadout(): void {
    const text = `缩放 ${this.zoom.toFixed(2)}×`;
    if (this.zoomReadout.textContent !== text) this.zoomReadout.textContent = text;
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
      const delta = this.lastFrameTime ? Math.min(0.05, (now - this.lastFrameTime) / 1000) : 0;
      this.lastFrameTime = now;
      this.updateWalk(delta);
      this.positionCamera();
      this.updateZoomReadout();
      try {
        if (this.avatar && this.subject) {
          this.subject.stageBinding.beginFrame(elapsed);
          this.avatar.kart.animation.updateCurrentState(elapsed);
          T4(this.avatar, elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
          this.walkingAvatar?.scene.update(elapsed, this.camera,
            this.root.clientWidth, this.root.clientHeight);
          if (this.avatarNeedsGrounding && this.anchors && this.walkingAvatar) {
            const bounds = new Box3().setFromObject(this.walkingAvatar.scene.object);
            const offset = this.riderGroundY - bounds.min.y;
            if (Number.isFinite(offset) && Math.abs(offset) < 20)
              this.characterGroundRoot.position.y += offset;
            this.avatarNeedsGrounding = false;
          }
          if (this.kartNeedsGrounding && this.anchors) {
            const bounds = myRoomVisibleBounds(this.avatar.kart.object);
            const offset = this.parkingGroundY - bounds.min.y;
            if (Number.isFinite(offset) && Math.abs(offset) < 20)
              this.parkedKartRoot.position.y += offset;
            this.kartNeedsGrounding = false;
          }
          this.avatar.flyingPet?.update(elapsed, this.camera,
            this.root.clientWidth, this.root.clientHeight);
          this.avatar.decorations.forEach(decoration => decoration.scene?.update(
            elapsed, this.camera, this.root.clientWidth, this.root.clientHeight));
        }
        this.sky.update(elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
        this.room.update(elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
        if (!this.floorMeasured && this.anchors) this.measureGround();
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

  private readonly onPointerDown = (): void => {
    this.canvas.focus();
  };

  private readonly onCanvasBlur = (): void => { this.heldKeys.clear(); };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const wanted = this.zoom * Math.exp(event.deltaY * 0.001);
    if (!this.followingPlayer) {
      this.zoom = Math.max(0.5, Math.min(2.5, wanted));
      return;
    }
    this.zoom = Math.max(FOLLOW_MIN_ZOOM, Math.min(FOLLOW_MAX_ZOOM, wanted));
  };

  private placeSubject(): void {
    if (!this.anchors || !this.avatar) return;
    this.playerRoot.position.copy(this.anchors.rider);
    this.characterGroundRoot.position.y = 0;
    this.playerRoot.rotation.y = 0;
    this.parkedKartRoot.position.copy(this.anchors.parking);
    // parking00 has a quarter-turn native basis; its front faces across the plaza.
    this.parkedKartRoot.rotation.y = Math.PI / 2;
    this.parkedKartRoot.scale.setScalar(this.environmentKartScale);
    if (!this.playerRoot.parent) this.scene.add(this.playerRoot);
    if (!this.parkedKartRoot.parent) this.scene.add(this.parkedKartRoot);
    this.followingPlayer = true;
    this.pitch = Math.PI * 0.045;
    this.cameraTarget.copy(this.playerRoot.position).add(new Vector3(0, 1.8, 0));
    this.lastFrameTime = 0;
  }

  /** The dummy can be above the paving; use the closest rendered floor below it. */
  private measureGround(): void {
    if (!this.anchors || !this.room) return;
    const ray = new Raycaster();
    const floor = (point: Vector3): number => {
      ray.set(point.clone().add(new Vector3(0, 30, 0)), new Vector3(0, -1, 0));
      const hit = ray.intersectObject(this.room!.object, true).find(candidate =>
        candidate.point.y <= point.y + 1 && candidate.point.y >= point.y - 10);
      return hit?.point.y ?? point.y;
    };
    this.riderGroundY = floor(this.anchors.rider);
    this.parkingGroundY = floor(this.anchors.parking);
    const { minX, maxX, minZ, maxZ } = this.anchors;
    this.disposeCollider();
    const walkArea = new Box3(
      new Vector3(minX - 2, this.riderGroundY - 1.5, minZ - 2),
      new Vector3(maxX + 2, this.riderGroundY + 2.5, maxZ + 2));
    this.collider = myRoomCollider(this.room.object, walkArea);
    this.floorCollider = myRoomCollider(this.room.object, walkArea, true);
    this.avatarNeedsGrounding = Boolean(this.avatar);
    this.kartNeedsGrounding = Boolean(this.avatar);
    this.floorMeasured = true;
  }

  private updateWalk(delta: number): void {
    if (!this.followingPlayer || !this.anchors || !this.avatar || delta <= 0) return;
    if (document.activeElement !== this.canvas) this.heldKeys.clear();
    const forward = Number(this.heldKeys.has("w") || this.heldKeys.has("arrowup")) -
      Number(this.heldKeys.has("s") || this.heldKeys.has("arrowdown"));
    const right = Number(this.heldKeys.has("d") || this.heldKeys.has("arrowright")) -
      Number(this.heldKeys.has("a") || this.heldKeys.has("arrowleft"));
    if (forward || right) {
      this.walkingAvatar?.motion.submitMotion(4);
      const length = Math.hypot(forward, right);
      const dx = right / length;
      const dz = -forward / length;
      const x = Math.max(this.anchors.minX, Math.min(this.anchors.maxX,
        this.playerRoot.position.x + dx * 1.8 * delta));
      const z = Math.max(this.anchors.minZ, Math.min(this.anchors.maxZ,
        this.playerRoot.position.z + dz * 1.8 * delta));
      const position = this.playerRoot.position;
      // Slide along whatever blocks a diagonal step instead of stopping dead.
      const step = [[x, z], [x, position.z], [position.x, z]]
        .find(([nextX, nextZ]) => this.canWalkTo(nextX!, nextZ!));
      if (step) position.set(step[0]!, this.anchors.rider.y, step[1]!);
      this.playerRoot.rotation.y = myRoomFacingYaw(dx, dz);
    } else {
      this.walkingAvatar?.motion.submitMotion(3);
      this.playerRoot.position.y = this.anchors.rider.y;
    }
    const desired = this.playerRoot.position.clone().add(new Vector3(0, 1.8, 0));
    this.cameraTarget.lerp(desired, Math.min(1, delta * 9));
  }

  /** Keep clear of the parked kart, solid scenery and floor edges or raised platforms. */
  private canWalkTo(x: number, z: number): boolean {
    if (!this.anchors) return false;
    const from = this.playerRoot.position;
    const dx = x - from.x;
    const dz = z - from.z;
    const distance = Math.hypot(dx, dz);
    if (!distance) return false;
    if (Math.hypot(x - this.anchors.parking.x, z - this.anchors.parking.z) <=
        1.8 * this.environmentKartScale) return false;
    const collider = this.collider;
    const floorCollider = this.floorCollider;
    if (!collider || !floorCollider) return true;
    const ray = this.walkRay;
    const ground = this.riderGroundY;
    const direction = new Vector3(dx / distance, 0, dz / distance);
    const side = new Vector3(-direction.z, 0, direction.x).multiplyScalar(WALK_RADIUS * 0.7);
    ray.far = distance + WALK_RADIUS;
    for (const height of WALK_PROBE_HEIGHTS) {
      for (const offset of [0, 1, -1]) {
        ray.set(new Vector3(from.x, ground + height, from.z).addScaledVector(side, offset), direction);
        if (ray.intersectObject(collider, false).length) return false;
      }
    }
    ray.far = 1.2 + 1.5;
    ray.set(new Vector3(x, ground + 1.2, z), new Vector3(0, -1, 0));
    // Low solid scenery below the probe heights still blocks the step.
    const solid = ray.intersectObject(collider, false)[0];
    if (solid && solid.point.y > ground + WALK_STEP) return false;
    return ray.intersectObject(floorCollider, false)
      .some(hit => Math.abs(hit.point.y - ground) <= WALK_STEP);
  }

  private disposeCollider(): void {
    for (const collider of [this.collider, this.floorCollider]) {
      collider?.geometry.dispose();
      (collider?.material as Material | undefined)?.dispose();
    }
    this.collider = this.floorCollider = undefined;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!/^(?:w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/.test(key) ||
        this.disposed || !this.avatar || !this.anchors ||
        document.activeElement !== this.canvas ||
        event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    this.heldKeys.add(key);
    event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.key.toLowerCase());
  };

  private readonly onWindowBlur = (): void => { this.heldKeys.clear(); };
}
