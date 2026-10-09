import type { ItemCubeDescriptor, ItemCubeSource, ItemVec3 } from "./item-cube-source";
import { clientToThree } from "./item-cube-source";

/**
 * Item cubes (道具箱) for one item race. All cubes of a track share one
 * assembled scene: each cube is a synthetic wrapper node (position and runtime
 * spin) over a copy of the theme's itemCube.1s node tree, so the model is
 * decoded once, its geometry sits in one pooled buffer, its materials and
 * textures are shared, and one scene update animates every cube. Pickup state
 * is per player (other racers' pickups never hide your cubes): stay -> eaten
 * for Eaten.life (hidden, fired01 effect on the kart, eaten sound) -> stay.
 */

export interface CubeSceneObject {
  visible: boolean;
  name: string;
  position: { copy(position: ItemVec3): unknown };
  add(...objects: CubeSceneObject[]): unknown;
  removeFromParent(): unknown;
}

/** The part of an assembled scene (`c5`) the field drives. */
export interface CubeRenderedScene {
  object: CubeSceneObject;
  rootObjects: CubeSceneObject[];
  setNodeScale(node: object, scale: number[]): void;
  reset(nowMs: number): void;
  playControllers?(nowMs: number, elapsedMs: number): void;
  update(nowMs: number, camera?: unknown, width?: number, height?: number): void;
  dispose(): void;
}

export interface CubeAudioSource {
  buffer: unknown;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}

export interface CubeAudioContext {
  createBufferSource(): CubeAudioSource;
}

/** A decoded `.1s` model (`y9` result). */
export interface CubeModelData {
  root: CubeModelNode;
  settings?: unknown;
}

export interface CubeModelNode {
  kind: string;
  name: string;
  children: CubeModelNode[];
  transform: number[][];
  position: number[];
  scale: number[];
  slots: unknown[];
  slotOccurrences: unknown[];
  [field: string]: unknown;
}

/** Texture source the eaten effect needs: fired01's textures live in item/common. */
export const ITEM_COMMON_TEXTURE_SOURCE = {
  kind: "item-common", id: "item:common", canonicalPrefix: "item/common", mountPath: "item",
} as const;

export interface ItemCubeFieldOps<Archive> {
  createObject(): CubeSceneObject;
  originalAsset(archive: Archive, path: string): { bytes(): Promise<unknown> };
  decodeModel(bytes: unknown): CubeModelData;
  decodeAudio(context: CubeAudioContext, bytes: unknown): Promise<unknown> | unknown;
  loadModel(
    data: CubeModelData,
    archive: Archive,
    path: string,
    identity: { id: string },
    options: {
      additionalRoots?: object[];
      advertisementSources?: readonly object[];
      environment: unknown;
      stageBinding: unknown;
      advanceEnvironment: false;
      textureCache: Map<unknown, { dispose(): void }>;
    },
  ): Promise<CubeRenderedScene>;
  routeAudio(context: CubeAudioContext, source: CubeAudioSource, group: "fx"): void;
}

/** What the race coordinator offers (`NormalRaceCoordinator`). */
export interface ItemPairWorld {
  queueKartPairObject(object: ItemPairObject): void;
  isKartPeer(candidate: unknown): boolean;
}

/** A category-2 object of the normal coordinator (GoItem* in the release). */
export interface ItemPairObject {
  name: string;
  category: number;
  active: boolean;
  removeRequested: boolean;
  slot12(nowMs: number): void;
  slot13(peer: unknown, nowMs: number): void;
  commit(): void;
  destroy(): void;
}

/** Client world matrix of a track scene node (`renderScene.clientWorldElements`). */
export type ItemWorldMatrix = (node: object) => ArrayLike<number> | undefined;

export interface ItemCubeField {
  /** One group for the track scene: all cubes plus the eaten effects. */
  readonly object: CubeSceneObject;
  readonly count: number;
  readonly cubes: readonly ItemCubeDescriptor[];
  attach(world: ItemPairWorld, kartPosition: () => ItemVec3, canCollect: () => boolean,
    onPickup: (cubeId: number) => void): void;
  /**
   * Call once per rendered frame after the track scene update (moving cubes
   * read its matrices). Pass the race camera and viewport like the LTE coins:
   * billboard skins (fengshen_dev) and the eaten effect need the camera.
   */
  update(nowMs: number, camera?: unknown, width?: number, height?: number): void;
  /** Current three.js position of a cube, following moving cubes. */
  position(cubeId: number): ItemVec3 | undefined;
  /** Whether this player's copy of the cube can be eaten now. */
  available(cubeId: number): boolean;
  dispose(): void;
}

