import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  loadStartupResources, prepareStartupReady, registerNewRider,
  type RiderCatalog, type RiderDialog, type RiderProfile,
  type StartupHost, type StartupLibrary, type StartupSelection,
} from "./startup-resources";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const methodNames = new Set([
  "loadVersionedResources", "applyNewRiderRegistration", "prepareStartupReady",
]);
const methods = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && methodNames.has(member.key.name));
assert.equal(methods.length, methodNames.size);
const methodSource = methods.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Event = unknown[];
type TestedHost = StartupHost & {
  loadVersionedResources(): Promise<void>;
  applyNewRiderRegistration(): Promise<void>;
  prepareStartupReady(library: StartupLibrary, selection: StartupSelection, title: string): Promise<void>;
};

function makeOriginal(dependencies: Record<string, unknown>): new () => TestedHost {
  return new Function(...Object.keys(dependencies), `return class { ${methodSource} };`)(
    ...Object.values(dependencies),
  ) as new () => TestedHost;
}

function profile(kartId = 999): RiderProfile {
  return {
    username: "Driver",
    equipment: {
      itemIds: { 1: 1, 2: 20, 3: kartId, 70: 70 },
      systemKart: "basic",
    },
  };
}

const catalog: RiderCatalog = {
  karts: [{ itemId: 7, title: "Speed Kart", path: "kart_/speed/model.1s" }],
  characters: [
    { itemId: 1, title: "Default", path: "character_/default/model.1s" },
    { itemId: 2, title: "Selected", path: "character_/selected/model.1s" },
  ],
  equipment: [
    { kind: "color", itemId: 20, title: "Red" },
    { kind: "dye", itemId: 70, title: "Blue" },
    { kind: "hat", itemId: 90, title: "Ignored" },
  ],
};
const startupSelection: StartupSelection = {
  trackId: "village_R01", mapPath: "track_/village_R01/track.1s",
  vehicleItemId: 7, characterPath: "character_/default/model.1s", characterItemId: 1,
};

function hostBasics(Original: new () => TestedHost, events: Event[]): TestedHost {
  const host = new Original();
  host.root = { name: "root" };
  host.assets = {
    beginGeneration: () => { events.push(["begin-generation"]); return 12; },
    isCurrent: generation => { events.push(["is-current", generation]); return true; },
    install: () => { events.push(["install"]); },
  };
  host.hud = {
    chooseResourceSource: async defaultName => {
      events.push(["choose-source", defaultName]);
      return { name: "local-pack" };
    },
    setLoadingProgress: (key, loaded, total, message) => {
      events.push(["progress", key, loaded, total, message]);
    },
    showDebugText: (message, level) => { events.push(["debug", message, level]); },
    finishLoading: () => { events.push(["finish-loading"]); },
    showLoadingError: message => { events.push(["loading-error", message]); },
  };
  host.userProfile = profile();
  host.localNickname = "";
  host.toonStageBinding = {
    retain: environment => {
      events.push(["retain-environment", (environment as { name?: string }).name]);
    },
  };
  host.session = { selection: { ...startupSelection }, vehicleTitle: "old vehicle" };
  host.audio = {};
  host.gameOptions = { music: true };
  host.targetRandom = "random-service";
  host.enterTimeAttackReady = async () => { events.push(["enter-ready"]); };
  return host;
}

type LoadMode =
  | "normal" | "source-choice" | "no-local" | "partial-errors"
  | "no-files" | "catalog-error" | "prepare-error";

