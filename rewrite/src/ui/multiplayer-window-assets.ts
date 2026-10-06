/** Resources needed by the reusable multiplayer BML window renderer. */
export interface WindowNode {
  name: string;
  children: WindowNode[];
}

export interface WindowSprite {
  image: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface WindowFrame { texture?: string }

export interface WindowResource {
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface MultiplayerWindowAssetHost {
  options: {
    library: { canonicalCandidates(path: string): WindowResource[] };
    roots: string[];
    definition: WindowNode;
    projectTexture?(name: string, canvas: HTMLCanvasElement): HTMLCanvasElement;
    modulateTextures?: boolean;
  };
  frames: Map<string, WindowFrame[]>;
  textures: Map<WindowNode, WindowSprite[]>;
  styles: Map<WindowNode, { states: Array<{ frame: { texture?: string } }> }>;
  images: Map<string, WindowSprite>;
  strings: Map<string, string>;
  config?: WindowNode;
  font?: unknown;
}

export interface MultiplayerWindowAssetDependencies {
  loadBml(library: MultiplayerWindowAssetHost["options"]["library"],
    root: string, name: string): Promise<WindowNode>;
  findResource(library: MultiplayerWindowAssetHost["options"]["library"],
    roots: string[], name: string, extension?: string): WindowResource;
  decodeTexture(bytes: Uint8Array): Promise<{
    width: number; height: number; pixels: Uint8Array;
  }>;
  frame(node: WindowNode): WindowFrame;
  attribute(node: WindowNode, name: string): string | undefined;
  buttonStyle(node: WindowNode, config: WindowNode, frames: WindowNode):
    { states: Array<{ frame: { texture?: string } }> };
  parseBml(bytes: Uint8Array): WindowNode;
  loadFont(family: string, bytes: Uint8Array): Promise<unknown>;
  fontFamily: string;
}

export async function loadMultiplayerWindowAssets(
  host: MultiplayerWindowAssetHost,
  dependencies: MultiplayerWindowAssetDependencies,
): Promise<void> {
  const { library, roots } = host.options;
  const { attribute, findResource } = dependencies;
  const frameTree = await dependencies.loadBml(library, "gui_/monocoque", "frame");
  host.config = await dependencies.loadBml(library, "gui_/monocoque", "config");
  for (const entry of frameTree.children)
    host.frames.set(entry.name, entry.children.map(dependencies.frame));

  const pendingTextures = new Map<string, Promise<WindowSprite>>();
  function loadTexture(name: string, fromMonocoque = false,
    resourceRoot?: string): Promise<WindowSprite> {
    const cacheKey = `${fromMonocoque}:${resourceRoot ?? ""}:${name}`;
    let pending = pendingTextures.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        const resource = findResource(library,
          fromMonocoque ? ["gui_/monocoque"] : resourceRoot ? [resourceRoot] : roots,
          name);
        const decoded = await dependencies.decodeTexture(await resource.bytes());
        const canvas = document.createElement("canvas");
        canvas.width = decoded.width;
        canvas.height = decoded.height;
        canvas.getContext("2d")!.putImageData(new ImageData(
          new Uint8ClampedArray(decoded.pixels), canvas.width, canvas.height), 0, 0);
        const image = host.options.projectTexture?.(name, canvas) ?? canvas;
        return { image, width: image.width, height: image.height };
      })();
      pendingTextures.set(cacheKey, pending);
    }
    return pending;
  }

  async function visit(node: WindowNode): Promise<void> {
    const imageSeries = attribute(node, "autoLoadImage") ??
      attribute(node, "autoLoadImageBoard");
    const textureName = attribute(node, "texture") ?? attribute(node, "image");
    if (imageSeries) {
      host.textures.set(node, await Promise.all([1, 2, 3, 4].map(index =>
        loadTexture(imageSeries.replace(/(@zz)?$/, `${index}$1`)))));
    } else if (textureName) {
      host.textures.set(node,
        [await loadTexture(textureName, false, attribute(node, "resourceRoot"))]);
    }

    const color = attribute(node, "color");
    if (host.options.modulateTextures && textureName && color &&
        attribute(node, "textureOp") === "modulate") {
      const sprite = host.textures.get(node)![0]!;
      const [alpha, red, green, blue] = color.split(/\s+/).map(Number);
      const tinted = document.createElement("canvas");
      tinted.width = sprite.width;
      tinted.height = sprite.height;
      const context = tinted.getContext("2d")!;
      context.drawImage(sprite.image, 0, 0);
      const pixels = context.getImageData(0, 0, tinted.width, tinted.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        pixels.data[index] = pixels.data[index]! * red! / 255;
        pixels.data[index + 1] = pixels.data[index + 1]! * green! / 255;
        pixels.data[index + 2] = pixels.data[index + 2]! * blue! / 255;
        pixels.data[index + 3] = pixels.data[index + 3]! * alpha! / 255;
      }
      context.putImageData(pixels, 0, 0);
      host.textures.set(node, [{ ...sprite, image: tinted }]);
    }

    if (node.name === "TextButton")
      host.styles.set(node, dependencies.buttonStyle(node, host.config!, frameTree));
    const frameName = attribute(node, "frame") ??
      (node.name === "Edit" ? "DefaultEdit" :
        node.name === "PlaneCheckButton" ? "DefaultCheckButton" : "");
    const frames = host.styles.get(node)?.states.map(state => state.frame) ??
      host.frames.get(frameName) ?? [];
    for (const frame of frames) {
      if (frame.texture && !host.images.has(frame.texture))
        host.images.set(frame.texture, await loadTexture(frame.texture, true));
    }
    await Promise.all(node.children.map(visit));
  }
  await visit(host.options.definition);

  const stringBag = await findResource(library, ["etc_"], "baseStringBag", ".xml").text();
  new DOMParser().parseFromString(stringBag, "application/xml")
    .querySelectorAll("k").forEach(entry => {
      const name = entry.getAttribute("n");
      const value = entry.querySelector('m[c="cn"]')?.getAttribute("v");
      if (name && value) host.strings.set(name, value);
    });
  for (const root of roots) {
    for (const name of ["stage_stringBag", "dialog_stringBag", "passwordBox_stringBag"]) {
      const candidates = library.canonicalCandidates(`${root}/${name}.bml`);
      if (candidates.length !== 1) continue;
      for (const entry of dependencies.parseBml(await candidates[0]!.bytes()).children) {
        const key = attribute(entry, "n");
        const local = entry.children.find(child => attribute(child, "c") === "cn");
        if (key && local) host.strings.set(key, attribute(local, "v") ?? "");
      }
    }
  }
  host.font = await dependencies.loadFont(dependencies.fontFamily,
    await findResource(library, ["gui_/font"], "SourceHanSansCN-Bold", ".otf").bytes());
}
