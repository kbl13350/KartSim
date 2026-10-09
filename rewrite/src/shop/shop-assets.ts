/**
 * Original art for the DOM shop: every image the stage_mqShop / shopCard /
 * mqBuyItem layouts name (texture and autoLoadImage _1.._4 states, looked up
 * like the release window renderer: stage_mqShop, dialog2_buyItem and
 * stage_common, @zz names trying @cn first), the gui_monocoque frames painted
 * with the release frame painter (generated C9) into 9-slice sources, and the
 * gui_/font SourceHanSansCN-Bold face the CN FtFonts use.
 *
 * Everything is exposed as CSS custom properties on the shop root (see
 * imageVar / frameVar); a missing piece keeps the plain CSS look. Loaded art
 * (blob URLs and the registered font) is cached per resource library for the
 * page's lifetime, so reopening the shop is immediate.
 */
import { C9, p2 } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import {
  attr, BUY_DIALOG, SHOP_CARD_TIP, SHOP_CARDS, SHOP_FRAMES, STAGE_WINDOW, STOCK_COMBO_ITEM,
  TC_CASH_SLOT, TC_CASH_WINDOW, textButtonStyle, type ShopFrame, type ShopNode,
} from "./shop-original";

export interface ShopArtEntry { bytes(): Promise<Uint8Array> }

export interface ShopArtLibrary {
  canonicalCandidates(path: string): readonly ShopArtEntry[];
}

export function isShopArtLibrary(value: unknown): value is ShopArtLibrary {
  return typeof value === "object" && value !== null &&
    typeof (value as { canonicalCandidates?: unknown }).canonicalCandidates === "function";
}

/** Resource folders searched for layout images (stage.bml addResFolder order). */
export const SHOP_ART_ROOTS = ["stage_/mqShop", "stage_/mqShop/tcCashEvent", "dialog2_/buyItem",
  "stage_/common"] as const;

/**
 * Card eventTag marks (stage_mqShop): 新品, 人气, 限购 and the discount
 * flags (discount10 blue under 30% off, discount30 red, discount60 purple
 * from 60%; _long for labels like 5.6折); two frames side by side.
 */
export const SHOP_MARK_IMAGES = [
  "new@cn", "hot@cn", "eventbuycount@cn", "limited@cn", "event@cn",
  "discount10@cn", "discount30@cn", "discount60@cn",
  "discount10_long@cn", "discount30_long@cn", "discount60_long@cn",
] as const;

/** tcCash window images set at run time (title, reached and open step slots). */
const SPEND_EVENT_IMAGES = [
  "tcCashEventTitle1@cn", "tcCashEventTitle0@cn",
  ...imageSeries("shop_chargePoint_slot_n_"), ...imageSeries("shop_chargePoint_slot_c_"),
];
const FRAME_ROOT = "gui_/monocoque";

/** The CSS family registered for gui_/font/SourceHanSansCN-Bold.otf. */
export const SHOP_FONT_FAMILY = "KartSim Shop SourceHanSansCN";

function sanitize(name: string): string {
  return [...name].map(character => /[A-Za-z0-9_-]/.test(character) ? character
    : `_${character.codePointAt(0)!.toString(16)}`).join("");
}

/** --ks-i-<name>: url(...) of one image. */
export function imageVar(name: string): string {
  return `--ks-i-${sanitize(name)}`;
}

/** --ks-f-<frame>-<state> (image), --ks-fs-… (border-image-slice), --ks-fw-… (border widths). */
export function frameVar(frame: string, state: number, kind: "image" | "slice" | "width"): string {
  const prefix = kind === "image" ? "f" : kind === "slice" ? "fs" : "fw";
  return `--ks-${prefix}-${sanitize(frame)}-${state}`;
}

/** The four autoLoadImage state names of a series ("btn_reset_" → btn_reset_1..4). */
export function imageSeries(series: string): string[] {
  return [1, 2, 3, 4].map(index => series.replace(/(@zz)?$/, `${index}$1`));
}

