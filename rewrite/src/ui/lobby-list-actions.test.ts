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
