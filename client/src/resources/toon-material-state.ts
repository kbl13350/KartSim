import {
  AddEquation, AlwaysDepth, CustomBlending, DoubleSide, DstAlphaFactor,
  DstColorFactor, EqualDepth, GreaterDepth, GreaterEqualDepth, LessDepth,
  LessEqualDepth, NeverDepth, NoBlending, NotEqualDepth, OneFactor,
  OneMinusDstAlphaFactor, OneMinusDstColorFactor, OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor, ShaderMaterial, SrcAlphaFactor,
  SrcAlphaSaturateFactor, SrcColorFactor, ZeroFactor,
  type BlendingDstFactor, type BlendingSrcFactor, type DepthModes,
  type Matrix4, type Texture, type Vector3,
} from "three";

export interface AlphaProperty {
  className?: string;
  blendEnable: number;
  srcBlend: number;
  dstBlend: number;
  alphaTestEnable: number;
  alphaFunc?: number;
  compare?: number;
  alphaRef: number;
}

export interface ZBufferProperty {
  className?: string;
  mode?: number;
  enabled?: number;
  zFunc?: number;
  zWrite?: number;
}

export interface PropertyOccurrence<T> {
  source: "property-bank";
  value: T;
  bankIndex: number;
}

export interface ToonMaterialProperties {
  toon: { value: { words: number[] } };
  wire: { value: { enabled: number } };
  material: { value: { mode: number } };
  alpha: { value: AlphaProperty & { compare: number } };
  zbuffer: { value: ZBufferProperty & { zFunc: number; zWrite: number } };
}

/** Finds a character's alpha/depth properties, with the release defaults. */
export function characterMaterialDefaults(root: {
  slots?: Array<{ value?: AlphaProperty | ZBufferProperty } | undefined>;
} | undefined, fallback?: { alpha?: AlphaProperty; zbuf?: ZBufferProperty }):
  { alpha: AlphaProperty; zbuf: ZBufferProperty } {
  const alpha: AlphaProperty = { className: "AlphaProperty", blendEnable: 0,
    srcBlend: 2, dstBlend: 1, alphaTestEnable: 0, alphaFunc: 8,
    alphaRef: 0 };
  const zbuf: ZBufferProperty = { className: "ZBufProperty", mode: 4,
    enabled: 1 };
  const selectedAlpha = root?.slots?.[3]?.value;
  const selectedZbuf = root?.slots?.[10]?.value;
  return {
    alpha: selectedAlpha?.className === "AlphaProperty"
      ? selectedAlpha as AlphaProperty : fallback?.alpha ?? alpha,
    zbuf: selectedZbuf?.className === "ZBufProperty"
      ? selectedZbuf as ZBufferProperty : fallback?.zbuf ?? zbuf,
  };
}

/** Expands the compact character property bank used by Toon materials. */
export function toonPropertyBank(alpha: AlphaProperty,
  zbuffer: ZBufferProperty) {
  const occurrence = <T>(value: T, bankIndex: number): PropertyOccurrence<T> =>
    ({ source: "property-bank", value, bankIndex });
  return {
    alpha: occurrence({ kind: "alpha", blendEnable: alpha.blendEnable,
      srcBlend: alpha.srcBlend, dstBlend: alpha.dstBlend,
      alphaTestEnable: alpha.alphaTestEnable,
      compare: alpha.alphaFunc, alphaRef: alpha.alphaRef }, 0),
    backface: occurrence({ kind: "backface", cull: 2 }, 7),
    fog: occurrence({ kind: "fog-property", selector: 0, mode: 1,
      color: 0, start: 0, end: 1, density: 1 }, 11),
    material: occurrence({ kind: "material", mode: 0,
      ambient: 0xffffffff, diffuse: 0xffffffff, specular: 0xffffffff,
      power: 1, reserved: 0, emissive: 0xffffffff,
      controllers: [], controllerOccurrences: [] }, 12),
    texture: occurrence({ kind: "texture", textureOp: 1,
      addressU: 1, addressV: 1, minFilter: 1, magFilter: 1, mipFilter: 0,
      maxAnisotropy: 1, uvControllers: [], uvControllerOccurrences: [],
      scalar: 1 }, 13),
    toon: occurrence({ kind: "toon", flags: [1, 1],
      words: [1, 4, 0xffffffff, 1065353216, 0, 2, 0, 4278190080, 2130706432] }, 15),
    wire: occurrence({ kind: "wire", enabled: 0 }, 16),
    zbuffer: occurrence({ kind: "zbuffer", zFunc: zbuffer.mode,
      zWrite: zbuffer.enabled }, 19),
  };
}

