import { forwardTruck, reverseTruck, sampleTrack, smoothLine, resample, filletPolyline, type Pt, type Track } from "./three/drive";
import { makeZone, type OrientedBox, type TrafficZone } from "./three/traffic";
import { semiTruckGeometry } from "./SemiTruck";
import { TRUCK_BAY_LENGTH, TRUCK_BAY_WIDTH } from "./plannerModel";

/**
 * La manœuvre d'un semi-remorque qui vient se mettre à quai — **tracée d'avance**, sans rien
 * dessiner : `PlannerDockTraffic` la fait jouer, `dockTrafficClearance` en tire la place qu'elle
 * prend.
 *
 * ## Comme un chauffeur
 *
 *  Tout se passe dans le repère du parking poids lourds (voir `TRUCK_BAY_LENGTH`) : `u` le long des
 *  places, l'entrée en `−u`, le bout quai en `+u` ; `v` en travers.
 *
 *  1. **L'approche**, en marche avant : le camion arrive de `entry`, vient longer l'entrée des
 *     places à bonne distance, tourne pour la longer (vers les `v` décroissants) et la dépasse de ce
 *     qu'il faut — assez longtemps en ligne droite pour que la remorque, qui a suivi le virage en
 *     coupant, se soit remise dans l'axe du tracteur ;
 *  2. **la marche arrière** : c'est l'**essieu de la remorque** qui suit un chemin lisse — une
 *     droite, un quart de cercle bien plus large que la remorque n'est longue, puis l'axe de la
 *     place jusqu'au quai, raccordés par des entrées en courbe progressives. La sellette s'en déduit,
 *     et le tracteur prend le cap qu'elle lui impose, en braquant d'un côté puis de l'autre, comme
 *     on le fait vraiment ;
 *  3. **le départ**, en marche avant : tout droit hors de la place, jusqu'à ce que la remorque en soit
 *     sortie, puis vers `entry`, la remorque suivant.
 *
 *  Tout est calculé une fois, au montage : les trois trajets s'enchaînent exactement — chacun part
 *  de la pose où le précédent a laissé le tracteur **et** la remorque.
 */

const TRUCK = semiTruckGeometry();
/** De la sellette à l'essieu de la remorque. */
export const TRAILER_WHEELBASE = TRUCK.kingpin - TRUCK.trailerAxle;
/** Le rayon de braquage du tracteur en marche avant, en cases. */
const DRIVE_RADIUS = 4.5;
/** Le rayon du quart de cercle que décrit l'essieu de la remorque en reculant. */
const SWING = 6;
/** Où l'essieu de la remorque finit son virage : une case avant l'entrée de la place. */
const RUN_IN = 1;
/** La ligne droite de recul avant le virage, et ce que le camion dépasse de la place. */
const STRAIGHT = 2.5;
/** Où s'arrête l'arrière de la remorque : un rien avant le bout quai. */
const DOCK_GAP = 0.15;
/** Le pas d'échantillonnage des trajets, et la longueur d'entrée en courbe. */
const STEP = 0.1;
const EASE = 2;

export interface DockBay {
  x: number;
  y: number;
  /** En degrés. */
  rotation: number;
  bays?: number;
}

/** Un rectangle du plan, aligné sur les axes, en cases : un bout de terrain où les camions ont le droit d'être. */
export interface YardRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/** Une ouverture dans la clôture — un portail : son milieu sur la clôture, sa largeur, et le côté du
 *  terrain où il est (le dehors est au-delà de ce côté). */
export interface YardOpening {
  x: number;
  y: number;
  width: number;
  edge: "south" | "north" | "west" | "east";
}

