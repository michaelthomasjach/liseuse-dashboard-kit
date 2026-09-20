import type { DepthLevel, PackedDepth, TapePrint } from "../../interfaces/MarketDepth.interface";

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

/** First slot at or after `target` within `[from, to)` of a sorted slice. */
function lowerBound(values: Float64Array, from: number, to: number, target: number): number {
  let lo = from;
  let hi = to;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Max or sum over a price band of a sorted (price, value) slice.
 *
 *  Bisected rather than scanned, which is what keeps a liquidity map linear: a script asks this
 *  once per level, and scanning the slice per question made the answer cost the whole book —
 *  fourteen thousand comparisons per bar to answer a hundred and twenty questions. An exact-price
 *  question, the common one, is a single bisection and a compare. */
function overBand(
  prices: Float64Array,
  sizes: Float64Array,
  from: number,
  to: number,
  price: number,
  tolerance: number,
  combine: "max" | "sum"
): number {
  const lo = lowerBound(prices, from, to, price - tolerance);
  let total = 0;
  for (let i = lo; i < to && prices[i] <= price + tolerance; i++) {
    total = combine === "max" ? Math.max(total, sizes[i]) : total + sizes[i];
  }
  return total;
}

export function buildDepthApi(packed: PackedDepth | undefined, getCurrentIndex: () => number): { book: BookApi; tape: TapeApi } {
  const hasDepth = packed !== undefined && packed.levelStart[packed.bars] > 0;
  const hasTape = packed !== undefined && packed.printStart[packed.bars] > 0;

  /** The bar being read, or -1 when there is no feed or the index is off the end. */
  function bar(): number {
    if (packed === undefined) return -1;
    const at = getCurrentIndex();
    return at >= 0 && at < packed.bars ? at : -1;
  }

  // The object form of a bar's levels, built once per bar rather than per call: a script reads
  // `levels()` several times on the same bar, and each call used to allocate the whole book again.
  let shapedBar = -1;
  let shapedBids: DepthLevel[] = EMPTY_LEVELS;
  let shapedAsks: DepthLevel[] = EMPTY_LEVELS;
  let shapedAll: DepthLevel[] = EMPTY_LEVELS;

  function shape(): void {
    const at = bar();
    if (shapedBar === at) return;
    shapedBar = at;
    if (at === -1 || packed === undefined) {
      shapedBids = EMPTY_LEVELS;
      shapedAsks = EMPTY_LEVELS;
      shapedAll = EMPTY_LEVELS;
      return;
    }
    const from = packed.levelStart[at];
    const to = packed.levelStart[at + 1];
    const split = from + packed.levelBids[at];
    shapedBids = [];
    shapedAsks = [];
    for (let i = from; i < split; i++) shapedBids.push({ price: packed.levelPrice[i], size: packed.levelSize[i] });
    for (let i = split; i < to; i++) shapedAsks.push({ price: packed.levelPrice[i], size: packed.levelSize[i] });
    shapedAll = [...shapedBids, ...shapedAsks];
  }

  const book: BookApi = {
    available: () => hasDepth,
    bids: () => {
      shape();
      return shapedBids;
    },
    asks: () => {
      shape();
      return shapedAsks;
    },
    levels: () => {
      shape();
      return shapedAll;
    },
    best: () => {
      const at = bar();
      if (at === -1 || packed === undefined) return { bid: null, ask: null, spread: null };
      const from = packed.levelStart[at];
      const to = packed.levelStart[at + 1];
      const split = from + packed.levelBids[at];
      // The slices are already best-first on each side, so the best is the first entry with size —
      // no scan, no sort, no allocation.
      let bid: number | null = null;
      for (let i = from; i < split; i++)
        if (packed.levelSize[i] > 0) {
          bid = packed.levelPrice[i];
          break;
        }
      let ask: number | null = null;
      for (let i = split; i < to; i++)
        if (packed.levelSize[i] > 0) {
          ask = packed.levelPrice[i];
          break;
        }
      return { bid, ask, spread: bid !== null && ask !== null ? ask - bid : null };
    },
    sizeAt: (price, tolerance = 0) => {
      const at = bar();
      if (at === -1 || packed === undefined) return 0;
      return overBand(packed.shownPrice, packed.shownSize, packed.shownStart[at], packed.shownStart[at + 1], price, tolerance, "max");
    },
    pressure: (depth) => {
      const at = bar();
      if (at === -1 || packed === undefined) return { bid: 0, ask: 0 };
      const best = book.best();
      const from = packed.levelStart[at];
      const to = packed.levelStart[at + 1];
      const split = from + packed.levelBids[at];
      let bid = 0;
      let ask = 0;
      if (best.bid !== null) for (let i = from; i < split; i++) if (best.bid - packed.levelPrice[i] <= depth) bid += packed.levelSize[i];
      if (best.ask !== null) for (let i = split; i < to; i++) if (packed.levelPrice[i] - best.ask <= depth) ask += packed.levelSize[i];
      return { bid, ask };
    },
  };

  let printsBar = -1;
  let printsShaped: TapePrint[] = [];

  const tape: TapeApi = {
    available: () => hasTape,
    prints: () => {
      const at = bar();
      if (at === -1 || packed === undefined) return [];
      if (printsBar === at) return printsShaped;
      printsBar = at;
      printsShaped = [];
      for (let i = packed.printStart[at]; i < packed.printStart[at + 1]; i++) {
        const side = packed.printSide[i];
        printsShaped.push({
          // No time on a packed print: nothing in the API reads it, and a Float64 per print for a
          // field nobody asks for is a megabyte of nothing on a busy session.
          time: 0,
          price: packed.printPrice[i],
          size: packed.printSize[i],
          aggressor: side === 1 ? "buy" : side === 2 ? "sell" : undefined,
        });
      }
      return printsShaped;
    },
    volumeAt: (price, tolerance = 0) => {
      const at = bar();
      if (at === -1 || packed === undefined) return 0;
      return overBand(packed.donePrice, packed.doneSize, packed.doneStart[at], packed.doneStart[at + 1], price, tolerance, "sum");
    },
    delta: () => {
      const at = bar();
      if (at === -1 || packed === undefined) return 0;
      let delta = 0;
      for (let i = packed.printStart[at]; i < packed.printStart[at + 1]; i++) {
        if (packed.printSide[i] === 1) delta += packed.printSize[i];
        else if (packed.printSide[i] === 2) delta -= packed.printSize[i];
      }
      return delta;
    },
    volume: () => {
      const at = bar();
      if (at === -1 || packed === undefined) return 0;
      let total = 0;
      for (let i = packed.printStart[at]; i < packed.printStart[at + 1]; i++) total += packed.printSize[i];
      return total;
    },
  };

  return { book, tape };
}
