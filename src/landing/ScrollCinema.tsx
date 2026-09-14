import { memo, useMemo } from "react";
import { CandlestickChart, type ChartEvent } from "../components/charts/CandlestickChart";
import type { ScriptDef } from "../components/charts/candlestick/interfaces/ScriptDef.interface";
import { generateCandles } from "../test-data/financeSampleData";
import { CINEMA_CODE, CINEMA_STEPS, CINEMA_STEP_ENDS } from "./cinemaScript";
import { NoCodeShowcase } from "./NoCodeShowcase";
import { AiShowcase } from "./AiShowcase";
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

  // The three beats, as shares of the held phase. The no-code canvas used to get 0.84 to 0.93 of
  // it — nine percent, against fifty for the typing — and a reader scrolling at any normal speed
  // saw it appear and leave before reading a single block. It now holds from 0.66 to 0.95, nearly
  // a third of the section, which is what it takes to follow thirteen blocks and their arrows. The
  // typing gives up the difference: it is the beat that explains itself fastest, since the code
  // arrives a character at a time and the chart answers every few lines.
  const panel = smoothstep(0.04, 0.13, held) * (1 - smoothstep(0.44, 0.5, held));
  const typing = smoothstep(0.13, 0.42, held);
  const noCode = smoothstep(0.46, 0.53, held) * (1 - smoothstep(0.74, 0.79, held));
  // The last beat: the canvas closes and the assistant opens on the same chart. It is the end of
  // the same story rather than a section further down the page — the script was written, then
  // drawn, and now something reads what it produced.
  const ai = smoothstep(0.76, 0.82, held) * (1 - smoothstep(0.97, 0.999, held));

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

              {/* An inert pane over the chart. `.lq-chart__overlay` carries `touch-action: none`
                  so the chart can own a finger for its crosshair, its drawings and its pan — right
                  everywhere else, and a trap here: on a phone a swipe started anywhere over the
                  plot moved nothing at all (measured: 0px, against 570px on the rest of the page).
                  This section's chart is a display, and the gesture belongs to the page, so this
                  catches it and does nothing with it. Deliberately NOT `pointer-events: none`,
                  which would hand the touch straight back to the chart. */}
              <div className="lqx-cinema__glass" aria-hidden="true" />

              <aside
                className="lqx-cinema__editor"
                // Only the progress; which edge it slides in from is the stylesheet's call.
                style={{ ["--panel-in" as string]: panel.toFixed(3) }}
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

              <div
                className="lqx-cinema__ai"
                style={{ opacity: ai, pointerEvents: ai > 0.5 ? "auto" : "none" }}
                aria-hidden={ai < 0.5}
              >
                <AiShowcase />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
