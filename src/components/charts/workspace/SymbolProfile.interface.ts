/** One "1S"/"1M"/"3M"/"6M"/"YTD"/"1A"-style tile in a `SymbolProfile`'s own `performance` grid —
 *  `label` is a plain string (not a fixed enum) so a caller can use whatever set of horizons makes
 *  sense for their own data, in whatever language, rather than being locked into six specific
 *  ones. */
export interface SymbolProfilePerformancePoint {
  label: string;
  changePercent: number;
}

/** Everything about a symbol this library has no way to know on its own — its full name, exchange/
 *  instrument type, whether that market is currently open, a set of trailing-return tiles, and a
 *  seasonality path — shown in the workspace's own side-panel "company info" section (see
 *  `SymbolProfilePanel`) underneath the watchlist. Same flat-array-keyed-by-ticker shape
 *  `WatchlistEarningsRow`/`WatchlistDividendRow`/`WatchlistNewsItem` already use for per-symbol
 *  host data: this library has no symbol database of its own (same stance `symbolSearchResults`/
 *  `watchlistNews` etc. already take), so it's entirely up to the caller to keep this in sync with
 *  whichever symbol is actually showing. The symbol's current price/change *isn't* part of this —
 *  that's derived directly from the focused panel's own OHLCV data instead, the same single
 *  source of truth the chart itself reads, so the two can never disagree with each other. */
export interface SymbolProfile {
  ticker: string;
  name?: string;
  exchange?: string;
  instrumentType?: string;
  /** e.g. "Marché fermé" / "Marché ouvert" — this library has no notion of exchange trading hours
   *  of its own, so this is read and shown completely as-is, whatever string the caller passes. */
  marketStatus?: string;
  /** A short company description — shown clamped to 3 lines (`text-overflow: ellipsis` via
   *  `-webkit-line-clamp`, not truncated by character count), so a caller can pass its full
   *  description as-is without pre-trimming it. */
  description?: string;
  /** Business sectors/industries this company operates in (e.g. ["Technologie", "Matériel
   *  informatique", "Électronique grand public"]) — shown as a row of small tags right under the
   *  description. Plain strings, in whatever taxonomy/language the caller's own data uses. */
  sectors?: string[];
  performance?: SymbolProfilePerformancePoint[];
  /** A pre-computed seasonality path (cumulative % return through a reference year, or whatever
   *  else the caller wants to show) — plotted as-is via a plain trend line, same "the caller
   *  already did the real computation, this library only ever renders the result" stance
   *  `CandlestickChart`'s own built-in seasonality mode takes for its *own* internal one (see
   *  `computeSeasonality`) — this is a *different*, caller-supplied one, not reused from that. */
  seasonality?: { date: Date; value: number }[];
}
