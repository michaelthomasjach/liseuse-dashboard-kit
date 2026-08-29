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

export interface MarketApi {
  open(offset?: number): number | null;
  high(offset?: number): number | null;
  low(offset?: number): number | null;
  close(offset?: number): number | null;
  volume(offset?: number): number | null;
  time(offset?: number): Date | null;
  series(field: SeriesField, count?: number): number[];
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
  function resolveIndex(offset: number): number | null {
    const index = getCurrentIndex() - offset;
    if (!Number.isFinite(offset) || index < 0 || index > getCurrentIndex()) return null;
    return index;
  }
  function field(key: SeriesField, offset: number): number | null {
    const index = resolveIndex(offset);
    if (index === null) return null;
    const value = snapshot.ohlcv[index][FIELD_KEY[key]];
    return typeof value === "number" ? value : null;
  }
  return {
    open: (offset = 0) => field("open", offset),
    high: (offset = 0) => field("high", offset),
    low: (offset = 0) => field("low", offset),
    close: (offset = 0) => field("close", offset),
    volume: (offset = 0) => field("volume", offset),
    time: (offset = 0) => {
      const index = resolveIndex(offset);
      return index === null ? null : new Date(snapshot.ohlcv[index].t);
    },
    series: (fieldName, count = MAX_SERIES_LENGTH) => {
      const currentIndex = getCurrentIndex();
      const clampedCount = Math.max(0, Math.min(count, MAX_SERIES_LENGTH));
      const start = Math.max(0, currentIndex - clampedCount + 1);
      const key = FIELD_KEY[fieldName];
      const result: number[] = [];
      for (let i = start; i <= currentIndex; i++) {
        const value = snapshot.ohlcv[i][key];
        if (typeof value === "number") result.push(value);
      }
      return result;
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
