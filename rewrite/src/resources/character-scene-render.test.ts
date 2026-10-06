import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Texture, Vector3 } from "three";

import { buildCharacterScene } from "./character-scene-render.js";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function originalScene(bindings: Record<string, unknown>) {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("async function TR(");
  const last = source.indexOf("\nasync function YY(", first);
  assert.ok(first >= 0 && last > first);
  return new Function(...Object.keys(bindings),
    `${source.slice(first, last)}\nreturn TR;`)(...Object.values(bindings)) as
      (model: unknown, body: Uint8Array, faces: Map<string, unknown>,
        animation: unknown, environment: unknown, stage: unknown,
        options?: unknown) => Promise<any>;
}

function harness() {
  const events: string[] = [];
  const rootAlpha = {};
  const properties = { alpha: rootAlpha, zbuf: {} };
  class FakeSkin {
    geometry = new BufferGeometry();
    outlineSource = { faces: [], positions: [] };
    updatePose(_pose: unknown) {
      events.push("skin.pose");
      return Array.from({ length: 15 }, () => [1, 0, 0, 0,
        0, 1, 0, 0, 0, 0, 1, 0]);
    }
    updateVertices() { events.push("skin.vertices"); }
  }
  class FakeOutline {
    object = new Group();
    update() { events.push("outline.update"); }
    dropFrame() { events.push("outline.drop"); }
    dispose() { events.push("outline.dispose"); }
  }
  const bodyTexture = new Texture();
  bodyTexture.addEventListener("dispose", () => events.push("texture.dispose"));
  const loadBodyTexture = async () => bodyTexture;
  const loadFaceTexture = async () => new Texture();
  const makeToonMaterial = () => {
    const material = new MeshBasicMaterial();
    (material as MeshBasicMaterial & { uniforms: { baseMap: { value?: Texture } } })
      .uniforms = { baseMap: {} };
    material.addEventListener("dispose", () => events.push("material.dispose"));
    return material;
  };
  const common = {
    QY: loadBodyTexture, YY: loadFaceTexture,
    T2: Group, v2: Matrix4, H: Vector3, D2: Mesh,
    Z9: PerspectiveCamera, Hl: () => undefined, cn: () => undefined,
    ju: () => properties, nZ: () => new BufferGeometry(), vR: FakeSkin,
    qm: () => undefined, AR: { collect: () => undefined },
    iZ: () => undefined, rZ: () => true,
    bo: makeToonMaterial, Mo: () => undefined, tZ: () => ({}),
    ie: () => undefined, N6: FakeOutline,
    JG: () => undefined, Xu: (object: { visible: boolean }) => object.visible,
    xo: () => undefined, ZY: () => new Matrix4(),
  };
  const adapter = {
    loadBodyTexture, loadFaceTexture,
    orientClientGroup: common.Hl, orientNativeGroup: common.cn,
    defaultProperties: common.ju, inheritProperties: common.ju,
    rigidGeometry: common.nZ, SkinnedGeometry: FakeSkin,
    registerSkinCulling: common.qm, collectBoneMatrices: common.AR.collect,
    applyTransform: common.iZ, isRenderableChild: common.rZ,
    makeToonMaterial, applyMaterialProperties: common.Mo,
    toonProperties: common.tZ, configureRenderOrder: common.ie,
    OutlineController: FakeOutline, cullHierarchy: common.JG,
    isVisible: common.Xu, configureToonUniforms: common.xo,
    poseMatrix: common.ZY,
  };
  return { common, adapter, events };
}

function fixture(includeFace = false) {
  const body = { className: "ReToonSkinned", name: "body", sortDepthBias: 0,
    geometry: { value: {} }, children: [], transform: [], nodeEnabled: 1 };
  const face = { className: "ReToonRigid", name: "face", sortDepthBias: 1,
    geometry: { value: {} }, children: [], transform: [], nodeEnabled: 1 };
  const root = { className: "ReCharacter", name: "character",
    serializedBoundsOverride: 0, cullingTraversalMode: 3,
    bounds0: {}, children: [{ value: body }, ...(includeFace ? [{ value: face }] : [])],
    transform: [], nodeEnabled: 1 };
  const animation = { face: () => includeFace ? "smile" : "default",
    update: () => [[1, 0, 0]],
    reset: () => undefined };
  return { model: { root: { value: root } }, animation };
}

function snapshot(scene: any) {
  const owner = scene.getDecorationOwner();
  return { root: scene.object.name, owner: owner.name,
    childNames: owner.children.map((child: Group) => child.name),
    bindings: scene.rootMaterialBindings.map((entry: any) => ({
      isMesh: entry.mesh.isMesh, inheritsRootAlpha: entry.inheritsRootAlpha,
    })),
    hierarchy: scene.object.children.map((child: Group) => child.name) };
}

test("角色 skin、Toon 轮廓、帧更新和资源释放与发行版一致", async () => {
  const { model, animation } = fixture();
  const oldHarness = harness();
  const currentHarness = harness();
  const Original = await originalScene(oldHarness.common);
  const camera = new PerspectiveCamera();
  camera.position.set(1, 2, 3);
  const old = await Original(model, new Uint8Array(), new Map(), animation,
    {}, {}, {});
  const current = await buildCharacterScene(model, new Uint8Array(), new Map(),
    animation, {}, {}, {}, currentHarness.adapter);
  assert.deepEqual(snapshot(current), snapshot(old));
  old.update(100, camera, 640, 480);
  current.update(100, camera, 640, 480);
  assert.deepEqual(currentHarness.events, oldHarness.events);
  old.reset();
  current.reset();
  old.dispose();
  current.dispose();
  assert.deepEqual(currentHarness.events, oldHarness.events);
});

test("角色面部纹理切换与隐藏帧的轮廓回收与发行版一致", async () => {
  const { model, animation } = fixture(true);
  const oldHarness = harness();
  const currentHarness = harness();
  const Original = await originalScene(oldHarness.common);
  const faces = new Map([["smile", { image: new Uint8Array() }]]);
  const old = await Original(model, new Uint8Array(), faces, animation, {}, {}, {});
  const current = await buildCharacterScene(model, new Uint8Array(), faces,
    animation, {}, {}, {}, currentHarness.adapter);
  assert.deepEqual(snapshot(current), snapshot(old));
  const camera = new PerspectiveCamera();
  old.update(100, camera, 640, 480);
  current.update(100, camera, 640, 480);
  assert.deepEqual(currentHarness.events, oldHarness.events);
  old.object.children[0].visible = false;
  current.object.children[0]!.visible = false;
  old.update(110, camera, 640, 480);
  current.update(110, camera, 640, 480);
  assert.deepEqual(currentHarness.events, oldHarness.events);
  old.dispose();
  current.dispose();
  assert.deepEqual(currentHarness.events, oldHarness.events);
});

test("角色根边界模式错误与发行版一致", async () => {
  const { model, animation } = fixture();
  model.root.value.cullingTraversalMode = 0;
  const oldHarness = harness();
  const currentHarness = harness();
  const Original = await originalScene(oldHarness.common);
  const capture = async (run: () => Promise<unknown>) =>
    run().then(() => "success", error => String(error));
  assert.equal(await capture(() => buildCharacterScene(model, new Uint8Array(),
    new Map(), animation, {}, {}, {}, currentHarness.adapter)),
  await capture(() => Original(model, new Uint8Array(), new Map(), animation,
    {}, {}, {})));
});
