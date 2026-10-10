import {
  Box3, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
  type Material, type Object3D,
} from "three";
import { CR, SR, TR, W1, Yb, e4, sn, xR, y9, yo } from "../generated/formats.js";
import { FI, Ma, Tr, p5, xa } from "../generated/library.js";
import { Jv, Lt, T4 } from "../generated/ui.js";
import { ag, hr, pk } from "../generated/vehicle.js";
import { S4 } from "../generated/world.js";
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

/** A goggle, headband, hand item or aura worn by a walking rider. */
interface WornItem {
  scene?: { object: Object3D; update?(elapsed: number, camera: unknown, width: number, height: number): void };
  dispose(): void;
}

/** A flying pet following a walking rider. */
interface FollowingPet {
  mount(owner: unknown): void;
  update(elapsed: number, camera: unknown, width: number, height: number): void;
  dispose(): void;
}

interface WalkingAvatar {
  scene: WalkingScene;
  motion: InstanceType<typeof ag>;
  /** The character's own meshes (ground and head height ignore what it wears). */
  body: Object3D[];
  worn: WornItem[];
  pet?: FollowingPet;
}

/**
 * Where each item a character wears goes, as Ready dresses the rider
 * (ui.js Jv): goggle, headband and hand item on decoration sockets.
 */
const WORN_SOCKETS: ReadonlyArray<[kind: string, category: number, part: number, slot: number]> = [
  ["goggle", 8, 3, 0], ["headBand", 11, 3, 3], ["handGearL", 16, 4, 0],
];

interface DressingLibrary {
  timeAttackDecorationItem(category: number, itemId: number): Promise<{ internalId: string; decorationTrans?: unknown }>;
}

interface DecoratedCharacter {
  getDecorationSocket(part: number, slot: number): Object3D | undefined;
  getDecorationOwner(): Object3D;
  reset?(): void;
}

/**
 * Dress a walking rider like Ready's: goggle, headband, hand item, aura and
 * flying pet from its equipment. A piece that fails to load is left off.
 */
async function dressWalkingAvatar(library: MyRoomSceneLibrary, subject: MyRoomSceneSubject,
  avatar: WalkingAvatar): Promise<void> {
  const items = subject.profile.equipment.itemIds;
  const character = avatar.scene as unknown as DecoratedCharacter;
  const dressing = library as unknown as DressingLibrary;
  const load = async (kind: string, category: number) => {
    const item = await dressing.timeAttackDecorationItem(category, items[category]!);
    return await hr(library, kind, item.internalId, subject.environment, subject.stageBinding, {
      convertClientCoordinates: false, trans: item.decorationTrans,
      ...(kind === "goggle" ? { goggleType: (subject.character as { goggleType?: string }).goggleType ?? "" } : {}),
    }) as WornItem;
  };
  for (const [kind, category, part, slot] of WORN_SOCKETS) {
    if (!items[category]) continue;
    try {
      const worn = await load(kind, category);
      const socket = character.getDecorationSocket(part, slot);
      if (!socket || !worn.scene) {
        worn.dispose();
        continue;
      }
      socket.add(worn.scene.object);
      avatar.worn.push(worn);
    } catch (error) {
      console.warn(`小屋人物 ${kind} 加载失败`, error);
    }
  }
  if (items[26]) {
    try {
      const aura = await load("aura", 26);
      if (aura.scene) {
        character.getDecorationOwner().add(aura.scene.object);
        avatar.worn.push(aura);
      } else aura.dispose();
    } catch (error) {
      console.warn("小屋人物光环加载失败", error);
    }
  }
  if (items[52]) {
    try {
      const item = await Ma(library, items[52]);
      if (item) {
        const colors = await Yb(library, items[2] ?? 0);
        const pet = await S4.preview({ library, item, environment: subject.environment,
          binding: subject.stageBinding, colors, animate: true,
          previewPosition: [1.05, -0.75, 2] }) as FollowingPet;
        pet.mount(character.getDecorationOwner());
        avatar.pet = pet;
      }
    } catch (error) {
      console.warn("小屋飞行宠物加载失败", error);
    }
  }
  character.reset?.();
}

function updateWalkingAvatar(avatar: WalkingAvatar, elapsed: number, camera: unknown, width: number,
  height: number): void {
  avatar.scene.update(elapsed, camera as never, width, height);
  for (const worn of avatar.worn) worn.scene?.update?.(elapsed, camera, width, height);
  avatar.pet?.update(elapsed, camera, width, height);
}

function disposeWalkingAvatar(avatar: WalkingAvatar | undefined): void {
  if (!avatar) return;
  for (const worn of avatar.worn) worn.dispose();
  avatar.pet?.dispose();
  avatar.scene.dispose();
}

