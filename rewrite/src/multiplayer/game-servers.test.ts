import assert from "node:assert/strict";
import test from "node:test";

import { chooseGameServer, fetchGameServerList, GAME_SERVER_STORAGE_KEY,
  gameServerOfferUrl, loadRememberedGameServer, NO_GAME_SERVER_MESSAGE,
  parseGameServerList, parseGameServerTicket, rememberGameServer,
  requestGameServerEntry, requestGameServerTicket, type GameServer,
  type GameServerDependencies, type GameServerOption } from "./game-servers";

const entry = (nodeId: string, extra: Record<string, unknown> = {}) => ({
  nodeId, name: `服务器 ${nodeId}`, origin: `http://127.0.0.1:${nodeId.slice(-4)}`,
  players: 1, rooms: 0, capacity: 10, full: false, ...extra,
});

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function harness(responses: Array<{ status: number; body?: unknown } | Error>,
  pageUrl = "http://127.0.0.1:8780/") {
  const requests: Array<{ url: string; init: Record<string, unknown> }> = [];
  const picks: Array<{ options: GameServerOption[]; selected: string }> = [];
  const storage = new MemoryStorage();
  let choice: (options: GameServerOption[]) => GameServer =
    options => options.find(option => !option.unavailable)!.server;
  const deps: GameServerDependencies = {
    endpoint: path => `http://127.0.0.1:8787/multiplayer/${path}`,
    backendOrigin: () => "http://127.0.0.1:8787",
    pageUrl: () => pageUrl,
    fetch: async (url, init) => {
      requests.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error("unexpected request");
      if (next instanceof Error) throw next;
      return { ok: next.status >= 200 && next.status < 300, status: next.status,
        json: async () => {
          if (next.body === undefined) throw new SyntaxError("Unexpected end of JSON input");
          return next.body;
        } };
    },
    storage: () => storage,
    pick: async (_root, options, selected) => {
      picks.push({ options, selected });
      return choice(options);
    },
  };
  return { deps, requests, picks, storage,
    choose(next: typeof choice) { choice = next; } };
}

const signal = () => new AbortController().signal;

test("server list validation keeps well-formed servers and drops broken entries", () => {
  const list = parseGameServerList({ dataNode: "data-1", servers: [
    entry("game-8788"),
    entry("game-8789", { origin: null, players: 10 }),
    entry("game-8788", { name: "重复" }),
    entry("bad id!"),
    entry("game-8790", { name: "x".repeat(33) }),
    entry("game-8791", { name: "控制\u0007字符" }),
    entry("game-8792", { players: -1 }),
    entry("game-8793", { capacity: 1.5 }),
    entry("game-8794", { origin: "http://127.0.0.1:8794/path" }),
    entry("game-8795", { origin: "ftp://127.0.0.1:8795" }),
    entry("game-8796", { full: "no" }),
    entry("game-8797", { name: "   " }),
    "not an object",
  ] });
  assert.deepEqual(list, { dataNode: "data-1", servers: [
    { nodeId: "game-8788", name: "服务器 game-8788", origin: "http://127.0.0.1:8788",
      players: 1, rooms: 0, capacity: 10, full: false },
    { nodeId: "game-8789", name: "服务器 game-8789", origin: null,
      players: 10, rooms: 0, capacity: 10, full: true },
  ] });
  for (const body of [null, [], { servers: [] }, { dataNode: "", servers: [] },
    { dataNode: "data-1", servers: {} }]) {
    assert.throws(() => parseGameServerList(body), /游戏服务器列表格式无效/);
  }
});

