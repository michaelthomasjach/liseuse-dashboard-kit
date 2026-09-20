import { ATR } from "technicalindicators";
import { CandleModeIcon, BarModeIcon, LineCloseModeIcon, HeikinAshiModeIcon, RenkoModeIcon, LineBreakModeIcon } from "../../icons";
import type { Candle } from "./interfaces/Candle.interface";
import type { ChartDisplayMode } from "./interfaces/ChartDisplayMode.interface";

/** Heikin Ashi keeps a 1:1 index/date correspondence with `data` (unlike Renko/Line Break
 *  below) — each output candle just replaces the OHLC values the regular candle-drawing loop
 *  reads at the same index, so it needs no changes to the index-based scale/zoom/crosshair
 *  machinery that everything else in this file assumes `data` provides. */
export function computeHeikinAshiCandles(data: Candle[]): Candle[] {
  const out: Candle[] = [];
  let prevOpen = 0;
  let prevClose = 0;
  data.forEach((d, i) => {
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = i === 0 ? (d.open + d.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(d.high, haOpen, haClose);
    const haLow = Math.min(d.low, haOpen, haClose);
    out.push({ ...d, open: haOpen, high: haHigh, low: haLow, close: haClose });
    prevOpen = haOpen;
    prevClose = haClose;
  });
  return out;
}

/** A Renko/Line Break "brick": unlike a candle, it doesn't own a single index — it forms over a
 *  run of source candles, from the one right after the previous brick closed (`startIndex`) to
 *  the one whose close confirmed it (`endIndex`). Rendered as a rectangle spanning exactly that
 *  index range on the existing index-based X scale, so bricks stay perfectly in sync with
 *  zoom/pan/volume/indicators/drawings instead of needing a separate scale of their own — the
 *  tradeoff is that brick width varies with how many source candles it took to form, rather than
 *  the uniform width Renko/Line Break charts have on a dedicated (non-time) axis. */
export interface PriceBrick {
  open: number;
  close: number;
  direction: 1 | -1;
  startIndex: number;
  endIndex: number;
}

/** Brick size = ATR(period) over the whole dataset — the standard, volatility-adaptive way to
 *  size Renko bricks (vs. a fixed price or a % of price, neither of which adapts to how much the
 *  instrument actually moves). Falls back to the plain average true range over however much data
 *  exists when there's not enough of it for the ATR library to warm up (period + 1 candles),
 *  rather than leaving Renko with zero bricks on a short dataset. */
export function computeRenkoBrickSize(data: Candle[], period: number): number {
  if (data.length < 2) return 0;
  const values = ATR.calculate({ period, high: data.map((d) => d.high), low: data.map((d) => d.low), close: data.map((d) => d.close) });
  const last = values.length > 0 ? values[values.length - 1] : undefined;
  if (last && last > 0) return last;
  const trueRanges = data.map((d, i) => {
    const prevClose = i > 0 ? data[i - 1].close : d.close;
    return Math.max(d.high - d.low, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose));
  });
  const avg = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  return avg > 0 ? avg : 1;
}

/** Traditional close-based Renko: a new brick forms every time the close moves `brickSize` past
 *  the last brick's own close, one brick per `brickSize` of movement (a single big move can spawn
 *  several bricks between two candles) — reverses direction on a single opposite brick, the same
 *  simplification most retail platforms use instead of the stricter "2 bricks to reverse" rule.
 *
 *  BUG FIXED: an earlier version gated each direction's check on the *current* `direction` itself
 *  (`while (direction >= 0 && price >= basePrice + brickSize)`, and the mirror image below it) —
 *  meant to stop the very first candle from qualifying for both directions at once, but it also
 *  permanently locked out reversals: once direction settled to -1 after the first down-brick,
 *  `direction >= 0` could never be true again for the rest of the dataset, so no up-brick could
 *  ever form again either (and symmetrically for 1). On real (non-monotonic) data this collapsed
 *  the whole series to just its first brick — exactly the "Renko doesn't work" symptom. Checking
 *  the *price* against both thresholds unconditionally (whichever qualifies first) instead of
 *  gating on the brick's own last direction fixes this — direction is now purely a label on each
 *  brick, not a one-way gate on what can happen next. */