/** One turn every 4000 ms, the LTE coin spin. */
export function cubeSpin(nowMs: number): number {
  const now = nowMs >>> 0;
  return Math.fround(Math.fround(Math.fround(now % 4000) * Math.fround(0.00050000002)) * Math.fround(3.141592));
}

type CubeState = "stay" | "pending" | "eaten";

interface CubeEntry {
  descriptor: ItemCubeDescriptor;
  /** three.js position used for pickup; moving cubes refresh it every update. */
  position: ItemVec3;
  state: CubeState;
  eatenAt: number;
  wrapper?: CubeModelNode;
  view?: CubeSceneObject;
}

interface EffectSlot {
  root: CubeSceneObject;
  scene: CubeRenderedScene;
  startedAt: number;
  active: boolean;
}

/** Number of eaten effects that can play at once (two cubes of one row, then the next row). */
export const CUBE_EFFECT_POOL = 3;

const IDENTITY = (): number[][] => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const ONE = [1, 1, 1];

/** A scene-node copy with fresh identity and no controllers (a plain Relement). */
function syntheticNode(template: CubeModelNode, name: string, position: number[],
  children: CubeModelNode[]): CubeModelNode {
  return {
    ...template,
    name,
    transform: IDENTITY(),
    position: [...position],
    scale: [...ONE],
    slots: Array.from({ length: template.slots.length }),
    slotOccurrences: Array.from({ length: template.slotOccurrences.length }),
    childOccurrences: [],
    nodeEnabled: 1,
    children,
  };
}

/** Deep copy of the node tree; geometry and controller data stay shared. */
function cloneTree(node: CubeModelNode): CubeModelNode {
  return { ...node, children: node.children.map(cloneTree) };
}

/** A model root that is a plain identity Relement adds nothing under a wrapper. */
function plainRoot(root: CubeModelNode): boolean {
  const identity = IDENTITY();
  return root.className === "Relement" && root.nodeEnabled !== 0 &&
    root.transform.every((row, index) => row.every((value, column) => value === identity[index]![column])) &&
    root.position.every(value => value === 0) && root.scale.every(value => value === 1) &&
    root.slotOccurrences.every(slot => !slot);
}

/**
 * One wrapper per cube at the cube's client position; its basis carries the
 * spin. The wrapper replaces a plain model root, so a cube costs only the
 * model's own nodes plus one.
 */
export function buildCubeRoots(model: CubeModelData, cubes: readonly ItemCubeDescriptor[]): {
  root: CubeModelNode;
  wrappers: CubeModelNode[];
} {
  if (model.root.kind !== "node") throw Error("道具箱模型必须是独立 Relement。");
  const root = syntheticNode(model.root, "itemCubes", [0, 0, 0], []);
  const fold = plainRoot(model.root);
  const wrappers = cubes.map(cube => syntheticNode(model.root, `itemCube#${cube.id}`,
    [...cube.clientPosition], fold ? model.root.children.map(cloneTree) : [cloneTree(model.root)]));
  return { root, wrappers };
}

class CubeField<Archive> implements ItemCubeField {
  readonly object: CubeSceneObject;
  readonly cubes: readonly ItemCubeDescriptor[];
  readonly entries: CubeEntry[];
  readonly byId = new Map<number, CubeEntry>();
  scene?: CubeRenderedScene;
  effects: EffectSlot[] = [];
  textures = new Map<unknown, { dispose(): void }>();
  sources = new Set<CubeAudioSource>();
  audio: unknown;
  kartPosition?: () => ItemVec3;
  attached = false;
  disposed = false;
  spinBasis = IDENTITY();

