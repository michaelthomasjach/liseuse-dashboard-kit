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
import { SCRIPT_EXAMPLE_FUNDAMENTALS } from "../scriptExampleSampleData";
import { ReportView } from "./ReportView";
import { analyzeScriptKind } from "../scriptKind";
import { withScriptParams, withScriptParamsForFiles } from "../prepareScriptCode";
import { DEFAULT_STRATEGY_SETTINGS } from "../../interfaces/StrategySettings.interface";

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
  /** The example's own kind, and the capability that goes with it.
   *
   *  Without this, a `@quant` or a `@report` example ran down the per-bar indicator path: its
   *  `return` was thrown away, `report.*` did not exist, and the runner showed neither a result nor
   *  an error — the two examples that document those decorators demonstrated nothing at all. The
   *  engine gates each capability on being handed it (see `ScriptEngineSnapshot.quant`/`report`),
   *  so a runner that never hands it over can never show what the decorator does. */
  const kind = useMemo(() => analyzeScriptKind(example.code), [example.code]);
  const quant = useMemo(
    () =>
      kind.kind === "quant"
        ? {
            // Demo data, one series, under whichever names the example declared — the docs have no
            // data source of their own, and every symbol showing the same history is honest here:
            // what the example demonstrates is the shape of the output, not a real comparison.
            symbols: kind.symbols.length > 0 ? kind.symbols : ["DÉMO"],
            series: Object.fromEntries((kind.symbols.length > 0 ? kind.symbols : ["DÉMO"]).map((s) => [s, SCRIPT_EXAMPLE_DATA])),
            hostSymbol: kind.symbols[0],
          }
        : undefined,
    [kind],
  );
  const report = useMemo(() => (kind.kind === "report" ? { symbol: kind.symbols[0] ?? "DÉMO" } : undefined), [kind]);
  // Same gate again: without settings the engine builds no `strategy` object at all, so a
  // `@strategy` example failed on its first `strategy.long(...)` with "Cannot read properties of
  // undefined" — in the documentation, on the examples meant to teach that very API.
  const strategySettings = kind.kind === "strategy" ? DEFAULT_STRATEGY_SETTINGS : undefined;
  const engine = useScriptEngine(
    `example-${example.id}`,
    SCRIPT_EXAMPLE_DATA,
    example.indicators ?? [],
    // The fundamentals a `@report` example reads. Absent, `company.value(...)` is null everywhere
    // and the example prints a document of dashes.
    kind.kind === "report" ? SCRIPT_EXAMPLE_FUNDAMENTALS : undefined,
    false,
    [],
    null,
    undefined,
    strategySettings,
    quant,
    report,
    kind.symbols[0] ?? "DÉMO",
  );

  useEffect(() => {
    engine.run(withScriptParams(example.code, undefined), false, withScriptParamsForFiles(example.files, undefined));
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
      {/* A multi-file example shows every file, in import order, each under its own name — the
          same name the entry file's own `import … from "./name"` uses, so the two read together. */}
      {example.files?.map((file) => (
        <div key={file.name} className="lq-script-example__file">
          <div className="lq-script-example__file-name">{`./${file.name}`}</div>
          <CodeBlock code={file.code} language="JavaScript" className="lq-script-docs__code" />
        </div>
      ))}
      <div className="lq-script-example__toolbar">
        <button type="button" className="lq-script-example__run-button" onClick={() => engine.run(withScriptParams(example.code, undefined), false, withScriptParamsForFiles(example.files, undefined))} disabled={engine.running}>
          <PlayIcon size={13} /> {engine.running ? "Exécution…" : "Exécuter"}
        </button>
      </div>
      {engine.result?.error && <ScriptErrorPanel error={engine.result.error} />}
      {/* A `@quant` analysis and a `@report` produce no chart at all — showing an empty one under
          them would suggest the example had failed. They get what they actually made instead. */}
      {engine.result?.quant && (
        <div className="lq-script-example__result">
          {engine.result.quant.rows.map((row) => (
            <div key={row.symbol} className="lq-script-example__result-row">
              <span className="lq-script-example__result-symbol">{row.symbol}</span>
              <pre>{row.error ? row.error.message : JSON.stringify(row.value, null, 1)}</pre>
            </div>
          ))}
        </div>
      )}
      {engine.result?.report && (
        <div className="lq-script-example__result">
          <ReportView report={engine.result.report} />
        </div>
      )}
      {kind.kind !== "quant" && kind.kind !== "report" && (
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
      )}
      {engine.result?.xyCharts.map((chart) => (
        <div key={chart.name} className="lq-script-example__xy-chart">
          <ScriptXYChart chart={chart} height={180} />
        </div>
      ))}
    </div>
  );
}
