import type { CSSProperties, ReactNode } from "react";
import "./Stepper.css";

export type StepperOrientation = "horizontal" | "vertical";

export interface StepperStep {
  id: string;
  /** Shown under the square (horizontal) or beside it (vertical). A node, not a string, so a
   *  caller can stack a title over a date without this component growing a second text prop. */
  label?: ReactNode;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index of the step currently in progress. `steps.length` means every step is behind us —
   *  nothing is active any more and the whole line, trailing tail included, reads as travelled. */
  active: number;
  /** Default "horizontal". Vertical puts the label *beside* the square rather than under it: the
   *  space under a square in a vertical stepper is where the line to the next step runs, and text
   *  dropped there would sit on top of it. */
  orientation?: StepperOrientation;
  /** Side of the squares, in px. Default 12. The line is centred on this, so changing it moves the
   *  line with it. */
  markerSize?: number;
  /** Line thickness in px. Default 2. */
  thickness?: number;
  /** Opacity of the current step. Default 1 — everything else is measured down from it. */
  activeOpacity?: number;
  /** Opacity of the steps already passed, and of the line segments leading to the current one.
   *  Default 0.55: dimmer than the active step (which is what "only the current one is at full
   *  strength" asks for) but clearly above the steps still to come, so the eye can still read how
   *  far along the sequence is — a single dim level for both sides would show progress on the
   *  squares' colours and nowhere else. */
  completedOpacity?: number;
  /** Opacity of the steps still ahead, and of the line segments leading to them. Default 0.22. */
  upcomingOpacity?: number;
  /** Minimum length of one step along the line, in px (a row's height when vertical, a column's
   *  width when horizontal). Default 56 vertical / 0 horizontal — a horizontal stepper already
   *  gets its width from its container and only needs a floor when its labels are very short. */
  stepSize?: number;
  className?: string;
}

/** A sequence of steps threaded on a line: small filled squares the line runs straight through,
 *  each with its own text, horizontally or vertically.
 *
 *  Every part of it fades by position rather than by colour — the current step at full strength,
 *  what is behind it dimmer, what is ahead dimmest — and the line is cut into one independent
 *  segment per gap so it fades the same way, brightening up to the current square and staying pale
 *  past it. The line starts at the very edges: a leading segment before the first square and a
 *  trailing one after the last, so the track spans the full width (or height) rather than stopping
 *  at the outer squares. */
export function Stepper({
  steps,
  active,
  orientation = "horizontal",
  markerSize,
  thickness,
  activeOpacity,
  completedOpacity,
  upcomingOpacity,
  stepSize,
  className,
}: StepperProps) {
  const count = steps.length;
  if (count === 0) return null;

  // `steps.length` is a legal value — "all done", no active step — so this clamps to [0, count]
  // rather than to the last index.
  const activeIndex = Math.max(0, Math.min(count, Math.round(active)));

  // The squares sit at the centre of equal columns (rows), i.e. step k is at (k + 0.5) / count of
  // the track. A segment runs from one centre to the next, except the first and last, which run
  // from (to) the container edge. Positioning the line off those same fractions — rather than
  // threading segments and squares through one flex row — is what keeps the two layers aligned:
  // the squares have a width of their own and would push every centre off the fraction the labels
  // below them are centred on.
  const segments = Array.from({ length: count + 1 }, (_, i) => {
    const start = i === 0 ? 0 : (i - 0.5) / count;
    const end = i === count ? 1 : (i + 0.5) / count;
    return {
      offset: `${start * 100}%`,
      length: `${(end - start) * 100}%`,
      // Segment i arrives at step i, so everything up to and including the active step's own
      // incoming segment is travelled. The trailing segment (i === count) only lights up once
      // activeIndex reaches count, which is exactly the "all done" case.
      done: i <= activeIndex,
    };
  });

  const style: CSSProperties = {};
  const setVar = (name: string, value: string) => {
    (style as Record<string, string>)[name] = value;
  };
  if (markerSize !== undefined) setVar("--lq-stepper-marker-size", `${markerSize}px`);
  if (thickness !== undefined) setVar("--lq-stepper-thickness", `${thickness}px`);
  if (stepSize !== undefined) setVar("--lq-stepper-step-size", `${stepSize}px`);
  // Each level feeds two different properties — `opacity` for the text, and a color-mix share for
  // the squares and the line — so both spellings of the same number are written out here. The
  // squares cannot simply take `opacity`: the line runs *behind* them, and a translucent square
  // would show it straight through the middle of what is meant to be a solid block. Mixing toward
  // the backdrop instead keeps them opaque at every level.
  const setLevel = (name: string, value: number | undefined) => {
    if (value === undefined) return;
    setVar(`--lq-stepper-o-${name}`, String(value));
    setVar(`--lq-stepper-mix-${name}`, `${value * 100}%`);
  };
  setLevel("active", activeOpacity);
  setLevel("completed", completedOpacity);
  setLevel("upcoming", upcomingOpacity);

  return (
    <div className={["lq-stepper", `lq-stepper--${orientation}`, className].filter(Boolean).join(" ")} style={style}>
      <div className="lq-stepper__line" aria-hidden="true">
        {segments.map((segment, i) => (
          <span
            key={i}
            className={`lq-stepper__segment lq-stepper__segment--${segment.done ? "completed" : "upcoming"}`}
            style={orientation === "horizontal" ? { left: segment.offset, width: segment.length } : { top: segment.offset, height: segment.length }}
          />
        ))}
      </div>
      <ol className="lq-stepper__steps">
        {steps.map((step, i) => {
          const state = i === activeIndex ? "active" : i < activeIndex ? "completed" : "upcoming";
          return (
            <li key={step.id} className={`lq-stepper__step lq-stepper__step--${state}`} aria-current={state === "active" ? "step" : undefined}>
              <span className="lq-stepper__marker" />
              {step.label !== undefined && step.label !== null && <span className="lq-stepper__label">{step.label}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