test("origins the data service lists are normalized to the browser's canonical form", () => {
  // The Go services keep the configured spelling; the browser lowercases the
  // host, drops default ports, compresses IPv6 and punycodes IDN hosts.
  const canonical: Array<[string, string]> = [
    ["http://Game-A.local:8788", "http://game-a.local:8788"],
    ["http://Zhangs-MacBook-Pro.local:8788", "http://zhangs-macbook-pro.local:8788"],
    ["https://game-b.example:443", "https://game-b.example"],
    ["http://example.com:80", "http://example.com"],
    ["http://[0:0:0:0:0:0:0:1]:8788", "http://[::1]:8788"],
    ["https://例子.测试", "https://xn--fsqu00a.xn--0zwm56d"],
    ["HTTPS://GAME.EXAMPLE", "https://game.example"],
  ];
  const list = parseGameServerList({ dataNode: "data-1", servers: canonical.map(([origin], index) =>
    entry(`game-${8800 + index}`, { origin })) });
  assert.deepEqual(list.servers.map(server => server.origin), canonical.map(([, origin]) => origin));

  for (const origin of ["http://127.0.0.1:8794/path", "https://game.example/ws",
    "ftp://127.0.0.1:8795", "https://user:pass@game.example", "https://game.example?x=1",
    "https://game.example#top", "http:game.example", "http:\\\\game.example",
    " https://game.example", "https://game.\texample", "javascript:alert(1)", "game.example", ""]) {
    assert.equal(parseGameServerList({ dataNode: "data-1",
      servers: [entry("game-8788", { origin })] }).servers.length, 0, JSON.stringify(origin));
  }
});

test("ticket validation requires the requested node and a well-formed ticket", () => {
  const ticket = { ticket: "kt1.eyJ2IjoxfQ.c2ln", nodeId: "game-8788", origin: null,
    dataNode: "data-1", expiresAt: 1_700_000_120_000 };
  assert.deepEqual(parseGameServerTicket(ticket, "game-8788"), ticket);
  assert.throws(() => parseGameServerTicket(ticket, "game-8789"), /入场票据与所选游戏服务器不符/);
  for (const broken of [{ ticket: "" }, { ticket: "kt1.a b" }, { ticket: "x".repeat(2049) },
    { origin: "https://game.example/ws" }, { origin: 7 }, { expiresAt: 1.5 },
    { expiresAt: "1" }, { nodeId: "game 8788" }, { dataNode: null }]) {
    assert.throws(() => parseGameServerTicket({ ...ticket, ...broken }, "game-8788"),
      /入场票据格式无效/, JSON.stringify(broken));
  }
  assert.throws(() => parseGameServerTicket("kt1.a.b", "game-8788"), /入场票据格式无效/);
  assert.deepEqual(parseGameServerTicket({ ...ticket, origin: "https://Game.example:443" },
    "game-8788"), { ...ticket, origin: "https://game.example" });
});

test("offer URLs use the server origin or the data service origin and keep HTTPS", () => {
  assert.equal(gameServerOfferUrl("http://127.0.0.1:8788", "http://127.0.0.1:8787",
    "http://127.0.0.1:8780/"), "http://127.0.0.1:8788/multiplayer/offer");
  assert.equal(gameServerOfferUrl(null, "https://192.168.1.8:8780",
    "https://192.168.1.8:8780/"), "https://192.168.1.8:8780/multiplayer/offer");
  assert.equal(gameServerOfferUrl("https://game-1.example", "https://kart.example",
    "https://kart.example/"), "https://game-1.example/multiplayer/offer");
  assert.throws(() => gameServerOfferUrl("http://game-1.example", "https://kart.example",
    "https://kart.example/"), /HTTPS 网页必须连接 HTTPS 游戏服务器/);
  assert.throws(() => gameServerOfferUrl("https://game-1.example/x", "https://kart.example",
    "https://kart.example/"), /完整的 HTTP\(S\) 域名/);
  assert.equal(gameServerOfferUrl("https://Game.example:443", "https://kart.example",
    "https://kart.example/"), "https://game.example/multiplayer/offer");
  assert.equal(gameServerOfferUrl(null, "http://Kart.example:80", "http://kart.example/"),
    "http://kart.example/multiplayer/offer");
});

