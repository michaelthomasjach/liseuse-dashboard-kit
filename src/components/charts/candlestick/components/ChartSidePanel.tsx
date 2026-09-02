import type { ReactNode, RefObject } from "react";
import type * as React from "react";
import { SIDE_PANEL_DEFAULT_WIDTH_FRACTION } from "../constants";

export interface ChartSidePanelProps {
  children: ReactNode;
  panelRef: RefObject<HTMLDivElement>;
  widthPx: number | null;
  startResize: (e: React.PointerEvent) => void;
  /** Cover the whole content area instead of docking to its right edge — the mobile layout (see
   *  `ChartWorkspace`'s own `isMobileWorkspace`). Below that width a docked panel and the charts
   *  beside it are both too narrow to be worth anything, so the panel takes the area over
   *  entirely; the way back is the same topbar button that opened it. `widthPx` and the resize
   *  handle are both meaningless then and are ignored/not rendered. */
  fullscreen?: boolean;
}

/** A right-docked panel — a flex sibling of whatever it's docked beside (`.lq-chart__main` inside
 *  a single `CandlestickChart`'s own `.lq-chart` row, or `.lq-chart-workspace__grid` inside a
 *  whole `ChartWorkspace`; see each of those components' own doc for why that split exists: it
 *  lets the *other* side genuinely shrink to make room via ordinary flexbox, with zero changes
 *  needed to any of the axis/margin/grid-track math everything else already reads from). Purely a
 *  layout shell around whatever the caller passed as content — same "structure only, caller owns
 *  the content" shape as `ChartWorkspace.children` itself. Meant to be unmounted entirely (not
 *  just visually hidden) by its own caller whenever collapsed — see `useSidePanel`'s own `open` —
 *  so a collapsed panel gives its sibling back its *full* width, not a thin strip. */
export function ChartSidePanel({ children, panelRef, widthPx, startResize, fullscreen = false }: ChartSidePanelProps) {
  return (
    <div
      ref={panelRef}
      className={["lq-chart__side-panel", fullscreen && "lq-chart__side-panel--fullscreen"].filter(Boolean).join(" ")}
      // The CSS default (a plain 20% flex-basis, see SIDE_PANEL_DEFAULT_WIDTH_FRACTION) is what
      // actually delivers "1/5 of the chart" — this inline style only kicks in once the user has
      // dragged the resize handle at least once (see useSidePanel's own widthPx doc), pinning the
      // panel to that exact pixel width from then on instead of a relative share. Skipped entirely
      // while `fullscreen`, where the panel is taken out of the flex row and covers it instead — a
      // dragged-to width from a previous desktop session must not leak into that.
      style={fullscreen ? undefined : widthPx !== null ? { flex: `0 0 ${widthPx}px` } : { flexBasis: SIDE_PANEL_DEFAULT_WIDTH_FRACTION }}
    >
      {!fullscreen && <div className="lq-chart__side-panel-resize-handle" onPointerDown={startResize} />}
      <div className="lq-chart__side-panel-content">{children}</div>
    </div>
  );
}
