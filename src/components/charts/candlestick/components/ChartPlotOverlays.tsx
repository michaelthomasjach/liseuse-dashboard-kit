import { ChartCanvasOverlay, type ChartCanvasOverlayProps } from "./ChartCanvasOverlay";
import { ChartHoverBadges, type ChartHoverBadgesProps } from "./ChartHoverBadges";
import { ChartAxisAnnotations, type ChartAxisAnnotationsProps } from "./ChartAxisAnnotations";

export type ChartPlotOverlaysProps = ChartCanvasOverlayProps & ChartHoverBadgesProps & ChartAxisAnnotationsProps;

/** `ChartCanvasOverlay` (the SVG axes/handles/drawing-interaction layer sitting over the canvas)
 *  and `ChartHoverBadges` (the live hover/axis-value badges on top of that), grouped into one
 *  component purely because their own prop lists overlap so heavily (dims, every zoomed scale,
 *  priceHeight/volumeTop, visibleDrawings, the event-tooltip state...) that keeping them as two
 *  separate call sites in CandlestickChart.tsx meant listing most of the same values twice —
 *  extracted here (not because either has gained any behavior of its own) purely to keep
 *  CandlestickChart.tsx itself under this repo's 1000-line cap. Every prop still reaches its own
 *  original component unchanged; this file has no logic beyond the two calls below. */
export function ChartPlotOverlays(props: ChartPlotOverlaysProps) {
  return (
    <>
      <ChartCanvasOverlay {...props} />
      {/* Before the hover badges for the same reason the last-close badge is: what the pointer
          is on right now paints over what was selected earlier. */}
      <ChartAxisAnnotations {...props} />
      <ChartHoverBadges {...props} />
    </>
  );
}
