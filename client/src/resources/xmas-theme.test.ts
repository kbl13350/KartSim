import assert from "node:assert/strict";
import test from "node:test";

import { loadMirrorLibrary } from "../item/item-test-fixtures";
import { raceBgmArchiveTracks } from "../timeattack/race-bgm-resources";
import { buildResourceGroups, findResourceGroup } from "./resource-groups";
import { mirrorArchives } from "./mirror-archives.test-support";
import { TAIWAN_TRACKS, isTaiwanTrackFolder } from "./taiwan-tracks";
import {
  XMAS_DASHBOARD_PATH, XMAS_TRACK_IDS, isXmasTrack, xmasClassicHud, xmasSlotFrame,
  xmasTrackModelPath,
} from "./xmas-theme";

test("the Christmas model sits beside the track's own, reverse included", () => {
  const files = new Set(["track_/ice_I01/track_xmas.1s", "track_/ice_I01/track_xmas_rvs.1s",
    "track_/ice_R01/track_xmas.1s", "track_/forest_I01/track_xmas.1s"]);
  const library = {
    findSibling(path: string, names: string[]) {
      const sibling = `${path.slice(0, path.lastIndexOf("/") + 1)}${names[0]}`;
      return files.has(sibling) ? { virtualPath: sibling } : undefined;
    },
  };
  assert.ok(isXmasTrack("ice_I01") && isXmasTrack("ice_I01_rvs") && isXmasTrack("ice_R02"));
  assert.ok(!isXmasTrack("ice_I07") && !isXmasTrack("forest_I01"));
  assert.equal(xmasTrackModelPath(library, "track_/ice_I01/track.1s", "ice_I01"),
    "track_/ice_I01/track_xmas.1s");
  assert.equal(xmasTrackModelPath(library, "track_/ice_I01/track_rvs.1s", "ice_I01_rvs"),
    "track_/ice_I01/track_xmas_rvs.1s");
  // ice_R01 has no reverse Christmas model; other themes never take one.
  assert.equal(xmasTrackModelPath(library, "track_/ice_R01/track_rvs.1s", "ice_R01_rvs"), undefined);
  assert.equal(xmasTrackModelPath(library, "track_/forest_I01/track.1s", "forest_I01"), undefined);
  assert.equal(xmasTrackModelPath(undefined, "track_/ice_I01/track.1s", "ice_I01"), undefined);
});

test("only the plain item slot frame turns into the Christmas one", () => {
  assert.equal(xmasSlotFrame("normal", true), "xmas");
  assert.equal(xmasSlotFrame("normal", false), "normal");
  assert.equal(xmasSlotFrame("dual", true), "dual");
});

test("the classic HUD keeps its package and swaps only the dashboard texture", async () => {
  const textures = new Map([["aw_01@zz", "plain"], ["aw_02@zz", "lamps"]]);
  const classic = { stage: "stage window", textures };
  const library = {
    exactCanonicalCandidates: (path: string) => path === XMAS_DASHBOARD_PATH
      ? [{ bytes: async () => new Uint8Array([7]) }] : [],
  };
  const xmas = await xmasClassicHud(classic, library, async bytes => `xmas ${bytes[0]}`);
  assert.equal(xmas.stage, "stage window");
  assert.deepEqual([...xmas.textures], [["aw_01@zz", "xmas 7"], ["aw_02@zz", "lamps"]]);
  assert.equal(textures.get("aw_01@zz"), "plain");
  await assert.rejects(xmasClassicHud(classic, { exactCanonicalCandidates: () => [] },
    async () => "x"), /aw_01_xmas@cn\.png/);
});

test("p3553 ships a Christmas model for exactly these ice tracks", () => {
  const archives = mirrorArchives();
  const shipped = new Map<string, Set<string>>();
  for (const archive of archives.index.rho) {
    const id = /^track_(.+)\.rho$/i.exec(archive.name)?.[1];
    if (!id) continue;
    shipped.set(id, new Set((archive.files as Array<{ name: string }>).map(file => file.name.toLowerCase())));
  }
  const xmas = [...shipped].filter(([, names]) => names.has("track_xmas.1s")).map(([id]) => id).sort();
  assert.deepEqual(xmas.filter(id => !isTaiwanTrackFolder(id)), [...XMAS_TRACK_IDS].sort());
  assert.deepEqual(xmas.filter(isTaiwanTrackFolder), [...new Set(TAIWAN_TRACKS
    .filter(track => track.modelFile === "track_xmas.1s").map(track => track.folder))].sort());
  // Every reversible one has its reverse Christmas model.
  for (const id of xmas.filter(id => !isTaiwanTrackFolder(id))) {
    const names = shipped.get(id)!;
    assert.equal(names.has("track_xmas_rvs.1s"), names.has("track_rvs.1s"), id);
  }
});

test("the Christmas music, cube, slot frame and dashboard resolve in p3553", async () => {
  const library = await loadMirrorLibrary(["zeta_cn_stage.rho", "sound_bgm_xmas.rho", "item.rho"]) as any;
  assert.deepEqual(raceBgmArchiveTracks(library, "xmas").map(entry => entry.name), ["xmas_01.ogg", "xmas_02.ogg"]);
  assert.equal(library.exactCanonicalCandidates(XMAS_DASHBOARD_PATH).length, 1);
  assert.equal(library.exactCanonicalCandidates("item/itemCube/xmas/zz/itemCube.1s").length, 1);
  assert.equal(library.exactCanonicalCandidates("item/slot/slot_xmas.png").length, 1);
  const frames = new TextDecoder("utf-16le").decode(
    await library.exactCanonicalCandidates("item/slot/slot_frameResource.bml")[0].bytes());
  assert.ok(frames.includes("xmas") && frames.includes("slot_xmas"));
});

test("the 冰河 download group brings the Christmas music", () => {
  const groups = buildResourceGroups([
    { name: "track_ice_I01.rho", size: 1 }, { name: "theme_ice.rho", size: 1 },
    { name: "sound_bgm_ice.rho", size: 1 }, { name: "sound_bgm_xmas.rho", size: 1 },
    { name: "track_forest_I01.rho", size: 1 },
  ], []);
  assert.ok(findResourceGroup(groups, "track:ice")!.containers.includes("sound_bgm_xmas.rho"));
  assert.ok(!findResourceGroup(groups, "track:forest")!.containers.includes("sound_bgm_xmas.rho"));
});
