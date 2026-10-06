import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RaceLoadingScreen } from "./race-loading-screen";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class gy {");
const end = release.indexOf("\nfunction _F(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

interface FakeNode {
  kind: string;
  width: number;
  height: number;
  hidden: boolean;
  textContent: string | null;
  className: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  setAttribute(name: string, value: string): void;
  append(...children: FakeNode[]): void;
  remove(): void;
  getContext(kind: string): FakeContext | null;
  getBoundingClientRect(): { height: number };
}

interface FakeContext {
  font: string;
  textAlign: string;
  textBaseline: string;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: string;
  fillStyle: string;
  clearRect(...args: number[]): void;
  drawImage(image: FakeNode, ...args: number[]): void;
  putImageData(image: { width: number; height: number; data: Uint8ClampedArray }, ...args: number[]): void;
  strokeText(message: string, ...args: number[]): void;
  fillText(message: string, ...args: number[]): void;
}

function fakeDom(events: unknown[][], zeroHeight: boolean, noContext: boolean) {
  let canvasCount = 0;
  function makeNode(kind: string): FakeNode {
    const id = kind === "canvas" ? `canvas-${++canvasCount}` : kind;
    const context = {
      font: "", textAlign: "", textBaseline: "", strokeStyle: "",
      lineWidth: 0, lineJoin: "", fillStyle: "",
      clearRect(...args: number[]) { events.push(["clear", id, ...args]); },
      drawImage(image: FakeNode, ...args: number[]) {
        events.push(["draw", id, image.kind, ...args]);
      },
      putImageData(image: { width: number; height: number; data: Uint8ClampedArray }, ...args: number[]) {
        events.push(["pixels", id, image.width, image.height, [...image.data], ...args]);
      },
      strokeText(message: string, ...args: number[]) {
        events.push(["stroke", id, message, ...args, this.font, this.lineWidth]);
      },
      fillText(message: string, ...args: number[]) {
        events.push(["fill", id, message, ...args, this.fillStyle]);
      },
    } as FakeContext;
    return {
      kind: id, width: 0, height: 0, hidden: false, textContent: null,
      className: "", dataset: {}, style: {},
      setAttribute(name, value) { events.push(["attribute", id, name, value]); },
      append(...children) { events.push(["append", id, children.map(child => child.kind)]); },
      remove() { events.push(["remove", id]); },
      getContext(type) {
        events.push(["context", id, type]);
        return noContext && id === "canvas-2" ? null : context;
      },
      getBoundingClientRect() { return { height: zeroHeight ? 0 : 450 }; },
    };
  }
  const root = makeNode("root");
  const observed: FakeNode[] = [];
  const globals = {
    document: { createElement: (kind: string) => makeNode(kind) },
    window: { innerWidth: 1200 },
    ResizeObserver: class {
      constructor(_callback: () => void) { events.push(["observer-new"]); }
      observe(node: FakeNode) { observed.push(node); events.push(["observe", node.kind]); }
      disconnect() { events.push(["disconnect"]); }
    },
    ImageData: class {
      constructor(readonly data: Uint8ClampedArray,
        readonly width: number, readonly height: number) {}
    },
  };
  return { root, globals, observed, makeNode };
}

async function observe(rewritten: boolean, variant: "normal" | "zero-height" | "no-context") {
  const events: unknown[][] = [];
  const dom = fakeDom(events, variant === "zero-height", variant === "no-context");
  const globalRecord = globalThis as unknown as Record<string, unknown>;
  const previous = Object.fromEntries(Object.keys(dom.globals).map(key => [key, globalRecord[key]]));
  Object.assign(globalRecord, dom.globals);
  try {
    const imageBytes = async (_library: unknown, roots: string[], name: string) => {
      events.push(["asset", roots, name]);
      return Uint8Array.from([3, 4]);
    };
    const decodeImage = async (bytes: Uint8Array) => {
      events.push(["decode", [...bytes]]);
      return { width: 160, height: 90, pixels: [1, 2, 3, 4] };
    };
    let screen: RaceLoadingScreen | undefined;
    let error: string | undefined;
    try {
      if (rewritten) {
        class Screen extends RaceLoadingScreen {}
        screen = await Screen.load({ name: "library" }, dom.root as unknown as HTMLElement,
          { imageBytes, decodeImage });
      } else {
        const Legacy = new Function("p2", "U1", `${originalClass}\nreturn gy;`)(
          decodeImage, (_library: unknown, roots: string[], name: string) => ({
            bytes: () => imageBytes(_library, roots, name),
          }),
        ) as { load(library: unknown, root: FakeNode): Promise<RaceLoadingScreen> };
        screen = await Legacy.load({ name: "library" }, dom.root);
      }
      screen.show(2, 7);
      screen.paint();
      screen.hide();
      screen.dispose();
      screen.show(7, 7);
      screen.paint();
    } catch (failure) {
      error = (failure as Error).message;
    }
    return { events, error, state: screen && {
      disposed: screen.disposed,
      hidden: screen.element.hidden,
      progress: screen.progress.textContent,
      board: [screen.board.width, screen.board.height],
      observed: dom.observed.length,
    } };
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalRecord[key];
      else globalRecord[key] = value;
    }
  }
}

test("multiplayer loading screen drawing and lifecycle match the release", async () => {
  for (const variant of ["normal", "zero-height", "no-context"] as const) {
    assert.deepEqual(await observe(true, variant), await observe(false, variant), variant);
  }
});