export interface DockPlanOptions {
  /**
   * Le terrain clos, où les camions manœuvrent : un ou plusieurs rectangles. Donné, un camion n'en
   * sort **que par une ouverture** (`openings`), sur ses trajets d'arrivée et de départ ; la manœuvre
   * choisit la variante qui tient dedans. Absent : pas de contrainte, comme avant.
   */
  bounds?: YardRect[];
  /** Les portails de la clôture. */
  openings?: YardOpening[];
  /** Un portail de sortie à part (une cour à sens unique) : le point de la rue où l'on sort. Défaut : `entry`. */
  exit?: Pt;
  /** Les points de passage vers la sortie, dans l'ordre de la marche. Défaut : `via` à rebours. */
  exitVia?: Pt[];
  /** La route avant `entry` : par les rues, depuis le bord de la carte (`streetRoute`). */
  approach?: Pt[];
  /** La route après la sortie, jusqu'au bord de la carte. */
  leave?: Pt[];
}

export interface DockLane {
  /** L'approche, la marche arrière, le départ : la sellette, le cap du tracteur, celui de la remorque. */
  approach: Track;
  reverse: Track;
  depart: Track;
  /** Garé : la sellette et le cap (tracteur et remorque, alignés). */
  park: { x: number; y: number; heading: number };
  /** L'arrière des portes, là où un chargeur vient poser ou prendre. */
  dock: Pt;
  /** Devant les portes, dans l'axe de la place, côté entrepôt. */
  apron: Pt;
  /** Où, sur l'approche, un camion attend son tour avant la cour (en cases le long du trajet). */
  hold: number;
  /** Où, sur le départ, il a quitté la cour et la rend. */
  clear: number;
  /** La variante retenue : le dépassement vers les `v` décroissants (1) ou croissants (−1). */
  side: 1 | -1;
  /** La manœuvre ne tient pas dans le terrain (ou n'y a pas d'accès) : on ne fait pas venir de camion. */
  blocked?: DockYardProblem;
}

export interface DockPlan {
  lanes: DockLane[];
  entry: Pt;
  /** Du repère du parking au plan. */
  world: (u: number, v: number) => Pt;
}

export interface DockYardProblem {
  code: "NO_ROOM" | "NO_ACCESS";
  message: string;
  /** La cour qu'il faudrait, à peu près : le pavé que balaie la manœuvre. */
  needed?: YardRect;
}

/** L'axe de la place `i`, en travers. */
const laneV = (bays: number, i: number) => (-bays * TRUCK_BAY_WIDTH) / 2 + TRUCK_BAY_WIDTH * (i + 0.5);

function smooth(points: Pt[], radius: number): Pt[] {
  // Deux points confondus feraient un cap indéfini : on les écarte.
  const clean = points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 0.05);
  return smoothLine(resample(filletPolyline(clean, radius), STEP), Math.round(EASE / STEP), 2);
}

/** L'abscisse du point d'un trajet le plus proche de `p`. */
function nearestS(track: Track, p: Pt): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < track.s.length; i += 1) {
    const d = (track.x[i] - p.x) ** 2 + (track.y[i] - p.y) ** 2;
    if (d < bd) {
      bd = d;
      best = track.s[i];
    }
  }
  return best;
}

/**
 * Toute la manœuvre de chaque place d'un parking poids lourds.
 *
 *  `via` : des points de passage entre `entry` et les places — le bord d'une voie d'accès, un
 *  portail. Le camion les suit à l'aller dans l'ordre, et au départ dans l'ordre inverse (ou par
 *  `exitVia` jusqu'à `exit`, pour une cour à sens unique) ; le trajet reste lissé au rayon de
 *  braquage, et il **part aligné** sur le premier tronçon. `approach` et `leave` le prolongent par
 *  les rues jusqu'au bord de la carte.
 *
 *  Avec `bounds`, la manœuvre est essayée dans ses deux sens — dépasser la place d'un côté ou de
 *  l'autre avant de reculer — et la première qui tient dans le terrain (sans franchir la clôture
 *  ailleurs qu'à une ouverture) est retenue ; si aucune ne tient, la place est marquée `blocked`.
 */
