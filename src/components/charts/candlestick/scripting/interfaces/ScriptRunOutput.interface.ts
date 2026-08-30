import type { CustomIndicatorDef } from "../../interfaces/CustomIndicatorDef.interface";
import type { TrendLineDrawing } from "../../interfaces/TrendLineDrawing.interface";
import type { ScriptRunResult, ScriptTableOutput } from "./ScriptRunResult.interface";

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
}

export const EMPTY_SCRIPT_RUN_OUTPUT: ScriptRunOutput = { result: null, running: false, indicators: [], drawings: [], table: null };
