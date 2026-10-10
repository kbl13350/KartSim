import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageViewControlsHost {
  controls: HTMLElement;
  transformPreviewPartsRoot?: HTMLElement;
  partsOnlyNodes: HTMLElement[];
  vehicleInfoNodes: HTMLElement[];
  status: HTMLElement;
  options: { onInteraction?: () => void };
  assets: {
    nodes: Map<string, unknown>;
    strings: Map<string, string>;
    imageUrls: Map<string, string>;
    rects: Map<string, GaragePreviewRect>;
  };
  button(label: string, action: () => void): HTMLButtonElement;
  skin(button: HTMLButtonElement, imageBase: string, states?: number): void;
  place(element: HTMLElement, rect: GaragePreviewRect): void;
  rect(name: string): GaragePreviewRect;
}

export interface GarageViewControlsDependencies {
  attribute(node: unknown, name: string): string | undefined;
}

export function placeGarageControl(
  host: GarageViewControlsHost,
  element: HTMLElement,
  rect: GaragePreviewRect,
): void {
  Object.assign(element.style, {
    position: "absolute", left: `${rect.x}px`, top: `${rect.y}px`,
    width: `${rect.width}px`, height: `${rect.height}px`,
  });
  host.controls.append(element);
}

/** Keep Parts-only controls under the active transform-preview root. */
export function setGaragePartsOnlyNodesMounted(host: GarageViewControlsHost, mounted: boolean): void {
  const root = host.transformPreviewPartsRoot ?? host.controls;
  for (const node of host.partsOnlyNodes) {
    if (mounted) {
      if (node.parentElement !== root) root.append(node);
    } else if (node.parentElement === root) node.remove();
  }
}

export function setGarageVehicleInfoNodesMounted(host: GarageViewControlsHost, mounted: boolean): void {
  for (const node of host.vehicleInfoNodes) {
    if (mounted) {
      if (node.parentElement !== host.controls) host.controls.append(node);
    } else if (node.parentElement === host.controls) node.remove();
  }
}

export function setGarageUpgradeStatusMounted(host: GarageViewControlsHost, mounted: boolean): void {
  if (mounted) {
    if (host.status.parentElement !== host.controls) host.controls.append(host.status);
  } else if (host.status.parentElement === host.controls) host.status.remove();
}

/** Invoke a garage action while showing its recoverable error on the status line. */
export function createGarageActionButton(
  host: GarageViewControlsHost,
  label: string,
  action: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.onclick = () => {
    host.options.onInteraction?.();
    try { action(); }
    catch (error) {
      host.status.textContent = String(error instanceof Error ? error.message : error);
    }
  };
  return button;
}

function nativeButtonStatePath(base: string, state: number): string {
  return base.endsWith("@zz") ? `${base.slice(0, -3)}${state}@zz` : `${base}${state}`;
}

export function skinGarageActionButton(
  host: GarageViewControlsHost,
  button: HTMLButtonElement,
  imageBase: string,
  states = 4,
): void {
  button.classList.add("garage-native-button");
  for (let state = 1; state <= states; state++) {
    const url = host.assets.imageUrls.get(nativeButtonStatePath(imageBase, state));
    if (url) button.style.setProperty(`--button-${state}`, `url("${url}")`);
  }
}

/** Build a localized native-textured button from an authored garage node. */
export function createGarageNativeButton(
  host: GarageViewControlsHost,
  name: string,
  fallback: string,
  action: () => void,
  override: string | undefined,
  dependencies: GarageViewControlsDependencies,
): HTMLButtonElement {
  const node = host.assets.nodes.get(name);
  const authoredText = node ? dependencies.attribute(node, "text") : undefined;
  const stringKey = authoredText && /^#sb\((.+)\)$/.exec(authoredText)?.[1];
  const label = override ?? (stringKey ? host.assets.strings.get(stringKey) ?? fallback : fallback);
  const button = host.button(label, action);
  button.setAttribute("aria-label", button.textContent ?? fallback);
  for (const [index, prefix] of ["t", "overT", "clickedT", "disabledT"].entries()) {
    const color = node ? dependencies.attribute(node, `${prefix}extColor`) : undefined;
    if (!color) continue;
    const values = color.trim().split(/\s+/).map(Number);
    const cssColor = values.length === 4 && values.every(Number.isFinite)
      ? `rgba(${values[1]}, ${values[2]}, ${values[3]}, ${values[0]! / 255})`
      : color;
    button.style.setProperty(`--text-${index + 1}`, cssColor);
  }
  const imageBase = node ? dependencies.attribute(node, "autoLoadImage") : undefined;
  if (imageBase) host.skin(button, imageBase);
  host.place(button, host.rect(name));
  return button;
}

export function garageViewRect(host: GarageViewControlsHost, name: string): GaragePreviewRect {
  const rect = host.assets.rects.get(name);
  if (!rect) throw new Error(`P3543 车库布局缺少 ${name}`);
  return rect;
}

export function createGarageIcon(
  host: GarageViewControlsHost,
  key: string,
  className: string,
): HTMLImageElement | undefined {
  const url = host.assets.imageUrls.get(key);
  if (!url) return undefined;
  const icon = document.createElement("img");
  icon.src = url;
  icon.alt = "";
  icon.className = className;
  icon.draggable = false;
  return icon;
}
