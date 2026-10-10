import { CanvasHitController, type CanvasHitRegion } from "./canvas-hit-controller";
import { C9, E9, Ft, G1, T, V0, f3, f5, m9, st, ve } from "../generated/formats.js";
import { F9, U1 } from "../generated/library.js";
import { ImageCache, type MyRoomDataLibrary } from "../myroom/myroom-data";
import { myRoomHudColor, myRoomHudTextRender, readMyRoomStringBag, type MyRoomHudNode } from "./my-room-hud";

/**
 * A release BML window drawn on one canvas (1600×900 stage stretched over
 * the root, like the My Room windows): layout with the monocoque frames
 * (gui_/monocoque frame.bml: CaptionDialog, TextButton, DefaultEdit …),
 * textures from the window's folders (@zz names try @cn first), #sb()
 * strings, image and text buttons with their hover/press states, and
 * hooks for the nodes a window draws itself.
 */

export type BmlNode = MyRoomHudNode;
export type Rect = { x: number; y: number; width: number; height: number };

export interface BmlLibrary extends MyRoomDataLibrary {
  canonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array>; text?(): Promise<string> }>;
}

interface Frame {
  texture: string;
  caption: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
}

export interface BmlShared {
  library: BmlLibrary;
  frames: Map<string, Frame[]>;
  strings: Map<string, string>;
  fontFamily: string;
  font: FontFace;
}

export const STAGE: Rect = { x: 0, y: 0, width: 1600, height: 900 };

/** The controls that draw their text (a Container's text attribute is not shown). */
const TEXT_NODES = new Set(["Label", "ColorLabel", "TextButton", "ImageButton", "ImageBoardButton", "Edit"]);

const attribute = (node: BmlNode, name: string): string | undefined => T(node, name) as string | undefined;

