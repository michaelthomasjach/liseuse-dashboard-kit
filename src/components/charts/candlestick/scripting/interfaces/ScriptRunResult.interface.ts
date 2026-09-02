/** A script error, with line/column when the engine can recover them — `new Function`-compiled
 *  code reports its own location relative to a synthetic wrapper the browser generates, not the
 *  user's script verbatim, so these are best-effort (calibrated empirically per engine — see
 *  runScript.ts's own doc) rather than guaranteed exact. `line`/`column` are 1-based, matching
 *  how a code editor already numbers them, so the UI (M5) can point at the offending line with no
 *  further translation. */
export interface ScriptError {
  message: string;
  line?: number;
  column?: number;
}

/** One `pane.line/area/histogram/band` call's own series within a `plot.pane`/`plot.overlay`
 *  group, built up one point per bar as the script runs — every call to the same `name` (within
 *  the same pane) during a run contributes one more point rather than creating a new series, so
 *  `pane.line("Quant Score", score)` called on every bar of a replay produces one continuous
 *  series by the time the run finishes, not one series per call. `key` is a slug of `name`, used
 *  to key into `IndicatorMultiSeriesValue.multi` once this pane has 2+ of its own series (see
 *  `scriptPaneToCustomIndicatorDef.ts`'s own doc for the 1-vs-2+ series split). */
export interface ScriptPaneSubSeries {
  key: string;
  name: string;
  draw: "line" | "area" | "histogram" | "band" | "profile";
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  points: { date: number; value: number }[] | { date: number; upper: number; lower: number }[];
  /** `draw: "profile"` only — the whole series at once, as (price, value) pairs, in place of the
   *  per-bar `points` above (which stays empty for it). A profile is not a time series: it is
   *  computed once over a price range, so it has no bar to attach each point to. `points` and this
   *  are mutually exclusive; see `PaneSeriesHandle.profile`'s own doc. */
  profile?: { price: number; value: number }[];
}

/** One `plot.pane(name)`/`plot.overlay(name)` output — a named group of 1+ of its own series (see
 *  `ScriptPaneSubSeries`), all sharing this one pane's own Y-scale (own-pane) or the price scale
 *  (overlay). `name` becomes the pane header's/legend entry's own label once converted to a
 *  `CustomIndicatorDef` (`scriptPaneToCustomIndicatorDef.ts`) — deliberately shaped close to that
 *  interface, which is what lets a script's own output ride the *existing* indicator
 *  pane/legend/settings machinery with no changes to it at all. */
export interface ScriptPaneSeries {
  name: string;
  pane: "overlay" | "own";
  /** `"own"` panes only — which edge of the chart this pane docks to (see `PlotPaneOptions`'s own
   *  doc). `undefined`/`"bottom"` stacks below price/volume, the original behavior; `"left"`/
   *  `"right"` docks it beside the chart instead, in its own resizable column. Never set on an
   *  `"overlay"` pane (the price section can't dock anywhere else). */
  dock?: "bottom" | "left" | "right";
  series: ScriptPaneSubSeries[];
}

/** One `plot.signal/point/horizontal/vertical` output — a single discrete marker at the bar it
 *  was emitted on, unlike `ScriptPlotSeries` above (one call = one point appended to a
 *  continuous series). Converts to a `TrendLineDrawing` via `scriptOutputToDrawings.ts`, reusing
 *  the exact marker/line shapes the drawing toolbar's own arrowUp/arrowDown/pin/horizontal/
 *  vertical tools already render — no new rendering primitive needed for any of this. `date` is
 *  epoch milliseconds, matching `ScriptEngineSnapshotCandle.t`'s own convention. */
export interface ScriptDrawingOutput {
  kind: "signal" | "point" | "horizontal" | "vertical";
  date: number;
  price?: number;
  /** "signal" only — `"BUY"`/`"SELL"` pick the marker's default direction (see
   *  scriptOutputToDrawings.ts); any other string is still recorded but falls back to a plain
   *  marker with no direction implied. */
  type?: string;
  color?: string;
  /** "signal"/"point" only — overrides the type-implied marker shape with one of this library's
   *  own drawing-tool names directly (`"arrowUp"`, `"pin"`, etc.) for a script author who wants
   *  more control than the BUY/SELL default gives. */
  shape?: string;
  /** "signal"/"point" only — a short label rendered next to the marker (same `TrendLineDrawing.text`
   *  every hand-drawn arrow/pin already supports) — `plot.signal("BUY")`'s own arrow shape implies
   *  a *direction*, not a caption; this is how a script puts an actual word like "BUY" next to it. */
  text?: string;
}

