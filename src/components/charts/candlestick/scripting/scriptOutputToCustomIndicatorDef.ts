import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import type { CustomIndicatorDef, CustomIndicatorMultiDataPoint } from "../interfaces/CustomIndicatorDef.interface";
import type { ScriptPaneSeries } from "./interfaces/ScriptRunResult.interface";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plot";
}

/** The deterministic id a `plot.pane`/`plot.overlay` output converts to as a `CustomIndicatorDef`
 *  (see `scriptPaneToCustomIndicatorDef`'s own doc) — extracted so `useScriptEngine.ts` can derive
 *  the exact same id for a `.label`'s own `paneName` when resolving which real on-screen "own"
 *  pane it belongs to (see `ScriptLabelOutput`'s own doc), rather than risking the two id formulas
 *  drifting apart if one were ever edited without the other. */
export function scriptPaneIndicatorId(scriptId: string, paneName: string): string {
  return `script:${scriptId}:${slugify(paneName)}`;
}

/** The inverse of `scriptPaneIndicatorId` — which script produced this indicator, or `null` for
 *  one that isn't script-produced at all. Shared rather than re-derived at each call site (the two
 *  pane-header components and the settings modal all need it) precisely because it has to keep
 *  agreeing with the formula right above it. */
export function scriptIdFromIndicatorId(indicatorId: string | undefined): string | null {
  if (!indicatorId?.startsWith("script:")) return null;
  return indicatorId.split(":")[1] ?? null;
}

/** What the "?" button should open the info modal about, for one indicator: the script that
 *  produced it when there is one (so the modal can show that script's own `@description`), and
 *  otherwise the plain kind, whose description is the built-in catalog's. Lives here, beside the id
 *  format it depends on, so the three headers/legends that draw that button all agree. */
export function infoTargetFor(indicator: Indicator): IndicatorInfoTarget {
  const scriptId = scriptIdFromIndicatorId(indicator.customData?.id);
  return scriptId === null ? indicator.kind : { scriptId };
}

/** One `plot.pane`/`plot.overlay` output, converted into the exact shape
 *  `CandlestickChartProps.customIndicators` already accepts — this is the whole reason a script
 *  can produce a real chart pane/legend entry with zero changes to `indicators.ts`,
 *  `IndicatorKind`, or any rendering code: a `CustomIndicatorDef` was always meant to be "some
 *  series from outside this library's own built-in catalog," and a script's own output is exactly
 *  that, just generated at runtime instead of passed in as a static prop.
 *
 *  A pane with exactly **one** of its own series converts to the exact same single-value shape
 *  this always produced (`draw: "line"/"area"/"histogram"/"band"`, plain `data`) — the pane's own
 *  name becomes the `label` (its one series' own name has no further role once there's nothing
 *  else in the pane to distinguish it from). A pane with **two or more** series converts to
 *  `draw: "multi"` instead — one `CustomIndicatorMultiDataPoint` per date the pane has *any* of its
 *  own series active on, `multiSeries` carrying each series' own style, and each series' own value
 *  keyed by `key` inside `values` only on the dates that series itself was actually called on that
 *  bar (computeCustomIndicatorValues forward-fills every key independently from there). This 1-vs-2+
 *  split keeps every existing single-series script (the common case) riding the *exact* same
 *  rendering/hover-badge/legend code as before this multi-series capability existed at all.
 *
 *  A deterministic id (`script:<scriptId>:<paneName>`, slugified) rather than a fresh one per
 *  conversion — every re-run of the same script produces the *same* id for the *same* named pane,
 *  so the caller can upsert-by-id into its own `customIndicators` array (replacing the previous
 *  run's version in place) instead of the array growing forever across runs. */
