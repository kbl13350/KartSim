import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  compareGarageUpgradeLevels, drawGaragePreparation, drawPreparationCards,
  fillPreparationMethodPanel, preparationMethodPanelRect,
  type GaragePreparationRenderHost,
} from "./garage-upgrade-preparation-render";
import { GarageUpgradePreparationState } from "./garage-progression-session";
import type { XunGarageProgression } from "./garage-progression-panel";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name: string): string {
  const node = nodes.find(candidate =>
    (candidate.type === "ClassDeclaration" || candidate.type === "FunctionDeclaration") &&
    candidate.id?.name === name);
  assert.ok(node);
  return release.slice(node.start!, node.end!);
}
const oldCompare = new Function(sourceOf("Za") + ";return Za;")() as
  typeof compareGarageUpgradeLevels;
const oldCards = new Function(sourceOf("en") + ";return en;")() as
  typeof drawPreparationCards;
const oldPanel = new Function(sourceOf("Ya") + ";return Ya;")() as
  typeof fillPreparationMethodPanel;

function fixture(released: boolean, disposed = false, loaded = true) {
  const events: unknown[] = [];
  const image = (name: string) => ({ name, width: 90, height: 45 });
  const images = new Map([
    ["frame", image("frame")], ["tuning_upgradePopupBg", image("background")],
    ["tuning_arrow_g", image("arrow-first")],
    ["tuning_arrow_g_s", image("arrow-more")],
    ["cardNormal", image("normal")], ["cardSelected", image("selected")],
  ]);
  const context = {
    canvas: { getBoundingClientRect: () => ({ width: 800, height: 450 }) },
    imageSmoothingEnabled: false,
    fillStyle: "",
    clearRect: (...args: unknown[]) => { events.push(["clear", ...args]); },
    drawImage: (source: { name: string }, ...args: unknown[]) => {
      events.push(["draw-image", source.name, ...args]);
    },
    save: () => { events.push("save"); },
    fillRect: (...args: unknown[]) => { events.push(["fill", ...args]); },
    restore: () => { events.push("restore"); },
  } as unknown as CanvasRenderingContext2D;
  const value = (level: number): XunGarageProgression => ({
    kind: "xun", level, skills: [
      { id: 1, points: 0 }, { id: 2, points: 0 }, { id: 3, points: 0 },
    ],
  });
  const state = new GarageUpgradePreparationState(
    Array.from({ length: 3 }, (_, itemId) => ({
      item: { itemId, engineGrade: 9, title: "Vehicle " + itemId },
      value: value(2),
    })), 1, {
      blockedKart: () => false,
      validate: () => undefined,
      nextLevel: entry => ({ ...entry, level: entry.level + 1 }),
    });
  const assets = {
    frame: "frame-map",
    rect: { x: 50, y: 60, width: 700, height: 400 },
    rects: new Map([
      ["ImageBoard", { x: 4, y: 5, width: 10, height: 12 }],
      ["itemView", { x: 14, y: 15, width: 110, height: 80 }],
      ["kartSelector", { x: 100, y: 200, width: 400, height: 200 }],
      ["arrow0", { x: 21, y: 22, width: 30, height: 31 }],
      ["arrow1", { x: 41, y: 42, width: 50, height: 51 }],
      ["arrow2", { x: 61, y: 62, width: 70, height: 71 }],
    ]),
    cardLayout: {
      width: 80, height: 50, columns: 2, horizontalMargin: 6,
      verticalMargin: 7, clientLeft: 8, clientTop: 9,
    },
    images,
  };
  const fitCanvas = (_canvas: HTMLCanvasElement, _context: CanvasRenderingContext2D,
    width: number, height: number, ratio: number, logicalWidth: number,
    logicalHeight: number) => {
    events.push(["fit", width, height, ratio, logicalWidth, logicalHeight]);
  };
  const pixelRatio = () => { events.push("pixel-ratio"); return 2; };
  const drawFrame = (_context: CanvasRenderingContext2D, frame: unknown,
    atlas: CanvasImageSource, rect: unknown) => {
    events.push(["frame", frame, (atlas as { name: string }).name, rect]);
  };
  const Original = new Function(
    "Pe", "Ee", "be", "ss",
    sourceOf("Ya") + "\n" + sourceOf("en") + "\n" + sourceOf("Ja") + "\nreturn Ja;",
  )(fitCanvas, pixelRatio, drawFrame, preparationMethodPanelRect) as
    new (...args: never[]) => GaragePreparationRenderHost & {
      draw(presenter: unknown): void;
    };
  const host = released
    ? Object.create(Original.prototype) as InstanceType<typeof Original>
    : {} as GaragePreparationRenderHost;
  Object.assign(host, { context, assets: loaded ? assets : undefined, state, disposed });
  const presenter = {
    drawCard: (_context: CanvasRenderingContext2D,
      item: { itemId: number }, rect: unknown) => {
      events.push(["card", item.itemId, rect]);
    },
  };
  const draw = () => {
    if (released) (host as InstanceType<typeof Original>).draw(presenter);
    else drawGaragePreparation(host, presenter, { fitCanvas, pixelRatio, drawFrame });
  };
  return { draw, snapshot: () => ({ events, smoothing: context.imageSmoothingEnabled }) };
}

