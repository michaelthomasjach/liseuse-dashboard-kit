import { rectangleXs } from "./drawingFills";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";
import { allPointsOf, effectiveExtendOf, extendSegmentToEdges, forecastCurvePoints } from "./drawingGeometry";
import { distanceToDrawing, type HitTestContext } from "./drawingHitTest";
import { DRAWING_HIT_DISTANCE } from "./constants";

/** Le rectangle de sélection (Ctrl + glisser), en pixels du graphique, bornes incluses. */
export interface SelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Le rectangle tracé entre deux coins quelconques. */
export function selectionRectBetween(ax: number, ay: number, bx: number, by: number): SelectionRect {
  return { left: Math.min(ax, bx), top: Math.min(ay, by), right: Math.max(ax, bx), bottom: Math.max(ay, by) };
}

function pointIn(r: SelectionRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** Un segment traverse-t-il le rectangle (ou y est-il contenu) ? Découpage de Liang-Barsky. */
export function segmentTouchesRect(r: SelectionRect, x1: number, y1: number, x2: number, y2: number): boolean {
  if (pointIn(r, x1, y1) || pointIn(r, x2, y2)) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, x1 - r.left) && clip(dx, r.right - x1) && clip(-dy, y1 - r.top) && clip(dy, r.bottom - y1) && t0 <= t1;
}

function boxesOverlap(r: SelectionRect, left: number, top: number, right: number, bottom: number): boolean {
  return left <= r.right && right >= r.left && top <= r.bottom && bottom >= r.top;
}

function polylineTouchesRect(r: SelectionRect, pts: { x: number; y: number }[]): boolean {
  if (pts.some((p) => pointIn(r, p.x, p.y))) return true;
  for (let i = 1; i < pts.length; i++) {
    if (segmentTouchesRect(r, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)) return true;
  }
  return false;
}

/** Types tracés comme une boîte (cadre, tableau, niveaux, position…) : touchés dès que leur boîte chevauche le
 *  rectangle de sélection, qu'il l'englobe, la coupe ou y soit contenu. */
const BOX_LINE_TYPES = new Set(["rectangle", "table", "fibonacci", "longPosition", "shortPosition", "rangeForecast", "fibonacciExtension"]);

/** Vrai quand le rectangle de sélection touche ou englobe le dessin : au moins un de ses points ou un morceau de ses
 *  segments est dedans. Une ligne horizontale est touchée dès que sa hauteur est dans le rectangle, une verticale dès
 *  que sa date y est. Les étiquettes et marqueurs plus grands que leur point d'ancrage sont rattrapés par le test de
 *  survol habituel (distanceToDrawing) aux coins et au centre du rectangle. */
export function drawingTouchesRect(dr: TrendLineDrawing, r: SelectionRect, ctx: HitTestContext): boolean {
  const { dims, priceHeight, zoomedXScale, zoomedPriceScale, indexForDate, pixelYForDrawing } = ctx;
  const px = (d: Date) => zoomedXScale(indexForDate(d) + 0.5);
  if (dr.lineType === "horizontal") {
    const y = pixelYForDrawing(dr);
    return y >= r.top && y <= r.bottom;
  }
  if (dr.lineType === "vertical") {
    const x = px(dr.x1);
    return x >= r.left && x <= r.right;
  }
  if (dr.lineType === "ray") {
    const y = pixelYForDrawing(dr);
    return y >= r.top && y <= r.bottom && px(dr.x1) <= r.right;
  }
  if (dr.lineType === "zones") {
    const a = px(dr.x1);
    const b = px(dr.x2);
    return boxesOverlap(r, Math.min(a, b), 0, Math.max(a, b), priceHeight);
  }
  const pts = allPointsOf(dr).map((p) => ({ x: px(p.x), y: zoomedPriceScale(p.y) }));
  if (BOX_LINE_TYPES.has(dr.lineType ?? "")) {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    let [left, right] = [Math.min(...xs), Math.max(...xs)];
    if (dr.lineType === "rectangle") [left, right] = rectangleXs(pts[0].x, pts[1].x, dr.extend, dims.boundedWidth);
    if (boxesOverlap(r, left, Math.min(...ys), right, Math.max(...ys))) return true;
  } else if (dr.lineType === "forecast") {
    if (polylineTouchesRect(r, forecastCurvePoints(pts[0].x, pts[0].y, pts[1].x, pts[1].y))) return true;
  } else {
    if (polylineTouchesRect(r, pts)) return true;
    // Une ligne prolongée (bord gauche, droit ou les deux) : la partie prolongée compte aussi.
    const extend = effectiveExtendOf(dr);
    if (pts.length === 2 && extend !== "none") {
      const e = extendSegmentToEdges(pts[0].x, pts[0].y, pts[1].x, pts[1].y, 0, dims.boundedWidth, extend);
      if (segmentTouchesRect(r, e.x1, e.y1, e.x2, e.y2)) return true;
    }
    // Le canal : sa seconde ligne, décalée de channelOffset.
    if (dr.lineType === "channel" && pts.length >= 2) {
      const off = zoomedPriceScale(dr.y1 + (dr.channelOffset ?? 0)) - zoomedPriceScale(dr.y1);
      if (segmentTouchesRect(r, pts[0].x, pts[0].y + off, pts[1].x, pts[1].y + off)) return true;
    }
  }
  const probes: [number, number][] = [
    [r.left, r.top],
    [r.right, r.top],
    [r.left, r.bottom],
    [r.right, r.bottom],
    [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
  ];
  return probes.some(([x, y]) => distanceToDrawing(dr, x, y, ctx) <= DRAWING_HIT_DISTANCE);
}
