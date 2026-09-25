import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, placed, useBuilt } from "./three/scene";
import { FLOOR_HEIGHT, SLAB_THICKNESS } from "./placement";

/**
 * Ce qui fait un **étage** : la dalle qui le porte, l'escalier et le monte-charge qui y mènent.
 *
 *  Tous trois se posent comme les autres modules — par le coin de leur emprise (`origin`), tournés
 *  de `rotation` autour de son centre — **au niveau du plancher où ils sont** : la dalle a son dessus
 *  à `z = 0` (elle descend de son épaisseur), l'escalier et le monte-charge partent de `z = 0` et
 *  montent d'un étage. C'est le plan qui les élève à leur étage (voir `placement.ts`).
 */

interface Placed {
  length?: number;
  width?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  cellSize?: number;
  className?: string;
}

/** La dalle d'un étage : un plateau de béton, sa rive, et un garde-corps sur son pourtour (`guard`). */
export function FloorSlab(props: Placed & { guard?: boolean }) {
  const { length = 8, width = 6, rotation = 0, origin = { x: 0, y: 0 }, cellSize = 20, className } = props;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: -SLAB_THICKNESS, z1: 1.2 });
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={className} ariaLabel="Dalle d'étage">
      <FloorSlabBody {...props} />
    </Solo>
  );
}

function FloorSlabBody({ length = 8, width = 6, rotation = 0, origin = { x: 0, y: 0 }, guard = false }: Placed & { guard?: boolean }) {
  const built = useBuilt(() => {
    const b = new Builder();
    b.box("slab", 0, length, 0, width, -SLAB_THICKNESS, 0);
    // La rive : une bande plus sombre sur le pourtour, qui dit l'épaisseur de la dalle.
    b.box("slab-edge", -0.02, length + 0.02, -0.02, 0.06, -SLAB_THICKNESS - 0.01, 0.005);
    b.box("slab-edge", -0.02, length + 0.02, width - 0.06, width + 0.02, -SLAB_THICKNESS - 0.01, 0.005);
    b.box("slab-edge", -0.02, 0.06, -0.02, width + 0.02, -SLAB_THICKNESS - 0.01, 0.005);
    b.box("slab-edge", length - 0.06, length + 0.02, -0.02, width + 0.02, -SLAB_THICKNESS - 0.01, 0.005);
    // Les joints de dalle, tous les 4 cases.
    const joints: [P3, P3][] = [];
    for (let x = 4; x < length - 0.5; x += 4) joints.push([[x, 0.1, 0.004], [x, width - 0.1, 0.004]]);
    for (let y = 4; y < width - 0.5; y += 4) joints.push([[0.1, y, 0.004], [length - 0.1, y, 0.004]]);
    if (joints.length) b.lines("lq-plot__seam", joints);
    if (guard) {
      // Un garde-corps : des potelets tous les 1,5 case, une lisse haute et une lisse intermédiaire.
      const h = 0.55;
      const edge = (x0: number, y0: number, x1: number, y1: number) => {
        const L = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.max(1, Math.round(L / 1.5));
        for (let i = 0; i <= n; i += 1) {
          const x = x0 + ((x1 - x0) * i) / n;
          const y = y0 + ((y1 - y0) * i) / n;
          b.box("safety", x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0, h);
        }
        b.beam("safety", [x0, y0, h], [x1, y1, h], 0.025, false);
        b.beam("safety", [x0, y0, h * 0.5], [x1, y1, h * 0.5], 0.018, false);
      };
      edge(0.05, 0.05, length - 0.05, 0.05);
      edge(length - 0.05, 0.05, length - 0.05, width - 0.05);
      edge(length - 0.05, width - 0.05, 0.05, width - 0.05);
      edge(0.05, width - 0.05, 0.05, 0.05);
    }
    return b.build();
  }, [length, width, guard]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

/** Un escalier droit qui monte d'un étage le long de sa longueur, ses deux limons et sa main courante ;
 *  `landing` : un palier à mi-hauteur. */
export function Stairs(props: Placed & { height?: number; landing?: boolean }) {
  const { length = 4.2, width = 1.4, height = FLOOR_HEIGHT, rotation = 0, origin = { x: 0, y: 0 }, cellSize = 30, className } = props;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: height + 0.6 });
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={className} ariaLabel="Escalier">
      <StairsBody {...props} />
    </Solo>
  );
}

