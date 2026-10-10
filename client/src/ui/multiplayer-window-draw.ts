import type { WindowFrame, WindowNode, WindowSprite } from "./multiplayer-window-assets";

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowNodeState {
  visible?: boolean;
  disabled?: boolean;
  action?: () => void;
  input?: {
    password?: boolean; maxLength: number; value: string;
    /** The browser's autofill hint (username, current-password, new-password); "off" when left out. */
    autocomplete?: string;
    change(value: string): void;
    submit?(): void; blurOnEmptyEnter?: boolean;
  };
  select?: { values: string[]; value: string; valueText?: string;
    change(value: string): void };
  size?: unknown;
  offsetX?: number;
  pointerBlock?: boolean;
  hoverRegion?: string;
  hoverRegionSound?: boolean;
  text?: string;
  textColor?: string;
  paint?(context: CanvasRenderingContext2D, rectangle: WindowRect): void;
  lines?: Array<string | { text: string; color: string }>;
  label?: string;
  checked?: boolean;
  expanded?: boolean;
}

interface FramePiece { x: number; y: number; width: number; height: number }
interface EdgedFrame extends WindowFrame {
  caption?: FramePiece; bottom?: FramePiece;
  captionLeftMargin?: number; captionRightMargin?: number;
  bottomLeftMargin?: number; bottomRightMargin?: number;
}

const solidFrames = new WeakMap<WindowFrame, WindowFrame>();

/** The margins of an edge piece, leaving its middle at least 1 px wide. */
function solidMargins(piece: FramePiece | undefined, left = 0, right = 0): [number, number] {
  if (!piece || piece.width < 2 || piece.height <= 0 || piece.width - left - right > 0) return [left, right];
  const kept = Math.min(left, piece.width - 1);
  return [kept, piece.width - kept - 1];
}

/**
 * Release frames whose caption or bottom margins take the whole piece
 * (InnerFrame and TitleCapBottomGrey: 9 + 9 of 18 px) leave a 0 px middle,
 * which the frame painter skips, so the dialog's white shows through as a
 * strip. Their middle stretches the 1 px column at the boundary instead.
 * Frames without such a piece are passed on unchanged.
 */
export function solidFrame(frame: WindowFrame): WindowFrame {
  const cached = solidFrames.get(frame);
  if (cached) return cached;
  const edged = frame as EdgedFrame;
  const [captionLeftMargin, captionRightMargin] = solidMargins(edged.caption, edged.captionLeftMargin,
    edged.captionRightMargin);
  const [bottomLeftMargin, bottomRightMargin] = solidMargins(edged.bottom, edged.bottomLeftMargin,
    edged.bottomRightMargin);
  const solid = captionLeftMargin === (edged.captionLeftMargin ?? 0) &&
    captionRightMargin === (edged.captionRightMargin ?? 0) &&
    bottomLeftMargin === (edged.bottomLeftMargin ?? 0) && bottomRightMargin === (edged.bottomRightMargin ?? 0)
    ? frame : { ...edged, captionLeftMargin, captionRightMargin, bottomLeftMargin, bottomRightMargin };
  solidFrames.set(frame, solid);
  return solid;
}

export interface WindowButton {
  key: WindowNode;
  rect: WindowRect;
  label?: string;
  disabled?: boolean;
  activate(): void;
  hover?(): void;
  keydown?(event: KeyboardEvent): void;
}

export interface MultiplayerWindowDrawHost {
  options: {
    state(node: WindowNode): WindowNodeState;
    modulateTextures?: boolean;
    root: HTMLElement;
    onActivate?(): void;
  };
  textures: Map<WindowNode, WindowSprite[]>;
  styles: Map<WindowNode, { states: Array<{ frame: WindowFrame; textColor?: string }> }>;
  frames: Map<string, WindowFrame[]>;
  images: Map<string, WindowSprite>;
  config: WindowNode;
  hovered?: WindowNode;
  pressed?: WindowNode;
  context: CanvasRenderingContext2D;
  buttons: WindowButton[];
  hoverRegions: Array<{ id: string; rect: WindowRect; sound: boolean }>;
  comboRects: Map<WindowNode, WindowRect>;
  controls: Map<WindowNode, HTMLButtonElement | HTMLInputElement>;
  element: HTMLElement;
  buttonLayer: { ensure(button: WindowButton): HTMLButtonElement };
  popup: HTMLElement;
  openCombo?: WindowNode;
  paintingOnly: boolean;
  text(value: string): string;
  canvasButton(node: WindowNode, rectangle: WindowRect,
    text: string, state: WindowNodeState): WindowButton;
  drawComboText(node: WindowNode, rectangle: WindowRect | undefined,
    disabled: boolean): void;
  draw(node: WindowNode, parent: WindowRect, visible: Set<WindowNode>): void;
}

