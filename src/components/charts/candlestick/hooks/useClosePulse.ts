import { useEffect, useRef, useState } from "react";

export interface ClosePulse {
  /** Bumped once per fired ripple. Its only job is to be a React `key`: restarting a CSS animation
   *  needs a new node, and two consecutive rises would otherwise draw nothing the second time
   *  because the element never changed. */
  seq: number;
  direction: "up" | "down";
}

/** Fires once each time the last revealed close *changes value*.
 *
 *  That single condition is also what makes this a live/replay feature without knowing about
 *  either: a chart sitting on a finished dataset has a last close that never moves, so nothing ever
 *  fires; a live feed rewrites it on every tick, and a replay reveals a new bar on every step.
 *  Panning and zooming leave it alone, which is the point — the ripple marks a new price, not a new
 *  view of an old one.
 *
 *  Nothing fires on the first value either. "Higher or lower than before" needs a before. */
export function useClosePulse(enabled: boolean, close: number | undefined): ClosePulse | null {
  const previousRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState<ClosePulse | null>(null);

  useEffect(() => {
    if (!enabled || close === undefined) {
      // Kept in step even while switched off, so turning the option back on does not compare the
      // current price against whatever was showing the last time it was on and fire a ripple for a
      // move the reader never saw happen.
      previousRef.current = close ?? null;
      return;
    }
    const previous = previousRef.current;
    previousRef.current = close;
    if (previous === null || previous === close) return;
    setPulse((current) => ({ seq: (current?.seq ?? 0) + 1, direction: close > previous ? "up" : "down" }));
  }, [enabled, close]);

  return enabled ? pulse : null;
}
