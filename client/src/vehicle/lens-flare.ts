import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending, DataTexture,
  DoubleSide, DynamicDrawUsage, LessEqualDepth, LinearFilter, Matrix4, Mesh,
  NoColorSpace, OneFactor, PerspectiveCamera, RepeatWrapping,
  RGBAFormat, ShaderMaterial, SrcColorFactor, UnsignedByteType, Vector3, Vector4,
} from "three";

const texturePath = "etc_/lensFlare.png";
const flareCount = 10;
const cornersPerFlare = 4;
const float32 = Math.fround;
const appearance = [
  1, 1.5, 0, 0, 0, 0.5, 0.5, 0.8, 0.125, 0, 0.5, 0.25, 0.75, 0.5,
  0.7, 0.2, 0, 0.5, 0.25, 0.75, 0.5, 0.5, 0.3, 0, 0.5, 0, 0.75,
  0.25, 0.333, 0.25, 0, 0, 0.5, 0.5, 1, 0.125, 0.125, 0, 0.5, 0,
  0.75, 0.25, -0.181, 0.25, 0, 0.75, 0, 1, 0.25, -0.25, 0.4, 0,
  0.5, 0.25, 0.75, 0.5, -0.4, 0.5, 0, 0, 0.5, 0.5, 1, -0.8, 1,
  0, 0, 0.5, 0.5, 1,
].map(Math.fround);
const offsetScale = [0, 0, 0, 0, 0, 0, 0, 0.1, 0.125, 0.25].map(Math.fround);

export interface LensFlareSource {
  sourceKind: string;
  sourceName: string;
  containerId: string;
  bytes(): Promise<Uint8Array>;
}
export interface LensFlareLibrary {
  exactCanonicalCandidates(path: string): LensFlareSource[];
}
export interface LensFlareImage { pixels: Uint8Array; width: number; height: number }
export interface LensFlareTrack {
  root: {
    kind: string;
    trackObjects: {
      kind: string;
      name: string;
      transform: { position: number[] };
    }[];
  };
}

/** Reads the one lens flare anchor placed in a track's dummy nodes. */
export function lensFlareAnchor(track: LensFlareTrack): number[] | undefined {
  if (track.root.kind !== "track") return;
  const markers = track.root.trackObjects.filter(object =>
    object.kind === "ToDummy" && object.name === "lensflare");
  if (markers.length > 1)
    throw new Error(`lensflare exact ToDummy owner 数量应不大于 1，实际为 ${markers.length}。`);
  const position = markers[0]?.transform.position;
  return position ? [position[0]!, position[1]!, position[2]!] : undefined;
}

/** Loads the P3528 DataPack1 lens flare texture and projects its track anchor. */
export async function loadLensFlareEffect<T extends LensFlareEffect>(
  library: LensFlareLibrary,
  sourcePosition: number[],
  decodeImage: (bytes: Uint8Array) => Promise<LensFlareImage>,
  makeEffect: (position: Vector3, texture: DataTexture) => T,
): Promise<T> {
  const candidates = library.exactCanonicalCandidates(texturePath);
  if (candidates.length !== 1)
    throw new Error(`${texturePath} exact source 数量应为 1，实际为 ${candidates.length}。`);
  const source = candidates[0]!;
  if (source.sourceKind !== "rho5" || source.sourceName !== "DataPack1_00001.rho5" ||
      source.containerId !== "rho5:datapack1")
    throw new Error(`${texturePath} 不来自当前 P3528 DataPack1 exact owner。`);
  const image = await decodeImage(await source.bytes());
  if (image.width !== 256 || image.height !== 256)
    throw new Error(`${texturePath} 应为 256x256，实际为 ${image.width}x${image.height}。`);
  const texture = new DataTexture(image.pixels, image.width, image.height, RGBAFormat, UnsignedByteType);
  texture.name = texturePath;
  texture.colorSpace = NoColorSpace;
  texture.flipY = false;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const position = new Vector3(float32(sourcePosition[0]!), float32(sourcePosition[2]!),
    float32(-sourcePosition[1]!));
  return makeEffect(position, texture);
}

