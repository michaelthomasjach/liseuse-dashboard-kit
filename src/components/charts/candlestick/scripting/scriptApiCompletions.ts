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
  // Not part of the injected sandbox API like everything below it: `Variable` is resolved away
  // before the script ever compiles (see scriptVariables.ts). It's listed here because from the
  // author's point of view it's just another name they type.
  {
    label: "@description",
    type: "keyword",
    detail: "\"…\" — texte d'aide du script, affiché derrière le « ? » de l'en-tête de pane",
    apply: '@description ""',
  },
  {
    label: "Variable",
    type: "keyword",
    detail:
      '(type, défaut, { description?, min?, max? }) — paramètre réglable : "string" | "number" | "boolean" | "Array[string]" | "Array[number]" | "color". min/max uniquement pour "number".',
    apply: 'new Variable("number", 1, { description: "" })',
  },
  // Also resolved away before compilation, like Variable itself — but instead of only ever being
  // substituted into the code, this one specific name is also read directly by useScriptEngine to
  // pace its own live-tick re-trigger (see that hook's own `debounceMs` doc). Every other declared
  // name has no meaning to the engine beyond its own substituted value.
  {
    label: "DEBOUNCE_MS",
    type: "keyword",
    detail:
      'const DEBOUNCE_MS = new Variable("number", 300) — délai (ms) d\'anti-rafale avant un recalcul déclenché par un tick de marché en direct sur la bougie en formation. 0 = aucun anti-rafale. Sans effet sur le replay ou une nouvelle bougie. Défaut 300 si non déclaré.',
    apply: 'const DEBOUNCE_MS = new Variable("number", 300, { min: 0 });',
  },
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
  { label: "market.resample", type: "function", detail: '("5m"|"15m"|"1h"|"4h"|"1d"|...) => handle for another timeframe', apply: 'market.resample("1h")' },
  { label: "chart.indicator", type: "function", detail: '(id) => handle — see chart.listIndicators()', apply: 'chart.indicator("rsi")' },
  { label: "chart.listIndicators", type: "function", detail: "() => string[]", apply: "chart.listIndicators()" },
  { label: ".value", type: "function", detail: "(offset?) => number | null — plain/band indicators" },
  { label: ".line", type: "function", detail: "(offset?) => number | null — MACD  ·  (name, value, options?) — pane.line/overlay.line" },
  { label: ".signal", type: "function", detail: "(offset?) => number | null — MACD" },
  { label: ".histogram", type: "function", detail: "(offset?) => number | null — MACD  ·  (name, value, options?) — pane.histogram/overlay.histogram" },
  {
    label: ".profile",
    type: "function",
    detail: "(nom, valeurs, prix, options?) — profil tourné à 90°, sur un panneau ancré à gauche/droite",
    apply: 'profile("Densité", valeurs, prix)',
  },
  { label: ".upper", type: "function", detail: "(offset?) => number | null — band" },
  { label: ".middle", type: "function", detail: "(offset?) => number | null — band" },
  { label: ".lower", type: "function", detail: "(offset?) => number | null — band" },
  { label: ".adx", type: "function", detail: "(offset?) => number | null — ADX" },
  { label: ".plusDI", type: "function", detail: "(offset?) => number | null — ADX" },
  { label: ".minusDI", type: "function", detail: "(offset?) => number | null — ADX" },
  {
    label: "plot.pane",
    type: "function",
    detail: '(name, { dock? }) => handle — sub-pane dédié (bottom/left/right), dessiner via .line/.area/.histogram/.band/.label/.profile',
    apply: 'plot.pane("")',
  },
  {
    label: "plot.overlay",
    type: "function",
    detail: "(name) => handle — pane prix, dessiner via .line/.area/.histogram/.band/.label",
    apply: 'plot.overlay("")',
  },
  { label: ".area", type: "function", detail: "(name, value, options?) — pane.area/overlay.area" },
  { label: ".band", type: "function", detail: "(name, upper, lower, options?) — pane.band/overlay.band, remplit entre deux courbes" },
  {
    label: ".label",
    type: "function",
    detail: "(name, texte, { x, y, unit?, rotation?, ... }) — pane.label/overlay.label, élément positionné librement",
    apply: '.label("", "", { x: 50, y: 50 })',
  },
  { label: "plot.signal", type: "function", detail: '("BUY"|"SELL" | {type,price?,color?,shape?})', apply: 'plot.signal("BUY")' },
  { label: "plot.point", type: "function", detail: "(value, options?)", apply: "plot.point()" },
  { label: "plot.horizontal", type: "function", detail: "(price, options?)", apply: "plot.horizontal()" },
  { label: "plot.vertical", type: "function", detail: "(options?)", apply: "plot.vertical()" },
  { label: "plot.table", type: "function", detail: "(rows, options?) — table overlay anchored to a corner", apply: 'plot.table([], { title: "", columns: [] })' },
  {
    label: "plot.xy",
    type: "function",
    detail: '(name, x[], y[], options?) — graphique X/Y libre, mode notebook uniquement',
    apply: 'plot.xy("", [], [])',
  },
  { label: "state.get", type: "function", detail: "(key, defaultValue?) => any", apply: 'state.get("", )' },
  { label: "state.set", type: "function", detail: "(key, value) => void", apply: 'state.set("", )' },
  { label: "alert", type: "function", detail: "(message) => void", apply: "alert()" },
  { label: "console.log", type: "function", detail: "(...) => void — capturé dans la console de l'éditeur", apply: "console.log()" },
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