test("the remembered server survives unavailable or corrupted storage", () => {
  const storage = new MemoryStorage();
  assert.equal(loadRememberedGameServer(() => storage), undefined);
  rememberGameServer("game-8789", () => storage);
  assert.equal(storage.getItem(GAME_SERVER_STORAGE_KEY), "game-8789");
  assert.equal(loadRememberedGameServer(() => storage), "game-8789");
  storage.setItem(GAME_SERVER_STORAGE_KEY, "<script>");
  assert.equal(loadRememberedGameServer(() => storage), undefined);
  const broken = () => { throw new DOMException("denied", "SecurityError"); };
  assert.equal(loadRememberedGameServer(broken), undefined);
  assert.doesNotThrow(() => rememberGameServer("game-8789", broken));
  const failing = { getItem: () => { throw new Error("quota"); },
    setItem: () => { throw new Error("quota"); } };
  assert.equal(loadRememberedGameServer(() => failing), undefined);
  assert.doesNotThrow(() => rememberGameServer("game-8789", () => failing));
});

test("list requests report server codes, old backends and unreachable services", async () => {
  const ok = harness([{ status: 200, body: { dataNode: "data-1", servers: [entry("game-8788")] } }]);
  const list = await fetchGameServerList(ok.deps, signal());
  assert.equal(list.servers.length, 1);
  assert.equal(ok.requests[0]!.url, "http://127.0.0.1:8787/multiplayer/game-servers");
  assert.equal(ok.requests[0]!.init.cache, "no-store");
  assert.equal(ok.requests[0]!.init.credentials, "same-origin");
  assert.equal(ok.requests[0]!.init.method, undefined);

  const cases: Array<[{ status: number; body?: unknown } | Error, RegExp | { message: string }]> = [
    [{ status: 503, body: { error: "DATA_SERVICE_UNAVAILABLE" } }, { message: "DATA_SERVICE_UNAVAILABLE" }],
    [{ status: 500, body: { error: "<b>bad</b>" } }, { message: "HTTP_500" }],
    [{ status: 502 }, { message: "HTTP_502" }],
    [{ status: 404, body: { status: 404, error: "Not Found" } }, /尚未更新到多服务器版本/],
    [{ status: 200, body: "not json object" }, /游戏服务器列表格式无效/],
    [{ status: 200 }, /游戏服务器列表格式无效/],
    [new TypeError("Failed to fetch"), /无法连接数据服务/],
  ];
  for (const [response, expected] of cases) {
    await assert.rejects(fetchGameServerList(harness([response]).deps, signal()), expected);
  }

  const misconfigured = harness([]);
  misconfigured.deps.endpoint = () => { throw new Error("当前网页域名与联机前端配置不匹配。"); };
  await assert.rejects(fetchGameServerList(misconfigured.deps, signal()),
    { message: "当前网页域名与联机前端配置不匹配。" });

  const controller = new AbortController();
  controller.abort();
  const abortError = new DOMException("aborted", "AbortError");
  await assert.rejects(fetchGameServerList(harness([abortError]).deps, controller.signal),
    error => error === abortError);
});

test("tickets carry the session token only to the data service", async () => {
  const ticket = { ticket: "kt1.abc.def", nodeId: "game-8788",
    origin: "http://127.0.0.1:8788", dataNode: "data-1", expiresAt: 1 };
  const { deps, requests } = harness([{ status: 200, body: ticket }, { status: 200, body: ticket }]);
  assert.deepEqual(await requestGameServerTicket(deps, "game-8788", "s".repeat(43), signal()), ticket);
  await requestGameServerTicket(deps, "game-8788", undefined, signal());
  assert.equal(requests[0]!.url, "http://127.0.0.1:8787/multiplayer/game-servers/ticket");
  assert.equal(requests[0]!.init.method, "POST");
  assert.equal(requests[0]!.init.body, JSON.stringify({ nodeId: "game-8788" }));
  assert.deepEqual(requests[0]!.init.headers, { "Content-Type": "application/json",
    Authorization: `Bearer ${"s".repeat(43)}` });
  assert.deepEqual(requests[1]!.init.headers, { "Content-Type": "application/json" });

  for (const code of ["GAME_SERVER_FULL", "GAME_SERVER_NOT_FOUND", "LOGIN_REQUIRED"]) {
    await assert.rejects(requestGameServerTicket(harness([{ status: 409, body: { error: code } }]).deps,
      "game-8788", undefined, signal()), { message: code });
  }
});

