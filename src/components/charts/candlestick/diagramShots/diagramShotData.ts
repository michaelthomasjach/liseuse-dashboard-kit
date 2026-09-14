import type { FundamentalDataPoint } from "../interfaces/FundamentalDataPoint.interface";
import type { OverlayDataPoint } from "../interfaces/TrendLineDrawing.interface";
import { PROP_SHOT_DATA, shotClose, shotDate } from "../propShots/propShotData";

/** The two extra datasets the diagram captures need on top of the candles.
 *
 *  The candles themselves are `PROP_SHOT_DATA` — the same fixed-seed, fixed-end-date series the
 *  props reference already screenshots. Reusing it is the point: these captures are committed
 *  files compared across runs, and a dataset that slid forward with the calendar would produce a
 *  diff on every run and drift every date-anchored drawing out of the visible window.
 *
 *  Eight of the thirty indicators are fundamentals and one is a correlation, and none of those
 *  can be computed from candles — the library plots what the host reports and fetches nothing
 *  itself. So they are reported here, deterministically. */

export { PROP_SHOT_DATA, shotClose, shotDate };

/** Quarterly reports across the candles' own date range, shaped so each metric's own pane shows
 *  something worth looking at rather than a flat line: revenue climbs, net income takes one
 *  exceptional hit, free cash flow dips negative during an investment phase, the P/E spikes on the
 *  quarter where earnings nearly vanish. */
export const SHOT_FUNDAMENTALS: FundamentalDataPoint[] = [
  { fromEnd: 156, freeCashFlow: 42_000_000, netIncome: 61_000_000, totalRevenue: 410_000_000, netMargin: 14.9, grossMargin: 52.1, peRatio: 21.4, eps: 1.22, debtToEquity: 0.44 },
  { fromEnd: 124, freeCashFlow: 18_000_000, netIncome: 72_000_000, totalRevenue: 447_000_000, netMargin: 16.1, grossMargin: 53.4, peRatio: 23.8, eps: 1.41, debtToEquity: 0.52 },
  { fromEnd: 92, freeCashFlow: -9_000_000, netIncome: 54_000_000, totalRevenue: 486_000_000, netMargin: 11.1, grossMargin: 51.8, peRatio: 26.2, eps: 1.06, debtToEquity: 0.68 },
  { fromEnd: 60, freeCashFlow: 27_000_000, netIncome: 12_000_000, totalRevenue: 521_000_000, netMargin: 2.3, grossMargin: 52.6, peRatio: 88.5, eps: 0.24, debtToEquity: 0.81 },
  { fromEnd: 28, freeCashFlow: 66_000_000, netIncome: 95_000_000, totalRevenue: 564_000_000, netMargin: 16.8, grossMargin: 54.9, peRatio: 24.9, eps: 1.92, debtToEquity: 0.73 },
].map(({ fromEnd, ...metrics }) => ({ date: shotDate(fromEnd), ...metrics }));

/** A second instrument for the correlation pane: it mirrors the main series for the first half of
 *  the window and then shadows it, so the coefficient underneath actually travels from one end of
 *  its scale to the other instead of sitting still. */
export const SHOT_CORRELATION_DATA: OverlayDataPoint[] = PROP_SHOT_DATA.map((candle, i) => {
  const mid = PROP_SHOT_DATA.length / 2;
  const base = shotClose(0);
  // First half: reflected around the series' own mean, so the two move in opposite directions.
  // Second half: the same shape, six points below — solidaire.
  // Noise on purpose: an exact mirror gives a coefficient of exactly -1, which plots on the
  // pane's own bottom edge and reads as no line at all.
  const noise = Math.sin(i * 1.7) * 2.4 + Math.sin(i * 0.37) * 1.6;
  const value = i < mid ? 2 * base - candle.close + noise : candle.close - 6 + noise * 0.4;
  return { date: candle.date, value };
});

