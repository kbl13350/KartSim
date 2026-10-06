import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  loadRaceBgm, prepareMultiplayerBgm, selectRaceBgm,
  type RaceBgmLoadingDependencies, type RaceBgmLoadingHost,
} from "./race-bgm-loading";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class P7 {");
const end = release.indexOf("\nfunction Zd0", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Bgm = RaceBgmLoadingHost & {
  readyBuffer: unknown;
  garageBuffer: unknown;
  winBuffer: unknown;
  loseBuffer: unknown;
  random: unknown;
  prepareMultiplayer(library: unknown, lobbyPath?: string): Promise<void>;
  selectRace(library: unknown, track: unknown): Promise<void>;
};
type BgmConstructor = {
  new (context: unknown, playlist: { buffers: unknown[]; names: unknown[] },
    ready: unknown, garage: unknown, win: unknown, lose: unknown,
    random: unknown): Bgm;
  load(library: unknown, track: unknown, random: unknown,
    context: unknown): Promise<Bgm>;
};

function makeFixture(mode: "normal" | "alternate-garage" | "fail-update") {
  const events: unknown[][] = [];
  const cache = new Map<string, { path: string; bytes(): Promise<Uint8Array> }>();
  const dependencies: RaceBgmLoadingDependencies = {
    resource(_library, path) {
      events.push(["resource", path]);
      let resource = cache.get(path);
      if (!resource) {
        resource = { path, async bytes() {
          events.push(["bytes", path]);
          return new TextEncoder().encode("<bgm/>");
        } };
        cache.set(path, resource);
      }
      return resource;
    },
    garageMusic(_library, single) {
      events.push(["garage-music", (single as unknown as { path: string }).path]);
      return mode === "alternate-garage"
        ? dependencies.resource("library", "sound_/bgm/main/garage.ogg")
        : single;
    },
    parseMultiplayerList(xml, lobbyPath) {
      events.push(["parse-list", xml, lobbyPath]);
      return { lobby: `lobby:${lobbyPath}`, room: "room:standard" };
    },
    async decodeBuffer(resource, context) {
      const path = (resource as unknown as { path: string }).path;
      events.push(["decode", path, context]);
      if (mode === "fail-update" && path === "lobby:theme") {
        throw new Error("theme unavailable");
      }
      return `buffer:${path}`;
    },
    async racePlaylist(_library, track, context) {
      events.push(["playlist", track, context]);
      return { buffers: [`race:${String(track)}`], names: [`name:${String(track)}`] };
    },
    create: () => undefined,
  };
  const Original = new Function("G5", "Fc0", "Kt", "eG", "ef0",
    `${originalClass}\nreturn P7;`)(
      dependencies.resource, dependencies.parseMultiplayerList,
      dependencies.decodeBuffer, dependencies.racePlaylist,
      dependencies.garageMusic,
    ) as BgmConstructor;
  dependencies.create = (context, playlist, ready, garage, win, lose, random) =>
    new Original(context, playlist, ready, garage, win, lose, random);
  return { Original, dependencies, events };
}

function snapshot(bgm: Bgm) {
  return {
    ready: bgm.readyBuffer, garage: bgm.garageBuffer,
    win: bgm.winBuffer, lose: bgm.loseBuffer,
    context: bgm.context, random: bgm.random,
    raceBuffers: bgm.raceBuffers, raceNames: bgm.raceNames,
    currentRaceName: bgm.currentRaceNameValue,
    multiplayerBuffers: bgm.multiplayerBuffers,
    multiplayerLobbyPath: bgm.multiplayerLobbyPath,
  };
}

test("static BGM load preserves shared and separate garage buffer cases", async () => {
  for (const mode of ["normal", "alternate-garage"] as const) {
    const inspect = async (rewritten: boolean) => {
      const { Original, dependencies, events } = makeFixture(mode);
      const bgm = rewritten
        ? await loadRaceBgm("library", "track-a", "random", "context", dependencies) as Bgm
        : await Original.load("library", "track-a", "random", "context");
      return { events, bgm: snapshot(bgm) };
    };
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});

test("multiplayer music loads once, refreshes lobby only, and retains state on failure", async () => {
  for (const mode of ["normal", "fail-update"] as const) {
    const inspect = async (rewritten: boolean) => {
      const { Original, dependencies, events } = makeFixture(mode);
      const bgm = new Original("context", { buffers: [], names: [] },
        "ready", "garage", "win", "lose", "random");
      const outcomes: unknown[] = [];
      const prepare = async (path: string) => {
        try {
          outcomes.push(rewritten
            ? await prepareMultiplayerBgm(bgm, "library", path, dependencies)
            : await bgm.prepareMultiplayer("library", path));
        } catch (error) { outcomes.push({ error: (error as Error).message }); }
      };
      await prepare("");
      await prepare("");
      await prepare("theme");
      const afterPrepare = snapshot(bgm);
      bgm.currentRaceNameValue = "old-name";
      if (rewritten) await selectRaceBgm(bgm, "library", "new-track", dependencies);
      else await bgm.selectRace("library", "new-track");
      return { events, outcomes, afterPrepare, afterSelect: snapshot(bgm) };
    };
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});
