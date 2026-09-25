import { forwardTruck, reverseTruck, sampleTrack, smoothLine, resample, filletPolyline, type Pt, type Track } from "./three/drive";
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
}

export interface DockPlan {
  lanes: DockLane[];
  entry: Pt;
  /** Du repère du parking au plan. */
  world: (u: number, v: number) => Pt;
}

/** L'axe de la place `i`, en travers. */
const laneV = (bays: number, i: number) => (-bays * TRUCK_BAY_WIDTH) / 2 + TRUCK_BAY_WIDTH * (i + 0.5);

function smooth(points: Pt[], radius: number): Pt[] {
  return smoothLine(resample(filletPolyline(points, radius), STEP), Math.round(EASE / STEP), 2);
}

/** Toute la manœuvre de chaque place d'un parking poids lourds. */
export function planDock(bay: DockBay, entry?: Pt): DockPlan {
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
  const e = local(E);
  const parked = th + Math.PI;

  const lanes = Array.from({ length: bays }, (_, i): DockLane => {
    const v = laneV(bays, i);
    // Garé : l'arrière de la remorque au bout quai, son essieu devant, la sellette encore devant.
    const rearU = Lb / 2 - DOCK_GAP;
    const axleU = rearU - TRUCK.trailerAxle;
    const hitchU = axleU - Lt;
    const park = world(hitchU, v);
    // La ligne où le camion s'aligne avant de reculer : assez loin de l'entrée pour que le virage de
    // la remorque se finisse avant elle.
    const u0 = -Lb / 2 - RUN_IN - SWING;
    const stopV = v - SWING - STRAIGHT - Lt;
    const topV = Math.max(e.v, v + 1.5);

    // 1. L'approche : de l'entrée au bord de la place, puis le long de l'entrée, jusqu'à l'arrêt.
    const approachPts = smooth([E, world(u0, topV), world(u0, stopV)], DRIVE_RADIUS);
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

    // 3. Le départ : tout droit jusqu'à ce que la remorque soit sortie, puis vers l'entrée.
    const out = -Lb / 2 - 0.8 - TRUCK.kingpin - EASE - 1;
    const departPts = smooth([park, world(Math.min(out, hitchU - 2), v), E], DRIVE_RADIUS);
    const depart = forwardTruck(departPts, parked, Lt, parked);

    return {
      approach,
      reverse,
      depart,
      park: { ...park, heading: parked },
      dock: world(Lb / 2 + 0.9, v),
      apron: world(Lb / 2 + 2.6, v),
    };
  });
  return { lanes, entry: E, world };
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
  /** La marge autour de ce que balaie le camion, en cases. Défaut : 0,6. */
  margin?: number;
  /** La longueur de trajet couverte par un rectangle, en cases : plus court, plus serré. Défaut : 4. */
  chunk?: number;
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
  const plan = planDock(bay, opts.entry);
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
