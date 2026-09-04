import type { ScriptParamValue } from "../interfaces/ScriptParam.interface";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ScriptDef, ScriptFile } from "../interfaces/ScriptDef.interface";
import type { ScriptRunOutput } from "../scripting/interfaces/ScriptRunOutput.interface";
import type { ScriptTableOutput } from "../scripting/interfaces/ScriptRunResult.interface";

export interface UseScriptingStateControlledEditorOpen {
  editorOpen: boolean;
  onChange: (open: boolean) => void;
}

export interface UseScriptingStateControlledScripts {
  scripts: ScriptDef[];
  onChange: (scripts: ScriptDef[]) => void;
}

export interface UseScriptingStateArgs {
  defaultScripts: ScriptDef[] | undefined;
  onScriptsChange: ((scripts: ScriptDef[]) => void) | undefined;
  /** Lets an owner outside this hook decide the editor's own open/closed state instead of it
   *  managing its own — same `controlled?: {...} | undefined` shape and reasoning
   *  `useFullscreen`'s own `controlled` param already uses. Omitted (the common standalone-
   *  `CandlestickChart` case): this hook manages the state itself, exactly as before. */
  controlledEditorOpen?: UseScriptingStateControlledEditorOpen;
  /** Lets an owner outside this hook decide the *script list itself* instead of it managing its
   *  own — same shape/reasoning as `controlledEditorOpen` above. `ChartWorkspace` uses this to
   *  share one script list (and one editor) across every panel: it owns the real list and hands
   *  each panel only the subset targeting it (see `ChartWorkspace.tsx`'s own doc), so a panel's own
   *  `toggleScriptEnabled`/`removeScript`/`runScript`/etc. still work exactly as written here, but
   *  report back up to the workspace instead of mutating a panel-local list nothing else can see —
   *  crucially, this includes run/stop *triggering* too (see `ScriptDef.runRequestId`'s own doc for
   *  why that has to live on the script itself rather than a separate side channel). */
  controlledScripts?: UseScriptingStateControlledScripts;
}

/** Script CRUD (uncontrolled state, `defaultScripts`/`onScriptsChange` — same convention as
 *  `usePaneLayout`'s own `indicators`), the editor's own open/active-tab UI state, and the
 *  aggregated output every currently-running script contributes — one `ScriptRunner` per enabled
 *  script (see `ScriptRunnerHost.tsx`) reports its own output here via `reportRunOutput`, keyed by
 *  script id, and this hook just flattens all of them together for the render pipeline. Doesn't
 *  itself touch a Worker or `useScriptEngine` at all — that's each `ScriptRunner`'s own concern;
 *  this hook only ever manages the *list* of scripts and their already-computed output.
 *  `editorOpen` and `scripts` itself are each independently controllable (see
 *  `controlledEditorOpen`/`controlledScripts`'s own docs) the same way `useFullscreen`'s own
 *  `isFullscreen` is — everything else here stays internal.
 *
 *  `runScript`/`stopScript` write their own trigger directly onto the target `ScriptDef` (see
 *  `ScriptDef.runRequestId`/`stopRequestId`'s own doc) rather than into a separate
 *  `Record<scriptId, ...>` channel the way an earlier version of this engine did — that separate
 *  channel never actually reached a `ChartWorkspace`-routed script's own real `ScriptRunner` (it
 *  lived entirely inside whichever `useScriptingState` instance called `runScript`, not the panel
 *  that ends up owning the script), so a shared script's own "Exécuter" silently re-ran its last
 *  *saved* code instead of the fresh draft. Since every trigger now rides along with `scripts`
 *  itself, and `scripts` already correctly routes through `controlledScripts` end to end, this
 *  works correctly in both the standalone and workspace-shared cases with no separate plumbing. */
