/** A marker shown at the bottom of the price plot (earnings, dividends, product updates…) — see
 *  `CandlestickChartProps.events`. `kind` is a free-form app-defined string (not a fixed enum, so
 *  a caller can introduce new event categories without a library change) grouping related events
 *  for the per-kind show/hide toggle in the chart-settings modal; its first letter (uppercased)
 *  is what actually renders on the badge unless `symbol` overrides it. */
export interface ChartEvent {
  date: Date;
  kind: string;
  /** Shown in the badge's tooltip, alongside the date. */
  label: string;
  /** Further lines under the label — a short news-style summary (figures, verdict, reaction…),
   *  listed in the event card and appended to the badge's hover tooltip. */
  details?: string[];
  /** 1-2 characters drawn inside the badge instead of `kind`'s own first letter. */
  symbol?: string;
  color?: string;
}
