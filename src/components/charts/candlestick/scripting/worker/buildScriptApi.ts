import type { ScriptEngineSnapshot, ScriptEngineSnapshotCandle } from "../interfaces/ScriptEngineSnapshot.interface";
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
