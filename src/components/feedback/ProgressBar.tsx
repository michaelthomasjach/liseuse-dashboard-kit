import type { ReactNode } from "react";
import "./ProgressBar.css";

export type ProgressBarSlot = "left" | "right" | "top" | "bottom" | "inside";

export interface ProgressBarProps {
  /** 0-100. Omit for an indeterminate bar. */
  value?: number;
  label?: ReactNode;
  /** Where `label` renders relative to the bar — "inside" overlays it centered on the track, in a
   *  color that stays readable over both the filled and unfilled portions (see
   *  `.lq-progress-bar__inside`'s own doc for how). Default "top", the original (and only)
   *  position this component had before `labelPosition`/`valuePosition` existed. */
  labelPosition?: ProgressBarSlot;
  /** Shows a numeric read-out of `value` alongside/on the bar — off by default (the original
   *  behavior had no separate value read-out at all; a caller wanting the number had to fold it
   *  into `label` itself). Meaningless while indeterminate (no percentage to show), and quietly
   *  ignored then regardless of this flag. */
  showValue?: boolean;
  formatValue?: (value: number) => string;
  /** Same five positions as `labelPosition`, independent of it — the two can share a position
   *  (rendered side by side there) or sit on opposite edges. Default "right". */
  valuePosition?: ProgressBarSlot;
  className?: string;
}

/** Linear progress indicator — determinate (`value` set) or indeterminate (`value` omitted, an
 *  animated stripe). `label`/the optional numeric read-out (`showValue`) can each independently
 *  land on any of the bar's four edges or overlay it directly (`labelPosition`/`valuePosition`) —
 *  from a plain loading bar with a caption above it (the default, and this component's original
 *  shape) to a compact metrics row (label left, value right) or a value centered inside a thicker
 *  bar. */
export function ProgressBar({ value, label, labelPosition = "top", showValue = false, formatValue, valuePosition = "right", className }: ProgressBarProps) {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value));
  const formattedValue = formatValue ? formatValue(clamped) : String(Math.round(clamped));

  const labelNode = label !== undefined && label !== null ? <span className="lq-progress-bar__label">{label}</span> : null;
  const valueNode = !indeterminate && showValue ? <span className="lq-progress-bar__value">{formattedValue}</span> : null;

  // One shared helper for every edge slot ("inside" is handled separately below, since it
  // overlays the track rather than sitting beside it) — label and value can land in the very same
  // slot (e.g. both "top"), so each slot renders whichever of the two are actually assigned to it,
  // label first, rather than only ever expecting one.
  function edgeSlot(position: Exclude<ProgressBarSlot, "inside">) {
    const items = [labelPosition === position ? labelNode : null, valuePosition === position ? valueNode : null].filter(Boolean);
    return items.length > 0 ? <div className={`lq-progress-bar__slot lq-progress-bar__slot--${position}`}>{items}</div> : null;
  }

  const insideItems = [labelPosition === "inside" ? labelNode : null, valuePosition === "inside" ? valueNode : null].filter(Boolean);

  return (
    <div className={["lq-progress-bar", className].filter(Boolean).join(" ")}>
      {edgeSlot("top")}
      <div className="lq-progress-bar__row">
        {edgeSlot("left")}
        <div className="lq-progress-bar__track" role="progressbar" aria-valuenow={indeterminate ? undefined : clamped} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={["lq-progress-bar__fill", indeterminate && "lq-progress-bar__fill--indeterminate"].filter(Boolean).join(" ")}
            style={indeterminate ? undefined : { width: `${clamped}%` }}
          />
          {insideItems.length > 0 && <div className="lq-progress-bar__inside">{insideItems}</div>}
        </div>
        {edgeSlot("right")}
      </div>
      {edgeSlot("bottom")}
    </div>
  );
}
