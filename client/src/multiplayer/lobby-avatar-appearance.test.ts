import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadLobbyAvatarAppearance, type LobbyAvatarEquipment } from
  "./lobby-avatar-appearance";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("async function Sl0(");
const end = release.indexOf("\nclass El0 {", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

type Case = "plain" | "team" | "cosmetics" | "missing-team" |
  "paint-failure";

async function observe(rewritten: boolean, variant: Case) {
  const events: unknown[][] = [];
  const library = { id: "library" };
  const equipment: LobbyAvatarEquipment = {
    itemIds: variant === "plain" ? {} : { 2: 202, 70: 703 },
  };
  const member = { id: "rider" };
  const deps = {
    async loadRoleTeams(source: unknown) {
      events.push(["teams", source === library]);
      return [{ dyeId: 701 }, { dyeId: 702 }];
    },
    async paintColors(source: unknown, itemId: number, slot?: number) {
      events.push(["paint", source === library, itemId, slot]);
      if (variant === "paint-failure" && slot === 70) {
        throw new Error("paint failed");
      }
      return { itemId, slot, primary: itemId + 1 };
    },
    cosmetics(value: LobbyAvatarEquipment, rider: unknown) {
      events.push(["cosmetics", value === equipment, rider === member]);
      return variant === "cosmetics" ? { hat: "red" } : null;
    },
  };
  const original = new Function("fa", "We", "BI",
    `${source}\nreturn Sl0;`)(
      deps.loadRoleTeams, deps.paintColors, deps.cosmetics,
    ) as (library: unknown, equipment: LobbyAvatarEquipment,
      teamIndex: number | null, member: unknown, initial?: string) =>
      Promise<unknown>;
  const teamIndex = variant === "team" || variant === "missing-team"
    ? variant === "team" ? 2 : 3 : null;
  let result: unknown;
  let error: string | undefined;
  try {
    result = rewritten
      ? await loadLobbyAvatarAppearance(library, equipment, teamIndex,
        member, "pose", deps)
      : await original(library, equipment, teamIndex, member, "pose");
  } catch (failure) { error = (failure as Error).message; }
  return { events, result, error };
}

test("lobby avatar dye lookup, appearance and failures match release", async () => {
  for (const variant of ["plain", "team", "cosmetics", "missing-team",
    "paint-failure"] as const) {
    assert.deepEqual(await observe(true, variant), await observe(false, variant),
      variant);
  }
});
