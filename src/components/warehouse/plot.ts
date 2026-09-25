import { rng } from "./three/random";
import { roadSize, roadTrack, type RoadProps } from "./Road";
import { lotSize, type BuildingKind, type BuildingSpec } from "./Building";
import type { TreeSpec } from "./Tree";
import type { CarKind, CarTone } from "./Car";
import type { P3 } from "./three/builder";

/**
 * Le terrain à bâtir, tiré d'une graine.
 *
 * ## Ce qu'on reçoit
 *
 * Un joueur ne construit pas dans le vide : on lui **donne un terrain**. Un rectangle, un carré, ou
 * une forme moins commode — un L, un T, un U — dont une partie est déjà occupée par des voisins.
 * C'est la contrainte de départ, et c'est une graine qui la fixe : la même graine donne toujours le
 * même terrain, les mêmes voisins, les mêmes rues ; une autre graine, une autre partie.
 *
 * ## Ce qui l'entoure
 *
 * Autour du terrain, une **rue en boucle** (deux voies, deux trottoirs), d'où partent parfois des
 * rues vers l'extérieur. Au-delà de la rue, des **voisins** — maisons, pavillons, petit immeuble,
 * bureaux, ateliers, commerces — façade sur la rue. Dans les échancrures d'un terrain en L, en T ou
 * en U, d'autres voisins, derrière une clôture. Des arbres d'alignement, des candélabres, et des
 * voitures qui tournent sur la boucle. C'est ce décor qui dit, sans un mot, que le terrain est
 * **limité** : on voit où il s'arrête, et ce qui commence après ne nous appartient pas.
 *
 * ## Le repère
 *
 * Tout est en cases (une case vaut deux mètres). Le rectangle englobant du terrain va de `(0, 0)` à
 * `(width, depth)` ; les cases constructibles sont celles de ce rectangle qui ne tombent dans
 * aucune échancrure (`notches`). La rue et les voisins sont en dehors, en coordonnées négatives ou
 * au-delà de `width` / `depth`.
 */

export type PlotShape = "rect" | "square" | "L" | "T" | "U";

export const PLOT_SHAPES: PlotShape[] = ["rect", "square", "L", "T", "U"];

export interface PlotRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/**
 * Une parcelle voisine **à vendre** : une partie du terrain que le joueur ne possède pas encore.
 *
 *  Elle est dans le rectangle du terrain, mais hors du constructible — comme une échancrure — tant
 *  qu'elle n'est pas achetée : une friche, close d'une clôture du côté de ce qu'on possède, et un
 *  panneau « À VENDRE » en son milieu. `label` s'y lit sous l'annonce (un prix, un nom).
 */
export interface PlotLockedArea extends PlotRect {
  id: string;
  label?: string;
}

export interface PlotTile extends RoadProps {
  /** La tuile est parcourue à rebours dans le sens de la boucle. */
  flip?: boolean;
}

export interface PlotCar {
  kind: CarKind;
  tone: CarTone;
  /** L'itinéraire : la voie de la boucle dans le sens direct, ou dans l'autre. */
  reverse: boolean;
  speed: number;
  phase: number;
}

export interface PlotLayout {
  seed: number;
  shape: PlotShape;
  width: number;
  depth: number;
  /** Les parties du rectangle englobant qui ne sont **pas** au joueur. */
  notches: PlotRect[];
  /** Parmi elles, les parcelles à vendre (voir `withLockedAreas`) : ni voisins ni maisons dessus,
   *  une friche close et son panneau. */
  locked?: PlotLockedArea[];
  /** La bande entre le terrain et la rue, en cases. */
  margin: number;
  /** La rue : ses tuiles, et les deux voies de la boucle. */
  roads: PlotTile[];
  lanes: { forward: P3[][]; backward: P3[][] };
  neighbors: BuildingSpec[];
  trees: TreeSpec[];
  lights: { x: number; y: number; rotation: number }[];
  /** Les clôtures entre les échancrures et le terrain, d'un point à l'autre. */
  fences: { x0: number; y0: number; x1: number; y1: number }[];
  cars: PlotCar[];
  /** Le pavé de tout ce décor, en cases. */
  frame: { x: number; y: number; width: number; depth: number; height: number };
}

