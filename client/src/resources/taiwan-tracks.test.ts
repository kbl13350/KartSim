import assert from "node:assert/strict";
import test from "node:test";
import { TAIWAN_TRACKS, taiwanTrack, taiwanTrackForPath } from "./taiwan-tracks";
import { extraTrackChoices, resourceTracks } from "./extra-tracks";
import { trackMetadata, trackTitles, type TrackLibrary } from "./track-catalog";

function library(paths: readonly string[]): TrackLibrary {
  const files = paths.map(path => ({ name: path.split("/").at(-1)!, extension: "1s",
    canonicalPath: path, virtualPath: path, sourceName: `${path.split("/")[1]}.rho`,
    bytes: async () => new Uint8Array() }));
  const source: TrackLibrary = { files, mapAssets: () => files,
    trackTitles: async () => new Map(), trackMetadataCatalog: async () => [],
    timeAttackTrackCatalog: async () => extraTrackChoices(source, [], []),
    findSibling: () => undefined };
  return source;
}

test("all 362 TW entries retain distinct selection IDs and isolated physical paths", () => {
  assert.equal(TAIWAN_TRACKS.length, 362);
  assert.equal(new Set(TAIWAN_TRACKS.map(track => track.id)).size, 362);
  const source = library(TAIWAN_TRACKS.map(track => track.canonicalPath));
  const choices = extraTrackChoices(source, [], []);
  assert.equal(choices.length, 362);
  for (const track of TAIWAN_TRACKS) {
    const choice = choices.find(choice => choice.id === track.id)!;
    assert.equal(choice.path, track.canonicalPath, track.id);
    assert.equal(choice.title, track.title, track.id);
    assert.equal(choice.theme, track.theme, track.id);
    assert.equal(!!choice.reverse, track.id.endsWith("_rvs"), track.id);
    assert.ok(choice.resourceCategory, track.id);
    assert.equal(taiwanTrackForPath(track.canonicalPath), track);
    assert.equal(taiwanTrackForPath(track.canonicalPath.replace("track_/", "track_")), track);
  }
});

test("TW aliases retain title, laps, texture theme and route direction without replacing CN metadata", async () => {
  const source = library(["track_/village_I01/track.1s", ...TAIWAN_TRACKS.map(track => track.canonicalPath)]);
  const base = { id: "village_I01", cnTitle: "城镇 钟楼", laps: 3,
    difficulty: 2, gameType: "item", theme: "village", speedPool: true };
  source.trackMetadataCatalog = async () => [base];
  assert.equal(await trackMetadata(source, "village_I01"), base);
  const facelift = await trackMetadata(source, "facelift_village_I01");
  assert.equal(facelift?.id, "tw_facelift_village_I01");
  assert.equal(facelift?.folder, "tw_facelift_village_I01");
  assert.equal(facelift?.cnTitle, "新城鎮 鐘樓");
  assert.equal(facelift?.texTheme, "brodi");
  assert.equal(facelift?.theme, "village");
  assert.equal(facelift?.laps, 3);
  assert.equal(facelift?.speedPool, false);
  assert.equal((await trackMetadata(source, "korea_R01_rvs"))?.cnTitle, "[反]韓國 繁華的首爾");
  assert.equal((await trackMetadata(source, "korea_R01_rvs"))?.laps, 1);
  assert.equal((await trackMetadata(source, "village_R11"))?.texTheme, "china");
  const titles = await trackTitles(source);
  assert.equal(titles.get("tw_korea_R01")?.title, "韓國 繁華的首爾");
  assert.equal(titles.get("village_I01")?.title, "城镇 钟楼");
});

test("the nonstandard boost-charge filename is normalized and unavailable TW models stay absent", async () => {
  const track = taiwanTrack("ice_R01_village__boost_charge")!;
  assert.equal(track.modelFile, "track_boost_charge.1s");
  const source = library([track.canonicalPath]);
  assert.equal(resourceTracks(source)[0]?.id, track.id);
  assert.equal((await source.timeAttackTrackCatalog())[0]?.path, track.canonicalPath);
  assert.equal((await library([]).timeAttackTrackCatalog()).length, 0);
  assert.equal(await trackMetadata(library([]), "korea_R01"), undefined);
  assert.equal(resourceTracks(library(["track_/tw_village_I04/track.1s"])).length, 0,
    "a CN sibling copied as an imported folder dependency is not another selectable map");
});
