import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { pitchforkLines } from "../pitchforkGeometry";
import type { PitchforkVariant } from "../pitchforkGeometry";
import { lineDashArray, drawDrawingText } from "../drawingRender";

const PITCHFORK_TYPES = new Set(["pitchfork", "schiffPitchfork", "modifiedSchiffPitchfork", "insidePitchfork"]);

/** The 4 pitchfork variants (see pitchforkGeometry.ts) — 3 points (P0/P1/P2, x1/y1-x2/y2-
 *  extraPoints[0]) resolved into 4 on-screen lines via `pitchforkLines`: the B–C spine and the
 *  two tines (solid, sharing the drawing's own `lineStyle`), plus the median drawn dashed to
 *  stand out from them (matching the icons' own convention — see PitchforkIcon and its variants)
 *  regardless of that same `lineStyle`. Called from `drawPriceDrawings` while its own price-
 *  section clip is still open, same as every other price-space drawing type. */
export function drawPitchforkDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate, dims } = params;
  const { colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (!PITCHFORK_TYPES.has(dr.lineType ?? "") || !dr.extraPoints?.length) continue;
    const p0 = { x: zoomedXScale(indexForDate(dr.x1) + 0.5), y: zoomedPriceScale(dr.y1) };
    const p1 = { x: zoomedXScale(indexForDate(dr.x2) + 0.5), y: zoomedPriceScale(dr.y2) };
    const p2Point = dr.extraPoints[0];
    const p2 = { x: zoomedXScale(indexForDate(p2Point.x) + 0.5), y: zoomedPriceScale(p2Point.y) };
    const lineColor = dr.color ?? colorAccent;
    const { spine, median, tine1, tine2 } = pitchforkLines(p0, p1, p2, dr.lineType as PitchforkVariant, 0, dims.boundedWidth);

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);

    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(median.x1, median.y1);
    ctx.lineTo(median.x2, median.y2);
    ctx.stroke();

    ctx.setLineDash(lineDashArray(dr));
    for (const line of [spine, tine1, tine2]) {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = lineColor;
    for (const p of [p0, p1, p2]) {
      ctx.moveTo(p.x + 2.5, p.y);
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    }
    ctx.fill();

    // "A"/"B"/"C" next to each of the 3 points (P0/P1/P2, the same click order every variant
    // shares — see pitchforkGeometry.ts) — matches the standard Andrews' Pitchfork reference
    // diagrams this tool is modeled on, where the handle/width-pair points are always labeled
    // that way. Offset up-right of each dot so the label reads clear of both the marker itself
    // and whichever line passes closest through it.
    ctx.save();
    ctx.font = `700 11px ${fontFamily}`;
    ctx.fillStyle = lineColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (const [label, p] of [
      ["A", p0],
      ["B", p1],
      ["C", p2],
    ] as const) {
      ctx.fillText(label, p.x + 6, p.y - 6);
    }
    ctx.restore();

    drawDrawingText(ctx, dr, p0.x, p0.y, p1.x, p1.y, lineColor, fontFamily);
  }
}