export function scriptPaneToCustomIndicatorDef(scriptId: string, pane: ScriptPaneSeries): CustomIndicatorDef {
  const id = scriptPaneIndicatorId(scriptId, pane.name);
  const type = pane.pane === "overlay" ? "overlay" : "own";

  // A profile short-circuits both branches below: its data is (price, value) pairs, not points on
  // dates, so neither the single-series `data` shape nor the date-keyed `multi` accumulation can
  // carry it. One profile makes the whole pane a profile pane — see PaneSeriesHandle.profile's own
  // doc on why anything else drawn alongside it is dropped rather than merged.
  const profileSeries = pane.series.find((series) => series.draw === "profile");
  if (profileSeries) {
    return {
      id,
      label: pane.name,
      section: "Scripts",
      type,
      dock: pane.dock,
      draw: "profile",
      data: [],
      profile: profileSeries.profile ?? [],
      profileHeadroom: profileSeries.profileHeadroom,
      color: profileSeries.color,
      lineWidth: profileSeries.lineWidth,
    };
  }

  if (pane.series.length === 1) {
    const series = pane.series[0];
    if (series.draw === "band") {
      const points = series.points as { date: number; upper: number; lower: number }[];
      return {
        id,
        label: pane.name,
        section: "Scripts",
        type,
        dock: pane.dock,
        draw: "band",
        data: points.map((p) => ({ date: new Date(p.date), upper: p.upper, lower: p.lower })),
        color: series.color,
        lineWidth: series.lineWidth,
      };
    }
    const points = series.points as { date: number; value: number }[];
    return {
      id,
      label: pane.name,
      section: "Scripts",
      type,
      dock: pane.dock,
      draw: series.draw,
      data: points.map((p) => ({ date: new Date(p.date), value: p.value })),
      color: series.color,
      lineWidth: series.lineWidth,
      lineStyle: series.lineStyle,
    };
  }

  // 2+ series sharing this one pane — one composite point per date any of them has a point on
  // (a plain `Map<date, {...}>` accumulation, then sorted, since the pane's own series were each
  // independently accumulated in their own call order/dates by buildPlotApi.ts).
  const byDate = new Map<number, CustomIndicatorMultiDataPoint>();
  for (const series of pane.series) {
    if (series.draw === "band") {
      for (const p of series.points as { date: number; upper: number; lower: number }[]) {
        const point = byDate.get(p.date) ?? { date: new Date(p.date), values: {} };
        point.values[series.key] = { upper: p.upper, lower: p.lower };
        byDate.set(p.date, point);
      }
    } else {
      for (const p of series.points as { date: number; value: number }[]) {
        const point = byDate.get(p.date) ?? { date: new Date(p.date), values: {} };
        point.values[series.key] = p.value;
        byDate.set(p.date, point);
      }
    }
  }
  const data = [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    id,
    label: pane.name,
    section: "Scripts",
    type,
    dock: pane.dock,
    draw: "multi",
    data,
    // `draw` is narrowed here, not cast: the profile short-circuit above already returned for any
    // pane holding one, so nothing reaching this point can be a profile — but the compiler can't
    // see that through `find`, and a cast would hide it if that ever stopped being true.
    multiSeries: pane.series.map((series) => ({
      key: series.key,
      label: series.name,
      draw: series.draw === "profile" ? "line" : series.draw,
      color: series.color,
      lineWidth: series.lineWidth,
      lineStyle: series.lineStyle,
    })),
  };
}

/** Every pane a run of `scriptId` produced, upserted into `existing` by id — a pane the script
 *  stopped emitting this run (its own name no longer among `panes`, e.g. an `if` branch that used
 *  to run stopped matching) still gets its *previous* entry removed here rather than left stale
 *  forever, same "a run's output fully replaces its own previous output" rule
 *  `scriptDrawingsToTrendLineDrawings`'s own doc follows for drawings. */
export function upsertScriptCustomIndicators(existing: CustomIndicatorDef[], scriptId: string, panes: ScriptPaneSeries[]): CustomIndicatorDef[] {
  const prefix = `script:${scriptId}:`;
  const kept = existing.filter((def) => !def.id.startsWith(prefix));
  return [...kept, ...panes.map((pane) => scriptPaneToCustomIndicatorDef(scriptId, pane))];
}
