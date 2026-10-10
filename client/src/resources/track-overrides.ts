import type { TrackMetadata } from "./track-catalog";

/**
 * Metadata for tracks that track@zz.bml does not list: the 驾照考试
 * (rider school) courses such as village_L01_02 or village_C005 ship only
 * their track.1s, and the mission table supplies the rest. The race loader
 * falls back to these when the release table has no row.
 */
const overrides = new Map<string, TrackMetadata>();

export function registerTrackMetadata(metadata: TrackMetadata): void {
  overrides.set(metadata.id.toLowerCase(), metadata);
}

export function trackMetadataOverride(trackId: string): TrackMetadata | undefined {
  return overrides.get(trackId.toLowerCase());
}
