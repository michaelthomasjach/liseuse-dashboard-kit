import type { KeyboardEvent } from "react";
import { Avatar } from "./Avatar";
import { PriceChangeTag } from "./PriceChangeTag";
import { Sparkline } from "../charts/Sparkline";
import "./HoldingCard.css";

export interface HoldingCardProps {
  symbol: string;
  name: string;
  quantity?: number;
  price: number;
  /** Signed percent change. */
  change: number;
  /** Locale of the default formats (price, change, quantity). Default `"fr-FR"`. */
  locale?: string;
  /** Default: two decimals in `locale` and " €" — "1 234,50 €". */
  formatPrice?: (value: number) => string;
  /** Formats the *absolute* change (the sign and arrow are added around it). Default: two decimals
   *  in `locale` and " %" — "2,40 %". */
  formatChange?: (absValue: number) => string;
  /** Default: "12 parts" / "1 part", the number in `locale`. Pass your own for "actions", "lots"… */
  formatQuantity?: (quantity: number) => string;
  sparklineData?: number[];
  /** Makes the card a button: click, Enter or Space. */
  onClick?: () => void;
  className?: string;
}

/** Compact row card for a single position — watchlists, holdings lists. Stacked in a column, the
 *  figures and the quantity keep a common minimum width (`--lq-holding-figures-width`,
 *  `--lq-holding-quantity-width`) so they line up from one card to the next. */
export function HoldingCard({
  symbol,
  name,
  quantity,
  price,
  change,
  locale = "fr-FR",
  formatPrice,
  formatChange,
  formatQuantity,
  sparklineData,
  onClick,
  className,
}: HoldingCardProps) {
  const twoDecimals = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = formatPrice ?? ((v: number) => `${twoDecimals.format(v)} €`);
  const fmtChange = formatChange ?? ((v: number) => `${twoDecimals.format(v)} %`);
  const fmtQuantity = formatQuantity ?? ((q: number) => `${new Intl.NumberFormat(locale).format(q)} ${Math.abs(q) > 1 ? "parts" : "part"}`);
  const interactive = Boolean(onClick);

  // role="button" promises the keyboard of a button: Enter and Space, not only the click it had.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={["lq-holding-card", interactive && "lq-holding-card--interactive", className].filter(Boolean).join(" ")}
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <Avatar name={symbol} size={36} />
      <div className="lq-holding-card__identity">
        <span className="lq-holding-card__symbol">{symbol}</span>
        <span className="lq-holding-card__name">{name}</span>
      </div>

      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} width={64} height={28} colorByTrend className="lq-holding-card__sparkline" />
      )}

      <div className="lq-holding-card__figures">
        <span className="lq-holding-card__price">{fmt(price)}</span>
        <PriceChangeTag value={change} format={fmtChange} />
      </div>

      {quantity !== undefined && <span className="lq-holding-card__quantity">{fmtQuantity(quantity)}</span>}
    </div>
  );
}
