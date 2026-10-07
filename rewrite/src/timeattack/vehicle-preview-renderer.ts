export interface PreviewRenderer {
  outputColorSpace: unknown;
  domElement: CanvasImageSource;
  setClearColor(color: number, alpha: number): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  setDrawingBufferSize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

export interface PreviewSubject {
  kartItem: unknown;
  characterItem: unknown;
  profile: unknown;
}

export interface PreviewScene {
  kart: { animation: { updateCurrentState(timeMs: number): void } };
  flyingPet?: { update(timeMs: number, camera: unknown,
    width: number, height: number): void };
  decorations: Array<{ scene: { update(timeMs: number, camera: unknown,
    width: number, height: number): void } }>;
  scene: unknown;
}

export interface PreviewSubjectOptions {
  library: unknown;
  environment: unknown;
  stageBinding: { beginFrame(timeMs: number): void };
  subject: PreviewSubject;
}

export interface VehiclePreviewDependencies {
  createRenderer(): PreviewRenderer;
  outputColorSpace: unknown;
  createCamera(width: number, height: number): unknown;
  createImportToken(): unknown;
  loadSubject(library: unknown, kartItem: unknown, characterItem: unknown,
    environment: unknown, binding: unknown, token: unknown, mode: "preview",
    profile: unknown): Promise<PreviewScene>;
  disposeSubject(preview: PreviewScene): void;
  updateSubject(preview: PreviewScene, timeMs: number, camera: unknown,
    width: number, height: number): void;
  renderScene(renderer: PreviewRenderer, scene: unknown, camera: unknown): void;
}

/** Owns the offscreen renderer and the current vehicle/character preview. */
export class VehiclePreviewRenderer {
  readonly renderer: PreviewRenderer;
  readonly camera: unknown;
  pixelRatio = 1;
  generation = 0;
  loaded?: {
    preview: PreviewScene;
    stageBinding: PreviewSubjectOptions["stageBinding"];
  };
  lastError?: string;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly dependencies: VehiclePreviewDependencies,
  ) {
    this.renderer = dependencies.createRenderer();
    this.renderer.outputColorSpace = dependencies.outputColorSpace;
    this.renderer.setClearColor(0, 0);
    this.renderer.setSize(width, height, false);
    this.camera = dependencies.createCamera(width, height);
  }

  get ready(): boolean {
    return this.loaded !== undefined;
  }

  setPixelRatio(pixelRatio: number): void {
    if (Math.abs(this.pixelRatio - pixelRatio) < 0.001) return;
    this.pixelRatio = pixelRatio;
    this.renderer.setDrawingBufferSize(this.width, this.height, pixelRatio);
  }

  async setSubject(options: PreviewSubjectOptions): Promise<void> {
    const generation = ++this.generation;
    const { library, environment, stageBinding, subject } = options;
    let preview: PreviewScene | undefined;
    try {
      preview = await this.dependencies.loadSubject(
        library, subject.kartItem, subject.characterItem, environment,
        stageBinding, this.dependencies.createImportToken(), "preview",
        subject.profile,
      );
      if (generation !== this.generation) {
        this.dependencies.disposeSubject(preview);
        return;
      }
      const previous = this.loaded;
      this.loaded = { preview, stageBinding };
      this.lastError = undefined;
      if (previous) this.dependencies.disposeSubject(previous.preview);
    } catch (error) {
      if (preview) this.dependencies.disposeSubject(preview);
      if (generation === this.generation)
        this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  render(
    context: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    timeMs: number,
  ): void {
    const loaded = this.loaded;
    if (!loaded) return;
    const { preview, stageBinding } = loaded;
    stageBinding.beginFrame(timeMs);
    preview.kart.animation.updateCurrentState(timeMs);
    this.dependencies.updateSubject(preview, timeMs, this.camera,
      this.width, this.height);
    preview.flyingPet?.update(timeMs, this.camera, this.width, this.height);
    for (const decoration of preview.decorations)
      decoration.scene.update(timeMs, this.camera, this.width, this.height);
    this.dependencies.renderScene(this.renderer, preview.scene, this.camera);
    context.drawImage(this.renderer.domElement,
      rect.x, rect.y, rect.width, rect.height);
  }

  dispose(): void {
    this.generation += 1;
    if (this.loaded) this.dependencies.disposeSubject(this.loaded.preview);
    this.loaded = undefined;
    this.renderer.dispose();
  }
}
