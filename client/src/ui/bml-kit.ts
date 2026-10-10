import { p2, T, s2 } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import { readMainMenuStrings, type MainMenuNode } from "./main-menu-view";
import { pruneMissingTextures } from "./story-windows";

/**
 * Helpers for release BML windows drawn by the shared window renderer
 * (generated te): tree edits that keep the renderer's node identity rules
 * (it hands the state callback the very nodes of the final tree), string
 * bags, the attributes it does not load, row templates and canvas text.
 * Used by the 俱乐部 pages and the taskbar menus (奖励箱, 任务, 迷你提示窗,
 * 聊天, 车手信息).
 */

export interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface BmlLibrary { canonicalCandidates(path: string): ResourceFile[] }
export interface Node { name: string; attributes: Array<{ name: string; value: string }>; children: Node[] }
export interface Texture { image: CanvasImageSource; width: number; height: number }
export type Rect = { x: number; y: number; width: number; height: number };
export type NodeState = Record<string, unknown>;

/** What te.load returns. */
export interface WindowView {
  readonly element: HTMLElement;
  readonly hoveredRegionId?: string;
  render(): void;
  show(): void;
  focus(name?: string): void;
  dispose(): void;
}

export const FONT = "'KartSim Main Menu', 'PingFang SC', 'Microsoft YaHei', sans-serif";

export const attribute = (node: Node, name: string): string | undefined => T(node, name) as string | undefined;
export const nodeName = (node: Node): string => attribute(node, "name") ?? "";

/** A node built in code. */
export function node(name: string, attributes: Record<string, string>, children: Node[] = []): Node {
  return { name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children };
}

export function withAttributes(target: Node, changes: Record<string, string | undefined>): Node {
  const attributes = target.attributes.filter(entry => !(entry.name in changes));
  for (const [key, value] of Object.entries(changes))
    if (value !== undefined) attributes.push({ name: key, value });
  return { ...target, attributes };
}

export function mapTree(target: Node, change: (node: Node) => Node | undefined): Node {
  const changed = change(target) ?? target;
  return { ...changed, children: changed.children.map(child => mapTree(child, change)) };
}

export function clone(target: Node): Node {
  return { name: target.name, attributes: target.attributes.map(entry => ({ ...entry })),
    children: target.children.map(clone) };
}

export function exists(library: BmlLibrary, roots: string[], name: string): boolean {
  try {
    U1(library, roots, name);
    return true;
  } catch {
    return false;
  }
}

/** Replace "#sb(key)" texts the window loader cannot resolve (dialog string bags). */
export function resolveStrings(definition: Node, strings: Map<string, string>): Node {
  return mapTree(definition, entry => {
    const changes: Record<string, string> = {};
    for (const key of ["text", "caption"]) {
      const raw = attribute(entry, key);
      if (!raw?.includes("#sb(")) continue;
      // Every key must be known; otherwise the window loader's bag resolves it.
      let known = true;
      const value = raw.replace(/#sb\(([^)]+)\)/g, (whole, name: string) => {
        const found = strings.get(name);
        if (found === undefined) known = false;
        return found ?? whole;
      });
      if (known) changes[key] = value;
    }
    return Object.keys(changes).length ? withAttributes(entry, changes) : undefined;
  });
}

/**
 * Release attributes the shared renderer does not load: autoLoadNoDisable
 * (three states) becomes autoLoadImage when four exist, else the first
 * state; autoImage radio boxes are painted instead.
 */
