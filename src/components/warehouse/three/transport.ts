import type { P3 } from "./builder";

/**
 * Les itinéraires : le chemin que suivent les marchandises, **d'un module à l'autre**.
 *
 * ## Pourquoi au niveau de la scène
 *
 * Le dessin isométrique faisait voyager chaque colis *dans* un tapis : le tapis le dessinait, le
 * faisait avancer, puis le faisait disparaître à son bout, et le tapis suivant en faisait apparaître
 * un autre au même instant — avec des réglages de phase pour que les deux coïncident. À la moindre
 * dérive, à la moindre différence de vitesse ou de gabarit, le colis clignotait ou sautait à la
 * jonction. Et un colis qui passe d'un tapis à une chute, puis à un bac, traversait trois modules qui
 * ne se connaissaient pas.
 *
 * Ici, **aucun module ne possède un colis**. Chaque module de manutention expose sa *piste* — la
 * ligne que suit une charge posée dessus, en coordonnées monde — et la scène les met bout à bout
 * en un seul itinéraire, que les colis parcourent d'un bout à l'autre. Il n'y a donc pas de
 * jonction du point de vue d'un colis : il avance le long d'une seule courbe, et les modules ne sont
 * que ce qui se trouve dessous. C'est la condition pour qu'une marchandise ne disparaisse jamais en
 * changeant de module — et pour qu'un jeu puisse la suivre, la compter, la dérouter.
 *
 * ## Les raccords
 *
 * Deux pistes qui se touchent se raccordent telles quelles. Deux pistes séparées par un vide se
 * raccordent par un segment droit — un transfert. Et quand la suivante est **plus basse** de plus
 * d'un palier, le raccord est une **chute** : une parabole, le colis quittant le bout du tapis avec
 * sa vitesse et tombant en accélérant, comme il le fait sur une vraie ligne de tri.
 */

export interface Route {
  points: P3[];
  /** La longueur cumulée jusqu'à chaque point. */
  cum: number[];
  length: number;
  closed: boolean;
}

const dist = (a: P3, b: P3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** Le raccord entre la fin d'une piste et le début de la suivante. */
function bridge(a: P3, b: P3, before: P3 | undefined): P3[] {
  const gap = dist(a, b);
  if (gap < 1e-3) return [];
  const fall = a[2] - b[2];
  if (fall > 0.08) {
    // Une chute : le colis garde sa direction et tombe en parabole jusqu'au point d'arrivée.
    const out: P3[] = [];
    const n = 10;
    for (let i = 1; i <= n; i += 1) {
      const u = i / n;
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] - fall * u * u]);
    }
    void before;
    return out;
  }
  return [b];
}

/** Mettre des pistes bout à bout en un itinéraire. `closed` : le dernier point rejoint le premier. */
export function makeRoute(tracks: P3[] | P3[][], closed = false): Route {
  const list: P3[][] = tracks.length > 0 && Array.isArray((tracks as P3[][])[0][0]) ? (tracks as P3[][]) : [tracks as P3[]];
  const points: P3[] = [];
  for (const t of list) {
    if (t.length === 0) continue;
    if (points.length === 0) points.push(...t);
    else {
      const last = points[points.length - 1];
      points.push(...bridge(last, t[0], points[points.length - 2]));
      const first = dist(points[points.length - 1], t[0]) < 1e-3 ? 1 : 0;
      points.push(...t.slice(first));
    }
  }
  if (closed && points.length > 1) {
    const a = points[points.length - 1];
    if (dist(a, points[0]) > 1e-3) points.push(...bridge(a, points[0], points[points.length - 2]));
    if (dist(points[points.length - 1], points[0]) > 1e-3) points.push(points[0]);
  }
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  return { points, cum, length: cum[cum.length - 1] ?? 0, closed };
}

export interface RoutePose {
  x: number;
  y: number;
  z: number;
  /** Le cap du mouvement, en radians, dans le plan du sol. */
  heading: number;
  /** La pente du mouvement, en radians. */
  pitch: number;
}

/** Où en est-on à la distance `s` le long de l'itinéraire. */
export function sampleRoute(route: Route, s: number): RoutePose {
  const { points, cum, length } = route;
  if (points.length === 0) return { x: 0, y: 0, z: 0, heading: 0, pitch: 0 };
  if (points.length === 1) return { x: points[0][0], y: points[0][1], z: points[0][2], heading: 0, pitch: 0 };
  let d = route.closed ? ((s % length) + length) % length : Math.max(0, Math.min(length, s));
  // Recherche par dichotomie du segment qui contient `d`.
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const seg = cum[hi] - cum[lo] || 1;
  d = (d - cum[lo]) / seg;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  // Le cap se lisse sur les points voisins, pour qu'un colis tourne dans un virage au lieu de
  // pivoter d'un coup à chaque sommet du polygone qui l'approche.
  const flat = Math.hypot(dx, dy);
  return {
    x: a[0] + dx * d,
    y: a[1] + dy * d,
    z: a[2] + dz * d,
    heading: flat > 1e-6 ? Math.atan2(dy, dx) : 0,
    pitch: Math.atan2(dz, flat || 1e-6),
  };
}

/** Transformer une piste locale à un module par la pose de ce module. */
export function transformTrack(track: P3[], m: { elements: ArrayLike<number> }): P3[] {
  const e = m.elements;
  return track.map(([x, y, z]) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]);
}