export function computeRenkoBricks(data: Candle[], brickSize: number): PriceBrick[] {
  if (brickSize <= 0 || data.length === 0) return [];
  const bricks: PriceBrick[] = [];
  let basePrice = data[0].close;
  let startIndex = 0;
  for (let i = 1; i < data.length; i++) {
    const price = data[i].close;
    // A single candle can confirm more than one brick if it moves far enough — keep peeling
    // bricks off the same candle until it's no longer past the next threshold in either
    // direction. Checked as if/else-if (not two independent whiles) since after moving basePrice
    // one way, the opposite threshold is now further away, never closer — so at most one of the
    // two conditions can ever be true on a given pass.
    let moved = true;
    while (moved) {
      moved = false;
      if (price >= basePrice + brickSize) {
        bricks.push({ open: basePrice, close: basePrice + brickSize, direction: 1, startIndex, endIndex: i });
        basePrice += brickSize;
        startIndex = i;
        moved = true;
      } else if (price <= basePrice - brickSize) {
        bricks.push({ open: basePrice, close: basePrice - brickSize, direction: -1, startIndex, endIndex: i });
        basePrice -= brickSize;
        startIndex = i;
        moved = true;
      }
    }
  }
  return bricks;
}

/** N-line break (classic "Three Line Break" at lineCount = 3): a new line extends the run
 *  whenever the close makes a new high (uptrend) / low (downtrend) past the last line's own
 *  close; it only reverses once the close breaks past the extreme of the last `lineCount` lines
 *  in the opposite direction — closes that do neither (inside the last line's range) produce no
 *  new line at all, unlike Renko where every candle is at least checked against a fixed step. */
export function computeLineBreakBricks(data: Candle[], lineCount: number): PriceBrick[] {
  if (data.length < 2) return [];
  const closes = data.map((d) => d.close);
  const lines: PriceBrick[] = [];
  let startIndex = 0;
  for (let i = 1; i < closes.length; i++) {
    const price = closes[i];
    if (lines.length === 0) {
      const direction: 1 | -1 = price >= closes[0] ? 1 : -1;
      lines.push({ open: closes[0], close: price, direction, startIndex: 0, endIndex: i });
      startIndex = i;
      continue;
    }
    const last = lines[lines.length - 1];
    const extendsRun = last.direction === 1 ? price > last.close : price < last.close;
    if (extendsRun) {
      lines.push({ open: last.close, close: price, direction: last.direction, startIndex, endIndex: i });
      startIndex = i;
      continue;
    }
    const window = lines.slice(-lineCount);
    const extreme =
      last.direction === 1
        ? Math.min(...window.map((l) => Math.min(l.open, l.close)))
        : Math.max(...window.map((l) => Math.max(l.open, l.close)));
    const reverses = last.direction === 1 ? price < extreme : price > extreme;
    if (reverses) {
      lines.push({ open: last.close, close: price, direction: last.direction === 1 ? -1 : 1, startIndex, endIndex: i });
      startIndex = i;
    }
  }
  return lines;
}

export interface TpoRow {
  priceLow: number;
  priceHigh: number;
}

/** One time block within a session — real TPO letters/numbers, each shown at every price `Row`
 *  (by index into the session's own `rows`) any candle inside this block's own time window
 *  touched. `label` wraps letters back to "A" after "Z" (there's no data-driven upper bound on
 *  how many blocks a long session at a fine `blockMinutes` can produce) — good enough for typical
 *  session/block combinations without needing a second letter tier, and numbers never need to. */
export interface TpoBlock {
  label: string;
  rows: number[];
}

export interface TpoSessionProfile {
  /** Both relative to the `candles` array `computeTPOSessionProfiles` was given, same index space
   *  its own caller's `visibleRange` slice already uses — not absolute indices into the chart's
   *  full `data`. */
  startIndex: number;
  endIndex: number;
  rows: TpoRow[];
  blocks: TpoBlock[];
  pocRow: number;
  vahRow: number;
  valRow: number;
}

function tpoBlockLabel(index: number, style: "letters" | "numbers"): string {
  if (style === "numbers") return String(index + 1);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[index % letters.length];
}

