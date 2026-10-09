/**
 * The cloud2 screen cover: item/cloud2/cloud2Effect.bml, the item stages'
 * fullscreen "cloud2Effect" host. Its three Play1SPanels (rainbow, ink and
 * fairy cloud, matching the three bases of cloud2/item.bml) play a
 * `*_화면가림.1s` model in front of the camera, through the same Play1S
 * pipeline as the tachometer (sX → Rw → Iw → ow).
 *
 * The cover models animate 3000 ms: their materials fade in by 500 ms and
 * out towards 3000 ms, while cloud2 covers for 10 s (Set life). The cover
 * therefore plays in, holds at ITEM_CLOUD_HOLD_MS while the state lasts, then
 * plays its own fade out [还原].
 */

import type { HudNode } from "./item-hud-assets";

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
}

/** Where the cover holds while cloud2 lasts: past the 500 ms fade in [还原]. */
export const ITEM_CLOUD_HOLD_MS = 1500;

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

type CoverPhase = { kind: "in"; variant: number; start: number }
  | { kind: "out"; variant: number; start: number; released: number };

export class ItemHudCloud {
  phase?: CoverPhase;
  private disposed = false;

  constructor(readonly root: HudNode, readonly tree: unknown,
    readonly bindings: CloudPlayBinding[], readonly runtimes: Map<unknown, CloudPlayRuntime>,
    readonly durations: number[], readonly renderer: CloudRenderer,
    readonly dependencies: ItemHudCloudDependencies) {}

  /** The variant on screen (fading in, holding or fading out). */
  get active(): number | undefined { return this.phase?.variant; }

  static async load(library: unknown, deps: ItemHudCloudDependencies,
    tick = 0): Promise<ItemHudCloud> {
    const source = deps.parseBml(await deps.findResource(library, [folder], "cloud2Effect",
      ".bml").bytes());
    const root = closedPanel(source, deps);
    const bindings = await deps.collectPlayPanels(root, async scene => {
      const file = deps.findResource(library, [folder], scene, ".1s");
      return { scene: deps.parseModel(await file.bytes()),
        canonicalPath: file.canonicalPath ?? file.virtualPath ?? `${folder}/${scene}.1s` };
    });
    if (bindings.length !== 3) throw new Error(`cloud2Effect 应有 3 个 Play1SPanel，实际 ${bindings.length}。`);
    const runtimes = new Map<unknown, CloudPlayRuntime>();
    let cloud: ItemHudCloud | undefined;
    const time = (tick: number) => cloud ? cloud.sceneTime(tick) : tick;
    try {
      for (const binding of bindings) {
        const camera = deps.createCamera();
        aimCloudCamera(camera, binding);
        runtimes.set(binding.node, deps.createPlayRuntime(binding,
          coverScene(await deps.loadPlayScene(binding, library), camera, time), tick));
      }
      cloud = new ItemHudCloud(root, deps.makeUi(root, new Map()), bindings, runtimes,
        bindings.map(binding => deps.controllerDuration(binding.scene)),
        deps.createRenderer(runtimes), deps);
      return cloud;
    } catch (error) {
      runtimes.forEach(runtime => runtime.dispose());
      throw error;
    }
  }

  /** The animation time the cover's scene sees for a HUD tick. */
  sceneTime(tick: number): number {
    const phase = this.phase;
    if (!phase) return tick;
    const hold = phase.start + Math.min(ITEM_CLOUD_HOLD_MS, this.durations[phase.variant] ?? 0);
    if (phase.kind === "in") return Math.min(tick, hold);
    return hold + Math.max(0, tick - phase.released);
  }

  /**
   * Shows variant `variant` while `cloud.opacity` > 0: it plays in and
   * holds; when the cloud ends (or another variant starts) it plays out.
   */
  update(cloud: { opacity: number; variant?: number } | undefined, tick: number): void {
    if (this.disposed) return;
    tick = Math.trunc(tick) >>> 0;
    const wanted = cloud && cloud.opacity > 0
      ? Math.min(this.bindings.length - 1, Math.max(0, Math.trunc(cloud.variant ?? 0)))
      : undefined;
    const phase = this.phase;
    if (wanted !== undefined && (!phase || phase.variant !== wanted || phase.kind === "out")) {
      if (phase) this.runtime(phase.variant).stop();
      this.runtime(wanted).play(this.durations[wanted] ?? 0, 0, tick);
      this.phase = { kind: "in", variant: wanted, start: tick };
    } else if (wanted === undefined && phase?.kind === "in") {
      this.phase = { ...phase, kind: "out", released: Math.max(tick, phase.start) };
    }
    const current = this.phase;
    if (current?.kind === "out" &&
        this.sceneTime(tick) - current.start >= (this.durations[current.variant] ?? 0)) {
      this.runtime(current.variant).stop();
      this.phase = undefined;
    }
    if (!this.phase) {
      this.renderer.update([], tick);
      return;
    }
    const shown = this.bindings[this.phase.variant]!.node;
    const commands = this.dependencies.finalizePlay(this.dependencies.materialize(
      this.dependencies.layoutUi(this.tree, 1600, 900, {
        visibility: node => node.name === "Play1SPanel" ? node === shown : undefined,
      }), new Map()), this.bindings);
    this.renderer.update(commands, tick);
  }

  render(renderer: unknown, width: number, height: number): void {
    if (!this.disposed && this.phase) this.renderer.render(renderer, width, height);
  }

  reset(): void {
    if (this.phase) this.runtime(this.phase.variant).stop();
    this.phase = undefined;
    this.renderer.update([], 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.dispose();
  }

  private runtime(variant: number): CloudPlayRuntime {
    const runtime = this.runtimes.get(this.bindings[variant]!.node);
    if (!runtime) throw new Error("cloud2Effect Play1S runtime 缺失。");
    return runtime;
  }
}
