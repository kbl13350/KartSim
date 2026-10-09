import { T, V0, p2 } from "../generated/formats.js";
import { C8, F9, U1, _w, h2, te } from "../generated/library.js";
import { showLobbyMessageBox } from "../multiplayer/lobby-dialog-views";
import type { StoryChapter, StoryMission, StoryNode, StoryScenePage,
  StoryStep } from "../story/story-data";
import { PLAYABLE_STORY_MISSIONS } from "../story/story-data";
import { SCENE_ROOT, STORY_ROOT } from "../story/story-resources";
import type { StoryTrackCard } from "./story-track-card";

/**
 * The release story windows, drawn by the shared BML window renderer:
 * stage_scenarioSelect (the chapter map), stage_scenarioReady (one step) and
 * stage_scene (the dialogue before a race).
 */

interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface StoryWindowLibrary { canonicalCandidates(path: string): ResourceFile[] }
interface Texture { image: CanvasImageSource; width: number; height: number }
type Rect = { x: number; y: number; width: number; height: number };
interface WindowView {
  readonly element: HTMLElement;
  render(): void;
  show(): void;
  hide(): void;
  focus(name?: string): void;
  dispose(): void;
  disposed: boolean;
}

/** Keys go to the newest story window, not the one it opened over. */
function focusWindow(view: WindowView): void {
  view.element.tabIndex = -1;
  view.element.focus({ preventScroll: true });
}

const FONT = "'KartSim Main Menu', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const MAP_VIEW = { width: 764, height: 506 };

const name = (node: StoryNode): string => (T(node, "name") as string | undefined) ?? "";

function withAttributes(node: StoryNode, changes: Record<string, string | undefined>): StoryNode {
  const attributes = node.attributes.filter(entry => !(entry.name in changes));
  for (const [key, value] of Object.entries(changes))
    if (value !== undefined) attributes.push({ name: key, value });
  return { ...node, attributes };
}

function exists(library: StoryWindowLibrary, roots: string[], file: string,
  extension = ".png"): boolean {
  try {
    U1(library, roots, file, extension);
    return true;
  } catch {
    return false;
  }
}

/**
 * The renderer refuses a window whose art is missing; drop texture references
 * that the local resources do not have so the rest still draws.
 */
export function pruneMissingTextures(library: StoryWindowLibrary, node: StoryNode,
  roots: string[]): StoryNode {
  const series = T(node, "autoLoadImage") ?? T(node, "autoLoadImageBoard");
  const single = T(node, "texture") ?? T(node, "image");
  const changes: Record<string, string | undefined> = {};
  // The shared renderer (V0) refuses clientRect outright; on an unframed node
  // it is the same box as windowRect.
  const client = T(node, "clientRect");
  if (client && !T(node, "frame") && !T(node, "windowRect")) {
    changes.clientRect = undefined;
    changes.windowRect = client;
  }
  if (series && ![1, 2, 3, 4].every(index =>
    exists(library, roots, series.replace(/(@zz)?$/, `${index}$1`)))) {
    changes.autoLoadImage = undefined;
    changes.autoLoadImageBoard = undefined;
  }
  if (single && !exists(library, T(node, "resourceRoot") ? [T(node, "resourceRoot")!] : roots,
    single)) {
    changes.texture = undefined;
    changes.image = undefined;
  }
  const pruned = Object.keys(changes).length ? withAttributes(node, changes) : node;
  return { ...pruned, children: pruned.children.map(child =>
    pruneMissingTextures(library, child, roots)) };
}

function mapTree(node: StoryNode, change: (node: StoryNode) => StoryNode | undefined): StoryNode {
  const changed = change(node) ?? node;
  return { ...changed, children: changed.children.map(child => mapTree(child, change)) };
}

function findNode(node: StoryNode, wanted: string): StoryNode | undefined {
  if (name(node) === wanted) return node;
  for (const child of node.children) {
    const found = findNode(child, wanted);
    if (found) return found;
  }
  return undefined;
}

