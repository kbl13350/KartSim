import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  captureGarageStage, captureGarageStrengtheningStage,
  drawGarageKartCatalogFrame, drawGarageKartLevelBadge,
  finishGarageCanvasFrame, garageAuthoredPointerY, paintGarageTaskbar,
  type GarageFrameCanvasDependencies, type GarageFrameCanvasHost,
} from "./garage-frame-canvas";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view && view.type === "ClassDeclaration");
const names = ["captureStrengtheningStage", "captureStage", "finishCanvasFrame",
  "paintTaskbar", "authoredPointerY", "drawKartCatalogFrame", "drawKartLevelBadge"];
const members = view.body.body.filter(node => node.type === "ClassMethod" &&
  node.key.type === "Identifier" && names.includes(node.key.name));
assert.equal(members.length, names.length);
const source = members.map(member => release.slice(member.start!, member.end!)).join("\n");

type TestHost = GarageFrameCanvasHost & {
  captureStrengtheningStage(): void;
  finishCanvasFrame(frozen?: boolean): void;
  authoredPointerY(event: PointerEvent): number;
  drawKartCatalogFrame(context: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    selected: boolean, hovered?: boolean): void;
  drawKartLevelBadge(context: CanvasRenderingContext2D,
    kart: { kind: string; itemId: number; engineGrade: number },
    rect: { x: number; y: number; width: number; height: number }): void;
};

function fixture(released: boolean, contextAvailable = true) {
  const events: unknown[] = [];
  const sourceTexture = { width: 200, height: 60 } as HTMLImageElement;
  const stageContext = {
    getTransform: () => ({ a: 1.5, d: 2, e: 3, f: 4 }),
    drawImage: (...args: unknown[]) => { events.push(["draw-image", ...args.map(value =>
      typeof value === "object" && value !== null && "name" in value
        ? (value as { name: string }).name : value)]); },
    save: () => { events.push("save"); },
    setTransform: (...args: unknown[]) => { events.push(["transform", ...args]); },
    restore: () => { events.push("restore"); },
  } as unknown as CanvasRenderingContext2D;
  const createCanvas = (name: string) => ({ name, width: 0, height: 0,
    getContext: (_kind: string) => contextAvailable ? stageContext : null,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 500, height: 400 }),
  }) as unknown as HTMLCanvasElement;
  const documentStub = { createElement: (name: string) => createCanvas(name) };
  const currentConfiguration = (_configuration: unknown, itemId: number, serial: number) => {
    events.push(["configuration", itemId, serial]);
    return { progression: { level: 4, kind: itemId === 8 ? "xun" : "classic" } };
  };
  const progressionKind = (grade: number) => {
    events.push(["kind", grade]);
    return grade === 9 ? "xun" : "classic";
  };
  const badgeTexture = (grade: number, level: number | undefined) => {
    events.push(["badge", grade, level]); return `badge-${grade}`;
  };
  const levelLabel = (level: number | undefined) => {
    events.push(["level-label", level]); return `L${level}`;
  };
  const drawLabel = (_context: CanvasRenderingContext2D, label: string,
    rect: unknown, style: unknown) => { events.push(["label", label, rect, style]); };
  const dependencies: GarageFrameCanvasDependencies = {
    currentConfiguration, progressionKind, badgeTexture, levelLabel, drawLabel,
  };
  const Original = new Function("K", "fi", "mi", "vi", "wi", "document",
    `return class Original { ${source} };`)(
      currentConfiguration, progressionKind, badgeTexture, levelLabel,
      drawLabel, documentStub,
    ) as new () => TestHost;
  const host = new Original();
  host.assets = { stage: { width: 100, height: 80 },
    textures: new Map([["normal", sourceTexture], ["selected", sourceTexture],
      ["badge-0", sourceTexture], ["badge-9", sourceTexture]]),
    kartCardLayout: { width: 100, height: 60,
      selectedTexture: "selected", texture: "normal" } };
  host.canvas = createCanvas("main");
  host.canvas.width = 1000;
  host.canvas.height = 800;
  host.context = stageContext;
  host.drawing = { drawCanvasLayer: (canvas, rect, revision) => {
    events.push(["layer", (canvas as unknown as { name: string }).name, rect, revision]);
  }, endFrame: () => { events.push("end-frame"); } };
  host.controlCanvas = { draw: (_drawing, ratio, frozen) => {
    events.push(["control-canvas", ratio, frozen]);
  } };
  host.controls = { inert: false } as HTMLElement;
  host.search = { inert: false, style: { visibility: "visible" } } as HTMLInputElement;
  host.surface = { getBoundingClientRect: () => ({ top: 20, height: 400 }) } as unknown as HTMLElement;
  host.renderPixelRatio = 1.5;
  host.options = { taskbar: { compositeFrame: {
    canvas: createCanvas("taskbar"),
    rect: { left: 30, top: 50, width: 120, height: 24 }, revision: 7,
  } } };
  host.selected = { kind: "kart", itemId: 7, engineGrade: 0 };
  host.configuration = {};
  host.serial = () => 42;
  if (!released) {
    host.captureStrengtheningStage = () => captureGarageStrengtheningStage(host);
    host.captureStage = () => {
      const previous = globalThis.document;
      globalThis.document = documentStub as unknown as Document;
      try { return captureGarageStage(host); }
      finally { globalThis.document = previous; }
    };
    host.finishCanvasFrame = frozen => finishGarageCanvasFrame(host, frozen);
    host.paintTaskbar = () => paintGarageTaskbar(host);
    host.authoredPointerY = event => garageAuthoredPointerY(host, event);
    host.drawKartCatalogFrame = (context, rect, selected, hovered) =>
      drawGarageKartCatalogFrame(host, context, rect, selected, hovered);
    host.drawKartLevelBadge = (context, kart, rect) =>
      drawGarageKartLevelBadge(host, context, kart, rect, dependencies);
  }
  const snapshot = () => ({ events: structuredClone(events),
    snapshot: host.strengtheningSnapshot && {
      width: host.strengtheningSnapshot.width, height: host.strengtheningSnapshot.height },
    search: { inert: host.search.inert, visibility: host.search.style.visibility },
  });
  return { host, stageContext, events, snapshot };
}

test("stage capture preserves transform and freezes only once like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.captureStrengtheningStage();
    f.host.captureStrengtheningStage();
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("capture failure, frame controls and taskbar composite match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released, false);
    let error: string | undefined;
    try { f.host.captureStage(); } catch (cause) { error = (cause as Error).message; }
    f.host.finishCanvasFrame();
    f.host.controls.inert = true;
    f.host.finishCanvasFrame(true);
    const pointer = f.host.authoredPointerY({ clientY: 120 } as PointerEvent);
    return { error, pointer, result: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("catalog atlas frames and classic/XUN badges match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const rect = { x: 10, y: 20, width: 90, height: 60 };
    f.host.drawKartCatalogFrame(f.stageContext, rect, false, false);
    f.host.drawKartCatalogFrame(f.stageContext, rect, false, true);
    f.host.drawKartCatalogFrame(f.stageContext, rect, true);
    f.host.drawKartLevelBadge(f.stageContext,
      { kind: "kart", itemId: 7, engineGrade: 0 }, rect);
    f.host.drawKartLevelBadge(f.stageContext,
      { kind: "kart", itemId: 8, engineGrade: 9 }, rect);
    f.host.drawKartLevelBadge(f.stageContext,
      { kind: "character", itemId: 8, engineGrade: 9 }, rect);
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});
