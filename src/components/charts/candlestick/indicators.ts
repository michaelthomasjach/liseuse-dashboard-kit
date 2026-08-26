import { VWAP, BollingerBands, RSI, MACD, ATR, PSAR, ADX } from "technicalindicators";
import type { Candle } from "./interfaces/Candle.interface";
import type { FundamentalDataPoint } from "./interfaces/FundamentalDataPoint.interface";
import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";
import type { IndicatorBand } from "./interfaces/IndicatorBand.interface";
import type { IndicatorMACD } from "./interfaces/IndicatorMACD.interface";
import type { IndicatorZigZagPoint } from "./interfaces/IndicatorZigZagPoint.interface";
import type { IndicatorSupertrendPoint } from "./interfaces/IndicatorSupertrendPoint.interface";
import type { IndicatorIchimokuPoint } from "./interfaces/IndicatorIchimokuPoint.interface";
import type { IndicatorGapPoint } from "./interfaces/IndicatorGapPoint.interface";
import type { IndicatorPivotPointsPoint } from "./interfaces/IndicatorPivotPointsPoint.interface";
import type { IndicatorADXPoint } from "./interfaces/IndicatorADXPoint.interface";
import type { IndicatorChandelierPoint } from "./interfaces/IndicatorChandelierPoint.interface";
import type { IndicatorSRLevel } from "./interfaces/IndicatorSRLevel.interface";
import type { IndicatorValue } from "./interfaces/IndicatorValue.interface";
import type { Indicator } from "./interfaces/Indicator.interface";
import type { CustomIndicatorDef } from "./interfaces/CustomIndicatorDef.interface";
import type { OverlayDataPoint } from "./interfaces/TrendLineDrawing.interface";
import { isFundamentalKind } from "./indicatorCatalog";
import { computePatternRecognitionValues } from "./patternRecognition";
import { computeCandleRecognitionValues } from "./candleRecognition";

/** Forward-fills a sparse, date-keyed series (quarterly reports, any other "one number per
 *  period" data) onto every candle — the most recent point on or before that candle's own date, a
 *  step function, `null` before the first point exists yet. Shared by `computeFundamentalValues`
 *  (the built-in eight) and `computeCustomIndicatorValues` (a caller-supplied `CustomIndicatorDef`
 *  — see its own doc) so both read exactly the same way despite one being baked into the library
 *  and the other entirely external to it. `points` doesn't need to be pre-sorted. */
function forwardFillSeries(data: Candle[], points: { date: Date; value: number }[]): (number | null)[] {
  if (points.length === 0) return data.map(() => null);
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  let cursor = 0;
  return data.map((d) => {
    while (cursor + 1 < sorted.length && sorted[cursor + 1].date.getTime() <= d.date.getTime()) cursor++;
    const point = sorted[cursor];
    return point.date.getTime() > d.date.getTime() ? null : point.value;
  });
}

/** A fundamental's own value at each candle — see `forwardFillSeries`. */
export function computeFundamentalValues(data: Candle[], fundamentals: FundamentalDataPoint[] | undefined, kind: IndicatorKind): (number | null)[] {
  if (!fundamentals || fundamentals.length === 0) return data.map(() => null);
  const points = fundamentals
    .map((f) => ({ date: f.date, value: f[kind as keyof Omit<FundamentalDataPoint, "date">] }))
    .filter((p): p is { date: Date; value: number } => typeof p.value === "number");
  return forwardFillSeries(data, points);
}

/** A `CustomIndicatorDef`'s own series, forward-filled the same way — see `forwardFillSeries`. */
export function computeCustomIndicatorValues(data: Candle[], def: CustomIndicatorDef): (number | null)[] {
  return forwardFillSeries(data, def.data);
}

/** Rolling Pearson correlation coefficient between the main series' own close and a second
 *  symbol's own close, over `period`-sized windows — +1 the two move together, -1 they move
 *  opposite, 0 no linear relationship. The second symbol's own (sparser, possibly
 *  differently-dated) series is forward-filled onto `data`'s own index space first, same as every
 *  other date-keyed series above; a window with any still-unfilled (`null`, before that symbol's
 *  own history starts) point, or with zero variance in either series, has no defined coefficient. */
