/** The original five-model Giant Boost HUD and its authored panel layer. */

import { GiantBoostGaugeState, findGiantModelNode, frameGiantModelCamera,
  giantControllerDuration, giantHudViewport, type GiantModelNode } from
  "./giant-boost-hud-model";

export interface GiantHudModel {
  parsed: { root: GiantModelNode };
  scene: {
    object: { removeFromParent(): void };
    dispose(): void;
    update(tick: number): void;
    playControllers?(tick: number, channel: number): void;
    setControllerCycleMode?(mode: number): void;
    setNodeScale?(node: GiantModelNode, scale: number[]): void;
    clientWorldElements?(node: GiantModelNode): ArrayLike<number> | undefined;
  };
}

export interface GiantHudPanel {
  kind: string;
  node: unknown;
  framebufferRect: { left: number; right: number; top: number; bottom: number };
  texture?: unknown;
  [field: string]: unknown;
}

export interface GiantBoostHudDependencies {
  createRenderer(): {
    enableUiSmoothing(): void;
    update(panels: GiantHudPanel[], time: number): void;
    render(renderer: any, width: number, height: number): void;
    dispose(): void;
  };
  createCamera(): any;
  createWorld(): { add(object: unknown): void; clear(): void };
  createViewport(): any;
  applyCamera(camera: unknown, view: number[], projection: number[]): void;
  attribute(node: unknown, name: string): string | undefined;
  loadModel(library: unknown, path: string, textures: Map<string, any>,
    options: Record<string, unknown>, original: boolean): Promise<GiantHudModel>;
  findResource(library: unknown, path: string): { bytes(): Promise<Uint8Array> };
  parseBml(bytes: Uint8Array): any;
  decodeTexture(bytes: Uint8Array): Promise<any>;
  makeUi(definition: unknown, images: Map<string, any>): unknown;
  layoutUi(ui: unknown, width: number, height: number,
    options: { visibility(): boolean }): unknown;
  panels(ui: unknown, images: Map<string, any>): GiantHudPanel[];
}

const modelNames = [
  "거인게이지에니01", "거인게이지에니02", "거인용부스터_회색",
  "거인용부스터_차지", "거인용부스터_풀",
];

function authoredWindowNode(node: any, attribute: GiantBoostHudDependencies["attribute"]): any {
  if (attribute(node, "frame") !== undefined)
    throw new Error("巨人窗口含未核准 frame inset。");
  return {
    ...node,
    attributes: node.attributes.map((entry: { name: string }) =>
      entry.name === "clientRect" ? { ...entry, name: "windowRect" } : entry),
    children: node.children.map((child: unknown) => authoredWindowNode(child, attribute)),
  };
}

export class GiantBoostHud {
  readonly models: GiantHudModel[];
  readonly textures: Map<string, { dispose(): void }>;
  readonly panels: GiantHudPanel[];
  readonly state: GiantBoostGaugeState;
  readonly renderer: ReturnType<GiantBoostHudDependencies["createRenderer"]>;
  readonly camera: any;
  readonly world: ReturnType<GiantBoostHudDependencies["createWorld"]>;
  readonly viewport: any;
  readonly boostDuration: number;
  readonly chargeNode: GiantModelNode;
  disposed = false;
  boostFull = false;
  boostRequested = false;

  constructor(models: GiantHudModel[], textures: Map<string, { dispose(): void }>,
    panels: GiantHudPanel[], readonly dependencies: GiantBoostHudDependencies) {
    this.camera = Object.assign(dependencies.createCamera(),
      { matrixWorldAutoUpdate: false });
    this.world = dependencies.createWorld();
    this.viewport = dependencies.createViewport();
    this.models = models;
    this.textures = textures;
    this.panels = panels;
    this.state = new GiantBoostGaugeState(giantControllerDuration(models[0]!.parsed));
    models[1]!.scene.setControllerCycleMode?.(0);
    this.boostDuration = giantControllerDuration(models[4]!.parsed);
    const root = models[3]!.parsed.root;
    const chargeNode = root.kind === "node"
      ? findGiantModelNode(root, "부스터 게이지01") : undefined;
    if (!chargeNode || this.boostDuration !== 1000 ||
        !models[3]!.scene.setNodeScale)
      throw new Error("巨人原集气模型 consumer 未闭合。");
    this.chargeNode = chargeNode;
    this.renderer = dependencies.createRenderer();
    this.renderer.enableUiSmoothing();
  }

