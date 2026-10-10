import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  createGhostRecordMenu, currentGhostRecordKey, mountGhostRecordMenu,
  selectGhostTrack, type GhostMenuConfiguration, type GhostMenuHost,
} from "./ghost-menu";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const selected = new Set(["mountGhostMenu", "ghostRecordMenu", "selectGhostTrack", "currentGhostRecordKey"]);
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, selected.size);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Selection = { trackId?: string; characterItemId?: number };
type Configuration = GhostMenuConfiguration<Selection, string, { name: string }>;
type Event = Array<string | number | undefined | object>;
let originalEvents: Event[] = [];
const recordKey = (selection: Selection, options: { speed: number; version: string }) =>
  ({ trackId: selection.trackId, speed: options.speed, version: options.version });
class Menu {
  constructor(readonly configuration: Configuration) {}
  mount(slot: unknown) { originalEvents.push(["mount", String(slot)]); return "mounted"; }
}
const Original = new Function("vd0", "bl0", "Pt", `return class { ${originalSource} };`)(
  Menu,
  () => originalEvents.push(["clear-nickname"]),
  { recordKey },
) as new () => GhostMenuHost<Selection, string, { name: string }> & {
  mountGhostMenu(): unknown;
  ghostRecordMenu(): Menu;
};

function makeHost(rewritten: boolean): {
  host: GhostMenuHost<Selection, string, { name: string }> & { mountGhostMenu(): unknown; ghostRecordMenu(): Menu };
  events: Event[];
} {
  const events: Event[] = [];
  originalEvents = events;
  const host = new Original();
  host.replayLibrary = { name: "replays" };
  host.rhoLibrary = "archive";
  host.session = { selection: { trackId: "city", characterItemId: 42 } };
  host.timeAttackReadyOptions = {
    speed: 7, booster: 0, version: "国服", settingSpeed: 7, showGhost: true,
  };
  host.ready = { refreshRecord: () => { events.push(["refresh-record"]); } };
  host.hud = { showDebugText: (message, level) => { events.push(["debug", message, level]); } };
  host.ghostSamplingMode = "normal";
  host.localNickname = "Driver";
  host.touchControls = { ghostMenuSlot: "slot" };
  host.applyNewRiderRegistration = async () => {
    events.push(["registration"]);
    throw new Error("registration failed");
  };
  host.enterTimeAttackReady = async () => { events.push(["enter-ready"]); };
  if (rewritten) {
    host.mountGhostMenu = () => mountGhostRecordMenu(host);
    host.ghostRecordMenu = () => createGhostRecordMenu(host,
      configuration => new Menu(configuration),
      () => events.push(["clear-nickname"]));
    host.selectGhostTrack = (selection, speed, booster, version) =>
      selectGhostTrack(host, selection, speed, booster, version);
    host.currentGhostRecordKey = () => currentGhostRecordKey(host, recordKey);
  }
  return { host, events };
}

async function run(rewritten: boolean): Promise<unknown> {
  const { host, events } = makeHost(rewritten);
  const mounted = host.mountGhostMenu();
  const menu = host.ghostRecordMenu() as Menu;
  const options = menu.configuration;
  const snapshots: unknown[] = [];
  snapshots.push({
    mounted,
    library: options.library,
    currentLibrary: options.getLibrary(),
    selectedTrack: options.getSelection(),
    currentKey: options.currentKey(),
    speedVersion: options.speedVersion(),
    samplingMode: options.samplingMode(),
  });
  options.refreshRecord();
  options.reportError("bad record");
  options.changeSamplingMode("precise");
  await options.selectTrack({ trackId: "mountain", characterItemId: 5 }, 4, 1, "国服");
  snapshots.push({ selection: host.session.selection,
    options: { ...host.timeAttackReadyOptions },
    key: options.currentKey(),
    samplingMode: options.samplingMode() });
  await host.selectGhostTrack({ trackId: "coast" }, 8, 2, "国际服");
  snapshots.push({ selection: host.session.selection,
    options: { ...host.timeAttackReadyOptions },
    key: host.currentGhostRecordKey() });
  host.session.selection = undefined;
  host.timeAttackReadyOptions.version = undefined as unknown as string;
  snapshots.push({ missingKey: options.currentKey(), defaultVersion: options.speedVersion() });
  options.resetNickname();
  await Promise.resolve();
  await Promise.resolve();
  return { snapshots, events, nickname: host.localNickname };
}

test("Ghost menu selection and registration behavior match the release", async () => {
  assert.deepEqual(await run(true), await run(false));
});
