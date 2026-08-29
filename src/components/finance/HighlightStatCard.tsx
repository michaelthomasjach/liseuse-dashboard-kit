import type { ReactNode } from "react";
import { Highlight } from "../primitives/Highlight";
import { Sparkline } from "../charts/Sparkline";
import "./HighlightStatCard.css";

export interface HighlightStatCardProps {
  /** Small muted uppercase label, e.g. "52-week high" (`Highlight` uppercases it via CSS — pass
   *  normal case). */
  label: string;
  value: ReactNode;
  /** Short line under the value, e.g. "3,6 % en dessous". */
  subtext?: ReactNode;
  sparklineData?: number[];
  className?: string;
}

/** Quiet KPI tile — thick top rule, muted label, big value, short subtext, trailing sparkline —
 *  for a single standout stat (52-week high/low, all-time high…) rather than a boxed card.
 *  Built on the `Highlight` primitive; unlike `StatCard` (delta tag + icon in a bordered `Panel`),
 *  this has no box or delta pill, just the rule and the numbers themselves. */
export function HighlightStatCard({ label, value, subtext, sparklineData, className }: HighlightStatCardProps) {
  return (
    <Highlight title={label} className={["lq-highlight-stat-card", className].filter(Boolean).join(" ")}>
      <div className="lq-highlight-stat-card__value">{value}</div>
      {subtext && <div className="lq-highlight-stat-card__subtext">{subtext}</div>}
      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} width={220} height={36} area className="lq-highlight-stat-card__sparkline" />
      )}
    </Highlight>
  );
}