/** Deux voies de 3,50 m, deux trottoirs de 2 m. */
const ROAD: RoadProps = { lanes: 2, laneWidth: 1.75, sidewalk: 1 };
const RW = roadSize({ ...ROAD, kind: "corner" }).width;
/**
 * Le profil de la rue autour du terrain : la largeur d'un trottoir et d'une voie, en cases. La rue
 * commence à `margin` cases du bord du terrain (voir `PlotLayout.margin`) — d'abord le trottoir côté
 * terrain, puis la voie qui longe le terrain, puis l'autre.
 */
export const PLOT_STREET = { sidewalk: ROAD.sidewalk ?? 1, laneWidth: ROAD.laneWidth ?? 1.75, lanes: ROAD.lanes ?? 2 };
/** La profondeur de la frange de voisins, au-delà de la rue. */
const FRINGE = 11;

/** Un côté du terrain, et de la rue qui le longe : au sud les `y` négatifs, au nord au-delà de
 *  `depth`, à l'ouest les `x` négatifs, à l'est au-delà de `width`. */
export type PlotSide = "south" | "north" | "west" | "east";
export const PLOT_SIDES: PlotSide[] = ["south", "north", "west", "east"];

type XY = { x: number; y: number };

/** Le repère d'un côté du terrain (voir `plotSideFrame`). */
export interface PlotSideFrame {
  /** La longueur du côté, en cases. */
  length: number;
  /** Le vecteur unitaire le long du côté, et celui qui sort du terrain vers la rue. */
  t: XY;
  o: XY;
  along: (p: XY) => number;
  out: (p: XY) => number;
  at: (a: number, d: number) => XY;
}

/**
 * Le repère d'un côté du terrain : `a` le long du bord (les `x` au sud et au nord, les `y` à l'ouest
 * et à l'est), `d` la distance **vers la rue**, comptée depuis le bord du terrain — négative dedans.
 * La rue de ce côté commence à `d = margin` (le trottoir), sa chaussée à `d = margin + sidewalk`.
 */
export function plotSideFrame(plot: Pick<PlotLayout, "width" | "depth">, side: PlotSide): PlotSideFrame {
  const W = plot.width;
  const D = plot.depth;
  switch (side) {
    case "south":
      return { length: W, t: { x: 1, y: 0 }, o: { x: 0, y: -1 }, along: (p) => p.x, out: (p) => -p.y, at: (a, d) => ({ x: a, y: -d }) };
    case "north":
      return { length: W, t: { x: 1, y: 0 }, o: { x: 0, y: 1 }, along: (p) => p.x, out: (p) => p.y - D, at: (a, d) => ({ x: a, y: D + d }) };
    case "west":
      return { length: D, t: { x: 0, y: 1 }, o: { x: -1, y: 0 }, along: (p) => p.y, out: (p) => -p.x, at: (a, d) => ({ x: -d, y: a }) };
    default:
      return { length: D, t: { x: 0, y: 1 }, o: { x: 1, y: 0 }, along: (p) => p.y, out: (p) => p.x - W, at: (a, d) => ({ x: W + d, y: a }) };
  }
}

/**
 * Un **raccordement** à la rue : là où une voie d'accès du terrain rejoint la chaussée.
 *
 *  `from` et `to` bornent, le long du côté (repère de `plotSideFrame`), l'ouverture du trottoir côté
 *  terrain — le bateau ; `apron` est le polygone d'enrobé, en cases, qui va du bout de la voie
 *  jusqu'au bord de la chaussée en traversant la bande d'herbe et le trottoir ouvert.
 */
export interface PlotDriveway {
  side: PlotSide;
  from: number;
  to: number;
  apron: XY[];
}

