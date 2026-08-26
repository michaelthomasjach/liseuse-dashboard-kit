import type { Candle } from "./interfaces/Candle.interface";
import type { IndicatorCandleMatch } from "./interfaces/IndicatorCandleMatch.interface";
import { recognitionDateLimitIndex } from "./recognitionWindow";

const TREND_LOOKBACK = 5;

/** Whether price was broadly rising or falling over the `TREND_LOOKBACK` candles right before
 *  `index` — the one piece of context that tells a hammer from a hanging man, or an inverted
 *  hammer from a shooting star (same candle shape, opposite meaning depending on what it's
 *  reversing). A plain "first close vs. last close" comparison rather than a full regression:
 *  precise enough for a 5-candle window, and every caller here only needs the sign. */
function precedingTrend(data: Candle[], index: number): "up" | "down" | "flat" {
  const from = Math.max(0, index - TREND_LOOKBACK);
  if (from >= index) return "flat";
  const delta = data[index - 1].close - data[from].close;
  const threshold = data[from].close * 0.001;
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "flat";
}

function body(c: Candle): number {
  return Math.abs(c.close - c.open);
}
function range(c: Candle): number {
  return c.high - c.low;
}
function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}
function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}
function isBullish(c: Candle): boolean {
  return c.close > c.open;
}
function isBearish(c: Candle): boolean {
  return c.close < c.open;
}

// Checked in priority order (most specific/rarest first) by detectCandlePatternAt below — a
// 3-candle confirmation pattern is a stronger, more deliberate signal than a single candle's own
// shape, so it takes precedence whenever both happen to line up on the same index.

function matchThreeInside(data: Candle[], i: number): IndicatorCandleMatch | null {
  if (i < 2) return null;
  const [c1, c2, c3] = [data[i - 2], data[i - 1], data[i]];
  const b1 = body(c1);
  if (b1 === 0) return null;
  // c2's whole body sits inside c1's own body (the "harami") — the classic 2-candle setup this
  // 3rd-candle confirmation builds on.
  const c1Top = Math.max(c1.open, c1.close);
  const c1Bottom = Math.min(c1.open, c1.close);
  const c2Top = Math.max(c2.open, c2.close);
  const c2Bottom = Math.min(c2.open, c2.close);
  const isHarami = c2Top <= c1Top && c2Bottom >= c1Bottom;
  if (!isHarami) return null;
  if (isBearish(c1) && isBullish(c3) && c3.close > c1.open) {
    return { type: "threeInsideUp", label: "Three Inside Up", index: i, spanIndex: i - 2, direction: "bullish" };
  }
  if (isBullish(c1) && isBearish(c3) && c3.close < c1.open) {
    return { type: "threeInsideDown", label: "Three Inside Down", index: i, spanIndex: i - 2, direction: "bearish" };
  }
  return null;
}

function matchStar(data: Candle[], i: number): IndicatorCandleMatch | null {
  if (i < 2) return null;
  const [c1, c2, c3] = [data[i - 2], data[i - 1], data[i]];
  const b1 = body(c1);
  const r1 = range(c1);
  const r3 = range(c3);
  if (r1 === 0 || r3 === 0) return null;
  // c2's own body is small relative to both its neighbors' — the "star", indecision between two
  // otherwise decisive candles.
  const smallMiddle = body(c2) < Math.min(r1, r3) * 0.3;
  if (!smallMiddle) return null;
  const c1Mid = (c1.open + c1.close) / 2;
  if (isBearish(c1) && b1 / r1 > 0.5 && isBullish(c3) && c3.close > c1Mid) {
    return { type: "morningStar", label: "Étoile du matin", index: i, spanIndex: i - 2, direction: "bullish" };
  }
  if (isBullish(c1) && b1 / r1 > 0.5 && isBearish(c3) && c3.close < c1Mid) {
    return { type: "eveningStar", label: "Étoile du soir", index: i, spanIndex: i - 2, direction: "bearish" };
  }
  return null;
}

