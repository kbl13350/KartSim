import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { loadTrackMap, loadTimeAttackMap, loadMultiplayerMap } from "../src/vehicle/load-track-map.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "ul");
assert.ok(declaration);
const originalClass = release.slice(declaration.start, declaration.end);

function normalize(value) {
  if (value === undefined) return "[undefined]";
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Uint8Array) return [...value];
  if (value instanceof Map) return [...value].map(([key, entry]) =>
    [normalize(key), normalize(entry)]);
  if (Array.isArray(value)) return value.map(normalize);
  if (value.name) return value.name;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
    [key, normalize(entry)]));
}

function fixture(options = {}) {
  const calls = [];
  const log = (label, ...args) => calls.push([label, ...args.map(normalize)]);
  const method = (label, result) => (...args) => { log(label, ...args); return result; };
  const asyncMethod = (label, result) => async (...args) => {
    log(label, ...args);
    if (options.failAt === label) throw new Error(`${label} failed`);
    return result;
  };
  const disposable = name => ({ name, object: { name: `${name} object` },
    dispose() { log("dispose", name); } });
  const model = { name: "track model", root: {
    kind: options.invalidRoot ? "node" : "track",
    trackObjects: options.minimaps === 0 ? [] : options.minimaps === 2
      ? [{ kind: "ToMinimap", name: "m1" }, { kind: "ToMinimap", name: "m2" }]
      : [{ kind: "ToMinimap", name: "minimap" }],
  } };
  const asset = {
    extension: options.badAsset ? "rho" : "1s",
    name: options.badAsset ? "bad.rho" : "track.1s",
    virtualPath: "track/path/track.1s", sourceKind: "rho",
    sourceName: "track.rho", containerId: options.noProvenance ? undefined : "c1",
    canonicalPath: "track/path/track.1s",
    async bytes() { log("asset bytes"); return new Uint8Array([1]); },
  };
  const metadata = options.noMetadata ? undefined : {
    id: "track_id", cnTitle: options.noTitle ? "" : "轨道",
    laps: options.noLaps ? undefined : 3,
    gameType: options.badGameType ? "battle" : "speed",
    blocked: !!options.blocked,
    choosable: !options.unchoosable,
  };
  const readyAsset = { sourceName: "stage_common.rho", name: "readyCamera.1s",
    async bytes() { log("ready bytes"); return new Uint8Array([2]); } };
  const skyAsset = { virtualPath: "track/path/skydome.1s",
    async bytes() { log("sky bytes"); return new Uint8Array([3]); } };
  const library = {
    name: "library", files: options.noReady ? [] : [readyAsset],
    async trackMetadata(trackId) { log("metadata", trackId); return metadata; },
    findSibling(path, paths) {
      log("sibling", path, paths);
      return options.sky ? skyAsset : undefined;
    },
  };
  const host = {
    toonStageBinding: { name: "stage binding" },
    generationValue: method("generation", 3),
    requireAsset: method("require asset", asset),
    getLibrary: method("library", options.noLibrary ? undefined : library),
    isGenerationCurrent: method("generation current", !options.changedGeneration),
  };
  const course = { name: "course", records: options.unsupportedSurface
    ? [{ occurrence: { kind: "route-surface" }, reason: "unknown" }]
    : options.warpRoute
      ? [{ occurrence: { kind: "route-surface" }, reason: "route-event-warpnext" }]
      : [] };
  const movingObject = { object: { name: "moving object" },
    transform: { name: "moving transform" } };
  const moving = options.moving ? [movingObject] : [];
  const projection = { status: "parsed", renderRoot: { name: "event root" } };
  const triangles = options.rail
    ? [{ roadDescriptor: "rail", origin: { mesh: "mesh" } }] : [];
  const deferred = options.deferred
    ? [{ roadDescriptor: "deferred", origin: { mesh: "mesh" } }] : [];
  const issues = options.roadIssue
    ? [{ descriptor: "unsupported", mesh: { node: { name: "mesh" } }, reason: "unknown" }]
    : [];
  const road = { name: "road", collisionTriangles: triangles,
    deferredRoadTriangles: deferred, roadIssues: issues,
    containerName: "track", sections: [], firstSection: 0,
    lastSection: 0, start: { name: "start" } };
  const dependencies = {
    y9: method("decode", model),
    A10: asyncMethod("lte coins", options.noCoins ? undefined : { name: "coins" }),
    A30: asyncMethod("weather", options.noWeather ? undefined : { name: "weather" }),
    b30: asyncMethod("warp", options.fairy ? { inType: "fairy" } : { name: "warp" }),
    X30: asset => {
      log("provenance", asset);
      if (!asset.containerId)
        throw new Error(`${asset.virtualPath} 缺少逻辑容器 provenance。`);
      return { sourceKind: asset.sourceKind, sourceName: asset.sourceName,
        containerId: asset.containerId,
        logicalPath: asset.canonicalPath ?? asset.virtualPath };
    },
    Y30: method("course", course),
    c30: method("lens flare", { name: "lens flare" }),
    Vn0: method("dummy sounds", [{ name: "dummy sound" }]),
    YW: method("extract road", road),
    K30: method("moving objects", moving),
    j30: method("matrix roots", [{ name: "matrix root" }]),
    Um: method("admit moving", {
      status: "admit", animator: { name: "animator" },
      renderRoot: { name: "moving root" },
    }),
    $k: method("project event", projection),
    Kn0: class { constructor(value) { log("event runtime", value); this.name = "event runtime"; } },
    mo: method("deferred road?", true),
    Fl: method("deferred material?", false),
    NG: method("unsupported road?", true),
    Ri: method("rail?", true),
    w30: asyncMethod("rail config", options.noRailConfig ? undefined : { name: "rail config" }),
    y30: asyncMethod("rail capture", 4.5),
    Bt: method("version", options.version ?? "p3553"),
    Vw: method("lte identity", !options.badLteIdentity),
    I30: class { constructor(value) { log("ready camera", value); this.name = "ready camera"; } },
    Ln0: asyncMethod("advertisements", [{ name: "ad source" }]),
    hB: method("texture candidates", { candidates: options.textureCandidate
      ? [{ state: { texture: { value: "tex" } } }] : [] }),
    sn: method("texture status", { status: "missing" }),
    rn: { load: asyncMethod("environment", disposable("environment")) },
    c5: async (...args) => {
      log("load scene", ...args);
      if (options.failAt === "load scene") throw new Error("load scene failed");
      return disposable(args[2] === skyAsset.virtualPath ? "skydome" : "render scene");
    },
    O30: method("warp camera", options.noWarpCamera ? undefined : { name: "warp camera" }),
    i40: method("configure skydome", undefined),
    J30: method("time admit", { name: "time admit" }),
    Z30: method("multiplayer admit", { name: "multiplayer admit" }),
  };
  const Original = new Function("deps", `with (deps) { ${originalClass}; return ul; }`)(dependencies);
  const original = new Original(host);
  const owner = { assetHost: host };
  const ops = {
    decodeModel: dependencies.y9,
    assetProvenance: dependencies.X30,
    loadLteCoins: dependencies.A10,
    loadWeather: dependencies.A30,
    loadWarp: dependencies.b30,
    validateCourse: dependencies.Y30,
    lensFlareAnchor: dependencies.c30,
    dummySounds: dependencies.Vn0,
    extractRoad: dependencies.YW,
    mapMovingObjects: dependencies.K30,
    additionalMatrixRoots: dependencies.j30,
    admitMovingObject: dependencies.Um,
    parseEventProjection: dependencies.$k,
    makeEventRuntime: value => new dependencies.Kn0(value),
    hasDeferredRoad: dependencies.mo,
    isDeferredRoadMaterial: dependencies.Fl,
    unsupportedRoad: dependencies.NG,
    hasRail: dependencies.Ri,
    loadRailConfig: dependencies.w30,
    loadRailCapture: dependencies.y30,
    resourceVersion: dependencies.Bt,
    isLteTrack: dependencies.Vw,
    loadAdmission: dependencies.J30,
    loadMultiplayerAdmission: dependencies.Z30,
    makeReadyCamera: value => new dependencies.I30(value),
    loadAdvertisements: dependencies.Ln0,
    textureCandidates: dependencies.hB,
    textureStatus: dependencies.sn,
    loadEnvironment: dependencies.rn.load,
    loadScene: dependencies.c5,
    warpNextCamera: dependencies.O30,
    configureSkydome: dependencies.i40,
  };
  return { calls, original, owner, ops, dependencies };
}

