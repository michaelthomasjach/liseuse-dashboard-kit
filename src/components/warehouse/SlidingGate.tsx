import { useRef } from "react";
import type { Group } from "three";
import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";

/**
 * Le portail coulissant d'une entrée de site.
 *
 * Un vantail à barreaudage, cadré, qui **glisse latéralement** sur un rail au sol et s'efface le
 * long de la clôture — il n'a pas besoin de place devant lui pour s'ouvrir, c'est ce qui le fait
 * préférer au portail battant sur une entrée de poids lourds. Un poteau de guidage à galets le tient
 * debout, un poteau de réception l'accueille quand il se ferme, et le moteur est au pied du guide.
 *
 * Le repère : l'ouverture va de `x = 0` à `x = length`, le long des `x` ; le vantail s'efface vers
 * les `x` négatifs, où il faut donc autant de place libre. `open` l'ouvre de 0 à 1 ; `cycle` l'ouvre
 * et le referme en boucle.
 */

export interface SlidingGateProps {
  /** La largeur de l'ouverture, en cases. */
  length?: number;
  /** La hauteur du vantail, en cases. */
  height?: number;
  /** L'ouverture, de 0 (fermé) à 1 (ouvert). */
  open?: number;
  /** Ouvrir et refermer en boucle — la période, en secondes de simulation. */
  cycle?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export function SlidingGate(props: SlidingGateProps) {
  const { length = 4, height = 1, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 34, className } = props;
  const { bounds } = placed(origin, rotation, { x0: -length - 0.3, x1: length + 0.3, y0: -0.3, y1: 0.3, z0: 0, z1: height + 0.2 }, { x: length / 2, y: 0 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Portail coulissant">
      <SlidingGateBody {...props} />
    </Solo>
  );
}

function SlidingGateBody({ length = 4, height = 1, open = 0, cycle, rotation = 0, origin = { x: 0, y: 0 } }: SlidingGateProps) {
  const L = Math.max(1, length);
  const fixed = useBuilt(() => {
    const b = new Builder();
    // Le rail au sol, sur toute la course ; le poteau de réception ; le guide et son moteur.
    b.box("steel", -L - 0.1, L + 0.05, -0.03, 0.03, 0, 0.03);
    b.box("paint-dark", L, L + 0.12, -0.08, 0.08, 0, height + 0.1);
    for (const x of [-0.14, 0.02]) b.box("paint-dark", x, x + 0.12, -0.16, -0.06, 0, height + 0.1);
    b.cylinder("rubber", -0.02, -0.04, height - 0.05, 0.03, 0.05, "z", 10);
    b.box("paint-light", -0.5, -0.2, -0.32, -0.1, 0, 0.35);
    b.box("robot-led", -0.5, -0.2, -0.32, -0.1, 0.35, 0.38, false);
    return b.build();
  }, [L, height]);
  const leaf = useBuilt(() => {
    const b = new Builder();
    // Le vantail : un cadre, deux lisses, un barreaudage serré, et les deux galets de roulement.
    const z0 = 0.06;
    b.box("paint-dark", 0, L, -0.025, 0.025, z0, z0 + 0.06);
    b.box("paint-dark", 0, L, -0.025, 0.025, height - 0.06, height);
    b.box("paint-dark", 0, 0.06, -0.025, 0.025, z0, height);
    b.box("paint-dark", L - 0.06, L, -0.025, 0.025, z0, height);
    b.box("paint-dark", 0, L, -0.02, 0.02, height * 0.55, height * 0.55 + 0.04, false);
    const bars: [P3, P3][] = [];
    for (let x = 0.14; x < L - 0.06; x += 0.1) bars.push([[x, 0, z0 + 0.06], [x, 0, height - 0.06]]);
    b.lines("lq-gate__bar", bars);
    for (const x of [0.3, L - 0.3]) b.cylinder("steel", x, 0, 0.05, 0.05, 0.04, "y", 10);
    return b.build();
  }, [L, height]);
  const slide = useRef<Group>(null);
  useSimFrame(
    (t) => {
      const g = slide.current;
      if (!g) return;
      const period = Math.max(3, cycle ?? 0);
      const u = (t % period) / period;
      const k = u < 0.25 ? u / 0.25 : u < 0.5 ? 1 : u < 0.75 ? 1 - (u - 0.5) / 0.25 : 0;
      g.position.x = -k * k * (3 - 2 * k) * L;
    },
    !!cycle
  );
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: 0, z0: 0, z1: 1 }, { x: L / 2, y: 0 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={fixed} />
      <group ref={slide} position={[-Math.max(0, Math.min(1, open)) * L, 0, 0]}>
        <Parts built={leaf} />
      </group>
    </group>
  );
}
