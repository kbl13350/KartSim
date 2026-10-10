/**
 * The remaining time of a rented item ("剩余 3 天") drawn on a garage card.
 * Garage catalogs filtered by the account inventory (account/ownership.ts)
 * annotate rentals with `ownershipLabel`; permanent items have none.
 */

export interface BadgeRect { x: number; y: number; width: number; height: number }

export function ownershipLabelOf(item: unknown): string | undefined {
  const label = (item as { ownershipLabel?: unknown } | undefined)?.ownershipLabel;
  return typeof label === "string" && label ? label : undefined;
}

/** A small gold label on a dark pill in the card's bottom-left corner. */
export function drawOwnershipBadge(context: CanvasRenderingContext2D, item: unknown,
  rect: BadgeRect, fontFamily = "sans-serif"): void {
  const label = ownershipLabelOf(item);
  if (!label) return;
  const size = Math.max(10, Math.min(13, Math.round(rect.height * 0.12)));
  context.save();
  context.font = `bold ${size}px "${fontFamily}", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  const width = Math.min(rect.width - 8, context.measureText(label).width + 10);
  const height = size + 6;
  const x = rect.x + 4;
  const y = rect.y + rect.height - height - 4;
  context.fillStyle = "rgba(10, 20, 40, 0.78)";
  context.fillRect(x, y, width, height);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(0, 0, 0, 0.9)";
  context.strokeText(label, x + 5, y + height / 2, width - 10);
  context.fillStyle = "rgb(255, 222, 0)";
  context.fillText(label, x + 5, y + height / 2, width - 10);
  context.restore();
}