export function planDock(bay: DockBay, entry?: Pt, via: Pt[] = [], opts: DockPlanOptions = {}): DockPlan {
  const bays = Math.max(1, Math.round(bay.bays ?? 1));
  const th = (bay.rotation * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const world = (u: number, v: number): Pt => ({ x: bay.x + u * c - v * s, y: bay.y + u * s + v * c });
  const local = (p: Pt) => {
    const dx = p.x - bay.x;
    const dy = p.y - bay.y;
    return { u: dx * c + dy * s, v: -dx * s + dy * c };
  };
  const Lb = TRUCK_BAY_LENGTH;
  const Lt = TRAILER_WHEELBASE;
  const E = entry ?? world(-Lb / 2 - 14, 0);
  const X = opts.exit ?? E;
  const exitVia = opts.exitVia ?? [...via].reverse();
  const approachRoad = opts.approach ?? [];
  const leaveRoad = opts.leave ?? [];
  // Le dernier point de passage — le bout de la voie d'accès, un portail — tient lieu d'entrée pour
  // placer la ligne où le camion vient longer les places.
  const e = local(via[via.length - 1] ?? E);
  const parked = th + Math.PI;

  const variant = (i: number, side: 1 | -1): DockLane => {
    const v = laneV(bays, i);
    // Garé : l'arrière de la remorque au bout quai, son essieu devant, la sellette encore devant.
    const rearU = Lb / 2 - DOCK_GAP;
    const axleU = rearU - TRUCK.trailerAxle;
    const hitchU = axleU - Lt;
    const park = world(hitchU, v);
    // La ligne où le camion s'aligne avant de reculer : assez loin de l'entrée pour que le virage de
    // la remorque se finisse avant elle.
    const u0 = -Lb / 2 - RUN_IN - SWING;
    const stopV = v - side * (SWING + STRAIGHT + Lt);
    const topV = side > 0 ? Math.max(e.v, v + 1.5) : Math.min(e.v, v - 1.5);

    // 1. L'approche : des rues à l'entrée, puis au bord de la place, le long de l'entrée, jusqu'à l'arrêt.
    const approachPts = smooth([...approachRoad, E, ...via, world(u0, topV), world(u0, stopV)], DRIVE_RADIUS);
    const h0 = Math.atan2(approachPts[1].y - approachPts[0].y, approachPts[1].x - approachPts[0].x);
    const approach = forwardTruck(approachPts, h0, Lt, h0);

    // 2. La marche arrière, depuis la pose réelle où l'approche a laissé le camion : l'essieu de la
    //    remorque recule tout droit dans son axe, tourne sur un grand rayon, et entre dans la place.
    const end = sampleTrack(approach, approach.length);
    const trailer = end.trailer ?? end.heading;
    const axle0 = { x: end.x - Math.cos(trailer) * Lt, y: end.y - Math.sin(trailer) * Lt };
    const a0 = local(axle0);
    const back = trailer + Math.PI - th;
    const sinB = Math.sin(back);
    const t = Math.abs(sinB) > 0.2 ? (v - a0.v) / sinB : SWING + STRAIGHT;
    const corner = { u: a0.u + Math.cos(back) * t, v: a0.v + Math.sin(back) * t };
    const axlePts = smooth([axle0, world(corner.u, corner.v), world(axleU, v)], SWING);
    const reverse = reverseTruck(axlePts, Lt, end.heading);

    // 3. Le départ : tout droit jusqu'à ce que la remorque soit sortie, puis vers la sortie, et les rues.
    const out = -Lb / 2 - 0.8 - TRUCK.kingpin - EASE - 1;
    const departPts = smooth([park, world(Math.min(out, hitchU - 2), v), ...exitVia, X, ...leaveRoad], DRIVE_RADIUS);
    const depart = forwardTruck(departPts, parked, Lt, parked);

    // Où il attend son tour : un camion et deux cases avant l'entrée (dans la rue, avant le portail) ;
    // où il rend la cour : un camion après la sortie.
    const hold = Math.max(0, nearestS(approach, E) - TRUCK.length - 2);
    const clear = Math.min(depart.length, nearestS(depart, X) + TRUCK.length + 1);
    return {
      approach,
      reverse,
      depart,
      park: { ...park, heading: parked },
      dock: world(Lb / 2 + 0.9, v),
      apron: world(Lb / 2 + 2.6, v),
      hold,
      clear,
      side,
    };
  };

  const lanes = Array.from({ length: bays }, (_, i): DockLane => {
    const first = variant(i, 1);
    if (!opts.bounds?.length) return first;
    const p1 = yardFit(first, opts.bounds, opts.openings ?? [], E);
    if (!p1) return first;
    const second = variant(i, -1);
    const p2 = yardFit(second, opts.bounds, opts.openings ?? [], E);
    if (!p2) return second;
    // Ni l'une ni l'autre : la place est marquée, avec ce qu'il faudrait.
    return { ...first, blocked: p1.code === "NO_ACCESS" && p2.code === "NO_ACCESS" ? p1 : p1.code === "NO_ROOM" ? p1 : p2 };
  });
  return { lanes, entry: E, world };
}

const inRect = (p: Pt, r: YardRect, eps = 0.02) => p.x >= r.x - eps && p.x <= r.x + r.width + eps && p.y >= r.y - eps && p.y <= r.y + r.depth + eps;

/** L'ouverture posée sur sa clôture : ses deux bouts. */
function openingSpan(o: YardOpening): [Pt, Pt] {
  const h = o.width / 2;
  return o.edge === "south" || o.edge === "north"
    ? [
        { x: o.x - h, y: o.y },
        { x: o.x + h, y: o.y },
      ]
    : [
        { x: o.x, y: o.y - h },
        { x: o.x, y: o.y + h },
      ];
}

function segCross(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + rx * t, y: a.y + ry * t };
}

