import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import { defaultIndicatorColor, indicatorCatalogEntry } from "../indicatorCatalog";
import { mainValue } from "../attachedIndicators";

/** Écart visé entre deux cercles, en pixels : assez pour lire la ligne entre eux, assez serré pour la suivre. */
const SPACING_PX = 56;
const RADIUS = 3.5;

/**
 * L'indicateur sélectionné (un clic sur sa ligne) : des cercles creux à intervalle régulier le long de sa ligne
 * principale, à la manière des poignées d'un dessin sélectionné — on voit lequel est choisi, et que le prochain réglage
 * (Suppr, couleur…) s'applique à lui. Sur les prix, dans son panneau, ou dans le panneau où il est posé.
 */
export function drawSelectedIndicatorMarkers(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle) {
  const { selectedIndicatorId, visibleIndicators, indicators, zoomedXScale, zoomedPriceScale, priceHeight, ownPaneIndicators, indicatorPaneTops, zoomedOwnPaneScales, dims } = params;
  if (!selectedIndicatorId) return;
  const entry = visibleIndicators.find((v) => v.indicator.id === selectedIndicatorId);
  if (!entry || entry.indicator.hidden || entry.points.length === 0) return;
  const ind = entry.indicator;

  // L'échelle et le décalage vertical de l'endroit où la ligne est dessinée.
  const pane = indicatorCatalogEntry(ind).pane;
  const paneId = pane === "own" ? ind.id : pane === "attached" ? ind.sourceId : undefined;
  let scale = zoomedPriceScale;
  let offset = 0;
  let clipTop = 0;
  let clipHeight = priceHeight;
  if (paneId !== undefined) {
    const idx = ownPaneIndicators.findIndex((p) => p.id === paneId);
    const paneScale = zoomedOwnPaneScales[paneId];
    if (idx < 0 || !paneScale || ownPaneIndicators[idx]?.paneCollapsed) return;
    scale = paneScale;
    offset = priceHeight + (indicatorPaneTops[idx] ?? 0);
    clipTop = offset;
    clipHeight = (params.indicatorPaneHeights[idx] ?? 0);
  }

  const step = Math.max(1, Math.round(SPACING_PX / Math.max(1, zoomedXScale(1) - zoomedXScale(0))));
  const color = ind.color ?? defaultIndicatorColor(indicators.indexOf(ind));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipTop, dims.boundedWidth, clipHeight);
  ctx.clip();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = style.colorBg;
  for (const p of entry.points) {
    if (p.i % step !== 0) continue;
    const v = mainValue(p.value);
    if (v === null) continue;
    const x = zoomedXScale(p.i + 0.5);
    const y = offset + scale(v);
    ctx.beginPath();
    ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
