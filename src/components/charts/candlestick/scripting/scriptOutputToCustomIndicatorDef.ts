import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { ScriptBandSeries, ScriptPlotSeries } from "./interfaces/ScriptRunResult.interface";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plot";
}

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
  return {
    id: `script:${scriptId}:${slugify(plot.name)}`,
    label: plot.name,
    section: "Scripts",
    type: plot.pane === "overlay" ? "overlay" : "own",
    draw: plot.draw,
    data: plot.points.map((p) => ({ date: new Date(p.date), value: p.value })),
    color: plot.color,
    lineWidth: plot.lineWidth,
    lineStyle: plot.lineStyle,
  };
}

/** One `plot.band/bandOverlay` output, converted the same way — `draw: "band"` is what routes it
 *  through `computeCustomIndicatorValues`'s own band branch (see that field's own doc), which is
 *  what lets a script's fill-between-two-curves ride the exact same rendering already built for
 *  Bollinger Bands with no new canvas code. Same deterministic id scheme as
 *  `scriptOutputToCustomIndicatorDef` (a band and a line/area/histogram plot can share a script
 *  without ever colliding, since both slugify from the same per-script id prefix). */
export function scriptBandToCustomIndicatorDef(scriptId: string, band: ScriptBandSeries): CustomIndicatorDef {
  return {
    id: `script:${scriptId}:${slugify(band.name)}`,
    label: band.name,
    section: "Scripts",
    type: band.pane === "overlay" ? "overlay" : "own",
    draw: "band",
    data: band.points.map((p) => ({ date: new Date(p.date), upper: p.upper, lower: p.lower })),
    color: band.color,
    lineWidth: band.lineWidth,
  };
}

/** Every plot/band a run of `scriptId` produced, upserted into `existing` by id — a plot/band the
 *  script stopped emitting this run (its own name no longer among `plots`/`bands`, e.g. an `if`
 *  branch that used to run stopped matching) still gets its *previous* entry removed here rather
 *  than left stale forever, same "a run's output fully replaces its own previous output" rule
 *  `scriptDrawingsToTrendLineDrawings`'s own doc follows for drawings. Plots and bands share one
 *  id prefix/namespace (both are just `CustomIndicatorDef`s once converted), so a single filter
 *  pass covers both. */
export function upsertScriptCustomIndicators(
  existing: CustomIndicatorDef[],
  scriptId: string,
  plots: ScriptPlotSeries[],
  bands: ScriptBandSeries[]
): CustomIndicatorDef[] {
  const prefix = `script:${scriptId}:`;
  const kept = existing.filter((def) => !def.id.startsWith(prefix));
  return [
    ...kept,
    ...plots.map((plot) => scriptOutputToCustomIndicatorDef(scriptId, plot)),
    ...bands.map((band) => scriptBandToCustomIndicatorDef(scriptId, band)),
  ];
}
