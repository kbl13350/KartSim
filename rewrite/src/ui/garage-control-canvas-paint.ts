import type { GaragePreviewRect } from "./garage-transform-preview";
import { garageObjectFitRect } from "./garage-control-canvas-lifecycle";

/** Split CSS layers at commas outside nested color and gradient functions. */
export function splitGarageCssLayers(value: string): string[] {
  let depth = 0;
  let start = 0;
  const layers: string[] = [];
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") depth++;
    else if (value[index] === ")") depth--;
    else if (value[index] === "," && depth === 0) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers;
}

export function garageCssLength(value: string, basis: number): number {
  return value.endsWith("%")
    ? Number.parseFloat(value) / 100 * basis
    : Number.parseFloat(value) || 0;
}

/** Paint the subset of CSS box effects present in the Garage control overlay. */
export function paintGarageControlBox(context: CanvasRenderingContext2D,
  style: CSSStyleDeclaration, rect: GaragePreviewRect,
  image: (url: string) => HTMLImageElement | undefined): void {
  const { x, y, width, height } = rect;
  context.save();
  if (style.clipPath.startsWith("polygon(")) {
    context.beginPath();
    splitGarageCssLayers(style.clipPath.slice(8, -1)).forEach((point, index) => {
      const [horizontal, vertical] = point.split(/\s+/);
      const pointX = x + garageCssLength(horizontal!, width);
      const pointY = y + garageCssLength(vertical!, height);
      if (index) context.lineTo(pointX, pointY);
      else context.moveTo(pointX, pointY);
    });
    context.closePath();
    context.clip();
  }
  context.fillStyle = style.backgroundColor;
  context.fillRect(x, y, width, height);

  for (const shadow of splitGarageCssLayers(style.boxShadow)) {
    const match =
      /^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?\s+inset$/.exec(shadow);
    if (!match) continue;
    const spread = Number(match[5] ?? 0);
    const shiftX = Number(match[2]);
    const shiftY = Number(match[3]);
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = match[1]!;
    const top = Math.max(0, spread + shiftY);
    const bottom = Math.max(0, spread - shiftY);
    const left = Math.max(0, spread + shiftX);
    const right = Math.max(0, spread - shiftX);
    if (top) context.fillRect(x, y, width, top);
    if (bottom) context.fillRect(x, y + height - bottom, width, bottom);
    if (left) context.fillRect(x, y, left, height);
    if (right) context.fillRect(x + width - right, y, right, height);
    context.restore();
  }

  for (const layer of splitGarageCssLayers(style.backgroundImage).reverse()) {
    const url = /^url\(["']?(.*?)["']?\)$/.exec(layer)?.[1];
    const bitmap = url && image(url);
    if (bitmap) {
      const size = style.backgroundSize.split(/\s+/);
      const fitted = style.backgroundSize === "contain" ||
        style.backgroundSize === "cover"
        ? garageObjectFitRect(rect, bitmap.naturalWidth, bitmap.naturalHeight,
            style.backgroundSize)
        : undefined;
      const imageWidth = fitted?.width ??
        (size[0] === "auto" ? bitmap.naturalWidth : garageCssLength(size[0]!, width));
      const imageHeight = fitted?.height ??
        (!size[1] || size[1] === "auto"
          ? bitmap.naturalHeight * imageWidth / bitmap.naturalWidth
          : garageCssLength(size[1], height));
      const imageX = x + garageCssLength(style.backgroundPositionX, width - imageWidth);
      const imageY = y + garageCssLength(style.backgroundPositionY, height - imageHeight);
      context.save();
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      context.drawImage(bitmap, imageX, imageY, imageWidth, imageHeight);
      context.restore();
    } else if (layer.startsWith("linear-gradient(")) {
      const stops = splitGarageCssLayers(layer.slice(16, -1));
      const gradient = context.createLinearGradient(x, y, x, y + height);
      stops.forEach((stop, index) => {
        const match = /^(.*?)(?:\s+(-?[\d.]+)(%|px))?$/.exec(stop)!;
        const position = match[2]
          ? Math.max(0, Math.min(1,
            Number(match[2]) / (match[3] === "%" ? 100 : height)))
          : index / (stops.length - 1);
        gradient.addColorStop(position, match[1]!);
      });
      context.fillStyle = gradient;
      context.fillRect(x, y, width, height);
    }
  }

  const borders: Array<[string, string, number, number, number, number]> = [
    [style.borderTopWidth, style.borderTopColor, x, y, width, 0],
    [style.borderBottomWidth, style.borderBottomColor, x, y + height, width, -1],
    [style.borderLeftWidth, style.borderLeftColor, x, y, 0, height],
    [style.borderRightWidth, style.borderRightColor, x + width, y, -1, height],
  ];
  for (const [thickness, color, edgeX, edgeY, edgeWidth, edgeHeight] of borders) {
    const pixels = Number.parseFloat(thickness);
    if (!pixels) continue;
    context.fillStyle = color;
    context.fillRect(
      edgeX + (edgeWidth === -1 ? -pixels : 0),
      edgeY + (edgeHeight === -1 ? -pixels : 0),
      edgeWidth > 0 ? edgeWidth : pixels,
      edgeHeight > 0 ? edgeHeight : pixels,
    );
  }
  if (style.outlineStyle !== "none") {
    const stroke = Number.parseFloat(style.outlineWidth);
    const offset = Number.parseFloat(style.outlineOffset);
    context.strokeStyle = style.outlineColor;
    context.lineWidth = stroke;
    context.strokeRect(x - offset - stroke / 2, y - offset - stroke / 2,
      width + offset * 2 + stroke, height + offset * 2 + stroke);
  }
  context.restore();
}

export function paintGarageControlCharacter(context: CanvasRenderingContext2D,
  style: CSSStyleDeclaration, character: string,
  rect: GaragePreviewRect): void {
  context.font = style.font;
  context.textBaseline = "alphabetic";
  context.fillStyle = style.color;
  const metrics = context.measureText(character);
  const baseline = rect.y + metrics.fontBoundingBoxAscent;
  for (const shadow of splitGarageCssLayers(style.textShadow)) {
    const match =
      /^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?$/.exec(shadow);
    if (!match) continue;
    context.save();
    context.fillStyle = match[1]!;
    context.shadowColor = match[1]!;
    context.shadowBlur = Number(match[4] ?? 0);
    context.fillText(character, rect.x + Number(match[2]),
      baseline + Number(match[3]));
    context.restore();
  }
  context.fillText(character, rect.x, baseline);
}
