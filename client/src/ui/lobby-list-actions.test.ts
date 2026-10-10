import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { activateLobbyListEntry, type LobbyListActionHost } from "./lobby-list-actions";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

test("多人大厅所有入口的分发与发行版一致", async () => {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class Ew {");
  const end = release.indexOf("\nfunction U1(", start);
  assert.ok(start >= 0 && end > start);
  const modes: Record<string, { gameplay: string }> = {
    giant: { gameplay: "giant" },
    roadblock: { gameplay: "roadblock" },
    grip: { gameplay: "grip" },
    ordinaryRace: { gameplay: "ordinary" },
  };
  const modeForButton = (name: string) => modes[name];
  const isChannel = (name: string) => name === "speedTeamCombine";
  const Original = new Function("Zc", "$6",
    `${release.slice(start, end)}\nreturn Ew;`)(modeForButton, isChannel) as {
      prototype: { activate(this: LobbyListActionHost, name: string): void };
    };

  for (const channelName of [undefined, "speedTeamCombine", "speedIndiCombine"]) {
    for (const name of ["giant", "roadblock", "grip", "ordinaryRace",
      "createRoom", "quickJoin", "room0", "room8", "roomLeft", "roomRight",
      "speedTeamCombine", "missing"]) {
      const originalEvents: unknown[][] = [];
      const rewrittenEvents: unknown[][] = [];
      const host = (events: unknown[][]): LobbyListActionHost => ({
        hits: name === "missing" ? [] : [{ name }],
        rooms: [{ count: 2, capacity: 8 }], channelName, page: 3,
        gameplay: "ordinary",
        options: {
          onActivate: () => { events.push(["activate"]); },
          onMode: (...args) => { events.push(["mode", ...args]); },
          onCreate: () => { events.push(["create"]); },
          onQuickJoin: () => { events.push(["quickJoin"]); },
          onJoin: room => { events.push(["join", room]); },
        },
      });
      Original.prototype.activate.call(host(originalEvents), name);
      activateLobbyListEntry(host(rewrittenEvents), name, modeForButton, isChannel);
      assert.deepEqual(rewrittenEvents, originalEvents, `${channelName}:${name}`);
    }
  }
});

test("标签、分类和筛选只改界面状态并请求对应列表", () => {
  const events: unknown[][] = [];
  const host: LobbyListActionHost = {
    hits: ["tab:etc", "tab:item", "cat:itemTeam", "cat:speedTeam", "cat:speedCustom", "filter:team",
      "roomRight"].map(name => ({ name })),
    rooms: [], channelName: "speedIndiCombine", page: 2, gameplay: "ordinary",
    render: () => { events.push(["render"]); },
    options: {
      version: "p3553",
      onMode: (...args) => { events.push(["mode", ...args]); },
      onUnavailable: (title, message) => { events.push(["unavailable", title, message]); },
    },
  };
  const modeForButton = () => undefined;
  const isChannel = () => false;

  activateLobbyListEntry(host, "cat:speedCustom", modeForButton, isChannel);
  // Same list: the page stays.
  assert.deepEqual(events.splice(0), [["render"], ["mode", "speedIndiCombine", 2, "ordinary"]]);
  assert.equal(host.lobbyUi?.loading, true);

  activateLobbyListEntry(host, "cat:speedTeam", modeForButton, isChannel);
  assert.deepEqual(events.splice(0), [["render"], ["mode", "speedTeamCombine", 0, "ordinary"]]);

  activateLobbyListEntry(host, "filter:team", modeForButton, isChannel);
  assert.deepEqual(events.splice(0), [["render"]]);
  assert.equal(host.lobbyUi?.filters.team, false);

  // 道具赛 opens on 个人道具赛 and lists the item gameplay.
  activateLobbyListEntry(host, "tab:item", modeForButton, isChannel);
  assert.deepEqual(events.splice(0), [["render"], ["mode", "itemIndiCombine", 0, "item"]]);
  assert.deepEqual([host.lobbyUi?.tab, host.lobbyUi?.category], ["item", "itemIndi"]);
  host.channelName = "itemIndiCombine";
  host.gameplay = "item";
  host.page = 1;
  activateLobbyListEntry(host, "cat:itemTeam", modeForButton, isChannel);
  // The other item category lists the same rooms; its channel opens page 0.
  assert.deepEqual(events.splice(0), [["render"], ["mode", "itemTeamCombine", 0, "item"]]);
  assert.deepEqual([host.lobbyUi?.tab, host.lobbyUi?.category], ["item", "itemTeam"]);
  host.channelName = "speedIndiCombine";
  host.gameplay = "ordinary";
  host.page = 2;

  activateLobbyListEntry(host, "tab:etc", modeForButton, isChannel);
  assert.deepEqual(events.splice(0), [["render"], ["mode", "speedIndiCombine", 0, "grip"]]);
  assert.deepEqual([host.lobbyUi?.tab, host.lobbyUi?.category], ["etc", "grip"]);

  activateLobbyListEntry(host, "roomRight", modeForButton, isChannel);
  assert.deepEqual(events.splice(0), [["mode", "speedIndiCombine", 3, "ordinary"]]);
});

test("道具赛在 P3553 以外不开放，模式卡从道具列表回到竞速频道", () => {
  const events: unknown[][] = [];
  const host: LobbyListActionHost = {
    hits: ["tab:item", "grip", "ordinaryRace"].map(name => ({ name })),
    rooms: [], channelName: "itemTeamCombine", page: 0, gameplay: "item",
    options: {
      version: "p3528",
      onMode: (...args) => { events.push(["mode", ...args]); },
      onUnavailable: (title, message) => { events.push(["unavailable", title, message]); },
    },
  };
  activateLobbyListEntry(host, "tab:item", () => undefined, () => false);
  assert.deepEqual(events.splice(0), [["unavailable", "道具赛", "道具赛需要 P3553 资源版本。"]]);
  const modes: Record<string, { gameplay: string }> = {
    grip: { gameplay: "grip" }, ordinaryRace: { gameplay: "ordinary" },
  };
  activateLobbyListEntry(host, "grip", name => modes[name], () => false);
  activateLobbyListEntry(host, "ordinaryRace", name => modes[name], () => false);
  assert.deepEqual(events, [["mode", "speedTeamCombine", 0, "grip"],
    ["mode", "speedTeamCombine", 0, "ordinary"]]);
});
