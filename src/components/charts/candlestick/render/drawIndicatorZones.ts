import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ChartCanvasStyle } from "../interfaces/ChartCanvasStyle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import { defaultIndicatorColor } from "../indicatorCatalog";

const HOUR_MS = 3_600_000;

/** Une date d'une zone, `Date` ou chaîne (une liste d'indicateurs relue d'un JSON enregistré n'a plus de `Date`). */
function toTime(d: Date | string | number | undefined): number | null {
  if (d === undefined || d === null) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Couleur d'un indicateur de zones : la sienne, sinon celle de sa définition, sinon celle de sa place dans la liste. */
export function zoneIndicatorColor(indicator: Indicator, index: number): string {
  return indicator.color ?? indicator.customData?.color ?? defaultIndicatorColor(index);
}

/** Indicateurs `customData.draw: "zones"` (voir `CustomIndicatorZone`) : une bande verticale par zone sur toute la
 *  hauteur du graphique des prix, sous les bougies, bordée en pointillé, avec son libellé en haut et son repère vertical
 *  (ligne tiretée et libellé). Une zone dans le futur se place dans l'espace vide à droite de la dernière bougie, à
 *  l'écartement moyen des bougies, comme un dessin. Appelé dans la découpe du graphique des prix. */
export function drawIndicatorZones(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, style: ChartCanvasStyle): void {
  const { indicators, zoomedXScale, indexForDate, priceHeight, dims } = params;
  const zoneIndicators = indicators.filter((ind) => ind.customData?.draw === "zones" && !ind.hidden && (ind.customData.zones?.length ?? 0) > 0);
  if (zoneIndicators.length === 0) return;
  const xOf = (t: number) => zoomedXScale(indexForDate(new Date(t)) + 0.5);
  for (const indicator of zoneIndicators) {
    const color = zoneIndicatorColor(indicator, indicators.indexOf(indicator));
    const opacity = Math.min(100, Math.max(0, indicator.zoneOpacity ?? 12)) / 100;
    const showLabels = indicator.zoneShowLabels ?? true;
    const showMarkers = indicator.zoneShowMarkers ?? true;
    const padBefore = (indicator.zonePadBeforeHours ?? 0) * HOUR_MS;
    const padAfter = (indicator.zonePadAfterHours ?? 0) * HOUR_MS;
    for (const zone of indicator.customData?.zones ?? []) {
      const from = toTime(zone.from);
      const to = toTime(zone.to);
      if (from === null || to === null) continue;
      const start = Math.min(from, to) - padBefore;
      const end = Math.max(from, to) + padAfter;
      if (end <= start) continue;
      const x1 = xOf(start);
      const x2 = xOf(end);
      if (x2 < 0 || x1 > dims.boundedWidth) continue;
      const left = Math.min(x1, x2);
      const width = Math.max(1, Math.abs(x2 - x1));
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.fillRect(left, 0, width, priceHeight);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(Math.round(left) + 0.5, 0.5, Math.max(1, Math.round(width) - 1), priceHeight - 1);
      ctx.setLineDash([]);
      ctx.font = `600 11px ${style.fontFamily}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = color;
      let labelY = 6;
      if (showLabels && zone.label) {
        ctx.fillText(zone.label, left + 5, labelY);
        labelY += 16;
      }
      const markerTime = toTime(zone.marker?.date);
      if (showMarkers && zone.marker && markerTime !== null) {
        const mx = Math.round(xOf(markerTime)) + 0.5;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx, priceHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        if (zone.marker.label) ctx.fillText(zone.marker.label, mx + 5, labelY);
      }
      ctx.restore();
    }
  }
}
