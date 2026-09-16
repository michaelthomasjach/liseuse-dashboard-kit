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

/** The whole feed, flattened into typed arrays, one slice per bar.
 *
 *  This shape exists for one reason and it is worth stating plainly: a session's book is a few
 *  hundred thousand small objects, and every script run posts it into a Worker. Structured-cloning
 *  an object graph that size costs per *object* — measured on the demo feed, 160 ms on the main
 *  thread, where it blocks everything, and a comparable share of the Worker's own time
 *  deserialising it. The same numbers in typed arrays are a handful of memcpys.
 *
 *  It also front-loads the work the Worker used to repeat. `displayed` and `executed` are the two
 *  indexes a script actually asks questions of, built once here rather than rebuilt per bar inside
 *  the run — so the engine goes from "index this bar, then answer" to "answer".
 *
 *  Deliberately *not* transferred on postMessage: the same pack is reused across runs and across
 *  every script on the chart, and transferring would detach it after the first one. Copied, which
 *  for typed arrays is a memcpy rather than a graph walk. */
export interface PackedDepth {
  bars: number;
  /** Levels of each bar's last snapshot — the book as it stood when the bar closed. `levelStart[i]`
   *  to `levelStart[i + 1]` is bar i's slice; the first `levelBids[i]` of it are bids, best first,
   *  and the rest are asks, best first. */
  levelStart: Int32Array;
  levelBids: Int32Array;
  levelPrice: Float64Array;
  levelSize: Float64Array;
  /** Largest size ever *displayed* at each price during the bar, across every snapshot in it,
   *  sorted by price. The maximum and not the last: a level that was eaten and not yet refilled
   *  displayed something, and reading the last snapshot would say it displayed nothing. */
  shownStart: Int32Array;
  shownPrice: Float64Array;
  shownSize: Float64Array;
  /** Size *executed* at each price during the bar, sorted by price. */
  doneStart: Int32Array;
  donePrice: Float64Array;
  doneSize: Float64Array;
  /** The prints themselves, in order. `printSide` is 0 unknown, 1 buy, 2 sell. */
  printStart: Int32Array;
  printPrice: Float64Array;
  printSize: Float64Array;
  printSide: Uint8Array;
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