function StairsBody({ length = 4.2, width = 1.4, height = FLOOR_HEIGHT, landing = false, rotation = 0, origin = { x: 0, y: 0 } }: Placed & { height?: number; landing?: boolean }) {
  const built = useBuilt(() => {
    const b = new Builder();
    const steps = Math.max(6, Math.round(height / 0.09));
    const run = landing ? length * 0.8 : length;
    const rise = height / steps;
    const tread = run / steps;
    for (let i = 0; i < steps; i += 1) {
      // Un palier à mi-course : les marches reprennent au-delà.
      const shift = landing && i >= steps / 2 ? length * 0.2 : 0;
      const x0 = i * tread + shift;
      b.box("steel", x0, x0 + tread + 0.01, 0.06, width - 0.06, (i + 1) * rise - 0.03, (i + 1) * rise);
    }
    if (landing) b.box("steel", run / 2, run / 2 + length * 0.2, 0.06, width - 0.06, height / 2 - 0.04, height / 2);
    // Les limons, de chaque côté, et la main courante.
    for (const y of [0, width - 0.06]) {
      b.beam("paint-dark", [0, y + 0.03, 0.05], [length, y + 0.03, height], 0.05, false);
      b.beam("safety", [0, y + 0.03, 0.5], [length, y + 0.03, height + 0.45], 0.02, false);
      for (const u of [0.05, 0.5, 0.95]) b.box("safety", u * length - 0.02, u * length + 0.02, y, y + 0.06, u * height, u * height + 0.47);
    }
    return b.build();
  }, [length, width, height, landing]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

/** Un monte-charge : une cage de poteaux et de grillage, la plate-forme, le moteur en tête. */
export function FreightLift(props: Placed & { height?: number }) {
  const { length = 2, width = 2, height = FLOOR_HEIGHT, rotation = 0, origin = { x: 0, y: 0 }, cellSize = 30, className } = props;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: height + 0.8 });
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={className} ariaLabel="Monte-charge">
      <FreightLiftBody {...props} />
    </Solo>
  );
}

function FreightLiftBody({ length = 2, width = 2, height = FLOOR_HEIGHT, rotation = 0, origin = { x: 0, y: 0 } }: Placed & { height?: number }) {
  const built = useBuilt(() => {
    const b = new Builder();
    const top = height + 0.7;
    for (const [x, y] of [
      [0, 0],
      [length - 0.12, 0],
      [length - 0.12, width - 0.12],
      [0, width - 0.12],
    ])
      b.box("paint-dark", x, x + 0.12, y, y + 0.12, 0, top);
    b.box("paint-dark", 0, length, 0, width, top - 0.1, top);
    b.box("cabinet", length * 0.25, length * 0.75, width * 0.2, width * 0.8, top, top + 0.25);
    // La plate-forme, en bas, et ses barrières de sécurité jaunes.
    b.box("steel", 0.12, length - 0.12, 0.12, width - 0.12, 0, 0.08);
    b.box("safety", 0.12, length - 0.12, 0.1, 0.14, 0.08, 0.6);
    // Le grillage de la cage, en traits.
    const mesh: [P3, P3][] = [];
    for (let z = 0.4; z < top - 0.2; z += 0.35) {
      mesh.push([[0, width, z], [length, width, z]], [[length, 0, z], [length, width, z]], [[0, 0, z], [0, width, z]]);
    }
    b.lines("lq-gate__bar", mesh);
    return b.build();
  }, [length, width, height]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
