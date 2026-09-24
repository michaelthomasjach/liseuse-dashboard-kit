import { plotInside, type PlotLayout } from "./plot";
import { semiTruckGeometry } from "./SemiTruck";
import { CONTAINER_DIMENSIONS } from "./ShippingContainer";

/**
 * Ce qu'on pose sur le plan de l'entrepôt, et la géométrie qui va avec — sans rien dessiner.
 *
 * ## Deux familles
 *
 * - Les éléments **linéaires** — murs, murs de quai, clôtures, tapis, racks à palettes — sont un
 *   **segment** du point `(x0, y0)` au point `(x1, y1)`. C'est ce qui permet de les étirer : on
 *   attrape un bout et on le tire. Leur longueur est celle du segment, leur cap sa direction.
 * - Les éléments **ponctuels** — un chariot, un robot, une zone de stockage, un arbre — sont posés
 *   par leur **centre** et tournés d'un angle. On les déplace, on les tourne ; leur taille est la
 *   leur.
 *
 * Tout est en cases, comme le reste du kit : une case vaut deux mètres.
 */

export type PlannerLinearKind = "wall" | "dock" | "fence" | "conveyor" | "palletRack";
export type PlannerPointKind = "shelf" | "zone" | "forklift" | "amr" | "arm" | "truck" | "container" | "worker" | "tree" | "light";
export type PlannerKind = PlannerLinearKind | PlannerPointKind;

