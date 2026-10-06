import type { GarageProgressionRect } from "./garage-progression-panel";

export interface GarageProgressionElementsHost {
  assets: {
    rects: Map<string, GarageProgressionRect>;
    nodes: Map<string, unknown>;
    urls: Map<string, string>;
    strings: Map<string, string>;
  };
  activeContainer: HTMLElement;
  framedControls: Map<string, HTMLElement>;
  rect(name: string): GarageProgressionRect;
  place(element: HTMLElement, rect: GarageProgressionRect): void;
  styleFromNode(element: HTMLElement, node: string): void;
}

export interface GarageProgressionElementsDependencies {
  attribute(node: unknown, name: string): string | undefined;
}

/** Locate an authored strengthening-page rectangle and fail clearly if the asset is missing. */
export function garageProgressionRect(host: GarageProgressionElementsHost, name: string): GarageProgressionRect {
  const rect = host.assets.rects.get(name);
  if (!rect) throw new Error(`升级页缺少 ${name}`);
  return rect;
}

/** Mount a native control over its authored coordinates. */
export function placeGarageProgressionElement(
  host: GarageProgressionElementsHost,
  element: HTMLElement,
  rect: GarageProgressionRect,
): void {
  Object.assign(element.style, {
    position: "absolute",
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  host.activeContainer.append(element);
}

/** Translate authored text alignment, weight, size and color into CSS. */
export function styleGarageProgressionFromNode(
  host: GarageProgressionElementsHost,
  element: HTMLElement,
  name: string,
  dependencies: GarageProgressionElementsDependencies,
): void {
  const node = host.assets.nodes.get(name);
  if (!node) return;
  const alignment = new Set((dependencies.attribute(node, "textAlign") ?? "")
    .split(",").map(part => part.trim()).filter(Boolean));
  if (alignment.has("vcenter")) {
    element.style.display = "flex";
    element.style.alignItems = "center";
  }
  if (alignment.has("right")) element.style.justifyContent = "flex-end";
  else if (alignment.has("center") || alignment.has("hcenter"))
    element.style.justifyContent = "center";
  else if (alignment.has("left")) element.style.justifyContent = "flex-start";

  const textRender = dependencies.attribute(node, "textRender") ?? "";
  const fontSize = /([0-9]+)$/.exec(textRender)?.[1];
  if (fontSize) element.style.fontSize = `${fontSize}px`;
  if (textRender.startsWith("bold")) element.style.fontWeight = "700";

  const color = dependencies.attribute(node, "textColor");
  if (color === "white") element.style.color = "#fff";
  else if (color) {
    const [alpha, red, green, blue] = color.split(/\s+/).map(Number);
    if ([alpha, red, green, blue].every(Number.isFinite)) {
      element.style.color = `rgba(${red}, ${green}, ${blue}, ${alpha! / 255})`;
    }
  }
  if (textRender.startsWith("outline")) element.classList.add("garage-native-outline");
}

export function addGarageProgressionLabel(
  host: GarageProgressionElementsHost,
  text: string | undefined,
  rect: GarageProgressionRect,
  node?: string,
): void {
  const label = document.createElement("div");
  label.textContent = text as string;
  label.className = "garage-native-label";
  if (node) host.styleFromNode(label, node);
  host.place(label, rect);
}

/** Resolve a localized string from an authored text node and mount its native label. */
export function addGarageProgressionNativeLabel(
  host: GarageProgressionElementsHost,
  name: string,
  fallback: string,
  dependencies: GarageProgressionElementsDependencies,
): HTMLElement {
  const node = host.assets.nodes.get(name);
  const authoredText = node ? dependencies.attribute(node, "text") : undefined;
  const stringKey = authoredText?.match(/^#sb\((.+)\)$/)?.[1];
  const text = (stringKey ? host.assets.strings.get(stringKey) : authoredText) ?? fallback;
  const label = document.createElement("div");
  label.textContent = text.replaceAll("|", "\n");
  label.className = "garage-native-label";
  host.styleFromNode(label, name);
  host.place(label, host.rect(name));
  return label;
}

export function addGarageProgressionTexture(
  host: GarageProgressionElementsHost,
  texture: string,
  rect: GarageProgressionRect,
): void {
  const url = host.assets.urls.get(texture);
  if (!url) return;
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.className = "garage-tuning-art";
  host.place(image, rect);
}

function nativeButtonStatePath(base: string, state: number): string {
  return base.endsWith("@zz") ? `${base.slice(0, -3)}${state}@zz` : `${base}${state}`;
}

/** Build a strengthening control from native button textures, with a text fallback. */
export function addGarageProgressionButton(
  host: GarageProgressionElementsHost,
  name: string,
  title: string,
  action: () => void,
  disabled = false,
  xOffset = 0,
  dependencies: GarageProgressionElementsDependencies,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", title);
  button.title = title;
  button.disabled = disabled;
  const node = host.assets.nodes.get(name);
  const imageBase = node ? dependencies.attribute(node, "autoLoadImage") : undefined;
  button.className = "garage-native-button";
  if (imageBase) {
    for (let state = 1; state <= 4; state++) {
      const url = host.assets.urls.get(nativeButtonStatePath(imageBase, state));
      if (url) button.style.setProperty(`--button-${state}`, `url("${url}")`);
    }
  } else button.textContent = title;
  button.onclick = action;
  const rect = host.rect(name);
  host.place(button, { ...rect, x: rect.x + xOffset });
  if (node && dependencies.attribute(node, "frame"))
    host.framedControls.set(name, button);
  return button;
}
