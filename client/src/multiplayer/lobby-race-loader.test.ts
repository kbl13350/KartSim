import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeLobbyRace, type LobbyRaceDependencies,
  type LobbyRaceHost } from "./lobby-race-loader";
import type { CoordinatedRace, CoordinatedRoom,
  RaceStartOptions } from "./race-start-coordinator";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const ctorStart = source.indexOf("  constructor(e) {", classStart);
const ctorEnd = source.indexOf("  options;", ctorStart);
assert.ok(classStart > 0 && ctorStart > classStart && ctorEnd > ctorStart);
const constructorSource = source.slice(ctorStart, ctorEnd);

const race = (changes: Partial<CoordinatedRace> = {}): CoordinatedRace => ({
  raceId: "race-1", loadedIds: [], channelName: "speedIndiCombine", ...changes,
});
const room = (phase: CoordinatedRoom["phase"] = "loading",
  changes: Partial<CoordinatedRoom> = {}): CoordinatedRoom => ({
    roomId: "room-1", revision: 1, name: "Room", phase,
    hostId: "me", mode: "individual", speed: 7, speedVersion: "国服",
    channelName: "speedIndiCombine", resourceVersion: "p3553",
    members: [{ playerId: "me", name: "Me", slot: 0, ready: false, team: null }],
    race: race(), ...changes,
  });

function fixture(useBanners: boolean) {
  const events: unknown[] = [];
  let coordinatorOptions!: RaceStartOptions;
  let capturedConnection: Record<string, unknown> | undefined;
  let raceChatListener: ((message: unknown) => void) | undefined;
  let lobbyListener: ((event: { type: string; roomId?: string; message?: unknown }) => void) | undefined;
  const state = { room: useBanners
    ? room("loading", { race: race({ rp: {}, roadblock: {} }) }) : room() };
  const client = {
    raceConnection: (_roomId: string, _raceId: string, _signal: AbortSignal) => {
      events.push("raceConnection");
      return { hasMotionRecipients: true, motionRoundTripMs: 17,
        sendRaceChat: async (message: string) => { events.push(["race.chat", message]); },
        subscribeRaceChat: (listener: (message: unknown) => void) => {
          raceChatListener = listener; events.push("race.subscribe");
          return () => events.push("race.unsubscribe");
        },
        returnToRoom: async () => { events.push("returnToRoom"); },
      };
    },
    request: async (message: Record<string, unknown>) => {
      events.push(["request", message]); return { ok: true };
    },
    subscribe: (listener: (event: { type: string; roomId?: string; message?: unknown }) => void) => {
      lobbyListener = listener; events.push("lobby.subscribe");
      return () => events.push("lobby.unsubscribe");
    },
    captureClock: () => { events.push("captureClock"); return { offset: 3 }; },
  };
  const stage = { showWaiting: () => events.push("waiting"),
    bindClock: (mapping: Record<string, unknown>) => events.push(["bindClock", mapping.offset]),
    updateRoom: (next: CoordinatedRoom) => events.push(["updateRoom", next.phase]),
    scheduleStart: (tick: number) => events.push(["start", tick]),
    presentingResults: () => false,
    dispose: () => events.push("stage.dispose"),
  };
  const options: LobbyRaceHost["options"] = {
    library: "library", root: "root",
    raceLoader: { prepare: async (_room, _race, _signal, connection) => {
      events.push("stage.prepare"); capturedConnection = connection;
      return stage;
    } },
    audioContext: () => "audio",
    onRaceVisibility: visible => events.push(["visible", visible]),
    onPageAudio: page => events.push(["audio", page]),
    status: (message, error) => events.push(["status", message, error]),
  };
  const banner = (name: string) => ({
    present: async (_signal: AbortSignal) => { events.push([name, "present"]); },
    dispose: () => { events.push([name, "dispose"]); },
  });
  const deps: LobbyRaceDependencies = {
    createCoordinator: value => {
      coordinatorOptions = value;
      events.push("coordinator");
      return { releasePresentedRace: () => events.push("releasePresentedRace") };
    },
    preloadRpPet: async () => { events.push("pet.preload"); },
    loadRoadblock: async () => { events.push("roadblock.load"); return banner("roadblock"); },
    loadRpNotice: async () => { events.push("rp.load"); return banner("rp"); },
  };
  const common = {
    options, client, state,
    roomView: { hide: () => events.push("room.hide"),
      show: () => events.push("room.show") },
    playerId: "me", disposed: false, raceVisible: false,
    autoReadyRoom: undefined, autoReadyConsumed: false,
    syncLoadingView: () => events.push("loading.sync"),
    render: () => events.push("render"),
    maybeAutoReady: () => events.push("autoReady"),
  };
  const Original = new Function("ll0", "Nl0", "yy", "vy", "C1", "fixture",
    `return class { ${constructorSource}
      client = fixture.client;
      state = fixture.state;
      roomView = fixture.roomView;
      playerId = fixture.playerId;
      disposed = false;
      raceVisible = false;
      autoReadyRoom;
      autoReadyConsumed = false;
      syncLoadingView() { fixture.syncLoadingView(); }
      render() { fixture.render(); }
      maybeAutoReady() { fixture.maybeAutoReady(); }
    };`)(
      class { constructor(public options: RaceStartOptions) {
        coordinatorOptions = options; events.push("coordinator");
      } releasePresentedRace() { events.push("releasePresentedRace"); } },
      deps.preloadRpPet,
      { load: deps.loadRoadblock }, { load: deps.loadRpNotice },
      (error: unknown) => error instanceof Error ? error.message : String(error),
      common,
    ) as new (options: LobbyRaceHost["options"]) => LobbyRaceHost;
  return { host: common as LobbyRaceHost, Original, deps, options,
    events, getCoordinatorOptions: () => coordinatorOptions,
    getConnection: () => capturedConnection,
    emitRace: (message: unknown) => raceChatListener?.(message),
    emitLobby: (event: { type: string; roomId?: string; message?: unknown }) => lobbyListener?.(event) };
}