export interface PlannerLinear {
  id: string;
  kind: PlannerLinearKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PlannerPoint {
  id: string;
  kind: PlannerPointKind;
  x: number;
  y: number;
  /** En degrés. */
  rotation: number;
}

export type PlannerItem = PlannerLinear | PlannerPoint;

export const LINEAR_KINDS: PlannerLinearKind[] = ["wall", "dock", "fence", "conveyor", "palletRack"];

export function isLinear(item: PlannerItem): item is PlannerLinear {
  return (LINEAR_KINDS as string[]).includes(item.kind);
}

export interface PlannerTool {
  kind: PlannerKind;
  label: string;
  group: "Bâtiment" | "Stockage" | "Manutention" | "Véhicules" | "Extérieur";
  /** Pour un élément linéaire : sa longueur à la pose, en cases. */
  length?: number;
}

export const PLANNER_TOOLS: PlannerTool[] = [
  { kind: "wall", label: "Mur", group: "Bâtiment", length: 10 },
  { kind: "dock", label: "Mur de quai", group: "Bâtiment", length: 12 },
  { kind: "fence", label: "Clôture", group: "Bâtiment", length: 8 },
  { kind: "palletRack", label: "Rack à palettes", group: "Stockage", length: 5.5 },
  { kind: "shelf", label: "Étagère", group: "Stockage" },
  { kind: "zone", label: "Zone de stockage", group: "Stockage" },
  { kind: "conveyor", label: "Tapis roulant", group: "Manutention", length: 6 },
  { kind: "arm", label: "Bras robotisé", group: "Manutention" },
  { kind: "forklift", label: "Chariot élévateur", group: "Véhicules" },
  { kind: "amr", label: "Robot autonome", group: "Véhicules" },
  { kind: "truck", label: "Semi-remorque", group: "Véhicules" },
  { kind: "container", label: "Conteneur", group: "Extérieur" },
  { kind: "worker", label: "Opérateur", group: "Extérieur" },
  { kind: "tree", label: "Arbre", group: "Extérieur" },
  { kind: "light", label: "Mât d'éclairage", group: "Extérieur" },
];

export const PLANNER_LABEL: Record<PlannerKind, string> = Object.fromEntries(PLANNER_TOOLS.map((t) => [t.kind, t.label])) as Record<PlannerKind, string>;

/** L'épaisseur d'un élément linéaire, en travers de son segment, en cases. */
export const LINEAR_THICKNESS: Record<PlannerLinearKind, number> = { wall: 0.3, dock: 0.3, fence: 0.1, conveyor: 1.6, palletRack: 0.55 };

/** L'emprise d'un élément ponctuel, avant rotation : longueur (le long de son cap) et largeur. */
export const POINT_SIZE: Record<PlannerPointKind, { length: number; width: number }> = {
  shelf: { length: 4, width: 1.2 },
  zone: { length: 4.3, width: 2.75 },
  forklift: { length: 2.7, width: 1 },
  amr: { length: 1.6, width: 1.15 },
  arm: { length: 1.2, width: 1.2 },
  truck: { length: semiTruckGeometry().length, width: semiTruckGeometry().width },
  container: { length: CONTAINER_DIMENSIONS["40"].length, width: CONTAINER_DIMENSIONS["40"].width },
  worker: { length: 0.4, width: 0.4 },
  tree: { length: 1.4, width: 1.4 },
  light: { length: 0.6, width: 0.6 },
};

/** Un rectangle orienté : son centre, ses demi-côtés, son cap en radians. */
export interface Footprint {
  cx: number;
  cy: number;
  halfL: number;
  halfW: number;
  angle: number;
}

export function footprintOf(item: PlannerItem): Footprint {
  if (isLinear(item)) {
    const L = Math.hypot(item.x1 - item.x0, item.y1 - item.y0);
    return {
      cx: (item.x0 + item.x1) / 2,
      cy: (item.y0 + item.y1) / 2,
      halfL: L / 2,
      halfW: LINEAR_THICKNESS[item.kind] / 2,
      angle: Math.atan2(item.y1 - item.y0, item.x1 - item.x0),
    };
  }
  const s = POINT_SIZE[item.kind];
  return { cx: item.x, cy: item.y, halfL: s.length / 2, halfW: s.width / 2, angle: (item.rotation * Math.PI) / 180 };
}

/** Les quatre coins d'une emprise. */
export function cornersOf(f: Footprint): { x: number; y: number }[] {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return [
    [-f.halfL, -f.halfW],
    [f.halfL, -f.halfW],
    [f.halfL, f.halfW],
    [-f.halfL, f.halfW],
  ].map(([u, v]) => ({ x: f.cx + u * c - v * s, y: f.cy + u * s + v * c }));
}

/** Le point `p` est-il sur l'élément ? Un rien de marge autour, pour attraper un mur fin. */
export function hits(item: PlannerItem, p: { x: number; y: number }, slack = 0.25): boolean {
  const f = footprintOf(item);
  const c = Math.cos(-f.angle);
  const s = Math.sin(-f.angle);
  const dx = p.x - f.cx;
  const dy = p.y - f.cy;
  const u = dx * c - dy * s;
  const v = dx * s + dy * c;
  return Math.abs(u) <= f.halfL + slack && Math.abs(v) <= f.halfW + slack;
}

/** L'élément sous le point : le dernier posé d'abord, comme il est dessiné par-dessus. */
export function hitTest(items: PlannerItem[], p: { x: number; y: number }): PlannerItem | null {
  for (let i = items.length - 1; i >= 0; i -= 1) if (hits(items[i], p)) return items[i];
  return null;
}

/** L'élément tient-il entièrement sur le terrain constructible ? On sonde son emprise tous les
 *  demi-mètres. */
export function fitsPlot(item: PlannerItem, plot: Pick<PlotLayout, "width" | "depth" | "notches">): boolean {
  const f = footprintOf(item);
  // Un mur, une clôture se jugent sur leur axe, et un axe peut longer le bord du terrain : un point
  // posé sur une ligne de la grille est dedans si l'une des cases qu'il touche l'est.
  if (item.kind === "wall" || item.kind === "dock" || item.kind === "fence") {
    const e = 1e-4;
    const touches = (x: number, y: number) =>
      [
        [-e, -e],
        [e, -e],
        [-e, e],
        [e, e],
      ].some(([a, b]) => plotInside(plot, Math.floor(x + a), Math.floor(y + b)));
    const n = Math.max(1, Math.ceil((f.halfL * 2) / 0.25));
    for (let i = 0; i <= n; i += 1) {
      const u = -f.halfL + (2 * f.halfL * i) / n;
      if (!touches(f.cx + u * Math.cos(f.angle), f.cy + u * Math.sin(f.angle))) return false;
    }
    return true;
  }
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const nu = Math.max(1, Math.ceil((f.halfL * 2) / 0.25));
  const nv = Math.max(1, Math.ceil((f.halfW * 2) / 0.25));
  for (let i = 0; i <= nu; i += 1)
    for (let j = 0; j <= nv; j += 1) {
      const u = -f.halfL + (2 * f.halfL * i) / nu;
      const v = -f.halfW + (2 * f.halfW * j) / nv;
      const x = f.cx + u * c - v * s;
      const y = f.cy + u * s + v * c;
      // Un bord exactement sur une ligne de la grille appartient aux deux cases : on rentre d'un rien.
      const ix = Math.floor(x - Math.sign(u) * 1e-6);
      const iy = Math.floor(y - Math.sign(v) * 1e-6);
      if (!plotInside(plot, ix, iy)) return false;
    }
  return true;
}

/** Le pas de la grille d'un élément : les murs vont d'un nœud entier à l'autre, comme dans les
 *  Sims ; le reste se pose à la demi-case. */
export function gridStep(item: PlannerItem): number {
  return item.kind === "wall" || item.kind === "dock" || item.kind === "fence" ? 1 : 0.5;
}

/** Arrondir à la grille — une demi-case par défaut. */
export const snap = (v: number, step = 0.5) => Math.round(v / step) * step;

/**
 * Tirer un bout d'élément linéaire : le point est arrondi à la grille, et un segment presque droit
 * **devient droit** — un mur à 3° de l'horizontale est un mur mal tracé, pas une intention.
 */
export function dragEnd(item: PlannerLinear, which: 0 | 1, p: { x: number; y: number }, free = false): PlannerLinear {
  const ax = which === 0 ? item.x1 : item.x0;
  const ay = which === 0 ? item.y1 : item.y0;
  const step = gridStep(item);
  let x = snap(p.x, step);
  let y = snap(p.y, step);
  if (!free) {
    const deg = (Math.atan2(y - ay, x - ax) * 180) / Math.PI;
    const near = Math.round(deg / 45) * 45;
    if (Math.abs(deg - near) < 8) {
      if (near % 180 === 0) y = ay;
      else if (near % 90 === 0) x = ax;
    }
  }
  // Un mur a une longueur minimale : on ne peut pas le replier sur lui-même.
  if (Math.hypot(x - ax, y - ay) < 1) return item;
  return which === 0 ? { ...item, x0: x, y0: y } : { ...item, x1: x, y1: y };
}

/** Déplacer un élément de `(dx, dy)`, arrondi à la grille. */
export function moveBy(item: PlannerItem, dx: number, dy: number): PlannerItem {
  if (isLinear(item)) {
    const step = gridStep(item);
    const sx = snap(item.x0 + dx, step) - item.x0;
    const sy = snap(item.y0 + dy, step) - item.y0;
    return { ...item, x0: item.x0 + sx, y0: item.y0 + sy, x1: item.x1 + sx, y1: item.y1 + sy };
  }
  return { ...item, x: snap(item.x + dx), y: snap(item.y + dy) };
}

/** Tourner d'un quart de tour, autour du centre. */
export function rotateQuarter(item: PlannerItem): PlannerItem {
  if (!isLinear(item)) return { ...item, rotation: (item.rotation + 90) % 360 };
  const cx = (item.x0 + item.x1) / 2;
  const cy = (item.y0 + item.y1) / 2;
  const rot = (x: number, y: number) => ({ x: snap(cx - (y - cy)), y: snap(cy + (x - cx)) });
  const a = rot(item.x0, item.y0);
  const b = rot(item.x1, item.y1);
  return { ...item, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

/** Retourner un élément linéaire : ce qui était dehors passe dedans — la cour d'un quai change de
 *  côté. */
export function flip(item: PlannerItem): PlannerItem {
  if (!isLinear(item)) return { ...item, rotation: (item.rotation + 180) % 360 };
  return { ...item, x0: item.x1, y0: item.y1, x1: item.x0, y1: item.y0 };
}

let counter = 0;
/** Un nouvel élément de l'outil `kind`, centré en `(x, y)`. */
export function createItem(kind: PlannerKind, x: number, y: number): PlannerItem {
  counter += 1;
  const id = `${kind}-${Date.now().toString(36)}-${counter}`;
  const tool = PLANNER_TOOLS.find((t) => t.kind === kind);
  if ((LINEAR_KINDS as string[]).includes(kind)) {
    const half = (tool?.length ?? 6) / 2;
    const step = kind === "wall" || kind === "dock" || kind === "fence" ? 1 : 0.5;
    const cx = snap(x, step);
    const cy = snap(y, step);
    return { id, kind: kind as PlannerLinearKind, x0: cx - half, y0: cy, x1: cx + half, y1: cy };
  }
  return { id, kind: kind as PlannerPointKind, x: snap(x), y: snap(y), rotation: 0 };
}

// --- Le tracé des murs, à la manière des Sims ------------------------------------------------------

/** Les façons de tracer : un segment, une chaîne de segments, deux murs parallèles, une pièce. */
export type DrawMode = "segment" | "chain" | "parallel" | "room";

/**
 * Le point du tracé sous le curseur.
 *
 *  Comme dans les Sims, un mur va **d'un nœud de la grille à un autre** — une case entière, jamais
 *  une fraction — et part droit ou en diagonale à 45°. Au départ, le curseur s'accroche aussi au
 *  bout d'un mur existant à portée : c'est ce qui fait qu'un nouveau mur se raccorde au précédent au
 *  lieu de s'arrêter à côté.
 */
export function wallPoint(p: { x: number; y: number }, start: { x: number; y: number } | null, mode: DrawMode, items: PlannerItem[]): { x: number; y: number } {
  if (!start || mode === "parallel" || mode === "room") {
    let best: { x: number; y: number } | null = null;
    let bestD = 0.8;
    if (!start)
      for (const it of items)
        if (isLinear(it))
          for (const q of [
            { x: it.x0, y: it.y0 },
            { x: it.x1, y: it.y1 },
          ]) {
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bestD) {
              bestD = d;
              best = q;
            }
          }
    return best ?? { x: Math.round(p.x), y: Math.round(p.y) };
  }
  const dx = p.x - start.x;
  const dy = p.y - start.y;
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const ux = Math.round(Math.cos(a));
  const uy = Math.round(Math.sin(a));
  if (ux !== 0 && uy !== 0) {
    const n = Math.round((Math.abs(dx) + Math.abs(dy)) / 2);
    return { x: start.x + ux * n, y: start.y + uy * n };
  }
  const n = Math.round(ux !== 0 ? Math.abs(dx) : Math.abs(dy));
  return { x: start.x + ux * n, y: start.y + uy * n };
}

/**
 * Les murs d'un tracé en cours, du point `s` au point `e`.
 *
 *  Une pièce est tracée dans l'ordre qui met l'extérieur de chaque mur **dehors** (voir
 *  `wallPlacement`) : un mur de quai qu'on y changerait aurait sa cour du bon côté. Les deux murs
 *  parallèles sont les deux grands côtés du rectangle tiré.
 */
export function draftWalls(kind: PlannerLinearKind, mode: DrawMode, s: { x: number; y: number }, e: { x: number; y: number }): PlannerLinear[] {
  const id = (i: number) => `draft-${i}`;
  if (mode === "segment" || mode === "chain") {
    if (Math.hypot(e.x - s.x, e.y - s.y) < 1) return [];
    return [{ id: id(0), kind, x0: s.x, y0: s.y, x1: e.x, y1: e.y }];
  }
  const x0 = Math.min(s.x, e.x);
  const x1 = Math.max(s.x, e.x);
  const y0 = Math.min(s.y, e.y);
  const y1 = Math.max(s.y, e.y);
  const w = x1 - x0;
  const h = y1 - y0;
  const bottom: PlannerLinear = { id: id(0), kind, x0, y0, x1, y1: y0 };
  const right: PlannerLinear = { id: id(1), kind, x0: x1, y0, x1, y1 };
  const top: PlannerLinear = { id: id(2), kind, x0: x1, y0: y1, x1: x0, y1 };
  const left: PlannerLinear = { id: id(3), kind, x0, y0: y1, x1: x0, y1: y0 };
  if (mode === "room") return w >= 1 && h >= 1 ? [bottom, right, top, left] : [];
  if (w >= h) return w >= 1 && h >= 1 ? [bottom, top] : [];
  return w >= 1 && h >= 1 ? [left, right] : [];
}

/** Donner des identifiants neufs aux murs d'un tracé qu'on valide. */
export function commitDraft(draft: PlannerLinear[]): PlannerLinear[] {
  counter += 1;
  const stamp = `${Date.now().toString(36)}-${counter}`;
  return draft.map((w, i) => ({ ...w, id: `${w.kind}-${stamp}-${i}` }));
}
