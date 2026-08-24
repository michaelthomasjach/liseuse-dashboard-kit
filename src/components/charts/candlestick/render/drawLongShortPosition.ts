import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { drawPillLabel } from "../drawingRender";

/** "longPosition"/"shortPosition" (see TrendLineDrawing.lineType's own doc): a risk/reward box —
 *  x1/y1 the entry, x2/y2 the profit target, extraPoints[0] the stop, each zone spanning from
 *  entry to that point's own date independently of the other (unlike rangeForecast's shared
 *  "direction" date, target and stop here can each be dragged to a different width). Target's
 *  zone always fills the theme's "up" color, stop's always "down" — a fixed role, not recomputed
 *  from which price is actually higher, since dragging a point past entry by hand doesn't change
 *  what it *means*, only where it currently sits. Boundary lines (entry, target, stop) all draw in
 *  the drawing's own color, same "fill carries the semantic color, strokes stay neutral"
 *  convention the "zones" tool already uses. Every level is labeled with its own price and %
 *  change from entry, entry additionally with the computed reward:risk ratio. */
export function drawLongShortPositionDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorUp, colorDown, colorAccent, colorBg, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if ((dr.lineType !== "longPosition" && dr.lineType !== "shortPosition") || !dr.extraPoints?.length) continue;
    const stop = dr.extraPoints[0];
    const entryX = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const entryY = zoomedPriceScale(dr.y1);
    const targetX = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const targetY = zoomedPriceScale(dr.y2);
    const stopX = zoomedXScale(indexForDate(stop.x) + 0.5);
    const stopY = zoomedPriceScale(stop.y);
    const lineColor = dr.color ?? colorAccent;

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = colorUp;
    ctx.fillRect(Math.min(entryX, targetX), Math.min(entryY, targetY), Math.abs(targetX - entryX), Math.abs(entryY - targetY));
    ctx.fillStyle = colorDown;
    ctx.fillRect(Math.min(entryX, stopX), Math.min(entryY, stopY), Math.abs(stopX - entryX), Math.abs(entryY - stopY));
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(entryX, entryY);
    ctx.lineTo(Math.max(targetX, stopX), entryY);
    ctx.moveTo(Math.min(entryX, targetX), targetY);
    ctx.lineTo(Math.max(entryX, targetX), targetY);
    ctx.moveTo(Math.min(entryX, stopX), stopY);
    ctx.lineTo(Math.max(entryX, stopX), stopY);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = lineColor;
    ctx.arc(entryX, entryY, 3, 0, Math.PI * 2);
    ctx.fill();

    const fmt = (v: number) => v.toFixed(2);
    const pctOf = (y: number) => (dr.y1 !== 0 ? ((y - dr.y1) / dr.y1) * 100 : 0);
    const signed = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
    const rewardPct = pctOf(dr.y2);
    const riskPct = pctOf(stop.y);
    const rr = riskPct !== 0 ? Math.abs(rewardPct / riskPct) : 0;

    drawPillLabel(ctx, entryX, entryY, `Entrée ${fmt(dr.y1)} · R:R ${rr.toFixed(2)}`, lineColor, colorBg, fontFamily, "left");
    drawPillLabel(ctx, targetX, targetY, `Objectif ${signed(rewardPct)} ${fmt(dr.y2)}`, colorUp, colorBg, fontFamily, "right");
    drawPillLabel(ctx, stopX, stopY, `Stop ${signed(riskPct)} ${fmt(stop.y)}`, colorDown, colorBg, fontFamily, "right");
  }
}
