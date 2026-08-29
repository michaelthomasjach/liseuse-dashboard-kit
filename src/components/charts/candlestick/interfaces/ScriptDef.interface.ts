/** One user-authored script, as seen from outside this library — see
 *  `CandlestickChartProps.defaultScripts`/`onScriptsChange`, the same uncontrolled-state
 *  convention `defaultIndicators`/`onIndicatorsChange` and `defaultDrawings`/`onDrawingsChange`
 *  already follow (the library owns the array's own lifecycle — add/edit/remove/reorder — and
 *  just reports it back on every change, rather than the caller driving it turn by turn). */
export interface ScriptDef {
  id: string;
  /** Shown in the script list/editor tab, not read by the engine itself. */
  name: string;
  code: string;
  /** A disabled script is kept (editable, savable) but never run — no Worker spun up for it, no
   *  contribution to `scriptIndicators`/`scriptDrawings`. Default true. */
  enabled?: boolean;
}
