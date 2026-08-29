import type { ComponentType } from "react";
import {
  ScriptReplayDiagram,
  MarketOffsetDiagram,
  ChartIndicatorDiagram,
  PlotOwnPaneDiagram,
  PlotOverlayDiagram,
  PlotSignalDiagram,
  StateMemoryDiagram,
  BarIsNewDiagram,
} from "./scriptingDiagrams";

/** One explanatory diagram per `diagramKey` a `scriptApiReference.ts` block can reference — same
 *  "plain data, resolved to a component only at render time" split `indicatorDiagramRegistry.ts`
 *  already uses for the built-in indicators. */
export const SCRIPT_DIAGRAM_REGISTRY: Record<string, ComponentType> = {
  replay: ScriptReplayDiagram,
  marketOffset: MarketOffsetDiagram,
  chartIndicator: ChartIndicatorDiagram,
  plotOwnPane: PlotOwnPaneDiagram,
  plotOverlay: PlotOverlayDiagram,
  plotSignal: PlotSignalDiagram,
  stateMemory: StateMemoryDiagram,
  barIsNew: BarIsNewDiagram,
};