/* ------------------------------------------------------------------------------------------- *
 *  Candles shaped to contain what an indicator exists to find
 *
 *  Four of the thirty indicators detect a *structure* rather than transforming the series: gaps,
 *  chart patterns, candle figures, and repeated support/resistance. The shared series contains
 *  none of them — it is a random walk, so it has no gaps at all by construction, and its extremes
 *  never land within the 1% of range that support/resistance clusters on. Captured against it,
 *  all four produced the same picture of an empty chart.
 *
 *  So each gets its own series, on the same dates as every other shot. This is not staging: the
 *  indicator still runs on candles and still finds what it finds. A detector photographed against
 *  data holding nothing to detect is not a picture of the detector.
 * ------------------------------------------------------------------------------------------- */

const DATES = PROP_SHOT_DATA.map((candle) => candle.date);

/** Deterministic wobble — an index in, a number in [-1, 1] out. Keeps the built series from
 *  looking like graph paper without pulling a generator into this file. */
function wobble(i: number, scale = 1): number {
  return Math.sin(i * 12.9898) * 43758.5453 % 1 * scale;
}

function candleAt(i: number, open: number, close: number, wickUp: number, wickDown: number) {
  return {
    date: DATES[i],
    open,
    close,
    high: Math.max(open, close) + wickUp,
    low: Math.min(open, close) - wickDown,
    volume: 900_000 + Math.round(Math.abs(wobble(i)) * 600_000),
  };
}

/** Two gaps, built rather than shifted.
 *
 *  A gap counts as filled the moment *any* later candle's range touches the zone again, so an
 *  unfilled one needs every subsequent low to stay clear of it — which shifting a random walk
 *  cannot guarantee, and did not: three shifts produced three gaps all filled within one candle.
 *  This series is written out instead, with the run after each gap shaped to do what the picture
 *  has to show.
 *
 *  The first gap is deliberately left open for fifteen candles and then filled, so its rectangle
 *  is long enough to read. The second is never filled, and its rectangle runs to the edge. */
export const SHOT_GAPS_DATA = (() => {
  const closes: number[] = [];
  const ramp = (from: number, to: number, count: number) => {
    for (let k = 0; k < count; k += 1) {
      const t = k / count;
      // The drift, plus a swing and some noise — a straight line reads as a diagram, not a market.
      closes.push(from + (to - from) * t + Math.sin((closes.length / 9) * Math.PI) * 1.6 + wobble(closes.length, 1.1));
    }
  };
  ramp(150, 154, 40); // 0-39    the run-up
  ramp(164, 167, 16); // 40-55   after the first gap, holding well above it
  ramp(167, 155, 15); // 56-70   the retrace that fills it
  ramp(155, 150, 67); // 71-137  a long drift
  ramp(169, 179, 22); // 138-159 after the second gap, never coming back

  return DATES.map((date, i) => {
    // A gap is a candle that opens away from the last close; every other candle opens on it.
    const gapOpen = i === 40 || i === 138;
    const open = gapOpen ? closes[i] - 0.8 : i === 0 ? closes[0] - 1 : closes[i - 1];
    const close = closes[i];
    const jitter = Math.abs(wobble(i, 0.55));
    // Wicks stay short around a gap and through the run after the open one, so nothing reaches
    // back across it by accident — a single stray wick turns an open gap into a filled one.
    const tight = i === 39 || i === 40 || i >= 138;
    const wick = tight ? 0.3 : 0.5 + jitter;
    return {
      date,
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
      volume: 900_000 + Math.round(jitter * 900_000),
    };
  });
})();

/** A series that keeps turning at the same two prices.
 *
 *  Support/resistance detection clusters swing extremes within 1% of the window's own range and
 *  then drops any cluster touched only once — so it needs levels that genuinely repeat, which a
 *  random walk never produces.
 *
 *  The bodies ramp between a floor and a ceiling held *inside* the two levels; only the turning
 *  candle's wick reaches the level itself. That matters: a level is found by a fractal test, and
 *  if the candle before the turn carried an equally long wick it would win the test and the level
 *  would land a candle early, on a price that is not the level. */
