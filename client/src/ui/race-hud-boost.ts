/** The race HUD keeps the personal and team full-gauge flashes independently. */
export interface RaceHudBoostState {
  fullActive: boolean;
  fullAnchorMs: number;
  teamFullActive: boolean;
  teamFullAnchorMs: number;
}

export interface RaceHudBoostFrame {
  ratio: number;
  fullVisible: boolean;
  fullAlpha: number;
}

type ActiveKey = "fullActive" | "teamFullActive";
type AnchorKey = "fullAnchorMs" | "teamFullAnchorMs";

function advanceFullGauge(
  state: RaceHudBoostState,
  timeMs: number,
  ratio: number,
  activeKey: ActiveKey,
  anchorKey: AnchorKey,
  invalidRatioLabel: string,
  nativeSine: (radians: number) => number,
): RaceHudBoostFrame {
  if (!Number.isFinite(ratio))
    throw new Error(`P3528 ${invalidRatioLabel}=${ratio} 无效。`);
  if (!state[activeKey]) return { ratio, fullVisible: false, fullAlpha: 255 };

  if (state[anchorKey] === 0) state[anchorKey] = timeMs;
  const elapsedMs = (timeMs - state[anchorKey]) >>> 0;
  if (elapsedMs >= 1_000) {
    state[activeKey] = false;
    state[anchorKey] = 0;
    return { ratio: 0, fullVisible: false, fullAlpha: 255 };
  }

  const single = Math.fround;
  const fadeRatio = Math.max(0,
    single(single(1) - single(single(elapsedMs) / single(1_000))));
  const wave = single(nativeSine(single(single(elapsedMs) * single(0.005))));
  const fullAlpha = Math.trunc(single(single(Math.abs(wave)) * single(255))) & 255;
  return { ratio: fadeRatio, fullVisible: true, fullAlpha };
}

export function personalBoostFrame(
  state: RaceHudBoostState,
  timeMs: number,
  ratio: number,
  nativeSine: (radians: number) => number,
): RaceHudBoostFrame {
  return advanceFullGauge(state, timeMs, ratio,
    "fullActive", "fullAnchorMs", "boost gauge ratio", nativeSine);
}

export function teamBoostFrame(
  state: RaceHudBoostState,
  timeMs: number,
  ratio: number,
  nativeSine: (radians: number) => number,
): RaceHudBoostFrame {
  return advanceFullGauge(state, timeMs, ratio,
    "teamFullActive", "teamFullAnchorMs", "team boost gauge ratio", nativeSine);
}
