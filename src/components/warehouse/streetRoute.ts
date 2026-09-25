import { PLOT_STREET, type PlotLayout } from "./plot";
import { roadSize } from "./Road";

/**
 * Le trajet d'un camion **par les rues** : du bord de la carte, là où une rue quitte le quartier,
 * jusqu'au point de la rue en face d'un portail — et, au départ, l'inverse.
 *
 * ## Le réseau
 *
 *  La rue d'un terrain (`generatePlot`) est une **boucle** autour de lui, d'où partent zéro à quatre
 *  rues vers l'extérieur ; chacune finit au bord de la carte. On en fait un petit graphe : la boucle,
 *  paramétrée sur son pourtour, et pour chaque rue sortante son carrefour sur la boucle et son bout
 *  au bord. Un trajet d'arrivée descend une rue sortante jusqu'à son carrefour, fait le tour de la
 *  boucle par le plus court jusqu'en face du portail, et s'y arrête ; un départ fait l'inverse.
 *
 * ## La voie
 *
 *  On roule **à droite** : chaque tronçon est décalé d'une demi-voie à droite du sens de la marche,
 *  et les virages se raccordent à l'intersection des tronçons décalés — le camion tourne dans sa voie.
 *  Le dernier point est celui qu'on a demandé (le point de la rue en face du portail, `gateEntry`) :
 *  le camion y traverse la voie d'en face s'il le faut, pour tourner vers le portail.
 *
 *  Sans rue sortante — un quartier fermé —, le trajet part du point de la boucle le plus éloigné du
 *  portail : le camion vient quand même de la rue, simplement sans être vu arriver du bord.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface StreetRouteOptions {
  /** Par quelle rue sortante arriver : la plus proche (défaut), ou une tirée au sort par `seed`. */
  from?: "nearest-edge" | "random-edge";
  seed?: number;
  /** `"in"` (défaut) : du bord de la carte au portail ; `"out"` : du portail au bord de la carte. */
  direction?: "in" | "out";
}

interface Ring {
  xL: number;
  xR: number;
  yB: number;
  yT: number;
  perimeter: number;
}

interface Exit {
  junction: Pt;
  edge: Pt;
}

/** La boucle et les rues sortantes d'un terrain, en axes de chaussée. */
export function streetNetwork(plot: PlotLayout): { ring: Ring; exits: Exit[] } {
  const RW = roadSize({ lanes: PLOT_STREET.lanes, laneWidth: PLOT_STREET.laneWidth, sidewalk: PLOT_STREET.sidewalk, kind: "corner" }).width;
  const m = plot.margin;
  const o = -m - RW;
  const Sx = plot.width + 2 * m;
  const Sy = plot.depth + 2 * m;
  const ring: Ring = { xL: o + RW / 2, xR: o + RW + Sx + RW / 2, yB: o + RW / 2, yT: o + RW + Sy + RW / 2, perimeter: 2 * (Sx + RW) + 2 * (Sy + RW) };
  const outer = { x0: o, x1: o + 2 * RW + Sx, y0: o, y1: o + 2 * RW + Sy };
  const exits: Exit[] = [];
  for (const t of plot.roads) {
    if ((t.kind ?? "straight") !== "straight") continue;
    const L = t.length ?? 0;
    const o0 = t.origin ?? { x: 0, y: 0 };
    let a: Pt;
    let b: Pt;
    if ((t.rotation ?? 0) % 180 === 0) {
      a = { x: o0.x, y: o0.y + RW / 2 };
      b = { x: o0.x + L, y: o0.y + RW / 2 };
    } else {
      const cx = o0.x + L / 2;
      const cy = o0.y + RW / 2;
      a = { x: cx, y: cy - L / 2 };
      b = { x: cx, y: cy + L / 2 };
    }
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const inside = mid.x > outer.x0 - 0.1 && mid.x < outer.x1 + 0.1 && mid.y > outer.y0 - 0.1 && mid.y < outer.y1 + 0.1;
    if (inside) continue;
    // Le bout près de la boucle est le carrefour ; on le pose sur l'axe de la boucle.
    const da = distToRing(a, ring);
    const db = distToRing(b, ring);
    const near = da < db ? a : b;
    const far = da < db ? b : a;
    exits.push({ junction: projectRing(near, ring).p, edge: far });
  }
  return { ring, exits };
}

/** La position sur la boucle, en abscisse le long de son pourtour (sens direct : sud vers l'est). */
function ringParam(p: Pt, r: Ring): number {
  const w = r.xR - r.xL;
  const h = r.yT - r.yB;
  const q = projectRing(p, r).p;
  if (Math.abs(q.y - r.yB) < 1e-6) return q.x - r.xL;
  if (Math.abs(q.x - r.xR) < 1e-6) return w + (q.y - r.yB);
  if (Math.abs(q.y - r.yT) < 1e-6) return w + h + (r.xR - q.x);
  return 2 * w + h + (r.yT - q.y);
}

function ringPoint(t: number, r: Ring): Pt {
  const w = r.xR - r.xL;
  const h = r.yT - r.yB;
  const P = 2 * (w + h);
  let u = ((t % P) + P) % P;
  if (u <= w) return { x: r.xL + u, y: r.yB };
  u -= w;
  if (u <= h) return { x: r.xR, y: r.yB + u };
  u -= h;
  if (u <= w) return { x: r.xR - u, y: r.yT };
  u -= w;
  return { x: r.xL, y: r.yT - u };
}

