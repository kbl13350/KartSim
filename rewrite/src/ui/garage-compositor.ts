/** A rectangle in the garage canvas's top-left coordinate system. */
export interface GarageRect { x: number; y: number; width: number; height: number }

export interface GarageCanvas {
  width: number;
  height: number;
  getContext(kind: "2d"): CanvasRenderingContext2D | null;
}

export interface GarageTexture {
  minFilter: unknown;
  magFilter: unknown;
  generateMipmaps: boolean;
  needsUpdate: boolean;
  dispose(): void;
}

export interface GarageRenderer {
  outputColorSpace: unknown;
  autoClear: boolean;
  setClearColor(color: number, alpha: number): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  setViewport(x: number, y: number, width: number, height: number): void;
  setScissor(x: number, y: number, width: number, height: number): void;
  setScissorTest(enabled: boolean): void;
  clear(color: boolean, depth: boolean, stencil: boolean): void;
  render(scene: unknown, camera: unknown): void;
  dispose(): void;
}

export interface GarageCamera {
  left: number; right: number; top: number; bottom: number; near: number; far: number;
  updateProjectionMatrix(): void;
}

export interface GarageMaterial {
  uniforms: { image: { value: unknown }; opacity: { value: number } };
  dispose(): void;
}

export interface GarageQuad {
  frustumCulled: boolean;
  geometry: { dispose(): void };
  position: { set(x: number, y: number, z: number): void };
  scale: { set(x: number, y: number, z: number): void };
}

export interface GarageCompositorDependencies {
  createCanvas(): GarageCanvas;
  createRenderer(canvas: GarageCanvas): GarageRenderer;
  createScene(): { add(object: GarageQuad): void };
  createCamera(): GarageCamera;
  createMaterial(options: Record<string, unknown>): GarageMaterial;
  createQuad(material: GarageMaterial): GarageQuad;
  createTexture(canvas: GarageCanvas): GarageTexture;
  outputColorSpace: unknown;
  canvasTextureFilter: unknown;
  paintTextureFilter: unknown;
}

export interface GaragePaintState {
  [name: string]: unknown;
  lineWidth: number;
  miterLimit: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

type PaintMethod = "drawImage" | "fillRect" | "fillText" | "strokeText" | "fill" | "stroke";
type PathMethod = "moveTo" | "lineTo" | "closePath";
export interface GaragePathCommand { method: PathMethod; args: unknown[] }
export interface GaragePaint {
  method: PaintMethod;
  args: unknown[];
  state: GaragePaintState;
  transform: [number, number, number, number, number, number];
  path?: GaragePathCommand[];
}

interface RasterLayer { texture: GarageTexture; rect: GarageRect; bytes: number }
interface CanvasLayer { texture: GarageTexture; revision: unknown; used: boolean }

const PAINT_METHODS = new Set<PaintMethod>([
  "drawImage", "fillRect", "fillText", "strokeText", "fill", "stroke",
]);
const UNSUPPORTED_METHODS = new Set([
  "arc", "arcTo", "ellipse", "rect", "roundRect", "bezierCurveTo",
  "quadraticCurveTo", "strokeRect", "putImageData", "clip", "reset",
]);
const PAINT_STATE_FIELDS = [
  "fillStyle", "strokeStyle", "font", "fontKerning", "letterSpacing",
  "textAlign", "textBaseline", "direction", "lineWidth", "lineJoin",
  "miterLimit", "globalAlpha", "globalCompositeOperation",
  "imageSmoothingEnabled", "imageSmoothingQuality", "shadowBlur",
  "shadowColor", "shadowOffsetX", "shadowOffsetY",
] as const;
const MAX_LAYER_BYTES = 64 * 1024 * 1024;

/** Convert a 2D canvas rectangle to the renderer's bottom-left viewport. */
export function garageViewportRect(
  rect: GarageRect, scaleX: number, scaleY: number, canvasHeight: number,
  translateX = 0, translateY = 0,
): GarageRect {
  const x = Math.trunc(rect.x * scaleX + translateX);
  const y = Math.trunc(rect.y * scaleY + translateY);
  const width = Math.trunc(rect.width * scaleX);
  const height = Math.trunc(rect.height * scaleY);
  return { x, y: canvasHeight - y - height, width, height };
}

/** Records 2D paints as cached textures and interleaves them with WebGL garage views. */
export class GarageCanvasCompositor {
  readonly canvas: GarageCanvas;
  readonly renderer: GarageRenderer;
  readonly context: CanvasRenderingContext2D;
  readonly state: CanvasRenderingContext2D;
  readonly scene: { add(object: GarageQuad): void };
  readonly camera: GarageCamera;
  readonly material: GarageMaterial;
  readonly quad: GarageQuad;
  layers = new Map<string, RasterLayer>();
  imageIds = new WeakMap<object, number>();
  canvasLayers = new Map<GarageCanvas, CanvasLayer>();
  nextImageId = 0;
  paints: GaragePaint[] = [];
  path: GaragePathCommand[] = [];
  layerBytes = 0;
  backingWidth = 0;
  backingHeight = 0;
  disposed = false;

