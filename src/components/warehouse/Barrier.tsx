import { useRef } from "react";
import type { Group } from "three";
import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";

/**
 * Ce qui contrôle l'accès d'une voie : la barrière levante, et le portique de hauteur.
 *
 * - `"boom"` : la **barrière levante** d'un parking ou d'une entrée de site — un fût, et une lisse
 *   rayée qui pivote pour laisser passer. `open` la lève ; `cycle` la fait lever et baisser toute
 *   seule, comme au passage d'un véhicule.
 * - `"gantry"` : le **portique de limitation de hauteur** — deux poteaux et une traverse zébrée, à
 *   la hauteur au-delà de laquelle un véhicule ne passe pas, et la plaque qui l'annonce.
 *
 * Le repère : la voie franchie court le long des `y`, sur la largeur `width` ; la barrière est
 * posée en `x = 0`.
 */

export type BarrierKind = "boom" | "gantry";

export interface BarrierProps {
  kind?: BarrierKind;
  /** La largeur de la voie franchie, en cases. */
  width?: number;
  /** Portique : la hauteur libre, en cases. 1,75 : trois mètres cinquante. */
  clearance?: number;
  /** Barrière : son ouverture, de 0 (baissée) à 1 (levée). */
  open?: number;
  /** Barrière : lever et baisser en boucle — la période, en secondes de simulation. */
  cycle?: number;
  rotation?: number;
  /** Où poser le pied de la barrière, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export function Barrier(props: BarrierProps) {
  const { kind = "boom", width = 2, clearance = 1.75, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 40, className } = props;
  const top = kind === "gantry" ? clearance + 0.5 : width + 0.8;
  const { bounds } = placed(origin, rotation, { x0: -0.4, x1: 0.4, y0: -0.3, y1: width + 0.3, z0: 0, z1: top }, { x: 0, y: width / 2 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel={kind === "gantry" ? "Portique de hauteur" : "Barrière levante"}>
      <BarrierBody {...props} />
    </Solo>
  );
}

function BarrierBody({ kind = "boom", width = 2, clearance = 1.75, open = 0, cycle, rotation = 0, origin = { x: 0, y: 0 } }: BarrierProps) {
  const fixed = useBuilt(() => {
    const b = new Builder();
    if (kind === "gantry") {
      // Deux poteaux sur platines, une traverse zébrée, la plaque de hauteur, les chaînes de rappel.
      for (const y of [-0.12, width + 0.02]) {
        b.box("steel", -0.05, 0.05, y, y + 0.1, 0, clearance + 0.3);
        b.box("slab", -0.12, 0.12, y - 0.07, y + 0.17, 0, 0.05);
      }
      b.box("paint-light", -0.06, 0.06, -0.12, width + 0.12, clearance, clearance + 0.16);
      for (let y = 0; y < width; y += 0.4) b.box("stripe", -0.062, 0.062, y, y + 0.2, clearance + 0.001, clearance + 0.159, false);
      b.box("paint-light", -0.02, 0.02, width / 2 - 0.25, width / 2 + 0.25, clearance + 0.16, clearance + 0.42);
      b.faceX("lq-sign__mark", -0.022, width / 2 - 0.2, width / 2 + 0.2, clearance + 0.2, clearance + 0.38);
      const chains: [P3, P3][] = [];
      for (let y = 0.2; y < width; y += 0.3) chains.push([[0, y, clearance], [0, y, clearance - 0.25]]);
      b.lines("lq-fence__wire", chains);
      return b.build();
    }
    // Le fût de la barrière, son capot, son lecteur de badge.
    b.box("slab", -0.2, 0.2, -0.28, 0.02, 0, 0.04);
    b.box("safety", -0.15, 0.15, -0.25, -0.01, 0.04, 0.55);
    b.box("paint-dark", -0.17, 0.17, -0.27, 0.01, 0.55, 0.6, false);
    b.box("paint-dark", 0.5, 0.58, -0.35, -0.27, 0, 0.5);
    b.box("paint-light", 0.47, 0.61, -0.37, -0.25, 0.5, 0.64);
    b.faceY("lq-screen__face", -0.372, 0.49, 0.59, 0.53, 0.6);
    // La béquille de repos, au bout de la voie.
    b.box("safety", -0.03, 0.03, width - 0.05, width + 0.05, 0, 0.45);
    return b.build();
  }, [kind, width, clearance]);
  const arm = useBuilt(() => {
    const b = new Builder();
    if (kind === "gantry") return b.build();
    b.box("paint-light", -0.03, 0.03, 0, width, -0.035, 0.035);
    for (let y = 0.1; y < width - 0.15; y += 0.36) b.box("stripe", -0.032, 0.032, y, y + 0.18, -0.037, 0.037, false);
    return b.build();
  }, [kind, width]);
  const pivot = useRef<Group>(null);
  useSimFrame(
    (t) => {
      const g = pivot.current;
      if (!g) return;
      const period = Math.max(2, cycle ?? 0);
      const u = (t % period) / period;
      const k = u < 0.15 ? u / 0.15 : u < 0.45 ? 1 : u < 0.6 ? 1 - (u - 0.45) / 0.15 : 0;
      g.rotation.x = k * k * (3 - 2 * k) * (Math.PI / 2) * 0.95;
    },
    kind === "boom" && !!cycle
  );
  const lift = Math.max(0, Math.min(1, open)) * (Math.PI / 2) * 0.95;
  const { pose } = placed(origin, rotation, { x0: 0, x1: 0, y0: 0, y1: width, z0: 0, z1: 1 }, { x: 0, y: width / 2 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={fixed} />
      {kind === "boom" && (
        <group ref={pivot} position={[0, -0.13, 0.5]} rotation={[lift, 0, 0]}>
          <Parts built={arm} />
        </group>
      )}
    </group>
  );
}
