import assert from "node:assert/strict";
import test from "node:test";
import { BRAVE_CHANNEL, BRAVE_GAME_TYPE, BRAVE_LABEL, BRAVE_TRACK_ID,
  freezeBraveRaceRules, isBraveRaceRules, isBraveRoster, sameBraveRaceRules } from "./lobby-brave-mode";
import { isValidRoomSnapshot } from "./room-validation";
import { roomChannelNames } from "./lobby-room-options";
import { isPlayableGameplay } from "./gameplay-admission";
import { roomSettingsMode } from "./lobby-room-settings-dialog";
import { formatMultiplayerError } from "./errors";
import { lobbyCategory, categoryForChannel, LOBBY_LAYOUT, LOBBY_TABS } from "../ui/lobby-list-layout";
import { gameLocale, tr } from "../i18n/locale";

type Fixture = Record<string, any>;
function braveRoom(phase = "open", players = 4): Fixture {
  const equipment = {
    itemIds: Object.fromEntries([
      1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
      32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
    ].map(slot => [slot, slot === 1 || slot === 3 ? 1 : 0])),
    kartSerial: 0, valueAt3E: 0, exceedType: 0,
  };
  const members = Array.from({ length: players }, (_, index) => ({
    playerId: `p${index}`, name: `Player ${index}`, ready: true, equipment,
    team: index % 2 ? 2 : 1, slot: Math.floor(index / 2) + (index % 2 ? 4 : 0),
  }));
  const room: Fixture = {
    roomId: "brave-room", revision: 1, name: BRAVE_LABEL, mode: "team", capacity: players,
    speedVersion: "国服", channelName: BRAVE_CHANNEL, speed: 7, gameplay: "brave",
    resourceVersion: "p3553", hostId: "p0", phase, members, trackId: BRAVE_TRACK_ID,
  };
  if (phase !== "open") {
    room.race = {
      raceId: "brave-race", channelName: BRAVE_CHANNEL, gameplay: "brave", trackId: BRAVE_TRACK_ID,
      loadingDeadline: 100, roster: structuredClone(members), loadedIds: members.map(entry => entry.playerId),
      brave: { ruleset: "web-brave-v1", forwardTeam: 1 },
    };
    if (phase !== "loading") room.race.startAt = 200;
  }
  return room;
}

test("Brave identity and lobby category retain the original team-only game type", () => {
  assert.equal(BRAVE_GAME_TYPE, 31);
  assert.ok(isPlayableGameplay("brave"));
  assert.deepEqual(roomChannelNames("brave", {}, {}), { speedTeamCombine: BRAVE_LABEL });
  assert.equal(roomSettingsMode({ mode: "team", gameplay: "brave" }), "brave");
  assert.equal(lobbyCategory("brave")?.tab.id, "etc");
  assert.equal(categoryForChannel(BRAVE_CHANNEL, "brave")?.id, "brave");
  assert.deepEqual(lobbyCategory("brave")?.category.channels, [BRAVE_CHANNEL]);
  const rows = LOBBY_TABS.find(tab => tab.id === "etc")!.categories.length;
  assert.ok(LOBBY_LAYOUT.categories.y + rows * (LOBBY_LAYOUT.categories.itemHeight +
    LOBBY_LAYOUT.categories.gap) - LOBBY_LAYOUT.categories.gap < LOBBY_LAYOUT.visibleHeight);
});

test("Brave rooms use P3553, fixed Bridge of Fate, even capacity and the team speed channel", () => {
  for (const capacity of [4, 6, 8]) assert.ok(isValidRoomSnapshot(braveRoom("open", capacity)));
  const one = braveRoom(); one.members = one.members.slice(0, 1);
  assert.ok(isValidRoomSnapshot(one), "open rooms need not already have four racers");
  for (const update of [{ capacity: 2 }, { capacity: 5 }, { resourceVersion: "p3543" },
    { trackId: "village_R01" }, { trackId: undefined, randomTrackCode: 0 },
    { channelName: "speedIndiCombine", mode: "individual" },
    { channelName: "speedTeamInfinit", speed: 4 }]) {
    assert.equal(isValidRoomSnapshot({ ...braveRoom(), ...update }), false, JSON.stringify(update));
  }
});

