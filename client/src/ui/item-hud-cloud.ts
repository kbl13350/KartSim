/**
 * The item race screen covers, through the same Play1S pipeline as the
 * tachometer (sX → Rw → Iw → ow):
 *
 * - cloud2: item/cloud2/cloud2Effect.bml, the item stages' fullscreen
 *   "cloud2Effect" host. Its three Play1SPanels (rainbow, ink and fairy
 *   cloud, matching the three bases of cloud2/item.bml) play a
 *   `*_화면가림.1s` model in front of the camera. The dark clouds (1, 115)
 *   cover with cloud2Effect_1 (ITEM_MODE.md C.4).
 * - the special items' own screen models, which no item.bml names but each
 *   item ships (research-13 "Screen overlays"): the tiger, dino claw and
 *   lion claws (`Tiger_Nail_Att_1600`), the panther (`black_leopard_1600`),
 *   the delivery tape (`택배테이프`), the honey (`벌꿀`) and the oil
 *   (`oilEffect`). They carry their own camera (a ReCamera at the origin
 *   looking along +y, projection mode 1, 161° with near 31 / far 306), which
 *   the original draws as an orthographic view `tan(fov/2)·323.221` wide —
 *   the projection the Giant Boost HUD reproduces for its models
 *   (giant-boost-hud-model.ts) — here with the stage's 16:9 aspect.
 *
 * Every cover plays in, holds while its state lasts, then plays its own fade
 * out [还原]: the cloud models animate 3000 ms (materials fade in by 500 ms
 * and out towards 3000 ms) and hold at ITEM_CLOUD_HOLD_MS; the item models
 * hold half way. A cover's strength below 1 (the goggles' `trans`, C.2)
 * holds that far into its fade in instead.
 */

import type { HudNode } from "./item-hud-assets";
import type { ItemHudOverlay, ItemHudOverlayKind } from "./item-hud-state";
import { findGiantModelCamera, type GiantModelNode } from "./giant-boost-hud-model";

export interface CloudPlayBinding {
  node: HudNode;
  name: string;
  scene: unknown;
  defaultCameraPosition?: number[];
  defaultSpotPosition?: number[];
  fieldOfViewDegrees?: number;
  nearPlane?: number;
  farPlane?: number;
  geometry?: { width: number; height: number };
  [field: string]: unknown;
}

export interface CloudPlayRuntime {
  play(durationMs: number, sourceTickMs: number, nowTick: number): void;
  stop(): void;
  update(tick: number): void;
  dispose(): void;
}

export interface CloudRenderer {
  enableUiSmoothing?(): void;
  update(commands: unknown[], time: number): void;
  render(renderer: unknown, width: number, height: number): void;
  dispose(): void;
}

/** The parts of a three.js PerspectiveCamera the cover sets. */
export interface CloudCamera {
  position: { set(x: number, y: number, z: number): unknown };
  up: { set(x: number, y: number, z: number): unknown };
  lookAt(x: number, y: number, z: number): void;
  fov: number;
  aspect: number;
  near: number;
  far: number;
  updateProjectionMatrix(): void;
  updateMatrixWorld(force?: boolean): void;
}

export interface ItemHudCloudDependencies {
  attribute(node: HudNode, name: string): string | undefined;
  parseBml(bytes: Uint8Array): HudNode;
  findResource(library: unknown, roots: readonly string[], name: string,
    extension?: string): { bytes(): Promise<Uint8Array>; canonicalPath?: string; virtualPath?: string };
  parseModel(bytes: Uint8Array): unknown;
  /** Release sX: Play1SPanel bindings with their parsed scenes. */
  collectPlayPanels(root: HudNode, load: (scene: string) =>
    Promise<{ scene: unknown; canonicalPath: string }>): Promise<CloudPlayBinding[]>;
  /**
   * Release Rw: the scene of a binding, textures from its container, kept in
   * client coordinates (convertClientCoordinates: false) like the tachometer's
   * Play1S scenes: the Play1S view is a client-space view.
   */
  loadPlayScene(binding: CloudPlayBinding, library: unknown): Promise<unknown>;
  /** Release Iw. */
  createPlayRuntime(binding: CloudPlayBinding, scene: unknown, tick: number): CloudPlayRuntime;
  createRenderer(runtimes: Map<unknown, CloudPlayRuntime>): CloudRenderer;
  makeUi(root: HudNode, textures: Map<string, unknown>): unknown;
  layoutUi(tree: unknown, width: number, height: number,
    options: { visibility(node: HudNode): boolean | undefined }): unknown[];
  materialize(commands: unknown[], textures: Map<string, unknown>): unknown[];
  /** Release ow: view, projection and viewport of the play-1s-panel commands. */
  finalizePlay(commands: unknown[], bindings: CloudPlayBinding[]): unknown[];
  /** The longest controller of a parsed model, ms. */
  controllerDuration(scene: unknown): number;
  /** A three.js PerspectiveCamera (the scene's culling requires one). */
  createCamera(): CloudCamera;
  warn?(message: string): void;
}

