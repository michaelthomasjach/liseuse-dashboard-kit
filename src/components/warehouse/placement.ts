import { footprintOf, footprintsOverlap, isLinear, levelOf, sizeOf, type PlannerItem, type PlannerKind, type PlannerPoint } from "./plannerModel";

/**
 * Les règles de pose **en hauteur** — les étages d'un bâtiment, les piles de conteneurs — en
 * fonctions pures, sans rien dessiner : l'éditeur (`WarehousePlanner`) s'en sert, et un jeu peut
 * les reprendre telles quelles côté serveur pour refuser ce que le client aurait laissé passer.
 *
 * ## Les étages
 *
 *  Un élément a un étage (`floor`, 0 au rez-de-chaussée). L'étage `n` est à `n × FLOOR_HEIGHT`
 *  cases de haut : la hauteur d'un mur et l'épaisseur d'une dalle. Un étage n'existe que là où une
 *  **dalle d'étage** (`floorSlab`) le porte :
 *  - une dalle de l'étage `n` repose sur des **murs de l'étage `n − 1`** : chacun de ses coins est
 *    au droit d'un mur (à moins de `SLAB_REACH` case) — `SLAB_NO_SUPPORT` sinon ;
 *  - tout autre élément de l'étage `n ≥ 1` doit être **sur une dalle** de cet étage — `NO_FLOOR`
 *    sinon ;
 *  - les chevauchements ne comptent qu'**entre éléments du même étage** (`OVERLAP`, si on le demande) ;
 *  - un escalier (`stairs`) ou un monte-charge (`freightLift`) posé à l'étage `n` mène à l'étage
 *    `n + 1` : il y faut une dalle au-dessus de lui — `NO_FLOOR_ABOVE` sinon ;
 *  - la toiture se pose sur le **dernier** étage : pas de dalle au-dessus d'elle (`ROOF_NOT_TOP`).
 *
 * ## Les piles
 *
 *  Certains éléments s'empilent (`STACKABLE`) : un conteneur sur un autre, jusqu'à `max` de haut. Un
 *  élément empilé est un élément à part entière, avec son `stackLevel` (0 au sol) ; il a exactement
 *  la même emprise que celui du dessous (`sameFootprint`) — même place, même cap, même taille.
 *  - `STACK_NO_BASE` : rien dessous à ce niveau ;
 *  - `STACK_MISMATCH` : le dessous n'a pas la même emprise (un 20 pieds sur un 40 pieds) ;
 *  - `STACK_FULL` : la pile est déjà à son maximum.
 *
 *  **Retirer** un élément d'une pile emporte ceux qui sont dessus (`removalSet`) : un conteneur ne
 *  flotte pas, et c'est ce qu'on attend en le soulevant. Retirer une dalle qui porte encore quelque
 *  chose est refusé (`removalProblem`) : on vide l'étage d'abord.
 */

/** La hauteur d'un étage, en cases : un mur (3 cases) et une dalle. */
export const FLOOR_HEIGHT = 3.25;
/** L'épaisseur d'une dalle d'étage. */
export const SLAB_THICKNESS = 0.25;
/** La distance, en cases, à laquelle un coin de dalle doit être d'un mur de l'étage d'en dessous. */
export const SLAB_REACH = 0.8;
/** La hauteur d'un conteneur maritime, en cases (2,59 m). */
export const CONTAINER_HEIGHT = 1.295;

/** Ce qui s'empile, et jusqu'où. */
export const STACKABLE: Partial<Record<PlannerKind, { max: number; sameFootprint: true; height: number }>> = {
  container: { max: 4, sameFootprint: true, height: CONTAINER_HEIGHT },
};

export type PlacementCode = "SLAB_NO_SUPPORT" | "NO_FLOOR" | "NO_FLOOR_ABOVE" | "ROOF_NOT_TOP" | "OVERLAP" | "STACK_NO_BASE" | "STACK_MISMATCH" | "STACK_FULL" | "SLAB_NOT_EMPTY";

export interface PlacementProblem {
  code: PlacementCode;
  message: string;
}

/** L'étage d'un élément (0 : le rez-de-chaussée). */
export const floorOf = (item: PlannerItem): number => Math.max(0, Math.round(item.floor ?? 0));
/** Le niveau d'un élément dans sa pile (0 : au sol). */
export const stackLevelOf = (item: PlannerItem): number => Math.max(0, Math.round((item as PlannerPoint).stackLevel ?? 0));
/** La hauteur, en cases, du plancher de l'étage `floor`. */
export const floorElevation = (floor: number): number => Math.max(0, floor) * FLOOR_HEIGHT;
/** La hauteur, en cases, où se pose un élément : son étage, et sa place dans une pile. */
export function elevationOf(item: PlannerItem): number {
  const st = STACKABLE[item.kind];
  return floorElevation(floorOf(item)) + (st ? stackLevelOf(item) * st.height : 0);
}
export const sameFloor = (a: PlannerItem, b: PlannerItem): boolean => floorOf(a) === floorOf(b);

