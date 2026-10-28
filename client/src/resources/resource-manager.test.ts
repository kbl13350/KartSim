import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

import { ContainerStore, DownloadPausedError, type ContainerProgress, type DirectoryHandle } from "./container-store";
import { buildResourceGroups, findResourceGroup, trackThemeOf } from "./resource-groups";
import { ResourceManager, type ResourceStoreApi } from "./resource-manager";

const files = [
  { name: "aaa.pk", size: 10 },
  { name: "gui_font.rho", size: 100 },
  { name: "stage_common.rho", size: 50 },
  { name: "myRoom.rho", size: 70 },
  { name: "stage_myRoom.rho", size: 5 },
  { name: "theme_village.rho", size: 20 },
  { name: "track_village_R01.rho", size: 30 },
  { name: "track_forest_I01.rho", size: 25 },
  { name: "theme_forest.rho", size: 15 },
  { name: "sound_bgm_forest.rho", size: 12 },
  { name: "effect.rho", size: 40 },
  { name: "character_bazzi.rho", size: 60 },
  { name: "DataPack3_00000.rho5", size: 80 },
  { name: "DataPack3_00001.rho5", size: 90 },
  { name: "stage_weird.rho", size: 3 },
];
const packs = [{ name: "DataPack3", parts: [{ id: 0, name: "DataPack3_00000.rho5" },
  { id: 1, name: "DataPack3_00001.rho5" }], files: [
  { path: "track_/camelot_R01/track.1s", partId: 0 },
  { path: "track_/camelot_R01/tex.dds", partId: 1 },
  { path: "track_/forest_R09/track.1s", partId: 1 },
] }];

test("groups cover every container; themes gather tracks, textures, music and rho5 parts", () => {
  const groups = buildResourceGroups(files, packs);
  const all = new Set(groups.flatMap(group => group.containers));
  assert.equal(all.size, files.length);
  const home = findResourceGroup(groups, "home")!;
  assert.equal(home.required, true);
  assert.ok(home.containers.includes("gui_font.rho") && home.containers.includes("myRoom.rho"));
  // myRoom.rho is the home backdrop and 小屋.
  assert.ok(findResourceGroup(groups, "myroom")!.containers.includes("myRoom.rho"));
  const forest = findResourceGroup(groups, "track:forest")!;
  assert.deepEqual(forest.containers, ["DataPack3_00001.rho5", "sound_bgm_forest.rho", "theme_forest.rho",
    "track_forest_I01.rho"]);
  assert.equal(forest.title, "森林");
  assert.deepEqual(findResourceGroup(groups, "track:camelot")!.containers,
    ["DataPack3_00000.rho5", "DataPack3_00001.rho5"]);
  assert.deepEqual(findResourceGroup(groups, "other")!.containers, ["stage_weird.rho"]);
  assert.equal(trackThemeOf("track_/village_R01/track.1s"), "village");
  assert.equal(trackThemeOf("forest_I10_rvs"), "forest");
  assert.equal(trackThemeOf("simulationGame"), undefined);
});

test("Taiwan additions are downloadable with the vehicle and map groups", () => {
  const additions = ["kart_taiwan_import.rho", "track_tw_korea_I01.rho",
    "sound_bgm_taiwan_korea.rho", "sound_taiwan_import.rho",
    "character_tyrannoBlack.rho"].map(name => ({ name, size: 1 }));
  const groups = buildResourceGroups([...files, ...additions], packs);
  assert.ok(findResourceGroup(groups, "karts")!.containers.includes("kart_taiwan_import.rho"));
  assert.deepEqual(findResourceGroup(groups, "track:tw")!.containers,
    ["sound_bgm_taiwan_korea.rho", "sound_taiwan_import.rho", "track_tw_korea_I01.rho"]);
  assert.equal(findResourceGroup(groups, "track:tw")!.title, "台服补充地图");
  assert.ok(findResourceGroup(groups, "characters")!.containers.includes("character_tyrannoBlack.rho"));
  assert.ok(additions.every(file => !findResourceGroup(groups, "other")!.containers.includes(file.name)));
});