export function useScriptingState({ defaultScripts, onScriptsChange, controlledEditorOpen, controlledScripts }: UseScriptingStateArgs) {
  const [internalScripts, setInternalScripts] = useState<ScriptDef[]>(defaultScripts ?? []);
  const scripts = controlledScripts?.scripts ?? internalScripts;
  const [internalEditorOpen, setInternalEditorOpen] = useState(false);
  const editorOpen = controlledEditorOpen?.editorOpen ?? internalEditorOpen;
  const setEditorOpen = controlledEditorOpen?.onChange ?? setInternalEditorOpen;
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [runOutputs, setRunOutputs] = useState<Record<string, ScriptRunOutput>>({});
  const scriptIdRef = useRef(0);

  function commitScripts(next: ScriptDef[]) {
    if (controlledScripts) {
      controlledScripts.onChange(next);
      return;
    }
    setInternalScripts(next);
    onScriptsChange?.(next);
  }

  // `code` is a plain parameter (not a separate follow-up updateScript call) deliberately — a
  // caller adding a script and setting its initial content in the same synchronous handler would
  // otherwise read `scripts` from a still-stale closure (React batches the state update from this
  // call, so a same-tick `updateScript` wouldn't see the just-added entry yet). `rest` exists for
  // exactly the same reason, for every *other* field a caller needs set at creation time — notably
  // `targetPanelIndex`, without which a `ChartWorkspace`-owned script is routed to no panel at all
  // (see that file's own per-panel `scripts` filter) and so never runs.
  function addScript(name = "Nouveau script", code = "", rest?: Partial<Omit<ScriptDef, "id" | "name" | "code">>): string {
    const id = `script-${scriptIdRef.current++}`;
    commitScripts([...scripts, { id, name, code, enabled: true, ...rest }]);
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
  // already committed. See this hook's own doc for why the trigger lives on the ScriptDef itself.
  function runScript(id: string, code: string, files?: ScriptFile[]) {
    commitScripts(
      scripts.map((s) => (s.id === id ? { ...s, runRequestId: (s.runRequestId ?? 0) + 1, runDraftCode: code, runDraftFiles: files } : s))
    );
  }

  // Committing a parameter value re-runs the script, deliberately: a settings panel whose changes
  // only show up after a separate "Exécuter" click reads as broken. Bumps `runRequestId` without
  // touching `runDraftCode`, so the re-run uses whatever code was last run rather than resetting to
  // the saved `code` — changing a parameter while a draft is open keeps testing that draft.
  // Debouncing lives in the field UI (see ScriptParamsFields' own RERUN_DEBOUNCE_MS), so by the time
  // a call reaches here the edit has already settled.
  function setScriptParamValue(id: string, name: string, value: ScriptParamValue) {
    commitScripts(
      scripts.map((s) =>
        s.id === id ? { ...s, paramValues: { ...(s.paramValues ?? {}), [name]: value }, runRequestId: (s.runRequestId ?? 0) + 1 } : s
      )
    );
  }

  // Drops every stored value for one script, so each parameter falls back to the default written in
  // its own declaration (see ScriptDef.paramValues' own doc) — same re-run on the way out.
  function resetScriptParamValues(id: string) {
    commitScripts(scripts.map((s) => (s.id === id ? { ...s, paramValues: {}, runRequestId: (s.runRequestId ?? 0) + 1 } : s)));
  }

  // The editor's own Stop button — terminates that script's own in-flight Worker (via
  // useScriptEngine's own stop(), see ScriptRunner.tsx) rather than trying to "run" it into
  // stopping, which wouldn't preempt an actual infinite loop: a Worker only starts processing a
  // *new* postMessage once whatever it's currently running finishes on its own.
  function stopScript(id: string) {
    commitScripts(scripts.map((s) => (s.id === id ? { ...s, stopRequestId: (s.stopRequestId ?? 0) + 1 } : s)));
  }

  const reportRunOutput = useCallback((id: string, output: ScriptRunOutput) => {
    setRunOutputs((prev) => ({ ...prev, [id]: output }));
  }, []);

  // Every active script's own already-converted output, flattened — each entry only ever carries
  // its own script's own ids (see useScriptEngine's own upsert-by-scriptId design), so a plain
  // concat here can never collide or duplicate across scripts.
  const scriptIndicators = useMemo(() => Object.values(runOutputs).flatMap((o) => o.indicators), [runOutputs]);
  const scriptDrawings = useMemo(() => Object.values(runOutputs).flatMap((o) => o.drawings), [runOutputs]);
  // At most one table per active script (not a flatMap like the two above — plot.table's own
  // "latest call wins" semantics mean each script contributes zero or one, never several).
  const scriptTables = useMemo(
    () => Object.values(runOutputs).reduce<ScriptTableOutput[]>((acc, o) => (o.table ? [...acc, o.table] : acc), []),
    [runOutputs]
  );
  // Same "each script contributes its own, a plain concat can't collide" reasoning as
  // scriptIndicators/scriptDrawings above — a label's own paneName is only unique *within* the
  // script that created it, but ScriptLabelOverlay.tsx only ever needs it alongside that same
  // label's already-resolved paneId, never across scripts.
  const scriptLabels = useMemo(() => Object.values(runOutputs).flatMap((o) => o.labels), [runOutputs]);

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
    runScript,
    setScriptParamValue,
    resetScriptParamValues,
    stopScript,
    reportRunOutput,
    scriptIndicators,
    scriptDrawings,
    scriptTables,
    scriptLabels,
  };
}