function matchEngulfing(data: Candle[], i: number): IndicatorCandleMatch | null {
  if (i < 1) return null;
  const [c1, c2] = [data[i - 1], data[i]];
  if (body(c1) === 0) return null;
  if (isBearish(c1) && isBullish(c2) && c2.open <= c1.close && c2.close >= c1.open && body(c2) > body(c1)) {
    return { type: "bullishEngulfing", label: "Avalante haussière", index: i, spanIndex: i - 1, direction: "bullish" };
  }
  if (isBullish(c1) && isBearish(c2) && c2.open >= c1.close && c2.close <= c1.open && body(c2) > body(c1)) {
    return { type: "bearishEngulfing", label: "Avalante baissière", index: i, spanIndex: i - 1, direction: "bearish" };
  }
  return null;
}

// Hammer/hanging man/inverted hammer/shooting star all share one shape (a small body pinned to
// one end of the candle's own range, a long wick on the other side, little to no wick on the
// body's own side) — the only thing distinguishing all four from each other is which end the body
// sits at and what the trend right before it was doing (see precedingTrend's own doc).
function matchSingleCandleShapes(data: Candle[], i: number): IndicatorCandleMatch | null {
  const c = data[i];
  const r = range(c);
  if (r === 0) return null;
  const b = body(c);
  if (b / r > 0.35) return null;
  const uw = upperWick(c);
  const lw = lowerWick(c);
  const trend = precedingTrend(data, i);

  // Long lower wick, short upper wick — body near the top of the range.
  if (lw >= b * 2 && uw <= b * 0.5) {
    if (trend === "down") return { type: "hammer", label: "Marteau", index: i, spanIndex: i, direction: "bullish" };
    if (trend === "up") return { type: "hangingMan", label: "Pendu", index: i, spanIndex: i, direction: "bearish" };
    return null;
  }
  // Long upper wick, short lower wick — body near the bottom of the range.
  if (uw >= b * 2 && lw <= b * 0.5) {
    if (trend === "down") return { type: "invertedHammer", label: "Marteau inversé", index: i, spanIndex: i, direction: "bullish" };
    if (trend === "up") return { type: "shootingStar", label: "Étoile filante", index: i, spanIndex: i, direction: "bearish" };
    return null;
  }
  return null;
}

function matchDoji(data: Candle[], i: number): IndicatorCandleMatch | null {
  const c = data[i];
  const r = range(c);
  if (r === 0) return null;
  if (body(c) / r <= 0.1) {
    return { type: "doji", label: "Doji", index: i, spanIndex: i, direction: "neutral" };
  }
  return null;
}

function detectCandlePatternAt(data: Candle[], i: number): IndicatorCandleMatch | null {
  // Star checked before three-inside: a morning/evening star's own tiny middle candle very often
  // also happens to sit inside the first candle's body (a "harami" by coincidence, not by the
  // pattern's own design) — star's conditions are the more specific/deliberate setup of the two
  // (a genuinely large first candle *and* a close back past its own midpoint, not just
  // "contained"), so it should win whenever both technically match the same 3 candles.
  return matchStar(data, i) ?? matchThreeInside(data, i) ?? matchEngulfing(data, i) ?? matchSingleCandleShapes(data, i) ?? matchDoji(data, i);
}

/** "candleRecognition": auto-detects classic candlestick patterns (three inside up/down,
 *  morning/evening star, engulfing, hammer/hanging man/inverted hammer/shooting star, doji) —
 *  evaluated once, at whichever candle `Indicator.recognitionDateLimit` resolves to (see
 *  `recognitionDateLimitIndex`'s own doc), not scanned across history: this indicator's whole
 *  point is "what's happening right now", refreshed forward a candle at a time as new data
 *  arrives, not a running log of every past occurrence. Each pattern's own detector reaches back
 *  as many candles as its own classic definition needs (1 for hammer/doji, 2 for engulfing, 3 for
 *  a star/three-inside) — always well inside the 20-candle cap `computePatternRecognitionValues`
 *  needs for its own, genuinely multi-day patterns. */
export function computeCandleRecognitionValues(data: Candle[], dateLimit: Date | undefined): (IndicatorCandleMatch | null)[] {
  const n = data.length;
  const result: (IndicatorCandleMatch | null)[] = new Array(n).fill(null);
  const limitIndex = recognitionDateLimitIndex(data, dateLimit);
  if (limitIndex < 0) return result;
  result[limitIndex] = detectCandlePatternAt(data, limitIndex);
  return result;
}
