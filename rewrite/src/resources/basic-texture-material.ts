import {
  AddEquation, AlwaysDepth, BackSide, Color, CustomBlending,
  DoubleSide, DstAlphaFactor, DstColorFactor, EqualDepth, FrontSide,
  GreaterDepth, GreaterEqualDepth, LessDepth, LessEqualDepth,
  NeverDepth, NoBlending, NotEqualDepth, OneFactor,
  OneMinusDstAlphaFactor, OneMinusDstColorFactor,
  OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, ShaderMaterial,
  SrcAlphaFactor, SrcAlphaSaturateFactor, SrcColorFactor, Vector2, Vector4,
  ZeroFactor, type Texture,
} from "three";

export interface BasicTextureProperties {
  texture: { value: { textureOp: number } };
  fog: { value: { selector: number } };
  material: { value: { mode: number; diffuse: number; emissive: number } };
  alpha: { value: { alphaTestEnable: number; compare: number; alphaRef: number;
    blendEnable: number; srcBlend: number; dstBlend: number } };
  zbuffer: { value: { zWrite: number; zFunc: number } };
  backface: { value: { cull: number } };
}

export function d3dDepthFunction(value: number): ShaderMaterial["depthFunc"] {
  const mapped: Record<number, ShaderMaterial["depthFunc"]> = { 1: NeverDepth, 2: LessDepth,
    3: EqualDepth, 4: LessEqualDepth, 5: GreaterDepth,
    6: NotEqualDepth, 7: GreaterEqualDepth, 8: AlwaysDepth };
  const result = mapped[value];
  if (result === undefined) throw new Error(`D3DCMPFUNC ${value} 尚未映射。`);
  return result;
}

export function d3dBlendFactor(value: number): number {
  const mapped: Record<number, number> = {
    1: ZeroFactor, 2: OneFactor, 3: SrcColorFactor,
    4: OneMinusSrcColorFactor, 5: SrcAlphaFactor,
    6: OneMinusSrcAlphaFactor, 7: DstColorFactor,
    8: DstAlphaFactor, 9: OneMinusDstAlphaFactor,
    10: OneMinusDstColorFactor, 11: SrcAlphaSaturateFactor,
  };
  const result = mapped[value];
  if (result === undefined) throw new Error(`D3DBLEND ${value} 尚未映射。`);
  return result;
}

export function d3dCullSide(cull: number, flipWinding: boolean): ShaderMaterial["side"] {
  if (cull === 1) return DoubleSide;
  if (cull !== 2 && cull !== 3) throw new Error(`D3DCULL ${cull} 尚未映射。`);
  return (cull === 3) !== flipWinding ? BackSide : FrontSide;
}

/** Alpha comes from diffuse, while RGB comes from emissive in this client. */
export function basicMaterialColor(diffuse: number, emissive: number): Vector4 {
  return new Vector4(
    ((emissive >>> 16) & 255) / 255,
    ((emissive >>> 8) & 255) / 255,
    (emissive & 255) / 255,
    ((diffuse >>> 24) & 255) / 255,
  );
}