export const SHOT_LEVELS_DATA = (() => {
  const RESISTANCE = 170;
  const SUPPORT = 146;
  const MID = (RESISTANCE + SUPPORT) / 2;
  const PERIOD = 34;
  const FIRST_TOP = 8.5;
  // Bodies swing inside the two levels; only a turning candle's wick reaches one. That gap
  // matters: a level is found by a fractal test, and if its neighbours carried equally long wicks
  // the level would land a candle early, on a price that is not the level.
  const amplitude = ((RESISTANCE - SUPPORT) / 2) * 0.8;
  const body = (i: number) => MID + Math.cos(((i - FIRST_TOP) / PERIOD) * 2 * Math.PI) * amplitude + wobble(i, 1.1);
  const turns = new Map<number, "top" | "bottom">();
  for (let k = 0; FIRST_TOP + (k * PERIOD) / 2 < DATES.length; k += 1) {
    turns.set(Math.round(FIRST_TOP + (k * PERIOD) / 2), k % 2 === 0 ? "top" : "bottom");
  }
  return DATES.map((date, i) => {
    const open = body(i);
    const close = body(i + 1);
    const turn = turns.get(i);
    const jitter = Math.abs(wobble(i, 0.5));
    return {
      date,
      open,
      close,
      high: turn === "top" ? RESISTANCE + Math.abs(wobble(i, 0.12)) : Math.max(open, close) + 0.4 + jitter,
      low: turn === "bottom" ? SUPPORT - Math.abs(wobble(i, 0.12)) : Math.min(open, close) - 0.4 - jitter,
      volume: 950_000 + Math.round(jitter * 900_000),
    };
  });
})();

/** The shared series, with its last twenty candles replaced by a double top: a rise, a peak, a
 *  trough well past the 2% the detector demands, a second peak within 1.5% of the first, then the
 *  breakdown. Pattern recognition looks at a 20-candle window ending on the last candle, so the
 *  figure has to live exactly there. */
/** How far from the right edge the figure ends. A pattern detected on the very last candle
 *  has its badge drawn against the price axis, where it is clipped. */
export const PATTERN_MARGIN = 20;

export const SHOT_PATTERN_DATA = (() => {
  const shape = [152, 155, 159, 163, 167, 168.4, 165, 161, 158, 160, 163, 166, 168.0, 164, 159, 155, 151, 148, 145, 143];
  const out = PROP_SHOT_DATA.map((c) => ({ ...c }));
  const from = out.length - shape.length - PATTERN_MARGIN;
  for (let k = 0; k < shape.length; k += 1) {
    const i = from + k;
    const open = k === 0 ? out[i - 1].close : shape[k - 1];
    out[i] = candleAt(i, open, shape[k], 0.7 + Math.abs(wobble(i, 0.5)), 0.7 + Math.abs(wobble(i, 0.5)));
  }
  return out;
})();

/** The shared series ending on a hammer: five falling candles, then a small body at the top of a
 *  long lower wick. Candle recognition reads only the last candle and the five before it — the
 *  hammer and the hanging man are the same silhouette, and it is that run that tells them apart. */
export const SHOT_CANDLE_DATA = (() => {
  const shape = [164, 160, 156, 153, 150, 148];
  const out = PROP_SHOT_DATA.map((c) => ({ ...c }));
  const from = out.length - shape.length - PATTERN_MARGIN;
  for (let k = 0; k < shape.length - 1; k += 1) {
    const i = from + k;
    const open = k === 0 ? out[i - 1].close : shape[k - 1];
    out[i] = candleAt(i, open, shape[k], 0.6, 0.9);
  }
  // The hammer itself: opens low, closes a little higher, and reaches far below both.
  const last = out.length - 1 - PATTERN_MARGIN;
  out[last] = { date: DATES[last], open: 148.4, close: 149.8, high: 150.3, low: 141.2, volume: 1_800_000 };
  return out;
})();
