import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Sphere, Texture, Vector3 } from "three";

import { assembleTrackScene } from "./track-scene-assembly.js";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseScene() {
  const source = await readFile(releaseFile, "utf8");
  const classStart = source.indexOf("class XK {");
  const classEnd = source.indexOf("\nconst Bb =", classStart);
  const start = source.indexOf("async function W1(");
  const end = source.indexOf("\nfunction YK(", start);
  assert.ok(classStart >= 0 && classEnd > classStart && start >= 0 && end > start);
  const Store = new Function("v2", `${source.slice(classStart, classEnd)}\nreturn XK;`)(Matrix4);
  return (bindings: Record<string, unknown>) => new Function(...Object.keys(bindings),
    `${source.slice(start, end)}\nreturn W1;`)(...Object.values(bindings)) as
      (model: unknown, library: unknown, name: string,
        texture: (state: unknown) => unknown, options: unknown) => Promise<any>;
}

function sceneNode(name: string, children: any[] = []): any {
  return { name, className: "Relement", kind: "scene-node", children,
    serializedBoundsOverride: 0, slotOccurrences: [], nodeEnabled: 1,
    cullingTraversalMode: 0, bounds0: { kind: "ordinary",
      min: [1, 2, 3], max: [4, 5, 6] },
    position: [0, 0, 0], transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    scale: [1, 1, 1] };
}

function harness() {
  const events: string[] = [];
  const environment = { dispose() { events.push("environment.dispose"); } };
  const stageBinding = { beginFrame(time: number) { events.push(`frame:${time}`); },
    lightFactor() { return 0.75; } };
  const shared = {
    T2: Group, v2: Matrix4, H: Vector3,
    hB: () => ({ candidates: [], omitted: [] }), ZK: () => undefined,
    Vu: () => false, Vp: (indices: number[]) => indices,
    aj: () => undefined, cj: () => undefined, oj: () => undefined,
    rn: { load: async () => environment }, ha: class {},
    GB: () => new Matrix4(), uj: () => new Matrix4(), TK: () => undefined,
    Lb: () => undefined, hj: () => undefined, zG: () => undefined,
    Jm: (target: Matrix4, value: { scale: number[] }) =>
      target.makeScale(...value.scale as [number, number, number]),
    QK: () => undefined, p8: () => undefined, BK: () => undefined,
    ku: () => undefined, GW: () => undefined, Lu: () => [],
    BW: () => undefined, RW: () => undefined,
    JK: () => undefined, PK: () => undefined, Ob: () => true,
    Hc: 0, tj: () => undefined, nj: () => undefined,
    Gp: () => undefined, ej: () => undefined, wq: () => undefined,
    Sq: () => undefined, BB: () => undefined,
  };
  const adapter = {
    inspectRoot: shared.hB, validateInspection: shared.ZK,
    isMorphGeometry: shared.Vu, stripIndices: shared.Vp,
    allocateRigidGeometry: shared.aj, allocateTriangleGeometry: shared.cj,
    finishSharedGeometry: shared.oj,
    SceneStore: undefined as unknown, loadEnvironment: shared.rn.load,
    StageBinding: shared.ha, localNodeMatrix: shared.uj,
    poseOverrideMatrix: shared.GB, sceneVisibility: shared.TK,
    prsController: shared.Lb, prsFallback: shared.hj,
    makePrsRuntime: shared.zG, resetNodeControllers: shared.QK,
    eachVisibility: shared.p8, resetTextureControllers: shared.BK,
    eachPrs: shared.ku, playPrs: shared.GW, materialControllers: shared.Lu,
    setPrsCycleMode: shared.BW, stopPrs: shared.RW,
    updateNodeVisibility: shared.JK, updateLightFactor: shared.PK,
    isVisible: shared.Ob, updateNodeWorld: shared.nj,
    updateCulling: shared.wq, cullBlackPlanes: shared.Sq,
    collectVisible: shared.Gp, updateNoCameraCulling: shared.ej,
    readCameraPose: shared.tj, serializeLocalTransform: shared.Jm,
    readPoseOverrideFallback: shared.hj, setClientWorldRoot: shared.BB,
    incrementFrameSerial: () => { shared.Hc++; },
  };
  return { events, environment, stageBinding, shared, adapter };
}

