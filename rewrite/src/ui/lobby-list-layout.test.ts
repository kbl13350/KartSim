import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOBBY_CATEGORY, LOBBY_LOADING_MS, LOBBY_TABS, categoryForChannel,
  createLobbyListUiState, lobbyListLoading, lobbyRoomModeLabel, lobbyTabAvailable,
  quickStartRoom, reconcileLobbyCategory, requestLobbyList, roomFilterKey,
  trackThemeName, visibleLobbyRooms, type LobbyListRoom,
} from "./lobby-list-layout";

const room = (mode: string, speed: number, extra: Partial<LobbyListRoom> = {}): LobbyListRoom =>
  ({ mode, speed, count: 1, capacity: 8, ...extra });

test("频道与玩法打开对应分类，竞速自订只兜底", () => {
  assert.equal(categoryForChannel(undefined)?.id, DEFAULT_LOBBY_CATEGORY);
  assert.equal(categoryForChannel("speedIndiCombine")?.id, "speedIndi");
  assert.equal(categoryForChannel("speedTeamCombine")?.id, "speedTeam");
  assert.equal(categoryForChannel("speedIndiInfinit")?.id, "speedInfinit");
  assert.equal(categoryForChannel("speedTeamInfinit")?.id, "speedInfinit");
  assert.equal(categoryForChannel("speedIndiCombine", "grip")?.id, "grip");
  assert.equal(categoryForChannel("speedIndiInfinit", "shadow")?.id, "shadow");
});

test("列表回来时保留仍然匹配的分类，否则跟随频道", () => {
  const state = createLobbyListUiState();
  reconcileLobbyCategory(state, "speedTeamInfinit", "ordinary");
  assert.equal(state.category, "speedCustom");
  state.category = "speedIndi";
  reconcileLobbyCategory(state, "speedTeamCombine", "ordinary");
  assert.equal(state.category, "speedTeam");
  reconcileLobbyCategory(state, "speedIndiCombine", "giant");
  assert.deepEqual([state.tab, state.category], ["etc", "giant"]);
});

test("分类和筛选框按房间模式与速度过滤", () => {
  const rooms = [room("individual", 7), room("team", 7), room("individual", 4),
    room("team", 4)];
  assert.deepEqual(rooms.map(roomFilterKey), ["indi", "team", "indiInfinit", "teamInfinit"]);
  const state = createLobbyListUiState();
  assert.deepEqual(visibleLobbyRooms(state, rooms), [0, 1, 2, 3]);
  state.filters.team = false;
  state.filters.indiInfinit = false;
  assert.deepEqual(visibleLobbyRooms(state, rooms), [0, 3]);
  state.category = "speedTeam";
  assert.deepEqual(visibleLobbyRooms(state, rooms), [1]);
  state.category = "speedInfinit";
  assert.deepEqual(visibleLobbyRooms(state, rooms), [2, 3]);
  state.category = "grip";
  assert.deepEqual(visibleLobbyRooms(state, rooms), [0, 1, 2, 3]);
});

test("模式列、快速开始与赛道主题", () => {
  assert.equal(lobbyRoomModeLabel(room("individual", 7)), "个人赛");
  assert.equal(lobbyRoomModeLabel(room("team", 7)), "团体赛");
  assert.equal(lobbyRoomModeLabel(room("individual", 4)), "无限个人");
  assert.equal(lobbyRoomModeLabel(room("team", 4)), "无限团体");
  assert.equal(lobbyRoomModeLabel(room("team", 7, { gameplay: "grip" })), "组队抓地");
  assert.equal(lobbyRoomModeLabel(room("individual", 4, { gameplay: "shadow" })), "个人幽灵无限");
  const rooms = [room("individual", 7, { locked: true }), room("individual", 7, { gaming: true }),
    room("individual", 7, { count: 8 }), room("individual", 7), room("team", 7)];
  assert.equal(quickStartRoom(rooms, [0, 1, 2, 3, 4]), 3);
  assert.equal(quickStartRoom(rooms, [4]), 4);
  assert.equal(quickStartRoom(rooms, [0, 1, 2]), undefined);
  assert.equal(trackThemeName("城镇 高速公路"), "城镇");
  assert.equal(trackThemeName("高速公路"), undefined);
  assert.equal(trackThemeName(undefined), undefined);
});

test("道具赛未开放，ETC 需要 P3553", () => {
  const [speed, item, etc] = LOBBY_TABS;
  assert.equal(lobbyTabAvailable(speed!, "p3528"), true);
  assert.equal(lobbyTabAvailable(item!, "p3553"), false);
  assert.equal(lobbyTabAvailable(etc!, "p3553"), true);
  assert.equal(lobbyTabAvailable(etc!, "p3528"), false);
});

test("请求同步清空旧行不算返回；超时后不再显示读取中", () => {
  const state = createLobbyListUiState();
  const seen: boolean[] = [];
  requestLobbyList(state, () => { seen.push(state.listing); }, 1000);
  assert.deepEqual(seen, [true]);
  assert.equal(state.listing, false);
  assert.equal(lobbyListLoading(state, 1000 + LOBBY_LOADING_MS - 1), true);
  assert.equal(lobbyListLoading(state, 1000 + LOBBY_LOADING_MS), false);
  state.loading = false;
  assert.equal(lobbyListLoading(state, 1001), false);
});
