import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { ScriptPlotSeries } from "./interfaces/ScriptRunResult.interface";

/** One `plot.line/area/histogram/overlay/panel` output, converted into the exact shape
 *  `CandlestickChartProps.customIndicators` already accepts — this is the whole reason a script
 *  can produce a real chart pane/legend entry with zero changes to `indicators.ts`,
 *  `IndicatorKind`, or any rendering code: a `CustomIndicatorDef` was always meant to be "some
 *  series from outside this library's own built-in catalog," and a script's own output is exactly
 *  that, just generated at runtime instead of passed in as a static prop.
 *
 *  A deterministic id (`script:<scriptId>:<plotName>`, slugified) rather than a fresh one per
 *  conversion — every re-run of the same script produces the *same* id for the *same* named plot,
 *  so the caller can upsert-by-id into its own `customIndicators` array (replacing the previous
 *  run's version in place) instead of the array growing forever across runs. */
export function scriptOutputToCustomIndicatorDef(scriptId: string, plot: ScriptPlotSeries): CustomIndicatorDef {
  const slug = plot.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plot";
  return {
    id: `script:${scriptId}:${slug}`,
    label: plot.name,
    section: "Scripts",
    type: plot.pane === "overlay" ? "overlay" : "own",
    draw: plot.draw,
    data: plot.points.map((p) => ({ date: new Date(p.date), value: p.value })),
    color: plot.color,
  };
}

/** Every plot a run of `scriptId` produced, upserted into `existing` by id — a plot the script
 *  stopped emitting this run (its own name no longer among `plots`, e.g. an `if` branch that
 *  used to run stopped matching) still gets its *previous* entry removed here rather than left
 *  stale forever, same "a run's output fully replaces its own previous output" rule
 *  `scriptDrawingsToTrendLineDrawings`'s own doc follows for drawings. */
export function upsertScriptCustomIndicators(existing: CustomIndicatorDef[], scriptId: string, plots: ScriptPlotSeries[]): CustomIndicatorDef[] {
  const prefix = `script:${scriptId}:`;
  const kept = existing.filter((def) => !def.id.startsWith(prefix));
  return [...kept, ...plots.map((plot) => scriptOutputToCustomIndicatorDef(scriptId, plot))];
}
