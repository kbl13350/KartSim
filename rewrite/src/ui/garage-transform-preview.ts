export interface GaragePreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GarageTransformPreviewPanels {
  isTransformPreviewSessionActive?: boolean;
  isTransformPreviewEnabled?: boolean;
  isPreviewReady?: boolean;
  beginTransformPreviewSession?(): void;
  restartTransformPreview(): void;
  resetPreviewRotation?(): void;
}

interface SavedControlState {
  hidden: boolean;
  inert: boolean;
  pointerEvents: string;
}

export interface GarageTransformPreviewHost {
  panels?: GarageTransformPreviewPanels;
  controls?: HTMLElement;
  transformPreviewPartsRoot: HTMLElement;
  transformPreviewStartPending: boolean;
  transformPreviewUiHidden: boolean;
  transformPreviewUiRestore?: Map<HTMLElement, SavedControlState>;
  pageMode: string;
  progressionPanel: { previewRect: GaragePreviewRect };
  factoryPanel?: { previewRect: GaragePreviewRect };
  previewRect: GaragePreviewRect;
  drag?: { id: number; x: number };
  canvas: HTMLCanvasElement;
  transformPreviewSessionActive(): boolean;
  flushTransformPreviewStart(): void;
  syncTransformPreviewUi(): void;
}

const previewControls =
  ".garage-x-parts-title, .garage-x-inventory, .garage-x-scrollbar-slot, [data-part-tab]";

/** Queue a preview restart; an immediate request also begins the panel session. */
export function startGarageTransformPreview(
  host: GarageTransformPreviewHost,
  immediate = false,
): void {
  host.transformPreviewStartPending = true;
  if (immediate) {
    host.panels?.beginTransformPreviewSession?.();
    host.flushTransformPreviewStart();
  }
  host.syncTransformPreviewUi();
}

/** The panel's active-session flag takes precedence over its legacy enabled flag. */
export function isGarageTransformPreviewSessionActive(host: GarageTransformPreviewHost): boolean {
  return host.panels?.isTransformPreviewSessionActive ??
    host.panels?.isTransformPreviewEnabled ?? false;
}

/** Restart only after model previews have loaded; keep the pending request otherwise. */
export function flushGarageTransformPreviewStart(host: GarageTransformPreviewHost): void {
  if (!host.transformPreviewStartPending || !host.panels?.isPreviewReady) return;
  host.transformPreviewStartPending = false;
  host.panels.restartTransformPreview();
  host.syncTransformPreviewUi();
}

/** Preserve each part control's original state while the transform preview owns the page. */
export function syncGarageTransformPreviewUi(host: GarageTransformPreviewHost): void {
  if (host.transformPreviewStartPending || host.transformPreviewSessionActive()) {
    host.transformPreviewUiHidden = true;
    if (!host.controls) return;

    const saved = host.transformPreviewUiRestore ??= new Map();
    const controls = [...host.controls.querySelectorAll<HTMLElement>(previewControls)];
    const root = host.transformPreviewPartsRoot;
    if (root && !controls.includes(root)) controls.push(root);

    for (const control of controls) {
      if (!saved.has(control)) {
        saved.set(control, {
          hidden: control.hidden,
          inert: control.inert,
          pointerEvents: control.style.pointerEvents,
        });
      }
      if (typeof HTMLElement !== "undefined" && control instanceof HTMLElement &&
          typeof document !== "undefined" && document.activeElement instanceof HTMLElement &&
          control.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      control.hidden = true;
      control.inert = true;
      control.style.pointerEvents = "none";
    }
    return;
  }

  host.transformPreviewUiHidden = false;
  const saved = host.transformPreviewUiRestore ??= new Map();
  for (const [control, state] of saved) {
    control.hidden = state.hidden;
    control.inert = state.inert;
    control.style.pointerEvents = state.pointerEvents;
  }
  saved.clear();
}

export function moveToGarageTransformPreviewRoot(
  host: GarageTransformPreviewHost,
  control: HTMLElement,
): void {
  if (control.parentElement !== host.transformPreviewPartsRoot)
    host.transformPreviewPartsRoot.append(control);
}

export function placeInGarageTransformPreviewRoot(
  host: GarageTransformPreviewHost,
  control: HTMLElement,
  rect: GaragePreviewRect,
): void {
  Object.assign(control.style, {
    position: "absolute",
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  host.transformPreviewPartsRoot.append(control);
}

export function activeGaragePreviewRect(host: GarageTransformPreviewHost): GaragePreviewRect {
  if (host.pageMode === "level") return host.progressionPanel.previewRect;
  if (host.pageMode === "factory" && host.factoryPanel)
    return host.factoryPanel.previewRect;
  return host.previewRect;
}

export function finishGaragePreviewDrag(host: GarageTransformPreviewHost, pointerId: number): void {
  if (host.drag?.id !== pointerId) return;
  host.drag = undefined;
  host.panels?.resetPreviewRotation?.();
  if (host.canvas.hasPointerCapture(pointerId))
    host.canvas.releasePointerCapture(pointerId);
}
