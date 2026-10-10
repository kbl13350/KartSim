import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ReadyController, type ReadyControllerServices } from
  "./ready-controller";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class ql0 {");
const end = release.indexOf("\nfunction xl(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

function observe(rewritten: boolean) {
  const events: unknown[][] = [];
  class RandomTrackSession {
    constructor() { events.push(["random-session"]); }
  }
  let profile = { favoriteTracks: [{ themeId: "old", trackId: "one" }] };
  const application = {
    shell: { readyModalBusy: true },
    getProfile() { events.push(["profile"]); return profile; },
    setProfile(value: typeof profile) { events.push(["set-profile", value]); profile = value; },
    saveProfile() { events.push(["save-profile"]); },
    hud: { showDebugText() {} },
  };
  const normalize = (track: unknown) => {
    events.push(["normalize", track]);
    return { themeId: "theme", trackId: String(track) };
  };
  const services = {
    createRandomTrackSession: () => new RandomTrackSession(),
    favoriteTrack: normalize,
  } as unknown as ReadyControllerServices;
  const Original = new Function("Tc0", "IP",
    `${source}\nreturn ql0;`)(RandomTrackSession, normalize) as
    new (host: typeof application) => Record<string, unknown>;
  const instance = rewritten
    ? new ReadyController(application, services) : new Original(application);
  const host = instance as unknown as Record<string, unknown>;
  const keys = Object.keys(host);
  const initial = JSON.parse(JSON.stringify(host, (_key, value: unknown) =>
    typeof value === "function" ? "function" : value));
  const notice = { update(value: unknown) { events.push(["notice", value]); } };
  (instance as ReadyController).setWindowNotice(notice);
  const currentNotice = (instance as ReadyController).getWindowNotice() === notice;
  (instance as ReadyController).updateWindowNotice("online");
  host.activeTimeAttackReady = {
    render(value: unknown) { events.push(["render", value]); },
    refreshRecord() { events.push(["refresh"]); },
  };
  (instance as ReadyController).renderReady({ phase: "ready" });
  (instance as ReadyController).refreshRecord();
  const busy = (instance as ReadyController).readyModalBusy();
  const emptyNetwork = (instance as ReadyController).networkDiagnostics();
  host.multiplayer = {
    networkDiagnostics() { events.push(["network"]); return [123]; },
  };
  const network = (instance as ReadyController).networkDiagnostics();
  (instance as ReadyController).changeFavoriteTrack("two", true);
  (instance as ReadyController).changeFavoriteItems(["one"]);
  return { keys, initial, events, currentNotice, busy,
    emptyNetwork, network, profile };
}

test("Ready controller ownership, notices, network and favorites match release", () => {
  assert.deepEqual(observe(true), observe(false));
});
