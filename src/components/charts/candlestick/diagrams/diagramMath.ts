/** The geometry and arithmetic behind the indicator diagrams, kept apart from the components that
 *  draw with them — a module that exports both is a module Fast Refresh has to reload wholesale.
 *
 *  The arithmetic here is the real thing, not an approximation of it. A diagram that claims an EMA
 *  turns before an SMA states a series of closes and asks for both curves; it cannot accidentally
 *  illustrate something the maths does not do. */

/** A vertical slice of the canvas, in SVG y-coordinates. Series are written on an abstract 0–100
 *  price scale and mapped into one of these, so the same series can back a full-height diagram and
 *  the price half of a split one without being rewritten. */
export interface DiagramBand {
  top: number;
  bottom: number;
}

export const FULL_BAND: DiagramBand = { top: 22, bottom: 158 };
export const UPPER_BAND: DiagramBand = { top: 14, bottom: 92 };
export const LOWER_BAND: DiagramBand = { top: 112, bottom: 176 };

/** 0–100 price → SVG y. Inverted, because SVG counts downwards and prices do not. */
export function bandY(value: number, band: DiagramBand): number {
  return band.bottom - (value / 100) * (band.bottom - band.top);
}

export const CANDLE_X0 = 22;
export const CANDLE_STEP = 18;
export const CANDLE_WIDTH = 10;

/** x for the i-th point of any series drawn on this canvas — candles, lines and panel plots all
 *  use it, which is what keeps a panel line beneath a candle actually aligned with it. */
export function seriesX(i: number): number {
  return CANDLE_X0 + i * CANDLE_STEP;
}

/** Simple moving average of a 0–100 series, `null` until the window fills. */
export function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let total = 0;
    for (let k = i - period + 1; k <= i; k += 1) total += values[k];
    return total / period;
  });
}

/** Exponential moving average, seeded on the simple average of the first window — the same warm-up
 *  the real indicator uses, so the diagram's EMA leads its SMA for the real reason. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (values.length < period) return out;
  let acc = 0;
  for (let i = 0; i < period; i += 1) acc += values[i];
  let prev = acc / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Rolling standard deviation, for the Bollinger diagram's own bands. */
export function stddev(values: number[], period: number): (number | null)[] {
  const means = sma(values, period);
  return values.map((_, i) => {
    const mean = means[i];
    if (mean === null) return null;
    let total = 0;
    for (let k = i - period + 1; k <= i; k += 1) total += (values[k] - mean) ** 2;
    return Math.sqrt(total / period);
  });
}

/** The two series most diagrams draw on: one that trends and turns, one that goes nowhere. Having
 *  them shared is what lets two diagrams be compared — the EMA and SMA pictures differ only in the
 *  average drawn on them, which is the entire point being made. */
export const SWING_CLOSES = [
  30, 34, 31, 38, 43, 39, 47, 53, 49, 57, 63, 60, 67, 73, 79, 75, 81, 77, 69, 62, 55, 48,
];

export const RANGE_CLOSES = [
  50, 60, 44, 57, 46, 62, 48, 55, 42, 59, 50, 63, 45, 57, 43, 61, 49, 54, 46, 60, 47, 53,
];