function snapshot(scene: any) {
  return { name: scene.object.name,
    children: scene.object.children.map((child: Group) => child.name),
    roots: scene.rootObjects.map((object: Group) => object.name),
    world: [...scene.object.matrixWorld.elements],
    visible: scene.rootObjects.map((object: Group) => object.visible),
    bounds: scene.clientWorldBounds(scene.settings.node) };
}

test("空材质场景的根装配、节点尺度、帧更新和释放与发行版一致", async () => {
  const makeOriginal = await releaseScene();
  for (const convert of [true, false]) {
    const node = sceneNode("root", [sceneNode("child")]);
    const model = { root: node, settings: { node } };
    const originalHarness = harness();
    const currentHarness = harness();
    const source = await readFile(releaseFile, "utf8");
    const classStart = source.indexOf("class XK {");
    const classEnd = source.indexOf("\nconst Bb =", classStart);
    const Store = new Function("v2", `${source.slice(classStart, classEnd)}\nreturn XK;`)(Matrix4);
    const old = await makeOriginal({ ...originalHarness.shared, XK: Store })(model, {},
      "scene", () => ({ status: "absent" }),
      { environment: originalHarness.environment,
        stageBinding: originalHarness.stageBinding,
        convertClientCoordinates: convert });
    const current = await assembleTrackScene(model, {}, "scene",
      () => ({ status: "absent" }),
      { environment: currentHarness.environment,
        stageBinding: currentHarness.stageBinding,
        convertClientCoordinates: convert }, { ...currentHarness.adapter, SceneStore: Store });
    assert.deepEqual(snapshot(current), snapshot(old));
    old.setNodeScale(node, [2, 3, 4]);
    current.setNodeScale(node, [2, 3, 4]);
    assert.deepEqual(current.clientWorldElements(node), old.clientWorldElements(node));
    old.reset(100);
    current.reset(100);
    old.update(120);
    current.update(120);
    assert.deepEqual(snapshot(current), snapshot(old));
    assert.deepEqual(currentHarness.events, originalHarness.events);
    old.pruneWorldMatrixRecursion();
    current.pruneWorldMatrixRecursion();
    assert.equal(current.object.matrixWorldAutoUpdate, old.object.matrixWorldAutoUpdate);
    old.dispose();
    current.dispose();
    assert.deepEqual(currentHarness.events, originalHarness.events);
  }
});

test("相机居中与有无相机切换的世界矩阵策略与发行版一致", async () => {
  const makeOriginal = await releaseScene();
  const source = await readFile(releaseFile, "utf8");
  const classStart = source.indexOf("class XK {");
  const classEnd = source.indexOf("\nconst Bb =", classStart);
  const Store = new Function("v2", `${source.slice(classStart, classEnd)}\nreturn XK;`)(Matrix4);
  const node = sceneNode("camera-root");
  const model = { root: node, settings: {} };
  const oldHarness = harness();
  const currentHarness = harness();
  const old = await makeOriginal({ ...oldHarness.shared, XK: Store,
    Z9: PerspectiveCamera })(model, {}, "camera-scene", () => ({}),
    { environment: oldHarness.environment, stageBinding: oldHarness.stageBinding,
      cameraCentered: true });
  const current = await assembleTrackScene(model, {}, "camera-scene", () => ({}),
    { environment: currentHarness.environment, stageBinding: currentHarness.stageBinding,
      cameraCentered: true }, { ...currentHarness.adapter, SceneStore: Store });
  const camera = new PerspectiveCamera(65, 1.6, 0.1, 1000);
  camera.position.set(4, 8, 12);
  for (const view of [camera, undefined, camera]) {
    old.update(500, view);
    current.update(500, view);
    assert.deepEqual([...current.object.position], [...old.object.position]);
    assert.deepEqual([...current.object.matrixWorld.elements],
      [...old.object.matrixWorld.elements]);
    assert.equal(current.object.matrixWorldAutoUpdate, old.object.matrixWorldAutoUpdate);
    assert.equal(current.rootObjects[0].matrixWorldAutoUpdate,
      old.rootObjects[0].matrixWorldAutoUpdate);
  }
  old.dispose();
  current.dispose();
});

