import type { GaragePreviewRect } from "./garage-transform-preview";
import type { GaragePreparationRenderDependencies } from
  "./garage-upgrade-preparation-render";

export interface GaragePreparationArrow {
  direction: "left" | "right";
  color: [number, number, number, number];
  hoverColor: [number, number, number, number];
  clickedColor: [number, number, number, number];
  disabledColor: [number, number, number, number];
}

export interface GaragePreparationControlAssets {
  rect?: GaragePreviewRect;
  rects: Map<string, GaragePreviewRect>;
  pageButtonFrames: Map<string, unknown>;
  images: Map<string, CanvasImageSource>;
}

export interface GaragePreparationControlHost {
  controls: HTMLElement;
  assets?: GaragePreparationControlAssets;
  pageFrameObservers: ResizeObserver[];
  pageFrameRedraws?: Array<() => void>;
  close(accept: boolean): void;
}

export function placePreparationControl(host: GaragePreparationControlHost,
  element: HTMLElement, rect: GaragePreviewRect): void {
  Object.assign(element.style, {
    position: "absolute", left: rect.x + "px", top: rect.y + "px",
    width: rect.width + "px", height: rect.height + "px",
  });
  host.controls.append(element);
}

export function addPreparationLabel(host: GaragePreparationControlHost,
  text: string, rectName: string, extraClass = ""): void {
  const element = document.createElement("div");
  element.textContent = text;
  element.className = "garage-preparation-label " + extraClass;
  placePreparationControl(host, element, host.assets!.rects.get(rectName)!);
}

export function addPreparationComparisonValue(host: GaragePreparationControlHost,
  rectName: string, value: number, increment = 0,
  extraClass = "metric-value"): void {
  const element = document.createElement("div");
  element.className = "garage-preparation-label " + extraClass;
  const main = document.createElement("span");
  main.className = "garage-preparation-value-main";
  main.textContent = String(value);
  element.append(main);
  if (increment > 0) {
    const increase = document.createElement("span");
    increase.className = "garage-preparation-value-increment";
    increase.textContent = "(+" + increment + ")";
    element.append(increase);
  }
  element.setAttribute("aria-label", increment > 0
    ? value + "，增加 " + increment : String(value));
  placePreparationControl(host, element, host.assets!.rects.get(rectName)!);
}

export function createPreparationButton(host: GaragePreparationControlHost,
  label: string, rect: GaragePreviewRect, action: () => void,
  disabled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.onclick = action;
  placePreparationControl(host, button, rect);
  return button;
}

export function addPreparationCancelButton(host: GaragePreparationControlHost): void {
  const rect = host.assets?.rect ?? { x: 178, y: 56, width: 1244 };
  const button = createPreparationButton(host, "关闭强化准备", {
    x: rect.x + rect.width - 38, y: rect.y + 3, width: 30, height: 30,
  }, () => host.close(false));
  button.textContent = "×";
  button.className = "garage-preparation-close";
  button.focus();
}

/** Render a BML page button frame for hover, press, focus and resize states. */
export function decoratePreparationPageArrow(host: GaragePreparationControlHost,
  button: HTMLButtonElement, arrow: GaragePreparationArrow,
  rect: GaragePreviewRect | undefined,
  dependencies: GaragePreparationRenderDependencies): void {
  const color = ([alpha, red, green, blue]: [number, number, number, number]) =>
    "rgb(" + red + " " + green + " " + blue + " / " + alpha / 255 + ")";
  button.className = "garage-preparation-page-arrow " + arrow.direction;
  button.textContent = "";
  button.style.setProperty("--page-arrow-normal", color(arrow.color));
  button.style.setProperty("--page-arrow-hover", color(arrow.hoverColor));
  button.style.setProperty("--page-arrow-active", color(arrow.clickedColor));
  button.style.setProperty("--page-arrow-disabled", color(arrow.disabledColor));
  const canvas = document.createElement("canvas");
  canvas.className = "garage-preparation-page-frame";
  if (rect) { canvas.width = rect.width; canvas.height = rect.height; }
  const render = (state: "normal" | "hover" | "clicked" | "disabled") => {
    if (!rect || !host.assets) return;
    const context = canvas.getContext("2d");
    const frame = host.assets.pageButtonFrames.get(state);
    const image = host.assets.images.get("frame");
    if (!context || !frame || !image) return;
    const bounds = canvas.getBoundingClientRect();
    dependencies.fitCanvas(canvas, context, bounds.width, bounds.height,
      dependencies.pixelRatio(), rect.width, rect.height);
    context.imageSmoothingEnabled = true;
    context.clearRect(0, 0, rect.width, rect.height);
    dependencies.drawFrame(context, frame, image,
      { x: 0, y: 0, width: rect.width, height: rect.height });
  };
  const idle = () => render(button.disabled ? "disabled" : "normal");
  button.addEventListener("mouseenter", () =>
    render(button.disabled ? "disabled" : "hover"));
  button.addEventListener("mouseleave", idle);
  button.addEventListener("mousedown", () => {
    if (!button.disabled) render("clicked");
  });
  button.addEventListener("mouseup", () =>
    render(button.disabled ? "disabled" : "hover"));
  button.addEventListener("focus", () =>
    render(button.disabled ? "disabled" : "hover"));
  button.addEventListener("blur", idle);
  const icon = document.createElement("span");
  icon.className = "garage-preparation-page-arrow-icon";
  button.append(canvas, icon);
  const redraw = () => render(button.disabled ? "disabled"
    : button.matches(":active") ? "clicked"
      : button.matches(":hover") || document.activeElement === button ? "hover"
        : "normal");
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    host.pageFrameObservers.push(observer);
  }
  (host.pageFrameRedraws ??= []).push(redraw);
  idle();
}