/**
 * Where the cloud cover holds while it lasts: inside the opaque part of the
 * 3000 ms play (opaque from 300–400 ms to 2666 ms); the rest plays out after,
 * so a window of ITEM_RULES.cloudCoverWindowMs shows the original 3 s cover.
 */
export const ITEM_CLOUD_HOLD_MS = 1500;
/**
 * How long the cloud cover pieces take to fade in: their alpha controllers
 * rise linearly from 0 to 1 over 300, 366 or 400 ms (무지개구름_화면가림).
 * A goggles' strength s holds the play at s × this, about alpha s.
 */
export const ITEM_CLOUD_FADE_IN_MS = 350;

/** The special items' screen models (item folder and `.1s` stem), by HUD overlay kind. */
export const ITEM_HUD_OVERLAY_MODELS: Readonly<Record<Exclude<ItemHudOverlayKind, "darkCloud">,
  { folder: string; scene: string }>> = Object.freeze({
  tiger: { folder: "item/tigerRocket", scene: "Tiger_Nail_Att_1600" },
  panther: { folder: "item/pantherRocket", scene: "black_leopard_1600" },
  delivery: { folder: "item/deliveryRocket", scene: "택배테이프" },
  dinoClaw: { folder: "item/dinoClawRocket", scene: "Tiger_Nail_Att_1600" },
  lion: { folder: "item/lionMaskRocket", scene: "Tiger_Nail_Att_1600" },
  honey: { folder: "item/honeyBee", scene: "벌꿀" },
  oil: { folder: "item/oil", scene: "oilEffect" },
});

/** The dark clouds cover with the ink cloud (cloud2Effect_1). */
const DARK_CLOUD_VARIANT = 1;
const CLOUD_VARIANTS = 3;
/** The original's projection-mode-1 width per unit tan(fov/2) (giant-boost-hud-model.ts). */
const MODEL_CAMERA_EXTENT = Math.fround(323.22100830078125);

interface PlayScene { update(time: number, camera?: unknown): void }

/**
 * The scene update the cover needs. Iw updates scenes without a camera,
 * which the tachometer scenes never need; the cover models hold billboards
 * (ReBillboard) that face the camera. The Play1S view (release nX) is a
 * left-handed D3D view the scene's hierarchy culling cannot use, so the
 * scene sees an ordinary perspective camera at the same place and looking
 * the same way, while the overlay renderer still draws with the release
 * matrices. The scene time also comes from the cover's hold/release clock.
 */
function coverScene(scene: unknown, camera: unknown, time: (tick: number) => number): unknown {
  return new Proxy(scene as PlayScene, {
    get(target, key) {
      if (key === "update") return (tick: number) => target.update(time(tick), camera);
      return Reflect.get(target, key, target);
    },
  });
}

/** Points a camera like the panel's defaultCameraPos / defaultSpotPos (client z up). */
export function aimCloudCamera(camera: CloudCamera, binding: CloudPlayBinding): void {
  const [x, y, z] = binding.defaultCameraPosition ?? [0, -70, 0];
  const [sx, sy, sz] = binding.defaultSpotPosition ?? [0, 0, 0];
  const width = binding.geometry?.width ?? 1600;
  const height = binding.geometry?.height ?? 900;
  // The release projection's 75° is horizontal (iX scales x by 1/tan 37.5°).
  const horizontal = (binding.fieldOfViewDegrees ?? 75) * Math.PI / 180;
  camera.fov = 2 * Math.atan(Math.tan(horizontal / 2) * height / width) * 180 / Math.PI;
  camera.aspect = width / height;
  camera.near = binding.nearPlane ?? 1;
  camera.far = binding.farPlane ?? 1000;
  camera.updateProjectionMatrix();
  camera.position.set(x!, y!, z!);
  camera.up.set(0, 0, 1);
  camera.lookAt(sx!, sy!, sz!);
  camera.updateMatrixWorld(true);
}

/**
 * The culling camera of an item cover model: at its own camera (the origin),
 * looking along +y, wide enough to hold the whole orthographic view.
 */
