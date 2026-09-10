import { memo, useMemo } from "react";
import { CandlestickChart, type ChartEvent } from "../components/charts/CandlestickChart";
import type { ScriptDef } from "../components/charts/candlestick/interfaces/ScriptDef.interface";
import { generateCandles } from "../test-data/financeSampleData";
import { CINEMA_CODE, CINEMA_STEPS, CINEMA_STEP_ENDS } from "./cinemaScript";
import { NoCodeShowcase } from "./NoCodeShowcase";
import { smoothstep, useCinemaScroll } from "./useCinemaScroll";
import "./ScrollCinema.css";

// Shorter than the hero's series on purpose: every step of the script below is a real run over the
// whole history, and four of them happen while the reader is still scrolling.
const CINEMA_CANDLES = generateCandles(260, 172, 9);

const SCRIPT_ID = "cinema";

const CINEMA_EVENTS: ChartEvent[] = [
  { date: CINEMA_CANDLES[70].date, kind: "earnings", label: "Résultats T2 : BPA 1,51 $ (attendu 1,48 $)" },
  { date: CINEMA_CANDLES[168].date, kind: "dividend", label: "Dividende détaché : 0,62 $/action" },
];

const CINEMA_TIMEFRAMES = [
  { group: "Jours", options: [{ label: "1 jour", value: "1d" }, { label: "1 semaine", value: "1w" }] },
];

/** The chart, isolated behind `memo` so the only thing that re-renders it is the script list.
 *
 *  Everything else in this section moves sixty times a second: the geometry through CSS custom
 *  properties (no render at all) and the typed text through state (a render per character). A
 *  chart re-created on each of those would redraw its canvas for nothing. */
const CinemaChart = memo(function CinemaChart({ scripts }: { scripts: ScriptDef[] }) {
  return (
    <CandlestickChart
      data={CINEMA_CANDLES}
      symbol="MSFT"
      fillHeight
      showVolume
      showIndicators
      showTemplates
      drawingTools
      fullscreenToggle
      events={CINEMA_EVENTS}
      timeframes={CINEMA_TIMEFRAMES}
      // The wheel belongs to the page here: it is what advances the sequence, so the chart must
      // not swallow it to zoom. Everything else the toolbar offers stays on.
      zoomable={false}
      scripts={scripts}
    />
  );
});

/** A scrollytelling beat: the page pins, the chart opens out of the flow to fill the screen, the
 *  scripting editor comes up in front of it, the script types itself, and then everything folds
 *  back to where it started and the page carries on.
 *
 *  Nothing here is a mock-up. `scripts` is a controlled prop of `CandlestickChart`, so the code in
 *  the panel is the code the engine executes, and the moving averages, the RSI pane and the
 *  signals appearing behind it are its real output. The one liberty is the panel's chrome, drawn
 *  here rather than being the chart's own editor window — that one lives in `ChartWorkspace` and
 *  opens on a click, which a scroll cannot stand in for.
 *
 *  The geometry belongs to `useCinemaScroll`, which writes it as CSS variables from a smoothed
 *  rAF loop; this component only decides what is written *in* the panel. */
export function ScrollCinema() {
  const refs = useCinemaScroll();
  const { held } = refs.state;

  const panel = smoothstep(0.06, 0.18, held) * (1 - smoothstep(0.72, 0.8, held));
  const typing = smoothstep(0.18, 0.68, held);
  const noCode = smoothstep(0.76, 0.84, held) * (1 - smoothstep(0.93, 0.99, held));

  const typedLength = Math.round(typing * CINEMA_CODE.length);
  const stepsDone = CINEMA_STEP_ENDS.filter((end) => typedLength >= end).length;

  /* Derived, not stored. `runRequestId` is what makes the engine re-run, and it is bumped once per
     completed step rather than once per typed character: four runs across the whole section
     instead of several hundred. */
  const scripts = useMemo<ScriptDef[]>(() => {
    if (stepsDone === 0) return [];
    const code = CINEMA_STEPS.slice(0, stepsDone).map((s) => s.code).join("");
    return [{ id: SCRIPT_ID, name: "Croisement de moyennes", code, enabled: true, runRequestId: stepsDone, runDraftCode: code }];
  }, [stepsDone]);

  const typed = CINEMA_CODE.slice(0, typedLength);
  const caption = stepsDone > 0 ? CINEMA_STEPS[stepsDone - 1].caption : null;

  return (
    <div className="lqx-cinema" ref={refs.container}>
      <section className="lqx-cinema__section" ref={refs.section}>
        <div className="lqx-cinema__sticky">
          <div className="lqx-cinema__wrapper">
            <div className="lqx-cinema__label" ref={refs.label}>
              <div>
                <span className="lqx-cinema__kicker">Scripting</span>
                <h2 className="lqx-cinema__title">
                  Tes idées, ton code, tes indicateurs, <span className="lqx-cinema__accent">au même endroit</span>.
                </h2>
              </div>
              <span className="lqx-cinema__nudge">Faites défiler pour entrer</span>
            </div>

            <div className="lqx-cinema__stage" ref={refs.stage}>
              <CinemaChart scripts={scripts} />

              <aside
                className="lqx-cinema__editor"
                style={{ transform: `translateX(${((1 - panel) * 112).toFixed(2)}%)`, opacity: panel }}
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

              <div
                className="lqx-cinema__nocode"
                style={{ opacity: noCode, pointerEvents: noCode > 0.5 ? "auto" : "none" }}
                aria-hidden={noCode < 0.5}
              >
                <NoCodeShowcase />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
