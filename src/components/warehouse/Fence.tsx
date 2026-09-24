import { Matrix4 } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * Clôtures et barrières : ce qui ferme un site et ce qui canalise ce qui y roule.
 *
 * Quatre sortes, qu'on trouve toutes autour d'une plateforme logistique :
 * - `"mesh"`    : la clôture de site en panneaux rigides — poteaux, panneaux de treillis soudé,
 *   deux plis horizontaux. C'est elle qui fait le tour du terrain ;
 * - `"jersey"`  : le séparateur en béton, au profil en « J » — il protège un pied de bâtiment, une
 *   cuve, une file de piétons ;
 * - `"guard"`   : la glissière métallique, lisse sur ses poteaux ;
 * - `"barrier"` : la barrière de protection jaune et noire des allées intérieures, qui tient les
 *   chariots à l'écart des racks et des passages piétons.
 *
 * Une clôture est un **segment** : elle court le long des `x` sur `length`, et on la tourne pour
 * fermer un terrain. Le treillis est dessiné en **traits** et non en volume : un maillage de fils
 * fins serait du bruit à cette échelle, et c'est ce qu'on voit d'une vraie clôture — des traits
 * serrés au travers desquels on voit le reste.
 */

export type FenceKind = "mesh" | "jersey" | "guard" | "barrier";

export interface FenceProps {
  kind?: FenceKind;
  /** Longueur du segment, en cases (une case vaut deux mètres). */
  length?: number;
  /** Hauteur, en cases. Par défaut, celle de la sorte : 1 case pour une clôture de site. */
  height?: number;
  /** Écart entre deux poteaux, en cases. */
  postEvery?: number;
  /** Rotation sur le sol, en degrés, autour du milieu du segment. */
  rotation?: number;
  /** Où commence le segment, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const HEIGHT: Record<FenceKind, number> = { mesh: 1, jersey: 0.4, guard: 0.38, barrier: 0.55 };
const DEPTH: Record<FenceKind, number> = { mesh: 0.06, jersey: 0.3, guard: 0.12, barrier: 0.1 };

function buildFence(kind: FenceKind, L: number, H: number, every: number) {
  const b = new Builder();
  const n = Math.max(1, Math.round(L / every));
  const step = L / n;
  if (kind === "jersey") {
    // Le profil en J, extrudé sur la longueur, en éléments de deux mètres jointifs.
    const w = DEPTH.jersey;
    const prof = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: H * 0.18 },
      { x: w * 0.72, y: H * 0.34 },
      { x: w * 0.6, y: H },
      { x: w * 0.4, y: H },
      { x: w * 0.28, y: H * 0.34 },
      { x: 0, y: H * 0.18 },
    ];
    const pieces = Math.max(1, Math.round(L));
    // Le profil est dessiné dans `(y, z)` ; un quart de tour le couche le long des `x`.
    const spin = new Matrix4().makeRotationZ(Math.PI / 2);
    for (let i = 0; i < pieces; i += 1) {
      const x0 = (L * i) / pieces;
      const x1 = (L * (i + 1)) / pieces - 0.015;
      b.within(spin, () => b.profile("kerb", prof.map((q) => ({ x: q.x - w / 2, y: q.y })), -x1, -x0));
    }
    return b.build();
  }
  if (kind === "guard") {
    for (let i = 0; i <= n; i += 1) b.box("steel", i * step - 0.04, i * step + 0.04, 0.06, 0.12, 0, H);
    // La lisse, profil en W simplifié : deux pans.
    b.box("chrome", 0, L, 0, 0.05, H * 0.55, H * 0.95);
    b.lines("lq-trailer__line", [[[0, -0.002, H * 0.75], [L, -0.002, H * 0.75]]]);
    return b.build();
  }
  if (kind === "barrier") {
    // Poteaux jaunes sur platine, deux lisses : la protection des allées.
    for (let i = 0; i <= n; i += 1) {
      const x = Math.min(L - 0.05, Math.max(0.05, i * step));
      b.box("safety", x - 0.05, x + 0.05, -0.05, 0.05, 0, H);
      b.box("steel", x - 0.08, x + 0.08, -0.08, 0.08, 0, 0.02, false);
    }
    for (const z of [H * 0.45, H * 0.85]) b.box("safety", 0, L, -0.035, 0.035, z - 0.05, z + 0.05);
    // Les chevrons noirs sur les lisses : ce qui la fait voir.
    const segs = Math.floor(L / 0.3);
    for (let i = 0; i < segs; i += 2) {
      const x0 = i * 0.3 + 0.05;
      b.faceY("lq-zone__hatch", -0.037, x0, x0 + 0.15, H * 0.85 - 0.05, H * 0.85 + 0.05);
      b.faceY("lq-zone__hatch", 0.037, x0, x0 + 0.15, H * 0.85 - 0.05, H * 0.85 + 0.05);
    }
    return b.build();
  }
  // La clôture de site : poteaux, panneaux cadrés, treillis en traits.
  for (let i = 0; i <= n; i += 1) {
    const x = i * step;
    b.box("paint-dark", x - 0.03, x + 0.03, -0.03, 0.03, 0, H + 0.04);
  }
  const segs: [[number, number, number], [number, number, number]][] = [];
  for (let i = 0; i < n; i += 1) {
    const x0 = i * step + 0.03;
    const x1 = (i + 1) * step - 0.03;
    // Le cadre du panneau, et ses deux plis horizontaux.
    b.box("paint-dark", x0, x1, -0.012, 0.012, 0.04, 0.06, false);
    b.box("paint-dark", x0, x1, -0.012, 0.012, H - 0.02, H, false);
    for (const z of [H * 0.33, H * 0.66]) b.box("paint-dark", x0, x1, -0.025, 0.025, z - 0.015, z + 0.015, false);
    // Le treillis : des fils verticaux serrés, tracés.
    const wires = Math.max(2, Math.round((x1 - x0) / 0.1));
    for (let k = 1; k < wires; k += 1) {
      const x = x0 + ((x1 - x0) * k) / wires;
      segs.push([[x, 0, 0.06], [x, 0, H - 0.02]]);
    }
  }
  b.lines("lq-fence__wire", segs);
  return b.build();
}

export function Fence(props: FenceProps) {
  const { kind = "mesh", length = 6, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const H = props.height ?? HEIGHT[kind];
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: -DEPTH[kind], y1: DEPTH[kind], z0: 0, z1: H + 0.05 }, { x: length / 2, y: 0 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-fence", className].filter(Boolean).join(" ")} ariaLabel="Clôture">
      <FenceBody {...props} />
    </Solo>
  );
}

function FenceBody({ kind = "mesh", length = 6, height, postEvery = 1.25, rotation = 0, origin = { x: 0, y: 0 } }: FenceProps) {
  const H = height ?? HEIGHT[kind];
  const L = Math.max(0.2, length);
  const built = useBuilt(() => buildFence(kind, L, H, Math.max(0.3, postEvery)), [kind, L, H, postEvery]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: 0, z0: 0, z1: 1 }, { x: L / 2, y: 0 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
