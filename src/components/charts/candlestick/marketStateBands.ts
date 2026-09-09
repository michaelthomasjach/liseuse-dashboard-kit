import { computeMarketState, type MarketStateDirection, type MarketStateInput } from "./marketState";

/** One run of bars the Market State reads the same way — what the chart shades when the readout's
 *  "surligner les zones" switch is on. */
export interface MarketStateBand {
  direction: MarketStateDirection;
  /** Inclusive bar indices. */
  from: number;
  to: number;
}

/** How many points across the *whole series* are evaluated.
 *
 *  Every sample is a full `computeMarketState` — percentiles over a 200-bar window, every
 *  indicator on the chart read at that bar — so the count has to be bounded rather than "one per
 *  bar", whatever the dataset's length. The direction is held between samples, which is exactly
 *  what a band is: a claim about a stretch, not about a bar. */
const MAX_SAMPLES = 200;

/** The direction the readout would give at each sampled bar, merged into runs — over the whole
 *  series, not the visible window.
 *
 *  That distinction is the difference between usable and not. A bar's direction depends on that
 *  bar and its own lookback; the viewport has nothing to do with it. Computing per visible range
 *  made the result change identity on every pan frame, and since each frame re-ran the full
 *  computation the chart stalled while being dragged — measured at 128ms a frame, 2.5 seconds of
 *  long tasks across one pan. Over the whole series it is computed once per dataset and per
 *  indicator change, and panning costs nothing at all.
 *
 *  Deliberately routed through `computeMarketState` rather than through a cheaper approximation of
 *  it: the shading and the panel have to agree at the bar under the pointer, and two code paths
 *  computing "the same" score is how they stop agreeing. */
export function computeMarketStateBands(input: Omit<MarketStateInput, "index">): MarketStateBand[] {
  const first = 0;
  const last = input.candles.length - 1;
  if (last <= first) return [];

  const step = Math.max(1, Math.ceil((last - first + 1) / MAX_SAMPLES));
  const bands: MarketStateBand[] = [];

  for (let index = first; index <= last; index += step) {
    const { direction } = computeMarketState({ ...input, index });
    const previous = bands[bands.length - 1];
    // The run reaches to just before the next sample, or to the end of the range for the last one.
    const reach = Math.min(last, index + step - 1);
    if (previous && previous.direction === direction) previous.to = reach;
    else bands.push({ direction, from: index, to: reach });
  }
  return bands;
}
