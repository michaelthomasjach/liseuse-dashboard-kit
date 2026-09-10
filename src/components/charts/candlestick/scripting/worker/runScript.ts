import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import type { QuantSymbolResult, ScriptError, ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import { buildMarketApi, buildChartApi } from "./buildScriptApi";
import { buildPlotApi } from "./buildPlotApi";
import { buildStateApi } from "./buildStateApi";
import { buildAlertApi } from "./buildAlertApi";
import { buildBarApi } from "./buildBarApi";
import { buildStrategyApi } from "./buildStrategyApi";
import { buildCompanyApi } from "./buildCompanyApi";
import { buildQuantPlotApi } from "./buildQuantPlotApi";
import { buildReportApi } from "./buildReportApi";
import { mathApi } from "./mathLib";
import { taApi } from "./taLib";
import { SCRIPT_MODULE_EXPORTS, SCRIPT_MODULE_REQUIRE, transformScriptModule } from "../scriptModules";

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
  // What a `@quant` script is handed instead — every method throws, naming what to do instead.
  const quantPlot = snapshot.report ? buildQuantPlotApi("report") : snapshot.quant ? buildQuantPlotApi("quant") : null;
  // The document a `@report` script writes into. Built only for that kind, the same gate every
  // other capability goes through: a script that never declared itself a report has no `report`
  // object, and calling it names what is missing.
  const { api: reportApi, getResult: getReport } = buildReportApi();
  const state = buildStateApi();
  const { api: alert, getAlerts } = buildAlertApi(getCurrentIndex, getCurrentDate);
  const bar = buildBarApi(snapshot, getCurrentIndex);
  // Built only when the host declared strategy settings — which it does only for a `@strategy`
  // script (see ScriptEngineSnapshot.strategySettings). An indicator gets `undefined` for the
  // `strategy` argument, so calling it is a plain TypeError naming the thing that's missing rather
  // than a silent no-op that leaves the author wondering why no trade ever appeared.
  const strategy = snapshot.strategySettings
    ? buildStrategyApi(snapshot.strategySettings, snapshot.ohlcv, getCurrentIndex)
    : null;
  const company = buildCompanyApi(snapshot, getCurrentIndex);

  // The module registry. Each extra file is compiled on its own `new Function` the first time it is
  // imported, then cached — so a file imported by three others runs once, exactly as a real module
  // would, and its own line numbers stay its own (a single bundled string would have shifted every
  // file after the first, and with it every error line the author sees).
  const moduleSources = new Map((snapshot.scriptModules ?? []).map((m) => [m.name, m.code]));
  const moduleCache = new Map<string, Record<string, unknown>>();
  const loading = new Set<string>();
  function requireModule(rawName: string): Record<string, unknown> {
    // "./levels", "levels" and "levels.js" all mean the same file — a script author should not
    // have to know which spelling the registry stores.
    const name = rawName.replace(/^\.\//, "").replace(/\.js$/, "");
    // Checked before the cache, not after: a module being imported while it is still evaluating is
    // already in the cache (as a half-built object), so a cache-first order would hand back exports
    // that are still empty and never fill in — real ESM resolves that with live bindings, which
    // `new Function` has none of, so a destructuring import would silently capture `undefined`.
    // Naming the cycle is the honest outcome.
    if (loading.has(name)) {
      throw new Error(`Import circulaire détecté sur "${name}" : ce fichier s'importe lui-même, directement ou via un autre fichier.`);
    }
    const cached = moduleCache.get(name);
    if (cached) return cached;
    const raw = moduleSources.get(name);
    if (raw === undefined) {
      throw new Error(`Fichier introuvable : "${rawName}". Fichiers de ce script : ${[...moduleSources.keys()].join(", ") || "(aucun)"}`);
    }
    const { code: source, diagnostics } = transformScriptModule(raw);
    if (diagnostics.length > 0) throw new Error(`${name} ligne ${diagnostics[0].line} : ${diagnostics[0].message}`);
    loading.add(name);
    const exports: Record<string, unknown> = {};
    moduleCache.set(name, exports);
    try {
      const factory = new RealFunction(
        SCRIPT_MODULE_EXPORTS,
        SCRIPT_MODULE_REQUIRE,
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
        source
      ) as (...args: unknown[]) => void;
      factory(exports, requireModule, market, chart, plot, state, alert, bar, company, mathApi, taApi, scriptConsole);
    } finally {
      loading.delete(name);
    }
    return exports;
  }

  type CompiledScript = (
    exports: unknown,
    requireModule: unknown,
    market: unknown,
    chart: unknown,
    plot: unknown,
    state: unknown,
    alert: unknown,
    bar: unknown,
    company: unknown,
    math: unknown,
    ta: unknown,
    console: unknown,
    strategy: unknown,
    report: unknown
    // `unknown` rather than `void`: on the quant path what the script returns *is* its output.
  ) => unknown;
  // The entry file goes through the same rewrite as any other — a single-file script simply has
  // nothing to rewrite, and comes back unchanged.
  const entry = transformScriptModule(snapshot.scriptCode);
  // Nothing imports the entry, so its exports go nowhere — the object exists only so that an
  // `export` written there is a no-op rather than a crash.
  const entryExports: Record<string, unknown> = {};
  if (entry.diagnostics.length > 0) {
    return {
      error: { message: entry.diagnostics[0].message, line: entry.diagnostics[0].line },
      logs,
      panes: [],
      drawings: [],
      table: null,
      xyCharts: [],
      alerts: [],
      labels: [],
      strategy: null,
      quant: null,
      report: null,
    };
  }

  let compiled: CompiledScript;
  try {
    compiled = new RealFunction(
      SCRIPT_MODULE_EXPORTS,
      SCRIPT_MODULE_REQUIRE,
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
      // `undefined` for an indicator, so `strategy.long(...)` there is a TypeError naming what is
      // missing. The name must be declared even then: omitted from this list it is not a parameter
      // at all, and the call below silently passes an argument the function never declared — which
      // is exactly how this shipped broken once, as a ReferenceError no type-check could catch.
      "strategy",
      "report",
      entry.code
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
      strategy: null,
      quant: null,
      report: null,
    };
  }

  // A report is a document, not a series: it runs once, positioned at the last bar so `market.*`
  // and `company.*` see the whole history, and what it writes through `report.*` is its output.
  if (snapshot.report) {
    currentIndex = snapshot.ohlcv.length - 1;
    try {
      compiled(entryExports, requireModule, market, chart, quantPlot, state, alert, bar, company, mathApi, taApi, scriptConsole, undefined, reportApi);
    } catch (err) {
      return {
        error: toScriptError(err),
        logs,
        panes: [],
        drawings: [],
        table: null,
        xyCharts: [],
        alerts: getAlerts(),
        labels: [],
        strategy: null,
        quant: null,
        // The partial document is kept for the same reason a partial backtest is: a report that
        // threw on its last section still wrote the ones before it, and those are most of the work.
        report: getReport(),
      };
    }
    return {
      error: null,
      logs,
      panes: [],
      drawings: [],
      table: null,
      xyCharts: [],
      alerts: getAlerts(),
      labels: [],
      strategy: null,
      quant: null,
      report: getReport(),
    };
  }

  // A quant analysis is not a series and has nothing to draw: it runs once per symbol, positioned
  // at that symbol's last bar so every `market.*` accessor sees the whole history, and what it
  // returns is the whole of its output. Handled before the per-bar loop rather than inside it,
  // because it is a different execution model, not a variation on one.
  if (snapshot.quant) {
    const rows: QuantSymbolResult[] = [];
    for (const symbol of snapshot.quant.symbols) {
      const series = snapshot.quant.series[symbol];
      if (series === undefined || series.length === 0) {
        rows.push({ symbol, value: undefined, error: { message: `Aucune donnée fournie pour ${symbol}.` } });
        continue;
      }
      // Indicator and fundamental series are computed from the host chart's own data, so they
      // belong to the host symbol alone — handing them to another company's run would answer a
      // question about the wrong company. Emptied rather than approximated.
      const isHost = symbol === snapshot.quant.hostSymbol;
      const symbolSnapshot: ScriptEngineSnapshot = {
        ...snapshot,
        ohlcv: series,
        runUpToIndex: series.length - 1,
        indicatorSeries: isHost ? snapshot.indicatorSeries : {},
        fundamentalSeries: isHost ? snapshot.fundamentalSeries : {},
        // `market.symbol()` answers with the symbol *being run*, not the chart's — a script
        // covering a list has no other way to know which one it is looking at.
        symbol,
      };
      currentIndex = series.length - 1;
      const symbolMarket = buildMarketApi(symbolSnapshot, getCurrentIndex);
      const symbolChart = buildChartApi(symbolSnapshot, getCurrentIndex);
      const symbolBar = buildBarApi(symbolSnapshot, getCurrentIndex);
      const symbolCompany = buildCompanyApi(symbolSnapshot, getCurrentIndex);
      try {
        const value = compiled(
          // A fresh exports object per symbol, so one symbol's run cannot see the last one's.
          {},
          requireModule,
          symbolMarket,
          symbolChart,
          quantPlot,
          state,
          alert,
          symbolBar,
          symbolCompany,
          mathApi,
          taApi,
          scriptConsole,
          undefined,
          undefined,
        );
        rows.push({ symbol, value });
      } catch (err) {
        // One symbol failing does not fail the run: the others still have answers, and losing them
        // because one ticker had no usable data would be the analysis punishing its author for the
        // host's own gaps.
        rows.push({ symbol, value: undefined, error: toScriptError(err) });
      }
    }
    return {
      error: null,
      logs,
      panes: [],
      drawings: [],
      table: null,
      xyCharts: [],
      alerts: getAlerts(),
      labels: [],
      strategy: null,
      quant: { rows, ranAt: Date.now() },
      report: null,
    };
  }

  for (let i = 0; i <= snapshot.runUpToIndex; i++) {
    currentIndex = i;
    try {
      compiled(entryExports, requireModule, market, chart, plot, state, alert, bar, company, mathApi, taApi, scriptConsole, strategy?.api, undefined);
      // After the bar's own pass, never during it: an order placed mid-script fills once, at this
      // bar's own price, no matter how many times the script changed its mind (see settleBar).
      strategy?.settleBar(snapshot.ohlcv[i], i + 1 < snapshot.ohlcv.length ? snapshot.ohlcv[i + 1] : null);
    } catch (err) {
      const { panes, drawings, table, xyCharts, labels } = getPlotResult();
      // The partial backtest is kept, not discarded: a strategy that threw on bar 900 still traded
      // 899 bars, and seeing where its equity was when it broke is most of the debugging.
      return {
        error: toScriptError(err),
        logs,
        panes,
        drawings: [...drawings, ...(strategy?.getMarkers() ?? [])],
        table,
        xyCharts,
        alerts: getAlerts(),
        labels,
        strategy: strategy?.getResult() ?? null,
        quant: null,
        report: null,
      };
    }
  }
  const { panes, drawings, table, xyCharts, labels } = getPlotResult();
  // Entry/exit markers ride the same drawing channel every `plot.signal` already uses — the chart
  // needs no notion of a "strategy marker" to paint them.
  return {
    error: null,
    logs,
    panes,
    drawings: [...drawings, ...(strategy?.getMarkers() ?? [])],
    table,
    xyCharts,
    alerts: getAlerts(),
    labels,
    strategy: strategy?.getResult() ?? null,
    quant: null,
    report: null,
  };
}
