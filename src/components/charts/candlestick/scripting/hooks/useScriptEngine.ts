import { useEffect, useRef, useState } from "react";
import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import type { ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import { computeIndicatorValues } from "../../indicators";
import { buildStableIndicatorIds } from "../stableIndicatorId";
import { HISTORICAL_REPLAY_TIMEOUT_MS, MAX_SERIES_LENGTH, REALTIME_TICK_TIMEOUT_MS } from "../constants";
// Vite's own `?worker` import suffix (typed via src/vite-env.d.ts's vite/client reference) —
// resolves to a Worker *constructor*, not the module's own exports.
import ScriptWorkerFactory from "../worker/scriptWorkerEntry?worker";

function buildSnapshot(
  data: Candle[],
  indicators: Indicator[],
  fundamentals: FundamentalDataPoint[] | undefined,
  scriptCode: string,
  timeoutMs: number
): ScriptEngineSnapshot {
  // Reuses `computeIndicatorValues` verbatim — the exact same function `useIndicatorPaneScales`
  // calls to produce what's actually drawn on the chart — rather than recomputing indicator
  // values some other way, so `chart.indicator(id).value(i)` can never read a different number
  // than what the chart itself shows at that same bar. `custom` (a caller's own CustomIndicatorDef,
  // via `Indicator.customData`) is skipped here on purpose: it's already a plain host-supplied
  // series, nothing a script gains anything by re-reading through this path, and it has no
  // `IndicatorKind`-based slug to derive in the first place.
  const slugsById = buildStableIndicatorIds(indicators);
  const indicatorSeries: ScriptEngineSnapshot["indicatorSeries"] = {};
  for (const indicator of indicators) {
    if (indicator.customData) continue;
    const slug = slugsById.get(indicator.id);
    if (!slug) continue;
    indicatorSeries[slug] = computeIndicatorValues(data, indicator, fundamentals);
  }
  return {
    ohlcv: data.map((d) => ({ t: d.date.getTime(), o: d.open, h: d.high, l: d.low, c: d.close, v: d.volume })),
    indicatorSeries,
    runUpToIndex: data.length - 1,
    scriptCode,
    limits: { timeoutMs, maxSeriesLength: MAX_SERIES_LENGTH },
  };
}

/** Runs one user script against `data`/`indicators` in its own sandboxed Worker — see the
 *  approved scripting-engine plan (`C:\Users\micha\.claude\plans\cheeky-purring-charm.md`) for
 *  the full architecture. Through M2: `market.*` and `chart.*` (built-in indicators only, read-
 *  only) — no `plot.*` output, `state`, or real-time re-trigger yet (M3-M4). `run()` is a manual
 *  trigger only, matching the platform's own "Run" button (see the plan's M5); M4 adds the
 *  `useEffect` that calls it automatically on `data` change for a real-time tick. */
export function useScriptEngine(data: Candle[], indicators: Indicator[], fundamentals: FundamentalDataPoint[] | undefined) {
  const [result, setResult] = useState<ScriptRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // A terminated Worker can't be reused (per the platform spec, not a choice made here) — every
  // stop/timeout path below both terminates whatever's currently running *and* immediately
  // constructs its replacement, so the next `run()` call always has somewhere to `postMessage`
  // into with no async "wait for a fresh worker to spin up" step in between.
  function replaceWorker(): Worker {
    workerRef.current?.terminate();
    const worker = new ScriptWorkerFactory();
    workerRef.current = worker;
    return worker;
  }

  useEffect(() => {
    workerRef.current = new ScriptWorkerFactory();
    return () => {
      clearPendingTimeout();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
    // Constructed once per hook instance — every run() call below reuses (or, after a
    // timeout/stop, replaces) this same ref rather than depending on it here.
  }, []);

  /** `isRealtimeTick` picks which of the two timeout constants applies — a full replay is
   *  expected to sometimes genuinely take a while, a single new bar's worth of re-evaluation
   *  isn't (see HISTORICAL_REPLAY_TIMEOUT_MS/REALTIME_TICK_TIMEOUT_MS's own docs). Both this and
   *  the timeout/respawn plumbing exist even though M1 has no real-time re-trigger driving this
   *  parameter yet (that's M4) — a run triggered by hand still deserves the same safety net a
   *  live one will. */
  function run(scriptCode: string, isRealtimeTick = false) {
    const worker = workerRef.current ?? replaceWorker();
    clearPendingTimeout();
    setRunning(true);
    const timeoutMs = isRealtimeTick ? REALTIME_TICK_TIMEOUT_MS : HISTORICAL_REPLAY_TIMEOUT_MS;

    worker.onmessage = (e: MessageEvent<ScriptRunResult>) => {
      clearPendingTimeout();
      setResult(e.data);
      setRunning(false);
    };
    // A script bug the try/catch inside runScript.ts didn't anticipate (an engine-level failure,
    // not an ordinary thrown error — those already come back as a normal ScriptRunResult) —
    // treated the same as a timeout: terminate, respawn, report as an error rather than letting
    // it reach the host's own onerror/crash the tab.
    worker.onerror = (e: ErrorEvent) => {
      clearPendingTimeout();
      replaceWorker();
      setResult({ error: { message: e.message || "Erreur inattendue du script." }, logs: [] });
      setRunning(false);
    };

    timeoutRef.current = setTimeout(() => {
      replaceWorker();
      setResult({ error: { message: "Le script a dépassé le délai d'exécution autorisé et a été arrêté." }, logs: [] });
      setRunning(false);
    }, timeoutMs);

    worker.postMessage(buildSnapshot(data, indicators, fundamentals, scriptCode, timeoutMs));
  }

  /** Interrupts whatever's currently running (or about to) — same terminate-and-respawn
   *  mechanism as a timeout, just user-initiated (the platform's own "Stop" button, see the
   *  plan's M5). */
  function stop() {
    clearPendingTimeout();
    replaceWorker();
    setRunning(false);
  }

  return { result, running, run, stop };
}
