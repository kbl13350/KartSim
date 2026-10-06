/** Scene attachment and release of a replay Ghost's visual resources. */

import type { Vec3Like } from "./ghost-visual-motion";

interface SceneNode {
  add(child: unknown): void;
  clear(): void;
  removeFromParent?(): void;
}

interface Disposable {
  dispose(): void;
}

export interface GhostVisualLifecycleHost {
  root: SceneNode & {
    position: { set(x: number, y: number, z: number): void };
    quaternion: { setFromRotationMatrix(matrix: unknown): void };
    removeFromParent(): void;
  };
  modelMount: SceneNode;
  basisRight: { set(x: number, y: number, z: number): void };
  basisUp: { set(x: number, y: number, z: number): void };
  basisForward: { set(x: number, y: number, z: number): void };
  orientationMatrix: { makeBasis(right: unknown, up: unknown,
    forward: unknown): void };
  effects?: Disposable;
  trails?: Disposable & { object: unknown };
  trailVehicle?: unknown;
  trailState: number;
  balloon?: Disposable;
  accessories: Array<{ render: Disposable }>;
  attachmentNodes: unknown[];
  imported?: { renderScene?: Disposable; object: unknown };
  character?: Disposable;
  linkedPresentation?: unknown;
  animation?: unknown;
  visual?: unknown;
}

export function seedGhostVisualStart(host: GhostVisualLifecycleHost,
  position: Vec3Like, right: Vec3Like, forward: Vec3Like,
  up: Vec3Like): void {
  host.root.position.set(position.x, position.y, position.z);
  host.basisRight.set(right.x, right.y, right.z);
  host.basisUp.set(up.x, up.y, up.z);
  host.basisForward.set(forward.x, forward.y, forward.z);
  host.orientationMatrix.makeBasis(
    host.basisRight, host.basisUp, host.basisForward);
  host.root.quaternion.setFromRotationMatrix(host.orientationMatrix);
}

export function setGhostVisualEffects(host: GhostVisualLifecycleHost,
  effects: Disposable): void {
  host.effects = effects;
}

export function setGhostVisualTrails(host: GhostVisualLifecycleHost,
  trails: Disposable & { object: unknown }, vehicle: unknown): void {
  host.trails = trails;
  host.trailVehicle = vehicle;
  host.trailState = 0;
}

export function attachGhostVisualToScene(host: GhostVisualLifecycleHost,
  scene: SceneNode): void {
  scene.add(host.root);
  if (host.trails) scene.add(host.trails.object);
}

export function disposeGhostVisual(host: GhostVisualLifecycleHost,
  releaseObject: (object: unknown) => void): void {
  host.balloon?.dispose();
  host.balloon = undefined;
  host.accessories.forEach(({ render }) => render.dispose());
  host.accessories = [];
  host.attachmentNodes = [];
  host.effects?.dispose();
  host.effects = undefined;
  host.trails?.dispose();
  host.trails = undefined;
  if (host.imported) {
    host.imported.renderScene?.dispose();
    releaseObject(host.imported.object);
    host.imported = undefined;
  }
  host.character?.dispose();
  host.character = undefined;
  host.linkedPresentation = undefined;
  host.animation = undefined;
  host.visual = undefined;
  host.modelMount.clear();
  host.root.removeFromParent();
}
