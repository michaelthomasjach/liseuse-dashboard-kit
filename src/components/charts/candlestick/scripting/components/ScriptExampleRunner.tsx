import { useEffect, useMemo, useState } from "react";
import { CandlestickChart } from "../../../CandlestickChart";
import { CodeBlock } from "../../../../primitives/CodeBlock";
import { PlayIcon } from "../../../../icons";
import { useScriptEngine } from "../hooks/useScriptEngine";
import { scriptIndicatorToChartIndicator } from "../scriptIndicatorToChartIndicator";
import { SCRIPT_EXAMPLE_DATA } from "../scriptExampleSampleData";
import type { ScriptExample } from "../scriptExamples";
import { headingAnchorId } from "../scriptDocsNav";
import { ScriptTableOverlay } from "../../components/ScriptTableOverlay";
import { ScriptXYChart } from "./ScriptXYChart";
import { ScriptErrorPanel } from "./ScriptErrorPanel";
import "./ScriptExampleRunner.css";

export interface ScriptExampleRunnerProps {
  example: ScriptExample;
}

/** One "Exemples" script — a real "Exécuter" button and a live chart underneath, instead of just
 *  syntax-highlighted text (exigence : « je veux pouvoir exécuter les scripts d'exemples... et
 *  avoir la chart qui apparaît sous les scripts respectifs »). Deliberately *not* editable (unlike
 *  `ScriptInteractiveTutorial.tsx`'s own workspace) — these are meant to stay "copiables tels
 *  quels" (the section's own intro text), a fixed reference a reader copies elsewhere rather than
 *  tweaks in place; a plain read-only `CodeBlock` plus a run button is all that's needed for that.
 *  Auto-runs once on mount (same "see the result before touching anything" reasoning the tutorial's
 *  own steps already follow) — `example.code` never changes at runtime, so the effect's own empty
 *  dep array is intentional, not a lint gap. `example.indicators` (only "Quant Score" sets it) is
 *  what lets `chart.indicator("rsi")`/`chart.indicator("macd")` inside that one example's own code
 *  resolve to something real instead of the all-`null` "unknown id" handle — see
 *  `useScriptEngine`'s own `indicators` argument doc. */
export function ScriptExampleRunner({ example }: ScriptExampleRunnerProps) {
  const [runVersion, setRunVersion] = useState(0);
  const engine = useScriptEngine(`example-${example.id}`, SCRIPT_EXAMPLE_DATA, example.indicators ?? [], undefined);

  useEffect(() => {
    engine.run(example.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same "only remount the preview on a successful run" reasoning as ScriptInteractiveTutorial.tsx
  // — an error run keeps the engine's own last-good scriptIndicators/scriptDrawings, so remounting
  // here too would only reset the preview's zoom/pan for nothing new.
  useEffect(() => {
    if (engine.result && !engine.result.error) setRunVersion((v) => v + 1);
  }, [engine.result]);

  const chartIndicators = useMemo(() => engine.scriptIndicators.map(scriptIndicatorToChartIndicator), [engine.scriptIndicators]);

  return (
    <div id={headingAnchorId("examples", example.title)} className="lq-script-example">
      <h4 className="lq-script-docs__example-heading">{example.title}</h4>
      <p>{example.description}</p>
      <CodeBlock code={example.code} language="JavaScript" className="lq-script-docs__code" />
      <div className="lq-script-example__toolbar">
        <button type="button" className="lq-script-example__run-button" onClick={() => engine.run(example.code)} disabled={engine.running}>
          <PlayIcon size={13} /> {engine.running ? "Exécution…" : "Exécuter"}
        </button>
      </div>
      {engine.result?.error && <ScriptErrorPanel error={engine.result.error} />}
      <div className="lq-script-example__preview">
        <CandlestickChart
          key={runVersion}
          data={SCRIPT_EXAMPLE_DATA}
          defaultIndicators={chartIndicators}
          defaultDrawings={engine.scriptDrawings}
          height={280}
          zoomable
          symbol="Démo"
        />
        {engine.scriptTable && <ScriptTableOverlay tables={[engine.scriptTable]} />}
      </div>
      {engine.result?.xyCharts.map((chart) => (
        <div key={chart.name} className="lq-script-example__xy-chart">
          <ScriptXYChart chart={chart} height={180} />
        </div>
      ))}
    </div>
  );
}
