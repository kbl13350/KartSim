export const RADAR_FIELDS = {
  DragFactor: "dragFactor",
  ForwardAccelForce: "forwardAccel",
  TransAccelFactor: "transAccelFactor",
  TeamBoosterTime: "teamBoosterTime",
  NormalBoosterTime: "normalBoosterTime",
  StartBoosterTimeSpeed: "startBoosterTimeSpeed",
  DriftMaxGauge: "driftMaxGauge",
  DriftEscapeForce: "driftEscapeForce",
  CornerDrawFactor: "cornerDrawFactor",
} as const;

const RADAR_LABELS = [
  "集气速度", "加速时间", "加速最高速度", "竞速",
  "弯道", "稳定性", "平衡", "强化力量",
] as const;

export interface GarageRadarWeights {
  publicCutDown: number;
  enchantVariable: number;
  generalWeight: number;
  enchantWeight: number;
}

export interface GarageRadarAxis {
  label: string;
  base: number;
  enhanced: number;
}

export interface GarageRadarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function finiteFloat(value: unknown): number {
  const rounded = Math.fround(value as number);
  if (!Number.isFinite(rounded))
    throw new Error("车辆雷达参数不是有效有限数值。");
  return rounded;
}

/** Convert the engine statistics and enchant weights into eight displayed axes. */
export function calculateGarageRadar(
  base: Record<string, number>,
  enhanced: Record<string, number>,
  weights: Map<string, GarageRadarWeights>,
): GarageRadarAxis[] {
  const round = Math.fround;
  const baseScore = new Map<string, number>();
  const enhancedScore = new Map<string, number>();

  for (const key of Object.keys(RADAR_FIELDS)) {
    const weight = weights.get(key);
    if (!weight || !weight.enchantVariable ||
        !Object.values(weight).every(Number.isFinite))
      throw new Error(`车辆雷达权重无效：${key}。`);
    const field = RADAR_FIELDS[key as keyof typeof RADAR_FIELDS];
    const initial = finiteFloat(base[field]);
    const upgraded = finiteFloat(enhanced[field]);
    const original = Math.max(0,
      round(round(round(round(initial - weight.publicCutDown) /
        weight.enchantVariable) * weight.generalWeight) *
        finiteFloat(base.DescEngineGrade)));
    const increase = round(round(round(round(upgraded - initial) /
      weight.enchantVariable) * weight.enchantWeight) *
      finiteFloat(enhanced.DescEngineGrade));
    baseScore.set(key, finiteFloat(original));
    enhancedScore.set(key, finiteFloat(Math.max(0, round(original + increase))));
  }

  const axes = (scores: Map<string, number>, vehicle: Record<string, number>) => [
    scores.get("DriftMaxGauge"),
    round(round(scores.get("TeamBoosterTime")! +
      scores.get("NormalBoosterTime")!) +
      scores.get("StartBoosterTimeSpeed")!),
    scores.get("TransAccelFactor"),
    round(scores.get("DragFactor")! + scores.get("ForwardAccelForce")!),
    round(round(scores.get("DriftEscapeForce")! +
      scores.get("CornerDrawFactor")!) + finiteFloat(vehicle.DescCornering)),
    finiteFloat(vehicle.DescStability),
    finiteFloat(vehicle.DescBalance),
    finiteFloat(vehicle.DescEnchantCap),
  ];
  const normalized = (value: number | undefined) =>
    round(round(round(Math.min(70, Math.max(20, value!)) - 10) * 100) / 60);
  const initialAxes = axes(baseScore, base);
  const enhancedAxes = axes(enhancedScore, enhanced);
  return RADAR_LABELS.map((label, index) => ({
    label, base: normalized(initialAxes[index]),
    enhanced: normalized(enhancedAxes[index]),
  }));
}

/** The original chart uses a fixed top-starting octagon and float32 coordinates. */
export function garageRadarPoint(rect: GarageRadarRect, axis: number,
  percent: number): { x: number; y: number } {
  const round = Math.fround;
  const angle = round(
    round(round(round(6.283185005187988 / 24) * 3) * (axis + 1)) -
      round(0.3926990032196045));
  const radius = round(Math.min(rect.width, rect.height) * round(0.4));
  return {
    x: rect.x + rect.width / 2 +
      round((round(round(Math.sin(angle)) * radius) * percent) / 100),
    y: rect.y + rect.height / 2 +
      round((round(round(Math.cos(angle)) * radius) * percent) / 100),
  };
}

/** Paint the original five rings and before/after vehicle polygons. */
export function drawGarageRadar(context: CanvasRenderingContext2D,
  rect: GarageRadarRect, axes: GarageRadarAxis[]): void {
  if (axes.length !== 8) return;
  context.save();
  const polygon = (values: number[], fill: string, stroke?: string): void => {
    context.beginPath();
    values.forEach((value, axis) => {
      const point = garageRadarPoint(rect, axis, value);
      if (axis) context.lineTo(point.x, point.y);
      else context.moveTo(point.x, point.y);
    });
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
  };
  for (let ring = 5; ring >= 1; ring--)
    polygon(Array(8).fill(ring * 20), ring % 2 ? "#182a45" : "#1b355b",
      ring === 5 ? "#667482" : undefined);
  polygon(axes.map(axis => axis.enhanced), "rgba(80,193,255,.45)", "#7dd8ff");
  polygon(axes.map(axis => axis.base), "#1499ed");
  context.font = '15px "P3528 Source Han Sans CN Garage"';
  context.fillStyle = "white";
  context.shadowColor = "black";
  context.shadowBlur = 2;
  context.textBaseline = "middle";
  axes.forEach((axis, index) => {
    const point = garageRadarPoint(rect, index, 125);
    context.textAlign = point.x < rect.x + rect.width / 2 ? "right" : "left";
    if (axis.label === "加速最高速度") {
      context.fillText("加速", point.x, point.y - 10);
      context.fillText("最高速度", point.x, point.y + 10);
    } else context.fillText(axis.label, point.x, point.y);
  });
  context.restore();
}
