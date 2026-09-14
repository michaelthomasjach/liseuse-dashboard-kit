import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CloseIcon, ChevronDownIcon, DetachWindowIcon, SettingsIcon, HelpIcon } from "../../../icons";
import { computeMarketState, type MarketStateAxis, type MarketStateDirection } from "../marketState";
import { DEFAULT_MARKET_STATE_SETTINGS, type MarketStateSettings } from "../marketStateSettings";
import { MarketStateSettingsModal } from "./MarketStateSettingsModal";
import { MarketStateHelpModal } from "./MarketStateHelpModal";
import { MARKET_STATE_BAND_LABELS, type MarketStateBandColors } from "../marketStateBandColors";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import "./MarketStatePanel.css";

export interface MarketStatePanelProps {
  candles: Candle[];
  /** The bar to read — the hovered one, or the last when the pointer is away. */
  index: number;
  /** Exactly what the chart is drawing. Hidden indicators are filtered out by the caller: a score
   *  must never be fed by something the reader cannot see on the chart. */
  indicators: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  onClose: () => void;
  /** Formats the date of the bar being read, so the panel says which one it describes. */
  formatDate: (date: Date) => string;
  /** Opens the readout in a window of its own. Omitted (the detached copy's own case) hides the
   *  button — a window has nowhere further to go. */
  onRequestDetach?: () => void;
  /** The copy living in that window: it fills it rather than floating over a plot, so it drops the
   *  absolute positioning, the drag and the close button, none of which mean anything there. */
  detached?: boolean;
  /** The "surligner les zones" switch, owned by the chart because the shading it turns on is drawn
   *  on the chart, not here. Omitted hides the switch — a host with nowhere to draw bands should
   *  not offer to. */
  bandsOn?: boolean;
  onBandsChange?: (on: boolean) => void;
  /** The three zone colours, and the way to change them. Shown only while the shading is on —
   *  colour pickers for something invisible are three controls asking about nothing. */
  bandColors?: MarketStateBandColors;
  onBandColorsChange?: (colors: MarketStateBandColors) => void;
  /** Weights, thresholds and the neutral band. Absent keeps the defaults and hides the gear — a
   *  host that cannot store a change should not offer to take one. */
  settings?: MarketStateSettings;
  onSettingsChange?: (settings: MarketStateSettings) => void;
}

/** The Market State dashboard: five 0-100 readings of the market and one long-side signal, all
 *  computed from the indicators currently on the chart (see `marketState.ts` for the arithmetic).
 *
 *  It exists to answer the complaint that a chart carrying fifteen indicators is fifteen things to
 *  read every time you look at it. Which is only an improvement if the summary can be taken apart
 *  — a number you cannot question is a number you cannot use — so every row here opens onto the
 *  exact list of what fed it, and so does the signal at the bottom. Nothing is asserted that isn't
 *  also explained one click away.
 *
 *  Monospaced and boxed, deliberately: it is a readout, not a chart, and lining the figures up in
 *  a column is what makes five of them comparable at a glance. */
/** What the bottom line calls itself. The score is always read from the long side; only the label
 *  and the percentage beside it change with the side it lands on. */
const STANCE_LABEL: Record<MarketStateDirection, string> = {
  long: "LONG",
  neutral: "NEUTRE",
  short: "SHORT",
};

const SIGNAL_LABEL: Record<MarketStateDirection, string> = {
  long: "SIGNAL LONG",
  short: "SIGNAL SHORT",
  neutral: "SIGNAL NEUTRE",
};