/**
 * La manœuvre d'une place tient-elle dans le terrain ? `null` si oui ; sinon ce qui ne va pas. Aucun
 * côté du camion (tracteur, remorque) ne doit **croiser la clôture** ailleurs qu'à une ouverture, et,
 * une fois entré, le camion ne ressort pas du terrain avant son départ.
 */
function yardFit(lane: DockLane, bounds: YardRect[], openings: YardOpening[], entry: Pt): DockYardProblem | null {
  const spans = openings.map(openingSpan);
  // La clôture : les bords des rectangles, sauf ce qui court à l'intérieur d'un autre.
  const fence: [Pt, Pt][] = [];
  for (const r of bounds)
    fence.push(
      [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }],
      [{ x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.depth }],
      [{ x: r.x + r.width, y: r.y + r.depth }, { x: r.x, y: r.y + r.depth }],
      [{ x: r.x, y: r.y + r.depth }, { x: r.x, y: r.y }]
    );
  const interior = (p: Pt) => bounds.some((r) => p.x > r.x + 0.05 && p.x < r.x + r.width - 0.05 && p.y > r.y + 0.05 && p.y < r.y + r.depth - 0.05);
  const inGap = (p: Pt) =>
    spans.some(([a, b]) => {
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l);
      const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / l;
      return d < 0.4 && t >= 0 && t <= 1;
    });
  const inB = (p: Pt) => bounds.some((r) => inRect(p, r));
  type Pose = { c: Pt[]; track: "approach" | "reverse" | "depart"; s: number };
  const poses: Pose[] = [];
  for (const [name, track] of [
    ["approach", lane.approach],
    ["reverse", lane.reverse],
    ["depart", lane.depart],
  ] as const)
    for (let s = 0; s <= track.length; s += 0.5) {
      const q = sampleTrack(track, s);
      poses.push({ c: truckCorners(q.x, q.y, q.heading, q.trailer ?? q.heading), track: name, s });
    }
  const entryS = nearestS(lane.approach, entry);
  const needed = (): YardRect => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const q of poses)
      if ((q.track !== "approach" || q.s > entryS) && q.c.some(inB))
        for (const p of q.c) {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        }
    return { x: x0, y: y0, width: x1 - x0, depth: y1 - y0 };
  };
  const firstIn = poses.findIndex((q) => q.c.every(inB));
  if (firstIn < 0) return { code: "NO_ACCESS", message: "Ce quai est hors du terrain clos : les camions ne peuvent pas l'atteindre.", needed: needed() };
  for (let i = 0; i < poses.length; i += 1) {
    const q = poses[i];
    let crosses = false;
    // Un côté du tracteur ou de la remorque qui coupe la clôture hors d'une ouverture.
    for (const k of [0, 4]) {
      for (let j = 0; j < 4 && !crosses; j += 1) {
        const a = q.c[k + j];
        const b = q.c[k + ((j + 1) % 4)];
        for (const [f0, f1] of fence) {
          const x = segCross(a, b, f0, f1);
          if (x && !interior(x) && !inGap(x)) {
            crosses = true;
            break;
          }
        }
      }
    }
    if (!crosses) continue;
    // Avant d'avoir franchi l'entrée, c'est l'accès qui manque ; après, la place.
    if (q.track === "approach" && i <= firstIn) return { code: "NO_ACCESS", message: "Aucun portail ne permet aux camions d'atteindre ce quai sans traverser la clôture.", needed: needed() };
    const n = needed();
    const meters = Math.round(Math.max(n.width, n.depth));
    return { code: "NO_ROOM", message: `Pas assez de place devant le quai pour qu'un semi-remorque manœuvre (il faut environ ${meters} m de cour).`, needed: n };
  }
  return null;
}