/** Image names and frame names a layout tree draws. */
export function layoutArt(roots: readonly ShopNode[]): { images: Set<string>; frames: Set<string> } {
  const images = new Set<string>();
  const frames = new Set<string>();
  const visit = (node: ShopNode) => {
    const series = attr(node, "autoLoadImage");
    if (series) for (const name of imageSeries(series)) images.add(name);
    const texture = attr(node, "texture") ?? attr(node, "image");
    if (texture) images.add(texture);
    const frame = attr(node, "frame") ?? (node.name === "Edit" ? "DefaultEdit" : undefined);
    if (node.name === "TextButton") frames.add(textButtonStyle(node).frameName);
    else if (frame) frames.add(frame);
    const listFrame = attr(node, "listFrame");
    if (listFrame) frames.add(listFrame);
    for (const child of node.children) visit(child);
  };
  for (const root of roots) visit(root);
  return { images, frames };
}

export interface ShopArt {
  /** CSS custom properties for the shop root. */
  readonly properties: ReadonlyMap<string, string>;
  /** Natural sizes of the loaded images. */
  readonly sizes: ReadonlyMap<string, { width: number; height: number }>;
}

interface Decoded { canvas: HTMLCanvasElement; width: number; height: number }

function find(library: ShopArtLibrary, roots: readonly string[], name: string,
  extension = ".png"): ShopArtEntry | undefined {
  try {
    return U1(library, [...roots], name, extension) as ShopArtEntry;
  } catch {
    return undefined;
  }
}