/** etc_/baseStringBag.xml (cn), the strings every window may name. */
async function baseStrings(library: BmlLibrary): Promise<Map<string, string>> {
  const strings = new Map<string, string>();
  const file = library.canonicalCandidates("etc_/baseStringBag.xml")[0];
  const xml = file?.text ? await file.text() : "";
  for (const match of xml.matchAll(/<k n=['"]([^'"]+)['"]>([\s\S]*?)<\/k>/g)) {
    const cn = /<m c=['"]cn['"] v=(?:'([^']*)'|"([^"]*)")/.exec(match[2]!);
    if (cn) strings.set(match[1]!, (cn[1] ?? cn[2] ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'"));
  }
  return strings;
}

/** Frames, strings (base bag, then each [folder, bag] in order) and the font of a set of windows. */
export async function loadBmlShared(library: BmlLibrary, fontFamily: string,
  bags: ReadonlyArray<[string, string]>): Promise<BmlShared> {
  const [frameTree, base, fontBytes, ...bagNodes] = await Promise.all([
    F9(library, "gui_/monocoque", "frame") as Promise<BmlNode>,
    baseStrings(library),
    (U1(library, ["gui_/font"], "SourceHanSansCN-Bold", ".otf") as { bytes(): Promise<Uint8Array> }).bytes(),
    ...bags.map(([folder, name]) => F9(library, folder, name) as Promise<BmlNode>),
  ]);
  const frames = new Map<string, Frame[]>();
  for (const entry of frameTree.children) {
    try {
      frames.set(entry.name, entry.children.map(state => Ft(state) as Frame));
    } catch { /* A clientType the painter does not know: not used by these windows. */ }
  }
  const strings = new Map(base);
  for (const bag of bagNodes) for (const [key, value] of readMyRoomStringBag(bag)) strings.set(key, value);
  const font = await f5(fontFamily, fontBytes);
  return { library, frames, strings, fontFamily, font };
}

export function releaseBmlShared(shared: BmlShared): void { G1(shared.font); }

/** What a hook makes of a node that reacts to the pointer. */
export interface BmlButton {
  activate(): void;
  disabled?: boolean;
  /** Drawn in its pressed state (a chosen tab). */
  selected?: boolean;
  label?: string;
  /** The hit region's key (the node name by default). */
  key?: string;
}

export interface BmlHooks {
  /** false hides the node, true shows it, undefined keeps its visible attribute. */
  visible?(node: BmlNode, name: string): boolean | undefined;
  /** Draws the node itself; true skips the default drawing and the children. */
  draw?(node: BmlNode, name: string, rect: Rect): boolean | void;
  /** After the default drawing, before the children. */
  after?(node: BmlNode, name: string, rect: Rect): void;
  /** A label's text: undefined uses the BML text, null draws none. */
  label?(node: BmlNode, name: string): string | null | undefined;
  /** Makes the node a button. */
  button?(node: BmlNode, name: string): BmlButton | undefined;
  /** An image to draw instead of the node's texture. */
  image?(node: BmlNode, name: string): CanvasImageSource | undefined;
}

export interface BmlCanvasOptions {
  root: HTMLElement;
  shared: BmlShared;
  /** Texture folders in lookup order. */
  folders: readonly string[];
  label: string;
  zIndex?: string;
  /** Draws the window's layers with drawTree. */
  paint(canvas: BmlCanvas): void;
  onKeyDown?(event: KeyboardEvent): void;
  onWheel?(event: WheelEvent, point: { x: number; y: number }): void;
}

export class BmlCanvas {
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly context: CanvasRenderingContext2D;
  readonly images: ImageCache;
  hovered?: string;
  pressed?: string;
  /** The pointer in stage coordinates. */
  pointer?: { x: number; y: number };
  private readonly hits: CanvasHitController<string>;
  private readonly observer?: ResizeObserver;
  private readonly textures = new Map<string, string | null>();
  private regions: Array<CanvasHitRegion<string>> = [];
  private disposed = false;
  private warned = false;
  private readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;

  constructor(readonly options: BmlCanvasOptions) {
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建窗口画布");
    this.context = context;
    this.images = new ImageCache(options.shared.library, () => this.render());
    this.element.dataset.uiLayer = "dialog";
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", options.label);
    this.element.tabIndex = -1;
    Object.assign(this.element.style, { position: "absolute", inset: "0", zIndex: options.zIndex ?? "3" });
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    this.element.append(this.canvas);
    options.root.append(this.element);
    this.hits = new CanvasHitController(this.canvas, this.element, () => STAGE, (hovered, pressed) => {
      this.hovered = hovered;
      this.pressed = pressed;
      this.render();
    });
    this.canvas.addEventListener("pointermove", this.onPointer);
    this.canvas.addEventListener("pointerdown", this.onPointer);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.element.addEventListener("keydown", this.onKeyDown);
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.render());
      this.observer.observe(options.root);
    }
  }

  get shared(): BmlShared { return this.options.shared; }
  get isDisposed(): boolean { return this.disposed; }

  focus(): void { this.element.focus(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.hits.dispose();
    this.canvas.removeEventListener("pointermove", this.onPointer);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.element.remove();
    this.previousFocus?.isConnected && this.previousFocus.focus();
  }

  text(key: string): string | undefined { return this.shared.strings.get(key); }

  /** A release texture of the window's folders: the cn variant of an @zz name first. */
  texture(name: string | undefined): HTMLCanvasElement | undefined {
    if (!name) return undefined;
    let path = this.textures.get(name);
    if (path === undefined) {
      const names = name.includes("@zz") ? [name.replace("@zz", "@cn"), name, name.replace("@zz", "")] : [name];
      path = null;
      search: for (const folder of [...this.options.folders, "gui_/monocoque"]) {
        for (const candidate of names) {
          const file = `${folder}/${candidate}.png`;
          if (this.shared.library.canonicalCandidates(file).length > 0) {
            path = file;
            break search;
          }
        }
      }
      this.textures.set(name, path);
    }
    return path ? this.images.get(path) : undefined;
  }

  /** The sprite of an autoLoadImage series ("…_@zz" or "…_") for state 0-3. */
  seriesSprite(series: string, state: number): HTMLCanvasElement | undefined {
    return this.texture(series.replace(/(@zz)?$/, `${state + 1}$1`));
  }

  frame(name: string, state = 0): Frame | undefined {
    const states = this.shared.frames.get(name);
    return states?.[Math.min(state, states.length - 1)];
  }

  /** Draws a monocoque frame; undefined until its texture loads. */
  drawFrame(name: string, state: number, rect: Rect): void {
    const frame = this.frame(name, state);
    const image = frame && this.images.get(`gui_/monocoque/${frame.texture}.png`);
    if (frame && image) C9(this.context, frame, image, rect);
  }

  /** A hit region for this frame. */
  addButton(key: string, rect: Rect, label: string, activate: () => void, disabled = false): void {
    this.regions.push({ key, rect, label, disabled, activate });
  }

  /** The state index (0 normal, 1 hover, 2 pressed, 3 disabled) of a button key. */
  state(key: string, disabled = false, selected = false): number {
    return disabled ? 3 : selected ? 2 : st(key, this.hovered, this.pressed);
  }

  render(): void {
    if (this.disposed) return;
    const width = this.options.root.clientWidth;
    const height = this.options.root.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.setTransform(width / STAGE.width * ratio, 0, 0, height / STAGE.height * ratio, 0, 0);
    this.regions = [];
    this.options.paint(this);
    this.hits.update(this.regions);
  }

  /** Lays a node out in parent (its frame's insets included). */
  layout(node: BmlNode, parent: Rect): Rect {
    const series = attribute(node, "autoLoadImage") ?? attribute(node, "autoLoadImageBoard");
    const image = this.texture(attribute(node, "image") ?? attribute(node, "texture")) ??
      (series ? this.seriesSprite(series, 0) : undefined);
    const position = attribute(node, "leftTopWH")?.trim().split(/\s+/);
    const layout = attribute(node, "listFrame") || position?.length === 2
      ? { ...node, attributes: node.attributes.filter(item => item.name !== "listFrame")
        .map(item => item.name === "leftTopWH" && position?.length === 2
          ? { ...item, value: `${position.join(" ")} ${parent.width} ${parent.height}` } : item) }
      : node;
    return V0(layout, parent, this.nodeFrame(node), image
      ? { image, width: image.width, height: image.height } : undefined) as Rect;
  }

  private nodeFrame(node: BmlNode, state = 0): Frame | undefined {
    const name = attribute(node, "frame") ?? (node.name === "TextButton" ? "TextButton" : undefined);
    return name ? this.frame(name, state) : undefined;
  }

  /** Draws a BML tree in parent with the window's hooks. */
  drawTree(node: BmlNode, parent: Rect, hooks: BmlHooks = {}): void {
    try {
      this.drawNode(node, parent, hooks);
    } catch (error) {
      if (!this.warned) console.warn("窗口控件绘制失败", attribute(node, "name") ?? node.name, error);
      this.warned = true;
    }
  }

  private drawNode(node: BmlNode, parent: Rect, hooks: BmlHooks): void {
    const name = attribute(node, "name") ?? "";
    if (node.name === "Skip" || node.name === "StringBag") return;
    const shown = hooks.visible?.(node, name);
    if (shown === false || (shown === undefined && attribute(node, "visible") === "false")) return;
    const rect = this.layout(node, parent);
    if (hooks.draw?.(node, name, rect)) return;
    const context = this.context;
    const color = attribute(node, "color");
    const frameName = attribute(node, "frame") ?? (node.name === "TextButton" ? "TextButton" : undefined);
    if (color && !attribute(node, "texture") && !attribute(node, "image") &&
        (node.name === "Panel" || node.name === "Window") && !frameName) {
      context.fillStyle = myRoomHudColor(color);
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    const button = hooks.button?.(node, name);
    const key = button?.key ?? name;
    const state = button ? this.state(key, button.disabled, button.selected) : 0;
    if (frameName) {
      const frame = this.frame(frameName, frameName === "CaptionDialog" ? 0 : state);
      const image = frame && this.images.get(`gui_/monocoque/${frame.texture}.png`);
      if (frame && image) C9(context, frame, image, rect);
    }
    const series = attribute(node, "autoLoadImage") ?? attribute(node, "autoLoadImageBoard");
    const override = hooks.image?.(node, name);
    if (override) this.drawImage(override, rect, node);
    else if (series) {
      const sprite = this.seriesSprite(series, state) ?? this.seriesSprite(series, 0);
      if (sprite) context.drawImage(sprite, rect.x, rect.y, rect.width, rect.height);
    } else if (node.name !== "CharPanel") {
      const image = this.texture(attribute(node, "image") ?? attribute(node, "texture"));
      if (image) this.drawImage(image, rect, node);
    }
    if (node.name === "CaptionWindow" && frameName) {
      const frame = this.frame(frameName);
      const caption = attribute(node, "caption");
      const text = caption && (/^#sb\(([^)]+)\)$/.exec(caption)?.[1] ? this.text(/^#sb\(([^)]+)\)$/.exec(caption)![1]!)
        : caption);
      const custom = hooks.label?.(node, name);
      const shownCaption = custom === null ? undefined : custom ?? text;
      if (frame && shownCaption) {
        const position = (attribute(node, "captionPos") ?? "0 0").split(/\s+/).map(Number);
        m9(context, shownCaption, f3(frame, rect, { x: position[0] ?? 0, y: position[1] ?? 0 }), {
          family: this.shared.fontFamily, size: 20, kind: "button", color: "white", align: "center",
          verticalAlign: "center", stroke: 0, strokeColor: "black" });
      }
    }
    hooks.after?.(node, name, rect);
    if (TEXT_NODES.has(node.name)) {
      const label = this.label(node, name, hooks);
      if (label) this.drawLabel(node, label, frameName ? E9(this.nodeFrame(node) ?? this.frame(frameName)!, rect) : rect,
        button ? state : 0);
    }
    if (button) this.addButton(key, rect, button.label ?? this.label(node, name, hooks) ?? name,
      () => button.activate(), button.disabled);
    const frame = frameName ? this.frame(frameName) : undefined;
    const inner = frame && frameName !== "HSection" && frameName !== "VSection" ? E9(frame, rect) : rect;
    for (const child of node.children) this.drawTree(child, inner, hooks);
  }

  drawImage(image: CanvasImageSource, rect: Rect, node?: BmlNode): void {
    const uv = node ? attribute(node, "uvRect")?.split(/\s+/).map(Number) : undefined;
    if (uv?.length === 4)
      this.context.drawImage(image, uv[0]!, uv[1]!, uv[2]! - uv[0]!, uv[3]! - uv[1]!, rect.x, rect.y, rect.width,
        rect.height);
    else this.context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }

  /** Fits image into rect keeping its aspect (scale capped at max). */
  drawFitted(image: CanvasImageSource | undefined, rect: Rect, max = 2): boolean {
    const source = image as { width?: number; height?: number } | undefined;
    if (!image || !source?.width || !source.height) return false;
    const scale = Math.min(rect.width / source.width, rect.height / source.height, max);
    const width = source.width * scale;
    const height = source.height * scale;
    this.context.drawImage(image, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width,
      height);
    return true;
  }

  private label(node: BmlNode, name: string, hooks: BmlHooks): string | undefined {
    const custom = hooks.label?.(node, name);
    if (custom === null) return undefined;
    if (custom !== undefined) return custom;
    const raw = attribute(node, "text");
    if (!raw) return undefined;
    const key = /^#sb\(([^)]+)\)$/.exec(raw)?.[1];
    if (key) return this.text(key);
    // Template placeholders (Korean samples, "0(-)", "000") are not shown.
    return /[가-힣]|^\[?\w+\]?$|^0\(-\)$|^\s*$/.test(raw) && !/^\d+$/.test(raw) ? undefined : raw;
  }

  /** Draws a label of a node with its textRender, colors and textAlign. */
  drawLabel(node: BmlNode, text: string, rect: Rect, state = 0): void {
    const alignment = (attribute(node, "textAlign") ?? (node.name === "TextButton" ? "center" : "")).toLowerCase();
    const render = myRoomHudTextRender(attribute(node, "textRender"));
    const colorAttribute = state === 1 ? attribute(node, "overTextColor") ?? attribute(node, "textColor")
      : state === 2 ? attribute(node, "clickedTextColor") ?? attribute(node, "textColor")
        : state === 3 ? attribute(node, "disabledTextColor") ?? attribute(node, "textColor")
          : attribute(node, "textColor");
    const center = node.name === "TextButton" || node.name === "ImageButton" || alignment === "center" ||
      alignment.includes("hcenter") || (alignment.includes("center") && !alignment.includes("vcenter"));
    this.drawRich(text, rect, {
      size: render.size, stroke: render.stroke,
      color: myRoomHudColor(colorAttribute, "white"),
      strokeColor: myRoomHudColor(attribute(node, "textColor2"), "black"),
      align: alignment.includes("right") ? "right" : alignment.includes("left") ? "left" : center ? "center" : "left",
      verticalAlign: alignment.includes("vcenter") || alignment === "center" || node.name === "TextButton" ||
        node.name === "ImageButton" ? "center" : "top",
    });
  }

  /**
   * Text with the release markup: "|" breaks lines, [color:a r g b]…[/color]
   * colors a run.
   */
  drawRich(text: string, rect: Rect, style: { size: number; color: string; align: "left" | "center" | "right";
    verticalAlign: "top" | "center"; stroke?: number; strokeColor?: string }): void {
    const lines = text.split("|");
    const lineHeight = style.size + 6;
    const total = lines.length * lineHeight;
    let y = style.verticalAlign === "center" ? rect.y + (rect.height - total) / 2 : rect.y;
    const font = { family: this.shared.fontFamily, size: style.size };
    for (const line of lines) {
      const runs: Array<{ text: string; color: string }> = [];
      let rest = line;
      while (rest) {
        const open = /\[color:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(rest);
        if (!open) {
          runs.push({ text: rest, color: style.color });
          break;
        }
        if (open.index > 0) runs.push({ text: rest.slice(0, open.index), color: style.color });
        rest = rest.slice(open.index + open[0].length);
        const close = rest.indexOf("[/color]");
        const inner = close < 0 ? rest : rest.slice(0, close);
        runs.push({ text: inner, color: `rgba(${open[2]},${open[3]},${open[4]},${Number(open[1]) / 255})` });
        rest = close < 0 ? "" : rest.slice(close + "[/color]".length);
      }
      const widths = runs.map(run => (ve(this.context, run.text, font) as { width: number }).width);
      const width = widths.reduce((sum, value) => sum + value, 0);
      let x = style.align === "center" ? rect.x + (rect.width - width) / 2
        : style.align === "right" ? rect.x + rect.width - width : rect.x;
      runs.forEach((run, index) => {
        m9(this.context, run.text, { x, y, width: widths[index]! + 2, height: lineHeight }, {
          family: this.shared.fontFamily, size: style.size, kind: "label", color: run.color, align: "left",
          verticalAlign: "center", stroke: style.stroke ?? 0, strokeColor: style.strokeColor ?? "black" });
        x += widths[index]!;
      });
      y += lineHeight;
    }
  }

  private readonly onPointer = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.pointer = { x: (event.clientX - bounds.left) * STAGE.width / bounds.width,
      y: (event.clientY - bounds.top) * STAGE.height / bounds.height };
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.options.onWheel?.(event, { x: (event.clientX - bounds.left) * STAGE.width / bounds.width,
      y: (event.clientY - bounds.top) * STAGE.height / bounds.height });
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => this.options.onKeyDown?.(event);
}
