import { Matrix4, type PerspectiveCamera } from "three";

export interface CameraPose {
  position: [number, number, number];
  basis: [[number, number, number], [number, number, number], [number, number, number]];
  scale: [number, number, number];
}

export interface ReadyCameraData {
  projectionMode: number;
  fieldOfViewController?: unknown;
  nearClipController?: unknown;
  farClipController?: unknown;
  fieldOfViewDegrees: number;
  nearClip: number;
  farClip: number;
}

export interface ReadyNode {
  position: CameraPose["position"];
  transform: CameraPose["basis"];
  scale: CameraPose["scale"];
  kind?: string;
  className: string;
  name?: string;
  children: ReadyNode[];
  slotOccurrences: { value: unknown }[];
  camera?: ReadyCameraData;
}

export interface ReadyCameraModel {
  root: ReadyNode & { kind: string };
}

export interface ReadyCameraRuntime {
  anchor: number;
  previousCycle: number;
  reverseHalf: boolean;
  [key: string]: unknown;
}

export interface ReadyPathEntry {
  source: ReadyNode;
  controller: unknown;
  runtime?: ReadyCameraRuntime;
}

export interface ReadyCameraOps {
  isPrsController(value: unknown): boolean;
  unsupportedPrs(controller: unknown): string | undefined;
  createPrsRuntime(): ReadyCameraRuntime;
  animatePrs(controller: unknown, runtime: ReadyCameraRuntime, timeMs: number, pose: CameraPose): CameraPose;
  fieldOfView(degrees: number, aspect: number): number;
}

export interface ReadyPlayerFrame {
  position: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
}

/** The first ReCamera path and its PRS controllers in a readyCamera.1s model. */
export function findReadyCameraPath(root: ReadyNode, ops: ReadyCameraOps): ReadyPathEntry[] | undefined {
  const visit = (node: ReadyNode, ancestors: ReadyPathEntry[]): ReadyPathEntry[] | undefined => {
    const controller = prsController(node, ops);
    if (controller) {
      const unsupported = ops.unsupportedPrs(controller);
      if (unsupported) throw new Error(`${node.name || node.className} Ready PRS: ${unsupported}`);
    }
    const entry: ReadyPathEntry = {
      source: node,
      controller,
      runtime: controller ? ops.createPrsRuntime() : undefined,
    };
    const path = [...ancestors, entry];
    if (node.className === "ReCamera") return path;
    for (const child of node.children) {
      const result = visit(child, path);
      if (result) return result;
    }
  };
  return visit(root, []);
}

export function prsController(node: ReadyNode, ops: ReadyCameraOps): unknown {
  const value = node.slotOccurrences[1]?.value;
  return ops.isPrsController(value) ? value : undefined;
}

/** Convert PRS row vectors into a Three.js matrix, preserving the release's element order. */
export function matrixFromPose({ basis, position, scale }: CameraPose): Matrix4 {
  return new Matrix4().set(
    basis[0][0] * scale[0], basis[0][1] * scale[1], basis[0][2] * scale[2], position[0],
    basis[1][0] * scale[0], basis[1][1] * scale[1], basis[1][2] * scale[2], position[1],
    basis[2][0] * scale[0], basis[2][1] * scale[1], basis[2][2] * scale[2], position[2],
    0, 0, 0, 1,
  );
}

function clientBasis(vector: { x: number; y: number; z: number }) {
  return { x: vector.x, y: -vector.z, z: vector.y };
}

function gameBasis(vector: { x: number; y: number; z: number }) {
  return { x: vector.x, y: vector.z, z: -vector.y };
}

/** Build the client-world transform from the player's game-coordinate frame. */
export function matrixFromPlayerFrame(frame: ReadyPlayerFrame): Matrix4 {
  const position = clientBasis(frame.position);
  const right = clientBasis(frame.right);
  const forward = clientBasis(frame.forward);
  const up = clientBasis(frame.up);
  const view = { x: -forward.x, y: -forward.y, z: -forward.z };
  return new Matrix4().set(
    right.x, view.x, up.x, position.x,
    right.y, view.y, up.y, position.y,
    right.z, view.z, up.z, position.z,
    0, 0, 0, 1,
  );
}

