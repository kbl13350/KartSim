export interface FlyingPetModelDependencies {
  createGroup(): any;
  createSkin(source: any): any;
  registerSkinCulling(root: any, collect: () => void): void;
  applyTransform(root: any, transform: unknown): void;
  toonProperties(node: any, parent?: any): any;
  makeMaterial(texture: unknown, options: unknown): any;
  applyMaterial(material: any, properties: unknown): void;
  renderState(alpha: unknown, zBuffer: unknown): unknown;
  createMesh(geometry: any, material: any): any;
  configureRenderOrder(mesh: any, sortDepth: unknown, transparent: boolean,
    offset: number, root: any): void;
  createOutline(source: any, color: number, edgeColor: number, visible: boolean): any;
  createMatrix(): any;
  createVector(): any;
  updateEnvironment(material: any, texture: unknown, binding: unknown,
    world: any, inverse: any, position: any): void;
  rigidGeometry(source: any): any;
  isElement(node: any): boolean;
  collectBoneMatrices(source: any, pose: unknown): any[];
  composeBoneMatrix(pose: unknown, inverseBind: unknown): any;
  setTextureEnabled(material: any, disabled: boolean): void;
  headTransform(pose: unknown): any;
}

/** Native flying pet skeletons may use only supported, reserved bone matrices. */
export function validateFlyingPetSkeleton(geometry: any): void {
  const visit = (index: number): void => {
    const bone = geometry.bones[index];
    if (!bone) throw new Error("飞宠骨骼索引越界。");
    if (index !== 0 && bone.enabled) {
      if (bone.parentIndex >= index) throw new Error("飞宠骨骼父索引无效。");
      visit(bone.parentIndex);
    }
  };
  visit(5);
  for (const vertex of geometry.vertices) {
    for (const [index, active] of [
      [vertex.bone0, vertex.bone1 === 65535 || vertex.weight0 !== 0],
      [vertex.bone1, vertex.bone1 !== 65535 && vertex.weight1 !== 0],
    ] as [number, boolean][]) {
      if (active && (visit(index), !geometry.bones[index].reserved))
        throw new Error("此飞宠依赖原生保留蒙皮矩阵，暂不支持显示。");
    }
  }
}

/** Resolve the body texture and all faces referenced by the motion clips. */
export async function loadFlyingPetModelParts(clips: any[], skin: any): Promise<{
  body: unknown; faces: Map<unknown, unknown>;
}> {
  const body = await skin.body();
  const faces = new Map<unknown, unknown>();
  for (const faceId of new Set(clips.flatMap(clip => clip.map))) {
    const face = await skin.face(faceId);
    if (face) faces.set(faceId, face);
  }
  return { body, faces };
}

/** CPU skinned flying pet with independent face and outline render passes. */
export class FlyingPetModel {
  readonly object: any;
  headSocket: any;
  skin: any;
  skinSource: any;
  frame: any;
  readonly draws: { mesh: any; outline: any }[] = [];
  readonly materials: any[] = [];
  readonly rigid: any[] = [];
  readonly attachments: { object: any; local: any }[] = [];
  readonly faceMaterials: any[] = [];
  faces = new Map<unknown, unknown>();
  head: any;
  disposed = false;

