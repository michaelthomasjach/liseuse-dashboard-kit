import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { IndicatorCatalogEntry } from "../../indicatorCatalog";
import type { TrendLineDrawing } from "../../interfaces/TrendLineDrawing.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { ScriptRunOutput } from "../../scripting/interfaces/ScriptRunOutput.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";

/** Everything the assistant can read from, and every lever it can pull.
 *
 *  One object, assembled by the chart from what it already has, rather than the assistant reaching
 *  into the chart's internals: this is the whole surface the model is given, so it can be read in
 *  one place and — the point — nothing outside it is reachable, however the model is prompted. A
 *  tool that is not here does not exist.
 *
 *  Every mutating entry is the *same* function the corresponding button already calls. The
 *  assistant adding an indicator and a person adding one are one code path, so they cannot drift
 *  apart, and an action the model takes is undoable exactly as a person's would be. */
export interface AiChartContext {
  symbol: string | undefined;
  timeframe: string | undefined;
  availableTimeframes: string[];
  data: Candle[];
  fundamentals: FundamentalDataPoint[] | undefined;

  indicators: Indicator[];
  indicatorCatalog: IndicatorCatalogEntry[];
  indicatorLabel: (indicator: Indicator) => string;
  addIndicator: (entry: IndicatorCatalogEntry) => void;
  removeIndicator: (id: string) => void;
  setVolumeVisible: (visible: boolean) => void;
  volumeVisible: boolean;

  /** The drawings as they stand *now*, not as the last render saw them — a tool that appends has
   *  to see what the tool before it in the same pass appended. */
  drawings: () => TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  /** A fresh drawing id from the chart's own counter, so an assistant-made drawing can never
   *  collide with a hand-drawn one. */
  nextDrawingId: () => string;

  scripts: ScriptDef[];
  runOutputs: Record<string, ScriptRunOutput>;
  /** Creates a script and returns its id. */
  addScript: (name: string, code: string) => string;
  updateScript: (id: string, code: string) => void;
  runScript: (id: string) => void;

  setTimeframe: ((timeframe: string) => void) | undefined;
  setSymbol: ((symbol: string) => void) | undefined;
  /** Opens a script in the editor, so "j'ai écrit la stratégie" ends with it on screen rather
   *  than merely saved. */
  openScript: ((id: string) => void) | undefined;
}
