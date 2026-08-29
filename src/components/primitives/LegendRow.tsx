import type { ReactNode } from "react";
import "./LegendRow.css";

export interface LegendRowProps {
  /** Swatch color identifying this row's category/series — any valid CSS color, same convention
   *  chart legends already use (see e.g. ChartLegend). */
  color: string;
  /** Rendered bold, e.g. "Semiconductors". */
  label: ReactNode;
  /** Rendered bold at the trailing edge, e.g. "62.7%". */
  value: ReactNode;
  className?: string;
}

/** A single labelled row — color swatch, bold label, bold trailing value, thin divider below —
 *  for a breakdown/allocation list (sector weights, top holdings, category shares…). Rows are
 *  meant to sit directly one after another (their own divider disappears on the last child), same
 *  convention `PanelRow` already uses. */
export function LegendRow({ color, label, value, className }: LegendRowProps) {
  return (
    <div className={["lq-legend-row", className].filter(Boolean).join(" ")}>
      <span className="lq-legend-row__swatch" style={{ backgroundColor: color }} />
      <span className="lq-legend-row__label">{label}</span>
      <span className="lq-legend-row__value">{value}</span>
    </div>
  );
}
