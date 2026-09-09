import { useMemo, useState } from "react";
import { CloseIcon, ChevronDownIcon } from "../../../icons";
import { computeMarketState, SIGNAL_NEUTRAL_BAND, type MarketStateAxis, type MarketStateDirection } from "../marketState";
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
const SIGNAL_LABEL: Record<MarketStateDirection, string> = {
  long: "SIGNAL LONG",
  short: "SIGNAL SHORT",
  neutral: "SIGNAL NEUTRE",
};

export function MarketStatePanel({ candles, index, indicators, onClose, formatDate }: MarketStatePanelProps) {
  const [expanded, setExpanded] = useState<MarketStateAxis | "signal" | null>(null);
  const state = useMemo(
    () => computeMarketState({ candles, index, indicators }),
    [candles, index, indicators],
  );
  const bar = candles[state.atIndex];

  return (
    <section className="lq-market-state" aria-label="État du marché">
      <header className="lq-market-state__head">
        <span className="lq-market-state__title">MARKET STATE</span>
        <button type="button" onClick={onClose} aria-label="Fermer l'état du marché" title="Fermer">
          <CloseIcon size={11} />
        </button>
      </header>

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
            baissier. Entre {50 - SIGNAL_NEUTRAL_BAND} et {50 + SIGNAL_NEUTRAL_BAND}, le signal est dit neutre — les axes
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

      {bar && <p className="lq-market-state__at">Bougie du {formatDate(bar.date)}</p>}
    </section>
  );
}
