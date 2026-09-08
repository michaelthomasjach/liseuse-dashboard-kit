import type { StrategyRobustness } from "../interfaces/StrategyRobustness.interface";
import { memo } from "react";

export interface StrategyRobustnessPanelProps {
  robustness: StrategyRobustness;
}

/** The robustness score and, always beside it, what it is made of.
 *
 *  Never the bare number. A single "82/100" is exactly the kind of figure that gets quoted without
 *  its assumptions and then trusted past what it can bear — so the axes are listed underneath with
 *  their own reading, and the two this engine cannot measure from a single backtest are shown as
 *  unmeasured rather than dropped. A reader who does not know parameter stability was never tested
 *  will over-read whatever remains. */
function StrategyRobustnessPanelImpl({ robustness }: StrategyRobustnessPanelProps) {
  const tone = robustness.score === null ? "" : robustness.score >= 70 ? "up" : robustness.score >= 40 ? "" : "down";
  // A mean treats a fatal axis as equal to a cosmetic one: a strategy whose entire profit vanishes
  // at double commission still averages to a respectable-looking number if its other axes hold.
  // Naming the weakest one in the header stops the total from hiding it, without replacing the mean
  // by something harder to explain.
  const measured = robustness.components.filter((c): c is typeof c & { score: number } => c.score !== null);
  const weakest = measured.length > 1 ? measured.reduce((low, c) => (c.score < low.score ? c : low)) : null;
  const showWeakest = weakest !== null && robustness.score !== null && weakest.score < robustness.score - 15;

  return (
    <div className="lq-strategy__robustness">
      <div className="lq-strategy__robustness-head">
        <span className="lq-strategy__robustness-label">Robustesse</span>
        {robustness.score === null ? (
          <span className="lq-strategy__robustness-none">non calculée</span>
        ) : (
          <>
            {/* A ten-segment bar rather than a smooth gauge: the underlying number is a mean of a
                handful of coarse axes, and a gauge reading 82.4 would claim a precision it has
                nowhere near. */}
            <span className="lq-strategy__robustness-bar" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={[
                    "lq-strategy__robustness-cell",
                    i * 10 < robustness.score! && `lq-strategy__robustness-cell--on`,
                    i * 10 < robustness.score! && tone && `lq-strategy__robustness-cell--${tone}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))}
            </span>
            <span className={["lq-strategy__robustness-score", tone && `lq-strategy__metric-value--${tone}`].filter(Boolean).join(" ")}>
              {robustness.score}/100
            </span>
          </>
        )}
      </div>

      {showWeakest && (
        <p className="lq-strategy__robustness-reason">
          Maillon faible : <strong>{weakest.label.toLowerCase()}</strong> à {Math.round(weakest.score)}. La note globale est une moyenne — elle
          ne dit pas à elle seule qu&apos;un seul de ces axes peut suffire à faire tomber la stratégie.
        </p>
      )}
      {robustness.unavailableReason && <p className="lq-strategy__robustness-reason">{robustness.unavailableReason}</p>}

      <ul className="lq-strategy__robustness-list">
        {robustness.components.map((component) => (
          <li
            className={["lq-strategy__robustness-item", component.score === null && "lq-strategy__robustness-item--unmeasured"]
              .filter(Boolean)
              .join(" ")}
            key={component.id}
          >
            <span className="lq-strategy__robustness-item-label">{component.label}</span>
            <span className="lq-strategy__robustness-item-score">{component.score === null ? "non mesuré" : Math.round(component.score)}</span>
            <span className="lq-strategy__robustness-item-detail">{component.detail}</span>
          </li>
        ))}
      </ul>

      <p className="lq-strategy__hint">
        Calculé sur un seul backtest. La sensibilité aux coûts est recalculée sur les trades existants, ce qui en fait une borne optimiste :
        à coûts réellement différents, un dimensionnement en pourcentage d&apos;équité aurait aussi déplacé les tailles.
      </p>
    </div>
  );
}

/** Pure function of the run's own robustness scores — nothing the cursor can change.
 *
 *  A shallow prop comparison is enough: every prop here is either a primitive or an array/object
 *  the panel already holds stable across renders (it comes from the run result, which only changes
 *  when the script re-runs). */
export const StrategyRobustnessPanel = memo(StrategyRobustnessPanelImpl);
