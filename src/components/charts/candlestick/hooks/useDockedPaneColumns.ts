import { useRef, useState } from "react";
import type * as React from "react";
import { SIDE_DOCK_PANE_MIN_WIDTH, SIDE_DOCK_PANE_MAX_WIDTH } from "../constants";

export type DockSide = "left" | "right";

/** Drag-to-resize for a `plot.pane(name, { dock: "left"|"right" })` script pane's own column —
 *  same "uncontrolled, starts null (use the CSS/inline default), a drag pins it to a fixed pixel
 *  width from then on" shape `useSidePanel.ts` already uses for the (unrelated) watchlist panel,
 *  just for two independent columns instead of one. A single hook (not two calls to a
 *  side-panel-shaped one) since both columns share the same MIN/MAX bounds and the same drag
 *  mechanics — parametrizing `side` here is simpler than a second, near-identical hook. */
export function useDockedPaneColumns() {
  const [widths, setWidths] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  function startResize(side: DockSide) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const panelRef = side === "left" ? leftRef : rightRef;
      const startClientX = e.clientX;
      const startWidth = panelRef.current?.getBoundingClientRect().width ?? SIDE_DOCK_PANE_MIN_WIDTH;
      const onMove = (ev: PointerEvent) => {
        // A left-docked column's own resize handle sits on its *right* edge (against the main
        // chart) — dragging it right grows the column. A right-docked one's handle sits on its
        // *left* edge instead, so the same rightward drag has to shrink it — hence the sign flip.
        const delta = side === "left" ? ev.clientX - startClientX : startClientX - ev.clientX;
        const next = Math.min(SIDE_DOCK_PANE_MAX_WIDTH, Math.max(SIDE_DOCK_PANE_MIN_WIDTH, startWidth + delta));
        setWidths((prev) => ({ ...prev, [side]: next }));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  return { widths, leftRef, rightRef, startResize };
}