test("the release manifest: home stays within separate base and locale image budgets", () => {
  const manifestPath = new URL("../../../mirror/__p3553/resources", import.meta.url);
  const indexPath = new URL("../../../mirror/__p3553/archive-index", import.meta.url);
  if (!existsSync(manifestPath) || !existsSync(indexPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { files: Array<{ name: string; size: number }> };
  const index = JSON.parse(inflateSync(readFileSync(indexPath)).toString()) as { rho5: typeof packs };
  const groups = buildResourceGroups(manifest.files, index.rho5);
  assert.equal(new Set(groups.flatMap(group => group.containers)).size, manifest.files.length);
  const home = findResourceGroup(groups, "home")!;
  const locale = manifest.files.find(file => file.name === "locale_ui.rho");
  assert.ok(locale && home.containers.includes(locale.name), "complete language images are a base resource");
  // Keep the original 400 MiB base budget; the complete three-language image
  // archive has its own 50 MiB allowance instead of hiding unrelated growth.
  assert.ok(locale.size < 50 * 1024 * 1024, `locale images ${locale.size}`);
  assert.ok(home.bytes - locale.size < 400 * 1024 * 1024, `base home ${home.bytes - locale.size}`);
  assert.ok(home.bytes < 450 * 1024 * 1024, `home including locale images ${home.bytes}`);
  assert.ok((findResourceGroup(groups, "tracks")!.children?.length ?? 0) >= 30);
});

/** An in-memory store: ensure resolves when the test lets it. */
class FakeStore implements ResourceStoreApi {
  cached = new Set<string>();
  started: string[] = [];
  waiting = new Map<string, { resolve(): void; reject(error: Error): void }>();
  removed: string[] = [];
  listeners = new Set<(progress: ContainerProgress) => void>();
  list() { return files; }
  ensure(name: string): Promise<unknown> {
    this.started.push(name);
    return new Promise<void>((resolve, reject) => this.waiting.set(name, { resolve, reject }));
  }
  finish(name: string, error?: string): void {
    const size = files.find(file => file.name === name)!.size;
    for (const listener of this.listeners) listener({ phase: "downloading", file: name, loadedBytes: size / 2, totalBytes: size });
    if (error) return this.waiting.get(name)!.reject(new Error(error));
    this.cached.add(name);
    for (const listener of this.listeners) listener({ phase: "ready", file: name, loadedBytes: size, totalBytes: size });
    this.waiting.get(name)!.resolve();
  }
  async cachedNames() { return new Set(this.cached); }
  async remove(name: string) {
    this.removed.push(name);
    return this.cached.delete(name);
  }
  addProgressListener(listener: (progress: ContainerProgress) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("localized UI art downloads with home resources and survives resource cleanup", async () => {
  const store = new FakeStore();
  store.list = () => [...files, { name: "locale_ui.rho", size: 250 }];
  store.cached = new Set(files.map(file => file.name));
  store.ensure = async name => {
    store.started.push(name);
    store.cached.add(name);
  };
  const manager = new ResourceManager(store, packs);
  await manager.ready;
  assert.ok(manager.group("home")!.containers.includes("locale_ui.rho"));
  assert.ok(!manager.group("other")!.containers.includes("locale_ui.rho"));
  assert.equal(manager.status("home").state, "partial");

  await manager.downloadGroup("home").done;
  assert.deepEqual(store.started, ["locale_ui.rho"]);
  assert.equal(manager.status("home").state, "complete");

  await manager.removeGroup("other");
  assert.deepEqual(store.removed, ["stage_weird.rho"]);
  assert.equal(manager.removableBytes("home"), 0);
  assert.equal(await manager.removeGroup("home"), 0);
  assert.ok(store.cached.has("locale_ui.rho"), "language art stays available after cleanup");
});

test("the queue runs the highest priority first and downloads each container once", async () => {
  const store = new FakeStore();
  store.cached.add("gui_font.rho");
  const manager = new ResourceManager(store, packs, undefined, 1);
  await manager.ready;
  assert.equal(manager.status("home").state, "partial");
  const background = manager.download(["character_bazzi.rho", "effect.rho"], { label: "后台", priority: "low" });
  const home = manager.downloadGroup("home", "high");
  const again = manager.downloadGroup("home", "normal");
  assert.deepEqual(store.started, ["character_bazzi.rho"]);
  store.finish("character_bazzi.rho");
  await tick();
  // 首页 (high) goes before the low job's effect.rho.
  for (const name of ["aaa.pk", "myRoom.rho", "stage_common.rho", "theme_village.rho"]) {
    assert.equal(store.started.at(-1), name);
    store.finish(name);
    await tick();
  }
  await home.done;
  await again.done;
  assert.equal(manager.status("home").state, "complete");
  assert.equal(store.started.at(-1), "effect.rho");
  assert.equal(background.state, "running");
  store.finish("effect.rho");
  await background.done;
  assert.equal(new Set(store.started).size, store.started.length, "each container once");
});

test("background (low) containers take one download slot; pages and races get the others", async () => {
  const store = new FakeStore();
  const options: Array<{ name: string; background?: boolean }> = [];
  const ensure = store.ensure.bind(store);
  store.ensure = (name: string, flags?: { background?: boolean }) => {
    options.push({ name, background: flags?.background });
    return ensure(name);
  };
  const manager = new ResourceManager(store, packs, undefined, 3);
  await manager.ready;
  manager.download(["myRoom.rho", "stage_common.rho", "effect.rho"], { label: "首页资源", priority: "low" });
  assert.deepEqual(store.started, ["myRoom.rho"]);
  const race = manager.download(["track_forest_I01.rho", "theme_forest.rho", "sound_bgm_forest.rho"],
    { label: "本局赛道资源", priority: "high" });
  assert.deepEqual(store.started, ["myRoom.rho", "track_forest_I01.rho", "theme_forest.rho"]);
  assert.deepEqual(options.map(entry => entry.background), [true, false, false]);
  store.finish("track_forest_I01.rho");
  await tick();
  assert.equal(store.started.at(-1), "sound_bgm_forest.rho", "the race goes before the background queue");
  store.finish("theme_forest.rho");
  store.finish("sound_bgm_forest.rho");
  await race.done;
  await tick();
  assert.equal(store.started.length, 4, "still one background download at a time");
  store.finish("myRoom.rho");
  await tick();
  assert.equal(store.started.at(-1), "stage_common.rho");
});

test("a race holds background downloads: the running one pauses, none starts, all resume after", async () => {
  const store = new FakeStore();
  let paused = 0;
  (store as ResourceStoreApi).pauseBackground = () => {
    paused++;
    for (const [name, waiting] of store.waiting) {
      if (!store.cached.has(name)) waiting.reject(new DownloadPausedError(name));
    }
  };
  const manager = new ResourceManager(store, packs, undefined, 3);
  await manager.ready;
  const home = manager.download(["myRoom.rho", "stage_common.rho"], { label: "首页资源", priority: "low" });
  assert.deepEqual(store.started, ["myRoom.rho"]);
  const release = manager.holdBackground();
  const again = manager.holdBackground();
  assert.equal(paused, 1, "paused once for nested holds");
  await tick();
  assert.equal(home.state, "running", "a pause is not a failure");
  assert.deepEqual(store.started, ["myRoom.rho"], "nothing starts while held");
  const page = manager.download(["effect.rho"], { label: "比赛", priority: "high" });
  assert.equal(store.started.at(-1), "effect.rho", "pages and races still download");
  store.finish("effect.rho");
  await page.done;
  release();
  await tick();
  assert.equal(store.started.length, 2, "still held by the other race");
  again();
  await tick();
  assert.deepEqual(store.started.slice(2), ["myRoom.rho"], "the paused container resumes");
  store.finish("myRoom.rho");
  await tick();
  store.finish("stage_common.rho");
  await home.done;
});

test("cancel, failures, deletes and a race's track containers", async () => {
  const store = new FakeStore();
  const manager = new ResourceManager(store, packs, {
    entriesUnderCanonicalPrefix: prefix => prefix === "track_/forest_R09" ? [{ sourceName: "DataPack3_00001.rho5" }] : [],
  }, 1);
  await manager.ready;
  const job = manager.downloadGroup("track:forest");
  assert.equal(store.started.length, 1);
  job.cancel();
  await assert.rejects(job.done, /CANCELLED/);
  store.finish(store.started[0]!);
  await tick();
  assert.equal(store.started.length, 1, "the cancelled job's queue is gone");

  const failing = manager.download(["effect.rho", "theme_forest.rho"], { label: "x" });
  store.finish("effect.rho", "OPFS 空间不足");
  await assert.rejects(failing.done, /OPFS/);
  assert.equal(manager.lastFailure(), "OPFS 空间不足");

  // The containers of the track's own folder.
  assert.deepEqual(manager.trackContainers("track_/forest_R09/track.1s"), ["DataPack3_00001.rho5"]);
  assert.deepEqual(manager.trackContainers("forest_R09_rvs"), ["DataPack3_00001.rho5"]);
  assert.deepEqual(manager.trackContainers("unknown_R01"), []);

  store.cached.add("myRoom.rho");
  store.cached.add("stage_myRoom.rho");
  await manager.refresh();
  // myRoom.rho stays (首页 needs it); stage_myRoom.rho goes.
  assert.equal(manager.removableBytes("myroom"), 5);
  assert.equal(manager.removableBytes("home"), 0);
  await manager.removeGroup("myroom");
  assert.deepEqual(store.removed, ["stage_myRoom.rho"]);
  assert.equal(await manager.removeGroup("home"), 0, "首页 is never deleted");
});

/** A Map-backed OPFS directory. */
function memoryDirectory(): DirectoryHandle & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  const directory = {
    files,
    async getDirectoryHandle() { return directory; },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name) && !options?.create) throw new DOMException("missing", "NotFoundError");
      if (!files.has(name)) files.set(name, new Uint8Array());
      return {
        async getFile() { return new Blob([files.get(name)! as BlobPart]); },
        async createWritable() {
          const chunks: Uint8Array[] = [];
          return {
            async write(chunk: Uint8Array) { chunks.push(chunk); },
            async close() { files.set(name, new Uint8Array(Buffer.concat(chunks))); },
            async abort() {},
          };
        },
      };
    },
    async removeEntry(name: string) { files.delete(name); },
    async *keys() { yield* files.keys(); },
  };
  return directory;
}

