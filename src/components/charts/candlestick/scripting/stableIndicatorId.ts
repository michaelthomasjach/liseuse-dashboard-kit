import type { Indicator } from "../interfaces/Indicator.interface";

// camelCase kind name -> snake_case slug segment ("parabolicSar" -> "parabolic_sar"), matching
// the platform's own documented examples (rsi_14, macd_12_26_9) rather than this library's own
// internal camelCase `IndicatorKind` spelling.
function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** The distinguishing settings worth folding into an indicator's own slug, kind by kind — only
 *  for kinds where a script author would plausibly need to tell two instances apart at a glance
 *  (two RSIs at different periods, two MACDs) or where `period` alone doesn't already do that
 *  job. Kinds not listed here fall back to bare `kind` (or `kind_period` when `period` actually
 *  varies anything about them) — the numeric-suffix dedup in `buildStableIndicatorIds` below
 *  keeps every slug unique regardless of how coarse a given kind's own naming is. */
function slugParts(indicator: Indicator): string[] {
  switch (indicator.kind) {
    case "macd":
      return [String(indicator.fastPeriod ?? 12), String(indicator.slowPeriod ?? 26), String(indicator.signalPeriod ?? 9)];
    case "bollinger":
      return [String(indicator.period), String(indicator.stdDev ?? 2)];
    case "correlation":
      return [indicator.correlationSymbol ?? "?", String(indicator.period)];
    case "ichimoku":
      return [String(indicator.ichimokuConversionPeriod ?? 9), String(indicator.ichimokuBasePeriod ?? 26), String(indicator.ichimokuSpanPeriod ?? 52)];
    case "pivotPoints":
      return [indicator.pivotType ?? "classic", indicator.pivotPeriod ?? "weekly"];
    case "zigzag":
      return [String(indicator.zigzagDeviation ?? 5)];
    case "gaps":
      return [String(indicator.gapsMinPercent ?? 0.1)];
    case "vwap":
    case "parabolicSar":
    case "custom":
      return [];
    default:
      return [String(indicator.period)];
  }
}

/** Derives a stable, script-facing id for every currently-active indicator — `Indicator.id`
 *  itself is an ephemeral `indicator-${n}` counter (see usePaneLayout's own `indicatorIdRef`),
 *  meaningless to a script author and not guaranteed to mean the same thing across sessions.
 *  Computed fresh from the *live* indicator list every time (memoized by the caller — see
 *  useStableIndicatorIds), not stored anywhere, so it never needs migrating when an indicator's
 *  own settings change.
 *
 *  Collisions (two RSI(14)'s, say) are resolved with a numeric suffix in indicator-array order —
 *  arbitrary but deterministic for a given `indicators` array, which is all `chart.indicator()`
 *  actually needs: the id just has to keep meaning "this one" for the duration of a run. */
export function buildStableIndicatorIds(indicators: Indicator[]): Map<string, string> {
  const seen = new Map<string, number>();
  const result = new Map<string, string>();
  for (const indicator of indicators) {
    const base = [snakeCase(indicator.kind), ...slugParts(indicator)].filter(Boolean).join("_");
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    result.set(indicator.id, count === 1 ? base : `${base}_${count}`);
  }
  return result;
}
