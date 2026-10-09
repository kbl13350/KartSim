/**
 * DOM for the release messenger layouts: one absolutely positioned element
 * per BML node at the rectangle the release layout functions give it
 * (messenger-art BmlLayout), dressed with its original art:
 *  - texture / image → stretched background (--i0),
 *  - autoLoadImage _1.._4 → an inner image at natural size centred on the
 *    node like the release ImageButton (normal, over, pressed/selected,
 *    disabled; a missing state shows _1),
 *  - frame states → the frame painted at the node's size (--f0..--f3),
 *  - text with its textRender size, textAlign, stringPos and state colours;
 *    ColorLabel [color:…] runs.
 * ImageButtons are real <button>s and ChatEdits real <input>s.
 */
import {
  attr, bmlColor, colorRuns, imageSeries, type BmlLayout, type BmlNode, type MessengerArt, type Rect,
} from "./messenger-art";

const BUTTONS = new Set(["ImageButton", "ImageCheckButton", "TextButton"]);
/** List rows the window drives itself (click, double click, right click). */
const ROWS = new Set(["MsgrFriendInfoButton", "MsgrReceiveInfoButton", "MsgrSendInfoButton", "ChatListPanel"]);

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function place(target: HTMLElement, rect: Rect, parent?: Rect): void {
  target.style.left = `${rect.x - (parent?.x ?? 0)}px`;
  target.style.top = `${rect.y - (parent?.y ?? 0)}px`;
  target.style.width = `${Math.max(0, rect.width)}px`;
  target.style.height = `${Math.max(0, rect.height)}px`;
}

function cssUrl(url: string): string {
  return `url("${url}")`;
}

