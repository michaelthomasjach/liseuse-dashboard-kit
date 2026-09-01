import { useEffect, useRef, useState } from "react";
import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { CustomIndicatorDef } from "../../interfaces/CustomIndicatorDef.interface";
import type { TrendLineDrawing } from "../../interfaces/TrendLineDrawing.interface";
import type { ScriptTableOutput } from "../interfaces/ScriptRunResult.interface";
import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import type { ScriptRunResult } from "../interfaces/ScriptRunResult.interface";
import type { ResolvedScriptLabel } from "../interfaces/ScriptRunOutput.interface";
import { computeIndicatorValues } from "../../indicators";
import { buildStableIndicatorIds } from "../stableIndicatorId";
import { upsertScriptCustomIndicators, scriptPaneIndicatorId } from "../scriptOutputToCustomIndicatorDef";
import { upsertScriptDrawings } from "../scriptOutputToDrawings";
import {
  HISTORICAL_REPLAY_TIMEOUT_MS,
  MAX_SERIES_LENGTH,
  REALTIME_TICK_DEBOUNCE_MS,
  REALTIME_TICK_TIMEOUT_MS,
} from "../constants";
// Vite's own `?worker` import suffix (typed via src/vite-env.d.ts's vite/client reference) —
// resolves to a Worker *constructor*, not the module's own exports.
import ScriptWorkerFactory from "../worker/scriptWorkerEntry?worker";

function buildSnapshot(
  data: Candle[],
  indicators: Indicator[],
  fundamentals: FundamentalDataPoint[] | undefined,
  scriptCode: string,
  timeoutMs: number,
  lastCandleOpen: boolean,
  isRealtimeTick: boolean,
  availableTimeframes: string[]
,
  runUpToIndex: number
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
    runUpToIndex,
    scriptCode,
    limits: { timeoutMs, maxSeriesLength: MAX_SERIES_LENGTH },
    lastCandleOpen,
    isRealtimeTick,
    availableTimeframes,
  };
}

/** Runs one user script against `data`/`indicators` in its own sandboxed Worker — see the
 *  approved scripting-engine plan (`C:\Users\micha\.claude\plans\cheeky-purring-charm.md`) for
 *  the full architecture. Through M4: `market.*`/`chart.*` (read-only), `state.get/set`,
 *  `alert()`, `bar.isNew/isClosed/isRealtime`, and `plot.*` output converted into
 *  `scriptIndicators`/`scriptDrawings` (see scriptOutputToCustomIndicatorDef.ts/
 *  scriptOutputToDrawings.ts) every time a run completes, plus an automatic real-time re-trigger
 *  on `data` change. `alerts` aren't surfaced as their own hook state the way plots/drawings are
 *  — they're point-in-time events, not chart elements to keep displaying, so `result.alerts` is
 *  enough until M5 wires a real `onScriptAlert` prop up to them. This hook itself still only ever
 *  drives *one* script; the plan's own "one Worker per enabled script" orchestration across
 *  several scripts at once is M5's own concern, layered on top of this rather than rebuilding it.
 *  `lastCandleOpen` (default `false`, the conservative "every bar is closed" reading) is the only
 *  piece of "is the market live right now" knowledge this hook can't infer on its own — the host
 *  is the one source of truth for it, same reasoning `ScriptEngineSnapshot.lastCandleOpen`'s own
 *  doc gives. `availableTimeframes` (default `[]`) feeds `market.availableTimeframes()` — see that
 *  snapshot field's own doc for why this is inspection-only, not multi-timeframe data access. */