test("Brave races require frozen directions and equal teams of at least two", () => {
  for (const phase of ["loading", "countdown", "racing"]) {
    for (const capacity of [4, 6, 8]) assert.ok(isValidRoomSnapshot(braveRoom(phase, capacity)));
  }
  for (const change of [
    (room: Fixture) => { delete room.race.brave; },
    (room: Fixture) => { room.race.brave.forwardTeam = 0; },
    (room: Fixture) => { room.race.brave.ruleset = "future"; },
    (room: Fixture) => { room.race.roster.pop(); },
    (room: Fixture) => { room.race.roster[1].team = 1; },
    (room: Fixture) => { room.race.roster[1].team = null; },
    (room: Fixture) => { room.race.roster[1].slot = 2; },
  ]) {
    const room = braveRoom("racing"); change(room);
    assert.equal(isValidRoomSnapshot(room), false);
  }
  const mixed = braveRoom("racing");
  mixed.gameplay = mixed.race.gameplay = "ordinary";
  assert.equal(isValidRoomSnapshot(mixed), false, "another mode must not carry Brave rules");
});

test("a four-player Brave race can draw all four original start positions per team", () => {
  const room = braveRoom("racing");
  room.closedSlots = [1, 5];
  room.members = room.members.filter((entry: Fixture) => entry.playerId === "p0" || entry.playerId === "p1");
  room.race.roster[0].slot = 3; room.race.roster[1].slot = 7;
  assert.ok(isBraveRoster(room.race.roster));
  assert.ok(isValidRoomSnapshot(room));
});

test("frozen Brave rules copy direction, reject stale direction and have translated start errors", () => {
  const source = { ruleset: "web-brave-v1", forwardTeam: 1 };
  const frozen = freezeBraveRaceRules(source);
  assert.ok(Object.isFrozen(frozen));
  source.forwardTeam = 2;
  assert.equal(frozen?.forwardTeam, 1);
  assert.equal(sameBraveRaceRules(source, frozen), false);
  assert.equal(sameBraveRaceRules(undefined, undefined), true);
  assert.equal(sameBraveRaceRules(undefined, frozen), false);
  assert.equal(isBraveRaceRules({ ruleset: "web-brave-v1", forwardTeam: "1" }), false);
  assert.equal(formatMultiplayerError(new Error("BRAVE_TEAMS_UNBALANCED")),
    tr("勇者模式需要红蓝两队人数相等，每队至少两人。"));
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const language of ["en", "ko"]) {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => language } });
      assert.equal(gameLocale(), language);
      for (const caption of [BRAVE_LABEL, "四人以上 · 两队相向竞速", "至少4人，人数均等",
        "勇者模式至少需要四名玩家，且红蓝两队人数相等。", "勇者模式需要红蓝两队人数相等，每队至少两人。"])
        assert.notEqual(tr(caption), caption);
    }
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("Brave room creation offers only 4/6/8 seats and sends the fixed original track", async () => {
  const { showLobbyRoomCreationForm } = await import("./lobby-room-form");
  const { createLobbyRoom } = await import("./lobby-settings");
  type Node = import("./lobby-dialog-views").LobbyDialogNode;
  const node = (name: string, children: Node[] = [], extra: Record<string, unknown> = {}): Node =>
    ({ name, children, ...extra });
  const rows = ["2", "4", "6", "8"].map(text => node(`row${text}`, [], { text: `${text} #sb(people)` }));
  const template = node("root", [node("방만들기", [node("gameStyle"),
    node("joinNum", [node("Skip", rows)]), node("joinTeamGame", [node("Skip", rows)]),
    node("roomName"), node("createRoom")])]);
  const view = { show() {}, render() {}, dispose() {}, focus() {} };
  let options: Record<string, any> = {};
  const submitted: unknown[] = [];
  await showLobbyRoomCreationForm(() => ({ busy: false, view }), { library: {}, cancel() {} },
    "individual", "Brave", (settings, channel) => submitted.push({ ...settings, channel }),
    BRAVE_CHANNEL, "brave", {
      async loadMessageTemplate() { throw new Error("unused"); },
      async loadDefinition() { return template; }, async decorateDefinition(_library, definition) { return definition; },
      clone: (target, attributes, children = target.children) => ({ ...target, ...attributes, children }),
      nodeName: target => target.name, attribute: (target, name) => target[name] as string | undefined,
      async loadView(value) { options = value; return view; },
      channelNames: gameplay => roomChannelNames(gameplay, {}, {}),
      channelKey: () => BRAVE_CHANNEL, channelMode: () => "team",
      dropdown: target => target,
    });
  const state = (name: string) => options.state(node(name));
  assert.equal(state("joinNum").visible, false);
  assert.equal(state("joinTeamGame").visible, true);
  assert.deepEqual(state("joinTeamGame").select.values, ["4", "6", "8"]);
  const adapted = options.definition.children[0].children.find((entry: Node) => entry.name === "joinTeamGame");
  assert.deepEqual(adapted.children[0].children.map((entry: Node) => entry.text),
    ["4 #sb(people)", "6 #sb(people)", "8 #sb(people)"]);
  state("joinTeamGame").select.change("4"); state("createRoom").action();
  assert.deepEqual(submitted, [{ name: "Brave的房间", capacity: 4, password: "", channel: BRAVE_CHANNEL }]);
  const messages: Record<string, unknown>[] = [];
  const host = { gameplay: "brave", channelName: BRAVE_CHANNEL, options: { nickname: "Brave", status() {} },
    openDialog: async (factory: () => unknown) => { await factory(); }, dialogOptions: () => ({}),
    mutate: async (message: Record<string, unknown>) => { messages.push(message); return true; },
  } as unknown as import("./lobby-settings").LobbySettingsHost;
  await createLobbyRoom(host, { [BRAVE_CHANNEL]: { mode: "team", speed: 7 } },
    (_options, gameplay, channel, _name, submit) => {
      submit({ name: "Brave", capacity: 4, password: "", gameplay, channelName: channel });
    });
  assert.deepEqual(messages, [{ type: "create", name: "Brave", capacity: 4, password: "",
    gameplay: "brave", channelName: BRAVE_CHANNEL, mode: "team", speed: 7, speedVersion: "国服",
    resourceVersion: "p3553", trackId: BRAVE_TRACK_ID }]);
});

