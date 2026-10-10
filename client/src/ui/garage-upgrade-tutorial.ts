import type { GarageAssetEntry, GarageAssetNode, GarageAssetRect } from
  "./garage-asset-bundle";

export interface GarageTutorialLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
}

export interface GarageTutorialFrame { texture: string }

export interface GarageTutorialDependencies {
  parseBml(bytes: Uint8Array): GarageAssetNode;
  attribute(node: GarageAssetNode, name: string): string | undefined;
  frameStyle(node: GarageAssetNode): GarageTutorialFrame;
  layout(root: GarageAssetNode, bounds: GarageAssetRect,
    frames: Map<string, GarageTutorialFrame>): Map<GarageAssetNode, GarageAssetRect>;
  childRect(node: GarageAssetNode, parent: GarageAssetRect,
    unused1?: unknown, unused2?: unknown,
    imageSize?: { width: number; height: number }): GarageAssetRect;
  paintFrame(context: CanvasRenderingContext2D, frame: GarageTutorialFrame | undefined,
    image: ImageBitmap | undefined, rect: GarageAssetRect): void;
  sizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
    width: number, height: number, pixelRatio: number,
    logicalWidth: number, logicalHeight: number): void;
  pixelRatio(): number;
  fontFamily: string;
  loadFont(library: GarageTutorialLibrary): Promise<unknown>;
  unloadFont(font: unknown): void;
  bitmapMeta(bitmap: ImageBitmap): Promise<ImageBitmap>;
  createBitmap(blob: Blob): Promise<ImageBitmap>;
}

