import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { trackDirectoryRows } from "./track-directory.mjs";
import { contentVersion } from "./canonical.mjs";

test("admin directory groups reviewed aliases while preserving metadata and reverse routes", () => {
  const track = (id, extra = {}) => ({ id, title: id, theme: "korea", gameType: "speed", difficulty: 3, ...extra });
  const rows = trackDirectoryRows([
    track("korea_R01_old"), track("korea_R01"), track("korea_R01_rvs", { reverse: true }),
    track("custom_demo123"),
  ]);
  assert.deepEqual(rows.map(row => row.id), ["korea_R01", "korea_R01_rvs"]);
  assert.deepEqual(rows[0], { id: "korea_R01", title: "korea_R01", theme: "korea", themeTitle: "韩国",
    gameType: "speed", difficulty: 3, reverse: false, aliases: ["korea_R01_old"] });
  assert.equal(rows[1].reverse, true);
  assert.deepEqual(rows[1].aliases, []);
  assert.deepEqual(trackDirectoryRows([track("korea_R01_old")]).map(row => row.id), ["korea_R01_old"]);
});

test("embedded management directory covers every settlement ID exactly once", () => {
  const directory = JSON.parse(readFileSync(new URL("../../../server-go/internal/data/economy/track-directory.json", import.meta.url), "utf8"));
  const settlement = JSON.parse(readFileSync(new URL("../../../server-go/internal/data/economy/tracks.json", import.meta.url), "utf8"));
  assert.equal(directory.version, contentVersion(directory));
  const all = directory.tracks.flatMap(track => [track.id, ...track.aliases]);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), settlement.tracks.map(track => track.id).sort());
  assert.equal(directory.tracks.length, 796);
  assert.equal(directory.tracks.filter(track => track.theme === "korea").length, 22);
  assert.ok(directory.tracks.every(track => track.theme && track.themeTitle && typeof track.reverse === "boolean"));
});