function aimModelCamera(camera: CloudCamera, world: ArrayLike<number>): void {
  camera.fov = 170;
  camera.aspect = 16 / 9;
  camera.near = 0.1;
  camera.far = 2000;
  camera.updateProjectionMatrix();
  camera.position.set(world[12]!, world[13]!, world[14]!);
  camera.up.set(0, 0, 1);
  camera.lookAt(world[12]!, world[13]! + 1, world[14]!);
  camera.updateMatrixWorld(true);
}

export interface ModelCameraConfig {
  projectionMode: number;
  fieldOfViewDegrees: number;
  nearClip: number;
  farClip: number;
}

/**
 * View (3×4) and projection (4×4, row-major) of an item cover model's own
 * camera: at its world position, looking along +y with z up (the authored
 * Camera01, and the Play1S view convention of nX: view x = x, view y = z,
 * depth = y), projected orthographically like projection mode 1 of the Giant
 * Boost HUD (`tan(fov/2)·323.221` wide) with the stage's aspect.
 */
export function modelCameraMatrices(world: ArrayLike<number>, config: ModelCameraConfig,
  aspect: number): { view: number[]; projection: number[] } {
  const single = Math.fround;
  const [x, y, z] = [world[12] ?? 0, world[13] ?? 0, world[14] ?? 0];
  const view = [1, 0, 0, single(-x), 0, 0, 1, single(-z), 0, 1, 0, single(-y)];
  const radians = single(config.fieldOfViewDegrees * single(0.008726639673113823));
  const horizontal = single(Math.tan(radians) * MODEL_CAMERA_EXTENT);
  const vertical = single(horizontal * single(aspect));
  const near = config.nearClip;
  const far = config.farClip;
  const projection = [
    single(2 / horizontal), 0, 0, 0,
    0, single(2 / vertical), 0, 0,
    0, 0, single(1 / (far - near)), single(near / (near - far)),
    0, 0, 0, 1,
  ];
  return { view, projection };
}

const folder = "item/cloud2";

/**
 * The authored panels lack `visible` (the release Play1S binding requires it)
 * and use windowRect="fullscreen" (its geometry needs a size): give both,
 * on the 1600×900 stage.
 */
function closedPanel(node: HudNode, deps: ItemHudCloudDependencies): HudNode {
  const attributes = node.attributes.map(entry =>
    entry.name === "windowRect" && entry.value === "fullscreen"
      ? { name: "windowRect", value: "0 0 1600 900" } : entry);
  if (node.name === "Play1SPanel" && deps.attribute(node, "visible") === undefined)
    attributes.push({ name: "visible", value: "false" });
  return { ...node, attributes, children: node.children.map(child => closedPanel(child, deps)) };
}

/**
 * A Play1SPanel for an item's own screen model. The pipeline's view and
 * projection are replaced by the model's camera at draw time; the authored
 * values only satisfy the release binding.
 */
function overlayPanel(kind: string): HudNode {
  return { name: "Play1SPanel", attributes: Object.entries({
    name: `itemOverlay_${kind}`, scene: kind, windowRect: "0 0 1600 900",
    defaultCameraPos: "0.0 -70.0 0.0", defaultSpotPos: "0.0 0.0 0.0", zoom: "1.0",
    stop: "true", clearZBefore: "true", clearZAfter: "true", enable: "false", visible: "false",
  }).map(([name, value]) => ({ name, value })), children: [] };
}

type CoverPhase = { kind: "in"; start: number; strength: number }
  | { kind: "out"; start: number; strength: number; released: number };

interface CoverEntry {
  /** Hold point after the start at full strength, and how long the model fades in. */
  holdMs: number;
  fadeInMs: number;
  /** The item model's own camera (overlays); undefined for the cloud panels. */
  camera?: { view: number[]; projection: number[] };
}

export class ItemHudCloud {
  readonly phases = new Map<number, CoverPhase>();
  private disposed = false;

  constructor(readonly root: HudNode, readonly tree: unknown,
    readonly bindings: CloudPlayBinding[], readonly runtimes: Map<unknown, CloudPlayRuntime>,
    readonly durations: number[], readonly renderer: CloudRenderer,
    readonly dependencies: ItemHudCloudDependencies,
    readonly entries: CoverEntry[] = bindings.map((_binding, index) => ({
      holdMs: ITEM_CLOUD_HOLD_MS, fadeInMs: Math.min(ITEM_CLOUD_FADE_IN_MS, durations[index] ?? 0) })),
    /** Binding index of each loaded item overlay. */
    readonly overlays: ReadonlyMap<string, number> = new Map()) {}

  /** The first cover on screen (fading in, holding or fading out). */
  get active(): number | undefined {
    return this.phases.size ? Math.min(...this.phases.keys()) : undefined;
  }

