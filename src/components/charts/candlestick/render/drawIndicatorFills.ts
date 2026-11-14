import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorFill } from "../interfaces/IndicatorFill.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { mainValue } from "../attachedIndicators";

/** Opacité par défaut d'une zone colorée, en %. */
export const DEFAULT_FILL_OPACITY = 25;

/**
 * Zones colorées d'un indicateur (`Indicator.fills`) : l'espace entre sa courbe et une référence (un niveau fixe, ou le
 * cours de clôture), d'une couleur quand la courbe est au-dessus, d'une autre en dessous. Peint *avant* la courbe, dans
 * le repère déjà translaté et découpé du panneau.
 *
 * Construit morceau par morceau entre deux bougies voisines, coupé au point exact où la courbe croise la référence :
 * chaque couleur est remplie en une seule fois (un seul chemin), si bien que les morceaux voisins ne se superposent pas
 * en bandes plus foncées.
 */
export function drawIndicatorFills(
  ctx: CanvasRenderingContext2D,
  indicator: Indicator,
  points: { i: number; value: IndicatorValue }[],
  xAt: (i: number) => number,
  yAt: (value: number) => number,
  closeAt?: (i: number) => number | undefined,
): void {
  const fills = indicator.fills;
  if (!fills || fills.length === 0 || points.length < 2) return;
  for (const fill of fills) drawOneFill(ctx, fill, points, xAt, yAt, closeAt);
}

function drawOneFill(
  ctx: CanvasRenderingContext2D,
  fill: IndicatorFill,
  points: { i: number; value: IndicatorValue }[],
  xAt: (i: number) => number,
  yAt: (value: number) => number,
  closeAt?: (i: number) => number | undefined,
): void {
  if (!fill.aboveColor && !fill.belowColor) return;
  const refAt = (i: number): number | null => {
    if (fill.reference === "close") {
      const c = closeAt?.(i);
      return c === undefined || !Number.isFinite(c) ? null : c;
    }
    return fill.level ?? 0;
  };
  const above = new Path2D();
  const below = new Path2D();
  let prev: { i: number; x: number; y: number; r: number } | null = null;
  for (const p of points) {
    const v = mainValue(p.value);
    const ref = refAt(p.i);
    if (v === null || ref === null) {
      prev = null;
      continue;
    }
    const cur = { i: p.i, x: xAt(p.i + 0.5), y: yAt(v), r: yAt(ref) };
    if (prev && cur.i - prev.i === 1) addSegment(above, below, prev, cur);
    prev = cur;
  }
  ctx.save();
  ctx.globalAlpha = Math.min(100, Math.max(0, fill.opacity ?? DEFAULT_FILL_OPACITY)) / 100;
  if (fill.aboveColor) {
    ctx.fillStyle = fill.aboveColor;
    ctx.fill(above);
  }
  if (fill.belowColor) {
    ctx.fillStyle = fill.belowColor;
    ctx.fill(below);
  }
  ctx.restore();
}

/** Un morceau entre deux bougies voisines. À l'écran, « au-dessus » veut dire un y plus petit que celui de la référence. */
function addSegment(
  above: Path2D,
  below: Path2D,
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
): void {
  const da = a.r - a.y;
  const db = b.r - b.y;
  const pathOf = (d: number, other: number) => ((d !== 0 ? d : other) >= 0 ? above : below);
  if (da * db >= 0) {
    const path = pathOf(da, db);
    path.moveTo(a.x, a.y);
    path.lineTo(b.x, b.y);
    path.lineTo(b.x, b.r);
    path.lineTo(a.x, a.r);
    path.closePath();
    return;
  }
  // La courbe croise la référence entre les deux bougies : un triangle de chaque côté du croisement.
  const t = da / (da - db);
  const xc = a.x + t * (b.x - a.x);
  const yc = a.y + t * (b.y - a.y);
  const first = da > 0 ? above : below;
  const second = db > 0 ? above : below;
  first.moveTo(a.x, a.y);
  first.lineTo(xc, yc);
  first.lineTo(a.x, a.r);
  first.closePath();
  second.moveTo(xc, yc);
  second.lineTo(b.x, b.y);
  second.lineTo(b.x, b.r);
  second.closePath();
}
