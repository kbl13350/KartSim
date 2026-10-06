import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GaragePreviewInputHost {
  assets: {
    nodes: Map<string, { children?: Array<{ name: string }> }>;
    strings: Map<string, string>;
    stage: { width: number; height: number };
  };
  surface: HTMLElement;
  canvas: HTMLCanvasElement;
  panels?: {
    toggleTransformPreview(): void;
    beginPreviewRotation(): void;
    rotatePreview(delta: number): void;
  };
  drag?: { id: number; x: number };
  button(label: string, action: () => void): HTMLButtonElement;
  skin(button: HTMLButtonElement, base: string, states: number): void;
  place(button: HTMLButtonElement, rect: GaragePreviewRect): void;
  rect(name: string): GaragePreviewRect;
  activePreviewRect(): GaragePreviewRect;
  finishPreviewDrag(pointerId: number): void;
  syncTransformPreviewUi(): void;
  transformPreviewSessionActive(): boolean;
}

export interface GaragePreviewInputDependencies {
  attribute(node: unknown, name: string): string | undefined;
}

/** Add the authored XUN transform switch and reflect its live pressed state. */
export function createGarageTransformPreviewButton(host: GaragePreviewInputHost,
  dependencies: GaragePreviewInputDependencies): HTMLButtonElement {
  const name = "previewEquippedTailLamp_Xun";
  const node = host.assets.nodes.get(name);
  const labelNode = node?.children?.find(child => child.name === "Label");
  const authoredText = labelNode && dependencies.attribute(labelNode, "text");
  const stringKey = authoredText && /^#sb\((.+)\)$/.exec(authoredText)?.[1];
  const button = host.button("", () => {
    host.panels?.toggleTransformPreview();
    host.syncTransformPreviewUi();
    button.setAttribute("aria-pressed", String(host.transformPreviewSessionActive()));
  });
  button.classList.add("garage-transform-preview");
  const label = document.createElement("span");
  label.textContent = stringKey
    ? host.assets.strings.get(stringKey) ?? "变形预览" : "变形预览";
  button.append(label);
  host.skin(button, dependencies.attribute(node, "autoImage") ?? "garage_check_0", 5);
  button.dataset.transformPreview = "true";
  button.dataset.transformAvailable = "false";
  button.setAttribute("aria-pressed", String(host.transformPreviewSessionActive()));
  host.place(button, host.rect(name));
  return button;
}

/** Start rotating only when the primary pointer lands inside the active preview. */
export function startGaragePreviewDrag(host: GaragePreviewInputHost,
  event: PointerEvent): void {
  if (event.button !== 0) return;
  const bounds = host.surface.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * host.assets.stage.width / bounds.width;
  const y = (event.clientY - bounds.top) * host.assets.stage.height / bounds.height;
  const preview = host.activePreviewRect();
  if (x < preview.x || x > preview.x + preview.width ||
      y < preview.y || y > preview.y + preview.height) return;
  host.panels?.beginPreviewRotation();
  host.drag = { id: event.pointerId, x: event.clientX };
  host.canvas.setPointerCapture(event.pointerId);
}

export function moveGaragePreviewDrag(host: GaragePreviewInputHost,
  event: PointerEvent): void {
  if (host.drag?.id !== event.pointerId) return;
  host.panels?.rotatePreview((event.clientX - host.drag.x) *
    host.assets.stage.width / host.surface.getBoundingClientRect().width);
  host.drag.x = event.clientX;
}

export function endGaragePreviewDrag(host: GaragePreviewInputHost,
  event: PointerEvent): void {
  host.finishPreviewDrag(event.pointerId);
}
