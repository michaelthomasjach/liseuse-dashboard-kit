import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { addWorker } from "./Worker";
import { Barrier } from "./Barrier";
import { Matrix4 } from "three";

/**
 * Le poste de contrôle d'une grande entrée de site, à la manière d'une gare de péage.
 *
 * Plusieurs voies côte à côte sous un **auvent** porté par des poteaux ; entre deux voies, un
 * **îlot** protégé par des butoirs, et sur l'îlot une **cabine** vitrée avec son agent ; au bout de
 * chaque voie, une **barrière levante** et un **feu** d'affectation. C'est l'entrée d'un site qui
 * reçoit des dizaines de camions à l'heure : chaque voie est un guichet.
 *
 * Le repère : les voies courent le long des `x`, côte à côte le long des `y`, de largeur `lane`.
 */

export interface TollBoothProps {
  /** Nombre de voies. */
  lanes?: number;
  /** Largeur d'une voie, en cases. */
  lane?: number;
  /** Longueur des îlots et de l'auvent, le long des voies, en cases. */
  length?: number;
  /** Les barrières levées et baissées en boucle — la période, en secondes de simulation. */
  cycle?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const ISLAND = 0.9;
const CANOPY = 2.6;

function layout(p: TollBoothProps) {
  const lanes = Math.max(1, Math.round(p.lanes ?? 3));
  const lane = Math.max(1.4, p.lane ?? 1.9);
  const L = Math.max(2.5, p.length ?? 4);
  // Un îlot de part et d'autre de chaque voie : lanes + 1 îlots.
  const W = lanes * lane + (lanes + 1) * ISLAND;
  const islandY = (i: number) => i * (lane + ISLAND);
  return { lanes, lane, L, W, islandY };
}

/** L'emprise d'un poste de péage, avant rotation. */
export function tollBoothSize(p: TollBoothProps): { length: number; width: number } {
  const { L, W } = layout(p);
  return { length: L, width: W };
}

export function TollBooth(props: TollBoothProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 22, className } = props;
  const { L, W } = layout(props);
  const { bounds } = placed(origin, rotation, { x0: -0.3, x1: L + 0.3, y0: -0.3, y1: W + 0.3, z0: 0, z1: CANOPY + 0.5 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Poste de péage">
      <TollBoothBody {...props} />
    </Solo>
  );
}

function TollBoothBody(props: TollBoothProps) {
  const { cycle = 7, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { lanes, lane, L, W, islandY } = layout(props);
  const built = useBuilt(() => {
    const b = new Builder();
    for (let i = 0; i <= lanes; i += 1) {
      const y0 = islandY(i);
      const y1 = y0 + ISLAND;
      // L'îlot : une bordure en pointe à l'entrée, zébrée, et ses butoirs jaunes.
      b.prism("kerb", [
        { x: 0, y: (y0 + y1) / 2 },
        { x: 0.5, y: y0 },
        { x: L, y: y0 },
        { x: L, y: y1 },
        { x: 0.5, y: y1 },
      ], 0, 0.12);
      for (let x = 0.15; x < 0.5; x += 0.14) b.faceZ("lq-zone__hatch", 0.121, x, x + 0.06, (y0 + y1) / 2 - 0.1, (y0 + y1) / 2 + 0.1);
      for (const x of [0.6, L - 0.3]) b.cylinder("safety", x, (y0 + y1) / 2, 0.12 + 0.25, 0.08, 0.5, "z", 12);
      // Les poteaux de l'auvent.
      b.box("steel", L / 2 - 0.08, L / 2 + 0.08, (y0 + y1) / 2 - 0.08, (y0 + y1) / 2 + 0.08, 0.12, CANOPY);
      // La cabine, sauf sur les deux îlots de rive.
      if (i > 0 && i < lanes + 1 && y1 - y0 > 0.5) {
        const bx0 = L / 2 + 0.3;
        const bx1 = bx0 + 1.1;
        const by0 = y0 + 0.12;
        const by1 = y1 - 0.12;
        b.box("paint-light", bx0, bx1, by0, by1, 0.12, 0.6);
        b.box("glass", bx0 + 0.02, bx1 - 0.02, by0 + 0.02, by1 - 0.02, 0.6, 1.25);
        for (const [x, y] of [
          [bx0, by0],
          [bx1 - 0.05, by0],
          [bx0, by1 - 0.05],
          [bx1 - 0.05, by1 - 0.05],
        ])
          b.box("paint-light", x, x + 0.05, y, y + 0.05, 0.6, 1.25);
        b.box("paint-light", bx0 - 0.08, bx1 + 0.08, by0 - 0.08, by1 + 0.08, 1.25, 1.35);
        b.within(new Matrix4().makeTranslation((bx0 + bx1) / 2, (by0 + by1) / 2, 0.55).multiply(new Matrix4().makeRotationZ(Math.PI)), () => addWorker(b, "sit"));
      }
    }
    // L'auvent : une dalle mince sur toute la largeur, son bandeau, et ses rampes d'éclairage.
    b.box("paint-light", 0.2, L - 0.2, -0.2, W + 0.2, CANOPY, CANOPY + 0.25);
    b.box("paint-dark", 0.18, L - 0.18, -0.22, W + 0.22, CANOPY + 0.25, CANOPY + 0.3, false);
    for (let i = 0; i < lanes; i += 1) {
      const yc = islandY(i) + ISLAND + lane / 2;
      b.faceZ("lq-car__lamp", CANOPY - 0.002, L / 2 - 0.8, L / 2 + 0.8, yc - 0.08, yc + 0.08);
      // Le feu d'affectation au-dessus de la voie : une croix ou une flèche, ici un voyant.
      b.box("paint-dark", 0.25, 0.35, yc - 0.18, yc + 0.18, CANOPY - 0.3, CANOPY);
      b.faceX("lq-toll__go", 0.248, yc - 0.12, yc + 0.12, CANOPY - 0.26, CANOPY - 0.04);
      // Le marquage : une ligne d'arrêt devant la barrière.
      b.faceZ("lq-road__mark", 0.004, L - 0.05, L + 0.05, yc - lane / 2 + 0.1, yc + lane / 2 - 0.1);
    }
    const edge: [P3, P3][] = [];
    for (let i = 0; i < lanes; i += 1) {
      const y = islandY(i) + ISLAND;
      edge.push([[0, y + lane / 2, 0.004], [L, y + lane / 2, 0.004]]);
    }
    void edge;
    return b.build();
  }, [lanes, lane, L]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
      {Array.from({ length: lanes }, (_, i) => (
        <Barrier key={i} kind="boom" width={lane} cycle={cycle + i * 1.3} origin={{ x: L - 0.2, y: islandY(i) + ISLAND }} />
      ))}
    </group>
  );
}
