import type { Indicator } from "../interfaces/Indicator.interface";

// camelCase kind name -> snake_case slug segment ("parabolicSar" -> "parabolic_sar"), matching
// the platform's own documented examples (rsi, macd, bollinger) rather than this library's own
// internal camelCase `IndicatorKind` spelling.
function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** The distinguishing settings worth folding into an indicator's own slug, kind by kind — only
 *  for kinds whose settings pick a genuinely different *identity* (a different symbol, a
 *  different flavor of calculation), never a plain numeric tuning knob (period, std dev,
 *  deviation…): a script author asking for "rsi" wants the RSI regardless of its period, so the
 *  id must stay `rsi` no matter how it's tuned. Kinds not listed here always fall back to bare
 *  `kind` — the numeric-suffix dedup in `buildStableIndicatorIds` below still keeps every slug
 *  unique when two same-kind indicators would otherwise collide (`rsi`, `rsi_2`). */
function slugParts(indicator: Indicator): string[] {
  switch (indicator.kind) {
    case "correlation":
      // A correlation against another symbol is a different *series*, not a retuned version of
      // the same one — worth keeping apart at a glance, unlike a period.
      return [indicator.correlationSymbol ?? "?"];
    case "pivotPoints":
      // classic/fibonacci and daily/weekly are different calculations, not tuning knobs.
      return [indicator.pivotType ?? "classic", indicator.pivotPeriod ?? "weekly"];
    default:
      return [];
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
