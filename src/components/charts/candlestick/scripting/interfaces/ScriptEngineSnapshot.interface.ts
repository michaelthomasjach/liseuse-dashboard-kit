import type { IndicatorValue } from "../../interfaces/IndicatorValue.interface";

/** One candle, flattened to a plain JSON-safe shape for `structuredClone`-based `postMessage` —
 *  `Candle`'s own `date: Date` survives structured clone fine on its own, but keeping the
 *  snapshot itself fully plain (no `Date` instances, no class prototypes) means it round-trips
 *  identically whether it ever actually crosses a `postMessage` boundary or not, which matters
 *  once this same snapshot shape gets reused for a same-thread test harness or a future stricter
 *  sandbox backend that may not offer structured clone at all (see ScriptEngineSnapshot's own
 *  doc). `t` is epoch milliseconds — `market.time()` reconstructs a real `Date` from it on the
 *  worker side, where doing so is cheap and only ever needed for whichever bars a script actually
 *  reads. */
export interface ScriptEngineSnapshotCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

/** Everything one script run needs, computed on the main thread and posted into the Worker
 *  exactly once — no further communication happens until the Worker posts back its own
 *  `ScriptRunResult`. This is what makes "same bar, every series" (the platform's own
 *  synchronization requirement) true by construction rather than by runtime coordination: every
 *  field below is derived from the *same* `data`/`indicatorValues` pass on the main thread, so
 *  `ohlcv[i]` and `indicatorSeries[slug][i]` can never drift apart mid-run.
 *
 *  Deliberately plain data, no functions/closures — this is exactly what gets structured-cloned
 *  across the `postMessage` boundary, so anything that can't survive that (a class instance, a
 *  DOM node, a function) has no business being a field here. */
export interface ScriptEngineSnapshot {
  /** The visible OHLCV history, index-aligned with the main thread's own `data`/`visible` — the
   *  same index space every `market.*`/`chart.indicator()` accessor reads from inside the
   *  Worker. */
  ohlcv: ScriptEngineSnapshotCandle[];
  /** Every currently-active *built-in* indicator's own computed series, keyed by its stable
   *  script-facing slug (see `stableIndicatorId.ts` — `"rsi_14"`, not the ephemeral
   *  `Indicator.id`). A script-authored indicator (one script's own `plot.*` output feeding
   *  another script, per the deferred requirement #21) deliberately never appears here — see
   *  the plan's own doc on why that's excluded, not just out of scope yet. */
  indicatorSeries: Record<string, (IndicatorValue | null)[]>;
  /** The last index to replay this run — always `ohlcv.length - 1` for both a full historical
   *  replay and a single real-time tick (a tick is just "replay ending one bar later," not a
   *  separate code path — see runScript's own doc). */
  runUpToIndex: number;
  /** The user's own script source, compiled fresh inside the Worker via `new Function` on every
   *  run (see runScript.ts) — never persisted or cached Worker-side across runs, so a script edit
   *  always takes effect on its very next run with no stale-closure risk. */
  scriptCode: string;
  limits: {
    /** Milliseconds the main thread waits before `.terminate()`-ing an in-flight run — see
     *  useScriptEngine's own timeout/respawn handling. Not enforced inside the Worker itself
     *  (there's no reliable way for a script to interrupt its own infinite loop); this is a
     *  main-thread-only backstop. */
    timeoutMs: number;
    /** Hard cap on how many points `market.series()` ever returns, regardless of what a script
     *  asks for — the one place a script could otherwise demand an unbounded amount of work/
     *  memory from a single call. */
    maxSeriesLength: number;
  };
  /** Whether `ohlcv`'s own last candle is still actively forming (host-controlled — this library
   *  never decides on its own whether the market is open) — read by `bar.isClosed()`. Defaults to
   *  `false` (every bar reported closed) when the host doesn't say otherwise, the conservative
   *  choice: a script gating on `bar.isClosed()` should not fire early just because the caller
   *  forgot to set this. */
  lastCandleOpen?: boolean;
  /** Whether *this run* is a live re-trigger (one more bar appended to an already-replayed
   *  script) rather than a full historical replay or a manual Run — read by `bar.isRealtime()`.
   *  Set by `useScriptEngine`'s own `run(code, isRealtimeTick)`, never by the script itself. */
  isRealtimeTick?: boolean;
  /** Every timeframe value the host chart's own `CandlestickChartProps.timeframes` picker offers
   *  (flattened via `flattenTimeframeValues` — see that function's own doc), read by
   *  `market.availableTimeframes()` (exigence #25). Inspection only — a script reading *another*
   *  timeframe's own data is the deferred multi-timeframe requirement (#20), explicitly out of v1
   *  scope per the approved plan; this just answers "what timeframes exist" the same way
   *  `chart.listIndicators()` answers "what indicators exist" without granting access to either. */
  availableTimeframes: string[];
}
