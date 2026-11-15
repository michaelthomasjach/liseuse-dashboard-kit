import type { ScaleLinear } from "d3";
import type { Candle } from "../interfaces/Candle.interface";

/**
 * Rendu des bougies au fort dézoom, comme TradingView : sous un certain espace par bougie, le corps, la bordure et
 * les tics des barres ne se distinguent plus et tournent à la bouillie. On passe alors par trois paliers, selon
 * l'espace qu'occupe une bougie en pixels physiques (pixels CSS × devicePixelRatio) :
 *
 * - « normal » : le rendu habituel (corps + mèche + bordure), inchangé ;
 * - « thin » (de 1 à 2 fois le seuil) : corps plein sans bordure et mèche, calés sur la grille de pixels physiques,
 *   pour que la bascule vers les traits ne fasse pas de saut visible ;
 * - « dense » (sous le seuil) : un simple trait vertical du plus bas au plus haut, de la couleur de la bougie, d'un
 *   pixel CSS de large (arrondi à un nombre entier de pixels physiques). Plusieurs bougies qui tombent sur la même
 *   colonne de pixels sont fusionnées (plus bas des plus bas, plus haut des plus hauts, couleur de la dernière) :
 *   un rectangle par colonne au lieu d'un tracé par bougie.
 *
 * Tout est calculé en pixels physiques puis redivisé par le facteur d'échelle du contexte, si bien que chaque bord
 * tombe pile sur un pixel de l'écran : des traits nets, sans anticrénelage baveux.
 */

/** Seuil par défaut de `denseCandleThreshold`, en pixels CSS par bougie. */
export const DEFAULT_DENSE_CANDLE_THRESHOLD = 3;

export type CandleDensity = "normal" | "thin" | "dense";

/** Facteur d'échelle courant du contexte (le devicePixelRatio posé par `renderCandlestickChart`). */
export function contextPixelRatio(ctx: CanvasRenderingContext2D): number {
  const a = typeof ctx.getTransform === "function" ? ctx.getTransform().a : 0;
  return a > 0 ? a : (typeof window !== "undefined" && window.devicePixelRatio) || 1;
}

/** Largeur d'un trait d'un pixel CSS, en pixels physiques entiers (1 à 100 %, 2 sur un écran Retina, 1 à 150 %). */
export function hairlinePx(dpr: number): number {
  return Math.max(1, Math.floor(dpr));
}

/** Le palier de rendu pour l'échelle courante. `threshold` ≤ 0 : toujours le rendu normal. */
export function candleDensity(xScale: ScaleLinear<number, number>, dpr: number, threshold: number | undefined): CandleDensity {
  const t = threshold ?? DEFAULT_DENSE_CANDLE_THRESHOLD;
  if (!(t > 0)) return "normal";
  // Espace d'une bougie en pixels physiques, comparé au seuil exprimé en « traits » : à 100 % et en Retina, cela
  // revient au seuil en pixels CSS ; à 150 %, où le trait reste d'un pixel physique, les bougies gardent leur corps
  // un peu plus loin dans le dézoom puisqu'il y a la place de le dessiner net.
  const slotPhys = Math.abs(xScale(1) - xScale(0)) * dpr;
  const unit = t * hairlinePx(dpr);
  if (slotPhys < unit) return "dense";
  if (slotPhys < unit * 2) return "thin";
  return "normal";
}

interface DenseCandleColors {
  /** Couleur du corps (et du trait au palier « dense »). */
  body: (i: number, d: Candle) => string;
  /** Couleur de la mèche (palier « thin »). */
  wick: (i: number, d: Candle) => string;
}

/** Ajoute un rectangle (en pixels physiques) au groupe de sa couleur. */
function push(groups: Map<string, number[]>, color: string, x: number, y: number, w: number, h: number): void {
  const list = groups.get(color);
  if (list) list.push(x, y, w, h);
  else groups.set(color, [x, y, w, h]);
}

