import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * Le transformateur électrique qui abaisse la tension du réseau pour le site.
 *
 * Trois gabarits, du plus petit au plus gros — ce sont aussi les étapes d'un site qui consomme de
 * plus en plus :
 * - `"pad"` : le **transformateur sur socle**, une cuve à ailettes de refroidissement coiffée de ses
 *   bornes, sur une dalle, derrière un grillage ;
 * - `"kiosk"` : le **poste préfabriqué**, un petit bâtiment béton à portes et à grilles de
 *   ventilation, qui abrite transformateur et cellules ;
 * - `"substation"` : le **poste de livraison** en plein air, deux transformateurs de puissance à
 *   radiateurs, leurs traversées isolantes, un portique d'arrivée de ligne, le tout clôturé.
 *
 * Le repère : l'emprise va de `(0, 0)` à `transformerSize(kind)`.
 */

export type TransformerKind = "pad" | "kiosk" | "substation";

export interface TransformerProps {
  kind?: TransformerKind;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const SIZE: Record<TransformerKind, { length: number; width: number; height: number }> = {
  pad: { length: 2, width: 1.6, height: 1.3 },
  kiosk: { length: 2.6, width: 1.4, height: 1.5 },
  substation: { length: 7, width: 5, height: 4.2 },
};

export function transformerSize(kind: TransformerKind): { length: number; width: number } {
  return { length: SIZE[kind].length, width: SIZE[kind].width };
}

/** Une cuve de transformateur, ses ailettes et ses bornes, posée en `(x, y)`, longue de `l`. */
function addTank(b: Builder, x: number, y: number, l: number, w: number, h: number, bushings: number, hv = false) {
  b.box("paint-cool", x, x + l, y, y + w, 0.1, 0.1 + h);
  b.box("paint-cool", x - 0.03, x + l + 0.03, y - 0.03, y + w + 0.03, 0.1 + h, 0.1 + h + 0.05);
  // Les ailettes de refroidissement, sur les deux longs côtés.
  for (let k = 0.08; k < l - 0.05; k += 0.1)
    for (const [a, c] of [
      [y - 0.12, y],
      [y + w, y + w + 0.12],
    ])
      b.box("paint-cool", x + k, x + k + 0.025, a, c, 0.2, 0.1 + h - 0.1, false);
  // Les traversées isolantes : des colonnes blanches à ailettes.
  for (let i = 0; i < bushings; i += 1) {
    const bx = x + (l * (i + 1)) / (bushings + 1);
    const tall = hv ? 0.7 : 0.25;
    b.cylinder("lamp", bx, y + w / 2, 0.15 + h + tall / 2, 0.04, tall, "z", 10);
    for (let z = 0.2 + h; z < 0.15 + h + tall; z += 0.08) b.cylinder("lamp", bx, y + w / 2, z, 0.065, 0.02, "z", 10);
  }
}

function buildTransformer(kind: TransformerKind) {
  const b = new Builder();
  const s = SIZE[kind];
  if (kind === "pad") {
    b.box("slab", 0, s.length, 0, s.width, 0, 0.1);
    addTank(b, 0.5, 0.45, 1, 0.7, 0.8, 3);
    // Le grillage de protection, sur trois côtés, et sa plaque de danger.
    const mesh: [P3, P3][] = [];
    for (const [x0, y0, x1, y1] of [
      [0.05, 0.05, s.length - 0.05, 0.05],
      [s.length - 0.05, 0.05, s.length - 0.05, s.width - 0.05],
      [0.05, s.width - 0.05, s.length - 0.05, s.width - 0.05],
    ]) {
      b.box("paint-dark", Math.min(x0, x1) - 0.02, Math.max(x0, x1) + 0.02, Math.min(y0, y1) - 0.02, Math.max(y0, y1) + 0.02, 1.02, 1.05, false);
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.08);
      for (let i = 0; i <= n; i += 1) {
        const u = i / n;
        mesh.push([[x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.1], [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 1.02]]);
      }
    }
    b.lines("lq-fence__wire", mesh);
    b.faceY("lq-sign__mark", 0.028, s.length / 2 - 0.12, s.length / 2 + 0.12, 0.55, 0.75);
    return b.build();
  }
  if (kind === "kiosk") {
    // Le poste préfabriqué : un volume béton, un toit débordant, deux portes, des grilles.
    b.box("slab", -0.05, s.length + 0.05, -0.05, s.width + 0.05, 0, 0.08);
    b.box("wall", 0, s.length, 0, s.width, 0.08, 1.35);
    b.box("paint-light", -0.08, s.length + 0.08, -0.08, s.width + 0.08, 1.35, 1.45);
    for (const x of [0.3, 1.4]) {
      b.faceY("lq-building__garage", -0.004, x, x + 0.8, 0.1, 1.15, true);
      b.lines("lq-trailer__line", [[[x + 0.4, -0.005, 0.1], [x + 0.4, -0.005, 1.15]]]);
    }
    const vents: [P3, P3][] = [];
    for (let z = 0.3; z < 0.9; z += 0.07) vents.push([[s.length + 0.004, 0.4, z], [s.length + 0.004, 1.0, z]]);
    b.lines("lq-trailer__line", vents);
    b.faceY("lq-sign__mark", -0.006, 1.2 + 0.03, 1.36, 1.0, 1.2);
    return b.build();
  }
  // Le poste de livraison : dalle, clôture, deux transformateurs de puissance, un portique.
  b.box("pavement", 0, s.length, 0, s.width, 0, 0.05);
  for (const y of [0.9, 2.9]) addTank(b, 1.2, y, 2.2, 1.1, 1.6, 3, true);
  // Le portique d'arrivée : deux poteaux treillis, une traverse, trois isolateurs suspendus.
  for (const y of [0.4, s.width - 0.4]) {
    for (const dx of [-0.12, 0.12]) for (const dy of [-0.12, 0.12]) b.beam("iron", [5.4 + dx, y + dy, 0], [5.4 + dx * 0.4, y + dy * 0.4, s.height], 0.025, false);
    for (let z = 0.4; z < s.height; z += 0.5) b.beam("iron", [5.28, y - 0.12, z], [5.52, y + 0.12, z + 0.4], 0.012, false);
  }
  b.box("iron", 5.3, 5.5, 0.3, s.width - 0.3, s.height - 0.1, s.height + 0.05);
  const wires: [P3, P3][] = [];
  for (let i = 0; i < 3; i += 1) {
    const y = 1.3 + i * 1.2;
    b.cylinder("lamp", 5.4, y, s.height - 0.45, 0.05, 0.6, "z", 8);
    wires.push([[5.4, y, s.height - 0.75], [3.4 - i * 0.3, y > 2.5 ? 3.45 : 1.45, 2.1]]);
  }
  b.lines("lq-powerline__wire", wires);
  // La clôture du poste.
  const fence: [P3, P3][] = [];
  const H = 1.1;
  for (const [x0, y0, x1, y1] of [
    [0, 0, s.length, 0],
    [s.length, 0, s.length, s.width],
    [s.length, s.width, 0, s.width],
    [0, s.width, 0, 0],
  ]) {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.12);
    for (let i = 0; i <= n; i += 1) {
      const u = i / n;
      fence.push([[x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.05], [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, H]]);
    }
    const posts = Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.25);
    for (let i = 0; i <= posts; i += 1) {
      const u = i / posts;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      b.box("paint-dark", x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0, H + 0.05);
    }
  }
  b.lines("lq-fence__wire", fence);
  return b.build();
}

export function Transformer(props: TransformerProps) {
  const { kind = "pad", rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const s = SIZE[kind];
  const { bounds } = placed(origin, rotation, { x0: -0.2, x1: s.length + 0.2, y0: -0.2, y1: s.width + 0.2, z0: 0, z1: s.height + 0.2 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Transformateur électrique">
      <TransformerBody {...props} />
    </Solo>
  );
}

function TransformerBody({ kind = "pad", rotation = 0, origin = { x: 0, y: 0 } }: TransformerProps) {
  const s = SIZE[kind];
  const built = useBuilt(() => buildTransformer(kind), [kind]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: s.length, y0: 0, y1: s.width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
