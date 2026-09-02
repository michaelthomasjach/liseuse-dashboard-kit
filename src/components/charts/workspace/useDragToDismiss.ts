import { useState } from "react";

/** How far down the drag has to have travelled when the finger lifts for it to count as "close
 *  this" rather than snapping back. Deliberately well past a stray few pixels: the bar is the only
 *  way off this page, so a tap that wobbles must not dismiss it by accident. */
const DISMISS_THRESHOLD = 90;

/** Drag-down-to-close for the mobile symbol-details page's own grab bar (see `ChartWorkspace`'s
 *  own `mobileProfileTicker` page, which is what this closes).
 *
 *  Window listeners opened on pointerdown, the same shape `useSymbolProfileSplit` right beside it
 *  already uses: a drag that starts on a 20px bar spends nearly all of its life off that bar, and
 *  the bar's own DOM node never moves out from under the finger the way a reordered list row can,
 *  so there's nothing `setPointerCapture` would buy over the pair this library uses everywhere
 *  else.
 *
 *  `offsetY` is never negative — dragging *up* does nothing rather than lifting the page off its
 *  own top edge, which could only ever expose the panel's background above it. */
export function useDragToDismiss(onDismiss: () => void) {
  const [offsetY, setOffsetY] = useState(0);
  // Drives the "no transition while the finger is down" class — without it the page chases the
  // finger through a 180ms ease on every move event instead of tracking it, which reads as lag
  // rather than as something being dragged.
  const [dragging, setDragging] = useState(false);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startClientY = e.clientY;
    // Closed over rather than read back from `offsetY`: this is what the pointerup handler decides
    // on, and that handler is created once per drag, so it would otherwise be reading the value
    // state had at pointerdown — always 0.
    let travelled = 0;
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      travelled = Math.max(0, ev.clientY - startClientY);
      setOffsetY(travelled);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      // Back to rest either way: on a dismiss the page unmounts before this is ever painted, and
      // on a snap-back it's the transition's own target.
      setOffsetY(0);
      if (travelled >= DISMISS_THRESHOLD) onDismiss();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { offsetY, dragging, startDrag };
}
