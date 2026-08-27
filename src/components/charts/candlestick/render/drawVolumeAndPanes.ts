import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { IndicatorMACD } from "../interfaces/IndicatorMACD.interface";
import type { IndicatorADXPoint } from "../interfaces/IndicatorADXPoint.interface";
import { snapPixel } from "../drawingGeometry";
import { lineDashArray, drawDrawingText } from "../drawingRender";
import { defaultIndicatorColor, isFundamentalKind } from "../indicatorCatalog";

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


    if (volumeVisible) {
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

      const color = ind.color ?? defaultIndicatorColor(indicators.indexOf(ind));
      const scale = zoomedOwnPaneScales[ind.id];
      if (!scale) {
        ctx.restore();
        return;
      }

      if (ind.kind === "rsi" || ind.kind === "chop") {
        // Reference levels are user-adjustable (rsiOverbought/rsiOversold, chopUpperThreshold/
        // chopLowerThreshold — see their own docs on Indicator) but default to exactly the
        // levels this block always drew before those settings existed.
        const levels =
          ind.kind === "rsi" ? [ind.rsiOversold ?? 30, ind.rsiOverbought ?? 70] : [ind.chopLowerThreshold ?? 38.2, ind.chopUpperThreshold ?? 61.8];
        ctx.save();
        ctx.strokeStyle = colorGrid;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        for (const level of levels) {
          const y = scale(level);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(dims.boundedWidth, y);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        points.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value as number);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else if (ind.kind === "correlation") {
        // Zero line unconditionally (same role MACD's own zero line plays just below), plus the
        // user-adjustable "strongly correlated" reference pair (correlationStrongThreshold — see
        // its own doc on Indicator) at +/- that value.
        ctx.save();
        ctx.strokeStyle = colorGrid;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        const threshold = ind.correlationStrongThreshold ?? 0.7;
        for (const level of [0, threshold, -threshold]) {
          const y = scale(level);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(dims.boundedWidth, y);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        points.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value as number);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else if (ind.kind === "macd") {
        const macdPoints = points as { i: number; value: IndicatorMACD }[];
        const zeroY = scale(0);

        ctx.save();
        ctx.strokeStyle = colorGrid;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, zeroY);
        ctx.lineTo(dims.boundedWidth, zeroY);
        ctx.stroke();
        ctx.restore();

        if (ind.macdShowHistogram !== false) {
          const histUpColor = ind.macdHistogramUpColor ?? colorUp;
          const histDownColor = ind.macdHistogramDownColor ?? colorDown;
          for (const p of macdPoints) {
            if (p.value.histogram === null) continue;
            const x = zoomedXScale(p.i + 0.5);
            const y = scale(p.value.histogram);
            const up = p.value.histogram >= 0;
            ctx.globalAlpha = isEink ? (up ? 0.25 : 0.45) : 0.6;
            ctx.fillStyle = isEink ? colorText : up ? histUpColor : histDownColor;
            ctx.fillRect(x - candleWidth / 2, Math.min(y, zeroY), Math.max(candleWidth, 1), Math.abs(y - zeroY));
          }
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        macdPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value.macd);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.strokeStyle = colorMuted;
        ctx.lineWidth = 1;
        ctx.beginPath();
        let started = false;
        for (const p of macdPoints) {
          if (p.value.signal === null) continue;
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value.signal);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      } else if (ind.kind === "adx") {
        // Three independent lines sharing this pane's own fixed 0-100 scale (see
        // useIndicatorPaneScales) — the ADX line itself in this indicator's own configurable
        // color (the "how strong" reading), +DI/-DI in their own configurable colors (the "which
        // direction" reading), defaulting to the chart's own up/down colors, same "leaving both
        // unset reproduces the exact prior behavior" convention as Supertrend/Parabolic SAR/
        // Chandelier Exit's own directional-color pairs — plus the user-adjustable "strong trend"
        // reference level (adxThreshold — see its own doc on Indicator).
        ctx.save();
        ctx.strokeStyle = colorGrid;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        const thresholdY = scale(ind.adxThreshold ?? 25);
        ctx.beginPath();
        ctx.moveTo(0, thresholdY);
        ctx.lineTo(dims.boundedWidth, thresholdY);
        ctx.stroke();
        ctx.restore();

        const adxPoints = points as { i: number; value: IndicatorADXPoint }[];
        const strokeField = (get: (v: IndicatorADXPoint) => number, lineColor: string, lineWidth: number) => {
          ctx.save();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash([]);
          ctx.beginPath();
          adxPoints.forEach((p, k) => {
            const x = zoomedXScale(p.i + 0.5);
            const y = scale(get(p.value));
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.restore();
        };
        strokeField((v) => v.plusDI, ind.adxPlusColor ?? colorUp, 1);
        strokeField((v) => v.minusDI, ind.adxMinusColor ?? colorDown, 1);
        strokeField((v) => v.adx, color, 1.5);
      } else if (ind.customData?.draw === "histogram") {
        // Same zero-baseline bar shape as MACD's own histogram above, just against this pane's
        // own auto-fit scale instead of MACD's fixed one — `scale(0)` still works as a baseline
        // even when the visible values never actually cross zero (e.g. a metric that's always
        // positive), since it just lands outside the pane's own clipped area rather than at some
        // meaningless position.
        const numericPoints = points as { i: number; value: number }[];
        const zeroY = scale(0);
        ctx.globalAlpha = isEink ? 0.35 : 0.6;
        ctx.fillStyle = isEink ? colorText : color;
        for (const p of numericPoints) {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value);
          ctx.fillRect(x - candleWidth / 2, Math.min(y, zeroY), Math.max(candleWidth, 1), Math.abs(y - zeroY));
        }
        ctx.globalAlpha = 1;
      } else if (ind.customData?.draw === "area") {
        const numericPoints = points as { i: number; value: number }[];
        const zeroY = scale(0);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.beginPath();
        numericPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          if (k === 0) ctx.moveTo(x, zeroY);
          ctx.lineTo(x, scale(p.value));
        });
        ctx.lineTo(zoomedXScale(numericPoints[numericPoints.length - 1].i + 0.5), zeroY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        numericPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else {
        // Fundamental indicators (Free Cash Flow, Net Income, P/E…) and a custom "line"-draw one:
        // no fixed reference levels either way — unlike RSI/CHOP there's no universal
        // "overbought/oversold"-style threshold that would mean anything across arbitrary
        // metrics/companies. A fundamental's own `fundamentalChartStyle` (see its doc on
        // Indicator) picks "step"/"area" instead of the default plain diagonal line — a custom
        // indicator has no such setting and always gets the plain line.
        const numericPoints = points as { i: number; value: number }[];
        const style = isFundamentalKind(ind.kind) ? (ind.fundamentalChartStyle ?? "line") : "line";

        if (style === "area") {
          const zeroY = scale(0);
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = color;
          ctx.beginPath();
          numericPoints.forEach((p, k) => {
            const x = zoomedXScale(p.i + 0.5);
            if (k === 0) ctx.moveTo(x, zeroY);
            ctx.lineTo(x, scale(p.value));
          });
          ctx.lineTo(zoomedXScale(numericPoints[numericPoints.length - 1].i + 0.5), zeroY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        numericPoints.forEach((p, k) => {
          const x = zoomedXScale(p.i + 0.5);
          const y = scale(p.value);
          if (k === 0) ctx.moveTo(x, y);
          else if (style === "step") {
            // A flat hold at the previous value's own height, then a vertical jump to this one —
            // the step function the underlying data (forward-filled between report dates) already
            // literally is, rather than "line"'s diagonal interpolation implying a gradual change
            // that didn't really happen.
            const prevY = scale(numericPoints[k - 1].value);
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }

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
