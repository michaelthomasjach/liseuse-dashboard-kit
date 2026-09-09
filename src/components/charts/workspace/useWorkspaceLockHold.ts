import { useCallback, useRef, useState } from "react";
import type React from "react";

/** How long the grid has to be held to toggle its lock. Three seconds is deliberately long: this
 *  protects a laid-out workspace from stray clicks, so arming it by accident would defeat the
 *  point. */
export const LOCK_HOLD_MS = 3000;
/** When the hold starts showing itself — the fade and the gauge. Before this a press is just a
 *  press, and a click, a drag or a tap costs nothing visually. */
export const LOCK_HOLD_REVEAL_MS = 1000;
/** How far the pointer may travel and still count as held rather than dragged. */
export const LOCK_HOLD_SLOP = 10;

/** Hold anywhere on the grid to toggle the workspace lock, in either direction.
 *
 *  A press rather than a click count (which this used to be) because a count has no way to show
 *  its own progress — you either guessed right or nothing happened. A hold can be watched, and
 *  abandoned. */
export function useWorkspaceLockHold() {
  const [locked, setLocked] = useState(false);
  // 0 while nothing is held; otherwise how far through the hold we are, 0→1. Only surfaces past
  // LOCK_HOLD_REVEAL_MS — see the overlay in ChartWorkspace — so a stray press costs nothing
  // visually.
  const [progress, setProgress] = useState(0);
  const holdRef = useRef<{ frame: number; startedAt: number; startX: number; startY: number } | null>(null);

  const end = useCallback(() => {
    const hold = holdRef.current;
    if (!hold) return;
    cancelAnimationFrame(hold.frame);
    holdRef.current = null;
    setProgress(0);
  }, []);

  const start = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (holdRef.current) return;
      // A drawing tool being active anywhere in the workspace disables the gesture outright: with a
      // tool armed, a press on the plot is the first point of a drawing, and it must not also arm a
      // lock. Read off the DOM rather than through props — `.lq-chart__overlay--drawing` is the
      // class CandlestickChart already puts on its hit rect for exactly this state, and every panel
      // is a descendant of this grid, so one query answers it for all of them without threading a
      // per-panel `activeTool` up through the tree.
      if (!locked && e.currentTarget.querySelector(".lq-chart__overlay--drawing")) return;
      const startedAt = performance.now();
      const step = () => {
        const hold = holdRef.current;
        if (!hold) return;
        const next = Math.min(1, (performance.now() - hold.startedAt) / LOCK_HOLD_MS);
        setProgress(next);
        if (next >= 1) {
          setLocked((current) => !current);
          end();
          return;
        }
        hold.frame = requestAnimationFrame(step);
      };
      holdRef.current = { frame: requestAnimationFrame(step), startedAt, startX: e.clientX, startY: e.clientY };
    },
    [locked, end],
  );

  const track = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const hold = holdRef.current;
      if (!hold) return;
      // A press that travels is a pan, not a hold. Without this, panning the chart for three
      // seconds would silently lock the workspace — the gesture would misfire far more often than
      // it fired.
      if (Math.hypot(e.clientX - hold.startX, e.clientY - hold.startY) > LOCK_HOLD_SLOP) end();
    },
    [end],
  );

  /** Whether the progress ring should be on screen — past the reveal delay, and only while held. */
  const revealed = progress * LOCK_HOLD_MS >= LOCK_HOLD_REVEAL_MS;

  return { locked, setLocked, progress, revealed, start, track, end };
}
