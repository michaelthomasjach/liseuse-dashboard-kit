import { computeMarketState, type MarketStateDirection, type MarketStateInput } from "./marketState";

/** One run of bars the Market State reads the same way — what the chart shades when the readout's
 *  "surligner les zones" switch is on. */
export interface MarketStateBand {
  direction: MarketStateDirection;
  /** Inclusive bar indices. */
  from: number;
  to: number;
}

/** How many points across the visible range are actually evaluated.
 *
 *  Every sample is a full `computeMarketState` — percentiles over a 200-bar window, every
 *  indicator on the chart read at that bar. Running it on all 400 visible bars of a wide screen
 *  costs a visible pause on every pan; running it 120 times does not, and 120 samples across a
 *  screen is already finer than a shaded background can show. The direction is held between
 *  samples, which is exactly what a band is: a claim about a stretch, not about a bar. */
const MAX_SAMPLES = 120;

/** The direction the readout would give at each sampled bar, merged into runs.
 *
 *  Deliberately routed through `computeMarketState` rather than through a cheaper approximation of
 *  it: the shading and the panel have to agree at the bar under the pointer, and two code paths
 *  computing "the same" score is how they stop agreeing. */
export function computeMarketStateBands(
  input: Omit<MarketStateInput, "index">,
  from: number,
  to: number,
): MarketStateBand[] {
  const first = Math.max(0, Math.floor(from));
  const last = Math.min(input.candles.length - 1, Math.ceil(to));
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