test("each entry asks for a new ticket and connects where the ticket says", async () => {
  const issue = (ticket: string, origin: string | null) => ({ status: 200,
    body: { ticket, nodeId: "game-8788", origin, dataNode: "data-1", expiresAt: 1 } });
  const { deps, requests } = harness([issue("kt1.one.a", null),
    issue("kt1.two.b", "http://127.0.0.1:8788")]);
  const server: GameServer = { ...entry("game-8788"), origin: "http://127.0.0.1:8788" };
  assert.deepEqual(await requestGameServerEntry(deps, server, undefined, signal()), {
    nodeId: "game-8788", ticket: "kt1.one.a",
    offerUrl: "http://127.0.0.1:8787/multiplayer/offer" });
  assert.deepEqual(await requestGameServerEntry(deps, server, undefined, signal()), {
    nodeId: "game-8788", ticket: "kt1.two.b",
    offerUrl: "http://127.0.0.1:8788/multiplayer/offer" });
  assert.equal(requests.length, 2);
});

test("no usable server is an error and a single usable server is entered directly", async () => {
  const none = harness([{ status: 200, body: { dataNode: "data-1", servers: [
    entry("game-8788", { full: true }), entry("game-8789", { players: 10 }),
  ] } }]);
  await assert.rejects(chooseGameServer(none.deps, "root", signal()),
    { message: `${NO_GAME_SERVER_MESSAGE}所有游戏服务器均已满，请稍后再试。` });
  const empty = harness([{ status: 200, body: { dataNode: "data-1", servers: [] } }]);
  await assert.rejects(chooseGameServer(empty.deps, "root", signal()),
    { message: NO_GAME_SERVER_MESSAGE });

  const single = harness([{ status: 200, body: { dataNode: "data-1", servers: [
    entry("game-8788", { full: true }), entry("game-8789"),
  ] } }]);
  single.storage.setItem(GAME_SERVER_STORAGE_KEY, "game-8788");
  assert.equal((await chooseGameServer(single.deps, "root", signal())).nodeId, "game-8789");
  assert.equal(single.picks.length, 0);
  assert.equal(single.storage.getItem(GAME_SERVER_STORAGE_KEY), "game-8788");

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(chooseGameServer(single.deps, "root", controller.signal),
    { message: "ACCOUNT_CANCELLED" });
});

test("several usable servers open the picker on the remembered choice", async () => {
  const body = { dataNode: "data-1", servers: [
    entry("game-8788"), entry("game-8789"), entry("game-8790", { full: true }),
  ] };
  const first = harness([{ status: 200, body }]);
  first.choose(options => options[1]!.server);
  assert.equal((await chooseGameServer(first.deps, "root", signal())).nodeId, "game-8789");
  assert.equal(first.picks[0]!.selected, "game-8788");
  assert.deepEqual(first.picks[0]!.options.map(option => [option.server.nodeId,
    option.unavailable]), [["game-8788", undefined], ["game-8789", undefined],
    ["game-8790", "已满"]]);
  assert.equal(first.storage.getItem(GAME_SERVER_STORAGE_KEY), "game-8789");

  const again = harness([{ status: 200, body }]);
  again.storage.setItem(GAME_SERVER_STORAGE_KEY, "game-8789");
  await chooseGameServer(again.deps, "root", signal());
  assert.equal(again.picks[0]!.selected, "game-8789");

  const stale = harness([{ status: 200, body }]);
  stale.storage.setItem(GAME_SERVER_STORAGE_KEY, "game-8790");
  await chooseGameServer(stale.deps, "root", signal());
  assert.equal(stale.picks[0]!.selected, "game-8788");

  const cancelled = harness([{ status: 200, body }]);
  cancelled.deps.pick = async () => { throw new Error("ACCOUNT_CANCELLED"); };
  await assert.rejects(chooseGameServer(cancelled.deps, "root", signal()), /ACCOUNT_CANCELLED/);
  assert.equal(cancelled.storage.getItem(GAME_SERVER_STORAGE_KEY), null);
});

