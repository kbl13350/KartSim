import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { FlyingPetModel, loadFlyingPetModelParts, validateFlyingPetSkeleton } from "../src/world/flying-pet-model.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = nodes.find(item => item.id?.name === name);
  assert.ok(node, `${name} missing`);
  return release.slice(node.start, node.end);
}

function fixture() {
  const log = [];
  let groupId = 0;
  let meshId = 0;
  let outlineId = 0;
  class Matrix {
    constructor(name = "matrix") { this.name = name; }
    makeRotationX(angle) { log.push(["rotation", angle]); return this; }
    copy(source) { log.push(["copy", this.name, source.name]); return this; }
    multiply(source) { log.push(["multiply", this.name, source.name]); return this; }
    invert() { log.push(["invert", this.name]); return this; }
    identity() { log.push(["identity", this.name]); return this; }
    clone() { log.push(["clone", this.name]); return new Matrix(`${this.name}:clone`); }
  }
  class Group {
    constructor() {
      this.id = `group${groupId++}`;
      this.matrix = new Matrix(this.id);
      this.children = [];
    }
    add(...children) {
      this.children.push(...children);
      log.push(["add", this.id, children.map(child => child.id)]);
    }
    removeFromParent() { log.push(["remove", this.id]); }
    updateWorldMatrix(force, children) { log.push(["worldMatrix", this.id, force, children]); }
  }
  class Vector {
    set(x, y, z) { log.push(["vector", x, y, z]); return this; }
  }
  class Material {
    constructor(texture, options) {
      this.id = `material:${texture}`;
      this.transparent = false;
      this.uniforms = { baseMap: { value: null }, uvControllerEnabled: { value: 1 } };
      log.push(["material", texture, options.kind]);
    }
    dispose() { log.push(["dispose", this.id]); }
  }
  class Mesh {
    constructor(geometry, material) {
      this.id = `mesh${meshId++}`;
      this.matrixWorld = new Matrix(`${this.id}:world`);
      log.push(["mesh", this.id, geometry.id, material.id]);
    }
  }
  class Outline {
    constructor(source, _dark, _light, visible) {
      this.id = `outline${outlineId++}`;
      this.object = { id: this.id, visible };
      log.push(["outline", this.id, source.id, visible]);
    }
    update(mesh, _camera, width, height) { log.push(["outlineUpdate", this.id, mesh.id, width, height]); }
    dispose() { log.push(["dispose", this.id]); }
  }
  class Skin {
    constructor(source) {
      log.push(["skin", source.id]);
      this.geometry = { id: "skinGeometry", dispose() { log.push(["dispose", "skinGeometry"]); } };
      this.outlineSource = { id: "skinOutline" };
    }
    applyPalette(palette) { log.push(["palette", palette]); }
  }
  const bones = Array.from({ length: 6 }, (_, index) => ({
    enabled: false, parentIndex: 0, reserved: true, inverseBind: `inverse${index}`,
  }));
  const skeleton = {
    id: "skeleton", bones,
    vertices: [{ bone0: 0, bone1: 65535, weight0: 1, weight1: 0 }],
  };
  const skinNode = {
    className: "ReToonSkinned", geometry: { value: skeleton },
    transform: "skinTransform", nodeEnabled: 1,
  };
  const rigidNode = {
    className: "ReToonRigid", geometry: { value: { id: "rigid" } },
    transform: "rigidTransform", nodeEnabled: 1,
  };
  const headChild = { className: "Relement", children: [], transform: "headChildTransform" };
  const head = { className: "Relement", name: "head", transform: "headTransform",
    children: [{ value: headChild }] };
  const model = { root: { value: {
    className: "RePet2", transform: "rootTransform", sortDepthBias: 1,
    children: [{ value: skinNode }, { value: { children: [{ value: rigidNode }] } },
      undefined, { value: head }],
  } } };
  const textures = {
    async body() { log.push(["body"]); return "bodyTexture"; },
    async face(face) { log.push(["face", face]); return face === "faceA" ? "faceTexture" : null; },
  };
  const clips = [{ map: ["faceA", "faceB"] }, { map: ["faceA"] }];
  const registerSkinCulling = (object, callback) => { object.collectCallback = callback; log.push(["culling", object.id]); };
  const applyTransform = (object, transform) => log.push(["transform", object.id, transform]);
  const toonProperties = () => ({ alpha: 1, zbuf: 2 });
  const applyMaterial = (material, state) => log.push(["materialState", material.id, state]);
  const renderState = (alpha, zbuf) => `${alpha}:${zbuf}`;
  const configureRenderOrder = (object, bias, transparent, offset) =>
    log.push(["order", object.id, bias, transparent, offset]);
  const rigidGeometry = source => ({ id: `rigid:${source.id}`, dispose() { log.push(["dispose", "rigid"]); } });
  const isElement = node => node?.value?.className === "Relement";
  const collectBoneMatrices = () => bones.map((_, index) => ({ name: `bone${index}` }));
  const composeBoneMatrix = (bone, inverse) => `${bone.name}:${inverse}`;
  const setTextureEnabled = (material, disabled) => log.push(["textureEnabled", material.id, disabled]);
  const headTransform = bone => new Matrix(`head:${bone.name}`);
  const updateEnvironment = material => log.push(["environment", material.id]);
  const deps = {
    createGroup: () => new Group(), createSkin: source => new Skin(source),
    registerSkinCulling, applyTransform, toonProperties,
    makeMaterial: (texture, options) => new Material(texture, options),
    applyMaterial, renderState, createMesh: (geometry, material) => new Mesh(geometry, material),
    configureRenderOrder, createOutline: (...args) => new Outline(...args),
    createMatrix: () => new Matrix(), createVector: () => new Vector(),
    updateEnvironment, rigidGeometry, isElement, collectBoneMatrices,
    composeBoneMatrix, setTextureEnabled, headTransform,
  };
  const Original = new Function("T2", "vR", "qm", "Ud", "wE", "bo", "Mo", "ir0",
    "D2", "ie", "N6", "v2", "H", "xo", "rr0", "vE", "sr0", "AR", "yR", "JH", "nr0",
    `${declaration("Ks")}\nreturn Ks;`)(
      Group, Skin, registerSkinCulling, applyTransform, toonProperties,
      (texture, options) => new Material(texture, options), applyMaterial, renderState,
      Mesh, configureRenderOrder, Outline, Matrix, Vector, updateEnvironment,
      rigidGeometry, isElement,
      new Function(`${declaration("sr0")}\nreturn sr0;`)(),
      { collect: collectBoneMatrices }, composeBoneMatrix, setTextureEnabled, headTransform,
    );
  return { log, model, clips, textures, skeleton, deps, Original };
}

