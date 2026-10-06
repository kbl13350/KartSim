import type { GaragePreviewRect } from "./garage-transform-preview";
import {
  garageControlZIndex, garageObjectFitRect,
  type GarageControlCanvasHost,
} from "./garage-control-canvas-lifecycle";

export interface GarageControlCanvasRebuildHost extends GarageControlCanvasHost {
  image(url: string): HTMLImageElement | undefined;
}

export interface GarageControlCanvasPaintDependencies {
  intersect(left: GaragePreviewRect, right: GaragePreviewRect): GaragePreviewRect;
  paintBox(context: CanvasRenderingContext2D, style: CSSStyleDeclaration,
    rect: GaragePreviewRect, image: (url: string) => HTMLImageElement | undefined): void;
  paintCharacter(context: CanvasRenderingContext2D, style: CSSStyleDeclaration,
    character: string, rect: GaragePreviewRect): void;
}

export function intersectGarageRect(left: GaragePreviewRect,
  right: GaragePreviewRect): GaragePreviewRect {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  return {
    x, y,
    width: Math.max(0, Math.min(left.x + left.width, right.x + right.width) - x),
    height: Math.max(0, Math.min(left.y + left.height, right.y + right.height) - y),
  };
}

interface PaintTask {
  rect: GaragePreviewRect;
  clip: GaragePreviewRect;
  alpha: number;
  paint(context: CanvasRenderingContext2D): void;
}

/** Group static DOM elements into clipped canvases while retaining live canvas layers. */
export function rebuildGarageControlCanvas(host: GarageControlCanvasRebuildHost,
  dependencies: GarageControlCanvasPaintDependencies): void {
  host.layers = [];
  const surfaceBounds = host.surface.getBoundingClientRect();
  if (!surfaceBounds.width || !surfaceBounds.height) return;
  const scaleX = host.width / surfaceBounds.width;
  const scaleY = host.height / surfaceBounds.height;
  const logicalRect = (bounds: DOMRect | ClientRect): GaragePreviewRect => ({
    x: (bounds.x - surfaceBounds.x) * scaleX,
    y: (bounds.y - surfaceBounds.y) * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY,
  });
  const fullCanvas = { x: 0, y: 0, width: host.width, height: host.height };
  let tasks: PaintTask[] = [];

  const flush = () => {
    if (!tasks.length) return;
    const visible = tasks.map(task => dependencies.intersect(task.rect, task.clip));
    const left = Math.max(0, Math.floor(Math.min(...visible.map(rect => rect.x))));
    const top = Math.max(0, Math.floor(Math.min(...visible.map(rect => rect.y))));
    const right = Math.min(host.width,
      Math.ceil(Math.max(...visible.map(rect => rect.x + rect.width))));
    const bottom = Math.min(host.height,
      Math.ceil(Math.max(...visible.map(rect => rect.y + rect.height))));
    if (right > left && bottom > top) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((right - left) * host.ratio));
      canvas.height = Math.max(1, Math.round((bottom - top) * host.ratio));
      const context = canvas.getContext("2d")!;
      context.setTransform(
        canvas.width / (right - left), 0, 0,
        canvas.height / (bottom - top),
        -left * canvas.width / (right - left),
        -top * canvas.height / (bottom - top),
      );
      for (const task of tasks) {
        context.save();
        context.beginPath();
        context.rect(task.clip.x, task.clip.y, task.clip.width, task.clip.height);
        context.clip();
        context.globalAlpha = task.alpha;
        task.paint(context);
        context.restore();
      }
      host.layers.push({
        canvas,
        rect: { x: left, y: top, width: right - left, height: bottom - top },
        live: false,
      });
    }
    tasks = [];
  };

  const queue = (rect: GaragePreviewRect, clip: GaragePreviewRect,
    alpha: number, paint: PaintTask["paint"]) => {
    const visible = dependencies.intersect(rect, clip);
    if (visible.width && visible.height && alpha > 0)
      tasks.push({ rect, clip, alpha, paint });
  };

  const visit = (element: HTMLElement, clip: GaragePreviewRect, parentAlpha: number) => {
    if (element.hidden) return;
    const style = getComputedStyle(element);
    const alpha = parentAlpha * Number(style.opacity);
    if (style.display === "none" || style.visibility === "hidden" || alpha <= 0)
      return;
    const rect = logicalRect(element.getBoundingClientRect());
    if (!rect.width || !rect.height) return;
    const visible = dependencies.intersect(rect, clip);
    if (!visible.width || !visible.height) return;
    const childClip = style.overflowX !== "visible" || style.overflowY !== "visible"
      ? visible : clip;
    const outline = Number.parseFloat(style.outlineWidth) +
      Math.max(0, Number.parseFloat(style.outlineOffset));
    const margin = Number.isFinite(outline) ? outline : 0;
    queue({
      x: rect.x - margin, y: rect.y - margin,
      width: rect.width + margin * 2, height: rect.height + margin * 2,
    }, clip, alpha, context =>
      dependencies.paintBox(context, style, rect, url => host.image(url)));

    if (element instanceof HTMLCanvasElement) {
      flush();
      host.layers.push({ canvas: element, rect, clip: childClip, live: true, alpha });
    } else if (element instanceof HTMLImageElement) {
      if (element.complete && element.naturalWidth) {
        queue(rect, childClip, alpha, context => {
          const imageRect = garageObjectFitRect(rect, element.naturalWidth,
            element.naturalHeight, style.objectFit);
          context.drawImage(element, imageRect.x, imageRect.y,
            imageRect.width, imageRect.height);
        });
      }
    } else if (element instanceof HTMLSelectElement) {
      queue(rect, childClip, alpha, context => {
        context.font = style.font;
        context.fillStyle = style.color;
        context.textBaseline = "middle";
        context.fillText(element.selectedOptions[0]?.textContent ?? "",
          rect.x + 4, rect.y + rect.height / 2);
        context.fillText("▾", rect.x + rect.width - 15,
          rect.y + rect.height / 2);
      });
    } else {
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
        const range = document.createRange();
        let offset = 0;
        for (const character of node.textContent) {
          range.setStart(node, offset);
          offset += character.length;
          range.setEnd(node, offset);
          if (!character.trim()) continue;
          const letter = logicalRect(range.getBoundingClientRect());
          if (!letter.width || !letter.height) continue;
          queue({
            x: letter.x - 2, y: letter.y - 2,
            width: letter.width + 4, height: letter.height + 4,
          }, childClip, alpha, context =>
            dependencies.paintCharacter(context, style, character, letter));
        }
      }
      const children = [...element.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement);
      children.sort((left, right) =>
        garageControlZIndex(left) - garageControlZIndex(right));
      children.forEach(child => visit(child, childClip, alpha));
    }
  };

  const children = [...host.surface.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement);
  children.sort((left, right) =>
    garageControlZIndex(left) - garageControlZIndex(right));
  for (const child of children) {
    if (host.overlayOnly && [
      "garage-x-controls", "garage-progression", "garage-factory",
      "garage-point-effects",
    ].some(className => child.classList.contains(className))) continue;
    visit(child, fullCanvas, 1);
  }
  flush();
}
