import { useRef, useState } from "react";
import { SIDE_PANEL_MAX_WIDTH, SIDE_PANEL_MIN_WIDTH } from "../constants";

export interface UseSidePanelArgs {
  defaultSidePanelOpen: boolean | undefined;
  onSidePanelOpenChange: ((open: boolean) => void) | undefined;
}

/** Open/collapsed state plus drag-to-resize for a docked `ChartSidePanel` — shared by
 *  `CandlestickChartProps.sidePanel` (a single chart's own panel) and `ChartWorkspaceProps.sidePanel`
 *  (one panel docked to a whole multi-chart workspace instead — see ChartWorkspace's own doc for
 *  why that one lives at the *workspace* level rather than being repeated per panel). Same
 *  "uncontrolled `defaultX` seeds state, every setter funnels through one `commitX` that also
 *  fires `onXChange`" shape `usePaneLayout`'s own `commitIndicators` already uses.
 *
 *  `widthPx` starts `null`, meaning "use the CSS default" (a plain 20% flex-basis on
 *  `.lq-chart__side-panel` — see SIDE_PANEL_DEFAULT_WIDTH_FRACTION) rather than a number computed
 *  here: the panel's *default* width only ever needs to be "1/5 of its container," which the
 *  browser's own flex layout already gives for free with no measurement/chicken-and-egg problem,
 *  so there's nothing to compute a fallback pixel value from until the user actually drags the
 *  handle — at that point `startResize` reads the panel's own current rendered width directly off
 *  the DOM via `panelRef` (however wide it happened to be, whether that came from the CSS default
 *  or an earlier drag) and switches to tracking that as a fixed pixel value from then on. */
export function useSidePanel({ defaultSidePanelOpen, onSidePanelOpenChange }: UseSidePanelArgs) {
  const [open, setOpen] = useState(defaultSidePanelOpen ?? true);
  const [widthPx, setWidthPx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function commitOpen(next: boolean) {
    setOpen(next);
    onSidePanelOpenChange?.(next);
  }

  // Same window-pointermove-listener pattern usePaneLayout's own startPaneResize uses (see its
  // own comment) rather than setPointerCapture — keeps tracking the drag even once the pointer
  // leaves the handle's own thin strip.
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? SIDE_PANEL_MIN_WIDTH;
    const onMove = (ev: PointerEvent) => {
      // Dragging the handle (on the panel's own left edge) further left grows the panel.
      const next = Math.min(SIDE_PANEL_MAX_WIDTH, Math.max(SIDE_PANEL_MIN_WIDTH, startWidth - (ev.clientX - startClientX)));
      setWidthPx(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Ouvre ou ferme sans prévenir l'appelant (rien d'enregistré) : un changement imposé par la mise en page, pas un
   *  choix de l'utilisateur. */
  function setOpenTransient(next: boolean) {
    setOpen(next);
  }

  return { open, commitOpen, setOpenTransient, widthPx, panelRef, startResize };
}
