import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CandlestickChart } from "../../../CandlestickChart";
import { ScriptTableOverlay } from "../../components/ScriptTableOverlay";
import { PlayIcon, PauseIcon, RefreshIcon, ChevronLeftIcon, ChevronRightIcon } from "../../../../icons";
import { useScriptEngine } from "../hooks/useScriptEngine";
import { scriptIndicatorToChartIndicator } from "../scriptIndicatorToChartIndicator";
import { SCRIPT_TUTORIAL_STEPS } from "../scriptTutorialSteps";
import { SCRIPT_TUTORIAL_DATA } from "../scriptTutorialSampleData";
import { SCRIPT_DIAGRAM_REGISTRY } from "../scriptDiagramRegistry";
import { ScriptErrorPanel } from "./ScriptErrorPanel";
import "./ScriptInteractiveTutorial.css";

const LazyScriptEditorCodeMirror = lazy(() =>
  import("./ScriptEditorCodeMirror").then((m) => ({ default: m.ScriptEditorCodeMirror }))
);

/** The documentation's own "learn by doing" mode (exigence : « je veux un mode test live sur la
 *  documentation, comme un prof qui me dis fais ci fais ca, et je vois la chart qui se met à jour »,
 *  modelled on learngitbranching.js.org) — a step-by-step walkthrough where each step's code is
 *  editable and runnable right here, against a small fixed demo dataset, with a real chart reflecting
 *  the result live. Deliberately bypasses the public `CandlestickChart` `scripts`/`onScriptsChange`
 *  pathway (the one a real host app would use) in favor of a *direct* `useScriptEngine` call: that
 *  public pathway's own `defaultIndicators`/`defaultDrawings` are uncontrolled (seeded once, never
 *  resynced — confirmed in `usePaneLayout.ts`) and its only output channel is `onScriptAlert`, with no
 *  way at all to read back `result.error`/`result.logs` — both of which this tutorial needs constantly,
 *  since a learner *will* type typos. Calling the engine directly gives full access to that, at the
 *  cost of having to `key`-remount `<CandlestickChart>` on every successful run to push its own fresh
 *  `defaultIndicators`/`defaultDrawings` in (the only way to update an intentionally-uncontrolled prop
 *  from outside) — skipped on an *error* run so a typo never wipes the last good preview, mirroring
 *  `useScriptEngine`'s own "don't erase good output over a transient failure" stance. `plot.table`
 *  output (`engine.scriptTable`) doesn't have this problem at all — it was never a
 *  `CandlestickChart` prop to begin with (only ever reachable via the real `scripts` pathway this
 *  component already avoids), so `ScriptTableOverlay` is mounted directly here instead, a plain
 *  sibling of the preview chart fed straight from the same engine instance. */
