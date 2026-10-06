/** RP box and sparkle scenes plus the kart preview shown inside their panels. */

interface SceneNode { name: string; children: SceneNode[] }
interface ResourceEntry { bytes(): Promise<Uint8Array> }
interface ResourceLibrary { get(path: string): ResourceEntry | undefined }
interface Box { x: number; y: number; width: number; height: number }
interface DrawContext { drawImage(image: unknown, x: number, y: number,
  width: number, height: number): void }

interface Camera {
  matrixAutoUpdate: boolean;
  matrixWorldAutoUpdate: boolean;
  position: { set(x: number, y: number, z: number): void };
  lookAt(x: number, y: number, z: number): void;
  near: number;
  far: number;
  aspect: number;
  fov: number;
  updateProjectionMatrix(): void;
}

interface Renderer {
  domElement: unknown;
  outputColorSpace: unknown;
  setClearColor(color: number, alpha: number): void;
  setPixelRatio(ratio: number): void;
  getSize(size: { x: number; y: number }): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  clear(color: boolean, depth: boolean, stencil: boolean): void;
  render(object: unknown, camera: Camera): void;
  dispose(): void;
  forceContextLoss(): void;
}

interface AnimationScene {
  object: unknown;
  playControllers?(at: number, blend: number): void;
  stopControllers?(at: number): void;
  update(nowMs: number, camera: Camera, width: number, height: number): void;
  dispose(): void;
}

interface KartPreview { scene: unknown }
interface FrameBinding { beginFrame(nowMs: number): void; dispose(): void }
interface KartEnvironment { dispose(): void }

export interface RpScenePreviewDependencies {
  createCamera(): Camera;
  createSize(): { x: number; y: number };
  createBinding(): FrameBinding;
  sceneName(node: SceneNode): string | undefined;
  validateCamera(node: SceneNode, width: number, height: number): void;
  parseScene(bytes: Uint8Array): unknown;
  loadScene(parsed: unknown, library: ResourceLibrary, path: string,
    reference: (path: string) => unknown,
    options: { convertClientCoordinates: boolean }): Promise<AnimationScene>;
  resolveReference(library: ResourceLibrary, path: string,
    reference: string): unknown;
  loadKartEnvironment(library: ResourceLibrary): Promise<KartEnvironment>;
  loadKart(library: ResourceLibrary, kartItem: unknown,
    environment: KartEnvironment, binding: FrameBinding): Promise<KartPreview>;
  createRenderer(options: { alpha: boolean; antialias: boolean;
    preserveDrawingBuffer: boolean }): Renderer;
  outputColorSpace: unknown;
  kartFieldOfView(angle: number, aspect: number): number;
  prepareKart(kart: KartPreview, nowMs: number, camera: Camera,
    width: number, height: number): void;
  renderKart(renderer: Renderer, scene: unknown, camera: Camera): void;
  configureSceneCamera(camera: Camera, node: SceneNode,
    width: number, height: number): void;
  disposeKart(kart: KartPreview): void;
}

export class RpScenePreview {
  renderer?: Renderer;
  readonly camera: Camera;
  readonly scenes = new Map<SceneNode, AnimationScene>();
  readonly size: { x: number; y: number };
  kart?: KartPreview;
  kartEnvironment?: KartEnvironment;
  readonly kartBinding: FrameBinding;
  readonly kartCamera: Camera;
  disposed = false;

  constructor(readonly dependencies: RpScenePreviewDependencies) {
    this.camera = dependencies.createCamera();
    this.size = dependencies.createSize();
    this.kartBinding = dependencies.createBinding();
    this.kartCamera = dependencies.createCamera();
    this.camera.matrixAutoUpdate = false;
    this.camera.matrixWorldAutoUpdate = false;
  }