export async function decodeStoryTexture(file: ResourceFile, jpeg = false): Promise<Texture> {
  const bytes = await file.bytes();
  if (jpeg) {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/jpeg" }));
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const image = await p2(bytes) as { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(
    new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return { image: canvas, width: image.width, height: image.height };
}

/** Wrapped text inside a box, line by line; "\n" starts a new line. */
export function wrapStoryText(context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const character of paragraph) {
      if (current && context.measureText(current + character).width > width) {
        lines.push(current);
        current = "";
      }
      current += character;
    }
    lines.push(current);
  }
  return lines;
}

function paintText(context: CanvasRenderingContext2D, text: string, rect: Rect,
  style: { size: number; color: string; outline?: string; align?: "left" | "center" | "right";
    middle?: boolean; gap?: number; bold?: boolean }): void {
  context.save();
  context.font = `${style.bold === false ? "" : "bold "}${style.size}px ${FONT}`;
  const lineHeight = style.size + (style.gap ?? 6);
  const lines = wrapStoryText(context, text, rect.width - 4)
    .slice(0, Math.max(1, Math.floor(rect.height / lineHeight)));
  const total = lines.length * lineHeight;
  let y = rect.y + (style.middle ? Math.max(0, (rect.height - total) / 2) : 0) + style.size;
  context.textAlign = style.align ?? "left";
  const x = style.align === "center" ? rect.x + rect.width / 2
    : style.align === "right" ? rect.x + rect.width - 2 : rect.x + 2;
  context.lineJoin = "round";
  for (const line of lines) {
    if (style.outline) {
      context.strokeStyle = style.outline;
      context.lineWidth = 3;
      context.strokeText(line, x, y);
    }
    context.fillStyle = style.color;
    context.fillText(line, x, y);
    y += lineHeight;
  }
  context.restore();
}

/** The shared window renderer's label font. */
const WINDOW_FONT = "KartSim Multiplayer Windows";
/** Release label for chapters without a subtitle, stage_stringBag "chapter". */
const CHAPTER_LABEL = "章节";
let measureContext: CanvasRenderingContext2D | null | undefined;

/** Width of a label as the shared renderer draws it, glyph by glyph. */
export function windowTextWidth(text: string, size: number,
  measure: (text: string) => number = defaultMeasure(size)): number {
  return Array.from(text).reduce((width, character) => width + measure(character), 0);
}

function defaultMeasure(size: number): (text: string) => number {
  measureContext ??= typeof document === "undefined" ? null
    : document.createElement("canvas").getContext("2d");
  const context = measureContext;
  if (!context) return text => text.length * size;
  return text => {
    context.font = `${size}px "${WINDOW_FONT}"`;
    return context.measureText(text).width;
  };
}

const adjustX = (node: StoryNode | undefined): number =>
  Number(((T(node ?? { name: "", attributes: [], children: [] }, "adjust") as string | undefined)
    ?? "0").trim().split(/\s+/)[0]) || 0;

/**
 * "第一章 | 车手的诞生": the release slot before the divider holds two
 * characters ("章节"); push the divider and title right when the chapter
 * label is longer, keeping the release spacing.
 */
export function chapterHeaderShift(chapterX: number, divideX: number,
  labelWidth: number, gap = 12): number {
  return Math.max(0, Math.ceil(chapterX + labelWidth + gap - divideX));
}

/** States for the frame's "chapter", "divide" and "title" labels. */
function chapterHeader(definition: StoryNode, chapter: StoryChapter):
  (key: string) => Record<string, unknown> | undefined {
  const label = chapter.subTitle ?? CHAPTER_LABEL;
  const chapterX = adjustX(findNode(definition, "chapter"));
  const divideX = adjustX(findNode(definition, "divide"));
  let shift: number | undefined;
  // Measured on first draw, once the window font is registered.
  const offset = (): number => shift ??= chapterHeaderShift(chapterX, divideX,
    windowTextWidth(label, 20));
  return key => {
    switch (key) {
      case "chapter": return chapter.subTitle ? { text: chapter.subTitle } : {};
      case "divide": return { offsetX: offset() };
      case "title": return { text: chapter.title, offsetX: offset() };
    }
    return undefined;
  };
}

/** BML "A R G B" colours, as the shared renderer reads them. */
export function storyColor(value: string | undefined, fallback = "white"): string {
  const parts = value?.trim().split(/\s+/).map(Number);
  if (parts?.length === 4 && parts.every(Number.isFinite))
    return `rgba(${parts[1]},${parts[2]},${parts[3]},${parts[0]! / 255})`;
  return value ?? fallback;
}

/**
 * A multi-line Label drawn the way the shared renderer draws one line: its
 * textRender size, outline in textColor2, textColor, textAlign and lineGap,
 * glyph by glyph in the window font. The renderer itself does not wrap.
 */
function paintLabel(context: CanvasRenderingContext2D, node: StoryNode, text: string,
  rect: Rect): void {
  const render = (T(node, "textRender") as string | undefined) ?? "";
  const size = Number(/\d+/.exec(render)?.[0] ?? 16);
  const stroke = /^outline/.test(render) ? 1 : 0;
  const align = (T(node, "textAlign") as string | undefined) ?? "left";
  const horizontal = align.includes("hcenter") || align === "center" ? 0.5
    : align.includes("right") ? 1 : 0;
  const middle = align.includes("vcenter") || align === "center";
  const gap = Number(T(node, "lineGap") ?? 0) || 0;
  context.save();
  context.font = `${size}px "${WINDOW_FONT}"`;
  context.fontKerning = "none";
  const advance = (character: string): number => context.measureText(character).width + stroke * 2;
  const width = (line: string): number =>
    Array.from(line).reduce((total, character) => total + advance(character), 0);
  const lines = wrapStoryText({ measureText: (line: string) => ({ width: width(line) }) } as never,
    text, rect.width);
  const lineHeight = Math.trunc(1.448 * size) + stroke * 2 + gap;
  const ascent = Math.trunc(1.16 * size) + stroke;
  const visible = lines.slice(0, Math.max(1, Math.floor((rect.height + gap) / lineHeight)));
  let y = rect.y + (middle ? Math.max(0, (rect.height - (visible.length * lineHeight - gap)) / 2) : 0);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = stroke * 2;
  context.strokeStyle = storyColor(T(node, "textColor2") as string | undefined, "black");
  context.fillStyle = storyColor(T(node, "textColor") as string | undefined);
  for (const line of visible) {
    let x = Math.floor(rect.x + (rect.width - width(line)) * horizontal) + stroke;
    for (const character of line) {
      if (stroke) context.strokeText(character, x, y + ascent);
      context.fillText(character, x, y + ascent);
      x += advance(character);
    }
    y += lineHeight;
  }
  context.restore();
}

async function openWindow(options: {
  library: StoryWindowLibrary; root: HTMLElement; definition: StoryNode; roots: string[];
  label: string; state(node: StoryNode): Record<string, unknown>;
  onCancel(): void; onConfirm?(): void;
}): Promise<WindowView> {
  const view = await te.load({
    library: options.library, root: options.root, definition: options.definition,
    roots: options.roots, smoothImages: true, modal: true, label: options.label,
    onCancel: options.onCancel, onConfirm: options.onConfirm, state: options.state,
  }) as WindowView;
  view.show();
  focusWindow(view);
  return view;
}

/** The release message box, dialog2_customMessageBox, with one 确定 button. */
export async function openStoryMessage(options: {
  library: StoryWindowLibrary; root: HTMLElement; title: string; message: string;
  onClose(): void;
}): Promise<WindowView> {
  const dialog = await showLobbyMessageBox(
    () => ({ busy: false, view: undefined as unknown as WindowView }),
    { library: options.library, root: options.root, cancel: options.onClose },
    options.title, options.message, options.onClose, { yes: "确定" }, true, {
      loadMessageTemplate: library => _w(library),
      loadDefinition: (library, folder, file) => F9(library, folder, file),
      decorateDefinition: (library, definition, folder) => C8(library, definition, folder),
      clone: (node, attributes, children) => children === undefined
        ? h2(node, attributes) : h2(node, attributes, children),
      nodeName: node => T(node, "name") as string | undefined,
      loadView: loaded => te.load(loaded as never),
    });
  return dialog.view as WindowView;
}

// ---------------------------------------------------------------------------
// Chapter map (stage_scenarioSelect + <chapter>/scenarioSelect.bml)

export interface StoryMapOptions {
  library: StoryWindowLibrary;
  root: HTMLElement;
  chapter: StoryChapter;
  steps: readonly StoryStep[];
  map: StoryNode;
  isCleared(step: StoryStep): boolean;
  isOpen(step: StoryStep): boolean;
  /** An ending step is cleared (forks leave the other branch unplayed). */
  chapterCleared(): boolean;
  onStep(step: StoryStep): void;
  onClose(): void;
  onActivate?(): void;
}

export interface StoryMapWindow {
  render(): void;
  /** While the dialogue plays, which the release runs as its own stage. */
  hide(): void;
  show(): void;
  focus(): void;
  dispose(): void;
}


/** formats.js Nj: V0 lays a node out by the first of these it has. */
const LAYOUT_KEYS = ["windowRect", "clientRect", "leftTopTex", "leftTopWH",
  "windowSize", "clientSize"] as const;

/**
 * The rect the shared window renderer gives `node` inside `parent` (V0),
 * before state.offsetX. V0 refuses clientRect and frames it is not handed;
 * unframed, clientRect is the windowRect box, and only clientSize reads a frame.
 */
export function storyLayoutRect(node: StoryNode, parent: Rect,
  textureSize?: { width: number; height: number }): Rect {
  const key = LAYOUT_KEYS.find(entry => T(node, entry) !== undefined);
  const changes: Record<string, string | undefined> = {};
  if (key === "clientRect") {
    changes.clientRect = undefined;
    changes.windowRect = T(node, "clientRect") as string;
  }
  if (T(node, "frame") !== undefined) changes.frame = undefined;
  const layout = Object.keys(changes).length ? withAttributes(node, changes) : node;
  return V0(layout, parent, undefined, textureSize) as Rect;
}

/**
 * Page offsets for a map wider than its window: a page ends where a step
 * would be cut, so every step shows whole on at least one page.
 */
export function storyMapPages(mapWidth: number, pageWidth: number,
  rects: readonly Rect[]): number[] {
  const last = Math.max(0, mapWidth - pageWidth);
  const pages = [0];
  while (pages.at(-1)! < last) {
    const start = pages.at(-1)!;
    const edge = start + pageWidth;
    let next = edge;
    for (const rect of rects)
      if (rect.x > start && rect.x < edge && rect.x + rect.width > edge) next = Math.min(next, rect.x);
    pages.push(Math.min(last, Math.max(start + 1, next)));
  }
  return pages;
}

/** The first page a rect fits on whole, else the one holding its centre. */
export function storyPageOf(pages: readonly number[], pageWidth: number, rect: Rect): number {
  const whole = pages.findIndex(offset => rect.x >= offset && rect.x + rect.width <= offset + pageWidth);
  if (whole >= 0) return whole;
  const centre = rect.x + rect.width / 2;
  const found = pages.findIndex(offset => centre >= offset && centre < offset + pageWidth);
  return found >= 0 ? found : pages.length - 1;
}

/**
 * The step the rider marker stands on: the first open step not yet cleared,
 * else the last one cleared (never a branch the fork locked).
 */
export function currentStoryStep(steps: readonly StoryStep[],
  isCleared: (step: StoryStep) => boolean, isOpen: (step: StoryStep) => boolean):
  StoryStep | undefined {
  return steps.find(step => isOpen(step) && !isCleared(step)) ??
    [...steps].reverse().find(isCleared) ?? steps[0];
}

/** The map picture: "map", or "map1"/"map2"/… panels side by side. */
const MAP_PANEL = /^map\d*$/;
const STEP = /^step_(\d+)$/;
/** stage_scenarioSelect startPoint art, laid out by leftTopTex on some maps. */
const START_POINT = { width: 76, height: 76 };

export async function openStoryMap(options: StoryMapOptions): Promise<StoryMapWindow> {
  const { library, chapter, steps } = options;
  const chapterRoot = `${STORY_ROOT}/${chapter.name}`;
  const roots = [chapterRoot, `${STORY_ROOT}/common`, "stage_/scenarioSelect", "stage_/common"];
  const frame = await F9(library, "stage_/scenarioSelect", "stage_window@zz") as StoryNode;
  const stepById = new Map(steps.map(step => [step.id, step]));
  const current = currentStoryStep(steps, options.isCleared, options.isOpen);

  // Lay the map out in its own coordinates, as the renderer will inside mapHolder.
  const background = storyLayoutRect(options.map, { x: 0, y: 0, ...MAP_VIEW });
  const local: Rect = { x: 0, y: 0, width: background.width, height: background.height };
  const panels: Array<{ rect: Rect; texture: Texture; uv?: number[] }> = [];
  const stepRects = new Map<number, Rect>();
  const visit = async (node: StoryNode): Promise<void> => {
    const key = name(node);
    const stepMatch = STEP.exec(key);
    if (stepMatch) stepRects.set(Number(stepMatch[1]), storyLayoutRect(node, local));
    const image = (T(node, "image") ?? T(node, "texture")) as string | undefined;
    if (MAP_PANEL.test(key) && image) {
      const texture = await decodeStoryTexture(U1(library, [chapterRoot], image) as ResourceFile);
      const uv = (T(node, "uvRect") as string | undefined)?.trim().split(/\s+/).map(Number);
      panels.push({ rect: storyLayoutRect(node, local, texture), texture,
        uv: uv?.length === 4 && uv.every(Number.isFinite) ? uv : undefined });
    }
    for (const child of node.children) await visit(child);
  };
  await visit(options.map);
  const mapWidth = Math.max(MAP_VIEW.width,
    ...panels.map(panel => panel.rect.x + panel.rect.width),
    ...[...stepRects.values()].map(rect => rect.x + rect.width));
  const currentRect = current && stepRects.get(current.id);
  const startRect = (() => {
    const start = findNode(options.map, "start");
    return start && storyLayoutRect(start, local, START_POINT);
  })();

  // Map pictures are painted, clipped, into mapHolder; the buttons scroll by offsetX.
  // The release step tooltip (static/toolTip) is drawn last, over the rider marker:
  // one copy per step, placed above it when hovered.
  const tooltip = findNode(findNode(options.map, "static") ?? options.map, "toolTip");
  const tooltips = tooltip ? steps.map(step => withAttributes(tooltip, {
    name: `toolTip_${step.id}`, text: step.title, windowRect: undefined, align: undefined,
    adjust: undefined, leftTopWH: "0 0 80 19" })) : [];
  const map = mapTree({ ...options.map, children: [...options.map.children, ...tooltips] }, node => {
    const key = name(node);
    const stepMatch = STEP.exec(key);
    if (stepMatch) return { ...node, name: "ImageButton" };
    if (MAP_PANEL.test(key)) return withAttributes(node, { image: undefined, texture: undefined });
    if (key === "dao" && currentRect) {
      const at = { x: currentRect.x - 7, y: currentRect.y - 52 };
      return withAttributes(node, { clientRect: undefined, leftTopWH: undefined,
        windowSize: undefined, leftTopTex: undefined, align: undefined, adjust: undefined,
        windowRect: `${at.x} ${at.y} ${at.x + 80} ${at.y + 82}` });
    }
    return undefined;
  });
  const definition = pruneMissingTextures(library, mapTree(frame, node =>
    name(node) === "mapHolder" ? { ...node, children: [map] } : undefined), roots);
  // Tag the final tree: every rewrite above copies the nodes.
  const clearOwners = new WeakMap<StoryNode, number>();
  const stepNodes = new Map<number, StoryNode>();
  const tag = (node: StoryNode, owner?: number): void => {
    const stepMatch = STEP.exec(name(node));
    if (stepMatch) stepNodes.set(Number(stepMatch[1]), node);
    const next = stepMatch ? Number(stepMatch[1]) : owner;
    if (name(node) === "clear" && next !== undefined) clearOwners.set(node, next);
    node.children.forEach(child => tag(child, next));
  };
  tag(definition);

  const pageWidth = MAP_VIEW.width;
  const pages = storyMapPages(mapWidth, pageWidth, [...stepRects.values()]);
  let page = currentRect ? storyPageOf(pages, pageWidth, currentRect) : 0;
  const offset = (): number => pages[page] ?? 0;
  const onPage = (rect: Rect | undefined): boolean =>
    !!rect && storyPageOf(pages, pageWidth, rect) === page;
  const visibleOn = (rect: Rect | undefined): boolean => !!rect &&
    rect.x >= offset() && rect.x + rect.width <= offset() + pageWidth;

  const header = chapterHeader(definition, chapter);
  let view: (WindowView & { hovered?: StoryNode }) | undefined;
  const render = (): void => { if (view && !view.disposed) view.render(); };
  const turn = (direction: number): void => {
    options.onActivate?.();
    page = Math.min(pages.length - 1, Math.max(0, page + direction));
    render();
  };
  view = await openWindow({
    library, root: options.root, definition, roots, label: `故事模式：${chapter.title}`,
    onCancel: options.onClose,
    state: node => {
      const key = name(node);
      const stepMatch = STEP.exec(key);
      if (stepMatch) {
        const step = stepById.get(Number(stepMatch[1]));
        const rect = step && stepRects.get(step.id);
        // A step shows on the page it belongs to, or whole on the one shown.
        if (!step || !(onPage(rect) || visibleOn(rect))) return { visible: false };
        const open = options.isOpen(step);
        return { offsetX: -offset(), label: step.title, disabled: !open,
          action: open ? () => { options.onActivate?.(); options.onStep(step); } : undefined };
      }
      const tooltipMatch = /^toolTip_(\d+)$/.exec(key);
      if (tooltipMatch) {
        const step = stepById.get(Number(tooltipMatch[1]));
        const owner = stepNodes.get(Number(tooltipMatch[1]));
        const rect = step && stepRects.get(step.id);
        if (!step || !owner || !rect || view?.hovered !== owner) return { visible: false };
        // autoSizing: as wide as the title, centred 24 px above the step.
        const width = Math.ceil(windowTextWidth(step.title, 14)) + 20;
        return { visible: true, text: step.title, offsetX: -offset(),
          size: { left: Math.floor(rect.x + (rect.width - width) / 2), top: rect.y - 24,
            width, height: 19 } };
      }
      const headerState = header(key);
      if (headerState) return headerState;
      if (key === "clear" && clearOwners.has(node)) {
        const step = stepById.get(clearOwners.get(node)!);
        return { visible: !!step && options.isCleared(step) };
      }
      switch (key) {
        case "mapHolder": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          context.save();
          context.beginPath();
          context.rect(rect.x, rect.y, rect.width, rect.height);
          context.clip();
          const originX = rect.x + background.x - offset();
          const originY = rect.y + background.y;
          for (const panel of panels) {
            const [u0, v0, u1, v1] = panel.uv ?? [0, 0, panel.texture.width, panel.texture.height];
            context.drawImage(panel.texture.image, u0!, v0!, u1! - u0!, v1! - v0!,
              originX + panel.rect.x, originY + panel.rect.y, panel.rect.width, panel.rect.height);
          }
          context.restore();
        } };
        case "start": return { offsetX: -offset(), visible: visibleOn(startRect) };
        case "dao": return { offsetX: -offset(), visible: visibleOn(currentRect) };
        case "static": return { visible: false };
        case "goBackButton": return { label: "关闭", action: () => {
          options.onActivate?.(); options.onClose(); } };
        case "scrLeft": return page > 0
          ? { label: "上一页", action: () => turn(-1) } : { visible: false };
        case "scrRight": return page < pages.length - 1
          ? { label: "下一页", action: () => turn(1) } : { visible: false };
        case "story": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
          paintLabel(context, node, chapter.desc, rect) };
        case "chapterClear": return { visible: options.chapterCleared() };
      }
      return {};
    },
  }) as WindowView & { hovered?: StoryNode };
  return {
    render,
    hide: () => view?.hide(),
    show: () => {
      if (!view || view.disposed) return;
      view.show();
      focusWindow(view);
    },
    focus: () => { if (view && !view.disposed) focusWindow(view); },
    dispose: () => view?.dispose(),
  };
}

