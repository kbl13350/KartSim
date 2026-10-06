import { readyButtonImageState, selectReadyOption, type ReadyOptions } from "./ready-options";

export interface ReadyButtonRect { x: number; y: number; width: number; height: number }
export interface ReadyButtonHit { id: string; name: string; rect: ReadyButtonRect }
export interface ReadyPointerEvent {
  clientX: number;
  clientY: number;
  pointerId: number;
  button: number;
}

export interface ReadyViewDependencies {
  formatRecord(record: unknown, strings: unknown, version: string): unknown;
  speedChannel(options: ReadyOptions): number;
  defaultVersion: string;
}

export interface ReadyViewHost {
  options: {
    randomGroup?: unknown;
    onInteraction?(): void;
    onHover?(): void;
    onStartActivate?(): void;
    onActivate?(): void;
    onTraining(options: ReadyOptions): void;
    onTrackSelect(options: ReadyOptions): void;
    onItemSelect(options: ReadyOptions): void;
    onExit?(options: ReadyOptions): void;
    recordFor(options: ReadyOptions): { hasGhost?: boolean } | undefined;
  };
  assets: { strings: unknown };
  canvas: {
    getBoundingClientRect(): { left: number; top: number; width: number; height: number };
    setPointerCapture(pointerId: number): void;
    hasPointerCapture(pointerId: number): boolean;
    releasePointerCapture(pointerId: number): void;
  };
  readyOptions: ReadyOptions;
  record: unknown;
  hasReplay: boolean;
  buttonHits: ReadyButtonHit[];
  nodeIds: WeakMap<object, string>;
  nextNodeId: number;
  hoveredButton?: string;
  pressedButton?: string;
  shown: boolean;
  disposed: boolean;
  render(): void;
  activateButton(name: string): void;
  selectReadyOption(name: string): boolean;
  applyReadyOptions(options: ReadyOptions): void;
  refreshRecord(): void;
  hitButton(event: ReadyPointerEvent): ReadyButtonHit | undefined;
}

export interface ReadyButtonNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
}

export interface ReadyButtonTextStyle { textRender: string; textColor: unknown }
export interface ReadyButtonDrawingHost extends ReadyViewHost {
  assets: ReadyViewHost["assets"] & {
    buttonImages: Map<string, unknown[]>;
    buttonStyles: Map<ReadyButtonNode, { states: ReadyButtonTextStyle[] }>;
  };
  context: unknown;
  nodeId(node: ReadyButtonNode): string;
  drawButtonText(node: ReadyButtonNode, rect: ReadyButtonRect, state: number): void;
}

export interface ReadyButtonDrawingDependencies {
  paintFrame(context: unknown, image: unknown, rect: ReadyButtonRect): void;
  paintText(context: unknown, text: string, rect: ReadyButtonRect, style: {
    kind: "button"; render: string; align: string; color: unknown;
  }): void;
  translate(text: string, strings: unknown): string;
}

function buttonAttribute(node: ReadyButtonNode, name: string): string | undefined {
  return node.attributes.find(attribute => attribute.name === name)?.value;
}

function requiredButtonAttribute(node: ReadyButtonNode, name: string): string {
  const value = buttonAttribute(node, name);
  if (value === undefined) throw new Error(`P3528 Ready ${node.name}.${name} 缺失。`);
  return value;
}

/** Paint the correct button frame and expose only actionable buttons to hit testing. */
export function drawReadyImageButton(host: ReadyButtonDrawingHost,
  node: ReadyButtonNode, rect: ReadyButtonRect,
  deps: ReadyButtonDrawingDependencies): void {
  const id = host.nodeId(node);
  const name = buttonAttribute(node, "name") ?? id;
  const imageName = requiredButtonAttribute(node, "autoLoadImage");
  const randomGhostButton = host.options.randomGroup !== undefined &&
    (name === "onBtn" || name === "offBtn");
  const state = randomGhostButton
    ? (name === "offBtn" ? 4 : 1)
    : readyButtonImageState(id, name, host.readyOptions,
      host.hoveredButton, host.pressedButton);
  const images = host.assets.buttonImages.get(imageName);
  if (!images) throw new Error(`P3528 Ready button ${imageName} 没有四态图片。`);
  deps.paintFrame(host.context, images[state - 1], rect);
  host.drawButtonText(node, rect, state);
  if (state !== 4 && !randomGhostButton) {
    host.buttonHits = [...host.buttonHits, { id, name, rect }];
  }
}

export function drawReadyButtonText(host: ReadyButtonDrawingHost,
  node: ReadyButtonNode, rect: ReadyButtonRect, state: number,
  deps: ReadyButtonDrawingDependencies): void {
  const text = buttonAttribute(node, "text");
  if (text === undefined) return;
  const style = host.assets.buttonStyles.get(node)?.states[state - 1];
  if (!style) throw new Error("P3528 Ready button 缺少原版四态文字样式。");
  deps.paintText(host.context, deps.translate(text, host.assets.strings), rect, {
    kind: "button",
    render: style.textRender,
    align: buttonAttribute(node, "textAlign") ?? "center",
    color: style.textColor,
  });
}