async function exercise(rewritten) {
  const { log, model, clips, textures, deps, Original } = fixture();
  const owner = rewritten
    ? await (async () => {
      const { body, faces } = await loadFlyingPetModelParts(clips, textures);
      return new FlyingPetModel(model, body, faces, "env", "binding", deps);
    })()
    : await Original.load(model, clips, textures, "env", "binding");
  const animation = {
    sequence: { map: ["faceA"] }, faceSlot: 0, pose: {},
    update(now) { log.push(["animation", now]); },
  };
  owner.update(animation, "camera", 640, 480, 100);
  owner.collect();
  owner.draws[0].mesh.onBeforeRender(null, null, {
    getWorldPosition(vector) { vector.set(1, 2, 3); },
  });
  const beforeDispose = { headSocket: !!owner.headSocket, faces: [...owner.faces.keys()],
    draws: owner.draws.length, attachments: owner.attachments.length };
  owner.dispose();
  owner.dispose();
  return { beforeDispose, disposed: owner.disposed, log };
}

test("flying pet model loading, render palette and cleanup match release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});

test("flying pet skeleton validation matches release errors", () => {
  const { skeleton } = fixture();
  const releaseValidate = new Function(`${declaration("sr0")}\nreturn sr0;`)();
  for (const mutate of [
    geometry => geometry.bones.splice(5, 1),
    geometry => { geometry.bones[5].enabled = true; geometry.bones[5].parentIndex = 5; },
    geometry => { geometry.bones[0].reserved = false; },
  ]) {
    const copy = structuredClone(skeleton);
    mutate(copy);
    let actual, expected;
    try { validateFlyingPetSkeleton(copy); } catch (error) { actual = error.message; }
    try { releaseValidate(copy); } catch (error) { expected = error.message; }
    assert.equal(actual, expected);
  }
});
