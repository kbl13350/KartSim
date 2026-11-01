import assert from "node:assert/strict";
import test from "node:test";
import { DEATHMATCH_CHANNEL, DEATHMATCH_GAME_TYPE, DEATHMATCH_LABEL, DEATHMATCH_RANDOM_GROUP,
  DEATHMATCH_RULES_HINT, DEATHMATCH_TRACK_IDS } from "./lobby-deathmatch-mode";
import { isPlayableGameplay } from "./gameplay-admission";
import { roomChannelNames } from "./lobby-room-options";
import { roomSettingsMode } from "./lobby-room-settings-dialog";
import { lobbyCategory, categoryForChannel, LOBBY_LAYOUT, LOBBY_TABS } from "../ui/lobby-list-layout";
import { deathmatchTrackCatalog, type TrackLibrary, type TrackMetadata, type TrackResource } from "../resources/track-catalog";
import { gameLocale, tr } from "../i18n/locale";
import { chooseLobbyTrack, confirmLobbyTrack, type LobbyTrackHost, type TrackSelectOptions } from "./lobby-track";
import { activateLobbyListEntry } from "../ui/lobby-list-actions";

test("DeathMatchTeam 58 is available in ETC with a fixed team channel and a rules notice", () => {
  assert.equal(DEATHMATCH_GAME_TYPE, 58);
  assert.ok(isPlayableGameplay("deathmatch"));
  assert.deepEqual(roomChannelNames("deathmatch", {}, {}), { [DEATHMATCH_CHANNEL]: DEATHMATCH_LABEL });
  assert.equal(roomSettingsMode({ mode: "team", gameplay: "deathmatch" }), "deathmatch");
  assert.equal(lobbyCategory("deathmatch")?.tab.id, "etc");
  assert.equal(categoryForChannel(DEATHMATCH_CHANNEL, "deathmatch")?.id, "deathmatch");
  const rows = LOBBY_TABS.find(tab => tab.id === "etc")!.categories.length;
  assert.ok(LOBBY_LAYOUT.categories.y + rows * (LOBBY_LAYOUT.categories.itemHeight + LOBBY_LAYOUT.categories.gap)
    - LOBBY_LAYOUT.categories.gap < LOBBY_LAYOUT.visibleHeight);
  const notices: unknown[] = [];
  activateLobbyListEntry({ hits: [{ name: "cat:deathmatch" }, { name: "deathmatchInfo" }], rooms: [],
    page: 0, gameplay: "deathmatch", options: { onMode() {}, onUnavailable: (...args) => notices.push(args) },
    lobbyUi: { tab: "etc", category: "deathmatch", filters: { indi: true, team: true, indiInfinit: true, teamInfinit: true },
      requested: false, loading: false, loadingSince: 0, listing: false } }, "deathmatchInfo", () => undefined, () => false);
  assert.deepEqual(notices, [[tr(DEATHMATCH_LABEL), tr(DEATHMATCH_RULES_HINT)]]);
});

function arenaLibrary(): TrackLibrary {
  const metadata: TrackMetadata[] = [...DEATHMATCH_TRACK_IDS, "village_R01", "ice_D02"].map(id => ({
    id, gameType: id === "village_R01" ? "speed" : "death", difficulty: 3, speedPool: false,
    theme: id.split("_")[0], cnTitle: id, choosable: false,
  }));
  const assets = metadata.map(row => ({ virtualPath: `track_/${row.id}/track.1s` } as TrackResource));
  return { files: [], mapAssets: () => assets, trackMetadataCatalog: async () => metadata,
    findSibling: () => undefined, trackTitles: async () => new Map(), timeAttackTrackCatalog: async () => [] };
}

test("arena catalogue selects five original death maps without lap or speed filters", async () => {
  const library = arenaLibrary();
  const tracks = await deathmatchTrackCatalog(library);
  assert.deepEqual(tracks.map(track => track.id), DEATHMATCH_TRACK_IDS);
  assert.ok(tracks.every(track => track.gameType === "speed" && !track.reverse));
  assert.ok((await library.trackMetadataCatalog()).filter(row => DEATHMATCH_TRACK_IDS.includes(row.id as never))
    .every(row => row.gameType === "death" && row.laps === undefined), "the picker must preserve original metadata");
});