test("an HTTPS page cannot choose plain HTTP game servers", async () => {
  const { deps, picks } = harness([{ status: 200, body: { dataNode: "data-1", servers: [
    entry("game-8788"), { ...entry("game-8789"), origin: "https://game-2.example" },
    { ...entry("game-8790"), origin: null },
  ] } }], "https://kart.example/");
  await chooseGameServer(deps, "root", signal());
  assert.deepEqual(picks[0]!.options.map(option => option.unavailable),
    ["需要 HTTPS", undefined, undefined]);
  assert.equal(picks[0]!.selected, "game-8789");

  const onlyHttp = harness([{ status: 200, body: { dataNode: "data-1",
    servers: [entry("game-8788"), entry("game-8789")] } }], "https://kart.example/");
  await assert.rejects(chooseGameServer(onlyHttp.deps, "root", signal()),
    { message: `${NO_GAME_SERVER_MESSAGE}在线的游戏服务器未启用 HTTPS，HTTPS 网页无法连接` +
      "（请为游戏服务器配置 https:// 地址）。" });

  const mixed = harness([{ status: 200, body: { dataNode: "data-1", servers: [
    entry("game-8788"), entry("game-8789"), { ...entry("game-8790"), origin: "https://game-3.example",
      full: true },
  ] } }], "https://kart.example/");
  await assert.rejects(chooseGameServer(mixed.deps, "root", signal()),
    { message: `${NO_GAME_SERVER_MESSAGE}在线的游戏服务器中，2 台未启用 HTTPS` +
      "（HTTPS 网页无法连接，请为游戏服务器配置 https:// 地址）；1 台已满。" });
});

test("servers the lobby failed to enter are listed but not offered again", async () => {
  const body = { dataNode: "data-1", servers: [
    entry("game-8788"), entry("game-8789"), entry("game-8790"), entry("game-8791", { full: true }),
  ] };
  const repick = harness([{ status: 200, body }]);
  repick.storage.setItem(GAME_SERVER_STORAGE_KEY, "game-8788");
  repick.choose(options => options[2]!.server);
  assert.equal((await chooseGameServer(repick.deps, "root", signal(),
    new Set(["game-8788"]))).nodeId, "game-8790");
  assert.deepEqual(repick.picks[0]!.options.map(option => option.unavailable),
    ["连接失败", undefined, undefined, "已满"]);
  assert.equal(repick.picks[0]!.selected, "game-8789");

  const single = harness([{ status: 200, body }]);
  assert.equal((await chooseGameServer(single.deps, "root", signal(),
    new Set(["game-8788", "game-8789"]))).nodeId, "game-8790");
  assert.equal(single.picks.length, 0);

  const none = harness([{ status: 200, body: { dataNode: "data-1", servers: [entry("game-8788")] } }]);
  await assert.rejects(chooseGameServer(none.deps, "root", signal(), new Set(["game-8788"])),
    { message: `${NO_GAME_SERVER_MESSAGE}刚才无法进入所选游戏服务器，请稍后再试。` });
  const rest = harness([{ status: 200, body: { dataNode: "data-1", servers: [
    entry("game-8788"), entry("game-8789", { full: true })] } }]);
  await assert.rejects(chooseGameServer(rest.deps, "root", signal(), new Set(["game-8788"])),
    { message: `${NO_GAME_SERVER_MESSAGE}在线的游戏服务器中，1 台刚才无法进入；1 台已满。` });
});
