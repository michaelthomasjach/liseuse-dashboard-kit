import { useRef, type CSSProperties } from "react";
import { beginDrag, snapToStep, valueForKey } from "./internal/dragValue";
import "./BalanceControl.css";

export interface BalanceControlProps {
  /** −100 hard left, 0 centred, +100 hard right. */
  value: number;
  onChange: (value: number) => void;
  step?: number;
  /** What the two ends are called. Default "L" and "R". */
  leftLabel?: string;
  rightLabel?: string;
  label?: string;
  /** Formats the read-out. The default says which side it is leaning to rather than printing a
   *  signed number, because "−34" does not say "left" to anyone who has not read the prop doc. */
  formatValue?: (value: number) => string;
  /** How close to the centre the handle has to come before it snaps there, in units. Default 4.
   *  A real balance pot has a detent at the middle and it is the only way to reliably find dead
   *  centre by hand; without one, a dragged handle lands on −1 or +2 and stays there. Pass 0 for a
   *  perfectly linear control. */
  detent?: number;
  /** Hides the read-out. Default false. */
  hideValue?: boolean;
  disabled?: boolean;
  className?: string;
}

const MIN = -100;
const MAX = 100;

function defaultFormat(value: number): string {
  if (value === 0) return "Centré";
  return value < 0 ? `G ${Math.abs(value)}` : `D ${value}`;
}

/** Left/right balance — one handle on a track with a detent at dead centre, and a fill that runs
 *  *from the middle out* rather than from the left edge, so the picture is "how far off centre",
 *  which is the only thing a balance says.
 *
 *  Double-click (or Home) recentres. */
export function BalanceControl({
  value,
  onChange,
  step = 1,
  leftLabel = "L",
  rightLabel = "R",
  label,
  formatValue,
  detent = 4,
  hideValue = false,
  disabled = false,
  className,
}: BalanceControlProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const clamped = snapToStep(value, MIN, MAX, step);
  const settle = (next: number) => onChange(detent > 0 && Math.abs(next) <= detent ? 0 : next);

  // 0 → 50 %: the centre of the track is the origin, and everything below is drawn from it.
  const percent = ((clamped - MIN) / (MAX - MIN)) * 100;
  const fillStyle: CSSProperties =
    clamped >= 0 ? { left: "50%", width: `${percent - 50}%` } : { left: `${percent}%`, width: `${50 - percent}%` };

  return (
    <div
      className={["lq-balance", disabled && "lq-balance--disabled", className].filter(Boolean).join(" ")}
    >
      {(label || !hideValue) && (
        <div className="lq-balance__header">
          {label && <span className="lq-balance__label">{label}</span>}
          {!hideValue && <span className="lq-balance__value">{(formatValue ?? defaultFormat)(clamped)}</span>}
        </div>
      )}

      <div className="lq-balance__row">
        <span className="lq-balance__end">{leftLabel}</span>

        <div
          ref={trackRef}
          className="lq-balance__track"
          onPointerDown={(event) => {
            const track = trackRef.current;
            if (disabled || !track) return;
            beginDrag(event, { track, axis: "x", min: MIN, max: MAX, step, onChange: settle });
          }}
          onDoubleClick={() => {
            if (!disabled) onChange(0);
          }}
        >
          <span className="lq-balance__detent" />
          <span className="lq-balance__fill" style={fillStyle} />
          <span
            className="lq-balance__handle"
            style={{ left: `${percent}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            aria-valuenow={clamped}
            aria-valuetext={(formatValue ?? defaultFormat)(clamped)}
            aria-label={label ?? "Balance"}
            aria-disabled={disabled || undefined}
            onKeyDown={(event) => {
              if (disabled) return;
              const next = valueForKey(event.key, clamped, { min: MIN, max: MAX, step, home: 0 });
              if (next === null) return;
              event.preventDefault();
              // The keyboard steps past the detent instead of being caught by it: someone pressing
              // an arrow key is asking for exactly one step, and swallowing it into 0 would make
              // the control feel stuck near the middle.
              onChange(next);
            }}
          />
        </div>

        <span className="lq-balance__end">{rightLabel}</span>
      </div>
    </div>
  );
}
