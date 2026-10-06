import type { WindowNode } from "./multiplayer-window-assets";
import type { WindowRect } from "./multiplayer-window-draw";

export interface MultiplayerWindowActionState {
  label?: string;
  disabled?: boolean;
  visible?: boolean;
  silentHover?: boolean;
  action?(): void;
  onActivate?(): void;
  select?: { values: string[]; value: string; change(value: string): void };
}
export interface MultiplayerWindowActionHost {
  options: {
    root: { getBoundingClientRect(): { left: number; top: number;
      width: number; height: number } };
    state(node: WindowNode): MultiplayerWindowActionState;
    onHover?(): void;
    onActivate?(): void;
  };
  openCombo?: WindowNode;
  comboIndex: number;
  hoveredRegion?: string;
  hoverRegions: Array<{ id: string; rect: WindowRect; sound: boolean }>;
  controls: Map<WindowNode, { focus(): void }>;
  render(): void;
  closeCombo(): void;
  chooseCombo(index: number): void;
}

/** Defines the pointer and keyboard behavior for one BML canvas control. */
export function multiplayerCanvasButton(host: MultiplayerWindowActionHost,
  node: WindowNode, rect: WindowRect, text: string | undefined,
  snapshot: MultiplayerWindowActionState,
  attribute: (node: WindowNode, name: string) => string | undefined) {
  return {
    key: node,
    rect,
    label: snapshot.label ?? text ?? attribute(node, "name") ?? "",
    disabled: !!snapshot.disabled || (!snapshot.action && !snapshot.select),
    hover: () => {
      if (!host.options.state(node).silentHover) host.options.onHover?.();
    },
    activate: () => {
      const state = host.options.state(node);
      if (state.disabled || state.visible === false) return;
      if (state.select) {
        host.options.onActivate?.();
        host.openCombo = node;
        host.comboIndex = Math.max(0, state.select.values.indexOf(state.select.value));
        host.render();
      } else if (state.action) {
        (state.onActivate ?? host.options.onActivate)?.();
        state.action();
      }
    },
    keydown: (event: KeyboardEvent) => {
      const state = host.options.state(node);
      if (host.openCombo || state.disabled || !state.select ||
          (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      event.stopPropagation();
      host.openCombo = node;
      host.comboIndex = Math.max(0, state.select.values.indexOf(state.select.value));
      host.render();
    },
  };
}

export function updateMultiplayerHoverRegion(host: MultiplayerWindowActionHost,
  event: PointerEvent): void {
  const bounds = host.options.root.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) * 1600) / bounds.width;
  const y = ((event.clientY - bounds.top) * 900) / bounds.height;
  const hit = host.hoverRegions.find(({ rect }) =>
    x >= rect.x && x < rect.x + rect.width &&
    y >= rect.y && y < rect.y + rect.height);
  if (hit?.id !== host.hoveredRegion) {
    host.hoveredRegion = hit?.id;
    if (hit?.sound) host.options.onHover?.();
    host.render();
  }
}

export function closeMultiplayerCombo(host: MultiplayerWindowActionHost): void {
  const combo = host.openCombo;
  host.openCombo = undefined;
  host.render();
  if (combo) host.controls.get(combo)?.focus();
}

export function chooseMultiplayerCombo(host: MultiplayerWindowActionHost,
  index: number): void {
  const combo = host.openCombo;
  if (!combo) return;
  const state = host.options.state(combo);
  const value = state.select?.values[index];
  if (!state.disabled && value !== undefined) {
    host.options.onActivate?.();
    state.select!.change(value);
  }
  host.closeCombo();
}
