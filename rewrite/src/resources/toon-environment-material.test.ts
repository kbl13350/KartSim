import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Color, Matrix4, NoColorSpace, ShaderMaterial, Texture,
  Vector2, Vector3, Vector4 } from "three";

import { createToonEnvironmentMaterial, type ToonEnvironment } from
  "./toon-environment-material";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseMaterial() {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("function bo(");
  const end = source.indexOf("\nfunction Zq(", start);
  assert.ok(start >= 0 && end > start);
  return new Function("v9", "$1", "v2", "H", "B2", "Y2", "r9",
    `${source.slice(start, end)}; return bo;`)(NoColorSpace,
    ShaderMaterial, Matrix4, Vector3, Vector2, Vector4, Color) as
    (texture: Texture, environment: ToonEnvironment, parts?: number) => ShaderMaterial;
}

function snapshot(material: ShaderMaterial, baseMap: Texture) {
  return {
    baseColorSpace: baseMap.colorSpace,
    name: material.name,
    vertexShader: material.vertexShader,
    fragmentShader: material.fragmentShader,
    uniforms: Object.fromEntries(Object.entries(material.uniforms).map(([name, entry]) => {
      const value = entry.value;
      return [name, value instanceof Matrix4 || value instanceof Vector2 ||
        value instanceof Vector3 || value instanceof Vector4
        ? value.toArray() : value instanceof Color ? value.getHex() :
          value instanceof Float32Array ? [...value] : value === baseMap ? "baseMap" : value];
    })),
    toneMapped: material.toneMapped,
    fog: material.fog,
    forceSinglePass: material.forceSinglePass,
  };
}

test("Toon 环境反射与法线投影材质及分件 shader 与发行版一致", async () => {
  const original = await releaseMaterial();
  for (const environment of [
    { kind: "rigid-reflection", origin: [4, 5, 6] },
    { kind: "normal-projection" },
    { kind: "other" },
  ] as ToonEnvironment[]) {
    for (const parts of [0, 1, 4]) {
      const oldTexture = new Texture(), newTexture = new Texture();
      const expected = original(oldTexture, environment, parts);
      const actual = createToonEnvironmentMaterial(newTexture, environment, parts);
      assert.deepEqual(snapshot(actual, newTexture), snapshot(expected, oldTexture),
        `${environment.kind}, ${parts} palette parts`);
    }
  }
});
