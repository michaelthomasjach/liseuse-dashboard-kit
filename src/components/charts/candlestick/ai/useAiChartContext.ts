import { useMemo } from "react";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { FundamentalDataPoint } from "../interfaces/FundamentalDataPoint.interface";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import type { ScriptRunOutput } from "../scripting/interfaces/ScriptRunOutput.interface";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry } from "../indicatorCatalog";

export interface UseAiChartContextArgs {
  symbol: string | undefined;
  timeframe: string | undefined;
  availableTimeframes: string[];
  data: Candle[];
  fundamentals: FundamentalDataPoint[] | undefined;
  indicators: Indicator[];
  indicatorLabel: (indicator: Indicator) => string;
  addIndicator: (entry: IndicatorCatalogEntry) => void;
  removeIndicator: (id: string) => void;
  volumeVisible: boolean;
  setVolumePaneState: (state: "expanded" | "collapsed" | "hidden") => void;
  drawings: () => TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  nextDrawingId: () => string;
  scripts: ScriptDef[];
  runOutputs: Record<string, ScriptRunOutput>;
  addScript: (name: string, code: string) => string;
  updateScript: (id: string, code: string) => void;
  runScript: (id: string) => void;
  onTimeframeChange: ((timeframe: string) => void) | undefined;
  onSymbolChange: ((symbol: string) => void) | undefined;
  onEditScript: ((id: string) => void) | undefined;
}

/** Gathers the assistant's whole world into one object.
 *
 *  Assembled here rather than inside the panel so that *what the model can reach* is written down
 *  in one place and reviewable as one thing. Every mutating entry is the same function the
 *  corresponding button already calls — so an action the assistant takes and the same action taken
 *  by hand are one code path, and neither can grow a capability the other lacks. */
export function useAiChartContext(args: UseAiChartContextArgs): AiChartContext {
  const {
    symbol,
    timeframe,
    availableTimeframes,
    data,
    fundamentals,
    indicators,
    indicatorLabel,
    addIndicator,
    removeIndicator,
    volumeVisible,
    setVolumePaneState,
    drawings,
    commitDrawings,
    nextDrawingId,
    scripts,
    runOutputs,
    addScript,
    updateScript,
    runScript,
    onTimeframeChange,
    onSymbolChange,
    onEditScript,
  } = args;

  return useMemo(
    () => ({
      symbol,
      timeframe,
      availableTimeframes,
      data,
      fundamentals,
      indicators,
      indicatorCatalog: INDICATOR_CATALOG,
      indicatorLabel,
      addIndicator,
      removeIndicator,
      volumeVisible,
      // The pane has three states and the tool has two: "montre-moi le volume" means expanded, and
      // hiding it is hiding it. Collapsing is a thing a person does by dragging, not a thing to ask
      // for in words.
      setVolumeVisible: (visible: boolean) => setVolumePaneState(visible ? "expanded" : "hidden"),
      drawings,
      commitDrawings,
      nextDrawingId,
      scripts,
      runOutputs,
      addScript,
      updateScript,
      runScript,
      setTimeframe: onTimeframeChange,
      setSymbol: onSymbolChange,
      openScript: onEditScript,
    }),
    [
      symbol,
      timeframe,
      availableTimeframes,
      data,
      fundamentals,
      indicators,
      indicatorLabel,
      addIndicator,
      removeIndicator,
      volumeVisible,
      setVolumePaneState,
      drawings,
      commitDrawings,
      nextDrawingId,
      scripts,
      runOutputs,
      addScript,
      updateScript,
      runScript,
      onTimeframeChange,
      onSymbolChange,
      onEditScript,
    ],
  );
}