  constructor(
    readonly source: ItemCubeSource,
    readonly context: CubeAudioContext | undefined,
    readonly worldMatrix: ItemWorldMatrix | undefined,
    readonly ops: ItemCubeFieldOps<Archive>,
  ) {
    this.object = ops.createObject();
    this.object.name = "itemCubes";
    this.cubes = source.cubes;
    this.entries = source.cubes.map(descriptor => ({
      descriptor, position: { ...descriptor.position }, state: "stay" as CubeState, eatenAt: 0,
    }));
    for (const entry of this.entries) this.byId.set(entry.descriptor.id, entry);
  }

  get count(): number { return this.entries.length; }

  async load(archive: Archive, environment: unknown, stageBinding: unknown): Promise<void> {
    if (this.entries.length === 0) return;
    const { ops, source } = this;
    const [model, eaten, audio] = await Promise.all([
      ops.originalAsset(archive, source.modelPath).bytes().then(ops.decodeModel),
      ops.originalAsset(archive, source.eatenModelPath).bytes().then(ops.decodeModel),
      this.context
        ? ops.originalAsset(archive, source.eatenSoundPath).bytes()
          .then(bytes => ops.decodeAudio(this.context!, bytes))
        : undefined,
    ]);
    this.audio = audio;
    const options = { environment, stageBinding, advanceEnvironment: false as const,
      textureCache: this.textures };
    const { root, wrappers } = buildCubeRoots(model, source.cubes);
    const scene = await ops.loadModel({ root, settings: model.settings }, archive, source.modelPath,
      { id: "itemCube" }, { ...options, additionalRoots: wrappers });
    this.scene = scene;
    this.object.add(scene.object);
    // Roots are assembled in order: the synthetic root, then every wrapper.
    if (scene.rootObjects.length !== wrappers.length + 1)
      throw Error("道具箱场景根节点数量不一致。");
    this.entries.forEach((entry, index) => {
      entry.wrapper = wrappers[index];
      entry.view = scene.rootObjects[index + 1];
      if (entry.view?.name !== wrappers[index]!.name) throw Error("道具箱场景根节点顺序不一致。");
    });
    // Like the track scene, the cube skins' own controllers (fairy book, ice
    // twinkle) run from a reset clock; only the eaten effect is played per pickup.
    scene.reset(0);
    for (let index = 0; index < CUBE_EFFECT_POOL; index++) {
      const effect = await ops.loadModel(eaten, archive, source.eatenModelPath, { id: "itemCube" },
        { ...options, advertisementSources: [ITEM_COMMON_TEXTURE_SOURCE] });
      const effectRoot = ops.createObject();
      effectRoot.name = `itemCubeEaten#${index}`;
      effectRoot.visible = false;
      effectRoot.add(effect.object);
      this.object.add(effectRoot);
      this.effects.push({ root: effectRoot, scene: effect, startedAt: 0, active: false });
    }
  }

  attach(world: ItemPairWorld, kartPosition: () => ItemVec3, canCollect: () => boolean,
    onPickup: (cubeId: number) => void): void {
    if (this.disposed || this.attached) throw Error("道具箱已释放或重复绑定。");
    this.attached = true;
    this.kartPosition = kartPosition;
    if (this.entries.length === 0) return;
    const radius = this.source.radius;
    const lifeMs = this.source.eatenLifeMs;
    const contact: ItemPairObject = {
      name: "GoItemCube[]",
      category: 2,
      active: true,
      removeRequested: false,
      slot12: nowMs => {
        if (this.disposed) return;
        const now = nowMs >>> 0;
        const eaten: number[] = [];
        for (const entry of this.entries) {
          if (entry.state === "pending") {
            entry.state = "eaten";
            entry.eatenAt = now;
            if (entry.view) entry.view.visible = false;
            eaten.push(entry.descriptor.id);
          } else if (entry.state === "eaten" && ((now - entry.eatenAt) >>> 0) >= lifeMs) {
            entry.state = "stay";
            if (entry.view) entry.view.visible = true;
          }
        }
        if (eaten.length === 0) return;
        // Cubes eaten in one frame share one effect and one sound on the kart.
        this.startEffect(now);
        this.play();
        for (const id of eaten) onPickup(id);
      },
      slot13: peer => {
        if (this.disposed || !world.isKartPeer(peer) || !canCollect()) return;
        const kart = kartPosition();
        for (const entry of this.entries) {
          if (entry.state !== "stay") continue;
          const dx = Math.fround(kart.x - entry.position.x);
          const dy = Math.fround(kart.y - entry.position.y);
          const dz = Math.fround(kart.z - entry.position.z);
          const distance = Math.fround(Math.sqrt(Math.fround(
            Math.fround(Math.fround(dx * dx) + Math.fround(dy * dy)) + Math.fround(dz * dz))));
          if (Number.isFinite(distance) && distance <= radius) entry.state = "pending";
        }
      },
      commit: () => {},
      destroy: () => { contact.active = false; },
    };
    world.queueKartPairObject(contact);
  }

