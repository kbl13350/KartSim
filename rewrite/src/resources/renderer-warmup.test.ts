import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  BoxGeometry, Fog, Group, Mesh, MeshBasicMaterial, PerspectiveCamera,
  Scene, ShaderMaterial, Sprite, SpriteMaterial, Texture, Vector4,
  type WebGLRenderer,
} from "three";
import { warmRendererResources } from "./renderer-warmup";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as typeof import("@babel/parser");
const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseWarmup() {
  const source = await readFile(releaseFile, "utf8");
  const declaration = parse(source, { sourceType: "module" }).program.body
    .find(node => node.type === "FunctionDeclaration" && node.id?.name === "Hn");
  assert.ok(declaration);
  return new Function("Z9", "D1", "D2", "GG", "D9", "Y2",
    `${source.slice(declaration.start!, declaration.end!)}\nreturn Hn;`)(
      PerspectiveCamera, Scene, Mesh, Sprite, Texture, Vector4,
    ) as typeof warmRendererResources;
}

function fixture() {
  const texture = new Texture();
  texture.name = "shared";
  const secondary = new Texture();
  secondary.name = "uniform";
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), [
    new MeshBasicMaterial({ map: texture }),
    new ShaderMaterial({ uniforms: {
      first: { value: texture }, second: { value: secondary },
    } }),
  ]);
  mesh.position.set(2, 3, 4);
  root.add(mesh, new Sprite(new SpriteMaterial({ map: texture })));
  root.updateMatrixWorld(true);
  const environment = new Scene();
  environment.fog = new Fog(0xffffff, 1, 100);
  return { root, environment };
}

function fakeRenderer(failRender: boolean) {
  const calls: unknown[] = [];
  const target = { name: "original target" };
  const renderer = {
    sortObjects: true,
    compile(...args: unknown[]) {
      calls.push(["compile", args.length, (args[1] as PerspectiveCamera).type]);
    },
    initTexture(texture: Texture) { calls.push(["texture", texture.name]); },
    getRenderTarget() { calls.push(["get-target"]); return target; },
    getViewport(out: Vector4) {
      calls.push(["get-viewport"]); return out.set(2, 3, 400, 300);
    },
    getScissor(out: Vector4) {
      calls.push(["get-scissor"]); return out.set(4, 5, 100, 70);
    },
    getScissorTest() { calls.push(["get-scissor-test"]); return false; },
    setRenderTarget(value: unknown) {
      calls.push(["set-target", value === null ? "null" :
        value === target ? "original" : "unknown"]);
    },
    setViewport(...args: unknown[]) {
      calls.push(["set-viewport", ...args.map(value =>
        value instanceof Vector4 ? value.toArray() : value)]);
    },
    setScissor(...args: unknown[]) {
      calls.push(["set-scissor", ...args.map(value =>
        value instanceof Vector4 ? value.toArray() : value)]);
    },
    setScissorTest(value: boolean) { calls.push(["scissor-test", value]); },
    render(scene: Scene, camera: PerspectiveCamera) {
      calls.push(["render", camera.type, scene.fog?.constructor.name,
        scene.children.map(child => ({
          type: child.type, matrix: child.matrix.toArray(),
          matrixAutoUpdate: child.matrixAutoUpdate,
          frustumCulled: child.frustumCulled,
        }))]);
      if (failRender) throw new Error("render failure");
    },
  };
  return { renderer: renderer as unknown as WebGLRenderer, calls,
    state: () => renderer.sortObjects };
}

test("预编译、去重上传纹理及单像素预热与发行版一致", async () => {
  const old = await releaseWarmup();
  const { root, environment } = fixture();
  for (const withEnvironment of [false, true])
    for (const onePixel of [false, true]) {
      const expected = fakeRenderer(false);
      const actual = fakeRenderer(false);
      const scene = withEnvironment ? environment : undefined;
      old(expected.renderer, root, scene, onePixel);
      warmRendererResources(actual.renderer, root, scene, onePixel);
      assert.deepEqual(actual.calls, expected.calls);
      assert.equal(actual.state(), expected.state());
    }
});

test("单像素预热出错仍恢复渲染状态", async () => {
  const old = await releaseWarmup();
  const { root, environment } = fixture();
  const expected = fakeRenderer(true);
  const actual = fakeRenderer(true);
  assert.throws(() => old(expected.renderer, root, environment, true),
    { message: "render failure" });
  assert.throws(() => warmRendererResources(actual.renderer, root,
    environment, true), { message: "render failure" });
  assert.deepEqual(actual.calls, expected.calls);
  assert.equal(actual.state(), expected.state());
});
