import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { GameServer } from "./game-servers";
import { openMultiplayerLobby, type LobbyOpenClient, type LobbyOpenDependencies,
  type LobbyOpenHost } from "./lobby-open";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  async open() {", classStart);
const end = source.indexOf("  bindClient()", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = source.slice(start, end);

const server: GameServer = { nodeId: "game-8788", name: "一号服", origin: "http://127.0.0.1:8788",
  players: 3, rooms: 1, capacity: 400, full: false };

interface Options {
  version?: number;
  repair?: () => Promise<void>;
  choose?: (failed: ReadonlySet<string> | undefined) => Promise<GameServer>;
  enter?: (attempt: number) => Promise<{ nodeId: string; offerUrl: string; ticket: string }>;
}

function fixture(account: { nickname: string } | undefined,
  connectResults: Array<{ type: string; playerId: string } | Error>, options: Options = {}) {
  const events: unknown[] = [];
  const equipmentSent: unknown[] = [];
  let clientNumber = 0;
  let ticketNumber = 0;
  const createClient = (): LobbyOpenClient => {
    const number = ++clientNumber;
    return { connect: async (url, nickname, resourceVersion, equipment, initial,
      raceRuntime, ticket) => {
      events.push(["connect", number, url, nickname, resourceVersion, initial, raceRuntime, ticket]);
      equipmentSent.push(equipment);
      const result = connectResults.shift();
      if (result instanceof Error) throw result;
      if (!result) throw new Error("Unexpected connect");
      return result;
    }, dispose: () => events.push(["dispose", number]) };
  };
  const deps: LobbyOpenDependencies = {
    protocolVersion: 39,
    pageUrl: () => "http://127.0.0.1:8780/",
    endpoint: (path, pageUrl) => new URL(`/multiplayer/${path}`, pageUrl).href,
    fetchHealth: async (url, signal) => {
      events.push(["health", url, signal.aborted]);
      return { ok: true, json: async () => ({ protocolVersion: options.version ?? 39 }) };
    },
    showAccountProgress: (_root, signal) => {
      events.push(["progress", signal.aborted]);
      return { close: () => events.push("progress.close"),
        fail: async (message: string) => { events.push(["progress.fail", message]); } };
    },
    loadAccount: async () => { events.push("loadAccount"); return account; },
    loadLobby: async options => {
      events.push(["loadLobby", typeof options.onMode, typeof options.onJoin]);
      return { show: () => events.push("lobby.show"),
        dispose: () => events.push("lobby.dispose") };
    },
    notice: (_options, title, message) => { events.push(["notice", title, message]); },
    chooseGameServer: async (root, signal, failed) => {
      events.push(["servers", root, signal.aborted]);
      return options.choose ? options.choose(failed && new Set(failed)) : server;
    },
    enterGameServer: async (chosen, sessionToken, signal) => {
      const attempt = ++ticketNumber;
      events.push(["ticket", chosen.nodeId, sessionToken, signal.aborted]);
      return options.enter ? options.enter(attempt) : { nodeId: chosen.nodeId,
        offerUrl: "http://127.0.0.1:8788/multiplayer/offer", ticket: `kt1.ticket-${attempt}` };
    },
    sessionToken: url => { events.push(["token", url]); return "session"; },
    ...(options.repair ? { repairEquipment: options.repair } : {}),
    createClient,
  };
  // The release still had a guest nickname path; it is unreachable with an account.
  const chooseNickname = async (_root: unknown, suggestion: string, _signal: unknown,
    retry?: boolean) => {
    events.push(["nickname", suggestion, retry]);
    return retry ? "Guest-2" : "Guest-1";
  };
  const rememberNickname = (nickname: string) => { events.push(["remember", nickname]); };
  const host = {
    options: { root: "root", nickname: "Suggestion", version: "p3553",
      initialEquipment: { kart: "initial" }, initial: "initial", raceLoader: {},
      currentEquipment: () => ({ kart: "repaired" }),
      prepareAudio: async () => { events.push("audio.prepare"); },
      onVisible: () => { events.push("visible"); },
      onPageAudio: (page: string) => { events.push(["pageAudio", page]); },
      status: (message: string, error?: boolean) => { events.push(["status", message, error]); },
    },
    accountAbort: new AbortController(), accountNickname: undefined as string | undefined,
    client: createClient(), lobby: undefined, state: { room: undefined },
    disposed: false, connected: false, busy: false, modalLoading: false,
    dialog: undefined, playerId: "", channelName: undefined, page: 0,
    refresh: undefined,
    bindClient: () => { events.push("bindClient"); },
    render: () => { events.push("render"); },
    list: async () => { events.push("list"); },
    openDialog: async () => { events.push("openDialog"); },
    dialogOptions: () => ({}), create: async () => {}, join: async () => {},
    quickJoin: async () => {},
  } as unknown as LobbyOpenHost;
  const Original = new Function("vl0", "Ko", "yl0", "PT", "Ew", "b1",
    "xF", "ay", "EF", "LT", "Uo", "C1", "fetch", "window",
    `return class { ${method} };`)(
      deps.showAccountProgress, deps.endpoint, deps.loadAccount,
      chooseNickname, { load: deps.loadLobby }, { notice: deps.notice },
      deps.sessionToken, (url: string) => url, rememberNickname,
      class { constructor() { return createClient(); } }, deps.protocolVersion,
      (error: unknown) => error instanceof Error ? error.message : String(error),
      (url: string, init: { signal: AbortSignal }) => deps.fetchHealth(url, init.signal),
      { location: { href: deps.pageUrl() } },
    ) as new () => { open(this: LobbyOpenHost): Promise<void> };
  return { host, deps, Original, events, equipmentSent };
}

async function run(released: boolean, account: { nickname: string } | undefined,
  results: Array<{ type: string; playerId: string } | Error>, options: Options = {}) {
  const { host, deps, Original, events, equipmentSent } = fixture(account, results, options);
  let error: string | undefined;
  try {
    if (released) await Original.prototype.open.call(host);
    else await openMultiplayerLobby(host, deps);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    clearInterval(host.refresh);
  }
  return { events, error, nickname: host.accountNickname, playerId: host.playerId,
    connected: host.connected, hasLobby: !!host.lobby, refresh: !!host.refresh, equipmentSent };
}

/**
 * Remove what the split architecture adds (server choice, its progress view,
 * tickets and session-token lookups) and the connect target, so the rest of
 * the flow can still be compared with the release.
 */
function withoutServerChoice(result: Awaited<ReturnType<typeof run>>) {
  const events: unknown[] = [];
  let serverProgress = false;
  for (const event of result.events) {
    const tag = Array.isArray(event) ? event[0] : event;
    if (tag === "servers" || tag === "ticket" || tag === "token") continue;
    if (tag === "progress" && events.includes("progress.close")) {
      serverProgress = true;
      continue;
    }
    if (serverProgress && tag === "progress.close") {
      serverProgress = false;
      continue;
    }
    events.push(tag === "connect" ? (event as unknown[]).slice(0, 2)
      .concat((event as unknown[]).slice(3, 7)) : event);
  }
  return { ...result, events, equipmentSent: [] };
}

test("registered account flow matches release apart from server choice and ticket", async () => {
  const result = [{ type: "welcome", playerId: "member-1" }];
  assert.deepEqual(withoutServerChoice(await run(false, { nickname: "Account" }, [...result])),
    withoutServerChoice(await run(true, { nickname: "Account" }, [...result])));
});

// The release let guests pick a nickname; accounts are now required (ECONOMY.md 0).
test("without a signed-in account the lobby is refused instead of asking a guest nickname", async () => {
  const result = await run(false, undefined, [{ type: "welcome", playerId: "member-2" }]);
  assert.equal(result.error, "LOGIN_REQUIRED");
  assert.equal(result.hasLobby, false);
  assert.equal(result.events.some(event => Array.isArray(event) && event[0] === "nickname"), false);
  assert.deepEqual(result.events.slice(-2), ["loadAccount",
    ["progress.fail", "无法打开多人游戏：登录已失效，请重新登录后再进入多人游戏。"]]);
});

test("health protocol mismatch and progress failure match release", async () => {
  assert.deepEqual(await run(false, { nickname: "Account" }, [], { version: 38 }),
    await run(true, undefined, [], { version: 38 }));
});

test("an account chooses a server after login and connects with a ticket", async () => {
  const result = await run(false, { nickname: "Account" },
    [{ type: "welcome", playerId: "member-1" }]);
  assert.equal(result.error, undefined);
  assert.equal(result.connected, true);
  assert.equal(result.playerId, "member-1");
  assert.deepEqual(result.events, [
    ["progress", false],
    ["health", "http://127.0.0.1:8780/multiplayer/healthz", false],
    "loadAccount",
    "progress.close",
    ["progress", false],
    ["servers", "root", false],
    "progress.close",
    "audio.prepare",
    ["loadLobby", "function", "function"],
    "lobby.show", "visible", ["pageAudio", "lobby"], "bindClient",
    ["status", "多人大厅已打开，正在连接房间服务…", undefined],
    ["token", "http://127.0.0.1:8780/"],
    ["ticket", "game-8788", "session", false],
    ["connect", 1, "http://127.0.0.1:8788/multiplayer/offer", "Account", "p3553",
      "initial", true, "kt1.ticket-1"],
    "render",
    ["status", "请选择比赛频道。", undefined],
  ]);
});

test("unowned equipment is repaired once and retried with a fresh ticket", async () => {
  const repairs: string[] = [];
  const result = await run(false, { nickname: "Account" }, [new Error("ITEM_NOT_OWNED"),
    { type: "welcome", playerId: "member-3" }], {
    repair: async () => { repairs.push("repair"); },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.connected, true);
  assert.deepEqual(repairs, ["repair"]);
  assert.deepEqual(result.equipmentSent, [{ kart: "initial" }, { kart: "repaired" }]);
  const tickets = result.events.filter(event => Array.isArray(event) &&
    (event[0] === "ticket" || event[0] === "dispose"));
  assert.deepEqual(tickets, [
    ["ticket", "game-8788", "session", false], ["dispose", 1],
    ["ticket", "game-8788", "session", false],
  ]);
  // A second refusal is reported instead of looping.
  const twice = await run(false, { nickname: "Account" },
    [new Error("ITEM_NOT_OWNED"), new Error("ITEM_NOT_OWNED")], { repair: async () => {} });
  assert.equal(twice.connected, false);
  assert.deepEqual(twice.events.at(-1), ["status",
    "多人游戏：装备中有未拥有或已过期的物品，请在「选择赛车」或车库中更换后再试。", true]);
});

test("a registered account does not retry a taken nickname", async () => {
  const result = await run(false, { nickname: "Account" }, [new Error("NICKNAME_TAKEN")]);
  assert.equal(result.connected, false);
  assert.equal(result.events.filter(event => Array.isArray(event) &&
    event[0] === "connect").length, 1);
  assert.deepEqual(result.events.at(-1),
    ["status", "多人游戏：该昵称已被使用或已在游戏中。", true]);
});

test("no usable game server is reported before the lobby opens", async () => {
  const result = await run(false, { nickname: "Account" }, [], {
    choose: async () => { throw new Error("暂无可用的游戏服务器。"); },
  });
  assert.equal(result.error, "暂无可用的游戏服务器。");
  assert.equal(result.hasLobby, false);
  assert.deepEqual(result.events.slice(-3), [
    ["progress", false],
    ["servers", "root", false],
    ["progress.fail", "无法进入游戏服务器：暂无可用的游戏服务器。"],
  ]);
});

test("a cancelled server choice closes the progress view without an error notice", async () => {
  const result = await run(false, { nickname: "Account" }, [], {
    choose: async () => { throw new Error("ACCOUNT_CANCELLED"); },
  });
  assert.equal(result.error, "ACCOUNT_CANCELLED");
  assert.deepEqual(result.events.slice(-2), [["servers", "root", false], "progress.close"]);
});

const second: GameServer = { ...server, nodeId: "game-8789", name: "二号服",
  origin: "http://127.0.0.1:8789" };
const entryFor = (chosen: GameServer, attempt: number) => ({ nodeId: chosen.nodeId,
  offerUrl: `${chosen.origin}/multiplayer/offer`, ticket: `kt1.ticket-${attempt}` });

test("a server rejection after the lobby opens offers the other servers", async () => {
  const failedSets: Array<string[] | undefined> = [];
  let current = server;
  const result = await run(false, { nickname: "Account" },
    [{ type: "welcome", playerId: "member-1" }], {
      choose: async failed => {
        failedSets.push(failed && [...failed]);
        current = failed ? second : server;
        return current;
      },
      enter: async attempt => {
        if (attempt === 1) throw new Error("GAME_SERVER_FULL");
        return entryFor(current, attempt);
      },
    });
  assert.equal(result.error, undefined);
  assert.equal(result.connected, true);
  assert.equal(result.playerId, "member-1");
  assert.deepEqual(failedSets, [undefined, ["game-8788"]]);
  const lobbyShown = result.events.indexOf("lobby.show");
  assert.deepEqual(result.events.slice(lobbyShown + 4), [
    ["status", "多人大厅已打开，正在连接房间服务…", undefined],
    ["token", "http://127.0.0.1:8780/"],
    ["ticket", "game-8788", "session", false],
    ["dispose", 1], "bindClient",
    ["status", "多人游戏：所选游戏服务器已满，请选择其他服务器。", true],
    ["progress", false],
    ["servers", "root", false],
    "progress.close",
    ["status", "多人大厅已打开，正在连接房间服务…", undefined],
    ["token", "http://127.0.0.1:8780/"],
    ["ticket", "game-8789", "session", false],
    ["connect", 2, "http://127.0.0.1:8789/multiplayer/offer", "Account", "p3553",
      "initial", true, "kt1.ticket-2"],
    "render",
    ["status", "请选择比赛频道。", undefined],
  ]);
});

test("node refusals from the WebSocket and hello also offer the other servers", async () => {
  for (const code of ["SERVER_FULL", "SERVER_BUSY", "SERVER_SHUTTING_DOWN", "TICKET_WRONG_NODE",
    "DATA_NODE_MISMATCH", "PROTOCOL_MISMATCH", "WebSocket connection failed",
    "WebSocket connection timeout", "GAME_SERVER_NOT_FOUND"]) {
    let current = server;
    const result = await run(false, { nickname: "Account" }, [new Error(code),
      { type: "welcome", playerId: "member-2" }], {
      choose: async failed => (current = failed ? second : server),
      enter: async attempt => entryFor(current, attempt),
    });
    assert.equal(result.connected, true, code);
    assert.deepEqual(result.events.filter(event => Array.isArray(event) &&
      event[0] === "connect").map(event => (event as unknown[]).slice(1, 3)),
    [[1, "http://127.0.0.1:8788/multiplayer/offer"],
      [2, "http://127.0.0.1:8789/multiplayer/offer"]], code);
    assert.equal(result.nickname, "Account", code);
  }
});

test("re-picking stops after three servers and reports the last refusal", async () => {
  const failedSets: string[][] = [];
  let next = 8788;
  const result = await run(false, { nickname: "Account" }, [], {
    choose: async failed => {
      if (failed) failedSets.push([...failed]);
      return { ...server, nodeId: `game-${next++}` };
    },
    enter: async () => { throw new Error("SERVER_BUSY"); },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.connected, false);
  assert.deepEqual(failedSets, [["game-8788"], ["game-8788", "game-8789"],
    ["game-8788", "game-8789", "game-8790"]]);
  assert.equal(result.events.filter(event => Array.isArray(event) && event[0] === "ticket").length, 4);
  assert.deepEqual(result.events.at(-1),
    ["status", "多人游戏：游戏服务器繁忙，请稍后再试或选择其他服务器。", true]);
});

test("a failed re-pick is reported, and a cancelled one points back to single player", async () => {
  const none = await run(false, { nickname: "Account" }, [], {
    choose: async failed => {
      if (failed) throw new Error("暂无可用的游戏服务器。刚才无法进入所选游戏服务器，请稍后再试。");
      return server;
    },
    enter: async () => { throw new Error("GAME_SERVER_FULL"); },
  });
  assert.equal(none.error, undefined);
  assert.equal(none.connected, false);
  assert.deepEqual(none.events.slice(-3), [
    ["servers", "root", false],
    ["progress.fail", "无法进入游戏服务器：暂无可用的游戏服务器。刚才无法进入所选游戏服务器，请稍后再试。"],
    ["status", "多人游戏：暂无可用的游戏服务器。刚才无法进入所选游戏服务器，请稍后再试。", true],
  ]);

  const cancelled = await run(false, { nickname: "Account" }, [], {
    choose: async failed => {
      if (failed) throw new Error("ACCOUNT_CANCELLED");
      return server;
    },
    enter: async () => { throw new Error("GAME_SERVER_NOT_FOUND"); },
  });
  assert.equal(cancelled.error, undefined);
  assert.equal(cancelled.connected, false);
  assert.deepEqual(cancelled.events.slice(-3), [
    ["servers", "root", false],
    "progress.close",
    ["status", "多人游戏：未进入游戏服务器。请返回单人游戏，再重新进入多人游戏。", true],
  ]);
});

test("other connection failures after the lobby opens are shown in the status line", async () => {
  const result = await run(false, { nickname: "Account" }, [], {
    enter: async () => { throw new Error("TICKET_EXPIRED"); },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.connected, false);
  assert.equal(result.events.filter(event => Array.isArray(event) && event[0] === "servers").length, 1);
  assert.deepEqual(result.events.at(-1),
    ["status", "多人游戏：入场票据已过期，请重新进入多人游戏。", true]);
});