  static async load(library: unknown, deps: ItemHudCloudDependencies,
    tick = 0, overlays: boolean = true): Promise<ItemHudCloud> {
    const source = deps.parseBml(await deps.findResource(library, [folder], "cloud2Effect",
      ".bml").bytes());
    const cloudRoot = closedPanel(source, deps);
    const loadScene = (roots: string[]) => async (scene: string) => {
      const file = deps.findResource(library, roots, scene, ".1s");
      return { scene: deps.parseModel(await file.bytes()),
        canonicalPath: file.canonicalPath ?? file.virtualPath ?? `${roots[0]}/${scene}.1s` };
    };
    const bindings = await deps.collectPlayPanels(cloudRoot, loadScene([folder]));
    if (bindings.length !== CLOUD_VARIANTS)
      throw new Error(`cloud2Effect 应有 3 个 Play1SPanel，实际 ${bindings.length}。`);
    const overlayIndex = new Map<string, number>();
    const panels: HudNode[] = [];
    /** Assembled scenes and own cameras of the item models that loaded. */
    const loaded = new Map<number, { scene: unknown; world: ArrayLike<number>;
      camera: { view: number[]; projection: number[] } }>();
    const message = (error: unknown) => error instanceof Error ? error.message : String(error);
    if (overlays) {
      // Each item model is optional: one that does not assemble only loses its own cover.
      for (const [kind, model] of Object.entries(ITEM_HUD_OVERLAY_MODELS)) {
        const panel = overlayPanel(kind);
        try {
          const [binding] = await deps.collectPlayPanels(panel, async () =>
            loadScene([model.folder])(model.scene));
          if (!binding) continue;
          const scene = await deps.loadPlayScene(binding, library);
          const world = modelCameraWorld(binding, scene);
          const config = findGiantModelCamera((binding.scene as { root: GiantModelNode }).root)?.camera;
          // Without its own camera the model would draw through the cloud's view: leave it out.
          if (!world || !config || config.projectionMode !== 1) throw new Error("缺少原相机");
          loaded.set(bindings.length, { scene, world,
            camera: modelCameraMatrices(world, config, 900 / 1600) });
          overlayIndex.set(kind, bindings.length);
          bindings.push(binding);
          panels.push(panel);
        } catch (error) {
          deps.warn?.(`道具遮挡 ${kind}（${model.folder}/${model.scene}）未载入：${message(error)}`);
        }
      }
    }
    const root: HudNode = { ...cloudRoot, children: [...cloudRoot.children, ...panels] };
    const runtimes = new Map<unknown, CloudPlayRuntime>();
    const durations = bindings.map(binding => deps.controllerDuration(binding.scene));
    const entries: CoverEntry[] = bindings.map((_binding, index) => index < CLOUD_VARIANTS
      ? { holdMs: ITEM_CLOUD_HOLD_MS, fadeInMs: Math.min(ITEM_CLOUD_FADE_IN_MS, durations[index]!) }
      : { holdMs: Math.floor(durations[index]! / 2), fadeInMs: Math.floor(durations[index]! / 2),
        camera: loaded.get(index)!.camera });
    let cloud: ItemHudCloud | undefined;
    try {
      for (const [index, binding] of bindings.entries()) {
        const camera = deps.createCamera();
        const overlay = loaded.get(index);
        const scene = overlay ? overlay.scene : await deps.loadPlayScene(binding, library);
        if (overlay) aimModelCamera(camera, overlay.world);
        else aimCloudCamera(camera, binding);
        const time = (now: number) => cloud ? cloud.sceneTime(index, now) : now;
        runtimes.set(binding.node, deps.createPlayRuntime(binding, coverScene(scene, camera, time), tick));
      }
      cloud = new ItemHudCloud(root, deps.makeUi(root, new Map()), bindings, runtimes, durations,
        deps.createRenderer(runtimes), deps, entries, overlayIndex);
      return cloud;
    } catch (error) {
      runtimes.forEach(runtime => runtime.dispose());
      throw error;
    }
  }

  /** The animation time a cover's scene sees for a HUD tick. */
  sceneTime(index: number, tick: number): number {
    const phase = this.phases.get(index);
    if (!phase) return tick;
    const hold = phase.start + this.holdPoint(index, phase.strength);
    if (phase.kind === "in") return Math.min(tick, hold);
    return hold + Math.max(0, tick - phase.released);
  }