/** The released basic texture stage, including baked-node and alpha modes. */
export function createBasicTextureMaterial(baseMap: Texture | null,
  properties: BasicTextureProperties, flipWinding = false,
  bakedNodes = false): ShaderMaterial {
  const textureOperation = properties.texture.value.textureOp;
  if (textureOperation !== 1 && textureOperation !== 4)
    throw new Error(`Basic TexProperty operation ${textureOperation} 尚未映射。`);
  if (properties.fog.value.selector !== 0)
    throw new Error(`Basic Fog selector ${properties.fog.value.selector} 尚未映射。`);
  const mode = properties.material.value.mode;
  if (mode !== 0 && mode !== 1 && mode !== 2)
    throw new Error(`Basic Mtl mode ${mode} 尚未映射。`);
  const alpha = properties.alpha.value;
  const material = new ShaderMaterial({
    name: "KartRider basic texture stage",
    defines: bakedNodes ? { BAKED_NODES: "" } : {},
    uniforms: {
      baseMap: { value: baseMap },
      textureEnabled: { value: baseMap ? 1 : 0 },
      lightingEnabled: { value: mode === 2 ? 1 : 0 },
      textureAlpha: { value: 1 },
      currentAlpha: { value: 1 },
      textureOperation: { value: textureOperation },
      alphaTestEnabled: { value: alpha.alphaTestEnable ? 1 : 0 },
      alphaFunction: { value: alpha.compare },
      alphaReference: { value: alpha.alphaRef / 255 },
      uvControllerEnabled: { value: 0 },
      uvOffsetScale: { value: new Vector4(0, 0, 1, 1) },
      uvRotation: { value: 0 },
      lightFactor: { value: 1 },
      materialColor: { value: mode === 2
        ? basicMaterialColor(properties.material.value.diffuse,
          properties.material.value.emissive)
        : new Vector4(1, 1, 1, 1) },
      nodeMatrices: { value: null },
      nodeMatrixSize: { value: new Vector2(1, 1) },
      fogColor: { value: new Color() },
      fogNear: { value: 1 },
      fogFar: { value: 1 },
      fogDensity: { value: 0.00025 },
    },
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv0;
      varying vec4 vPrimary;
      attribute vec4 primaryColor;
      uniform int uvControllerEnabled;
      uniform vec4 uvOffsetScale;
      uniform float uvRotation;
      #ifdef BAKED_NODES
      attribute float aNode;
      uniform sampler2D nodeMatrices;
      uniform vec2 nodeMatrixSize;
      vec4 nodeMatrixTexel(float texel) {
        float x = mod(texel, nodeMatrixSize.x);
        float y = floor(texel / nodeMatrixSize.x);
        return texture2D(nodeMatrices, (vec2(x, y) + 0.5) / nodeMatrixSize);
      }
      #endif
      void main() {
        if (uvControllerEnabled != 0) {
          float cosine = cos(uvRotation);
          float sine = sin(uvRotation);
          float x = uv.x - 0.5 - uvOffsetScale.x;
          float y = uv.y - 0.5 - uvOffsetScale.y;
          vUv0 = vec2(
            0.5 + cosine * uvOffsetScale.z * x - sine * uvOffsetScale.w * y,
            0.5 - sine * uvOffsetScale.z * x - cosine * uvOffsetScale.w * y
          );
        } else vUv0 = uv;
        vPrimary = primaryColor;
        #ifdef BAKED_NODES
        // aNode rows: [m11,m12,m13,m14], [m21,m22,m23,m24], [m31,m32,m33,m34]
        // of the node's root-local matrix, so position stays node-local.
        float nodeRow = aNode * 3.0;
        vec4 local = vec4(position, 1.0);
        vec3 clientPosition = vec3(
          dot(nodeMatrixTexel(nodeRow), local),
          dot(nodeMatrixTexel(nodeRow + 1.0), local),
          dot(nodeMatrixTexel(nodeRow + 2.0), local)
        );
        vec4 mvPosition = modelViewMatrix * vec4(clientPosition, 1.0);
        #else
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        #endif
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec2 vUv0;
      varying vec4 vPrimary;
      uniform sampler2D baseMap;
      uniform int textureEnabled;
      uniform int lightingEnabled;
      uniform float textureAlpha;
      uniform float currentAlpha;
      uniform int textureOperation;
      uniform int alphaTestEnabled;
      uniform int alphaFunction;
      uniform float alphaReference;
      uniform float lightFactor;
      uniform vec4 materialColor;
      bool alphaPass(float value) {
        if (alphaFunction == 1) return false;
        if (alphaFunction == 2) return value < alphaReference;
        if (alphaFunction == 3) return value == alphaReference;
        if (alphaFunction == 4) return value <= alphaReference;
        if (alphaFunction == 5) return value > alphaReference;
        if (alphaFunction == 6) return value != alphaReference;
        if (alphaFunction == 7) return value >= alphaReference;
        return true;
      }
      void main() {
        vec4 source;
        if (textureEnabled == 0) source = lightingEnabled != 0 ? vec4(1.0) : vPrimary;
        else {
          vec4 texel = texture2D(baseMap, vUv0);
          if (textureOperation == 4) source = currentAlpha == 1.0 ? texel * vPrimary : vPrimary;
          else {
            source = texel;
            source.a *= textureAlpha;
          }
        }
        source *= materialColor;
        if (alphaTestEnabled != 0 && !alphaPass(source.a)) discard;
        gl_FragColor = vec4(clamp(source.rgb * lightFactor, 0.0, 1.0), source.a);
        #include <fog_fragment>
      }
    `,
  });
  material.toneMapped = false;
  material.fog = true;
  material.depthWrite = properties.zbuffer.value.zWrite !== 0;
  material.depthFunc = d3dDepthFunction(properties.zbuffer.value.zFunc);
  material.side = d3dCullSide(properties.backface.value.cull, flipWinding);
  if (alpha.blendEnable) {
    material.transparent = true;
    material.blending = CustomBlending;
    material.blendSrc = d3dBlendFactor(alpha.srcBlend) as ShaderMaterial["blendSrc"];
    material.blendDst = d3dBlendFactor(alpha.dstBlend) as ShaderMaterial["blendDst"];
    material.blendEquation = AddEquation;
  } else material.blending = NoBlending;
  material.forceSinglePass = true;
  return material;
}
