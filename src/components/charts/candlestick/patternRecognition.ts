import type { Candle } from "./interfaces/Candle.interface";
import type { IndicatorPatternMatch, PatternMatchType } from "./interfaces/IndicatorPatternMatch.interface";
import { recognitionDateLimitIndex, recognitionWindowStart } from "./recognitionWindow";

const MAX_LOOKBACK_CANDLES = 20;

interface Swing {
  index: number;
  price: number;
  kind: "high" | "low";
}

// Same fractal-swing idea `computeSupportResistanceValues` already uses (a candle is a swing high/
// low if no neighbor within `span` on either side beats its own high/low), just with `span` scaled
// down to 1 — a 100+ candle lookback can afford span 3, but this indicator's own window is capped
// at 20 candles (see MAX_LOOKBACK_CANDLES's own doc below), where span 3 would leave most of it
// with no swings to work with at all.
function detectSwings(data: Candle[], start: number, end: number): Swing[] {
  const span = 1;
  const swings: Swing[] = [];
  for (let i = start; i <= end; i++) {
    const lo = Math.max(start, i - span);
    const hi = Math.min(end, i + span);
    if (hi - lo < span * 2) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = lo; j <= hi; j++) {
      if (j === i) continue;
      if (data[j].high >= data[i].high) isHigh = false;
      if (data[j].low <= data[i].low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: data[i].high, kind: "high" });
    if (isLow) swings.push({ index: i, price: data[i].low, kind: "low" });
  }
  return swings;
}

function point(s: Swing): { index: number; price: number } {
  return { index: s.index, price: s.price };
}

function pctDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);
}

function makeMatch(
  type: PatternMatchType,
  label: string,
  points: Swing[],
  direction: IndicatorPatternMatch["direction"]
): IndicatorPatternMatch {
  return {
    type,
    label,
    startIndex: points[0].index,
    endIndex: points[points.length - 1].index,
    points: points.map(point),
    direction,
  };
}

// A reversal at two comparable peaks (top) or troughs (bottom) with a real pullback between them
// — "real" meaning the trough/peak in between sits meaningfully away from both, not just one
// candle's worth of noise, same idea `tolerance` gives every other detector below.
function matchDoubleTopBottom(highs: Swing[], lows: Swing[]): IndicatorPatternMatch | null {
  if (highs.length >= 2) {
    const [a, b] = highs.slice(-2);
    const between = lows.filter((l) => l.index > a.index && l.index < b.index);
    if (between.length > 0 && pctDiff(a.price, b.price) < 0.015) {
      const trough = Math.min(...between.map((l) => l.price));
      if ((Math.min(a.price, b.price) - trough) / Math.min(a.price, b.price) > 0.02) {
        return makeMatch("doubleTop", "Double sommet", [a, b], "bearish");
      }
    }
  }
  if (lows.length >= 2) {
    const [a, b] = lows.slice(-2);
    const between = highs.filter((h) => h.index > a.index && h.index < b.index);
    if (between.length > 0 && pctDiff(a.price, b.price) < 0.015) {
      const peak = Math.max(...between.map((h) => h.price));
      if ((peak - Math.max(a.price, b.price)) / Math.max(a.price, b.price) > 0.02) {
        return makeMatch("doubleBottom", "Double creux", [a, b], "bullish");
      }
    }
  }
  return null;
}

// Same 3-peak (or 3-trough) shape the "headShoulders" drawing tool lets a user place by hand —
// here inferred from the window's own last 3 high (or low) swings instead: the middle one clearly
// past the two outer ones, which are themselves roughly level with each other.
function matchHeadShoulders(highs: Swing[], lows: Swing[]): IndicatorPatternMatch | null {
  if (highs.length >= 3) {
    const [left, head, right] = highs.slice(-3);
    if (head.price > left.price * 1.01 && head.price > right.price * 1.01 && pctDiff(left.price, right.price) < 0.03) {
      return makeMatch("headShoulders", "Épaule-Tête-Épaule", [left, head, right], "bearish");
    }
  }
  if (lows.length >= 3) {
    const [left, head, right] = lows.slice(-3);
    if (head.price < left.price * 0.99 && head.price < right.price * 0.99 && pctDiff(left.price, right.price) < 0.03) {
      return makeMatch("inverseHeadShoulders", "ETE inversée", [left, head, right], "bullish");
    }
  }
  return null;
}