  /** How far into its animation a cover holds at this strength. */
  holdPoint(index: number, strength: number): number {
    const entry = this.entries[index];
    const duration = this.durations[index] ?? 0;
    if (!entry) return Math.min(ITEM_CLOUD_HOLD_MS, duration);
    if (strength >= 1) return Math.min(entry.holdMs, duration);
    return Math.max(0, Math.round(entry.fadeInMs * strength));
  }

  /**
   * Shows the cloud variant while `cloud.opacity` > 0 and the overlay until
   * its `untilMs`: each plays in and holds; when it ends it plays out. A new
   * cloud variant replaces the one on screen at once.
   */
  update(cloud: { opacity: number; variant?: number } | undefined, tick: number,
    overlay?: ItemHudOverlay): void {
    if (this.disposed) return;
    tick = Math.trunc(tick) >>> 0;
    const wanted = new Map<number, number>();
    const want = (index: number | undefined, strength: number) => {
      if (index === undefined || !(strength > 0)) return;
      wanted.set(index, Math.max(wanted.get(index) ?? 0, Math.min(1, strength)));
    };
    if (cloud) want(Math.min(CLOUD_VARIANTS - 1, Math.max(0, Math.trunc(cloud.variant ?? 0))), cloud.opacity);
    if (overlay && tick < overlay.untilMs)
      want(overlay.kind === "darkCloud" ? DARK_CLOUD_VARIANT : this.overlays.get(overlay.kind), overlay.opacity);
    const wantedCloud = [...wanted.keys()].some(index => index < CLOUD_VARIANTS);
    for (const [index, phase] of [...this.phases]) {
      const strength = wanted.get(index);
      if (strength !== undefined) {
        if (phase.kind === "in") phase.strength = strength;
        continue;
      }
      if (index < CLOUD_VARIANTS && wantedCloud) {
        // Another cloud variant takes the screen at once.
        this.runtime(index).stop();
        this.phases.delete(index);
      } else if (phase.kind === "in") {
        this.phases.set(index, { ...phase, kind: "out", released: Math.max(tick, phase.start) });
      }
    }
    for (const [index, strength] of wanted) {
      const phase = this.phases.get(index);
      if (phase?.kind === "in") continue;
      if (phase) this.runtime(index).stop();
      this.runtime(index).play(this.durations[index] ?? 0, 0, tick);
      this.phases.set(index, { kind: "in", start: tick, strength });
    }
    for (const [index, phase] of [...this.phases]) {
      if (phase.kind === "out" &&
          this.sceneTime(index, tick) - phase.start >= (this.durations[index] ?? 0)) {
        this.runtime(index).stop();
        this.phases.delete(index);
      }
    }
    if (!this.phases.size) {
      this.renderer.update([], tick);
      return;
    }
    const shown = new Set([...this.phases.keys()].map(index => this.bindings[index]!.node));
    const commands = this.dependencies.finalizePlay(this.dependencies.materialize(
      this.dependencies.layoutUi(this.tree, 1600, 900, {
        visibility: node => node.name === "Play1SPanel" ? shown.has(node) : undefined,
      }), new Map()), this.bindings).map(command => this.withCamera(command));
    this.renderer.update(commands, tick);
  }

  /** An item model's command draws with the model's own camera. */
  private withCamera(command: unknown): unknown {
    const play = command as { kind?: string; binding?: CloudPlayBinding };
    if (play.kind !== "play-1s-panel" || !play.binding) return command;
    const index = this.bindings.indexOf(play.binding);
    const camera = index >= 0 ? this.entries[index]?.camera : undefined;
    return camera ? { ...play, view: camera.view, projection: camera.projection } : command;
  }

  render(renderer: unknown, width: number, height: number): void {
    if (!this.disposed && this.phases.size) this.renderer.render(renderer, width, height);
  }

  reset(): void {
    for (const index of this.phases.keys()) this.runtime(index).stop();
    this.phases.clear();
    this.renderer.update([], 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.dispose();
  }

  private runtime(index: number): CloudPlayRuntime {
    const runtime = this.runtimes.get(this.bindings[index]!.node);
    if (!runtime) throw new Error("cloud2Effect Play1S runtime 缺失。");
    return runtime;
  }
}

/** The client world matrix of an item model's camera, after its first update. */
function modelCameraWorld(binding: CloudPlayBinding, scene: unknown): ArrayLike<number> | undefined {
  const root = (binding.scene as { root?: GiantModelNode } | undefined)?.root;
  const node = root ? findGiantModelCamera(root) : undefined;
  const assembled = scene as { update?(time: number): void;
    clientWorldElements?(node: GiantModelNode): ArrayLike<number> | undefined };
  if (!node || !assembled.clientWorldElements) return undefined;
  assembled.update?.(0);
  return assembled.clientWorldElements(node);
}
