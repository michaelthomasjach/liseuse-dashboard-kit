import type { Candle } from "../interfaces/Candle.interface";

/** Same generator shape as `scriptTutorialSampleData.ts` (see its own doc on why this is a small
 *  local duplicate rather than a shared import from `src/test-data/`) — a *separate* dataset
 *  because the multi-timeframe tutorial steps (`scriptTutorialSteps.ts`, steps "resample" onward)
 *  need real 5-minute-interval bars for `market.resample("1d"/"4h"/...)` to have anything
 *  meaningful to aggregate; the original daily-spaced tutorial dataset has only one candle per
 *  session, nothing finer to group. */
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// A 6.5-hour session (9:30–16:00, a plausible equities session) sampled every 5 minutes.
const SESSION_START_HOUR = 9;
const SESSION_START_MINUTE = 30;
const BARS_PER_SESSION = 78; // (16:00 - 9:30) / 5min

function generateIntradayCandles(sessionsCount: number, start: number, seed: number): Candle[] {
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  let close = start;
  let day = new Date();
  day.setDate(day.getDate() - Math.ceil(sessionsCount * 1.6));
  day.setHours(0, 0, 0, 0);

  let sessionsGenerated = 0;
  while (sessionsGenerated < sessionsCount) {
    day = new Date(day);
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends, like a real market

    const sessionStart = new Date(day);
    sessionStart.setHours(SESSION_START_HOUR, SESSION_START_MINUTE, 0, 0);

    for (let bar = 0; bar < BARS_PER_SESSION; bar++) {
      const time = new Date(sessionStart.getTime() + bar * 5 * 60_000);
      const open = close;
      const change = (rand() - 0.5) * (start * 0.006);
      close = Math.max(1, open + change);
      const high = Math.max(open, close) + rand() * (start * 0.002);
      const low = Math.min(open, close) - rand() * (start * 0.002);
      const volume = Math.round(2_000 + rand() * 8_000);
      candles.push({ date: time, open: round2(open), high: round2(high), low: round2(low), close: round2(close), volume });
    }
    sessionsGenerated++;
  }
  return candles;
}

/** ~30 trading sessions of 5-minute bars (~2340 candles) — the base timeframe for the tutorial's
 *  own multi-timeframe RSI steps; `market.resample("15m"/"1h"/"4h"/"1d")` aggregates up from this.
 *  30 sessions specifically (not fewer) so the *daily* resample alone still has enough history for
 *  ta.rsi(values, 14)'s own warm-up (it needs 15+ closes) — 8 sessions left the "1J" row's RSI
 *  permanently null, the one timeframe with only one candle per session to draw from. */
export const SCRIPT_TUTORIAL_INTRADAY_DATA: Candle[] = generateIntradayCandles(30, 180, 29);