export function ScriptInteractiveTutorial() {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(SCRIPT_TUTORIAL_STEPS[0].code ?? "");
  const [runVersion, setRunVersion] = useState(0);

  const step = SCRIPT_TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === SCRIPT_TUTORIAL_STEPS.length - 1;
  const Diagram = step.diagramKey ? SCRIPT_DIAGRAM_REGISTRY[step.diagramKey] : undefined;
  // Most steps share the default daily-spaced dataset; the multi-timeframe steps override it with
  // real intraday bars (see ScriptTutorialStep.data's own doc) so market.resample(...) has
  // something meaningful to aggregate.
  const stepData = step.data ?? SCRIPT_TUTORIAL_DATA;
  const engine = useScriptEngine("tutorial-preview", stepData, [], undefined);

  // Loads the new step's own canonical code and runs it immediately — the reader sees the "expected"
  // result the instant they arrive on a step, before touching anything, exactly like clicking
  // "Exécuter" themselves. Deliberately keyed on `stepIndex` alone (not `engine`/`step` — see
  // `useScriptEngine.ts`'s own identical-shaped real-time effect for the same reasoning): a step's own
  // code never changes at runtime, so there's nothing else this should ever re-fire on. Fires on
  // mount too (an effect always runs once for its own dependency's initial value), which is exactly
  // what seeds step 1's own first plot without a separate mount-only effect.
  useEffect(() => {
    setDraft(step.code ?? "");
    if (step.code) engine.run(step.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Remounts the preview chart only on a *successful* run — its own `defaultIndicators`/
  // `defaultDrawings` are uncontrolled (see this component's own top doc), so a fresh `key` is the
  // only way to push new script output in. An error run intentionally does *not* bump this: the
  // engine itself keeps `scriptIndicators`/`scriptDrawings` at their last good value while broken, so
  // remounting here would only reset the preview's zoom/pan for a run that produced nothing new.
  useEffect(() => {
    if (engine.result && !engine.result.error) setRunVersion((v) => v + 1);
  }, [engine.result]);

  const chartIndicators = useMemo(
    () => engine.scriptIndicators.map(scriptIndicatorToChartIndicator),
    [engine.scriptIndicators]
  );

  return (
    <div className="lq-script-tutorial">
      <div className="lq-script-tutorial__instructions">
        <div className="lq-script-tutorial__steps-nav">
          {SCRIPT_TUTORIAL_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={["lq-script-tutorial__step-pill", i === stepIndex && "lq-script-tutorial__step-pill--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setStepIndex(i)}
              title={s.title}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <h4 className="lq-script-tutorial__step-title">{step.title}</h4>
        {step.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {Diagram && <Diagram />}
        {step.list && (
          <ul>
            {step.list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {isLastStep && (
          <button type="button" className="lq-script-tutorial__restart" onClick={() => setStepIndex(0)}>
            <RefreshIcon size={13} /> Recommencer le tutoriel
          </button>
        )}
        <div className="lq-script-tutorial__pager">
          <button type="button" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
            <ChevronLeftIcon size={13} /> Précédent
          </button>
          <span className="lq-script-tutorial__pager-count">
            Étape {stepIndex + 1} / {SCRIPT_TUTORIAL_STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.min(SCRIPT_TUTORIAL_STEPS.length - 1, i + 1))}
            disabled={isLastStep}
          >
            Suivant <ChevronRightIcon size={13} />
          </button>
        </div>
      </div>

      {step.code !== undefined && (
        <div className="lq-script-tutorial__workspace">
          <div className="lq-script-tutorial__editor">
            <div className="lq-script-tutorial__toolbar">
              <button type="button" className="lq-script-tutorial__toolbar-button" onClick={() => engine.run(draft)}>
                <PlayIcon size={13} /> Exécuter
              </button>
              <button
                type="button"
                className="lq-script-tutorial__toolbar-button"
                onClick={() => engine.stop()}
                disabled={!engine.running}
              >
                <PauseIcon size={13} /> Arrêter
              </button>
              <button
                type="button"
                className="lq-script-tutorial__toolbar-button"
                onClick={() => setDraft(step.code ?? "")}
                disabled={draft === step.code}
              >
                <RefreshIcon size={13} /> Réinitialiser
              </button>
              {engine.running && <span className="lq-script-tutorial__status">Exécution…</span>}
            </div>
            <Suspense fallback={<div className="lq-script-tutorial__loading">Chargement de l'éditeur…</div>}>
              <LazyScriptEditorCodeMirror value={draft} onChange={setDraft} error={engine.result?.error ?? null} />
            </Suspense>
            {engine.result?.error && <ScriptErrorPanel error={engine.result.error} />}
            {engine.result?.logs && engine.result.logs.length > 0 && (
              <div className="lq-script-tutorial__console">
                {engine.result.logs.map((line, i) => (
                  <div key={i} className="lq-script-tutorial__console-line">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="lq-script-tutorial__preview">
            <CandlestickChart
              key={runVersion}
              data={stepData}
              defaultIndicators={chartIndicators}
              defaultDrawings={engine.scriptDrawings}
              height={320}
              zoomable
              symbol="Démo"
            />
            {engine.scriptTable && <ScriptTableOverlay tables={[engine.scriptTable]} />}
          </div>
        </div>
      )}
    </div>
  );
}