/** Une case est-elle constructible ? */
export function plotInside(plot: Pick<PlotLayout, "width" | "depth" | "notches">, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= plot.width || y >= plot.depth) return false;
  return !plot.notches.some((n) => x >= n.x && x < n.x + n.width && y >= n.y && y < n.y + n.depth);
}

/** Les arêtes unitaires du bord constructible : `[x0, y0, x1, y1]`, sur la grille. */
export function plotOutline(plot: Pick<PlotLayout, "width" | "depth" | "notches">): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let x = -1; x <= plot.width; x += 1)
    for (let y = -1; y <= plot.depth; y += 1) {
      const a = plotInside(plot, x, y);
      if (a !== plotInside(plot, x + 1, y)) out.push([x + 1, y, x + 1, y + 1]);
      if (a !== plotInside(plot, x, y + 1)) out.push([x, y + 1, x + 1, y + 1]);
    }
  return out;
}

/** Un tronçon de clôture, d'un point à l'autre, en cases. */
export interface PlotFenceRun {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * La **clôture de pourtour** : le bord constructible tout entier (voir `plotOutline`) — le rectangle
 * du terrain moins ses échancrures et ses parcelles à vendre —, en tronçons droits aussi longs que
 * possible, interrompus là où passe une ouverture.
 *
 *  Les arêtes d'une case qui se suivent sur une même ligne sont fondues en un tronçon. `openings`
 *  sont des polygones **convexes** (l'emprise d'une voie d'accès, élargie d'un rien) : chaque tronçon
 *  en est retranché, et ce qui reste de moins d'un tiers de case n'est pas planté. Une parcelle
 *  achetée n'est plus une échancrure : la clôture se déplace d'elle-même vers le nouveau bord.
 */
export function perimeterFenceRuns(plot: Pick<PlotLayout, "width" | "depth" | "notches">, openings: { x: number; y: number }[][] = []): PlotFenceRun[] {
  // Les arêtes, rangées par ligne : les horizontales par leur `y`, les verticales par leur `x`.
  const rows = new Map<string, { horizontal: boolean; at: number; spans: [number, number][] }>();
  for (const [x0, y0, x1, y1] of plotOutline(plot)) {
    const horizontal = y0 === y1;
    const at = horizontal ? y0 : x0;
    const key = `${horizontal ? "h" : "v"}${at}`;
    const row = rows.get(key) ?? { horizontal, at, spans: [] };
    row.spans.push(horizontal ? [Math.min(x0, x1), Math.max(x0, x1)] : [Math.min(y0, y1), Math.max(y0, y1)]);
    rows.set(key, row);
  }
  /** Où une ligne entre dans un polygone convexe, et où elle en sort — le long de la ligne. */
  const cross = (poly: { x: number; y: number }[], horizontal: boolean, at: number): [number, number] | null => {
    const hits: number[] = [];
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const pc = horizontal ? p.y : p.x;
      const qc = horizontal ? q.y : q.x;
      const pa = horizontal ? p.x : p.y;
      const qa = horizontal ? q.x : q.y;
      if ((pc - at) * (qc - at) > 0) continue;
      if (Math.abs(qc - pc) < 1e-9) hits.push(pa, qa);
      else hits.push(pa + ((at - pc) * (qa - pa)) / (qc - pc));
    }
    return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : null;
  };
  const out: PlotFenceRun[] = [];
  for (const { horizontal, at, spans } of rows.values()) {
    spans.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], s[1]);
      else merged.push([s[0], s[1]]);
    }
    const cuts = openings.map((poly) => cross(poly, horizontal, at)).filter((c): c is [number, number] => c !== null);
    for (const [a0, a1] of merged) {
      // Retrancher les ouvertures, de la gauche vers la droite.
      let pieces: [number, number][] = [[a0, a1]];
      for (const [c0, c1] of cuts) pieces = pieces.flatMap(([p0, p1]) => (c1 <= p0 || c0 >= p1 ? [[p0, p1] as [number, number]] : ([[p0, c0], [c1, p1]] as [number, number][]).filter(([u, v]) => v - u > 1e-6)));
      for (const [p0, p1] of pieces) {
        if (p1 - p0 < 1 / 3) continue;
        out.push(horizontal ? { x0: p0, y0: at, x1: p1, y1: at } : { x0: at, y0: p0, x1: at, y1: p1 });
      }
    }
  }
  return out;
}