export function computeCorrelationValues(data: Candle[], correlationData: OverlayDataPoint[] | undefined, period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (!correlationData || correlationData.length === 0) return result;
  const aligned = forwardFillSeries(data, correlationData.map((p) => ({ date: p.date, value: p.value })));
  for (let i = period - 1; i < data.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      const y = aligned[j];
      if (y === null) {
        ok = false;
        break;
      }
      sumX += data[j].close;
      sumY += y;
    }
    if (!ok) continue;
    const meanX = sumX / period;
    const meanY = sumY / period;
    let cov = 0;
    let varX = 0;
    let varY = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const dx = data[j].close - meanX;
      const dy = (aligned[j] as number) - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    }
    if (varX === 0 || varY === 0) continue;
    result[i] = Math.max(-1, Math.min(1, cov / Math.sqrt(varX * varY)));
  }
  return result;
}

// Each returns one value per candle (null during the warm-up period before enough history has
// accumulated), so the result stays index-aligned with `data` — the draw effect windows it down
// to the visible range the exact same way `visible` windows `data` itself.
export function computeSMAValues(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

export function computeEMAValues(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let ema = sum / period;
  result[period - 1] = ema;
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function computeWMAValues(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < data.length; i++) {
    let weighted = 0;
    for (let j = 0; j < period; j++) weighted += data[i - period + 1 + j].close * (j + 1);
    result[i] = weighted / denom;
  }
  return result;
}

// VWAP (from the `technicalindicators` npm package) is cumulative rather than windowed, so it
// returns one value per input bar with no warm-up gap — still routed through the same
// null-padding shape as the hand-rolled indicators above purely so every `IndicatorKind` shares
// one result type.
export function computeVWAPValues(data: Candle[]): (number | null)[] {
  if (data.length === 0) return [];
  const values = VWAP.calculate({
    high: data.map((d) => d.high),
    low: data.map((d) => d.low),
    close: data.map((d) => d.close),
    volume: data.map((d) => d.volume ?? 0),
  });
  const offset = data.length - values.length;
  const result: (number | null)[] = new Array(offset).fill(null);
  return result.concat(values);
}

// `technicalindicators`'s calculate() trims the warm-up period off the front of its result
// instead of null-padding it (e.g. 10 closes at period 5 comes back as 6 values, not 10) — every
// indicator here left-pads by that same trimmed amount so the result stays index-aligned with
// `data`, same convention as the hand-rolled SMA/EMA/WMA above.
export function computeBollingerValues(data: Candle[], period: number, stdDev: number): (IndicatorBand | null)[] {
  if (data.length === 0) return [];
  const values = BollingerBands.calculate({ period, stdDev, values: data.map((d) => d.close) });
  const offset = data.length - values.length;
  const result: (IndicatorBand | null)[] = new Array(offset).fill(null);
  return result.concat(values.map((v) => ({ upper: v.upper, middle: v.middle, lower: v.lower })));
}

export function computeRSIValues(data: Candle[], period: number): (number | null)[] {
  if (data.length === 0) return [];
  const values = RSI.calculate({ period, values: data.map((d) => d.close) });
  const offset = data.length - values.length;
  return new Array(offset).fill(null).concat(values);
}

// Not in `technicalindicators` (no Choppiness Index there), so hand-rolled from its plain
// definition: 100 * log10(sum of true range over `period`) / (highest high − lowest low over the
// same window), scaled by log10(period) — same O(n·period) shape as the hand-rolled WMA above,
// there's no rolling-window shortcut without also tracking a separate max/min structure.
export function computeCHOPValues(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length === 0) return result;
  const trueRanges = data.map((d, i) => {
    const prevClose = i > 0 ? data[i - 1].close : d.close;
    return Math.max(d.high - d.low, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose));
  });
  for (let i = period - 1; i < data.length; i++) {
    let trSum = 0;
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      trSum += trueRanges[j];
      highest = Math.max(highest, data[j].high);
      lowest = Math.min(lowest, data[j].low);
    }
    const range = highest - lowest;
    result[i] = range > 0 ? (100 * Math.log10(trSum / range)) / Math.log10(period) : null;
  }
  return result;
}