/** Give each BML button node a stable ID across Ready renders. */
export function readyButtonNodeId(host: ReadyViewHost, node: object): string {
  const existing = host.nodeIds.get(node);
  if (existing !== undefined) return existing;
  const id = `ready-button-${host.nextNodeId++}`;
  host.nodeIds.set(node, id);
  return id;
}

/** Hit test from screen pixels to the packaged 1600 × 900 Ready layout. */
export function readyButtonAtPoint(host: ReadyViewHost, event: ReadyPointerEvent): ReadyButtonHit | undefined {
  const canvasRect = host.canvas.getBoundingClientRect();
  const x = ((event.clientX - canvasRect.left) * 1600) / canvasRect.width;
  const y = ((event.clientY - canvasRect.top) * 900) / canvasRect.height;
  return [...host.buttonHits].reverse().find(({ rect }) =>
    x >= rect.x && x <= rect.x + rect.width &&
    y >= rect.y && y <= rect.y + rect.height);
}

export function moveReadyPointer(host: ReadyViewHost, event: ReadyPointerEvent): void {
  const hovered = host.hitButton(event)?.id;
  if (hovered !== host.hoveredButton) {
    host.hoveredButton = hovered;
    if (hovered !== undefined) host.options.onHover?.();
    host.render();
  }
}

export function pressReadyPointer(host: ReadyViewHost, event: ReadyPointerEvent): void {
  const hit = host.hitButton(event);
  if (!hit || event.button !== 0) return;
  host.options.onInteraction?.();
  host.hoveredButton = hit.id;
  host.pressedButton = hit.id;
  host.canvas.setPointerCapture(event.pointerId);
  host.render();
}

export function releaseReadyPointer(host: ReadyViewHost, event: ReadyPointerEvent): void {
  const hit = host.hitButton(event);
  const name = hit && hit.id === host.pressedButton ? hit.name : undefined;
  host.pressedButton = undefined;
  if (host.canvas.hasPointerCapture(event.pointerId)) {
    host.canvas.releasePointerCapture(event.pointerId);
  }
  if (name === undefined) {
    host.render();
    return;
  }
  host.activateButton(name);
}

export function cancelReadyPointer(host: ReadyViewHost, event: ReadyPointerEvent): void {
  host.pressedButton = undefined;
  if (host.canvas.hasPointerCapture(event.pointerId)) {
    host.canvas.releasePointerCapture(event.pointerId);
  }
  host.render();
}

export function leaveReadyPointer(host: ReadyViewHost): void {
  host.hoveredButton = undefined;
  host.render();
}

export function activateReadyTrainingShortcut(host: ReadyViewHost): void {
  if (host.shown && !host.disposed) {
    host.options.onInteraction?.();
    host.activateButton("training");
  }
}

/** Option buttons update the Ready view; navigation buttons delegate to its owner. */
export function activateReadyButton(host: ReadyViewHost, name: string): void {
  if (name === "training") host.options.onStartActivate?.();
  else host.options.onActivate?.();
  if (host.selectReadyOption(name)) {
    host.render();
    return;
  }
  host.render();
  if (name === "training") host.options.onTraining(host.readyOptions);
  else if (name === "selectTrackBtn") host.options.onTrackSelect(host.readyOptions);
  else if (name === "myItemBtn") host.options.onItemSelect(host.readyOptions);
  else if (name === "exit") host.options.onExit?.(host.readyOptions);
}

export function refreshReadyViewRecord(host: ReadyViewHost, deps: ReadyViewDependencies): void {
  const record = host.options.recordFor(host.readyOptions);
  host.record = deps.formatRecord(record, host.assets.strings,
    host.readyOptions.version ?? deps.defaultVersion);
  host.hasReplay = record?.hasGhost === true;
}

/** Keep the existing option object when the effective speed channel is unchanged. */
export function setReadyViewSpeedChannel(host: ReadyViewHost,
  change: Partial<ReadyOptions>, deps: ReadyViewDependencies): void {
  const next = { ...host.readyOptions, ...change };
  if (deps.speedChannel(host.readyOptions) !== deps.speedChannel(next)) {
    host.applyReadyOptions(next);
  }
}

export function selectReadyViewOption(host: ReadyViewHost, name: string): boolean {
  const next = selectReadyOption(host.readyOptions, name);
  if (next === host.readyOptions) return false;
  host.applyReadyOptions(next);
  return true;
}

export function applyReadyViewOptions(host: ReadyViewHost,
  next: ReadyOptions, deps: ReadyViewDependencies): void {
  const recordChanged = deps.speedChannel(next) !== deps.speedChannel(host.readyOptions) ||
    next.booster !== host.readyOptions.booster;
  host.readyOptions = next;
  if (recordChanged) host.refreshRecord();
}
