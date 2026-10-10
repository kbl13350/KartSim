import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import {
  getOrCreateRecordService, updateKartBoosterState,
  type KartBoosterHost, type RecordServiceConfiguration, type RecordServiceHost,
} from "./race-services";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as { parse(source: string, options: object): any };
const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class Bf0 {");
const classEnd = release.indexOf("\nfunction Rf0", classStart);
assert.ok(classStart >= 0 && classEnd > classStart);
const classSource = release.slice(classStart, classEnd);
const ast = parse(classSource, { sourceType: "script" });
const selected = new Set(["records", "updateKartBoosterState"]);
const members = ast.program.body[0].body.body.filter((member: any) =>
  member.key?.type === "Identifier" && selected.has(member.key.name));
assert.equal(members.length, selected.size);
const originalSource = members.map((member: any) =>
  classSource.slice(member.start, member.end)).join("\n");

type Event = unknown[];
class RecordService {
  constructor(readonly configuration: RecordServiceConfiguration) {}
}
type TestedHost = RecordServiceHost & KartBoosterHost & {
  readonly records: RecordService;
  updateKartBoosterState(nowMs: unknown, visualState: unknown, previousSlot: unknown): unknown;
};

function makeHost(rewritten: boolean): { host: TestedHost; events: Event[] } {
  const events: Event[] = [];
  class OriginalRecordService extends RecordService {
    constructor(configuration: RecordServiceConfiguration) {
      super(configuration);
      events.push(["create-record-service"]);
    }
  }
  const Original = new Function("Nh0", `return class { ${originalSource} };`)(
    OriginalRecordService,
  ) as new () => TestedHost;
  const host = new Original();
  host.replayLibrary = "replays-1";
  host.session = {
    selection: { trackId: "village_R01" }, vehicleTitle: "Kart A",
    kartEffects: undefined,
  };
  host.timeAttackReadyOptions = { speed: 7 };
  host.userProfile = { name: "Rider A" };
  host.localNickname = "Blue";
  host.currentPlayerSlot = 2;
  host.ghostRecorder = "ghost-1";
  host.hud = { showDebugText: (message, level) => { events.push(["debug", message, level]); } };
  host.physics = {
    audioState: () => { events.push(["audio-state"]); return "audio"; },
    dualBoosterMode: () => { events.push(["booster-mode"]); return "mode"; },
    dualBoosterTeam: () => { events.push(["booster-team"]); return "team"; },
    setAnimationSlot: slot => { events.push(["animation-slot", slot]); },
  };
  host.kartView = { enterDualUse: () => { events.push(["enter-dual-use"]); return 3; } };
  if (rewritten) {
    Object.defineProperty(host, "records", { configurable: true,
      get: () => getOrCreateRecordService(host, config => new OriginalRecordService(config)) });
    host.updateKartBoosterState = (nowMs, visualState, previousSlot) =>
      updateKartBoosterState(host, nowMs, visualState, previousSlot);
  }
  return { host, events };
}

function inspectRecordService(rewritten: boolean): unknown {
  const { host, events } = makeHost(rewritten);
  const first = host.records;
  const second = host.records;
  const config = first.configuration;
  const beforeTrack = config.getTrackId();
  host.replayLibrary = "replays-2";
  host.session.selection = { trackId: "coast" };
  host.session.vehicleTitle = "Kart B";
  host.session.track = { data: { trackId: "coast" } };
  host.timeAttackReadyOptions = { speed: 4 };
  host.userProfile = { name: "Rider B" };
  host.localNickname = "Green";
  host.currentPlayerSlot = 4;
  host.ghostRecorder = "ghost-2";
  const current = {
    libraryAtConstruction: config.library,
    selection: config.getSelection(),
    vehicleTitle: config.getVehicleTitle(),
    trackId: config.getTrackId(),
    readyOptions: config.getReadyOptions(),
    profile: config.getProfile(),
    nickname: config.getLocalNickname(),
    playerSlot: config.getPlayerSlot(),
    recorder: config.getRecorder(),
  };
  config.reportError("bad record");
  host.recordsInstance = null;
  const third = host.records;
  return {
    beforeTrack, cached: first === second, current,
    recreatedAfterNull: third !== first,
    newLibrary: third.configuration.library,
    events,
  };
}

test("record service is lazy and callbacks read live race state like release", () => {
  assert.deepEqual(inspectRecordService(true), inspectRecordService(false));
});

function runBooster(rewritten: boolean, changed: boolean | undefined,
  slot: unknown): unknown {
  const { host, events } = makeHost(rewritten);
  if (changed !== undefined) {
    host.session.kartEffects = {
      setState: (...args) => { events.push(["set-effect-state", ...args]); return changed; },
    };
  }
  host.kartView.enterDualUse = () => { events.push(["enter-dual-use"]); return slot; };
  const returned = host.updateKartBoosterState(1234, "glow", "previous-slot");
  return { returned, events };
}

test("Kart booster visual transition and fallback slots match release", () => {
  for (const changed of [undefined, false, true] as const) {
    for (const slot of [undefined, 3]) {
      assert.deepEqual(runBooster(true, changed, slot), runBooster(false, changed, slot));
    }
  }
});
