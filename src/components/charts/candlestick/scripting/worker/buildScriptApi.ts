import type { ScriptEngineSnapshot, ScriptEngineSnapshotCandle } from "../interfaces/ScriptEngineSnapshot.interface";
import type { IndicatorValue } from "../../interfaces/IndicatorValue.interface";
import { MAX_SERIES_LENGTH } from "../constants";

type SeriesField = "open" | "high" | "low" | "close" | "volume";

const FIELD_KEY: Record<SeriesField, keyof ScriptEngineSnapshotCandle> = {
  open: "o",
  high: "h",
  low: "l",
  close: "c",
  volume: "v",
};

/** `market.resample(interval)`'s own return shape — identical to `MarketApi` minus `resample`/
 *  `availableTimeframes` (nesting either would suggest a resampled view can itself be resampled
 *  again or has its own separate timeframe list, neither of which is true — see `MarketApi.resample`'s
 *  own doc). */
export interface MarketResampledApi {
  open(offset?: number): number | null;
  high(offset?: number): number | null;
  low(offset?: number): number | null;
  close(offset?: number): number | null;
  volume(offset?: number): number | null;
  time(offset?: number): Date | null;
  series(field: SeriesField, count?: number): number[];
}

export interface MarketApi {
  open(offset?: number): number | null;
  high(offset?: number): number | null;
  low(offset?: number): number | null;
  close(offset?: number): number | null;
  volume(offset?: number): number | null;
  time(offset?: number): Date | null;
  series(field: SeriesField, count?: number): number[];
  /** Every timeframe value the host chart's own picker offers (exigence #25) — inspection only,
   *  see `ScriptEngineSnapshot.availableTimeframes`'s own doc for why this doesn't grant access to
   *  any *other* timeframe's own data (that's `resample`'s own job, see below). */
  availableTimeframes(): string[];
  /** Aggregates the base OHLCV (the same data the chart itself displays, per `snapshot.ohlcv`)
   *  into a coarser timeframe — this library never owns a data source of its own (same stance
   *  `availableTimeframes()`'s own doc takes), so there is no separate finer/other feed to fetch;
   *  a higher timeframe is always derived from whatever's already here. `interval` is a
   *  `"<n><unit>"` string, unit one of `"m"`/`"h"`/`"d"` (e.g. `"15m"`, `"4h"`, `"1d"`), matching
   *  `availableTimeframes()`'s own format. An unparsable interval, or one *finer* than the chart's
   *  own base granularity (upsampling — there's nothing real to subdivide into), returns an
   *  accessor whose every method reads as "no data" (`null`/`[]`) rather than throwing or
   *  fabricating false precision — same "typo → quiet no-op" convention `chart.indicator()` on an
   *  unknown id already follows.
   *
   *  Look-ahead safety is structural, not a separate check: the aggregated bars are built fresh on
   *  every call from `snapshot.ohlcv[0..getCurrentIndex()]` only, so a resampled bar can no more
   *  straddle into the future than `market.close()` itself can (requirement #18) — this is exactly
   *  why the returned accessor's own "current" index can safely be fixed at construction time
   *  (`buckets.length - 1`) instead of tracking a live callback the way `market.*` itself does: a
   *  script that wants an up-to-date read the next bar simply calls `resample()` again, which is
   *  the normal "script re-runs top to bottom every bar" model every other `plot.*` call already
   *  relies on. */
  resample(interval: string): MarketResampledApi;
}

const ALL_NULL_RESAMPLED_API: MarketResampledApi = {
  open: () => null,
  high: () => null,
  low: () => null,
  close: () => null,
  volume: () => null,
  time: () => null,
  series: () => [],
};

/** Parses `market.resample()`'s own `"<n><unit>"` argument into milliseconds — `null` for
 *  anything that doesn't match, read by `resample()` as "give up gracefully" rather than throw. */
function parseIntervalMs(interval: string): number | null {
  const match = /^(\d+)(m|h|d)$/.exec(interval.trim().toLowerCase());
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unitMs = match[2] === "m" ? 60_000 : match[2] === "h" ? 3_600_000 : 86_400_000;
  return amount * unitMs;
}

