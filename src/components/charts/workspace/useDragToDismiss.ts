import { useEffect, useRef, useState } from "react";
import type { TransitionEvent as ReactTransitionEvent } from "react";

/** How far the finger may travel and still count as a tap on the bar rather than a drag of it —
 *  a deliberate tap always wobbles a little. */
const TAP_SLOP = 6;

/** How far down the drag has to have travelled when the finger lifts for it to count as "close
 *  this" rather than settling back. Deliberately well past a stray few pixels: the bar is the only
 *  gesture off this page, so a tap that wobbles must not dismiss it by accident. */
const DISMISS_THRESHOLD = 90;
/** Backstop for the closing transition's own `transitionend` — an element that never actually
 *  transitions (animations off at the engine level, a test renderer) would otherwise never call
 *  `onDismiss` and strand the page on screen. Comfortably past the CSS duration. */
const CLOSE_FALLBACK_MS = 500;

export interface UseDragToDismissArgs {
  /** Whether the sheet should be on screen. Going true starts the entrance; the caller keeps
   *  rendering it until `onDismiss` fires, which is what gives the exit somewhere to play. */
  open: boolean;
  onDismiss: () => void;
}

/** The mobile symbol-details page's own presentation: slides up from the bottom edge on open,
 *  follows a finger dragged down its grab bar, and slides the rest of the way down on release —
 *  or settles back if the drag didn't go far enough.
 *
 *  Three visual states, all driven through CSS classes on one transform transition rather than
 *  keyframes, so a drag can interrupt an entrance and a release can continue straight into the
 *  exit from wherever the finger left the sheet — which is the whole point of `entered`/`closing`
 *  being flags rather than animations. `offsetY` is the live finger offset and only ever applies
 *  while `dragging`; it is never negative, so dragging *up* does nothing rather than lifting the
 *  sheet off its own top edge.
 *
 *  Window listeners opened on pointerdown, the same shape `useSymbolProfileSplit` beside it uses:
 *  a drag that starts on a 28px bar spends nearly all of its life off that bar, and the bar's own
 *  node never moves out from under the finger, so `setPointerCapture` would buy nothing. */
export function useDragToDismiss({ open, onDismiss }: UseDragToDismissArgs) {
  const [offsetY, setOffsetY] = useState(0);
  // Drives the "no transition while the finger is down" class — without it the sheet eases toward
  // each pointermove instead of tracking it, which reads as lag rather than as something dragged.
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  // False for the sheet's first painted frame, true from the next one — that flip is what the
  // entrance transition animates. Without a real painted frame at the start position the browser
  // has nothing to transition *from* and the sheet simply appears in place.
  const [entered, setEntered] = useState(false);
  // When the last pointer sequence on the bar ended, so the click it synthesises can be told apart
  // from a genuine keyboard activation — see `onGrabberClick`.
  const lastPointerUpAtRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setClosing(false);
      setOffsetY(0);
      return;
    }
    // Two nested frames, not one: a single rAF can still land in the same paint as the mount on
    // some engines, which collapses the transition to nothing.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);

  // Both ways out — the grab bar's own click and a drag past the threshold — go through here, so
  // the exit is the same animation either way. `onDismiss` deliberately isn't called yet: the
  // caller must keep rendering until the transition ends, or there is nothing left to animate.
  function requestClose() {
    setDragging(false);
    setOffsetY(0);
    setClosing(true);
  }

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startClientY = e.clientY;
    // Closed over rather than read back from `offsetY`: the pointerup handler is created once per
    // drag, so it would otherwise see the value state held at pointerdown — always 0.
    let travelled = 0;
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      travelled = Math.max(0, ev.clientY - startClientY);
      setOffsetY(travelled);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      lastPointerUpAtRef.current = Date.now();
      // A tap, not a drag — the bar closes on a plain press too, and this is the path that
      // actually delivers it: `preventDefault()` on pointerdown above suppresses the synthesised
      // click on several engines, so relying on onClick alone would make tapping the bar a
      // coin-toss. Handled here rather than left to fall through to the settle-back below, which
      // would silently swallow the press.
      if (travelled <= TAP_SLOP) {
        requestClose();
        return;
      }
      if (travelled >= DISMISS_THRESHOLD) {
        // Dropping `dragging` and the inline offset in the same commit hands the sheet back to the
        // CSS class, which is already at translateY(100%) — so it carries on down from exactly
        // where the finger left it instead of jumping.
        requestClose();
        return;
      }
      setDragging(false);
      setOffsetY(0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onDismiss, CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
    // `onDismiss` is a fresh closure every render and re-subscribing on it would restart the
    // backstop endlessly; only the transition into `closing` should ever arm it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  // Escape closes it too. Not a phone gesture, but this layout is a *width*, not a device — a
  // narrow desktop window gets the same sheet, and there a dialog that only a drag can dismiss is
  // a dead end for anyone on a keyboard.
  useEffect(() => {
    if (!open || closing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /** For the grab bar's own `onClick`. A pointer sequence has already decided the outcome by the
   *  time its synthesised click lands, so anything arriving on the heels of one is dropped; a real
   *  keyboard activation (Enter/Space on the focused bar) comes with no pointer sequence behind it
   *  and closes normally. Without this, a drag released short of the threshold would settle back
   *  and then be closed anyway by the click that followed it. */
  function onGrabberClick() {
    if (Date.now() - lastPointerUpAtRef.current < 500) return;
    requestClose();
  }

  function onTransitionEnd(e: ReactTransitionEvent<HTMLElement>) {
    // The sheet's own transform, not one bubbling up from anything inside it.
    if (!closing || e.target !== e.currentTarget || e.propertyName !== "transform") return;
    onDismiss();
  }

  return { offsetY, dragging, closing, entered, startDrag, requestClose, onGrabberClick, onTransitionEnd };
}
