import { useMemo } from "react";
import { CandlestickChart, type ChartEvent } from "../components/charts/CandlestickChart";
import type { ScriptDef } from "../components/charts/candlestick/interfaces/ScriptDef.interface";
import { generateCandles } from "../test-data/financeSampleData";
import { CINEMA_CODE, CINEMA_STEPS, CINEMA_STEP_ENDS } from "./cinemaScript";
import { NoCodeShowcase } from "./NoCodeShowcase";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { phase, useScrollProgress } from "./useScrollProgress";
import "./ScrollCinema.css";

// Shorter than the hero's series on purpose: every step of the script below is a real run over the
// whole history, and four of them happen while the reader is still scrolling.
const CINEMA_CANDLES = generateCandles(260, 172, 9);

const SCRIPT_ID = "cinema";

/** What the chart measures at rest: the width of the page's own content column, and the height a
 *  chart of this kind gets when it sits in a section like any other. */
const REST_MAX_WIDTH = 1180;
const REST_PADDING = 64;
const REST_HEIGHT = 460;

const CINEMA_EVENTS: ChartEvent[] = [
  { date: CINEMA_CANDLES[70].date, kind: "earnings", label: "Résultats T2 : BPA 1,51 $ (attendu 1,48 $)" },
  { date: CINEMA_CANDLES[168].date, kind: "dividend", label: "Dividende détaché : 0,62 $/action" },
];

const CINEMA_TIMEFRAMES = [
  { group: "Jours", options: [{ label: "1 jour", value: "1d" }, { label: "1 semaine", value: "1w" }] },
];

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

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
 *  The chart is genuinely resized rather than revealed through a mask: at rest it has to *be* a
 *  chart at the column's width, with its toolbar and its axes at their normal size, not a crop of
 *  a bigger one. Every re-measure that costs is paid for by `useScrollProgress`, which writes at
 *  most once per animation frame, so the chart redraws at the frame rate and no faster however
 *  hard the wheel is spun. */
export function ScrollCinema() {
  const [sectionRef, progress] = useScrollProgress();
  const [stageRef, stageWidth] = useMeasuredWidth();

  const open = phase(progress, 0.04, 0.2);
  const close = phase(progress, 0.9, 1);
  // One number for the whole choreography: 0 is "a chart in the page", 1 is "the chart is the page".
  const openness = Math.max(0, open - close);

  const panel = phase(progress, 0.26, 0.34) * (1 - phase(progress, 0.74, 0.8));
  const typing = phase(progress, 0.34, 0.72);
  const noCode = phase(progress, 0.76, 0.83) * (1 - phase(progress, 0.88, 0.94));

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

  const restWidth = Math.min(REST_MAX_WIDTH, Math.max(320, stageWidth - REST_PADDING));
  const box = stageWidth === 0
    ? undefined
    : {
        width: Math.round(lerp(restWidth, stageWidth, openness)),
        height: Math.round(lerp(REST_HEIGHT, window.innerHeight, openness)),
      };

  return (
    <section className="lqx-cinema" ref={sectionRef}>
      <div className="lqx-cinema__sticky" ref={stageRef}>
        {/* Nudged down while it is still a card, to clear the headline above it; the offset goes
            with the growth, so at full screen it is exactly centred. */}
        <div
          className="lqx-cinema__box"
          style={{ ...box, transform: `translateY(${Math.round((1 - openness) * 96)}px)` }}
        >
          {box !== undefined && (
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
              // The wheel belongs to the page here: it is what advances the sequence, so the chart
              // must not swallow it to zoom. Everything else the toolbar offers stays on.
              zoomable={false}
              scripts={scripts}
            />
          )}
        </div>

        <header className="lqx-cinema__intro" style={{ opacity: 1 - phase(progress, 0.1, 0.2) }}>
          <p className="lqx-cinema__kicker">Continuez à faire défiler</p>
          <h2 className="lqx-cinema__title">
            Tes idées, ton code, tes indicateurs, <span className="lqx-cinema__accent">au même endroit</span>.
          </h2>
        </header>

        <aside
          className="lqx-cinema__editor"
          style={{
            transform: `translateX(${((1 - panel) * 112).toFixed(2)}%) scale(${(0.96 + panel * 0.04).toFixed(3)})`,
            opacity: panel,
          }}
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
    </section>
  );
}
