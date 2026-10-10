import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as Three from "three";

import { createBasicTextureMaterial, type BasicTextureProperties } from
  "./basic-texture-material";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseMaterial() {
  const source = await readFile(releaseFile, "utf8");
  const begin = source.indexOf("function CB(");
  const end = source.indexOf("\nfunction EB(", begin);
  const helpersBegin = source.indexOf("function DK(", end);
  const helpersEnd = source.indexOf("\nclass Zm {", helpersBegin);
  assert.ok(begin >= 0 && end > begin && helpersBegin > end && helpersEnd > helpersBegin);
  const aliases = {
    $1: Three.ShaderMaterial, Y2: Three.Vector4,
    B2: Three.Vector2, r9: Three.Color,
    u1: Three.CustomBlending, R9: Three.AddEquation,
    n5: Three.NoBlending, s1: Three.DoubleSide,
    me: Three.BackSide, tn: Three.FrontSide,
    ro: Three.NeverDepth, so: Three.LessDepth,
    oo: Three.EqualDepth, y1: Three.LessEqualDepth,
    ao: Three.GreaterDepth, co: Three.NotEqualDepth,
    rr: Three.GreaterEqualDepth, ir: Three.AlwaysDepth,
    ym: Three.ZeroFactor, h3: Three.OneFactor,
    ra: Three.SrcColorFactor, Am: Three.OneMinusSrcColorFactor,
    l1: Three.SrcAlphaFactor, v1: Three.OneMinusSrcAlphaFactor,
    bm: Three.DstColorFactor, Mm: Three.DstAlphaFactor,
    xm: Three.OneMinusDstAlphaFactor, Sm: Three.OneMinusDstColorFactor,
    Cm: Three.SrcAlphaSaturateFactor,
  };
  const names = Object.keys(aliases);
  return new Function(...names,
    `${source.slice(begin, end)}
    ${source.slice(helpersBegin, helpersEnd)}
    return CB;`)(...Object.values(aliases)) as
    (texture: Three.Texture | null, properties: BasicTextureProperties,
      flip?: boolean, baked?: boolean) => Three.ShaderMaterial;
}

function properties(mode: number, textureOp: number,
  blendEnable: number): BasicTextureProperties {
  return {
    texture: { value: { textureOp } },
    fog: { value: { selector: 0 } },
    material: { value: { mode, diffuse: 0x80ff0000, emissive: 0xff4499cc } },
    alpha: { value: { alphaTestEnable: 1, compare: 5, alphaRef: 127,
      blendEnable, srcBlend: 5, dstBlend: 6 } },
    zbuffer: { value: { zWrite: 1, zFunc: 4 } },
    backface: { value: { cull: 3 } },
  };
}

function snapshot(material: Three.ShaderMaterial, baseMap: Three.Texture | null) {
  return {
    name: material.name, defines: material.defines,
    vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
    uniforms: Object.fromEntries(Object.entries(material.uniforms).map(([name, entry]) => {
      const value = entry.value;
      return [name, value instanceof Three.Vector2 || value instanceof Three.Vector4
        ? value.toArray() : value instanceof Three.Color ? value.getHex() :
          value === baseMap && baseMap ? "baseMap" : value];
    })),
    toneMapped: material.toneMapped, fog: material.fog,
    depthWrite: material.depthWrite, depthFunc: material.depthFunc,
    side: material.side, transparent: material.transparent,
    blending: material.blending, blendSrc: material.blendSrc,
    blendDst: material.blendDst, blendEquation: material.blendEquation,
    forceSinglePass: material.forceSinglePass,
  };
}

test("基础纹理材质、烘焙节点、alpha 与三种材质模式和发行版一致", async () => {
  const original = await releaseMaterial();
  for (const mode of [0, 1, 2]) {
    for (const textureOp of [1, 4]) {
      for (const blend of [0, 1]) {
        const props = properties(mode, textureOp, blend);
        const oldTexture = new Three.Texture(), newTexture = new Three.Texture();
        const expected = original(oldTexture, props, true, mode === 2);
        const actual = createBasicTextureMaterial(newTexture, props, true, mode === 2);
        assert.deepEqual(snapshot(actual, newTexture), snapshot(expected, oldTexture),
          `${mode}/${textureOp}/${blend}`);
      }
    }
  }
});

test("基础纹理材质的未映射 D3D 值保留发行版错误", async () => {
  const original = await releaseMaterial();
  for (const field of ["texture", "fog", "mode", "depth", "cull", "srcBlend"] as const) {
    const props = properties(2, 1, 1);
    if (field === "texture") props.texture.value.textureOp = 99;
    if (field === "fog") props.fog.value.selector = 99;
    if (field === "mode") props.material.value.mode = 99;
    if (field === "depth") props.zbuffer.value.zFunc = 99;
    if (field === "cull") props.backface.value.cull = 99;
    if (field === "srcBlend") props.alpha.value.srcBlend = 99;
    const capture = (make: typeof original) => {
      try { make(null, props); return "success"; }
      catch (error) { return String(error); }
    };
    assert.equal(capture(createBasicTextureMaterial), capture(original), field);
  }
});