test("the store lists its cached containers, removes them and reports to listeners", async () => {
  const directory = memoryDirectory();
  const manifest = { version: "p3553", revision: "r1", files: [
    { name: "a.rho", size: 3, mtimeMs: 0, sha256: "" }, { name: "b.rho", size: 2, mtimeMs: 0, sha256: "" }] };
  const store = new ContainerStore({
    manifest: manifest as never,
    storage: { getDirectory: async () => directory, estimate: async () => ({ quota: 1e9, usage: 0 }) },
    fetcher: (async (url: string) => new Response(url.includes("/a.rho") ? "abc" : "xy")) as never,
  });
  const events: string[] = [];
  const release = store.addProgressListener(progress => events.push(`${progress.phase}:${progress.file}`));
  directory.files.set("b.rho", new Uint8Array([1])); // a partial copy does not count
  assert.deepEqual([...await store.cachedNames()], []);
  await store.ensure("a.rho");
  assert.deepEqual([...await store.cachedNames()], ["a.rho"]);
  assert.ok(events.includes("ready:a.rho"));
  release();
  assert.equal(await store.remove("a.rho"), true);
  assert.equal(await store.remove("a.rho"), false);
  assert.deepEqual([...await store.cachedNames()], []);
});

test("a cached container that vanished from OPFS downloads again on the next read", async () => {
  const directory = memoryDirectory();
  const gone = new Set<string>();
  const open = directory.getFileHandle.bind(directory);
  // Like a browser that cleared the file after getFile(): the held Blob's reads fail.
  directory.getFileHandle = async (name: string, options?: { create?: boolean }) => {
    const handle = await open(name, options);
    return { ...handle, getFile: async () => {
      const blob = await handle.getFile();
      return { size: blob.size, slice: (start?: number, end?: number) => ({ arrayBuffer: async () => {
        if (gone.has(name)) throw new DOMException("gone", "NotFoundError");
        return blob.slice(start, end).arrayBuffer();
      } }) } as unknown as Blob;
    } };
  };
  const remove = directory.removeEntry!.bind(directory);
  directory.removeEntry = async (name: string) => {
    gone.delete(name);
    await remove(name);
  };
  let fetches = 0;
  const store = new ContainerStore({
    manifest: { version: "p3553", revision: "r1", files: [{ name: "a.rho", size: 3, mtimeMs: 0, sha256: "" }] } as never,
    storage: { getDirectory: async () => directory, estimate: async () => ({ quota: 1e9, usage: 0 }) },
    fetcher: (async () => { fetches++; return new Response("abc"); }) as never,
  });
  assert.equal(new TextDecoder().decode(await store.readRange("a.rho", 0, 3)), "abc");
  gone.add("a.rho");
  directory.files.delete("a.rho");
  // The store still holds the first Blob: its read fails, the file downloads again.
  assert.equal(new TextDecoder().decode(await store.readRange("a.rho", 0, 3)), "abc");
  assert.equal(fetches, 2);
});