// Fits a straight line through the window's own high-swings and another through its low-swings
// (endpoint to endpoint — a plain 2-point line rather than a full regression, appropriate for the
// small number of swings a 20-candle window ever produces) and classifies by how each one slopes:
// flat-topped + rising floor = ascending, falling ceiling + flat floor = descending, both
// converging toward each other = symmetrical.
function matchTriangle(data: Candle[], highs: Swing[], lows: Swing[]): IndicatorPatternMatch | null {
  if (highs.length < 2 || lows.length < 2) return null;
  const h0 = highs[0];
  const h1 = highs[highs.length - 1];
  const l0 = lows[0];
  const l1 = lows[lows.length - 1];
  if (h1.index === h0.index || l1.index === l0.index) return null;
  const refPrice = data[data.length - 1].close;
  const flatThreshold = refPrice * 0.0015;
  const highSlope = (h1.price - h0.price) / (h1.index - h0.index);
  const lowSlope = (l1.price - l0.price) / (l1.index - l0.index);
  const highFlat = Math.abs(highSlope) < flatThreshold;
  const lowFlat = Math.abs(lowSlope) < flatThreshold;
  const points = [h0, h1, l0, l1].sort((a, b) => a.index - b.index);
  if (highFlat && lowSlope > flatThreshold) return makeMatch("ascendingTriangle", "Triangle ascendant", points, "bullish");
  if (lowFlat && highSlope < -flatThreshold) return makeMatch("descendingTriangle", "Triangle descendant", points, "bearish");
  if (highSlope < -flatThreshold && lowSlope > flatThreshold) return makeMatch("symmetricalTriangle", "Triangle symétrique", points, "neutral");
  return null;
}

// A strong directional move (the "pole") followed by a tight, roughly sideways consolidation (the
// "flag") — split the window in two and compare the first half's own net move to the second half's
// own range, rather than trying to fit a channel through the consolidation's own swings (overkill
// for what's fundamentally just "big move, then a pause").
function matchFlag(data: Candle[], start: number, end: number): IndicatorPatternMatch | null {
  const mid = Math.floor((start + end) / 2);
  if (mid - start < 2 || end - mid < 2) return null;
  const poleMove = data[mid].close - data[start].close;
  let poleRangeSum = 0;
  for (let i = start; i <= mid; i++) poleRangeSum += data[i].high - data[i].low;
  const poleAvgRange = poleRangeSum / (mid - start + 1);
  if (poleAvgRange <= 0 || Math.abs(poleMove) < poleAvgRange * 3) return null;
  let consolLow = Infinity;
  let consolHigh = -Infinity;
  for (let i = mid + 1; i <= end; i++) {
    consolLow = Math.min(consolLow, data[i].low);
    consolHigh = Math.max(consolHigh, data[i].high);
  }
  const consolRange = consolHigh - consolLow;
  if (consolRange >= Math.abs(poleMove) * 0.5) return null;
  const points: Swing[] = [
    { index: start, price: data[start].close, kind: poleMove > 0 ? "low" : "high" },
    { index: mid, price: data[mid].close, kind: poleMove > 0 ? "high" : "low" },
    { index: end, price: poleMove > 0 ? consolLow : consolHigh, kind: poleMove > 0 ? "low" : "high" },
  ];
  return makeMatch("flag", poleMove > 0 ? "Drapeau haussier" : "Drapeau baissier", points, poleMove > 0 ? "bullish" : "bearish");
}