function loadHarness(rewritten: boolean, mode: LoadMode, cancelAt?: number): {
  host: TestedHost; events: Event[];
} {
  const events: Event[] = [];
  const localSource = { name: "restored-pack" };
  const mounted = { sources: "sources", archiveIndexes: "indexes" };
  const library: StartupLibrary = {
    files: mode === "no-files" ? [] : ["file-a", "file-b"],
    archives: ["one", "two", "three"],
    errors: mode === "no-files" || mode === "partial-errors" ? ["archive issue"] : [],
    warnings: ["catalog warning"],
    timeAttackGarageCatalog: async () => {
      events.push(["garage-catalog"]);
      if (mode === "catalog-error") throw new Error("catalog failed");
      return catalog;
    },
    mapCatalog: async () => { events.push(["map-catalog"]); return [{ path: startupSelection.mapPath }]; },
    trackMetadata: async () => ({ id: startupSelection.trackId }),
  };
  let checkCount = 0;
  const deps = {
    io0: () => { events.push(["local-supported"]); return mode !== "no-local"; },
    ro0: async () => {
      events.push(["restore-local"]);
      return mode === "source-choice" ? undefined : localSource;
    },
    so0: "default-source",
    Bt: (version: string) => { events.push(["version", version]); return "verified-p3553"; },
    uo0: async (version: string, progress: (value: {
      file: string; loadedBytes: number; totalBytes: number;
    }) => void, source: unknown) => {
      events.push(["load-sources", version, (source as { name?: string } | undefined)?.name]);
      progress({ file: "ABC.RHO", loadedBytes: 20, totalBytes: 100 });
      return mounted;
    },
    Sw: { load: async (sources: unknown, unused: unknown, indexes: unknown) => {
      events.push(["open-library", sources, unused, indexes]);
      return library;
    } },
    Ta0: () => { events.push(["load-profile"]); return profile(); },
    gr: () => { events.push(["default-profile"]); return profile(7); },
    Rf0: (_garage: unknown, _maps: unknown, selectedProfile: RiderProfile) => {
      events.push(["resolve-startup", selectedProfile.equipment.itemIds[3]]);
      return { selection: startupSelection, vehicleTitle: "Speed Kart" };
    },
    n3: (itemId: number) => { events.push(["special-kart", itemId]); return itemId === 999; },
    Mw: (itemId: number) => { events.push(["kart-name", itemId]); return "Special Kart"; },
    im: () => { events.push(["nickname"]); return ""; },
  };
  const Original = makeOriginal(deps);
  const host = hostBasics(Original, events);
  host.assets.isCurrent = generation => {
    checkCount++;
    events.push(["is-current", generation, checkCount]);
    return checkCount !== cancelAt;
  };
  host.assets.install = (loadedLibrary, loadedSources) => {
    events.push(["install", loadedLibrary === library, loadedSources === mounted]);
  };
  host.prepareStartupReady = async (_library, selection, title) => {
    events.push(["prepare-ready", selection.trackId, title]);
    if (mode === "prepare-error") throw new Error("ready failed");
  };
  host.applyNewRiderRegistration = async () => { events.push(["register-rider"]); };
  if (rewritten) {
    host.loadVersionedResources = () => loadStartupResources(host, {
      localResourcesSupported: deps.io0,
      recoverLocalSource: deps.ro0,
      defaultSourceName: deps.so0,
      versionId: deps.Bt,
      loadVersionedSources: deps.uo0,
      loadLibrary: (sources, indexes) => deps.Sw.load(sources, undefined, indexes),
      loadProfile: deps.Ta0,
      defaultProfile: deps.gr,
      resolveSelection: deps.Rf0,
      isSpecialKartId: deps.n3,
      displayKartName: deps.Mw,
      localNickname: deps.im,
    });
  }
  return { host, events };
}

async function runLoad(mode: LoadMode, rewritten: boolean, cancelAt?: number): Promise<unknown> {
  const { host, events } = loadHarness(rewritten, mode, cancelAt);
  await host.loadVersionedResources();
  return { events, profile: host.userProfile };
}

test("resource startup and local-source choices match the release", async () => {
  for (const mode of ["normal", "source-choice", "no-local", "partial-errors"] as const) {
    assert.deepEqual(await runLoad(mode, true), await runLoad(mode, false), mode);
  }
});

test("every resource-generation cancellation gate matches the release", async () => {
  for (const check of [1, 2, 3, 4, 5]) {
    assert.deepEqual(await runLoad("normal", true, check), await runLoad("normal", false, check));
  }
});

test("missing files and catalog/Ready failures match release loading errors", async () => {
  for (const mode of ["no-files", "catalog-error", "prepare-error"] as const) {
    assert.deepEqual(await runLoad(mode, true), await runLoad(mode, false), mode);
  }
});

