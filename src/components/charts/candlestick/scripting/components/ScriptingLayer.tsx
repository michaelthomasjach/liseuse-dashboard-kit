import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { ScriptAlertEvent } from "../../interfaces/ScriptAlertEvent.interface";
import type { useScriptingState } from "../../hooks/useScriptingState";
import { ScriptRunnerHost } from "./ScriptRunnerHost";
import { ScriptEditorPanel } from "./ScriptEditorPanel";

export interface ScriptingLayerProps {
  /** The whole `useScriptingState()` return, taken as one prop rather than destructured field by
   *  field — `ScriptRunnerHost` and `ScriptEditorPanel` below always render as a pair driven by
   *  the exact same state, so plumbing each of that hook's dozen-odd fields through
   *  `CandlestickChart.tsx`'s own already-near-its-line-cap body individually would only add
   *  prop-forwarding noise there for no real benefit — same "merge always-co-rendered pieces"
   *  reasoning `ChartPlotOverlays.tsx` already applies to `ChartCanvasOverlay`+`ChartHoverBadges`. */
  scripting: ReturnType<typeof useScriptingState>;
  data: Candle[];
  /** The chart's own *real*, CRUD-managed indicators only — never script-produced ones (a script
   *  reading its own sibling's output is the deferred multi-script-communication requirement,
   *  explicitly out of v1 scope per the approved plan). */
  indicators: Indicator[];
  fundamentals: FundamentalDataPoint[] | undefined;
  lastCandleOpen: boolean;
  onScriptAlert: ((event: ScriptAlertEvent) => void) | undefined;
}

/** Always mounted, regardless of `CandlestickChartProps.scripting` — that prop only gates the
 *  header button that opens `ScriptEditorPanel` (see ChartHeader.tsx), the same "gate controls the
 *  affordance, not whether already-configured content renders" convention `showIndicators` already
 *  follows for indicator panes. A script added via `defaultScripts` still runs and still renders
 *  its own output even with the editor button hidden. */
export function ScriptingLayer({ scripting, data, indicators, fundamentals, lastCandleOpen, onScriptAlert }: ScriptingLayerProps) {
  return (
    <>
      <ScriptRunnerHost
        scripts={scripting.scripts}
        data={data}
        indicators={indicators}
        fundamentals={fundamentals}
        lastCandleOpen={lastCandleOpen}
        runRequests={scripting.runRequests}
        stopRequests={scripting.stopRequests}
        onOutput={scripting.reportRunOutput}
        onAlert={onScriptAlert}
      />
      <ScriptEditorPanel
        open={scripting.editorOpen}
        onClose={() => scripting.setEditorOpen(false)}
        scripts={scripting.scripts}
        activeScriptId={scripting.activeScriptId}
        setActiveScriptId={scripting.setActiveScriptId}
        addScript={scripting.addScript}
        updateScript={scripting.updateScript}
        removeScript={scripting.removeScript}
        toggleScriptEnabled={scripting.toggleScriptEnabled}
        runScript={scripting.runScript}
        stopScript={scripting.stopScript}
        runOutputs={scripting.runOutputs}
        indicators={indicators}
      />
    </>
  );
}
