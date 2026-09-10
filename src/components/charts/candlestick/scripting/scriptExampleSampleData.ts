import type { Candle } from "../interfaces/Candle.interface";
import type { FundamentalDataPoint } from "../interfaces/FundamentalDataPoint.interface";

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

/** Four reported years, for the `@report` example.
 *
 *  A report reads what a company published, and the documentation has no data source of its own —
 *  without these, `company.value("capex")` and the rest are null everywhere and the example prints
 *  a document of dashes, which teaches nothing about what a report can say. Made up, obviously, and
 *  shaped like a business that is growing while keeping its margins: that is the case the example's
 *  own commentary discusses.
 *
 *  Dated off `SCRIPT_EXAMPLE_DATA`'s own span so the forward-fill lands inside the demo history
 *  rather than before it — a report positioned at the last bar has to find something behind it. */
export const SCRIPT_EXAMPLE_FUNDAMENTALS: FundamentalDataPoint[] = [
  { revenue: 90e9, income: 18e9, capex: 7.0e9, cash: 26e9, tax: 4.1e9, rate: 18.5, roic: 21.4, margin: 20.0 },
  { revenue: 105e9, income: 23e9, capex: 8.2e9, cash: 31e9, tax: 5.2e9, rate: 18.4, roic: 23.8, margin: 21.9 },
  { revenue: 121e9, income: 27e9, capex: 9.1e9, cash: 36e9, tax: 6.0e9, rate: 18.2, roic: 25.1, margin: 22.3 },
  { revenue: 138e9, income: 32e9, capex: 10.4e9, cash: 42e9, tax: 7.3e9, rate: 18.6, roic: 27.3, margin: 23.2 },
].map((year, i, all) => ({
  // Evenly spread across the demo history, the most recent landing well before its last bar.
  date: SCRIPT_EXAMPLE_DATA[Math.floor((SCRIPT_EXAMPLE_DATA.length - 1) * ((i + 0.5) / all.length))].date,
  totalRevenue: year.revenue,
  netIncome: year.income,
  netMargin: year.margin,
  grossMargin: year.margin + 24,
  capex: year.capex,
  operatingCashFlow: year.cash,
  taxExpense: year.tax,
  effectiveTaxRate: year.rate,
  returnOnInvestedCapital: year.roic,
  returnOnEquity: year.roic + 6,
  totalEquity: year.income * 5,
  totalDebt: year.revenue * 0.35,
  eps: year.income / 15e9,
  sharesOutstanding: 15e9,
}));
