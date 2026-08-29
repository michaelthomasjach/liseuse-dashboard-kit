import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import type { ScriptError, ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import { buildMarketApi, buildChartApi } from "./buildScriptApi";
import { buildPlotApi } from "./buildPlotApi";
import { buildStateApi } from "./buildStateApi";
import { buildAlertApi } from "./buildAlertApi";
import { buildBarApi } from "./buildBarApi";
import { mathApi } from "./mathLib";
import { taApi } from "./taLib";

// `new Function(...paramNames, body)` wraps `body` in a synthetic `function anonymous(<params>
// ) {` header, always exactly 2 lines regardless of how many params there are (confirmed by
// dumping `fn.toString()` for both 0 and 6 params — V8 always breaks after the param list and
// again after the opening brace, never inlining `) {` onto the params' own line) — so a runtime
// error's own reported line number is always exactly 2 more than where it actually sits in the
// user's own script text; the column is untouched, since the offset is purely a matter of extra
// *lines*, not characters within them. Calibrated against Node (V8) specifically — Worker/Chrome
// share the same engine, but this has NOT been re-verified against Firefox/SpiderMonkey or
// Safari/JavaScriptCore, which don't necessarily share V8's exact wrapper format (flagged in the
// approved plan as a real M6 task, not silently assumed universal).
const WRAPPER_HEADER_LINES = 2;
const STACK_LOCATION_RE = /<anonymous>:(\d+):(\d+)/;

/** Best-effort line/column for a runtime error thrown while executing the compiled script —
 *  `undefined` line/column (message-only) is a legitimate, honest result, not a bug: a
 *  `SyntaxError` from the `new Function` call itself never reaches here at all (V8 gives no
 *  usable position for those, see runScript's own catch block below), and an error thrown from
 *  *inside* one of the injected API functions (rather than from the user's own script text) will
 *  have its `<anonymous>` frame missing entirely from the stack, in which case reporting no
 *  location is more honest than reporting a wrong one. */
function toScriptError(err: unknown): ScriptError {
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error) || !err.stack) return { message };
  const match = STACK_LOCATION_RE.exec(err.stack);
  if (!match) return { message };
  const wrapperLine = Number(match[1]);
  const column = Number(match[2]);
  const line = wrapperLine - WRAPPER_HEADER_LINES;
  return line >= 1 ? { message, line, column } : { message };
}

/** Runs one script, once per bar from bar 0 through `snapshot.runUpToIndex` inclusive — the
 *  platform's own "script re-runs automatically every bar" model (matching the user-facing
 *  example syntax, plain top-level statements rather than an explicit per-bar callback the user
 *  has to wire up themselves). A historical replay and a single real-time tick are the exact
 *  same call: a tick is just a snapshot whose `runUpToIndex` is one bar further than the previous
 *  run's — there is no second "live" code path to keep in sync with this one.
 *
 *  Compiled once per call (not once per bar) — `new Function` is genuinely expensive relative to
 *  a plain function call, and the compiled function's own closures over `market`/(future)
 *  `chart`/`plot`/etc. only need constructing once regardless of how many bars it then runs
 *  against, since `buildMarketApi`'s own `getCurrentIndex` callback (not a fixed value baked in
 *  at construction time) is what actually varies per bar. */
export function runScript(snapshot: ScriptEngineSnapshot): ScriptRunResult {
  const logs: string[] = [];
  const scriptConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    },
  };

  let currentIndex = 0;
  const getCurrentIndex = () => currentIndex;
  const getCurrentDate = () => snapshot.ohlcv[currentIndex].t;
  const market = buildMarketApi(snapshot, getCurrentIndex);
  const chart = buildChartApi(snapshot, getCurrentIndex);
  const { api: plot, getResult: getPlotResult } = buildPlotApi(getCurrentDate, () => snapshot.ohlcv[currentIndex].c);
  const state = buildStateApi();
  const { api: alert, getAlerts } = buildAlertApi(getCurrentIndex, getCurrentDate);
  const bar = buildBarApi(snapshot, getCurrentIndex);

  type CompiledScript = (
    market: unknown,
    chart: unknown,
    plot: unknown,
    state: unknown,
    alert: unknown,
    bar: unknown,
    math: unknown,
    ta: unknown,
    console: unknown
  ) => void;
  let compiled: CompiledScript;
  try {
    compiled = new Function(
      "market",
      "chart",
      "plot",
      "state",
      "alert",
      "bar",
      "math",
      "ta",
      "console",
      snapshot.scriptCode
    ) as CompiledScript;
  } catch (err) {
    // A SyntaxError here carries no usable line/column at all (confirmed empirically — V8 reports
    // only "at new Function (<anonymous>)", no position) — message-only is the honest result.
    return { error: { message: err instanceof Error ? err.message : String(err) }, logs, plots: [], drawings: [], alerts: [] };
  }

  for (let i = 0; i <= snapshot.runUpToIndex; i++) {
    currentIndex = i;
    try {
      compiled(market, chart, plot, state, alert, bar, mathApi, taApi, scriptConsole);
    } catch (err) {
      const { plots, drawings } = getPlotResult();
      return { error: toScriptError(err), logs, plots, drawings, alerts: getAlerts() };
    }
  }
  const { plots, drawings } = getPlotResult();
  return { error: null, logs, plots, drawings, alerts: getAlerts() };
}
