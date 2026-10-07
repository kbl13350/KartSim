import { Group, Matrix4, type Object3D } from "three";

interface PoseVector { x: number; y: number; z: number }
export interface KartPose {
  x: number; y: number; z: number;
  right: PoseVector; up: PoseVector; forward: PoseVector;
  visualScale: PoseVector;
}

export interface KartVisualConfig {
  attachments: string[];
  isTransformAutoCharge: boolean;
  autoChargeLowSpeed: number;
  transformTime: number;
}

export interface KartAnimation {
  state: number;
  reset(time: number): void;
  updateCurrentState(time: number): unknown;
  enterDualUse(): void;
  update(time: number, charging: boolean, transformTime: number,
    dualMode: unknown, physicsState: number): unknown;
}

export interface WheelPresentation {
  reset(): void;
  update(pose: KartPose, time: number, animationState: number): void;
}

export interface KartPresentationDependencies {
  makeWheelPresentation(resource: unknown, nodes: unknown,
    visual: KartVisualConfig): WheelPresentation;
  makeBalloon(resource: unknown, nodes: unknown): Object3D;
  disposeObject(object: Object3D): void;
}

interface AssetNodeMap { nodes: Map<string, { object: Object3D }> }

/**
 * Converts physics coordinates into the imported kart model's matrix basis
 * and owns animation, wheel and attachment presentation for the local kart.
 */
export class KartPresentationView {
  root = new Group();
  modelMount = new Group();
  affectBasis = new Matrix4();
  presentationMatrix = new Matrix4();
  presentationState?: KartPose;
  importedModel?: Object3D;
  visualConfig?: KartVisualConfig;
  animation?: KartAnimation;
  wheelPresentation?: WheelPresentation;
  attachmentNodes: Array<Object3D | undefined> = [];

  constructor(scene: Object3D, private readonly dependencies: KartPresentationDependencies) {
    this.root.name = "player-kart";
    this.modelMount.name = "imported-kart-mount";
    this.root.matrixAutoUpdate = false;
    this.root.matrixWorld = new Matrix4().copy(this.root.matrixWorld);
    this.modelMount.matrixAutoUpdate = false;
    this.modelMount.matrixWorldAutoUpdate = false;
    this.modelMount.matrixWorld = new Matrix4().copy(this.modelMount.matrixWorld);
    this.root.add(this.modelMount);
    scene.add(this.root);
  }

  setModel(model: Object3D, visual: KartVisualConfig,
    animation: KartAnimation | undefined, resource?: unknown,
    assetNodes?: AssetNodeMap): void {
    const wheels = resource && assetNodes
      ? this.dependencies.makeWheelPresentation(resource, assetNodes, visual)
      : undefined;
    const attachments = visual.attachments.map(name =>
      assetNodes?.nodes.get(name)?.object);
    if (!attachments[16] && visual.attachments[16] === "balloon" &&
      resource && assetNodes) {
      attachments[16] = this.dependencies.makeBalloon(resource, assetNodes);
    }
    this.clearImportedModel();
    this.importedModel = model;
    this.visualConfig = visual;
    this.animation = animation;
    this.wheelPresentation = wheels;
    this.attachmentNodes = attachments;
    this.modelMount.add(model);
  }

  clearModel(): void { this.clearImportedModel(); }

  resetAnimation(): void {
    this.animation?.reset(0);
    this.wheelPresentation?.reset();
    this.setLocalAffectBasis();
  }

  setLocalAffectBasis(matrix?: Matrix4): void {
    if (matrix) {
      const values = matrix.elements;
      this.affectBasis.set(
        values[0]!, -values[8]!, values[4]!, 0,
        -values[2]!, values[10]!, -values[6]!, 0,
        values[1]!, -values[9]!, values[5]!, 0,
        0, 0, 0, 1,
      );
    } else {
      this.affectBasis.identity();
    }
    if (this.presentationState) {
      this.updatePresentationTransform(this.presentationState);
    }
  }

