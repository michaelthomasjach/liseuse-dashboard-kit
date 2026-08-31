import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { snapPixel } from "../drawingGeometry";
import { lineDashArray, drawDrawingText } from "../drawingRender";
import { drawOwnPaneIndicatorSeries } from "./drawOwnPaneIndicatorSeries";

/** Phase 3 of `renderCandlestickChart`, painted outside the price section's own clip: the volume
 *  pane's bars and any "horizontal"/"ray" drawing anchored to it, each "own"-pane indicator's
 *  strip (RSI/CHOP/MACD/fundamentals — its own clipped section, same idea as volume), "vertical"
 *  drawings (full plot height, unlike every other lineType which stays within one pane), and the
 *  hover crosshair's vertical line. */
export function drawVolumeAndPanes(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const {
    dims,
    priceHeight,
    plotBoundedHeight,
    zoomedXScale,
    visible,
    candleWidth,
    visibleIndicators,
    hovered,
    hoverVolumeY,
    hoverIndicatorPaneId,
    hoverIndicatorPaneY,
    hoverIndex,
    visibleDrawings,
    hoveredDrawingId,
    indexForDate,
    volumeVisible,
    volumeCollapsed,
    zoomedVolumeScale,
    volumeHeight,
    volumeTop,
    volumeUpColorOverride,
    volumeDownColorOverride,
    ownPaneIndicators,
    indicatorPaneHeights,
    indicatorPaneTops,
    zoomedOwnPaneScales,
    indicators,
  } = params;
  const { colorUp, colorDown, colorText, colorMuted, colorAccent, colorGrid, fontFamily, isEink } = style;


    // volumeHeight is 0 whenever some *other* pane is fullscreened (see usePaneLayout's own
    // volumeHeight branch) — volumeVisible alone doesn't capture that (it only tracks whether
    // the caller has volume turned on at all), so without this the divider line below would
    // still draw a stray 1px rule at the very top of that other pane's now full-height plot.
    if (volumeVisible && volumeHeight > 0) {
      // Divider right above wherever volume currently sits (priceHeight + volumeTop — its own
      // top, not necessarily right after price anymore now that it can be dragged among the
      // indicator panes) — flush against both, no padding on either side (the line itself is the
      // only separation). Drawn even collapsed, separating it from the pane's own header strip.
      ctx.save();
      ctx.strokeStyle = colorGrid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const dividerY = snapPixel(priceHeight + volumeTop);
      ctx.moveTo(0, dividerY);
      ctx.lineTo(dims.boundedWidth, dividerY);
      ctx.stroke();
      ctx.restore();

      // Collapsed, the pane is just its own header strip (an HTML overlay, see the JSX below) —
      // nothing left to draw on the canvas underneath it.
      if (!volumeCollapsed) {
        // Clipped to its own rectangle for the same reason as the price section above.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, priceHeight + volumeTop, dims.boundedWidth, volumeHeight);
        ctx.clip();
        ctx.translate(0, priceHeight + volumeTop);
        // Falls back to whichever of colorUp/colorDown is already in effect (theme or its own
        // override) — only actually diverges from the candles' own colors once set from the
        // volume pane's own settings modal (see the gear icon in its header below).
        const volColorUp = volumeUpColorOverride ?? colorUp;
        const volColorDown = volumeDownColorOverride ?? colorDown;
        for (const { d, i } of visible) {
          const cx = zoomedXScale(i + 0.5);
          const up = d.close >= d.open;
          const barHeight = Math.max(0, volumeHeight - zoomedVolumeScale(d.volume ?? 0));
          ctx.globalAlpha = isEink ? (up ? 0.15 : 0.35) : 0.55;
          ctx.fillStyle = isEink ? colorText : up ? volColorUp : volColorDown;
          ctx.fillRect(cx - candleWidth / 2, volumeHeight - barHeight, candleWidth, barHeight);
        }
        ctx.globalAlpha = 1;
        if (hoverVolumeY !== null) {
          ctx.strokeStyle = colorMuted;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(0, hoverVolumeY);
          ctx.lineTo(dims.boundedWidth, hoverVolumeY);
          ctx.stroke();
        }
        for (const dr of visibleDrawings) {
          if (!((dr.lineType === "horizontal" || dr.lineType === "ray") && dr.valueAxis === "volume")) continue;
          const lineColor = dr.color ?? colorAccent;
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
          ctx.setLineDash(lineDashArray(dr));
          const y = zoomedVolumeScale(dr.y1);
          const x = dr.lineType === "ray" ? zoomedXScale(indexForDate(dr.x1) + 0.5) : 0;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(dims.boundedWidth, y);
          ctx.stroke();
          if (dr.text) {
            ctx.save();
            ctx.font = `${dr.textBold === false ? 400 : 600} ${dr.textSize ?? 11}px ${fontFamily}`;
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = dr.color ?? lineColor;
            ctx.fillText(dr.text, dims.boundedWidth - 4, y - 6);
            ctx.restore();
          }
        }
        ctx.restore();
      }
    }

    // "own"-pane indicators (RSI/CHOP/MACD) — one clipped section each, stacked below volume in
    // the order they were added, each with its own scale (RSI/CHOP are always 0-100 by
    // definition; MACD auto-fits to whatever's currently visible, same spirit as YAutoScaling
    // for price). Same hover crosshair + "+"-to-add badge as price/volume (see
    // hoverIndicatorPaneId/hoverIndicatorPaneY), generalized across however many of these panes
    // exist.
    ownPaneIndicators.forEach((ind, idx) => {
      // volumeHeight is no longer added here — indicatorPaneTops already reserves room for
      // volume's own height wherever it currently falls in the order (see its own memo).
      const paneTop = priceHeight + indicatorPaneTops[idx];
      const paneHeight = indicatorPaneHeights[idx];

      ctx.save();
      ctx.strokeStyle = colorGrid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const dividerY = snapPixel(paneTop);
      ctx.moveTo(0, dividerY);
      ctx.lineTo(dims.boundedWidth, dividerY);
      ctx.stroke();
      ctx.restore();

      if (ind.paneCollapsed) return;

      const entry = visibleIndicators.find((v) => v.indicator.id === ind.id);
      const points = entry?.points ?? [];
      if (points.length === 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, paneTop, dims.boundedWidth, paneHeight);
      ctx.clip();
      ctx.translate(0, paneTop);

      const scale = zoomedOwnPaneScales[ind.id];
      if (!scale) {
        ctx.restore();
        return;
      }

      drawOwnPaneIndicatorSeries(ctx, ind, points, zoomedXScale, candleWidth, dims.boundedWidth, indicators, scale, style);

      if (hoverIndicatorPaneId === ind.id && hoverIndicatorPaneY !== null) {
        ctx.strokeStyle = colorMuted;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, hoverIndicatorPaneY);
        ctx.lineTo(dims.boundedWidth, hoverIndicatorPaneY);
        ctx.stroke();
      }

      // Same "horizontal"/"ray" rendering as the volume section above, scoped to lines anchored
      // to this specific indicator's own pane (valueAxis === its id) instead of "volume" — the
      // one other lineType generalized to work on any pane so far (see TrendLineDrawing.valueAxis).
      for (const dr of visibleDrawings) {
        if (!((dr.lineType === "horizontal" || dr.lineType === "ray") && dr.valueAxis === ind.id)) continue;
        const lineColor = dr.color ?? colorAccent;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
        ctx.setLineDash(lineDashArray(dr));
        const y = scale(dr.y1);
        const x = dr.lineType === "ray" ? zoomedXScale(indexForDate(dr.x1) + 0.5) : 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(dims.boundedWidth, y);
        ctx.stroke();
        if (dr.text) {
          ctx.save();
          ctx.font = `${dr.textBold === false ? 400 : 600} ${dr.textSize ?? 11}px ${fontFamily}`;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = dr.color ?? lineColor;
          ctx.fillText(dr.text, dims.boundedWidth - 4, y - 6);
          ctx.restore();
        }
      }

      ctx.restore();
    });

    // "Vertical" drawn lines span the full plot height (price and volume together), same as the
    // hover crosshair below — deliberately outside either section's clip above.
    for (const dr of visibleDrawings) {
      if (dr.lineType !== "vertical") continue;
      const lineColor = dr.color ?? colorAccent;
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
      ctx.setLineDash(lineDashArray(dr));
      const x = zoomedXScale(indexForDate(dr.x1) + 0.5);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotBoundedHeight);
      ctx.stroke();
      ctx.restore();
      // textHorizontalAlign positions along the line's own length here (top/center/bottom of it,
      // default "right" below to match the old fixed-at-the-bottom behavior since "left"/"center"
      // would otherwise default to the vertical line's own top, a less useful default), and
      // textVerticalAlign offsets to one side of it instead of above/below — same generic anchor
      // logic as every other line type, just rotated 90° along with the line itself.
      drawDrawingText(ctx, dr, x, 0, x, plotBoundedHeight, lineColor, fontFamily);
    }

    // Vertical crosshair spans the full plot (price and volume together) — deliberately drawn
    // outside either section's clip above.
    if (hovered) {
      ctx.save();
      ctx.strokeStyle = colorMuted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const hx = zoomedXScale(hoverIndex! + 0.5);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, plotBoundedHeight);
      ctx.stroke();
      ctx.restore();
    }
}
