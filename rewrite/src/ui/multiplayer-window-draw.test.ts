import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { drawMultiplayerWindowNode, type MultiplayerWindowDrawDependencies,
  type MultiplayerWindowDrawHost, type WindowNodeState,
  type WindowRect } from "./multiplayer-window-draw";
import type { WindowNode, WindowSprite } from "./multiplayer-window-assets";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");
interface FixtureNode extends WindowNode { attributes: Record<string, string>; rect: WindowRect }
function node(name: string, rect: WindowRect,
  attributes: Record<string, string> = {}, children: WindowNode[] = []): FixtureNode {
  return { name, rect, attributes, children };
}

test("多人窗口 BML 绘制与无障碍控件和发行版一致", async () => {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class te {");
  const end = release.indexOf("\nfunction OM(", start);
  assert.ok(start >= 0 && end > start);
  const previousDocument = globalThis.document;
  const previousInput = globalThis.HTMLInputElement;
  class Control {
    style: Record<string, string> = {};
    attributes = new Map<string, string>();
    hidden = false;
    disabled = false;
    value = "";
    type = "";
    maxLength = 0;
    autocomplete = "";
    listeners = new Map<string, EventListenerOrEventListenerObject>();
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    removeAttribute(key: string) { this.attributes.delete(key); }
    addEventListener(key: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.set(key, listener);
    }
  }
  class Input extends Control { blur() {} }
  globalThis.HTMLInputElement = Input as unknown as typeof HTMLInputElement;
  globalThis.document = { createElement: () => new Input() } as unknown as Document;
  try {
    const attribute = (entry: WindowNode, key: string) =>
      (entry as FixtureNode).attributes[key];
    const rectangle = (entry: WindowNode) => (entry as FixtureNode).rect;
    const innerRectangle = (_frame: unknown, rect: WindowRect) => rect;
    const color = (value: string) => value;
    const charGlyphs = () => [{
      u0: 0, v0: 0, u1: 0.5, v1: 1,
      left: 0, top: 0, right: 10, bottom: 20,
    }];
    const numbers = (value: string) => value.split(/\s+/).map(Number);
    const comboEntries = (entry: WindowNode) => entry.children;
    const captionRectangle = (_frame: unknown, rect: WindowRect) => rect;
    const nodeConfig = () => ({});
    const eventsOriginal: unknown[][] = [];
    const eventsRewrite: unknown[][] = [];
    const makeContext = (events: unknown[][]) => ({
      save: () => events.push(["save"]), restore: () => events.push(["restore"]),
      beginPath: () => events.push(["beginPath"]),
      rect: (...args: unknown[]) => events.push(["rect", ...args]),
      clip: () => events.push(["clip"]),
      fillRect: (...args: unknown[]) => events.push(["fillRect", ...args]),
      drawImage: (...args: unknown[]) => events.push(["drawImage", ...args]),
      measureText: (value: string) => ({ width: value.length * 7 }),
      fillStyle: "", font: "",
    }) as unknown as CanvasRenderingContext2D;
    const paintFrame = (context: CanvasRenderingContext2D,
      frame: unknown, image: unknown, rect: WindowRect) =>
      (context as unknown as { log: (event: unknown[]) => void }).log(["frame", frame, image, rect]);
    const textDraw = (context: CanvasRenderingContext2D, value: string,
      rect: WindowRect, style: unknown) =>
      (context as unknown as { log: (event: unknown[]) => void }).log(["text", value, rect, style]);
    const tile = (context: CanvasRenderingContext2D, sprite: WindowSprite,
      rect: WindowRect) =>
      (context as unknown as { log: (event: unknown[]) => void }).log(["tile", sprite, rect]);
    const makeLogContext = (events: unknown[][]) => {
      const context = makeContext(events);
      (context as unknown as { log: (event: unknown[]) => void }).log =
        event => { events.push(event); };
      return context;
    };
    const Original = new Function("T", "V0", "E9", "C9", "E8", "ga", "pa",
      "ct", "j2", "m9", "OM", "f3", "an", "Sn",
      `${release.slice(start, end)}\nreturn te;`)(
        attribute, rectangle, innerRectangle, paintFrame, color,
        () => ({}), charGlyphs, tile, numbers, textDraw, comboEntries,
        captionRectangle, nodeConfig, "Window Font",
      ) as { prototype: { draw(this: MultiplayerWindowDrawHost,
        entry: WindowNode, rect: WindowRect, visible: Set<WindowNode>): void } };
    const dependencies: MultiplayerWindowDrawDependencies = {
      attribute, rectangle, innerRectangle, paintFrame, color,
      charLayout: () => ({}), charGlyphs, paintImageButton: tile,
      numbers, drawText: textDraw, comboEntries,
      captionRectangle, nodeConfig, fontFamily: "Window Font",
    };

    const label = node("CaptionWindow", { x: 10, y: 10, width: 180, height: 60 },
      { caption: "标题", frame: "Caption", color: "white" });
    const image = node("ImageButton", { x: 20, y: 90, width: 80, height: 40 },
      { name: "image", hoverRegion: "image" });
    const char = node("CharPanel", { x: 120, y: 90, width: 40, height: 20 },
      { text: "AB" });
    const input = node("Edit", { x: 20, y: 150, width: 140, height: 28 },
      { name: "chat" });
    const comboValue = node("Value", { x: 0, y: 0, width: 20, height: 20 },
      { text: "4 人" });
    const combo = node("TextButton", { x: 200, y: 150, width: 100, height: 28 },
      { name: "people" }, [comboValue]);
    const root = node("Container", { x: 0, y: 0, width: 1600, height: 900 }, {},
      [label, image, char, input, combo]);
    const sprite = { image: "texture" as unknown as HTMLCanvasElement,
      width: 40, height: 20 };
    const states = new Map<WindowNode, WindowNodeState>([
      [label, { text: "标题", lines: ["第一行", { text: "第二行", color: "yellow" }] }],
      [image, { action: () => {}, hoverRegion: "image" }],
      [char, { text: "AB" }],
      [input, { input: { maxLength: 20, value: "hello", change: () => {},
        submit: () => {} } }],
      [combo, { select: { values: ["4"], value: "4", change: () => {} } }],
    ]);
    const makeHost = (events: unknown[][]): MultiplayerWindowDrawHost => {
      const context = makeLogContext(events);
      const host = {
        options: { state: (entry: WindowNode) => states.get(entry) ?? {},
          root: { clientWidth: 1600, clientHeight: 900 }, onActivate: () => {} },
        textures: new Map([[image, [sprite]], [char, [sprite]]]),
        styles: new Map(),
        frames: new Map([["Caption", [{ texture: "caption" }]]]),
        images: new Map([["caption", sprite]]),
        config: root, hovered: image,
        context, buttons: [], hoverRegions: [], comboRects: new Map(),
        controls: new Map(), element: { append: () => events.push(["append"]) },
        buttonLayer: { ensure: () => new Control() }, popup: { id: "popup" },
        paintingOnly: false, text: (value: string) => value,
        canvasButton: (entry: WindowNode, rect: WindowRect, value: string) =>
          ({ key: entry, rect, label: value, activate() {} }),
        drawComboText: (entry: WindowNode, rect: WindowRect) =>
          events.push(["combo", entry.name, rect]),
        draw() {},
      } as unknown as MultiplayerWindowDrawHost;
      return host;
    };
    const baseline = makeHost(eventsOriginal);
    const rewritten = makeHost(eventsRewrite);
    baseline.draw = function (entry, rect, visible) {
      Original.prototype.draw.call(this, entry, rect, visible);
    };
    rewritten.draw = function (entry, rect, visible) {
      drawMultiplayerWindowNode(this, entry, rect, visible, dependencies);
    };
    const visibleOriginal = new Set<WindowNode>();
    const visibleRewrite = new Set<WindowNode>();
    baseline.draw(root, root.rect, visibleOriginal);
    rewritten.draw(root, root.rect, visibleRewrite);
    const summary = (host: MultiplayerWindowDrawHost, visible: Set<WindowNode>) => ({
      buttons: host.buttons.map(button => [button.key.name, button.rect, button.disabled]),
      controls: [...host.controls].map(([entry, control]) =>
        [entry.name, control.hidden, control.disabled,
          [...(control as unknown as Control).attributes],
          (control as HTMLInputElement).value]),
      visible: [...visible].map(entry => entry.name),
      regions: host.hoverRegions,
    });
    assert.deepEqual(eventsRewrite, eventsOriginal);
    assert.deepEqual(summary(rewritten, visibleRewrite), summary(baseline, visibleOriginal));
  } finally {
    globalThis.document = previousDocument;
    globalThis.HTMLInputElement = previousInput;
  }
});
