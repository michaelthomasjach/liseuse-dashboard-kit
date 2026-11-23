import type { MutableRefObject } from "react";
import type * as d3 from "d3";
import type { Candle } from "../interfaces/Candle.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";

export interface UseAddLineHandlersArgs {
  data: Candle[];
  drawings: TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  drawingIdRef: MutableRefObject<number>;
  hoverY: number | null;
  zoomedPriceScale: d3.ScaleLinear<number, number>;
  hoverVolumeY: number | null;
  zoomedVolumeScale: d3.ScaleLinear<number, number>;
  hovered: Candle | null;
  /** Date sous le réticule, extrapolée dans l'espace vide à droite de la dernière bougie. */
  crosshairDate?: Date | null;
  priceScale: d3.ScaleLinear<number, number>;
  hoverIndicatorPaneId: string | null;
  hoverIndicatorPaneY: number | null;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: d3.ScaleLinear<number, number>; offset: number };
}

/** The "+"-button handlers behind every hover-to-add-a-line badge (see ChartHoverBadges): a
 *  horizontal price line, a horizontal volume line, a vertical date line, and a horizontal line
 *  on whichever "own"-pane indicator (RSI/CHOP/MACD/fundamentals) is currently hovered. All four
 *  span the dataset's own (unzoomed) extent rather than the currently visible one, so they still
 *  reach edge to edge after the user zooms/pans away from where they were added — a price alert
 *  or a session marker shouldn't disappear just because the view moved. Marked with `lineType` so
 *  they drag along one axis only (see handlePointerMove/handleAxisHandle* in
 *  useDrawingInteractions) and render full-span instead of between their stored x1/x2 (see the
 *  canvas draw effect). */
export function useAddLineHandlers({
  data,
  drawings,
  commitDrawings,
  drawingIdRef,
  hoverY,
  zoomedPriceScale,
  hoverVolumeY,
  zoomedVolumeScale,
  hovered,
  crosshairDate,
  priceScale,
  hoverIndicatorPaneId,
  hoverIndicatorPaneY,
  paneScaleAndOffset,
}: UseAddLineHandlersArgs) {
  function addPriceLine() {
    if (hoverY === null) return;
    const price = zoomedPriceScale.invert(hoverY);
    commitDrawings([
      ...drawings,
      { id: `drawing-${drawingIdRef.current++}`, x1: data[0].date, y1: price, x2: data[data.length - 1].date, y2: price, lineType: "horizontal" },
    ]);
  }

  function addVolumeLine() {
    if (hoverVolumeY === null) return;
    const volume = zoomedVolumeScale.invert(hoverVolumeY);
    commitDrawings([
      ...drawings,
      {
        id: `drawing-${drawingIdRef.current++}`,
        x1: data[0].date,
        y1: volume,
        x2: data[data.length - 1].date,
        y2: volume,
        lineType: "horizontal",
        valueAxis: "volume",
      },
    ]);
  }

  function addDateLine() {
    const date = crosshairDate ?? hovered?.date;
    if (!date) return;
    const [p0, p1] = priceScale.domain() as [number, number];
    commitDrawings([...drawings, { id: `drawing-${drawingIdRef.current++}`, x1: date, y1: p0, x2: date, y2: p1, lineType: "vertical" }]);
  }

  // Same idea as addPriceLine/addVolumeLine, generalized to whichever "own"-pane indicator
  // (RSI/CHOP/MACD/fundamentals) is currently hovered — hoverIndicatorPaneY is relative to that
  // pane's own top, so paneScaleAndOffset's own scale (not the offset, already baked into the
  // hover Y itself) is all that's needed to invert it back to a data value.
  function addIndicatorPaneLine() {
    if (hoverIndicatorPaneId === null || hoverIndicatorPaneY === null) return;
    const value = paneScaleAndOffset(hoverIndicatorPaneId).scale.invert(hoverIndicatorPaneY);
    commitDrawings([
      ...drawings,
      {
        id: `drawing-${drawingIdRef.current++}`,
        x1: data[0].date,
        y1: value,
        x2: data[data.length - 1].date,
        y2: value,
        lineType: "horizontal",
        valueAxis: hoverIndicatorPaneId,
      },
    ]);
  }

  return { addPriceLine, addVolumeLine, addDateLine, addIndicatorPaneLine };
}
