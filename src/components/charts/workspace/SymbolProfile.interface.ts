/** One "1S"/"1M"/"3M"/"6M"/"YTD"/"1A"-style tile in a `SymbolProfile`'s own `performance` grid —
 *  `label` is a plain string (not a fixed enum) so a caller can use whatever set of horizons makes
 *  sense for their own data, in whatever language, rather than being locked into six specific
 *  ones. */
export interface SymbolProfilePerformancePoint {
  label: string;
  changePercent: number;
}

/** One headline in a `SymbolProfile`'s own `news` list — same shape/spirit as the watchlist's own
 *  `WatchlistNewsItem` (`WatchlistExposureModal.tsx`), kept as a separate, deliberately smaller
 *  interface here rather than reused directly: this panel only ever shows the single most recent
 *  headline for the one currently-focused symbol, not a filterable multi-symbol table, so it has
 *  no need for that one's `ticker`/`logoUrl`/`logoColor`/`isFinancialReport` fields. */
export interface SymbolProfileNewsItem {
  id: string;
  /** Pre-formatted by the caller, e.g. "2 jours" — same "this library has no notion of relative
   *  time of its own" stance every other timestamp-ish field here already takes. */
  time: string;
  headline: string;
  provider?: string;
  /** Opens in a new tab when the headline is clicked, if set — no in-app navigation of any kind
   *  (this library doesn't know what "opening an article" means in the host app). */
  url?: string;
}

/** The "Key stats" list — every value already formatted by the caller (a market cap of "44.01B",
 *  a volume of "3.71M") except `nextEarningsInDays`, the one plain number here: it drives two
 *  different renderings at once (the "Dans N jours" key-stats row, and the bare "N" badge on the
 *  earnings chart above it), so formatting it once at the source would force picking one of the
 *  two forms and re-deriving the other. */
export interface SymbolProfileKeyStats {
  nextEarningsInDays?: number;
  volume?: string;
  averageVolume?: string;
  marketCap?: string;
}

/** One reported (or upcoming, `actualEps` unset) quarter in a `SymbolProfile`'s own `earnings`
 *  chart — `date` is a pre-formatted x-axis label (a quarter end date, in whatever format the
 *  caller's own data uses), not a real `Date`, matching `seasonality`'s neighboring convention of
 *  leaving formatting entirely up to the caller wherever this panel doesn't itself compute a
 *  derived value from it. */
export interface SymbolProfileEarningsPoint {
  date: string;
  estimateEps?: number;
  actualEps?: number;
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
  /** A handful of at-a-glance numbers — next earnings countdown, volume, average volume,
   *  market cap. Shown as a plain label/value list, same spirit as `performance`'s tiles but for
   *  values that don't have a meaningful "up/down" color of their own. */
  keyStats?: SymbolProfileKeyStats;
  /** Most recent headline(s) for this symbol — only the first is ever shown (see
   *  `SymbolProfileNewsItem`'s own doc); further items only change whether a "more" link renders
   *  (see `SymbolProfilePanelProps.onMoreNews`), not how many headlines this panel itself lists. */
  news?: SymbolProfileNewsItem[];
  /** Recent (and, with `actualEps` left unset, upcoming) quarterly EPS — estimate vs. actual,
   *  shown as a small dot chart. */
  earnings?: SymbolProfileEarningsPoint[];
}
