import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { rng } from "./three/random";
import { addTree } from "./Tree";

/**
 * Un parterre de fleurs : la touche qui fait d'une entrée de site un accueil.
 *
 * Une bordure basse — béton ou bois —, une terre sombre, et des **massifs** de fleurs en touffes
 * colorées, semés en quinconce, avec quelques arbustes pour donner du relief. Les couleurs sont
 * celles des accents du thème : poudrées en couleur, elles deviennent des gris distincts sur une
 * liseuse, et le parterre reste un parterre.
 *
 * - `"rect"`  : un parterre rectangulaire, le long d'une façade ou d'une allée ;
 * - `"round"` : un rond fleuri, au milieu d'un rond-point ou d'une cour.
 */

export type FlowerBedShape = "rect" | "round";

export interface FlowerBedProps {
  shape?: FlowerBedShape;
  /** Longueur (ou diamètre), en cases. */
  length?: number;
  /** Largeur, en cases (parterre rectangulaire). */
  width?: number;
  /** La densité des fleurs, de 0 à 1. */
  density?: number;
  /** Graine des couleurs et des places. */
  seed?: number;
  /** La bordure : béton ou bois. */
  border?: "concrete" | "wood";
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const PETALS = ["flower-rose", "flower-amber", "flower-violet", "flower-sky", "flower-white"];

function buildBed(p: FlowerBedProps) {
  const { shape = "rect", length = 3, width = 1, density = 0.8, seed = 1, border = "concrete" } = p;
  const b = new Builder();
  const r = rng(seed * 17 + 3);
  const round = shape === "round";
  const L = Math.max(0.6, length);
  const W = round ? L : Math.max(0.4, width);
  const edge = border === "wood" ? "wood" : "kerb";
  const h = 0.12;
  if (round) {
    const ring = (rad: number) => Array.from({ length: 28 }, (_, i) => ({ x: L / 2 + Math.cos((i / 28) * Math.PI * 2) * rad, y: L / 2 + Math.sin((i / 28) * Math.PI * 2) * rad }));
    b.prism(edge, ring(L / 2), 0, h);
    b.prism("soil", ring(L / 2 - 0.08), h, h + 0.012, false);
  } else {
    b.box(edge, 0, L, 0, W, 0, h);
    b.box("soil", 0.07, L - 0.07, 0.07, W - 0.07, h, h + 0.012, false);
  }
  const inside = (x: number, y: number) => (round ? Math.hypot(x - L / 2, y - L / 2) < L / 2 - 0.18 : x > 0.16 && x < L - 0.16 && y > 0.16 && y < W - 0.16);
  // Les massifs : des touffes de feuillage, coiffées de fleurs d'une couleur par massif.
  const step = 0.26;
  let k = 0;
  for (let x = 0.16; x < L; x += step)
    for (let y = 0.16 + ((Math.round(x / step) % 2) * step) / 2; y < W; y += step) {
      if (!inside(x, y) || r() > density) continue;
      const petal = PETALS[Math.floor(((x + y * 0.7) / 0.8 + seed) % PETALS.length)];
      const z = h + 0.012;
      b.blob("foliage", x, y, z + 0.06, 0.1, 0, 0.75);
      for (let f = 0; f < 4; f += 1) {
        const a = (f / 4) * Math.PI * 2 + r();
        b.blob(petal, x + Math.cos(a) * 0.06, y + Math.sin(a) * 0.06, z + 0.13 + r() * 0.03, 0.05, 0);
      }
      k += 1;
    }
  // Un ou deux arbustes pour le relief, au centre ou aux bouts.
  if (round) addTree(b, { x: L / 2, y: L / 2, kind: "boxwood", height: 0.45, seed });
  else if (L > 2) for (const x of [0.4, L - 0.4]) addTree(b, { x, y: W / 2, kind: "boxwood", height: 0.4, seed: seed + Math.round(x * 10) });
  void k;
  return { built: b.build(), L, W };
}

export function FlowerBed(props: FlowerBedProps) {
  const { shape = "rect", length = 3, width = 1, rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 40, className } = props;
  const L = Math.max(0.6, length);
  const W = shape === "round" ? L : Math.max(0.4, width);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 0.5 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Parterre de fleurs">
      <FlowerBedBody {...props} />
    </Solo>
  );
}

function FlowerBedBody(props: FlowerBedProps) {
  const { rotation = 0, origin = { x: 0, y: 0 } } = props;
  const built = useBuilt(() => buildBed(props).built, [props.shape, props.length, props.width, props.density, props.seed, props.border]);
  const L = Math.max(0.6, props.length ?? 3);
  const W = props.shape === "round" ? L : Math.max(0.4, props.width ?? 1);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
