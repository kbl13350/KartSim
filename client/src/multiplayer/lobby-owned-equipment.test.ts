import assert from "node:assert/strict";
import test from "node:test";

import { mutateLobbyRoom, type LobbyControllerHost, type LobbyRoom } from "./lobby-actions";

const room = (): LobbyRoom => ({ roomId: "room-1", revision: 4, name: "Room",
  phase: "open", hostId: "me", mode: "individual", speed: 7, members: [
    { playerId: "me", name: "Me", slot: 0, ready: false, team: 0 },
    { playerId: "other", name: "Other", slot: 1, ready: false, team: 0 },
  ] } as unknown as LobbyRoom);

function fixture(answers: Array<unknown | Error>,
  repair?: LobbyControllerHost["options"]["repairEquipment"]) {
  const events: unknown[] = [];
  const host = {
    options: {
      status: (message: string, error?: boolean) => events.push(["status", message, error]),
      ...(repair ? { repairEquipment: repair } : {}),
    },
    client: {
      request: async (request: Record<string, unknown>) => {
        events.push(["request", request]);
        const answer = answers.shift();
        if (answer instanceof Error) throw answer;
        return answer;
      },
      dispose: () => events.push("dispose"),
    },
    state: { room: undefined as LobbyRoom | undefined, allowJoin() {} },
    connected: true, disposed: false, busy: false, leaving: false, raceVisible: false,
    hasModal: false, gameplay: "ordinary", page: 0, rooms: [], selection: 0,
    playerId: "me", dialogGeneration: 0, manualStartAfter: 0,
    render() {},
    receive: (message: unknown) => events.push(["receive", message]),
    list: async () => {}, mutate: async () => false, join: async () => {},
    confirmLeaveRoom: async () => true, cancelDialog() {},
    openDialog: async (factory: () => unknown) => { events.push(["dialog", factory()]); },
    dialogOptions: () => "options",
  } as unknown as LobbyControllerHost;
  return { host, events };
}

const notice = (_options: unknown, title: string, message: string) => ({ title, message });
const requests = (events: unknown[]) => events.filter(event =>
  Array.isArray(event) && event[0] === "request").map(event => (event as unknown[])[1]);

test("create refused for an expired item is repaired and sent once more with owned gear", async () => {
  const repaired: unknown[] = [];
  const { host, events } = fixture([new Error("ITEM_NOT_OWNED"), { type: "room", ok: true }],
    async command => {
      repaired.push(command);
      return { ...command, equipment: { itemIds: { 3: 0, 8: 0 } } };
    });
  const command = { type: "create", name: "Room", equipment: { itemIds: { 3: 0, 8: 9 } } };
  assert.equal(await mutateLobbyRoom(host, command, notice), true);
  assert.deepEqual(repaired, [command]);
  assert.deepEqual(requests(events), [command,
    { type: "create", name: "Room", equipment: { itemIds: { 3: 0, 8: 0 } } }]);
  assert.ok(!events.some(event => Array.isArray(event) && event[0] === "status"));
});

test("join and equipment are resent once; a second refusal is reported", async () => {
  const { host, events } = fixture([new Error("ITEM_NOT_OWNED"), new Error("ITEM_NOT_OWNED")],
    async command => ({ ...command, equipment: "owned" }));
  host.state.room = { ...room(), revision: 9 };
  const command = { type: "equipment", roomId: "room-1", revision: 4, equipment: "expired" };
  assert.equal(await mutateLobbyRoom(host, command, notice), false);
  // The resend carries the room's current revision.
  assert.deepEqual(requests(events), [command,
    { type: "equipment", roomId: "room-1", revision: 9, equipment: "owned" }]);
  assert.deepEqual(events.at(-1), ["status",
    "装备中有未拥有或已过期的物品，请在「选择赛车」或车库中更换后再试。", true]);
});

test("without a repair hook the refusal is reported as before", async () => {
  const { host, events } = fixture([new Error("ITEM_NOT_OWNED")]);
  assert.equal(await mutateLobbyRoom(host, { type: "join", roomId: "r", password: "" }, notice), false);
  assert.equal(requests(events).length, 1);
  assert.equal((events.at(-1) as unknown[])[0], "status");
});

test("other refusals are not repaired", async () => {
  let repairs = 0;
  const { host } = fixture([new Error("ROOM_FULL")], async () => { repairs++; return {}; });
  assert.equal(await mutateLobbyRoom(host, { type: "join", roomId: "r" }, notice), false);
  assert.equal(repairs, 0);
});

test("ready refused for expired gear repairs the profile and explains what to do", async () => {
  const repaired: unknown[] = [];
  const { host, events } = fixture([new Error("ITEM_NOT_OWNED")], async command => {
    repaired.push(command.type);
    return undefined;
  });
  host.state.room = { ...room(), hostId: "other" };
  assert.equal(await mutateLobbyRoom(host, { type: "ready", roomId: "room-1", ready: true }, notice),
    false);
  assert.deepEqual(repaired, ["ready"]);
  assert.equal(requests(events).length, 1, "ready is not resent");
  const message = "你的装备中有已过期或未拥有的物品，已换回默认装备。请在「选择赛车」中确认装备后再准备。";
  assert.deepEqual(events.at(-2), ["status", message, true]);
  assert.deepEqual(events.at(-1), ["dialog", { title: "无法准备", message }]);
});

test("start refused because a member's gear expired tells the host and repairs its own gear", async () => {
  const repaired: unknown[] = [];
  const { host, events } = fixture([new Error("ITEM_NOT_OWNED")], async command => {
    repaired.push(command.type);
    return undefined;
  });
  host.state.room = room();
  assert.equal(await mutateLobbyRoom(host, { type: "start", roomId: "room-1" }, notice), false);
  assert.deepEqual(repaired, ["start"]);
  assert.equal(requests(events).length, 1, "start is not resent");
  assert.deepEqual(events.at(-1), ["dialog", { title: "无法开始比赛",
    message: "有玩家的装备中有已过期或未拥有的物品，已取消其准备。请等待更换装备后再开始比赛。" }]);
});

test("game-node throttling and a second live session read in Chinese in the room", async () => {
  for (const [code, text] of [["RATE_LIMITED", "操作太频繁，请稍后再试。"],
    ["ACCOUNT_ONLINE", "该账号已在其他地方在线，请先退出另一处登录。"]] as const) {
    const { host, events } = fixture([new Error(code)]);
    await mutateLobbyRoom(host, { type: "join", roomId: "r" }, notice);
    assert.deepEqual(events.at(-1), ["status", text, true]);
  }
});
