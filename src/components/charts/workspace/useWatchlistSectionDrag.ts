import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface UseWatchlistSectionDragArgs {
  /** The active list's own current section order (ids). Only ever read at drag start/drop time
   *  (see `startDrag` below) — unlike the row-drag/pane-reorder gestures this now otherwise
   *  mirrors, nothing here needs to keep re-reading a *changing* order mid-drag, since (also like
   *  `useWatchlistRowDrag`) nothing about the order actually changes until the pointer is
   *  released. */
  sectionOrder: string[];
  onReorder: ((newOrder: string[]) => void) | undefined;
}

// Same threshold, same reasoning as useWatchlistRowDrag's own — not shared directly since
// nothing else already couples these two modules.
const DRAG_THRESHOLD = 4;

/**
 * Drag a watchlist section (from anywhere on its header, not just its own grip handle — a plain
 * click still toggles collapse as usual, only actually starting a visible drag once the pointer
 * travels past `DRAG_THRESHOLD`) onto a precise position among the list's other sections — same
 * gesture shape as `useWatchlistRowDrag`'s own (a live drop-indicator line previews where it will
 * land; nothing reorders until the pointer is actually released), rather than the live-splicing
 * "swap as soon as you cross a neighbor's midpoint" this used to do — deliberately matched to
 * row-drag's own feel since a section is still just one more thing being dragged in the exact same
 * list, and every symbol/row it contains already moves with it for free (it owns its own `rows`
 * array — see `ChartWorkspaceWatchlistSection`'s own doc — so reordering the *section* is already
 * reordering everything inside it, no extra plumbing needed here for that part). `pressedSectionId`
 * is set the instant `startDrag` fires (pointerdown), before any movement at all — purely a
 * "you're now holding this section" visual cue, same distinction row-drag's own `pressedRowId`
 * draws from `draggingRowId`.
 */
export function useWatchlistSectionDrag({ sectionOrder, onReorder }: UseWatchlistSectionDragArgs) {
  const [pressedSectionId, setPressedSectionId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function startDrag(sectionId: string, e: ReactPointerEvent) {
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let indicatorIndex: number | null = null;
    setPressedSectionId(sectionId);

    // Where `sectionId` would land if dropped right now — the first other section whose own
    // header midpoint is still below the pointer, or the end of the list past every one of them.
    // The dragged section's own header is excluded (same reasoning `useWatchlistRowDrag`'s own
    // `computeIndicator` excludes the dragged row) so the index is always relative to "the list
    // without it".
    function computeDropIndex(ev: PointerEvent): number {
      const headers = Array.from(document.querySelectorAll<HTMLElement>("[data-watchlist-section-id]")).filter(
        (el) => el.dataset.watchlistSectionId !== sectionId
      );
      for (let i = 0; i < headers.length; i++) {
        const rect = headers[i].getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) return i;
      }
      return headers.length;
    }

    function onPointerMove(ev: PointerEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        setDraggingSectionId(sectionId);
      }
      indicatorIndex = computeDropIndex(ev);
      setDropIndex(indicatorIndex);
    }
    function onPointerUp() {
      if (dragging && indicatorIndex !== null) {
        const next = sectionOrder.filter((id) => id !== sectionId);
        next.splice(indicatorIndex, 0, sectionId);
        onReorder?.(next);
      }
      setPressedSectionId(null);
      setDraggingSectionId(null);
      setDropIndex(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return { pressedSectionId, draggingSectionId, dropIndex, startDrag };
}