/**
 * Le terrain, avec des parcelles **à vendre** en plus de ses échancrures.
 *
 *  Chaque parcelle est ramenée aux cases entières et au rectangle du terrain, puis ajoutée aux
 *  `notches` : pour tout ce qui juge du constructible (`plotInside`, `fitsPlot`, le pointillé),
 *  c'est une case qui n'est pas au joueur. Elle est aussi rangée dans `locked`, pour que le décor
 *  la dessine en friche à vendre plutôt que d'y mettre des voisins.
 */
export function withLockedAreas(plot: PlotLayout, areas: PlotLockedArea[] | undefined): PlotLayout {
  if (!areas || areas.length === 0) return plot;
  const locked: PlotLockedArea[] = [];
  for (const a of areas) {
    const x0 = Math.max(0, Math.round(a.x));
    const y0 = Math.max(0, Math.round(a.y));
    const x1 = Math.min(plot.width, Math.round(a.x + a.width));
    const y1 = Math.min(plot.depth, Math.round(a.y + a.depth));
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    locked.push({ ...a, x: x0, y: y0, width: x1 - x0, depth: y1 - y0 });
  }
  if (locked.length === 0) return plot;
  return { ...plot, notches: [...plot.notches, ...locked.map(({ x, y, width, depth }) => ({ x, y, width, depth }))], locked };
}

/**
 * Les clôtures des parcelles à vendre : sur les bords qu'elles partagent avec ce que le joueur
 * possède, et là seulement — le long de la rue ou d'une autre parcelle à vendre, il n'y a rien à
 * séparer. Les tronçons d'une case qui se suivent sont fondus en un seul.
 */
export function lockedFences(plot: PlotLayout): { x0: number; y0: number; x1: number; y1: number }[] {
  const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const a of plot.locked ?? []) {
    const sides: { from: [number, number]; step: [number, number]; n: number; probe: [number, number] }[] = [
      { from: [a.x, a.y], step: [1, 0], n: a.width, probe: [0, -1] },
      { from: [a.x, a.y + a.depth], step: [1, 0], n: a.width, probe: [0, 0] },
      { from: [a.x, a.y], step: [0, 1], n: a.depth, probe: [-1, 0] },
      { from: [a.x + a.width, a.y], step: [0, 1], n: a.depth, probe: [0, 0] },
    ];
    for (const s of sides) {
      let run: number | null = null;
      for (let i = 0; i <= s.n; i += 1) {
        const x = s.from[0] + s.step[0] * i;
        const y = s.from[1] + s.step[1] * i;
        const owned = i < s.n && plotInside(plot, x + s.probe[0], y + s.probe[1]);
        if (owned && run === null) run = i;
        if (!owned && run !== null) {
          out.push({ x0: s.from[0] + s.step[0] * run, y0: s.from[1] + s.step[1] * run, x1: x, y1: y });
          run = null;
        }
      }
    }
  }
  return out;
}

/**
 * La circulation de la rue à une heure donnée : `density` de 0 (la nuit, une voiture par sens) à 1
 * (l'heure de pointe).
 *
 *  Plus il y a de monde, plus il y a de voitures — et plus elles vont lentement, **en paquets** : à
 *  l'heure de pointe, on roule à 30 % de sa vitesse, pare-chocs contre pare-chocs par grappes de
 *  quatre. Les voitures sont tirées de celles du terrain, dans l'ordre, et la place de chacune ne
 *  dépend que de son rang : une densité qui monte en ajoute sans déplacer les autres.
 */
