/**
 * The cloud2 screen cover: item/cloud2/cloud2Effect.bml, the item stages'
 * fullscreen "cloud2Effect" host. Its three Play1SPanels (rainbow, ink and
 * fairy cloud, matching the three bases of cloud2/item.bml) play a
 * `*_화면가림.1s` model in front of the camera, through the same Play1S
 * pipeline as the tachometer (sX → Rw → Iw → ow).
 */

import type { HudNode } from "./item-hud-assets";

export interface CloudPlayBinding {
  node: HudNode;
  name: string;
  scene: unknown;
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

export interface ItemHudCloudDependencies {
  attribute(node: HudNode, name: string): string | undefined;
  parseBml(bytes: Uint8Array): HudNode;
  findResource(library: unknown, roots: readonly string[], name: string,
    extension?: string): { bytes(): Promise<Uint8Array>; canonicalPath?: string; virtualPath?: string };
  parseModel(bytes: Uint8Array): unknown;
  /** Release sX: Play1SPanel bindings with their parsed scenes. */
  collectPlayPanels(root: HudNode, load: (scene: string) =>
    Promise<{ scene: unknown; canonicalPath: string }>): Promise<CloudPlayBinding[]>;
  /** Release Rw: the scene of a binding, textures from its container. */
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

export class ItemHudCloud {
  active?: number;
  private disposed = false;

  constructor(readonly root: HudNode, readonly tree: unknown,
    readonly bindings: CloudPlayBinding[], readonly runtimes: Map<unknown, CloudPlayRuntime>,
    readonly durations: number[], readonly renderer: CloudRenderer,
    readonly dependencies: ItemHudCloudDependencies) {}

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
    try {
      for (const binding of bindings) {
        runtimes.set(binding.node, deps.createPlayRuntime(binding,
          await deps.loadPlayScene(binding, library), tick));
      }
      const renderer = deps.createRenderer(runtimes);
      return new ItemHudCloud(root, deps.makeUi(root, new Map()), bindings, runtimes,
        bindings.map(binding => deps.controllerDuration(binding.scene)), renderer, deps);
    } catch (error) {
      runtimes.forEach(runtime => runtime.dispose());
      throw error;
    }
  }

  /** Shows variant `variant` while `cloud.opacity` > 0; restarts it when it begins. */
  update(cloud: { opacity: number; variant?: number } | undefined, tick: number): void {
    if (this.disposed) return;
    tick = Math.trunc(tick) >>> 0;
    const variant = cloud && cloud.opacity > 0
      ? Math.min(this.bindings.length - 1, Math.max(0, Math.trunc(cloud.variant ?? 0)))
      : undefined;
    if (variant !== this.active) {
      if (this.active !== undefined) this.runtime(this.active).stop();
      if (variant !== undefined)
        this.runtime(variant).play(this.durations[variant] ?? 0, 0, tick);
      this.active = variant;
    }
    if (variant === undefined) {
      this.renderer.update([], tick);
      return;
    }
    const shown = this.bindings[variant]!.node;
    const commands = this.dependencies.layoutUi(this.tree, 1600, 900, {
      visibility: node => node.name === "Play1SPanel" ? node === shown : undefined,
    });
    this.renderer.update(this.dependencies.finalizePlay(
      this.dependencies.materialize(commands, new Map()), this.bindings), tick);
  }

  render(renderer: unknown, width: number, height: number): void {
    if (!this.disposed && this.active !== undefined) this.renderer.render(renderer, width, height);
  }

  reset(): void {
    if (this.active !== undefined) this.runtime(this.active).stop();
    this.active = undefined;
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
