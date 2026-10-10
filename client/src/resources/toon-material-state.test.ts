import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AddEquation, AlwaysDepth, CustomBlending, DoubleSide, DstAlphaFactor,
  DstColorFactor, EqualDepth, GreaterDepth, GreaterEqualDepth, LessDepth,
  LessEqualDepth, Matrix4, NeverDepth, NoBlending, NotEqualDepth, OneFactor,
  OneMinusDstAlphaFactor, OneMinusDstColorFactor, OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor, ShaderMaterial, SrcAlphaFactor,
  SrcAlphaSaturateFactor, SrcColorFactor, Texture, Vector2, Vector3, Vector4,
  ZeroFactor,
} from "three";

import { applyToonMaterialProperties, characterMaterialDefaults,
  setToonEnvironmentUniforms, setToonUvController, toonPropertyBank,
  type AlphaProperty, type ToonMaterialProperties,
  type ZBufferProperty } from "./toon-material-state";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseFunctions() {
  const source = await readFile(releaseFile, "utf8");
  const stateStart = source.indexOf("function Zq(");
  const stateEnd = source.indexOf("\nclass Jq", stateStart);
  const defaultsStart = source.indexOf("function ju(");
  const defaultsEnd = source.indexOf("\nfunction nZ(", defaultsStart);
  assert.ok(stateStart >= 0 && stateEnd > stateStart &&
    defaultsStart >= 0 && defaultsEnd > defaultsStart);
  const bindings = {
    ro: NeverDepth, so: LessDepth, oo: EqualDepth, y1: LessEqualDepth,
    ao: GreaterDepth, co: NotEqualDepth, rr: GreaterEqualDepth,
    ir: AlwaysDepth, s1: DoubleSide, u1: CustomBlending,
    n5: NoBlending, R9: AddEquation,
    ym: ZeroFactor, h3: OneFactor, ra: SrcColorFactor,
    Am: OneMinusSrcColorFactor, l1: SrcAlphaFactor,
    v1: OneMinusSrcAlphaFactor, bm: DstColorFactor,
    Mm: DstAlphaFactor, xm: OneMinusDstAlphaFactor,
    Sm: OneMinusDstColorFactor, Cm: SrcAlphaSaturateFactor,
  };
  return new Function(...Object.keys(bindings), `${source.slice(stateStart, stateEnd)}
    ${source.slice(defaultsStart, defaultsEnd)}
    return {Zq,Mo,xo,ju,tZ};`)(...Object.values(bindings)) as {
      Zq: typeof setToonUvController;
      Mo: typeof applyToonMaterialProperties;
      xo: typeof setToonEnvironmentUniforms;
      ju: typeof characterMaterialDefaults;
      tZ: typeof toonPropertyBank;
    };
}

function material(): ShaderMaterial {
  return new ShaderMaterial({ uniforms: {
    uvControllerEnabled: { value: 0 }, uvOffsetScale: { value: new Vector4() },
    uvRotation: { value: 0 }, normalUvOffset: { value: new Vector2() },
    alphaTestEnabled: { value: 0 }, alphaFunction: { value: 0 },
    alphaReference: { value: 0 }, toonEnv: { value: undefined },
    clientWorld: { value: new Matrix4() },
    clientWorldInverse: { value: new Matrix4() },
    viewOriginClient: { value: new Vector3() },
  } });
}

function snapshot(shader: ShaderMaterial) {
  return { uvEnabled: shader.uniforms.uvControllerEnabled!.value,
    uv: shader.uniforms.uvOffsetScale!.value.toArray(),
    rotation: shader.uniforms.uvRotation!.value,
    normalUv: shader.uniforms.normalUvOffset!.value.toArray(),
    alphaEnabled: shader.uniforms.alphaTestEnabled!.value,
    alphaFunc: shader.uniforms.alphaFunction!.value,
    alphaRef: shader.uniforms.alphaReference!.value,
    depthWrite: shader.depthWrite, depthFunc: shader.depthFunc,
    side: shader.side, transparent: shader.transparent,
    blending: shader.blending, blendSrc: shader.blendSrc,
    blendDst: shader.blendDst, blendEquation: shader.blendEquation,
    toonEnv: shader.uniforms.toonEnv!.value?.name,
    clientWorld: shader.uniforms.clientWorld!.value.toArray(),
    clientWorldInverse: shader.uniforms.clientWorldInverse!.value.toArray(),
    viewOriginClient: shader.uniforms.viewOriginClient!.value.toArray() };
}

const alpha: AlphaProperty = { blendEnable: 1, srcBlend: 5,
  dstBlend: 6, alphaTestEnable: 1, alphaFunc: 4, alphaRef: 128 };
const zbuffer: ZBufferProperty = { mode: 4, enabled: 1 };

test("角色默认属性和 Toon property bank 与发行版一致", async () => {
  const original = await releaseFunctions();
  for (const root of [undefined, { slots: [] },
    { slots: Array.from({ length: 11 }, (_, index) => ({ value: index === 3
      ? { ...alpha, className: "AlphaProperty" }
      : index === 10 ? { ...zbuffer, className: "ZBufProperty" }
      : undefined })) }]) {
    assert.deepEqual(characterMaterialDefaults(root), original.ju(root));
  }
  assert.deepEqual(toonPropertyBank(alpha, zbuffer), original.tZ(alpha, zbuffer));
});

test("Toon UV、D3D 深度混合、环境矩阵应用与发行版一致", async () => {
  const original = await releaseFunctions();
  for (const blendEnable of [0, 1]) {
    const properties = toonPropertyBank({ ...alpha, blendEnable },
      zbuffer) as unknown as ToonMaterialProperties;
    const old = material(), current = material();
    const uv = { offsetU: 0.2, offsetV: -0.3, scaleU: 1.5,
      scaleV: 0.75, rotation: 0.6 };
    original.Zq(old, uv, true);
    setToonUvController(current, uv, true);
    original.Mo(old, properties);
    applyToonMaterialProperties(current, properties);
    const texture = new Texture();
    texture.name = "toon";
    const environment = { request: () => texture };
    const world = new Matrix4().makeTranslation(1, 2, 3);
    const inverse = world.clone().invert();
    const origin = new Vector3(4, 5, 6);
    original.xo(old, texture, environment, world, inverse, origin);
    setToonEnvironmentUniforms(current, texture, environment, world,
      inverse, origin);
    assert.deepEqual(snapshot(current), snapshot(old));
  }
});

test("未映射的 Toon、D3D 深度和混合状态错误与发行版一致", async () => {
  const original = await releaseFunctions();
  const base = toonPropertyBank(alpha, zbuffer) as unknown as ToonMaterialProperties;
  const cases = [
    { ...base, toon: { value: { words: [9, 0, 0, 0, 0, 2] } } },
    { ...base, wire: { value: { enabled: 1 } } },
    { ...base, material: { value: { mode: 3 } } },
    { ...base, zbuffer: { value: { zFunc: 99, zWrite: 1 } } },
    { ...base, alpha: { value: { ...base.alpha.value, srcBlend: 99 } } },
  ];
  const capture = (run: () => unknown) => {
    try { run(); return "success"; }
    catch (error) { return String(error); }
  };
  for (const properties of cases)
    assert.equal(capture(() => applyToonMaterialProperties(material(),
      properties)), capture(() => original.Mo(material(), properties)));
});
