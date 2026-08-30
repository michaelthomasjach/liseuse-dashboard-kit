import type { ReactNode } from "react";
import "./ProgressBar.css";

export type ProgressBarSlot = "left" | "right" | "top" | "bottom" | "inside";

export interface ProgressBarSegment {
  id: string;
  /** This segment's own magnitude — its rendered width is its share of the *sum of every
   *  segment's* value (not a share of `min`-`max`), so segments always partition the whole track
   *  edge to edge regardless of what scale the values themselves are on. */
  value: number;
  /** Defaults to a color cycled from a small built-in palette (mirrors `charts/internal/
   *  palette.ts`'s own list, duplicated by hand rather than imported — this component lives
   *  outside the `charts/` module and has no business reaching into another module's own
   *  `internal/` folder) if omitted, but a meaningful segmented bar (sector allocation, budget
   *  breakdown…) almost always wants its own explicit colors instead. */
  color?: string;
  /** Shown in this segment's own native-tooltip (`title` attribute) alongside its value — no
   *  custom tooltip UI, this is a plain presentational primitive, not a chart. */
  label?: string;
}

// Mirrors charts/internal/palette.ts's own CHART_PALETTE — see ProgressBarSegment.color's own doc
// for why this is a hand-kept duplicate instead of a cross-module import.
const SEGMENT_PALETTE = [
  "var(--lq-color-accent)",
  "var(--lq-color-green)",
  "var(--lq-color-amber)",
  "var(--lq-color-sky)",
  "var(--lq-color-rose)",
  "var(--lq-color-violet)",
];

export interface ProgressBarProps {
  /** 0-100. Omit for an indeterminate bar. Ignored once `segments` is set. */
  value?: number;
  /** Splits the bar into multiple proportional colored sections side by side instead of a single
   *  fill — a sector-allocation/budget-breakdown bar rather than a plain progress meter. Takes
   *  over from `value`/`showValue` entirely when set (there's no single "percent done" once the
   *  bar represents several parts of a whole at once) — `label`/`labelPosition` still work
   *  normally alongside it, for an overall caption. */
  segments?: ProgressBarSegment[];
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
  /** Track height in px. Default 6 (the original, only size this component ever had) — fill/
   *  segments always stay `height: 100%` of the track, so they thicken along with it automatically. */
  thickness?: number;
  /** Whether the track shows a border — omit to keep the palette's own existing default (only
   *  "eink" gets one automatically, every other palette relies on the fill/track color contrast
   *  alone); set explicitly to force it on or off regardless of palette, including overriding
   *  eink's own otherwise-automatic border. */
  bordered?: boolean;
  className?: string;
}

/** Linear progress indicator — determinate (`value` set) or indeterminate (`value` omitted, an
 *  animated stripe). `label`/the optional numeric read-out (`showValue`) can each independently
 *  land on any of the bar's four edges or overlay it directly (`labelPosition`/`valuePosition`) —
 *  from a plain loading bar with a caption above it (the default, and this component's original
 *  shape) to a compact metrics row (label left, value right) or a value centered inside a thicker
 *  bar. */
export function ProgressBar({
  value,
  segments,
  label,
  labelPosition = "top",
  showValue = false,
  formatValue,
  valuePosition = "right",
  thickness,
  bordered,
  className,
}: ProgressBarProps) {
  const indeterminate = !segments && value === undefined;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value ?? 0));
  const formattedValue = formatValue ? formatValue(clamped) : String(Math.round(clamped));
  const segmentTotal = segments ? segments.reduce((sum, s) => sum + Math.max(0, s.value), 0) : 0;

  const labelNode = label !== undefined && label !== null ? <span className="lq-progress-bar__label">{label}</span> : null;
  const valueNode = !segments && !indeterminate && showValue ? <span className="lq-progress-bar__value">{formattedValue}</span> : null;

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
        <div
          className={[
            "lq-progress-bar__track",
            bordered === true && "lq-progress-bar__track--bordered",
            bordered === false && "lq-progress-bar__track--no-border",
          ]
            .filter(Boolean)
            .join(" ")}
          style={thickness !== undefined ? { height: thickness } : undefined}
          role={segments ? undefined : "progressbar"}
          aria-valuenow={!segments && !indeterminate ? clamped : undefined}
          aria-valuemin={segments ? undefined : 0}
          aria-valuemax={segments ? undefined : 100}
        >
          {segments ? (
            <div className="lq-progress-bar__segments">
              {segments
                .filter((s) => s.value > 0)
                .map((s, i) => (
                  <div
                    key={s.id}
                    className="lq-progress-bar__segment"
                    style={{ width: `${(s.value / (segmentTotal || 1)) * 100}%`, backgroundColor: s.color ?? SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] }}
                    title={s.label ? `${s.label} — ${s.value}` : String(s.value)}
                  />
                ))}
            </div>
          ) : (
            <div
              className={["lq-progress-bar__fill", indeterminate && "lq-progress-bar__fill--indeterminate"].filter(Boolean).join(" ")}
              style={indeterminate ? undefined : { width: `${clamped}%` }}
            />
          )}
          {insideItems.length > 0 && <div className="lq-progress-bar__inside">{insideItems}</div>}
        </div>
        {edgeSlot("right")}
      </div>
      {edgeSlot("bottom")}
    </div>
  );
}