export function computeMACDValues(data: Candle[], fastPeriod: number, slowPeriod: number, signalPeriod: number): (IndicatorMACD | null)[] {
  if (data.length === 0) return [];
  const values = MACD.calculate({
    values: data.map((d) => d.close),
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const offset = data.length - values.length;
  const result: (IndicatorMACD | null)[] = new Array(offset).fill(null);
  return result.concat(values.map((v) => ({ macd: v.MACD ?? 0, signal: v.signal ?? null, histogram: v.histogram ?? null })));
}

// Percentage-deviation ZigZag, computed off closes (not high/low wicks — a simpler, still
// standard variant that avoids the two-tracker bookkeeping a wick-based version would need, and
// reads cleanly against a line chart of closes too). Confirms a pivot only once price has
// reversed by at least `deviationPercent` from the current provisional extreme — the most recent,
// still-unconfirmed leg is left off entirely rather than drawn as a repainting last segment, so
// the line only ever reaches the last *confirmed* pivot.
export function computeZigZagValues(data: Candle[], deviationPercent: number): (IndicatorZigZagPoint | null)[] {
  const n = data.length;
  const result: (IndicatorZigZagPoint | null)[] = new Array(n).fill(null);
  if (n < 2) return result;
  const threshold = Math.max(0.01, deviationPercent) / 100;

  let lastHighPrice: number | null = null;
  let lastLowPrice: number | null = null;
  function labelFor(kind: "high" | "low", price: number): IndicatorZigZagPoint["label"] {
    const prev = kind === "high" ? lastHighPrice : lastLowPrice;
    if (prev === null) return null;
    if (kind === "high") return price > prev ? "HH" : "LH";
    return price > prev ? "HL" : "LL";
  }
  function confirm(index: number, price: number, kind: "high" | "low") {
    result[index] = { price, kind, label: labelFor(kind, price) };
    if (kind === "high") lastHighPrice = price;
    else lastLowPrice = price;
  }

  // Phase 1: direction undetermined yet — track the running max and min simultaneously from the
  // very start. Whichever one first reverses by `threshold` from the other becomes the first
  // confirmed pivot (reversing *off* a high confirms that high as a pivot, and vice versa); the
  // index comparison guards against the rare case where both thresholds are crossed on the same
  // bar, preferring whichever extreme is chronologically the more recent of the two.
  let runningMaxPrice = data[0].close;
  let runningMaxIndex = 0;
  let runningMinPrice = data[0].close;
  let runningMinIndex = 0;
  let firstPivotKind: "high" | "low" | null = null;
  let i = 1;
  for (; i < n; i++) {
    const price = data[i].close;
    if (price > runningMaxPrice) {
      runningMaxPrice = price;
      runningMaxIndex = i;
    }
    if (price < runningMinPrice) {
      runningMinPrice = price;
      runningMinIndex = i;
    }
    if ((runningMaxPrice - price) / runningMaxPrice >= threshold && runningMaxIndex > runningMinIndex) {
      confirm(runningMaxIndex, runningMaxPrice, "high");
      firstPivotKind = "high";
      break;
    }
    if ((price - runningMinPrice) / runningMinPrice >= threshold && runningMinIndex > runningMaxIndex) {
      confirm(runningMinIndex, runningMinPrice, "low");
      firstPivotKind = "low";
      break;
    }
  }
  if (firstPivotKind === null) return result; // Never even reversed enough to confirm a first pivot.

  // Phase 2: alternate, hunting a pivot of the opposite kind each time, until the data ends. The
  // new pending leg starts from the *current* bar `i` (where the reversal was detected), not from
  // runningMaxIndex/runningMinIndex (where the just-confirmed pivot actually sits) — those are
  // two different bars whenever the reversal wasn't confirmed on the very next bar after the peak.
  let pendingKind: "high" | "low" = firstPivotKind === "high" ? "low" : "high";
  let pendingIndex = i;
  let pendingPrice = data[i].close;
  for (i = i + 1; i < n; i++) {
    const price = data[i].close;
    if (pendingKind === "low") {
      if (price < pendingPrice) {
        pendingPrice = price;
        pendingIndex = i;
      } else if ((price - pendingPrice) / pendingPrice >= threshold) {
        confirm(pendingIndex, pendingPrice, "low");
        pendingKind = "high";
        pendingPrice = price;
        pendingIndex = i;
      }
    } else {
      if (price > pendingPrice) {
        pendingPrice = price;
        pendingIndex = i;
      } else if ((pendingPrice - price) / pendingPrice >= threshold) {
        confirm(pendingIndex, pendingPrice, "high");
        pendingKind = "low";
        pendingPrice = price;
        pendingIndex = i;
      }
    }
  }
  return result;
}

export function computeATRValues(data: Candle[], period: number): (number | null)[] {
  if (data.length === 0) return [];
  const values = ATR.calculate({ high: data.map((d) => d.high), low: data.map((d) => d.low), close: data.map((d) => d.close), period });
  const offset = data.length - values.length;
  return new Array(offset).fill(null).concat(values);
}

// Wilder's own DMI/ADX, from `technicalindicators` — its own `pdi`/`mdi` renamed to `plusDI`/
// `minusDI` (see IndicatorADXPoint's own doc) purely for readability at every call site that
// reads them back, same warm-up-offset convention as every other `technicalindicators`-backed
// indicator above.
export function computeADXValues(data: Candle[], period: number): (IndicatorADXPoint | null)[] {
  if (data.length === 0) return [];
  const values = ADX.calculate({ high: data.map((d) => d.high), low: data.map((d) => d.low), close: data.map((d) => d.close), period });
  const offset = data.length - values.length;
  const result: (IndicatorADXPoint | null)[] = new Array(offset).fill(null);
  return result.concat(values.map((v) => ({ adx: v.adx, plusDI: v.pdi, minusDI: v.mdi })));
}

// Standard ATR-band trend flip: a band hugs price on whichever side it's currently trending
// (finalLower while "up", finalUpper while "down"), only ever tightening toward price — never
// loosening back away from it — until price actually crosses to the other side, at which point
// the trend flips and the *other* band starts hugging instead. `value` (what's actually plotted)
// is always whichever band is currently active for the trend that bar settled into.
export function computeSupertrendValues(data: Candle[], period: number, multiplier: number): (IndicatorSupertrendPoint | null)[] {
  const n = data.length;
  const result: (IndicatorSupertrendPoint | null)[] = new Array(n).fill(null);
  if (n === 0) return result;
  const atrValues = computeATRValues(data, period);
  let prevFinalUpper: number | null = null;
  let prevFinalLower: number | null = null;
  let prevTrend: "up" | "down" = "up";
  for (let i = 0; i < n; i++) {
    const atr = atrValues[i];
    if (atr === null) continue;
    const hl2 = (data[i].high + data[i].low) / 2;
    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;
    const prevClose = i > 0 ? data[i - 1].close : data[i].close;
    const finalUpper: number = prevFinalUpper === null || basicUpper < prevFinalUpper || prevClose > prevFinalUpper ? basicUpper : prevFinalUpper;
    const finalLower: number = prevFinalLower === null || basicLower > prevFinalLower || prevClose < prevFinalLower ? basicLower : prevFinalLower;
    let trend: "up" | "down";
    if (prevFinalUpper === null) trend = data[i].close >= finalLower ? "up" : "down";
    else if (prevTrend === "up" && data[i].close < finalLower) trend = "down";
    else if (prevTrend === "down" && data[i].close > finalUpper) trend = "up";
    else trend = prevTrend;
    result[i] = { value: trend === "up" ? finalLower : finalUpper, trend };
    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevTrend = trend;
  }
  return result;
}

// Ported from the "Chandelier Exit" Pine Script (Alex Orekhov, GPL-3.0) — two ATR-offset trailing
// stops that each only ever *ratchet toward price* (the long stop up, the short stop down) for as
// long as the *previous* bar's own close stayed on the right side of the *previous* bar's own
// final stop; the instant it doesn't, that stop resets to its own fresh raw value instead of
// continuing to ratchet from a now-invalidated level. `dir` (which stop is "active") flips to long
// once price closes above the short stop, to short once it closes below the long stop, and
// otherwise carries over unchanged — this is a `var` in Pine, i.e. state that persists across
// bars, not a value recomputed fresh each time the way every other indicator here is.
export function computeChandelierExitValues(
  data: Candle[],
  length: number,
  multiplier: number,
  useClose: boolean
): (IndicatorChandelierPoint | null)[] {
  const n = data.length;
  const result: (IndicatorChandelierPoint | null)[] = new Array(n).fill(null);
  if (n === 0) return result;

  const atrValues = computeATRValues(data, length);
  let longStopPrev: number | null = null;
  let shortStopPrev: number | null = null;
  let dir: 1 | -1 = 1;

  for (let i = 0; i < n; i++) {
    const atrRaw = atrValues[i];
    if (atrRaw === null) continue;
    const atr = multiplier * atrRaw;

    // ta.highest/ta.lowest's own trailing window — same rolling-window-by-plain-loop shape
    // computeCHOPValues' own highest/lowest already uses, clamped to however many bars actually
    // exist near the very start rather than requiring a separate `length`-bar warm-up of its own
    // (Pine's ta.highest returns a real value off fewer than `length` bars too, it just never
    // needs to since ta.atr's own warm-up is normally longer anyway).
    const windowStart = Math.max(0, i - length + 1);
    let highestClose = -Infinity;
    let highestHigh = -Infinity;
    let lowestClose = Infinity;
    let lowestLow = Infinity;
    for (let j = windowStart; j <= i; j++) {
      highestClose = Math.max(highestClose, data[j].close);
      highestHigh = Math.max(highestHigh, data[j].high);
      lowestClose = Math.min(lowestClose, data[j].close);
      lowestLow = Math.min(lowestLow, data[j].low);
    }

    const rawLongStop: number = (useClose ? highestClose : highestHigh) - atr;
    const rawShortStop: number = (useClose ? lowestClose : lowestLow) + atr;
    // nz(longStop[1], longStop): the previous bar's own *final* stop, defaulting to this bar's
    // own raw value the first time either stop is ever computed.
    const effectiveLongStopPrev: number = longStopPrev ?? rawLongStop;
    const effectiveShortStopPrev: number = shortStopPrev ?? rawShortStop;

    // close[1] > longStopPrev / close[1] < shortStopPrev — on the very first bar there is no
    // close[1] at all (Pine reads na, which every comparison against it treats as false), so
    // neither stop ratchets yet; every bar after that compares the *previous* bar's own close.
    const longStop: number = i > 0 && data[i - 1].close > effectiveLongStopPrev ? Math.max(rawLongStop, effectiveLongStopPrev) : rawLongStop;
    const shortStop: number = i > 0 && data[i - 1].close < effectiveShortStopPrev ? Math.min(rawShortStop, effectiveShortStopPrev) : rawShortStop;

    const prevDir = dir;
    const newDir: 1 | -1 = data[i].close > effectiveShortStopPrev ? 1 : data[i].close < effectiveLongStopPrev ? -1 : dir;
    result[i] = { longStop, shortStop, dir: newDir, buySignal: newDir === 1 && prevDir === -1, sellSignal: newDir === -1 && prevDir === 1 };

    dir = newDir;
    longStopPrev = longStop;
    shortStopPrev = shortStop;
  }
  return result;
}

export function computeParabolicSARValues(data: Candle[], step: number, max: number): (number | null)[] {
  if (data.length < 2) return new Array(data.length).fill(null);
  const values = PSAR.calculate({ high: data.map((d) => d.high), low: data.map((d) => d.low), step, max });
  const offset = data.length - values.length;
  return new Array(offset).fill(null).concat(values);
}

// A gap between candle i-1 and i, stored at i (see IndicatorGapPoint's own doc) once the jump is
// at least minPercent of the earlier candle's own reference price — filterable the same way a
// deviation threshold gates a ZigZag pivot, so a noisy intraday series doesn't flag every
// fractional-cent overlap as a "gap". Once found, scans forward for the first later candle whose
// own high/low range re-enters [bottom, top] to mark it filled and pick where the shaded
// rectangle stops — same "look forward, once, at compute time" shape ZigZag/Gaps' own detection
// otherwise wouldn't need, but a gap rectangle's very reason for existing is showing *whether and
// when* price came back to fill it, so unlike every other indicator here this one's rendering
// genuinely depends on bars after the point it's anchored to, not just before.
export function computeGapValues(data: Candle[], minPercent: number): (IndicatorGapPoint | null)[] {
  const n = data.length;
  const result: (IndicatorGapPoint | null)[] = new Array(n).fill(null);
  const threshold = Math.max(0, minPercent) / 100;
  for (let i = 1; i < n; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    let direction: "up" | "down" | null = null;
    let top = 0;
    let bottom = 0;
    if (curr.low > prev.high && (curr.low - prev.high) / prev.high >= threshold) {
      direction = "up";
      top = curr.low;
      bottom = prev.high;
    } else if (curr.high < prev.low && (prev.low - curr.high) / prev.low >= threshold) {
      direction = "down";
      top = prev.low;
      bottom = curr.high;
    }
    if (!direction) continue;
    let endIndex = n - 1;
    let filled = false;
    for (let j = i + 1; j < n; j++) {
      if (data[j].low <= top && data[j].high >= bottom) {
        endIndex = j;
        filled = true;
        break;
      }
    }
    result[i] = { top, bottom, direction, endIndex, filled };
  }
  return result;
}

// Which reference period a candle belongs to, as a plain grouping key (not itself a date) — a
// Monday-anchored week (not a true ISO week number, which nobody reading this indicator would
// actually recognize a plotted level by) for "weekly", calendar year+month for "monthly", the
// calendar day itself for "daily".
function pivotPeriodKey(date: Date, period: "daily" | "weekly" | "monthly"): string {
  if (period === "monthly") return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
  if (period === "weekly") {
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

// Each pivot type's own formula, applied to one reference period's own high/low/close — every
// type produces the same 7-level shape (a pivot plus 3 resistance/support levels on each side) so
// the rest of this indicator (grouping, rendering, settings) never needs to know which formula
// actually produced them. Classic and Woodie share every level past their own differently-weighted
// pivot; Fibonacci scales the period's own high-low range by the standard retracement ratios
// instead of Classic's fixed multiples; Camarilla anchors every level off the close (not the
// pivot) by a fixed set of range fractions, the one type here whose R/S levels don't reduce to a
// simple function of `pp` alone.
function pivotLevelsFor(
  type: "classic" | "fibonacci" | "woodie" | "camarilla",
  high: number,
  low: number,
  close: number
): Omit<IndicatorPivotPointsPoint, "periodStart"> {
  const range = high - low;
  switch (type) {
    case "fibonacci": {
      const pp = (high + low + close) / 3;
      return { pp, r1: pp + 0.382 * range, r2: pp + 0.618 * range, r3: pp + range, s1: pp - 0.382 * range, s2: pp - 0.618 * range, s3: pp - range };
    }
    case "woodie": {
      const pp = (high + low + 2 * close) / 4;
      return { pp, r1: 2 * pp - low, r2: pp + range, r3: high + 2 * (pp - low), s1: 2 * pp - high, s2: pp - range, s3: low - 2 * (high - pp) };
    }
    case "camarilla": {
      const pp = (high + low + close) / 3;
      return {
        pp,
        r1: close + (range * 1.1) / 12,
        r2: close + (range * 1.1) / 6,
        r3: close + (range * 1.1) / 4,
        s1: close - (range * 1.1) / 12,
        s2: close - (range * 1.1) / 6,
        s3: close - (range * 1.1) / 4,
      };
    }
    case "classic":
    default: {
      const pp = (high + low + close) / 3;
      return { pp, r1: 2 * pp - low, r2: pp + range, r3: high + 2 * (pp - low), s1: 2 * pp - high, s2: pp - range, s3: low - 2 * (high - pp) };
    }
  }
}

// One flat set of levels per reference period (see `pivotPeriodKey`), derived from the *previous*
// period's own high/low/close and held constant across every candle of the current one — the
// "staircase" every trading platform draws for this indicator (see IndicatorPivotPointsPoint's own
// doc). The very first period has no previous one to derive levels from, so its own candles stay
// null, same "nothing to show until there's enough history" reasoning a moving average's own
// warm-up period already follows.
export function computePivotPointsValues(
  data: Candle[],
  pivotType: "classic" | "fibonacci" | "woodie" | "camarilla",
  pivotPeriod: "daily" | "weekly" | "monthly"
): (IndicatorPivotPointsPoint | null)[] {
  const n = data.length;
  const result: (IndicatorPivotPointsPoint | null)[] = new Array(n).fill(null);
  if (n === 0) return result;

  interface PeriodSummary {
    firstIndex: number;
    lastIndex: number;
    high: number;
    low: number;
    close: number;
  }
  const periods: PeriodSummary[] = [];
  let currentKey: string | null = null;
  for (let i = 0; i < n; i++) {
    const key = pivotPeriodKey(data[i].date, pivotPeriod);
    if (key !== currentKey) {
      periods.push({ firstIndex: i, lastIndex: i, high: data[i].high, low: data[i].low, close: data[i].close });
      currentKey = key;
    } else {
      const current = periods[periods.length - 1];
      current.lastIndex = i;
      current.high = Math.max(current.high, data[i].high);
      current.low = Math.min(current.low, data[i].low);
      current.close = data[i].close;
    }
  }

  for (let k = 1; k < periods.length; k++) {
    const previous = periods[k - 1];
    const current = periods[k];
    const levels = pivotLevelsFor(pivotType, previous.high, previous.low, previous.close);
    for (let i = current.firstIndex; i <= current.lastIndex; i++) {
      result[i] = { periodStart: current.firstIndex, ...levels };
    }
  }
  return result;
}

// Auto support/resistance: fractal swing highs/lows within the lookback window (a candle whose
// own high/low is the most extreme among `fractalSpan` neighbors on each side — the same "local
// extremum" idea `computeZigZagValues` confirms by %-deviation instead, simpler here since level
// *detection* only cares about density of touches, not a clean directional zigzag line), then
// clustered by price (sorted, walked once, a new cluster wherever the gap to the previous swing
// exceeds `tolerance`) so repeated touches near the same price collapse into one level instead of
// one per candle. Ranked by touch count and capped at `maxLevels` — a level nobody's ever
// re-touched (`touchCount < 2`) isn't a level, just a single swing.
export function computeSupportResistanceValues(data: Candle[], period: number, maxLevels: number): (IndicatorSRLevel[] | null)[] {
  const n = data.length;
  const result: (IndicatorSRLevel[] | null)[] = new Array(n).fill(null);
  if (n === 0) return result;

  const lookback = Math.min(n, Math.max(10, Math.round(period)));
  const start = n - lookback;
  const fractalSpan = 3;

  const swings: { price: number; index: number }[] = [];
  for (let i = start; i < n; i++) {
    const lo = Math.max(start, i - fractalSpan);
    const hi = Math.min(n - 1, i + fractalSpan);
    if (hi - lo < fractalSpan * 2) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = lo; j <= hi; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }
    if (isHigh) swings.push({ price: data[i].high, index: i });
    if (isLow) swings.push({ price: data[i].low, index: i });
  }
  if (swings.length === 0) return result;

  let rangeLo = Infinity;
  let rangeHi = -Infinity;
  for (let i = start; i < n; i++) {
    rangeLo = Math.min(rangeLo, data[i].low);
    rangeHi = Math.max(rangeHi, data[i].high);
  }
  const tolerance = (rangeHi - rangeLo) * 0.01;

  swings.sort((a, b) => a.price - b.price);
  const clusters: { prices: number[]; indices: number[] }[] = [];
  for (const s of swings) {
    const current = clusters[clusters.length - 1];
    if (current && s.price - current.prices[current.prices.length - 1] <= tolerance) {
      current.prices.push(s.price);
      current.indices.push(s.index);
    } else {
      clusters.push({ prices: [s.price], indices: [s.index] });
    }
  }

  const levels: IndicatorSRLevel[] = clusters
    .map((c) => ({
      price: c.prices.reduce((a, b) => a + b, 0) / c.prices.length,
      startIndex: Math.min(...c.indices),
      touchCount: c.prices.length,
    }))
    .filter((l) => l.touchCount >= 2)
    .sort((a, b) => b.touchCount - a.touchCount)
    .slice(0, Math.max(1, Math.round(maxLevels)));
  if (levels.length === 0) return result;

  for (let i = start; i < n; i++) result[i] = levels;
  return result;
}

// Hand-rolled rather than routed through `technicalindicators`' own IchimokuCloud (which trims
// its warm-up period from the front the same way RSI/MACD do, same convention every other
// indicator here null-pads back in) — the reason is the two Senkou spans' own *displacement*:
// classically plotted `displacement` bars *ahead* of the bar they're computed from, projecting
// into the still-blank space past the last candle. That's genuinely supportable here — the price
// scale already allows panning into empty space past data.length (see useZoomAndScales' own
// MAX_EMPTY_FRACTION) — but every indicator's own value array is one slot per *candle*, with
// nowhere to put a value meant for an index beyond data.length without widening that contract
// for this one indicator alone. Instead, each span is stored already shifted to the index it's
// *displayed* at (computed by looking `displacement` bars *back*, not projecting forward) — every
// past bar's cloud renders exactly like a real Ichimoku chart's, at the one cost of not showing
// the still-forming final `displacement` bars' worth of "future" cloud past the last candle.
// Chikou (the lagging span) needs no such trade-off — shifted *behind*, it only ever reads
// already-existing bars, so it's plotted in full.
export function computeIchimokuValues(
  data: Candle[],
  conversionPeriod: number,
  basePeriod: number,
  spanPeriod: number,
  displacement: number
): (IndicatorIchimokuPoint | null)[] {
  const n = data.length;
  if (n === 0) return [];
  function midpointSeries(period: number): (number | null)[] {
    return data.map((_, i) => {
      if (i < period - 1) return null;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        hi = Math.max(hi, data[j].high);
        lo = Math.min(lo, data[j].low);
      }
      return (hi + lo) / 2;
    });
  }
  const conversionAll = midpointSeries(conversionPeriod);
  const baseAll = midpointSeries(basePeriod);
  const spanBAll = midpointSeries(spanPeriod);

  return data.map((_, i) => {
    const conversion = conversionAll[i];
    const base = baseAll[i];
    const sourceIndex = i - displacement;
    let spanA: number | null = null;
    let spanB: number | null = null;
    if (sourceIndex >= 0) {
      const c = conversionAll[sourceIndex];
      const b = baseAll[sourceIndex];
      spanA = c !== null && b !== null ? (c + b) / 2 : null;
      spanB = spanBAll[sourceIndex];
    }
    const chikouSourceIndex = i + displacement;
    const chikou = chikouSourceIndex < n ? data[chikouSourceIndex].close : null;
    return { conversion, base, spanA, spanB, chikou };
  });
}

export function computeIndicatorValues(
  data: Candle[],
  indicator: Indicator,
  fundamentals: FundamentalDataPoint[] | undefined
): (IndicatorValue | null)[] {
  if (indicator.customData) return computeCustomIndicatorValues(data, indicator.customData);
  const period = Math.max(1, Math.round(indicator.period));
  if (isFundamentalKind(indicator.kind)) return computeFundamentalValues(data, fundamentals, indicator.kind);
  switch (indicator.kind) {
    case "ema":
      return computeEMAValues(data, period);
    case "wma":
      return computeWMAValues(data, period);
    case "vwap":
      return computeVWAPValues(data);
    case "bollinger":
      return computeBollingerValues(data, period, indicator.stdDev ?? 2);
    case "rsi":
      return computeRSIValues(data, period);
    case "chop":
      return computeCHOPValues(data, period);
    case "macd":
      return computeMACDValues(data, indicator.fastPeriod ?? 12, indicator.slowPeriod ?? 26, indicator.signalPeriod ?? 9);
    case "zigzag":
      return computeZigZagValues(data, indicator.zigzagDeviation ?? 5);
    case "atr":
      return computeATRValues(data, period);
    case "supertrend":
      return computeSupertrendValues(data, period, indicator.supertrendMultiplier ?? 3);
    case "chandelierExit":
      return computeChandelierExitValues(data, period, indicator.chandelierMultiplier ?? 3, indicator.chandelierUseClose ?? true);
    case "adx":
      return computeADXValues(data, period);
    case "correlation":
      return computeCorrelationValues(data, indicator.correlationData, period);
    case "parabolicSar":
      return computeParabolicSARValues(data, indicator.sarStep ?? 0.02, indicator.sarMax ?? 0.2);
    case "gaps":
      return computeGapValues(data, indicator.gapsMinPercent ?? 0.1);
    case "patternRecognition":
      return computePatternRecognitionValues(data, indicator.recognitionDateLimit);
    case "candleRecognition":
      return computeCandleRecognitionValues(data, indicator.recognitionDateLimit);
    case "pivotPoints":
      return computePivotPointsValues(data, indicator.pivotType ?? "classic", indicator.pivotPeriod ?? "weekly");
    case "supportResistance":
      return computeSupportResistanceValues(data, period, indicator.srMaxLevels ?? 6);
    // "tpo" bypasses this per-candle pipeline entirely — a session profile is a range-aware
    // aggregate that needs to know what's currently visible (see computeTPOSessionProfiles' own
    // doc), not a value at a fixed index, so it's computed by its own dedicated, zoom-aware memo
    // (useTpoOverlay) instead. An explicit no-op case here (rather than falling through to the
    // `default` SMA below) avoids paying for a real computation nothing ever reads.
    case "tpo":
      return data.map(() => null);
    case "ichimoku":
      return computeIchimokuValues(
        data,
        indicator.ichimokuConversionPeriod ?? 9,
        indicator.ichimokuBasePeriod ?? 26,
        indicator.ichimokuSpanPeriod ?? 52,
        indicator.ichimokuDisplacement ?? 26
      );
    case "sma":
    default:
      return computeSMAValues(data, period);
  }
}
