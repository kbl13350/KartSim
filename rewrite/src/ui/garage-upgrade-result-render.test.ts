import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  captureGarageUpgradePreview, closeGarageUpgradeResult, disposeGarageUpgradeResult,
  renderGarageUpgradeResult, type GarageUpgradeRenderDependencies,
  type GarageUpgradeRenderHost,
} from "./garage-upgrade-result-render";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ra");
assert.ok(view && view.type === "ClassDeclaration");
const original = release.slice(view.start!, view.end!);

type TestHost = GarageUpgradeRenderHost & {
  capturePreview(panels: { drawPreview(context: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number }): void },
    rect: { x: number; y: number; width: number; height: number }): void;
  render(time: number, panels: { drawAuxiliaryPanel(panel: unknown,
    contexts: CanvasRenderingContext2D[]): void }): void;
  close(confirmed: boolean): void;
};

function fixture(released: boolean, classic = false, resultOnly = false) {
  const events: unknown[] = [];
  const sizeCanvas = (_canvas: unknown, _context: unknown, width: number, height: number,
    ratio: number, logicalWidth: number, logicalHeight: number) => {
    events.push(["size", width, height, ratio, logicalWidth, logicalHeight]);
  };
  const pixelRatio = () => { events.push("ratio"); return 2; };
  const phase = (durations: number[], elapsed: number) => {
    events.push(["phase", durations, elapsed]);
    if (elapsed < 100) return { index: 0, time: elapsed, complete: false };
    if (elapsed < 300) return { index: 1, time: elapsed - 100, complete: false };
    return { index: 2, time: Math.min(300, elapsed - 300), complete: elapsed >= 600 };
  };
  const phaseLabels = ["准备", "强化", "结果"];
  const dependencies: GarageUpgradeRenderDependencies = {
    sizeCanvas, pixelRatio, phase, phaseLabels,
  };
  const Original = new Function("Pe", "Ee", "Aa", "Ia", `${original}; return Ra;`)(
    sizeCanvas, pixelRatio, phase, phaseLabels,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const context = {
    canvas: { getBoundingClientRect: () => ({ width: 400, height: 225 }) },
    clearRect: (...args: unknown[]) => { events.push(["clear", ...args]); },
    save: () => { events.push("save"); },
    translate: (...args: unknown[]) => { events.push(["translate", ...args]); },
    scale: (...args: unknown[]) => { events.push(["scale", ...args]); },
    restore: () => { events.push("restore"); },
  } as unknown as CanvasRenderingContext2D;
  host.disposed = false;
  host.context = context;
  host.kartContext = context;
  host.canvasLogicalWidth = 1600;
  host.canvasLogicalHeight = 900;
  host.kartLogicalWidth = 250;
  host.kartLogicalHeight = 250;
  host.title = "测试车辆";
  host.summary = { beforeLevel: 2, afterLevel: 3 };
  host.resultOnly = resultOnly;
  host.result = { hidden: true } as HTMLElement;
  host.label = { textContent: "" } as HTMLElement;
  host.accept = { disabled: true, hidden: true } as HTMLButtonElement;
  host.panels = [0, 1, 2].map(index => ({ durationMs: (index + 1) * 100,
    seek: (time: number) => { events.push(["seek", index, time]); },
    dispose: () => { events.push(["dispose-panel", index]); } }));
  if (classic) host.classic = { drawResult: (_context, title, summary) => {
    events.push(["classic-result", title, summary]);
  }, dispose: () => { events.push("dispose-classic"); } };
  host.epoch = undefined;
  host.complete = false;
  host.previousFocus = { isConnected: true,
    focus: () => { events.push("focus-previous"); } } as HTMLElement;
  host.element = { remove: () => { events.push("remove"); } } as HTMLElement;
  host.onClose = confirmed => { events.push(["close", confirmed]); };
  if (!released) {
    host.capturePreview = (panels, rect) =>
      captureGarageUpgradePreview(host, panels, rect, dependencies);
    host.render = (time, panels) =>
      renderGarageUpgradeResult(host, time,
        panels as Parameters<typeof renderGarageUpgradeResult>[2], dependencies);
    host.close = confirmed => closeGarageUpgradeResult(host, confirmed);
    host.dispose = () => disposeGarageUpgradeResult(host);
  }
  const drawingPanels = { drawAuxiliaryPanel: (_panel: unknown,
    contexts: CanvasRenderingContext2D[]) => {
    events.push(["draw-auxiliary", contexts.length]);
  } };
  const snapshot = () => ({ events: structuredClone(events), disposed: host.disposed,
    resultHidden: host.result.hidden, accept: { disabled: host.accept.disabled,
      hidden: host.accept.hidden }, label: host.label.textContent,
    complete: host.complete, epoch: host.epoch, panels: host.panels?.length,
    hasClassic: !!host.classic, hasFocus: !!host.previousFocus });
  return { host, drawingPanels, snapshot, events };
}

test("upgrade result captures Garage preview with authored transforms like Ra", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const rect = { x: 10, y: 20, width: 100, height: 80 };
    f.host.capturePreview({ drawPreview: (_context, bounds) => {
      f.events.push(["draw-preview", bounds]);
    } }, rect);
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("classic and XUN animation phase rendering matches Ra", () => {
  for (const classic of [false, true]) {
    const run = (released: boolean) => {
      const f = fixture(released, classic);
      for (const time of [1000, 1050, 1150, 1400, 1650, 1700])
        f.host.render(time, f.drawingPanels);
      return f.snapshot();
    };
    assert.deepEqual(run(false), run(true), String(classic));
  }
});

test("result-only frame, close callback, focus and disposal match Ra", () => {
  for (const classic of [false, true]) {
    const run = (released: boolean) => {
      const f = fixture(released, classic, true);
      f.host.render(2000, f.drawingPanels);
      const rendered = f.snapshot();
      f.host.close(true);
      f.host.dispose();
      f.host.render(2100, f.drawingPanels);
      return { rendered, final: f.snapshot() };
    };
    assert.deepEqual(run(false), run(true), String(classic));
  }
});
