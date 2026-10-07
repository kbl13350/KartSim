/** Three.js renderer for the legacy 2D tachometer and embedded Play1S panels. */

import {
  AddEquation, BufferAttribute, BufferGeometry, Camera, CustomBlending, DataTexture,
  DynamicDrawUsage, GreaterEqualDepth, LessEqualDepth, LinearFilter, Mesh, NearestFilter,
  NoColorSpace, OneMinusSrcAlphaFactor, RawShaderMaterial, RepeatWrapping, RGBAFormat,
  Scene, SrcAlphaFactor, UnsignedByteType, Vector2, Vector4, type WebGLRenderer,
} from "three";

export interface OverlayImage { pixels: Uint8Array; width: number; height: number; }
export interface OverlayRect { left: number; top: number; right: number; bottom: number;
  u0?: number; v0?: number; u1?: number; v1?: number; }

export type OverlayCommand = {
  kind: string;
  node?: unknown;
  texture?: OverlayImage;
  framebufferRect?: OverlayRect;
  framebufferPositions?: number[];
  framebufferQuads?: OverlayRect[];
  quad?: { uv: OverlayRect };
  uv?: OverlayRect;
  color?: number[];
  alpha?: number;
  binding?: { node: unknown; name: string };
  view?: number[];
  projection?: number[];
  steps?: string[];
  viewport?: { x: number; y: number; width: number; height: number };
  useV1CollisionDepthRange?: boolean;
};

export interface OverlayPlayRuntime {
  scene: { object: Scene };
  update(time: number): void;
  dispose(): void;
}

export interface OverlayDependencies {
  attribute(node: unknown, name: string): string | undefined;
  smoothImages(): boolean;
  smoothPixels(image: OverlayImage): Uint8Array;
  setPlayCamera(camera: Camera, view: number[], projection: number[]): void;
}

const depthOfUiQuad = 48.98989486694336 / 49.5;
const legacyCollisionDepthNear = Math.fround(9700 / 9801);

function isPlayPanel(command: OverlayCommand): boolean {
  return command.kind === "play-1s-panel" && "binding" in command && "steps" in command;
}

function isCanvasPanel(command: OverlayCommand): boolean {
  return command.kind === "solid-panel" && "color" in command && "framebufferRect" in command ||
    command.kind === "panel" && "texture" in command && "uv" in command ||
    command.kind === "char-panel" && "texture" in command && "framebufferQuads" in command ||
    command.kind === "graduation" && "texture" in command && "framebufferPositions" in command ||
    command.kind === "blink-button" && "texture" in command && "framebufferRect" in command;
}

function quadCount(command: OverlayCommand): number {
  return command.kind === "char-panel" ? command.framebufferQuads!.length : 1;
}

function createQuadGeometry(capacity: number): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(capacity * 4 * 3), 3);
  const uv = new BufferAttribute(new Float32Array(capacity * 4 * 2), 2);
  position.setUsage(DynamicDrawUsage);
  uv.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", uv);
  const indices = capacity * 4 <= 65535
    ? new Uint16Array(capacity * 6) : new Uint32Array(capacity * 6);
  for (let index = 0; index < capacity; index++) {
    const vertex = index * 4;
    const slot = index * 6;
    indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], slot);
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  return geometry;
}

function writeUv(buffer: ArrayLike<number> & { [index: number]: number }, index: number,
  left: number, top: number, right: number, bottom: number): void {
  const offset = index * 8;
  buffer[offset] = left;
  buffer[offset + 1] = top;
  buffer[offset + 2] = left;
  buffer[offset + 3] = bottom;
  buffer[offset + 4] = right;
  buffer[offset + 5] = top;
  buffer[offset + 6] = right;
  buffer[offset + 7] = bottom;
}

function writeRectangle(position: ArrayLike<number> & { [index: number]: number },
  uv: ArrayLike<number> & { [index: number]: number }, index: number,
  rectangle: OverlayRect, left = rectangle.u0 ?? 0, top = rectangle.v0 ?? 0,
  right = rectangle.u1 ?? 1, bottom = rectangle.v1 ?? 1): void {
  const offset = index * 12;
  position[offset] = rectangle.left;
  position[offset + 1] = rectangle.top;
  position[offset + 2] = depthOfUiQuad;
  position[offset + 3] = rectangle.left;
  position[offset + 4] = rectangle.bottom;
  position[offset + 5] = depthOfUiQuad;
  position[offset + 6] = rectangle.right;
  position[offset + 7] = rectangle.top;
  position[offset + 8] = depthOfUiQuad;
  position[offset + 9] = rectangle.right;
  position[offset + 10] = rectangle.bottom;
  position[offset + 11] = depthOfUiQuad;
  writeUv(uv, index, left, top, right, bottom);
}