  static async load<Hud extends GiantBoostHud>(library: unknown,
    dependencies: GiantBoostHudDependencies,
    create: (models: GiantHudModel[], textures: Map<string, { dispose(): void }>,
      panels: GiantHudPanel[]) => Hud): Promise<Hud> {
    const textures = new Map<string, { dispose(): void }>();
    const models: GiantHudModel[] = [];
    let hud: Hud | undefined;
    try {
      for (const name of modelNames) models.push(await dependencies.loadModel(
        library, `stage_/common/action/${name}.1s`, textures, {}, true));
      const path = "gui_/windowTemplate/giantBoost.bml";
      const definition = dependencies.parseBml(
        await dependencies.findResource(library, path).bytes());
      const images = new Map<string, any>();
      const loadImages = async (node: any): Promise<void> => {
        const texture = dependencies.attribute(node, "texture");
        if (texture && !images.has(texture)) {
          const localized = texture.replace(/@zz$/, "@cn");
          images.set(texture, await dependencies.decodeTexture(
            await dependencies.findResource(library,
              `gui_/windowTemplate/${localized}.png`).bytes()));
        }
        for (const child of node.children) await loadImages(child);
      };
      await loadImages(definition);
      const ui = dependencies.makeUi(
        authoredWindowNode(definition, dependencies.attribute), images);
      const layout = dependencies.layoutUi(ui, 800, 600,
        { visibility: () => true });
      const panels = dependencies.panels(layout, images);
      if (panels.some(panel => panel.kind !== "panel" || !("texture" in panel)))
        throw new Error("巨人 HUD 原窗口含未知绘制节点。");
      hud = create(models, textures, panels);
      for (const model of models) {
        model.scene.update(0);
        frameGiantModelCamera(model, hud.camera, dependencies.applyCamera);
      }
      return hud;
    } catch (error) {
      if (hud) hud.dispose();
      else {
        for (const model of models) model.scene.dispose();
        for (const texture of textures.values()) texture.dispose();
      }
      throw error;
    }
  }

  stage(cells: number, tick: number): void {
    tick = Math.trunc(tick) >>> 0;
    if (!this.disposed && this.state.stage(cells, tick))
      this.models[0]!.scene.playControllers?.(tick, 0);
  }

  update(tick: number): void {
    if (this.disposed) return;
    tick = Math.trunc(tick) >>> 0;
    this.state.update(tick);
    this.models[this.state.full ? 1 : this.state.zero ? 0 : 2]!.scene.update(tick);
  }

  updateBoost(tick: number, full: boolean, charge: number): void {
    if (this.disposed) return;
    tick = Math.trunc(tick) >>> 0;
    if (this.boostRequested || (full && !this.boostFull))
      this.models[4]!.scene.playControllers?.(tick, 0);
    this.boostRequested = false;
    this.boostFull = full;
    if (!full) {
      const scale = this.chargeNode.scale as number[];
      this.models[3]!.scene.setNodeScale!(this.chargeNode, [
        Math.fround(scale[0]! * Math.fround(2 * charge)), scale[1]!, scale[2]!,
      ]);
    }
    this.models[full ? 4 : 3]!.scene.update(tick);
  }

  requestBoostFull(): void { this.boostRequested = true; }

  drawModel(renderer: any, model: GiantHudModel, width: number, height: number): void {
    const viewport = giantHudViewport(width, height);
    frameGiantModelCamera(model, this.camera,
      this.dependencies.applyCamera, viewport.width, viewport.height);
    this.world.add(model.scene.object);
    renderer.getViewport(this.viewport);
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      renderer.setViewport(viewport.left,
        height - viewport.top - viewport.height,
        viewport.width, viewport.height);
      renderer.render(this.world, this.camera);
      renderer.clearDepth();
    } finally {
      model.scene.object.removeFromParent();
      renderer.setViewport(this.viewport);
      renderer.autoClear = oldAutoClear;
    }
  }

  renderBefore(renderer: any, width: number, height: number,
    skipInactive: boolean): void {
    if (this.disposed) return;
    if (this.state.full || this.state.zero)
      this.drawModel(renderer, this.models[this.state.full ? 1 : 0]!, width, height);
    else if (!skipInactive) this.drawModel(renderer, this.models[2]!, width, height);
  }

  renderPanels(renderer: any, width: number, height: number): void {
    if (this.disposed) return;
    const viewport = giantHudViewport(width, height);
    const scale = viewport.scale;
    this.renderer.update(this.panels.filter(panel => {
      const name = this.dependencies.attribute(panel.node, "name") ?? "";
      const step = /^step([1-6])$/.exec(name);
      return !step || Number(step[1]) <= this.state.cells;
    }).map(panel => ({
      ...panel,
      framebufferRect: {
        left: viewport.left + panel.framebufferRect.left * scale,
        right: viewport.left + panel.framebufferRect.right * scale,
        top: viewport.top + panel.framebufferRect.top * scale,
        bottom: viewport.top + panel.framebufferRect.bottom * scale,
      },
    })), 0);
    this.renderer.render(renderer, width, height);
  }

  renderAfter(renderer: any, width: number, height: number,
    skipInactive: boolean): void {
    if (!this.disposed && this.state.full && !skipInactive)
      this.drawModel(renderer, this.models[2]!, width, height);
  }

  renderBoost(renderer: any, width: number, height: number): void {
    if (!this.disposed)
      this.drawModel(renderer, this.models[this.boostFull ? 4 : 3]!, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state.reset();
    this.renderer.dispose();
    for (const model of this.models) model.scene.dispose();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
    this.world.clear();
  }
}
