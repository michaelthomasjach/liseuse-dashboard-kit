import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { TABLE_DEFAULT_ROWS, TABLE_DEFAULT_COLS } from "../constants";
import { tableCellRect } from "../drawingGeometry";

const CELL_TEXT_PAD = 6;

/** "table" (see TrendLineDrawing.lineType's own doc): a stroked box like "rectangle", with a
 *  faint fill of its own `color`, subdivided by `tableRows`/`tableCols` even grid lines — each
 *  cell's own text (`tableCells[row * tableCols + col]`, see tableCellRect for the shared layout
 *  math) clipped to that one cell so a long value never spills into its neighbors. Called from
 *  `drawPriceDrawings` while its own price-section clip is still open, same as every other
 *  price-space drawing type. */
export function drawTableDrawings(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { visibleDrawings, hoveredDrawingId, zoomedXScale, zoomedPriceScale, indexForDate } = params;
  const { colorAccent, colorText, fontFamily } = style;
  for (const dr of visibleDrawings) {
    if (dr.lineType !== "table") continue;
    const rows = dr.tableRows ?? TABLE_DEFAULT_ROWS;
    const cols = dr.tableCols ?? TABLE_DEFAULT_COLS;
    const x1 = zoomedXScale(indexForDate(dr.x1) + 0.5);
    const y1 = zoomedPriceScale(dr.y1);
    const x2 = zoomedXScale(indexForDate(dr.x2) + 0.5);
    const y2 = zoomedPriceScale(dr.y2);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const lineColor = dr.color ?? colorAccent;

    ctx.save();
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(left, top, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (dr.strokeWidth ?? 1.5) + (hoveredDrawingId === dr.id ? 1 : 0);
    ctx.setLineDash([]);
    ctx.strokeRect(left, top, w, h);
    ctx.beginPath();
    for (let c = 1; c < cols; c++) {
      const x = left + (w / cols) * c;
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h);
    }
    for (let r = 1; r < rows; r++) {
      const y = top + (h / rows) * r;
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
    }
    ctx.stroke();
    ctx.restore();

    const cells = dr.tableCells ?? [];
    if (cells.length > 0) {
      ctx.save();
      ctx.font = `400 11px ${fontFamily}`;
      ctx.fillStyle = dr.textColor ?? colorText;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (let i = 0; i < rows * cols; i++) {
        const text = cells[i];
        if (!text) continue;
        const rect = tableCellRect(x1, y1, x2, y2, rows, cols, i);
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.clip();
        ctx.fillText(text, rect.x + CELL_TEXT_PAD, rect.y + rect.h / 2);
        ctx.restore();
      }
      ctx.restore();
    }
  }
}
