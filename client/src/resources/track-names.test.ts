import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { trackNames } from "../i18n/catalogs/tracks";
import type { GameLocale } from "../i18n/locale";
import { listSourceTracks, type SourceLibrary } from "../mapeditor/source-tracks";
import { featuredEntries, loadReplayMenu } from "../timeattack/ready-replays";
import { mapCatalog, timeAttackRandomTrackNames, timeAttackTrackCatalog, trackTitles,
  type TrackLibrary, type TrackMetadata, type TrackResource } from "./track-catalog";
import { trackDisplayTitle } from "./track-names";

const locales: GameLocale[] = ["zh-CN", "en", "ko"];
const villageTitles = ["城镇 高速公路", "Village Highway", "빌리지 고가의 질주"];
const reversePrefixes = ["[反]", "[Reverse] ", "[역방향] "];

async function eachLocale(run: (locale: GameLocale, index: number) => void | Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const [index, locale] of locales.entries()) {
      Object.defineProperty(globalThis, "localStorage", { configurable: true,
        value: { getItem: () => locale } });
      await run(locale, index);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

test("all server tracks and every named resource track have complete display names", () => {
  const server = JSON.parse(readFileSync(new URL("../../../server-go/internal/data/economy/tracks.json", import.meta.url), "utf8")) as {
    tracks: Array<{ id: string; title: string }>;
  };
  assert.ok(server.tracks.length >= 371);
  assert.equal(Object.keys(trackNames).length, 380);
  for (const track of server.tracks) {
    assert.equal(trackDisplayTitle(track.id, track.title, "zh-CN"), track.title, track.id);
    if (!(track.id.replace(/_rvs$/i, "") in trackNames)) continue;
    for (const locale of ["en", "ko"] as const) {
      const title = trackDisplayTitle(track.id, track.title, locale);
      assert.notEqual(title, track.id, `${track.id}: ${locale}`);
      assert.doesNotMatch(title, /\p{Script=Han}/u, `${track.id}: ${locale}`);
    }
  }
  for (const [id, titles] of Object.entries(trackNames)) {
    assert.ok(titles.every(title => title.trim().length > 0), id);
    assert.doesNotMatch(titles[1], /\p{Script=Han}/u, id);
    assert.doesNotMatch(titles[2], /\p{Script=Han}/u, id);
  }
  // Native Korean is retained; Chinese-only and reconstructed tracks also get names.
  assert.equal(trackDisplayTitle("forest_I01", undefined, "ko"), "포레스트 통나무");
  assert.equal(trackDisplayTitle("forest_I10", undefined, "ko"), "포레스트 폭포 슬라이드");
  assert.equal(trackDisplayTitle("xyy_R01", undefined, "en"), "Pleasant Goat Wolf Castle");
  assert.equal(trackDisplayTitle("korea_R01", undefined, "zh-CN"), "韩国 活力首尔");
  assert.equal(trackDisplayTitle("mine_S02", undefined, "en"), "Myth Muspelheim");
  assert.equal(trackDisplayTitle("moonhill_R05", undefined, "en"), "Moonhill Taipei Rush");
});

test("reverse and lower-case replay IDs localize while unknown/player map names are preserved", async () => {
  await eachLocale((_locale, index) => {
    assert.equal(trackDisplayTitle("VILLAGE_r01"), villageTitles[index]);
    assert.equal(trackDisplayTitle("village_r01_RVS"), `${reversePrefixes[index]}${villageTitles[index]}`);
    for (const id of ["custom_123", "custom_123_draft", "custom_123_rvs", "unknown_track"]) {
      assert.equal(trackDisplayTitle(id, "城镇 高速公路"), "城镇 高速公路");
      assert.equal(trackDisplayTitle(id, "我的地图 My Map 내 맵"), "我的地图 My Map 내 맵");
    }
  });
});

function resource(virtualPath: string): TrackResource {
  return { name: virtualPath.split("/").at(-1)!, extension: "1s", virtualPath,
    sourceName: "track_village_R01.rho", bytes: async () => new Uint8Array() };
}

function libraryFixture(): { library: TrackLibrary; metadata: TrackMetadata[] } {
  const metadata: TrackMetadata[] = [{ id: "village_R01", folder: "village_R01", gameType: "speed",
    cnTitle: "城镇 高速公路", laps: 3, difficulty: 3, speedPool: true, theme: "village" }];
  const model = resource("track_/village_R01/track.1s");
  const reversed = resource("track_/village_R01/track_rvs.1s");
  const library: TrackLibrary = {
    files: [model, reversed], mapAssets: () => [model],
    trackMetadataPromise: Promise.resolve(metadata), trackMetadataCatalog: async () => metadata,
    trackTitles: () => trackTitles(library), timeAttackTrackCatalog: () => timeAttackTrackCatalog(library),
    findSibling: (path, names) => [model, reversed].find(file =>
      file.virtualPath.slice(0, file.virtualPath.lastIndexOf("/")) === path.slice(0, path.lastIndexOf("/")) && names.includes(file.name)),
  };
  return { library, metadata };
}

test("cached metadata feeds picker, random pool, map browser and workshop in the active language", async () => {
  const { library, metadata } = libraryFixture();
  const original = structuredClone(metadata);
  // An older cache must not pin the title to the first selected language.
  library.trackTitlePromise = Promise.resolve(new Map([["village_R01", { title: "过期名称", trackId: "village_R01" }]]));
  await eachLocale(async (_locale, index) => {
    const titles = await trackTitles(library);
    assert.equal(titles.get("village_R01")?.title, villageTitles[index]);
    const catalog = await timeAttackTrackCatalog(library);
    assert.deepEqual(catalog.map(track => track.id), ["village_R01", "village_R01_rvs"]);
    assert.deepEqual(catalog.map(track => track.path), ["track_/village_R01/track.1s", "track_/village_R01/track_rvs.1s"]);
    assert.deepEqual(catalog.map(track => track.title), [villageTitles[index], `${reversePrefixes[index]}${villageTitles[index]}`]);
    const random = await timeAttackRandomTrackNames(library);
    assert.equal(random.get("village_R01_rvs"), `${reversePrefixes[index]}${villageTitles[index]}`);
    assert.equal((await mapCatalog(library))[0]?.name, villageTitles[index]);
    const source = await listSourceTracks(library as unknown as SourceLibrary);
    assert.equal(source[0]?.title, villageTitles[index]);
    assert.deepEqual(metadata, original, "display localization must not rewrite region metadata");
  });
});

test("published replay track names localize by official ID without rewriting published or player text", async () => {
  await eachLocale((_locale, index) => {
    const original = { id: 5, title: "第1届决赛", note: "玩家写的说明", trackId: "village_R01_rvs",
      trackName: "[反]城镇 高速公路", speed: 7, booster: 0, accountId: "player-id", nickname: "城镇 高速公路",
      kartName: "Kart", bestMs: 95_000, createdAt: 1 };
    const [official, custom] = featuredEntries([original, { ...original, id: 6, trackId: "custom_player_map", trackName: "我的地图" }]);
    assert.equal(official?.trackTitle, `${reversePrefixes[index]}${villageTitles[index]}`);
    assert.equal(official?.title, original.title);
    assert.equal(official?.note, original.note);
    assert.equal(official?.riderName, original.nickname);
    assert.equal(custom?.trackTitle, "我的地图");
    assert.equal(original.trackName, "[反]城镇 高速公路");
  });
});

test("saved local replay IDs resolve translated titles without changing records or custom map names", async () => {
  const records = new Map([
    ["village_r01_rvs\u00007\u00000", { hasGhost: true, elapsedMs: 95_000, kartName: "Kart" }],
    ["custom_player_map\u00007\u00000", { hasGhost: true, elapsedMs: 90_000, kartName: "Kart" }],
  ]);
  const before = structuredClone(records);
  const controller = { host: { replayLibrary: { records }, getLibrary: () => ({
    timeAttackTrackCatalog: async () => [{ id: "village_R01_rvs" }],
    trackMetadata: async (id: string) => ({ cnTitle: id.startsWith("custom_") ? "我的赛道" : "城镇 高速公路" }),
  }) } } as unknown as Parameters<typeof loadReplayMenu>[0];
  await eachLocale(async (_locale, index) => {
    const entries = await loadReplayMenu(controller, "我的名字");
    assert.equal(entries.find(entry => entry.trackId === "village_r01_rvs")?.trackTitle,
      `${reversePrefixes[index]}${villageTitles[index]}`);
    assert.equal(entries.find(entry => entry.trackId === "custom_player_map")?.trackTitle, "我的赛道");
    assert.ok(entries.every(entry => entry.riderName === "我的名字"));
    assert.deepEqual(records, before);
  });
});
