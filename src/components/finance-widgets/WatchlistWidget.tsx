import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";
import { HoldingCard, type HoldingCardProps } from "../finance/HoldingCard";
import "./WatchlistWidget.css";

export interface WatchlistItem extends Omit<HoldingCardProps, "onClick"> {
  id: string;
}

export interface WatchlistWidgetProps {
  /** Default « Liste de surveillance » (it was the English "Watchlist"). */
  title?: ReactNode;
  items: WatchlistItem[];
  onSelect?: (id: string) => void;
  emptyMessage?: string;
  className?: string;
}

/** Ready-to-drop watchlist: a titled card stacking `HoldingCard` rows. */
export function WatchlistWidget({ title = "Liste de surveillance", items, onSelect, emptyMessage = "Aucun actif suivi", className }: WatchlistWidgetProps) {
  return (
    <Panel title={title} meta={`${items.length} actif${items.length > 1 ? "s" : ""}`} className={className}>
      {items.length === 0 ? (
        <p className="lq-watchlist__empty">{emptyMessage}</p>
      ) : (
        <div className="lq-watchlist__list">
          {items.map(({ id, ...item }) => (
            <HoldingCard key={id} {...item} onClick={onSelect ? () => onSelect(id) : undefined} />
          ))}
        </div>
      )}
    </Panel>
  );
}