/**
 * Où un engin vient charger ou décharger chaque place d'un quai : `door`, contre l'arrière du camion
 * à quai ; `apron`, un peu en retrait, dans l'axe de la place — là où un transporteur de flotte
 * s'approche avant d'entrer. Pour une tâche de `PlannerTransporter` : `{ from: stock, to: door }`
 * (expédition) ou `{ from: door, to: stock }` (réception).
 */
export function dockLoadingPoints(bay: DockBay): { door: Pt; apron: Pt }[] {
  return planDock(bay).lanes.map((l) => ({ door: l.dock, apron: l.apron }));
}

/**
 * Le quai a-t-il la place de faire manœuvrer ses camions ? `null` si oui ; sinon le problème, en
 * français, pour refuser ou prévenir : `NO_ROOM` (la cour est trop petite), `NO_ACCESS` (aucun
 * portail n'y mène). `needed` : le pavé que la manœuvre balaie, à peu près.
 */
export function dockYardProblem(bay: DockBay, opts: { bounds: YardRect[]; openings?: YardOpening[]; entry?: Pt; via?: Pt[]; exit?: Pt; exitVia?: Pt[] }): DockYardProblem | null {
  const plan = planDock(bay, opts.entry, opts.via ?? [], opts);
  return plan.lanes.find((l) => l.blocked)?.blocked ?? null;
}

/** Les rectangles orientés que couvre un camion posé — tracteur et remorque, élargis de `margin`. */
export function truckBoxes(x: number, y: number, tractor: number, trailer: number, margin = 0.3): OrientedBox[] {
  const hw = TRUCK.width / 2 + margin;
  const t0 = TRUCK.tractor0 - TRUCK.kingpin - 0.1;
  const t1 = TRUCK.length - TRUCK.kingpin;
  const r0 = -TRUCK.kingpin;
  const r1 = TRUCK.trailer - TRUCK.kingpin;
  const box = (a: number, b: number, h: number): OrientedBox => {
    const mid = (a + b) / 2;
    return { cx: x + Math.cos(h) * mid, cy: y + Math.sin(h) * mid, hl: (b - a) / 2 + margin, hw, angle: h };
  };
  return [box(t0, t1, tractor), box(r0, r1, trailer)];
}

/** La zone que balaie un morceau de trajet : les rectangles des poses, tous les `step`. */
export function sweptZone(track: Track, s0: number, s1: number, step = 1): TrafficZone {
  const boxes: OrientedBox[] = [];
  for (let s = s0; s <= s1 + 1e-6; s = s >= s1 ? s1 + 1 : Math.min(s1, s + step)) {
    const q = sampleTrack(track, s);
    boxes.push(...truckBoxes(q.x, q.y, q.heading, q.trailer ?? q.heading));
    if (s >= s1) break;
  }
  return makeZone(boxes);
}

// --- La place que prend la manœuvre ------------------------------------------------------------------