export function trafficCars(plot: PlotLayout, density: number): PlotCar[] {
  const d = Math.max(0, Math.min(1, density));
  const loop = plot.lanes.forward.reduce((s, t) => s + t.reduce((a, p, i) => (i === 0 ? a : a + Math.hypot(p[0] - t[i - 1][0], p[1] - t[i - 1][1])), 0), 0) || 100;
  const out: PlotCar[] = [];
  for (const reverse of [false, true]) {
    const base = plot.cars.filter((c) => c.reverse === reverse);
    if (base.length === 0) continue;
    const n = Math.max(1, Math.round(1 + d * 15));
    const speed = base[0].speed * (1 - 0.7 * d);
    // Quatre têtes de file réparties sur la boucle ; chaque voiture de plus se range derrière l'une
    // d'elles. La place d'une voiture ne dépend que de son rang : en ajouter n'en déplace aucune.
    for (let i = 0; i < n; i += 1) {
      const c = base[i % base.length];
      const lead = i % 4;
      const rank = Math.floor(i / 4);
      out.push({ ...c, speed, phase: (loop * lead) / 4 + (reverse ? loop / 8 : 0) - rank * 2.6 });
    }
  }
  return out;
}

/** L'aire constructible, en cases. */
export function plotArea(plot: Pick<PlotLayout, "width" | "depth" | "notches">): number {
  return plot.width * plot.depth - plot.notches.reduce((s, n) => s + n.width * n.depth, 0);
}

type Face = "+x" | "-x" | "+y" | "-y";
const FACE_ROTATION: Record<Face, number> = { "-y": 0, "+y": 180, "+x": 90, "-x": 270 };

