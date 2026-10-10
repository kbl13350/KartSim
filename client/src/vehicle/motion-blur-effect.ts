/** Kart booster motion blur: capture, temporal feedback and mask composite. */

type Constructor = new (...args: any[]) => any;
export interface MotionBlurRendererOps {
  Scene: Constructor;
  Camera: Constructor;
  Geometry: Constructor;
  FloatAttribute: Constructor;
  Mesh: Constructor;
  Vector2: Constructor;
  Vector3: Constructor;
  ShaderMaterial: Constructor;
  RenderTarget: Constructor;
  DataTexture: Constructor;
  FramebufferTexture: Constructor;
  decodePng(bytes: unknown): Promise<{ pixels: unknown; width: number; height: number }>;
  colorSpace: unknown;
  clampWrapping: unknown;
  linearFilter: unknown;
  textureFormat: unknown;
  textureType: unknown;
  customBlending: unknown;
  additiveEquation: unknown;
  sourceAlpha: unknown;
  oneMinusSourceAlpha: unknown;
}

export interface MotionBlurArchive {
  exactCanonicalCandidates(path: string): { bytes(): Promise<unknown> }[];
}
export interface MotionBlurDefinition {
  boosterBlur: boolean;
  boostBlurColorSource?: string;
}

const targetSize = 256;
const transitionDurationMs = 500;
const feedbackDecay = Math.fround(0.8999999761581421);
const blurPhysicsStates = new Set([3, 4, 5, 6, 7, 9]);
const defaultArgb = 4294967295;
const primaryMaskPath = "effect/boosterBlur/blurMask.png";
const secondaryMaskPath = "effect/boosterBlur/blurMask2.png";
const f32 = Math.fround;

/** ARGB bytes in release order, or opaque white when the property is absent. */
export function parseMotionBlurColor(source?: string): number {
  if (source === undefined) return defaultArgb;
  const channels = source.trim().split(/\s+/).map(Number);
  if (channels.length !== 4 || channels.some(channel =>
    !Number.isInteger(channel) || channel < 0 || channel > 255))
    throw new Error(`BoostBlurColor ${source} 不是 A R G B bytes。`);
  return ((channels[0]! << 24) | (channels[1]! << 16) |
    (channels[2]! << 8) | channels[3]!) >>> 0;
}

/** State entry needs an initial 150 ms; an active blur stays on until its exit gate. */
export function motionBlurEnabled(current: boolean, physicsState: number,
  previousPhysicsState: number, elapsedMs: number, eligible: boolean): boolean {
  if (!eligible || previousPhysicsState === 0) return false;
  return current ? elapsedMs >= 150 : blurPhysicsStates.has(physicsState) && elapsedMs > 150;
}

/** Restart a 500 ms transition while preserving the elapsed part of a rapid reversal. */
export function motionBlurTransitionStart(previousStartMs: number, nowMs: number): number {
  const elapsed = (nowMs - previousStartMs) >>> 0;
  const rewind = elapsed < transitionDurationMs ? transitionDurationMs - elapsed : 0;
  return (nowMs - rewind) >>> 0;
}

export function motionBlurOpacity(enabled: boolean, transitionStartMs: number, nowMs: number): number {
  const elapsed = (nowMs - transitionStartMs) >>> 0;
  if (elapsed >= transitionDurationMs) return enabled ? 1 : 0;
  const ratio = f32(elapsed / transitionDurationMs);
  return enabled ? ratio : f32(1 - ratio);
}

export function motionBlurMaskOpacity(argb: number, transitionOpacity: number): number {
  return Math.trunc(f32((argb >>> 24) * transitionOpacity)) / 255;
}

