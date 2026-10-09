import type { UiRectangle } from "./scrollbar";
import { loadTaskbarAssets, type TaskbarAssetLibrary } from "./taskbar-assets";

const logicalWidth = 1600;
const logicalHeight = 66;

export interface TaskbarImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface TaskbarButton {
  node: object;
  name: string;
  rect: UiRectangle;
}

export interface TaskbarAssets {
  background: TaskbarImage;
  images: Map<object, [TaskbarImage, TaskbarImage, TaskbarImage, TaskbarImage]>;
  buttons: TaskbarButton[];
  labels: Map<string, string>;
}

export interface TaskbarOptions {
  root: HTMLElement;
  onSettings?: () => void;
  onGarage?: () => void;
  onHouse?: () => void;
  onSinglePlayer?: () => void;
  onMultiplayer?: () => void;
  /** gotoHome: return to the main menu home. */
  onHome?: () => void;
  /** 상점: the account shop (server-go/ECONOMY.md 7.6). */
  onShop?: () => void;
  onHover?: () => void;
  onActivate?: () => void;
  /** messengerButton: 好友聊天系统 (ui/messenger-window.ts). */
  onMessenger?: () => void;
  /** messengerAlert, the tray's red "!" (ui/messenger-tray.ts). */
  messengerAlert?: {
    active(): boolean;
    subscribe(listener: () => void): () => void;
    badge(): CanvasImageSource | undefined;
  };
  /** The bar was shown or hidden (hidden during races). */
  onVisibilityChange?: (visible: boolean) => void;
}

/** messengerAlert's rectangle relative to messengerButton (tray@cn windowRect 11 -6 31 15). */
const messengerAlertOffset = { x: 11, y: -6 };

function canvasSize(width: number, height: number, pixelRatio: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1600;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 900;
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const scaleX = Math.round(safeWidth * ratio) / 1600;
  const scaleY = Math.round(safeHeight * ratio) / 900;
  return {
    width: Math.max(1, Math.round(logicalWidth * scaleX)),
    height: Math.max(1, Math.round(logicalHeight * scaleY)),
    scaleX,
    scaleY,
  };
}

function drawCentered(context: CanvasRenderingContext2D, image: TaskbarImage, rect: UiRectangle): void {
  context.drawImage(image.image,
    rect.x + (rect.width - image.width) * 0.5,
    rect.y + (rect.height - image.height) * 0.5);
}

function buttonFrame(name: string, hovered?: string, pressed?: string): number {
  return hovered !== name ? 0 : pressed === name ? 2 : 1;
}

/** Bottom navigation bar rendered from packaged tray images and accessible buttons. */
export class Taskbar {
  element = document.createElement("div");
  canvas = document.createElement("canvas");
  context: CanvasRenderingContext2D;
  resizeObserver: ResizeObserver;
  onViewportResize = () => this.render();
  hovered?: string;
  pressed?: string;
  compositeOwner?: object;
  compositeChanged?: () => void;
  revision = 0;
  releaseAlert?: () => void;

  static async load(options: TaskbarOptions & { library: TaskbarAssetLibrary }): Promise<Taskbar> {
    return new Taskbar(options, await loadTaskbarAssets(options.library));
  }