function updateQuadGeometry(geometry: BufferGeometry, command: OverlayCommand): void {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const points = position.array;
  const textureCoordinates = uv.array;
  let count = 1;
  if (command.kind === "graduation") {
    for (let corner = 0; corner < 4; corner++) {
      points[corner * 3] = command.framebufferPositions![corner * 2]!;
      points[corner * 3 + 1] = command.framebufferPositions![corner * 2 + 1]!;
      points[corner * 3 + 2] = depthOfUiQuad;
    }
    const uvRect = command.quad!.uv;
    writeUv(textureCoordinates, 0, uvRect.left, uvRect.top, uvRect.right, uvRect.bottom);
  } else if (command.kind === "char-panel") {
    count = command.framebufferQuads!.length;
    for (let index = 0; index < count; index++)
      writeRectangle(points, textureCoordinates, index, command.framebufferQuads![index]!);
  } else {
    const uvRect = command.kind === "panel" ? command.uv : undefined;
    writeRectangle(points, textureCoordinates, 0, command.framebufferRect!,
      uvRect?.left ?? 0, uvRect?.top ?? 0, uvRect?.right ?? 1, uvRect?.bottom ?? 1);
  }
  geometry.setDrawRange(0, count * 6);
  position.needsUpdate = true;
  uv.needsUpdate = true;
}

function createSolidMaterial(): RawShaderMaterial {
  return new RawShaderMaterial({
    name: "KartRider Solid Panel",
    uniforms: { viewport: { value: new Vector2() }, color: { value: new Vector4() } },
    vertexShader: `
      precision highp float;
      attribute vec3 position;
      uniform vec2 viewport;
      void main() {
        gl_Position = vec4(position.x * 2.0 / viewport.x - 1.0, 1.0 - position.y * 2.0 / viewport.y, position.z * 2.0 - 1.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
        if (gl_FragColor.a <= 8.0 / 255.0) discard;
      }
    `,
    transparent: true, depthTest: true, depthWrite: true, depthFunc: LessEqualDepth,
    blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
    blendEquation: AddEquation, toneMapped: false,
  });
}

export class DerivedOverlayRenderer {
  readonly overlayScene = new Scene();
  readonly overlayCamera = new Camera();
  readonly playCamera = new Camera();
  readonly savedViewport = new Vector4();
  readonly textures = new Map<OverlayImage, DataTexture>();
  readonly materials = new Map<OverlayImage, RawShaderMaterial>();
  readonly solidMaterial = createSolidMaterial();
  overlayGeometry = createQuadGeometry(1);
  readonly overlayMesh = new Mesh(this.overlayGeometry, this.solidMaterial);
  overlayQuadCapacity = 1;
  commands: OverlayCommand[] = [];
  smoothTextures = false;

  constructor(readonly playRuntimes: Map<unknown, OverlayPlayRuntime>,
    readonly alphaTestReference = 8, readonly dependencies: OverlayDependencies) {
    this.overlayScene.name = "derived-overlay";
    this.overlayMesh.frustumCulled = false;
    this.overlayScene.add(this.overlayMesh);
    this.playCamera.matrixWorldAutoUpdate = false;
  }

  enableUiSmoothing(): void { this.smoothTextures = true; }

  update(commands: OverlayCommand[], time: number): void {
    this.commands = commands;
    this.playRuntimes.forEach(runtime => runtime.update(time));
  }

