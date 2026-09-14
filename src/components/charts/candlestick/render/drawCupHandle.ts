import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { CUP_HANDLE_VERTEX_LABELS } from "../drawingCatalog";

/** "cupHandle" (see TrendLineDrawing.lineType's own doc): the pattern's own 5 vertices (A start of
 *  cup, B bottom of cup, C end of cup / start of handle, D bottom of handle, E end of handle)
 *  drawn as one connected polyline, each point lettered, plus a dashed "rim" reference line at the
 *  cup's own resistance level (the higher of A/C, same idea as Head & Shoulders' own dashed line
 *  at the head's level — see drawHeadShoulders.ts) extended across the whole plot. Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawCupHandleDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate, dims } = params;
  const { colorDown, colorMuted, colorAccent, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "cupHandle" || (dr.extraPoints?.length ?? 0) < 3) continue;
    const [cPoint, dPoint, ePoint] = dr.extraPoints!;
    const toScreen = (p: { x: Date; y: number }) => ({ x: zoomedXScale(indexForDate(p.x) + 0.5), y: zoomedPriceScale(p.y) });
    const points = [{ x: dr.x1, y: dr.y1 }, { x: dr.x2, y: dr.y2 }, cPoint, dPoint, ePoint].map(toScreen);
    const lineColor = dr.color ?? colorAccent;

    // The rim — a plain reference level, not one of the pattern's own stored points (recomputed
    // from A/C every render so it never needs its own drag handling), at whichever of the two is
    // higher (lower price-axis value visually, i.e. the smaller y) so it still reads sensibly even
    // while A/C haven't been dragged to an exactly even height yet.
    const rimY = Math.min(points[0].y, points[2].y);
    ctx.save();
    ctx.strokeStyle = colorMuted;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, rimY);
    ctx.lineTo(dims.boundedWidth, rimY);
    ctx.stroke();
    ctx.restore();

    // The pattern, as two rounded bowls rather than five straight segments.
    //
    // It was a polyline first, and a polyline draws a V — which is the one shape the figure is
    // defined *against*: a cup is an arrondi, and its slowness is part of what makes it a cup
    // rather than a spike. The five points still define it; only the stroke between them changed.
    //
    // Each bowl is one cubic Bézier whose two control points share a height, which puts the curve
    // exactly through the middle vertex at its own midpoint (for a cubic, the point at t = 0.5 is
    // (P₀ + 3P₁ + 3P₂ + P₃) / 8 — so a shared control height of (8·mid − start − end) / 6 lands it
    // on `mid`). The bottom comes out flat, the way a real cup's does.
    const bowl = (from: { x: number; y: number }, mid: { x: number; y: number }, to: { x: number; y: number }) => {
      const span = to.x - from.x;
      const controlY = (8 * mid.y - from.y - to.y) / 6;
      ctx.bezierCurveTo(from.x + span * 0.28, controlY, to.x - span * 0.28, controlY, to.x, to.y);
    };

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    bowl(points[0], points[1], points[2]); // A → B → C, the cup
    bowl(points[2], points[3], points[4]); // C → D → E, the handle
    ctx.stroke();
    ctx.restore();

    // Every vertex lettered (A-E, in the theme's own "down" red — distinct from the pattern's own
    // line color, same convention drawHeadShoulders.ts uses for its own numbers) plus a small
    // persistent dot.
    ctx.save();
    ctx.font = `700 10px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = colorDown;
    points.forEach((p, i) => ctx.fillText(CUP_HANDLE_VERTEX_LABELS[i] ?? "", p.x, p.y - 8));
    ctx.restore();

    ctx.beginPath();
    ctx.fillStyle = lineColor;
    for (const p of points) {
      ctx.moveTo(p.x + 3, p.y);
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
