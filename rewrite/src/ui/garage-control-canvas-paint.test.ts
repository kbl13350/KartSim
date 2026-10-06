import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  garageCssLength, paintGarageControlBox, paintGarageControlCharacter,
  splitGarageCssLayers,
} from "./garage-control-canvas-paint";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name: string): string {
  const node = nodes.find(candidate =>
    candidate.type === "FunctionDeclaration" && candidate.id?.name === name);
  assert.ok(node);
  return release.slice(node.start!, node.end!);
}
const Original = new Function(
  ["Fe", "Cs", "Ie", "Ei", "Si"].map(sourceOf).join("\n") +
  ";return { Fe, Ie, Ei, Si };",
)() as {
  Fe: typeof splitGarageCssLayers;
  Ie: typeof garageCssLength;
  Ei: typeof paintGarageControlBox;
  Si: typeof paintGarageControlCharacter;
};

function contextFixture() {
  const events: unknown[] = [];
  const base = {
    save: () => { events.push("save"); },
    restore: () => { events.push("restore"); },
    beginPath: () => { events.push("begin"); },
    closePath: () => { events.push("close"); },
    clip: () => { events.push("clip"); },
    moveTo: (...args: unknown[]) => { events.push(["move", ...args]); },
    lineTo: (...args: unknown[]) => { events.push(["line", ...args]); },
    rect: (...args: unknown[]) => { events.push(["rect", ...args]); },
    fillRect: (...args: unknown[]) => { events.push(["fill", ...args]); },
    strokeRect: (...args: unknown[]) => { events.push(["stroke", ...args]); },
    drawImage: (image: { key: string }, ...args: unknown[]) =>
      { events.push(["image", image.key, ...args]); },
    fillText: (...args: unknown[]) => { events.push(["text", ...args]); },
    measureText: (_character: string) => ({ fontBoundingBoxAscent: 9 }),
    createLinearGradient: (...args: unknown[]) => {
      events.push(["gradient", ...args]);
      const stops: unknown[] = [];
      return { stops, addColorStop: (position: number, color: string) => {
        stops.push([position, color]);
        events.push(["stop", position, color]);
      } };
    },
  };
  const context = new Proxy(base, {
    set(target, property, value) {
      events.push(["set", String(property), value?.stops ?? value]);
      Reflect.set(target, property, value);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, events };
}

function style(overrides: Record<string, string> = {}): CSSStyleDeclaration {
  return {
    clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
    backgroundColor: "rgb(1 2 3)",
    boxShadow: "rgba(0, 0, 0, .5) 2px -3px 4px 5px inset",
    backgroundImage: 'url("texture.png"), linear-gradient(red 0%, blue 100%)',
    backgroundSize: "contain",
    backgroundPositionX: "50%",
    backgroundPositionY: "25%",
    borderTopWidth: "1px", borderTopColor: "red",
    borderBottomWidth: "2px", borderBottomColor: "blue",
    borderLeftWidth: "3px", borderLeftColor: "green",
    borderRightWidth: "4px", borderRightColor: "yellow",
    outlineStyle: "solid", outlineWidth: "2px",
    outlineOffset: "1px", outlineColor: "purple",
    font: "14px Test", color: "#abcdef",
    textShadow: "rgba(0, 0, 0, .5) 1px 2px 3px, rgba(1, 2, 3, .4) -2px 0px",
    ...overrides,
  } as CSSStyleDeclaration;
}

test("CSS layer splitting and authored lengths match Fe/Ie", () => {
  for (const value of [
    "", "none", "a,b", "rgba(1, 2, 3, .5), url(x)",
    "linear-gradient(red, rgba(1, 2, 3, .5)), url(y)",
  ]) {
    assert.deepEqual(splitGarageCssLayers(value), Original.Fe(value));
  }
  for (const value of ["50%", "-12.5%", "3px", "auto", "0", "-2.5px"])
    assert.equal(garageCssLength(value, 240), Original.Ie(value, 240));
});

test("Garage CSS box polygon, inset shadow, image, gradient, border and outline match Ei", () => {
  const rect = { x: 10, y: 20, width: 120, height: 80 };
  const bitmap = { key: "texture", naturalWidth: 40, naturalHeight: 20 } as
    HTMLImageElement & { key: string };
  const image = (url: string) => url === "texture.png" ? bitmap : undefined;
  const run = (released: boolean, customStyle: CSSStyleDeclaration) => {
    const { context, events } = contextFixture();
    if (released) Original.Ei(context, customStyle, rect, image);
    else paintGarageControlBox(context, customStyle, rect, image);
    return events;
  };
  for (const customStyle of [
    style(),
    style({ clipPath: "none", boxShadow: "none", backgroundImage: "none",
      outlineStyle: "none" }),
    style({ backgroundSize: "12px 24px", backgroundPositionX: "4px",
      backgroundPositionY: "5px" }),
  ]) {
    assert.deepEqual(run(false, customStyle), run(true, customStyle));
  }
});

test("Garage text shadows and baseline match Si", () => {
  const rect = { x: 11, y: 22, width: 33, height: 44 };
  const run = (released: boolean, textShadow: string) => {
    const { context, events } = contextFixture();
    const customStyle = style({ textShadow });
    if (released) Original.Si(context, customStyle, "A", rect);
    else paintGarageControlCharacter(context, customStyle, "A", rect);
    return events;
  };
  for (const shadow of ["none", "rgba(0, 0, 0, .5) 1px 2px 3px",
    "rgba(1, 2, 3, .4) -2px 0px, rgba(4, 5, 6, .6) 1px 1px 2px"])
    assert.deepEqual(run(false, shadow), run(true, shadow));
});