  getAttachment(index: number): Object3D | undefined {
    return this.attachmentNodes[index];
  }
  getVisualConfig(): KartVisualConfig | undefined { return this.visualConfig; }
  presentationRoot(): Group { return this.modelMount; }

  update(pose: KartPose, time: number, driving?: {
    displaySpeedKmh: number; physicsState: number; dualMode: unknown;
  }): unknown {
    this.updatePose(pose);
    this.presentationState = pose;
    const previousAnimationState = this.animation?.state ?? 0;
    const animationResult = driving
      ? this.updateAnimation(time, driving)
      : this.animation?.updateCurrentState(time);
    if (this.wheelPresentation) {
      this.wheelPresentation.update(pose, time >>> 0, previousAnimationState);
    }
    return animationResult;
  }

  updatePose(pose: KartPose): void {
    this.root.matrix.set(
      pose.right.x, pose.up.x, pose.forward.x, pose.x,
      pose.right.y, pose.up.y, pose.forward.y, pose.y,
      pose.right.z, pose.up.z, pose.forward.z, pose.z,
      0, 0, 0, 1,
    );
    this.root.matrixWorldNeedsUpdate = true;
    this.updatePresentationTransform(pose);
  }

  updateRemote(pose: KartPose, time: number, driving: {
    displaySpeedKmh: number; physicsState: number; dualMode: unknown;
  }): unknown {
    this.updatePose(pose);
    this.presentationState = pose;
    return this.updateAnimation(time, driving);
  }

  enterDualUse(): number | undefined {
    this.animation?.enterDualUse();
    return this.animation?.state;
  }

  updateAnimation(time: number, driving: {
    displaySpeedKmh: number; physicsState: number; dualMode: unknown;
  }): unknown {
    if (!this.animation || !this.visualConfig) return;
    const charging =
      (this.visualConfig.isTransformAutoCharge &&
        driving.displaySpeedKmh > this.visualConfig.autoChargeLowSpeed) ||
      (driving.physicsState > 2 && driving.physicsState < 12);
    return this.animation.update(
      time >>> 0, charging, this.visualConfig.transformTime,
      driving.dualMode, driving.physicsState,
    );
  }

  dispose(): void {
    this.clearImportedModel();
    this.root.removeFromParent();
  }

  releaseBorrowedModel(): void {
    this.clearImportedModel(false);
    this.root.removeFromParent();
  }

  updatePresentationTransform(pose: KartPose): void {
    const basis = this.presentationMatrix.set(
      pose.right.x, -pose.forward.x, pose.up.x, 0,
      -pose.right.z, pose.forward.z, -pose.up.z, 0,
      pose.right.y, -pose.forward.y, pose.up.y, 0,
      0, 0, 0, 1,
    ).multiply(this.affectBasis).elements;
    const { x, y, z } = pose.visualScale;
    const f32 = Math.fround;
    this.modelMount.matrixWorld.set(
      f32(basis[0]! * x), f32(basis[8]! * y), -f32(basis[4]! * z), pose.x,
      f32(basis[2]! * x), f32(basis[10]! * y), -f32(basis[6]! * z), pose.y,
      -f32(basis[1]! * x), -f32(basis[9]! * y), f32(basis[5]! * z), pose.z,
      0, 0, 0, 1,
    );
    this.modelMount.matrixWorldNeedsUpdate = true;
  }

  clearImportedModel(dispose = true): void {
    if (!this.importedModel) return;
    this.importedModel.removeFromParent();
    if (dispose) this.dependencies.disposeObject(this.importedModel);
    this.importedModel = undefined;
    this.visualConfig = undefined;
    this.animation = undefined;
    this.wheelPresentation = undefined;
    this.attachmentNodes = [];
    if (!dispose) this.presentationState = undefined;
    this.setLocalAffectBasis();
  }
}