// How much time one candle represents, estimated once across the whole slice as the *median*
// gap between consecutive candles (robust to weekend/holiday gaps a plain average would skew).
// Deciding merge-vs-synthesize per candle by comparing it to its own next neighbor *within the
// session* (an earlier version of this) breaks at exactly the case synthesis exists for: a
// session that degenerates to a single candle (the norm once candles are daily-or-coarser, since
// sessions are calendar days) has no next-in-session candle to compare against, and silently
// falls back to "no gap data" — which reads as "finer than a block" and merges instead of
// synthesizes. A single dataset-wide estimate has no such boundary to trip over.
function nominalCandleMs(candles: Candle[]): number {
  if (candles.length < 2) return 24 * 60 * 60_000;
  const diffs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].date.getTime() - candles[i - 1].date.getTime();
    if (diff > 0) diffs.push(diff);
  }
  if (diffs.length === 0) return 24 * 60 * 60_000;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

// One candle's own O/H/L/C, turned into `count` synthetic sub-blocks tracing a plausible
// intrabar path — real TPO needs real intrabar data to know which of a session's own time blocks
// actually touched which price, not available here (see computeTPOSessionProfiles' own doc), so
// this instead assumes a bullish candle moved Open -> Low -> High -> Close (dipped, then rallied)
// and a bearish one Open -> High -> Low -> Close (the mirror image) — the same "4-price" shape
// several other OHLC-only reconstruction techniques already assume, split into `count` equal-time
// steps along that path. Each block touches every row between its own start/end price on the
// path, so a block near a turning point (the low or high) naturally spans more rows than one in a
// flat stretch — texture a uniform per-row split wouldn't have.
function tpoSyntheticBlocks(candle: Candle, count: number, rowOf: (price: number) => number): Set<number>[] {
  if (count <= 1) {
    const rows = new Set<number>();
    for (let r = rowOf(candle.low); r <= rowOf(candle.high); r++) rows.add(r);
    return [rows];
  }
  const bullish = candle.close >= candle.open;
  const path = bullish ? [candle.open, candle.low, candle.high, candle.close] : [candle.open, candle.high, candle.low, candle.close];
  const priceAt = (t: number) => {
    const segT = Math.min(0.999999, Math.max(0, t)) * 3;
    const seg = Math.min(2, Math.floor(segT));
    return path[seg] + (path[seg + 1] - path[seg]) * (segT - seg);
  };
  const blocks: Set<number>[] = [];
  for (let i = 0; i < count; i++) {
    const pStart = priceAt(i / count);
    const pEnd = priceAt((i + 1) / count);
    const rows = new Set<number>();
    for (let r = rowOf(Math.min(pStart, pEnd)); r <= rowOf(Math.max(pStart, pEnd)); r++) rows.add(r);
    blocks.push(rows);
  }
  return blocks;
}

/** "Time Price Opportunities": real Market Profile charts slice each session into fixed-length
 *  time blocks (`blockMinutes` — 30 minutes on a real exchange floor, historically), stamping
 *  that block's own letter/number at every price level a candle inside it touched. A real TPO
 *  tool can do this on a daily chart because it separately pulls finer intraday data behind the
 *  scenes regardless of what the chart itself is showing — this library only ever has the one
 *  `candles` array it's given (see this whole library's own "caller owns the data" stance).
 *
 *  So within each session (a calendar day — degenerates to one candle per session on a
 *  daily-or-coarser timeframe, which is exactly the case that needs the fallback below), every
 *  real candle contributes blocks one of two ways depending on how the dataset's own candle
 *  duration (`nominalCandleMs`, estimated once across the whole visible slice) compares to
 *  `blockMinutes`: candles *finer* than a block (several fit inside one `blockMinutes` window)
 *  are grouped together into that one real block, same as a genuine TPO tool would read them;
 *  a candle *coarser* than a block (the block fits inside it several times over, the common case
 *  once a single candle already spans a whole day or more) is instead split into that many
 *  synthetic sub-blocks (see `tpoSyntheticBlocks`) — an approximation, but the only way to show
 *  a real breakdown at all without needing an intraday timeframe.
 *
 *  Rows are a fixed count across each session's own [low, high] (independent of block count —
 *  more blocks just means more distinct letters landing in the same rows, not more rows), same
 *  price-binning idea a volume profile already uses. POC is the row the most blocks touched; the
 *  value area expands outward from it, always toward whichever neighboring row more blocks
 *  touched, until it encloses `valueAreaFraction` of all (block, row) touches (0.7 = the standard
 *  Market Profile default) — the same definition, just counted in blocks-per-row instead of
 *  volume-per-row. */
