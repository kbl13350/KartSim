import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeTrackInfoCard, loadTrackInfoCard,
  type TrackCardLoadDependencies, type TrackCardLoadOptions,
} from "./track-info-card-loading";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class M7 {");
const end = release.indexOf("\nfunction ys0(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "normal" | "reverse" | "disabled" | "missing-card" |
  "missing-bgm" | "duplicate-bgm" | "missing-strings" |
  "bad-frame" | "bad-label" | "bad-reverse" |
  "bad-difficulty" | "font-error" | "canvas-error";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const paths = {
    bgm: "etc_/bgmList.xml", strings: "etc_/baseStringBag.xml",
    card: "card/example",
  };
  const dimensions = (path: string) => path.endsWith("trackcard.png")
    ? { width: variant === "bad-frame" ? 299 : 300, height: 180 }
    : path.endsWith("trackInfoLabel.png")
      ? { width: 300, height: variant === "bad-label" ? 49 : 50 }
      : path.endsWith("큰리버스트랙.png")
        ? { width: variant === "bad-reverse" ? 101 : 100, height: 80 }
        : { width: 100, height: 80 };
  function source(path: string) {
    return { path, async bytes() { events.push(["bytes", path]);
      return Uint8Array.from([1]); },
    async text() { events.push(["text", path]); return path; } };
  }
  const library = {
    get(path: string) { events.push(["get", path]);
      return path === paths.card && variant === "missing-card"
        ? undefined : source(path); },
    exactCanonicalCandidates(path: string) {
      events.push(["candidates", path]);
      if (path === paths.bgm && variant === "missing-bgm") return [];
      if (path === paths.bgm && variant === "duplicate-bgm") {
        return [source(path), source(path)];
      }
      if (path === paths.strings && variant === "missing-strings") return [];
      return [source(path)];
    },
  };
  const layout = { width: 300, height: 220, cardHeight: 180,
    stripHeight: 25, stripCount: 2, stripIndex: 0,
    trackRect: { x: 0, y: 0, width: 100, height: 80 } };
  const options: TrackCardLoadOptions = {
    library, root: { append() { events.push(["append"]); } },
    trackDirectory: "example", trackId: variant === "reverse"
      || variant === "bad-reverse" ? "example_rvs" : "example",
    trackTitle: "赛道", difficulty: variant === "bad-difficulty" ? -1 : 4,
    game: { team: 1, modeKey: "mode", speed: 2 },
  };
  const context = {};
  const canvas = { style: {}, dataset: {},
    setAttribute(name: string, value: string) {
      events.push(["attribute", name, value]);
    },
    getContext(type: string, options: unknown) {
      events.push(["context", type, options]);
      return variant === "canvas-error" ? null : context;
    },
  };
  const document = { createElement(name: string) {
    events.push(["create", name]); return canvas;
  } };
  class ResizeObserver {
    constructor(_callback: () => void) { events.push(["observer"]); }
    observe(_root: unknown) { events.push(["observe"]); }
  }
  const window = { addEventListener(name: string) { events.push(["window", name]); } };
  const deps = {
    configEnabled: async () => { events.push(["enabled"]);
      return variant !== "disabled"; },
    cardPath: (directory: string) => { events.push(["card-path", directory]);
      return paths.card; },
    parseXml: (text: string, path: string) => {
      events.push(["xml", text, path]); return new Map([["mode", "竞速"]]);
    },
    gameLabels: (_game: unknown, _labels: unknown) => {
      events.push(["game-labels"]); return { gameSpeed: "标准" };
    },
    uniqueResource: (value: typeof library, path: string) => {
      events.push(["resource", value === library, path]); return source(path);
    },
    parseNode: (_bytes: Uint8Array) => { events.push(["parse-node"]);
      return { name: "window" }; },
    layout: (_node: unknown) => { events.push(["layout"]); return layout; },
    stripIndex: (value: unknown, team: number | undefined) => {
      events.push(["strip", value, team]); return team;
    },
    decodeImage: async (entry: ReturnType<typeof source>) => {
      events.push(["decode", entry.path]);
      return { image: entry.path, ...dimensions(entry.path) };
    },
    difficultyLayout: (_node: unknown, rect: unknown, text: unknown,
      glyphs: unknown) => { events.push(["difficulty-layout", rect, text, glyphs]);
      return { id: "difficulty" }; },
    registerFont: async (family: string, _bytes: Uint8Array) => {
      events.push(["font", family]);
      if (variant === "font-error") throw new Error("font failed");
      return "font-owner";
    },
    releaseFont: (font: unknown) => { events.push(["font-release", font]); },
    title: (title: string, trackId: string) => {
      events.push(["title", title, trackId]); return `[反]${title}`;
    },
  };
  const originalDeps = {
    xs0: deps.configEnabled, ds0: deps.cardPath,
    qd: paths.bgm, Kd: paths.strings,
    DE: deps.parseXml, ws0: deps.gameLabels,
    Gn: deps.uniqueResource,
    s2: deps.parseNode, Ss0: deps.layout, ps0: deps.stripIndex,
    yi: deps.decodeImage, bs0: deps.difficultyLayout,
    f5: deps.registerFont, G1: deps.releaseFont,
    Og: "P3553 Source Han Sans CN TrackInfoCard", fs0: deps.title,
    ns0: "gui_/windowTemplate/trackInfoCard.bml",
    is0: "gui_/windowTemplate/trackcard.png",
    rs0: "gui_/windowTemplate/trackInfoLabel.png",
    cs0: "stage_/common/큰리버스트랙.png",
    ss0: "gui_/windowTemplate/trackDifficulty.bml",
    os0: "gui_/windowTemplate/난이도text@cn.png",
    as0: "gui_/windowTemplate/난이도원.png",
    ls0: "gui_/font/SourceHanSansCN-Bold.otf",
    document, ResizeObserver, window,
  };
  const Original = new Function(...Object.keys(originalDeps),
    `${originalClass}\nreturn M7;`)(...Object.values(originalDeps)) as {
      new (...args: unknown[]): { trackTitle: string; trackDifficulty?: number;
        bgmTitles: Map<string, string>; gameLabels: unknown;
        assets: Record<string, unknown>; adjustX: number };
      load(options: TrackCardLoadOptions): Promise<unknown>;
      prototype: { render(): void };
    };
  Original.prototype.render = () => { events.push(["render"]); };
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = Object.fromEntries(["ResizeObserver", "window"].map(
    key => [key, globals[key]]));
  Object.assign(globals, { ResizeObserver, window });
  try {
    let value: Awaited<ReturnType<typeof Original.load>> | undefined;
    let error: string | undefined;
    try {
      value = rewritten
        ? await loadTrackInfoCard(options, {
          ...deps,
          create: (root, title, difficulty, bgm, labels, assets) =>
            new Original(root, title, difficulty, bgm, labels, assets),
        } as TrackCardLoadDependencies<unknown>)
        : await Original.load(options);
    } catch (failure) { error = (failure as Error).message; }
    const card = value as InstanceType<typeof Original> | undefined;
    return { events, error, card: card && {
      title: card.trackTitle, difficulty: card.trackDifficulty,
      bgm: [...card.bgmTitles], labels: card.gameLabels,
      adjustX: card.adjustX,
      assets: card.assets,
    } };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globals[key];
      else globals[key] = value;
    }
  }
}