/** Display the authored upgrade tutorial, including keyboard and pointer navigation. */
export async function showGarageUpgradeTutorial(
  library: GarageTutorialLibrary,
  surface: HTMLElement,
  dependencies: GarageTutorialDependencies,
): Promise<() => void> {
  const read = async (path: string): Promise<Uint8Array> => {
    const resource = library.exactCanonicalCandidates(path)[0];
    if (!resource) throw new Error(`改装教程资源缺失：${path}`);
    return resource.bytes();
  };
  const [dialog, plant, strings, frameDefinition] = await Promise.all([
    "dialog/tutorial/tutorial.bml",
    "dialog/tutorial/plant/tutorial@cn.bml",
    "dialog/tutorial/tutorial_stringBag.bml",
    "gui_/monocoque/frame.bml",
  ].map(async path => dependencies.parseBml(await read(path))));
  const field = dependencies.attribute;
  const captions = new Map(strings!.children.map(node => [
    field(node, "n"),
    field(node.children.find(child => field(child, "c") === "cn") ?? node,
      "v") ?? "",
  ]));
  const frameGroups = frameDefinition!.children.filter(node =>
    ["CaptionDialog", "DefaultFocusedButton"].includes(node.name));
  const frameStates = new Map<string, GarageTutorialFrame>();
  for (const group of frameGroups)
    for (const child of group.children)
      frameStates.set(`${group.name}/${child.name}`,
        dependencies.frameStyle(child));
  const rootFrames = new Map(frameGroups
    .filter(group => group.children.length > 0)
    .map(group => [group.name, dependencies.frameStyle(group.children[0]!)]));
  const images = new Map<string, ImageBitmap>();
  let font: unknown;
  const unloadFont = (): void => {
    if (font) { dependencies.unloadFont(font); font = undefined; }
  };
  const loadImage = async (path: string): Promise<ImageBitmap> => {
    const bitmap = await dependencies.createBitmap(new Blob(
      [new Uint8Array(await read(path))], { type: "image/png" }));
    const image = await dependencies.bitmapMeta(bitmap);
    images.set(path, image);
    return image;
  };
  try {
    font = await dependencies.loadFont(library);
    const templates = await Promise.all(plant!.children.map(async page =>
      dependencies.parseBml(await read(
        `dialog/tutorial/template${field(page, "template")}.bml`))));
    const imagePaths = [
      ...new Set(plant!.children.map(page =>
        `dialog/tutorial/plant/${field(page, "image")}.png`)),
      ...new Set([...rootFrames.values()].filter(frame => frame.texture)
        .map(frame => `gui_/monocoque/${frame.texture}.png`)),
    ];
    const settled = await Promise.allSettled(imagePaths.map(loadImage));
    const failed = settled.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute", inset: "0", zIndex: "100",
      pointerEvents: "auto", background: "#0008",
    });
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", captions.get("title") || "改装教程");
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    Object.assign(canvas.style, {
      position: "absolute", inset: "0", width: "1600px",
      height: "900px", pointerEvents: "none",
    });
    const context = canvas.getContext("2d");
    if (!context) throw new Error("教程画布不可用。");
    const layout = dependencies.layout(dialog!,
      { x: 0, y: 0, width: 1600, height: 900 }, rootFrames);
    const content = dialog!.children.find(node => field(node, "name") === "context")!;
    const buttonGroup = dialog!.children.find(node =>
      field(node, "name") === "buttonGroup")!;
    const previousFocus = document.activeElement;
    let pageIndex = 0;
    let closed = false;
    let onResize: (() => void) | undefined;
    const close = (): void => {
      if (closed) return;
      closed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      overlay.remove();
      images.forEach(image => image.close());
      unloadFont();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
    const buttons = buttonGroup.children.map(node => {
      const button = document.createElement("button");
      const bounds = layout.get(node)!;
      button.type = "button";
      button.textContent = captions.get(field(node, "text")?.match(
        /#sb\((.+)\)/)?.[1]) ?? "";
      Object.assign(button.style, {
        position: "absolute", left: `${bounds.x}px`, top: `${bounds.y}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
        font: `16px "${dependencies.fontFamily}"`, background: "transparent",
        border: "0", padding: "0",
      });
      button.onclick = () => {
        const name = field(node, "name");
        if (name === "ok") close();
        else { pageIndex += name === "prev" ? -1 : 1; draw(); }
      };
      const paint = (state: string): void => {
        const frame = frameStates.get(
          `${field(node, "frame")}/${button.disabled ? "Disabled" : state}`);
        if (frame) dependencies.paintFrame(context, frame,
          images.get(`gui_/monocoque/${frame.texture}.png`), bounds);
        const color = field(node, button.disabled ? "disabledTextColor" :
          state === "Clicked" ? "clickedTextColor" :
            state === "MouseOn" ? "overTextColor" : "textColor") ?? "white";
        const components = color.split(/\s+/).map(Number);
        button.style.color = components.length === 4 ?
          `rgb(${components.slice(1).join(",")})` : color;
      };
      button.onpointerenter = () => paint("MouseOn");
      button.onpointerleave = () => paint("Normal");
      button.onpointerdown = () => paint("Clicked");
      button.onpointerup = () => paint("MouseOn");
      return { node, button, paint };
    });
    const draw = (): void => {
      const bounds = canvas.getBoundingClientRect();
      dependencies.sizeCanvas(canvas, context, bounds.width, bounds.height,
        dependencies.pixelRatio(), 1600, 900);
      context.imageSmoothingEnabled = true;
      context.clearRect(0, 0, 1600, 900);
      const dialogRect = layout.get(dialog!)!;
      const frame = rootFrames.get(field(dialog!, "frame") as string);
      dependencies.paintFrame(context, frame,
        images.get(`gui_/monocoque/${frame!.texture}.png`), dialogRect);
      context.fillStyle = field(dialog!, "captionColor")!;
      context.font = `16px "${dependencies.fontFamily}"`;
      context.textAlign = "center";
      context.fillText(captions.get("title") ?? "",
        dialogRect.x + dialogRect.width / 2, dialogRect.y + 22);
      const template = templates[pageIndex]!;
      const page = plant!.children[pageIndex]!;
      const image = images.get(
        `dialog/tutorial/plant/${field(page, "image")}.png`)!;
      const templateRect = dependencies.childRect(template,
        layout.get(content)!);
      const imageRect = dependencies.childRect(template.children[0]!,
        templateRect, undefined, undefined,
        { width: image.width, height: image.height });
      context.drawImage(image, imageRect.x, imageRect.y,
        imageRect.width, imageRect.height);
      for (const { node, button, paint } of buttons) {
        button.disabled = field(node, "name") === "prev" ? pageIndex === 0 :
          field(node, "name") === "next" ?
            pageIndex === plant!.children.length - 1 : false;
        const frame = frameStates.get(
          `${field(node, "frame")}/${button.disabled ? "Disabled" : "Normal"}`);
        if (frame) dependencies.paintFrame(context, frame,
          images.get(`gui_/monocoque/${frame.texture}.png`), layout.get(node)!);
        paint("Normal");
      }
    };
    overlay.onkeydown = event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        event.preventDefault();
        const enabled = buttons.map(item => item.button)
          .filter(button => !button.disabled);
        const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
        enabled[(current + (event.shiftKey ? enabled.length - 1 : 1)) %
          enabled.length]!.focus();
      }
    };
    overlay.append(canvas, ...buttons.map(item => item.button));
    surface.append(overlay);
    onResize = () => draw();
    window.addEventListener("resize", onResize);
    draw();
    buttons[2]!.button.focus();
    return close;
  } catch (error) {
    images.forEach(image => image.close());
    unloadFont();
    throw error;
  }
}
