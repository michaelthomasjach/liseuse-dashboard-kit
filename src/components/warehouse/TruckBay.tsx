import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * Parking poids lourds — les places où un semi-remorque recule jusqu'au quai.
 *
 * Il est vide : ce sont les **marquages** qui le disent, comme pour le parking des voitures. Un
 * enrobé ; un trait blanc entre les places ; au **bout quai**, une ligne jaune et, dans chaque place,
 * les **cales de roues** où viennent buter les roues arrière de la remorque ; à l'**entrée**, une
 * flèche peinte qui montre le sens de la manœuvre — on entre en marche arrière — et des hachures
 * jaunes qui interdisent de s'y arrêter.
 *
 * Le repère : l'emprise va de `(0, 0)` à `(length, bays · bayWidth)`. Les places sont **le long des
 * `x`** : l'entrée en `x = 0`, le bout quai en `x = length`. Les camions, eux, sont posés par
 * `PlannerDockTraffic`.
 */

export interface TruckBayProps {
  /** Le nombre de places, côte à côte. */
  bays?: number;
  /** La longueur d'une place, en cases. */
  length?: number;
  /** La largeur d'une place, en cases. */
  bayWidth?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

function buildTruckBay({ bays = 1, length = 10.5, bayWidth = 2.4 }: TruckBayProps) {
  const b = new Builder();
  const n = Math.max(1, Math.round(bays));
  const L = length;
  const W = n * bayWidth;
  const w = 0.045;
  // L'enrobé, un peu plus grand que les places.
  b.box("asphalt", -0.1, L + 0.1, -0.1, W + 0.1, -0.04, 0.002, false);
  // Les traits entre les places, sur toute la longueur.
  for (let i = 0; i <= n; i += 1) b.faceZ("lq-road__mark", 0.006, 0.4, L - 0.05, i * bayWidth - w, i * bayWidth + w);
  // Le bout quai : la ligne jaune, et les cales de roues de chaque place.
  b.faceZ("lq-road__mark--warn", 0.007, L - 0.3, L - 0.12, 0, W);
  const stop = L - 1.55;
  for (let i = 0; i < n; i += 1) {
    const c = (i + 0.5) * bayWidth;
    for (const s of [-1, 1]) b.box("safety", stop - 0.08, stop + 0.08, c + s * 0.62 - 0.22, c + s * 0.62 + 0.22, 0, 0.07);
  }
  for (let i = 0; i < n; i += 1) {
    const c = (i + 0.5) * bayWidth;
    // La flèche : un fût et une pointe vers le quai — on entre en marche arrière.
    const x0 = 1.3;
    const x1 = 3.1;
    const head = 0.55;
    b.faceZ("lq-bay__arrow", 0.007, x0, x1 - head, c - 0.1, c + 0.1);
    const tip: P3[] = [
      [x1 - head, c - 0.32, 0.007],
      [x1, c, 0.007],
      [x1 - head, c + 0.32, 0.007],
    ];
    b.decal("lq-bay__arrow", tip);
    // Les hachures de l'entrée : des bandes obliques entre les traits.
    for (let k = 0; k < 4; k += 1) {
      const y0 = i * bayWidth + 0.15 + k * ((bayWidth - 0.3) / 4);
      const y1 = y0 + (bayWidth - 0.3) / 8;
      b.decal("lq-bay__hatch", [
        [0.1, y0, 0.006],
        [0.1, y1, 0.006],
        [0.55, y1 + 0.15, 0.006],
        [0.55, y0 + 0.15, 0.006],
      ]);
    }
  }
  return b.build();
}

export function TruckBay(props: TruckBayProps) {
  const { bays = 1, length = 10.5, bayWidth = 2.4, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 24, className } = props;
  const W = Math.max(1, Math.round(bays)) * bayWidth;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: W, z0: 0, z1: 0.3 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Parking poids lourds">
      <TruckBayBody {...props} />
    </Solo>
  );
}

function TruckBayBody(props: TruckBayProps) {
  const { bays = 1, length = 10.5, bayWidth = 2.4, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const W = Math.max(1, Math.round(bays)) * bayWidth;
  const built = useBuilt(() => buildTruckBay(props), [props.bays, props.length, props.bayWidth]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
