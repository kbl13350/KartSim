import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readyButtonImageState, selectReadyOption, type ReadyOptions } from "./ready-options";
import {
  activateReadyButton, activateReadyTrainingShortcut, applyReadyViewOptions,
  cancelReadyPointer, leaveReadyPointer, moveReadyPointer, pressReadyPointer,
  drawReadyButtonText, drawReadyImageButton,
  readyButtonAtPoint, readyButtonNodeId, refreshReadyViewRecord,
  releaseReadyPointer, selectReadyViewOption, setReadyViewSpeedChannel,
  type ReadyButtonDrawingDependencies, type ReadyButtonDrawingHost,
  type ReadyButtonNode, type ReadyPointerEvent, type ReadyViewDependencies,
  type ReadyViewHost,
} from "./ready-view-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first, `missing release source: ${start}`);
  return source.slice(first, last);
}

const speedChannel = new Function(`const ze = "国服", E4 = 7;
  ${between("function Ue(n) {", "function kP(n) {")}
  return Ue;`)() as (options: ReadyOptions) => number;
const contains = new Function(`${between("function Oe(n, e, t) {", "function aw(n, e, t, i) {")}
  return Oe;`)() as (x: number, y: number, rect: unknown) => boolean;

function exercise(released: boolean) {
  const events: unknown[] = [];
  const captured = new Set<number>();
  class FakeCanvas {
    style: Record<string, unknown> = {};
    dataset: Record<string, string> = {};
    hidden = false;
    getContext() { return {}; }
    setAttribute(name: string, value: string) { events.push(["attribute", name, value]); }
    addEventListener(name: string) { events.push(["listen", name]); }
    removeEventListener(name: string) { events.push(["unlisten", name]); }
    getBoundingClientRect() { return { left: 10, top: 20, width: 800, height: 450 }; }
    setPointerCapture(id: number) { captured.add(id); events.push(["capture", id]); }
    hasPointerCapture(id: number) { return captured.has(id); }
    releasePointerCapture(id: number) { captured.delete(id); events.push(["release", id]); }
  }
  class FakeResizeObserver {
    constructor(_callback: () => void) { events.push(["observer"]); }
    observe(_root: unknown) { events.push(["observe"]); }
    disconnect() { events.push(["disconnect"]); }
  }
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = { createElement: (tag: string) => {
    assert.equal(tag, "canvas");
    return new FakeCanvas();
  } } as unknown as Document;
  globalThis.window = {
    addEventListener: (name: string) => events.push(["window-listen", name]),
    removeEventListener: (name: string) => events.push(["window-unlisten", name]),
  } as unknown as Window & typeof globalThis;
  try {
    const formatRecord = (record: unknown, _strings: unknown, version: string) => {
      events.push(["format-record", version, record]);
      return { version, record };
    };
    const deps: ReadyViewDependencies = {
      formatRecord, speedChannel, defaultVersion: "国服",
    };
    const attribute = (node: ReadyButtonNode, name: string) =>
      node.attributes.find(value => value.name === name)?.value;
    const requiredAttribute = (node: ReadyButtonNode, name: string) => {
      const value = attribute(node, name);
      if (value === undefined) throw new Error(`P3528 Ready ${node.name}.${name} 缺失。`);
      return value;
    };
    const drawing: ReadyButtonDrawingDependencies = {
      paintFrame: (_context, image, rect) => events.push(["frame", image, { ...rect }]),
      paintText: (_context, text, rect, style) =>
        events.push(["button-text", text, { ...rect }, { ...style }]),
      translate: text => text,
    };
    const Original = new Function("yT", "ze", "Yn", "J80", "Ue", "Oe", "Sc", "Cc",
      "ResizeObserver", "T", "Oi", "Z80", "ct", "df",
      `${between("class ty {", "class ny {")}; return ty;`)(
        formatRecord, "国服", (value: string) => value, selectReadyOption,
        speedChannel, contains, 1600, 900, FakeResizeObserver,
        attribute, requiredAttribute, readyButtonImageState,
        drawing.paintFrame, drawing.paintText,
      ) as new (options: unknown, assets: unknown, preview: unknown) => ReadyButtonDrawingHost & {
        nodeId(node: object): string;
        hitButton(event: ReadyPointerEvent): unknown;
        activateTrainingShortcut(): void;
        setSpeedChannel(change: Partial<ReadyOptions>): void;
        onPointerMove(event: ReadyPointerEvent): void;
        onPointerDown(event: ReadyPointerEvent): void;
        onPointerUp(event: ReadyPointerEvent): void;
        onPointerCancel(event: ReadyPointerEvent): void;
        onPointerLeave(): void;
        drawImageButton(node: ReadyButtonNode, rect: { x: number; y: number; width: number; height: number }): void;
      };
    const options = {
      initialOptions: { speed: 7, booster: 0, showGhost: true },
      randomGroup: undefined as unknown,
      recordFor: (current: ReadyOptions) => {
        const record = { hasGhost: current.speed === 4,
          speed: current.speed, booster: current.booster };
        events.push(["record-for", { ...current }]);
        return record;
      },
      root: { append: (_canvas: unknown) => events.push(["append"]) },
      onInteraction: () => events.push(["interaction"]),
      onHover: () => events.push(["hover"]),
      onStartActivate: () => events.push(["start-activate"]),
      onActivate: () => events.push(["activate"]),
      onTraining: (current: ReadyOptions) => events.push(["training", { ...current }]),
      onTrackSelect: (current: ReadyOptions) => events.push(["track-select", { ...current }]),
      onItemSelect: (current: ReadyOptions) => events.push(["item-select", { ...current }]),
      onExit: (current: ReadyOptions) => events.push(["exit", { ...current }]),
    };
    const assets = {
      strings: new Map(),
      buttonImages: new Map([["button", ["normal", "hover", "pressed", "selected"]]]),
      buttonStyles: new Map<ReadyButtonNode, { states: Array<{ textRender: string; textColor: string }> }>(),
    };
    const view = new Original(options, assets, { dispose() {} });
    view.render = () => { events.push(["render"]); };
    if (!released) {
      view.nodeId = node => readyButtonNodeId(view, node);
      view.hitButton = event => readyButtonAtPoint(view, event);
      view.onPointerMove = event => moveReadyPointer(view, event);
      view.onPointerDown = event => pressReadyPointer(view, event);
      view.onPointerUp = event => releaseReadyPointer(view, event);
      view.onPointerCancel = event => cancelReadyPointer(view, event);
      view.onPointerLeave = () => leaveReadyPointer(view);
      view.activateTrainingShortcut = () => activateReadyTrainingShortcut(view);
      view.activateButton = name => activateReadyButton(view, name);
      view.refreshRecord = () => refreshReadyViewRecord(view, deps);
      view.setSpeedChannel = change => setReadyViewSpeedChannel(view, change, deps);
      view.selectReadyOption = name => selectReadyViewOption(view, name);
      view.applyReadyOptions = current => applyReadyViewOptions(view, current, deps);
      view.drawImageButton = (node, rect) => drawReadyImageButton(view, node, rect, drawing);
      view.drawButtonText = (node, rect, state) =>
        drawReadyButtonText(view, node, rect, state, drawing);
    }
    const states: unknown[] = [];
    const errors: string[] = [];
    const capture = (label: string, result?: unknown) => states.push({
      label, result, readyOptions: { ...view.readyOptions }, record: view.record,
      hasReplay: view.hasReplay, hoveredButton: view.hoveredButton,
      pressedButton: view.pressedButton, nextNodeId: view.nextNodeId,
      captured: [...captured], buttonHits: structuredClone(view.buttonHits),
      errors: [...errors], events: structuredClone(events),
    });
    const point = (x: number, y: number, button = 0): ReadyPointerEvent => ({
      clientX: 10 + x / 2, clientY: 20 + y / 2, pointerId: 5, button,
    });
    const firstNode = {};
    const secondNode = {};
    capture("first-node", view.nodeId(firstNode));
    capture("same-node", view.nodeId(firstNode));
    capture("second-node", view.nodeId(secondNode));
    view.buttonHits = [
      { id: "speed", name: "S4", rect: { x: 0, y: 0, width: 100, height: 100 } },
      { id: "track", name: "selectTrackBtn", rect: { x: 80, y: 0, width: 100, height: 100 } },
    ];
    capture("overlapping-hit", view.hitButton(point(90, 50)));
    capture("edge-hit", view.hitButton(point(100, 100)));
    capture("miss", view.hitButton(point(181, 50)));
    view.onPointerMove(point(20, 50)); capture("hover-speed");
    view.onPointerMove(point(20, 50)); capture("hover-same");
    view.onPointerDown(point(20, 50)); capture("press-speed");
    view.onPointerUp(point(20, 50)); capture("select-speed");
    view.onPointerDown(point(90, 50));
    view.onPointerUp(point(90, 50)); capture("open-track-picker");
    view.onPointerDown(point(20, 50, 2)); capture("ignore-right-button");
    view.onPointerDown(point(20, 50));
    view.onPointerCancel(point(20, 50)); capture("cancel-pointer");
    view.onPointerLeave(); capture("leave");
    view.setSpeedChannel({ settingSpeed: 4 }); capture("change-speed-channel");
    view.setSpeedChannel({ settingSpeed: 4 }); capture("same-speed-channel");
    view.applyReadyOptions({ ...view.readyOptions, showGhost: false });
    capture("ghost-does-not-refresh-record");
    view.activateButton("teamBoosterBtn"); capture("booster-refreshes-record");
    view.activateButton("myItemBtn"); capture("open-items");
    view.activateButton("exit"); capture("exit");
    view.activateTrainingShortcut(); capture("hidden-shortcut");
    view.shown = true;
    view.activateTrainingShortcut(); capture("training-shortcut");
    view.disposed = true;
    view.activateTrainingShortcut(); capture("disposed-shortcut");
    const buttonNode = (name: string, text?: string, image = "button"): ReadyButtonNode => ({
      name: "ImageButton",
      attributes: [
        { name: "name", value: name }, { name: "autoLoadImage", value: image },
        ...(text === undefined ? [] : [{ name: "text", value: text }]),
      ],
    });
    const buttonRect = { x: 50, y: 60, width: 90, height: 30 };
    const speedNode = buttonNode("S4", "Speed");
    const teamNode = buttonNode("teamBoosterBtn", "Team");
    const onNode = buttonNode("onBtn", "On");
    const offNode = buttonNode("offBtn", "Off");
    for (const node of [speedNode, teamNode, onNode, offNode]) {
      assets.buttonStyles.set(node, { states: [1, 2, 3, 4].map(index => ({
        textRender: `bold${index}`, textColor: `color${index}`,
      })) });
    }
    view.buttonHits = [];
    view.drawImageButton(speedNode, buttonRect); capture("normal-button");
    view.hoveredButton = view.nodeId(speedNode);
    view.pressedButton = view.hoveredButton;
    view.drawImageButton(speedNode, buttonRect); capture("pressed-button");
    view.drawImageButton(teamNode, buttonRect); capture("selected-button");
    options.randomGroup = { id: "random" };
    view.drawImageButton(onNode, buttonRect);
    view.drawImageButton(offNode, buttonRect); capture("random-ghost-buttons");
    try { view.drawImageButton(buttonNode("missing", undefined, "missing"), buttonRect); }
    catch (error) { errors.push(String(error)); }
    try { view.drawImageButton(buttonNode("unstyled", "Text"), buttonRect); }
    catch (error) { errors.push(String(error)); }
    capture("button-errors");
    return states;
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

test("Ready button hit testing, pointer state, option changes and navigation match ty", () => {
  assert.deepEqual(exercise(false), exercise(true));
});
