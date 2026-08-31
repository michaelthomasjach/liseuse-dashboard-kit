import type { Candle } from "../interfaces/Candle.interface";

// Same generator as scriptTutorialSampleData.ts's own mulberry32/generateTutorialCandles —
// duplicated rather than imported for the exact same reason that file's own doc gives (this is a
// real, always-bundled documentation component, not a test-data dependency worth pulling in).
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

function generateExampleCandles(count: number, start: number, seed: number): Candle[] {
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  let close = start;
  let day = new Date();
  day.setDate(day.getDate() - count * 1.4);

  while (candles.length < count) {
    day = new Date(day);
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    const open = close;
    const change = (rand() - 0.5) * (start * 0.03);
    close = Math.max(1, open + change);
    const high = Math.max(open, close) + rand() * (start * 0.01);
    const low = Math.min(open, close) - rand() * (start * 0.01);
    const volume = Math.round(50_000 + rand() * 200_000);

    candles.push({
      date: new Date(day),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });
  }
  return candles;
}

/** Fixed sample OHLCV for the "Exemples" section's own live runners (`ScriptExampleRunner.tsx`) —
 *  deliberately bigger than the tutorial's own 140-candle `SCRIPT_TUTORIAL_DATA`: the Golden/Death
 *  Cross example needs a 200-period SMA to actually produce a value at all (`math.sma` returns
 *  `null` below its own period's worth of history), and a real crossover to be visible needs a
 *  good deal more than that on top — 260 gives ~60 candles of room once SMA 200 first turns
 *  non-null. Every other example's own periods (20-60) fit comfortably within this too. */
export const SCRIPT_EXAMPLE_DATA: Candle[] = generateExampleCandles(260, 180, 42);