  static async load<T extends RpScenePreview>(
    this: new (dependencies: RpScenePreviewDependencies) => T,
    library: ResourceLibrary, definition: SceneNode, kartItem: unknown,
    dependencies: RpScenePreviewDependencies): Promise<T> {
    const preview = new this(dependencies);
    try {
      const panels: SceneNode[] = [];
      const visit = (node: SceneNode): void => {
        if (node.name === "Play1SPanel") panels.push(node);
        node.children.forEach(visit);
      };
      visit(definition);
      if (panels.length !== 2) throw new Error("RP 原开箱/闪光场景不完整。");
      for (const panel of panels) {
        const sceneName = dependencies.sceneName(panel);
        if (!["복불복상자(선물펑)", "반짝반짝눈이부셔"].includes(sceneName ?? "")) {
          throw new Error("RP 场景身份不匹配。");
        }
        dependencies.validateCamera(panel, 1, 1);
        const path = `dialog/bokbulbok/${sceneName}.1s`;
        const source = library.get(path);
        if (!source) throw new Error(`RP 原动画缺失：${path}`);
        const scene = await dependencies.loadScene(
          dependencies.parseScene(await source.bytes()), library, path,
          reference => dependencies.resolveReference(library, path, reference),
          { convertClientCoordinates: false },
        );
        preview.scenes.set(panel, scene);
        if (!scene.playControllers || !scene.stopControllers) {
          throw new Error("RP 场景控制器生命周期缺失。");
        }
        scene.stopControllers(1);
      }
      preview.kartEnvironment = await dependencies.loadKartEnvironment(library);
      preview.kart = await dependencies.loadKart(library, kartItem,
        preview.kartEnvironment, preview.kartBinding);
      preview.renderer = dependencies.createRenderer({
        alpha: true, antialias: false, preserveDrawingBuffer: true,
      });
      preview.renderer.setClearColor(0, 0);
      preview.renderer.setPixelRatio(1);
      preview.renderer.outputColorSpace = dependencies.outputColorSpace;
      return preview;
    } catch (error) {
      preview.dispose();
      throw error;
    }
  }

  paintKart(canvas: DrawContext, rect: Box, nowMs: number): void {
    const kart = this.kart;
    const renderer = this.renderer;
    if (this.disposed || !kart || !renderer) {
      throw new Error("RP 车辆预览 owner 缺失。");
    }
    const width = Math.max(1, Math.trunc(rect.width));
    const height = Math.max(1, Math.trunc(rect.height));
    const camera = this.kartCamera;
    camera.position.set(Math.fround(-3.6), 2.25, 5);
    camera.lookAt(0, Math.fround(0.3), 0);
    camera.near = 1;
    camera.far = 100;
    camera.aspect = width / height;
    camera.fov = this.dependencies.kartFieldOfView(
      75 / Math.fround(1.4), camera.aspect);
    camera.updateProjectionMatrix();
    renderer.getSize(this.size);
    if (this.size.x !== width || this.size.y !== height) {
      renderer.setSize(width, height, false);
    }
    renderer.clear(true, true, true);
    this.kartBinding.beginFrame(nowMs >>> 0);
    this.dependencies.prepareKart(kart, nowMs >>> 0, camera, width, height);
    this.dependencies.renderKart(renderer, kart.scene, camera);
    canvas.drawImage(renderer.domElement, rect.x, rect.y,
      rect.width, rect.height);
  }

  play(panel: SceneNode, nowMs: number): void {
    if (this.disposed) throw new Error("RP 动画已释放。");
    const scene = this.scenes.get(panel);
    if (!scene) throw new Error("RP 动画节点未装配。");
    scene.playControllers!(nowMs >>> 0, 0);
  }

  paint(panel: SceneNode, canvas: DrawContext, rect: Box,
    nowMs: number): void {
    const scene = this.scenes.get(panel);
    const renderer = this.renderer;
    if (this.disposed || !scene || !renderer) {
      throw new Error("RP 动画绘制 owner 缺失。");
    }
    const width = Math.max(1, Math.trunc(rect.width));
    const height = Math.max(1, Math.trunc(rect.height));
    this.dependencies.configureSceneCamera(this.camera, panel, width, height);
    renderer.getSize(this.size);
    if (this.size.x !== width || this.size.y !== height) {
      renderer.setSize(width, height, false);
    }
    renderer.clear(true, true, true);
    scene.update(nowMs >>> 0, this.camera, width, height);
    renderer.render(scene.object, this.camera);
    canvas.drawImage(renderer.domElement, rect.x, rect.y,
      rect.width, rect.height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scenes.forEach(scene => scene.dispose());
    this.scenes.clear();
    if (this.kart) this.dependencies.disposeKart(this.kart);
    this.kart = undefined;
    this.kartBinding.dispose();
    this.kartEnvironment?.dispose();
    this.kartEnvironment = undefined;
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined;
  }
}