// ---------------------------------------------------------------------------
// One step (stage_scenarioReady mq_window)

export interface StoryReadyOptions {
  library: StoryWindowLibrary;
  root: HTMLElement;
  chapter: StoryChapter;
  step: StoryStep;
  mission: StoryMission;
  trackTitle: string;
  trackCard?: StoryTrackCard;
  cleared: boolean;
  /** Why the step cannot start here, if it cannot. */
  unavailable?: string;
  onStart(): void;
  onClose(): void;
  onActivate?(): void;
}

/** "赛道完成 %d回/%d回" with this step's count. */
export function storyMissionText(template: string, cleared: boolean): string {
  let index = 0;
  return template.replace(/%d/g, () => (index++ === 0 ? (cleared ? "1" : "0") : "1"));
}


/** stage_scenarioReady mq_<mission>@zz, the 338×162 picture of the mission type. */
export function storyMissionImage(mission: Pick<StoryMission, "kind" | "timeLimitMs">): string {
  switch (mission.kind) {
    case "TimeAttack": return mission.timeLimitMs > 0 ? "mq_시간체크@zz" : "mq_타임어택@zz";
    case "Shadow": return "mq_섀도우@zz";
    case "Tracing":
    case "Escape": return "mq_추격@zz";
    case "Delivery": return "mq_배달@zz";
    case "KnockOut": return "mq_넉다운@zz";
    case "CheckPoint": return "mq_시간체크@zz";
    case "ItemAttack":
    case "ItemAttackCheckPoint":
    case "AiKart": return "mq_ai아이템@zz";
  }
  return "mq_타임어택@zz";
}

