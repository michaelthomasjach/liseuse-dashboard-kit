import * as d3 from "d3";
import type { Candle } from "./interfaces/Candle.interface";
import type { ChartVisibleRange } from "./interfaces/ChartVisibleRange.interface";

/** Pas de repli quand les données ne disent rien de leur propre espacement (une seule bougie, ou
 *  toutes à la même date) : une journée, l'unité la plus courante. */
const FALLBACK_SPACING_MS = 24 * 60 * 60 * 1000;

/** L'écart moyen entre deux bougies sur tout l'historique, en millisecondes : le même pas que
 *  `indexForDate` / `dateForIndex` (useZoomAndScales) utilisent pour prolonger l'axe au-delà des
 *  données, pour qu'une date placée dans le vide du passé ou du futur tombe au même endroit ici et là. */
function averageSpacingMs(data: Candle[]): number {
  if (data.length < 2) return FALLBACK_SPACING_MS;
  const span = data[data.length - 1].date.getTime() - data[0].date.getTime();
  return span > 0 ? span / (data.length - 1) : FALLBACK_SPACING_MS;
}

/** L'instant (ms) qui tombe à une position continue de l'axe X, où la bougie `i` occupe [i, i + 1] et
 *  a son centre en i + 0,5.
 *
 *  Interpolé entre les dates des deux bougies voisines plutôt qu'arrondi à la plus proche : arrondi,
 *  un glisser continu sur un graphique ferait avancer ceux qui le suivent par sauts d'une bougie, ce
 *  qui se lit comme un tremblement. Au-delà de la première ou de la dernière bougie, prolongé au pas
 *  moyen des données. `data` ne doit pas être vide. */
export function timeAtPosition(data: Candle[], position: number): number {
  const n = data.length;
  const centre = position - 0.5;
  if (centre <= 0) return data[0].date.getTime() + centre * averageSpacingMs(data);
  if (centre >= n - 1) return data[n - 1].date.getTime() + (centre - (n - 1)) * averageSpacingMs(data);
  const j = Math.floor(centre);
  const from = data[j].date.getTime();
  const to = data[j + 1].date.getTime();
  return from + (centre - j) * (to - from);
}

/** L'inverse exact de `timeAtPosition` : la position continue, sur l'axe X de CE graphique, de
 *  l'instant `time`. Placée entre les deux bougies de `data` qui l'encadrent, proportionnellement à
 *  leur écart, ce qui cale l'instant sur les bougies de ce graphique-ci quel que soit le pas de celles
 *  du graphique d'où il vient (journalier contre hebdomadaire, jours fériés différents…). `data` ne
 *  doit pas être vide. */
export function positionAtTime(data: Candle[], time: number): number {
  const n = data.length;
  const first = data[0].date.getTime();
  const last = data[n - 1].date.getTime();
  if (time <= first) return 0.5 + (time - first) / averageSpacingMs(data);
  if (time >= last) return n - 0.5 + (time - last) / averageSpacingMs(data);
  // data[j] <= time < data[j + 1] : `right` rend la première bougie strictement après `time`.
  const j = d3.bisector<Candle, number>((d) => d.date.getTime()).right(data, time) - 1;
  const from = data[j].date.getTime();
  const to = data[j + 1].date.getTime();
  return j + 0.5 + (to > from ? (time - from) / (to - from) : 0);
}

/** La plage de dates d'un domaine d'index zoomé (`zoomedXScale.domain()`). `null` sans données. */
export function visibleRangeOfDomain(data: Candle[], domain: [number, number] | number[]): ChartVisibleRange | null {
  if (data.length === 0) return null;
  return { start: new Date(timeAtPosition(data, domain[0])), end: new Date(timeAtPosition(data, domain[1])) };
}

export interface TransformForVisibleRangeArgs {
  data: Candle[];
  range: ChartVisibleRange;
  /** L'échelle X non zoomée du graphique (index → pixels), celle que `transform.rescaleX` reçoit. */
  xScale: d3.ScaleLinear<number, number>;
  width: number;
  /** Le zoom horizontal le plus fort que ce graphique accepte de ses propres gestes. */
  maxZoom: number;
  /** La même contrainte de déplacement que ses propres gestes (vide permis au-delà des données). */
  constrain: (t: d3.ZoomTransform) => d3.ZoomTransform;
}

/** La transformation qui montre `range` sur ce graphique : ses propres bougies les plus proches de ces
 *  dates aux deux bords, dans les limites que ses propres gestes respectent — jamais un état qu'il ne
 *  pourrait pas atteindre seul, pour que le reprendre à la main ensuite ne le fasse pas sauter.
 *
 *  - Plage plus étroite que ce qu'il sait montrer (moins d'une bougie à son pas) : zoom maximal,
 *    centré sur le milieu de la plage.
 *  - Plage plus large que tout son historique (dézoom impossible au-delà) : il montre tout son
 *    historique ; si la plage finit avant la fin de ses données, ou commence après leur début, il
 *    aligne ce bord-là sur celui de la plage plutôt que de se centrer, ce qui couperait par exemple
 *    ses dernières bougies alors que la plage va jusqu'à aujourd'hui.
 *  - Plage hors de ses données : la contrainte de déplacement l'arrête au bord, ses bougies les plus
 *    proches restant à l'écran (au plus la moitié du tracé laissée vide), comme un glisser trop loin.
 *
 *  `null` quand il n'y a rien à calculer (pas de données, pas de largeur, plage vide). */
export function transformForVisibleRange({ data, range, xScale, width, maxZoom, constrain }: TransformForVisibleRangeArgs): d3.ZoomTransform | null {
  if (data.length === 0 || width <= 0) return null;
  const x0 = xScale(positionAtTime(data, range.start.getTime()));
  const x1 = xScale(positionAtTime(data, range.end.getTime()));
  if (!(x1 > x0)) return null;
  const wanted = width / (x1 - x0);
  if (wanted > maxZoom) return constrain(new d3.ZoomTransform(maxZoom, width / 2 - (maxZoom * (x0 + x1)) / 2, 0));
  if (wanted < 1) {
    // À k = 1 le tracé montre [left, left + width] en pixels non zoomés : `left` = 0 (tout
    // l'historique) si la plage le permet, sinon le bord de la plage le plus proche.
    const left = Math.min(Math.max(0, x0), x1 - width);
    return constrain(new d3.ZoomTransform(1, -left, 0));
  }
  return constrain(new d3.ZoomTransform(wanted, -wanted * x0, 0));
}
