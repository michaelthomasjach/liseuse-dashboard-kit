import { useRef, useState } from "react";

const SYMBOL_PROFILE_MIN_HEIGHT = 160;
const SYMBOL_PROFILE_MAX_HEIGHT = 640;
/** Flex-basis for the bottom "company info" pane before the user has ever dragged the divider —
 *  same "a plain CSS default costs nothing to compute" reasoning `SIDE_PANEL_DEFAULT_WIDTH_FRACTION`
 *  already uses for the side panel's own *width*, just vertical here. */
const SYMBOL_PROFILE_DEFAULT_HEIGHT_FRACTION = "45%";

/** Drag-to-resize for the divider between the side panel's own top half (watchlist/alerts) and
 *  bottom half (`SymbolProfilePanel`) — same "starts null, meaning 'use the CSS default', and only
 *  switches to tracking a fixed pixel size once the user actually drags" shape `useSidePanel`'s
 *  own `widthPx` already uses for the side panel's *width*, mirrored here for its bottom pane's
 *  own *height* instead. Kept as its own small hook (not folded into `useSidePanel` itself) since
 *  this split only exists inside `ChartWorkspace`'s own side panel, not the standalone-chart one
 *  `useSidePanel` is also shared with. */
export function useSymbolProfileSplit() {
  const [heightPx, setHeightPx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startClientY = e.clientY;
    const startHeight = panelRef.current?.getBoundingClientRect().height ?? SYMBOL_PROFILE_MIN_HEIGHT;
    const onMove = (ev: PointerEvent) => {
      // Dragging the handle up grows the bottom pane (it sits below the handle).
      const next = Math.min(SYMBOL_PROFILE_MAX_HEIGHT, Math.max(SYMBOL_PROFILE_MIN_HEIGHT, startHeight - (ev.clientY - startClientY)));
      setHeightPx(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { heightPx, panelRef, startResize, defaultHeightFraction: SYMBOL_PROFILE_DEFAULT_HEIGHT_FRACTION };
}