export interface MultiplayerWindowDrawDependencies {
  attribute(node: WindowNode, name: string): string | undefined;
  rectangle(node: WindowNode, parent: WindowRect, frame?: WindowFrame,
    texture?: WindowSprite, size?: unknown): WindowRect;
  innerRectangle(frame: WindowFrame, rectangle: WindowRect): WindowRect;
  paintFrame(context: CanvasRenderingContext2D, frame: WindowFrame,
    image: CanvasImageSource, rectangle: WindowRect): void;
  color(value: string): string;
  charLayout(node: WindowNode, sprite: WindowSprite): unknown;
  charGlyphs(layout: unknown, text: string): Array<{
    u0: number; v0: number; u1: number; v1: number;
    left: number; top: number; right: number; bottom: number;
  }>;
  paintImageButton(context: CanvasRenderingContext2D,
    sprite: WindowSprite, rectangle: WindowRect): void;
  numbers(value: string | undefined, count: number, label: string): number[];
  drawText(context: CanvasRenderingContext2D, text: string,
    rectangle: WindowRect, style: Record<string, unknown>): void;
  comboEntries(node: WindowNode, values: string[]): WindowNode[];
  captionRectangle(frame: WindowFrame, rectangle: WindowRect,
    config: unknown): WindowRect;
  nodeConfig(node: WindowNode, config: WindowNode): unknown;
  fontFamily: string;
}