  render(renderer: WebGLRenderer, width: number, height: number): void {
    renderer.getViewport(this.savedViewport);
    const priorAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      for (const command of this.commands) {
        if (isPlayPanel(command)) this.renderPlay1S(renderer, command, height);
        else if (isCanvasPanel(command)) {
          renderer.setViewport(0, 0, width, height);
          this.render2D(renderer, command, width, height);
        } else throw new Error(`${command.kind} 缺少已闭合的 P3528 derived payload。`);
      }
    } finally {
      renderer.setViewport(this.savedViewport);
      renderer.autoClear = priorAutoClear;
    }
  }

  render2D(renderer: WebGLRenderer, command: OverlayCommand, width: number, height: number): void {
    this.ensureOverlayCapacity(quadCount(command));
    updateQuadGeometry(this.overlayGeometry, command);
    const material = command.kind === "solid-panel"
      ? this.solidMaterial : this.material(command.texture!, width, height);
    const name = this.dependencies.attribute(command.node, "name");
    material.depthFunc = name !== undefined && /^(?:indi|team)BoostMask[1-9][0-9]*$/.test(name)
      ? GreaterEqualDepth : LessEqualDepth;
    material.uniforms.viewport!.value.set(width, height);
    if (command.kind === "solid-panel") {
      material.uniforms.color!.value.set(
        command.color![0]! / 255, command.color![1]! / 255,
        command.color![2]! / 255, command.color![3]! / 255);
    } else {
      material.uniforms.alpha!.value = command.kind === "panel" || command.kind === "graduation"
        ? (command.alpha ?? 255) / 255 : 1;
    }
    this.overlayMesh.material = material;
    renderer.render(this.overlayScene, this.overlayCamera);
  }

  ensureOverlayCapacity(quads: number): void {
    if (quads <= this.overlayQuadCapacity) return;
    let capacity = this.overlayQuadCapacity;
    while (capacity < quads) capacity *= 2;
    const previous = this.overlayGeometry;
    this.overlayGeometry = createQuadGeometry(capacity);
    this.overlayMesh.geometry = this.overlayGeometry;
    this.overlayQuadCapacity = capacity;
    previous.dispose();
  }

  renderPlay1S(renderer: WebGLRenderer, command: OverlayCommand, height: number): void {
    const runtime = this.playRuntimes.get(command.binding!.node);
    if (!runtime) throw new Error(`P3528 ${command.binding!.name} Play1S runtime 缺失。`);
    this.dependencies.setPlayCamera(this.playCamera, command.view!, command.projection!);
    const context = command.useV1CollisionDepthRange ? renderer.getContext() : undefined;
    context?.depthRange(legacyCollisionDepthNear, 1);
    try {
      for (const step of command.steps!) {
        if (step === "clear-depth") renderer.clearDepth();
        else {
          const viewport = command.viewport!;
          renderer.setViewport(viewport.x, height - viewport.y - viewport.height,
            viewport.width, viewport.height);
          renderer.render(runtime.scene.object, this.playCamera);
        }
      }
      if (command.steps!.at(-1) !== "clear-depth") renderer.clearDepth();
    } finally {
      context?.depthRange(0, 1);
    }
  }

  material(image: OverlayImage, width: number, height: number): RawShaderMaterial {
    let material = this.materials.get(image);
    if (material) {
      material.uniforms.viewport!.value.set(width, height);
      return material;
    }
    let texture = this.textures.get(image);
    if (!texture) {
      const smooth = this.smoothTextures || this.dependencies.smoothImages();
      const pixels = smooth ? this.dependencies.smoothPixels(image) : image.pixels;
      texture = new DataTexture(pixels, image.width, image.height, RGBAFormat, UnsignedByteType);
      texture.colorSpace = NoColorSpace;
      texture.flipY = false;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.magFilter = texture.minFilter = smooth ? LinearFilter : NearestFilter;
      texture.generateMipmaps = false;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;
      this.textures.set(image, texture);
    }
    material = new RawShaderMaterial({
      name: "KartRider Derived Tachometer",
      defines: texture.magFilter === LinearFilter ? { HUD_ALPHA_WEIGHTED: 1 } : {},
      uniforms: {
        map: { value: texture }, viewport: { value: new Vector2(width, height) },
        alpha: { value: 1 }, alphaTestReference: { value: this.alphaTestReference / 255 },
      },
      vertexShader: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform vec2 viewport;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.x * 2.0 / viewport.x - 1.0, 1.0 - position.y * 2.0 / viewport.y, position.z * 2.0 - 1.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D map;
        uniform float alpha;
        uniform float alphaTestReference;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(map, vUv);
          #ifdef HUD_ALPHA_WEIGHTED
          // Restore straight color before the existing window alpha and SrcAlpha blend.
          gl_FragColor.rgb = gl_FragColor.a > 0.0 ? gl_FragColor.rgb / gl_FragColor.a : vec3(0.0);
          #endif
          gl_FragColor.a *= alpha;
          if (gl_FragColor.a <= alphaTestReference) discard;
        }
      `,
      transparent: true, depthTest: true, depthWrite: true, depthFunc: LessEqualDepth,
      blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
      blendEquation: AddEquation, toneMapped: false,
    });
    this.materials.set(image, material);
    return material;
  }

  dispose(): void {
    this.overlayMesh.removeFromParent();
    this.overlayGeometry.dispose();
    this.playRuntimes.forEach(runtime => runtime.dispose());
    this.materials.forEach(material => material.dispose());
    this.solidMaterial.dispose();
    this.textures.forEach(texture => texture.dispose());
  }
}
