import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  loadLobbyRoomTrack,
  type LobbyRoomTrackDependencies, type LobbyRoomTrackHost,
} from "./lobby-room-track";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Room = LobbyRoomTrackHost & { loadTrack(): Promise<void> };
type Mode = "normal" | "reverse" | "random" | "lte-random" |
  "roadblock" | "missing-track" | "missing-resource" |
  "missing-card" | "missing-theme" | "decode-error" |
  "cancelled" | "disposed" | "no-track" | "same-identity";

function makeFixture(mode: Mode, rewritten: boolean) {
  const events: unknown[][] = [];
  let canvasId = 0;
  let room: Room;
  const makeCanvas = (image: { width: number; height: number;
    pixels: ArrayLike<number> }) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").putImageData(new ImageData(
      new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
    return canvas;
  };
  class ImageData {
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      events.push(["image-data", [...data], width, height]);
    }
  }
  const document = { createElement(tag: string) {
    const id = ++canvasId;
    events.push(["create-element", tag, id]);
    return {
      id, width: 0, height: 0,
      getContext(kind: string) {
        events.push(["get-context", id, kind]);
        return { putImageData(_image: unknown, x: number, y: number) {
          events.push(["put-image", id, x, y]);
        } };
      },
    };
  } };
  const dependencies: LobbyRoomTrackDependencies = {
    randomTrack(code) {
      events.push(["random-track", code]);
      return { code: String(code), title: "随机地图", cardToken: "random-card" };
    },
    mode() { events.push(["mode"]);
      return mode === "lte-random" ? "lte"
        : mode === "roadblock" ? "roadblock" : "normal"; },
    uiResource(_library, roots, token) {
      events.push(["ui-resource", roots, token]);
      return { async bytes() {
        events.push(["ui-bytes", token]);
        return new TextEncoder().encode(token);
      } };
    },
    async decodePng(bytes) {
      const token = new TextDecoder().decode(bytes);
      events.push(["decode-png", token]);
      if (mode === "decode-error") throw new Error("bad PNG");
      if (mode === "cancelled") room.trackLoad++;
      return { width: 2, height: 1, pixels: Uint8Array.of(1, 2, 3, 4,
        5, 6, 7, 8), token };
    },
    canvas: makeCanvas,
    async roadblockTracks() {
      events.push(["roadblock-tracks"]);
      return [{ id: "track-a", title: "Roadblock", path: "track/path" }];
    },
    theme(metadata) { events.push(["theme", metadata]);
      return mode === "missing-theme" ? undefined : "forest-theme"; },
  };
  const Original = new Function("X6", "G2", "p2", "U1", "document",
    "ImageData", "Cw", "wa",
    `${originalClass}\nreturn py;`)(
      dependencies.randomTrack, dependencies.mode,
      dependencies.decodePng, dependencies.uiResource,
      document, ImageData, dependencies.roadblockTracks,
      dependencies.theme,
    ) as new () => Room;
  room = Object.create(Original.prototype) as Room;
  room.room = mode === "no-track" ? {}
    : mode === "random" || mode === "lte-random"
      ? { trackId: "track-a", randomTrackCode: 9 }
      : { trackId: mode === "reverse" ? "track-a_rvs" : "track-a" };
  room.library = {
    async timeAttackTrackCatalog() {
      events.push(["track-catalog"]);
      if (mode === "missing-track") return [];
      return [{ id: room.room.trackId!, title: "Forest",
        path: "track/path" }];
    },
    get(path) {
      events.push(["get-track", path]);
      return mode === "missing-resource" ? undefined
        : { canonicalPath: "stage\\forest\\map.rho",
          virtualPath: "stage/forest/map.rho" };
    },
    resolveContainerPath(path, containerPath) {
      events.push(["resolve-card", path, containerPath]);
      return { status: mode === "missing-card" ? "missing" : "found",
        entry: { async bytes() {
          events.push(["card-bytes"]);
          return new TextEncoder().encode("track-card");
        } } };
    },
    async trackMetadata(trackId) {
      events.push(["track-metadata", trackId]);
      return { difficulty: 3, theme: "forest" };
    },
  };
  room.actions = { onError(error) {
    events.push(["error", (error as Error).message]);
  } };
  room.disposed = mode === "disposed";
  room.trackLoad = 0;
  room.trackTitle = "old-title";
  room.view = { render() { events.push(["render"]); } };
  if (mode === "same-identity") room.trackIdentity = "track-a";
  if (rewritten) Object.assign(room, {
    loadTrack() { return loadLobbyRoomTrack(room, dependencies); },
  });
  return { room, events };
}

test("room track card, reverse stamp and random card match release", async () => {
  for (const mode of ["normal", "reverse", "random", "lte-random",
    "roadblock", "no-track", "same-identity"] as const) {
    const inspect = async (rewritten: boolean) => {
      const { room, events } = makeFixture(mode, rewritten);
      await room.loadTrack();
      return { events, identity: room.trackIdentity,
        title: room.trackTitle, generation: room.trackLoad,
        image: (room.trackImage as { id?: number })?.id,
        icon: (room.trackIcon as { id?: number })?.id,
        reverse: (room.trackReverseStamp as { id?: number })?.id,
        difficulty: room.trackDifficulty };
    };
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});

test("room track errors, generation cancellation and disposal match release", async () => {
  for (const mode of ["missing-track", "missing-resource", "missing-card",
    "missing-theme", "decode-error", "cancelled", "disposed"] as const) {
    const inspect = async (rewritten: boolean) => {
      const { room, events } = makeFixture(mode, rewritten);
      await room.loadTrack();
      return { events, identity: room.trackIdentity,
        title: room.trackTitle, generation: room.trackLoad,
        image: (room.trackImage as { id?: number })?.id,
        icon: (room.trackIcon as { id?: number })?.id };
    };
    assert.deepEqual(await inspect(true), await inspect(false), mode);
  }
});
