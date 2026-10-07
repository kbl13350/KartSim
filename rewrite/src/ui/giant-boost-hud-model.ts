/** Authored controller timing and 3D camera projection for the Giant Boost HUD. */

export interface GiantModelNode {
  className?: string;
  name?: string;
  kind?: string;
  children: GiantModelNode[];
  camera?: {
    projectionMode: number;
    fieldOfViewController?: unknown;
    nearClipController?: unknown;
    farClipController?: unknown;
    fieldOfViewDegrees: number;
    nearClip: number;
    farClip: number;
  };
  [field: string]: unknown;
}

export interface GiantModel {
  parsed: { root: GiantModelNode };
  scene: { clientWorldElements?(node: GiantModelNode): ArrayLike<number> | undefined };
}

export class GiantBoostGaugeState {
  cells = 0;
  full = false;
  zero = false;
  remaining = 0;
  start = 0;
  last = 0;

  constructor(readonly duration: number) {
    if (!Number.isInteger(duration) || duration <= 0)
      throw new Error("巨人 HUD 缺少原控制器时长。");
  }

  stage(cells: number, tick: number): boolean {
    tick = Math.trunc(tick) >>> 0;
    if (this.remaining !== 0) cells = (cells + this.remaining) & 255;
    if (cells !== 0) {
      this.cells = cells;
      if (cells === 6) this.full = true;
      return false;
    }
    this.full = false;
    this.zero = true;
    this.start = tick;
    this.last = tick;
    this.remaining = 6;
    this.cells = 6;
    return true;
  }

  update(tick: number): void {
    tick = Math.trunc(tick) >>> 0;
    if (!this.zero) return;
    if (tick > this.last && tick - this.last > Math.trunc(this.duration / 7)) {
      this.remaining--;
      this.cells = this.remaining;
      this.last = tick;
    }
    if (tick > this.start && tick - this.start > this.duration) {
      this.zero = false;
      this.start = 0;
    }
  }

  reset(): void {
    this.cells = 0;
    this.full = false;
    this.zero = false;
    this.remaining = 0;
    this.start = 0;
    this.last = 0;
  }
}

export function findGiantModelCamera(node: GiantModelNode): GiantModelNode | undefined {
  if (node.className === "ReCamera") return node;
  for (const child of node.children) {
    const camera = findGiantModelCamera(child);
    if (camera) return camera;
  }
}

export function findGiantModelNode(node: GiantModelNode, name: string): GiantModelNode | undefined {
  if (node.name === name) return node;
  for (const child of node.children) {
    const result = findGiantModelNode(child, name);
    if (result) return result;
  }
}

/** Largest authored stop time in a nested controller tree. */
export function giantControllerDuration(value: unknown,
  seen = new Set<unknown>()): number {
  if (!value || typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  let duration = 0;
  const base = Reflect.get(value, "base") as { stopTimeWord?: unknown } | undefined;
  if (base && typeof base.stopTimeWord === "number") duration = base.stopTimeWord;
  for (const nested of Object.values(value))
    duration = Math.max(duration, giantControllerDuration(nested, seen));
  return duration;
}

/** Preserve the release's float32 view and projection arrays. */
export function frameGiantModelCamera(model: GiantModel, camera: unknown,
  applyCamera: (camera: unknown, view: number[], projection: number[]) => void,
  width = 800, height = 600): void {
  if (model.parsed.root.kind !== "node")
    throw new Error("巨人 HUD 相机根不是 Relement。");
  const source = findGiantModelCamera(model.parsed.root);
  const config = source?.camera;
  const world = source && model.scene.clientWorldElements?.(source);
  if (!config || config.projectionMode !== 1 || !world ||
      config.fieldOfViewController || config.nearClipController ||
      config.farClipController)
    throw new Error("巨人 HUD 原相机未闭合。");
  const single = Math.fround;
  const row = (index: number, direction: number) => [
    single(direction * world[index]!),
    single(direction * world[index + 1]!),
    single(direction * world[index + 2]!),
    single(-direction * (world[index]! * world[12]! +
      world[index + 1]! * world[13]! + world[index + 2]! * world[14]!)),
  ];
  const view = [...row(0, -1), ...row(4, 1), ...row(8, -1)];
  const aspect = world[13] === -64 ? single(height / width) : single(0.75);
  const radians = single(config.fieldOfViewDegrees * single(0.008726639673113823));
  const extent = Math.tan(radians) * single(323.22100830078125);
  const horizontal = single(extent);
  const vertical = single(extent * aspect);
  const near = config.nearClip;
  const far = config.farClip;
  const projection = [
    single(2 / horizontal), 0, 0, 0,
    0, single(2 / vertical), 0, 0,
    0, 0, single(1 / (far - near)), single(near / (near - far)),
    0, 0, 0, 1,
  ];
  applyCamera(camera, view, projection);
}

export function giantHudViewport(width: number, height: number) {
  const scale = Math.min(width / 800, height / 600);
  const scaledWidth = 800 * scale;
  const scaledHeight = 600 * scale;
  return {
    scale, left: (width - scaledWidth) / 2,
    top: height - scaledHeight - height * 0.2,
    width: scaledWidth, height: scaledHeight,
  };
}
