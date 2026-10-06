import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ScrollbarController, dragScrollPosition, pointInRectangle, scrollPosition,
  scrollbarGeometry, stepScrollPosition, type UiRectangle,
} from "./scrollbar";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("function uT(");
const end = source.indexOf("function Kv(", start);
assert.ok(start > 0 && end > start);
const release = new Function(`${source.slice(start, end)}; return { uT, qa0, nf, b6, qv, bc };`)() as {
  uT: typeof scrollbarGeometry;
  qa0: typeof dragScrollPosition;
  nf: typeof stepScrollPosition;
  qv: typeof scrollPosition;
  bc: typeof pointInRectangle;
  b6: new (onChange: (position: number) => void) => ScrollbarController;
};

test("scrollbar geometry and offset math match the immutable release", () => {
  const rects: UiRectangle[] = [
    { x: 102.5, y: 41.25, width: 19.8, height: 141.4 },
    { x: 0, y: 0, width: 20, height: 200 },
    { x: -10, y: 13, width: 8, height: 21 },
  ];
  for (const rect of rects) {
    for (const count of [2, 3, 8, 100]) {
      for (const position of [0, 1, count - 1]) {
        const skin = { minButtonHeight: 25 };
        assert.deepEqual(scrollbarGeometry(skin, rect, count, position),
          release.uT(skin, rect, count, position));
        const contentLength = Math.fround(count * rect.height + 12.7);
        const offset = Math.fround(position * rect.height + 0.33);
        assert.deepEqual(scrollbarGeometry(skin, rect, count, position, offset, contentLength),
          release.uT(skin, rect, count, position, offset, contentLength));
        for (const y of [rect.y - 50, rect.y + 4.5, rect.y + rect.height + 120]) {
          assert.deepEqual(dragScrollPosition(rect, count, y, 3.25, contentLength),
            release.qa0(rect, count, y, 3.25, contentLength));
        }
        for (const direction of [-5, -1, 0, 1, 3]) {
          for (const clamp of [false, true]) {
            assert.deepEqual(stepScrollPosition(rect, count, offset, direction, clamp,
              contentLength, 30.6), release.nf(rect, count, offset, direction,
              clamp, contentLength, 30.6));
          }
        }
      }
    }
    for (const offset of [-3, 0, rect.height * 2.25]) {
      assert.deepEqual(scrollPosition(rect, offset), release.qv(rect, offset));
    }
    for (const point of [
      { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x - 0.01, y: rect.y },
    ]) assert.equal(pointInRectangle(point, rect), release.bc(point, rect));
  }
});

test("drag, wheel, track repeat, reset and callbacks match release", () => {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let nextFrame = 0;
  const frames = new Set<number>();
  globalThis.requestAnimationFrame = () => {
    const id = ++nextFrame;
    frames.add(id);
    return id;
  };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };

  const run = (Controller: typeof ScrollbarController) => {
    const calls: number[] = [];
    const scrollbar = new Controller(position => calls.push(position));
    const rect = { x: 100, y: 100, width: 19, height: 120 };
    const skin = { minButtonHeight: 25 };
    const states: unknown[] = [];
    const capture = (result?: unknown) => states.push({
      result, buttonState: scrollbar.buttonState,
      contentOffset: scrollbar.contentOffset,
      current: scrollbar.current && {
        value: { ...scrollbar.current.value },
        geometry: { area: { ...scrollbar.current.geometry.area },
          button: { ...scrollbar.current.geometry.button } },
      },
      grabOffset: scrollbar.grabOffset,
      trackPoint: scrollbar.trackPoint && { ...scrollbar.trackPoint },
      hasRepeatFrame: scrollbar.repeatFrame !== undefined,
      calls: [...calls],
    });
    capture(scrollbar.down({ x: 110, y: 130 }));
    capture(scrollbar.wheel(1, 20));
    capture(scrollbar.layout(skin, rect, 8, 0));
    capture(scrollbar.down({ x: 110, y: 102 }));
    scrollbar.move({ x: 110, y: 154 }, true); capture();
    scrollbar.move({ x: 110, y: 160 }, false); capture();
    capture(scrollbar.wheel(-1, 30, true));
    scrollbar.layout(skin, rect, 8, 1); capture();
    capture(scrollbar.down({ x: 110, y: 215 }));
    scrollbar.repeatStart = 100;
    scrollbar.lastRepeat = 100;
    scrollbar.repeatTrack(401); capture();
    scrollbar.repeatTrack(500); capture();
    scrollbar.leave(); capture();
    scrollbar.up(); capture();
    scrollbar.reset(); capture();
    scrollbar.dispose(); capture();
    frames.clear();
    return states;
  };
  try {
    assert.deepEqual(run(ScrollbarController), run(release.b6));
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
