import { useMemo } from "react";
import { CandlestickChart } from "../components/charts/CandlestickChart";
import type { ScriptDef } from "../components/charts/candlestick/interfaces/ScriptDef.interface";
import { generateCandles } from "../test-data/financeSampleData";
import { CINEMA_CODE, CINEMA_STEPS, CINEMA_STEP_ENDS } from "./cinemaScript";
import { NoCodeShowcase } from "./NoCodeShowcase";
import { phase, useScrollProgress } from "./useScrollProgress";
import "./ScrollCinema.css";

// Shorter than the hero's series on purpose: every step of the script below is a real run over the
// whole history, and four of them happen while the reader is still scrolling.
const CINEMA_CANDLES = generateCandles(260, 172, 9);

const SCRIPT_ID = "cinema";

/** The chart grows to fill the screen, the editor slides in, the script types itself, and each
 *  finished step actually runs.
 *
 *  Nothing here is a mock-up: `scripts` is a controlled prop of `CandlestickChart`, so the code on
 *  the right is the code the engine executes, and the moving averages, the RSI pane and the
 *  signals that appear on the left are its real output. The one liberty taken is the editor's
 *  chrome, which is drawn here rather than being the chart's own editor window (that one lives in
 *  `ChartWorkspace` and opens on a click, which a scroll cannot stand in for).
 *
 *  The chart is mounted once at full size and revealed through `clip-path`, never resized: a chart
 *  whose box changes re-measures and redraws, and doing that on every scroll frame is what turns a
 *  section like this into a stuttering one. */
export function ScrollCinema() {
  const [sectionRef, progress] = useScrollProgress();

  // How much of the script has been typed, and therefore how many steps have run.
  const grow = phase(progress, 0.04, 0.24);
  const panel = phase(progress, 0.3, 0.4);
  const typing = phase(progress, 0.4, 0.84);
  const noCode = phase(progress, 0.88, 0.97);

  const typedLength = Math.round(typing * CINEMA_CODE.length);
  const stepsDone = CINEMA_STEP_ENDS.filter((end) => typedLength >= end).length;

  /* Derived, not stored. `runRequestId` is what makes the engine re-run, and it is bumped once per
     completed step rather than once per typed character: four runs across the whole section
     instead of several hundred. Nothing writes back into this list, so there is no state to keep
     in sync with the scroll position. */
  const scripts = useMemo<ScriptDef[]>(() => {
    if (stepsDone === 0) return [];
    const code = CINEMA_STEPS.slice(0, stepsDone).map((s) => s.code).join("");
    return [{ id: SCRIPT_ID, name: "Croisement de moyennes", code, enabled: true, runRequestId: stepsDone, runDraftCode: code }];
  }, [stepsDone]);

  const typed = CINEMA_CODE.slice(0, typedLength);
  const caption = stepsDone > 0 ? CINEMA_STEPS[stepsDone - 1].caption : null;

  // Revealed area, as a clip-path inset. 12% of the viewport all round at rest, none once grown.
  const inset = useMemo(() => {
    const v = (1 - grow) * 11;
    const h = (1 - grow) * 16;
    return `inset(${v.toFixed(2)}% ${h.toFixed(2)}% ${v.toFixed(2)}% ${h.toFixed(2)}%)`;
  }, [grow]);

  return (
    <section className="lqx-cinema" ref={sectionRef}>
      <div className="lqx-cinema__sticky">
        <div
          className="lqx-cinema__chart"
          style={{ clipPath: inset, transform: `scale(${(0.965 + grow * 0.035).toFixed(4)})` }}
        >
          <CandlestickChart
            data={CINEMA_CANDLES}
            symbol="MSFT"
            fillHeight
            zoomable={false}
            showVolume
            scripts={scripts}
          />
        </div>

        <div className="lqx-cinema__veil" style={{ opacity: (1 - grow) * 0.55 }} aria-hidden="true" />

        <header className="lqx-cinema__intro" style={{ opacity: 1 - phase(progress, 0.16, 0.28) }}>
          <p className="lqx-cinema__kicker">Continuez à faire défiler</p>
          <h2 className="lqx-cinema__title">
            Tes idées, ton code, tes indicateurs, <span className="lqx-cinema__accent">au même endroit</span>.
          </h2>
        </header>

        <aside
          className="lqx-cinema__editor"
          style={{ transform: `translateX(${((1 - panel) * 110).toFixed(2)}%)`, opacity: 1 - noCode }}
          aria-hidden={panel < 0.5}
        >
          <div className="lqx-cinema__editor-bar">
            <span className="lqx-cinema__dots">
              <span />
              <span />
              <span />
            </span>
            <span className="lqx-cinema__filename">croisement.js</span>
            <span className="lqx-cinema__badge">{stepsDone > 0 ? "en cours d'exécution" : "prêt"}</span>
          </div>
          <pre className="lqx-cinema__code">
            <code>
              {typed}
              <span className="lqx-cinema__caret" />
            </code>
          </pre>
          <div className="lqx-cinema__status">{caption ?? "Le script s'écrit, la chart suit."}</div>
        </aside>

        <div className="lqx-cinema__nocode" style={{ opacity: noCode, pointerEvents: noCode > 0.5 ? "auto" : "none" }}>
          <NoCodeShowcase />
        </div>
      </div>
    </section>
  );
}