  constructor(canvas: GarageCanvas, readonly dependencies: GarageCompositorDependencies) {
    this.canvas = canvas;
    this.scene = dependencies.createScene();
    this.camera = dependencies.createCamera();
    this.material = dependencies.createMaterial({
      uniforms: { image: { value: null }, opacity: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform sampler2D image; uniform float opacity; varying vec2 vUv; void main(){ gl_FragColor=texture2D(image,vUv); gl_FragColor.a*=opacity; }",
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.quad = dependencies.createQuad(this.material);
    const state = dependencies.createCanvas().getContext("2d");
    if (!state) throw new Error("浏览器无法创建车库界面绘制上下文。");
    this.state = state;
    this.renderer = dependencies.createRenderer(canvas);
    this.renderer.outputColorSpace = dependencies.outputColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0, 0);
    this.scene.add(this.quad);
    this.quad.frustumCulled = false;
    this.context = new Proxy(state, {
      get: (target, property) => {
        if (property === "canvas") return canvas;
        if (property === "clearRect") return () => {
          if (this.paints.length) throw new Error("车库仅在帧开始清理最终颜色目标。");
        };
        if (property === "beginPath") return () => { this.path = []; };
        if (property === "moveTo" || property === "lineTo" || property === "closePath") {
          return (...args: unknown[]) => {
            this.path = [...this.path, { method: property, args }];
          };
        }
        if (typeof property === "string" && PAINT_METHODS.has(property as PaintMethod)) {
          return (...args: unknown[]) => this.record(property as PaintMethod, args);
        }
        if (UNSUPPORTED_METHODS.has(String(property))) {
          return () => { throw new Error(`车库绘制目标未接入 ${String(property)}。`); };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set: (target, property, value) => Reflect.set(target, property, value, target),
    });
  }

  beginFrame(): void {
    if (this.disposed) return;
    this.paints = [];
    this.path = [];
    this.canvasLayers.forEach(layer => { layer.used = false; });
    const { width, height } = this.canvas;
    if (width !== this.backingWidth || height !== this.backingHeight) {
      this.renderer.setSize(width, height, false);
      this.backingWidth = width;
      this.backingHeight = height;
      this.releaseLayers();
      this.camera.left = 0;
      this.camera.right = width;
      this.camera.top = height;
      this.camera.bottom = 0;
      this.camera.near = -1;
      this.camera.far = 1;
      this.camera.updateProjectionMatrix();
    }
    this.fullViewport();
    this.renderer.clear(true, true, false);
  }

  endFrame(): void {
    this.flush();
    for (const [canvas, layer] of this.canvasLayers) {
      if (!layer.used) {
        layer.texture.dispose();
        this.canvasLayers.delete(canvas);
      }
    }
  }

  drawCanvasLayer(canvas: GarageCanvas, rect: GarageRect, revision: unknown,
    clip?: GarageRect, opacity = 1): void {
    if (this.disposed || !canvas.width || !canvas.height) return;
    this.flush();
    let layer = this.canvasLayers.get(canvas);
    if (layer) {
      if (revision === undefined || revision !== layer.revision) layer.texture.needsUpdate = true;
      layer.revision = revision;
      layer.used = true;
    } else {
      const texture = this.dependencies.createTexture(canvas);
      texture.minFilter = texture.magFilter = this.dependencies.canvasTextureFilter;
      texture.generateMipmaps = false;
      layer = { texture, revision, used: true };
      this.canvasLayers.set(canvas, layer);
    }
    const transform = this.state.getTransform();
    const x = transform.a * rect.x + transform.e;
    const y = transform.d * rect.y + transform.f;
    const width = transform.a * rect.width;
    const height = transform.d * rect.height;
    this.fullViewport();
    if (clip) {
      const scissor = garageViewportRect(clip, transform.a, transform.d,
        this.canvas.height, transform.e, transform.f);
      this.renderer.setScissor(scissor.x, scissor.y, scissor.width, scissor.height);
      this.renderer.setScissorTest(true);
    }
    this.material.uniforms.image.value = layer.texture;
    this.material.uniforms.opacity.value = opacity;
    this.quad.position.set(x + width / 2, this.canvas.height - y - height / 2, 0);
    this.quad.scale.set(width, height, 1);
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.fullViewport();
    }
  }

  drawModel(rect: GarageRect, draw: (renderer: GarageRenderer) => void): void {
    this.flush();
    const transform = this.state.getTransform();
    const viewport = garageViewportRect(rect, transform.a, transform.d,
      this.canvas.height, transform.e, transform.f);
    this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
    this.renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height);
    this.renderer.setScissorTest(true);
    try {
      draw(this.renderer);
    } finally {
      this.renderer.clear(false, true, false);
      this.fullViewport();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.paints = [];
    this.releaseLayers();
    this.canvasLayers.forEach(layer => layer.texture.dispose());
    this.canvasLayers.clear();
    this.material.dispose();
    this.quad.geometry.dispose();
    this.renderer.dispose();
  }

  record(method: PaintMethod, args: unknown[]): void {
    const state = Object.fromEntries(PAINT_STATE_FIELDS.map(name => [
      name, (this.state as unknown as Record<string, unknown>)[name],
    ])) as GaragePaintState;
    const { a, b, c, d, e, f } = this.state.getTransform();
    const path = method === "fill" || method === "stroke" ? this.path : undefined;
    if (path && args.length) {
      throw new Error("车库多边形仅接入现有雷达 owner 的无参数提交。");
    }
    if (path && !path.some(step => step.args.length === 2)) return;
    this.paints.push({ method, args, state, transform: [a, b, c, d, e, f], path });
  }

  flush(): void {
    if (!this.paints.length || this.disposed) return;
    const paints = this.paints;
    this.paints = [];
    const key = JSON.stringify(paints.map(paint => ({
      ...paint,
      args: paint.args.map(argument => {
        if (typeof argument !== "object" || argument === null) return argument;
        let id = this.imageIds.get(argument);
        if (id === undefined) {
          id = ++this.nextImageId;
          this.imageIds.set(argument, id);
        }
        return { image: id };
      }),
    })));
    let layer = this.layers.get(key);
    if (layer) {
      this.layers.delete(key);
      this.layers.set(key, layer);
    } else {
      layer = this.rasterize(paints);
      if (!layer) return;
      this.layers.set(key, layer);
      this.layerBytes += layer.bytes;
      while (this.layerBytes > MAX_LAYER_BYTES && this.layers.size > 1) {
        const oldest = this.layers.entries().next().value as [string, RasterLayer];
        this.layers.delete(oldest[0]);
        this.layerBytes -= oldest[1].bytes;
        oldest[1].texture.dispose();
      }
    }
    this.fullViewport();
    this.material.uniforms.image.value = layer.texture;
    this.material.uniforms.opacity.value = 1;
    this.quad.position.set(
      layer.rect.x + layer.rect.width / 2,
      this.canvas.height - layer.rect.y - layer.rect.height / 2, 0,
    );
    this.quad.scale.set(layer.rect.width, layer.rect.height, 1);
    this.renderer.render(this.scene, this.camera);
  }

  rasterize(paints: GaragePaint[]): RasterLayer | undefined {
    const bounds = paints.map(paint => this.paintBounds(paint));
    const left = Math.max(0, Math.floor(Math.min(...bounds.map(rect => rect.x))));
    const top = Math.max(0, Math.floor(Math.min(...bounds.map(rect => rect.y))));
    const right = Math.min(this.canvas.width,
      Math.ceil(Math.max(...bounds.map(rect => rect.x + rect.width))));
    const bottom = Math.min(this.canvas.height,
      Math.ceil(Math.max(...bounds.map(rect => rect.y + rect.height))));
    if (right <= left || bottom <= top) return undefined;
    const canvas = this.dependencies.createCanvas();
    canvas.width = right - left;
    canvas.height = bottom - top;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    for (const paint of paints) {
      Object.assign(context, paint.state);
      const [a, b, c, d, e, f] = paint.transform;
      context.setTransform(a, b, c, d, e - left, f - top);
      if (paint.path) {
        context.beginPath();
        for (const step of paint.path) {
          (Reflect.get(context, step.method, context) as (...args: unknown[]) => void)
            .apply(context, step.args);
        }
      }
      (Reflect.get(context, paint.method, context) as (...args: unknown[]) => void)
        .apply(context, paint.args);
    }
    const texture = this.dependencies.createTexture(canvas);
    texture.minFilter = texture.magFilter = this.dependencies.paintTextureFilter;
    texture.generateMipmaps = false;
    return {
      texture,
      rect: { x: left, y: top, width: canvas.width, height: canvas.height },
      bytes: canvas.width * canvas.height * 4,
    };
  }

  paintBounds(paint: GaragePaint): GarageRect {
    const args = paint.args;
    let x: number, y: number, width: number, height: number;
    if (paint.path) {
      const points = paint.path.filter(step => step.args.length === 2).map(step => step.args);
      const margin = paint.method === "stroke"
        ? paint.state.lineWidth * paint.state.miterLimit : 1;
      x = Math.min(...points.map(point => Number(point[0]))) - margin;
      y = Math.min(...points.map(point => Number(point[1]))) - margin;
      width = Math.max(...points.map(point => Number(point[0]))) - x + margin;
      height = Math.max(...points.map(point => Number(point[1]))) - y + margin;
    } else if (paint.method === "drawImage") {
      const image = args[0] as { width: number; height: number };
      const offset = args.length === 9 ? 5 : 1;
      x = Number(args[offset]);
      y = Number(args[offset + 1]);
      width = args.length === 3 ? image.width : Number(args[offset + 2]);
      height = args.length === 3 ? image.height : Number(args[offset + 3]);
    } else if (paint.method === "fillRect") {
      [x, y, width, height] = args.map(Number) as [number, number, number, number];
    } else {
      this.state.save();
      Object.assign(this.state, paint.state);
      const metrics = this.state.measureText(String(args[0]));
      this.state.restore();
      const margin = (paint.method === "strokeText"
        ? paint.state.lineWidth * paint.state.miterLimit : 0) + 2;
      x = Number(args[1]) - metrics.actualBoundingBoxLeft - margin;
      y = Number(args[2]) - metrics.actualBoundingBoxAscent - margin;
      width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + margin * 2;
      height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + margin * 2;
    }
    const [a, b, c, d, e, f] = paint.transform;
    const localCorners: [number, number][] = [
      [x, y], [x + width, y], [x, y + height], [x + width, y + height],
    ];
    const corners = localCorners.map(([localX, localY]): [number, number] => [
      a * localX + c * localY + e,
      b * localX + d * localY + f,
    ]);
    const xs = corners.map(([pointX]) => pointX);
    const ys = corners.map(([, pointY]) => pointY);
    const shadow = paint.state.shadowBlur * 2 +
      Math.abs(paint.state.shadowOffsetX) + Math.abs(paint.state.shadowOffsetY);
    return {
      x: Math.min(...xs) - shadow,
      y: Math.min(...ys) - shadow,
      width: Math.max(...xs) - Math.min(...xs) + shadow * 2,
      height: Math.max(...ys) - Math.min(...ys) + shadow * 2,
    };
  }

  fullViewport(): void {
    this.renderer.setViewport(0, 0, this.canvas.width, this.canvas.height);
    this.renderer.setScissorTest(false);
  }

  releaseLayers(): void {
    this.layers.forEach(layer => layer.texture.dispose());
    this.layers.clear();
    this.layerBytes = 0;
    this.material.uniforms.image.value = null;
  }
}
