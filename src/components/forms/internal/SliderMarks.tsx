import type { CSSProperties } from "react";
import { hasMarkLabels, type SliderMarkLike } from "./sliderMath";

/** La rangée de graduations sous la piste (à sa droite en vertical). `data-mark-value` permet à la
 *  zone de geste d'amener exactement à la graduation cliquée. */
export function SliderMarks({
  marks,
  min,
  max,
  isActive,
}: {
  marks: SliderMarkLike[];
  min: number;
  max: number;
  isActive: (value: number) => boolean;
}) {
  if (marks.length === 0) return null;
  const labelled = hasMarkLabels(marks);
  const span = max - min || 1;
  return (
    <div className="lq-slider__marks" aria-hidden="true">
      {marks.map((m) => (
        <span
          key={m.value}
          data-mark-value={labelled ? m.value : undefined}
          className={[
            "lq-slider__mark",
            isActive(m.value) && "lq-slider__mark--active",
            m.value === min && "lq-slider__mark--start",
            m.value === max && "lq-slider__mark--end",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--lq-slider-mark-pos": `${((m.value - min) / span) * 100}%` } as CSSProperties}
        >
          {labelled && <span className="lq-slider__mark-label">{m.label}</span>}
        </span>
      ))}
    </div>
  );
}
