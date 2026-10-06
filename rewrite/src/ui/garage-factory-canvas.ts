import type { FactoryPickerRect } from "./garage-factory-picker";

export interface GarageFactoryFrame {
  texture: string;
}

export interface GarageFactoryCatalogLayout {
  columns: number;
  cardWidth: number;
  cardHeight: number;
  gapX: number;
  gapY: number;
  rect: FactoryPickerRect;
}

export interface GarageFactoryCanvasHost {
  assets: {
    stage: { width: number; height: number };
    nodes: Map<string, unknown>;
    rects: Map<string, FactoryPickerRect>;
    images: Map<string, CanvasImageSource>;
    actionFrames?: Map<string, GarageFactoryFrame>;
  };
  actionFrameRedraws: Set<() => void>;
  installed: boolean;
  catalogLayout: GarageFactoryCatalogLayout;
}

export interface GarageFactoryCanvasDependencies {
  attribute(node: unknown, name: string): string | undefined;
  pixelRatio(): number;
  sizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    displayedWidth: number, displayedHeight: number, pixelRatio: number,
    authoredWidth: number, authoredHeight: number): void;
  drawFrame(context: CanvasRenderingContext2D, frame: GarageFactoryFrame,
    image: CanvasImageSource, rect: FactoryPickerRect): void;
}

export function resizeGarageFactoryCanvases(host: GarageFactoryCanvasHost): void {
  host.actionFrameRedraws.forEach(redraw => redraw());
}

/** Give the action button its authored four-state canvas frame and redraw hooks. */
export function styleGarageFactoryActionFrame(
  host: GarageFactoryCanvasHost,
  button: HTMLButtonElement,
  dependencies: GarageFactoryCanvasDependencies,
): void {
  const frames = host.assets.actionFrames;
  if (!frames?.size) return;
  const rect = host.assets.rects.get(button.dataset.factoryAction!)!;
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const label = document.createElement("span");
  label.textContent = button.textContent;
  label.style.position = "relative";
  Object.assign(canvas.style, {
    position: "absolute", left: "0", top: "0",
    width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: "none",
  });
  button.replaceChildren(canvas, label);
  button.style.background = "transparent";
  button.style.border = "0";

  const drawState = (requested: string) => {
    const frame = frames.get(button.disabled ? "Disabled" : requested) ?? frames.get("Normal");
    const image = frame && host.assets.images.get(frame.texture);
    const displayed = canvas.getBoundingClientRect();
    dependencies.sizeCanvas(canvas, context, displayed.width, displayed.height,
      dependencies.pixelRatio(), rect.width, rect.height);
    context.imageSmoothingEnabled = true;
    context.clearRect(0, 0, rect.width, rect.height);
    if (frame && image)
      dependencies.drawFrame(context, frame, image, { ...rect, x: 0, y: 0 });
  };
  button.onpointerenter = () => drawState("MouseOn");
  button.onpointerleave = () => drawState("Normal");
  button.onpointerdown = () => drawState("Clicked");
  button.onpointerup = () => drawState("MouseOn");
  host.actionFrameRedraws.add(() => drawState(
    button.matches(":active") ? "Clicked" : button.matches(":hover") ? "MouseOn" : "Normal"));
  drawState("Normal");
}

/** Draw the Factory background and the empty-workbench illustration. */
export function drawGarageFactoryBackground(
  host: GarageFactoryCanvasHost,
  context: CanvasRenderingContext2D,
  dependencies: GarageFactoryCanvasDependencies,
): void {
  const background = host.assets.images.get(`garage_img_floterBG_${host.assets.stage.width}`);
  if (background)
    context.drawImage(background, 0, 0, host.assets.stage.width, host.assets.stage.height);
  const emptyNode = host.assets.nodes.get("empty");
  const emptyRect = host.assets.rects.get("empty");
  const illustration = emptyNode ? host.assets.images.get(
    dependencies.attribute(emptyNode, "texture") ?? "") : undefined;
  if (!host.installed && illustration && emptyRect)
    context.drawImage(illustration, emptyRect.x, emptyRect.y, emptyRect.width, emptyRect.height);
}

/** Draw one catalog card from the selected or unselected native atlas half. */
export function drawGarageFactoryCatalogFrame(
  host: GarageFactoryCanvasHost,
  context: CanvasRenderingContext2D,
  index: number,
  selected: boolean,
  hover = false,
): void {
  const layout = host.catalogLayout;
  const image = host.assets.images.get(
    selected ? "img_floter_slotBoxSelected" : "img_floter_slotBox");
  if (!image) return;
  context.drawImage(image,
    selected || hover ? 0 : layout.cardWidth, 0,
    layout.cardWidth, layout.cardHeight,
    layout.rect.x + index % layout.columns * (layout.cardWidth + layout.gapX),
    layout.rect.y + Math.floor(index / layout.columns) * (layout.cardHeight + layout.gapY),
    layout.cardWidth, layout.cardHeight);
}