/** Shared field/series accessor logic — the exact same offset-based semantics `market.*` itself
 *  has always had (see `buildMarketApi`'s own doc on offsets), just parameterized over *which*
 *  candle array and "current index" to read rather than hardcoded to `snapshot.ohlcv`/
 *  `getCurrentIndex`, so `market.resample()`'s own aggregated bars can reuse it verbatim instead
 *  of duplicating it. `getCandles`/`getIndex` are callbacks (not plain values) so the *base*
 *  market object — the one long-lived instance `runScript.ts` advances bar by bar across the
 *  whole replay — keeps reading the live current index on every access; a `resample()` result, by
 *  contrast, is a fresh short-lived object per call, so wrapping its own already-fixed
 *  `buckets`/`buckets.length - 1` in trivial callbacks costs nothing and lets both share this one
 *  implementation. */
function buildCandleAccessor(
  getCandles: () => ScriptEngineSnapshotCandle[],
  getIndex: () => number
): MarketResampledApi {
  function resolveIndex(offset: number): number | null {
    const currentIndex = getIndex();
    const index = currentIndex - offset;
    if (!Number.isFinite(offset) || index < 0 || index > currentIndex) return null;
    return index;
  }
  function field(key: keyof ScriptEngineSnapshotCandle, offset: number): number | null {
    const index = resolveIndex(offset);
    if (index === null) return null;
    const value = getCandles()[index][key];
    return typeof value === "number" ? value : null;
  }
  return {
    open: (offset = 0) => field("o", offset),
    high: (offset = 0) => field("h", offset),
    low: (offset = 0) => field("l", offset),
    close: (offset = 0) => field("c", offset),
    volume: (offset = 0) => field("v", offset),
    time: (offset = 0) => {
      const index = resolveIndex(offset);
      return index === null ? null : new Date(getCandles()[index].t);
    },
    series: (fieldName, count = MAX_SERIES_LENGTH) => {
      const candles = getCandles();
      const currentIndex = getIndex();
      const clampedCount = Math.max(0, Math.min(count, MAX_SERIES_LENGTH));
      const start = Math.max(0, currentIndex - clampedCount + 1);
      const key = FIELD_KEY[fieldName];
      const result: number[] = [];
      for (let i = start; i <= currentIndex; i++) {
        const value = candles[i][key];
        if (typeof value === "number") result.push(value);
      }
      return result;
    },
  };
}

/** `market.*`, closed over the snapshot and a `getCurrentIndex` callback rather than a fixed
 *  index — `runScript.ts` advances the same `MarketApi` instance's own notion of "now" bar by
 *  bar across the whole replay loop instead of rebuilding this object every iteration, which
 *  would be needless per-bar allocation for something that's otherwise stateless.
 *
 *  Every accessor's own `offset` is candles *back* from the current bar (0 = this bar, 1 =
 *  previous, matching the platform's own documented convention) — never forward. An offset that
 *  would land before bar 0 or *after* the current bar (a negative offset, or a request past
 *  `getCurrentIndex()`) returns `null` rather than the value: past-the-start is a real "no data
 *  yet" case every indicator's own warm-up period already reads as `null` the same way, and
 *  future-of-current-bar is exactly the data leak requirement #18 says a script must never be
 *  able to observe — returning `null` for both makes "ask for something that doesn't exist yet"
 *  and "ask for the future" fail identically and safely, with no special-casing needed at every
 *  call site to keep the second one from silently working. */
