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

/** What one script run hands back to the main thread, whether it ran to completion or failed
 *  partway through. `error` set means the run stopped at whichever bar triggered it — everything
 *  the script produced *before* that bar (once M3+ add plots/drawings/alerts) is still returned
 *  alongside it, same "show what you have, don't discard a partial result" reasoning this
 *  library's own indicator computations already follow (a warm-up period leaves early bars
 *  `null` rather than refusing to compute the rest). `logs` is `console.log` output captured
 *  during the run, in call order — a near-free debugging aid this engine has that Pine Script
 *  itself doesn't. */
export interface ScriptRunResult {
  error: ScriptError | null;
  logs: string[];
}
