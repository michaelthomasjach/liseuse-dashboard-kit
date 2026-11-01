import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";
import { PriceChangeTag } from "./PriceChangeTag";
import "./ComparisonCard.css";

export interface ComparisonCardFigure {
  label: string;
  value: ReactNode;
  /** Signed percent change, shown as a `PriceChangeTag`. */
  delta?: number;
}

export interface ComparisonCardProps {
  title?: ReactNode;
  meta?: ReactNode;
  primary: ComparisonCardFigure;
  secondary: ComparisonCardFigure;
  /** Locale of the default delta format. Default `"fr-FR"`: "2,40 %" (it was "2.40 %"). */
  locale?: string;
  /** Formats the *absolute* delta (sign and arrow are added around it). Overrides `locale`. */
  formatDelta?: (absValue: number) => string;
  className?: string;
}

/** Two figures side by side with a divider — a portfolio vs. its benchmark, this period vs. last. */
export function ComparisonCard({ title, meta, primary, secondary, locale = "fr-FR", formatDelta, className }: ComparisonCardProps) {
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDelta = formatDelta ?? ((v: number) => `${percent.format(v)} %`);
  return (
    <Panel title={title} meta={meta} className={className}>
      <div className="lq-comparison-card">
        {[primary, secondary].map((figure, i) => (
          <div key={i} className="lq-comparison-card__figure">
            <span className="lq-comparison-card__label">{figure.label}</span>
            <span className="lq-comparison-card__value">{figure.value}</span>
            {figure.delta !== undefined && <PriceChangeTag value={figure.delta} format={fmtDelta} />}
          </div>
        ))}
      </div>
    </Panel>
  );
}
