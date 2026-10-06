import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  PerformanceCounter, durationDistribution,
} from "../src/ui/performance-counter.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = declarations.find(item =>
    item.id?.name === name || item.declarations?.some(declaration =>
      declaration.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};
const helperNames = ["qE", "Lo0", "KE", "jE", "vP", "XE", "Po0",
  "Fo0", "Do0", "Vo0", "i1", "$g", "No0", "De"];
const originalSource = `${sourceOf("Nv")}\nlet vc;\n${helperNames.map(sourceOf).join("\n")}
${sourceOf("ko0")}; return ko0;`;

function project(value) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Uint32Array) return [...value];
  if (Array.isArray(value)) return value.map(project);
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    key !== "longTaskObserver").map(([key, entry]) => [key, project(entry)]));
}

function runCounter(kind, options = {}) {
  const log = [];
  const NativeDate = globalThis.Date;
  const fixedDate = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : ["2026-10-06T00:00:00.000Z"])); }
  };
  const memory = { usedJSHeapSize: 8_000_000,
    totalJSHeapSize: 16_000_000, jsHeapSizeLimit: 32_000_000 };
  let clock = 0;
  const perf = { memory, now() { clock += 0.125; return clock; } };
  const observer = class {
    static supportedEntryTypes = options.observe ? ["longtask"] : [];
    constructor(callback) { log.push("observer created"); this.callback = callback; }
    observe(value) { log.push(["observe", value.entryTypes]); }
    disconnect() { log.push("disconnect"); }
  };
  const globals = ["Date", "performance", "PerformanceObserver",
    "navigator", "location", "window"];
  const saved = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({
    Date: fixedDate, performance: perf, PerformanceObserver: observer,
    navigator: { userAgent: "Test Agent", hardwareConcurrency: 8, deviceMemory: 4 },
    location: { href: "http://localhost/race" },
    window: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1.5 },
  })) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value });
  try {
    const Original = new Function(originalSource)();
    const owner = kind === "original" ? new Original() : new PerformanceCounter();
    const results = [];
    results.push(owner.recordFrame(16, 5, 50));
    owner.beginRace(100);
    results.push(owner.recordFrame(30, 10, 110));
    for (const [frame, work, at, heap] of [
      [16, 8, 120, 8_500_000], [20, 9, 140, 9_000_000],
      [45, 12, 180, 6_000_000], [8, 4, 300, 6_500_000],
      [33, 16, 1_450, 8_000_000],
    ]) {
      memory.usedJSHeapSize = heap;
      results.push(owner.recordFrame(frame, work, at));
    }
    owner.recordLongTasks({ getEntries: () => [
      { startTime: 90, duration: 80 },
      { startTime: 145, duration: 120 },
      { startTime: 1_400, duration: 60 },
    ] });
    owner.skipNextFrame();
    results.push(owner.recordFrame(100, 30, 1_470));
    const activeSummary = project(owner.summary());
    const activeReport = owner.formatReport();
    owner.clearPanelPeaks();
    memory.usedJSHeapSize = 8_500_000;
    owner.finishRace(1_500);
    results.push(owner.recordFrame(16, 8, 1_600));
    const finishedSummary = project(owner.summary());
    owner.dispose();
    return { log, results, activeSummary, activeReport,
      finishedSummary, fields: project(owner) };
  } finally {
    for (const name of globals) {
      const descriptor = saved[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("performance counter frame, heap and report behavior matches release", () => {
  for (const options of [{}, { observe: true }]) {
    assert.deepEqual(runCounter("rewritten", options),
      runCounter("original", options), JSON.stringify(options));
  }
});

test("duration histogram percentiles match release", () => {
  const Original = new Function(`${sourceOf("Nv")}\n${sourceOf("vP")}
    ${sourceOf("XE")}\n${sourceOf("jE")}; return jE;`)();
  for (const [samples, total, max] of [
    [[], 0, 0], [[2, 4, 1, 9], 25, 9],
    [[0, 0, 0, 10, 10, 10, 100], 130, 100],
  ]) {
    const hist = new Uint32Array(4_001);
    for (const duration of samples) hist[Math.min(4_000, Math.floor(duration / 0.5))]++;
    assert.deepEqual(durationDistribution(hist, samples.length, total, max),
      Original(hist, samples.length, total, max));
  }
});
