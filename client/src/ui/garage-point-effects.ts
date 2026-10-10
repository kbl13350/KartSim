import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageSkillProgression {
  kind: string;
  level: number;
  skills: Array<{ id: number; points: number }>;
}

export interface GaragePointEffectPanel {
  durationMs: number;
  seek(elapsedMs: number): void;
  dispose(): void;
}

export interface GaragePointEffectAssets {
  nodes: Map<string, unknown>;
  rects: Map<string, GaragePreviewRect>;
}

export interface GaragePointEffectSlot {
  context: CanvasRenderingContext2D;
  active: boolean;
  epoch?: number;
  panel?: GaragePointEffectPanel;
}

export interface GaragePointEffectDependencies {
  attribute(node: unknown, name: string): string | undefined;
}

/** Which skill rows need an old effect cleared or a new point effect played? */
export function compareGarageSkillEffects(before: GarageSkillProgression,
  after: GarageSkillProgression): { clear: number[]; play: number[] } {
  if (before.kind !== "xun" || after.kind !== "xun" || before.level !== after.level)
    return { clear: [0, 1, 2], play: [] };
  const clear: number[] = [];
  const play: number[] = [];
  after.skills.forEach((skill, index) => {
    const previous = before.skills[index]!;
    if (previous.id === skill.id && previous.points === skill.points) return;
    clear.push(index);
    if (previous.id === skill.id && skill.points === previous.points + 1)
      play.push(index);
  });
  return { clear, play };
}

/** Position the 1s animation sprite over the newly filled gauge point. */
export function garageSkillEffectRect(gauge: GaragePreviewRect,
  sprite: GaragePreviewRect, points: number): GaragePreviewRect {
  if (!Number.isInteger(points) || points < 1 || points > 5)
    throw new Error("加点动画目标超出强化条范围");
  return {
    ...sprite,
    x: gauge.x + ((28 + (points - 1) * 48) * gauge.width) / 248 - sprite.width / 2,
    y: gauge.y + gauge.height / 2 - sprite.height / 2,
  };
}

/** Loads, schedules and disposes Garage strengthening point animations. */
export class GaragePointEffects {
  readonly element = document.createElement("div");
  readonly slots = new Map<number, GaragePointEffectSlot>();
  contextKey?: string;
  disposed = false;

  constructor(
    surface: HTMLElement,
    readonly assets: GaragePointEffectAssets,
    readonly load: (source: { path: string; panel: unknown }) => Promise<GaragePointEffectPanel>,
    readonly onError: (message: string) => void,
    readonly dependencies: GaragePointEffectDependencies,
  ) {
    this.element.className = "garage-point-effects";
    this.element.setAttribute("aria-hidden", "true");
    surface.append(this.element);
  }

  setContext(key: string): void {
    if (key === this.contextKey) return;
    this.clear();
    this.contextKey = key;
  }

  transition(before: GarageSkillProgression, after: GarageSkillProgression): void {
    if (this.disposed || !this.contextKey) return;
    const change = compareGarageSkillEffects(before, after);
    change.clear.forEach(index => this.clear(index));
    if (after.kind === "xun")
      change.play.forEach(index => this.play(index, after.skills[index]!.points));
  }

  play(row: number, points: number): void {
    const root = `/backGround/engine12Data/tuningPanel/skillTuning/tuningSkill${row + 1}`;
    const sceneNode = this.assets.nodes.get(`${root}/tuningPoint1s`);
    const spriteRect = this.assets.rects.get(`${root}/tuningPoint1s`);
    const gauge = this.assets.rects.get(`${root}/skillGauge`);
    const gaugeRect = gauge && { ...gauge, x: gauge.x + 15 };
    const scene = sceneNode && this.dependencies.attribute(sceneNode, "scene");
    if (!sceneNode || !spriteRect || !gaugeRect || !scene) {
      this.onError("加点动画定义缺失；强化点已保留。");
      return;
    }
    const rect = garageSkillEffectRect(gaugeRect, spriteRect, points);
    let slot = this.slots.get(row);
    if (!slot) {
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.hidden = true;
      canvas.className = "garage-point-effect";
      canvas.dataset.row = String(row + 1);
      Object.assign(canvas.style, {
        left: `${rect.x}px`, top: `${rect.y}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
      });
      const context = canvas.getContext("2d");
      if (!context) {
        this.onError("加点动画画布不可用；强化点已保留。");
        return;
      }
      slot = { context, active: false };
      this.slots.set(row, slot);
      this.element.append(canvas);
      const pendingSlot = slot;
      this.load({ path: `stage_/kartune/${scene}.1s`, panel: sceneNode })
        .then(panel => {
          if (this.disposed) { panel.dispose(); return; }
          if (!(panel.durationMs > 0 && panel.durationMs < 60_000)) {
            panel.dispose();
            throw new Error("无效的加点动画时长");
          }
          pendingSlot.panel = panel;
        })
        .catch(error => {
          this.clear(row);
          if (!this.disposed)
            this.onError(`加点动画加载失败，强化点已保留：${error instanceof Error ? error.message : error}`);
        });
    }
    Object.assign(slot.context.canvas.style, {
      left: `${rect.x}px`, top: `${rect.y}px`,
    });
    slot.active = true;
    slot.epoch = undefined;
  }

  clear(row?: number): void {
    for (const [index, slot] of this.slots) {
      if (row !== undefined && index !== row) continue;
      slot.active = false;
      slot.epoch = undefined;
      const canvas = slot.context.canvas;
      canvas.hidden = true;
      slot.context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  render(time: number,
    panels: { drawAuxiliaryPanel(panel: GaragePointEffectPanel,
      contexts: CanvasRenderingContext2D[]): void }): void {
    if (this.disposed || !this.contextKey) return;
    for (const [row, slot] of this.slots) {
      if (!slot.active || !slot.panel) continue;
      slot.epoch ??= time;
      const elapsed = Math.max(0, time - slot.epoch);
      if (elapsed >= slot.panel.durationMs) { this.clear(row); continue; }
      slot.context.canvas.hidden = false;
      slot.panel.seek(elapsed);
      panels.drawAuxiliaryPanel(slot.panel, [slot.context]);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    for (const slot of this.slots.values()) slot.panel?.dispose();
    this.slots.clear();
    this.element.remove();
  }
}
