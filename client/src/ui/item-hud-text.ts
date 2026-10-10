/**
 * Item HUD text on a 2D canvas: each string is drawn once (outline16,
 * outline14 or plain, like the release Label renders) and handed to the
 * WebGL overlay renderer as an RGBA panel texture, as the release does for
 * rank board names (library.js PJ). Images are cached by text and style so
 * the renderer sees one texture per distinct string.
 */

import type { HudImage, TextStyle } from "./item-hud-assets";
import type { HudTextSpec } from "./item-hud-commands";

export interface HudTextContext {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  textBaseline: CanvasTextBaseline;
  measureText(text: string): { width: number };
  clearRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray };
}

export interface HudTextCanvas {
  width: number;
  height: number;
  getContext(kind: "2d", options?: { willReadFrequently?: boolean }): HudTextContext | null;
}

/** The game's CJK face (loaded at startup), as the rank board uses it. */
export const ITEM_HUD_FONT_FAMILY = "P3528 Source Han Sans CN Ready";
const PADDING = 2;
const MIN_SIZE = 10;
/** Distinct strings kept; the HUD drops its textures when this is passed. */
export const ITEM_HUD_TEXT_CACHE_LIMIT = 512;

export function hudFont(style: Pick<TextStyle, "size" | "outline">, size = style.size,
  family = ITEM_HUD_FONT_FAMILY): string {
  return `${style.outline ? "bold " : ""}${size}px "${family}", sans-serif`;
}

export function defaultTextCanvas(): HudTextCanvas | undefined {
  if (typeof OffscreenCanvas !== "undefined")
    return new OffscreenCanvas(1, 1) as unknown as HudTextCanvas;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    return typeof canvas.getContext === "function" ? canvas as unknown as HudTextCanvas : undefined;
  }
  return undefined;
}

export class HudTextRasterizer {
  private readonly cache = new Map<string, HudImage | null>();
  private canvas?: HudTextCanvas | null;

  constructor(private readonly createCanvas: () => HudTextCanvas | undefined = defaultTextCanvas,
    readonly family = ITEM_HUD_FONT_FAMILY) {}

  get size(): number { return this.cache.size; }
  clear(): void { this.cache.clear(); }

  readonly draw = (spec: HudTextSpec): HudImage | undefined => {
    const key = JSON.stringify([spec.text, spec.style, spec.maxWidth]);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached ?? undefined;
    const image = this.render(spec);
    this.cache.set(key, image ?? null);
    return image;
  };

  private render(spec: HudTextSpec): HudImage | undefined {
    if (this.canvas === undefined) this.canvas = this.createCanvas() ?? null;
    const canvas = this.canvas;
    // Every string is read back once into a texture.
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return undefined;
    const lines = spec.text.split("\n");
    let size = spec.style.size;
    context.font = hudFont(spec.style, size, this.family);
    let widest = Math.max(...lines.map(line => context.measureText(line).width));
    const limit = spec.maxWidth === undefined ? Infinity : spec.maxWidth - PADDING * 2;
    if (widest > limit && size > MIN_SIZE) {
      size = Math.max(MIN_SIZE, Math.floor(size * limit / widest));
      context.font = hudFont(spec.style, size, this.family);
      widest = Math.max(...lines.map(line => context.measureText(line).width));
    }
    const lineHeight = size + 2;
    const width = Math.max(1, Math.ceil(widest) + PADDING * 2);
    const height = lines.length * lineHeight + PADDING * 2;
    canvas.width = width;
    canvas.height = height;
    // Resizing resets the context state.
    context.font = hudFont(spec.style, size, this.family);
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.clearRect(0, 0, width, height);
    lines.forEach((line, index) => {
      const lineWidth = context.measureText(line).width;
      const x = spec.style.align === "right" ? width - PADDING - lineWidth
        : spec.style.align === "center" ? (width - lineWidth) / 2 : PADDING;
      const y = PADDING + index * lineHeight + lineHeight / 2;
      if (spec.style.outline) {
        context.strokeStyle = spec.style.outline;
        context.strokeText(line, x, y);
      }
      context.fillStyle = spec.style.color;
      context.fillText(line, x, y);
    });
    const pixels = context.getImageData(0, 0, width, height).data;
    return { width, height, pixels: Uint8Array.from(pixels) };
  }
}