export function MarketStatePanel({
  candles,
  index,
  indicators,
  onClose,
  formatDate,
  onRequestDetach,
  detached = false,
  bandsOn,
  onBandsChange,
  bandColors,
  onBandColorsChange,
  settings = DEFAULT_MARKET_STATE_SETTINGS,
  onSettingsChange,
}: MarketStatePanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The window the explanation has been torn off into. Opened inside the click that asks for it —
   *  a `window.open` deferred to an effect is no longer attributed to the gesture and browsers
   *  block it as an unsolicited popup. */
  const [helpWindow, setHelpWindow] = useState<Window | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  function openHelpWindow() {
    const child = window.open("", "", "width=760,height=900");
    if (child === null) return;
    setHelpWindow(child);
    setHelpOpen(false);
  }
  const [expanded, setExpanded] = useState<MarketStateAxis | "signal" | null>(null);
  // Where the reader has put it, as an offset from the corner it starts in. Kept here rather than
  // persisted: it is a position on *this* chart in *this* session, and a readout that reappeared
  // tomorrow in a spot chosen for a different screen would be worse than one that starts where it
  // always starts.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  function onHeaderPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (detached) return;
    // Not from the buttons: a press that starts on the close or detach icon is a click, and
    // capturing the pointer here would swallow it.
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHeaderPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== e.pointerId) return;
    setOffset({ x: drag.originX + (e.clientX - drag.startX), y: drag.originY + (e.clientY - drag.startY) });
  }

  function endDrag(e: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }
  const state = useMemo(
    () => computeMarketState({ candles, index, indicators, settings }),
    [candles, index, indicators, settings],
  );
  const bar = candles[state.atIndex];

  return (
    <section
      ref={(node) => {
        // The theme scope, looked up from the panel itself: whichever `.lq-root` this chart lives
        // in is what a detached window has to copy its palette from.
        rootRef.current = (node?.closest(".lq-root") as HTMLElement | null) ?? null;
      }}
      className={["lq-market-state", detached && "lq-market-state--detached"].filter(Boolean).join(" ")}
      aria-label="État du marché"
      // `translate`, not `top`/`left`: the panel keeps its corner anchoring (and so its own
      // max-height against the plot) and is simply moved from there, which is also the cheaper of
      // the two to animate on a drag.
      style={detached ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <header
        className="lq-market-state__head"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="lq-market-state__title">MARKET STATE</span>
        {onSettingsChange && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Réglages de l'état du marché"
            title="Réglages : poids, seuils, indicateurs"
          >
            <SettingsIcon size={11} />
          </button>
        )}
        {/* Right of the gear, as asked. The two content controls first — what this panel is about
            and how it is tuned — then the window ones. */}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Comprendre l'état du marché"
          title="Comprendre l'état du marché"
        >
          <HelpIcon size={11} />
        </button>
        {/* Straight to a window, skipping the modal — for a reader who wants the explanation open
            on a second screen while they work on the first. */}
        <button
          type="button"
          onClick={openHelpWindow}
          aria-label="Ouvrir l'explication dans une nouvelle fenêtre"
          title="Ouvrir l'explication dans une nouvelle fenêtre"
        >
          <DetachWindowIcon size={11} />
        </button>
        {onRequestDetach && (
          <button type="button" onClick={onRequestDetach} aria-label="Ouvrir dans une fenêtre" title="Ouvrir dans une fenêtre">
            <DetachWindowIcon size={11} />
          </button>
        )}
        {!detached && (
          <button type="button" onClick={onClose} aria-label="Fermer l'état du marché" title="Fermer">
            <CloseIcon size={11} />
          </button>
        )}
      </header>

      {/* All three sides at once, before any of the axes. A blended signal of 58 says "slightly
          long" and hides how it got there: five sources long against three short, and eleven all
          mildly long, are the same 58 and are not the same market. This is the vote behind the
          average — each source judged on its own thresholds (see the gear). */}
      <div className="lq-market-state__stance" role="group" aria-label="Répartition long, neutre, short">
        {(["long", "neutral", "short"] as MarketStateDirection[]).map((side) => (
          <div
            key={side}
            className={[
              "lq-market-state__stance-cell",
              `lq-market-state__stance-cell--${side}`,
              state.direction === side && "lq-market-state__stance-cell--leading",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="lq-market-state__stance-label">{STANCE_LABEL[side]}</span>
            <span className="lq-market-state__stance-value">{state.stance[side]} %</span>
            <span className="lq-market-state__stance-bar" aria-hidden="true">
              <span className="lq-market-state__stance-fill" style={{ width: `${state.stance[side]}%` }} />
            </span>
          </div>
        ))}
      </div>

      <div className="lq-market-state__box">
        {state.scores.map((score) => {
          const open = expanded === score.axis;
          return (
            <div key={score.axis} className="lq-market-state__row-group">
              <button
                type="button"
                className={["lq-market-state__row", open && "lq-market-state__row--open"].filter(Boolean).join(" ")}
                onClick={() => setExpanded(open ? null : score.axis)}
                aria-expanded={open}
                disabled={score.score === null}
              >
                <span className="lq-market-state__label">{score.label}</span>
                <span className="lq-market-state__value">
                  {score.score === null ? "—" : `${score.score}/100`}
                </span>
                {/* A bar behind the number, not beside it: the figure stays the thing you read,
                    and the fill is there for the glance that compares five rows at once. */}
                <span className="lq-market-state__gauge" aria-hidden="true">
                  <span style={{ width: `${score.score ?? 0}%` }} />
                </span>
                <ChevronDownIcon size={10} />
              </button>
              {open && (
                <div className="lq-market-state__detail">
                  <p className="lq-market-state__hint">{score.hint}</p>
                  {score.contributions.length === 0 ? (
                    <p className="lq-market-state__empty">Aucun indicateur affiché ne renseigne cet axe.</p>
                  ) : (
                    <ul className="lq-market-state__parts">
                      {score.contributions.map((part) => (
                        <li key={`${part.label}-${part.reading}`}>
                          <span className="lq-market-state__part-head">
                            <span className="lq-market-state__part-label">{part.label}</span>
                            <span className="lq-market-state__part-score">
                              {Math.round(part.score)}
                              <span className="lq-market-state__part-weight">×{part.weight}</span>
                            </span>
                          </span>
                          <span className="lq-market-state__part-reading">{part.reading}</span>
                          {/* The arithmetic, with this bar's numbers already in it. `why` says what
                              the reading means; this is the part a reader can actually disagree
                              with, so it gets the monospaced treatment the figures have. */}
                          <span className="lq-market-state__part-formula">{part.formula}</span>
                          <span className="lq-market-state__part-why">{part.why}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* One line, three possible answers. "Neutre" is a real reading, not a missing one: a blend of
          four axes that disagree sits near the middle, and dressing that up as a weak long is
          exactly how a readout starts lying to the person using it. */}
      <button
        type="button"
        className={[
          "lq-market-state__signal",
          `lq-market-state__signal--${state.direction}`,
          expanded === "signal" && "lq-market-state__signal--open",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setExpanded(expanded === "signal" ? null : "signal")}
        aria-expanded={expanded === "signal"}
        disabled={state.signal === null}
      >
        <span>{SIGNAL_LABEL[state.direction]}</span>
        <span className="lq-market-state__signal-value">{state.strength === null ? "—" : `${state.strength} %`}</span>
        <ChevronDownIcon size={10} />
      </button>
      {expanded === "signal" && (
        <div className="lq-market-state__detail lq-market-state__detail--signal">
          <p className="lq-market-state__hint">
            Moyenne pondérée des axes ci-dessus, lue du côté long : 50 est le milieu, 100 le plus haussier, 0 le plus
            baissier. Entre {50 - settings.neutralBand} et {50 + settings.neutralBand}, le signal est dit neutre — les axes
            se contredisent et il n'y a pas de côté à annoncer. La volatilité est volontairement absente du calcul : elle
            amplifie autant une bonne configuration qu'une mauvaise, donc la compter comme une direction serait faux dans
            les deux cas.
          </p>
          {/* Parenthesised, because it is the *sum* that is divided and not the last term — a
              formula that has to be read charitably to be right is not showing its work. */}
          <p className="lq-market-state__formula-line">
            {`(${state.signalParts
              .map((part) => `${Math.round(part.score)} × ${part.weight.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}`)
              .join(" + ")}) ÷ ${state.signalParts
              .reduce((sum, part) => sum + part.weight, 0)
              .toLocaleString("fr-FR", { minimumFractionDigits: 2 })} = ${state.signal}`}
          </p>
          <ul className="lq-market-state__parts">
            {state.signalParts.map((part) => (
              <li key={part.label}>
                <span className="lq-market-state__part-head">
                  <span className="lq-market-state__part-label">{part.label}</span>
                  <span className="lq-market-state__part-score">
                    {Math.round(part.score)}
                    <span className="lq-market-state__part-weight">×{part.weight}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onBandsChange && (
        <label className="lq-market-state__switch">
          <input type="checkbox" checked={bandsOn ?? false} onChange={(e) => onBandsChange(e.target.checked)} />
          <span>Surligner les zones sur le graphique</span>
        </label>
      )}
      {bandsOn && bandColors && onBandColorsChange && (
        <div className="lq-market-state__band-colors">
          {MARKET_STATE_BAND_LABELS.map(({ direction, label }) => (
            <label key={direction} className="lq-market-state__band-color">
              <input
                type="color"
                value={bandColors[direction]}
                onChange={(e) => onBandColorsChange({ ...bandColors, [direction]: e.target.value })}
                aria-label={`Couleur de la zone ${label}`}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}

      {bar && <p className="lq-market-state__at">Bougie du {formatDate(bar.date)}</p>}

      <MarketStateHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        settings={settings}
        detachedWindow={helpWindow}
        onDetach={openHelpWindow}
        onDetachedClose={() => setHelpWindow(null)}
        themeSource={rootRef.current}
      />

      {onSettingsChange && (
        <MarketStateSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onChange={onSettingsChange}
          // Built from this very reading, so the settings can only ever offer rows that are
          // actually being counted right now.
          sources={state.scores.map((score) => ({ axis: score.axis, axisLabel: score.label, contributions: score.contributions }))}
        />
      )}
    </section>
  );
}