async function decode(entry: ShopArtEntry): Promise<Decoded> {
  const image = await p2(await entry.bytes()) as { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(
    new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return { canvas, width: image.width, height: image.height };
}

async function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  return blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png");
}

/** Corner sizes of a frame's 9-slice source: the widest of its caption, side and bottom margins. */
export function frameSlices(frame: ShopFrame): { top: number; right: number; bottom: number; left: number } {
  return {
    top: frame.caption.height,
    bottom: frame.bottom.height,
    left: Math.max(frame.captionLeftMargin, frame.left.width, frame.bottomLeftMargin),
    right: Math.max(frame.captionRightMargin, frame.right.width, frame.bottomRightMargin),
  };
}

/**
 * The frame as a 9-slice source: generated C9 (the release frame painter)
 * draws it at its corner sizes plus a 2 px stretchable middle, which CSS
 * border-image then stretches like C9 stretches the original.
 */
function paintFrame(frame: ShopFrame, texture: CanvasImageSource): HTMLCanvasElement {
  const { top, right, bottom, left } = frameSlices(frame);
  const canvas = document.createElement("canvas");
  canvas.width = left + 2 + right;
  canvas.height = top + 2 + bottom;
  const context = canvas.getContext("2d")!;
  C9(context, frame, texture, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  return canvas;
}

const cache = new WeakMap<object, Promise<ShopArt>>();
const fonts = new WeakMap<object, Promise<string | undefined>>();

/**
 * Registers gui_/font/SourceHanSansCN-Bold.otf (the CN FtFonts' face) once per
 * library, as weight 700 so bold text uses it unsynthesised and the system
 * fallback fonts get their real bold. Resolves the family, or undefined.
 */
export function loadShopFont(library: ShopArtLibrary): Promise<string | undefined> {
  let pending = fonts.get(library);
  if (!pending) {
    pending = (async () => {
      const font = find(library, ["gui_/font"], "SourceHanSansCN-Bold", ".otf");
      if (!font || typeof FontFace !== "function") return undefined;
      try {
        const face = new FontFace(SHOP_FONT_FAMILY, (await font.bytes()).slice().buffer, { weight: "700" });
        await face.load();
        document.fonts.add(face);
        return SHOP_FONT_FAMILY;
      } catch {
        return undefined;
      }
    })();
    fonts.set(library, pending);
  }
  return pending;
}

/** Every image and frame the shop layouts draw, plus the art the shop places itself. */
export function shopArtRequest(): { images: Set<string>; frames: Set<string> } {
  const art = layoutArt([STAGE_WINDOW, ...Object.values(SHOP_CARDS), SHOP_CARD_TIP,
    STOCK_COMBO_ITEM, BUY_DIALOG, TC_CASH_WINDOW, TC_CASH_SLOT]);
  // Card eventTag marks (shopCat shopMark), the tcCash window, the combo's drop-down arrow.
  for (const name of [...SHOP_MARK_IMAGES, ...SPEND_EVENT_IMAGES, "dropDownButton"])
    art.images.add(name);
  // ScrollBar and ComboBox defaults.
  for (const name of ["DefaultVerticalScrollArea", "DefaultVerticalScrollButton",
    "ComboInnerDropDownButton", "DefaultEdit", "ComboSelectButton"])
    art.frames.add(name);
  return art;
}

/**
 * Loads (once per library) the shop's images and frames. Missing pieces are
 * skipped.
 */
export function loadShopArt(library: ShopArtLibrary): Promise<ShopArt> {
  let pending = cache.get(library);
  if (!pending) {
    const request = shopArtRequest();
    pending = load(library, [...request.images], [...request.frames]);
    cache.set(library, pending);
    // A failed load may be retried by the next shop.
    pending.catch(() => cache.delete(library));
  }
  return pending;
}

const layoutCache = new WeakMap<object, Map<string, Promise<ShopArt>>>();

/**
 * Loads (once per library and request) the images and frames of other
 * original layouts the same way (the lottery screens): images are looked
 * up in roots, frames in gui_/monocoque. Missing pieces are skipped.
 */
export function loadLayoutArt(library: ShopArtLibrary, roots: readonly string[], images: Iterable<string>,
  frames: Iterable<string> = []): Promise<ShopArt> {
  const imageList = [...new Set(images)].sort();
  const frameList = [...new Set(frames)].sort();
  const key = JSON.stringify([roots, imageList, frameList]);
  let byKey = layoutCache.get(library);
  if (!byKey) layoutCache.set(library, byKey = new Map());
  let pending = byKey.get(key);
  if (!pending) {
    pending = load(library, imageList, frameList, roots);
    byKey.set(key, pending);
    pending.catch(() => byKey!.delete(key));
  }
  return pending;
}

async function load(library: ShopArtLibrary, images: readonly string[],
  frames: readonly string[], roots: readonly string[] = SHOP_ART_ROOTS): Promise<ShopArt> {
  const properties = new Map<string, string>();
  const sizes = new Map<string, { width: number; height: number }>();
  await Promise.all(images.map(async name => {
    const entry = find(library, roots, name);
    if (!entry) return;
    try {
      const decoded = await decode(entry);
      sizes.set(name, { width: decoded.width, height: decoded.height });
      properties.set(imageVar(name), `url("${await canvasUrl(decoded.canvas)}")`);
    } catch { /* Keep the CSS fallback for this image. */ }
  }));
  const textures = new Map<string, Promise<Decoded | undefined>>();
  const texture = (name: string) => {
    let entry = textures.get(name);
    if (!entry) {
      const source = find(library, [FRAME_ROOT], name);
      entry = source ? decode(source).catch(() => undefined) : Promise.resolve(undefined);
      textures.set(name, entry);
    }
    return entry;
  };
  await Promise.all(frames.map(async name => {
    const states = SHOP_FRAMES.get(name) ?? [];
    await Promise.all(states.map(async (frame, state) => {
      const image = await texture(frame.texture);
      if (!image) return;
      try {
        const slices = frameSlices(frame);
        properties.set(frameVar(name, state, "image"), `url("${await canvasUrl(paintFrame(frame, image.canvas))}")`);
        properties.set(frameVar(name, state, "slice"),
          `${slices.top} ${slices.right} ${slices.bottom} ${slices.left}${frame.clientType === "none" ? "" : " fill"}`);
        properties.set(frameVar(name, state, "width"),
          `${slices.top}px ${slices.right}px ${slices.bottom}px ${slices.left}px`);
      } catch { /* This frame state stays plain. */ }
    }));
  }));
  return { properties, sizes };
}