// Same 5-point shape as the "cupHandle" drawing tool (A start, B bottom, C rim/handle start, D
// handle bottom, E handle end) — here A/B/C are inferred from the window's own low/rim points and
// D/E only recognized once there's a real, shallower pullback after the rim (see the "no handle
// yet" comment below) rather than forcing a match on a cup alone.
function matchCupHandle(data: Candle[], start: number, end: number): IndicatorPatternMatch | null {
  let bIdx = -1;
  let bPrice = Infinity;
  for (let i = start + 2; i <= end - 2; i++) {
    if (data[i].low < bPrice) {
      bPrice = data[i].low;
      bIdx = i;
    }
  }
  if (bIdx < 0) return null;
  let aIdx = start;
  let aPrice = -Infinity;
  for (let i = start; i <= bIdx; i++) {
    if (data[i].high > aPrice) {
      aPrice = data[i].high;
      aIdx = i;
    }
  }
  let cIdx = -1;
  let cPrice = -Infinity;
  for (let i = bIdx; i <= end; i++) {
    if (data[i].high > cPrice) {
      cPrice = data[i].high;
      cIdx = i;
    }
  }
  if (cIdx <= bIdx || pctDiff(aPrice, cPrice) > 0.05) return null;
  // No candles left after the rim to have formed a handle yet — a cup on its own isn't the
  // pattern this tool is named for.
  if (end - cIdx < 2) return null;
  let dIdx = cIdx;
  let dPrice = Infinity;
  for (let i = cIdx; i <= end; i++) {
    if (data[i].low < dPrice) {
      dPrice = data[i].low;
      dIdx = i;
    }
  }
  // A real handle pulls back only modestly (well short of the cup's own depth) — a drop as deep
  // as the cup itself is a fresh leg down, not a handle.
  if ((cPrice - dPrice) / (cPrice - bPrice || 1) > 0.5) return null;
  const eIdx = end;
  const points: Swing[] = [
    { index: aIdx, price: aPrice, kind: "high" },
    { index: bIdx, price: bPrice, kind: "low" },
    { index: cIdx, price: cPrice, kind: "high" },
    { index: dIdx, price: dPrice, kind: "low" },
    { index: eIdx, price: data[eIdx].close, kind: "high" },
  ];
  return makeMatch("cupHandle", "Tasse avec anse", points, "bullish");
}

// Best-effort only — a diamond's own textbook definition (broadening, then narrowing, price
// swings) has no single precise rule the way a double top's or a triangle's does. Approximated as
// "swing-to-swing amplitude rises across the window's first half, then falls across its second
// half" — real enough to flag the clearest cases without claiming more precision than a 20-candle
// window can actually support.
function matchDiamond(highs: Swing[], lows: Swing[]): IndicatorPatternMatch | null {
  const swings = [...highs, ...lows].sort((a, b) => a.index - b.index);
  if (swings.length < 5) return null;
  const amplitudes: number[] = [];
  for (let i = 1; i < swings.length; i++) amplitudes.push(Math.abs(swings[i].price - swings[i - 1].price));
  const mid = Math.floor(amplitudes.length / 2);
  if (mid < 2 || amplitudes.length - mid < 2) return null;
  const firstHalfRising = amplitudes[mid - 1] > amplitudes[0] * 1.15;
  const secondHalfFalling = amplitudes[amplitudes.length - 1] < amplitudes[mid] * 0.85;
  if (!firstHalfRising || !secondHalfFalling) return null;
  return makeMatch("diamond", "Diamant", [swings[0], swings[mid], swings[swings.length - 1]], "neutral");
}

// Best-effort only, same caveat as matchDiamond above — a rigorous Wolfe Wave needs precise
// trendline/channel relationships between all 5 points that a 20-candle window rarely resolves
// cleanly. Approximated as 5 alternating swings where wave 5 pushes past wave 3 in the same
// direction wave 1→3 already established, the one part of the textbook definition that's both
// load-bearing and checkable without fitting extra trendlines.
function matchWolfeWave(highs: Swing[], lows: Swing[]): IndicatorPatternMatch | null {
  const swings = [...highs, ...lows].sort((a, b) => a.index - b.index);
  for (let i = swings.length - 1; i >= 4; i--) {
    const [p1, p2, p3, p4, p5] = swings.slice(i - 4, i + 1);
    const alternating = p1.kind !== p2.kind && p2.kind !== p3.kind && p3.kind !== p4.kind && p4.kind !== p5.kind;
    if (!alternating) continue;
    if (p1.kind === "low" && p3.price < p1.price && p5.price < p3.price && p4.price < p2.price) {
      return makeMatch("wolfeWave", "Wolfe Wave", [p1, p2, p3, p4, p5], "bullish");
    }
    if (p1.kind === "high" && p3.price > p1.price && p5.price > p3.price && p4.price > p2.price) {
      return makeMatch("wolfeWave", "Wolfe Wave", [p1, p2, p3, p4, p5], "bearish");
    }
  }
  return null;
}

