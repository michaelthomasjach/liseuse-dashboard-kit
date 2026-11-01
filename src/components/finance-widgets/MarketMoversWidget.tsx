import { useState, type ReactNode } from "react";
import { Panel, PanelRow } from "../primitives/Panel";
import { Tabs } from "../primitives/Tabs";
import { PriceChangeTag } from "../finance/PriceChangeTag";
import "./MarketMoversWidget.css";

export interface MarketMoverItem {
  id: string;
  symbol: string;
  name: string;
  /** Signed percent change. */
  change: number;
}

/** The widget's own words — each one optional, the French default kept for whatever is left out. */
export interface MarketMoversLabels {
  /** Default « Hausses ». */
  gainers?: string;
  /** Default « Baisses ». */
  losers?: string;
  /** Shown when the active list is empty. Default « Aucune donnée ». */
  empty?: string;
}

export interface MarketMoversWidgetProps {
  title?: ReactNode;
  gainers: MarketMoverItem[];
  losers: MarketMoverItem[];
  /** Replaces the tab names and the empty message. */
  labels?: MarketMoversLabels;
  /** Makes each row a button (click, Enter, Space) — open the symbol, load it in a chart. `list`
   *  says which tab it was picked from. */
  onSelect?: (item: MarketMoverItem, list: "gainers" | "losers") => void;
  /** Locale of the default change format. Default `"fr-FR"`: "2,40 %". */
  locale?: string;
  /** Formats the *absolute* change (sign and arrow are added around it). Overrides `locale`. */
  formatChange?: (absValue: number) => string;
  className?: string;
}

/** Ready-to-drop "top movers" card: tabbed gainers/losers lists. */
export function MarketMoversWidget({
  title = "Marché",
  gainers,
  losers,
  labels,
  onSelect,
  locale = "fr-FR",
  formatChange,
  className,
}: MarketMoversWidgetProps) {
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const items = tab === "gainers" ? gainers : losers;
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtChange = formatChange ?? ((v: number) => `${percent.format(v)} %`);

  return (
    <Panel title={title} className={className}>
      <Tabs
        className="lq-market-movers__tabs"
        value={tab}
        onChange={(id) => setTab(id as "gainers" | "losers")}
        items={[
          { id: "gainers", label: labels?.gainers ?? "Hausses" },
          { id: "losers", label: labels?.losers ?? "Baisses" },
        ]}
      />
      {items.length === 0 ? (
        <p className="lq-market-movers__empty">{labels?.empty ?? "Aucune donnée"}</p>
      ) : (
        items.map((item) => (
          <PanelRow
            key={item.id}
            label={`${item.symbol} · ${item.name}`}
            value={<PriceChangeTag value={item.change} format={fmtChange} />}
            onClick={onSelect ? () => onSelect(item, tab) : undefined}
          />
        ))
      )}
    </Panel>
  );
}