  constructor(
    model: any, bodyTexture: unknown, faceTextures: Map<unknown, unknown>,
    environment: unknown, binding: unknown,
    readonly dependencies: FlyingPetModelDependencies,
  ) {
    const ops = dependencies;
    this.object = ops.createGroup();
    const root = model.root.value;
    if (root.className !== "RePet2") throw new Error("飞宠模型不是 RePet2。");
    const skinNode = root.children[0]?.value;
    if (skinNode?.className !== "ReToonSkinned") throw new Error("飞宠主蒙皮缺失。");
    validateFlyingPetSkeleton(skinNode.geometry.value);
    this.skinSource = skinNode.geometry.value;
    this.skin = ops.createSkin(this.skinSource);
    ops.registerSkinCulling(this.object, () => this.collect());
    try {
      this.faces = faceTextures;
      this.object.name = "FlyingPet:RePet2";
      ops.applyTransform(this.object, root.transform);
      const rootProperties = ops.toonProperties(root);

      const draw = (geometry: any, outlineSource: any, node: any,
        texture: unknown, faceMaterial: boolean, outlineVisible = true) => {
        const material = ops.makeMaterial(texture, { kind: "normal-projection" });
        const properties = ops.toonProperties(node, rootProperties);
        ops.applyMaterial(material, ops.renderState(properties.alpha, properties.zbuf));
        this.materials.push(material);
        if (faceMaterial) this.faceMaterials.push(material);
        const mesh = ops.createMesh(geometry, material);
        mesh.frustumCulled = false;
        ops.configureRenderOrder(mesh, root.sortDepthBias, material.transparent,
          material.transparent ? -0.01 : 0, this.object);
        const outline = ops.createOutline(outlineSource, 4278190080, 2130706432, outlineVisible);
        outline.object.visible = outlineVisible;
        ops.configureRenderOrder(outline.object, root.sortDepthBias, true, 0, this.object);
        const group = ops.createGroup();
        group.add(mesh, outline.object);
        ops.applyTransform(group, node.transform);
        group.visible = node.nodeEnabled !== 0;
        this.draws.push({ mesh, outline });

        const world = ops.createMatrix();
        const inverse = ops.createMatrix();
        const rotation = ops.createMatrix().makeRotationX(Math.PI / 2);
        const position = ops.createVector();
        mesh.onBeforeRender = (_renderer: unknown, _scene: unknown, camera: any) => {
          world.copy(rotation).multiply(mesh.matrixWorld);
          camera.getWorldPosition(position);
          position.set(position.x, -position.z, position.y);
          inverse.copy(world).invert();
          ops.updateEnvironment(material, environment, binding, world, inverse, position);
        };
        return group;
      };

      const body = draw(this.skin.geometry, this.skin.outlineSource,
        skinNode, bodyTexture, false);
      body.matrix.identity();
      this.object.add(body);
      for (const index of [1, 2]) {
        const parent = root.children[index]?.value;
        if (!parent || !("children" in parent)) continue;
        const node = parent.children[0]?.value;
        if (!node && index === 2) continue;
        if (!node || node.className !== "ReToonRigid")
          throw new Error("飞宠刚性附件结构不支持。");
        const geometry = ops.rigidGeometry(node.geometry.value);
        this.rigid.push(geometry);
        const attachment = draw(geometry, node.geometry.value, node,
          index === 1 ? (faceTextures.values().next().value ?? bodyTexture) : bodyTexture,
          index === 1, index !== 2);
        this.attachments.push({ object: attachment, local: attachment.matrix.clone() });
        this.object.add(attachment);
      }
      const headNode = root.children[3];
      if (headNode) {
        if (!ops.isElement(headNode) || headNode.value.name !== "head")
          throw new Error("飞宠头部挂点结构不支持。");
        const buildHead = (node: any): any => {
          if (node.className !== "Relement")
            throw new Error("飞宠头部包含未支持的几何。");
          const group = ops.createGroup();
          ops.applyTransform(group, node.transform);
          for (const child of node.children) {
            if (!ops.isElement(child)) throw new Error("飞宠头部子节点不是 Relement。");
            group.add(buildHead(child.value));
          }
          return group;
        };
        this.head = buildHead(headNode.value);
        this.headSocket = this.head.children[0];
        this.object.add(this.head);
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  update(animation: any, camera: unknown, width: number, height: number, now: number): void {
    this.frame = { animation, camera, width, height, now };
  }

  collect(): void {
    if (this.disposed || !this.frame) return;
    const { animation, camera, width, height, now } = this.frame;
    animation.update(now);
    const bones = this.dependencies.collectBoneMatrices(this.skinSource, animation.pose);
    this.skin.applyPalette(this.skinSource.bones.map((bone: any, index: number) =>
      this.dependencies.composeBoneMatrix(bones[index], bone.inverseBind)));
    const face = this.faces.get(animation.sequence.map[animation.faceSlot]);
    for (const material of this.faceMaterials) {
      this.dependencies.setTextureEnabled(material, !face);
      if (face) {
        material.uniforms.baseMap.value = face;
        material.uniforms.uvControllerEnabled.value = 0;
      }
    }
    const headMatrix = this.dependencies.headTransform(bones[5]);
    for (const attachment of this.attachments)
      attachment.object.matrix.copy(headMatrix).multiply(attachment.local);
    this.head?.matrix.copy(headMatrix);
    this.object.updateWorldMatrix(true, true);
    for (const { mesh, outline } of this.draws)
      outline.update(mesh, camera, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.skin.geometry.dispose();
    this.rigid.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.draws.forEach(({ outline }) => outline.dispose());
  }
}