/** Feedback texture replacement is quantized to 100 ms decay intervals. */
export function motionBlurCaptureOpacity(lastCaptureMs: number | undefined,
  nowMs: number, durationMs: number): number | undefined {
  if (lastCaptureMs === undefined) return 1;
  const elapsed = (nowMs - lastCaptureMs) >>> 0;
  if (elapsed >= durationMs) return 1;
  const interval = Math.floor(durationMs / 100);
  if (elapsed < interval) return undefined;
  const steps = Math.floor(elapsed / interval);
  let retained = f32(1);
  for (let step = 0; step < steps; step += 1) retained = f32(retained * feedbackDecay);
  return Math.trunc(f32(f32(1 - retained) * 255)) / 255;
}

function tick(value: number): number { return Math.trunc(value) >>> 0; }

function makeRenderTarget(name: string, ops: MotionBlurRendererOps): any {
  const target = new ops.RenderTarget(targetSize, targetSize, {
    depthBuffer: false, stencilBuffer: false,
    minFilter: ops.linearFilter, magFilter: ops.linearFilter,
    wrapS: ops.clampWrapping, wrapT: ops.clampWrapping,
  });
  target.texture.name = name;
  target.texture.colorSpace = ops.colorSpace;
  target.texture.generateMipmaps = false;
  return target;
}

