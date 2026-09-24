import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * La toiture d'une pièce ou d'un bâtiment, posée sur ses murs — et ce qu'on installe dessus.
 *
 * Trois états, qui sont aussi trois évolutions :
 * - `"deck"` : un **bac acier** nervuré, cerné d'un acrotère : un toit, sans plus ;
 * - `"skylight"` : le même, percé de **lanterneaux** vitrés en bandes, qui éclairent l'intérieur ;
 * - `"cold"` : la **chambre froide** — le toit isolé de panneaux blancs, et dessus les **groupes
 *   frigorifiques** : des condenseurs à ventilateurs en rangée, leurs tuyauteries calorifugées qui
 *   plongent dans le toit, un caillebotis de maintenance. Une pièce ainsi coiffée garde le froid.
 *
 * Le repère : la toiture couvre `(0, 0)` → `(length, width)`, à la hauteur `height` — celle du haut
 * des murs, qu'elle coiffe.
 */

export type RoofKind = "deck" | "skylight" | "cold";

export interface RoofProps {
  kind?: RoofKind;
  length?: number;
  width?: number;
  /** La hauteur du dessus des murs, en cases. */
  height?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Un groupe frigorifique : une caisse, ses deux ventilateurs sur le dessus, ses pieds. */
export function addCondenser(b: Builder, x: number, y: number, z: number, l = 0.9, w = 0.45, h = 0.4): void {
  for (const dx of [0.05, l - 0.1]) for (const dy of [0.05, w - 0.1]) b.box("steel", x + dx, x + dx + 0.05, y + dy, y + dy + 0.05, z, z + 0.06, false);
  b.box("paint-light", x, x + l, y, y + w, z + 0.06, z + 0.06 + h);
  const top = z + 0.06 + h;
  const fans: [P3, P3][] = [];
  for (const fx of [l / 4, (3 * l) / 4]) {
    const cx = x + fx;
    const cy = y + w / 2;
    const r = Math.min(l / 4, w / 2) - 0.03;
    const ring: P3[] = [];
    for (let i = 0; i < 16; i += 1) ring.push([cx + Math.cos((i / 16) * Math.PI * 2) * r, cy + Math.sin((i / 16) * Math.PI * 2) * r, top + 0.002]);
    b.decal("lq-roof__fan", ring, true);
    fans.push([[cx - r, cy, top + 0.004], [cx + r, cy, top + 0.004]], [[cx, cy - r, top + 0.004], [cx, cy + r, top + 0.004]]);
  }
  b.lines("lq-roof__grille", fans);
  // Les ailettes du condenseur, sur les flancs.
  const fins: [P3, P3][] = [];
  for (let k = 0.08; k < l - 0.05; k += 0.05) for (const yy of [y - 0.002, y + w + 0.002]) fins.push([[x + k, yy, z + 0.1], [x + k, yy, top - 0.05]]);
  b.lines("lq-trailer__line", fins);
}

function buildRoof(p: RoofProps) {
  const { kind = "deck", length = 8, width = 6, height = 3 } = p;
  const L = Math.max(1, length);
  const W = Math.max(1, width);
  const b = new Builder();
  const z = height;
  const cold = kind === "cold";
  // La dalle : un bac acier, ou des panneaux isolants blancs, plus épais.
  const t = cold ? 0.14 : 0.08;
  b.box(cold ? "paint-light" : "roof", 0, L, 0, W, z - t, z);
  // L'acrotère tout autour.
  const e = 0.12;
  for (const [x0, x1, y0, y1] of [
    [0, L, 0, e],
    [0, L, W - e, W],
    [0, e, e, W - e],
    [L - e, L, e, W - e],
  ])
    b.box("wall", x0, x1, y0, y1, z, z + 0.18);
  // Les nervures du bac, ou les joints des panneaux.
  const ribs: [P3, P3][] = [];
  for (let x = cold ? 0.6 : 0.25; x < L - 0.1; x += cold ? 0.6 : 0.25) ribs.push([[x, e, z + 0.002], [x, W - e, z + 0.002]]);
  b.lines("lq-trailer__line", ribs);
  if (kind === "skylight") {
    // Les lanterneaux : des bandes vitrées sur costière, régulièrement espacées.
    for (let x = 1.2; x < L - 1; x += 2.4)
      for (let y = 0.8; y < W - 1.2; y += 2.2) {
        b.box("wall", x, x + 1, y, y + 1.4, z, z + 0.1);
        b.box("glass", x + 0.05, x + 0.95, y + 0.05, y + 1.35, z + 0.1, z + 0.22);
      }
  }
  if (cold) {
    // La rangée de groupes frigorifiques, sur un caillebotis, et leurs tuyauteries.
    const n = Math.max(1, Math.floor((L - 1) / 1.3));
    const y0 = W / 2 - 0.25;
    b.box("steel", 0.5, 0.5 + n * 1.3, y0 - 0.35, y0 + 0.8, z, z + 0.04);
    for (let i = 0; i < n; i += 1) {
      const x = 0.7 + i * 1.3;
      addCondenser(b, x, y0, z + 0.04);
      b.cylinder("paint-light", x + 0.45, y0 + 0.62, z + 0.12, 0.05, 0.16, "z", 10);
      b.beam("paint-light", [x + 0.45, y0 + 0.5, z + 0.2], [x + 0.45, y0 + 0.62, z + 0.2], 0.035, false);
    }
    // Les évaporateurs qu'on devine en rive : une gaine qui court le long de l'acrotère.
    b.box("paint-light", 0.3, L - 0.3, W - 0.5, W - 0.3, z, z + 0.2);
    b.faceZ("lq-roof__cold", z + 0.203, 0.4, L - 0.4, W - 0.48, W - 0.32);
  }
  return b.build();
}

export function Roof(props: RoofProps) {
  const { length = 8, width = 6, height = 3, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 24, className } = props;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: height + 0.8 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Toiture">
      <RoofBody {...props} />
    </Solo>
  );
}

function RoofBody(props: RoofProps) {
  const { length = 8, width = 6, rotation = 0, origin = { x: 0, y: 0 } } = props;
  const built = useBuilt(() => buildRoof(props), [props.kind, props.length, props.width, props.height]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
