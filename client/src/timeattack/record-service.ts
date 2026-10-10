/** Publication of a completed solo race and its optional Ghost recording. */

export interface RecordSelection {
  trackId?: string;
  vehicleItemId?: number;
  characterItemId?: number;
  vehicleSystemKey?: unknown;
  vehiclePath?: unknown;
}

export interface ReadyRecordOptions {
  booster: unknown;
  version?: string;
  [key: string]: unknown;
}

export interface RaceResultCounts {
  crashCount: number;
  boosterCount: number;
}

export interface EquipmentSnapshot {
  character: number;
  kartPaint: unknown;
  characterColor: unknown;
  kart: number;
  systemKey?: unknown;
  kartPath?: unknown;
  plate: unknown;
  goggle: unknown;
  balloon: unknown;
  headBand: unknown;
  handGearL: unknown;
  plateText: unknown;
  playerName?: unknown;
  startSlot: unknown;
}

export interface RecordedRace {
  record: { stamps: unknown[] };
  runtimeStamps: unknown;
}

export interface RawRecording {
  metadata: {
    trackId: string;
    speed: unknown;
    version: string;
    booster: unknown;
    timeBase: "countdown";
    equipment: EquipmentSnapshot;
    summary: RaceResultCounts & {
      elapsedMs: number;
      kartName: string;
      speed: unknown;
      booster: unknown;
    };
  };
  frames: unknown[];
  ksvRuntimeStamps: unknown;
}

export interface ReplayParticipant {
  equipment: EquipmentSnapshot;
  record: RecordedRace["record"];
  timeBase: "countdown";
  rawRecording?: RawRecording;
}

export interface RecordServiceHost {
  library: {
    restore(reportError: (message: string) => void): unknown;
    promote(key: string, replay: ReplayParticipant[] | undefined, trackId: string,
      summary: RaceResultCounts & Record<string, unknown>): Promise<unknown> | unknown;
  };
  getSelection(): RecordSelection | undefined;
  getVehicleTitle(): string | undefined;
  getTrackId(): string | undefined;
  getReadyOptions(): ReadyRecordOptions;
  getProfile(): { equipment: { itemIds: Record<number, unknown> }; initial: unknown };
  getLocalNickname(): string | undefined;
  getPlayerSlot(): unknown;
  getRecorder(): { finish(): RecordedRace[] } | undefined;
  reportError(message: string): void;
}

export interface RecordService {
  host: RecordServiceHost;
  currentEquipment(): EquipmentSnapshot | undefined;
  rawRecording(recorded: RecordedRace, equipment: EquipmentSnapshot, elapsedMs: number,
    counts: RaceResultCounts, kartName: string): RawRecording | undefined;
  captureReplay(elapsedMs: number, counts: RaceResultCounts,
    kartName: string): ReplayParticipant[] | undefined;
}

export interface RecordServiceDependencies {
  recordKey(selection: RecordSelection, options: ReadyRecordOptions): string;
  resolveSpeed(options: ReadyRecordOptions): unknown;
  validateSpeed(options: ReadyRecordOptions): unknown;
}

export function restoreRaceRecords(service: RecordService): unknown {
  return service.host.library.restore(message => service.host.reportError(message));
}

/** Keep every host read in release order: the options may be live state. */
export async function promoteRaceRecord(service: RecordService, elapsedMs: number,
  counts: RaceResultCounts, dependencies: RecordServiceDependencies): Promise<void> {
  const selection = service.host.getSelection();
  const kartName = service.host.getVehicleTitle();
  if (!selection || !kartName) {
    throw new Error("TimeAttack record promotion 缺少当前资源身份。 ");
  }

  const key = dependencies.recordKey(selection, service.host.getReadyOptions());
  const replay = service.captureReplay(elapsedMs, counts, kartName);
  const trackId = service.host.getTrackId() ?? selection.trackId ?? "";
  await service.host.library.promote(key, replay, trackId, {
    elapsedMs,
    kartName,
    crashCount: counts.crashCount,
    boosterCount: counts.boosterCount,
    speed: dependencies.resolveSpeed(service.host.getReadyOptions()),
    booster: service.host.getReadyOptions().booster,
    ...(replay ? { hasGhost: true } : {}),
  });
}

export function captureRaceReplay(service: RecordService, elapsedMs: number,
  counts: RaceResultCounts, kartName: string): ReplayParticipant[] | undefined {
  const equipment = service.currentEquipment();
  const recorder = service.host.getRecorder();
  if (!recorder || !equipment) return;

  const recorded = recorder.finish()[0];
  if (!recorded || recorded.record.stamps.length === 0) return;
  const rawRecording = service.rawRecording(recorded, equipment, elapsedMs, counts, kartName);
  return [{
    equipment,
    record: recorded.record,
    timeBase: "countdown",
    ...(rawRecording ? { rawRecording } : {}),
  }];
}

/** A valid Ghost still survives when native KSV metadata cannot be built. */
export function buildRawRaceRecording(service: RecordService, recorded: RecordedRace,
  equipment: EquipmentSnapshot, elapsedMs: number, counts: RaceResultCounts,
  kartName: string, dependencies: RecordServiceDependencies): RawRecording | undefined {
  const selection = service.host.getSelection();
  if (!selection?.trackId) return;
  const options = service.host.getReadyOptions();
  let speed: unknown;
  try {
    speed = dependencies.validateSpeed(options);
  } catch {
    return;
  }
  return {
    metadata: {
      trackId: selection.trackId,
      speed,
      version: options.version ?? "国服",
      booster: options.booster,
      timeBase: "countdown",
      equipment,
      summary: {
        elapsedMs,
        kartName,
        crashCount: counts.crashCount,
        boosterCount: counts.boosterCount,
        speed,
        booster: options.booster,
      },
    },
    frames: [],
    ksvRuntimeStamps: recorded.runtimeStamps,
  };
}

/** Snapshot the equipped IDs before the race session is released. */
export function currentRaceEquipment(service: RecordService): EquipmentSnapshot | undefined {
  const selection = service.host.getSelection();
  if (selection?.vehicleItemId === undefined || !selection.characterItemId) return;
  const equipped = service.host.getProfile().equipment;
  return {
    character: selection.characterItemId,
    kartPaint: equipped.itemIds[2],
    characterColor: equipped.itemIds[70],
    kart: selection.vehicleItemId,
    ...(selection.vehicleSystemKey !== undefined
      ? { systemKey: selection.vehicleSystemKey } : {}),
    ...(selection.vehiclePath !== undefined
      ? { kartPath: selection.vehiclePath } : {}),
    plate: equipped.itemIds[4],
    goggle: equipped.itemIds[8],
    balloon: equipped.itemIds[9],
    headBand: equipped.itemIds[11],
    handGearL: equipped.itemIds[16],
    plateText: service.host.getProfile().initial,
    ...(service.host.getLocalNickname()
      ? { playerName: service.host.getLocalNickname() } : {}),
    startSlot: service.host.getPlayerSlot(),
  };
}
