import { Matrix4 } from "three";
import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * Les panneaux solaires : un champ au sol, et le panneau seul qu'on pose sur un toit.
 *
 * Un panneau est un **module** de 1 × 2 m — une demi-case sur une case —, en verre sombre sur un
 * cadre d'aluminium, et ses cellules se lisent en quadrillage : c'est ce quadrillage qui le fait
 * reconnaître d'en haut comme de biais. Sur le sol, les modules sont en **tables** inclinées vers le
 * soleil, sur des pieds, rangées en lignes assez espacées pour ne pas se faire d'ombre.
 *
 * Le champ grandit par lignes et par colonnes ; `inverter` lui ajoute l'armoire de l'onduleur, et
 * `battery` un conteneur de stockage — l'installation d'un site qui consomme ce qu'il produit.
 *
 * Le repère : le champ va de `(0, 0)` à son emprise ; les tables regardent vers les `y` négatifs.
 */

export interface SolarArrayProps {
  /** Lignes de tables, les unes derrière les autres. */
  rows?: number;
  /** Modules par ligne. */
  columns?: number;
  /** Modules empilés dans une table, dans sa pente. */
  stack?: number;
  /** Inclinaison des tables, en degrés. */
  tilt?: number;
  /** L'armoire de l'onduleur, au bout du champ. */
  inverter?: boolean;
  /** Un conteneur de batteries, à côté de l'onduleur. */
  battery?: boolean;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Un module : 1 × 2 m. */
export const PANEL_W = 0.5;
export const PANEL_L = 1;
const GAP = 0.02;

/**
 * Poser un panneau dans un constructeur : un rectangle `w × l` couché dans le plan `z = 0` du repère
 * courant, son cadre et le quadrillage de ses cellules. Pour l'incliner, on le pose dans un repère
 * incliné (`b.within`).
 */
export function addSolarPanel(b: Builder, x: number, y: number, w = PANEL_W, l = PANEL_L): void {
  b.box("paint-dark", x, x + w, y, y + l, 0, 0.02);
  b.faceZ("lq-solar__glass", 0.021, x + 0.012, x + w - 0.012, y + 0.012, y + l - 0.012);
  const cells: [P3, P3][] = [];
  const nx = 3;
  const ny = 6;
  for (let i = 1; i < nx; i += 1) cells.push([[x + (w * i) / nx, y + 0.012, 0.023], [x + (w * i) / nx, y + l - 0.012, 0.023]]);
  for (let j = 1; j < ny; j += 1) cells.push([[x + 0.012, y + (l * j) / ny, 0.023], [x + w - 0.012, y + (l * j) / ny, 0.023]]);
  b.lines("lq-solar__cells", cells);
}

function layout(p: SolarArrayProps) {
  const rows = Math.max(1, Math.round(p.rows ?? 2));
  const cols = Math.max(1, Math.round(p.columns ?? 6));
  const stack = Math.max(1, Math.round(p.stack ?? 2));
  const tilt = Math.max(0, Math.min(45, p.tilt ?? 20));
  const t = (tilt * Math.PI) / 180;
  const slope = stack * (PANEL_L * 0.5 + GAP);
  const depthOfTable = slope * Math.cos(t);
  const rise = slope * Math.sin(t);
  // L'écart entre deux lignes : deux fois la hauteur de la table, pour qu'aucune n'ombre l'autre.
  const pitch = depthOfTable + Math.max(0.4, rise * 2);
  const L = cols * (PANEL_W + GAP) + 0.1;
  const extra = (p.inverter ? 0.8 : 0) + (p.battery ? 1.4 : 0);
  const D = rows * pitch;
  return { rows, cols, stack, t, slope, depthOfTable, rise, pitch, L, D, W: L + extra };
}

/** L'emprise d'un champ, avant rotation. */
export function solarArraySize(p: SolarArrayProps): { length: number; width: number } {
  const { W, D } = layout(p);
  return { length: W, width: D };
}

export function SolarArray(props: SolarArrayProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className } = props;
  const { W, D } = layout(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: W, y0: 0, y1: D, z0: 0, z1: 1.5 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Panneaux solaires">
      <SolarArrayBody {...props} />
    </Solo>
  );
}

function SolarArrayBody(props: SolarArrayProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, inverter = false, battery = false } = props;
  const L = layout(props);
  const built = useBuilt(() => {
    const b = new Builder();
    const { rows, cols, stack, t, slope, depthOfTable, rise, pitch } = L;
    const low = 0.25;
    for (let r = 0; r < rows; r += 1) {
      const y0 = r * pitch + 0.1;
      // Les pieds : un poteau bas à l'avant, un haut à l'arrière, tous les deux modules.
      for (let c = 0; c <= cols; c += 2) {
        const x = 0.05 + Math.min(c, cols) * (PANEL_W + GAP);
        b.box("steel", x - 0.015, x + 0.015, y0 + 0.02, y0 + 0.05, 0, low);
        b.box("steel", x - 0.015, x + 0.015, y0 + depthOfTable - 0.05, y0 + depthOfTable - 0.02, 0, low + rise);
        b.beam("steel", [x, y0 + 0.035, low], [x, y0 + depthOfTable - 0.035, low + rise], 0.012, false);
      }
      // La table : les modules, dans le plan incliné qui monte vers l'arrière.
      const m = new Matrix4().makeTranslation(0, y0, low).multiply(new Matrix4().makeRotationX(t));
      b.within(m, () => {
        for (let c = 0; c < cols; c += 1)
          for (let k = 0; k < stack; k += 1) {
            // Portrait dans la pente : la demi-case en travers, la case en long — deux modules de
            // haut font une table de quatre mètres.
            addSolarPanel(b, 0.05 + c * (PANEL_W + GAP), k * (PANEL_L * 0.5 + GAP), PANEL_W, PANEL_L * 0.5);
          }
      });
      void slope;
    }
    let x = L.L + 0.1;
    if (inverter) {
      // L'onduleur : une armoire blanche sur socle, ventilée.
      b.box("slab", x, x + 0.6, 0.2, 0.7, 0, 0.06);
      b.box("paint-light", x + 0.05, x + 0.55, 0.25, 0.65, 0.06, 0.95);
      b.lines("lq-trailer__line", [0.3, 0.4, 0.5].map((z): [P3, P3] => [[x + 0.1, 0.249, z], [x + 0.5, 0.249, z]]));
      x += 0.8;
    }
    if (battery) {
      // Le stockage : un conteneur de 20 pieds, climatisé, sur longrines.
      b.box("slab", x, x + 1.3, 0.1, 3.2, 0, 0.05);
      b.box("container-alt", x + 0.04, x + 1.26, 0.15, 3.15, 0.05, 1.33);
      b.box("paint-dark", x + 0.3, x + 1.0, 1.2, 2.1, 1.33, 1.5);
      b.lines("lq-trailer__line", Array.from({ length: 18 }, (_, i): [P3, P3] => [[x + 0.039, 0.3 + i * 0.16, 0.12], [x + 0.039, 0.3 + i * 0.16, 1.28]]));
    }
    return b.build();
  }, [JSON.stringify([L.rows, L.cols, L.stack, L.t, inverter, battery])]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L.W, y0: 0, y1: L.D, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