export function prepare(library: BmlLibrary, definition: Node, roots: string[]): Node {
  const adapted = mapTree(definition, entry => {
    const noDisable = attribute(entry, "autoLoadNoDisable");
    if (noDisable) {
      const states = [1, 2, 3, 4].map(index => `${noDisable}${index}`);
      return withAttributes(entry, states.every(name => exists(library, roots, name))
        ? { autoLoadNoDisable: undefined, autoLoadImage: noDisable }
        : { autoLoadNoDisable: undefined, texture: exists(library, roots, states[0]!) ? states[0] : undefined });
    }
    if (attribute(entry, "autoImage")) return withAttributes(entry, { autoImage: undefined });
    // A Container's text is its tooltip (altText beside it), not a caption.
    if (entry.name === "Container" && attribute(entry, "text"))
      return withAttributes(entry, { text: undefined, altText: undefined });
    return undefined;
  });
  return pruneMissingTextures(library as never, adapted as never, roots) as unknown as Node;
}

/** Copies a row template into each grid window "<prefix><i>". */
export function fillRows(definition: Node, prefix: string, template: Node): Node {
  const pattern = new RegExp(`^${prefix}\\d+$`);
  return mapTree(definition, entry => pattern.test(nodeName(entry))
    ? { ...entry, children: [...entry.children, clone(template)] } : undefined);
}

/**
 * Index the nodes under each "<prefix><i>" window of the final tree by i
 * (the renderer hands the state callback these very nodes).
 */
export function indexRows(definition: Node, prefix: string, rows: WeakMap<Node, number>): void {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const walk = (entry: Node, row: number | undefined): void => {
    const match = pattern.exec(nodeName(entry));
    const index = match ? Number(match[1]) : row;
    if (index !== undefined) rows.set(entry, index);
    entry.children.forEach(child => walk(child, index));
  };
  walk(definition, undefined);
}

/** Every node under the window named `name`. */
export function nodesUnder(definition: Node, name: string): WeakSet<Node> {
  const found = new WeakSet<Node>();
  const walk = (entry: Node, inside: boolean): void => {
    const here = inside || nodeName(entry) === name;
    if (here) found.add(entry);
    entry.children.forEach(child => walk(child, here));
  };
  walk(definition, false);
  return found;
}

/** Closing punctuation never starts a line; it hangs at the end of the previous one. */
const HANGING = new Set([..."，。、；：？！）》」』】,.;:?!)%"]);

/** Lines of text wrapped to a width ("|" and "\n" break lines). */
export function wrapText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\||\n/)) {
    let current = "";
    for (const character of paragraph) {
      if (current && !HANGING.has(character) && context.measureText(current + character).width > width) {
        lines.push(current);
        current = "";
      }
      current += character;
    }
    lines.push(current);
  }
  return lines;
}

export interface PaintTextOptions {
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  outline?: boolean;
  middle?: boolean;
  lineGap?: number;
  bold?: boolean;
}

/** A state painting wrapped text in the node's rectangle. */
export function paintText(text: string, options: PaintTextOptions) {
  return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) => {
    const size = options.size ?? 14;
    context.save();
    context.font = `${options.bold ? "bold " : ""}${size}px ${FONT}`;
    context.textBaseline = "top";
    const lines = wrapText(context, text, rect.width);
    const step = size + (options.lineGap ?? 4);
    const top = options.middle ? rect.y + (rect.height - lines.length * step) / 2 : rect.y;
    const align = options.align ?? "left";
    context.textAlign = align;
    const x = align === "center" ? rect.x + rect.width / 2 : align === "right" ? rect.x + rect.width : rect.x;
    lines.forEach((line, index) => {
      if (options.outline) {
        context.lineWidth = 3;
        context.strokeStyle = "rgba(0,0,0,.8)";
        context.strokeText(line, x, top + index * step);
      }
      context.fillStyle = options.color ?? "rgb(42,55,80)";
      context.fillText(line, x, top + index * step);
    });
    context.restore();
  } };
}

/** A decoded BML file of a folder. */
export async function loadBml(library: BmlLibrary, folder: string, name: string): Promise<Node> {
  return s2(await (U1(library, [folder], name, ".bml") as ResourceFile).bytes()) as Node;
}

/** A string bag's cn texts (empty when the folder has none). */
export async function loadStrings(library: BmlLibrary, folder: string, bag: string): Promise<Map<string, string>> {
  try {
    return readMainMenuStrings(await loadBml(library, folder, bag) as unknown as MainMenuNode);
  } catch {
    return new Map();
  }
}

