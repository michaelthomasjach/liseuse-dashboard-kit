import type { Candle } from "./interfaces/Candle.interface";
import type { BarDepth, DepthSnapshot, TapePrint } from "./interfaces/MarketDepth.interface";

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
