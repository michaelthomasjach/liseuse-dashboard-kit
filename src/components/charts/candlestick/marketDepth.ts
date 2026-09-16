import type { Candle } from "./interfaces/Candle.interface";
import type { BarDepth, DepthSnapshot, PackedDepth, TapePrint } from "./interfaces/MarketDepth.interface";

/** How many prints one bar keeps. A liquid instrument prints tens of thousands of times a minute,
 *  and every one of them would be copied into a Worker message and walked once per script bar. The
 *  cap is on *count*, and the newest are kept: what a bar's tape is read for — where volume landed
 *  and how aggressive it was — survives thinning, and the alternative (an unbounded array) turns
 *  one busy session into a message the structured clone alone cannot afford. */
const MAX_PRINTS_PER_BAR = 2000;

/** Bins a feed onto the chart's own bars, once.
 *
 *  Two sorted sequences walked together rather than a search per bar: the bars are in order and so
 *  are the feeds, so the whole binding is linear in (bars + snapshots + prints). A per-bar
 *  `filter()` over the feed would be quadratic, which on a session's worth of ticks is the
 *  difference between imperceptible and unusable — and this runs again every time the data
 *  changes.
 *
 *  A snapshot or print before the first bar or after the last is dropped: there is no column to put
 *  it in, and inventing one would put liquidity where the chart shows no time. */
export function bindDepthToBars(data: Candle[], snapshots: DepthSnapshot[] | undefined, prints: TapePrint[] | undefined): BarDepth[] {
  const bars: BarDepth[] = data.map(() => ({ snapshots: [], prints: [] }));
  if (data.length === 0) return bars;

  // Each bar owns [its own open, the next bar's open), and the last bar owns everything from its
  // open onward — which is what makes a still-forming last bar collect the ticks arriving now.
  const startOf = (i: number) => data[i].date.getTime();

  const bind = <T extends { time: number }>(feed: T[] | undefined, take: (bar: BarDepth, entry: T) => void) => {
    if (feed === undefined || feed.length === 0) return;
    // Sorted defensively rather than trusted: a host merging two sources hands over something
    // almost-sorted, and the merge below would silently drop everything after the first inversion.
    const ordered = isSortedByTime(feed) ? feed : [...feed].sort((a, b) => a.time - b.time);
    let bar = 0;
    for (const entry of ordered) {
      if (entry.time < startOf(0)) continue;
      while (bar + 1 < data.length && entry.time >= startOf(bar + 1)) bar++;
      take(bars[bar], entry);
    }
  };

  bind(snapshots, (bar, snapshot) => bar.snapshots.push(snapshot));
  bind(prints, (bar, print) => {
    // Keeps the newest: a ring would cost an index per bar for the same answer, and a bar that
    // overflows this is a bar whose individual prints stopped being readable long before.
    if (bar.prints.length === MAX_PRINTS_PER_BAR) bar.prints.shift();
    bar.prints.push(print);
  });
  return bars;
}

function isSortedByTime(feed: { time: number }[]): boolean {
  for (let i = 1; i < feed.length; i++) if (feed[i].time < feed[i - 1].time) return false;
  return true;
}

/** The deepest resting size anywhere in a bound feed — the denominator a heatmap's colour scale
 *  needs when the script does not name one.
 *
 *  Taken over the whole run rather than over what is on screen: a scale that rebased itself on
 *  every pan would make the same wall of liquidity change colour as the chart moved, which is
 *  exactly the comparison the picture exists to allow. */
export function peakRestingSize(bars: BarDepth[]): number {
  let peak = 0;
  for (const bar of bars) {
    for (const snapshot of bar.snapshots) {
      for (const level of snapshot.bids) if (level.size > peak) peak = level.size;
      for (const level of snapshot.asks) if (level.size > peak) peak = level.size;
    }
  }
  return peak;
}


/** Flattens a bound feed into the typed arrays a Worker can take cheaply — see `PackedDepth`.
 *
 *  Two passes: one to count, one to fill. Counting first is what lets every array be allocated
 *  exactly once at its final size, which on a few hundred thousand levels is the difference between
 *  a handful of allocations and a few hundred reallocating pushes.
 *
 *  The two indexes are built here rather than in the Worker because they are a property of the
 *  feed, not of a run: the same numbers were being recomputed for every script on the chart and
 *  again on every re-run, and they never change unless the feed does. */
