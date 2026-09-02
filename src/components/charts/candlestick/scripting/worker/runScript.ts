import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import type { ScriptError, ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import { buildMarketApi, buildChartApi } from "./buildScriptApi";
import { buildPlotApi } from "./buildPlotApi";
import { buildStateApi } from "./buildStateApi";
import { buildAlertApi } from "./buildAlertApi";
import { buildBarApi } from "./buildBarApi";
import { buildCompanyApi } from "./buildCompanyApi";
import { mathApi } from "./mathLib";
import { taApi } from "./taLib";

// Captured at module-evaluation time — which, per ES module ordering, happens while
// scriptWorkerEntry.ts is still resolving its own imports, strictly before that file's own
// `lockDownGlobals()` call blocks the ambient `Function` global (see BLOCKED_GLOBALS' own doc).
// This module's one legitimate compile step below needs the *real* constructor even once a user
// script's own attempt to reach the (now-blocked) global one throws instead — without this, this
// file's own `new Function(...)` call would itself start throwing the moment the sandbox lockdown
// that's supposed to stop user code from doing exactly that also caught its own compiler.
const RealFunction = Function;

// `new Function(...paramNames, body)` wraps `body` in a synthetic `function anonymous(<params>
// ) {` header, always exactly 2 lines regardless of how many params there are (confirmed by
// dumping `fn.toString()` for both 0 and 6 params — V8 always breaks after the param list and
// again after the opening brace, never inlining `) {` onto the params' own line) — so a runtime
// error's own reported line number is always exactly 2 more than where it actually sits in the
// user's own script text; the column is untouched, since the offset is purely a matter of extra
// *lines*, not characters within them. Empirically confirmed to be the *same* 2-line offset on
// Firefox/SpiderMonkey too (dumped the real `err.stack` from inside an actual Worker, cross-engine,
// via Playwright — see the M6 commit for the methodology): despite a completely different stack
// *text* format from V8's, SpiderMonkey's own `> Function:LINE:COL` suffix reports the identical
// wrapperLine for the identical script, i.e. both engines converge on the same synthetic-wrapper
// shape even though ECMAScript doesn't mandate one. Safari/JavaScriptCore is the one real
// exception — see SPIDERMONKEY_LOCATION_RE's own doc below.
const WRAPPER_HEADER_LINES = 2;
// V8 (Chrome, Node, Edge, and this library's own Worker under Chromium): the offending frame reads
// `<anonymous>:LINE:COL` inside the stack's first `eval (...)` entry.
const V8_LOCATION_RE = /<anonymous>:(\d+):(\d+)/;
// SpiderMonkey (Firefox): no `<anonymous>` token at all — instead
// `anonymous@<url of the new Function() call site> line N > Function:LINE:COL`. `> Function:` is
// the literal, specific delimiter SpiderMonkey always uses for a stack frame originating inside a
// `new Function`-compiled body (confirmed via the same cross-engine Worker dump as above), chosen
// over a bare `Function:\d+:\d+` to avoid ever matching some unrelated frame that merely happens to
// mention a symbol named "Function".
const SPIDERMONKEY_LOCATION_RE = /> Function:(\d+):(\d+)/;
// JavaScriptCore (Safari/WebKit) is deliberately not handled here at all — dumped empirically as
// `anonymous@` with a genuinely empty url/line/col on every frame originating inside a
// `new Function`-compiled body. This isn't a parsing gap this file could close with a better
// pattern: the engine itself never records a source position for that case, so message-only is
// the correct, honest result on WebKit, not a limitation of this function.

/** Best-effort line/column for a runtime error thrown while executing the compiled script —
 *  `undefined` line/column (message-only) is a legitimate, honest result on every engine, not a
 *  bug: a `SyntaxError` from the `new Function` call itself never reaches here at all (no engine
 *  gives a usable position for those, see runScript's own catch block below), an error thrown from
 *  *inside* one of the injected API functions (rather than from the user's own script text) will
 *  have its own location-bearing frame missing from the stack, and Safari/WebKit never reports one
 *  at all (see SPIDERMONKEY_LOCATION_RE's own doc) — reporting no location is more honest than a
 *  wrong one in every one of these cases. */
function toScriptError(err: unknown): ScriptError {
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error) || !err.stack) return { message };
  const match = V8_LOCATION_RE.exec(err.stack) ?? SPIDERMONKEY_LOCATION_RE.exec(err.stack);
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
  const company = buildCompanyApi(snapshot, getCurrentIndex);

  type CompiledScript = (
    market: unknown,
    chart: unknown,
    plot: unknown,
    state: unknown,
    alert: unknown,
    bar: unknown,
    company: unknown,
    math: unknown,
    ta: unknown,
    console: unknown
  ) => void;
  let compiled: CompiledScript;
  try {
    compiled = new RealFunction(
      "market",
      "chart",
      "plot",
      "state",
      "alert",
      "bar",
      "company",
      "math",
      "ta",
      "console",
      snapshot.scriptCode
    ) as CompiledScript;
  } catch (err) {
    // A SyntaxError here carries no usable line/column at all (confirmed empirically — V8 reports
    // only "at new Function (<anonymous>)", no position) — message-only is the honest result.
    return {
      error: { message: err instanceof Error ? err.message : String(err) },
      logs,
      panes: [],
      drawings: [],
      table: null,
      xyCharts: [],
      alerts: [],
      labels: [],
    };
  }

  for (let i = 0; i <= snapshot.runUpToIndex; i++) {
    currentIndex = i;
    try {
      compiled(market, chart, plot, state, alert, bar, company, mathApi, taApi, scriptConsole);
    } catch (err) {
      const { panes, drawings, table, xyCharts, labels } = getPlotResult();
      return { error: toScriptError(err), logs, panes, drawings, table, xyCharts, alerts: getAlerts(), labels };
    }
  }
  const { panes, drawings, table, xyCharts, labels } = getPlotResult();
  return { error: null, logs, panes, drawings, table, xyCharts, alerts: getAlerts(), labels };
}