export function buildMarketApi(snapshot: ScriptEngineSnapshot, getCurrentIndex: () => number): MarketApi {
  const base = buildCandleAccessor(() => snapshot.ohlcv, getCurrentIndex);

  // Smallest positive gap among the last 20 base candles — a robust-enough "how fine is the base
  // data" estimate without the complexity of a real median: gaps are only ever *larger* than the
  // normal spacing (a weekend, a holiday), never smaller, so the minimum is never inflated by them
  // the way a plain average would be.
  function estimateBaseIntervalMs(): number | null {
    const currentIndex = getCurrentIndex();
    const from = Math.max(1, currentIndex - 20);
    let min = Infinity;
    for (let i = from; i <= currentIndex; i++) {
      const gap = snapshot.ohlcv[i].t - snapshot.ohlcv[i - 1].t;
      if (gap > 0 && gap < min) min = gap;
    }
    return Number.isFinite(min) ? min : null;
  }

  // Groups snapshot.ohlcv[0..currentIndex] into calendar-aligned buckets of `intervalMs` each
  // (open=first/high=max/low=min/close=last/volume=sum) — standard OHLCV resampling, bucketed by
  // wall-clock boundary rather than a fixed count of base bars per group so it stays correct
  // across gaps (weekends, closed sessions) instead of silently misaligning after one.
  function resampleCandles(intervalMs: number): ScriptEngineSnapshotCandle[] {
    const currentIndex = getCurrentIndex();
    const buckets: ScriptEngineSnapshotCandle[] = [];
    for (let i = 0; i <= currentIndex; i++) {
      const candle = snapshot.ohlcv[i];
      const bucketStart = Math.floor(candle.t / intervalMs) * intervalMs;
      const last = buckets[buckets.length - 1];
      if (last && last.t === bucketStart) {
        last.h = Math.max(last.h, candle.h);
        last.l = Math.min(last.l, candle.l);
        last.c = candle.c;
        if (typeof candle.v === "number") last.v = (last.v ?? 0) + candle.v;
      } else {
        buckets.push({ t: bucketStart, o: candle.o, h: candle.h, l: candle.l, c: candle.c, v: candle.v });
      }
    }
    return buckets;
  }

  return {
    ...base,
    availableTimeframes: () => snapshot.availableTimeframes,
    resample: (interval) => {
      const intervalMs = parseIntervalMs(interval);
      if (intervalMs === null) return ALL_NULL_RESAMPLED_API;
      const baseIntervalMs = estimateBaseIntervalMs();
      if (baseIntervalMs !== null && intervalMs < baseIntervalMs) return ALL_NULL_RESAMPLED_API;
      const buckets = resampleCandles(intervalMs);
      if (buckets.length === 0) return ALL_NULL_RESAMPLED_API;
      return buildCandleAccessor(() => buckets, () => buckets.length - 1);
    },
  };
}

/** One indicator's own accessor object, as returned by `chart.indicator(id)` — every method is
 *  present regardless of which of `IndicatorValue`'s shapes this particular indicator actually
 *  has, since a script's own `id` argument is a runtime string, not something TypeScript can
 *  narrow at the call site the way it could if the shape were known ahead of time. Calling an
 *  accessor that doesn't match the indicator's real shape (`.line()` on an RSI, `.upper()` on a
 *  MACD) returns `null` rather than throwing — a script author experimenting with an unfamiliar
 *  indicator gets a quiet "not applicable" instead of an aborted run over what's really just a
 *  mismatched accessor choice, not a bug worth stopping for.
 *
 *  Deliberately covers only the shapes explicitly named in the platform's own spec (a plain
 *  number, MACD's line/signal/histogram, a band's upper/middle/lower, ADX's adx/plusDI/minusDI)
 *  — `IndicatorValue`'s other variants (ZigZag points, Ichimoku, gaps, pivot levels, chandelier
 *  stops, support/resistance levels, pattern/candle matches) aren't one-value-per-bar readings in
 *  the same sense and have no obvious `.value()` equivalent; extending this table to cover one is
 *  a self-contained addition here whenever a concrete need for it shows up, not a redesign. */
export interface ScriptIndicatorHandle {
  /** A plain-number indicator's own reading — for a band-shaped one, its middle line (same
   *  "band's `.value()` is its middle" convention this library's own hover badges already use,
   *  see ChartHoverBadges.tsx). `null` for every other shape. */
  value(offset?: number): number | null;
  line(offset?: number): number | null;
  signal(offset?: number): number | null;
  histogram(offset?: number): number | null;
  upper(offset?: number): number | null;
  middle(offset?: number): number | null;
  lower(offset?: number): number | null;
  adx(offset?: number): number | null;
  plusDI(offset?: number): number | null;
  minusDI(offset?: number): number | null;
}

