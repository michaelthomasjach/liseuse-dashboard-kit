import { useRef } from "react";
import { Matrix4, type Group } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { addWorker } from "./Worker";

/**
 * L'entrée d'un site : la loge du gardien et ses barrières levantes.
 *
 * Tout camion qui entre passe devant elle — c'est là qu'on contrôle le bon de livraison, qu'on
 * attribue un quai, qu'on pèse parfois. Dans un jeu de gestion, c'est la **porte** du site : ce qui
 * règle le débit d'entrée.
 *
 * La loge est un petit volume vitré sur ses quatre faces, sous un toit débordant, avec son gardien
 * assis au comptoir. De part et d'autre, une barrière levante par sens de circulation : un fût, et
 * une lisse rayée qui pivote. `open` la lève ; `cycle` la fait lever et baisser toute seule, comme au
 * passage d'un véhicule.
 *
 * Le repère : la voie d'entrée court le long des `x`. La loge est posée sur l'îlot central, en
 * `y = lane … lane + island`, entre les deux voies.
 */

export interface GatehouseProps {
  /** Largeur d'une voie franchie par une barrière, en cases. */
  lane?: number;
  /** Nombre de barrières : `1` (une voie) ou `2` (entrée et sortie). */
  barriers?: 1 | 2;
  /** Ouverture des barrières, de `0` (baissées) à `1` (levées). */
  open?: number;
  /** Lever et baisser les barrières en boucle, comme au passage des véhicules — la période, en
   *  secondes de simulation. */
  cycle?: number;
  /** Un gardien dans la loge. */
  guard?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const ISLAND = 1.6;
const BOOTH = 1.3;
const BOOTH_H = 1.35;

function layout(p: GatehouseProps) {
  const lane = Math.max(1, p.lane ?? 2);
  const barriers = p.barriers ?? 2;
  const W = lane * barriers + ISLAND;
  const L = BOOTH + 0.6;
  const islandY = barriers === 2 ? lane : 0;
  return { lane, barriers, W, L, islandY };
}

export function Gatehouse(props: GatehouseProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 34, className } = props;
  const { W, L } = layout(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: BOOTH_H + 0.4 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Poste de garde">
      <GatehouseBody {...props} />
    </Solo>
  );
}

function GatehouseBody(props: GatehouseProps) {
  const { open = 0, cycle, guard = true, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { lane, barriers, W, L, islandY } = layout(props);
  const built = useBuilt(() => {
    const b = new Builder();
    // L'îlot en béton, sa bordure, et la loge au milieu.
    const y0 = islandY;
    const y1 = islandY + ISLAND;
    b.box("kerb", 0, L, y0, y1, 0, 0.1);
    const bx0 = 0.3;
    const bx1 = bx0 + BOOTH;
    const by0 = y0 + (ISLAND - BOOTH * 0.8) / 2;
    const by1 = by0 + BOOTH * 0.8;
    // Un soubassement plein, un bandeau vitré tout autour, un toit débordant.
    b.box("paint-light", bx0, bx1, by0, by1, 0.1, 0.55);
    b.box("glass", bx0 + 0.02, bx1 - 0.02, by0 + 0.02, by1 - 0.02, 0.55, BOOTH_H - 0.12);
    for (const [x, y] of [
      [bx0, by0],
      [bx1 - 0.06, by0],
      [bx0, by1 - 0.06],
      [bx1 - 0.06, by1 - 0.06],
    ])
      b.box("paint-light", x, x + 0.06, y, y + 0.06, 0.55, BOOTH_H - 0.12);
    b.box("paint-light", bx0 - 0.18, bx1 + 0.18, by0 - 0.18, by1 + 0.18, BOOTH_H - 0.12, BOOTH_H);
    // Le comptoir et le gardien assis derrière la vitre.
    if (guard)
      b.within(placedSeat(bx0 + BOOTH * 0.45, (by0 + by1) / 2), () => addWorker(b, "sit"));
    // Les fûts des barrières, sur l'îlot, un de chaque côté.
    const posts = barriers === 2 ? [y0 + 0.18, y1 - 0.18] : [y1 - 0.18];
    for (const y of posts) {
      b.box("safety", L - 0.42, L - 0.12, y - 0.15, y + 0.15, 0.1, 0.62);
      b.box("paint-dark", L - 0.44, L - 0.1, y - 0.17, y + 0.17, 0.62, 0.66, false);
    }
    // Un panneau « STOP » au sol, devant chaque barrière : la ligne d'arrêt.
    const stops = barriers === 2 ? [[0, lane], [y1, y1 + lane]] : [[y1, y1 + lane]];
    for (const [a, c] of stops) b.faceZ("lq-road__mark", 0.025, L - 1.2, L - 1.1, a + 0.15, c - 0.15);
    return b.build();
  }, [lane, barriers, W, L, islandY, guard]);

  // Une lisse : pivot au fût, longue de la voie, rayée de rouge.
  const arm = useBuilt(() => {
    const b = new Builder();
    b.box("paint-light", 0, lane - 0.15, -0.035, 0.035, -0.035, 0.035);
    for (let x = 0.15; x < lane - 0.3; x += 0.36) b.box("stripe", x, x + 0.18, -0.037, 0.037, -0.037, 0.037, false);
    return b.build();
  }, [lane]);

  const arms = useRef<(Group | null)[]>([]);
  useSimFrame(
    (t) => {
      const period = Math.max(2, cycle ?? 0);
      const u = (t % period) / period;
      // Lever, attendre qu'il passe, baisser, attendre le suivant.
      const k = u < 0.15 ? u / 0.15 : u < 0.45 ? 1 : u < 0.6 ? 1 - (u - 0.45) / 0.15 : 0;
      const e = k * k * (3 - 2 * k);
      arms.current.forEach((a, i) => {
        if (a) a.rotation.x = (i === 0 ? -1 : 1) * e * (Math.PI / 2) * 0.95;
      });
    },
    !!cycle
  );

  const y0 = islandY;
  const y1 = islandY + ISLAND;
  const lift = Math.max(0, Math.min(1, open)) * (Math.PI / 2) * 0.95;
  // Une lisse tendue vers le bas (`−y`) pour la voie d'entrée, vers le haut pour la sortie.
  const armSpecs = barriers === 2 ? [{ y: y0 + 0.18, dir: -1 }, { y: y1 - 0.18, dir: 1 }] : [{ y: y1 - 0.18, dir: 1 }];
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
      {armSpecs.map((s, i) => (
        <group key={i} position={[L - 0.27, s.y, 0.55]} rotation={[barriers === 2 && i === 0 ? -lift : lift, 0, 0]} ref={(el) => (arms.current[barriers === 2 ? i : 1] = el)}>
          <group rotation={[0, 0, s.dir > 0 ? Math.PI / 2 : -Math.PI / 2]}>
            <Parts built={arm} />
          </group>
        </group>
      ))}
    </group>
  );
}

/** La pose d'un siège : un gardien assis, tourné vers la vitre de la voie d'entrée. */
function placedSeat(x: number, y: number) {
  return new Matrix4().makeTranslation(x, y, 0.5).multiply(new Matrix4().makeRotationZ(Math.PI / 2));
}
