/**
 * Stable, descriptive entry points for game systems. Several generated classes
 * now delegate their behavior to handwritten modules; their remaining fields
 * and view construction can be migrated without changing imports.
 *
 * Importing `generated/app.js` starts the app immediately. It is deliberately
 * excluded from this barrel; `src/main.ts` owns startup.
 */
export { Sw as ArchiveLibrary } from "../generated/library.js";
export { AL as DrivingSimulation } from "../generated/driving.js";
export { _L as TrackWorld, jr0 as RacePresenter } from "../generated/world.js";
export {
  LT as MultiplayerClient,
  Wl0 as MultiplayerLobby,
  ql0 as MenuCoordinator,
} from "../generated/multiplayer.js";
export {
  LT as LegacyMultiplayerClient,
  Wl0 as LegacyMultiplayerLobby,
} from "../generated/multiplayer.js";
export {
  Pt as GhostRecordStore,
  df0 as TimeAttackController,
  vf0 as FramePresenter,
} from "../generated/timeattack.js";
export { DrivingAction, DrivingInputAccumulator } from "../input/driving-input";
export {
  makeGhostRecordKey,
  trackIdFromGhostKey,
  ghostExportFilename,
  safeGhostFilenamePart,
  commonGhostTimeBase,
  readGhostSummaryEntries,
  restoreGhostSummaries,
} from "./ghost-records";
export {
  GhostRecordStore as GhostFrameStore,
  restoreGhostRecord,
  persistGhostRecord,
} from "./ghost/record-store";
export { encodeGhostFrames, decodeGhostFrames } from "./ghost/frame-codec";
export {
  encodeKsvFile,
  decodeKsvFile,
  encodeKsvBody,
  decodeKsvBody,
} from "./ghost/ksv-codec";
