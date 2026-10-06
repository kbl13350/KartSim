import type { WindowNode } from "./multiplayer-window-assets";
import type { WindowRect } from "./multiplayer-window-draw";

export interface ComboFrame {
  texture?: string;
  left: { width: number };
  right: { width: number };
  caption: { height: number };
  bottom: { height: number };
}
export interface MultiplayerComboHost {
  options: {
    state(node: WindowNode): {
      select?: { values: string[]; value: string };
      disabled?: boolean;
    };
    onHover?(): void;
  };
  openCombo?: WindowNode;
  comboIndex: number;
  comboRects: Map<WindowNode, WindowRect>;
  buttons: Array<{
    key: WindowNode | string | number;
    rect: WindowRect;
    label?: string;
    tabIndex?: number;
    hover?(): void;
    activate(): void;
  }>;
  frames: Map<string, ComboFrame[]>;
  styles: Map<WindowNode, { states: Array<{ frame: ComboFrame }> }>;
  images: Map<string, { image: CanvasImageSource }>;
  context: CanvasRenderingContext2D;
  closeCombo(): void;
  chooseCombo(index: number): void;
  drawComboText(node: WindowNode, rect: WindowRect): void;
  text(value: string): string;
}
export interface MultiplayerComboDependencies {
  entries(node: WindowNode, values: string[]): WindowNode[];
  attribute(node: WindowNode, name: string): string | undefined;
  rectangle(node: WindowNode, parent: WindowRect, frame: ComboFrame): WindowRect;
  paintFrame(context: CanvasRenderingContext2D, frame: ComboFrame,
    image: CanvasImageSource, rectangle: WindowRect): void;
}

/** Draws an open BML combo list and its accessible hit regions. */
export function drawMultiplayerComboPopup(host: MultiplayerComboHost,
  dependencies: MultiplayerComboDependencies): void {
  const combo = host.openCombo;
  const state = combo ? host.options.state(combo) : undefined;
  const anchor = combo ? host.comboRects.get(combo) : undefined;
  if (!combo || !state?.select || state.disabled || !anchor) {
    host.openCombo = undefined;
    return;
  }
  host.buttons.push({
    key: "comboBackdrop",
    rect: { x: 0, y: 0, width: 1600, height: 900 },
    activate: () => host.closeCombo(),
  });
  const entries = dependencies.entries(combo, state.select.values);
  const listFrame = host.frames.get(dependencies.attribute(combo, "listFrame") ??
    "DefaultEdit")![0]!;
  const totalHeight = entries.reduce((height, entry) => height +
    dependencies.rectangle(entry, anchor, host.styles.get(entry)!.states[0]!.frame).height, 0);
  const listRect = {
    x: anchor.x - listFrame.left.width,
    y: anchor.y - listFrame.caption.height,
    width: anchor.width + listFrame.left.width + listFrame.right.width,
    height: totalHeight + listFrame.caption.height + listFrame.bottom.height,
  };
  if (listFrame.texture)
    dependencies.paintFrame(host.context, listFrame,
      host.images.get(listFrame.texture)!.image, listRect);
  let y = anchor.y;
  entries.forEach((entry, index) => {
    const style = host.styles.get(entry)!.states[index === host.comboIndex ? 1 : 0]!;
    const rect = dependencies.rectangle(entry,
      { ...anchor, y, height: totalHeight }, style.frame);
    y += rect.height;
    if (style.frame.texture)
      dependencies.paintFrame(host.context, style.frame,
        host.images.get(style.frame.texture)!.image, rect);
    host.drawComboText(entry, rect);
    host.buttons.push({
      key: index, rect,
      label: host.text(dependencies.attribute(entry, "text") ?? ""),
      tabIndex: -1,
      hover: () => host.options.onHover?.(),
      activate: () => host.chooseCombo(index),
    });
  });
}