/** Les coins d'un semi posé par sa sellette, le cap du tracteur et celui de la remorque. */
export function truckCorners(x: number, y: number, tractor: number, trailer: number): Pt[] {
  const W = TRUCK.width / 2;
  const out: Pt[] = [];
  const box = (x0: number, x1: number, h: number) => {
    const c = Math.cos(h);
    const s = Math.sin(h);
    for (const [u, v] of [
      [x0, -W],
      [x1, -W],
      [x1, W],
      [x0, W],
    ])
      out.push({ x: x + u * c - v * s, y: y + u * s + v * c });
  };
  box(TRUCK.tractor0 - TRUCK.kingpin - 0.1, TRUCK.length - TRUCK.kingpin, tractor);
  box(-TRUCK.kingpin, TRUCK.trailer - TRUCK.kingpin, trailer);
  return out;
}

export interface DockClearanceOptions {
  /** Le point d'où viennent les camions, comme `PlannerDockTraffic.entry`. Défaut : le sien. */
  entry?: Pt;
  /** Les points de passage, comme `PlannerDockTraffic.via`. */
  via?: Pt[];
  /** La marge autour de ce que balaie le camion, en cases. Défaut : 0,6. */
  margin?: number;
  /** La longueur de trajet couverte par un rectangle, en cases : plus court, plus serré. Défaut : 4. */
  chunk?: number;
  /** Le terrain clos et ses portails, la sortie à part : comme `PlannerDockTraffic` (voir `DockPlanOptions`). */
  bounds?: YardRect[];
  openings?: YardOpening[];
  exit?: Pt;
  exitVia?: Pt[];
}

/**
 * La place que prend la manœuvre d'un `PlannerDockTraffic` : des rectangles alignés sur les axes,
 * en cases, qui couvrent **tout ce que balaient les camions** — l'approche depuis `entry`, le
 * virage de la marche arrière, la place elle-même et le départ. Pour y écarter ce qu'un camion
 * accrocherait : `WarehousePlanner lightExclusions={bays.flatMap((b) => dockTrafficClearance(b))}`.
 *
 *  Le calcul rejoue la manœuvre elle-même (`planDock`) : chaque trajet est découpé en tronçons de
 *  `chunk` cases, et chaque tronçon donne le rectangle qui contient toutes les poses du tracteur et
 *  de la remorque qu'on y prend, élargi de `margin`. Les rectangles contenus dans un autre sont ôtés.
 */
export function dockTrafficClearance(bay: DockBay, opts: DockClearanceOptions = {}): { x: number; y: number; width: number; depth: number }[] {
  const plan = planDock(bay, opts.entry, opts.via, { bounds: opts.bounds, openings: opts.openings, exit: opts.exit, exitVia: opts.exitVia });
  const margin = opts.margin ?? 0.6;
  const chunk = Math.max(0.5, opts.chunk ?? 4);
  const rects: { x: number; y: number; width: number; depth: number }[] = [];
  for (const lane of plan.lanes)
    for (const track of [lane.approach, lane.reverse, lane.depart]) {
      for (let s0 = 0; s0 < track.length || s0 === 0; s0 += chunk) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        const s1 = Math.min(track.length, s0 + chunk);
        for (let s = s0; ; s = Math.min(s1, s + 0.3)) {
          const p = sampleTrack(track, s);
          for (const q of truckCorners(p.x, p.y, p.heading, p.trailer ?? p.heading)) {
            x0 = Math.min(x0, q.x);
            y0 = Math.min(y0, q.y);
            x1 = Math.max(x1, q.x);
            y1 = Math.max(y1, q.y);
          }
          if (s >= s1) break;
        }
        rects.push({ x: x0 - margin, y: y0 - margin, width: x1 - x0 + 2 * margin, depth: y1 - y0 + 2 * margin });
        if (track.length === 0) break;
      }
    }
  const inside = (a: (typeof rects)[number], b: (typeof rects)[number]) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.depth <= b.y + b.depth;
  return rects.filter((r, i) => !rects.some((o, j) => j !== i && inside(r, o) && (!inside(o, r) || j < i)));
}
