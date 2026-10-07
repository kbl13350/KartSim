import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatMultiplayerError } from "./errors";
import { joinLobbyRoom, leaveLobbyRoom, listLobbyRooms, mutateLobbyRoom,
  quickJoinLobbyRoom, sendLobbyChat, submitLobbyRoomSettings, switchLobbyTeam,
  type Gameplay, type LobbyControllerHost, type LobbyRoom, type RoomSummary,
} from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class Wl0 {");
assert.ok(start > 0);
const method = (name: string, next: string): string => {
  const begin = source.indexOf(`  async ${name}(`, start);
  const end = source.indexOf(`  ${next}(`, begin);
  assert.ok(begin > start && end > begin, `${name} boundaries`);
  return source.slice(begin, end);
};
const extracted = [
  method("list", "async leaveRoom"),
  method("leaveRoom", "async mutate"),
  method("mutate", "cancelDialog"),
  method("sendChat", "isChangingModalCurrent"),
  method("submitRoomSettings", "async create"),
  method("join", "async quickJoin"),
  method("quickJoin", "async team"),
  method("team", "async confirm"),
];
const messages = {
  ordinary: "普通竞速", grip: "抓地模式", shadow: "幽灵模式",
  roadblock: "挡人模式", lte: "LTE Web试玩", giant: "巨人模式", rp: "RP竞速",
};
const notice = (_options: unknown, title: string, message: string) => ({ title, message });
const password = (_options: unknown, submit: (value: string) => void) => submit("secret");
const Original = new Function("rg", "xX", "C1", "$l0", "b1",
  `return class { ${extracted.join("\n")} };`)(
    (value: Gameplay) => value in messages && value !== "lte", messages,
    formatMultiplayerError,
    new Set(["NOT_ENOUGH_PLAYERS", "ROADBLOCK_NEEDS_FIVE", "TRACK_REQUIRED",
      "EQUIPMENT_REQUIRED", "PLAYERS_NOT_READY", "TEAM_REQUIRED", "CLIENT_RACE_UNAVAILABLE"]),
    { notice, password },
  ) as new () => Record<string, (...args: never[]) => unknown>;

type MethodName = "list" | "leaveRoom" | "mutate" | "sendChat" |
  "submitRoomSettings" | "join" | "quickJoin" | "team";
const release = (name: MethodName, host: LobbyControllerHost, ...args: unknown[]) =>
  (Original.prototype[name] as (...values: unknown[]) => unknown).call(host, ...args);

const room = (): LobbyRoom => ({ roomId: "room-1", revision: 4, name: "Room",
  phase: "open", hostId: "me", mode: "team", speed: 7, members: [
    { playerId: "me", name: "Me", slot: 0, ready: false, team: 1 },
    { playerId: "other", name: "Other", slot: 1, ready: false, team: 2 },
  ] });
const summary = (roomId: string, overrides: Partial<RoomSummary> = {}): RoomSummary =>
  ({ roomId, locked: false, count: 1, capacity: 8, ...overrides });

function fixture() {
  const events: unknown[] = [];
  const responses: Array<unknown | Error> = [];
  const host = {
    options: { version: "p3553", status: (message: string, error?: boolean) =>
      events.push(["status", message, error]) },
    client: { request: async (request: Record<string, unknown>) => {
      events.push(["request", request]);
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    }, dispose: () => { events.push("dispose"); } },
    state: { room: undefined as LobbyRoom | undefined,
      allowJoin: (roomId: string) => { events.push(["allowJoin", roomId]); } },
    lobby: { setRooms: (...args: unknown[]) => { events.push(["setRooms", ...args]); } },
    connected: true, disposed: false, busy: false, leaving: false,
    raceVisible: false, hasModal: false, channelName: undefined as string | undefined,
    gameplay: "ordinary" as Gameplay, page: 0, rooms: [] as RoomSummary[],
    selection: 0, playerId: "me", roomSettingsRoomId: undefined as string | undefined,
    dialogGeneration: 2, manualStartAfter: 0,
    render: () => { events.push(["render", host.busy, host.leaving]); },
    receive: (message: unknown) => { events.push(["receive", message]);
      if ((message as { type?: string })?.type === "left") host.state.room = undefined; },
    list: async (_channel: string, _page: number, _quiet?: boolean, _gameplay?: Gameplay) => {},
    mutate: async (_message: Record<string, unknown>): Promise<boolean> => false,
    join: async (_room: RoomSummary) => {},
    confirmLeaveRoom: async (_roomId: string) => true,
    cancelDialog: () => { events.push("cancelDialog"); },
    openDialog: async (factory: () => unknown) => { events.push(["dialog", factory()]); },
    dialogOptions: () => "options",
  } satisfies LobbyControllerHost;
  return { host, events, responses };
}

test("room-list modes, page fallback and error state match release", async () => {
  const run = async (released: boolean) => {
    const { host, events, responses } = fixture();
    const invoke = (channel: string, page: number, quiet = false, gameplay: Gameplay = host.gameplay) =>
      released ? release("list", host, channel, page, quiet, gameplay)
        : listLobbyRooms(host, channel, page, quiet, gameplay);
    host.list = async (channel, page, quiet, gameplay) => { await invoke(channel, page, quiet, gameplay); };
    responses.push({ type: "rooms", total: 11, rooms: [] },
      { type: "rooms", total: 11, rooms: [summary("available")] },
      new Error("ROOM_FULL"));
    await invoke("speedIndiCombine", 2);
    await invoke("speedIndiCombine", 1, false, "grip");
    await invoke("speedIndiCombine", 0, false, "giant");
    return { events, roomIds: host.rooms.map(value => value.roomId),
      channelName: host.channelName, page: host.page, gameplay: host.gameplay,
      selection: host.selection };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("LTE lobby requests the local gameplay room list", async () => {
  const { host, events, responses } = fixture();
  responses.push({ type: "rooms", page: 0, total: 0, rooms: [] });
  await listLobbyRooms(host, "speedIndiCombine", 0, false, "lte");
  assert.equal(host.gameplay, "lte");
  assert.ok(events.some(event => Array.isArray(event) && event[0] === "request" &&
    (event[1] as { type?: string; gameplay?: string }).type === "list-gameplay" &&
    (event[1] as { gameplay?: string }).gameplay === "lte"));
});

test("room mutation success, host start error and timeout match release", async () => {
  const run = async (released: boolean) => {
    const { host, events, responses } = fixture();
    host.state.room = room();
    const invoke = (command: Record<string, unknown>) => released
      ? release("mutate", host, command)
      : mutateLobbyRoom(host, command, notice);
    responses.push({ type: "room", room: room() }, new Error("NOT_ENOUGH_PLAYERS"),
      new Error("Request timeout; synchronize room before retrying"));
    const result = [await invoke({ type: "ready" }), await invoke({ type: "start" }),
      await invoke({ type: "team" })];
    return { events, result, busy: host.busy };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("leave, chat, join, quick join, team and settings match release", async () => {
  const run = async (released: boolean) => {
    const { host, events, responses } = fixture();
    const invoke = (name: MethodName, ...args: unknown[]) => release(name, host, ...args);
    host.mutate = async message => { events.push(["mutate", message]);
      if (message.type === "leave") host.state.room = undefined;
      return true; };
    host.join = async roomSummary => {
      if (released) await invoke("join", roomSummary);
      else await joinLobbyRoom(host, roomSummary, async (target, submit) =>
        target.openDialog(() => password(target.dialogOptions(), submit)));
    };
    host.state.room = room();
    const leave = released ? await invoke("leaveRoom", "lobby") : await leaveLobbyRoom(host, "lobby");
    host.state.room = room();
    responses.push({ type: "chat" });
    const chat = released ? await invoke("sendChat", "hi") : await sendLobbyChat(host, "hi");
    host.state.room = undefined;
    await host.join(summary("locked", { locked: true }));
    host.rooms = [summary("full", { count: 8 }), summary("open")];
    if (released) await invoke("quickJoin"); else await quickJoinLobbyRoom(host);
    host.state.room = room();
    if (released) await invoke("team"); else await switchLobbyTeam(host);
    host.roomSettingsRoomId = "room-1";
    if (released) await invoke("submitRoomSettings", { name: "New" }, 2);
    else await submitLobbyRoomSettings(host, { name: "New" }, 2);
    return { events, leave, chat, manualStartAfter: host.manualStartAfter > 0 };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("joining sends the gear chosen since connecting so the race roster matches", async () => {
  const { host, events } = fixture();
  const equipment = { itemIds: { 3: 1637 } };
  const options = { ...host.options, currentEquipment: () => equipment };
  host.mutate = async message => { events.push(["mutate", message]); return true; };
  await joinLobbyRoom({ ...host, options }, summary("open"), async () => {});
  assert.deepEqual(events.find(event => Array.isArray(event) && event[0] === "mutate"),
    ["mutate", { type: "join", roomId: "open", password: "", equipment }]);
});