async function exercise(kind, options = {}) {
  const f = fixture(options);
  const mode = options.mode ?? "time-attack";
  const admit = mode === "time-attack" ? f.dependencies.J30 : f.dependencies.Z30;
  try {
    const result = kind === "original"
      ? await f.original.loadMap("track/path/track.1s", "track_id", mode,
        admit, !!options.lte)
      : await loadTrackMap(f.owner, "track/path/track.1s", "track_id", mode,
        admit, !!options.lte, f.ops);
    return { result: normalize(result), calls: f.calls };
  } catch (error) { return { error: error.message, calls: f.calls }; }
}

test("track map assembly and option branches match release", async () => {
  for (const options of [{}, { mode: "speed-individual" },
    { moving: true, deferred: true, textureCandidate: true, sky: true },
    { rail: true }, { lte: true, mode: "speed-individual" },
    { warpRoute: true, mode: "speed-individual", fairy: true }]) {
    assert.deepEqual(await exercise("rewritten", options),
      await exercise("original", options), JSON.stringify(options));
  }
});

test("track map validation and load failures match release", async () => {
  for (const options of [{ badAsset: true }, { noProvenance: true },
    { noCoins: true, lte: true }, { noWeather: true },
    { invalidRoot: true }, { minimaps: 0 }, { minimaps: 2 },
    { roadIssue: true }, { unsupportedSurface: true, mode: "speed-individual" },
    { rail: true, noRailConfig: true }, { noMetadata: true },
    { badGameType: true }, { blocked: true }, { unchoosable: true },
    { noTitle: true }, { noLaps: true }, { noReady: true },
    { changedGeneration: true }, { failAt: "load scene" },
    { warpRoute: true, mode: "speed-individual", noWarpCamera: true }]) {
    assert.deepEqual(await exercise("rewritten", options),
      await exercise("original", options), JSON.stringify(options));
  }
});

test("mode-specific map entry points preserve release routing", () => {
  const f = fixture();
  const calls = [];
  const owner = { loadMap(...args) { calls.push(args); return "map"; } };
  assert.equal(loadTimeAttackMap(owner, "path", "track", f.ops.loadAdmission), "map");
  assert.deepEqual(calls.pop(), ["path", "track", "time-attack", f.ops.loadAdmission]);
  assert.equal(loadMultiplayerMap(owner, "path", "track", "lte",
    f.ops.resourceVersion, f.ops.isLteTrack,
    f.ops.loadMultiplayerAdmission), "map");
  assert.deepEqual(calls.pop(), ["path", "track", "speed-individual",
    f.ops.loadMultiplayerAdmission, true]);
});
