/** One user-authored script, as seen from outside this library — see
 *  `CandlestickChartProps.defaultScripts`/`onScriptsChange`, the same uncontrolled-state
 *  convention `defaultIndicators`/`onIndicatorsChange` and `defaultDrawings`/`onDrawingsChange`
 *  already follow (the library owns the array's own lifecycle — add/edit/remove/reorder — and
 *  just reports it back on every change, rather than the caller driving it turn by turn). */
export interface ScriptDef {
  id: string;
  /** Shown in the script list/editor tab, not read by the engine itself. */
  name: string;
  code: string;
  /** Whether this script has ever gone through the "give it a name" flow (see
   *  `ScriptEditorPanel`'s own Ctrl+S/"Enregistrer sous" doc) — a fresh script keeps its
   *  auto-generated `name` ("Script 1"…) until its very first save, at which point saving prompts
   *  for a real one first, same "Untitled document" convention a text editor's first Ctrl+S
   *  follows. Once true, further saves just commit `code` in place, no prompt. */
  named?: boolean;
  /** A disabled script is kept (editable, savable) but never run — no Worker spun up for it, no
   *  contribution to `scriptIndicators`/`scriptDrawings`. Default true. */
  enabled?: boolean;
  /** `ChartWorkspace` only — which panel (by index) this script's own output routes to, when a
   *  workspace shares one script list across more than one panel. Set the first time "Exécuter" is
   *  clicked on a workspace with more than one panel open (via a picker in the editor's own
   *  toolbar), remembered afterward and changeable from there too. Meaningless for a standalone
   *  `CandlestickChart` (only ever one candidate panel: itself) — that usage ignores this field
   *  entirely. */
  targetPanelIndex?: number;
  /** Engine-internal trigger fields, not meant to be set by hand — bumped by the editor's own
   *  "Exécuter"/"Arrêter" buttons (see `useScriptingState.ts`'s own `runScript`/`stopScript`) and
   *  read by whichever `ScriptRunner` actually owns this script's own Worker. Living *on the
   *  `ScriptDef` itself*, rather than in some separate `Record<scriptId, ...>` channel, is what
   *  lets a run/stop request reach the right place even when `scripts` itself is workspace-
   *  controlled (`ChartWorkspace` routes each script to whichever panel currently targets it,
   *  and *only* fields carried on the script itself survive that routing — a parallel channel keyed
   *  by id would need its own separate plumbing all the way down, which is exactly the bug this
   *  design avoids: an earlier version of this engine had `runScript()` write into a Worker-
   *  triggering map ChartWorkspace never actually forwarded, so a shared script's own "Exécuter"
   *  silently only ever re-ran its last *saved* code instead of the fresh draft). `runDraftCode`
   *  is what actually runs when `runRequestId` bumps — the editor's current draft buffer, which may
   *  not match `code` above if unsaved; falls back to `code` when unset. */
  runRequestId?: number;
  runDraftCode?: string;
  stopRequestId?: number;
}
