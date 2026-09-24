import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { P3 } from "./builder";
import { useSimFrame } from "./time";
import { makeRoute, sampleRoute, type Route } from "./transport";

/**
 * Suivre un itinéraire : ce qui fait rouler un robot, un chariot, une voiture.
 *
 *  Un véhicule qui suit un itinéraire n'a plus de position propre : il est, à chaque instant, là où
 *  l'itinéraire le met, tourné dans le sens du mouvement. C'est le même calcul que celui des colis
 *  (`Cargo`) et la même horloge — si bien qu'un robot et la charge qu'il porte ne peuvent pas se
 *  séparer, et qu'un robot qui dépose un colis au bout d'un tapis le fait **au moment où** le tapis
 *  le reprend.
 *
 *  Une voiture, elle, ne prend pas un virage à la vitesse d'une ligne droite : `corners` dit de
 *  combien elle ralentit dans la courbe la plus serrée (`0.5` : de moitié). La vitesse est tirée de
 *  la courbure, segment par segment, et le temps de parcours intégré une fois pour toutes : le
 *  véhicule freine à l'entrée du virage et réaccélère à sa sortie, sans à-coup.
 */
export interface Follow {
  /** Les pistes parcourues, en coordonnées monde. */
  route: P3[] | P3[][];
  /** L'itinéraire se referme sur lui-même. */
  closed?: boolean;
  /** Vitesse, en cases par seconde de simulation — celle des lignes droites. */
  speed?: number;
  /** Où il en est au départ, en cases le long de l'itinéraire. */
  phase?: number;
  /** La part de sa vitesse qu'il garde dans le virage le plus serré, de 0 à 1. `1` : aucune. */
  corners?: number;
}

/** Le rayon sous lequel un virage est « serré » : à trois cases, on ralentit pleinement. */
const TIGHT = 3;

/** Le temps cumulé jusqu'à chaque point, vitesse modulée par la courbure. */
function timeTable(route: Route, speed: number, corners: number) {
  const { points, cum } = route;
  const n = points.length;
  const factor: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[Math.max(0, i - 1)];
    const b = points[i];
    const c = points[i + 1];
    const d = points[Math.min(n - 1, i + 2)];
    const h0 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const h1 = Math.atan2(d[1] - c[1], d[0] - c[0]);
    let turn = Math.abs(h1 - h0);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    const len = Math.max(1e-3, Math.hypot(d[0] - a[0], d[1] - a[1]));
    // Courbure ≈ angle tourné par longueur ; son inverse est le rayon.
    const radius = turn > 1e-3 ? len / turn : Infinity;
    const k = Math.min(1, TIGHT / radius);
    factor.push(1 - (1 - corners) * k);
  }
  // Un lissage court : on ne passe pas d'une vitesse à l'autre en un segment.
  const smooth = factor.map((_, i) => {
    let s = 0;
    let w = 0;
    for (let j = -3; j <= 3; j += 1) {
      const v = factor[i + j];
      if (v === undefined) continue;
      s += v;
      w += 1;
    }
    return s / w;
  });
  const t = [0];
  for (let i = 0; i < n - 1; i += 1) t.push(t[i] + (cum[i + 1] - cum[i]) / Math.max(1e-6, speed * smooth[i]));
  return { t, v: smooth };
}

export function useFollow(follow: Follow | undefined, active = true) {
  const ref = useRef<Group>(null);
  const route: Route | null = useMemo(() => (follow ? makeRoute(follow.route, follow.closed ?? true) : null), [follow ? JSON.stringify(follow.route) : null, follow?.closed]); // eslint-disable-line react-hooks/exhaustive-deps
  const speed = follow?.speed ?? 1;
  const corners = Math.max(0.1, Math.min(1, follow?.corners ?? 1));
  const table = useMemo(() => (route && corners < 1 ? timeTable(route, speed, corners) : null), [route, speed, corners]);
  useSimFrame((t) => {
    const g = ref.current;
    if (!g || !route || !follow) return;
    let s: number;
    if (!table) s = t * speed + (follow.phase ?? 0);
    else {
      // Du temps à la distance : on cherche le segment où l'on en est, puis on y avance à sa vitesse.
      const total = table.t[table.t.length - 1] || 1;
      const t0 = (follow.phase ?? 0) / speed;
      const closed = route.closed;
      let tt = t + t0;
      tt = closed ? ((tt % total) + total) % total : Math.max(0, Math.min(total, tt));
      let lo = 0;
      let hi = table.t.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (table.t[mid] <= tt) lo = mid;
        else hi = mid;
      }
      s = route.cum[lo] + (tt - table.t[lo]) * speed * (table.v[lo] ?? 1);
    }
    const p = sampleRoute(route, s);
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(0, 0, p.heading);
  }, active && !!follow);
  return ref;
}