/** Apply a live model matrix to a Three.js perspective camera. */
export function applyReadyCameraMatrix(camera: PerspectiveCamera, elements: ArrayLike<number>,
  source: ReadyCameraData, fieldOfView: ReadyCameraOps["fieldOfView"]): void {
  camera.matrixAutoUpdate = true;
  const position = gameBasis({ x: elements[12]!, y: elements[13]!, z: elements[14]! });
  const forward = gameBasis({ x: elements[4]!, y: elements[5]!, z: elements[6]! });
  const up = gameBasis({ x: elements[8]!, y: elements[9]!, z: elements[10]! });
  camera.position.set(position.x, position.y, position.z);
  camera.up.set(up.x, up.y, up.z);
  camera.lookAt(position.x - forward.x, position.y - forward.y, position.z - forward.z);
  camera.fov = fieldOfView(source.fieldOfViewDegrees, camera.aspect);
  camera.near = source.nearClip;
  camera.far = source.farClip;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/** Animated start-grid camera from readyCamera.1s. */
export class ReadyCameraController {
  path: ReadyPathEntry[];

  constructor(model: ReadyCameraModel, private readonly ops: ReadyCameraOps) {
    if (model.root.kind !== "node") throw new Error("readyCamera.1s 根对象不是 Relement。");
    const path = findReadyCameraPath(model.root, ops);
    if (!path) throw new Error("readyCamera.1s 不含 ReCamera。");
    const camera = path.at(-1)!.source.camera;
    if (!camera || camera.projectionMode !== 0)
      throw new Error("Ready ReCamera 不是已证 perspective mode 0。");
    if (camera.fieldOfViewController || camera.nearClipController || camera.farClipController)
      throw new Error("Ready ReCamera projection controller 尚未映射。");
    this.path = path;
  }

  start(): void {
    for (const { runtime } of this.path) {
      if (runtime) {
        runtime.anchor = 0;
        runtime.previousCycle = 0;
        runtime.reverseHalf = false;
      }
    }
  }

  apply(camera: PerspectiveCamera, timeMs: number, player: ReadyPlayerFrame): void {
    const now = Math.trunc(timeMs) >>> 0;
    const world = new Matrix4().identity();
    for (const { source, controller, runtime } of this.path) {
      const staticPose: CameraPose = {
        position: source.position, basis: source.transform, scale: source.scale,
      };
      const pose = controller && runtime
        ? this.ops.animatePrs(controller, runtime, now, staticPose) : staticPose;
      world.multiply(matrixFromPose(pose));
    }
    const cameraData = this.path.at(-1)!.source.camera!;
    const clientWorld = matrixFromPlayerFrame(player).multiply(world);
    applyReadyCameraMatrix(camera, clientWorld.elements, cameraData, this.ops.fieldOfView);
  }
}

export interface WarpCameraModel {
  root: { kind: string; scene: ReadyNode };
}
export interface WarpCameraOps {
  clientWorldElements?(node: ReadyNode): ArrayLike<number> | undefined;
  fieldOfView: ReadyCameraOps["fieldOfView"];
}

export function findNamedCamera(node: ReadyNode, name: string): ReadyNode | undefined {
  if (node.name === name) return node;
  for (const child of node.children) {
    const found = findNamedCamera(child, name);
    if (found) return found;
  }
}

/** Live warpnext camera adapter used by route presentation. */
export function warpNextCamera(model: WarpCameraModel, ops: WarpCameraOps):
  ((camera: PerspectiveCamera) => void) | undefined {
  if (model.root.kind !== "track") throw new Error("warpnext camera 缺少 TrackContainer。");
  const node = findNamedCamera(model.root.scene, "warpnextcamera_cam");
  if (!node) return;
  const source = node.camera;
  if (node.className !== "ReCamera" || !source || source.projectionMode !== 0)
    throw new Error("warpnextcamera_cam 不是已证 perspective ReCamera。");
  if (source.fieldOfViewController || source.nearClipController || source.farClipController)
    throw new Error("warpnextcamera_cam projection controller 尚未映射。");
  const readWorld = ops.clientWorldElements;
  if (!readWorld) throw new Error("warpnextcamera_cam 缺少 live world matrix owner。");
  return camera => {
    const elements = readWorld(node);
    if (!elements) throw new Error("warpnextcamera_cam 缺少 live world matrix。");
    applyReadyCameraMatrix(camera, elements, source, ops.fieldOfView);
  };
}