/** Ce qui ne compte pas dans les chevauchements : ce qui est dans un mur, sur un toit, ou le toit. */
const NO_OVERLAP: PlannerKind[] = ["door", "window", "bay", "roof", "roofSolar", "hvac", "floorSlab"];

function pointInside(p: { x: number; y: number }, it: PlannerItem, slack = 0.05): boolean {
  const f = footprintOf(it);
  const dx = p.x - f.cx;
  const dy = p.y - f.cy;
  const u = Math.abs(dx * Math.cos(f.angle) + dy * Math.sin(f.angle));
  const v = Math.abs(-dx * Math.sin(f.angle) + dy * Math.cos(f.angle));
  return u <= f.halfL + slack && v <= f.halfW + slack;
}

/** Les coins d'une emprise. */
function corners(it: PlannerItem) {
  const f = footprintOf(it);
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return [
    [-f.halfL, -f.halfW],
    [f.halfL, -f.halfW],
    [f.halfL, f.halfW],
    [-f.halfL, f.halfW],
  ].map(([u, v]) => ({ x: f.cx + u * c - v * s, y: f.cy + u * s + v * c }));
}

function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Les dalles de l'étage `floor` qui portent le point `p`. */
export function slabsAt(p: { x: number; y: number }, floor: number, items: PlannerItem[]): PlannerItem[] {
  return items.filter((it) => it.kind === "floorSlab" && floorOf(it) === floor && pointInside(p, it));
}

/** Un élément de l'étage `n ≥ 1` est-il entièrement sur les dalles de son étage ? */
export function onSlab(item: PlannerItem, items: PlannerItem[]): boolean {
  const f = floorOf(item);
  if (f === 0) return true;
  const pts = isLinear(item) ? [{ x: item.x0, y: item.y0 }, { x: item.x1, y: item.y1 }, { x: (item.x0 + item.x1) / 2, y: (item.y0 + item.y1) / 2 }] : [...corners(item), { x: item.x, y: item.y }];
  return pts.every((p) => slabsAt(p, f, items).length > 0);
}

/** Une dalle de l'étage `n` repose-t-elle sur des murs de l'étage `n − 1` ? */
export function slabSupported(slab: PlannerItem, items: PlannerItem[]): boolean {
  const below = floorOf(slab) - 1;
  if (below < 0) return false;
  const walls = items.filter((it) => isLinear(it) && (it.kind === "wall" || it.kind === "dock") && floorOf(it) === below);
  return corners(slab).every((c) => walls.some((w) => isLinear(w) && distToSegment(c, { x: w.x0, y: w.y0 }, { x: w.x1, y: w.y1 }) <= SLAB_REACH));
}

/** La pile sous un élément empilable : ceux du même genre, au même étage, sous sa place. */
export function stackAt(item: PlannerItem, items: PlannerItem[]): PlannerItem[] {
  if (isLinear(item) || !STACKABLE[item.kind]) return [];
  return items.filter((it) => it.id !== item.id && it.kind === item.kind && !isLinear(it) && floorOf(it) === floorOf(item) && pointInside({ x: item.x, y: item.y }, it)).sort((a, b) => stackLevelOf(a) - stackLevelOf(b));
}

/**
 * Poser `item` (un empilable) sur la pile qui est sous le point `(x, y)` : l'élément calé
 * exactement sur le sommet, au niveau suivant, ou `null` s'il n'y a pas de pile là. La pile peut être
 * pleine ou d'une autre taille : `placementProblem` le dira.
 */
export function stackOnto(item: PlannerPoint, at: { x: number; y: number }, items: PlannerItem[]): PlannerPoint | null {
  if (!STACKABLE[item.kind]) return null;
  const pile = items.filter((it): it is PlannerPoint => !isLinear(it) && it.kind === item.kind && floorOf(it) === floorOf(item) && pointInside(at, it));
  if (!pile.length) return null;
  const top = pile.reduce((a, b) => (stackLevelOf(b) > stackLevelOf(a) ? b : a));
  return { ...item, x: top.x, y: top.y, rotation: top.rotation, level: item.level, stackLevel: stackLevelOf(top) + 1 };
}

/** La hauteur d'une pile, en éléments, et son maximum : « niveau 2/4 ». */
export function stackInfo(item: PlannerItem): { level: number; max: number } | null {
  const st = STACKABLE[item.kind];
  return st ? { level: stackLevelOf(item) + 1, max: st.max } : null;
}

/**
 * Pourquoi `item` ne peut pas être là, au regard des étages et des piles — ou `null`. `others` : les
 * autres éléments du plan (sans lui). `overlap: true` ajoute les chevauchements, au même étage.
 */