export async function openStoryReady(options: StoryReadyOptions): Promise<WindowView> {
  const { library, step, chapter, mission } = options;
  const roots = ["stage_/scenarioReady", "stage_/common"];
  const raw = await F9(library, "stage_/scenarioReady", "mq_window@zz") as StoryNode;
  // The release fills these two panels per step: the step number badge and
  // the mission type picture.
  const definition = pruneMissingTextures(library, mapTree(raw, node => {
    if (name(node) === "missionImage")
      return withAttributes(node, { texture: storyMissionImage(mission) });
    // The lobby drops the placeholder theme texture the same way.
    if (name(node) === "trackTheme") return withAttributes(node, { texture: undefined });
    if (name(node) === "step" && step.stepTitleId)
      return withAttributes(node, { texture: `scenario/step_${step.stepTitleId}@zz`,
        windowRect: "0 0 50 50" });
    return undefined;
  }), roots);
  const badge = !!T(findNode(definition, "step") ?? definition, "texture");
  const playable = PLAYABLE_STORY_MISSIONS.has(mission.kind) && !options.unavailable;
  const start = (): void => {
    if (!playable) return;
    options.onActivate?.();
    options.onStart();
  };
  return openWindow({
    library, root: options.root, definition, roots, label: `故事关卡：${step.title}`,
    onCancel: options.onClose, onConfirm: start,
    state: node => {
      switch (name(node)) {
        case "scenarioChapterTitle": return { text: chapter.title };
        case "step": return badge ? {} : { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
          context.save();
          context.fillStyle = "rgba(16,38,104,.85)";
          context.beginPath();
          context.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
          context.fill();
          context.restore();
          paintText(context, `第 ${step.id} 关`, rect, { size: 20, color: "white",
            align: "center", middle: true });
        } };
        case "scenarioTitle": return { text: step.title };
        case "synopsis": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
          paintLabel(context, node, step.synopsis, rect) };
        case "howtoClear": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
          paintLabel(context, node, step.howToClear, rect) };
        case "missionText": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
          paintLabel(context, node, storyMissionText(step.missionText, options.cleared), rect) };
        case "trackInfoCard": return options.trackCard ? {
          paint: (context: CanvasRenderingContext2D, rect: Rect) => {
            const card = options.trackCard!;
            context.drawImage(card.image, rect.x, rect.y, rect.width, rect.height);
            if (card.reverseStamp)
              context.drawImage(card.reverseStamp.image, rect.x, rect.y, rect.width, rect.height);
          } } : {};
        case "out_trackName": return { text: options.trackCard?.title ?? options.trackTitle };
        case "trackTheme": return options.trackCard?.themeIcon ? {
          paint: (context: CanvasRenderingContext2D, rect: Rect) =>
            context.drawImage(options.trackCard!.themeIcon!.image, rect.x, rect.y,
              rect.width, rect.height) } : { visible: false };
        case "lblPrize": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
          paintLabel(context, node, step.prize ?? "", rect) };
        case "clearStep": return { visible: options.cleared };
        case "itemPanel":
        case "emblem": return { visible: false };
        case "시작": return { label: "开始", disabled: !playable,
          action: playable ? start : undefined };
        case "아이템배틀": return { visible: false };
        case "goBackButton": return { label: "关闭", action: () => {
          options.onActivate?.(); options.onClose(); } };
      }
      return {};
    },
  });
}

