import { useEffect, useRef } from "react";
import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { ScriptAlertEvent } from "../../interfaces/ScriptAlertEvent.interface";
import type { ScriptRunOutput } from "../interfaces/ScriptRunOutput.interface";
import { useScriptEngine } from "../hooks/useScriptEngine";

export interface ScriptRunnerProps {
  /** The whole `ScriptDef`, not its fields spread individually — `runRequestId`/`runDraftCode`/
   *  `stopRequestId` (see that interface's own doc) are what actually trigger a run/stop here, and
   *  they need to travel as part of the same object `scripts` itself does so they route correctly
   *  even when `scripts` is workspace-controlled (see useScriptingState.ts's own doc). */
  script: ScriptDef;
  data: Candle[];
  indicators: Indicator[];
  fundamentals: FundamentalDataPoint[] | undefined;
  lastCandleOpen: boolean;
  availableTimeframes: string[];
  onOutput: (id: string, output: ScriptRunOutput) => void;
  onAlert: ((event: ScriptAlertEvent) => void) | undefined;
}

/** One active script's own Worker, as a component instead of a bare hook call — `ScriptRunnerHost`
 *  mounts one of these per *enabled* script, which is what lets the number of concurrent scripts
 *  vary at runtime at all: `useScriptEngine` is itself a hook with its own Worker lifecycle, and
 *  the rules of hooks forbid calling one a variable number of times in a loop. Mounting/unmounting
 *  a component per script sidesteps that entirely — each gets its own independent Worker, matching
 *  the approved plan's own "one Worker per enabled script" design. Renders nothing. */
export function ScriptRunner({ script, data, indicators, fundamentals, lastCandleOpen, availableTimeframes, onOutput, onAlert }: ScriptRunnerProps) {
  const engine = useScriptEngine(script.id, data, indicators, fundamentals, lastCandleOpen, availableTimeframes);
  const hasRunOnceRef = useRef(false);
  const lastRunRequestIdRef = useRef<number | null>(null);
  const lastStopRequestIdRef = useRef<number | null>(null);
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
  // Skipped when a run was *already* requested right at mount (script.runRequestId already set) —
  // this happens when a ChartWorkspace script gets newly routed to this panel (its own
  // targetPanelIndex just changed) in the very same action that also clicked "Exécuter": the
  // runRequestId effect right below already runs the correct (possibly still-unsaved draft) code
  // once on its own, and also running the separately-saved `code` here too would be a redundant,
  // stale second run racing the same Worker for no benefit.
  useEffect(() => {
    if (hasRunOnceRef.current) return;
    hasRunOnceRef.current = true;
    if (script.runRequestId !== undefined) return;
    reportedAlertCountRef.current = 0;
    engine.run(script.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The editor's own Run button — executes whatever code it was called with (the current draft
  // buffer, which may differ from the saved `code`) whenever `runRequestId` bumps.
  useEffect(() => {
    if (script.runRequestId === undefined || script.runRequestId === lastRunRequestIdRef.current) return;
    lastRunRequestIdRef.current = script.runRequestId;
    reportedAlertCountRef.current = 0;
    engine.run(script.runDraftCode ?? script.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.runRequestId]);

  useEffect(() => {
    if (script.stopRequestId === undefined || script.stopRequestId === lastStopRequestIdRef.current) return;
    lastStopRequestIdRef.current = script.stopRequestId;
    engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.stopRequestId]);

  useEffect(() => {
    onOutput(script.id, {
      result: engine.result,
      running: engine.running,
      indicators: engine.scriptIndicators,
      drawings: engine.scriptDrawings,
      table: engine.scriptTable,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.id, engine.result, engine.running, engine.scriptIndicators, engine.scriptDrawings, engine.scriptTable]);

  useEffect(() => {
    if (!onAlert || !engine.result) return;
    const newAlerts = engine.result.alerts.slice(reportedAlertCountRef.current);
    reportedAlertCountRef.current = engine.result.alerts.length;
    for (const a of newAlerts) onAlert({ scriptId: script.id, message: a.message, barIndex: a.barIndex, date: new Date(a.date) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.result]);

  // Clears this script's own contribution the moment it unmounts (disabled or removed) — without
  // this its last output would linger forever in useScriptingState's aggregated
  // scriptIndicators/scriptDrawings after the very thing that produced it is gone.
  useEffect(() => {
    return () => onOutput(script.id, { result: null, running: false, indicators: [], drawings: [], table: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
