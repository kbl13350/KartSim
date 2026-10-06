import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseLobbyTrack, confirmLobbyTrack, type LobbyTrackDependencies,
  type LobbyTrackHost, type SelectedTrack, type TrackSelectOptions } from "./lobby-track";
import type { ChangingModal } from "./lobby-dialogs";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  async chooseTrack() {", classStart);
const middle = source.indexOf("  async confirmTrack(", start);
const end = source.indexOf("  async changeRoomInfo()", middle);
assert.ok(start > classStart && middle > start && end > middle);
const tracks = [{ id: "track-a" }, { id: "track-b" }];
const rules = [{ groupId: "group-a", code: 8 }];
const groups = [{ id: "group-a" }, { id: "group-b" }];

function room(gameplay: LobbyRoom["gameplay"] = "ordinary"): LobbyRoom {
  return { roomId: "room-1", revision: 3, name: "Room", phase: "open",
    speed: 7, resourceVersion: "p3553", hostId: "me", mode: "individual",
    gameplay, members: [{ playerId: "me", name: "Me", slot: 0, ready: false, team: null }] };
}

function fixture() {
  const events: unknown[] = [];
  let loadedOptions: TrackSelectOptions | undefined;
  const view = { show: () => events.push("show"), dispose: () => events.push("dispose") };
  const host = {
    options: { library: {
      timeAttackTrackCatalog: async () => { events.push("catalog"); return tracks; },
      timeAttackRandomTrackGroups: async () => { events.push("groups"); return groups; },
      timeAttackRandomTrackNames: async () => {
        events.push("names"); return new Map([["group-a", "Random A"]]); },
    }, root: "root", initialTrackId: "track-b",
    status: (message: string, error?: boolean) => events.push(["status", message, error]) },
    state: { room: room() }, playerId: "me", connected: true, disposed: false,
    busy: false, modalLoading: false, dialogGeneration: 0,
    changingModal: undefined as ChangingModal | undefined,
    roomView: { countdownLocked: false }, dialog: undefined,
    trackSelect: undefined, garage: undefined,
    favoriteTracks: new Set<string>(),
    render: () => events.push("render"),
    mutate: async (message: Record<string, unknown>) => {
      events.push(["mutate", message]); return true;
    },
    isChangingModalCurrent: (modal: ChangingModal) => host.changingModal === modal,
    finishChangingLoad: (_modal: ChangingModal, loaded: boolean) => {
      events.push(["finish", loaded]); host.modalLoading = false;
    },
    cancelDialog: () => { events.push("cancelDialog"); host.changingModal = undefined; },
    confirmTrack: async (_modal: ChangingModal, choice: SelectedTrack) => {
      events.push(["confirmTrack", choice]);
    },
  } as unknown as LobbyTrackHost;
  const deps: LobbyTrackDependencies = {
    gameplay: room => room.gameplay ?? "ordinary",
    isGiantTrack: id => id === "track-b",
    randomRules: rules,
    loadView: async options => { events.push("load"); loadedOptions = options; return view; },
  };
  const Original = new Function("G2", "Zl", "Yc", "_7", "C1",
    `return class { ${source.slice(start, end)} };`)(
      deps.gameplay, deps.isGiantTrack, rules, { load: deps.loadView },
      (error: unknown) => error instanceof Error ? error.message : String(error),
    ) as new () => { chooseTrack(this: LobbyTrackHost): Promise<void>;
      confirmTrack(this: LobbyTrackHost, modal: ChangingModal,
        choice: SelectedTrack): Promise<void> };
  return { host, events, deps, view, Original, getOptions: () => loadedOptions };
}

test("track picker catalog, random groups and callbacks match release", async () => {
  for (const gameplay of ["ordinary", "giant"] as const) {
    const run = async (released: boolean) => {
      const { host, events, deps, Original, getOptions } = fixture();
      host.state.room = room(gameplay);
      if (released) await Original.prototype.chooseTrack.call(host);
      else await chooseLobbyTrack(host, deps);
      const options = getOptions();
      assert.ok(options);
      options.onFavoriteChange("track-b", true);
      options.onNotice("Notice", "Message");
      options.onConfirm({ kind: "track", track: { id: "track-b" } });
      return { events, tracks: options.tracks, groups: options.randomGroups,
        selectedTrackId: options.selectedTrackId, modal: host.changingModal?.kind,
        favorites: [...host.favoriteTracks] };
    };
    assert.deepEqual(await run(false), await run(true), gameplay);
  }
});

test("concrete and random track submission match release", async () => {
  for (const choice of [
    { kind: "track", track: { id: "track-b" } },
    { kind: "random", group: { id: "group-a" } },
    { kind: "random", group: { id: "missing" } },
  ] as SelectedTrack[]) {
    const run = async (released: boolean) => {
      const { host, events, deps, view, Original } = fixture();
      const modal: ChangingModal = { kind: "track", roomId: "room-1",
        generation: 1, entered: true, released: false, releaseAllowed: true };
      host.changingModal = modal;
      host.trackSelect = view;
      if (released) await Original.prototype.confirmTrack.call(host, modal, choice);
      else await confirmLobbyTrack(host, modal, choice, deps.randomRules);
      return { events, hasView: !!host.trackSelect, modalLoading: host.modalLoading };
    };
    assert.deepEqual(await run(false), await run(true), JSON.stringify(choice));
  }
});
