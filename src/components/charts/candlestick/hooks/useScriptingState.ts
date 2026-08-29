import { useCallback, useMemo, useRef, useState } from "react";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import type { ScriptRunOutput } from "../scripting/interfaces/ScriptRunOutput.interface";

export interface UseScriptingStateControlledEditorOpen {
  editorOpen: boolean;
  onChange: (open: boolean) => void;
}

export interface UseScriptingStateArgs {
  defaultScripts: ScriptDef[] | undefined;
  onScriptsChange: ((scripts: ScriptDef[]) => void) | undefined;
  /** Lets an owner outside this hook decide the editor's own open/closed state instead of it
   *  managing its own — same `controlled?: {...} | undefined` shape and reasoning
   *  `useFullscreen`'s own `controlled` param already uses, for the same reason: `ChartWorkspace`
   *  needs a *workspace*-level "</>" button (its own side-rail, not any one panel's header) to be
   *  able to open a specific panel's own editor from outside that panel entirely. Omitted (the
   *  common standalone-`CandlestickChart` case): this hook manages the state itself, exactly as
   *  before. */
  controlledEditorOpen?: UseScriptingStateControlledEditorOpen;
}

/** A pending "run this code now" request for one script — `requestId` (not just `code`) is the
 *  effect trigger over in `ScriptRunner`, so clicking "Run" again on *unmodified* code still
 *  re-runs it instead of the request looking identical to the previous one and silently doing
 *  nothing. */
export interface ScriptRunRequest {
  code: string;
  requestId: number;
}

/** Script CRUD (uncontrolled state, `defaultScripts`/`onScriptsChange` — same convention as
 *  `usePaneLayout`'s own `indicators`), the editor's own open/active-tab UI state, and the
 *  aggregated output every currently-running script contributes — one `ScriptRunner` per enabled
 *  script (see `ScriptRunnerHost.tsx`) reports its own output here via `reportRunOutput`, keyed by
 *  script id, and this hook just flattens all of them together for the render pipeline. Doesn't
 *  itself touch a Worker or `useScriptEngine` at all — that's each `ScriptRunner`'s own concern;
 *  this hook only ever manages the *list* of scripts and their already-computed output.
 *  `editorOpen` is controllable (see `controlledEditorOpen`'s own doc) the same way
 *  `useFullscreen`'s own `isFullscreen` is — everything else here stays internal. */
export function useScriptingState({ defaultScripts, onScriptsChange, controlledEditorOpen }: UseScriptingStateArgs) {
  const [scripts, setScripts] = useState<ScriptDef[]>(defaultScripts ?? []);
  const [internalEditorOpen, setInternalEditorOpen] = useState(false);
  const editorOpen = controlledEditorOpen?.editorOpen ?? internalEditorOpen;
  const setEditorOpen = controlledEditorOpen?.onChange ?? setInternalEditorOpen;
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [runOutputs, setRunOutputs] = useState<Record<string, ScriptRunOutput>>({});
  const [runRequests, setRunRequests] = useState<Record<string, ScriptRunRequest>>({});
  // A pending "stop whatever's running now" request, same requestId-bump trigger as runRequests
  // above (not a boolean — two Stop clicks in a row while the engine is still winding down from
  // the first must both still register as *a* stop request each). Only the count, not a payload,
  // is meaningful here.
  const [stopRequests, setStopRequests] = useState<Record<string, number>>({});
  const scriptIdRef = useRef(0);

  function commitScripts(next: ScriptDef[]) {
    setScripts(next);
    onScriptsChange?.(next);
  }

  // `code` is a plain parameter (not a separate follow-up updateScript call) deliberately — a
  // caller adding a script and setting its initial content in the same synchronous handler would
  // otherwise read `scripts` from a still-stale closure (React batches the state update from this
  // call, so a same-tick `updateScript` wouldn't see the just-added entry yet).
  function addScript(name = "Nouveau script", code = ""): string {
    const id = `script-${scriptIdRef.current++}`;
    commitScripts([...scripts, { id, name, code, enabled: true }]);
    setActiveScriptId(id);
    setEditorOpen(true);
    return id;
  }

  function updateScript(id: string, patch: Partial<Omit<ScriptDef, "id">>) {
    commitScripts(scripts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeScript(id: string) {
    commitScripts(scripts.filter((s) => s.id !== id));
    setRunOutputs((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeScriptId === id) setActiveScriptId(null);
  }

  function toggleScriptEnabled(id: string) {
    commitScripts(scripts.map((s) => (s.id === id ? { ...s, enabled: s.enabled === false } : s)));
  }

  // The editor's own Run button — executes `code` (the editor's current draft buffer, which may
  // not be saved into the ScriptDef yet) rather than only ever being able to re-run whatever's
  // already committed. Stable identity (useCallback) since it's an effect dependency inside every
  // ScriptRunner.
  const runScript = useCallback((id: string, code: string) => {
    setRunRequests((prev) => ({ ...prev, [id]: { code, requestId: (prev[id]?.requestId ?? 0) + 1 } }));
  }, []);

  // The editor's own Stop button — terminates that script's own in-flight Worker (via
  // useScriptEngine's own stop(), see ScriptRunner.tsx) rather than trying to "run" it into
  // stopping, which wouldn't preempt an actual infinite loop: a Worker only starts processing a
  // *new* postMessage once whatever it's currently running finishes on its own.
  const stopScript = useCallback((id: string) => {
    setStopRequests((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const reportRunOutput = useCallback((id: string, output: ScriptRunOutput) => {
    setRunOutputs((prev) => ({ ...prev, [id]: output }));
  }, []);

  // Every active script's own already-converted output, flattened — each entry only ever carries
  // its own script's own ids (see useScriptEngine's own upsert-by-scriptId design), so a plain
  // concat here can never collide or duplicate across scripts.
  const scriptIndicators = useMemo(() => Object.values(runOutputs).flatMap((o) => o.indicators), [runOutputs]);
  const scriptDrawings = useMemo(() => Object.values(runOutputs).flatMap((o) => o.drawings), [runOutputs]);

  return {
    scripts,
    commitScripts,
    addScript,
    updateScript,
    removeScript,
    toggleScriptEnabled,
    editorOpen,
    setEditorOpen,
    activeScriptId,
    setActiveScriptId,
    runOutputs,
    runRequests,
    runScript,
    stopRequests,
    stopScript,
    reportRunOutput,
    scriptIndicators,
    scriptDrawings,
  };
}
