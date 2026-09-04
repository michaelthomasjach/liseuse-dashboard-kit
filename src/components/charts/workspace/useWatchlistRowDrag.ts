import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface MoveWatchlistRowArgs {
  rowId: string;
  fromSectionId: string | null;
  toSectionId: string | null;
  /** Position within the destination list (root `rows`, or that section's own `rows`), *after*
   *  the row itself has been removed from wherever it started — same convention `Array.splice`
   *  already uses, so a caller can implement this with a single filter-then-splice pass
   *  regardless of whether `fromSectionId`/`toSectionId` are the same list or different ones. */
  toIndex: number;
}

export interface UseWatchlistRowDragArgs {
  onMove: ((args: MoveWatchlistRowArgs) => void) | undefined;
  /** How long the row has to be held before a drag can begin. `0` (the default, and the desktop
   *  case) starts it on the first pixel of movement. On a touch layout that is exactly wrong: a
   *  finger's first pixel of movement on a list is almost always the start of a *scroll*, and a
   *  row that starts dragging under it steals the scroll and rearranges the list by accident.
   *  Holding still first is the gesture every phone already uses to mean "pick this up". */
  holdMs?: number;
}

/** Where the drop-indicator line should render, live-updated as the pointer moves — not yet
 *  committed (see `MoveWatchlistRowArgs`' own doc): nothing here mutates the caller's own row
 *  order until `onPointerUp`. */
export interface WatchlistDropIndicator {
  sectionId: string | null;
  index: number;
}

/** The root (no-section) drop zone's own sentinel id — `element.dataset` values are always
 *  strings, so `null` (root) needs a stand-in that can round-trip through a `data-*` attribute;
 *  translated back to `null` the moment it's read in `onPointerMove` below. */
const ROOT_DROP_ZONE = "__root__";

// How far the pointer has to travel from its own pointerdown before this counts as an actual
// drag rather than a plain click — same distinction (and same threshold) chart drawings already
// use for their own whole-body drag vs. click-to-select (see CLICK_DRAG_THRESHOLD in the
// candlestick module) — this module doesn't share that one directly since it's a different part
// of the library with no existing dependency between them, not worth introducing just for one
// constant.
const DRAG_THRESHOLD = 4;

/** Marks an element as a valid drop target for a dragged watchlist row — a section's own header/
 *  row-list, or the root (no-section) zone (pass `null`). Spread onto that element's own props. */
export function watchlistDropZoneProps(sectionId: string | null) {
  return { "data-watchlist-drop-zone": sectionId ?? ROOT_DROP_ZONE };
}

/** Marks a row element so `useWatchlistRowDrag` can find it (and every other row currently in the
 *  same zone) to compute a precise insertion index while dragging. Spread onto that row's own
 *  outer element. */
export function watchlistRowProps(rowId: string) {
  return { "data-watchlist-row-id": rowId };
}

/**
 * Drag a watchlist row (from anywhere on the row, not just its own grip handle — a plain click
 * still loads the row's symbol as usual) onto a precise position, within its own section/the root
 * list *or* a different one — both "reorder within a list" and "move between lists" are the same
 * gesture here (see `MoveWatchlistRowArgs`' own doc), unlike the coarser section-level-only
 * version this replaces. Two states track two different moments: `pressedRowId` is set the
 * instant `startDrag` fires (pointerdown), before any movement at all — purely a "you're now
 * holding this row" visual cue; `draggingRowId`/`dropIndicator` only turn on past
 * `DRAG_THRESHOLD`, once there's an actual drag (and a real position to show) to represent.
 * Pointer-based with window-level listeners attached directly from `startDrag` itself (not a
 * `useEffect` keyed on drag state — nothing here needs re-subscribing mid-drag the way
 * `usePaneDragReorder`'s own geometry inputs do, so each call just owns its own gesture via
 * closure instead).
 */
export function useWatchlistRowDrag({ onMove, holdMs = 0 }: UseWatchlistRowDragArgs) {
  const [pressedRowId, setPressedRowId] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<WatchlistDropIndicator | null>(null);

  function startDrag(rowId: string, fromSectionId: string | null, e: ReactPointerEvent) {
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let indicator: WatchlistDropIndicator | null = null;
    // Until the hold elapses nothing is armed: no pressed state, no drag. Movement past the
    // threshold in that window is a scroll and cancels the hold outright; a lift is a tap and does
    // the same. Only a finger that stays put for `holdMs` picks the row up — from then on the
    // gesture is exactly the desktop one.
    let armed = holdMs <= 0;
    let holdTimer = 0;
    if (armed) setPressedRowId(rowId);
    else {
      holdTimer = window.setTimeout(() => {
        holdTimer = 0;
        armed = true;
        setPressedRowId(rowId);
      }, holdMs);
    }
    const cancelHold = () => {
      if (holdTimer) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
      }
    };

    // Finds the zone under the pointer and, within it, exactly where `rowId` would land — the
    // first other row whose own vertical midpoint is still below the pointer, or the end of the
    // list if the pointer's past every one of them. The dragged row itself is excluded from this
    // scan (it may still be sitting in the DOM at its own original spot, mid-drag) so the
    // resulting index is always relative to "the list without it", the exact shape
    // `MoveWatchlistRowArgs.toIndex` documents.
    function computeIndicator(ev: PointerEvent): WatchlistDropIndicator | null {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const zoneEl = el?.closest<HTMLElement>("[data-watchlist-drop-zone]");
      if (!zoneEl) return null;
      const raw = zoneEl.dataset.watchlistDropZone;
      const sectionId = raw === undefined || raw === ROOT_DROP_ZONE ? null : raw;
      const rowEls = Array.from(zoneEl.querySelectorAll<HTMLElement>("[data-watchlist-row-id]")).filter(
        (rowEl) => rowEl.dataset.watchlistRowId !== rowId
      );
      let index = rowEls.length;
      for (let i = 0; i < rowEls.length; i++) {
        const rect = rowEls[i].getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) {
          index = i;
          break;
        }
      }
      return { sectionId, index };
    }

    function onPointerMove(ev: PointerEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        if (!armed) {
          // Moved before the hold elapsed: this is a scroll, not a pick-up. Stand down entirely
          // and let the list scroll — the listeners come off so a later stillness can't arm it.
          cancelHold();
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerUp);
          return;
        }
        dragging = true;
        setDraggingRowId(rowId);
      }
      indicator = computeIndicator(ev);
      setDropIndicator(indicator);
    }
    function onPointerUp() {
      cancelHold();
      if (dragging && indicator) {
        onMove?.({ rowId, fromSectionId, toSectionId: indicator.sectionId, toIndex: indicator.index });
      }
      setPressedRowId(null);
      setDraggingRowId(null);
      setDropIndicator(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    // A touch the browser reclaims (it decided the gesture was a scroll after all) must end this
    // the same way a lift does, or the hold timer fires into a gesture that no longer exists.
    window.addEventListener("pointercancel", onPointerUp);
  }

  return { pressedRowId, draggingRowId, dropIndicator, startDrag };
}