/** #sb(key) references; unknown keys stay empty like the release renderer. */
export function resolveText(art: MessengerArt, value: string | undefined): string {
  return (value ?? "").replace(/#sb\(([^)]+)\)/g, (_whole, key: string) => art.strings.get(key) ?? "");
}

/** textRender: boldNN → SourceHanSansCN-Bold NN px; outline/default → 12 px. */
function textSize(render: string | undefined): { size: number; outline: boolean } {
  const match = /^(bold|outline|medium|default)(\d+)?$/.exec((render ?? "default").trim());
  return { size: match?.[2] ? Number(match[2]) : 12, outline: match?.[1] === "outline" };
}

function textAlignment(node: BmlNode): { align: string; valign: string } {
  const value = attr(node, "textAlign") ?? "left";
  const tokens = value.split(/[|,.;\s]+/).filter(Boolean);
  const align = tokens.includes("center") || tokens.includes("hcenter") ? "center"
    : tokens.includes("right") ? "right" : "left";
  const valign = tokens.includes("center") || tokens.includes("vcenter") ? "center" : "top";
  return { align, valign };
}

/** Text style of a node: size, alignment, stringPos and the state colours. */
export function styleText(target: HTMLElement, node: BmlNode): void {
  const { size, outline } = textSize(attr(node, "textRender"));
  const { align, valign } = textAlignment(node);
  target.style.setProperty("--fz", `${size}px`);
  target.dataset.align = align;
  target.dataset.valign = valign;
  if (outline) target.dataset.outline = "true";
  const [x, y] = (attr(node, "stringPos") ?? "0 0").trim().split(/\s+/).map(Number);
  if (x) target.style.setProperty("--sx", `${x}px`);
  if (y) target.style.setProperty("--sy", `${y}px`);
  ["textColor", "overTextColor", "clickedTextColor", "disabledTextColor"].forEach((name, index) => {
    const value = attr(node, name);
    if (value !== undefined || index === 0) target.style.setProperty(`--c${index}`, bmlColor(value, "#ffffff"));
  });
  if (attr(node, "textColor2")) target.style.setProperty("--oc", bmlColor(attr(node, "textColor2"), "#000"));
  if (attr(node, "autoWrap") === "true" || attr(node, "multiLine") === "true") target.dataset.wrap = "true";
}

/** Sets a node element's text ("|" breaks lines); ColorLabels take [color:…] runs. */
export function setText(target: HTMLElement, text: string, colored = false): void {
  let span = target.querySelector<HTMLElement>(":scope > .ks-m-text");
  if (!span) {
    span = element("span", "ks-m-text");
    target.prepend(span);
  }
  if (!colored) {
    span.textContent = text.replaceAll("|", "\n");
    return;
  }
  // One flex item, so the runs flow (and wrap) as one paragraph.
  const runs = element("span", "ks-m-runs");
  runs.append(...colorRuns(text).map(run => {
    const part = element("span", undefined, run.text);
    if (run.color) part.style.color = run.color;
    return part;
  }));
  span.replaceChildren(runs);
}

/** An autoLoadImage (or autoImage) series as --i1..--i5 on the node's inner image. */
export function setImageSeries(art: MessengerArt, target: HTMLElement, series: string, count = 4): void {
  let image = target.querySelector<HTMLElement>(":scope > .ks-m-img");
  if (!image) {
    image = element("span", "ks-m-img");
    target.prepend(image);
  }
  const names = imageSeries(series, count);
  const first = art.images.get(names[0]!);
  names.forEach((name, index) => {
    const loaded = art.images.get(name);
    if (loaded) image!.style.setProperty(`--i${index + 1}`, cssUrl(loaded.url));
    else image!.style.removeProperty(`--i${index + 1}`);
  });
  image.style.setProperty("--iw", `${first?.width ?? 0}px`);
  image.style.setProperty("--ih", `${first?.height ?? 0}px`);
}

/** A texture stretched over the node (--i0). */
export function setTexture(art: MessengerArt, target: HTMLElement, texture: string | undefined): void {
  const loaded = texture ? art.images.get(texture) : undefined;
  if (loaded) target.style.setProperty("--i0", cssUrl(loaded.url));
  else target.style.removeProperty("--i0");
  target.classList.toggle("ks-m-tex", loaded !== undefined);
}

/** The node's frame states painted at its size as --f0..--f3. */
export function setFrame(art: MessengerArt, target: HTMLElement, frame: string, width: number, height: number): void {
  const states = art.frames.get(frame)?.length ?? 0;
  if (!states || frame === "NoFrame") return;
  for (let state = 0; state < 4; state++) {
    const url = state < states ? art.frameUrl(frame, state, width, height) : undefined;
    if (url) target.style.setProperty(`--f${state}`, cssUrl(url));
  }
  target.classList.add("ks-m-frame");
}

/** One element for one BML node (without children). */
export function createNodeElement(art: MessengerArt, node: BmlNode, rect: Rect): HTMLElement {
  const button = BUTTONS.has(node.name);
  const target = document.createElement(button ? "button" : "div");
  target.className = `ks-m ks-m-${node.name}`;
  if (target instanceof HTMLButtonElement) target.type = "button";
  if (ROWS.has(node.name)) target.classList.add("ks-m-row");
  const name = attr(node, "name");
  if (name) target.dataset.name = name;
  if (attr(node, "visible") === "false") target.hidden = true;
  if (node.name === "ChatEdit" || node.name === "Edit") {
    const input = element("input", "ks-m-input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    const maxChar = Number(attr(node, "maxChar"));
    if (Number.isInteger(maxChar) && maxChar > 0) input.maxLength = maxChar;
    input.style.color = bmlColor(attr(node, "textColor"), "#2a3750");
    input.style.caretColor = bmlColor(attr(node, "caretColor") ?? attr(node, "textColor"), "#2a3750");
    target.append(input);
  }
  const series = attr(node, "autoLoadImage");
  const checks = attr(node, "autoImage");
  if (series) setImageSeries(art, target, series);
  else if (checks) setImageSeries(art, target, checks, 5);
  setTexture(art, target, attr(node, "texture") ?? attr(node, "image"));
  // A TextButton without a frame uses the monocoque config's default (DefaultStaticButton).
  const frame = attr(node, "frame") ?? (node.name === "TextButton" ? "DefaultStaticButton" : undefined);
  if (frame) setFrame(art, target, frame, rect.width, rect.height);
  const color = attr(node, "color");
  if (color && !attr(node, "texture") && !attr(node, "image")) target.style.backgroundColor = bmlColor(color);
  styleText(target, node);
  const text = resolveText(art, attr(node, "text"));
  if (text && node.name !== "ChatEdit") setText(target, text, node.name === "ColorLabel");
  return target;
}

/** The input inside a ChatEdit element. */
export function editInput(target: HTMLElement): HTMLInputElement {
  return target.querySelector<HTMLInputElement>(".ks-m-input")!;
}

/**
 * The DOM of a BML subtree placed by a layout; the root element sits at the
 * origin of whatever holds it. `skip` leaves nodes (and their subtrees) out.
 */
export class BmlDom {
  readonly elements = new Map<BmlNode, HTMLElement>();
  readonly element: HTMLElement;

  constructor(readonly art: MessengerArt, readonly layout: BmlLayout, readonly root: BmlNode,
    skip?: (node: BmlNode) => boolean) {
    const build = (node: BmlNode, parent: BmlNode | undefined): HTMLElement => {
      const rect = layout.rect(node);
      const target = createNodeElement(art, node, rect);
      this.elements.set(node, target);
      if (parent) place(target, rect, layout.rect(parent));
      else place(target, { ...rect, x: 0, y: 0 });
      for (const child of node.children) if (!skip?.(child)) target.append(build(child, node));
      return target;
    };
    this.element = build(root, undefined);
  }

  /** The first element of a node named `name` (optionally of a BML type). */
  named(name: string, type?: string): HTMLElement {
    for (const [node, target] of this.elements)
      if (attr(node, "name") === name && (!type || node.name === type)) return target;
    throw new Error(`好友聊天系统布局缺少 ${name}。`);
  }

  all(name: string, type?: string): HTMLElement[] {
    return [...this.elements].filter(([node]) => attr(node, "name") === name && (!type || node.name === type))
      .map(([, target]) => target);
  }

  nodeOf(target: HTMLElement): BmlNode | undefined {
    for (const [node, candidate] of this.elements) if (candidate === target) return node;
    return undefined;
  }
}

/** A row template: one component of a template file, built once and cloned per row. */
export class RowTemplate {
  private readonly prototype: HTMLElement;
  readonly height: number;
  readonly width: number;

  constructor(art: MessengerArt, layout: BmlLayout, component: BmlNode) {
    const dom = new BmlDom(art, layout, component);
    this.prototype = dom.element;
    this.prototype.hidden = false;
    this.prototype.classList.add("ks-m-row-root");
    const rect = layout.rect(component);
    this.width = rect.width;
    this.height = rect.height;
  }

  create(): HTMLElement {
    return this.prototype.cloneNode(true) as HTMLElement;
  }
}

/** A part of a cloned row by BML name. */
export function part(row: HTMLElement, name: string): HTMLElement {
  if (row.dataset.name === name) return row;
  const found = row.querySelector<HTMLElement>(`[data-name="${CSS.escape(name)}"]`);
  if (!found) throw new Error(`好友聊天系统行模板缺少 ${name}。`);
  return found;
}
