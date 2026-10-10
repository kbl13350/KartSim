import type { UiRectangle } from "./scrollbar";

export interface WindowNoticeContent {
  rect: UiRectangle;
  text: string;
  draw(context: CanvasRenderingContext2D): void;
}

function devicePixelRatio(): number {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function canvasSize(width: number, height: number, ratio: number,
  logicalWidth: number, logicalHeight: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : logicalWidth;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : logicalHeight;
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const scaleX = Math.round(safeWidth * safeRatio) / logicalWidth;
  const scaleY = Math.round(safeHeight * safeRatio) / logicalHeight;
  return {
    width: Math.max(1, Math.round(logicalWidth * scaleX)),
    height: Math.max(1, Math.round(logicalHeight * scaleY)),
    scaleX,
    scaleY,
  };
}

/** A short-lived, accessible Canvas notice positioned over the game viewport. */
export class WindowNotice {
  canvas = document.createElement("canvas");
  context: CanvasRenderingContext2D;
  resizeObserver?: ResizeObserver;
  expiresAt = 0;
  active?: WindowNoticeContent;
  onResize = () => this.paint();

  constructor(root: HTMLElement) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法创建 P3528 通知窗口 Canvas。");
    this.context = context;
    Object.assign(this.canvas.style, { position: "absolute", pointerEvents: "auto" });
    this.canvas.dataset.uiLayer = "notice";
    this.canvas.hidden = true;
    this.canvas.setAttribute("role", "status");
    root.append(this.canvas);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(root);
    }
    window.addEventListener("resize", this.onResize);
  }

  show(rect: UiRectangle, text: string,
    draw: (context: CanvasRenderingContext2D) => void, durationMs = 1500): void {
    Object.assign(this.canvas.style, {
      left: `${(rect.x / 1600) * 100}%`,
      top: `${(rect.y / 900) * 100}%`,
      width: `${(rect.width / 1600) * 100}%`,
      height: `${(rect.height / 900) * 100}%`,
    });
    this.expiresAt = performance.now() + durationMs;
    this.canvas.setAttribute("aria-label", text);
    this.active = { rect, text, draw };
    this.canvas.hidden = false;
    this.paint();
  }

  update(timeMs: number): void {
    if (timeMs >= this.expiresAt) {
      this.canvas.hidden = true;
      this.active = undefined;
    }
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.active = undefined;
    this.canvas.remove();
  }

  paint(): void {
    const notice = this.active;
    if (!notice || this.canvas.hidden) return;
    const rect = this.canvas.getBoundingClientRect();
    const size = canvasSize(rect.width, rect.height, devicePixelRatio(),
      notice.rect.width, notice.rect.height);
    if (this.canvas.width !== size.width) this.canvas.width = size.width;
    if (this.canvas.height !== size.height) this.canvas.height = size.height;
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.setTransform(size.scaleX, 0, 0, size.scaleY,
      -notice.rect.x * size.scaleX, -notice.rect.y * size.scaleY);
    this.context.imageSmoothingEnabled = false;
    notice.draw(this.context);
  }
}