type RegistrationMode =
  | "normal" | "no-library" | "missing-kart" | "dialog-load-error"
  | "dialog-open-error" | "ready-error" | "existing-dialog" | "no-character-path";

function registrationHarness(rewritten: boolean, mode: RegistrationMode): {
  host: TestedHost; events: Event[];
} {
  const events: Event[] = [];
  const environment = {
    name: "rider-environment",
    dispose: () => { events.push(["dispose-environment"]); },
  };
  const dialog: RiderDialog = {
    open: async () => {
      events.push(["open-dialog"]);
      if (mode === "dialog-open-error") throw new Error("dialog open failed");
      return { name: "Blue", characterItemId: 2, paintItemId: 21, dyeItemId: 71 };
    },
    dispose: () => { events.push(["dispose-dialog"]); },
  };
  const library: StartupLibrary = {
    files: [], archives: [], errors: [], warnings: [],
    timeAttackGarageCatalog: async () => { events.push(["garage-catalog"]); return catalog; },
    mapCatalog: async () => [],
    trackMetadata: async () => undefined,
  };
  const deps = {
    rn: { load: async (requested: StartupLibrary) => {
      events.push(["load-environment", requested === library]);
      return environment;
    } },
    Fy: { load: async (_library: StartupLibrary, _root: unknown, options: {
      characters: unknown[]; paints: unknown[]; dyes: unknown[]; defaults: unknown;
    }, context: { kartItem: { itemId: number }; profile: RiderProfile }) => {
      events.push(["load-dialog", options.characters, options.paints, options.dyes,
        options.defaults, context.kartItem.itemId, context.profile.equipment.itemIds[3]]);
      if (mode === "dialog-load-error") throw new Error("dialog load failed");
      return dialog;
    } },
    cT: (selectedProfile: RiderProfile) => {
      events.push(["save-profile", { ...selectedProfile.equipment.itemIds }]);
    },
    EF: (name: string) => { events.push(["save-nickname", name]); },
  };
  const Original = makeOriginal(deps);
  const host = hostBasics(Original, events);
  host.rhoLibrary = mode === "no-library" ? undefined : library;
  if (mode === "missing-kart") host.session.selection = { ...startupSelection, vehicleItemId: 1234 };
  if (mode === "no-character-path") {
    host.session.selection = { ...startupSelection, characterPath: undefined };
  }
  if (mode === "existing-dialog") host.newRiderDialog = dialog;
  host.enterTimeAttackReady = async () => {
    events.push(["enter-ready"]);
    if (mode === "ready-error") throw new Error("Ready failed");
  };
  if (rewritten) {
    host.applyNewRiderRegistration = () => registerNewRider(host, {
      loadEnvironment: deps.rn.load,
      loadDialog: deps.Fy.load,
      saveProfile: deps.cT,
      saveNickname: deps.EF,
    });
  }
  return { host, events };
}

async function runRegistration(mode: RegistrationMode, rewritten: boolean): Promise<unknown> {
  const { host, events } = registrationHarness(rewritten, mode);
  let rejected: string | undefined;
  try { await host.applyNewRiderRegistration(); }
  catch (error) { rejected = error instanceof Error ? error.message : String(error); }
  return {
    events, rejected, profile: host.userProfile, selection: host.session.selection,
    nickname: host.localNickname, dialogCleared: host.newRiderDialog === undefined,
  };
}

test("first-rider profile, character selection and dialog reuse match release", async () => {
  for (const mode of ["normal", "existing-dialog", "no-character-path"] as const) {
    assert.deepEqual(await runRegistration(mode, true), await runRegistration(mode, false), mode);
  }
});

test("registration early returns and failure cleanup match release", async () => {
  for (const mode of ["no-library", "missing-kart", "dialog-load-error",
    "dialog-open-error", "ready-error"] as const) {
    assert.deepEqual(await runRegistration(mode, true), await runRegistration(mode, false), mode);
  }
});

type ReadyMode = "normal" | "missing-metadata" | "audio-options-error" |
  "bgm-error" | "interface-error" | "ready-error" | "closed-context";