/** One `pane.label(...)`/`overlay.label(...)` output — a single element positioned in pixels or
 *  percent within its own pane (`paneName`/`paneType` identify which one — see
 *  `scriptPaneIndicatorId` in `scriptOutputToCustomIndicatorDef.ts`, the same id derivation used
 *  to resolve `paneType === "own"` to a real on-screen pane at render time), not tied to a bar
 *  index/value the way `pane.line`/`pane.area` are. "Latest call for this name wins" within its
 *  own pane, same as every other `PaneSeriesHandle` method (`buildPlotApi.ts`'s own
 *  `subSeriesByName`-style upsert) — a script that wants an always-current label just calls
 *  `.label(...)` unconditionally every bar, no `bar.isNew()` gating needed. */
export interface ScriptLabelOutput {
  paneName: string;
  paneType: "overlay" | "own";
  name: string;
  text: string;
  x: number;
  y: number;
  /** `"px"`/`"%"` position within the pane's own box; `"bar"` means `x` is a bar index and `y` a
   *  price on that pane's own scale, so the label tracks the data through pan and zoom (see
   *  `PlotLabelOptions.bar`). */
  unit: "px" | "%" | "bar";
  rotation: number;
  color?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
}

/** One `plot.xy(...)` output — a free-standing X/Y chart, decoupled from the bar-by-bar replay
 *  (see `PlotApi.xy`'s own doc): whole `x`/`y` arrays passed in one call, "latest call for this
 *  name wins" like `ScriptTableOutput`, not an accumulating per-bar series like `ScriptPaneSeries`.
 *  Never becomes a `CustomIndicatorDef` (unlike `ScriptPaneSeries`) — only ever rendered inline as
 *  a notebook cell's own output in the script editor, never on the real candlestick chart. */
export interface ScriptXYChartOutput {
  name: string;
  x: number[];
  y: number[];
  color?: string;
  draw?: "line" | "scatter";
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

/** One row of a `plot.table(...)` output — `color`, when set, tints every cell's own text in that
 *  row (a whole-row accent, e.g. green/red for a per-timeframe BUY/SELL read), not just one cell,
 *  since there's no single "special" column position this engine can assume every script means to
 *  highlight. */
export interface ScriptTableRow {
  cells: string[];
  color?: string;
}

/** One `plot.table(...)` output — unlike `ScriptPlotSeries` (accumulates one point per bar) or
 *  `ScriptDrawingOutput` (one entry per call, every call kept), a table is neither a continuous
 *  series nor a growing list of markers: it represents "the current state as of the bar that
 *  produced it" only, so `buildPlotApi.ts` keeps just the *most recent* call's own table rather
 *  than accumulating one per bar (same "latest wins" semantics `state.*` already has, not
 *  `plot.line`'s). A script that wants an always-current table simply calls `plot.table(...)`
 *  unconditionally every bar, same as any other continuous `plot.*` call — there's no need to gate
 *  it behind `bar.isNew()` the way a one-shot marker/alert would be. */
export interface ScriptTableOutput {
  title?: string;
  /** Header row labels — shown as-is above `rows`, purely cosmetic (this engine never validates
   *  that `columns.length` matches each row's own `cells.length`). */
  columns?: string[];
  rows: ScriptTableRow[];
  /** Which corner of the price pane this table anchors to. Default `"topRight"`. */
  position?: "topRight" | "topLeft" | "bottomRight" | "bottomLeft";
}

/** One `alert(message)` call, timestamped with whichever bar was current when the script made it
 *  — `date`/`barIndex` mirror `ScriptDrawingOutput`'s own conventions (epoch milliseconds, index
 *  into the same `ohlcv` the rest of this run's output is aligned to). Worker-side only; the host
 *  adds its own `scriptId` when this reaches `onScriptAlert` (M5), the same "engine output is
 *  script-agnostic, the host attaches identity" split `scriptOutputToCustomIndicatorDef.ts`
 *  already follows. */
export interface ScriptRunAlert {
  message: string;
  barIndex: number;
  date: number;
}

/** What one script run hands back to the main thread, whether it ran to completion or failed
 *  partway through. `error` set means the run stopped at whichever bar triggered it — everything
 *  the script produced *before* that bar is still returned alongside it, same "show what you
 *  have, don't discard a partial result" reasoning this library's own indicator computations
 *  already follow (a warm-up period leaves early bars `null` rather than refusing to compute the
 *  rest). `logs` is `console.log` output captured during the run, in call order — a near-free
 *  debugging aid this engine has that Pine Script itself doesn't. */
export interface ScriptRunResult {
  error: ScriptError | null;
  logs: string[];
  panes: ScriptPaneSeries[];
  drawings: ScriptDrawingOutput[];
  table: ScriptTableOutput | null;
  xyCharts: ScriptXYChartOutput[];
  alerts: ScriptRunAlert[];
  labels: ScriptLabelOutput[];
}
