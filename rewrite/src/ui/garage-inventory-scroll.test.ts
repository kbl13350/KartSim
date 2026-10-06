import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import { GarageInventoryScroll, type GarageScrollbarLayout } from "./garage-inventory-scroll";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "vn");
assert.ok(view && view.type === "ClassDeclaration");
const source = release.slice(view.start!, view.end!);
const Original = new Function("Qs", `${source}; return vn;`) as (
  layout: GarageScrollbarLayout,
) => new (viewport: HTMLElement, hitTarget: HTMLElement,
  snapStep?: () => number) => GarageInventoryScroll;

function fixture(released: boolean, scrollHeight: number, step?: number) {
  const events: unknown[] = [];
  const viewport = { scrollHeight, clientHeight: 100, scrollTop: 0 } as HTMLElement;
  const captures = new Set<number>();
  const hitTarget = {
    setPointerCapture: (id: number) => { events.push(["capture", id]); captures.add(id); },
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => { events.push(["release", id]); captures.delete(id); },
  } as HTMLElement;
  const layout: GarageScrollbarLayout = (_scrollbar, rect, ratio, offset, top, total) => {
    events.push(["geometry", ratio, offset, top, total]);
    return { button: { y: rect.y + top / 5, height: 20 } };
  };
  const scroll = released
    ? new (Original(layout))(viewport, hitTarget, step === undefined ? undefined : () => step)
    : new GarageInventoryScroll(viewport, hitTarget,
        step === undefined ? undefined : () => step, layout);
  const rect = { x: 10, y: 20, width: 16, height: 80 };
  const pointer = (id: number) => ({ pointerId: id,
    preventDefault: () => { events.push("prevent"); } }) as PointerEvent;
  const snapshot = () => ({ events: structuredClone(events),
    top: viewport.scrollTop, maximum: scroll.maximum(), grab: scroll.grab,
    captures: [...captures] });
  return { scroll, rect, pointer, snapshot, viewport };
}

test("Garage inventory snap maximum, thumb geometry and paging match vn", () => {
  const run = (released: boolean) => {
    const f = fixture(released, 345, 24);
    const first = f.scroll.geometry({}, f.rect);
    const up = f.scroll.page(-1);
    const down = f.scroll.page(1);
    const second = f.scroll.geometry({}, f.rect);
    f.scroll.page(10);
    return { first, up, down, second, final: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("Garage scrollbar thumb grab, page click, drag and release match vn", () => {
  const run = (released: boolean) => {
    const f = fixture(released, 500);
    f.scroll.down(f.pointer(8), {}, f.rect, 30);
    f.scroll.move({}, f.rect, 75);
    const dragged = f.snapshot();
    f.scroll.up(8);
    f.scroll.down(f.pointer(9), {}, f.rect, 5);
    f.scroll.move({}, f.rect, 50);
    f.scroll.up(9);
    f.scroll.move({}, f.rect, 50);
    return { dragged, final: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("Garage inventory with no overflow does not capture pointer like vn", () => {
  const run = (released: boolean) => {
    const f = fixture(released, 80);
    const geometry = f.scroll.geometry({}, f.rect);
    const paged = f.scroll.page(1);
    f.scroll.down(f.pointer(1), {}, f.rect, 30);
    f.scroll.up(1);
    return { geometry, paged, final: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});
