import { ArrowDownIcon, ArrowUpIcon } from "../icons";
import "./PriceChangeTag.css";

export interface PriceChangeTagProps {
  /** Signed value, e.g. 2.4 or -1.1. */
  value: number;
  /** Locale of the default format — two decimals and " %", "2,40 %" in `fr-FR` (default),
   *  "2.40 %" in `en-US`. The kit's other finance cards (`HoldingCard`, `ComparisonCard`) take the
   *  same prop with the same default. */
  locale?: string;
  /** Formats the *absolute* value; the sign (a true minus, U+2212) and the arrow are added around
   *  it. Overrides `locale`. */
  format?: (absValue: number) => string;
  showIcon?: boolean;
  className?: string;
}

/** Signed delta with an up/down arrow — price change, P&L, allocation drift. */
export function PriceChangeTag({ value, locale = "fr-FR", format, showIcon = true, className }: PriceChangeTagProps) {
  const up = value >= 0;
  const fmt = format ?? ((v: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} %`);
  return (
    <span className={["lq-price-change", up ? "lq-price-change--up" : "lq-price-change--down", className].filter(Boolean).join(" ")}>
      {showIcon && (up ? <ArrowUpIcon size={14} /> : <ArrowDownIcon size={14} />)}
      {up ? "+" : "−"}
      {fmt(Math.abs(value))}
    </span>
  );
}
