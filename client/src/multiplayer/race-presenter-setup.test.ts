import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearRacePresenterGiant, prepareRacePresenterFlyingPet,
  prepareRacePresenterGiant, prepareRacePresenterRoadblockFlag,
  prepareRacePresenterRoadblockResult,
  type RacePresenterSetupDependencies,
  type RacePresenterSetupHost } from "./race-presenter-setup";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Method = "pet" | "flag" | "giant" | "clear" | "result";
type Variant = "normal" | "skip" | "missing" | "disposed";

async function observe(rewritten: boolean, method: Method, variant: Variant) {
  const events: unknown[][] = [];
  let host: RacePresenterSetupHost;
  const pet = { dispose() { events.push(["dispose-pet"]); },
    mount(owner: unknown) { events.push(["mount-pet", owner]); } };
  const flag = { dispose() { events.push(["dispose-flag"]); } };
  const giant = { dispose() { events.push(["dispose-giant"]); } };
  const roadblockResult = { dispose() { events.push(["dispose-result"]); } };
  const dependencies = {
    async flyingPetItem(_library: unknown, itemId: number | undefined) {
      events.push(["pet-item", itemId]);
      return variant === "skip" ? undefined : { itemId };
    },
    serializedRoot(model: unknown) { events.push(["serialized-root", model]);
      return { children: Array.from({ length: 7 }, (_, index) => index === 6
        ? { value: variant === "missing" ? undefined
          : { transform: { scale: 1.5 } } } : {}) }; },
    async loadFlyingPet(options: {
      item: unknown; role: string; colors: unknown; grandparentScale: unknown;
      listen(listener: unknown): void;
    }) {
      events.push(["load-pet", options.item, options.role,
        options.colors, options.grandparentScale]);
      options.listen("listener");
      if (variant === "disposed") host.disposed = true;
      return pet;
    },
    async paintColors(_library: unknown, itemId: number) {
      events.push(["paint-colors", itemId]); return "paint";
    },
    async loadRoadblockFlag(_library: unknown, root: unknown,
      world: unknown, localRunner: boolean) {
      events.push(["load-flag", root, world, localRunner]);
      if (variant === "disposed") host.disposed = true;
      return flag;
    },
    async loadGiant(_library: unknown, scene: unknown,
      participants: Array<{ id: unknown; logic: unknown; pose(): unknown }>,
      world: unknown, context: unknown,
      onStage: (stage: unknown, value: unknown) => void) {
      events.push(["load-giant", scene, participants.map(owner => [
        owner.id, owner.logic, owner.pose(),
      ]), world, context]);
      onStage("growing", 2);
      if (variant === "disposed") host.disposed = true;
      return giant;
    },
    async loadRoadblockResult(_library: unknown, _assets: unknown) {
      events.push(["load-result"]);
      if (variant === "disposed") host.disposed = true;
      return roadblockResult;
    },
    nowMs() { return 1200; },
  };
  const Original = new Function("Ma", "J5", "S4", "We", "_v", "Fv",
    "Bv", "performance", `${originalClass}\nreturn jr0;`)(
    dependencies.flyingPetItem, dependencies.serializedRoot,
    { race: dependencies.loadFlyingPet }, dependencies.paintColors,
    { load: dependencies.loadRoadblockFlag }, { load: dependencies.loadGiant },
    { load: dependencies.loadRoadblockResult }, { now: () => 1200 },
  ) as new () => {
    prepareFlyingPet(library: unknown, context: unknown): Promise<void>;
    prepareRoadBlockFlag(library: unknown): Promise<void>;
    prepareGiant(library: unknown, context: unknown): Promise<void>;
    clearGiant(): void;
    prepareRoadBlockResult(library: unknown): Promise<void>;
  };
  host = Object.create(Original.prototype) as RacePresenterSetupHost;
  const isRoadblock = method === "flag" || method === "result";
  const isGiant = method === "giant" || method === "clear";
  const participants = [
    { playerId: "local", profile: { equipment: { itemIds: { 52: 8, 2: 0 } } },
      characters: { ordinary: { scene: { getDecorationOwner() {
        events.push(["decoration-owner"]); return "owner";
      } } } }, vehicle: { imported: { model: "local-model" } } },
    { playerId: "remote", profile: { equipment: { itemIds: {} } },
      characters: {}, vehicle: { imported: { model: "remote-model" } } },
  ];
  Object.assign(host, {
    disposed: false,
    playerId: "local",
    race: { roadblock: isRoadblock && variant !== "skip"
      ? { runnerId: "local" } : undefined },
    assets: {
      drivingMode: isGiant && variant !== "skip" ? { kind: "giant" }
        : { kind: "ordinary" },
      participants,
      map: { environment: "environment", stageBinding: "binding" },
    },
    scene: "scene",
    random: "random",
    runtime: {
      local: {
        giant: { main: 2 },
        physics: { body: "local-body", addFlyingPetListener(listener: unknown) {
          events.push(["pet-listener", listener]);
        } },
      },
      remotes: {
        giant(id: unknown) { events.push(["remote-giant", id]);
          return variant === "missing" ? undefined : { main: 4 }; },
        presentationVisible(id: unknown, nowMs: number) {
          events.push(["remote-visible", id, nowMs]); return true;
        },
        copyWebPose(id: unknown) { events.push(["remote-pose", id]);
          return "remote-body"; },
      },
    },
    views: variant === "missing" && method === "flag" ? new Map()
      : new Map([["local", { root: "local-root" }]]),
    hud: {
      giantStage(stage: unknown, value: unknown) {
        events.push(["giant-stage", stage, value]);
      },
      clearGiant() { events.push(["clear-giant-hud"]); },
    },
    cameraShake: { setGiantGate(value: unknown) {
      events.push(["giant-gate", value]);
    } },
    giantAppearances: new Map([["local", { dispose() {
      events.push(["dispose-local-appearance"]);
    } }], ["remote", { dispose() {
      events.push(["dispose-remote-appearance"]);
    } }]]),
    giantPresentation: giant,
  });
  let error: string | undefined;
  try {
    if (rewritten) {
      const deps = dependencies as unknown as RacePresenterSetupDependencies;
      if (method === "pet") await prepareRacePresenterFlyingPet(host,
        "library", "audio-context", deps);
      else if (method === "flag") await prepareRacePresenterRoadblockFlag(
        host, "library", deps);
      else if (method === "giant") await prepareRacePresenterGiant(host,
        "library", "audio-context", deps);
      else if (method === "clear") clearRacePresenterGiant(host);
      else await prepareRacePresenterRoadblockResult(host, "library", deps);
    } else {
      const original = host as unknown as InstanceType<typeof Original>;
      if (method === "pet") await original.prepareFlyingPet("library", "audio-context");
      else if (method === "flag") await original.prepareRoadBlockFlag("library");
      else if (method === "giant") await original.prepareGiant("library", "audio-context");
      else if (method === "clear") original.clearGiant();
      else await original.prepareRoadBlockResult("library");
    }
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, disposed: host.disposed,
    pet: host.flyingPet === pet,
    flag: host.roadblockFlag === flag,
    giant: host.giantPresentation === giant,
    roadblockResult: host.roadblockResult === roadblockResult,
    appearanceCount: host.giantAppearances.size };
}

test("multiplayer presenter optional owner setup and disposal match release", async () => {
  const scenarios: Array<[Method, Variant]> = [
    ["pet", "normal"], ["pet", "skip"], ["pet", "missing"],
    ["pet", "disposed"], ["flag", "normal"], ["flag", "skip"],
    ["flag", "missing"], ["flag", "disposed"], ["giant", "normal"],
    ["giant", "skip"], ["giant", "missing"], ["giant", "disposed"],
    ["clear", "normal"], ["clear", "skip"], ["result", "normal"],
    ["result", "skip"], ["result", "disposed"],
  ];
  for (const [method, variant] of scenarios) {
    assert.deepEqual(await observe(true, method, variant),
      await observe(false, method, variant), `${method}:${variant}`);
  }
});
