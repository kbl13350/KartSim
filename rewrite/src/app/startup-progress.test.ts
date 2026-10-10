import assert from "node:assert/strict";
import test from "node:test";
import { StartupProgress } from "./startup-progress";
import { loadStartupResources, type ResourceLoadingDependencies, type StartupHost,
  type StartupLibrary } from "./startup-resources";

test("all startup work is planned before loading; partial and repeated reports never regress", () => {
  const progress = new StartupProgress();
  assert.equal(progress.update("sources", 1), 10);
  assert.equal(progress.update("library", 50, 100), 15);
  assert.equal(progress.update("library", 0, 100), 15);
  assert.equal(progress.update("library", 100, 100), 20);
  assert.equal(progress.update("maps", 1), 30);
  assert.equal(progress.update("garage", 1), 40);
  assert.equal(progress.update("account", 1), 50);
  assert.equal(progress.update("profile", 1), 60);
  assert.equal(progress.update("ready", 1, 4), 70);
  assert.equal(progress.update("ready", 2, 4), 80);
  assert.equal(progress.update("ready", 3, 4), 90);
  assert.equal(progress.update("ready", 4, 4), 99, "100 belongs to successful completion");
  assert.equal(new StartupProgress().update("ready", 1, 0), 0);
  assert.equal(new StartupProgress().update("library", NaN, 100), 0);
  assert.equal(new StartupProgress().update("library", 100, Infinity), 0);
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function harness() {
  const samples: number[] = [];
  const errors: string[] = [];
  let generation = 0, finishes = 0, starts = 0, downloads = 0;
  const gates = { sources: deferred(), library: deferred(), garage: deferred(),
    maps: deferred(), account: deferred(), profile: deferred(), ready: deferred() };
  const profile = { equipment: { itemIds: { 1: 1, 3: 7 } } };
  const catalog = { karts: [{ itemId: 7 }], characters: [], equipment: [] };
  const selection = { trackId: "test", mapPath: "track.1s", vehicleItemId: 7 };
  const library: StartupLibrary = {
    files: ["file"], archives: [], errors: [], warnings: [],
    timeAttackGarageCatalog: async () => { await gates.garage.promise; return catalog; },
    mapCatalog: async () => { await gates.maps.promise; return []; },
    trackMetadata: async () => ({}),
  };
  const host = {
    assets: { beginGeneration: () => ++generation,
      isCurrent: (value: number) => value === generation, install() {} },
    hud: { beginStartupLoading: () => { starts++; samples.push(0); },
      setStartupProgress: (percent: number) => samples.push(percent),
      setLoadingProgress: () => { downloads++; },
      chooseResourceSource: async () => undefined, showDebugText() {},
      finishLoading: () => { finishes++; samples.push(100); },
      showLoadingError: (message: string) => errors.push(message) },
    userProfile: profile,
    prepareStartupReady: async (_library: unknown, _selection: unknown, _title: string,
      progress?: (current: number, total: number) => void) => {
      progress?.(3, 4);
      await gates.ready.promise;
      progress?.(4, 4);
    },
  } as unknown as StartupHost;
  let indexProgress: Parameters<NonNullable<ResourceLoadingDependencies["loadLibrary"]>>[2];
  let byteProgress: Parameters<ResourceLoadingDependencies["loadVersionedSources"]>[1];
  const dependencies: ResourceLoadingDependencies = {
    localResourcesSupported: () => false, recoverLocalSource: async () => undefined,
    defaultSourceName: "test", versionId: value => value,
    loadVersionedSources: async (_version, progress) => {
      byteProgress = progress;
      await gates.sources.promise;
      return { sources: [], archiveIndexes: {} };
    },
    loadLibrary: async (_sources, _indexes, progress) => {
      indexProgress = progress;
      progress?.({ current: 50, total: 100, filename: "test" });
      await gates.library.promise;
      return library;
    },
    ensureAccount: () => gates.account.promise,
    loadProfile: async () => { await gates.profile.promise; return profile; },
    defaultProfile: () => profile, resolveSelection: () => ({ selection, vehicleTitle: "test" }),
    isSpecialKartId: () => false, displayKartName: () => "test", localNickname: () => "test",
    needsRiderRegistration: () => false,
  };
  return { host, dependencies, gates, samples, errors,
    counts: () => ({ finishes, starts, downloads }), cancel: () => generation++,
    lateIndex: () => indexProgress?.({ current: 100, total: 100, filename: "test" }),
    lateBytes: () => byteProgress?.({ file: "test.rho", loadedBytes: 100, totalBytes: 100 }) };
}

test("startup tracks archive parsing, both catalogs, login, profile and scene before reaching 100", async () => {
  const state = harness();
  const run = loadStartupResources(state.host, state.dependencies);
  state.gates.sources.resolve(); await settle();
  assert.equal(state.samples.at(-1), 15);
  state.gates.library.resolve(); state.gates.maps.resolve(); await settle();
  assert.equal(state.samples.at(-1), 30, "the vehicle catalog is still pending");
  state.gates.garage.resolve(); await settle();
  assert.equal(state.samples.at(-1), 40, "login is still pending");
  state.gates.account.resolve(); await settle();
  assert.equal(state.samples.at(-1), 50, "profile is still pending");
  state.gates.profile.resolve(); await settle();
  assert.equal(state.samples.at(-1), 90, "the scene is still pending");
  assert.equal(state.counts().finishes, 0);
  state.gates.ready.resolve(); await run;
  assert.equal(state.samples.at(-1), 100);
  assert.deepEqual(state.samples, [...state.samples].sort((a, b) => a - b));
  const samples = [...state.samples];
  state.lateIndex(); state.lateBytes();
  assert.deepEqual(state.samples, samples, "index callbacks after completion are ignored");
  assert.equal(state.counts().downloads, 1, "subsequent lazy downloads still update the background badge");
});

test("a failed initialization stays incomplete; retry starts at zero and stale callbacks are ignored", async () => {
  const state = harness();
  let run = loadStartupResources(state.host, state.dependencies);
  state.gates.sources.resolve(); await settle();
  state.gates.library.resolve(); state.gates.maps.resolve();
  state.gates.garage.reject(new Error("catalog failed")); await run;
  assert.equal(state.counts().finishes, 0);
  assert.ok(state.samples.every(value => value < 100));
  assert.deepEqual(state.errors, ["catalog failed"]);
  const samples = [...state.samples];
  state.lateIndex(); state.lateBytes();
  assert.deepEqual(state.samples, samples);
  state.dependencies.loadLibrary = async () => ({ files: ["file"], archives: [], errors: [], warnings: [],
    timeAttackGarageCatalog: async () => ({ karts: [], characters: [], equipment: [] }),
    mapCatalog: async () => [], trackMetadata: async () => ({}) });
  run = loadStartupResources(state.host, state.dependencies);
  assert.equal(state.samples.at(-1), 0);
  await settle(); state.cancel(); state.gates.account.resolve(); await run;
  assert.equal(state.counts().starts, 2);
  assert.equal(state.counts().finishes, 0);
  const afterCancel = [...state.samples];
  state.lateIndex(); state.lateBytes();
  assert.deepEqual(state.samples, afterCancel);
});
