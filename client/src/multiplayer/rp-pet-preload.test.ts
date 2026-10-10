import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { preloadRpFlyingPet, type RpArchiveEntry, type RpPetRace } from
  "./rp-pet-preload";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("async function Nl0(");
const end = release.indexOf("\nclass yy {", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

type Scenario = "no-rp" | "invalid-draws" | "missing-draw" |
  "no-pet" | "missing-identity" | "success" | "cancel-after-item" |
  "asset-failure";

async function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  let checks = 0;
  let active = 0;
  let maxActive = 0;
  const signal = {
    throwIfAborted() {
      checks++;
      events.push(["abort-check", checks]);
      if (scenario === "cancel-after-item" && checks === 2) {
        throw new Error("cancelled");
      }
    },
  };
  const entry = (id: string, sourceKind = "archive"): RpArchiveEntry => ({
    sourceKind, virtualPath: `virtual/${id}`, sourceName: `source/${id}`,
    async bytes() {
      events.push(["start", id]);
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      if (scenario === "asset-failure" && id === "C") {
        throw new Error("asset failed");
      }
      events.push(["end", id]);
      return new Uint8Array([id.charCodeAt(0)]);
    },
  });
  const a = entry("A");
  const b = entry("B", "loose");
  const c = entry("C");
  const d = entry("D");
  const folders: Record<string, RpArchiveEntry[]> = {
    "flyingPet_/body": [a, b],
    "shared": [b, c],
    "sound_/flyingPet/voices": [c, d],
  };
  const library = {
    entriesUnderCanonicalPrefix(prefix: string) {
      events.push(["entries", prefix]);
      return folders[prefix] ?? [];
    },
  };
  const race: RpPetRace = {
    roster: [{ playerId: "self" }, { playerId: "other" }],
    ...(scenario === "no-rp" ? {} : { rp: { draws: scenario === "missing-draw"
      ? {} : { self: { flyingPetId: scenario === "no-pet" ? 0 : 407 } } } }),
  };
  const deps = {
    validDraws(rp: NonNullable<RpPetRace["rp"]>, playerIds: string[]) {
      events.push(["valid-draws", rp === race.rp, playerIds]);
      return scenario !== "invalid-draws";
    },
    async findItem(_library: typeof library, id: number) {
      events.push(["item", _library === library, id]);
      return scenario === "missing-identity" ? undefined
        : { internalId: "pet_407" };
    },
    async loadPet(_library: typeof library, internalId: string) {
      events.push(["pet", _library === library, internalId]);
      return { folders: ["body"], soundFolders: ["voices"] };
    },
    sharedFolder: "shared",
  };
  const original = new Function("ba", "Ma", "x4", "DI",
    `${source}\nreturn Nl0;`)(
      deps.validDraws, deps.findItem, { load: deps.loadPet },
      deps.sharedFolder,
    ) as (source: { entriesUnderCanonicalPrefix(prefix: string):
      RpArchiveEntry[] }, race: RpPetRace, playerId: string,
      abort: { throwIfAborted(): void }) => Promise<void>;
  let error: string | undefined;
  try {
    if (rewritten) await preloadRpFlyingPet(library, race, "self", signal, deps);
    else await original(library, race, "self", signal);
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, maxActive };
}

test("RP flying pet preload, deduplication, cancellation and failures match release", async () => {
  for (const scenario of ["no-rp", "invalid-draws", "missing-draw",
    "no-pet", "missing-identity", "success", "cancel-after-item",
    "asset-failure"] as const) {
    assert.deepEqual(await observe(true, scenario), await observe(false, scenario),
      scenario);
  }
});