function readyHarness(rewritten: boolean, mode: ReadyMode): {
  host: TestedHost; library: StartupLibrary; events: Event[];
} {
  const events: Event[] = [];
  const bgm = { name: "new-bgm", dispose: () => { events.push(["dispose-bgm"]); } };
  const interfaceAudio = {
    name: "new-interface-audio", dispose: () => { events.push(["dispose-interface"]); },
  };
  const metadata = { id: "village_R01" };
  const library: StartupLibrary = {
    files: [], archives: [], errors: [], warnings: [],
    timeAttackGarageCatalog: async () => catalog,
    mapCatalog: async () => [],
    trackMetadata: async trackId => {
      events.push(["track-metadata", trackId]);
      return mode === "missing-metadata" ? undefined : metadata;
    },
  };
  class MockAudioContext {
    name = "new-context";
    state = mode === "closed-context" ? "closed" : "running";
    constructor() { events.push(["new-context"]); }
    close() { events.push(["close-context"]); return Promise.resolve(); }
  }
  const deps = {
    AudioContext: MockAudioContext,
    Qc: (context: MockAudioContext, options: unknown) => {
      events.push(["apply-audio-options", context.name, (options as { music: boolean }).music]);
      if (mode === "audio-options-error") throw new Error("options failed");
    },
    P7: { load: async (_library: StartupLibrary, selectedMetadata: unknown,
      random: unknown, context: MockAudioContext) => {
      events.push(["load-bgm", selectedMetadata === metadata, random, context.name]);
      if (mode === "bgm-error") throw new Error("BGM failed");
      return bgm;
    } },
    Ny: { load: async (_library: StartupLibrary, context: MockAudioContext) => {
      events.push(["load-interface", context.name]);
      if (mode === "interface-error") throw new Error("interface failed");
      return interfaceAudio;
    } },
  };
  const Original = makeOriginal(deps);
  const host = hostBasics(Original, events);
  const oldBgm = { name: "old-bgm", dispose: () => { events.push(["dispose-old-bgm"]); } };
  const oldInterfaceAudio = { name: "old-interface", dispose: () => {
    events.push(["dispose-old-interface"]);
  } };
  host.audio = {
    context: { state: "running", close: () => { events.push(["close-old-context"]); } },
    bgm: oldBgm,
    bgmTrackId: "old-track",
    interfaceAudio: oldInterfaceAudio,
  };
  host.enterTimeAttackReady = async () => {
    events.push(["enter-ready"]);
    if (mode === "ready-error") throw new Error("Ready failed");
  };
  if (rewritten) {
    host.prepareStartupReady = (selectedLibrary, selection, title) =>
      prepareStartupReady(host, selectedLibrary, selection, title, {
        createAudioContext: () => new MockAudioContext(),
        applyAudioOptions: deps.Qc,
        loadBgm: deps.P7.load,
        loadInterfaceAudio: deps.Ny.load,
      });
  }
  return { host, library, events };
}

function audioName(value: unknown): string | undefined {
  return (value as { name?: string } | undefined)?.name;
}

async function runReady(mode: ReadyMode, rewritten: boolean): Promise<unknown> {
  const { host, library, events } = readyHarness(rewritten, mode);
  let rejected: string | undefined;
  try { await host.prepareStartupReady(library, startupSelection, "Speed Kart"); }
  catch (error) { rejected = error instanceof Error ? error.message : String(error); }
  return {
    events, rejected, selection: host.session.selection, title: host.session.vehicleTitle,
    context: audioName(host.audio.context), bgm: audioName(host.audio.bgm),
    bgmTrackId: host.audio.bgmTrackId,
    interfaceAudio: audioName(host.audio.interfaceAudio),
  };
}

test("startup audio and Ready publication match release", async () => {
  assert.deepEqual(await runReady("normal", true), await runReady("normal", false));
});

test("metadata and audio/Ready failures restore release state", async () => {
  for (const mode of ["missing-metadata", "audio-options-error", "bgm-error",
    "interface-error", "ready-error", "closed-context"] as const) {
    assert.deepEqual(await runReady(mode, true), await runReady(mode, false), mode);
  }
});
