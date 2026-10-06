/** Converts native race frames into KSV v12 recordings and headers. */

interface Vec3 { x: number; y: number; z: number }
interface Quaternion { w: number; x: number; y: number; z: number }

export interface NativeRaceFrame {
  stageTimeMs: number;
  position: Vec3;
  rotation: Quaternion;
  state: {
    stateCode: unknown;
    driftActive: unknown;
    instantAccelerationActive: unknown;
    motionRequest: unknown;
  };
}

export interface KsvStamp {
  timeMs: number;
  x: number;
  y: number;
  z: number;
  w: number;
  qx: number;
  qy: number;
  qz: number;
  status: unknown;
}

export interface GhostKsvRecording {
  frames: NativeRaceFrame[];
  ksvRuntimeStamps?: unknown[];
  metadata: {
    equipment: Record<string, unknown> & { playerName?: string };
    trackId: string;
    summary: { elapsedMs: number };
    speed: unknown;
  };
}

export interface GhostKsvExportDependencies {
  encodeStatus(stateCode: unknown, driftActive: unknown,
    instantAccelerationActive: unknown, motionRequest: unknown): unknown;
  encodeRuntimeStamp(stamp: unknown, zCeiling: number): unknown;
  createRecorder(zCeiling: number): {
    begin(stamp: KsvStamp): void;
    update(stamp: KsvStamp): void;
    finish(): unknown;
  };
}

export function nativeFrameToKsvStamp(frame: NativeRaceFrame,
  encodeStatus: GhostKsvExportDependencies["encodeStatus"]): KsvStamp {
  return {
    timeMs: Math.max(0, frame.stageTimeMs),
    x: frame.position.x,
    y: -frame.position.z,
    z: frame.position.y,
    w: frame.rotation.w,
    qx: frame.rotation.x,
    qy: frame.rotation.y,
    qz: frame.rotation.z,
    status: encodeStatus(frame.state.stateCode, frame.state.driftActive,
      frame.state.instantAccelerationActive, frame.state.motionRequest),
  };
}

export function encodeGhostKsvRecording(recording: GhostKsvRecording,
  zCeiling: number,
  dependencies: GhostKsvExportDependencies): unknown {
  if (recording.ksvRuntimeStamps) {
    return { stamps: recording.ksvRuntimeStamps.map(stamp =>
      dependencies.encodeRuntimeStamp(stamp, zCeiling)) };
  }
  const first = recording.frames[0];
  if (!first) return { stamps: [] };
  const recorder = dependencies.createRecorder(zCeiling);
  recorder.begin(nativeFrameToKsvStamp(first, dependencies.encodeStatus));
  for (const frame of recording.frames) {
    recorder.update(nativeFrameToKsvStamp(frame, dependencies.encodeStatus));
  }
  return recorder.finish();
}

export function ghostKsvEquipment(equipment: Record<string, unknown>): {
  [key: string]: unknown;
} {
  return {
    character: equipment.character,
    kartPaint: equipment.kartPaint ?? 0,
    characterColor: equipment.characterColor ?? 0,
    kart: equipment.kart,
    plate: equipment.plate,
    goggle: equipment.goggle,
    balloon: equipment.balloon,
    equ2: equipment.superBoss ?? 0,
    headband: equipment.headBand,
    replay: equipment.headphone ?? 0,
    cane: equipment.handGearL,
    equ3: equipment.handGearR ?? 0,
    apparel: equipment.uniform ?? 0,
    equ4: equipment.decal ?? 0,
    plateText: equipment.plateText,
    startSlot: equipment.startSlot,
    unknownPlayerFlag: 0,
    equ5: 0,
    equ6: 0,
    equ7: 0,
    equ8: 0,
    equ9: 0,
    equ10: 0,
    equ11: 0,
    equ12: 0,
  };
}

export function buildGhostKsvHeader(recording: GhostKsvRecording,
  encoded: unknown): Record<string, unknown> {
  const equipment = ghostKsvEquipment(recording.metadata.equipment);
  const playerName = recording.metadata.equipment.playerName ?? "";
  return {
    headerVersion: 12,
    recordTitle: "",
    regionCode: 0,
    unknown1_1: 255,
    contestType: 9,
    playerNameHash: 0,
    unknown1_2: 0,
    recorderAccount: "",
    recorderName: playerName,
    recordingDateDays: 0,
    recordingDateTime: 0,
    recordChecksum: 0,
    isOfficial: false,
    description: "",
    trackName: recording.metadata.trackId,
    unknown3: 0,
    bestTimeMs: recording.metadata.summary.elapsedMs,
    contestImg: "",
    opaqueBlob: Uint8Array.of(0, 0, 0, 0),
    unknown6: 0,
    speed: recording.metadata.speed,
    unknown7: 0,
    players: [{ playerName, clubName: "", equipment }],
    recordVersion: 12,
    records: [encoded],
  };
}
