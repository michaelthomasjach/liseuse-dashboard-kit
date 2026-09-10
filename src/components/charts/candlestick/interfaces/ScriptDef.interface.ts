import type { StrategySettings } from "./StrategySettings.interface";
import type { ScriptParamValue } from "./ScriptParam.interface";
import type { QuantSymbolResult } from "../scripting/interfaces/ScriptRunResult.interface";

/** One user-authored script, as seen from outside this library — see
 *  `CandlestickChartProps.defaultScripts`/`onScriptsChange`, the same uncontrolled-state
 *  convention `defaultIndicators`/`onIndicatorsChange` and `defaultDrawings`/`onDrawingsChange`
 *  already follow (the library owns the array's own lifecycle — add/edit/remove/reorder — and
 *  just reports it back on every change, rather than the caller driving it turn by turn). */
/** One file of a multi-file script — see `ScriptDef.files`. */
export interface ScriptFile {
  name: string;
  code: string;
}

export interface ScriptDef {
  id: string;
  /** Shown in the script list/editor tab, not read by the engine itself. */
  name: string;
  /** The entry file — the one that actually runs, once per bar. */
  code: string;
  /** The script's own extra files, if it has been split into several. Each is a real module: it
   *  runs once (not once per bar), and what it `export`s is what an `import` in another file of the
   *  same script sees. Absent for a single-file script. Names are what an import resolves against —
   *  `import { X } from "./levels"` finds the file named `levels` (a leading `./` and a trailing
   *  `.js` are both optional, so all three spellings a JS author might reach for work). */
  files?: ScriptFile[];
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
  /** A `@strategy` script's own account and frictions (see `StrategySettings`), as edited in its
   *  strategy pane. Lives on the script rather than in some parallel map keyed by id because it
   *  belongs to it: saved with it, routed with it to whichever panel runs it, and gone with it when
   *  it is deleted. `undefined` until the pane is first opened, at which point the defaults apply —
   *  so a strategy runs sensibly before anyone has configured anything. */
  strategySettings?: StrategySettings;
  /** Values the user has set for this script's own `const NAME = new Variable(type, default)`
   *  parameters, by parameter name. Absent (or missing an entry) means "use the default written in
   *  the code", so a script whose declarations change — a renamed parameter, a new one — keeps
   *  working rather than reading a stale value: nothing here is authoritative on its own, the
   *  declarations in the source are (see `analyzeScriptVariables`). Stored on the ScriptDef for the
   *  same reason the run/stop triggers below are: only fields carried on the script itself survive
   *  ChartWorkspace's own routing of a shared script to whichever panel targets it. */
  paramValues?: Record<string, ScriptParamValue>;
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
  /** The editor's current draft of `files`, same relationship `runDraftCode` has to `code` — so a
   *  run started from the editor uses the unsaved state of *every* file, not just the entry. */
  runDraftFiles?: ScriptFile[];
  stopRequestId?: number;
  /** Runs of this `@quant` analysis the user chose to keep, newest first.
   *
   *  A quant analysis can be slow — it covers a list of symbols, each one a full pass over its own
   *  history — and its answer is a fact about a moment, not a live reading. Saving one is what lets
   *  it be consulted, compared and shared later without paying for it again.
   *
   *  On the `ScriptDef` rather than in a store of its own, for the same reason `strategySettings`
   *  is: it belongs to this script, is saved with it through the caller's own `onScriptsChange`,
   *  routes with it to whichever panel runs it, and is gone with it when it is deleted. */
  quantRuns?: QuantSavedRun[];
}

/** One kept run of a `@quant` analysis. */
export interface QuantSavedRun {
  id: string;
  /** When the analysis actually ran, epoch ms — not when it was saved, which is what someone
   *  reading two saved runs side by side needs to tell them apart. */
  ranAt: number;
  /** What the user called it, if anything. Unnamed runs are listed by date alone. */
  label?: string;
  rows: QuantSymbolResult[];
}
