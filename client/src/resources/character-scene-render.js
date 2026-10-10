import { Group, Matrix4, Mesh, PerspectiveCamera, Vector3 } from "three";

/** Build and animate a character model, face textures, skin and Toon outlines. */
export async function buildCharacterScene(model, bodyBytes, faceSources,
  animation, environment, stageBinding, options = {}, dependencies) {
  const {
    loadBodyTexture, loadFaceTexture, orientClientGroup, orientNativeGroup,
    defaultProperties, inheritProperties, rigidGeometry, SkinnedGeometry,
    registerSkinCulling, collectBoneMatrices, applyTransform,
    isRenderableChild, makeToonMaterial, applyMaterialProperties,
    toonProperties, configureRenderOrder, OutlineController,
    cullHierarchy, isVisible, configureToonUniforms, poseMatrix,
  } = dependencies;
  const root = model.root.value;
  if (root.serializedBoundsOverride !== 0 || root.cullingTraversalMode !== 3)
    throw new Error("P3528 ReCharacter root bounds mode 不在已闭合模型集合。");

  const [bodyTexture, faceEntries] = await Promise.all([
    loadBodyTexture(bodyBytes, options),
    Promise.all([...faceSources].map(async ([name, source]) =>
      [name, await loadFaceTexture(name, source, options)])),
  ]);
  const faceTextures = new Map(faceEntries);
  const outlineBatch = options.outlineBatch;
  const faceTexture = name => faceTextures.get(name) ?? bodyTexture;
  const initialFaceTexture = faceTexture(animation.face());
  const scene = new Group();
  scene.name = "TimeAttackCharacter";
  if (options.convertClientCoordinates !== false) orientClientGroup(scene);
  else orientNativeGroup(scene);

  const materials = new Set();
  const faceMaterials = [];
  const geometries = new Set();
  const outlines = [];
  const meshes = [];
  const modelToClient = new Matrix4();
  const clientToModel = new Matrix4();
  const viewer = new Vector3();
  const skins = [];
  let currentPose;
  const defaults = defaultProperties();
  const rootAlpha = inheritProperties(root, defaults).alpha;
  const rootMaterialBindings = [];
  const characterObject = buildNode(model.root, defaults, false);
  const cullingObject = new Group();
  cullingObject.name = "ReCharacter:P3528Cull";
  cullingObject.add(characterObject);
  const cullingRecord = {
    cullingObject, sourceObject: characterObject, bounds: root.bounds0,
    cullingTraversalMode: root.cullingTraversalMode, children: [],
    enabled: root.nodeEnabled !== 0,
  };
  scene.add(cullingObject);
  const mainSkin = skins[0]?.skin;
  if (!mainSkin) throw new Error("ReCharacter 缺少主 ReToonSkinned body。");
  const attachments = [
    { object: characterObject.children[1], bone: 5,
      local: characterObject.children[1]?.matrix.clone() },
    { object: characterObject.children[2], bone: 5,
      local: characterObject.children[2]?.matrix.clone() },
    { object: characterObject.children[3], bone: 5 },
    { object: characterObject.children[4], bone: 9 },
    { object: characterObject.children[5], bone: 14 },
  ];

  return {
    object: scene,
    rootMaterialBindings,
    getDecorationOwner: () => characterObject,
    getDecorationSocket: (parentIndex, childIndex) =>
      characterObject.children[parentIndex]?.children[childIndex],
    update,
    reset: () => animation.reset(),
    dispose,
  };

  function buildNode(occurrence, parentProperties, isFace) {
    const node = occurrence.value;
    const properties = inheritProperties(node, parentProperties);
    const face = isFace || node.name === "face";
    let object;
    if (node.className === "ReToonRigid") {
      const geometry = rigidGeometry(node.geometry.value);
      geometries.add(geometry);
      object = buildMesh(geometry, node.geometry.value,
        face ? initialFaceTexture : bodyTexture,
        properties, node.sortDepthBias, face);
    } else if (node.className === "ReToonSkinned") {
      const skin = new SkinnedGeometry(node.geometry.value);
      geometries.add(skin.geometry);
      object = buildMesh(skin.geometry, skin.outlineSource, bodyTexture,
        properties, node.sortDepthBias, false);
      skins.push({ skin, object });
      registerSkinCulling(object, () => {
        if (currentPose) collectBoneMatrices(node.geometry.value, currentPose);
      });
    } else object = new Group();
    object.name = node.name;
    applyTransform(object, node.transform);
    object.visible = node.nodeEnabled !== 0;
    for (const child of node.children) {
      if (!isRenderableChild(child))
        throw new Error(`${node.name || node.className} child 不是 Relement。`);
      object.add(buildNode(child, properties, face));
    }
    return object;
  }

  function buildMesh(geometry, outlineSource, texture, properties,
    sortDepthBias, usesFaceTexture) {
    const material = makeToonMaterial(texture, { kind: "normal-projection" });
    applyMaterialProperties(material, toonProperties(properties.alpha, properties.zbuf));
    materials.add(material);
    if (usesFaceTexture) faceMaterials.push(material);
    const mesh = new Mesh(geometry, material);
    rootMaterialBindings.push({ mesh,
      inheritsRootAlpha: properties.alpha === rootAlpha });
    mesh.frustumCulled = false;
    configureRenderOrder(mesh, sortDepthBias, material.transparent,
      material.transparent ? -0.01 : 0);
    const outline = new OutlineController(outlineSource, 4278190080,
      2130706432, true, outlineBatch);
    outline.object.frustumCulled = false;
    configureRenderOrder(outline.object, sortDepthBias, true);
    const group = new Group();
    group.add(mesh, outline.object);
    outlines.push({ outline, mesh });
    meshes.push({ mesh, material });
    return group;
  }

  function update(time, camera, width, height, context) {
    const pose = animation.update(time, context);
    currentPose = pose;
    const activeFaceTexture = faceTexture(animation.face());
    for (const material of faceMaterials)
      material.uniforms.baseMap.value = activeFaceTexture;
    const boneMatrices = mainSkin.updatePose(pose);
    for (let index = 1; index < skins.length; index++)
      skins[index].skin.updatePose(pose);
    for (const { object, bone, local } of attachments) {
      if (!object) continue;
      const boneMatrix = poseMatrix(boneMatrices[bone]);
      object.matrix.copy(local ? boneMatrix.multiply(local) : boneMatrix);
    }
    if (!(camera instanceof PerspectiveCamera))
      throw new Error("P3528 ReCharacter hierarchy culling 需要 perspective camera。");
    scene.updateWorldMatrix(true, true);
    cullHierarchy([cullingRecord], camera);
    if (!isVisible(cullingObject)) {
      for (const { outline } of outlines) outline.dropFrame();
      return;
    }
    for (const { skin, object } of skins)
      if (isVisible(object)) skin.updateVertices();
    viewer.set(camera.position.x, -camera.position.z, camera.position.y);
    for (const { mesh, material } of meshes) {
      if (!isVisible(mesh)) continue;
      modelToClient.makeRotationX(Math.PI / 2).multiply(mesh.matrixWorld);
      clientToModel.copy(modelToClient).invert();
      configureToonUniforms(material, environment, stageBinding,
        modelToClient, clientToModel, viewer);
    }
    for (const { outline, mesh } of outlines)
      outline.update(mesh, camera, width, height);
  }

  function dispose() {
    scene.removeFromParent();
    outlines.forEach(({ outline }) => outline.dispose());
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    bodyTexture.dispose();
    faceTextures.forEach(texture => texture.dispose());
  }
}