function createFlareGeometry(positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  const uv = new Float32Array(flareCount * cornersPerFlare * 2);
  const indices = new Uint16Array(flareCount * 6);
  for (let flare = 0; flare < flareCount; flare += 1) {
    const index = flare * 7;
    const vertex = flare * cornersPerFlare;
    const uvOffset = vertex * 2;
    const left = appearance[index + 3]!, top = appearance[index + 4]!;
    const right = appearance[index + 5]!, bottom = appearance[index + 6]!;
    uv.set([left, top, right, top, left, bottom, right, bottom], uvOffset);
    indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], flare * 6);
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  return geometry;
}

function createFlareMaterial(texture: DataTexture): ShaderMaterial {
  const material = new ShaderMaterial({
    name: "KartRider ReLensFlare",
    uniforms: { map: { value: texture } },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    depthFunc: LessEqualDepth,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: SrcColorFactor,
    blendDst: OneFactor,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() { gl_FragColor = texture2D(map, vUv); }
    `,
  });
  material.toneMapped = false;
  material.forceSinglePass = true;
  return material;
}

/** Ten screen quads that follow a track marker after camera projection. */
export class LensFlareEffect {
  worldPoint: Vector3;
  texture: DataTexture;
  object: Mesh<BufferGeometry, ShaderMaterial>;
  positions = new Float32Array(flareCount * cornersPerFlare * 3);
  clip = new Vector4();
  viewProjection = new Matrix4();
  enabled = false;

  constructor(worldPoint: Vector3, texture: DataTexture,
    setRenderKey: (object: Mesh, key: number) => void) {
    this.worldPoint = worldPoint;
    this.texture = texture;
    this.object = new Mesh(createFlareGeometry(this.positions), createFlareMaterial(texture));
    this.object.name = "__lensFlare__";
    this.object.frustumCulled = false;
    setRenderKey(this.object, -1000);
    this.reset();
  }

  reset(): void {
    this.enabled = false;
    this.object.visible = false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.object.visible = false;
  }

  update(camera: PerspectiveCamera, width: number, height: number): void {
    if (!this.enabled) return;
    camera.updateMatrixWorld(true);
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.clip.set(this.worldPoint.x, this.worldPoint.y, this.worldPoint.z, 1)
      .applyMatrix4(this.viewProjection);
    const x = float32(this.clip.x), y = float32(this.clip.y);
    const z = float32(this.clip.z), w = float32(this.clip.w);
    const normalizedX = float32(x / w), normalizedY = float32(y / w);
    if (!(w > float32(1e-5)) || normalizedX < -1 || normalizedX > 1 ||
        normalizedY < -1 || normalizedY > 1 || z < -w) {
      this.object.visible = false;
      return;
    }
    this.writeQuads(normalizedX, normalizedY, width, height);
    this.object.geometry.getAttribute("position").needsUpdate = true;
    this.object.visible = true;
  }

  writeQuads(x: number, y: number, width: number, height: number): void {
    const aspect = float32(float32(width) / float32(height));
    for (let flare = 0; flare < flareCount; flare += 1) {
      const index = flare * 7;
      const horizontal = float32(x * appearance[index]!);
      const vertical = float32(y * appearance[index]!);
      const halfWidth = float32(appearance[index + 1]! * float32(0.4));
      const halfHeight = float32(halfWidth * aspect);
      const offset = float32(x * offsetScale[flare]!);
      const left = float32(horizontal - halfWidth), right = float32(horizontal + halfWidth);
      const top = float32(vertical + halfHeight), bottom = float32(vertical - halfHeight);
      const vertex = flare * cornersPerFlare * 3;
      this.positions.set([
        float32(left + offset), top, -1,
        float32(right + offset), top, -1,
        left, bottom, -1,
        right, bottom, -1,
      ], vertex);
    }
  }

  dispose(): void {
    this.object.removeFromParent();
    this.object.geometry.dispose();
    this.object.material.dispose();
    this.texture.dispose();
  }
}
