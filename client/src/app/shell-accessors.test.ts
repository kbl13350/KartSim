import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  getActiveWindowNotice, mountDevTools, mountDevToolsTrackObjectsOverlay,
  mountDevToolsTrackOverlay, onApplicationViewportResize,
  readPresenterClock, setActiveWindowNotice, setDevToolsTrackObjectKind,
  writePresenterClock, type PresenterClock, type ShellAccessorHost,
} from "./shell-accessors";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const clocks: PresenterClock[] = [
  "previousRenderTime", "lastUpdateMs", "presentationClockMs", "fps", "maxRafDelayMs",
];
const hooks = [
  "mountDevTools", "setDevToolsTrackObjectKind",
  "mountDevToolsTrackOverlay", "mountDevToolsTrackObjectsOverlay",
] as const;
const selected = new Set([...clocks, "activeWindowNotice", "onViewportResize", ...hooks]);
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, 17);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type TestedHost = ShellAccessorHost & {
  onViewportResize: () => void;
  activeWindowNotice: unknown;
  mountDevTools(): void;
  setDevToolsTrackObjectKind(kind: unknown, visible: unknown): void;
  mountDevToolsTrackOverlay(): void;
  mountDevToolsTrackObjectsOverlay(): void;
  [key: string]: unknown;
};

function inspect(rewritten: boolean): unknown {
  const events: unknown[][] = [];
  const Original = new Function(`return class { ${originalSource} };`)() as new () => TestedHost;
  const host = new Original();
  const values: Record<PresenterClock, unknown> = {
    previousRenderTime: 1,
    lastUpdateMs: 2,
    presentationClockMs: 3,
    fps: 4,
    maxRafDelayMs: 5,
  };
  const presenter = {} as Record<PresenterClock, unknown>;
  for (const clock of clocks) {
    Object.defineProperty(presenter, clock, {
      get: () => { events.push(["read-clock", clock]); return values[clock]; },
      set: (value: unknown) => { events.push(["write-clock", clock, value]); values[clock] = value; },
    });
  }
  let notice: unknown = "notice-1";
  const ready = {
    getWindowNotice: () => { events.push(["get-notice"]); return notice; },
    setWindowNotice: (value: unknown) => {
      events.push(["set-notice", value]); notice = value;
    },
  };
  Object.defineProperties(host, {
    presenter: { get: () => { events.push(["get-presenter"]); return presenter; } },
    ready: { get: () => { events.push(["get-ready"]); return ready; } },
  });
  host.configureBackbuffer = () => { events.push(["configure-backbuffer"]); };

  if (rewritten) {
    for (const clock of clocks) {
      Object.defineProperty(host, clock, { configurable: true,
        get: () => readPresenterClock(host, clock),
        set: value => writePresenterClock(host, clock, value),
      });
    }
    Object.defineProperty(host, "activeWindowNotice", { configurable: true,
      get: () => getActiveWindowNotice(host),
      set: value => setActiveWindowNotice(host, value),
    });
    Object.defineProperty(host, "onViewportResize", {
      configurable: true, enumerable: true, writable: true,
      value: () => onApplicationViewportResize(host),
    });
    host.mountDevTools = () => mountDevTools();
    host.setDevToolsTrackObjectKind = (kind, visible) =>
      setDevToolsTrackObjectKind(kind, visible);
    host.mountDevToolsTrackOverlay = () => mountDevToolsTrackOverlay();
    host.mountDevToolsTrackObjectsOverlay = () => mountDevToolsTrackObjectsOverlay();
  }

  const clockSnapshots: unknown[] = [];
  for (const [index, clock] of clocks.entries()) {
    const before = host[clock];
    host[clock] = 100 + index;
    clockSnapshots.push({ clock, before, after: host[clock] });
  }
  const firstNotice = host.activeWindowNotice;
  host.activeWindowNotice = "notice-2";
  const secondNotice = host.activeWindowNotice;
  const resizeHandler = host.onViewportResize;
  const stableResizeHandler = resizeHandler === host.onViewportResize;
  resizeHandler.call({ unrelated: true });
  const hookResults = hooks.map(name => {
    const callback = host[name] as (...args: unknown[]) => unknown;
    return { name, arity: callback.length, result: callback.call(host, "item", false) };
  });
  return {
    clockSnapshots, firstNotice, secondNotice, stableResizeHandler,
    resizeIsOwnEnumerable: Object.keys(host).includes("onViewportResize"),
    hookResults, events,
  };
}

test("clock, notice, resize and empty diagnostic members match release", () => {
  assert.deepEqual(inspect(true), inspect(false));
});
