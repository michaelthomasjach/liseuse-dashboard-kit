/** One `alert(message)` call from a running script, reported to the host via
 *  `CandlestickChartProps.onScriptAlert` — the host decides how it actually reaches the user
 *  (toast, sound, its own notification system); this library only ever produces the event. Mirrors
 *  the engine-internal `ScriptRunAlert` (`scripting/interfaces/ScriptRunResult.interface.ts`)
 *  field for field, plus `scriptId` (meaningless inside the Worker itself, which only ever runs
 *  one script and has no notion of its own id) and a real `Date` instead of that internal type's
 *  epoch-milliseconds `date`, matching every other host-facing timestamp in this library (see
 *  `ChartEvent.date`, `Candle.date`). */
export interface ScriptAlertEvent {
  scriptId: string;
  message: string;
  barIndex: number;
  date: Date;
}
