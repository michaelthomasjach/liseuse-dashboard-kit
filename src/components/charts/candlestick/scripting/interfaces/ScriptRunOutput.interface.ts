import type { CustomIndicatorDef } from "../../interfaces/CustomIndicatorDef.interface";
import type { TrendLineDrawing } from "../../interfaces/TrendLineDrawing.interface";
import type { ScriptLabelOutput, ScriptRunResult, ScriptTableOutput } from "./ScriptRunResult.interface";

/** A `ScriptLabelOutput` with its own target pane already resolved to a real `CustomIndicatorDef`
 *  id — `paneId` is `scriptPaneIndicatorId(scriptId, paneName)` for `paneType === "own"` (the same
 *  id `indicators` above carries for that pane, so `ScriptLabelOverlay.tsx` can look it up
 *  directly against `indicatorPaneTops`/`indicatorPaneHeights` without needing `scriptId` itself),
 *  or `null` for `paneType === "overlay"` (the price pane always occupies `{top: 0, height:
 *  priceHeight}`, no lookup needed). Resolved once here (where `scriptId` is naturally in scope,
 *  see `useScriptEngine.ts`'s own `applyRunOutput`) rather than carried around unresolved. */
export interface ResolvedScriptLabel extends ScriptLabelOutput {
  paneId: string | null;
}

/** One active script's own latest contribution, as tracked by `useScriptingState` (keyed by
 *  script id) and reported by each `ScriptRunner` — already converted into the shapes the render
 *  pipeline consumes directly (`indicators`/`drawings`), not the raw engine-internal `plots`/
 *  `drawings` `ScriptRunResult` itself carries (see `useScriptEngine`'s own
 *  `scriptIndicators`/`scriptDrawings`, which this mirrors one-for-one). */
export interface ScriptRunOutput {
  result: ScriptRunResult | null;
  running: boolean;
  indicators: CustomIndicatorDef[];
  drawings: TrendLineDrawing[];
  table: ScriptTableOutput | null;
  labels: ResolvedScriptLabel[];
}

export const EMPTY_SCRIPT_RUN_OUTPUT: ScriptRunOutput = { result: null, running: false, indicators: [], drawings: [], table: null, labels: [] };
