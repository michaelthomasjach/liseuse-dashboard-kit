/** Default `ScriptEngineSnapshot.limits.timeoutMs` for a full historical replay — generous
 *  because a script that legitimately calls a handful of `ta.*` functions once per bar, over a
 *  multi-thousand-candle window, can genuinely take real time; this is a "something is actually
 *  stuck" backstop, not a performance target. */
export const HISTORICAL_REPLAY_TIMEOUT_MS = 8000;
/** Default timeout for a single real-time tick (one more bar appended to an already-replayed
 *  script) — deliberately tight, since a slow single-bar re-evaluation is almost certainly stuck,
 *  not legitimately expensive the way a full replay can be. */
export const REALTIME_TICK_TIMEOUT_MS = 1500;
/** Hard cap on `market.series()`'s own requested length, regardless of what a script asks for —
 *  see ScriptEngineSnapshot.limits' own doc. */
export const MAX_SERIES_LENGTH = 5000;