export function generatePlot(seed: number, opts: { shape?: PlotShape; width?: number; depth?: number; branches?: boolean } = {}): PlotLayout {
  const r = rng(seed * 97 + 13);
  const between = (a: number, b: number) => Math.round(a + r() * (b - a));
  const pick = <T>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const shape: PlotShape = opts.shape ?? pick(PLOT_SHAPES);

  // Les cotes : un carré est carré, les formes découpées sont plus grandes pour garder de la place.
  let W: number;
  let D: number;
  // De quoi construire un vrai centre de distribution : de 70 à 130 m de côté.
  if (shape === "square") W = D = between(36, 48);
  else if (shape === "rect") {
    W = between(46, 62);
    D = between(30, 40);
  } else {
    W = between(52, 66);
    D = between(38, 50);
  }
  W = opts.width ?? W;
  D = opts.depth ?? D;

  const notches: PlotRect[] = [];
  if (shape === "L") {
    const w = between(W * 0.35, W * 0.5);
    const d = between(D * 0.35, D * 0.5);
    const cx = r() < 0.5 ? 0 : W - w;
    const cy = r() < 0.5 ? 0 : D - d;
    notches.push({ x: cx, y: cy, width: w, depth: d });
  } else if (shape === "T") {
    // La barre du T sur un bord, le pied qui descend au milieu : deux échancrures aux coins opposés.
    const stem = between(W * 0.36, W * 0.46);
    const side = Math.floor((W - stem) / 2);
    const d = between(D * 0.4, D * 0.55);
    const y = r() < 0.5 ? 0 : D - d;
    notches.push({ x: 0, y, width: side, depth: d }, { x: side + stem, y, width: W - side - stem, depth: d });
  } else if (shape === "U") {
    const w = between(W * 0.28, W * 0.38);
    const d = between(D * 0.38, D * 0.5);
    const x = Math.round((W - w) / 2);
    notches.push({ x, y: r() < 0.5 ? 0 : D - d, width: w, depth: d });
  }

  const m = 1;
  const o = -m - RW;
  const Sx = W + 2 * m;
  const Sy = D + 2 * m;

  // --- La rue en boucle, et ses départs vers l'extérieur ------------------------------------------
  const roads: PlotTile[] = [];
  // Un passage piéton à chaque bout de tronçon : là où l'on traverse, près des carrefours.
  type Zebra = RoadProps["crosswalk"];
  const hs = (x0: number, y0: number, len: number, flip: boolean, crosswalk: Zebra = "both"): PlotTile => ({ ...ROAD, kind: "straight", length: len, origin: { x: x0, y: y0 }, rotation: 0, flip, crosswalk: len > 5 ? crosswalk : undefined });
  const vs = (x0: number, y0: number, len: number, flip: boolean, crosswalk: Zebra = "both"): PlotTile => {
    const cx = x0 + RW / 2;
    const cy = y0 + len / 2;
    return { ...ROAD, kind: "straight", length: len, origin: { x: cx - len / 2, y: cy - RW / 2 }, rotation: 90, flip, crosswalk: len > 5 ? crosswalk : undefined };
  };
  const tee = (x0: number, y0: number, rotation: number): PlotTile => ({ ...ROAD, kind: "tee", origin: { x: x0, y: y0 }, rotation, flip: true });
  const corner = (x0: number, y0: number, rotation: number): PlotTile => ({ ...ROAD, kind: "corner", origin: { x: x0, y: y0 }, rotation });

  /** Où, le long de chaque côté, part une rue vers l'extérieur (le début de son té), ou rien. */
  const branchAt = (len: number) => (opts.branches === false || r() > 0.55 || len < 16 ? null : Math.round(4 + r() * (len - 8 - RW)));
  const branch = { south: branchAt(Sx), east: branchAt(Sy), north: branchAt(Sx), west: branchAt(Sy) };
  const outward: PlotTile[] = [];
  const BRANCH = FRINGE + 3;

  // Le bas : vers les `x` croissants.
  {
    const x0 = o + RW;
    const b = branch.south;
    if (b === null) roads.push(hs(x0, o, Sx, false));
    else {
      roads.push(hs(x0, o, b, false), tee(x0 + b, o, 180), hs(x0 + b + RW, o, Sx - b - RW, false));
      outward.push(vs(x0 + b, o - BRANCH, BRANCH, false, "end"));
    }
    roads.push(corner(o + RW + Sx, o, 0));
  }
  // La droite : vers les `y` croissants.
  {
    const x0 = o + RW + Sx;
    const y0 = o + RW;
    const b = branch.east;
    if (b === null) roads.push(vs(x0, y0, Sy, false));
    else {
      roads.push(vs(x0, y0, b, false), tee(x0, y0 + b, 270), vs(x0, y0 + b + RW, Sy - b - RW, false));
      outward.push(hs(x0 + RW, y0 + b, BRANCH, false, "start"));
    }
    roads.push(corner(x0, o + RW + Sy, 90));
  }
  // Le haut : vers les `x` décroissants.
  {
    const x0 = o + RW;
    const y0 = o + RW + Sy;
    const b = branch.north;
    if (b === null) roads.push(hs(x0, y0, Sx, true));
    else {
      roads.push(hs(x0 + b + RW, y0, Sx - b - RW, true), tee(x0 + b, y0, 0), hs(x0, y0, b, true));
      outward.push(vs(x0 + b, y0 + RW, BRANCH, false, "start"));
    }
    roads.push(corner(o, y0, 180));
  }
  // La gauche : vers les `y` décroissants.
  {
    const y0 = o + RW;
    const b = branch.west;
    if (b === null) roads.push(vs(o, y0, Sy, true));
    else {
      roads.push(vs(o, y0 + b + RW, Sy - b - RW, true), tee(o, y0 + b, 90), vs(o, y0, b, true));
      outward.push(hs(o - BRANCH, y0 + b, BRANCH, false, "end"));
    }
    roads.push(corner(o, o, 270));
  }
  const forward = roads.map((t) => roadTrack(t, { reverse: !!t.flip }));
  const backward = roads.map((t) => roadTrack(t, { reverse: !t.flip })).reverse();

  // --- Les voisins -------------------------------------------------------------------------------
  const neighbors: BuildingSpec[] = [];
  const trees: TreeSpec[] = [];
  let treeSeed = seed * 1000;
  /** Une rangée de parcelles, façades sur la ligne `edge`, de `a` à `b` le long de la ligne. */
  const row = (face: Face, edge: number, a: number, b: number, depth: number, kinds: BuildingKind[], gaps: [number, number][] = []) => {
    let s = a + 0.4;
    while (s < b - 1) {
      const gap = gaps.find(([g0, g1]) => s + 0.1 > g0 - 0.6 && s < g1 + 0.6);
      if (gap) {
        s = gap[1] + 0.8;
        continue;
      }
      const fits = kinds.filter((k) => lotSize(k).depth <= depth && s + lotSize(k).width <= b - 0.3 && !gaps.some(([g0, g1]) => s + lotSize(k).width > g0 - 0.6 && s < g1 + 0.6));
      if (!fits.length) {
        // Ce qui ne loge plus une parcelle loge un arbre.
        const t = s + 0.8;
        const along = face === "+y" || face === "-y";
        const back = face === "-y" || face === "-x" ? edge + 1.2 : edge - 1.2;
        trees.push({ x: along ? t : back, y: along ? back : t, kind: pick(["round", "conifer", "birch", "fruit", "willow", "shrub", "boxwood", "bush"] as const), seed: treeSeed++ });
        s += 1.6;
        continue;
      }
      const kind = pick(fits);
      const { width: w, depth: d } = lotSize(kind);
      let cx: number;
      let cy: number;
      if (face === "-y") [cx, cy] = [s + w / 2, edge + d / 2];
      else if (face === "+y") [cx, cy] = [s + w / 2, edge - d / 2];
      else if (face === "+x") [cx, cy] = [edge - d / 2, s + w / 2];
      else [cx, cy] = [edge + d / 2, s + w / 2];
      neighbors.push({ kind, seed: seed * 31 + neighbors.length, origin: { x: cx - w / 2, y: cy - d / 2 }, rotation: FACE_ROTATION[face] });
      s += w + 0.3 + r() * 0.6;
    }
  };
  const OUTER: BuildingKind[] = ["house", "house", "pavilion", "apartment", "office", "workshop", "shop", "shop"];
  const outerGap = 0.4;
  const southBranch: [number, number][] = branch.south === null ? [] : [[o + RW + branch.south, o + RW + branch.south + RW]];
  const northBranch: [number, number][] = branch.north === null ? [] : [[o + RW + branch.north, o + RW + branch.north + RW]];
  const eastBranch: [number, number][] = branch.east === null ? [] : [[o + RW + branch.east, o + RW + branch.east + RW]];
  const westBranch: [number, number][] = branch.west === null ? [] : [[o + RW + branch.west, o + RW + branch.west + RW]];
  row("+y", o - outerGap, o, o + 2 * RW + Sx, FRINGE, OUTER, southBranch);
  row("-y", o + 2 * RW + Sy + outerGap, o, o + 2 * RW + Sx, FRINGE, OUTER, northBranch);
  row("+x", o - outerGap, o + 0.5, o + 2 * RW + Sy - 0.5, FRINGE, OUTER, westBranch);
  row("-x", o + 2 * RW + Sx + outerGap, o + 0.5, o + 2 * RW + Sy - 0.5, FRINGE, OUTER, eastBranch);

  // Dans les échancrures : une rangée façade sur la rue, et des arbres derrière.
  const fences: PlotLayout["fences"] = [];
  for (const n of notches) {
    const touchS = n.y === 0;
    const touchN = n.y + n.depth === D;
    const touchW = n.x === 0;
    const touchE = n.x + n.width === W;
    const kinds: BuildingKind[] = ["house", "pavilion", "shop", "office", "house"];
    if (touchS && (n.width >= n.depth || !(touchW || touchE))) row("-y", n.y + 0.2, n.x, n.x + n.width, n.depth - 1, kinds);
    else if (touchN && (n.width >= n.depth || !(touchW || touchE))) row("+y", n.y + n.depth - 0.2, n.x, n.x + n.width, n.depth - 1, kinds);
    else if (touchW) row("-x", n.x + 0.2, n.y, n.y + n.depth, n.width - 1, kinds);
    else if (touchE) row("+x", n.x + n.width - 0.2, n.y, n.y + n.depth, n.width - 1, kinds);
    // La clôture qui sépare l'échancrure du terrain : sur les bords qui touchent le constructible.
    if (!touchW) fences.push({ x0: n.x, y0: n.y, x1: n.x, y1: n.y + n.depth });
    if (!touchE) fences.push({ x0: n.x + n.width, y0: n.y, x1: n.x + n.width, y1: n.y + n.depth });
    if (!touchS) fences.push({ x0: n.x, y0: n.y, x1: n.x + n.width, y1: n.y });
    if (!touchN) fences.push({ x0: n.x, y0: n.y + n.depth, x1: n.x + n.width, y1: n.y + n.depth });
  }

  // Les arbres d'alignement, sur le trottoir extérieur, et les candélabres sur l'intérieur.
  const lights: PlotLayout["lights"] = [];
  const inBranch = (v: number, list: [number, number][]) => list.some(([a, b]) => v > a - 1 && v < b + 1);
  // Une essence d'alignement par site : les rues d'une même ville sont plantées d'une même main.
  const street = pick(["round", "birch", "poplar", "pine", "fruit", "cypress"] as const);
  const streetH = street === "poplar" ? 4 : street === "fruit" ? 2.2 : 2.8;
  for (let x = o + RW + 2; x < o + RW + Sx - 1; x += 4) {
    if (!inBranch(x, southBranch)) trees.push({ x, y: o + 0.5, kind: street, height: streetH, seed: treeSeed++ });
    if (!inBranch(x, northBranch)) trees.push({ x, y: o + 2 * RW + Sy - 0.5, kind: street, height: streetH, seed: treeSeed++ });
  }
  for (let y = o + RW + 2; y < o + RW + Sy - 1; y += 4) {
    if (!inBranch(y, westBranch)) trees.push({ x: o + 0.5, y, kind: street, height: streetH, seed: treeSeed++ });
    if (!inBranch(y, eastBranch)) trees.push({ x: o + 2 * RW + Sx - 0.5, y, kind: street, height: streetH, seed: treeSeed++ });
  }
  for (let x = o + RW + 4; x < o + RW + Sx - 2; x += 8) {
    lights.push({ x, y: o + RW - 0.5, rotation: 270 });
    lights.push({ x, y: o + RW + Sy + 0.5, rotation: 90 });
  }
  for (let y = o + RW + 4; y < o + RW + Sy - 2; y += 8) {
    lights.push({ x: o + RW - 0.5, y, rotation: 180 });
    lights.push({ x: o + RW + Sx + 0.5, y, rotation: 0 });
  }

  // --- Les voitures : même vitesse sur une même voie, réparties sur la boucle ---------------------
  const loop = 2 * (Sx + Sy) + 4 * RW;
  const cars: PlotCar[] = [];
  const kinds: CarKind[] = ["sedan", "hatch", "suv", "van", "sedan", "pickup", "hatch", "suv"];
  const tones: CarTone[] = ["light", "dark", "warm", "cool", "accent"];
  for (const reverse of [false, true]) {
    const n = 3 + Math.floor(r() * 3);
    const speed = reverse ? 2.1 : 2.6;
    for (let i = 0; i < n; i += 1) cars.push({ kind: pick(kinds), tone: pick(tones), reverse, speed, phase: (loop * (i + r() * 0.4)) / n });
  }

  const x0 = o - FRINGE - 1;
  const y0 = o - FRINGE - 1;
  return {
    seed,
    shape,
    width: W,
    depth: D,
    notches,
    margin: m,
    roads: [...roads, ...outward],
    lanes: { forward, backward },
    neighbors,
    trees,
    lights,
    fences,
    cars,
    frame: { x: x0, y: y0, width: 2 * (RW + FRINGE + 1) + Sx, depth: 2 * (RW + FRINGE + 1) + Sy, height: 9 },
  };
}
