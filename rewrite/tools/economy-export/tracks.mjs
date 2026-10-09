// The time-attack track list the data service accepts in
// POST /api/timeattack/settle (server-go/internal/data/economy/tracks.json).
//
// The input is the browser's own TrackChoice list (src/resources/
// track-catalog.ts timeAttackTrackCatalog, from track_/common/track@zz.bml and
// the track models in the archives): its ids are exactly the trackId values
// the time-attack ready flow puts into the selection and settles, including
// the "<id>_rvs" reverse variants.

/** Longest id the data service stores (timeattack_* track_id VARCHAR(64)). */
export const MAX_TRACK_ID_LENGTH = 64;

const TRACK_ID = /^[A-Za-z0-9_.-]+$/;

/**
 * Turn TrackChoice entries into tracks.json rows, keeping the catalog order
 * (normal tracks, then reverse ones). Problems are reported through
 * `problem`; offending entries are left out.
 */
export function timeAttackTrackRows(choices, problem) {
  const rows = [];
  const seen = new Set();
  for (const choice of choices) {
    const id = choice?.id;
    if (typeof id !== "string" || !TRACK_ID.test(id) || id.length > MAX_TRACK_ID_LENGTH) {
      problem(`time-attack track id ${JSON.stringify(id)} is not a short ASCII id`);
      continue;
    }
    if (seen.has(id)) { problem(`time-attack track ${id} is listed twice`); continue; }
    seen.add(id);
    if (choice.gameType !== "item" && choice.gameType !== "speed")
      problem(`time-attack track ${id}: gameType ${choice.gameType}`);
    if (!choice.title) problem(`time-attack track ${id}: empty title`);
    rows.push({ id, title: choice.title, gameType: choice.gameType, reverse: choice.reverse ? true : undefined });
  }
  if (rows.length === 0) problem("time-attack track catalog is empty");
  return rows;
}
