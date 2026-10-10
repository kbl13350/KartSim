import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { WindowNode } from "./multiplayer-window-assets";
import { renderMultiplayerWindow, type MultiplayerWindowRenderHost } from
  "./multiplayer-window-render";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

test("多人窗口画布、可访问组合选项与仅重绘模式和发行版一致", async () => {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("class te {");
  const end = source.indexOf("\nfunction OM(", start);
  assert.ok(start >= 0 && end > start);
  const viewport = (width: number, height: number, ratio: number) => ({
    width: Math.round(width * ratio), height: Math.round(height * ratio),
    scaleX: width * ratio / 1600, scaleY: height * ratio / 900,
  });
  const Original = new Function("Sr", `${source.slice(start, end)}\nreturn te;`)(
    viewport) as { prototype: { render(this: MultiplayerWindowRenderHost): void } };
  const previousWindow = globalThis.window;
  const previousInput = globalThis.HTMLInputElement;
  class Input { hidden = false; disabled = false; style = { pointerEvents: "" };
    attributes = new Map<string, string>();
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  }
  globalThis.window = { devicePixelRatio: 2 } as Window & typeof globalThis;
  globalThis.HTMLInputElement = Input as unknown as typeof HTMLInputElement;
  try {
    const root: WindowNode = { name: "Window", children: [] };
    const combo: WindowNode = { name: "Combo", children: [] };
    const hidden: WindowNode = { name: "Hidden", children: [] };
    const makeHost = (paintingOnly: boolean, open: boolean) => {
      const events: unknown[][] = [];
      const input = new Input();
      const hiddenControl = new Input();
      const optionControls = new Map<number, { id: string; parentElement?: unknown;
        attributes: Map<string, string>; setAttribute(name: string, value: string): void }>();
      const popup = {
        id: "test-popup", hidden: true,
        append: (control: { parentElement?: unknown }) => {
          control.parentElement = popup; events.push(["append"]);
        },
      };
      const context = {
        setTransform: (...values: number[]) => events.push(["transform", ...values]),
        clearRect: (...values: number[]) => events.push(["clear", ...values]),
        imageSmoothingEnabled: false,
      } as unknown as CanvasRenderingContext2D;
      const host = {
        disposed: false, paintingOnly, font: {},
        options: {
          root: { getBoundingClientRect: () => ({ width: 800, height: 450 }) },
          definition: root, smoothImages: true,
          state: () => ({ select: { values: ["A", "B", "C"], value: "B" } }),
        },
        canvas: { width: 0, height: 0 }, context,
        controls: new Map([[combo, input], [hidden, hiddenControl]]),
        buttons: [], comboRects: new Map([[combo, { x: 0, y: 0, width: 1, height: 1 }]]),
        hoverRegions: ["old"], popup, openCombo: open ? combo : undefined,
        comboIndex: 2,
        buttonLayer: {
          update: (buttons: Array<{ key: unknown }>) => events.push(["update", buttons.length]),
          control: (key: number) => {
            let control = optionControls.get(key);
            if (!control) {
              control = { id: "", attributes: new Map(),
                setAttribute(name: string, value: string) {
                  this.attributes.set(name, value);
                } };
              optionControls.set(key, control);
            }
            return control;
          },
        },
        draw: (_node: WindowNode, _rect: unknown, visible: Set<WindowNode>) => {
          events.push(["draw"]);
          visible.add(combo);
          host.buttons = [0, 1, 2, "other"].map(key =>
            ({ key, activate() {} }));
        },
        drawComboPopup: () => events.push(["popup"]),
      } as unknown as MultiplayerWindowRenderHost;
      return { host, events,
        summary: () => ({
          canvas: [host.canvas.width, host.canvas.height],
          smooth: host.context.imageSmoothingEnabled,
          input: [input.style.pointerEvents, [...input.attributes]],
          hidden: hiddenControl.hidden,
          popup: popup.hidden,
          buttons: [...optionControls].map(([key, control]) =>
            [key, control.id, [...control.attributes], control.parentElement === popup]),
          events,
        }) };
    };
    for (const paintingOnly of [false, true]) {
      for (const open of [false, true]) {
        const original = makeHost(paintingOnly, open);
        const rewritten = makeHost(paintingOnly, open);
        Original.prototype.render.call(original.host);
        renderMultiplayerWindow(rewritten.host, viewport);
        assert.deepEqual(rewritten.summary(), original.summary(),
          `paintingOnly=${paintingOnly}, open=${open}`);
      }
    }
  } finally {
    globalThis.window = previousWindow;
    globalThis.HTMLInputElement = previousInput;
  }
});