test("三角网格候选的共享缓冲区、材质和 scene store 与发行版一致", async () => {
  const makeOriginal = await releaseScene();
  const node = sceneNode("triangle");
  node.sortDepthBias = 12;
  node.vertexData = { vertexCount: 3,
    positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0]],
    normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
    uvSetsPerVertex: 1, uvs: [[[0, 0]], [[1, 0]], [[0, 1]]],
    indices: [0, 1, 2] };
  const value = (value: unknown) => ({ value });
  const candidate = { node, geometryKind: "tri-list", issues: [],
    state: { texture: value({ name: "missing", addressU: 1, addressV: 1,
      minFilter: 1, magFilter: 1, mipFilter: 0, maxAnisotropy: 1,
      uvControllers: [], scalar: 1 }),
    alpha: value({ blendEnable: 0 }), fog: value({ selector: 0 }),
    material: value({ mode: 0 }), zbuffer: value({}), backface: value({}) } };
  function pool(vertices: number, indices: number) {
    const positions = new Float32Array(vertices * 3);
    const normals = new Float32Array(vertices * 3);
    const uvs = new Float32Array(vertices * 2);
    const colors = new Float32Array(vertices * 4);
    const indexValues = new Uint32Array(indices);
    return { positions, normals, uvs, colors, indices: indexValues,
      positionAttribute: new BufferAttribute(positions, 3),
      normalAttribute: new BufferAttribute(normals, 3),
      uvAttribute: new BufferAttribute(uvs, 2),
      colorAttribute: new BufferAttribute(colors, 4),
      indexAttribute: new BufferAttribute(indexValues, 1),
      sphere: new Sphere(), views: [], vertexCursor: 0, indexCursor: 0 };
  }
  const source = await readFile(releaseFile, "utf8");
  const classStart = source.indexOf("class XK {");
  const classEnd = source.indexOf("\nconst Bb =", classStart);
  const Store = new Function("v2", `${source.slice(classStart, classEnd)}\nreturn XK;`)(Matrix4);
  const originalHarness = harness();
  const currentHarness = harness();
  const textureControllers = () => ({ uvControllers: undefined,
    alphaController: undefined, currentAlpha: 1 });
  const makeMaterial = () => new MeshBasicMaterial();
  for (const item of [originalHarness, currentHarness]) {
    const h = item as unknown as { shared: Record<string, any>;
      adapter: Record<string, any> };
    h.shared.hB = () => ({ candidates: [candidate], omitted: [] });
    h.shared.cj = pool;
    Object.assign(h.shared, { D2: Mesh, t9: BufferGeometry, CB: makeMaterial,
      _K: textureControllers, EB: () => undefined,
      ie: () => undefined, _B: () => [1, 1, 1, 1] });
    Object.assign(h.adapter, { inspectRoot: h.shared.hB,
      allocateTriangleGeometry: pool,
      createBasicMaterial: makeMaterial,
      createTextureControllers: textureControllers,
      initializeMaterialUniforms: h.shared.EB,
      configureRenderOrder: h.shared.ie,
      floatColor: h.shared._B,
      SceneStore: Store });
  }
  const model = { root: node, settings: {} };
  const options = { environment: originalHarness.environment,
    stageBinding: originalHarness.stageBinding };
  const old = await makeOriginal({ ...originalHarness.shared, XK: Store })(model,
    {}, "triangle-scene", () => ({ status: "absent" }), options);
  const current = await assembleTrackScene(model, {}, "triangle-scene",
    () => ({ status: "absent" }),
    { environment: currentHarness.environment,
      stageBinding: currentHarness.stageBinding }, currentHarness.adapter);
  function mesh(scene: any): Mesh {
    return scene.rootObjects[0] as Mesh;
  }
  assert.equal(mesh(current).isMesh, mesh(old).isMesh);
  for (const attribute of ["position", "normal", "uv", "primaryColor"])
    assert.deepEqual([...mesh(current).geometry.getAttribute(attribute).array],
      [...mesh(old).geometry.getAttribute(attribute).array]);
  assert.deepEqual([...mesh(current).geometry.index!.array],
    [...mesh(old).geometry.index!.array]);
  assert.deepEqual(mesh(current).geometry.drawRange, mesh(old).geometry.drawRange);
  assert.deepEqual(mesh(current).userData, mesh(old).userData);
  old.update(10);
  current.update(10);
  assert.deepEqual(snapshot(current), snapshot(old));
  old.dispose();
  current.dispose();
});