export function packDepth(bars: BarDepth[]): PackedDepth {
  const count = bars.length;
  const levelStart = new Int32Array(count + 1);
  const levelBids = new Int32Array(count);
  const shownStart = new Int32Array(count + 1);
  const doneStart = new Int32Array(count + 1);
  const printStart = new Int32Array(count + 1);

  // Pass one: sizes. The two index maps are built now and kept, rather than built twice.
  const shownByBar: Map<number, number>[] = [];
  const doneByBar: Map<number, number>[] = [];
  for (let i = 0; i < count; i++) {
    const bar = bars[i];
    const last = bar.snapshots.length === 0 ? null : bar.snapshots[bar.snapshots.length - 1];
    levelStart[i + 1] = levelStart[i] + (last === null ? 0 : last.bids.length + last.asks.length);
    levelBids[i] = last === null ? 0 : last.bids.length;

    const shown = new Map<number, number>();
    for (const snapshot of bar.snapshots) {
      for (const level of snapshot.bids) {
        const seen = shown.get(level.price);
        if (seen === undefined || level.size > seen) shown.set(level.price, level.size);
      }
      for (const level of snapshot.asks) {
        const seen = shown.get(level.price);
        if (seen === undefined || level.size > seen) shown.set(level.price, level.size);
      }
    }
    const done = new Map<number, number>();
    for (const print of bar.prints) done.set(print.price, (done.get(print.price) ?? 0) + print.size);

    shownByBar.push(shown);
    doneByBar.push(done);
    shownStart[i + 1] = shownStart[i] + shown.size;
    doneStart[i + 1] = doneStart[i] + done.size;
    printStart[i + 1] = printStart[i] + bar.prints.length;
  }

  const packed: PackedDepth = {
    bars: count,
    levelStart,
    levelBids,
    levelPrice: new Float64Array(levelStart[count]),
    levelSize: new Float64Array(levelStart[count]),
    shownStart,
    shownPrice: new Float64Array(shownStart[count]),
    shownSize: new Float64Array(shownStart[count]),
    doneStart,
    donePrice: new Float64Array(doneStart[count]),
    doneSize: new Float64Array(doneStart[count]),
    printStart,
    printPrice: new Float64Array(printStart[count]),
    printSize: new Float64Array(printStart[count]),
    printSide: new Uint8Array(printStart[count]),
  };

  // Pass two: fill. Sorted here, once, so nothing downstream ever sorts: the level slice is best
  // first on each side because that is how a book is read, and the two index slices are by price
  // because that is what a tolerance search bisects.
  for (let i = 0; i < count; i++) {
    const bar = bars[i];
    const last = bar.snapshots.length === 0 ? null : bar.snapshots[bar.snapshots.length - 1];
    let at = levelStart[i];
    if (last !== null) {
      for (const level of [...last.bids].sort((a, b) => b.price - a.price)) {
        packed.levelPrice[at] = level.price;
        packed.levelSize[at] = level.size;
        at++;
      }
      for (const level of [...last.asks].sort((a, b) => a.price - b.price)) {
        packed.levelPrice[at] = level.price;
        packed.levelSize[at] = level.size;
        at++;
      }
    }

    let shownAt = shownStart[i];
    for (const price of [...shownByBar[i].keys()].sort((a, b) => a - b)) {
      packed.shownPrice[shownAt] = price;
      packed.shownSize[shownAt] = shownByBar[i].get(price) as number;
      shownAt++;
    }
    let doneAt = doneStart[i];
    for (const price of [...doneByBar[i].keys()].sort((a, b) => a - b)) {
      packed.donePrice[doneAt] = price;
      packed.doneSize[doneAt] = doneByBar[i].get(price) as number;
      doneAt++;
    }
    let printAt = printStart[i];
    for (const print of bar.prints) {
      packed.printPrice[printAt] = print.price;
      packed.printSize[printAt] = print.size;
      packed.printSide[printAt] = print.aggressor === "buy" ? 1 : print.aggressor === "sell" ? 2 : 0;
      printAt++;
    }
  }

  return packed;
}
