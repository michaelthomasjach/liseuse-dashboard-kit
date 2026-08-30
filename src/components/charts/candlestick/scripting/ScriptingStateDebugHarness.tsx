import { useState } from "react";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { ScriptAlertEvent } from "../interfaces/ScriptAlertEvent.interface";
import { useScriptingState } from "../hooks/useScriptingState";
import { ScriptRunnerHost } from "./components/ScriptRunnerHost";

/** Development-only harness for `useScriptingState`/`ScriptRunnerHost` — the M5 orchestration
 *  layer that lets a *variable* number of scripts each run their own Worker at once (see
 *  ScriptRunner.tsx's own doc for why that needs a component per script rather than a bare hook
 *  call). Not part of the public API, not meant to ship — exercises enable/disable (mount/unmount),
 *  concurrent scripts, the editor's own on-demand Run, and onScriptAlert end to end before any of
 *  this is wired into CandlestickChart.tsx itself. */
export interface ScriptingStateDebugHarnessProps {
  data: Candle[];
  indicators: Indicator[];
}

const SCRIPT_A_CODE = `
plot.pane("Score A").line("Score A", market.close(0) > market.open(0) ? 1 : 0);
`;
const SCRIPT_B_CODE = `
const seenBars = state.get("seenBars", 0) + 1;
state.set("seenBars", seenBars);
if (bar.isNew() && seenBars % 10 === 0) alert("Bar #" + seenBars);
plot.overlay("SMA20 (B)").line("SMA20 (B)", math.sma(market.series("close", 20), 20) ?? market.close(0));
`;

export function ScriptingStateDebugHarness({ data: initialData, indicators }: ScriptingStateDebugHarnessProps) {
  const [data, setData] = useState(initialData);
  const [alerts, setAlerts] = useState<ScriptAlertEvent[]>([]);
  const scripting = useScriptingState({ defaultScripts: undefined, onScriptsChange: undefined });

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, padding: 16 }}>
      <h3>Scripting State Debug Harness (M5 orchestration)</h3>
      <button type="button" data-testid="add-script-a" onClick={() => scripting.addScript("Script A", SCRIPT_A_CODE)}>
        Add Script A (own-pane score)
      </button>
      <button type="button" data-testid="add-script-b" onClick={() => scripting.addScript("Script B", SCRIPT_B_CODE)}>
        Add Script B (overlay + alert every 10 bars)
      </button>
      <hr />
      {scripting.scripts.map((s) => (
        <div key={s.id} style={{ marginBottom: 4 }}>
          <span>
            {s.name} ({s.id}) — enabled={String(s.enabled !== false)}
          </span>{" "}
          <button type="button" data-testid={`toggle-${s.id}`} onClick={() => scripting.toggleScriptEnabled(s.id)}>
            Toggle enabled
          </button>{" "}
          <button type="button" data-testid={`run-${s.id}`} onClick={() => scripting.runScript(s.id, s.code)}>
            Run
          </button>{" "}
          <button type="button" data-testid={`remove-${s.id}`} onClick={() => scripting.removeScript(s.id)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        data-testid="simulate-new-candle"
        onClick={() => {
          setData((prev) => {
            const last = prev[prev.length - 1];
            const nextClose = last.close * (1 + (Math.random() - 0.5) * 0.02);
            return [...prev, { date: new Date(last.date.getTime() + 24 * 60 * 60 * 1000), open: last.close, high: Math.max(last.close, nextClose), low: Math.min(last.close, nextClose), close: nextClose, volume: last.volume }];
          });
        }}
      >
        Simulate new candle
      </button>
      <div data-testid="data-length">data.length={data.length}</div>
      <hr />
      <ScriptRunnerHost
        scripts={scripting.scripts}
        data={data}
        indicators={indicators}
        fundamentals={undefined}
        lastCandleOpen={false}
        availableTimeframes={[]}
        onOutput={scripting.reportRunOutput}
        onAlert={(event) => setAlerts((prev) => [...prev, event])}
      />
      <h4>scriptIndicators (aggregated)</h4>
      <pre data-testid="aggregated-indicators">{JSON.stringify(scripting.scriptIndicators.map((i) => ({ id: i.id, label: i.label, type: i.type, dataLen: i.data.length })), null, 2)}</pre>
      <h4>scriptDrawings (aggregated)</h4>
      <pre data-testid="aggregated-drawings">{JSON.stringify(scripting.scriptDrawings, null, 2)}</pre>
      <h4>alerts received via onAlert</h4>
      <pre data-testid="received-alerts">{JSON.stringify(alerts, null, 2)}</pre>
    </div>
  );
}
