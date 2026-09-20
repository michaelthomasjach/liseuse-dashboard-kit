import { useLayoutEffect, useState, type RefObject } from "react";

export type PopoverPlacement = "bottom" | "top";

export interface PopoverPosition {
  top: number;
  left: number;
  placement: PopoverPlacement;
  ready: boolean;
}

const GAP = 6;
const PADDING = 8;

function compute(anchor: DOMRect, panel: DOMRect, preferred: PopoverPlacement): PopoverPosition {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const spaceBelow = viewportH - anchor.bottom;
  const spaceAbove = anchor.top;

  let placement = preferred;
  if (preferred === "bottom" && spaceBelow < panel.height + GAP && spaceAbove > spaceBelow) {
    placement = "top";
  } else if (preferred === "top" && spaceAbove < panel.height + GAP && spaceBelow > spaceAbove) {
    placement = "bottom";
  }

  const top = placement === "bottom" ? anchor.bottom + GAP : anchor.top - panel.height - GAP;

  // Prefer left-aligning the panel to the anchor; flip to right-aligned if it would overflow,
  // then clamp inside the viewport either way (covers "opens on the right, or the left").
  let left = anchor.left;
  const overflowsRight = left + panel.width + PADDING > viewportW;
  if (overflowsRight) {
    left = anchor.right - panel.width;
  }
  left = Math.max(PADDING, Math.min(left, viewportW - panel.width - PADDING));

  return { top, left, placement, ready: true };
}

/**
 * Positions a floating panel relative to an anchor element, flipping
 * vertically (bottom ↔ top) and shifting horizontally to stay inside the
 * viewport, re-measuring on scroll/resize while open.
 *
 * `trackKey` covers the anchors that move without either of those firing. Scroll and resize catch
 * a page that moves under the panel; they say nothing about an anchor that moves *within* a static
 * page — an item on a canvas that is being panned, zoomed or dragged. Change this on every such
 * move and the panel re-measures; leave it out and nothing changes for the menus and date pickers
 * that have always been anchored to something that stays put.
 */
export function usePopoverPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  preferred: PopoverPlacement = "bottom",
  trackKey?: string | number
): PopoverPosition {
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0, placement: preferred, ready: false });

  useLayoutEffect(() => {
    if (!open) {
      setPosition((p) => ({ ...p, ready: false }));
      return;
    }

    const update = () => {
      const anchorEl = anchorRef.current;
      const panelEl = panelRef.current;
      if (!anchorEl || !panelEl) return;
      setPosition(compute(anchorEl.getBoundingClientRect(), panelEl.getBoundingClientRect(), preferred));
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preferred, trackKey]);

  return position;
}