/** "%s" / "%d" / "%.1f" placeholders in order. */
export function formatSb(template: string, ...values: Array<string | number>): string {
  let index = 0;
  return template.replace(/%(?:\.(\d))?([sdf])/g, (_whole, digits: string | undefined, kind: string) => {
    const value = values[index++];
    if (value === undefined) return "";
    if (kind === "f") return Number(value).toFixed(digits ? Number(digits) : 1);
    return kind === "d" ? String(Math.trunc(Number(value))) : String(value);
  });
}

/**
 * PNG images by resource path or by name under roots, decoded once; the
 * first request starts the load and `changed` runs when it is ready.
 */
export class ImageCache {
  private readonly pending = new Map<string, Promise<Texture | undefined>>();
  private readonly loaded = new Map<string, Texture | null>();

  constructor(private readonly library: BmlLibrary, private readonly changed: () => void) {}

  /** etc_/… style full path. */
  path(path: string): Texture | undefined {
    return this.get(path, () => this.library.canonicalCandidates(path)[0]);
  }

  /** A name found under roots (U1 order: @cn before @zz). */
  named(roots: string[], name: string): Texture | undefined {
    return this.get(`${roots.join(",")}:${name}`, () => {
      try {
        return U1(this.library, roots, name) as ResourceFile;
      } catch {
        return undefined;
      }
    });
  }

  get(key: string, file: () => ResourceFile | undefined): Texture | undefined {
    const ready = this.loaded.get(key);
    if (ready !== undefined) return ready ?? undefined;
    if (!this.pending.has(key)) {
      const load = Promise.resolve().then(async () => {
        const entry = file();
        if (!entry) return undefined;
        const decoded = await p2(await entry.bytes()) as { width: number; height: number; pixels: ArrayLike<number> };
        const canvas = document.createElement("canvas");
        canvas.width = decoded.width;
        canvas.height = decoded.height;
        canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels),
          decoded.width, decoded.height), 0, 0);
        return { image: canvas, width: decoded.width, height: decoded.height };
      }).catch(() => undefined);
      this.pending.set(key, load);
      void load.then(texture => {
        this.loaded.set(key, texture ?? null);
        if (texture) this.changed();
      });
    }
    return undefined;
  }
}

/** Draw an image fitted (contained) and centred in rect. */
export function drawFitted(context: CanvasRenderingContext2D, image: Texture, rect: Rect, maxScale = Infinity): void {
  const scale = Math.min(rect.width / image.width, rect.height / image.height, maxScale);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image.image, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width, height);
}

/**
 * Clip a non-modal window's full-stage element to the stage rectangles it
 * draws, so the page under it keeps its pointer events elsewhere.
 */
export function clipToStage(element: HTMLElement, rects: Rect[]): void {
  if (!rects.length) {
    element.style.clipPath = "inset(100% 0 0 0)";
    return;
  }
  if (rects.length === 1) {
    const rect = rects[0]!;
    element.style.clipPath = `inset(${rect.y / 9}% ${100 - (rect.x + rect.width) / 16}% ${
      100 - (rect.y + rect.height) / 9}% ${rect.x / 16}%)`;
    return;
  }
  // Several rectangles: one polygon that visits each from the origin and
  // returns along the same edge (the joins enclose no area).
  const points = rects.flatMap(rect => {
    const left = rect.x / 16, top = rect.y / 9;
    const right = (rect.x + rect.width) / 16, bottom = (rect.y + rect.height) / 9;
    return ["0% 0%", `${left}% ${top}%`, `${right}% ${top}%`, `${right}% ${bottom}%`, `${left}% ${bottom}%`,
      `${left}% ${top}%`];
  });
  element.style.clipPath = `polygon(nonzero, ${points.join(", ")}, 0% 0%)`;
}