test("Toon 刚性网格、轮廓和纹理缓存与发行版一致", async () => {
  const makeOriginal = await releaseScene();
  const source = await readFile(releaseFile, "utf8");
  const classStart = source.indexOf("class XK {");
  const classEnd = source.indexOf("\nconst Bb =", classStart);
  const Store = new Function("v2", `${source.slice(classStart, classEnd)}\nreturn XK;`)(Matrix4);
  const node = sceneNode("toon");
  node.sortDepthBias = 4;
  node.rigidGeometry = { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    normals: [[0, 0, 1]], texcoords: [{ u: 0, v: 0, normalIndex: 0 },
      { u: 1, v: 0, normalIndex: 0 }, { u: 0, v: 1, normalIndex: 0 }],
    faces: [{ positionIndices: [0, 1, 2], texcoordIndices: [0, 1, 2],
      adjacentFaceIndices: [0, 0, 0], winding: 0, outlineOpenEdge: 0 }] };
  const value = (value: unknown) => ({ value });
  const candidate = { node, geometryKind: "toon-rigid", issues: [],
    state: { texture: value({ name: "skin", addressU: 1, addressV: 1,
      minFilter: 1, magFilter: 1, mipFilter: 0, maxAnisotropy: 1,
      uvControllers: [], scalar: 1 }),
    alpha: value({ blendEnable: 0 }), fog: value({ selector: 0 }),
    material: value({ mode: 0 }), zbuffer: value({}), backface: value({}),
    toon: value({ flags: [1, 1], words: [0, 0, 0, 0, 0, 0, 0, 4278190080, 2130706432] }) } };
  function pool(vertices: number) {
    const positions = new Float32Array(vertices * 3);
    const normals = new Float32Array(vertices * 3);
    const uvs = new Float32Array(vertices * 2);
    return { positions, normals, uvs, positionAttribute: new BufferAttribute(positions, 3),
      normalAttribute: new BufferAttribute(normals, 3),
      uvAttribute: new BufferAttribute(uvs, 2), sphere: new Sphere(),
      views: [], vertexCursor: 0 };
  }
  class FakeOutline {
    object = new Group();
    disposed = false;
    constructor(readonly source: unknown, readonly center: number,
      readonly outer: number, readonly draw: boolean) {}
    dispose() { this.disposed = true; }
    update() {}
  }
  const texture = () => new Texture();
  const makeMaterial = () => new MeshBasicMaterial();
  const textureControllers = () => ({ uvControllers: undefined,
    alphaController: undefined, currentAlpha: 1 });
  const originalHarness = harness();
  const currentHarness = harness();
  for (const item of [originalHarness, currentHarness]) {
    const h = item as unknown as { shared: Record<string, any>;
      adapter: Record<string, any> };
    h.shared.hB = () => ({ candidates: [candidate], omitted: [] });
    h.shared.aj = pool;
    Object.assign(h.shared, { D2: Mesh, t9: BufferGeometry, N6: FakeOutline,
      bo: makeMaterial, Mo: () => undefined, AB: texture,
      YK: (_candidate: unknown, value: unknown) => value,
      _K: textureControllers, ie: () => undefined });
    Object.assign(h.adapter, { inspectRoot: h.shared.hB,
      allocateRigidGeometry: pool, loadTexture: texture,
      inheritToonTexture: h.shared.YK,
      createToonMaterial: makeMaterial,
      applyMaterialProperties: h.shared.Mo,
      createTextureControllers: textureControllers,
      configureRenderOrder: h.shared.ie,
      OutlineController: FakeOutline,
      SceneStore: Store });
  }
  const resolveTexture = () => ({ status: "found", entry: { virtualPath: "skin.png" } });
  const old = await makeOriginal({ ...originalHarness.shared, XK: Store })
    ({ root: node, settings: {} }, {}, "toon-scene", resolveTexture,
      { environment: originalHarness.environment, stageBinding: originalHarness.stageBinding });
  const current = await assembleTrackScene({ root: node, settings: {} }, {},
    "toon-scene", resolveTexture,
    { environment: currentHarness.environment, stageBinding: currentHarness.stageBinding },
    currentHarness.adapter);
  assert.deepEqual(snapshot(current), snapshot(old));
  const oldBody = old.rootObjects[0].children[0] as Mesh;
  const currentBody = current.rootObjects[0].children[0] as Mesh;
  for (const attribute of ["position", "normal", "uv"])
    assert.deepEqual([...currentBody.geometry.getAttribute(attribute).array],
      [...oldBody.geometry.getAttribute(attribute).array]);
  assert.deepEqual(currentBody.geometry.drawRange, oldBody.geometry.drawRange);
  assert.deepEqual(currentBody.userData, oldBody.userData);
  old.dispose();
  current.dispose();
});
