import assert from "node:assert/strict";
import test from "node:test";

import { renderLobbyList, type LobbyListRenderHost } from "./lobby-list-render";

/** A 2D context that accepts every drawing call. */
function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "measureText") return (value: string) => ({ width: value.length * 10 });
      if (key === "createLinearGradient") return () => gradient;
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

interface Button { key: string; label: string; disabled?: boolean; activate(): void }

function lobby(overrides: Partial<LobbyListRenderHost> = {},
  options: Partial<LobbyListRenderHost["options"]> = {}) {
  const modes: unknown[][] = [];
  const activated: string[] = [];
  let buttons: Button[] = [];
  const host = {
    disposed: false,
    enabled: true,
    page: 0, total: 0, rooms: [], gameplay: "ordinary", hits: [],
    canvas: { width: 0, height: 0, style: {}, addEventListener() {} },
    context: fakeContext(),
    assets: { definition: { name: "root", children: [] }, textures: new Map(),
      trackTitles: new Map([["village_R01", "城镇 高速公路"]]), strings: new Map() },
    options: { root: { getBoundingClientRect: () => ({ width: 1600, height: 900 }) },
      onMode: (...args: unknown[]) => { modes.push(args); }, version: "p3553", ...options },
    buttons: { update: (entries: Button[]) => { buttons = entries; } },
    activate: (name: string) => { activated.push(name); },
    draw() {},
    ...overrides,
  } as unknown as LobbyListRenderHost;
  const render = () => renderLobbyList(host, {
    viewport: (width, height, ratio) => ({ width: width * ratio, height: height * ratio,
      scaleX: ratio, scaleY: ratio }),
    modeForButton: () => undefined,
    roomLabel: room => `${(room as { name?: string }).name}（${room.count}/${room.capacity}）`,
    randomTrack: () => ({ title: "随机赛道" }),
  });
  return { host, modes, activated, render, buttons: () => buttons };
}

async function withWindow(run: () => Promise<void> | void): Promise<void> {
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1, setTimeout: () => 0 } as unknown as
    Window & typeof globalThis;
  try { await run(); } finally { globalThis.window = previous; }
}

test("连上服务后默认打开竞速自订，并发布标签、分类、筛选与按钮", () => withWindow(async () => {
  const view = lobby();
  view.render();
  await Promise.resolve();
  assert.deepEqual(view.modes, [["speedIndiCombine", 0, "ordinary"]]);
  const labels = view.buttons().map(button => button.label);
  for (const label of ["竞速赛", "道具赛", "ETC", "竞速个人赛（个人）", "竞速自订（一般/无限）",
    "个人赛筛选（已勾选）", "无限团体筛选（已勾选）", "创建房间", "快速开始（F5）"])
    assert.ok(labels.includes(label), label);
  view.buttons().find(button => button.key === "quickJoin")!.activate();
  assert.deepEqual(view.activated, ["quickJoin"]);
}));

test("首页快速进入的频道决定打开的分类", () => withWindow(async () => {
  const view = lobby({}, { lobbyChannel: "speedIndiInfinit", lobbyGameplay: "ordinary" });
  view.render();
  await Promise.resolve();
  assert.deepEqual(view.modes, [["speedIndiInfinit", 0, "ordinary"]]);
  assert.equal(view.host.lobbyUi?.category, "speedInfinit");
  assert.ok(!view.buttons().some(button => button.key.startsWith("filter:")));
}));

test("房间行按分类过滤，满员不可加入，未连接时按钮停用", () => withWindow(async () => {
  const rooms = [
    { name: "个人房", mode: "individual", speed: 7, count: 1, capacity: 8, trackId: "village_R01" },
    { name: "组队房", mode: "team", speed: 7, count: 8, capacity: 8 },
    { name: "无限房", mode: "individual", speed: 4, count: 2, capacity: 8, randomTrackCode: 0 },
  ];
  const view = lobby({ rooms, total: 3, channelName: "speedTeamCombine" } as
    Partial<LobbyListRenderHost>);
  view.render();
  // 竞速自订 lists every ordinary channel, so it stays chosen.
  assert.equal(view.host.lobbyUi?.category, "speedCustom");
  const rows = () => view.buttons().filter(button => /^room\d$/.test(button.key));
  assert.deepEqual(rows().map(button => button.key), ["room0", "room1", "room2"]);
  assert.equal(rows()[0]!.label, "加入 个人房（1/8）");

  view.host.lobbyUi!.category = "speedTeam";
  view.render();
  assert.deepEqual(rows().map(button => [button.key, button.disabled]), [["room1", true]]);
  assert.deepEqual(view.host.visibleRoomIndexes?.(), [1]);

  (view.host as { enabled: boolean }).enabled = false;
  view.render();
  assert.deepEqual(rows(), []);
  assert.equal(view.buttons().find(button => button.key === "createRoom")?.disabled, true);
  assert.ok(!view.host.hits.some(hit => hit.name === "quickJoin"));
}));

test("翻页按钮只在有上一页或下一页时出现", () => withWindow(() => {
  const rooms = Array.from({ length: 10 }, (_, index) =>
    ({ name: `房${index}`, mode: "individual", speed: 7, count: 1, capacity: 8 }));
  const view = lobby({ rooms, total: 25, page: 1, channelName: "speedIndiCombine" } as
    Partial<LobbyListRenderHost>);
  view.render();
  const keys = view.buttons().map(button => button.key);
  assert.ok(keys.includes("roomLeft") && keys.includes("roomRight"));
  (view.host as { page: number }).page = 2;
  view.render();
  assert.ok(!view.buttons().some(button => button.key === "roomRight"));
}));
