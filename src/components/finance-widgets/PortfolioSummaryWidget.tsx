import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";
import { PriceChangeTag } from "../finance/PriceChangeTag";
import { LineAreaChart, type ChartPoint } from "../charts/LineAreaChart";
import "./PortfolioSummaryWidget.css";

export interface PortfolioSummaryWidgetProps {
  title?: ReactNode;
  meta?: ReactNode;
  value: ReactNode;
  /** Signed percent change, shown as a `PriceChangeTag` next to `value`. */
  delta?: number;
  /** History used to draw the area chart below the headline figure. */
  series: ChartPoint[];
  /** Value-axis and hover figures. Default: whole numbers in `locale` ("12 500"). */
  formatY?: (value: number) => string;
  /** Date (or index) labels. Default: dates in `locale` ("01 juin 2026", "juin" on the axis). */
  formatX?: (value: Date | number) => string;
  xType?: "time" | "linear";
  /** Locale of every default format here — figures, dates, delta. Default `"fr-FR"`. */
  locale?: string;
  /** Formats the *absolute* delta (sign and arrow are added around it). Overrides `locale`. */
  formatDelta?: (absValue: number) => string;
  className?: string;
}

/** Ready-to-drop portfolio overview: a big value + delta over a zoomable history chart. */
export function PortfolioSummaryWidget({
  title = "Valeur du portefeuille",
  meta,
  value,
  delta,
  series,
  formatY,
  formatX,
  xType = "time",
  locale = "fr-FR",
  formatDelta,
  className,
}: PortfolioSummaryWidgetProps) {
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDelta = formatDelta ?? ((v: number) => `${percent.format(v)} %`);
  // d3's default axis figures are English ("12,500"): French by default, like the rest.
  const figures = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const fmtY = formatY ?? ((v: number) => figures.format(v));
  return (
    <Panel title={title} meta={meta} className={className}>
      <div className="lq-portfolio-summary__headline">
        <span className="lq-portfolio-summary__value">{value}</span>
        {delta !== undefined && <PriceChangeTag value={delta} format={fmtDelta} />}
      </div>
      <LineAreaChart
        series={[{ id: "value", data: series }]}
        area
        xType={xType}
        formatY={fmtY}
        formatX={formatX}
        locale={locale}
        showLegend={false}
        height={160}
        margin={{ top: 8, right: 8, bottom: 24, left: 48 }}
      />
    </Panel>
  );
}