/** The character's own meshes in world space. */
function bodyBounds(avatar: WalkingAvatar): Box3 {
  const bounds = new Box3();
  for (const mesh of avatar.body) bounds.expandByObject(mesh, false);
  return bounds.isEmpty() ? new Box3().setFromObject(avatar.scene.object) : bounds;
}

export interface MyRoomSceneSubject {
  kart: GarageCatalogEntry;
  character: GarageCatalogEntry;
  profile: LocalProfile;
  /** The Ready-stage toon resources stay owned by Ready. */
  environment: unknown;
  stageBinding: { beginFrame(time: number): void; coatingTextures(library: unknown): unknown };
  /** roomAdmin representative karts, parked at parking08 and parking09. */
  displayKarts?: readonly GarageCatalogEntry[];
}

interface ParkedDisplay {
  root: Group;
  avatar: RoomAvatar;
  ground: number;
  needsGrounding: boolean;
}

/** A rider's head on the canvas after a frame (CSS pixels); id "" is the local rider. */
export interface MyRoomHead { id: string; x: number; y: number }

/** Where a rider stands and whether it walks (the room socket's pose). */
export interface MyRoomPose { x: number; y: number; z: number; yaw: number; moving: boolean }

/** Another rider in the room: its look and riderCard slot. */
export interface MyRoomRemoteRider {
  id: string;
  slot: number;
  subject: MyRoomSceneSubject;
  pose?: MyRoomPose;
}

/** A visitor's kart, parked at parking01-07 by riderCard slot. */
export interface MyRoomVisitorKart {
  id: string;
  slot: number;
  subject: MyRoomSceneSubject;
}

interface RemoteRider {
  id: string;
  slot: number;
  key: string;
  root: Group;
  ground: Group;
  walking?: WalkingAvatar;
  target: Vector3;
  yaw: number;
  moving: boolean;
  placed: boolean;
  needsGrounding: boolean;
  generation: number;
}

interface VisitorKart {
  id: string;
  slot: number;
  key: string;
  display?: ParkedDisplay;
  generation: number;
}

/** Remote riders walk at most this fast towards their reported spot. */
const REMOTE_SPEED = 3.6;
/** Farther than this and a remote rider jumps instead of walking. */
const REMOTE_SNAP = 8;
/** The local pose is reported at most this often while walking. */
const POSE_INTERVAL_MS = 100;

function subjectKey(subject: MyRoomSceneSubject): string {
  return JSON.stringify([subject.kart.path, subject.character.path, subject.profile.equipment,
    subject.profile.garage, subject.profile.initial]);
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
  const body: Object3D[] = [];
  scene.object.traverse((object: Object3D) => {
    if ((object as Mesh).isMesh) body.push(object);
  });
  const avatar: WalkingAvatar = { scene, motion, body, worn: [] };
  try {
    await dressWalkingAvatar(library, subject, avatar);
  } catch (error) {
    disposeWalkingAvatar(avatar);
    throw error;
  }
  return avatar;
}