export function computeTPOSessionProfiles(
  candles: Candle[],
  rowCount: number,
  blockMinutes: number,
  labelStyle: "letters" | "numbers",
  valueAreaFraction: number
): TpoSessionProfile[] {
  if (candles.length === 0) return [];
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const blockMs = Math.max(1, blockMinutes) * 60_000;
  const candleMs = nominalCandleMs(candles);

  const sessions: TpoSessionProfile[] = [];
  let sessionStart = 0;
  for (let i = 1; i <= candles.length; i++) {
    const sameDay = i < candles.length && dayKey(candles[i].date) === dayKey(candles[sessionStart].date);
    if (sameDay) continue;
    const endIndex = i - 1;
    const sessionCandles = candles.slice(sessionStart, endIndex + 1);

    let lo = Infinity;
    let hi = -Infinity;
    for (const d of sessionCandles) {
      lo = Math.min(lo, d.low);
      hi = Math.max(hi, d.high);
    }
    if (hi > lo) {
      const rowSize = (hi - lo) / rowCount;
      const rowOf = (price: number) => Math.min(rowCount - 1, Math.max(0, Math.floor((price - lo) / rowSize)));

      const orderedBlocks: Set<number>[] = [];
      let k = 0;
      while (k < sessionCandles.length) {
        if (candleMs <= blockMs) {
          // Merges every following candle still inside this same blockMinutes-wide window,
          // starting from candle k's own timestamp, into one real (not synthesized) block.
          const windowStart = sessionCandles[k].date.getTime();
          const rows = new Set<number>();
          let j = k;
          while (j < sessionCandles.length && sessionCandles[j].date.getTime() - windowStart < blockMs) {
            for (let r = rowOf(sessionCandles[j].low); r <= rowOf(sessionCandles[j].high); r++) rows.add(r);
            j++;
          }
          orderedBlocks.push(rows);
          k = j;
        } else {
          const subBlockCount = Math.max(1, Math.round(candleMs / blockMs));
          for (const rows of tpoSyntheticBlocks(sessionCandles[k], subBlockCount, rowOf)) orderedBlocks.push(rows);
          k++;
        }
      }

      const blocks: TpoBlock[] = orderedBlocks.map((rows, bi) => ({ label: tpoBlockLabel(bi, labelStyle), rows: Array.from(rows).sort((a, b) => a - b) }));
      const touchCounts = new Array(rowCount).fill(0);
      for (const block of blocks) for (const r of block.rows) touchCounts[r]++;
      const total = touchCounts.reduce((a: number, b: number) => a + b, 0);
      if (total > 0) {
        let pocRow = 0;
        for (let r = 1; r < rowCount; r++) if (touchCounts[r] > touchCounts[pocRow]) pocRow = r;
        let areaLow = pocRow;
        let areaHigh = pocRow;
        let areaSum = touchCounts[pocRow];
        while (areaSum / total < valueAreaFraction && (areaLow > 0 || areaHigh < rowCount - 1)) {
          const below = areaLow > 0 ? touchCounts[areaLow - 1] : -1;
          const above = areaHigh < rowCount - 1 ? touchCounts[areaHigh + 1] : -1;
          if (above >= below) areaSum += touchCounts[++areaHigh];
          else areaSum += touchCounts[--areaLow];
        }
        const rows: TpoRow[] = Array.from({ length: rowCount }, (_, r) => ({ priceLow: lo + r * rowSize, priceHigh: lo + (r + 1) * rowSize }));
        sessions.push({ startIndex: sessionStart, endIndex, rows, blocks, pocRow, vahRow: areaHigh, valRow: areaLow });
      }
    }
    sessionStart = i;
  }
  return sessions;
}

export interface ChartDisplayModeDef {
  mode: ChartDisplayMode;
  label: string;
  icon: typeof CandleModeIcon;
}

export const CHART_DISPLAY_MODES: ChartDisplayModeDef[] = [
  { mode: "candle", label: "Bougies", icon: CandleModeIcon },
  // Right after candles, because it is the same four numbers drawn differently — and before the
  // modes that change what a bar *is* (Heikin Ashi averages them, Renko and Line Break drop time
  // altogether).
  { mode: "bar", label: "Barres", icon: BarModeIcon },
  { mode: "line", label: "Ligne de clôture", icon: LineCloseModeIcon },
  { mode: "heikinAshi", label: "Heikin Ashi", icon: HeikinAshiModeIcon },
  { mode: "renko", label: "Renko", icon: RenkoModeIcon },
  { mode: "lineBreak", label: "Line Break", icon: LineBreakModeIcon },
];
