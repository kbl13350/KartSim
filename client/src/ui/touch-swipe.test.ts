import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TouchPageSwipe } from "./touch-swipe";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class WP {");
const end = source.indexOf("function HP(", start);
assert.ok(start > 0 && end > start);
const Original = new Function(`${source.slice(start, end)}; return WP;`)() as typeof TouchPageSwipe;

test("track picker touch paging, tap slop and blocked page match release", () => {
  const run = (Swipe: typeof TouchPageSwipe) => {
    let available = 4;
    const pages: number[] = [];
    const swipe = new Swipe(48, 8, direction => {
      if (available === 0) return false;
      available -= 1;
      pages.push(direction);
      return true;
    });
    const history: unknown[] = [];
    const capture = (result?: unknown) => history.push({ result, pointer: swipe.pointer,
      startY: swipe.startY, steps: swipe.steps, moved: swipe.moved, pages: [...pages] });
    capture(swipe.isActive(2));
    swipe.begin(2, 200); capture();
    swipe.move(3, 100); capture();
    swipe.move(2, 193); capture();
    swipe.move(2, 191); capture();
    swipe.move(2, 90); capture();
    swipe.move(2, 0); capture();
    capture(swipe.finish(3));
    capture(swipe.finish(2));
    swipe.begin(4, 100); capture();
    swipe.move(4, 104); capture();
    capture(swipe.finish(4));
    return history;
  };
  assert.deepEqual(run(TouchPageSwipe), run(Original));
});