export interface ChartApi {
  indicator(id: string): ScriptIndicatorHandle;
  listIndicators(): string[];
}

function isMacdShaped(v: IndicatorValue): v is { macd: number; signal: number | null; histogram: number | null } {
  return typeof v === "object" && v !== null && "macd" in v;
}
function isBandShaped(v: IndicatorValue): v is { upper: number; middle: number; lower: number } {
  return typeof v === "object" && v !== null && "upper" in v && "middle" in v;
}
function isAdxShaped(v: IndicatorValue): v is { adx: number; plusDI: number; minusDI: number } {
  return typeof v === "object" && v !== null && "plusDI" in v;
}

const MISSING_INDICATOR_HANDLE: ScriptIndicatorHandle = {
  value: () => null,
  line: () => null,
  signal: () => null,
  histogram: () => null,
  upper: () => null,
  middle: () => null,
  lower: () => null,
  adx: () => null,
  plusDI: () => null,
  minusDI: () => null,
};

/** `chart.*`, closed over the snapshot and the same `getCurrentIndex` callback `market.*` shares
 *  — `chart.indicator("rsi_14").value(1)` and `market.close(1)` reading the same bar for the same
 *  reason `market.*`'s own offsets do (see buildMarketApi's own doc): both are ultimately just
 *  array lookups at `getCurrentIndex() - offset` against arrays built from the *same* main-thread
 *  pass. Asking for an id that doesn't exist on this chart returns an all-`null` handle (see
 *  `MISSING_INDICATOR_HANDLE`) rather than throwing — `chart.listIndicators()` exists precisely
 *  so a script can check first, but a typo shouldn't abort a whole run either. */
export function buildChartApi(snapshot: ScriptEngineSnapshot, getCurrentIndex: () => number): ChartApi {
  function handleFor(series: (IndicatorValue | null)[]): ScriptIndicatorHandle {
    function at(offset: number): IndicatorValue | null {
      const index = getCurrentIndex() - offset;
      if (!Number.isFinite(offset) || index < 0 || index > getCurrentIndex()) return null;
      return series[index];
    }
    return {
      value: (offset = 0) => {
        const v = at(offset);
        if (v === null) return null;
        if (typeof v === "number") return v;
        if (isBandShaped(v)) return v.middle;
        return null;
      },
      line: (offset = 0) => {
        const v = at(offset);
        return v !== null && isMacdShaped(v) ? v.macd : null;
      },
      signal: (offset = 0) => {
        const v = at(offset);
        return v !== null && isMacdShaped(v) ? v.signal : null;
      },
      histogram: (offset = 0) => {
        const v = at(offset);
        return v !== null && isMacdShaped(v) ? v.histogram : null;
      },
      upper: (offset = 0) => {
        const v = at(offset);
        return v !== null && isBandShaped(v) ? v.upper : null;
      },
      middle: (offset = 0) => {
        const v = at(offset);
        return v !== null && isBandShaped(v) ? v.middle : null;
      },
      lower: (offset = 0) => {
        const v = at(offset);
        return v !== null && isBandShaped(v) ? v.lower : null;
      },
      adx: (offset = 0) => {
        const v = at(offset);
        return v !== null && isAdxShaped(v) ? v.adx : null;
      },
      plusDI: (offset = 0) => {
        const v = at(offset);
        return v !== null && isAdxShaped(v) ? v.plusDI : null;
      },
      minusDI: (offset = 0) => {
        const v = at(offset);
        return v !== null && isAdxShaped(v) ? v.minusDI : null;
      },
    };
  }

  return {
    indicator: (id) => {
      const series = snapshot.indicatorSeries[id];
      return series ? handleFor(series) : MISSING_INDICATOR_HANDLE;
    },
    listIndicators: () => Object.keys(snapshot.indicatorSeries),
  };
}