  startEffect(now: number): void {
    if (this.effects.length === 0) return;
    // Reuse a free slot, else restart the oldest one.
    const age = (effect: EffectSlot) => (now - effect.startedAt) >>> 0;
    const slot = this.effects.find(effect => !effect.active) ??
      this.effects.reduce((oldest, effect) => age(effect) > age(oldest) ? effect : oldest);
    slot.active = true;
    slot.startedAt = now;
    slot.root.visible = true;
    if (this.kartPosition) slot.root.position.copy(this.kartPosition());
    slot.scene.reset(now);
    slot.scene.playControllers?.(now, 0);
  }

  play(): void {
    if (!this.context || this.audio === undefined) return;
    const source = this.context.createBufferSource();
    source.buffer = this.audio;
    this.ops.routeAudio(this.context, source, "fx");
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    source.start();
  }

  update(nowMs: number, camera?: unknown, width?: number, height?: number): void {
    if (this.disposed || !this.scene) return;
    const now = nowMs >>> 0;
    const angle = cubeSpin(now);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const basis = this.spinBasis;
    basis[0]![0] = cos; basis[0]![1] = -sin;
    basis[1]![0] = sin; basis[1]![1] = cos;
    for (const entry of this.entries) {
      const wrapper = entry.wrapper;
      if (!wrapper) continue;
      let changed = false;
      const { anchor } = entry.descriptor;
      if (anchor && this.worldMatrix) {
        const matrix = this.worldMatrix(anchor);
        const client = matrix ? [matrix[12]!, matrix[13]!, matrix[14]!] : undefined;
        if (client?.every(Number.isFinite)) {
          wrapper.position = client;
          entry.position = clientToThree(client);
          changed = true;
        }
      }
      // Hidden (eaten) cubes keep their last pose until they return.
      if (entry.state === "stay") {
        wrapper.transform = basis;
        changed = true;
      }
      // `setNodeScale` re-serializes the wrapper's basis and position.
      if (changed) this.scene.setNodeScale(wrapper, ONE);
    }
    this.scene.update(now, camera, width, height);
    for (const effect of this.effects) {
      if (!effect.active) continue;
      // Signed age: a render clock a little behind the simulation keeps the effect.
      if (((now - effect.startedAt) | 0) >= this.source.eatenLifeMs) {
        effect.active = false;
        effect.root.visible = false;
        continue;
      }
      if (this.kartPosition) effect.root.position.copy(this.kartPosition());
      effect.scene.update(now, camera, width, height);
    }
  }

  position(cubeId: number): ItemVec3 | undefined {
    const entry = this.byId.get(cubeId);
    return entry ? { ...entry.position } : undefined;
  }

  available(cubeId: number): boolean {
    return this.byId.get(cubeId)?.state === "stay";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* An already stopped source is safe to release. */ }
      source.disconnect();
    }
    this.sources.clear();
    this.scene?.dispose();
    for (const effect of this.effects) effect.scene.dispose();
    this.effects.length = 0;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}

/**
 * Load the cube field of a track. `worldMatrix` reads the track scene's
 * client world matrices (moving cubes follow their anchors); `context` may be
 * omitted to load silently.
 */
export async function loadItemCubeField<Archive>(
  archive: Archive,
  source: ItemCubeSource,
  environment: unknown,
  stageBinding: unknown,
  context: CubeAudioContext | undefined,
  worldMatrix: ItemWorldMatrix | undefined,
  ops: ItemCubeFieldOps<Archive>,
): Promise<ItemCubeField> {
  const field = new CubeField(source, context, worldMatrix, ops);
  try {
    await field.load(archive, environment, stageBinding);
    return field;
  } catch (error) {
    field.dispose();
    throw error;
  }
}
