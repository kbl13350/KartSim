import { BufferAttribute, BufferGeometry, DynamicDrawUsage,
  type InterleavedBufferAttribute } from "three";

import { FloatKeyController, type ParsedFloatController } from "./float-key-controller";

interface MorphData {
  positions?: number[][];
  uvs?: number[][];
  normals?: unknown;
  scalars?: unknown;
  vertexCount: number;
  keys: ParsedFloatController["keys"];
}

export interface ParsedMorphController {
  kind: string;
  base: ParsedFloatController["base"];
  data: MorphData[];
}

type ControllerClass = typeof FloatKeyController;

function morphChannel(source: ParsedMorphController): "position" | "uv" {
  if (source.data.some(record => record.normals || record.scalars))
    throw new Error("MorphController normal/scalar channel 尚未映射。");
  const hasPosition = source.data[0]!.positions !== undefined;
  const hasUv = source.data[0]!.uvs !== undefined;
  if (hasPosition === hasUv)
    throw new Error("MorphController 必须且只能包含 position 或 UV channel。");
  const channel = hasPosition ? "position" : "uv";
  if (source.data.some(record => !!record.positions !== hasPosition ||
      !!record.uvs !== hasUv))
    throw new Error(`MorphController ${channel} channel 在 records 间不一致。`);
  return channel;
}

function validateAttribute(source: ParsedMorphController,
  channel: "position" | "uv",
  attribute: BufferAttribute | InterleavedBufferAttribute | undefined):
  asserts attribute is BufferAttribute {
  if (!(attribute?.array instanceof Float32Array))
    throw new Error(`Morph ${channel} buffer 必须为 Float32Array。`);
  const itemSize = channel === "position" ? 3 : 2;
  if (attribute.itemSize !== itemSize)
    throw new Error(`Morph ${channel} buffer 分量数应为 ${itemSize}。`);
  for (const record of source.data) {
    const values = channel === "position" ? record.positions : record.uvs;
    if (record.vertexCount !== attribute.count ||
        values?.length !== attribute.count)
      throw new Error(`MorphController ${channel} 顶点数 ${record.vertexCount} 与 mesh ${attribute.count} 不一致。`);
  }
}

const f32 = Math.fround;

function accumulatePosition(buffer: Float32Array, target: Float32Array,
  weight: number): void {
  for (let index = 0; index < buffer.length; index++)
    buffer[index] = f32(buffer[index]! + f32(target[index]! * weight));
}

function blendUv(buffer: Float32Array, target: Float32Array,
  weight: number): void {
  const remaining = f32(1 - weight);
  for (let index = 0; index < buffer.length; index++)
    buffer[index] = f32(f32(target[index]! * weight) +
      f32(buffer[index]! * remaining));
}

/** Plays a parsed morph channel directly into a Three.js geometry buffer. */
export class MorphController {
  channel: "position" | "uv";
  attribute: BufferAttribute;
  weights: FloatKeyController[];
  targets: Float32Array[];
  weightOutputs: number[];
  lastTick?: number;

  constructor(source: ParsedMorphController, public geometry: BufferGeometry,
    public refreshBounds: boolean | undefined,
    FloatController: ControllerClass = FloatKeyController) {
    if (source.data.length === 0)
      throw new Error("MorphController 缺少 MorphData。");
    this.channel = morphChannel(source);
    const attribute = geometry.getAttribute(this.channel);
    validateAttribute(source, this.channel, attribute);
    this.attribute = attribute;
    this.weights = source.data.map(record => FloatController.fromParsed({
      kind: "float-controller", base: source.base, keys: record.keys,
    }));
    this.weightOutputs = this.weights.map(() => 0);
    this.targets = source.data.map(record => Float32Array.from(
      (this.channel === "position" ? record.positions! : record.uvs!).flat()));
    this.attribute.setUsage(DynamicDrawUsage);
  }

  static fromParsed<T extends MorphController>(this: new (source: ParsedMorphController,
    geometry: BufferGeometry, refreshBounds: boolean) => T,
    source: ParsedMorphController, geometry: BufferGeometry,
    refreshBounds = true): T {
    if (!source || typeof source !== "object" ||
        source.kind !== "morph-controller" || !source.base ||
        !Array.isArray(source.data))
      throw new Error("VertexData property 不是 MorphController。");
    return new this(source, geometry, refreshBounds);
  }

  update(time: number): void {
    const tick = Math.trunc(time) >>> 0;
    if (tick === this.lastTick) return;
    this.lastTick = tick;
    for (let index = 0; index < this.weights.length; index++)
      this.weightOutputs[index] = this.weights[index]!.update(tick);
    const buffer = this.attribute.array as Float32Array;
    if (this.channel === "position") {
      buffer.fill(0);
      this.targets.forEach((target, index) =>
        accumulatePosition(buffer, target, this.weightOutputs[index]!));
      if (this.refreshBounds) {
        this.geometry.computeBoundingBox();
        this.geometry.computeBoundingSphere();
      }
    } else {
      this.targets.forEach((target, index) =>
        blendUv(buffer, target, this.weightOutputs[index]!));
    }
    this.attribute.needsUpdate = true;
  }

  reset(time: number): void {
    this.weights.forEach(controller => controller.reset(time));
    this.lastTick = undefined;
  }

  play(time: number, duration: number): void {
    this.weights.forEach(controller => controller.play(time, duration));
    this.lastTick = undefined;
  }

  setCycleMode(mode: number): void {
    this.weights.forEach(controller => controller.setCycleMode(mode));
  }

  stop(time: number): void {
    this.update(time);
    this.weights.forEach(controller => controller.stop(time));
  }
}
