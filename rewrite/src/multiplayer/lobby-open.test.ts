import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { openMultiplayerLobby, type LobbyOpenClient, type LobbyOpenDependencies,
  type LobbyOpenHost } from "./lobby-open";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  async open() {", classStart);
const end = source.indexOf("  bindClient()", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = source.slice(start, end);

function fixture(account: { nickname: string } | undefined,
  connectResults: Array<{ type: string; playerId: string } | Error>, version = 39) {
  const events: unknown[] = [];
  let clientNumber = 0;
  const createClient = (): LobbyOpenClient => {
    const number = ++clientNumber;
    return { connect: async (url, nickname, resourceVersion, _equipment, initial,
      raceRuntime, token) => {
      events.push(["connect", number, url, nickname, resourceVersion, initial, raceRuntime, token]);
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
      return { ok: true, json: async () => ({ protocolVersion: version }) };
    },
    showAccountProgress: (_root, signal) => {
      events.push(["progress", signal.aborted]);
      return { close: () => events.push("progress.close"),
        fail: async (message: string) => { events.push(["progress.fail", message]); } };
    },
    loadAccount: async () => { events.push("loadAccount"); return account; },
    chooseNickname: async (_root, suggestion, _signal, retry) => {
      events.push(["nickname", suggestion, retry]);
      return retry ? "Guest-2" : "Guest-1";
    },
    loadLobby: async options => {
      events.push(["loadLobby", typeof options.onMode, typeof options.onJoin]);
      return { show: () => events.push("lobby.show"),
        dispose: () => events.push("lobby.dispose") };
    },
    notice: (_options, title, message) => { events.push(["notice", title, message]); },
    sessionToken: url => { events.push(["token", url]); return "session"; },
    rememberNickname: nickname => { events.push(["remember", nickname]); },
    createClient,
  };
  const host = {
    options: { root: "root", nickname: "Suggestion", version: "p3553",
      initialEquipment: {}, initial: "initial", raceLoader: {},
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
      deps.chooseNickname, { load: deps.loadLobby }, { notice: deps.notice },
      deps.sessionToken, (url: string) => url, deps.rememberNickname,
      class { constructor() { return createClient(); } }, deps.protocolVersion,
      (error: unknown) => error instanceof Error ? error.message : String(error),
      (url: string, init: { signal: AbortSignal }) => deps.fetchHealth(url, init.signal),
      { location: { href: deps.pageUrl() } },
    ) as new () => { open(this: LobbyOpenHost): Promise<void> };
  return { host, deps, Original, events };
}

async function run(released: boolean, account: { nickname: string } | undefined,
  results: Array<{ type: string; playerId: string } | Error>, version = 39) {
  const { host, deps, Original, events } = fixture(account, results, version);
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
    connected: host.connected, hasLobby: !!host.lobby, refresh: !!host.refresh };
}

test("registered account connection matches release", async () => {
  const result = [{ type: "welcome", playerId: "member-1" }];
  assert.deepEqual(await run(false, { nickname: "Account" }, [...result]),
    await run(true, { nickname: "Account" }, [...result]));
});

test("guest nickname retry and successful connection match release", async () => {
  const result = [new Error("GUEST_NAME_TAKEN"),
    { type: "welcome", playerId: "member-2" }];
  assert.deepEqual(await run(false, undefined, [...result]),
    await run(true, undefined, [...result]));
});

test("health protocol mismatch and progress failure match release", async () => {
  assert.deepEqual(await run(false, undefined, [], 38),
    await run(true, undefined, [], 38));
});
