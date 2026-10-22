import { useEffect, useRef, useState } from "react";
import type { Candle } from "../interfaces/Candle.interface";

export type BarRangeValue = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";

export interface BarRangeOption {
  value: BarRangeValue;
  label: string;
}

// Shown as-is, not translated — these are the same universal trading-platform abbreviations
// (TradingView, Boursorama, Yahoo Finance, ...) used even in their own French UIs.
export const BAR_RANGE_OPTIONS: BarRangeOption[] = [
  { value: "1D", label: "1D" },
  { value: "5D", label: "5D" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1Y" },
  { value: "5Y", label: "5Y" },
  { value: "All", label: "All" },
];

// Every range but YTD/All is a fixed day count, matching the simple day-multiple model the user
// specified directly (1M = 30 days, not a calendar month) rather than calendar-accurate spans.
const RANGE_DAYS: Partial<Record<BarRangeValue, number>> = {
  "1D": 1,
  "5D": 5,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "5Y": 365 * 5,
};

// `timeframe` is a freeform caller-supplied string (see TimeframeOption.interface). Recognised:
// "<n><unit>" with the short units this library's own stories use (1m/5m/15m minutes, 1h/4h hours,
// 1d days, 1w weeks, 1M months — case-sensitive: lowercase m is minutes, uppercase M is months) and
// the spelled-out ones apps commonly send ("5min", "1hour", "4hour", "1day", "1week", "1month").
// Anything else (or no timeframe at all) means the bars-per-day is unknowable, so callers should
// treat a `null` return as "can't compute a range for this timeframe."
export function barsPerDayForTimeframe(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+)\s*([a-zA-Z]+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!n || n <= 0) return null;
  const unit = match[2] as string;
  // "M" alone is a month; every other spelling is case-insensitive.
  if (unit === "M") return 1 / (30 * n);
  switch (unit.toLowerCase()) {
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return (24 * 60) / n;
    case "h":
    case "hr":
    case "hour":
    case "hours":
      return 24 / n;
    case "d":
    case "day":
    case "days":
      return 1 / n;
    case "w":
    case "wk":
    case "week":
    case "weeks":
      return 1 / (7 * n);
    case "mo":
    case "mon":
    case "month":
    case "months":
      return 1 / (30 * n);
    default:
      return null;
  }
}

// "Today" for YTD purposes is the most recent candle's own date, not the wall-clock date — a
// dataset doesn't necessarily extend all the way to the real "now" (historical/mock data), and
// anchoring to the data itself keeps YTD meaningful either way.
function daysForRange(range: Exclude<BarRangeValue, "All">, lastCandleDate: Date | undefined): number | null {
  if (range === "YTD") {
    if (!lastCandleDate) return null;
    const startOfYear = new Date(lastCandleDate.getFullYear(), 0, 1);
    return Math.max(1, (lastCandleDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  }
  return RANGE_DAYS[range] ?? null;
}

export interface UseBarRangeSelectionArgs {
  data: Candle[];
  timeframe: string | undefined;
  setVisibleCandleCount: (count: number) => void;
}

/** The header's "1D/5D/1M/.../All" range dropdown — translates a human-scale range into an
 *  actual visible-candle count via `setVisibleCandleCount` (see `useZoomAndScales`), using the
 *  current `timeframe` to derive bars-per-day (e.g. a 30-minute timeframe means 48 bars/day, so
 *  "1D" shows 48 candles, "5D" shows 5×48, ...). Mirrors `ChartHeader`'s own timeframe-dropdown
 *  state shape (`*Open`/`*AnchorRef`) so it renders the same way. */
export function useBarRangeSelection({ data, timeframe, setVisibleCandleCount }: UseBarRangeSelectionArgs) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<BarRangeValue | null>(null);
  const rangeAnchorRef = useRef<HTMLButtonElement>(null);

  function applyRange(range: BarRangeValue) {
    setSelectedRange(range);
    setRangeOpen(false);
    if (data.length === 0) return;
    if (range === "All") {
      setVisibleCandleCount(data.length);
      return;
    }
    const barsPerDay = barsPerDayForTimeframe(timeframe);
    const days = daysForRange(range, data[data.length - 1]?.date);
    if (!barsPerDay || !days) return;
    setVisibleCandleCount(Math.max(1, Math.round(barsPerDay * days)));
  }

  // Re-applies the currently selected range whenever the timeframe changes, since a different
  // timeframe means a different bars-per-day for the same named range ("1D" on 30min isn't the
  // same candle count as "1D" on 1h) — skipped on mount so an initial `timeframe` doesn't fight
  // `initialVisibleCandles`'s own first-paint zoom, and a no-op while no range has been picked.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (selectedRange) applyRange(selectedRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  return {
    rangeOpen,
    setRangeOpen,
    rangeAnchorRef,
    selectedRange,
    applyRange,
    barRangeOptions: BAR_RANGE_OPTIONS,
  };
}
