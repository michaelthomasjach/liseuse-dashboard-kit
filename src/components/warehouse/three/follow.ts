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
 */
export interface Follow {
  /** Les pistes parcourues, en coordonnées monde. */
  route: P3[] | P3[][];
  /** L'itinéraire se referme sur lui-même. */
  closed?: boolean;
  /** Vitesse, en cases par seconde de simulation. */
  speed?: number;
  /** Où il en est au départ, en cases le long de l'itinéraire. */
  phase?: number;
}

export function useFollow(follow: Follow | undefined, active = true) {
  const ref = useRef<Group>(null);
  const route: Route | null = useMemo(() => (follow ? makeRoute(follow.route, follow.closed ?? true) : null), [follow ? JSON.stringify(follow.route) : null, follow?.closed]); // eslint-disable-line react-hooks/exhaustive-deps
  useSimFrame((t) => {
    const g = ref.current;
    if (!g || !route || !follow) return;
    const p = sampleRoute(route, t * (follow.speed ?? 1) + (follow.phase ?? 0));
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(0, 0, p.heading);
  }, active && !!follow);
  return ref;
}
