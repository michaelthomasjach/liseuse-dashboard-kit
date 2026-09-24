import { Matrix4 } from "three";
import { Builder, type P2, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { rng } from "./three/random";
import { addTree } from "./Tree";
import { addCar } from "./Car";

/**
 * Les bâtiments du voisinage — **non interactifs** : on ne les construit pas, on ne les exploite
 * pas, ils sont là.
 *
 * Un terrain à bâtir n'est jamais posé dans le vide : il a des voisins. Une rue de maisons, un
 * lotissement de pavillons, un petit immeuble, l'atelier d'une PME, un commerce au coin. Ce sont eux
 * qui disent que le terrain dont on dispose est **limité** — qu'au-delà de la clôture, la ville
 * continue et n'est pas à nous.
 *
 * Six sortes, qu'on reconnaît à leur silhouette plus qu'à leurs détails :
 * - `"house"`     : la maison de ville, deux niveaux, un toit à deux pans et sa cheminée ;
 * - `"pavilion"`  : le pavillon de lotissement, de plain-pied, toit à quatre pans, son garage, son
 *   jardin, sa haie, sa voiture dans l'allée ;
 * - `"apartment"` : le petit immeuble, quatre à six niveaux, toit plat, balcons ;
 * - `"office"`    : les bureaux d'une petite entreprise, bandeaux vitrés, enseigne, trois places de
 *   parking ;
 * - `"workshop"`  : l'atelier d'une PME — un bardage métallique, une porte sectionnelle, un bureau
 *   accolé ;
 * - `"shop"`      : le commerce de quartier, vitrine et store au rez-de-chaussée, logement au-dessus.
 *
 * Chaque bâtiment est tiré d'une **graine** : teinte des murs et du toit, nombre de niveaux,
 * longueur de façade varient d'un voisin à l'autre, mais un bâtiment donné garde son allure.
 *
 * Le repère : le bâtiment occupe sa **parcelle**, de `(0, 0)` à `lotSize(kind)`, et **sa façade
 * regarde vers les `y` négatifs** — la rue est de ce côté-là. On le tourne pour l'aligner sur une
 * autre rue.
 */

export type BuildingKind = "house" | "pavilion" | "apartment" | "office" | "workshop" | "shop";

export const BUILDING_KINDS: BuildingKind[] = ["house", "pavilion", "apartment", "office", "workshop", "shop"];

export const BUILDING_LABEL: Record<BuildingKind, string> = {
  house: "Maison de ville",
  pavilion: "Pavillon",
  apartment: "Petit immeuble",
  office: "Bureaux d'entreprise",
  workshop: "Atelier de PME",
  shop: "Commerce",
};

/** L'emprise d'une parcelle, en cases (une case vaut deux mètres), façade sur `y = 0`. */
const LOT: Record<BuildingKind, { width: number; depth: number }> = {
  house: { width: 4.5, depth: 6 },
  pavilion: { width: 8, depth: 8 },
  apartment: { width: 9, depth: 7 },
  office: { width: 9, depth: 8 },
  workshop: { width: 11, depth: 9 },
  shop: { width: 5, depth: 6 },
};

export function lotSize(kind: BuildingKind): { width: number; depth: number } {
  return LOT[kind];
}

const WALLS = ["paint-light", "wall", "kerb", "pavement", "paint-light"];
const ROOFS = ["paint-warm", "roof", "paint-dark"];
/** Hauteur d'un niveau : 2,8 m. */
const STOREY = 1.4;

/** Une grille de fenêtres sur une façade d'ordonnée `y` (normale vers `side`), de `x0` à `x1`. */
function windowsY(b: Builder, y: number, x0: number, x1: number, floors: number, z0: number, opts: { every?: number; w?: number; h?: number; skip?: (i: number, f: number) => boolean } = {}) {
  const every = opts.every ?? 1.3;
  const w = opts.w ?? 0.55;
  const h = opts.h ?? 0.7;
  const n = Math.max(1, Math.floor((x1 - x0) / every));
  const lead = x0 + (x1 - x0 - n * every) / 2 + every / 2;
  for (let f = 0; f < floors; f += 1)
    for (let i = 0; i < n; i += 1) {
      if (opts.skip?.(i, f)) continue;
      const cx = lead + i * every;
      const zb = z0 + f * STOREY + 0.45;
      b.faceY("lq-building__window", y, cx - w / 2, cx + w / 2, zb, zb + h, true);
    }
}

/** La même chose sur une façade d'abscisse `x`. */
function windowsX(b: Builder, x: number, y0: number, y1: number, floors: number, z0: number, opts: { every?: number; w?: number; h?: number } = {}) {
  const every = opts.every ?? 1.3;
  const w = opts.w ?? 0.55;
  const h = opts.h ?? 0.7;
  const n = Math.max(1, Math.floor((y1 - y0) / every));
  const lead = y0 + (y1 - y0 - n * every) / 2 + every / 2;
  for (let f = 0; f < floors; f += 1)
    for (let i = 0; i < n; i += 1) {
      const cy = lead + i * every;
      const zb = z0 + f * STOREY + 0.45;
      b.faceX("lq-building__window", x, cy - w / 2, cy + w / 2, zb, zb + h, true);
    }
}

/** Un toit à deux pans, faîtage le long des `x`, débord `o`. */
function gable(b: Builder, mat: string, x0: number, x1: number, y0: number, y1: number, z: number, rise: number, o = 0.15) {
  // Le profil est dans `(y, z)` : un quart de tour le couche le long des `x`.
  const spin = new Matrix4().makeRotationZ(Math.PI / 2);
  const ym = (y0 + y1) / 2;
  const prof: P2[] = [
    { x: y0 - o, y: z - 0.05 },
    { x: y1 + o, y: z - 0.05 },
    { x: ym, y: z + rise },
  ];
  b.within(spin, () => b.profile(mat, prof, -(x1 + o), -(x0 - o)));
  // Les pignons, dans la teinte des murs, sous le toit.
}

/** Un toit à quatre pans : un faîtage plus court que le bâtiment. */
function hipped(b: Builder, mat: string, x0: number, x1: number, y0: number, y1: number, z: number, rise: number, o = 0.18) {
  const ym = (y0 + y1) / 2;
  const inset = Math.min((y1 - y0) / 2, (x1 - x0) / 2 - 0.05);
  const c: P3[] = [
    [x0 - o, y0 - o, z],
    [x1 + o, y0 - o, z],
    [x1 + o, y1 + o, z],
    [x0 - o, y1 + o, z],
    [x0 + inset, ym - 0.001, z + rise],
    [x1 - inset, ym - 0.001, z + rise],
    [x1 - inset, ym + 0.001, z + rise],
    [x0 + inset, ym + 0.001, z + rise],
  ];
  b.hexa(mat, c);
}

/** Les pignons d'un toit à deux pans : deux triangles de mur sous le toit. */
function gableEnds(b: Builder, mat: string, x0: number, x1: number, y0: number, y1: number, z: number, rise: number) {
  const ym = (y0 + y1) / 2;
  for (const x of [x0, x1]) {
    const d = 0.001;
    b.hexa(mat, [
      [x - d, y0, z],
      [x + d, y0, z],
      [x + d, y1, z],
      [x - d, y1, z],
      [x - d, ym - 0.001, z + rise],
      [x + d, ym - 0.001, z + rise],
      [x + d, ym + 0.001, z + rise],
      [x - d, ym + 0.001, z + rise],
    ], false);
  }
}

/** Une porte d'entrée sur la façade `y`, centrée en `cx`. */
function door(b: Builder, y: number, cx: number, z0 = 0, w = 0.5, h = 1.05) {
  b.faceY("lq-building__door", y, cx - w / 2, cx + w / 2, z0, z0 + h, true);
}

/** Un bâtiment entier, dans un constructeur, sur sa parcelle. */
export function addBuilding(b: Builder, kind: BuildingKind, seed = 1): void {
  const r = rng(seed * 7 + BUILDING_KINDS.indexOf(kind) * 131);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const lot = LOT[kind];
  const wall = pick(WALLS);
  const roof = pick(ROOFS);
  const F = -0.004; // un rien devant la façade `y = y0`, pour les pièces rapportées

  if (kind === "house") {
    const floors = 2 + (r() < 0.3 ? 1 : 0);
    const x0 = 0.25;
    const x1 = lot.width - 0.25;
    const y0 = 1;
    const y1 = y0 + 3.4;
    const H = floors * STOREY;
    b.box(wall, x0, x1, y0, y1, 0, H);
    b.box("kerb", x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, 0, 0.25, false);
    gable(b, roof, x0, x1, y0, y1, H, 1.3);
    gableEnds(b, wall, x0, x1, y0, y1, H, 1.25);
    b.box("paint-dark", x1 - 0.9, x1 - 0.55, y0 + 1.1, y0 + 1.45, H + 0.5, H + 1.6);
    windowsY(b, y0 + F, x0, x1, floors, 0, { skip: (i, f) => f === 0 && i === 0 });
    windowsY(b, y1 - F, x0, x1, floors, 0);
    door(b, y0 + F, x0 + 0.8);
    // Le perron, et une bande de jardinet devant.
    b.box("kerb", x0 + 0.45, x0 + 1.15, y0 - 0.35, y0, 0, 0.12);
    b.box("grass", 0, lot.width, 0, y0 - 0.35, -0.02, 0.03, false);
    b.box("grass", 0, lot.width, y1 + 0.2, lot.depth, -0.02, 0.03, false);
    addTree(b, { x: lot.width - 0.9, y: lot.depth - 0.8, kind: "round", height: 2.6 + r(), seed: seed + 3 });
    return;
  }

  if (kind === "pavilion") {
    // Le jardin, l'allée, la haie, puis la maison et son garage.
    b.box("grass", 0, lot.width, 0, lot.depth, -0.02, 0.03, false);
    b.box("pavement", lot.width - 2.6, lot.width - 0.6, 0, 3, -0.02, 0.04, false);
    for (let x = 0.3; x < lot.width - 2.8; x += 0.55) addTree(b, { x, y: 0.3, kind: "bush", height: 0.55, seed: seed * 13 + Math.round(x * 10) });
    for (let y = 0.9; y < lot.depth - 0.2; y += 0.55) addTree(b, { x: 0.3, y, kind: "bush", height: 0.55, seed: seed * 17 + Math.round(y * 10) });
    const x0 = 1.2;
    const x1 = lot.width - 2.7;
    const y0 = 2.2;
    const y1 = y0 + 3.6;
    const H = STOREY;
    b.box(wall, x0, x1, y0, y1, 0, H);
    hipped(b, roof, x0, x1, y0, y1, H, 1.1);
    windowsY(b, y0 + F, x0, x1, 1, 0, { every: 1.5, skip: (i) => i === 1 });
    windowsY(b, y1 - F, x0, x1, 1, 0, { every: 1.4, w: 0.9 });
    windowsX(b, x0 + F, y0, y1, 1, 0, { every: 1.6 });
    door(b, y0 + F, (x0 + x1) / 2);
    // Le garage accolé, toit plat, sa porte basculante.
    const g0 = x1;
    const g1 = lot.width - 0.6;
    b.box(wall, g0, g1, y0 + 0.8, y1 - 0.4, 0, H * 0.85);
    b.box("paint-dark", g0 - 0.05, g1 + 0.1, y0 + 0.7, y1 - 0.3, H * 0.85, H * 0.85 + 0.08);
    b.faceY("lq-building__garage", y0 + 0.8 + F, g0 + 0.25, g1 - 0.25, 0, H * 0.7, true);
    b.within(new Matrix4().makeTranslation(lot.width - 1.1, 0.35, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), () => addCar(b, pick(["sedan", "hatch"] as const), pick(["light", "dark", "warm", "cool", "accent"] as const), { wheels: true }));
    addTree(b, { x: 2, y: lot.depth - 1, kind: pick(["round", "conifer"] as const), height: 2.5 + r() * 1.2, seed: seed + 5 });
    return;
  }

  if (kind === "apartment") {
    const floors = 4 + Math.floor(r() * 3);
    const x0 = 0.5;
    const x1 = lot.width - 0.5;
    const y0 = 1.5;
    const y1 = lot.depth - 1;
    const H = floors * STOREY;
    b.box("paint-dark", x0, x1, y0, y1, 0, 0.5);
    b.box(wall, x0, x1, y0, y1, 0.5, H);
    // L'acrotère du toit plat, ses édicules.
    b.box(wall, x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, H, H + 0.2);
    b.box("roof", x0 + 0.1, x1 - 0.1, y0 + 0.1, y1 - 0.1, H, H + 0.12, false);
    b.box("steel", x1 - 2, x1 - 1, y1 - 1.8, y1 - 0.8, H + 0.12, H + 0.8);
    windowsY(b, y0 + F, x0, x1, floors, 0, { every: 1.5, w: 0.7 });
    windowsY(b, y1 - F, x0, x1, floors, 0, { every: 1.5, w: 0.7 });
    windowsX(b, x0 + F, y0, y1, floors, 0, { every: 1.6 });
    windowsX(b, x1 - F, y0, y1, floors, 0, { every: 1.6 });
    // Les balcons, un sur deux, en saillie sur la façade de rue.
    const n = Math.floor((x1 - x0) / 3);
    for (let f = 1; f < floors; f += 1)
      for (let i = 0; i < n; i += 1) {
        const cx = x0 + (x1 - x0) * ((i + 0.5) / n);
        const z = f * STOREY;
        b.box("kerb", cx - 0.9, cx + 0.9, y0 - 0.55, y0, z, z + 0.08);
        b.box("glass", cx - 0.9, cx + 0.9, y0 - 0.56, y0 - 0.5, z + 0.08, z + 0.5, false);
      }
    b.faceY("lq-building__door", y0 + F, (x0 + x1) / 2 - 0.5, (x0 + x1) / 2 + 0.5, 0, 1.1, true);
    b.box("pavement", 0, lot.width, 0, y0, -0.02, 0.04, false);
    addTree(b, { x: 1, y: 0.7, kind: "round", height: 3, seed: seed + 1 });
    addTree(b, { x: lot.width - 1, y: 0.7, kind: "round", height: 3.2, seed: seed + 2 });
    return;
  }

  if (kind === "office") {
    const floors = 2 + Math.floor(r() * 2);
    const x0 = 0.5;
    const x1 = lot.width - 0.5;
    const y0 = 3;
    const y1 = lot.depth - 0.5;
    const H = floors * STOREY;
    b.box("pavement", 0, lot.width, 0, y0, -0.02, 0.03, false);
    b.box(wall, x0, x1, y0, y1, 0, H + 0.3);
    // Les bandeaux vitrés filants, un par niveau.
    for (let f = 0; f < floors; f += 1) {
      const z = f * STOREY + 0.35;
      b.faceY("lq-building__window", y0 + F, x0 + 0.2, x1 - 0.2, z, z + 0.85, true);
      b.faceX("lq-building__window", x0 + F, y0 + 0.2, y1 - 0.2, z, z + 0.85, true);
      b.faceX("lq-building__window", x1 - F, y0 + 0.2, y1 - 0.2, z, z + 0.85, true);
    }
    // L'entrée vitrée, en saillie, sous une marquise, et l'enseigne sur l'acrotère.
    b.box("glass", x0 + 1, x0 + 2.6, y0 - 0.8, y0, 0, 1.3);
    b.box("paint-dark", x0 + 0.8, x0 + 2.8, y0 - 1, y0, 1.3, 1.4);
    b.faceY("lq-sign__face", y0 + F, x1 - 3.4, x1 - 0.6, H - 0.05, H + 0.25, true);
    b.faceY("lq-sign__mark", y0 + F * 2, x1 - 3.3, x1 - 2.9, H, H + 0.2);
    // Les places de parking devant, deux voitures.
    for (let i = 0; i < 4; i += 1) {
      const x = 3.2 + i * 1.3;
      b.faceZ("lq-road__mark", 0.035, x, x + 0.06, 0.2, 2.5);
    }
    for (const i of [0, 2]) {
      if (r() < 0.25) continue;
      b.within(new Matrix4().makeTranslation(3.9 + i * 1.3, 0.3, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), () => addCar(b, pick(["sedan", "hatch", "van"] as const), pick(["light", "dark", "warm", "cool", "accent"] as const), { wheels: true }));
    }
    return;
  }

  if (kind === "workshop") {
    const x0 = 0.5;
    const x1 = lot.width - 3;
    const y0 = 2.5;
    const y1 = lot.depth - 0.5;
    const H = 2.6;
    b.box("pavement", 0, lot.width, 0, y0, -0.02, 0.03, false);
    // Le bardage : un volume, et ses nervures verticales en traits.
    b.box(wall, x0, x1, y0, y1, 0, H);
    gable(b, "roof", x0, x1, y0, y1, H, 0.45, 0.1);
    gableEnds(b, wall, x0, x1, y0, y1, H, 0.42);
    const ribs: [P3, P3][] = [];
    for (let x = x0 + 0.2; x < x1; x += 0.25) ribs.push([[x, y0 - 0.004, 0.1], [x, y0 - 0.004, H - 0.05]]);
    b.lines("lq-trailer__line", ribs);
    b.faceY("lq-building__garage", y0 - 0.006, x0 + 1, x0 + 3.2, 0, 2, true);
    b.faceY("lq-building__garage", y0 - 0.006, x0 + 4, x0 + 6.2, 0, 2, true);
    b.faceY("lq-building__window", y0 - 0.006, x0 + 0.3, x1 - 0.3, H - 0.55, H - 0.25, true);
    // Le bureau accolé, sur un niveau et demi.
    b.box("paint-light", x1, lot.width - 0.5, y0 + 0.5, y1 - 2, 0, 1.9);
    windowsY(b, y0 + 0.5 + F, x1, lot.width - 0.5, 1, 0, { every: 1.2, w: 0.7 });
    door(b, y0 + 0.5 + F, lot.width - 1.1);
    b.faceY("lq-sign__face", y0 - 0.008, x0 + 7, x1 - 0.4, H - 0.05, H + 0.02, true);
    // Quelques palettes et un conteneur à déchets dans la cour.
    b.box("wood", x1 - 0.8, x1 - 0.2, 0.6, 1.2, 0, 0.3);
    b.box("paint-cool", 0.4, 1.4, 0.4, 1.1, 0, 0.6);
    return;
  }

  // Le commerce : vitrine et store au rez-de-chaussée, un logement au-dessus.
  const floors = 2 + (r() < 0.4 ? 1 : 0);
  const x0 = 0.2;
  const x1 = lot.width - 0.2;
  const y0 = 1.2;
  const y1 = lot.depth - 0.4;
  const H = floors * STOREY;
  b.box("pavement", 0, lot.width, 0, y0, -0.02, 0.04, false);
  b.box(wall, x0, x1, y0, y1, 0, H + 0.15);
  b.box("paint-dark", x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, H + 0.15, H + 0.25, false);
  b.faceY("lq-building__window", y0 + F, x0 + 0.3, x1 - 1.2, 0.15, 1.15, true);
  door(b, y0 + F, x1 - 0.7, 0, 0.6, 1.1);
  // Le store rayé, incliné au-dessus de la vitrine.
  b.hexa("stripe", [
    [x0 + 0.2, y0, 1.35],
    [x1 - 0.2, y0, 1.35],
    [x1 - 0.2, y0, 1.42],
    [x0 + 0.2, y0, 1.42],
    [x0 + 0.2, y0 - 0.8, 1.05],
    [x1 - 0.2, y0 - 0.8, 1.05],
    [x1 - 0.2, y0 - 0.8, 1.12],
    [x0 + 0.2, y0 - 0.8, 1.12],
  ]);
  b.faceY("lq-sign__face", y0 + F, x0 + 0.4, x1 - 0.4, 1.5, 1.72, true);
  windowsY(b, y0 + F, x0, x1, floors - 1, STOREY, { every: 1.4 });
  windowsY(b, y1 - F, x0, x1, floors, 0, { every: 1.4 });
}

export interface BuildingProps {
  kind?: BuildingKind;
  /** La graine de ses variations. */
  seed?: number;
  rotation?: number;
  /** Où poser le coin de la parcelle, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export function Building(props: BuildingProps) {
  const { kind = "house", rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 22, className } = props;
  const lot = LOT[kind];
  const { bounds } = placed(origin, rotation, { x0: 0, x1: lot.width, y0: -0.6, y1: lot.depth, z0: 0, z1: kind === "apartment" ? 9.5 : 5 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-building", className].filter(Boolean).join(" ")} ariaLabel={BUILDING_LABEL[kind]}>
      <BuildingBody {...props} />
    </Solo>
  );
}

function BuildingBody({ kind = "house", seed = 1, rotation = 0, origin = { x: 0, y: 0 } }: BuildingProps) {
  const lot = LOT[kind];
  const built = useBuilt(() => {
    const b = new Builder();
    addBuilding(b, kind, seed);
    return b.build();
  }, [kind, seed]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: lot.width, y0: 0, y1: lot.depth, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

export interface BuildingSpec {
  kind: BuildingKind;
  seed?: number;
  origin: { x: number; y: number };
  rotation?: number;
}

/** Tout un quartier en un seul maillage — des dizaines de bâtiments au prix d'un. */
export function Buildings({ buildings, frame, cellSize = 16, className }: { buildings: BuildingSpec[]; frame?: BuildingProps["frame"]; cellSize?: number; className?: string }) {
  const boxes = buildings.map((s) => placed(s.origin, s.rotation ?? 0, { x0: 0, x1: LOT[s.kind].width, y0: 0, y1: LOT[s.kind].depth, z0: 0, z1: 1 }).bounds);
  const bounds = boxes.length
    ? { x0: Math.min(...boxes.map((q) => q.x0)), x1: Math.max(...boxes.map((q) => q.x1)), y0: Math.min(...boxes.map((q) => q.y0)), y1: Math.max(...boxes.map((q) => q.y1)), z0: 0, z1: 9 }
    : { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Quartier">
      <BuildingsBody buildings={buildings} />
    </Solo>
  );
}

function BuildingsBody({ buildings }: { buildings: BuildingSpec[] }) {
  const built = useBuilt(() => {
    const b = new Builder();
    for (const s of buildings) {
      const lot = LOT[s.kind];
      const { pose } = placed(s.origin, s.rotation ?? 0, { x0: 0, x1: lot.width, y0: 0, y1: lot.depth, z0: 0, z1: 1 });
      b.within(pose, () => addBuilding(b, s.kind, s.seed ?? 1));
    }
    return b.build();
  }, [JSON.stringify(buildings)]);
  return <Parts built={built} />;
}