test("deathmatch creation fixes eight slots and red/blue team channel even after an invalid capacity callback", async () => {
  const { showLobbyRoomCreationForm } = await import("./lobby-room-form");
  const { createLobbyRoom } = await import("./lobby-settings");
  type Node = import("./lobby-dialog-views").LobbyDialogNode;
  const node = (name: string, children: Node[] = [], extra: Record<string, unknown> = {}): Node => ({ name, children, ...extra });
  const rows = ["2", "4", "6", "8"].map(text => node(`row${text}`, [], { text: `${text} #sb(people)` }));
  const template = node("root", [node("방만들기", [node("gameStyle"), node("joinNum", [node("Skip", rows)]),
    node("joinTeamGame", [node("Skip", rows)]), node("roomName"), node("createRoom")])]);
  const view = { show() {}, render() {}, dispose() {}, focus() {} };
  let options: Record<string, any> = {};
  const submitted: unknown[] = [];
  await showLobbyRoomCreationForm(() => ({ busy: false, view }), { library: {}, cancel() {} },
    "individual", "Arena", (settings, channel) => submitted.push({ ...settings, channel }),
    DEATHMATCH_CHANNEL, "deathmatch", {
      async loadMessageTemplate() { throw new Error("unused"); }, async loadDefinition() { return template; },
      async decorateDefinition(_library, definition) { return definition; },
      clone: (target, attributes, children = target.children) => ({ ...target, ...attributes, children }),
      nodeName: target => target.name, attribute: (target, name) => target[name] as string | undefined,
      async loadView(value) { options = value; return view; }, channelNames: mode => roomChannelNames(mode, {}, {}),
      channelKey: () => DEATHMATCH_CHANNEL, channelMode: () => "team", dropdown: target => target,
    });
  const state = (name: string) => options.state(node(name));
  assert.equal(state("joinNum").visible, false);
  assert.equal(state("joinTeamGame").visible, true);
  assert.deepEqual(state("joinTeamGame").select.values, ["8"]);
  const adapted = options.definition.children[0].children.find((entry: Node) => entry.name === "joinTeamGame");
  assert.deepEqual(adapted.children[0].children.map((entry: Node) => entry.text), ["8 #sb(people)"]);
  state("joinTeamGame").select.change("2"); state("createRoom").action();
  assert.deepEqual(submitted, [{ name: "Arena的房间", capacity: 8, password: "", channel: DEATHMATCH_CHANNEL }]);
  const messages: Record<string, unknown>[] = [];
  const host = { gameplay: "deathmatch", channelName: DEATHMATCH_CHANNEL, options: { nickname: "Arena", status() {} },
    openDialog: async (factory: () => unknown) => { await factory(); }, dialogOptions: () => ({}),
    mutate: async (message: Record<string, unknown>) => { messages.push(message); return true; },
  } as unknown as import("./lobby-settings").LobbySettingsHost;
  await createLobbyRoom(host, { [DEATHMATCH_CHANNEL]: { mode: "team", speed: 7 } },
    (_options, gameplay, channel, _name, submit) => submit({ name: "Arena", capacity: 2, password: "", gameplay, channelName: channel }));
  assert.equal(messages[0]!.capacity, 8);
  assert.equal(messages[0]!.mode, "team");
  assert.equal(messages[0]!.resourceVersion, "p3553");
  assert.equal(messages[0]!.randomTrackCode, 0);
});

test("deathmatch picker and random submit admit only the five arena maps", async () => {
  const events: Record<string, unknown>[] = [];
  let options: TrackSelectOptions | undefined;
  const host = { options: { library: arenaLibrary(), root: {}, initialTrackId: "village_R01", status() {} },
    state: { room: { roomId: "arena", revision: 3, gameplay: "deathmatch", mode: "team", capacity: 8,
      hostId: "me", phase: "open", resourceVersion: "p3553", randomTrackCode: 0 } }, playerId: "me", connected: true,
    disposed: false, busy: false, modalLoading: false, dialogGeneration: 0, favoriteTracks: new Set(), render() {},
    mutate: async (event: Record<string, unknown>) => { events.push(event); return true; },
    isChangingModalCurrent: (modal: unknown) => host.changingModal === modal,
    finishChangingLoad() {}, cancelDialog() {}, changingModal: undefined as unknown,
    confirmTrack() {},
  } as unknown as LobbyTrackHost;
  const rules = [{ code: 0, groupId: "speed:all:0" }, { code: 40, groupId: "speed:speedAll:0" }];
  await chooseLobbyTrack(host, { gameplay: room => room.gameplay!, isGiantTrack: () => true, randomRules: rules,
    async loadView(value) { options = value; return { show() {}, dispose() {} }; } });
  assert.ok(options);
  assert.deepEqual(options.tracks.map(track => track.id), DEATHMATCH_TRACK_IDS);
  assert.deepEqual(options.gameTypes, ["speed"]);
  assert.deepEqual(options.randomGroups.map(group => group.id), [DEATHMATCH_RANDOM_GROUP]);
  assert.equal(options.selectedRandomGroupId, DEATHMATCH_RANDOM_GROUP);
  assert.equal(options.selectedTrackId, "ice_D01");
  const modal = host.changingModal!;
  events.length = 0;
  await confirmLobbyTrack(host, modal, { kind: "track", track: { id: "village_R01" } }, rules);
  await confirmLobbyTrack(host, modal, { kind: "random", group: { id: "speed:all:0" } }, rules);
  assert.deepEqual(events, []);
  await confirmLobbyTrack(host, modal, { kind: "random", group: { id: DEATHMATCH_RANDOM_GROUP } }, rules);
  assert.deepEqual(events, [{ type: "random-track", roomId: "arena", revision: 3, randomTrackCode: 0 }]);
});

test("deathmatch start errors explain the eight-player rule and new strings translate", async () => {
  const { mutateLobbyRoom } = await import("./lobby-actions");
  for (const code of ["NOT_ENOUGH_PLAYERS", "DEATHMATCH_TEAMS_UNBALANCED"]) {
    const notices: unknown[] = [];
    const host = { connected: true, busy: false, disposed: false, playerId: "p0",
      state: { room: { gameplay: "deathmatch", roomId: "arena", hostId: "p0", phase: "open" } },
      client: { request: async () => { throw new Error(code); } }, render() {}, options: { status() {} },
      dialogOptions: () => ({}), openDialog: async (factory: () => unknown) => { await factory(); },
    } as unknown as import("./lobby-actions").LobbyControllerHost;
    assert.equal(await mutateLobbyRoom(host, { type: "start" }, (_options, title, message) => notices.push([title, message])), false);
    assert.deepEqual(notices, [[tr("无法开始比赛"), tr("死斗模式需要8名玩家，红蓝两队各4人。")]]);
  }
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const language of ["en", "ko"]) {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => language } });
      assert.equal(gameLocale(), language);
      for (const caption of [DEATHMATCH_LABEL, DEATHMATCH_RULES_HINT, "8人 · 红蓝4对4撞落计分", "等待8人，红蓝各4人"])
        assert.notEqual(tr(caption), caption);
    }
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