/** Paint one BML node and synchronize its accessible DOM control. */
export function drawMultiplayerWindowNode(
  host: MultiplayerWindowDrawHost,
  node: WindowNode,
  parent: WindowRect,
  visibleControls: Set<WindowNode>,
  dependencies: MultiplayerWindowDrawDependencies,
): void {
  const { attribute } = dependencies;
  const state = host.options.state(node);
  if (state.visible === false ||
      (state.visible !== true && attribute(node, "visible") === "false") ||
      node.name === "Skip") return;

  const sprites = host.textures.get(node);
  const style = host.styles.get(node);
  const isButton = node.name.includes("Button");
  const stateIndex = state.disabled || (!state.action && isButton) ? 3 :
    host.hovered === node ? host.pressed === node ? 2 : 1 : 0;
  const frameName = attribute(node, "frame") ??
    (node.name === "Edit" ? "DefaultEdit" :
      node.name === "PlaneCheckButton" ? "DefaultCheckButton" : "");
  const defaultFrames = host.frames.get(frameName);
  const frame = style?.states[stateIndex]!.frame ??
    defaultFrames?.[node.name === "PlaneCheckButton" ? +!!state.checked : 0];
  const rawRect = dependencies.rectangle(node, parent, frame, sprites?.[0], state.size);
  const rect = { ...rawRect, x: rawRect.x + (state.offsetX ?? 0) };

  if (state.pointerBlock)
    host.buttons.push({ key: node, rect, disabled: true, activate() {} });
  if (state.hoverRegion)
    host.hoverRegions.push({ id: state.hoverRegion, rect,
      sound: !!state.hoverRegionSound });
  if (state.select)
    host.comboRects.set(node, frame ? dependencies.innerRectangle(frame, rect) : rect);
  if (frame?.texture)
    dependencies.paintFrame(host.context, solidFrame(frame),
      host.images.get(frame.texture)!.image, rect);

  const color = attribute(node, "color");
  if (color && !(host.options.modulateTextures && sprites &&
      attribute(node, "textureOp") === "modulate")) {
    host.context.fillStyle = dependencies.color(color);
    host.context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  if (sprites && node.name === "CharPanel") {
    const sprite = sprites[0]!;
    const layout = dependencies.charLayout(node, sprite);
    for (const glyph of dependencies.charGlyphs(layout,
      state.text ?? attribute(node, "text") ?? "")) {
      host.context.drawImage(sprite.image,
        glyph.u0 * sprite.width, glyph.v0 * sprite.height,
        (glyph.u1 - glyph.u0) * sprite.width,
        (glyph.v1 - glyph.v0) * sprite.height,
        rect.x + glyph.left, rect.y + glyph.top,
        glyph.right - glyph.left, glyph.bottom - glyph.top);
    }
  } else if (sprites) {
    const sprite = sprites.length === 1 ? sprites[0]! : sprites[stateIndex]!;
    if (node.name === "ImageButton")
      dependencies.paintImageButton(host.context, sprite, rect);
    else if (attribute(node, "uvRect") !== undefined) {
      const [left, top, right, bottom] = dependencies.numbers(
        attribute(node, "uvRect"), 4, "uvRect");
      host.context.drawImage(sprite.image, left!, top!, right! - left!,
        bottom! - top!, rect.x, rect.y, rect.width, rect.height);
    } else
      host.context.drawImage(sprite.image, rect.x, rect.y, rect.width, rect.height);
  }

  state.paint?.(host.context, rect);
  if (state.lines) {
    host.context.save();
    host.context.beginPath();
    host.context.rect(rect.x, rect.y, rect.width, rect.height);
    host.context.clip();
    host.context.font = `16px '${dependencies.fontFamily}'`;
    const lines: Array<{ text: string; color: string }> = [];
    for (const line of state.lines) {
      const text = typeof line === "string" ? line : line.text;
      const color = typeof line === "string" ? "white" : line.color;
      let current = "";
      for (const character of text) {
        if (current && host.context.measureText(current + character).width > rect.width - 12) {
          lines.push({ text: current, color });
          current = "";
        }
        current += character;
      }
      lines.push({ text: current, color });
    }
    lines.slice(-Math.floor(rect.height / 24)).forEach((line, index) =>
      dependencies.drawText(host.context, line.text,
        { ...rect, x: rect.x + 6, y: rect.y + index * 24 },
        { family: dependencies.fontFamily, size: 16, kind: "label",
          color: line.color, align: "left", verticalAlign: "top" }));
    host.context.restore();
  }

  const caption = node.name === "CaptionWindow";
  const text = state.text ?? host.text(attribute(node,
    caption ? "caption" : "text") ?? "");
  if (state.select) {
    const selected = dependencies.comboEntries(node, state.select.values)[
      state.select.values.indexOf(state.select.value)];
    if (selected) host.drawComboText(selected, host.comboRects.get(node), !!state.disabled);
  }
  if (text && !state.input && !state.select && node.name !== "CharPanel") {
    const alignment = attribute(node, "textAlign") ??
      (isButton || caption ? "center" : "left");
    dependencies.drawText(host.context, text,
      caption && frame ? dependencies.captionRectangle(frame, rect,
        dependencies.nodeConfig(node, host.config)) : rect,
      {
        stroke: /^outline(?:\d+)?$/.test(attribute(node, "textRender") ?? "") ? 1 : 0,
        strokeColor: dependencies.color(attribute(node, "textColor2") ?? "black"),
        family: dependencies.fontFamily,
        size: caption ? 20 : Number(/\d+/.exec(attribute(node, "textRender") ?? "")?.[0] ?? 16),
        kind: isButton || caption ? "button" : "label",
        color: state.textColor ?? (caption ? "white" :
          (style?.states[stateIndex]!.textColor ??
            dependencies.color(attribute(node, "textColor") ?? "white"))),
        align: alignment.includes("hcenter") || alignment === "center" ? "center" :
          alignment.includes("right") ? "right" : "left",
        verticalAlign: alignment.includes("vcenter") || alignment === "center"
          ? "center" : "top",
      });
  }

  if (!host.paintingOnly && (state.action || state.input || state.select || isButton)) {
    visibleControls.add(node);
    let control = host.controls.get(node);
    if (!control) {
      if (state.input) {
        control = document.createElement("input");
        host.element.append(control);
      } else control = host.buttonLayer.ensure(host.canvasButton(node, rect, text, state));
      host.controls.set(node, control);
      if (control instanceof HTMLInputElement) {
        Object.assign(control.style, {
          position: "absolute", margin: "0", padding: "0 4px",
          boxSizing: "border-box", border: "none", background: "transparent",
          font: `bold 16px '${dependencies.fontFamily}'`, color: "rgb(72,106,163)",
        });
        const input = control;
        input.addEventListener("keydown", event => {
          if (event.key !== "Enter" || event.isComposing) return;
          const latest = host.options.state(node);
          if (latest.disabled || !latest.input?.submit) return;
          event.preventDefault();
          event.stopPropagation();
          if (latest.input.blurOnEmptyEnter && !input.value.trim()) {
            input.blur();
            return;
          }
          latest.input.submit();
        });
        input.addEventListener("input", () => {
          host.options.state(node).input?.change(input.value);
        });
      }
    }
    if (!state.input && !host.buttons.some(button => button.key === node))
      host.buttons.push(host.canvasButton(node, rect, text, state));
    control.hidden = false;
    control.disabled = !!state.disabled ||
      (!state.action && !state.input && !state.select);
    control.setAttribute("aria-label", state.label ?? text ?? attribute(node, "name") ?? "");
    if (state.checked !== undefined)
      control.setAttribute("aria-pressed", String(state.checked));
    if (state.expanded !== undefined)
      control.setAttribute("aria-expanded", String(state.expanded));
    if (control instanceof HTMLInputElement && state.input) {
      control.type = state.input.password ? "password" : "text";
      control.maxLength = state.input.maxLength;
      control.autocomplete = (state.input.autocomplete ?? "off") as AutoFill;
      if (control.value !== state.input.value) control.value = state.input.value;
    }
    if (state.select) {
      control.setAttribute("role", "combobox");
      control.setAttribute("aria-haspopup", "listbox");
      control.setAttribute("aria-controls", host.popup.id);
      control.setAttribute("aria-expanded", String(host.openCombo === node));
      if (host.openCombo !== node) control.removeAttribute("aria-activedescendant");
      control.setAttribute("aria-valuetext",
        state.select.valueText ?? `${state.select.value} 人`);
    }
    if (control instanceof HTMLInputElement) {
      Object.assign(control.style, {
        left: `${rect.x / 16}%`, top: `${rect.y / 9}%`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        transformOrigin: "top left",
        transform: `scale(${host.options.root.clientWidth / 1600},${host.options.root.clientHeight / 900})`,
      });
    }
  }
  for (const child of node.children)
    host.draw(child, frame ? dependencies.innerRectangle(frame, rect) : rect,
      visibleControls);
}
