import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  fitGameViewport, mountGameViewport, resolveStartupSelection,
  watchFrontendVersion,
} from "../src/app/boot-support.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = declarations.find(item =>
    item.type === "FunctionDeclaration" && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};

test("startup catalog selection matches the release", () => {
  for (const scenario of [
    {}, { system: true }, { special: true }, { missingKart: true },
    { missingCharacter: true }, { missingTrack: true },
  ]) {
    const garage = {
      karts: [
        { itemId: 0, systemKey: "default", path: "kart/default", title: "Default" },
        { itemId: 2, path: "kart/2", title: "Two" },
        { itemId: 3, path: "kart/3", title: "Three" },
      ].filter(kart => !scenario.missingKart || kart.itemId !== 2),
      characters: scenario.missingCharacter ? []
        : [{ itemId: 10, path: "char/10" }],
    };
    const tracks = scenario.missingTrack ? [] : [{ path: "Track/Start" }];
    const profile = { equipment: { itemIds: { 3: scenario.special ? 3
      : scenario.system ? 0 : 2, 1: 10 },
      systemKart: "default", systemKartVariant: scenario.system ? "default" : undefined } };
    const fallback = { equipment: { itemIds: { 3: 2 } } };
    const calls = [];
    const deps = {
      gr: () => { calls.push("default profile"); return fallback; },
      b4: (karts, itemId, path, systemKey) => {
        calls.push(["resolve system", itemId, path, systemKey]);
        return karts.find(item => item.itemId === 0 && item.systemKey === systemKey);
      },
      n3: itemId => itemId === 3,
      Mw: itemId => `Kart ${itemId}`,
      jf: { mapPath: "track/start", trackId: "start" },
    };
    const Original = new Function("deps", `with (deps) { ${sourceOf("Rf0")}; return Rf0; }`)(deps);
    const run = kind => {
      calls.length = 0;
      try {
        const result = kind === "original"
          ? Original(garage, tracks, profile)
          : resolveStartupSelection(garage, tracks, profile, {
            defaultProfile: deps.gr, resolveSystemKart: deps.b4,
            isSpecialKartId: deps.n3, displayKartName: deps.Mw,
            startTrack: deps.jf,
          });
        return { result, calls: structuredClone(calls) };
      } catch (error) { return { error: error.message, calls: structuredClone(calls) }; }
    };
    assert.deepEqual(run("rewritten"), run("original"), JSON.stringify(scenario));
  }
});

test("viewport sizing matches the release over edge dimensions", () => {
  const Original = new Function(`${sourceOf("kf0")}; return kf0;`)();
  for (const [width, height, ratio] of [
    [1280, 720, 1], [1920, 1200, 2], [1024, 768, 1.25],
    [10, 10, 1], [0, 720, 1], [1280, Infinity, 1],
  ]) {
    const run = fn => { try { return fn(width, height, ratio); }
      catch (error) { return { error: error.message }; } };
    assert.deepEqual(run(fitGameViewport), run(Original));
  }
});

test("viewport root mount, resolution change and cleanup match the release", () => {
  const Original = new Function("deps", `with (deps) {
    ${sourceOf("kf0")}\n${sourceOf("Lf0")}; return Lf0;
  }`);
  const run = kind => {
    const calls = [];
    const handlers = new Map();
    const media = () => ({
      addEventListener(name, handler) { calls.push(["media add", name]); handlers.set("media", handler); },
      removeEventListener(name) { calls.push(["media remove", name]); },
    });
    const windowStub = {
      innerWidth: 1024, innerHeight: 768,
      matchMedia(query) { calls.push(["match", query]); return media(); },
      addEventListener(name, handler) { calls.push(["window add", name]); handlers.set(name, handler); },
      removeEventListener(name) { calls.push(["window remove", name]); },
    };
    const oldWindow = globalThis.window;
    globalThis.window = windowStub;
    const root = { style: { width: "old w", height: "old h",
      left: "old l", top: "old t" } };
    try {
      const cleanup = kind === "original"
        ? Original({ window: windowStub, xe: () => 1.5 })(root)
        : mountGameViewport(root, () => 1.5);
      const initial = structuredClone(root.style);
      windowStub.innerWidth = 1400;
      handlers.get("resize")();
      const resized = structuredClone(root.style);
      handlers.get("media")();
      const resolution = structuredClone(root.style);
      cleanup();
      return { calls, initial, resized, resolution, final: root.style };
    } finally { globalThis.window = oldWindow; }
  };
  assert.deepEqual(run("rewritten"), run("original"));
});

test("frontend update watcher matches release reload gating", async () => {
  const Original = new Function("deps", `with (deps) { ${sourceOf("If0")}; return If0; }`);
  const run = async kind => {
    const calls = [];
    const handlers = new Map();
    const marker = new Set();
    const windowStub = {
      location: { href: "http://localhost:8780/ready", reload() { calls.push("reload"); } },
      addEventListener(name, handler) { calls.push(["window add", name]); handlers.set(name, handler); },
      removeEventListener(name) { calls.push(["window remove", name]); },
    };
    const documentStub = {
      visibilityState: "visible",
      querySelector() { calls.push("current script"); return { src: "http://localhost:8780/old.js" }; },
      addEventListener(name, handler) { calls.push(["document add", name]); handlers.set(name, handler); },
      removeEventListener(name) { calls.push(["document remove", name]); },
    };
    const storage = {
      getItem(key) { calls.push(["storage get", key]); return marker.has(key) ? "1" : null; },
      setItem(key, value) { calls.push(["storage set", key, value]); marker.add(key); },
    };
    const fetchStub = async (url, options) => {
      calls.push(["fetch", url.pathname, options.cache, options.credentials]);
      return { ok: true, url: "http://localhost:8780/", headers: { get: () => "text/html" },
        async text() { calls.push("response text"); return "html"; } };
    };
    const parser = class { parseFromString() {
      calls.push("parse html");
      return { querySelector() { return { getAttribute: () => "/new.js" }; } };
    } };
    const saved = { window: globalThis.window, document: globalThis.document,
      fetch: globalThis.fetch, DOMParser: globalThis.DOMParser,
      sessionStorage: globalThis.sessionStorage };
    Object.assign(globalThis, { window: windowStub, document: documentStub,
      fetch: fetchStub, DOMParser: parser, sessionStorage: storage });
    try {
      const cleanup = kind === "original"
        ? Original({ window: windowStub, document: documentStub,
          fetch: fetchStub, DOMParser: parser, sessionStorage: storage })(() => true)
        : watchFrontendVersion(() => true);
      await new Promise(setImmediate);
      handlers.get("pageshow")();
      await new Promise(setImmediate);
      handlers.get("visibilitychange")();
      await new Promise(setImmediate);
      cleanup();
      return calls;
    } finally { Object.assign(globalThis, saved); }
  };
  assert.deepEqual(await run("rewritten"), await run("original"));
});
