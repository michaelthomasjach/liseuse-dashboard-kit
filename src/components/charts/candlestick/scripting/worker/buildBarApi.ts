import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";

export interface BarApi {
  /** True only for the bar this run's replay loop just reached for the first time — every earlier
   *  index is history the *previous* run already evaluated, replayed again here only because
   *  state is rebuilt from bar 0 each time (see buildStateApi's own doc). */
  isNew(): boolean;
  /** False only when this is both the newest bar *and* the host told us (via
   *  `ScriptEngineSnapshot.lastCandleOpen`) that its own most recent candle is still actively
   *  forming — every other bar, by definition, already closed before the next one could exist. */
  isClosed(): boolean;
  /** True only when this run is itself a live re-trigger (one more bar appended to an
   *  already-replayed script, see `runScript`'s own doc) *and* this is that newly-appended bar —
   *  false for every bar of a plain historical replay, including its own last one. */
  isRealtime(): boolean;
}

/** `bar.*`, closed over the same `getCurrentIndex` callback `market`/`chart` already share, plus
 *  the two host-provided flags on the snapshot that make these three questions answerable at all
 *  (`runScript` itself has no notion of "is the market open right now" — only the host does). */
export function buildBarApi(snapshot: ScriptEngineSnapshot, getCurrentIndex: () => number): BarApi {
  const isLastBar = () => getCurrentIndex() === snapshot.runUpToIndex;
  return {
    isNew: () => isLastBar(),
    isClosed: () => !(isLastBar() && snapshot.lastCandleOpen === true),
    isRealtime: () => isLastBar() && snapshot.isRealtimeTick === true,
  };
}
