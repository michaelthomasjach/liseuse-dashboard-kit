import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * Le conteneur maritime — la boîte qui arrive du port et qu'on dépote au quai.
 *
 * Deux longueurs normalisées, 20 et 40 pieds, et deux hauteurs : standard (2,59 m) et *high cube*
 * (2,90 m). Ce qui le fait reconnaître, c'est sa **tôle ondulée** — des nervures verticales serrées
 * sur les flancs —, ses **pièces de coin** aux huit angles, par lesquelles on le lève et on l'empile,
 * et ses **portes** au bout, avec leurs barres de verrouillage.
 *
 * `stack` en empile plusieurs, comme dans une cour de dépôt ; les teintes alternent pour qu'on
 * distingue les boîtes d'une pile, comme sur un vrai terminal où aucune n'est de la même compagnie
 * que sa voisine.
 */

export type ContainerSize = "20" | "40";

export interface ShippingContainerProps {
  size?: ContainerSize;
  /** Un *high cube*, 30 cm plus haut. */
  highCube?: boolean;
  /** Combien de conteneurs empilés. */
  stack?: number;
  /** La première teinte de la pile ; les suivantes alternent. */
  tone?: number;
  /** Les portes ouvertes, battues contre les flancs. */
  open?: boolean;
  rotation?: number;
  /** Où poser le coin du conteneur, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Les cotes, en cases (une case vaut deux mètres). */
export const CONTAINER_DIMENSIONS: Record<ContainerSize, { length: number; width: number }> = {
  "20": { length: 3.03, width: 1.22 },
  "40": { length: 6.1, width: 1.22 },
};
const TONES = ["container", "container-alt", "paint-cool", "paint-warm", "paint-dark"];

/** Poser un conteneur dans un constructeur, coin en `(0, 0, z)`, portes en `x = 0`. */
export function addContainer(b: Builder, size: ContainerSize, high: boolean, tone: string, z = 0, open = false): void {
  const { length: L, width: W } = CONTAINER_DIMENSIONS[size];
  const H = high ? 1.45 : 1.295;
  const c = 0.08;
  // La caisse, un rien en retrait des pièces de coin.
  b.box(tone, 0.02, L - 0.02, 0.015, W - 0.015, z + 0.02, z + H - 0.02);
  // Les huit pièces de coin, et les longerons haut et bas qui les relient.
  for (const x of [0, L - c])
    for (const y of [0, W - c])
      for (const zz of [z, z + H - c]) b.box("paint-dark", x, x + c, y, y + c, zz, zz + c, false);
  for (const y of [0, W - 0.05]) {
    b.box(tone, c, L - c, y, y + 0.05, z, z + 0.06, false);
    b.box(tone, c, L - c, y, y + 0.05, z + H - 0.06, z + H, false);
  }
  // La tôle ondulée : des nervures tracées sur les deux flancs et le fond.
  const ribs: [P3, P3][] = [];
  const pitch = 0.14;
  for (let x = c + pitch; x < L - c; x += pitch)
    for (const y of [0.012, W - 0.012]) ribs.push([[x, y, z + 0.07], [x, y, z + H - 0.07]]);
  for (let y = c + pitch; y < W - c; y += pitch) ribs.push([[L - 0.012, y, z + 0.07], [L - 0.012, y, z + H - 0.07]]);
  b.lines("lq-trailer__line", ribs);
  // Les portes : deux vantaux, quatre barres de verrouillage, leurs poignées.
  const bars: [P3, P3][] = [];
  if (!open) {
    b.lines("lq-truck__door", [[[0.018, W / 2, z + 0.08], [0.018, W / 2, z + H - 0.08]]]);
    for (const y of [W * 0.15, W * 0.35, W * 0.65, W * 0.85]) bars.push([[0.012, y, z + 0.06], [0.012, y, z + H - 0.06]]);
    b.lines("lq-container__bar", bars);
  } else {
    // Ouvertes : l'intérieur sombre, les vantaux rabattus contre les flancs.
    b.faceX("lq-trailer__inside", 0.018, 0.08, W - 0.08, z + 0.08, z + H - 0.08);
    b.box(tone, 0, W / 2 - 0.03, -0.04, -0.015, z + 0.04, z + H - 0.04);
    b.box(tone, 0, W / 2 - 0.03, W + 0.015, W + 0.04, z + 0.04, z + H - 0.04);
  }
}

export function ShippingContainer(props: ShippingContainerProps) {
  const { size = "40", highCube = false, stack = 1, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const { length: L, width: W } = CONTAINER_DIMENSIONS[size];
  const H = (highCube ? 1.45 : 1.295) * Math.max(1, stack);
  const { bounds } = placed(origin, rotation, { x0: -0.05, x1: L, y0: -0.05, y1: W + 0.05, z0: 0, z1: H });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Conteneur">
      <ShippingContainerBody {...props} />
    </Solo>
  );
}

function ShippingContainerBody({ size = "40", highCube = false, stack = 1, tone = 0, open = false, rotation = 0, origin = { x: 0, y: 0 } }: ShippingContainerProps) {
  const { length: L, width: W } = CONTAINER_DIMENSIONS[size];
  const H = highCube ? 1.45 : 1.295;
  const n = Math.max(1, Math.round(stack));
  const built = useBuilt(() => {
    const b = new Builder();
    for (let i = 0; i < n; i += 1) addContainer(b, size, highCube, TONES[(tone + i) % TONES.length], i * H, open && i === 0);
    return b.build();
  }, [size, highCube, n, tone, open]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
