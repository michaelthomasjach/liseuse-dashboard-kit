/** One resting price level of an order book: a price, and how much is sitting there.
 *
 *  Size in whatever unit the instrument trades in — shares, contracts, lots. This library never
 *  converts it and never compares it across symbols; it is a magnitude to be coloured, and the
 *  scale is always relative to the same book. */
export interface DepthLevel {
  price: number;
  size: number;
}

/** The book at one moment, both sides.
 *
 *  Levels need not be sorted, complete, or evenly spaced — a venue that publishes ten levels a side
 *  and one that publishes the whole book both fit, and the heatmap simply has more or less to
 *  colour. What they must be is *resting* size: what is displayed and waiting, not what traded.
 *  The difference between those two numbers at the same price is the entire basis of iceberg
 *  detection, and a feed that conflates them makes that detection meaningless rather than wrong. */
export interface DepthSnapshot {
  /** Epoch milliseconds. Snapshots are bound to whichever bar contains them — see
   *  `bindDepthToBars` — so the heatmap's own time resolution is the chart's bar resolution, not
   *  the feed's. A feed publishing ten snapshots inside one bar contributes ten observations to
   *  that bar's own column, not ten columns. */
  time: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

/** One execution off the tape: where it printed, how big, and which side crossed the spread to
 *  make it happen.
 *
 *  `aggressor` is the half a raw print does not carry and a feed has to tell us: a trade at the ask
 *  was bought, a trade at the bid was sold, and everything downstream that colours a bubble or
 *  computes a delta reads this rather than guessing from the price. A feed that cannot say leaves
 *  it undefined, and this library then draws the print without a side rather than inventing one. */
export interface TapePrint {
  time: number;
  price: number;
  size: number;
  aggressor?: "buy" | "sell";
}

/** Everything a bar knows about its own book and tape, precomputed once per run.
 *
 *  Bound to bars on the main thread rather than searched inside the script, because a script asking
 *  "what was resting at this price on this bar" runs that question once per level per bar — and a
 *  linear scan through an unindexed feed would turn a heatmap into a minute of work. */
export interface BarDepth {
  /** Every snapshot that fell inside this bar, in order. Usually one; more when the feed is
   *  faster than the chart. */
  snapshots: DepthSnapshot[];
  prints: TapePrint[];
}