  constructor(readonly options: TaskbarOptions, readonly assets: TaskbarAssets) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法创建 P3528 任务栏 Canvas。");
    this.context = context;
    Object.assign(this.element.style, {
      position: "absolute", bottom: "0", left: "0", width: "100%",
      height: `${logicalHeight / 9}%`,
    });
    this.element.dataset.uiLayer = "navigation";
    this.element.hidden = true;
    this.element.setAttribute("role", "toolbar");
    this.element.setAttribute("aria-label", "游戏任务栏");
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      width: "100%", height: "100%", imageRendering: "pixelated",
    });
    this.element.append(this.canvas);
    assets.buttons.forEach(button => this.appendButton(button));
    options.root.append(this.element);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(options.root);
    window.addEventListener("resize", this.onViewportResize);
    this.releaseAlert = options.messengerAlert?.subscribe(() => this.render());
    this.render();
  }

  /** Let a 3D owner composite the taskbar canvas until the returned release is called. */
  composite(owner: object, onChanged: () => void): () => void {
    this.compositeOwner = owner;
    this.compositeChanged = onChanged;
    this.canvas.style.visibility = "hidden";
    return () => {
      if (this.compositeOwner !== owner) return;
      this.compositeOwner = undefined;
      this.canvas.style.visibility = "visible";
      this.compositeChanged = undefined;
      this.render();
    };
  }

  get compositeFrame(): { canvas: HTMLCanvasElement; revision: number; rect: DOMRect } | undefined {
    if (this.element.hidden) return undefined;
    return {
      canvas: this.canvas,
      revision: this.revision,
      rect: this.element.getBoundingClientRect(),
    };
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
    this.hovered = undefined;
    this.pressed = undefined;
    this.render();
    this.options.onVisibilityChange?.(visible);
  }

  dispose(): void {
    this.releaseAlert?.();
    this.compositeOwner = undefined;
    this.compositeChanged = undefined;
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.onViewportResize);
    this.element.remove();
  }

  appendButton(button: TaskbarButton): void {
    const element = document.createElement("button");
    const label = this.assets.labels.get(button.name) ?? button.name;
    element.type = "button";
    element.dataset.taskbarButton = button.name;
    element.title = label;
    element.setAttribute("aria-label", label);
    element.disabled = !this.actionFor(button.name);
    Object.assign(element.style, {
      position: "absolute",
      left: `${(button.rect.x / logicalWidth) * 100}%`,
      top: `${(button.rect.y / logicalHeight) * 100}%`,
      width: `${(button.rect.width / logicalWidth) * 100}%`,
      height: `${(button.rect.height / logicalHeight) * 100}%`,
      padding: "0", border: "0", background: "transparent",
      cursor: element.disabled ? "default" : "pointer", outline: "none",
    });
    element.addEventListener("pointerenter", () => {
      if (!element.disabled) this.options.onHover?.();
      this.hovered = button.name;
      this.render();
    });
    element.addEventListener("pointerleave", () => {
      this.hovered = undefined;
      this.pressed = undefined;
      this.render();
    });
    element.addEventListener("pointerdown", () => {
      this.pressed = button.name;
      this.render();
    });
    element.addEventListener("pointerup", () => {
      this.pressed = undefined;
      this.render();
    });
    element.addEventListener("pointercancel", () => {
      this.pressed = undefined;
      this.render();
    });
    element.addEventListener("focus", () => this.render());
    element.addEventListener("blur", () => this.render());
    element.addEventListener("click", () => {
      const action = this.actionFor(button.name);
      if (!this.element.hidden && action && !element.disabled) {
        this.options.onActivate?.();
        action();
      }
    });
    this.element.append(element);
  }

  render(): void {
    const rootRect = this.options.root.getBoundingClientRect();
    const size = canvasSize(rootRect.width, rootRect.height, window.devicePixelRatio);
    if (this.canvas.width !== size.width) this.canvas.width = size.width;
    if (this.canvas.height !== size.height) this.canvas.height = size.height;
    this.context.setTransform(size.scaleX, 0, 0, size.scaleY, 0, 0);
    this.context.clearRect(0, 0, logicalWidth, logicalHeight);
    this.context.imageSmoothingEnabled = true;
    this.context.drawImage(this.assets.background.image, 0, 0);
    for (const button of this.assets.buttons) {
      const frame = this.actionFor(button.name)
        ? buttonFrame(button.name, this.hovered, this.pressed)
        : 3;
      drawCentered(this.context, this.assets.images.get(button.node)![frame]!, button.rect);
      const focused = document.activeElement;
      if (focused?.parentElement === this.element &&
        focused.getAttribute("aria-label") === (this.assets.labels.get(button.name) ?? button.name) &&
        focused.matches(":focus-visible")) {
        this.context.strokeStyle = "#a3edff";
        this.context.lineWidth = 2;
        this.context.strokeRect(button.rect.x + 1, button.rect.y + 1,
          button.rect.width - 2, button.rect.height - 2);
      }
      const badge = button.name === "messengerButton" && this.options.messengerAlert?.active()
        ? this.options.messengerAlert.badge() : undefined;
      if (badge) this.context.drawImage(badge, button.rect.x + messengerAlertOffset.x,
        button.rect.y + messengerAlertOffset.y);
    }
    this.revision++;
    this.compositeChanged?.();
  }

  actionFor(name: string): (() => void) | undefined {
    if (name === "설정") return this.options.onSettings;
    if (name === "파츠") return this.options.onGarage;
    if (name === "마이룸") return this.options.onHouse;
    if (name === "singleplay") return this.options.onSinglePlayer;
    if (name === "multiplay") return this.options.onMultiplayer;
    if (name === "gotoHome") return this.options.onHome;
    if (name === "상점") return this.options.onShop;
    if (name === "messengerButton") return this.options.onMessenger;
    return undefined;
  }
}
