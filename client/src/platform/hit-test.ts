/**
 * document.elementFromPoint for runtimes without it (Brewser keeps its hit
 * testing private). Walks the element tree and keeps the element under the
 * point that paints on top: stacking by the z-index of positioned ancestors
 * (the game's [data-ui-layer] layers and dialogs set them), then document
 * order, where a descendant follows its ancestors. Elements that are not
 * displayed, hidden, or have pointer-events: none are not hits; the children
 * of the latter two still are. Points outside an element's clip-path miss the
 * element and its children.
 */
export const HIT_TEST_IGNORE = "data-hit-test-ignore";

interface Candidate { element: Element; stack: number[]; order: number }

/** A clip-path region in client coordinates (it also clips the element's children). */
type ClipRegion = (x: number, y: number) => boolean;

function length(value: string, size: number): number {
  const text = value.trim();
  if (text.endsWith("%")) return Number.parseFloat(text) / 100 * size;
  return Number.parseFloat(text) || 0;
}

/**
 * clip-path inset() and polygon() (the forms the game's windows use to let
 * pointer events through around what they draw, ui/bml-kit.ts clipToStage).
 * Brewser does not implement clip-path, so its own hit testing ignores them.
 */
export function clipRegion(clipPath: string | undefined, rect: { left: number; top: number; width: number; height: number }):
  ClipRegion | undefined {
  const value = clipPath?.trim();
  if (!value || value === "none") return undefined;
  const inset = /^inset\(([^)]*)\)$/i.exec(value);
  if (inset) {
    const parts = inset[1]!.split(/\s+round\s+/i)[0]!.trim().split(/\s+/);
    const [top = "0", right = top, bottom = top, left = right] = parts;
    const x0 = rect.left + length(left, rect.width), x1 = rect.left + rect.width - length(right, rect.width);
    const y0 = rect.top + length(top, rect.height), y1 = rect.top + rect.height - length(bottom, rect.height);
    return (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  }
  const polygon = /^polygon\((.*)\)$/is.exec(value);
  if (polygon) {
    const items = polygon[1]!.split(",").map(item => item.trim()).filter(Boolean);
    let evenOdd = false;
    if (/^(nonzero|evenodd)$/i.test(items[0] ?? "")) evenOdd = items.shift()!.toLowerCase() === "evenodd";
    const points = items.map(item => {
      const [px = "0", py = "0"] = item.split(/\s+/);
      return [rect.left + length(px, rect.width), rect.top + length(py, rect.height)] as const;
    });
    return (x, y) => {
      let winding = 0;
      let crossings = 0;
      for (let index = 0; index < points.length; index++) {
        const [ax, ay] = points[index]!;
        const [bx, by] = points[(index + 1) % points.length]!;
        if ((ay <= y) !== (by <= y)) {
          const at = ax + (y - ay) / (by - ay) * (bx - ax);
          if (x < at) { crossings++; winding += by > ay ? 1 : -1; }
        }
      }
      return evenOdd ? crossings % 2 === 1 : winding !== 0;
    };
  }
  return undefined;
}

function computedStyle(element: Element): CSSStyleDeclaration | undefined {
  try { return typeof getComputedStyle === "function" ? getComputedStyle(element) : undefined; }
  catch { return undefined; }
}

function stackingZ(style: CSSStyleDeclaration | undefined, element: Element): number | undefined {
  const raw = style?.zIndex ?? (element as HTMLElement).style?.zIndex;
  if (raw === undefined || raw === "" || raw === "auto") return undefined;
  const position = style?.position ?? (element as HTMLElement).style?.position;
  if (position && position === "static") return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function above(a: Candidate, b: Candidate): boolean {
  const length = Math.max(a.stack.length, b.stack.length);
  for (let index = 0; index < length; index++) {
    const left = a.stack[index] ?? 0;
    const right = b.stack[index] ?? 0;
    if (left !== right) return left > right;
  }
  return a.order > b.order;
}

export function elementAtPoint(x: number, y: number, root: Element | null =
  typeof document === "undefined" ? null : document.body ?? document.documentElement): Element | null {
  if (!root) return null;
  let best: Candidate | undefined;
  let order = 0;
  const visit = (element: Element, stack: number[], inheritedNoHit: boolean) => {
    if (element.hasAttribute?.(HIT_TEST_IGNORE) || element.hasAttribute?.("hidden")) return;
    const style = computedStyle(element);
    if (style?.display === "none") return;
    const z = stackingZ(style, element);
    const own = z === undefined ? stack : [...stack, z];
    const pointerEvents = style?.pointerEvents ?? (element as HTMLElement).style?.pointerEvents;
    const noHit = pointerEvents === "none" ? true : pointerEvents ? false : inheritedNoHit;
    const visible = style?.visibility !== "hidden";
    const position = order++;
    const rect = element.getBoundingClientRect?.();
    const clipPath = (style?.clipPath && style.clipPath !== "none" ? style.clipPath : undefined) ??
      (element as HTMLElement).style?.clipPath;
    // Outside its clip-path neither the element nor its children are hit.
    if (rect && clipPath && clipRegion(clipPath, rect)?.(x, y) === false) return;
    if (!noHit && visible && rect && rect.width > 0 && rect.height > 0 &&
        x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) {
      const candidate = { element, stack: own, order: position };
      if (!best || above(candidate, best)) best = candidate;
    }
    for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
      visit(child, own, noHit);
    }
  };
  visit(root, [], false);
  return best?.element ?? null;
}
