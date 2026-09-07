import type { StrategyTrade } from "../interfaces/StrategyResult.interface";

/** The trade a moment on the price chart belongs to, or `null`.
 *
 *  A fill marker sits on either the entry or the exit, so both are matched — and the *nearest* of
 *  the two wins rather than the first found, so a strategy that exits one trade and enters the next
 *  on the same bar still resolves to whichever fill the pointer is actually nearest.
 *
 *  Exact-match only would be fragile: the marker's own timestamp comes from the bar it filled on,
 *  and the equity series is sampled per bar, so a tolerance of half a bar is what makes "the same
 *  column on screen" and "the same trade" agree. Callers pass that tolerance since only they know
 *  the current bar spacing. */
export function tradeAtTime(trades: StrategyTrade[], time: number | null, toleranceMs: number): StrategyTrade | null {
  if (time === null) return null;
  let best: StrategyTrade | null = null;
  let bestDistance = Infinity;
  for (const t of trades) {
    for (const at of [t.entryTime, t.exitTime]) {
      const d = Math.abs(at - time);
      if (d <= toleranceMs && d < bestDistance) {
        bestDistance = d;
        best = t;
      }
    }
  }
  return best;
}
