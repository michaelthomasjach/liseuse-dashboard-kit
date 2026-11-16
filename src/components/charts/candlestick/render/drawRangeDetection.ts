import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorRangeDetectionPoint, IndicatorRangeZone } from "../interfaces/IndicatorRangeDetectionPoint.interface";
import { RANGE_DETECTION_DEFAULTS, rangeStateLabel } from "../rangeDetection";
import { drawPriceBoxes, type PriceBox } from "./drawPriceBoxes";

/** Libellé d'une zone : son état, et pour la zone en cours le score de la dernière bougie (ou la cassure qui l'a close). */
function zoneLabel(zone: IndicatorRangeZone, last: IndicatorRangeDetectionPoint | undefined): string {
  const base = rangeStateLabel(zone.confirmed ? "confirmed" : "probable");
  if (zone.active) return `${base} · en cours${last ? ` · ${last.rangeScore} %` : ""}`;
  if (zone.breakout === "up") return `${base} · cassure ↑`;
  if (zone.breakout === "down") return `${base} · cassure ↓`;
  return base;
}

/** « Détection de range (précoce) » : un rectangle par zone de range visible — tirets et couleur « probable » tant que la
 *  zone n'a pas été confirmée, trait plein et couleur « confirmé » ensuite —, du début de la détection à la dernière
 *  bougie de la zone (la bougie courante pour une zone en cours), entre son plus haut et son plus bas. */
export function drawRangeDetection(
  ctx: CanvasRenderingContext2D,
  points: { i: number; value: IndicatorRangeDetectionPoint }[],
  indicator: Indicator,
  params: RenderCandlestickChartParams,
  style: ChartCanvasStyle,
) {
  const d = RANGE_DETECTION_DEFAULTS;
  const showProbable = indicator.rangeShowProbable ?? d.showProbable;
  const showLabels = indicator.rangeShowLabels ?? d.showLabels;
  const midline = indicator.rangeShowMidline ?? d.showMidline;
  const opacity = Math.min(100, Math.max(0, indicator.rangeOpacity ?? d.opacity)) / 100;
  const probableColor = indicator.rangeProbableColor ?? d.probableColor;
  const confirmedColor = indicator.color ?? d.confirmedColor;
  const seen = new Set<number>();
  const boxes: PriceBox[] = [];
  const last = points[points.length - 1]?.value;
  for (const { value } of points) {
    const zone = value.zone;
    if (!zone || seen.has(zone.start)) continue;
    seen.add(zone.start);
    if (!zone.confirmed && !showProbable) continue;
    boxes.push({
      fromIndex: zone.start,
      toIndex: zone.end,
      top: zone.high,
      bottom: zone.low,
      color: zone.confirmed ? confirmedColor : probableColor,
      fillOpacity: opacity,
      dashed: !zone.confirmed,
      midline,
      ...(showLabels ? { label: zoneLabel(zone, zone.active ? last : undefined) } : {}),
    });
  }
  drawPriceBoxes(ctx, boxes, params, style);
}
