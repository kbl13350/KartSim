import { BufferGeometry, Group, Matrix4, Mesh, PerspectiveCamera, Vector3 } from "three";
import { TrackSceneStore } from "./track-scene-store.js";

/**
 * Builds a renderable track scene from decoded model nodes. The dependency
 * adapter lives beside the release module, so archive parsing, animation,
 * material, and culling code can be replaced independently.
 */
export async function assembleTrackScene(model, library, label, resolveTexture,
  options = {}, dependencies) {
  const {
    inspectRoot, validateInspection, isMorphGeometry, stripIndices,
    allocateRigidGeometry, allocateTriangleGeometry, finishSharedGeometry,
    loadEnvironment, StageBinding, localNodeMatrix,
    poseOverrideMatrix, sceneVisibility, prsController,
    makePrsRuntime, loadTexture, inheritToonTexture, createToonMaterial,
    applyMaterialProperties, createBasicMaterial, createTextureControllers,
    ColorController, initializeMaterialUniforms, makeMorphGeometry,
    MorphController, configureRenderOrder, bindTexture, configureToonUniforms,
    OutlineController, isVisible, updateLightFactor,
    floatColor, updateMaterialEntry, resetNodeControllers, eachVisibility,
    resetTextureControllers, eachPrs, playPrs, materialControllers,
    setPrsCycleMode, stopPrs, updateNodeVisibility,
    readCameraPose, updateNodeWorld, updateCulling, cullBlackPlanes,
    collectVisible, updateNoCameraCulling, serializeLocalTransform,
    readPoseOverrideFallback, setClientWorldRoot, incrementFrameSerial,
  } = dependencies;

  const sceneRoot = model.root.kind === "track" ? model.root.scene : model.root;
  const blackPlanes = model.root.kind === "track"
    ? model.root.trackObjects.filter(object => object.kind === "ToBlackPlane") : [];
  const roots = [sceneRoot, ...(options.additionalRoots ?? [])];
  const inspections = roots.map(inspectRoot);
  inspections.forEach(validateInspection);
  const matrixOnlyRoots = new Set(options.matrixOnlyRoots ?? []);
  const ownsEnvironment = options.environment === undefined;
  const environment = options.environment ?? await loadEnvironment(library);
  const stageBinding = options.stageBinding ?? new StageBinding();
  const candidateByNode = new Map(inspections.flatMap((inspection, index) =>
    matrixOnlyRoots.has(roots[index]) ? [] :
      inspection.candidates.map(candidate => [candidate.node, candidate])));
  const ownsTextureCache = options.textureCache === undefined;
  const textureCache = options.textureCache ?? new Map();
  const toonMaterials = new Set();
  const basicMaterials = new Set();
  const geometries = new Set();
  const outlines = [];
  const morphControllers = [];
  const materialEntries = [];
  const basicMaterialCache = new Map();
  let lastOpaqueToonTexture;
  let cameraBasis;
  let frameTime = 0;
  let lastLightFactor;

  const object = new Group();
  object.name = label;
  if (options.convertClientCoordinates !== false) object.rotation.x = -Math.PI / 2;
  object.scale.setScalar(options.scale ?? 1);
  const identity = new Matrix4();
  const previousRootWorld = new Matrix4();
  const cameraRelative = new Matrix4();
  const cameraPose = {
    right: new Vector3(), up: new Vector3(), back: new Vector3(),
    position: new Vector3(),
  };
  let manualWorldMatrices = false;

  let rigidPool;
  let trianglePool;
  {
    let rigidVertices = 0;
    let triangleVertices = 0;
    let triangleIndices = 0;
    for (const candidate of candidateByNode.values()) {
      if (isMorphGeometry(candidate)) continue;
      if (candidate.geometryKind === "toon-rigid") {
        rigidVertices += candidate.node.rigidGeometry.faces.length * 3;
      } else {
        const vertexData = candidate.node.vertexData;
        triangleVertices += vertexData.vertexCount;
        triangleIndices += candidate.geometryKind === "tri-strip"
          ? stripIndices(vertexData.indices).length : vertexData.indices.length;
      }
    }
    if (rigidVertices > 0) rigidPool = allocateRigidGeometry(rigidVertices);
    if (triangleVertices > 0)
      trianglePool = allocateTriangleGeometry(triangleVertices, triangleIndices);
  }

  const records = [];
  let store;
  let blackPlaneMask;
  try {
    for (const root of roots) {
      const rootIndex = await buildNode(root, new Matrix4(), false);
      object.add(records[rootIndex].cullingObject);
    }
    finishSharedGeometry([rigidPool, trianglePool]);
    store = new TrackSceneStore(records);
    if (blackPlanes.length > 0) blackPlaneMask = new Uint8Array(store.count);
  } catch (error) {
    dispose();
    throw error;
  }

  const rootObjects = [];
  for (let index = 0; index < store.count; index++)
    if (store.parent[index] === -1) rootObjects.push(store.object[index]);

  return {
    object,
    rootObjects,
    settings: model.settings,
    setNodeScale(node, scale) {
      const index = store.indexBySource.get(node);
      if (index === undefined || store.prs[index] || scale.length !== 3 ||
          scale.some(value => !Number.isFinite(value)))
        throw new Error("原模型节点 scale writer 与控制器 owner 不匹配。");
      serializeLocalTransform(store.serializedLocal[index], {
        basis: node.transform, position: node.position, scale,
      });
      store.animatedTransform[index] = 1;
      for (let ancestor = store.parent[index]; ancestor >= 0;
        ancestor = store.parent[ancestor])
        store.animatedDescendants[ancestor] = 1;
    },
    clientWorldElements(node) {
      const index = store.indexBySource.get(node);
      return index === undefined ? undefined : store.clientWorldElementsViews[index];
    },
    clientWorldBounds(node) {
      const index = store.indexBySource.get(node);
      const bounds = index === undefined ? undefined : store.runtimeBounds[index];
      if (bounds?.kind !== "ordinary" || options.convertClientCoordinates === false)
        return bounds;
      return { kind: "ordinary",
        min: [bounds.min[0], -bounds.max[2], bounds.min[1]],
        max: [bounds.max[0], -bounds.min[2], bounds.max[1]] };
    },
    reset(time) {
      resetNodeControllers(store, time);
      eachVisibility(store, controller => controller.reset(time));
      for (const entry of materialEntries) {
        resetTextureControllers(entry.state, time);
        entry.materialControllers?.forEach(controller => controller?.reset(time));
      }
      morphControllers.forEach(controller => controller.reset(time));
    },
    playControllers(time, duration) {
      eachPrs(store, (controller, runtime) => playPrs(controller, runtime, time, duration));
      eachVisibility(store, controller => controller.play(time, duration));
      for (const entry of materialEntries)
        materialControllers(entry.state).forEach(controller => controller.play(time, duration));
      morphControllers.forEach(controller => controller.play(time, duration));
    },
    setControllerCycleMode(mode) {
      eachPrs(store, (controller, runtime) => setPrsCycleMode(runtime, mode));
      eachVisibility(store, controller => controller.setCycleMode(mode));
      for (const entry of materialEntries)
        materialControllers(entry.state).forEach(controller => controller.setCycleMode(mode));
      morphControllers.forEach(controller => controller.setCycleMode(mode));
    },
    stopControllers(time) {
      eachPrs(store, (controller, runtime) => stopPrs(controller, runtime, time));
      eachVisibility(store, controller => controller.stop(time));
      for (const entry of materialEntries)
        materialControllers(entry.state).forEach(controller => controller.stop(time));
      morphControllers.forEach(controller => controller.stop(time));
    },
    update(time, camera, viewportWidth, viewportHeight) {
      if (options.advanceEnvironment !== false) stageBinding.beginFrame(time);
      frameTime = time;
      updateNodeVisibility(store, time);
      updateWorldMatrices(time, camera);
      updateVisibleNodes(camera);
      const lightFactor = stageBinding.lightFactor();
      if (lastLightFactor !== lightFactor) {
        basicMaterials.forEach(material => updateLightFactor(material, lightFactor));
        lastLightFactor = lightFactor;
      }
      if (camera && viewportWidth && viewportHeight)
        for (const { outline, body } of outlines)
          if (isVisible(body)) {
            body.updateWorldMatrix(false, false);
            outline.update(body, camera, viewportWidth, viewportHeight);
          }
    },
    refreshRootWorldMatrices() {
      if (cameraBasis !== undefined)
        for (let index = 0; index < store.count; index++)
          if (store.parent[index] === -1)
            setClientWorldRoot(store, index, object.matrixWorld);
    },
    pruneWorldMatrixRecursion() {
      if (manualWorldMatrices) return;
      manualWorldMatrices = true;
      object.matrixWorldAutoUpdate = false;
      for (let index = 0; index < store.count; index++) {
        store.object[index].matrixWorldAutoUpdate = false;
        store.cullingObject[index].matrixWorldAutoUpdate = false;
      }
    },
    dispose,
  };

  function appendRigidGeometry(pool, source) {
    const firstVertex = pool.vertexCursor;
    source.faces.forEach((face, faceIndex) => {
      for (let corner = 0; corner < 3; corner++) {
        const position = source.positions[face.positionIndices[corner]];
        const texcoord = source.texcoords[face.texcoordIndices[corner]];
        const normal = source.normals[texcoord.normalIndex];
        const vertex = firstVertex + faceIndex * 3 + corner;
        const positionOffset = vertex * 3;
        pool.positions[positionOffset] = position[0];
        pool.positions[positionOffset + 1] = position[1];
        pool.positions[positionOffset + 2] = position[2];
        pool.normals[positionOffset] = normal[0];
        pool.normals[positionOffset + 1] = normal[1];
        pool.normals[positionOffset + 2] = normal[2];
        const uvOffset = vertex * 2;
        pool.uvs[uvOffset] = texcoord.u;
        pool.uvs[uvOffset + 1] = texcoord.v;
      }
    });
    const vertexCount = source.faces.length * 3;
    pool.vertexCursor += vertexCount;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", pool.positionAttribute);
    geometry.setAttribute("normal", pool.normalAttribute);
    geometry.setAttribute("uv", pool.uvAttribute);
    geometry.boundingSphere = pool.sphere;
    geometry.setDrawRange(firstVertex, vertexCount);
    pool.views.push(geometry);
    return geometry;
  }

  function appendTriangleGeometry(pool, vertexData, strip, label) {
    if (!vertexData.positions)
      throw new Error(`${label} TimeAttack geometry channel：position=${!!vertexData.positions} normal=${!!vertexData.normals} uvSets=${vertexData.uvSetsPerVertex}。`);
    const firstVertex = pool.vertexCursor;
    pool.positions.set(vertexData.positions.flat(), firstVertex * 3);
    if (vertexData.normals) pool.normals.set(vertexData.normals.flat(), firstVertex * 3);
    pool.uvs.set(vertexData.uvSetsPerVertex === 0
      ? new Float32Array(vertexData.vertexCount * 2)
      : vertexData.uvs.flatMap(sets => sets[0]), firstVertex * 2);
    pool.colors.set(vertexData.diffuseColors?.flatMap(floatColor) ??
      Array.from({ length: vertexData.vertexCount }, () => [1, 1, 1, 1]).flat(),
    firstVertex * 4);
    const indices = strip ? stripIndices(vertexData.indices) : [...vertexData.indices];
    const firstIndex = pool.indexCursor;
    for (let index = 0; index < indices.length; index++)
      pool.indices[firstIndex + index] = indices[index] + firstVertex;
    pool.vertexCursor += vertexData.vertexCount;
    pool.indexCursor += indices.length;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", pool.positionAttribute);
    geometry.setAttribute("normal", pool.normalAttribute);
    geometry.setAttribute("uv", pool.uvAttribute);
    geometry.setAttribute("primaryColor", pool.colorAttribute);
    geometry.setIndex(pool.indexAttribute);
    geometry.boundingSphere = pool.sphere;
    geometry.setDrawRange(firstIndex, indices.length);
    pool.views.push(geometry);
    return geometry;
  }

  function syncCameraMode(camera) {
    if (options.cameraCentered && camera) object.position.copy(camera.position);
    const cameraPresent = !!camera;
    if (manualWorldMatrices === cameraPresent) return false;
    manualWorldMatrices = cameraPresent;
    object.matrixWorldAutoUpdate = !manualWorldMatrices;
    for (let index = 0; index < store.count; index++) {
      store.object[index].matrixWorldAutoUpdate = !manualWorldMatrices;
      store.cullingObject[index].matrixWorldAutoUpdate = !manualWorldMatrices;
    }
    return true;
  }

  function updateWorldMatrices(time, camera) {
    incrementFrameSerial();
    const cameraModeChanged = syncCameraMode(camera);
    object.updateWorldMatrix(true, false);
    if (manualWorldMatrices)
      object.matrixWorld.multiplyMatrices(object.parent ? object.parent.matrixWorld : identity,
        object.matrix);
    const rootMoved = !previousRootWorld.equals(object.matrixWorld);
    previousRootWorld.copy(object.matrixWorld);
    let cameraAxes;
    if (camera) {
      camera.updateWorldMatrix(true, false);
      cameraRelative.copy(object.matrixWorld).invert().multiply(camera.matrixWorld);
      cameraAxes = readCameraPose(cameraPose, cameraRelative);
    }
    updateNodeWorld(store, identity, object.matrixWorld, cameraAxes, time,
      !camera || rootMoved || cameraModeChanged);
    cameraBasis = cameraAxes;
  }

  function updateVisibleNodes(camera) {
    if (!camera) {
      collectVisible(store);
      updateNoCameraCulling(store);
      return;
    }
    if (!(camera instanceof PerspectiveCamera))
      throw new Error("P3528 scene hierarchy culling 需要 perspective camera。");
    if (blackPlaneMask) {
      collectVisible(store);
      const elements = camera.matrixWorld.elements;
      cullBlackPlanes(store, blackPlanes,
        [elements[12], elements[13], elements[14]], blackPlaneMask,
        object.matrixWorld);
    }
    updateCulling(store, camera, blackPlaneMask);
  }

  async function buildNode(node, parentWorld, inheritedAnimation) {
    if (node.serializedBoundsOverride !== 0)
      throw new Error(`${node.name || node.className} 的 serialized bounds override 尚未映射。`);
    const poseOverride = options.rootPoseOverrides?.get(node);
    const local = poseOverride ? poseOverrideMatrix(poseOverride) : localNodeMatrix(node);
    const visibility = node.slotOccurrences[0]
      ? sceneVisibility(node.slotOccurrences[0].value) : undefined;
    const prs = prsController(node);
    const animated = !!prs || node.className === "ReBillboard" || visibility !== undefined;
    const clientWorld = parentWorld.clone().multiply(local);
    const candidate = candidateByNode.get(node);
    const index = records.length;
    const materialCount = materialEntries.length;
    const morphCount = morphControllers.length;
    const nodeObject = candidate
      ? await buildMesh(candidate, clientWorld, index) : new Group();
    const materialEntry = materialEntries.length > materialCount
      ? materialEntries[materialCount] : undefined;
    const morphController = morphControllers.length > morphCount
      ? morphControllers[morphCount] : undefined;
    nodeObject.name = node.name;
    nodeObject.matrix.copy(local);
    nodeObject.matrixAutoUpdate = false;
    nodeObject.visible = node.nodeEnabled !== 0;
    const cullingObject = new Group();
    cullingObject.name = `${node.name || node.className}:P3528Cull`;
    cullingObject.matrixAutoUpdate = false;
    cullingObject.add(nodeObject);
    const record = {
      source: node, object: nodeObject, cullingObject,
      bounds: node.bounds0, cullingTraversalMode: node.cullingTraversalMode,
      serializedLocal: local,
      prsFallback: poseOverride ? readPoseOverrideFallback(poseOverride)
        : { position: node.position, basis: node.transform, scale: node.scale },
      needsClientWorldInverse: candidate?.geometryKind === "toon-rigid",
      animatedTransform: !!prs || node.className === "ReBillboard",
      animatedDescendants: false,
      enabled: node.nodeEnabled !== 0,
      initialClientWorld: clientWorld.elements,
      visibility, prs, prsRuntime: prs ? makePrsRuntime() : undefined,
      onCollect: materialEntry?.needsUpdate
        ? () => updateMaterialEntry(materialEntry, frameTime) : undefined,
      onVisible: morphController ? () => morphController.update(frameTime) : undefined,
    };
    records.push(record);
    for (const child of node.children) {
      const childIndex = await buildNode(child, clientWorld, inheritedAnimation || animated);
      const childRecord = records[childIndex];
      record.animatedDescendants ||= childRecord.animatedTransform ||
        childRecord.animatedDescendants;
      nodeObject.add(childRecord.cullingObject);
    }
    return index;
  }

  async function buildMesh(candidate, clientWorld, nodeIndex) {
    const textureState = candidate.state.texture.value;
    const resolution = resolveTexture(textureState);
    if (resolution.status === "unresolved")
      throw new Error(`${candidate.node.name || candidate.node.className} texture ${textureState.name}：${resolution.reason}`);
    let texture;
    if (resolution.status === "found") {
      const cacheKey = [resolution.entry.virtualPath, textureState.addressU,
        textureState.addressV, textureState.minFilter, textureState.magFilter,
        textureState.mipFilter, textureState.maxAnisotropy].join("|");
      texture = textureCache.get(cacheKey);
      if (!texture) {
        texture = await loadTexture(resolution.entry, textureState);
        textureCache.set(cacheKey, texture);
      }
    }
    const toon = candidate.geometryKind === "toon-rigid";
    if (toon) texture = inheritToonTexture(candidate, texture, lastOpaqueToonTexture);
    if (texture && candidate.state.alpha.value.blendEnable === 0)
      lastOpaqueToonTexture = { texture, state: textureState };
    const inverted = clientWorld.determinant() < 0;
    let material;
    if (toon) {
      material = createToonMaterial(texture, { kind: "normal-projection" });
      applyMaterialProperties(material, candidate.state);
    } else {
      const key = JSON.stringify({ texture: texture ? texture.uuid : null,
        inverted, textureState, alpha: candidate.state.alpha.value,
        fogSelector: candidate.state.fog.value.selector,
        material: candidate.state.material.value,
        zbuffer: candidate.state.zbuffer.value,
        backface: candidate.state.backface.value });
      material = basicMaterialCache.get(key);
      if (!material) {
        material = createBasicMaterial(texture ?? null, candidate.state, inverted);
        basicMaterialCache.set(key, material);
      }
    }
    material.userData.toon = toon;
    const textureControllers = createTextureControllers(
      textureState.uvControllers, textureState.alphaController, textureState.scalar);
    const colorControllers = candidate.state.material.value.mode === 2
      ? candidate.state.material.value.controllers.map(parsed =>
        parsed ? ColorController.fromParsed(parsed) : undefined) : undefined;
    const materialColors = colorControllers ? [
      candidate.state.material.value.ambient,
      candidate.state.material.value.diffuse,
      candidate.state.material.value.specular,
      candidate.state.material.value.emissive,
    ] : undefined;
    const needsUpdate = textureControllers.uvControllers !== undefined ||
      textureControllers.alphaController !== undefined ||
      colorControllers?.some(controller => controller !== undefined) === true;
    if (!toon)
      initializeMaterialUniforms(material,
        { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 },
        false, textureControllers.currentAlpha);
    materialEntries.push({ state: textureControllers, material, toon,
      materialControllers: colorControllers, materialColors, needsUpdate });
    (toon ? toonMaterials : basicMaterials).add(material);

    let geometry;
    if (toon) geometry = appendRigidGeometry(rigidPool, candidate.node.rigidGeometry);
    else if (isMorphGeometry(candidate))
      geometry = makeMorphGeometry(candidate.node.vertexData,
        candidate.geometryKind === "tri-strip",
        candidate.node.name || candidate.node.className);
    else geometry = appendTriangleGeometry(trianglePool, candidate.node.vertexData,
      candidate.geometryKind === "tri-strip", candidate.node.name || candidate.node.className);
    geometries.add(geometry);
    const property = candidate.node.vertexData?.property;
    if (property && typeof property === "object" && property.kind === "morph-controller")
      morphControllers.push(MorphController.fromParsed(property, geometry));
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.userData.batchKind = toon ? "toon" : isMorphGeometry(candidate) ? "morph"
      : candidate.state.alpha.value.blendEnable !== 0 ? "blend"
        : candidate.node.slotOccurrences[0] ? "visibility"
          : prsController(candidate.node) || candidate.node.className === "ReBillboard"
            ? "animated" : "static";
    if (candidate.node.sortDepthBias === undefined)
      throw new Error(`${candidate.node.name || candidate.node.className} 缺少 sortDepthBias。`);
    configureRenderOrder(mesh, candidate.node.sortDepthBias, material.transparent,
      material.transparent ? -0.01 : 0);
    mesh.renderOrder = 0;
    mesh.onBeforeRender = (renderer, scene, camera) => {
      bindTexture(texture, renderer);
      if (toon) {
        const viewer = new Vector3(camera.position.x, -camera.position.z,
          camera.position.y);
        const world = new Matrix4();
        const inverse = new Matrix4();
        store.readClientWorld(nodeIndex, world);
        store.readClientWorldInverse(nodeIndex, inverse);
        configureToonUniforms(material, environment, stageBinding,
          world, inverse, viewer);
      }
    };
    if (!toon) return mesh;
    if (!candidate.node.rigidGeometry)
      throw new Error(`${candidate.node.name || candidate.node.className} outline 缺少 Toon face adjacency。`);
    const drawOutline = candidate.state.toon.value.flags[1] !== 0;
    const outline = new OutlineController(candidate.node.rigidGeometry,
      candidate.state.toon.value.words[7], candidate.state.toon.value.words[8],
      drawOutline);
    outlines.push({ outline, body: mesh });
    if (!drawOutline) return mesh;
    outline.object.frustumCulled = false;
    configureRenderOrder(outline.object, candidate.node.sortDepthBias, true);
    const group = new Group();
    group.add(mesh, outline.object);
    return group;
  }

  function dispose() {
    geometries.forEach(geometry => geometry.dispose());
    toonMaterials.forEach(material => material.dispose());
    basicMaterials.forEach(material => material.dispose());
    outlines.forEach(({ outline }) => outline.dispose());
    if (ownsTextureCache) textureCache.forEach(texture => texture.dispose());
    if (ownsEnvironment) environment.dispose();
  }
}
