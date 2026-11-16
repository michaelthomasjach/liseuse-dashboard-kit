import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";

/** Un rectangle tracé par un indicateur sur le graphique des prix : de la bougie `fromIndex` à la bougie `toIndex`
 *  (indices fractionnaires : -0,5 = bord gauche de la bougie, `toIndex` exclusif comme une fin de zone), entre deux
 *  prix. Le tracé générique des indicateurs qui dessinent des zones de prix (« Détection de range », indicateurs
 *  `CustomIndicatorDef.draw: "boxes"` d'une application). */
export interface PriceBox {
  fromIndex: number;
  toIndex: number;
  top: number;
  bottom: number;
  color: string;
  /** Opacité du fond, 0 à 1. */
  fillOpacity: number;
  /** Bordure en tirets (zone encore incertaine) plutôt qu'en trait plein. */
  dashed?: boolean;
  /** Écrit en haut à gauche, dans le rectangle. */
  label?: string;
  /** Ligne pointillée au milieu du rectangle. */
  midline?: boolean;
}

/** Trace des `PriceBox` sur la zone des prix (déjà découpée par l'appelant) : fond translucide, bordure, ligne médiane
 *  et libellé. Un rectangle hors de la vue est sauté. */
export function drawPriceBoxes(ctx: CanvasRenderingContext2D, boxes: PriceBox[], params: RenderCandlestickChartParams, style: ChartCanvasStyle): void {
  const { zoomedXScale, zoomedPriceScale, dims } = params;
  for (const box of boxes) {
    if (!Number.isFinite(box.top) || !Number.isFinite(box.bottom)) continue;
    const x0 = zoomedXScale(box.fromIndex - 0.5);
    const x1 = zoomedXScale(box.toIndex - 0.5);
    if (x1 < 0 || x0 > dims.boundedWidth) continue;
    const yTop = zoomedPriceScale(Math.max(box.top, box.bottom));
    const yBottom = zoomedPriceScale(Math.min(box.top, box.bottom));
    const left = Math.min(x0, x1);
    const width = Math.max(1, Math.abs(x1 - x0));
    const top = Math.min(yTop, yBottom);
    const height = Math.max(1, Math.abs(yBottom - yTop));
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, box.fillOpacity));
    ctx.fillStyle = box.color;
    ctx.fillRect(left, top, width, height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = box.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(box.dashed ? [5, 4] : []);
    ctx.strokeRect(Math.round(left) + 0.5, Math.round(top) + 0.5, Math.max(1, Math.round(width) - 1), Math.max(1, Math.round(height) - 1));
    if (box.midline) {
      const ym = Math.round(top + height / 2) + 0.5;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(left, ym);
      ctx.lineTo(left + width, ym);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (box.label && width > 30) {
      ctx.font = `600 11px ${style.fontFamily}`;
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillStyle = box.color;
      // Au-dessus du rectangle s'il y a la place, sinon juste dedans.
      const y = top > 14 ? top - 3 : top + 14;
      ctx.fillText(box.label, Math.max(left, 0) + 4, y);
    }
    ctx.restore();
  }
}
