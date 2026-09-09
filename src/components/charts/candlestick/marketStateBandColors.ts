import type { MarketStateDirection } from "./marketState";

/** The colour of each shaded zone on the price plot when the Market State readout's "surligner les
 *  zones" switch is on (see `MarketStateBands`). Caller-editable from the readout itself. */
export type MarketStateBandColors = Record<MarketStateDirection, string>;

/** Pale by construction, and that is the whole specification: these sit *under* the candles, so a
 *  colour strong enough to be admired is a colour strong enough to compete with the thing it is
 *  supposed to be describing. Green/grey/red follows the convention the rest of the chart already
 *  uses for up, flat and down, so no legend is needed to read them.
 *
 *  Written as literals rather than derived from `--lq-color-up`/`--lq-color-down`: these end up in
 *  a colour input the user edits, and an input cannot show, let alone round-trip, a value like
 *  `color-mix(in srgb, var(--lq-color-up) 12%, transparent)`. */
export const DEFAULT_MARKET_STATE_BAND_COLORS: MarketStateBandColors = {
  long: "#d8ecdd",
  neutral: "#e6e4de",
  short: "#f4dcda",
};

/** What each zone is called in the readout, in reading order. */
export const MARKET_STATE_BAND_LABELS: { direction: MarketStateDirection; label: string }[] = [
  { direction: "long", label: "Long" },
  { direction: "neutral", label: "Neutre" },
  { direction: "short", label: "Short" },
];