test("Brave start failures explain four-player minimum and team balance inside the room", async () => {
  const { mutateLobbyRoom } = await import("./lobby-actions");
  const room = braveRoom();
  for (const [code, expected] of [
    ["NOT_ENOUGH_PLAYERS", "勇者模式至少需要四名玩家，且红蓝两队人数相等。"],
    ["BRAVE_TEAMS_UNBALANCED", "勇者模式需要红蓝两队人数相等，每队至少两人。"],
  ]) {
    const notices: unknown[] = [];
    const host = { connected: true, busy: false, disposed: false, playerId: "p0", state: { room },
      client: { request: async () => { throw new Error(code); } }, render() {},
      options: { status() {} }, dialogOptions: () => ({}),
      openDialog: async (factory: () => unknown) => { await factory(); },
    } as unknown as import("./lobby-actions").LobbyControllerHost;
    const result = await mutateLobbyRoom(host, { type: "start", roomId: room.roomId },
      (_options, title, message) => { notices.push([title, message]); });
    assert.equal(result, false);
    assert.deepEqual(notices, [["无法开始比赛", expected]]);
  }
});

test("Brave room track card uses the original R07 artwork while the model is aliased to A07", async () => {
  const { loadLobbyRoomTrack } = await import("./lobby-room-track");
  const resources: string[] = [];
  const errors: unknown[] = [];
  const host = {
    room: { trackId: BRAVE_TRACK_ID }, library: {
      async timeAttackTrackCatalog() {
        return [{ id: BRAVE_TRACK_ID, title: "城镇 命运之桥", path: "track_/village_A07/track.1s" }];
      },
      get(path: string) { return { canonicalPath: path, virtualPath: path }; },
      resolveContainerPath() { throw new Error("Brave art must not come from the A07 model folder"); },
      async trackMetadata() { return { difficulty: 3 }; },
    },
    actions: { onError(error: unknown) { errors.push(error); } }, disposed: false,
    trackLoad: 0, trackTitle: "", view: { render() {} },
  } as import("./lobby-room-track").LobbyRoomTrackHost;
  await loadLobbyRoomTrack(host, {
    mode: () => "brave", randomTrack: () => undefined,
    uiResource(_library, roots, token) { resources.push(`${roots[0]}/${token}`);
      return { async bytes() { return Uint8Array.of(1); } }; },
    async decodePng() { return { width: 1, height: 1, pixels: Uint8Array.of(0, 0, 0, 255) }; },
    canvas: image => image, async roadblockTracks() { return []; }, theme: () => "village",
  });
  assert.deepEqual(errors, []);
  assert.equal(host.trackTitle, "城镇 命运之桥");
  assert.ok(resources.includes("track_/village_R07/xt_trackCard"));
  assert.ok(host.trackImage);
});
