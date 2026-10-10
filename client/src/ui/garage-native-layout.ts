import type { GarageAssetRect } from "./garage-asset-bundle";
import type { GarageCardGridAssets } from "./garage-ui-support";

/** Parse a native two-number position, using zero for malformed components. */
export function garagePair(value: string | undefined): [number, number] {
  const numbers = (value ?? "").trim().split(/\s+/).map(Number);
  return [Number.isFinite(numbers[0]) ? numbers[0]! : 0,
    Number.isFinite(numbers[1]) ? numbers[1]! : 0];
}

/** Read one native ARGB byte tuple for a Garage arrow. */
export function garageArrowColor(value: string | undefined,
  label: string): number[] {
  const numbers = value?.trim().split(/\s+/).map(Number) ?? [];
  if (numbers.length !== 4 || numbers.some(number =>
    !Number.isInteger(number) || number < 0 || number > 255))
    throw new Error(`${label} 无效。`);
  return numbers;
}

/** Require a numeric tuple with the exact native field count. */
export function garageNumericTuple(value: string | undefined,
  count: number, label: string): number[] {
  const numbers = value?.trim().split(/\s+/).map(Number) ?? [];
  if (numbers.length !== count || numbers.some(number =>
    !Number.isFinite(number)))
    throw new Error(`${label} 无效。`);
  return numbers;
}

/** Locate elapsed time inside the ordered upgrade animation scenes. */
export function garageUpgradeAnimationPhase(durations: number[],
  elapsed: number): { index: number; time: number; complete: boolean } {
  if (durations.length === 0 || durations.some(duration =>
    !Number.isFinite(duration) || duration <= 0) ||
    !Number.isFinite(elapsed))
    throw new Error("升级动画时长无效。");
  let remaining = Math.max(0, elapsed);
  for (let index = 0; index < durations.length; index++) {
    if (remaining < durations[index]!)
      return { index, time: remaining, complete: false };
    if (index === durations.length - 1)
      return { index, time: durations[index]!, complete: true };
    remaining -= durations[index]!;
  }
  throw new Error("升级动画阶段无效。");
}

/** Place a kart card inside the authored horizontal card strip. */
export function garageKartCardRect(assets: GarageCardGridAssets,
  index: number,
  cardsRect: (assets: GarageCardGridAssets) => GarageAssetRect): GarageAssetRect {
  const strip = cardsRect(assets);
  const card = assets.kartCardLayout;
  return { x: strip.x + index * (card.width + card.gapX), y: strip.y,
    width: card.width, height: card.height };
}

/** The native side panel uses a fixed inset before its content starts. */
export function garageInsetRect(rect: GarageAssetRect,
  inset: number): GarageAssetRect {
  return { ...rect, x: rect.x + inset };
}

export function garageSecondInsetRect(rect: GarageAssetRect,
  inset: number): GarageAssetRect {
  const first = garageInsetRect(rect, inset);
  return { ...first, x: first.x + 3 };
}

/** Fit the gap between the preview and the next native control. */
export function garageBetweenRects(left: GarageAssetRect,
  right: GarageAssetRect, inset: number): GarageAssetRect {
  const contentX = left.x + 8;
  const shiftedRight = garageInsetRect(right, inset);
  return {
    x: contentX, y: left.y,
    width: Math.max(0, Math.min(left.width - 8,
      shiftedRight.x - 8 - contentX)),
    height: left.height,
  };
}

/** Extend a panel far enough to include the authored right edge. */
export function garageExtendRect(rect: GarageAssetRect,
  rightEdge: number): GarageAssetRect {
  return { ...rect,
    width: Math.max(rect.width, rightEdge - rect.x - 20) };
}