export function placementProblem(item: PlannerItem, others: PlannerItem[], opts: { overlap?: boolean } = {}): PlacementProblem | null {
  const floor = floorOf(item);
  // Les dalles : sur des murs de l'étage d'en dessous.
  if (item.kind === "floorSlab") {
    if (floor < 1) return { code: "SLAB_NO_SUPPORT", message: "Une dalle d'étage se pose au-dessus du rez-de-chaussée : choisissez l'étage 1 ou plus." };
    if (!slabSupported(item, others)) return { code: "SLAB_NO_SUPPORT", message: "La dalle doit reposer sur des murs de l'étage du dessous : chacun de ses coins sur un mur." };
  } else if (floor > 0 && !onSlab(item, others)) {
    return { code: "NO_FLOOR", message: `Il n'y a pas de plancher ici à l'étage ${floor} : posez d'abord une dalle d'étage.` };
  }
  // Ce qui relie deux étages mène quelque part.
  if ((item.kind === "stairs" || item.kind === "freightLift") && !isLinear(item) && slabsAt({ x: item.x, y: item.y }, floor + 1, others).length === 0)
    return { code: "NO_FLOOR_ABOVE", message: "Un escalier ou un monte-charge mène à l'étage du dessus : il y faut une dalle au-dessus de lui." };
  // La toiture coiffe le dernier étage.
  if (item.kind === "roof" && !isLinear(item) && slabsAt({ x: item.x, y: item.y }, floor + 1, others).length > 0)
    return { code: "ROOF_NOT_TOP", message: "La toiture se pose sur le dernier étage : il y a une dalle au-dessus." };
  // Les piles.
  const st = STACKABLE[item.kind];
  const level = stackLevelOf(item);
  if (st && level > 0 && !isLinear(item)) {
    if (level >= st.max) return { code: "STACK_FULL", message: `La pile est pleine : ${st.max} au plus.` };
    const below = others.find((it) => it.kind === item.kind && !isLinear(it) && floorOf(it) === floor && stackLevelOf(it) === level - 1 && pointInside({ x: item.x, y: item.y }, it));
    if (!below || isLinear(below)) return { code: "STACK_NO_BASE", message: "Rien dessous pour porter cet élément à ce niveau de la pile." };
    const a = sizeOf(item);
    const b = sizeOf(below);
    const turned = Math.abs((((item.rotation - below.rotation) % 180) + 180) % 180);
    if (Math.abs(a.length - b.length) > 0.05 || Math.abs(a.width - b.width) > 0.05 || turned > 0.5 || Math.hypot(item.x - below.x, item.y - below.y) > 0.05 || levelOf(item) !== levelOf(below))
      return { code: "STACK_MISMATCH", message: "On n'empile que sur un élément de même taille, à la même place, dans le même sens." };
  }
  if (opts.overlap && !NO_OVERLAP.includes(item.kind)) {
    const f = footprintOf(item);
    const hit = others.find((o) => !NO_OVERLAP.includes(o.kind) && floorOf(o) === floor && !(st && o.kind === item.kind && stackLevelOf(o) !== level) && footprintsOverlap(f, footprintOf(o)));
    if (hit) return { code: "OVERLAP", message: "Un autre élément est déjà à cette place, à cet étage." };
  }
  return null;
}

/** Retirer `item` : les éléments qui partent avec lui — lui, et ce qui est empilé dessus. */
export function removalSet(item: PlannerItem, items: PlannerItem[]): PlannerItem[] {
  if (!STACKABLE[item.kind] || isLinear(item)) return [item];
  const level = stackLevelOf(item);
  return [item, ...stackAt(item, items).filter((it) => stackLevelOf(it) > level)];
}

/** Peut-on retirer `item` ? Une dalle qui porte encore quelque chose, non. */
export function removalProblem(item: PlannerItem, items: PlannerItem[]): PlacementProblem | null {
  if (item.kind !== "floorSlab") return null;
  const f = floorOf(item);
  const carried = items.filter((it) => it.id !== item.id && floorOf(it) === f && it.kind !== "floorSlab" && footprintsOverlap(footprintOf(it), footprintOf(item)));
  const upper = items.filter((it) => it.kind === "floorSlab" && floorOf(it) > f && footprintsOverlap(footprintOf(it), footprintOf(item)));
  if (carried.length || upper.length) return { code: "SLAB_NOT_EMPTY", message: "Cette dalle porte encore des éléments : videz l'étage avant de la retirer." };
  return null;
}

/** Le dernier étage où quelque chose est posé (0 s'il n'y a que le rez-de-chaussée). */
export function topFloor(items: PlannerItem[]): number {
  return items.reduce((m, it) => Math.max(m, floorOf(it)), 0);
}
