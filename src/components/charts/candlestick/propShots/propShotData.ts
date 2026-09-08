import type { Candle } from "../interfaces/Candle.interface";

/** The dataset behind every prop illustration.
 *
 *  It deliberately does *not* reuse `test-data/financeSampleData`'s own `generateCandles`: that
 *  one dates its candles relative to `new Date()`, which is right for a Storybook demo (the chart
 *  always looks current) and wrong here. These captures are committed files compared across runs;
 *  a dataset that slides forward every day would produce a diff on every single capture, and a
 *  drawing or event pinned to an absolute date would drift out of the visible window. So: fixed
 *  seed, fixed end date, fixed length. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNT = 160;
/** The last trading day in the set. Any date works; this one is a Friday, so the series ends on a
 *  full week rather than mid-week. */
const LAST_DAY = new Date(2024, 5, 28);

function buildCandles(): Candle[] {
  const rand = mulberry32(12);
  // Walk backwards from the end date over weekdays only, then fill forward, so the *last* candle
  // lands exactly on LAST_DAY (walking forward from a guessed start would not).
  const days: Date[] = [];
  const cursor = new Date(LAST_DAY);
  while (days.length < COUNT) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.unshift(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  const candles: Candle[] = [];
  let close = 180;
  for (const date of days) {
    const open = close;
    close = Math.max(1, open + (rand() - 0.5) * 5.4);
    candles.push({
      date,
      open: Math.round(open * 100) / 100,
      high: Math.round((Math.max(open, close) + rand() * 1.8) * 100) / 100,
      low: Math.round((Math.min(open, close) - rand() * 1.8) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(50_000 + rand() * 200_000),
    });
  }
  return candles;
}

export const PROP_SHOT_DATA = buildCandles();

/** A candle's date, counted from the end (0 = the last one). Lets a drawing or an event be placed
 *  somewhere legible on screen without anyone having to know what date that works out to. */
export function shotDate(fromEnd: number): Date {
  return PROP_SHOT_DATA[PROP_SHOT_DATA.length - 1 - fromEnd].date;
}

/** A candle's close, same indexing as `shotDate` — so a drawing anchored to a price lands on the
 *  series rather than off the top of the plot. */
export function shotClose(fromEnd: number): number {
  return PROP_SHOT_DATA[PROP_SHOT_DATA.length - 1 - fromEnd].close;
}
