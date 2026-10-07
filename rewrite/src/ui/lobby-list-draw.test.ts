import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { drawLobbyListNode, type LobbyDrawDependencies,
  type LobbyDrawHost, type LobbyLayoutNode, type LobbyRect } from "./lobby-list-draw";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

function node(name: string, bounds: LobbyRect, children: LobbyLayoutNode[] = [],
  attributes: Record<string, string> = {}): LobbyLayoutNode {
  return { name, children, bounds, attributes } as LobbyLayoutNode;
}

test("多人大厅树的文字、按钮、房间与裁剪和发行版一致", async () => {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class Ew {");
  const end = release.indexOf("\nfunction U1(", start);
  assert.ok(start >= 0 && end > start);

  const eventsOriginal: unknown[][] = [];
  const eventsRewrite: unknown[][] = [];
  const attribute = (entry: LobbyLayoutNode, name: string): string | undefined =>
    (entry as LobbyLayoutNode & { attributes: Record<string, string> }).attributes[name];
  const rectangle = (entry: LobbyLayoutNode): LobbyRect =>
    (entry as LobbyLayoutNode & { bounds: LobbyRect }).bounds;
  const modeForButton = (name: string) => name === "giantButton"
    ? { gameplay: "giant" } : undefined;
  const interactiveNames = new Set(["giantButton", "roomRight"]);
  const imageState = () => 1;
  const fitRoomTitle = (room: { count: number }, width: number,
    measure: (value: string) => number) => `room:${room.count}:${width}:${measure("abc")}`;
  const measure = (_context: unknown, text: string) => ({ width: text.length * 8 });
  const randomTrack = (code: number) => ({ title: `随机 ${code}` });
  const makeContext = (events: unknown[][]): CanvasRenderingContext2D => ({
    save: () => events.push(["save"]),
    restore: () => events.push(["restore"]),
    drawImage: (...args: unknown[]) => events.push(["drawImage", ...args]),
    strokeRect: (...args: unknown[]) => events.push(["strokeRect", ...args]),
    filter: "none", strokeStyle: "", lineWidth: 0,
  }) as unknown as CanvasRenderingContext2D;

  const Original = new Function("T", "V0", "Zc", "aQ", "st", "ct", "CX", "ve",
    "m9", "X6", "Yp", `${release.slice(start, end)}\nreturn Ew;`)(
    attribute, rectangle, modeForButton, interactiveNames, imageState,
    (context: CanvasRenderingContext2D, texture: unknown, bounds: LobbyRect) =>
      (context as unknown as { log?: unknown }).log ?? eventsOriginal.push(["tile", texture, bounds]),
    fitRoomTitle, measure,
    (_context: unknown, value: string, bounds: LobbyRect, style: unknown) =>
      eventsOriginal.push(["text", value, bounds, style]),
    randomTrack, "Lobby Font",
  ) as { prototype: { draw: (...args: unknown[]) => void } };
  const dependencies: LobbyDrawDependencies = {
    attribute,
    rectangle,
    modeForButton,
    interactiveNames,
    imageState,
    drawTexture: (_context, texture, bounds) => eventsRewrite.push(["tile", texture, bounds]),
    fitRoomTitle,
    measure,
    drawText: (_context, value, bounds, style) =>
      eventsRewrite.push(["text", value, bounds, style]),
    randomTrack,
    fontFamily: "Lobby Font",
  };

  const trackName = node("trackName", { x: 610, y: 100, width: 190, height: 25 });
  const roomNode = node("room0", { x: 200, y: 100, width: 600, height: 70 }, [
    node("roomTitle", { x: 220, y: 100, width: 360, height: 25 }, [],
      { textRender: "20", textAlign: "hcenter" }),
    trackName,
    node("userCnt", { x: 670, y: 130, width: 80, height: 20 }),
    node("lock", { x: 760, y: 120, width: 20, height: 20 }),
  ]);
  const giant = node("giantButton", { x: 20, y: 20, width: 80, height: 80 });
  const tree = node("multiplay_pop", { x: 0, y: 0, width: 1600, height: 900 }, [
    roomNode, giant, node("roomRight", { x: 1000, y: 600, width: 60, height: 30 }),
  ]);
  const textures = new Map<LobbyLayoutNode, Array<{
    image: CanvasImageSource; width: number; height: number;
  }>>([
    [roomNode, [{ image: "room" as unknown as CanvasImageSource, width: 600, height: 70 }]],
    [giant, Array.from({ length: 4 }, (_, index) => ({
      image: `giant${index}` as unknown as CanvasImageSource, width: 40, height: 20,
    }))],
  ]);
  const createHost = (events: unknown[][]): LobbyDrawHost => ({
    mode: "speed", page: 0, total: 24, rooms: [{
      count: 2, capacity: 8, locked: true, randomTrackCode: 3,
    }],
    enabled: true, hovered: "giantButton", pressed: undefined, gameplay: "giant",
    context: makeContext(events), hits: [],
    assets: { textures, trackTitles: new Map(), strings: new Map() },
    draw() {},
  });
  const baseline = createHost(eventsOriginal);
  const rewritten = createHost(eventsRewrite);
  baseline.draw = function (...args) { Original.prototype.draw.call(this, ...args); };
  rewritten.draw = function (entry, parent, room, titleRight) {
    drawLobbyListNode(this, entry, parent, room, titleRight, dependencies);
  };
  const viewport = { x: 0, y: 0, width: 1600, height: 900 };
  baseline.draw(tree, viewport);
  rewritten.draw(tree, viewport);
  assert.deepEqual(eventsRewrite, eventsOriginal);
  assert.deepEqual(rewritten.hits, baseline.hits);
});

test("房间列表标出游戏中或等待中，房间名让出标签位置", () => {
  const texts: Array<[string, LobbyRect]> = [];
  const fills: string[] = [];
  const fake = { save() {}, restore() {}, drawImage() {}, strokeRect() {},
    fillRect() { fills.push(fake.fillStyle); }, fillStyle: "", filter: "none" };
  const context = fake as unknown as CanvasRenderingContext2D;
  const dependencies: LobbyDrawDependencies = {
    attribute: (entry, name) =>
      (entry as LobbyLayoutNode & { attributes: Record<string, string> }).attributes[name],
    rectangle: entry => (entry as LobbyLayoutNode & { bounds: LobbyRect }).bounds,
    modeForButton: () => undefined, interactiveNames: new Set(), imageState: () => 0,
    drawTexture() {}, fitRoomTitle: (_room, width) => `title:${width}`,
    measure: (_context, value) => ({ width: value.length * 10 }),
    drawText: (_context, value, bounds) => { texts.push([value, bounds]); },
    randomTrack: () => undefined, fontFamily: "Lobby Font", showRoomStatus: true,
  };
  const rooms = [{ count: 3, capacity: 8, gaming: true }, { count: 1, capacity: 8 }];
  const host: LobbyDrawHost = {
    mode: "speed", page: 0, total: 2, rooms, enabled: true, gameplay: "ordinary",
    context, hits: [], assets: { textures: new Map(), trackTitles: new Map(), strings: new Map() },
    draw(entry, parent, room, titleRight) {
      drawLobbyListNode(this, entry, parent, room, titleRight, dependencies);
    },
  };
  // The BML reader looks names up as attributes.
  const named = (name: string, bounds: LobbyRect, children: LobbyLayoutNode[] = []) =>
    node(name, bounds, children, { name });
  const row = (index: number) => named(`room${index}`, { x: 0, y: index * 40, width: 600, height: 40 }, [
    named("roomTitle", { x: 0, y: index * 40, width: 400, height: 40 }),
    named("trackName", { x: 408, y: index * 40, width: 150, height: 40 }),
  ]);
  host.draw(named("list", { x: 0, y: 0, width: 600, height: 80 }, [row(0), row(1)]),
    { x: 0, y: 0, width: 600, height: 80 });

  assert.deepEqual(texts.map(([value]) => value).filter(value => /中$/.test(value)),
    ["游戏中", "准备中"]);
  assert.deepEqual(fills, ["#d9534f", "#2e9d5b"]);
  // 400px column - 44px tag - 6px gap; the title is drawn only in that space.
  const title = texts.find(([value]) => value.startsWith("title:"))!;
  assert.equal(title[0], "title:350");
  assert.equal(title[1].width, 350);
  // A racing room with space stays joinable; the late joiner waits in the room.
  assert.deepEqual(host.hits.map(hit => hit.name), ["room0", "room1"]);
});
