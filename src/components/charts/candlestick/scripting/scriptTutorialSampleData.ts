import type { Candle } from "../interfaces/Candle.interface";

/** Deterministic pseudo-random generator, same algorithm as `src/test-data/financeSampleData.ts`'s
 *  own `mulberry32` — duplicated in miniature here on purpose rather than imported: that file is a
 *  story/debug-harness helper, never otherwise reached from a component this library actually ships,
 *  and importing it from here (a real, always-bundled documentation component) would quietly turn a
 *  "test data" folder into a dependency of the published package. */
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

function generateTutorialCandles(count: number, start: number, seed: number): Candle[] {
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

/** Fixed sample OHLCV for the interactive tutorial (`ScriptInteractiveTutorial.tsx`) — deterministic
 *  (same seed every load) and computed once at module evaluation, not regenerated per render/run.
 *  140 candles gives comfortable warm-up room for the tutorial's own SMA 20 without needing more. */
export const SCRIPT_TUTORIAL_DATA: Candle[] = generateTutorialCandles(140, 180, 13);
