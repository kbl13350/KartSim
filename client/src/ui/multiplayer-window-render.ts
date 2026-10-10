import type { WindowNode } from "./multiplayer-window-assets";
import type { WindowRect } from "./multiplayer-window-draw";

export interface MultiplayerWindowButton {
  key: WindowNode | number | string;
  rect?: WindowRect;
  label?: string;
  disabled?: boolean;
  activate(): void;
  hover?(): void;
}
export interface MultiplayerWindowRenderHost {
  disposed: boolean;
  paintingOnly: boolean;
  font?: unknown;
  options: {
    root: { getBoundingClientRect(): { width: number; height: number } };
    definition: WindowNode;
    smoothImages?: boolean;
    state(node: WindowNode): { select?: { values: string[]; value: string } };
  };
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  controls: Map<WindowNode, HTMLElement>;
  buttons: MultiplayerWindowButton[];
  comboRects: Map<WindowNode, WindowRect>;
  hoverRegions: Array<unknown>;
  buttonLayer: {
    update(buttons: MultiplayerWindowButton[]): void;
    control(key: number): HTMLButtonElement;
  };
  popup: HTMLElement;
  openCombo?: WindowNode;
  comboIndex: number;
  draw(node: WindowNode, rectangle: WindowRect, visibleControls: Set<WindowNode>): void;
  drawComboPopup(): void;
}

export interface MultiplayerWindowViewport {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

/** Repaints the BML tree and synchronizes its native controls and combo options. */
export function renderMultiplayerWindow(host: MultiplayerWindowRenderHost,
  viewport: (width: number, height: number, devicePixelRatio: number,
    designWidth: number, designHeight: number) => MultiplayerWindowViewport): void {
  if (host.disposed || !host.font) return;
  const bounds = host.options.root.getBoundingClientRect();
  const display = viewport(bounds.width, bounds.height,
    window.devicePixelRatio, 1600, 900);
  if (host.canvas.width !== display.width) host.canvas.width = display.width;
  if (host.canvas.height !== display.height) host.canvas.height = display.height;
  host.context.setTransform(1, 0, 0, 1, 0, 0);
  host.context.clearRect(0, 0, host.canvas.width, host.canvas.height);
  host.context.setTransform(display.scaleX, 0, 0, display.scaleY, 0, 0);
  host.context.imageSmoothingEnabled = host.options.smoothImages === true;
  const visibleControls = new Set<WindowNode>();
  host.buttons = [];
  host.comboRects.clear();
  host.hoverRegions.length = 0;
  host.draw(host.options.definition,
    { x: 0, y: 0, width: 1600, height: 900 }, visibleControls);
  for (const [node, control] of host.controls) {
    if (!host.paintingOnly && !visibleControls.has(node)) control.hidden = true;
  }
  host.drawComboPopup();
  if (host.paintingOnly) return;

  for (const control of host.controls.values()) {
    if (control instanceof HTMLInputElement)
      control.style.pointerEvents = host.openCombo ? "none" : "auto";
  }
  host.buttonLayer.update(host.buttons);
  host.popup.hidden = !host.openCombo;
  for (const button of host.buttons) {
    if (typeof button.key !== "number") continue;
    const control = host.buttonLayer.control(button.key);
    control.id = `${host.popup.id}-option-${button.key}`;
    control.setAttribute("role", "option");
    control.setAttribute("aria-selected", String(button.key ===
      host.options.state(host.openCombo!).select!.values.indexOf(
        host.options.state(host.openCombo!).select!.value)));
    if (control.parentElement !== host.popup) host.popup.append(control);
  }
  if (host.openCombo) host.controls.get(host.openCombo)?.setAttribute(
    "aria-activedescendant", `${host.popup.id}-option-${host.comboIndex}`);
}