async function loadMask(archive: MotionBlurArchive, path: string,
  ops: MotionBlurRendererOps): Promise<any> {
  const candidates = archive.exactCanonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量应为 1，实际为 ${candidates.length}。`);
  const png = await ops.decodePng(await candidates[0]!.bytes());
  if (png.width !== 128 || png.height !== 128)
    throw new Error(`${path} 应为 128x128，实际为 ${png.width}x${png.height}。`);
  const texture = new ops.DataTexture(png.pixels, png.width, png.height,
    ops.textureFormat, ops.textureType);
  texture.name = path;
  texture.colorSpace = ops.colorSpace;
  texture.flipY = false;
  texture.wrapS = texture.wrapT = ops.clampWrapping;
  texture.minFilter = texture.magFilter = ops.linearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function makeFullscreenQuad(ops: MotionBlurRendererOps): any {
  const geometry = new ops.Geometry();
  geometry.setAttribute("position", new ops.FloatAttribute(
    [-1, -1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0], 3));
  geometry.setAttribute("uv", new ops.FloatAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2));
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  return geometry;
}

const fullscreenVertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform vec2 uvOffset;
      varying vec2 vUv;
      void main() {
        vUv = uv + uvOffset;
        gl_Position = vec4(position, 1.0);
      }
    `;
const copyFragmentShader = `
    precision highp float;
    uniform sampler2D map;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(map, vUv); }
  `;
const feedbackFragmentShader = `
    precision highp float;
    uniform sampler2D map;
    uniform float opacity;
    uniform vec3 color;
    varying vec2 vUv;
    void main() {
      // 10B0A50: RGB = TEXTURE * TFACTOR; alpha selects TFACTOR directly.
      gl_FragColor = vec4(texture2D(map, vUv).rgb * color, opacity);
    }
  `;
const overlayFragmentShader = `
    precision highp float;
    uniform sampler2D history;
    uniform sampler2D mask;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(
        texture2D(history, vUv).rgb,
        texture2D(mask, vec2(vUv.x, 1.0 - vUv.y)).a * opacity
      );
    }
  `;

function makeShader(fragmentShader: string, ops: MotionBlurRendererOps): any {
  return new ops.ShaderMaterial({
    uniforms: { uvOffset: { value: new ops.Vector2() } },
    vertexShader: fullscreenVertexShader, fragmentShader,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
}
function useNativeBlend(material: any, ops: MotionBlurRendererOps): void {
  material.transparent = true;
  material.blending = ops.customBlending;
  material.blendEquation = ops.additiveEquation;
  material.blendSrc = ops.sourceAlpha;
  material.blendDst = ops.oneMinusSourceAlpha;
}
function makeCopyMaterial(ops: MotionBlurRendererOps): any {
  const material = makeShader(copyFragmentShader, ops);
  material.name = "KartRider MotionBlur capture";
  material.uniforms.map = { value: null };
  return material;
}
function makeFeedbackMaterial(ops: MotionBlurRendererOps): any {
  const material = makeShader(feedbackFragmentShader, ops);
  material.name = "KartRider MotionBlur feedback";
  material.uniforms.map = { value: null };
  material.uniforms.opacity = { value: 1 };
  material.uniforms.color = { value: new ops.Vector3(1, 1, 1) };
  material.uniforms.uvOffset.value.set(-0.5 / targetSize, 0.5 / targetSize);
  useNativeBlend(material, ops);
  return material;
}
function makeOverlayMaterial(ops: MotionBlurRendererOps): any {
  const material = makeShader(overlayFragmentShader, ops);
  material.name = "KartRider MotionBlur mask composite";
  material.uniforms.history = { value: null };
  material.uniforms.mask = { value: null };
  material.uniforms.opacity = { value: 1 };
  useNativeBlend(material, ops);
  return material;
}

interface MotionBlurLayer {
  mask: any;
  history: any;
  color: number;
  lastCaptureMs?: number;
}
export interface MotionBlurRenderer {
  setRenderTarget(target: any): void;
  copyFramebufferToTexture(texture: any): void;
  render(scene: any, camera: any): void;
  getDrawingBufferSize(out: any): void;
}

/** Inject the release's renderer classes and preserve its capture order and timestamps. */
export function createMotionBlurEffectClass(ops: MotionBlurRendererOps) {
  return class MotionBlurEffect {
    scene = new ops.Scene();
    camera = new ops.Camera();
    geometry = makeFullscreenQuad(ops);
    copyMaterial = makeCopyMaterial(ops);
    feedbackMaterial = makeFeedbackMaterial(ops);
    overlayMaterial = makeOverlayMaterial(ops);
    quad = new ops.Mesh(this.geometry, this.copyMaterial);
    capture = makeRenderTarget("boostBlur capture", ops);
    layers: MotionBlurLayer[];
    drawingBufferSize = new ops.Vector2();
    screenTexture: any;
    screenWidth = 0;
    screenHeight = 0;
    enabled = false;
    drawable = false;
    transitionStartMs = 0;
    previousPhysicsState = 0;

    constructor(public feedbackDurationMs: number, masks: any[], alternateColor: number) {
      this.quad.frustumCulled = false;
      this.scene.add(this.quad);
      this.layers = masks.map((mask, index) => ({
        mask, history: makeRenderTarget(`boostBlur${index + 1} history`, ops),
        color: index === 0 ? defaultArgb : alternateColor,
      }));
    }

    static async load(archive: MotionBlurArchive, definition: MotionBlurDefinition,
      durationMs: number): Promise<MotionBlurEffect | undefined> {
      if (!definition.boosterBlur) return undefined;
      const duration = Math.max(0, Math.trunc(durationMs));
      if (duration > 0 && duration < 100)
        throw new Error(`MotionBlur duration ${duration}ms 会进入 P3528 的零 capture interval。`);
      const masks: any[] = [];
      const alternateColor = parseMotionBlurColor(definition.boostBlurColorSource);
      try {
        masks.push(await loadMask(archive, primaryMaskPath, ops));
        if (alternateColor !== defaultArgb)
          masks.push(await loadMask(archive, secondaryMaskPath, ops));
        return new MotionBlurEffect(duration, masks, alternateColor);
      } catch (error) {
        masks.forEach(mask => mask.dispose());
        throw error;
      }
    }

    setState(physicsState: number, elapsedMs: number, nowMs: number, eligible: boolean): void {
      const next = motionBlurEnabled(this.enabled, physicsState,
        this.previousPhysicsState, elapsedMs, eligible);
      this.previousPhysicsState = physicsState;
      if (next !== this.enabled) {
        this.enabled = next;
        this.drawable = true;
        this.transitionStartMs = motionBlurTransitionStart(this.transitionStartMs, tick(nowMs));
      }
    }

    render(renderer: MotionBlurRenderer, nowMs: number): void {
      if (!this.drawable) return;
      const now = tick(nowMs);
      const opacity = motionBlurOpacity(this.enabled, this.transitionStartMs, now);
      if (!this.enabled && opacity === 0) {
        this.drawable = false;
        return;
      }
      this.layers.forEach(layer => this.renderLayer(renderer, layer, opacity, now));
    }
    reset(): void {
      this.enabled = false;
      this.drawable = false;
      this.transitionStartMs = 0;
      this.previousPhysicsState = 0;
      this.layers.forEach(layer => { layer.lastCaptureMs = undefined; });
    }
    dispose(): void {
      this.screenTexture?.dispose();
      this.capture.dispose();
      this.layers.forEach(layer => { layer.mask.dispose(); layer.history.dispose(); });
      this.geometry.dispose();
      this.copyMaterial.dispose();
      this.feedbackMaterial.dispose();
      this.overlayMaterial.dispose();
    }

    renderLayer(renderer: MotionBlurRenderer, layer: MotionBlurLayer,
      opacity: number, nowMs: number): void {
      const captureOpacity = motionBlurCaptureOpacity(layer.lastCaptureMs, nowMs,
        this.feedbackDurationMs);
      if (captureOpacity !== undefined) {
        this.captureFrame(renderer, layer, captureOpacity);
        layer.lastCaptureMs = nowMs;
      }
      this.overlayFrame(renderer, layer, opacity);
    }
    captureFrame(renderer: MotionBlurRenderer, layer: MotionBlurLayer, opacity: number): void {
      const screen = this.currentScreenTexture(renderer);
      renderer.setRenderTarget(null);
      renderer.copyFramebufferToTexture(screen);
      this.copyMaterial.uniforms.map.value = screen;
      this.quad.material = this.copyMaterial;
      renderer.setRenderTarget(this.capture);
      renderer.render(this.scene, this.camera);
      this.feedbackMaterial.uniforms.map.value = this.capture.texture;
      this.feedbackMaterial.uniforms.opacity.value = opacity;
      this.feedbackMaterial.uniforms.color.value.set(
        ((layer.color >>> 16) & 255) / 255,
        ((layer.color >>> 8) & 255) / 255,
        (layer.color & 255) / 255,
      );
      this.quad.material = this.feedbackMaterial;
      renderer.setRenderTarget(layer.history);
      renderer.render(this.scene, this.camera);
    }
    overlayFrame(renderer: MotionBlurRenderer, layer: MotionBlurLayer, opacity: number): void {
      renderer.getDrawingBufferSize(this.drawingBufferSize);
      this.overlayMaterial.uniforms.history.value = layer.history.texture;
      this.overlayMaterial.uniforms.mask.value = layer.mask;
      this.overlayMaterial.uniforms.opacity.value = motionBlurMaskOpacity(layer.color, opacity);
      this.overlayMaterial.uniforms.uvOffset.value.set(
        -0.5 / this.drawingBufferSize.x,
        0.5 / this.drawingBufferSize.y,
      );
      this.quad.material = this.overlayMaterial;
      renderer.setRenderTarget(null);
      renderer.render(this.scene, this.camera);
    }
    currentScreenTexture(renderer: MotionBlurRenderer): any {
      renderer.getDrawingBufferSize(this.drawingBufferSize);
      const width = this.drawingBufferSize.x;
      const height = this.drawingBufferSize.y;
      if (this.screenTexture && width === this.screenWidth && height === this.screenHeight)
        return this.screenTexture;
      this.screenTexture?.dispose();
      const texture = new ops.FramebufferTexture(width, height);
      texture.name = "boostBlur framebuffer";
      texture.colorSpace = ops.colorSpace;
      texture.wrapS = texture.wrapT = ops.clampWrapping;
      texture.minFilter = texture.magFilter = ops.linearFilter;
      this.screenTexture = texture;
      this.screenWidth = width;
      this.screenHeight = height;
      return texture;
    }
  };
}
