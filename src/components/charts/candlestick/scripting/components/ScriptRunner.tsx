import { useEffect, useRef } from "react";
import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { ScriptAlertEvent } from "../../interfaces/ScriptAlertEvent.interface";
import type { ScriptRunRequest } from "../../hooks/useScriptingState";
import type { ScriptRunOutput } from "../interfaces/ScriptRunOutput.interface";
import { useScriptEngine } from "../hooks/useScriptEngine";

export interface ScriptRunnerProps {
  scriptId: string;
  code: string;
  data: Candle[];
  indicators: Indicator[];
  fundamentals: FundamentalDataPoint[] | undefined;
  lastCandleOpen: boolean;
  availableTimeframes: string[];
  runRequest: ScriptRunRequest | undefined;
  /** A pending "Stop" click for this script — see useScriptingState's own stopScript doc; only
   *  the count matters, not any payload. */
  stopRequest: number | undefined;
  onOutput: (id: string, output: ScriptRunOutput) => void;
  onAlert: ((event: ScriptAlertEvent) => void) | undefined;
}

/** One active script's own Worker, as a component instead of a bare hook call — `ScriptRunnerHost`
 *  mounts one of these per *enabled* script, which is what lets the number of concurrent scripts
 *  vary at runtime at all: `useScriptEngine` is itself a hook with its own Worker lifecycle, and
 *  the rules of hooks forbid calling one a variable number of times in a loop. Mounting/unmounting
 *  a component per script sidesteps that entirely — each gets its own independent Worker, matching
 *  the approved plan's own "one Worker per enabled script" design. Renders nothing. */
export function ScriptRunner({
  scriptId,
  code,
  data,
  indicators,
  fundamentals,
  lastCandleOpen,
  availableTimeframes,
  runRequest,
  stopRequest,
  onOutput,
  onAlert,
}: ScriptRunnerProps) {
  const engine = useScriptEngine(scriptId, data, indicators, fundamentals, lastCandleOpen, availableTimeframes);
  const hasRunOnceRef = useRef(false);
  const lastRequestIdRef = useRef<number | null>(null);
  const lastStopRequestRef = useRef<number | null>(null);
  // How many of `engine.result.alerts` (a *cumulative* list rebuilt from bar 0 on every run, per
  // M4's design) have already been forwarded via `onAlert` — reset to 0 right before either
  // explicit run() call below, so a genuinely fresh run (edited code, or the very first run) never
  // re-forwards alerts left over from a *previous* script version. A live real-time re-trigger
  // (M4's own internal effect, not called from here) always continues the exact same code as
  // whichever explicit run() this component itself most recently made, so its own result is
  // guaranteed to be a strict superset — the slice below only ever picks up genuinely new alerts
  // for that case, never replaying old ones on every tick.
  const reportedAlertCountRef = useRef(0);

  // Initial run, once, using whichever code this script currently has saved — a freshly-enabled
  // script starts producing output right away (matching how a built-in indicator behaves the
  // moment it's added) rather than sitting inert until the editor's own Run button is clicked.
  useEffect(() => {
    if (hasRunOnceRef.current) return;
    hasRunOnceRef.current = true;
    reportedAlertCountRef.current = 0;
    engine.run(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The editor's own Run button — executes whatever code it was called with (the current draft
  // buffer, which may differ from the saved `code` prop) whenever `runRequest.requestId` bumps.
  useEffect(() => {
    if (!runRequest || runRequest.requestId === lastRequestIdRef.current) return;
    lastRequestIdRef.current = runRequest.requestId;
    reportedAlertCountRef.current = 0;
    engine.run(runRequest.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRequest]);

  useEffect(() => {
    if (stopRequest === undefined || stopRequest === lastStopRequestRef.current) return;
    lastStopRequestRef.current = stopRequest;
    engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopRequest]);

  useEffect(() => {
    onOutput(scriptId, { result: engine.result, running: engine.running, indicators: engine.scriptIndicators, drawings: engine.scriptDrawings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId, engine.result, engine.running, engine.scriptIndicators, engine.scriptDrawings]);

  useEffect(() => {
    if (!onAlert || !engine.result) return;
    const newAlerts = engine.result.alerts.slice(reportedAlertCountRef.current);
    reportedAlertCountRef.current = engine.result.alerts.length;
    for (const a of newAlerts) onAlert({ scriptId, message: a.message, barIndex: a.barIndex, date: new Date(a.date) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.result]);

  // Clears this script's own contribution the moment it unmounts (disabled or removed) — without
  // this its last output would linger forever in useScriptingState's aggregated
  // scriptIndicators/scriptDrawings after the very thing that produced it is gone.
  useEffect(() => {
    return () => onOutput(scriptId, { result: null, running: false, indicators: [], drawings: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
