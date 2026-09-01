import { ChevronLeftIcon, ChevronRightIcon } from "../../../icons";
import type { DockSide } from "../hooks/useDockedPaneColumns";

export interface SideDockCollapsedStripProps {
  side: DockSide;
  label: string;
  onExpand: () => void;
}

/** The vertical band a *collapsed* docked pane folds down to — the exact mirror of what a collapsed
 *  pane in the bottom stack leaves behind (`.lq-chart__pane-header--collapsed`: a
 *  SUB_PANE_COLLAPSED_HEIGHT strip keeping the chevron and the pane's own name reachable), turned
 *  90°. A docked pane folds along its column's own short axis — sideways, toward the column's outer
 *  edge — so the band is SIDE_DOCK_COLLAPSED_WIDTH *wide* and full height instead, with its label
 *  set in `writing-mode: vertical-rl` rather than rotated with a transform (a transform would leave
 *  the element's own layout box horizontal, so the strip couldn't size itself to the text).
 *
 *  Sits in `.lq-chart__side-dock-pane-group` alongside the expanded panes' own plot box, not inside
 *  it: a folded pane is out of the vertical stack entirely (see `stackSidePanes`' own doc), which is
 *  what lets the panes still expanded take the column's whole height. */
export function SideDockCollapsedStrip({ side, label, onExpand }: SideDockCollapsedStripProps) {
  // Points back toward the main chart — the direction the pane unfolds into. Mirrors the bottom
  // stack, where a collapsed pane's own chevron points up, back into the space it would reclaim.
  const ExpandIcon = side === "right" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <div className={["lq-chart__side-dock-collapsed", `lq-chart__side-dock-collapsed--${side}`].join(" ")}>
      <button type="button" className="lq-chart__pane-header-action" onClick={onExpand} aria-label={`Agrandir le panneau ${label}`}>
        <ExpandIcon size={12} />
      </button>
      <span className="lq-chart__side-dock-collapsed-label" onDoubleClick={onExpand} title={label}>
        {label}
      </span>
    </div>
  );
}
