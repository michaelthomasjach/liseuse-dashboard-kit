import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";

export interface CompanyApi {
  /** One reported metric at the current bar, or `offset` bars back — `null` before the company's
   *  first report, and `null` for a metric the host never supplied at all. */
  value(field: string, offset?: number): number | null;
  /** Which metrics this chart actually has data for, so a script can adapt instead of guessing. */
  fields(): string[];
}

/** `company.*` — the fundamentals counterpart of `market.*`: what the company reported, read at
 *  the bar currently being replayed. Every metric arrives already forward-filled onto the bars (see
 *  `ScriptEngineSnapshot.fundamentalSeries`), so this is a plain bounded lookup with no projection
 *  logic of its own — which is exactly what keeps a script and the built-in fundamental panes
 *  showing the same figure on the same bar.
 *
 *  Bounded by `getCurrentIndex()` like every other accessor in this sandbox: a negative offset, or
 *  one reaching past the current bar, returns `null` rather than a future report. The no-future-leak
 *  guarantee is structural here too — the index simply cannot be moved forward from inside a
 *  script. */
export function buildCompanyApi(snapshot: ScriptEngineSnapshot, getCurrentIndex: () => number): CompanyApi {
  return {
    value: (field, offset = 0) => {
      const series = snapshot.fundamentalSeries[field];
      if (!series) return null;
      if (!Number.isFinite(offset) || offset < 0) return null;
      const index = getCurrentIndex() - Math.floor(offset);
      if (index < 0 || index >= series.length) return null;
      return series[index] ?? null;
    },
    fields: () => Object.keys(snapshot.fundamentalSeries),
  };
}
