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

/** One `plot.line/area/histogram/overlay/panel` output, built up one point per bar as the script
 *  runs — every call to the same `name` during a run contributes one more point rather than
 *  creating a new series, so `plot.line("Quant Score", score)` called on every bar of a replay
 *  produces one continuous series by the time the run finishes, not one series per call.
 *  Deliberately shaped close to `CustomIndicatorDef` (`interfaces/CustomIndicatorDef.interface.ts`)
 *  — `scriptOutputToCustomIndicatorDef.ts` converts this directly into one, which is what lets a
 *  script's own output ride the *existing* indicator pane/legend/settings machinery with no
 *  changes to it at all. */
export interface ScriptPlotSeries {
  name: string;
  draw: "line" | "area" | "histogram";
  pane: "overlay" | "own";
  color?: string;
  points: { date: number; value: number }[];
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
  plots: ScriptPlotSeries[];
  drawings: ScriptDrawingOutput[];
  alerts: ScriptRunAlert[];
}