// Same clustering idea as `computeSupportResistanceValues`, scaled to this indicator's own
// (much smaller) window — kept independent of that function rather than shared, since its own
// `period`/`srMaxLevels` settings and this one's `recognitionDateLimit` window have no reason to
// stay coupled.
function matchSupportResistance(highs: Swing[], lows: Swing[]): IndicatorPatternMatch[] {
  const matches: IndicatorPatternMatch[] = [];
  for (const [swings, type, direction] of [
    [highs, "resistance", "bearish"],
    [lows, "support", "bullish"],
  ] as const) {
    if (swings.length < 2) continue;
    const sorted = [...swings].sort((a, b) => a.price - b.price);
    const tolerance = (sorted[sorted.length - 1].price - sorted[0].price) * 0.02 || sorted[0].price * 0.01;
    let cluster: Swing[] = [sorted[0]];
    const flush = () => {
      if (cluster.length >= 2) {
        const ordered = [...cluster].sort((a, b) => a.index - b.index);
        matches.push(makeMatch(type, type === "resistance" ? "Résistance" : "Support", ordered, direction));
      }
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].price - cluster[cluster.length - 1].price <= tolerance) cluster.push(sorted[i]);
      else {
        flush();
        cluster = [sorted[i]];
      }
    }
    flush();
  }
  return matches;
}

/** "patternRecognition": auto-detects classic chart patterns (double top/bottom, head & shoulders,
 *  triangles, flag, cup & handle, diamond, wolfe wave, support/resistance) within a bounded window
 *  — up to `MAX_LOOKBACK_CANDLES` candles ending at whichever candle `Indicator.recognitionDateLimit`
 *  resolves to (see `recognitionDateLimitIndex`'s own doc) — rather than scanning the dataset's
 *  entire history: these patterns exist to say "here's what's forming right now", not to log
 *  every past occurrence, and the window itself is what keeps that true as new candles arrive
 *  (it slides forward with `recognitionDateLimit`'s own default). Each pattern family is detected
 *  independently and its own match (if any) stored at its own `endIndex` — several can coexist in
 *  the same window (e.g. a support level *and* a triangle), each is just its own entry. Diamond and
 *  Wolfe Wave are the two hardest of the list to define rigorously at all (even most trading
 *  platforms use loose heuristics for them) — see their own detectors' doc for exactly how far
 *  this goes and where it stops. */
export function computePatternRecognitionValues(data: Candle[], dateLimit: Date | undefined): (IndicatorPatternMatch | null)[] {
  const n = data.length;
  const result: (IndicatorPatternMatch | null)[] = new Array(n).fill(null);
  const limitIndex = recognitionDateLimitIndex(data, dateLimit);
  if (limitIndex < 4) return result;
  const start = recognitionWindowStart(limitIndex, MAX_LOOKBACK_CANDLES);
  const swings = detectSwings(data, start, limitIndex);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");

  const matches = [
    matchDoubleTopBottom(highs, lows),
    matchHeadShoulders(highs, lows),
    matchTriangle(data, highs, lows),
    matchFlag(data, start, limitIndex),
    matchCupHandle(data, start, limitIndex),
    matchDiamond(highs, lows),
    matchWolfeWave(highs, lows),
    ...matchSupportResistance(highs, lows),
  ].filter((m): m is IndicatorPatternMatch => m !== null);

  for (const m of matches) {
    if (result[m.endIndex] === null) result[m.endIndex] = m;
  }
  return result;
}
