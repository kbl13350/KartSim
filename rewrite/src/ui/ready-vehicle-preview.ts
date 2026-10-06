/** The Ready screen's small 3D vehicle preview and its frame ownership. */
export interface ReadyVehiclePreview {
  kart: { animation: { updateCurrentState(time: number): void } };
  flyingPet?: { update(time: number, camera: unknown, width: number, height: number): void };
  decorations: Array<{
    scene: { update(time: number, camera: unknown, width: number, height: number): void };
  }>;
  scene: unknown;
}

export interface ReadyVehiclePreviewHost<Preview extends ReadyVehiclePreview> {
  preview: Preview;
  stageBinding: { beginFrame(time: number): void };
  camera: unknown;
  renderer: { dispose(): void };
}

export interface ReadyVehiclePreviewLoadDependencies<Preview, Host> {
  createImporter(): unknown;
  loadPreview(
    library: unknown,
    environment: unknown,
    character: unknown,
    kart: unknown,
    stageBinding: unknown,
    importer: unknown,
    purpose: "ready",
    options: unknown,
  ): Promise<Preview>;
  createHost(preview: Preview, stageBinding: unknown): Host;
  releasePreview(preview: Preview): void;
}

/** A loaded preview belongs to the host; release it only if host creation fails. */
export async function loadReadyVehiclePreview<Preview, Host>(
  library: unknown,
  environment: unknown,
  character: unknown,
  kart: unknown,
  stageBinding: unknown,
  options: unknown,
  deps: ReadyVehiclePreviewLoadDependencies<Preview, Host>,
): Promise<Host> {
  let preview: Preview | undefined;
  try {
    preview = await deps.loadPreview(
      library, environment, character, kart, stageBinding,
      deps.createImporter(), "ready", options,
    );
    return deps.createHost(preview, stageBinding);
  } catch (error) {
    if (preview) deps.releasePreview(preview);
    throw error;
  }
}

export interface ReadyVehiclePreviewRenderDependencies<Preview extends ReadyVehiclePreview> {
  width: number;
  height: number;
  updateScene(preview: Preview, time: number, camera: unknown, width: number, height: number): void;
  composite(renderer: unknown, output: unknown, frame: unknown, paint: () => void): void;
  renderScene(renderer: unknown, scene: unknown, camera: unknown): void;
}

/** Update every preview attachment before drawing the frame to the Ready canvas. */
export function renderReadyVehiclePreview<Preview extends ReadyVehiclePreview>(
  host: ReadyVehiclePreviewHost<Preview>,
  output: unknown,
  frame: unknown,
  time: number,
  deps: ReadyVehiclePreviewRenderDependencies<Preview>,
): void {
  const { preview, camera, renderer } = host;
  host.stageBinding.beginFrame(time);
  preview.kart.animation.updateCurrentState(time);
  deps.updateScene(preview, time, camera, deps.width, deps.height);
  preview.flyingPet?.update(time, camera, deps.width, deps.height);
  preview.decorations.forEach(decoration => {
    decoration.scene.update(time, camera, deps.width, deps.height);
  });
  deps.composite(renderer, output, frame, () => {
    deps.renderScene(renderer, preview.scene, camera);
  });
}

export function disposeReadyVehiclePreview<Preview extends ReadyVehiclePreview>(
  host: ReadyVehiclePreviewHost<Preview>,
  releasePreview: (preview: Preview) => void,
): void {
  releasePreview(host.preview);
  host.renderer.dispose();
}
