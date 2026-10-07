import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  GARAGE_MUSIC_PATHS, RACE_BGM_THEMES, garageBgmResource,
  loadRaceBgmPlaylist, raceBgmArchiveTracks, requiredBgmResource,
  selectRaceBgmTheme,
} from "../src/timeattack/race-bgm-resources.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
const source = name => {
  const node = nodes.find(item => item.id?.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};
const original = new Function("J_", "Yd0", "Q9",
  ["Zd0", "Jd0", "eG", "Kt", "G5", "ef0", "tG"]
    .map(source).join("\n") +
  "; return { Zd0, Jd0, eG, G5, ef0 }; ")(
    RACE_BGM_THEMES, GARAGE_MUSIC_PATHS,
    async (context, bytes) => new TextDecoder().decode(bytes));

const resource = (name, order, containerId = "one",
  absenceAuthoritative = true) => ({
    name, extension: name.split(".").at(-1), sourceOrdinal: order,
    containerId, absenceAuthoritative,
    bytes: async () => new TextEncoder().encode(name),
  });

function fixture(entries) {
  return {
    manifestAvailable: true,
    archives: [{ mountPath: "sound_\\bgm\\forest" },
      { mountPath: "sound_/bgm/forest2" }],
    hasManifestMount: () => true,
    entriesUnderCanonicalPrefix: path => [...(entries[path] ?? [])],
    exactCanonicalCandidates: path => entries[path] ?? [],
  };
}

test("BGM theme and ordered canonical playlist match the release", async () => {
  const track = { id: "forest_R01" };
  const entries = {
    "sound_/bgm/forest": [resource("b.ogg", 2),
      resource("a.ogg", 1), resource("cover.png", 3)],
    "sound_/bgm/forest2": [resource("c.ogg", 1)],
  };
  const readableLibrary = fixture(entries);
  const originalLibrary = fixture(entries);
  assert.equal(selectRaceBgmTheme(track), original.Zd0(track));
  assert.deepEqual(
    raceBgmArchiveTracks(readableLibrary, "forest").map(item => item.name),
    original.Jd0(originalLibrary, "forest").map(item => item.name));
  const decode = async (context, bytes) => new TextDecoder().decode(bytes);
  assert.deepEqual(await loadRaceBgmPlaylist(readableLibrary, track, {}, decode),
    await original.eG(originalLibrary, track, {}));
});

test("BGM provenance and exact resource failures match the release", () => {
  const bad = fixture({ "sound_/bgm/forest": [
    resource("a.ogg", 0, "one"), resource("b.ogg", 1, "two"),
  ] });
  assert.throws(() => raceBgmArchiveTracks(bad, "forest"),
    error => {
      assert.throws(() => original.Jd0(bad, "forest"),
        originalError => originalError.message === error.message);
      return true;
    });
  const fallback = resource("single.ogg", 0);
  assert.equal(garageBgmResource(fixture({}), fallback),
    original.ef0(fixture({}), fallback));
  assert.throws(() => requiredBgmResource(fixture({}), "missing.ogg"),
    error => {
      assert.throws(() => original.G5(fixture({}), "missing.ogg"),
        originalError => originalError.message === error.message);
      return true;
    });
});