/** Peint les groupes : une couleur, un chemin, un remplissage. */
function fillGroups(ctx: CanvasRenderingContext2D, groups: Map<string, number[]>, dpr: number): void {
  for (const [color, r] of groups) {
    ctx.beginPath();
    for (let k = 0; k < r.length; k += 4) ctx.rect(r[k] / dpr, r[k + 1] / dpr, r[k + 2] / dpr, r[k + 3] / dpr);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/**
 * Bougies (ou barres, Heikin Ashi) aux paliers « thin » et « dense ». `at` : les valeurs OHLC dessinées (Heikin Ashi
 * le cas échéant). Les couleurs conditionnelles passent par `colors`, comme les couleurs hausse/baisse.
 */
export function drawDenseCandles(
  ctx: CanvasRenderingContext2D,
  density: Exclude<CandleDensity, "normal">,
  visible: { d: Candle; i: number }[],
  at: (i: number, d: Candle) => Candle,
  xScale: ScaleLinear<number, number>,
  yScale: ScaleLinear<number, number>,
  colors: DenseCandleColors,
): void {
  const dpr = contextPixelRatio(ctx);
  const lw = hairlinePx(dpr);
  const groups = new Map<string, number[]>();
  const py = (v: number) => Math.round(yScale(v) * dpr);

  if (density === "dense") {
    // Une colonne de `lw` pixels physiques par trait ; les bougies qui y tombent ensemble n'en font qu'un.
    let col = Number.NaN;
    let top = 0;
    let bottom = 0;
    let color = "";
    const flush = () => {
      if (Number.isNaN(col)) return;
      push(groups, color, col * lw, top, lw, Math.max(1, bottom - top));
    };
    for (const { d: raw, i } of visible) {
      const d = at(i, raw);
      if (!d) continue;
      const c = Math.floor((xScale(i + 0.5) * dpr) / lw);
      const hi = py(d.high);
      const lo = py(d.low);
      if (c === col) {
        top = Math.min(top, hi);
        bottom = Math.max(bottom, lo);
        color = colors.body(i, raw);
        continue;
      }
      flush();
      col = c;
      top = hi;
      bottom = lo;
      color = colors.body(i, raw);
    }
    flush();
    fillGroups(ctx, groups, dpr);
    return;
  }

  // Palier « thin » : corps plein sans bordure, d'une largeur entière de pixels physiques, toujours séparé du voisin
  // par au moins un pixel, et mèche centrée dessus (même parité de largeur que le corps).
  const slotPhys = Math.abs(xScale(1) - xScale(0)) * dpr;
  let bodyW = Math.max(lw, Math.min(Math.round(slotPhys * 0.8), Math.floor(slotPhys) - 1));
  if ((bodyW - lw) % 2 !== 0) bodyW = bodyW - 1 >= lw ? bodyW - 1 : bodyW + 1;
  const wickInset = (bodyW - lw) / 2;
  const wicks = new Map<string, number[]>();
  for (const { d: raw, i } of visible) {
    const d = at(i, raw);
    if (!d) continue;
    const left = Math.round(xScale(i + 0.5) * dpr - bodyW / 2);
    const hi = py(d.high);
    const lo = py(d.low);
    push(wicks, colors.wick(i, raw), left + wickInset, hi, lw, Math.max(1, lo - hi));
    const bodyTop = py(Math.max(d.open, d.close));
    const bodyBottom = py(Math.min(d.open, d.close));
    push(groups, colors.body(i, raw), left, bodyTop, bodyW, Math.max(1, bodyBottom - bodyTop));
  }
  fillGroups(ctx, wicks, dpr);
  fillGroups(ctx, groups, dpr);
}

/**
 * Volume au palier « dense » : des colonnes jointives d'un pixel physique au moins, sans espace entre elles (chaque
 * bougie occupe toute sa case, bord à bord), les bougies d'une même colonne fusionnées (volume le plus fort, couleur
 * de la dernière). `barTop(i)` : le haut de la barre en pixels CSS dans le repère du panneau, `bottom` son pied.
 */
export function drawDenseVolume(
  ctx: CanvasRenderingContext2D,
  visible: { d: Candle; i: number }[],
  xScale: ScaleLinear<number, number>,
  barTop: (d: Candle) => number,
  bottom: number,
  styleOf: (up: boolean) => { color: string; alpha: number },
): void {
  const dpr = contextPixelRatio(ctx);
  const cols: { l: number; r: number; top: number; up: boolean }[] = [];
  for (const { d, i } of visible) {
    const l = Math.round(xScale(i) * dpr);
    const r = Math.max(l + 1, Math.round(xScale(i + 1) * dpr));
    const top = barTop(d);
    const up = d.close >= d.open;
    const last = cols[cols.length - 1];
    if (last && l < last.r) {
      last.top = Math.min(last.top, top);
      last.r = Math.max(last.r, r);
      last.up = up;
    } else cols.push({ l, r, top, up });
  }
  for (const up of [true, false]) {
    ctx.beginPath();
    for (const c of cols) {
      if (c.up !== up || c.top >= bottom) continue;
      ctx.rect(c.l / dpr, c.top, (c.r - c.l) / dpr, bottom - c.top);
    }
    const s = styleOf(up);
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = s.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
