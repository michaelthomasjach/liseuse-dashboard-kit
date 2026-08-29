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
/** How long `useScriptEngine`'s real-time auto-re-trigger waits after the *last* `data` change
 *  before actually starting a run — a burst of several ticks arriving close together (a
 *  fast-moving feed, a resample, several symbols updating in the same host render pass) collapses
 *  into a single run against the latest snapshot instead of queuing one run per tick, most of
 *  which would just be `.terminate()`-superseded by the next before finishing anyway. */
export const REALTIME_TICK_DEBOUNCE_MS = 300;