test("track card resource selection, validation and font cleanup match release", async () => {
  for (const variant of ["normal", "reverse", "disabled", "missing-card",
    "missing-bgm", "duplicate-bgm", "missing-strings", "bad-frame",
    "bad-label", "bad-reverse", "bad-difficulty", "font-error",
    "canvas-error"] as const) {
    assert.deepEqual(await observe(true, variant), await observe(false, variant), variant);
  }
});

test("track card constructor preserves canvas setup and owner publication", () => {
  const events: unknown[][] = [];
  const root = { append() { events.push(["append"]); } } as unknown as HTMLElement;
  const canvas = { style: {}, dataset: {},
    setAttribute(name: string, value: string) {
      events.push(["attribute", name, value]);
    },
    getContext() { events.push(["context"]); return {} as CanvasRenderingContext2D; },
  } as unknown as HTMLCanvasElement;
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { ResizeObserver: globals.ResizeObserver, window: globals.window };
  globals.ResizeObserver = class {
    constructor(_callback: () => void) { events.push(["observer"]); }
    observe() { events.push(["observe"]); }
  };
  globals.window = { addEventListener(name: string) { events.push(["window", name]); } };
  try {
    const owner = { canvas, render() { events.push(["render"]); },
      onWindowResize: () => undefined } as Parameters<typeof initializeTrackInfoCard>[0];
    initializeTrackInfoCard(owner, root, "赛道", 3, new Map(), {},
      { layout: { adjustX: 5 } });
    assert.deepEqual(events, [["context"], ["attribute", "aria-hidden", "true"],
      ["append"], ["observer"], ["observe"], ["window", "resize"],
      ["render"]]);
    assert.equal(owner.adjustX, 5);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globals[key];
      else globals[key] = value;
    }
  }
});