export interface UvControllerState {
  offsetU: number; offsetV: number; scaleU: number; scaleV: number;
  rotation: number;
}

export function setToonUvController(material: ShaderMaterial,
  state: UvControllerState, enabled: boolean): void {
  material.uniforms.uvControllerEnabled!.value = enabled ? 1 : 0;
  material.uniforms.uvOffsetScale!.value.set(state.offsetU, state.offsetV,
    state.scaleU, state.scaleV);
  material.uniforms.uvRotation!.value = state.rotation;
}

function floatFromWord(word: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, word, true);
  return view.getFloat32(0, true);
}

function depthFunction(value: number): DepthModes {
  const mapped: Record<number, number> = {
    1: NeverDepth, 2: LessDepth, 3: EqualDepth, 4: LessEqualDepth,
    5: GreaterDepth, 6: NotEqualDepth, 7: GreaterEqualDepth, 8: AlwaysDepth,
  };
  const result = mapped[value];
  if (result === undefined) throw new Error(`D3DCMPFUNC ${value} 尚未映射。`);
  return result as DepthModes;
}

function blendFactor(value: number): number {
  const mapped: Record<number, number> = {
    1: ZeroFactor, 2: OneFactor, 3: SrcColorFactor,
    4: OneMinusSrcColorFactor, 5: SrcAlphaFactor,
    6: OneMinusSrcAlphaFactor, 7: DstColorFactor, 8: DstAlphaFactor,
    9: OneMinusDstAlphaFactor, 10: OneMinusDstColorFactor,
    11: SrcAlphaSaturateFactor,
  };
  const result = mapped[value];
  if (result === undefined) throw new Error(`D3DBLEND ${value} 尚未映射。`);
  return result;
}

/** Applies D3D9 Toon material/depth/blend state to a Three.js material. */
export function applyToonMaterialProperties(material: ShaderMaterial,
  properties: ToonMaterialProperties): void {
  const words = properties.toon.value.words;
  if (words[0] !== 1 || words[5] !== 2)
    throw new Error(`Toon mode/key ${words[0]}/${words[5]} 尚未映射。`);
  if (properties.wire.value.enabled !== 0)
    throw new Error("WireProperty enabled 尚未映射。 ");
  if (properties.material.value.mode !== 0)
    throw new Error(`MtlProperty mode ${properties.material.value.mode} 尚未映射。`);
  material.uniforms.normalUvOffset!.value.set(
    floatFromWord(words[3]!), floatFromWord(words[4]!));
  const alpha = properties.alpha.value;
  material.uniforms.alphaTestEnabled!.value = alpha.alphaTestEnable !== 0 ? 1 : 0;
  material.uniforms.alphaFunction!.value = alpha.compare;
  material.uniforms.alphaReference!.value = alpha.alphaRef / 255;
  material.depthWrite = properties.zbuffer.value.zWrite !== 0;
  material.depthFunc = depthFunction(properties.zbuffer.value.zFunc);
  material.side = DoubleSide;
  if (alpha.blendEnable !== 0) {
    material.transparent = true;
    material.blending = CustomBlending;
    material.blendSrc = blendFactor(alpha.srcBlend) as BlendingSrcFactor;
    material.blendDst = blendFactor(alpha.dstBlend) as BlendingDstFactor;
    material.blendEquation = AddEquation;
  } else {
    material.transparent = false;
    material.blending = NoBlending;
  }
}

export function setToonEnvironmentUniforms(material: ShaderMaterial,
  texture: Texture, environment: { request(texture: Texture): Texture | null },
  clientWorld: Matrix4, clientWorldInverse: Matrix4,
  viewOriginClient: Vector3): void {
  material.uniforms.toonEnv!.value = environment.request(texture);
  material.uniforms.clientWorld!.value.copy(clientWorld);
  material.uniforms.clientWorldInverse!.value.copy(clientWorldInverse);
  material.uniforms.viewOriginClient!.value.copy(viewOriginClient);
}
