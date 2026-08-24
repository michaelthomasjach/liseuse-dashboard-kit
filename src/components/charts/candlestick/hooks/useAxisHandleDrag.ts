import type { ScaleLinear } from "d3";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { round4 } from "../drawingGeometry";

// Same shape as useDrawingInteractions' own local MutableRef — duplicated rather than imported
// to avoid a needless cross-file type dependency for something this small.
interface MutableRef<T> {
  current: T;
}

export interface UseAxisHandleDragArgs {
  drawings: TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  drawingsLocked: boolean;
  dragAxisRef: MutableRef<{ id: string } | null>;
  zoomRef: MutableRef<SVGRectElement | null>;
  zoomedXScale: ScaleLinear<number, number>;
  zoomedPriceScale: ScaleLinear<number, number>;
  dateForIndex: (rawIndex: number) => Date;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: ScaleLinear<number, number>; offset: number };
}

/** The single-handle drag every axis-constrained/single-point drawing type shares — pulled out of
 *  `useDrawingInteractions` purely to keep that file under its 1000-line budget, same reasoning
 *  `distanceToDrawing` was already pulled into drawingHitTest.ts for; behavior unchanged. */
export function useAxisHandleDrag({
  drawings,
  commitDrawings,
  drawingsLocked,
  dragAxisRef,
  zoomRef,
  zoomedXScale,
  zoomedPriceScale,
  dateForIndex,
  paneScaleAndOffset,
}: UseAxisHandleDragArgs) {
  // Single-handle drag for an axis-constrained line: sets its value directly from the pointer's
  // absolute position (like the two-endpoint drag elsewhere), but along one axis only — a
  // "horizontal" line's handle only ever changes y1/y2 (kept equal), a "vertical" line's handle
  // only ever changes x1/x2 (kept equal).
  function handleAxisHandlePointerDown(drawingId: string) {
    return (e: React.PointerEvent<SVGCircleElement>) => {
      // Still stops propagation while locked — same reasoning as handleEndpointPointerDown.
      e.stopPropagation();
      if (drawingsLocked) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragAxisRef.current = { id: drawingId };
    };
  }

  function handleAxisHandlePointerMove(e: React.PointerEvent<SVGCircleElement>) {
    const drag = dragAxisRef.current;
    if (!drag) return;
    const dr = drawings.find((d) => d.id === drag.id);
    if (!dr) return;
    const rect = zoomRef.current!.getBoundingClientRect();
    if (dr.lineType === "horizontal") {
      const mouseY = e.clientY - rect.top;
      const pane = paneScaleAndOffset(dr.valueAxis);
      const value = round4(pane.scale.invert(mouseY - pane.offset));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, y1: value, y2: value } : d)));
    } else if (dr.lineType === "vertical") {
      const mouseX = e.clientX - rect.left;
      const dateValue = dateForIndex(zoomedXScale.invert(mouseX));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: dateValue, x2: dateValue } : d)));
    } else if (
      dr.lineType === "ray" ||
      ["arrowUp", "arrowDown", "pin", "flagMark", "text", "comment", "signpost", "priceLabel"].includes(dr.lineType ?? "")
    ) {
      // Both a ray's anchor and every single-point marker above have both degrees of freedom,
      // unlike horizontal/vertical's single axis — none of them are ever one of the pane-aware
      // lineTypes, so paneScaleAndOffset always resolves to price same as before.
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const dateValue = dateForIndex(zoomedXScale.invert(mouseX));
      const pane = paneScaleAndOffset(dr.valueAxis);
      const value = round4(pane.scale.invert(mouseY - pane.offset));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: dateValue, x2: dateValue, y1: value, y2: value } : d)));
    } else if (dr.lineType === "channel") {
      // A channel's 3rd handle only adjusts channelOffset (single axis, vertical) — line 1's own
      // two endpoints already have their own draggable handles, same as a regular trend line.
      // Recomputes the offset so line 2 passes through the new mouseY at the handle's own X (its
      // line 2 midpoint) — the midpoint's line-1 price simplifies to a plain average of y1/y2.
      const mouseY = e.clientY - rect.top;
      const midPrice = (dr.y1 + dr.y2) / 2;
      commitDrawings(
        drawings.map((d) => (d.id === drag.id ? { ...d, channelOffset: round4(zoomedPriceScale.invert(mouseY) - midPrice) } : d))
      );
    }
  }

  function handleAxisHandlePointerUp(e: React.PointerEvent<SVGCircleElement>) {
    dragAxisRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return { handleAxisHandlePointerDown, handleAxisHandlePointerMove, handleAxisHandlePointerUp };
}
