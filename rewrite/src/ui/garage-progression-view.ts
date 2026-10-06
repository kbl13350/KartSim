import type { GarageProgressionRect } from "./garage-progression-panel";

export interface GarageProgressionViewAssets {
  stage: { width: number; height: number };
  nodes: Map<string, unknown>;
  rects: Map<string, GarageProgressionRect>;
  images: Map<string, CanvasImageSource>;
  windowFrames?: Map<string, { texture: string }>;
}

export interface GarageProgressionViewHost {
  assets: GarageProgressionViewAssets;
  onChange: (progression: unknown) => void;
  onSelectSkill: (index: number) => void;
  onExceedTypeChange: () => void;
  element: HTMLElement;
  classicContainer: HTMLElement;
  engine12Container: HTMLElement;
  activeContainer: HTMLElement;
  framedControls: Map<string, HTMLButtonElement>;
  radar?: unknown;
  rect(name: string): GarageProgressionRect;
}

export interface GarageProgressionDrawDependencies {
  attribute(node: unknown, name: string): string | undefined;
  drawFrame(context: CanvasRenderingContext2D, frame: { texture: string },
    image: CanvasImageSource, rect: GarageProgressionRect): void;
  drawRadar(context: CanvasRenderingContext2D, rect: GarageProgressionRect, radar: unknown): void;
}

/** Connect the two authored layouts and callbacks after the view's DOM fields are created. */
export function initializeGarageProgressionView(
  host: GarageProgressionViewHost,
  assets: GarageProgressionViewAssets,
  onChange: GarageProgressionViewHost["onChange"],
  onSelectSkill: GarageProgressionViewHost["onSelectSkill"],
  onExceedTypeChange: GarageProgressionViewHost["onExceedTypeChange"] = () => {},
): void {
  host.assets = assets;
  host.onChange = onChange;
  host.onSelectSkill = onSelectSkill;
  host.onExceedTypeChange = onExceedTypeChange;
  host.element.className = "garage-progression";
  host.classicContainer.className = "garage-upgrade-layout";
  host.classicContainer.dataset.upgradeLayout = "classic";
  host.engine12Container.className = "garage-upgrade-layout";
  host.engine12Container.dataset.upgradeLayout = "engine12Data";
  host.engine12Container.hidden = true;
  host.element.append(host.classicContainer, host.engine12Container);
  host.activeContainer = host.classicContainer;
}

export function garageProgressionPreviewRect(
  host: GarageProgressionViewHost,
): GarageProgressionRect | undefined {
  return host.assets.rects.get("kartPreview");
}

/** Paint the authored panel backgrounds, native button frames and classic radar. */
export function drawGarageProgressionView(
  host: GarageProgressionViewHost,
  context: CanvasRenderingContext2D,
  engineGrade: number,
  dependencies: GarageProgressionDrawDependencies,
): void {
  const xun = engineGrade === 9;
  const backgroundNodes = xun
    ? ["backGround", "tuningPanel"]
    : ["backGround", "tuning_enhance", "back_img"];
  for (const name of backgroundNodes) {
    const node = host.assets.nodes.get(name);
    if (!node) continue;
    const image = host.assets.images.get(dependencies.attribute(node, "image") ?? "");
    const rect = host.rect(name);
    if (image) context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }

  if (!xun) {
    for (const [name, control] of host.framedControls) {
      const node = host.assets.nodes.get(name);
      const frameName = node ? dependencies.attribute(node, "frame") : undefined;
      if (!frameName) continue;
      const matches = control.matches;
      const state = control.disabled ? "Disabled" :
        matches?.call(control, ":active") ? "Clicked" :
        matches?.call(control, ":hover") ? "MouseOn" : "Normal";
      const frame = host.assets.windowFrames?.get(`${frameName}/${state}`) ??
        host.assets.windowFrames?.get(`${frameName}/Normal`);
      const image = frame && host.assets.images.get(frame.texture);
      if (frame && image) dependencies.drawFrame(context, frame, image, host.rect(name));
    }
    if (host.radar) dependencies.drawRadar(context, host.rect("resultGraph"), host.radar);
  }
}
