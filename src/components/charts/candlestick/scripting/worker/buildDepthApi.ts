import type { BarDepth, DepthLevel, TapePrint } from "../../interfaces/MarketDepth.interface";

/** `book.*` — the resting order book on the bar being evaluated.
 *
 *  Everything here answers about *this* bar, like `market.close()` does, because a script is a loop
 *  over bars and a question about "the book" without a bar is not a question this engine can
 *  answer. A bar with several snapshots in it is reduced to one answer per method, and each method
 *  says which reduction it uses — "the last one" and "the deepest one" are different questions and
 *  conflating them is how a heatmap ends up showing an average nobody ever saw. */
export interface BookApi {
  /** False when the host supplied no depth at all. Every other method then returns an empty
   *  answer, so a script can run unchanged against a chart with no book and simply draw nothing —
   *  which is better than failing, and much better than drawing zeros. */
  available(): boolean;
  /** Resting bids on this bar, from the *last* snapshot inside it — the book as it stood when the
   *  bar closed. Sorted best-first (highest price). */
  bids(): DepthLevel[];
  /** Resting asks, same rule. Sorted best-first (lowest price). */
  asks(): DepthLevel[];
  /** Best bid and ask of the last snapshot, and the spread between them. Any of the three is
   *  `null` when that side of the book is empty. */
  best(): { bid: number | null; ask: number | null; spread: number | null };
  /** The largest size seen resting at `price` during this bar, across every snapshot in it.
   *
   *  The maximum rather than the last, because this is the number iceberg detection divides by:
   *  what matters is the most that was ever *displayed* there, and taking the last snapshot would
   *  read a level that was eaten and not yet refilled as having displayed nothing. `tolerance`
   *  widens the match to a band around `price`, for a feed whose ticks do not line up with the
   *  script's own grid; 0 (the default) matches the exact price. */
  sizeAt(price: number, tolerance?: number): number;
  /** Every level of both sides of the last snapshot, bids and asks together, as one list. What a
   *  heatmap column is drawn from. */
  levels(): DepthLevel[];
  /** Total resting size within `depth` price units of the best bid / best ask — the two numbers an
   *  imbalance is computed from. */
  pressure(depth: number): { bid: number; ask: number };
}

/** `tape.*` — the executions that printed on the bar being evaluated. */
export interface TapeApi {
  /** False when the host supplied no time and sales. */
  available(): boolean;
  prints(): TapePrint[];
  /** Executed size at `price` on this bar, within `tolerance`. The numerator of iceberg
   *  detection: volume that traded at a level, against what that level ever showed. */
  volumeAt(price: number, tolerance?: number): number;
  /** Buy-initiated minus sell-initiated size on this bar. Prints whose aggressor the feed did not
   *  name count toward neither — a delta that guessed would be a delta nobody could check. */
  delta(): number;
  /** Total executed size on this bar, aggressor named or not. */
  volume(): number;
}

const EMPTY_LEVELS: DepthLevel[] = [];

function lastSnapshot(bar: BarDepth | undefined) {
  return bar === undefined || bar.snapshots.length === 0 ? null : bar.snapshots[bar.snapshots.length - 1];
}

export function buildDepthApi(bars: BarDepth[] | undefined, getCurrentIndex: () => number): { book: BookApi; tape: TapeApi } {
  const barAt = () => (bars === undefined ? undefined : bars[getCurrentIndex()]);
  const hasDepth = bars !== undefined && bars.some((bar) => bar.snapshots.length > 0);
  const hasTape = bars !== undefined && bars.some((bar) => bar.prints.length > 0);

  const book: BookApi = {
    available: () => hasDepth,
    bids: () => {
      const snapshot = lastSnapshot(barAt());
      return snapshot === null ? EMPTY_LEVELS : [...snapshot.bids].sort((a, b) => b.price - a.price);
    },
    asks: () => {
      const snapshot = lastSnapshot(barAt());
      return snapshot === null ? EMPTY_LEVELS : [...snapshot.asks].sort((a, b) => a.price - b.price);
    },
    best: () => {
      const snapshot = lastSnapshot(barAt());
      if (snapshot === null) return { bid: null, ask: null, spread: null };
      let bid: number | null = null;
      let ask: number | null = null;
      for (const level of snapshot.bids) if (level.size > 0 && (bid === null || level.price > bid)) bid = level.price;
      for (const level of snapshot.asks) if (level.size > 0 && (ask === null || level.price < ask)) ask = level.price;
      return { bid, ask, spread: bid !== null && ask !== null ? ask - bid : null };
    },
    sizeAt: (price, tolerance = 0) => {
      const bar = barAt();
      if (bar === undefined) return 0;
      let peak = 0;
      for (const snapshot of bar.snapshots) {
        for (const level of snapshot.bids) if (Math.abs(level.price - price) <= tolerance && level.size > peak) peak = level.size;
        for (const level of snapshot.asks) if (Math.abs(level.price - price) <= tolerance && level.size > peak) peak = level.size;
      }
      return peak;
    },
    levels: () => {
      const snapshot = lastSnapshot(barAt());
      return snapshot === null ? EMPTY_LEVELS : [...snapshot.bids, ...snapshot.asks];
    },
    pressure: (depth) => {
      const snapshot = lastSnapshot(barAt());
      if (snapshot === null) return { bid: 0, ask: 0 };
      const best = book.best();
      let bid = 0;
      let ask = 0;
      if (best.bid !== null) for (const level of snapshot.bids) if (best.bid - level.price <= depth) bid += level.size;
      if (best.ask !== null) for (const level of snapshot.asks) if (level.price - best.ask <= depth) ask += level.size;
      return { bid, ask };
    },
  };

  const tape: TapeApi = {
    available: () => hasTape,
    prints: () => barAt()?.prints ?? [],
    volumeAt: (price, tolerance = 0) => {
      const bar = barAt();
      if (bar === undefined) return 0;
      let total = 0;
      for (const print of bar.prints) if (Math.abs(print.price - price) <= tolerance) total += print.size;
      return total;
    },
    delta: () => {
      const bar = barAt();
      if (bar === undefined) return 0;
      let delta = 0;
      for (const print of bar.prints) {
        if (print.aggressor === "buy") delta += print.size;
        else if (print.aggressor === "sell") delta -= print.size;
      }
      return delta;
    },
    volume: () => {
      const bar = barAt();
      if (bar === undefined) return 0;
      let total = 0;
      for (const print of bar.prints) total += print.size;
      return total;
    },
  };

  return { book, tape };
}
