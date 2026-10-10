/**
 * DOM for original BML windows: one absolutely positioned element per BML
 * node at the rectangle the release layout functions give it (shop-original
 * ShopLayout), dressed with the node's original art through the CSS custom
 * properties shop-assets.ts publishes:
 *  - Panel texture → --i0 (stretched like the release drawImage),
 *  - ImageButton autoLoadImage _1.._4 → --i1..--i4 (normal, over, pressed,
 *    disabled; centred at natural size like generated ct),
 *  - frame states → --f<n>/--fs<n>/--fw<n> on a ::before 9-slice, TextButton
 *    states from the monocoque config (generated m4),
 *  - text with its textRender size/face/outline, textAlign, stringPos and the
 *    state colours (textColor, overTextColor, clickedTextColor,
 *    disabledTextColor).
 * Buttons are real <button>s and Edit an <input>, so focus, keyboard and
 * accessibility work as in the rest of the rewrite's DOM dialogs.
 */
import { frameVar, imageSeries, imageVar } from "./shop-assets";
import {
  attr, captionOffset, frameName, shopColor, shopFrame, shopText, textAlignment, textButtonStyle,
  textRenderStyle, type ShopLayout, type ShopNode, type ShopRect,
} from "./shop-original";

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Positions an element at rect (stage pixels), relative to its parent's rect. */
export function place(target: HTMLElement, rect: ShopRect, parent?: ShopRect): void {
  target.style.left = `${rect.x - (parent?.x ?? 0)}px`;
  target.style.top = `${rect.y - (parent?.y ?? 0)}px`;
  target.style.width = `${Math.max(0, rect.width)}px`;
  target.style.height = `${Math.max(0, rect.height)}px`;
}

function setVar(target: HTMLElement, name: string, value: string | undefined): void {
  if (value === undefined) target.style.removeProperty(name);
  else target.style.setProperty(name, value);
}

/** Uses one frame state's 9-slice as --f<slot> (slot 0 normal … 3 disabled). */
export function setFrame(target: HTMLElement, frame: string, state: number, slot = 0): void {
  setVar(target, `--f${slot}`, `var(${frameVar(frame, state, "image")})`);
  setVar(target, `--fs${slot}`, `var(${frameVar(frame, state, "slice")})`);
  setVar(target, `--fw${slot}`, `var(${frameVar(frame, state, "width")})`);
  target.classList.add("ks-frame");
}

/** An autoLoadImage series as --i1..--i4. */
export function setImageSeries(target: HTMLElement, series: string): void {
  imageSeries(series).forEach((name, index) => setVar(target, `--i${index + 1}`, `var(${imageVar(name)})`));
  target.classList.add("ks-ib");
}

/** A Panel texture as --i0. */
export function setTexture(target: HTMLElement, texture: string | undefined): void {
  setVar(target, "--i0", texture ? `var(${imageVar(texture)})` : undefined);
  target.classList.toggle("ks-tex", texture !== undefined);
}

const FACES: Record<string, string> = {
  bold: "var(--ks-shop-font-bold)", medium: "var(--ks-shop-font-plain)", default: "var(--ks-shop-font-plain)",
};

/** Text style of a node: size, face, outline, alignment and the four state colours. */
export function styleText(target: HTMLElement, node: ShopNode): void {
  const button = node.name === "TextButton" ? textButtonStyle(node) : undefined;
  const render = textRenderStyle(button?.states[0]!.textRender ?? attr(node, "textRender"));
  const { align, valign } = textAlignment(node);
  target.style.setProperty("--fz", `${render.size}px`);
  target.style.setProperty("--ff", FACES[render.face]!);
  if (render.face !== "bold") target.dataset.face = "plain";
  target.dataset.align = align;
  target.dataset.valign = valign;
  if (render.stroke) target.dataset.stroke = "true";
  const [x, y] = (attr(node, "stringPos") ?? "0 0").trim().split(/\s+/).map(Number);
  if (x) target.style.setProperty("--sx", `${x}px`);
  if (y) target.style.setProperty("--sy", `${y}px`);
  const colors = button
    ? button.states.map(state => state.textColor)
    : ["textColor", "overTextColor", "clickedTextColor", "disabledTextColor"]
      .map((name, index) => attr(node, name) === undefined && index > 0 ? undefined
        : shopColor(attr(node, name), "#ffffff"));
  colors.forEach((color, index) => setVar(target, `--c${index}`, color));
  const outline = button?.states[0]!.textColor2 ?? shopColor(attr(node, "textColor2"), "#000000");
  setVar(target, "--oc", render.stroke ? outline : undefined);
  if (attr(node, "multiLine") === "true" || attr(node, "autoWrap") === "true")
    target.dataset.wrap = "true";
}

/** Sets a node element's text ("|" breaks lines like the release labels). */
export function setText(target: HTMLElement, text: string): void {
  let span = target.querySelector<HTMLElement>(":scope > .ks-text");
  if (!span) {
    span = element("span", "ks-text");
    target.prepend(span);
  }
  span.textContent = text.replaceAll("|", "\n");
}

const BUTTONS = new Set(["ImageButton", "TextButton", "ComboBox"]);

