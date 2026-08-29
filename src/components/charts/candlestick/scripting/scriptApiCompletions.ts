/** One entry in the editor's own lightweight autocomplete list — a plain static table, not a real
 *  TypeScript language service (too heavy for what this needs: the sandboxed API surface is small
 *  and fixed, see `buildScriptApi.ts`/`buildPlotApi.ts`/`mathLib.ts`/`taLib.ts`/`buildStateApi.ts`/
 *  `buildAlertApi.ts`/`buildBarApi.ts` — this file is just those same names, spelled out once for
 *  the editor instead of introspected from them at runtime). Kept in sync by hand; a new API
 *  surface added to the engine should get an entry here too. */
export interface ScriptApiCompletion {
  label: string;
  type: "function" | "keyword";
  /** Shown in the completion popup's own detail column. */
  detail: string;
  /** Inserted instead of `label` when accepted, if it differs — every function entry gets its own
   *  parameter list here so accepting a completion leaves the cursor ready to fill in arguments
   *  rather than just the bare name. */
  apply?: string;
}

export const SCRIPT_API_COMPLETIONS: ScriptApiCompletion[] = [
  { label: "market.open", type: "function", detail: "(offset?) => number | null", apply: "market.open()" },
  { label: "market.high", type: "function", detail: "(offset?) => number | null", apply: "market.high()" },
  { label: "market.low", type: "function", detail: "(offset?) => number | null", apply: "market.low()" },
  { label: "market.close", type: "function", detail: "(offset?) => number | null", apply: "market.close()" },
  { label: "market.volume", type: "function", detail: "(offset?) => number | null", apply: "market.volume()" },
  { label: "market.time", type: "function", detail: "(offset?) => Date | null", apply: "market.time()" },
  {
    label: "market.series",
    type: "function",
    detail: '("open"|"high"|"low"|"close"|"volume", count?) => number[]',
    apply: 'market.series("close", 20)',
  },
  { label: "market.availableTimeframes", type: "function", detail: "() => string[]", apply: "market.availableTimeframes()" },
  { label: "chart.indicator", type: "function", detail: '(id) => handle — see chart.listIndicators()', apply: 'chart.indicator("rsi_14")' },
  { label: "chart.listIndicators", type: "function", detail: "() => string[]", apply: "chart.listIndicators()" },
  { label: ".value", type: "function", detail: "(offset?) => number | null — plain/band indicators" },
  { label: ".line", type: "function", detail: "(offset?) => number | null — MACD" },
  { label: ".signal", type: "function", detail: "(offset?) => number | null — MACD" },
  { label: ".histogram", type: "function", detail: "(offset?) => number | null — MACD" },
  { label: ".upper", type: "function", detail: "(offset?) => number | null — band" },
  { label: ".middle", type: "function", detail: "(offset?) => number | null — band" },
  { label: ".lower", type: "function", detail: "(offset?) => number | null — band" },
  { label: ".adx", type: "function", detail: "(offset?) => number | null — ADX" },
  { label: ".plusDI", type: "function", detail: "(offset?) => number | null — ADX" },
  { label: ".minusDI", type: "function", detail: "(offset?) => number | null — ADX" },
  { label: "plot.line", type: "function", detail: "(name, value, options?) — own pane", apply: 'plot.line("", )' },
  { label: "plot.area", type: "function", detail: "(name, value, options?) — own pane", apply: 'plot.area("", )' },
  { label: "plot.histogram", type: "function", detail: "(name, value, options?) — own pane", apply: 'plot.histogram("", )' },
  { label: "plot.overlay", type: "function", detail: "(name, value, options?) — price pane", apply: 'plot.overlay("", )' },
  { label: "plot.panel", type: "function", detail: "(name, value, options?) — own pane", apply: 'plot.panel("", )' },
  { label: "plot.signal", type: "function", detail: '("BUY"|"SELL" | {type,price?,color?,shape?})', apply: 'plot.signal("BUY")' },
  { label: "plot.point", type: "function", detail: "(value, options?)", apply: "plot.point()" },
  { label: "plot.horizontal", type: "function", detail: "(price, options?)", apply: "plot.horizontal()" },
  { label: "plot.vertical", type: "function", detail: "(options?)", apply: "plot.vertical()" },
  { label: "state.get", type: "function", detail: "(key, defaultValue?) => any", apply: 'state.get("", )' },
  { label: "state.set", type: "function", detail: "(key, value) => void", apply: 'state.set("", )' },
  { label: "alert", type: "function", detail: "(message) => void", apply: "alert()" },
  { label: "bar.isNew", type: "function", detail: "() => boolean", apply: "bar.isNew()" },
  { label: "bar.isClosed", type: "function", detail: "() => boolean", apply: "bar.isClosed()" },
  { label: "bar.isRealtime", type: "function", detail: "() => boolean", apply: "bar.isRealtime()" },
  { label: "math.sma", type: "function", detail: "(values, period) => number | null", apply: "math.sma(, )" },
  { label: "math.ema", type: "function", detail: "(values, period) => number | null", apply: "math.ema(, )" },
  { label: "math.std", type: "function", detail: "(values) => number | null", apply: "math.std()" },
  { label: "math.variance", type: "function", detail: "(values) => number | null", apply: "math.variance()" },
  { label: "math.mean", type: "function", detail: "(values) => number | null", apply: "math.mean()" },
  { label: "math.median", type: "function", detail: "(values) => number | null", apply: "math.median()" },
  { label: "math.percentile", type: "function", detail: "(values, p) => number | null", apply: "math.percentile(, )" },
  { label: "math.zscore", type: "function", detail: "(values) => number | null", apply: "math.zscore()" },
  { label: "math.correlation", type: "function", detail: "(a, b) => number | null", apply: "math.correlation(, )" },
  { label: "math.covariance", type: "function", detail: "(a, b) => number | null", apply: "math.covariance(, )" },
  { label: "math.min", type: "function", detail: "(values) => number | null", apply: "math.min()" },
  { label: "math.max", type: "function", detail: "(values) => number | null", apply: "math.max()" },
  { label: "math.abs", type: "function", detail: "(x) => number", apply: "math.abs()" },
  { label: "math.sqrt", type: "function", detail: "(x) => number", apply: "math.sqrt()" },
  { label: "math.pow", type: "function", detail: "(x, y) => number", apply: "math.pow(, )" },
  { label: "math.exp", type: "function", detail: "(x) => number", apply: "math.exp()" },
  { label: "math.log", type: "function", detail: "(x) => number", apply: "math.log()" },
  { label: "ta.sma", type: "function", detail: "(values, period) => number | null", apply: "ta.sma(, )" },
  { label: "ta.ema", type: "function", detail: "(values, period) => number | null", apply: "ta.ema(, )" },
  { label: "ta.rsi", type: "function", detail: "(values, period) => number | null", apply: "ta.rsi(, )" },
  { label: "ta.roc", type: "function", detail: "(values, period) => number | null", apply: "ta.roc(, )" },
  { label: "ta.atr", type: "function", detail: "(high, low, close, period) => number | null", apply: "ta.atr(, , , )" },
  { label: "ta.macd", type: "function", detail: "(values, fast?, slow?, signal?) => {macd,signal,histogram} | null", apply: "ta.macd()" },
  { label: "ta.bollinger", type: "function", detail: "(values, period?, stdDev?) => {upper,middle,lower} | null", apply: "ta.bollinger()" },
  { label: "ta.stochastic", type: "function", detail: "(high, low, close, period?, signalPeriod?) => {k,d} | null", apply: "ta.stochastic(, , )" },
  { label: "ta.adx", type: "function", detail: "(high, low, close, period?) => {adx,plusDI,minusDI} | null", apply: "ta.adx(, , )" },
];