async function run(released: boolean, banners: boolean) {
  const item = fixture(banners);
  const { Original, deps, options, events } = item;
  const host = released ? new Original(options) : item.host;
  if (!released) initializeLobbyRace(host, deps);
  const coordinator = item.getCoordinatorOptions();
  assert.ok(coordinator);
  const inputRoom = host.state.room!;
  const signal = new AbortController().signal;
  const prepared = await coordinator.loader.prepare(inputRoom, inputRoom.race!, signal);
  const connection = item.getConnection();
  assert.ok(connection);
  prepared.showWaiting?.();
  prepared.bindClock?.({ offset: 3 });
  prepared.updateRoom?.(room("finished"));
  host.state.room = room("open", { race: undefined });
  prepared.updateRoom?.(host.state.room);
  prepared.scheduleStart(99);
  await (connection.sendRaceChat as (message: string) => Promise<unknown>)("hello");
  const received: unknown[] = [];
  const unsubscribe = (connection.subscribeRaceChat as
    (listener: (message: unknown) => void) => () => void)(message => received.push(message));
  item.emitRace("race-message");
  item.emitLobby({ type: "chat", roomId: "room-1", message: "lobby-message" });
  unsubscribe();
  (connection.presentationClosed as () => void)();
  await new Promise(resolve => setImmediate(resolve));
  prepared.dispose();
  return { events, received, raceVisible: host.raceVisible,
    autoReadyRoom: host.autoReadyRoom, autoReadyConsumed: host.autoReadyConsumed,
    presentationComplete: host.startPresentation?.complete };
}

test("race presentation, scoped chat and return match release constructor", async () => {
  assert.deepEqual(await run(false, false), await run(true, false));
});

test("roadblock and RP banners match release constructor sequence", async () => {
  assert.deepEqual(await run(false, true), await run(true, true));
});