test("XUN level comparison and BML upgrade panel geometry match Za/ss/Ya", () => {
  for (const current of [0, 2, 3, 5]) {
    for (const next of [current, 5]) {
      assert.deepEqual(compareGarageUpgradeLevels(current, next),
        oldCompare(current, next));
    }
  }
  const errorMessage = (action: () => unknown) => {
    try { action(); return undefined; }
    catch (error) { return (error as Error).message; }
  };
  for (const [current, next] of [[-1, 2], [3, 2], [2, 6], [2.5, 3]] as
    Array<[number, number]>) {
    assert.equal(errorMessage(() => compareGarageUpgradeLevels(current, next)),
      errorMessage(() => oldCompare(current, next)));
  }
  const rect = preparationMethodPanelRect();
  assert.deepEqual(rect, { x: 186, y: 526, width: 519, height: 210 });
  const events: unknown[] = [];
  const context = {
    save: () => events.push("save"),
    restore: () => events.push("restore"),
    fillRect: (...args: unknown[]) => events.push(["fill", ...args]),
    set fillStyle(value: string) { events.push(["color", value]); },
  } as unknown as CanvasRenderingContext2D;
  fillPreparationMethodPanel(context, rect);
  const newEvents = structuredClone(events);
  events.length = 0;
  oldPanel(context, rect);
  assert.deepEqual(newEvents, events);
});

test("vehicle card backgrounds, previews and selected overlay match en/Ja.draw", () => {
  for (const disposed of [false, true]) {
    for (const loaded of [false, true]) {
      const rewritten = fixture(false, disposed, loaded);
      const original = fixture(true, disposed, loaded);
      rewritten.draw();
      original.draw();
      assert.deepEqual(rewritten.snapshot(), original.snapshot());
    }
  }
  const events: unknown[] = [];
  const context = {
    drawImage: (image: { name: string }, ...args: unknown[]) =>
      events.push(["image", image.name, ...args]),
  } as unknown as CanvasRenderingContext2D;
  const presenter = {
    drawCard: (_context: CanvasRenderingContext2D,
      item: { itemId: number }, rect: unknown) => events.push(["card", item.itemId, rect]),
  };
  const cards = [
    { item: { itemId: 1, engineGrade: 9, title: "A" },
      rect: { x: 1, y: 2, width: 3, height: 4 } },
    { item: { itemId: 2, engineGrade: 9, title: "B" },
      rect: { x: 5, y: 6, width: 7, height: 8 } },
  ];
  const normal = { name: "normal" } as unknown as CanvasImageSource;
  const selected = { name: "selected" } as unknown as CanvasImageSource;
  drawPreparationCards(context, presenter, cards, 2, normal, selected);
  const rewritten = structuredClone(events);
  events.length = 0;
  oldCards(context, presenter, cards, 2, normal, selected);
  assert.deepEqual(rewritten, events);
});