function projectRing(p: Pt, r: Ring): { p: Pt; d: number } {
  const cands: Pt[] = [
    { x: Math.max(r.xL, Math.min(r.xR, p.x)), y: r.yB },
    { x: Math.max(r.xL, Math.min(r.xR, p.x)), y: r.yT },
    { x: r.xL, y: Math.max(r.yB, Math.min(r.yT, p.y)) },
    { x: r.xR, y: Math.max(r.yB, Math.min(r.yT, p.y)) },
  ];
  let best = cands[0];
  let bd = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return { p: best, d: bd };
}

function distToRing(p: Pt, r: Ring) {
  return projectRing(p, r).d;
}

/** Le long de la boucle, de l'abscisse `a` à `b`, par le plus court : les coins traversés compris. */
function alongRing(a: number, b: number, r: Ring): Pt[] {
  const w = r.xR - r.xL;
  const h = r.yT - r.yB;
  const P = 2 * (w + h);
  const fwd = (((b - a) % P) + P) % P;
  const dir = fwd <= P - fwd ? 1 : -1;
  const len = dir > 0 ? fwd : P - fwd;
  const corners = [0, w, w + h, 2 * w + h];
  const pts: Pt[] = [ringPoint(a, r)];
  const passed: number[] = [];
  for (const c of corners) {
    const d = dir > 0 ? (((c - a) % P) + P) % P : (((a - c) % P) + P) % P;
    if (d > 1e-6 && d < len - 1e-6) passed.push(d);
  }
  passed.sort((x, y) => x - y);
  for (const d of passed) pts.push(ringPoint(a + dir * d, r));
  pts.push(ringPoint(b, r));
  return pts;
}

/** Décaler une polyligne d'une demi-voie à droite du sens de la marche, en raccordant les virages. */
function keepRight(pts: Pt[], d: number): Pt[] {
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 1e-3);
  if (clean.length < 2) return clean;
  const seg = clean.slice(1).map((p, i) => {
    const a = clean[i];
    const l = Math.hypot(p.x - a.x, p.y - a.y) || 1;
    const t = { x: (p.x - a.x) / l, y: (p.y - a.y) / l };
    const n = { x: t.y, y: -t.x };
    return { a: { x: a.x + n.x * d, y: a.y + n.y * d }, b: { x: p.x + n.x * d, y: p.y + n.y * d }, t };
  });
  const out: Pt[] = [seg[0].a];
  for (let i = 1; i < seg.length; i += 1) {
    const s0 = seg[i - 1];
    const s1 = seg[i];
    const cross = s0.t.x * s1.t.y - s0.t.y * s1.t.x;
    if (Math.abs(cross) < 1e-6) {
      out.push(s1.a);
      continue;
    }
    const k = ((s1.a.x - s0.a.x) * s1.t.y - (s1.a.y - s0.a.y) * s1.t.x) / cross;
    out.push({ x: s0.a.x + s0.t.x * k, y: s0.a.y + s0.t.y * k });
  }
  out.push(seg[seg.length - 1].b);
  // Un semi qui tourne à droite, près du trottoir, élargit son virage : il mord sur l'autre voie
  // plutôt que sur le trottoir (sa remorque coupe le virage). Le sommet est poussé vers l'extérieur.
  for (let i = 1; i < seg.length; i += 1) {
    const t0 = seg[i - 1].t;
    const t1 = seg[i].t;
    const cross = t0.x * t1.y - t0.y * t1.x;
    if (cross > -0.3) continue;
    const bx = t0.x - t1.x;
    const by = t0.y - t1.y;
    const l = Math.hypot(bx, by) || 1;
    out[i] = { x: out[i].x + (bx / l) * RIGHT_TURN_SWING, y: out[i].y + (by / l) * RIGHT_TURN_SWING };
  }
  return out;
}

/** De combien un semi élargit un virage à droite, en cases. */
const RIGHT_TURN_SWING = 2.8;

/**
 * Le trajet par les rues entre le bord de la carte et `target` (le point de la rue en face d'un
 * portail : `gateEntry(...).entry`, ou le résultat entier). À passer à `PlannerDockTraffic.approach`
 * (`direction: "in"`, défaut) et `leave` (`direction: "out"`).
 */
export function streetRoute(plot: PlotLayout, target: Pt | { entry: Pt }, opts: StreetRouteOptions = {}): Pt[] {
  const goal = "entry" in target ? target.entry : target;
  const { ring, exits } = streetNetwork(plot);
  const tGoal = ringParam(goal, ring);
  const lane = PLOT_STREET.laneWidth / 2;
  let center: Pt[];
  if (!exits.length) {
    // Un quartier fermé : on part du point de la boucle le plus loin du portail.
    center = alongRing(tGoal + ring.perimeter / 2, tGoal, ring);
  } else {
    const routes = exits.map((ex) => {
      const inner = alongRing(ringParam(ex.junction, ring), tGoal, ring);
      const pts = [ex.edge, ex.junction, ...inner.slice(1)];
      let len = 0;
      for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      return { pts, len };
    });
    let pick = routes.reduce((a, b) => (b.len < a.len ? b : a));
    if (opts.from === "random-edge") {
      const r = Math.abs(Math.sin((opts.seed ?? 1) * 12.9898) * 43758.5453) % 1;
      pick = routes[Math.floor(r * routes.length) % routes.length];
    }
    center = pick.pts;
  }
  const inbound = [...keepRight(center, lane).slice(0, -1), goal];
  if (opts.direction !== "out") return inbound;
  // Le départ : le même chemin à rebours, dans l'autre voie, depuis le portail.
  const back = keepRight([...center].reverse(), lane);
  return [goal, ...back.slice(1)];
}