export interface MyRoomSceneAnchors {
  rider: Vector3;
  parking: Vector3;
  /**
   * parking08 and parking09 continue the owner's column beside parking00; the
   * parking01-07 row behind the plaza is left for visiting riders' karts.
   */
  displayParking: Vector3[];
  /** The parking01-07 row behind the plaza, by spot number; rooms may omit spots. */
  backRow: Array<Vector3 | undefined>;
  /** rider00-07 standing spots by number (riderCard order); rooms may omit some. */
  riders: Array<Vector3 | undefined>;
  /** The front hall's centre: the middle of the rider00-07 standing spots. */
  hall: Vector3;
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
  const displayParking = ["parking08", "parking09"]
    .filter(name => objects.some(object => object.kind === "ToDummy" && object.name === name))
    .map(dummy);
  const backRow = [1, 2, 3, 4, 5, 6, 7].reduce<Array<Vector3 | undefined>>((row, spot) => {
    const name = `parking0${spot}`;
    row[spot] = objects.some(object => object.kind === "ToDummy" && object.name === name)
      ? dummy(name) : undefined;
    return row;
  }, []);
  const riderPoints = objects.filter(object => object.kind === "ToDummy" &&
    /^rider\d\d$/.test(object.name)).map(object => nativePoint(object.transform.position));
  const riders = [0, 1, 2, 3, 4, 5, 6, 7].map(spot => {
    const name = `rider0${spot}`;
    return objects.some(object => object.kind === "ToDummy" && object.name === name)
      ? dummy(name) : undefined;
  });
  const hall = riderPoints.reduce((sum, point) => sum.add(point), new Vector3())
    .multiplyScalar(1 / riderPoints.length).setY(rider.y);
  const xs = [...riderPoints.map(point => point.x), parking.x];
  const zs = [...riderPoints.map(point => point.z), parking.z];
  return {
    rider, parking, displayParking, backRow, riders, hall,
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

/**
 * Lobby showcase pose: the rider and kart side by side where
 * `myRoomShowcaseCenter` puts them, seen from the room's usual +Z camera.
 */
export interface MyRoomShowcasePose {
  /** How far in front of a straight back row's spots 4 and 5 the pair stands. */
  ahead: number;
  /** The kart from the rider; its x grows with the room's kart scale. */
  kart: Vector3;
  /** Kart yaw; zero faces the camera. */
  kartYaw: number;
  /** Rider yaw; zero faces the camera. */
  riderYaw: number;
  /** Camera target from the middle of the pair. */
  target: Vector3;
  /** Camera distance for karts at their normal size; larger karts pull it back. */
  distance: number;
  pitch: number;
}

export function myRoomShowcasePose(): MyRoomShowcasePose {
  return {
    ahead: 2.5,
    kart: new Vector3(-2.15, 0, -0.3),
    kartYaw: Math.PI * 0.33,
    riderYaw: -Math.PI * 0.06,
    target: new Vector3(0.525, 2.15, 2.05),
    distance: 5.2,
    pitch: Math.PI * 0.06,
  };
}

/** Spots 4 and 5 count as one back row when this level with each other and the floor. */
const ROW_TOLERANCE = 0.5;
const SHELF_HEIGHT = 1;

/** Whether parking04 and parking05 sit side by side in a straight back row on the floor. */
export function myRoomBackRowStraight(anchors: Pick<MyRoomSceneAnchors, "rider" | "backRow">):
  boolean {
  const four = anchors.backRow[4];
  const five = anchors.backRow[5];
  return !!four && !!five && Math.abs(four.z - five.z) <= ROW_TOLERANCE &&
    Math.abs(four.x - five.x) > ROW_TOLERANCE && four.z < anchors.rider.z &&
    Math.max(four.y, five.y) - anchors.rider.y <= SHELF_HEIGHT;
}

/**
 * Where the pair stands, on rider00's floor. Rooms whose back row runs
 * straight behind the plaza put it a little in front of the midpoint of
 * parking04 and parking05. Special rooms (rows that turn a corner or run
 * down the side, the VIP room's display shelves, missing spots) put it at
 * the front hall's centre instead.
 */
export function myRoomShowcaseCenter(anchors: Pick<MyRoomSceneAnchors, "rider" | "backRow" | "hall">,
  ahead: number): Vector3 {
  if (!myRoomBackRowStraight(anchors)) return anchors.hall.clone().setY(anchors.rider.y);
  return anchors.backRow[4]!.clone().add(anchors.backRow[5]!).multiplyScalar(0.5)
    .setY(anchors.rider.y).add(new Vector3(0, 0, ahead));
}

export interface MyRoomSceneOptions {
  /** A still lobby view: no walking or zoom, rider and kart posed together. */
  showcase?: MyRoomShowcasePose;
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
  /** The room owner's look when visiting: its kart is parked at parking00. */
  private owner?: MyRoomSceneSubject;
  private subjectKey?: string;
  /** riderCard slot of the local rider: it stands at rider0<slot>. */
  private localSlot = 0;
  private readonly remotes = new Map<string, RemoteRider>();
  private readonly visitorKarts = new Map<string, VisitorKart>();
  private lastPoseSent = 0;
  private lastPoseMoving = false;
  /** Reports the local rider's walking (throttled) for the room socket. */
  onLocalMove?: (pose: MyRoomPose) => void;
  /** After each drawn frame: where the riders' heads are (name tags, talk balloons). */
  onFrame?: (heads: MyRoomHead[]) => void;
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
  private displays: ParkedDisplay[] = [];
  private displayGeneration = 0;
  private floorCollider?: Mesh;
  private readonly walkRay = new Raycaster();
  private lastFrameTime = 0;
  private followingPlayer = false;
  private disposed = false;
  private readonly resizeObserver?: ResizeObserver;

  private readonly showcase?: MyRoomShowcasePose;

  constructor(readonly root: HTMLElement, readonly library: MyRoomSceneLibrary,
    options: MyRoomSceneOptions = {}) {
    this.showcase = options.showcase;
    this.canvas.setAttribute("aria-label", this.showcase
      ? "大厅三维场景" : "原版小屋三维场景，可用 WASD 行走，滚轮缩放");
    this.canvas.tabIndex = this.showcase ? -1 : 0;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    this.canvas.style.touchAction = "none";
    // Ready's detached rider is native Z-up; its imported kart is already Y-up.
    this.characterGroundRoot.rotation.x = -Math.PI / 2;
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "position:absolute;left:12px;top:76px;z-index:2;padding:6px 10px;max-width:calc(100% - 24px);border-radius:6px;background:#102b49d9;color:#fff;font:13px/1.4 system-ui,sans-serif;pointer-events:none";
    this.status.textContent = "等待载入原版小屋场景…";
    root.append(this.canvas, this.status);
    if (this.showcase) {
      this.canvas.style.pointerEvents = "none";
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(root);
      }
      return;
    }
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
      for (const remote of this.remotes.values()) {
        remote.needsGrounding = true;
        this.spawnRemote(remote);
      }
      // The lobby camera is fixed before the rider and kart arrive.
      if (this.showcase && !this.avatar) this.placeShowcase(this.showcase);
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

  /**
   * Load the same equipped model pair as Ready, then show the rider beside the
   * parked kart. When visiting, `owner` is the room owner's look: its kart is
   * the one parked at parking00 (and paints the representative karts) while
   * the local rider walks with its own character.
   */
  async setSubject(subject: MyRoomSceneSubject, owner?: MyRoomSceneSubject): Promise<boolean> {
    if (this.disposed) return false;
    const parked = owner ?? subject;
    const key = JSON.stringify([subjectKey(subject), owner ? subjectKey(owner) : ""]);
    if (key === this.subjectKey && this.avatar) return true;
    const generation = ++this.subjectGeneration;
    let next: RoomAvatar | undefined;
    let nextWalking: WalkingAvatar | undefined;
    if (this.room) this.setStatus("正在加载当前人物和卡丁车…");
    try {
      const equipment = parked.profile.equipment;
      const [kartColors, riderColors, ownRiderColors] = await Promise.all([
        Yb(this.library, equipment.itemIds[2] ?? 0),
        Yb(this.library, equipment.itemIds[70] ?? 0, 70),
        Yb(this.library, subject.profile.equipment.itemIds[70] ?? 0, 70),
      ]);
      if (this.disposed || generation !== this.subjectGeneration) return false;
      nextWalking = await loadWalkingAvatar(this.library, subject, ownRiderColors);
      if (this.disposed || generation !== this.subjectGeneration) return false;
      const serial = parked.kart.itemId === equipment.itemIds[3]
        ? equipment.kartSerial ?? 0 : 0;
      next = await Jv(this.library, parked.kart, parked.character,
        subject.environment, subject.stageBinding, new Tr(), "kart-only", {
          equipment,
          initial: parked.profile.initial,
          build: p5(parked.profile.garage, parked.kart.itemId, serial),
          kartColors, riderColors,
        }, undefined, true);
      if (this.disposed || generation !== this.subjectGeneration) return false;
      const avatar = next;
      const previous = this.avatar;
      const previousWalking = this.walkingAvatar;
      this.avatar = avatar;
      this.walkingAvatar = nextWalking;
      this.subject = subject;
      this.owner = owner;
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
      disposeWalkingAvatar(previousWalking);
      this.setStatus("WASD / 方向键行走 · 滚轮缩放");
      void this.setDisplayKarts(subject.displayKarts ?? []);
      return true;
    } catch (error) {
      if (!this.disposed && generation === this.subjectGeneration) {
        const message = error instanceof Error ? error.message : String(error);
        this.setStatus(`小屋人物和车辆加载失败：${message}`, true);
      }
      return false;
    } finally {
      if (next) Lt(next);
      disposeWalkingAvatar(nextWalking);
    }
  }

  /** Replace the representative karts beside the owner's parked kart. */
  async setDisplayKarts(karts: readonly GarageCatalogEntry[]): Promise<boolean> {
    if (this.disposed || !this.subject) return false;
    const subject = this.owner ?? this.subject;
    const generation = ++this.displayGeneration;
    const loaded: RoomAvatar[] = [];
    try {
      const equipment = subject.profile.equipment;
      const [kartColors, riderColors] = await Promise.all([
        Yb(this.library, equipment.itemIds[2] ?? 0),
        Yb(this.library, equipment.itemIds[70] ?? 0, 70),
      ]);
      for (const kart of karts.slice(0, 2)) {
        // Shown as a different kart with the owner's paint, like a garage preview.
        const shown = { ...equipment, itemIds: { ...equipment.itemIds, 3: kart.itemId },
          kartSerial: 0, systemKart: kart.itemId === 0 ? kart.systemKey : undefined,
          systemKartVariant: undefined };
        loaded.push(await Jv(this.library, kart, subject.character, subject.environment,
          subject.stageBinding, new Tr(), "kart-only", {
            equipment: shown, initial: subject.profile.initial,
            build: p5(subject.profile.garage, kart.itemId, 0), kartColors, riderColors,
          }, undefined, true));
        if (this.disposed || generation !== this.displayGeneration) return false;
      }
      this.clearDisplays();
      this.displays = loaded.splice(0).map(avatar => {
        const root = new Group();
        root.add(avatar.scene);
        this.scene.add(root);
        return { root, avatar, ground: 0, needsGrounding: true };
      });
      this.placeDisplays();
      return true;
    } catch (error) {
      if (!this.disposed && generation === this.displayGeneration) {
        const message = error instanceof Error ? error.message : String(error);
        this.setStatus(`小屋代表卡丁车加载失败：${message}`, true);
      }
      return false;
    } finally {
      loaded.forEach(avatar => Lt(avatar));
    }
  }

  /** Stand the local rider at rider0<slot> (its riderCard slot). */
  setLocalSlot(slot: number): void {
    if (this.localSlot === slot) return;
    this.localSlot = slot;
    if (this.avatar && this.anchors && !this.showcase) this.placeSubject();
  }

  /** The other riders in the room; riders already shown keep walking. */
  setRemoteRiders(riders: readonly MyRoomRemoteRider[]): void {
    if (this.disposed) return;
    const wanted = new Set(riders.map(rider => rider.id));
    for (const [id, remote] of this.remotes) {
      if (!wanted.has(id)) this.removeRemote(id, remote);
    }
    for (const rider of riders) {
      const key = subjectKey(rider.subject);
      const existing = this.remotes.get(rider.id);
      if (existing && existing.key === key) {
        existing.slot = rider.slot;
        continue;
      }
      if (existing) this.removeRemote(rider.id, existing);
      const remote: RemoteRider = { id: rider.id, slot: rider.slot, key, root: new Group(),
        ground: new Group(), target: new Vector3(), yaw: 0, moving: false, placed: false,
        needsGrounding: true, generation: 0 };
      remote.ground.rotation.x = -Math.PI / 2;
      remote.root.add(remote.ground);
      this.remotes.set(rider.id, remote);
      if (rider.pose) this.moveRemoteRider(rider.id, rider.pose);
      void this.loadRemote(remote, rider.subject);
    }
  }

  /** A remote rider reported where it is. */
  moveRemoteRider(id: string, pose: MyRoomPose): void {
    const remote = this.remotes.get(id);
    if (!remote) return;
    remote.target.set(pose.x, pose.y, pose.z);
    remote.yaw = pose.yaw;
    remote.moving = pose.moving;
    if (!remote.placed) {
      remote.root.position.copy(remote.target);
      remote.root.rotation.y = pose.yaw;
      remote.placed = true;
    }
  }

  /** Visitors' karts in the parking01-07 back row (the local rider's too). */
  setVisitorKarts(karts: readonly MyRoomVisitorKart[]): void {
    if (this.disposed) return;
    const wanted = new Map(karts.map(kart => [kart.id, kart]));
    for (const [id, kart] of this.visitorKarts) {
      const next = wanted.get(id);
      if (!next || next.slot !== kart.slot || subjectKey(next.subject) !== kart.key)
        this.removeVisitorKart(id, kart);
    }
    for (const kart of karts) {
      if (this.visitorKarts.has(kart.id)) continue;
      const entry: VisitorKart = { id: kart.id, slot: kart.slot, key: subjectKey(kart.subject),
        generation: 0 };
      this.visitorKarts.set(kart.id, entry);
      void this.loadVisitorKart(entry, kart.subject);
    }
  }

  private async loadRemote(remote: RemoteRider, subject: MyRoomSceneSubject): Promise<void> {
    const generation = ++remote.generation;
    let walking: WalkingAvatar | undefined;
    try {
      const riderColors = await Yb(this.library, subject.profile.equipment.itemIds[70] ?? 0, 70);
      walking = await loadWalkingAvatar(this.library, subject, riderColors);
      if (this.disposed || this.remotes.get(remote.id) !== remote || generation !== remote.generation) return;
      remote.walking = walking;
      walking = undefined;
      remote.ground.add(remote.walking.scene.object);
      remote.needsGrounding = true;
      if (!remote.placed) this.spawnRemote(remote);
      this.scene.add(remote.root);
    } catch (error) {
      console.warn("小屋车手模型加载失败", error);
    } finally {
      disposeWalkingAvatar(walking);
    }
  }

  private spawnRemote(remote: RemoteRider): void {
    if (!this.anchors) return;
    const spot = this.anchors.riders[remote.slot] ?? this.anchors.rider;
    remote.target.copy(spot).setY(this.anchors.rider.y);
    remote.root.position.copy(remote.target);
    remote.placed = true;
  }

  private removeRemote(id: string, remote: RemoteRider): void {
    remote.generation++;
    this.remotes.delete(id);
    remote.root.removeFromParent();
    remote.ground.clear();
    disposeWalkingAvatar(remote.walking);
    remote.walking = undefined;
  }

  private async loadVisitorKart(entry: VisitorKart, subject: MyRoomSceneSubject): Promise<void> {
    const generation = ++entry.generation;
    let avatar: RoomAvatar | undefined;
    try {
      const equipment = subject.profile.equipment;
      const [kartColors, riderColors] = await Promise.all([
        Yb(this.library, equipment.itemIds[2] ?? 0),
        Yb(this.library, equipment.itemIds[70] ?? 0, 70),
      ]);
      const serial = subject.kart.itemId === equipment.itemIds[3] ? equipment.kartSerial ?? 0 : 0;
      avatar = await Jv(this.library, subject.kart, subject.character, subject.environment,
        subject.stageBinding, new Tr(), "kart-only", {
          equipment, initial: subject.profile.initial,
          build: p5(subject.profile.garage, subject.kart.itemId, serial), kartColors, riderColors,
        }, undefined, true);
      if (this.disposed || this.visitorKarts.get(entry.id) !== entry || generation !== entry.generation) return;
      const root = new Group();
      root.add(avatar.scene);
      entry.display = { root, avatar, ground: 0, needsGrounding: true };
      avatar = undefined;
      this.scene.add(root);
      this.placeVisitorKart(entry);
    } catch (error) {
      console.warn("小屋访客卡丁车加载失败", error);
    } finally {
      if (avatar) Lt(avatar);
    }
  }

  private placeVisitorKart(entry: VisitorKart): void {
    const display = entry.display;
    if (!display) return;
    const spot = this.anchors?.backRow[entry.slot];
    display.root.visible = !!spot;
    if (!spot) return;
    display.root.position.copy(spot);
    // Back-row karts face the plaza (yaw 0 faces the room camera), front first.
    display.root.rotation.y = 0;
    display.root.scale.setScalar(this.environmentKartScale);
    display.ground = this.floorMeasured ? this.floorBelow(spot) : spot.y;
    display.needsGrounding = true;
  }

  private removeVisitorKart(id: string, entry: VisitorKart): void {
    entry.generation++;
    this.visitorKarts.delete(id);
    if (entry.display) {
      entry.display.root.removeFromParent();
      entry.display.root.clear();
      Lt(entry.display.avatar);
    }
  }

  /** Move remote riders towards their reported spots and animate them. */
  private updateRemotes(delta: number, elapsed: number): void {
    if (!this.anchors) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    for (const remote of this.remotes.values()) {
      if (!remote.walking) continue;
      const position = remote.root.position;
      const offset = remote.target.clone().sub(position).setY(0);
      const distance = offset.length();
      if (distance > REMOTE_SNAP) position.copy(remote.target);
      else if (distance > 0.01) position.addScaledVector(offset, Math.min(1, REMOTE_SPEED * delta / distance));
      position.y = this.anchors.rider.y;
      let turn = remote.yaw - remote.root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      remote.root.rotation.y += turn * Math.min(1, delta * 12);
      remote.walking.motion.submitMotion(remote.moving || distance > 0.15 ? 4 : 3);
      updateWalkingAvatar(remote.walking, elapsed, this.camera, width, height);
      if (remote.needsGrounding) {
        const bounds = bodyBounds(remote.walking);
        const ground = this.riderGroundY - bounds.min.y;
        if (Number.isFinite(ground) && Math.abs(ground) < 20) remote.ground.position.y += ground;
        remote.needsGrounding = false;
      }
    }
    for (const entry of this.visitorKarts.values()) {
      const display = entry.display;
      if (!display) continue;
      display.avatar.kart.animation.updateCurrentState(elapsed);
      T4(display.avatar, elapsed, this.camera, width, height);
      if (display.needsGrounding && display.root.visible) {
        const ground = display.ground - myRoomVisibleBounds(display.avatar.kart.object).min.y;
        if (Number.isFinite(ground) && Math.abs(ground) < 20) display.root.position.y += ground;
        display.needsGrounding = false;
      }
    }
  }

  /** Report the local rider's walking: while it moves, and once when it stops. */
  private reportPose(moving: boolean, now: number): void {
    if (!this.onLocalMove) return;
    if (moving ? now - this.lastPoseSent < POSE_INTERVAL_MS : !this.lastPoseMoving) return;
    this.lastPoseSent = now;
    this.lastPoseMoving = moving;
    const position = this.playerRoot.position;
    this.onLocalMove({ x: position.x, y: position.y, z: position.z,
      yaw: this.playerRoot.rotation.y, moving });
  }

  private clearDisplays(): void {
    for (const display of this.displays) {
      display.root.removeFromParent();
      display.root.clear();
      Lt(display.avatar);
    }
    this.displays = [];
  }

  /** Same quarter-turn basis and scale as parking00, grounded on the paving below. */
  private placeDisplays(): void {
    const slots = this.anchors?.displayParking ?? [];
    this.displays.forEach((display, index) => {
      const slot = slots[index];
      display.root.visible = !!slot;
      if (!slot) return;
      display.root.position.copy(slot);
      display.root.rotation.y = Math.PI / 2;
      display.root.scale.setScalar(this.environmentKartScale);
      display.ground = this.floorMeasured ? this.floorBelow(slot) : slot.y;
      display.needsGrounding = true;
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    ++this.subjectGeneration;
    ++this.displayGeneration;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("blur", this.onCanvasBlur);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("blur", this.onWindowBlur);
    this.heldKeys.clear();
    this.onLocalMove = undefined;
    for (const [id, remote] of this.remotes) this.removeRemote(id, remote);
    for (const [id, entry] of this.visitorKarts) this.removeVisitorKart(id, entry);
    this.avatar && Lt(this.avatar);
    this.clearDisplays();
    disposeWalkingAvatar(this.walkingAvatar);
    this.playerRoot.clear();
    this.parkedKartRoot.clear();
    this.room?.dispose();
    this.disposeCollider();
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

  /** Progress hints stay off screen under the release menus; errors are shown. */
  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.setAttribute("role", error ? "alert" : "status");
    this.status.hidden = !error;
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
      this.updateRemotes(delta, elapsed);
      this.positionCamera();
      try {
        if (this.avatar && this.subject) {
          this.subject.stageBinding.beginFrame(elapsed);
          this.avatar.kart.animation.updateCurrentState(elapsed);
          T4(this.avatar, elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
          if (this.walkingAvatar) updateWalkingAvatar(this.walkingAvatar, elapsed, this.camera,
            this.root.clientWidth, this.root.clientHeight);
          if (this.avatarNeedsGrounding && this.anchors && this.walkingAvatar) {
            const bounds = bodyBounds(this.walkingAvatar);
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
          for (const display of this.displays) {
            display.avatar.kart.animation.updateCurrentState(elapsed);
            T4(display.avatar, elapsed, this.camera, this.root.clientWidth,
              this.root.clientHeight);
            if (display.needsGrounding && display.root.visible) {
              const offset = display.ground -
                myRoomVisibleBounds(display.avatar.kart.object).min.y;
              if (Number.isFinite(offset) && Math.abs(offset) < 20)
                display.root.position.y += offset;
              display.needsGrounding = false;
            }
          }
          this.avatar.flyingPet?.update(elapsed, this.camera,
            this.root.clientWidth, this.root.clientHeight);
          this.avatar.decorations.forEach(decoration => decoration.scene?.update(
            elapsed, this.camera, this.root.clientWidth, this.root.clientHeight));
        }
        this.sky.update(elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
        this.room.update(elapsed, this.camera, this.root.clientWidth, this.root.clientHeight);
        if (!this.floorMeasured && this.anchors) this.measureGround();
        // Native skins and their face/head attachments are evaluated by the
        // release's scene collection pass, before Three submits any meshes.
        e4(this.skyScene, this.camera);
        e4(this.scene, this.camera);
        this.renderer.clear(true, true, true);
        yo(this.renderer, () => this.renderer!.render(this.skyScene, this.camera));
        this.renderer.clearDepth();
        yo(this.renderer, () => this.renderer!.render(this.scene, this.camera));
      } catch (error) {
        this.setStatus(`原版小屋场景渲染失败：${error instanceof Error ? error.message : String(error)}`, true);
        return;
      }
      if (this.onFrame) this.onFrame(this.riderHeads());
    }
    this.startRendering();
  };

  /** The riders' head tops projected onto the canvas. */
  riderHeads(): MyRoomHead[] {
    const heads: MyRoomHead[] = [];
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    const add = (id: string, avatar: WalkingAvatar | undefined) => {
      if (!avatar || !avatar.scene.object.visible) return;
      const bounds = bodyBounds(avatar);
      if (bounds.isEmpty()) return;
      const top = new Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y,
        (bounds.min.z + bounds.max.z) / 2).project(this.camera);
      if (top.z < -1 || top.z > 1) return;
      heads.push({ id, x: (top.x + 1) / 2 * width, y: (1 - top.y) / 2 * height });
    };
    if (!this.showcase) add("", this.walkingAvatar);
    for (const remote of this.remotes.values()) add(remote.id, remote.walking);
    return heads;
  }

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
    const spawn = this.anchors.riders[this.localSlot] ?? this.anchors.rider;
    this.playerRoot.position.copy(spawn).setY(this.anchors.rider.y);
    this.characterGroundRoot.position.y = 0;
    this.playerRoot.rotation.y = 0;
    this.parkedKartRoot.position.copy(this.anchors.parking);
    // parking00 has a quarter-turn native basis; its front faces across the plaza.
    this.parkedKartRoot.rotation.y = Math.PI / 2;
    this.parkedKartRoot.scale.setScalar(this.environmentKartScale);
    if (!this.playerRoot.parent) this.scene.add(this.playerRoot);
    if (!this.parkedKartRoot.parent) this.scene.add(this.parkedKartRoot);
    this.placeDisplays();
    for (const entry of this.visitorKarts.values()) this.placeVisitorKart(entry);
    this.lastPoseMoving = true; // report the new spot
    this.reportPose(false, performance.now());
    if (this.showcase) {
      this.placeShowcase(this.showcase);
      return;
    }
    this.followingPlayer = true;
    this.pitch = Math.PI * 0.045;
    this.cameraTarget.copy(this.playerRoot.position).add(new Vector3(0, 1.8, 0));
    this.lastFrameTime = 0;
  }

  /** Stand the rider beside the kart and fix the camera on them. */
  private placeShowcase(pose: MyRoomShowcasePose): void {
    if (!this.anchors) return;
    const center = myRoomShowcaseCenter(this.anchors, pose.ahead);
    const scale = this.environmentKartScale;
    const kart = new Vector3(pose.kart.x * scale, pose.kart.y, pose.kart.z);
    const rider = center.clone().addScaledVector(kart, -0.5);
    this.playerRoot.position.copy(rider);
    this.playerRoot.rotation.y = pose.riderYaw;
    this.parkedKartRoot.position.copy(rider).add(kart);
    this.parkedKartRoot.rotation.y = pose.kartYaw;
    this.riderGroundY = this.floorMeasured ? this.floorBelow(this.playerRoot.position)
      : this.playerRoot.position.y;
    this.parkingGroundY = this.floorMeasured ? this.floorBelow(this.parkedKartRoot.position)
      : this.parkedKartRoot.position.y;
    this.followingPlayer = false;
    this.pitch = pose.pitch;
    this.zoom = 1;
    this.frame = { target: center.clone().add(pose.target),
      distance: pose.distance * (1 + (scale - 1) * 0.6) };
    this.avatarNeedsGrounding = Boolean(this.avatar);
    this.kartNeedsGrounding = Boolean(this.avatar);
  }

  /** Change the lobby pose in place, keeping the loaded room and models. */
  setShowcasePose(pose: MyRoomShowcasePose): void {
    if (!this.showcase) return;
    Object.assign(this.showcase, pose);
    this.characterGroundRoot.position.y = 0;
    this.parkedKartRoot.position.y = 0;
    this.placeShowcase(this.showcase);
  }

  /** Whether the room and the posed rider and kart have been drawn. */
  get ready(): boolean {
    return !!this.room && !!this.avatar && this.floorMeasured &&
      !this.avatarNeedsGrounding && !this.kartNeedsGrounding;
  }

  /**
   * The current view as a small 2D image. The scene is drawn again first so
   * the WebGL buffer still holds it when it is copied.
   */
  snapshot(maxWidth = 960): HTMLCanvasElement | undefined {
    if (this.disposed || !this.renderer || !this.room || !this.sky ||
        !this.canvas.width || !this.canvas.height) return undefined;
    try {
      this.renderer.clear(true, true, true);
      this.renderer.render(this.skyScene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
      const scale = Math.min(1, maxWidth / this.canvas.width);
      const image = document.createElement("canvas");
      image.width = Math.max(1, Math.round(this.canvas.width * scale));
      image.height = Math.max(1, Math.round(this.canvas.height * scale));
      image.getContext("2d")?.drawImage(this.canvas, 0, 0, image.width, image.height);
      return image;
    } catch {
      return undefined;
    }
  }

  /** The dummy can be above the paving; use the closest rendered floor below it. */
  private floorBelow(point: Vector3): number {
    if (!this.room) return point.y;
    const ray = new Raycaster();
    ray.set(point.clone().add(new Vector3(0, 30, 0)), new Vector3(0, -1, 0));
    const hit = ray.intersectObject(this.room.object, true).find(candidate =>
      candidate.point.y <= point.y + 1 && candidate.point.y >= point.y - 10);
    return hit?.point.y ?? point.y;
  }

  private measureGround(): void {
    if (!this.anchors || !this.room) return;
    const floor = (point: Vector3): number => this.floorBelow(point);
    if (this.showcase) {
      this.floorMeasured = true;
      this.placeShowcase(this.showcase);
      return;
    }
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
    for (const remote of this.remotes.values()) remote.needsGrounding = true;
    for (const entry of this.visitorKarts.values()) this.placeVisitorKart(entry);
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
      this.reportPose(true, performance.now());
    } else {
      this.walkingAvatar?.motion.submitMotion(3);
      this.playerRoot.position.y = this.anchors.rider.y;
      this.reportPose(false, performance.now());
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
    const parked = [this.anchors.parking, ...[...this.displays,
      ...[...this.visitorKarts.values()].flatMap(entry => entry.display ? [entry.display] : [])]
      .filter(display => display.root.visible).map(display => display.root.position)];
    if (parked.some(spot => Math.hypot(x - spot.x, z - spot.z) <=
        1.8 * this.environmentKartScale)) return false;
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
