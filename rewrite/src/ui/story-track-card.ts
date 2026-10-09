import { wa as trackThemeOf } from "../generated/library.js";
import { decodePngRgba } from "../resources/png-decoder";
import type { TrackMetadata } from "../resources/track-catalog";
import { decodeTrackPickerImage, loadTrackCard, type TrackPickerImage,
  type TrackPickerResource, type TrackPickerResourceLibrary } from "./track-picker-window-assets";

/**
 * The track card of the story ready window (stage_scenarioReady trackInfoCard,
 * trackTheme and out_trackName), loaded the way the time attack Ready view
 * and the lobby load theirs.
 */
export interface StoryTrackCard {
  /** <track container>/xt_trackCard.png */
  image: HTMLCanvasElement;
  width: number;
  height: number;
  /** dialog2_selectTrackEx/<theme>_1.png */
  themeIcon?: TrackPickerImage;
  /** stage_common 큰리버스트랙, drawn over the card of a _rvs track. */
  reverseStamp?: TrackPickerImage;
  /** "[反]" + the trackLocale@cn name, as Ready shows it. */
  title: string;
}

export interface StoryTrackCardLibrary extends TrackPickerResourceLibrary {
  trackMetadata(id: string): Promise<TrackMetadata | undefined>;
}

const png = { decodePng: decodePngRgba };

function unique(library: TrackPickerResourceLibrary, path: string): TrackPickerResource | undefined {
  const found = library.canonicalCandidates(path);
  return found.length === 1 ? found[0] : undefined;
}

/** Throws when the track's own xt_trackCard.png is missing or not unique. */
export async function loadStoryTrackCard(library: StoryTrackCardLibrary,
  track: { id: string; path: string }): Promise<StoryTrackCard> {
  const reverse = /_rvs$/i.test(track.id);
  const metadata = await library.trackMetadata(track.id);
  const theme = metadata ? trackThemeOf(metadata) as string | undefined : undefined;
  const iconSource = theme ? unique(library, `dialog2_/selectTrackEx/${theme}_1.png`) : undefined;
  const stampSource = reverse ? unique(library, "stage_/common/큰리버스트랙.png") : undefined;
  const [card, themeIcon, reverseStamp] = await Promise.all([
    loadTrackCard(library, track.path, png),
    iconSource ? decodeTrackPickerImage(iconSource, png).catch(() => undefined) : undefined,
    stampSource ? decodeTrackPickerImage(stampSource, png).catch(() => undefined) : undefined,
  ]);
  const name = metadata?.cnTitle ?? track.id.replace(/_rvs$/i, "");
  return { image: card.image, width: card.width, height: card.height, themeIcon, reverseStamp,
    title: `${reverse ? "[反]" : ""}${name}` };
}