// ---------------------------------------------------------------------------
// Dialogue (stage_scene)

export interface StorySceneOptions {
  library: StoryWindowLibrary;
  root: HTMLElement;
  chapter: StoryChapter;
  pages: readonly StoryScenePage[];
  emotions: Map<string, Map<string, string[]>>;
  onDone(): void;
  onActivate?(): void;
}

/** Scene x positions run 0…15 across the 750 px stage. */
const SCENE_UNIT = 50;

export async function openStoryScene(options: StorySceneOptions): Promise<WindowView> {
  const { library, pages } = options;
  const roots = [SCENE_ROOT, "stage_/common"];
  const raw = await F9(library, SCENE_ROOT, "stage_window@zz") as StoryNode;
  const definition = pruneMissingTextures(library, raw, roots);
  const textures = new Map<string, Promise<Texture | undefined>>();
  // Scene backgrounds are .jpg or .png in stage_scene/bg; sprites are .png.
  const texture = (file: string, background = false): Promise<Texture | undefined> => {
    let pending = textures.get(file);
    if (!pending) {
      const roots = [SCENE_ROOT, `${SCENE_ROOT}/bg`];
      pending = Promise.resolve().then(() => {
        if (background && exists(library, roots, file, ".jpg"))
          return decodeStoryTexture(U1(library, roots, file, ".jpg") as ResourceFile, true);
        return decodeStoryTexture(U1(library, roots, file, ".png") as ResourceFile);
      }).catch(() => undefined);
      textures.set(file, pending);
    }
    return pending;
  };
  const loaded = new Map<string, Texture>();
  const spriteName = (id: string, emotion: string): string | undefined => {
    const emotions = options.emotions.get(id);
    return (emotions?.get(emotion) ?? emotions?.get("normal") ?? emotions?.get("stop1"))?.[0];
  };
  const prepare = async (index: number): Promise<void> => {
    const page = pages[index];
    if (!page) return;
    const names: Array<[string, boolean]> = [];
    if (page.background) names.push([`${page.background}_1`, true], [`${page.background}_2`, true]);
    for (const character of page.characters) {
      const sprite = spriteName(character.id, character.emotion);
      if (sprite) names.push([sprite, false]);
    }
    await Promise.all(names.map(async ([file, jpeg]) => {
      const result = await texture(file, jpeg);
      if (result) loaded.set(file, result);
    }));
  };
  let index = 0;
  let view: WindowView | undefined;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    options.onDone();
  };
  const advance = (): void => {
    options.onActivate?.();
    if (index >= pages.length - 1) {
      finish();
      return;
    }
    index++;
    void prepare(index).then(() => { if (view && !view.disposed) view.render(); });
    void prepare(index + 1);
    if (view && !view.disposed) view.render();
  };
  await prepare(0);
  void prepare(1);
  const background = (part: 1 | 2) => (context: CanvasRenderingContext2D, rect: Rect): void => {
    const page = pages[index];
    const image = page?.background && loaded.get(`${page.background}_${part}`);
    if (image) context.drawImage(image.image, rect.x, rect.y, rect.width, rect.height);
  };
  const header = chapterHeader(definition, options.chapter);
  view = await openWindow({
    library, root: options.root, definition, roots, label: "故事剧情",
    onCancel: finish, onConfirm: advance,
    state: node => {
      const page = pages[index];
      const headerState = header(name(node));
      if (headerState) return headerState;
      switch (name(node)) {
        case "Background1": return { paint: background(1) };
        case "Background2": return { paint: background(2) };
        case "sceneContainer": return {
          // Clicking the picture also turns the page, as in the release.
          action: advance, label: "下一句",
          paint: (context: CanvasRenderingContext2D, rect: Rect) => {
            for (const character of page?.characters ?? []) {
              const sprite = spriteName(character.id, character.emotion);
              const image = sprite && loaded.get(sprite);
              if (!image) continue;
              const scale = Math.min(1, rect.height / image.height);
              const width = image.width * scale;
              const height = image.height * scale;
              const x = rect.x + character.x * SCENE_UNIT - width / 2;
              const y = rect.y + rect.height - height;
              context.save();
              if (character.flip) {
                context.translate(x + width, y);
                context.scale(-1, 1);
                context.drawImage(image.image, 0, 0, width, height);
              } else context.drawImage(image.image, x, y, width, height);
              context.restore();
            }
          } };
        case "msgName": return { text: page?.speaker ?? "" };
        case "msg": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
          paintLabel(context, node, page?.text ?? "", rect) };
        // The release 확인버튼 (确认), drawn with its own four states.
        case "next": return { label: index >= pages.length - 1 ? "开始比赛" : "下一句",
          action: advance };
        case "script": return { visible: false };
        case "goBackButton": return { label: "跳过剧情", action: () => {
          options.onActivate?.(); finish(); } };
      }
      return {};
    },
  });
  return view;
}