export function useScriptEngine(
  scriptId: string,
  data: Candle[],
  indicators: Indicator[],
  fundamentals: FundamentalDataPoint[] | undefined,
  lastCandleOpen = false,
  availableTimeframes: string[] = [],
  /** How far into `data` a run goes — the last bar the script is allowed to see. `null` means "the
   *  whole history", the normal case. Replay passes its own cutoff instead, which is what makes a
   *  script actually *replay*: it re-runs against history-up-to-there, so its own output is
   *  recomputed from only the bars visible at that point rather than staying pinned to what the
   *  full dataset produced. See CandlestickChart's own `scriptRunUpToIndex`. */
  runUpToIndex: number | null = null
) {
  // Clamped: a cutoff from a previous, longer dataset would otherwise run past the end of this one.
  const effectiveRunUpToIndex = runUpToIndex === null ? data.length - 1 : Math.max(0, Math.min(runUpToIndex, data.length - 1));

  const [result, setResult] = useState<ScriptRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [scriptIndicators, setScriptIndicators] = useState<CustomIndicatorDef[]>([]);
  const [scriptDrawings, setScriptDrawings] = useState<TrendLineDrawing[]>([]);
  const [scriptTable, setScriptTable] = useState<ScriptTableOutput | null>(null);
  const [scriptLabels, setScriptLabels] = useState<ResolvedScriptLabel[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The most recently *run* script code — `null` until `run()` has been called at least once.
  // Drives the real-time re-trigger effect below: a script the caller hasn't run yet has nothing
  // to auto-re-evaluate on the next `data` change.
  const lastScriptCodeRef = useRef<string | null>(null);

  function applyRunOutput(runResult: ScriptRunResult) {
    setResult(runResult);
    setScriptIndicators((prev) => upsertScriptCustomIndicators(prev, scriptId, runResult.panes));
    setScriptDrawings((prev) => upsertScriptDrawings(prev, scriptId, runResult.drawings));
    setScriptTable(runResult.table);
    setScriptLabels(
      runResult.labels.map((label) => ({
        ...label,
        paneId: label.paneType === "own" ? scriptPaneIndicatorId(scriptId, label.paneName) : null,
      }))
    );
  }

  function clearPendingTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function clearPendingDebounce() {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
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
      clearPendingDebounce();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
    // Constructed once per hook instance — every run() call below reuses (or, after a
    // timeout/stop, replaces) this same ref rather than depending on it here.
  }, []);

  /** `isRealtimeTick` picks which of the two timeout constants applies — a full replay is
   *  expected to sometimes genuinely take a while, a single new bar's worth of re-evaluation
   *  isn't (see HISTORICAL_REPLAY_TIMEOUT_MS/REALTIME_TICK_TIMEOUT_MS's own docs). Returns a
   *  promise of the same `ScriptRunResult` every path here already produces — every existing
   *  caller ignores it (fire-and-forget, same as before this existed), it's only there for the
   *  notebook cell-output flow (`ScriptEditorCodeMirror.tsx`'s own per-cell run button), which
   *  needs to know exactly which result belongs to *its own* request rather than reading whatever
   *  `result` state happens to hold whenever its own effect next runs. */
  function run(scriptCode: string, isRealtimeTick = false): Promise<ScriptRunResult> {
    // Reusing a worker that's still mid-run would let its own stale result land in *this* call's
    // freshly-assigned onmessage/onerror below once it eventually finishes — a Worker processes
    // queued postMessage calls sequentially, it doesn't just drop the superseded one — silently
    // clearing this run's own timeout early, applying stale output as if it were current, and
    // (via ScriptRunner's own alert-count dedup) dropping or duplicating alerts on the *next*
    // real result. Terminating and replacing it first — same mechanism stop()/a timeout/onerror
    // already use — guarantees a fresh run always starts against a clean worker with nothing
    // stale still in flight to land later.
    const worker = running ? replaceWorker() : workerRef.current ?? replaceWorker();
    clearPendingTimeout();
    lastScriptCodeRef.current = scriptCode;
    setRunning(true);
    const timeoutMs = isRealtimeTick ? REALTIME_TICK_TIMEOUT_MS : HISTORICAL_REPLAY_TIMEOUT_MS;

    return new Promise<ScriptRunResult>((resolve) => {
      worker.onmessage = (e: MessageEvent<ScriptRunResult>) => {
        clearPendingTimeout();
        applyRunOutput(e.data);
        setRunning(false);
        resolve(e.data);
      };
      // A script bug the try/catch inside runScript.ts didn't anticipate (an engine-level failure,
      // not an ordinary thrown error — those already come back as a normal ScriptRunResult) —
      // treated the same as a timeout: terminate, respawn, report as an error rather than letting
      // it reach the host's own onerror/crash the tab. Deliberately *not* routed through
      // applyRunOutput — an error/timeout run produced no real plots/drawings of its own, and
      // wiping scriptIndicators/scriptDrawings to empty on every transient failure would erase a
      // script's last *good* output just because its most recent edit happens to be broken, which
      // is worse than leaving the chart showing slightly stale content until the script is fixed.
      worker.onerror = (e: ErrorEvent) => {
        clearPendingTimeout();
        replaceWorker();
        const errorResult: ScriptRunResult = {
          error: { message: e.message || "Erreur inattendue du script." },
          logs: [],
          panes: [],
          drawings: [],
          table: null,
          xyCharts: [],
          alerts: [],
          labels: [],
        };
        setResult(errorResult);
        setRunning(false);
        resolve(errorResult);
      };

      timeoutRef.current = setTimeout(() => {
        replaceWorker();
        const timeoutResult: ScriptRunResult = {
          error: { message: "Le script a dépassé le délai d'exécution autorisé et a été arrêté." },
          logs: [],
          panes: [],
          drawings: [],
          table: null,
          xyCharts: [],
          alerts: [],
          labels: [],
        };
        setResult(timeoutResult);
        setRunning(false);
        resolve(timeoutResult);
      }, timeoutMs);

      worker.postMessage(
        buildSnapshot(data, indicators, fundamentals, scriptCode, timeoutMs, lastCandleOpen, isRealtimeTick, availableTimeframes, effectiveRunUpToIndex)
      );
    });
  }

  /** Interrupts whatever's currently running (or about to) — same terminate-and-respawn
   *  mechanism as a timeout, just user-initiated (the platform's own "Stop" button, see the
   *  plan's M5). */
  function stop() {
    clearPendingTimeout();
    clearPendingDebounce();
    replaceWorker();
    setRunning(false);
  }

  // Real-time re-trigger: once a script has been run at least once (`lastScriptCodeRef` set), a
  // later `data` change (a new/updated candle arriving from the host) re-evaluates it
  // automatically as a live tick, debounced so a burst of several changes arriving close together
  // collapses into one run rather than one per change (see REALTIME_TICK_DEBOUNCE_MS's own doc).
  // No-op before the first manual `run()` — nothing to re-trigger yet. Deliberately keyed on
  // `data` alone: re-running because `run`/`indicators`/`fundamentals` changed identity would
  // defeat the "only the data actually moved" intent and risk a re-trigger loop.
  // Also keyed on the run bound: moving the replay cutoff is exactly as much a reason to re-run as
  // a new candle arriving. A cutoff move is a *full* re-run from bar 0, not a single new bar's
  // worth of work, so it takes the historical timeout rather than the much shorter real-time one —
  // see run()'s own doc on which constant `isRealtimeTick` picks.
  //
  // Paced by whether a run is already in flight, not by the debounce alone. A plain trailing
  // debounce starves under a replay playing at speed: every cutoff move rearms it, so it only ever
  // elapses once playback *stops* — which is exactly the "it only updates when I pause" symptom.
  // Restarting regardless would be worse: run() terminates a worker that is still mid-run (see its
  // own doc on why it must), so a script slower than the cutoff moves would have every run killed
  // before finishing and never produce anything at all. Instead a move arriving mid-run is
  // remembered and replayed the moment that run lands — `running` is in the dependency list purely
  // so its fall back to false wakes this effect up to do that. The result paces itself to whatever
  // the script can actually sustain.
  const previousRunUpToIndexRef = useRef(effectiveRunUpToIndex);
  const previousDataRef = useRef(data);
  const deferredRerunRef = useRef(false);
  const deferredBoundMovedRef = useRef(false);
  useEffect(() => {
    if (lastScriptCodeRef.current === null) {
      previousRunUpToIndexRef.current = effectiveRunUpToIndex;
      previousDataRef.current = data;
      return;
    }
    const boundMoved = previousRunUpToIndexRef.current !== effectiveRunUpToIndex;
    const dataMoved = previousDataRef.current !== data;
    previousRunUpToIndexRef.current = effectiveRunUpToIndex;
    previousDataRef.current = data;

    // Woken by `running` alone, with nothing waiting on it — nothing to do.
    if (!boundMoved && !dataMoved && !deferredRerunRef.current) return;

    if (running) {
      deferredRerunRef.current = true;
      deferredBoundMovedRef.current = deferredBoundMovedRef.current || boundMoved;
      return;
    }

    const historical = boundMoved || deferredBoundMovedRef.current;
    deferredRerunRef.current = false;
    deferredBoundMovedRef.current = false;
    // No cleanup returned on purpose: React runs the previous effect's cleanup before every
    // re-entry, so clearing the pending debounce there would silently drop an already-scheduled
    // re-run whenever this effect woke for an unrelated reason (a `running` flip, say). It is
    // cleared explicitly here instead, and on unmount by the worker effect above.
    clearPendingDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (lastScriptCodeRef.current !== null) run(lastScriptCodeRef.current, !historical);
    }, REALTIME_TICK_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, effectiveRunUpToIndex, running]);

  return { result, running, scriptIndicators, scriptDrawings, scriptTable, scriptLabels, run, stop };
}