/** One element for one BML node (without children). An Edit is a framed box around an <input>. */
export function createNodeElement(node: ShopNode): HTMLElement {
  const tag = BUTTONS.has(node.name) ? "button" : "div";
  const target = document.createElement(tag);
  if (node.name === "Edit") {
    const input = element("input", "ks-edit-input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    const maxChar = Number(attr(node, "maxChar"));
    if (Number.isInteger(maxChar) && maxChar > 0) input.maxLength = maxChar;
    target.append(input);
  }
  target.className = `ks-bml ks-bml-${node.name}`;
  const name = attr(node, "name");
  if (name) target.dataset.name = name;
  if (target instanceof HTMLButtonElement) target.type = "button";
  if (attr(node, "visible") === "false") target.hidden = true;
  if (attr(node, "enable") === "false") target.dataset.inert = "true";
  const series = attr(node, "autoLoadImage");
  if (series) setImageSeries(target, series);
  const texture = attr(node, "texture") ?? attr(node, "image");
  const frame = frameName(node);
  if (node.name === "TextButton") {
    const style = textButtonStyle(node);
    for (let state = 0; state < 4; state++) setFrame(target, style.frameName, state, state);
  } else if (frame === "Bullet") {
    // A 4×4 dot modulated with the node colour.
    target.classList.add("ks-bullet");
    target.style.backgroundColor = shopColor(attr(node, "color"), "#2a3750");
  } else if (frame) {
    setFrame(target, frame, 0);
  } else if (texture) {
    setTexture(target, texture);
  } else if (attr(node, "color")) {
    target.style.backgroundColor = shopColor(attr(node, "color"));
  }
  if (frame && texture && frame !== "Bullet") setTexture(target, texture);
  const text = shopText(attr(node, node.name === "CaptionWindow" ? "caption" : "text"));
  styleText(target, node);
  if (node.name === "CaptionWindow") target.classList.add("ks-caption-window");
  if (text && node.name !== "Edit") setText(target, text);
  return target;
}

/**
 * Where a CaptionWindow draws its caption (generated f3 with the monocoque
 * dialogCaptionPosOffset), relative to the window.
 */
export function captionTextRect(node: ShopNode, rect: ShopRect): ShopRect {
  const frame = shopFrame(frameName(node));
  if (!frame) return { x: 0, y: 0, width: rect.width, height: 20 };
  const offset = captionOffset(node);
  return {
    x: frame.left.width + offset.x, y: offset.y - 1,
    width: rect.width - frame.left.width - frame.right.width, height: frame.caption.height,
  };
}

/** The input inside an Edit node's element. */
export function editInput(target: HTMLElement): HTMLInputElement {
  return target.querySelector<HTMLInputElement>(".ks-edit-input")!;
}

/**
 * The DOM of a BML subtree, positioned by a ShopLayout. A button cannot hold
 * other controls, so the children of a button node become its following
 * siblings (same rectangles); a button root gets a wrapper <div> of its size
 * (`element`) that holds the button and those children.
 */
export class BmlTree {
  readonly elements = new Map<ShopNode, HTMLElement>();
  readonly element: HTMLElement;
  /** The node whose rectangle each element is placed against (its DOM parent's node). */
  private readonly bases = new Map<ShopNode, ShopNode>();
  private readonly wrapper: HTMLElement;

  constructor(public layout: ShopLayout, readonly root: ShopNode = layout.root,
    skip?: (node: ShopNode) => boolean) {
    /** Builds node into container, whose node is `base`. */
    const build = (node: ShopNode, container: HTMLElement, base: ShopNode): void => {
      const target = createNodeElement(node);
      this.elements.set(node, target);
      this.bases.set(node, base);
      this.placeNode(node, target);
      container.append(target);
      const button = target instanceof HTMLButtonElement || target.tagName === "BUTTON";
      for (const child of node.children)
        if (!skip?.(child)) build(child, button ? container : target, button ? base : node);
    };
    const wrapper = element("div", "ks-bml ks-bml-root");
    this.wrapper = wrapper;
    place(wrapper, { ...layout.rect(root), x: 0, y: 0 });
    build(root, wrapper, root);
    const first = this.elements.get(root)!;
    if (first.tagName === "BUTTON") {
      this.element = wrapper;
    } else {
      // The root itself is the element, at the origin of its parent.
      first.remove();
      first.style.left = "0px";
      first.style.top = "0px";
      this.element = first;
    }
  }

  private placeNode(node: ShopNode, target: HTMLElement): void {
    const rect = this.layout.rect(node);
    const base = this.layout.rect(this.bases.get(node) ?? this.root);
    if (node === this.root) place(target, { ...rect, x: 0, y: 0 });
    else place(target, rect, base);
    if (node.name === "CaptionWindow") {
      const caption = target.querySelector<HTMLElement>(":scope > .ks-text") ?? element("span", "ks-text");
      if (!caption.parentNode) target.prepend(caption);
      caption.classList.add("ks-caption-text");
      place(caption, captionTextRect(node, rect));
    }
  }

  /**
   * Places every element again by another layout of the same nodes (the
   * screen changed size: right, center and bottom anchors move).
   */
  relayout(layout: ShopLayout): void {
    this.layout = layout;
    place(this.wrapper, { ...layout.rect(this.root), x: 0, y: 0 });
    for (const [node, target] of this.elements) this.placeNode(node, target);
  }

  /** The first element for a BML name. */
  named(name: string): HTMLElement {
    for (const [node, target] of this.elements) if (attr(node, "name") === name) return target;
    throw new Error(`原版商店布局缺少 ${name}。`);
  }

  all(name: string): HTMLElement[] {
    return [...this.elements].filter(([node]) => attr(node, "name") === name).map(([, target]) => target);
  }

  nodeOf(target: HTMLElement): ShopNode | undefined {
    for (const [node, candidate] of this.elements) if (candidate === target) return node;
    return undefined;
  }
}
