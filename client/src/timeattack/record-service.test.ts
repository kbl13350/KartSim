import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildRawRaceRecording, captureRaceReplay, currentRaceEquipment,
  promoteRaceRecord, restoreRaceRecords, type EquipmentSnapshot,
  type RaceResultCounts, type ReadyRecordOptions, type RecordSelection,
  type RecordService, type RecordServiceDependencies, type RecordServiceHost,
  type RecordedRace,
} from "./record-service";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Nh0 {");
const end = release.indexOf("\nfunction Oh0", start);
assert.ok(start >= 0 && end > start);
const releasedClass = release.slice(start, end);
for (const member of ["restore", "promote", "captureReplay", "rawRecording", "currentEquipment"]) {
  assert.match(releasedClass, new RegExp(`\\b${member}\\(`));
}

type Service = RecordService & {
  restore(): unknown;
  promote(elapsedMs: number, counts: RaceResultCounts): Promise<void>;
};
type Event = unknown[];
type Scenario = "full" | "no-recorder" | "empty-record" | "no-equipment" |
  "invalid-speed" | "missing-selection" | "missing-title" | "publish-error" |
  "no-track-id" | "no-nickname";

function makeFixture(scenario: Scenario, rewritten: boolean): {
  service: Service;
  events: Event[];
  recorded: RecordedRace;
  equipment: EquipmentSnapshot;
} {
  const events: Event[] = [];
  const selection: RecordSelection | undefined = scenario === "missing-selection" ? undefined : {
    trackId: scenario === "no-track-id" ? undefined : "village_R01",
    vehicleItemId: 1097,
    characterItemId: scenario === "no-equipment" ? 0 : 302,
    vehicleSystemKey: 44,
    vehiclePath: "kart_/normal.kart",
  };
  const recorded: RecordedRace = {
    record: { stamps: scenario === "empty-record" ? [] : [{ at: 17 }] },
    runtimeStamps: [{ time: 17 }],
  };
  const profile = {
    initial: "L",
    equipment: { itemIds: { 2: 22, 70: 70, 4: 4, 8: 8, 9: 9, 11: 11, 16: 16 } },
  };
  let optionReads = 0;
  let nicknameReads = 0;
  const host: RecordServiceHost = {
    library: {
      restore(reportError) {
        events.push(["restore"]);
        reportError("broken older row");
        return "restored";
      },
      async promote(key, replay, trackId, summary) {
        events.push(["promote", key, replay, trackId, summary]);
        if (scenario === "publish-error") throw new Error("database unavailable");
      },
    },
    getSelection() { events.push(["selection"]); return selection; },
    getVehicleTitle() {
      events.push(["vehicle-title"]);
      return scenario === "missing-title" ? "" : "Cotton SR";
    },
    getTrackId() { events.push(["track-id"]); return undefined; },
    getReadyOptions() {
      const options: ReadyRecordOptions = {
        booster: 1 + optionReads,
        version: "国服",
        speed: 7 + optionReads,
      };
      optionReads++;
      events.push(["ready-options", optionReads]);
      return options;
    },
    getProfile() { events.push(["profile"]); return profile; },
    getLocalNickname() {
      nicknameReads++;
      events.push(["nickname", nicknameReads]);
      return scenario === "no-nickname" ? "" : `Rider-${nicknameReads}`;
    },
    getPlayerSlot() { events.push(["player-slot"]); return 2; },
    getRecorder() {
      events.push(["recorder"]);
      return scenario === "no-recorder" ? undefined : {
        finish() { events.push(["finish"]); return [recorded]; },
      };
    },
    reportError(message) { events.push(["report-error", message]); },
  };
  const dependencies: RecordServiceDependencies = {
    recordKey(value, options) {
      events.push(["record-key", value.trackId, options.speed]);
      if (!value.trackId) throw new Error("TimeAttack record key 缺少赛道。 ");
      return `${value.trackId}|${options.speed}`;
    },
    resolveSpeed(options) {
      events.push(["resolve-speed", options.speed]);
      return options.speed;
    },
    validateSpeed(options) {
      events.push(["validate-speed", options.speed]);
      if (scenario === "invalid-speed") throw new Error("unavailable speed");
      return options.speed;
    },
  };
  const Released = new Function("Pt", "Ue", "y6", `${releasedClass}\nreturn Nh0;`)(
    { recordKey: dependencies.recordKey }, dependencies.resolveSpeed,
    dependencies.validateSpeed,
  ) as new (value: RecordServiceHost) => Service;
  const service = new Released(host);
  if (rewritten) Object.assign(service, {
    restore(this: Service) { return restoreRaceRecords(this); },
    promote(this: Service, elapsedMs: number, counts: RaceResultCounts) {
      return promoteRaceRecord(this, elapsedMs, counts, dependencies);
    },
    captureReplay(this: Service, elapsedMs: number, counts: RaceResultCounts, kartName: string) {
      return captureRaceReplay(this, elapsedMs, counts, kartName);
    },
    rawRecording(this: Service, result: RecordedRace, equipment: EquipmentSnapshot,
      elapsedMs: number, counts: RaceResultCounts, kartName: string) {
      return buildRawRaceRecording(this, result, equipment, elapsedMs, counts,
        kartName, dependencies);
    },
    currentEquipment(this: Service) { return currentRaceEquipment(this); },
  });
  return { service, events, recorded, equipment: {
    character: 302, kartPaint: 22, characterColor: 70, kart: 1097,
    systemKey: 44, kartPath: "kart_/normal.kart", plate: 4, goggle: 8,
    balloon: 9, headBand: 11, handGearL: 16, plateText: "L",
    playerName: "Rider-2", startSlot: 2,
  } };
}

async function inspectPromotion(scenario: Scenario, rewritten: boolean): Promise<unknown> {
  const { service, events } = makeFixture(scenario, rewritten);
  let error: string | undefined;
  try {
    await service.promote(62_345, { crashCount: 3, boosterCount: 8 });
  } catch (failure) {
    error = (failure as Error).message;
  }
  return { error, events };
}

test("record promotion and Ghost publication match the released service", async () => {
  for (const scenario of ["full", "no-recorder", "empty-record", "no-equipment",
    "invalid-speed", "no-nickname", "publish-error", "no-track-id",
    "missing-selection", "missing-title"] as const) {
    assert.deepEqual(await inspectPromotion(scenario, true),
      await inspectPromotion(scenario, false), scenario);
  }
});

test("restore callback and direct Ghost methods match the released service", () => {
  for (const scenario of ["full", "no-recorder", "empty-record", "no-equipment",
    "invalid-speed", "no-track-id", "no-nickname"] as const) {
    function inspect(rewritten: boolean): unknown {
      const { service, events, recorded, equipment } = makeFixture(scenario, rewritten);
      const restored = service.restore();
      const current = service.currentEquipment();
      const replay = service.captureReplay(2200, { crashCount: 1, boosterCount: 2 }, "Neo");
      const raw = service.rawRecording(recorded, equipment, 2200,
        { crashCount: 1, boosterCount: 2 }, "Neo");
      return { restored, current, replay, raw, events };
    }
    assert.deepEqual(inspect(true), inspect(false), scenario);
  }
});
