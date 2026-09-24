import { plotInside, type PlotLayout } from "./plot";
import { semiTruckGeometry } from "./SemiTruck";
import { CONTAINER_DIMENSIONS } from "./ShippingContainer";
import { CAR_DIMENSIONS } from "./Car";
import { solarArraySize } from "./SolarPanel";
import { powerLineWidth } from "./PowerLine";
import { tollBoothSize } from "./TollBooth";
import { transformerSize } from "./Transformer";
import { robotCellSize } from "./RobotCell";
import type { StorageClass } from "./storageClass";

/**
 * Ce qu'on pose sur le plan de l'entrepôt, et la géométrie qui va avec — sans rien dessiner.
 *
 * ## Deux familles
 *
 * - Les éléments **linéaires** — murs, murs de quai, clôtures, tapis, racks à palettes — sont un
 *   **segment** du point `(x0, y0)` au point `(x1, y1)`. C'est ce qui permet de les étirer : on
 *   attrape un bout et on le tire. Leur longueur est celle du segment, leur cap sa direction.
 * - Les éléments **ponctuels** — un chariot, un robot, une zone de stockage, un arbre — sont posés
 *   par leur **centre** et tournés d'un angle. On les déplace, on les tourne ; leur taille est la
 *   leur.
 *
 * Tout est en cases, comme le reste du kit : une case vaut deux mètres.
 */

export type PlannerLinearKind = "wall" | "dock" | "fence" | "conveyor" | "palletRack" | "rail" | "picker" | "monorail" | "monoPicker" | "powerLine" | "gate" | "lowWall";
export type PlannerPointKind =
  | "shelf"
  | "shelfDecks"
  | "zone"
  | "conveyorCorner"
  | "conveyorTee"
  | "railCorner"
  | "monorailCorner"
  | "forklift"
  | "amr"
  | "arm"
  | "truck"
  | "container"
  | "worker"
  | "tree"
  | "light"
  | "parking"
  | "solar"
  | "barrier"
  | "tollBooth"
  | "flowerBed"
  | "shrub"
  | "transformer"
  | "packer"
  | "consolidator"
  | "delta"
  | "palletizer"
  | "roof"
  | "door"
  | "window"
  | "bay"
  | "roofSolar"
  | "hvac"
  | "coldRoom"
  | "truckBay";

/** Les éléments qu'on pose **sur un mur** : ils s'y accrochent et y percent leur ouverture. */
export const WALL_MOUNTED: PlannerKind[] = ["door", "window", "bay"];

/**
 * Les éléments qu'on pose **sur les toits** : des panneaux solaires, des groupes de climatisation.
 *
 *  Ils vivent au-dessus de tout le reste, à la hauteur de l'acrotère (`PLANNER_WALL_TOP`) : on ne
 *  les voit — et on ne les attrape — que quand les toitures sont affichées, et ils passent alors
 *  devant ce qui est dessous. Masquer les toits pour construire dedans les masque avec eux.
 */
export const ROOFTOP_KINDS: PlannerKind[] = ["roofSolar", "hvac"];

/** L'élément est-il posé sur les toits ? */
export function isRooftop(item: Pick<PlannerItem, "kind">): boolean {
  return ROOFTOP_KINDS.includes(item.kind);
}
export type PlannerKind = PlannerLinearKind | PlannerPointKind;

export interface PlannerLinear {
  id: string;
  kind: PlannerLinearKind;
  /** Le niveau d'évolution, à partir de 1. Absent : le premier. */
  level?: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Rack : la classe de stockage de l'élément (voir `storageClass.ts`). */
  storage?: StorageClass;
  /** Rack : un passage sous le rack, au milieu. */
  passage?: boolean;
}

export interface PlannerPoint {
  id: string;
  kind: PlannerPointKind;
  /** Le niveau d'évolution, à partir de 1. Absent : le premier. */
  level?: number;
  x: number;
  y: number;
  /** En degrés. */
  rotation: number;
  /** Une emprise libre, pour ce qui se trace à la taille voulue — une toiture. */
  size?: { length: number; width: number };
  /** Étagère : la classe de stockage de l'élément. */
  storage?: StorageClass;
  /** Étagère : hissée sur des pieds, un passage dessous. */
  passage?: boolean;
}

export type PlannerItem = PlannerLinear | PlannerPoint;

export const LINEAR_KINDS: PlannerLinearKind[] = ["wall", "dock", "fence", "conveyor", "palletRack", "rail", "picker", "monorail", "monoPicker", "powerLine", "gate", "lowWall"];

export function isLinear(item: PlannerItem): item is PlannerLinear {
  return (LINEAR_KINDS as string[]).includes(item.kind);
}

export interface PlannerTool {
  kind: PlannerKind;
  label: string;
  group: "Bâtiment" | "Stockage" | "Manutention" | "Véhicules" | "Extérieur";
  /** Pour un élément linéaire : sa longueur à la pose, en cases. */
  length?: number;
}

export const PLANNER_TOOLS: PlannerTool[] = [
  { kind: "wall", label: "Mur", group: "Bâtiment", length: 10 },
  { kind: "dock", label: "Mur de quai", group: "Bâtiment", length: 12 },
  { kind: "fence", label: "Clôture", group: "Bâtiment", length: 8 },
  { kind: "palletRack", label: "Rack à palettes", group: "Stockage", length: 5.5 },
  { kind: "shelf", label: "Étagère", group: "Stockage" },
  { kind: "shelfDecks", label: "Étagère à plateaux", group: "Stockage" },
  { kind: "zone", label: "Zone de stockage", group: "Stockage" },
  { kind: "conveyor", label: "Tapis roulant", group: "Manutention", length: 6 },
  { kind: "conveyorCorner", label: "Tapis d'angle", group: "Manutention" },
  { kind: "conveyorTee", label: "Tapis en T", group: "Manutention" },
  { kind: "rail", label: "Rail", group: "Manutention", length: 8 },
  { kind: "railCorner", label: "Rail d'angle", group: "Manutention" },
  { kind: "picker", label: "Picker sur rail", group: "Manutention", length: 10 },
  { kind: "monorail", label: "Monorail", group: "Manutention", length: 8 },
  { kind: "monorailCorner", label: "Monorail, virage", group: "Manutention" },
  { kind: "monoPicker", label: "Picker monorail", group: "Manutention", length: 10 },
  { kind: "arm", label: "Bras robotisé", group: "Manutention" },
  { kind: "forklift", label: "Chariot élévateur", group: "Véhicules" },
  { kind: "amr", label: "Robot autonome", group: "Véhicules" },
  { kind: "truck", label: "Semi-remorque", group: "Véhicules" },
  { kind: "container", label: "Conteneur", group: "Extérieur" },
  { kind: "worker", label: "Opérateur", group: "Extérieur" },
  { kind: "tree", label: "Arbre", group: "Extérieur" },
  { kind: "light", label: "Éclairage", group: "Extérieur" },
  { kind: "parking", label: "Parking", group: "Extérieur" },
  { kind: "solar", label: "Panneaux solaires", group: "Extérieur" },
  { kind: "powerLine", label: "Ligne électrique", group: "Extérieur", length: 24 },
  { kind: "gate", label: "Portail coulissant", group: "Extérieur", length: 4 },
  { kind: "lowWall", label: "Muret", group: "Bâtiment", length: 6 },
  { kind: "barrier", label: "Barrière", group: "Extérieur" },
  { kind: "tollBooth", label: "Poste de péage", group: "Extérieur" },
  { kind: "flowerBed", label: "Parterre de fleurs", group: "Extérieur" },
  { kind: "shrub", label: "Arbuste", group: "Extérieur" },
  { kind: "transformer", label: "Transformateur", group: "Extérieur" },
  { kind: "packer", label: "Machine d'emballage", group: "Manutention" },
  { kind: "consolidator", label: "Regroupement de commande", group: "Manutention" },
  { kind: "delta", label: "Robot delta", group: "Manutention" },
  { kind: "palletizer", label: "Palettiseur", group: "Manutention" },
  { kind: "roof", label: "Toiture", group: "Bâtiment" },
  { kind: "door", label: "Porte", group: "Bâtiment" },
  { kind: "window", label: "Fenêtre", group: "Bâtiment" },
  { kind: "bay", label: "Baie vitrée", group: "Bâtiment" },
  { kind: "roofSolar", label: "Panneaux solaires en toiture", group: "Bâtiment" },
  { kind: "hvac", label: "Climatiseur de toiture", group: "Bâtiment" },
  { kind: "coldRoom", label: "Chambre froide", group: "Stockage" },
  { kind: "truckBay", label: "Parking poids lourds", group: "Extérieur" },
];

export const PLANNER_LABEL: Record<PlannerKind, string> = Object.fromEntries(PLANNER_TOOLS.map((t) => [t.kind, t.label])) as Record<PlannerKind, string>;

/** L'épaisseur d'un élément linéaire, en travers de son segment, en cases. */
export const LINEAR_THICKNESS: Record<PlannerLinearKind, number> = { wall: 0.3, dock: 0.3, fence: 0.1, conveyor: 1.6, palletRack: 0.55, rail: 1.8, picker: 1.8, monorail: 1.2, monoPicker: 1.2, powerLine: 1.2, gate: 0.4, lowWall: 0.2 };

/** L'emprise d'un élément ponctuel, avant rotation : longueur (le long de son cap) et largeur. */
export const POINT_SIZE: Record<PlannerPointKind, { length: number; width: number }> = {
  shelf: { length: 4, width: 1.2 },
  shelfDecks: { length: 4, width: 1.2 },
  conveyorCorner: { length: 1.6, width: 1.6 },
  conveyorTee: { length: 1.6, width: 1.6 },
  railCorner: { length: 2.7, width: 2.7 },
  monorailCorner: { length: 2.6, width: 2.6 },
  zone: { length: 4.3, width: 2.75 },
  forklift: { length: 2.7, width: 1 },
  amr: { length: 1.6, width: 1.15 },
  arm: { length: 1.2, width: 1.2 },
  truck: { length: semiTruckGeometry().length, width: semiTruckGeometry().width },
  container: { length: CONTAINER_DIMENSIONS["40"].length, width: CONTAINER_DIMENSIONS["40"].width },
  worker: { length: 0.4, width: 0.4 },
  tree: { length: 1.4, width: 1.4 },
  light: { length: 0.6, width: 0.6 },
  parking: { length: 6.6, width: 2.2 },
  barrier: { length: 0.8, width: 2.4 },
  tollBooth: { length: 4, width: 7.2 },
  flowerBed: { length: 3, width: 1 },
  shrub: { length: 0.8, width: 0.8 },
  transformer: { length: 2, width: 1.6 },
  packer: { length: 5.5, width: 1.2 },
  consolidator: { length: 5.5, width: 3.6 },
  delta: { length: 5, width: 2.8 },
  palletizer: { length: 4.5, width: 3.2 },
  roof: { length: 8, width: 6 },
  door: { length: 0.55, width: 0.3 },
  window: { length: 1, width: 0.3 },
  bay: { length: 3, width: 0.3 },
  solar: { length: solarArraySize({ rows: 1, columns: 6 }).length, width: solarArraySize({ rows: 1, columns: 6 }).width },
  roofSolar: { length: solarArraySize({ rows: 1, columns: 6 }).length, width: solarArraySize({ rows: 1, columns: 6 }).width },
  hvac: { length: 1.4, width: 1 },
  coldRoom: { length: 6, width: 4 },
  truckBay: { length: 10.5, width: 2.4 },
};

/**
 * Le parking poids lourds : la longueur d'une place, le long du cap, et la largeur d'une place.
 *
 * ## Le repère d'un parking poids lourds — à retenir pour y faire manœuvrer des camions
 *
 *  L'élément est posé par son centre `(x, y)` et tourné de `rotation` (θ). Dans son repère :
 *  - les `x` locaux vont **le long des places** : l'**entrée** est en `x = −length/2`, le **bout
 *    quai** en `x = +length/2` — c'est là que viennent les portes arrière de la remorque, et c'est
 *    de ce côté qu'est peint le butoir jaune ;
 *  - les `y` locaux vont **en travers** : la place `i` (de `0` à `bays − 1`) a son axe en
 *    `y = −width/2 + TRUCK_BAY_WIDTH · (i + ½)`.
 *
 *  Un point local `(u, v)` est donc, sur le plan, en `(x + u·cos θ − v·sin θ, y + u·sin θ + v·cos θ)`.
 *  Un camion garé a l'arrière au bout quai et la cabine vers l'entrée : son cap est `θ + 180°`.
 */
export const TRUCK_BAY_LENGTH = 10.5;
export const TRUCK_BAY_WIDTH = 2.4;

// --- Les évolutions ----------------------------------------------------------------------------------

/**
 * Les niveaux d'évolution de chaque élément, du plus simple au plus abouti.
 *
 * C'est la progression d'un jeu de gestion : on pose d'abord ce qui est bon marché et encombrant,
 * puis on **améliore** sur place. Un parking devient couvert, puis solaire ; un rail double, qui
 * prend de la place, devient un monorail ; un chariot à conducteur devient autonome. Un élément
 * amélioré garde sa place et son identité — seul son niveau change, et avec lui son allure et,
 * parfois, son emprise.
 */
export const TIERS: Record<PlannerKind, string[]> = {
  wall: ["Voile de béton", "Mur à poteaux", "Mur bardé"],
  dock: ["Portes de plain-pied", "Quai de chargement", "Quai bardé, portes ouvertes"],
  fence: ["Glissière", "Clôture grillagée", "Séparateur béton"],
  conveyor: ["Tapis nu", "Tapis à rives", "Tapis contrôlé (portique scanner)"],
  conveyorCorner: ["Angle nu", "Angle à rives"],
  conveyorTee: ["Aiguillage nu", "Aiguillage à rives"],
  palletRack: ["Rack 3 niveaux", "Rack 4 niveaux", "Rack double, 5 niveaux"],
  rail: ["Rail double", "Monorail"],
  railCorner: ["Virage de rail double", "Virage de monorail"],
  picker: ["Picker sur rail double", "Picker sur monorail"],
  monorail: ["Monorail"],
  monorailCorner: ["Virage de monorail"],
  monoPicker: ["Picker sur monorail"],
  shelf: ["Étagère simple", "Étagère à plateaux", "Rayonnage haut"],
  shelfDecks: ["Étagère à plateaux"],
  zone: ["Marquage au sol", "Palettes", "Palettes gerbées"],
  arm: ["Bras au repos", "Bras en production"],
  forklift: ["Chariot à conducteur", "Chariot autonome"],
  amr: ["Robot plateau", "Robot porteur"],
  truck: ["Utilitaire", "Semi-remorque"],
  container: ["Conteneur 20 pieds", "Conteneur 40 pieds", "Pile de conteneurs"],
  worker: ["Opérateur"],
  tree: ["Arbuste", "Arbre", "Grand arbre"],
  light: ["Borne", "Candélabre", "Mât de cour"],
  parking: ["Parking", "Parking couvert", "Parking solaire"],
  solar: ["Petit champ", "Champ et onduleur", "Champ et stockage"],
  powerLine: ["Ligne sur poteaux bois", "Ligne sur poteaux béton", "Ligne haute tension"],
  gate: ["Portail manuel", "Portail motorisé"],
  lowWall: ["Muret béton", "Muret haut à poteaux", "Muret surmonté d'une grille"],
  barrier: ["Barrière levante", "Barrière automatique", "Portique de hauteur"],
  tollBooth: ["Péage à une voie", "Péage à deux voies", "Péage à trois voies"],
  flowerBed: ["Petit parterre", "Grand parterre", "Rond fleuri"],
  shrub: ["Graminée", "Buis en boule", "Arbuste", "Grand arbuste"],
  transformer: ["Transformateur sur socle", "Poste préfabriqué", "Poste de livraison", "Poste source HTB"],
  packer: ["Étiqueteuse", "Cercleuse", "Filmeuse", "Mise en carton"],
  consolidator: ["Regroupement, 4 bacs", "Regroupement, 6 bacs", "Regroupement, 8 bacs"],
  delta: ["Robot delta"],
  palletizer: ["Palettiseur"],
  roof: ["Toiture bac acier", "Toiture à lanterneaux", "Chambre froide"],
  door: ["Porte d'entrée"],
  window: ["Fenêtre", "Fenêtre large"],
  bay: ["Baie vitrée", "Grande baie vitrée"],
  roofSolar: ["Petit champ en toiture", "Champ en toiture", "Grand champ en toiture"],
  hvac: ["Groupe froid simple", "Groupe froid double", "Groupe froid triple"],
  coldRoom: ["Chambre froide positive", "Chambre froide négative"],
  truckBay: ["1 place camion", "2 places camion", "3 places camion"],
};

/** Le niveau d'un élément, borné à ceux que sa sorte connaît. */
export function levelOf(item: PlannerItem): number {
  return Math.max(1, Math.min(TIERS[item.kind].length, Math.round(item.level ?? 1)));
}

/** Le nom du niveau d'un élément. */
export function tierLabel(item: PlannerItem, level = levelOf(item)): string {
  return TIERS[item.kind][level - 1] ?? "";
}

/** Les cotes d'un champ solaire à chaque niveau. */
export const SOLAR_TIERS = [
  { rows: 1, columns: 6, inverter: false, battery: false },
  { rows: 2, columns: 8, inverter: true, battery: false },
  { rows: 3, columns: 8, inverter: true, battery: true },
];

/** Les cotes d'un champ solaire posé en toiture, à chaque niveau : les panneaux seuls — l'onduleur
 *  et le stockage restent au sol. */
export const ROOF_SOLAR_TIERS = [
  { rows: 1, columns: 6 },
  { rows: 2, columns: 8 },
  { rows: 3, columns: 8 },
];

/** Le nombre de condenseurs d'un climatiseur de toiture, à chaque niveau. */
export const HVAC_UNITS = [1, 2, 3];
const HVAC_LENGTH = [1.4, 2.4, 3.4];

/** L'emprise d'un élément posé, avant rotation, à son niveau. */
export function sizeOf(item: PlannerPoint): { length: number; width: number } {
  const lv = levelOf(item);
  if (item.kind === "truck" && lv === 1) return { length: CAR_DIMENSIONS.van.length, width: CAR_DIMENSIONS.van.width };
  if (item.kind === "container" && lv === 1) return { length: CONTAINER_DIMENSIONS["20"].length, width: CONTAINER_DIMENSIONS["20"].width };
  if (item.kind === "solar") return solarArraySize(SOLAR_TIERS[lv - 1]);
  if (item.kind === "roofSolar") return solarArraySize(ROOF_SOLAR_TIERS[lv - 1]);
  if (item.kind === "hvac") return { length: HVAC_LENGTH[lv - 1], width: 1 };
  if (item.kind === "truckBay") return { length: TRUCK_BAY_LENGTH, width: TRUCK_BAY_WIDTH * lv };
  if (item.kind === "roof") return item.size ?? POINT_SIZE.roof;
  if (item.kind === "tollBooth") return tollBoothSize({ lanes: lv });
  if (item.kind === "transformer") return transformerSize((["pad", "kiosk", "substation", "gridStation"] as const)[lv - 1]);
  if (item.kind === "consolidator") return robotCellSize({ kind: "gantry", slots: [4, 6, 8][lv - 1] });
  if (item.kind === "flowerBed") return lv === 1 ? { length: 3, width: 1 } : lv === 2 ? { length: 5, width: 1.4 } : { length: 2.4, width: 2.4 };
  if (item.kind === "window" && lv === 2) return { length: 1.6, width: 0.3 };
  if (item.kind === "bay" && lv === 2) return { length: 5, width: 0.3 };
  return POINT_SIZE[item.kind];
}

/** L'épaisseur d'un élément linéaire, à son niveau. */
export function thicknessOf(item: PlannerLinear): number {
  const lv = levelOf(item);
  if (item.kind === "rail" || item.kind === "picker") return lv >= 2 ? 1.2 : 1.8;
  if (item.kind === "palletRack") return lv >= 3 ? 1.2 : 0.55;
  if (item.kind === "powerLine") return powerLineWidth((["wood", "concrete", "pylon"] as const)[lv - 1]);
  return LINEAR_THICKNESS[item.kind];
}

/**
 * Accrocher un élément à un mur, comme dans les Sims : la porte, la fenêtre, la baie se posent sur
 * l'axe du mur le plus proche, tournées comme lui, et glissent le long de lui. Hors de portée d'un
 * mur, rien : `null`.
 */
export function snapToWall(item: PlannerPoint, items: PlannerItem[], reach = 1.2): PlannerPoint | null {
  let best: { d: number; x: number; y: number; angle: number } | null = null;
  const half = sizeOf(item).length / 2;
  for (const w of items) {
    if (!isLinear(w) || (w.kind !== "wall" && w.kind !== "dock")) continue;
    const dx = w.x1 - w.x0;
    const dy = w.y1 - w.y0;
    const L = Math.hypot(dx, dy);
    if (L < half * 2 + 0.2) continue;
    const ux = dx / L;
    const uy = dy / L;
    // Le long du mur, à la demi-case, sans déborder de ses bouts.
    const t = Math.max(half + 0.1, Math.min(L - half - 0.1, snap((item.x - w.x0) * ux + (item.y - w.y0) * uy, 0.5)));
    const px = w.x0 + ux * t;
    const py = w.y0 + uy * t;
    const d = Math.hypot(item.x - px, item.y - py);
    if (d < reach && (!best || d < best.d)) best = { d, x: px, y: py, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  }
  if (!best) return null;
  return { ...item, x: best.x, y: best.y, rotation: ((best.angle % 360) + 360) % 360 };
}

/** Les ouvertures qu'un mur porte, d'après les éléments accrochés à lui. */
export function wallMounts(wall: PlannerLinear, items: PlannerItem[]): { at: number; width: number; kind: "door" | "window" | "bay"; height?: number }[] {
  const dx = wall.x1 - wall.x0;
  const dy = wall.y1 - wall.y0;
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return [];
  const ux = dx / L;
  const uy = dy / L;
  const out: { at: number; width: number; kind: "door" | "window" | "bay"; height?: number }[] = [];
  for (const it of items) {
    if (isLinear(it) || !WALL_MOUNTED.includes(it.kind)) continue;
    const t = (it.x - wall.x0) * ux + (it.y - wall.y0) * uy;
    const off = Math.abs(-(it.x - wall.x0) * uy + (it.y - wall.y0) * ux);
    if (off > 0.2 || t < 0 || t > L) continue;
    const w = sizeOf(it).length;
    const kind = it.kind as "door" | "window" | "bay";
    out.push({ at: t - w / 2, width: w, kind, height: kind === "bay" && levelOf(it) === 2 ? 1.6 : undefined });
  }
  return out;
}

/** Changer le niveau d'un élément — l'améliorer ou le rétrograder. Un élément posé reste calé. */
export function withLevel(item: PlannerItem, level: number): PlannerItem {
  const next = { ...item, level: Math.max(1, Math.min(TIERS[item.kind].length, level)) } as PlannerItem;
  return isLinear(next) ? next : snapPoint(next);
}

/** Un rectangle orienté : son centre, ses demi-côtés, son cap en radians. */
export interface Footprint {
  cx: number;
  cy: number;
  halfL: number;
  halfW: number;
  angle: number;
}

export function footprintOf(item: PlannerItem): Footprint {
  if (isLinear(item)) {
    const L = Math.hypot(item.x1 - item.x0, item.y1 - item.y0);
    return {
      cx: (item.x0 + item.x1) / 2,
      cy: (item.y0 + item.y1) / 2,
      halfL: L / 2,
      halfW: thicknessOf(item) / 2,
      angle: Math.atan2(item.y1 - item.y0, item.x1 - item.x0),
    };
  }
  const s = sizeOf(item);
  return { cx: item.x, cy: item.y, halfL: s.length / 2, halfW: s.width / 2, angle: (item.rotation * Math.PI) / 180 };
}

/** Les quatre coins d'une emprise. */
export function cornersOf(f: Footprint): { x: number; y: number }[] {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return [
    [-f.halfL, -f.halfW],
    [f.halfL, -f.halfW],
    [f.halfL, f.halfW],
    [-f.halfL, f.halfW],
  ].map(([u, v]) => ({ x: f.cx + u * c - v * s, y: f.cy + u * s + v * c }));
}

/** Le point `p` est-il sur l'élément ? Un rien de marge autour, pour attraper un mur fin. */
export function hits(item: PlannerItem, p: { x: number; y: number }, slack = 0.25): boolean {
  const f = footprintOf(item);
  const c = Math.cos(-f.angle);
  const s = Math.sin(-f.angle);
  const dx = p.x - f.cx;
  const dy = p.y - f.cy;
  const u = dx * c - dy * s;
  const v = dx * s + dy * c;
  return Math.abs(u) <= f.halfL + slack && Math.abs(v) <= f.halfW + slack;
}

/** L'élément sous le point : le dernier posé d'abord, comme il est dessiné par-dessus. */
export function hitTest(items: PlannerItem[], p: { x: number; y: number }): PlannerItem | null {
  for (let i = items.length - 1; i >= 0; i -= 1) if (hits(items[i], p)) return items[i];
  return null;
}

/** L'élément tient-il entièrement sur le terrain constructible ? On sonde son emprise tous les
 *  demi-mètres. */
export function fitsPlot(item: PlannerItem, plot: Pick<PlotLayout, "width" | "depth" | "notches">): boolean {
  const f = footprintOf(item);
  // Un mur, une clôture se jugent sur leur axe, et un axe peut longer le bord du terrain : un point
  // posé sur une ligne de la grille est dedans si l'une des cases qu'il touche l'est.
  if (item.kind === "wall" || item.kind === "dock" || item.kind === "fence" || item.kind === "powerLine" || item.kind === "lowWall") {
    const e = 1e-4;
    const touches = (x: number, y: number) =>
      [
        [-e, -e],
        [e, -e],
        [-e, e],
        [e, e],
      ].some(([a, b]) => plotInside(plot, Math.floor(x + a), Math.floor(y + b)));
    const n = Math.max(1, Math.ceil((f.halfL * 2) / 0.25));
    for (let i = 0; i <= n; i += 1) {
      const u = -f.halfL + (2 * f.halfL * i) / n;
      if (!touches(f.cx + u * Math.cos(f.angle), f.cy + u * Math.sin(f.angle))) return false;
    }
    return true;
  }
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const nu = Math.max(1, Math.ceil((f.halfL * 2) / 0.25));
  const nv = Math.max(1, Math.ceil((f.halfW * 2) / 0.25));
  for (let i = 0; i <= nu; i += 1)
    for (let j = 0; j <= nv; j += 1) {
      const u = -f.halfL + (2 * f.halfL * i) / nu;
      const v = -f.halfW + (2 * f.halfW * j) / nv;
      const x = f.cx + u * c - v * s;
      const y = f.cy + u * s + v * c;
      // Un bord exactement sur une ligne de la grille appartient aux deux cases : on rentre d'un rien.
      const ix = Math.floor(x - Math.sign(u) * 1e-6);
      const iy = Math.floor(y - Math.sign(v) * 1e-6);
      if (!plotInside(plot, ix, iy)) return false;
    }
  return true;
}

/** Le pas de la grille d'un élément : les murs vont d'un nœud entier à l'autre, comme dans les
 *  Sims ; le reste se pose à la demi-case. */
export function gridStep(item: PlannerItem): number {
  return item.kind === "wall" || item.kind === "dock" || item.kind === "fence" || item.kind === "powerLine" || item.kind === "lowWall" ? 1 : 0.5;
}

/** Arrondir à la grille — une demi-case par défaut. */
export const snap = (v: number, step = 0.5) => Math.round(v / step) * step;

/**
 * Tirer un bout d'élément linéaire : le point est arrondi à la grille, et un segment presque droit
 * **devient droit** — un mur à 3° de l'horizontale est un mur mal tracé, pas une intention.
 */
export function dragEnd(item: PlannerLinear, which: 0 | 1, p: { x: number; y: number }, free = false): PlannerLinear {
  const ax = which === 0 ? item.x1 : item.x0;
  const ay = which === 0 ? item.y1 : item.y0;
  const step = gridStep(item);
  let x = snap(p.x, step);
  let y = snap(p.y, step);
  if (!free) {
    const deg = (Math.atan2(y - ay, x - ax) * 180) / Math.PI;
    const near = Math.round(deg / 45) * 45;
    if (Math.abs(deg - near) < 8) {
      if (near % 180 === 0) y = ay;
      else if (near % 90 === 0) x = ax;
    }
  }
  // Un mur a une longueur minimale : on ne peut pas le replier sur lui-même.
  if (Math.hypot(x - ax, y - ay) < 1) return item;
  return which === 0 ? { ...item, x0: x, y0: y } : { ...item, x1: x, y1: y };
}

// --- Le calage sur la grille, et la rotation -------------------------------------------------------

/** Le pas de la grille des éléments posés : la demi-case, un mètre. */
export const GRID = 0.5;

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/** L'emprise d'un élément posé, une fois tourné : sa largeur le long des `x`, sa profondeur le long
 *  des `y` — celles de la boîte qui l'enferme. */
export function extentsOf(item: PlannerPoint): { w: number; d: number } {
  const s = sizeOf(item);
  const a = (item.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const n = Math.abs(Math.sin(a));
  return { w: s.length * c + s.width * n, d: s.length * n + s.width * c };
}

/**
 * Caler un élément posé sur la grille **par ses bords**, et non par son centre.
 *
 *  Un chariot de 2,7 cases dont on arrondissait le centre à la demi-case avait ses flancs entre deux
 *  lignes : deux chariots côte à côte ne s'alignaient jamais tout à fait, et une étagère ne venait
 *  pas se coller à un mur. Ici, c'est le coin de l'emprise — tournée — qui tombe sur un nœud de la
 *  grille : deux éléments posés l'un contre l'autre se touchent, et un élément tourné d'un quart de
 *  tour reste aligné.
 */
export function snapPoint(item: PlannerPoint): PlannerPoint {
  const { w, d } = extentsOf(item);
  return { ...item, x: snap(item.x - w / 2, GRID) + w / 2, y: snap(item.y - d / 2, GRID) + d / 2 };
}

/**
 * Tourner un élément à un cap donné, en degrés.
 *
 *  Par crans de 15° — assez fin pour une diagonale, assez gros pour qu'un quart de tour tombe juste
 *  — ou librement (`free`). Un élément posé est recalé sur la grille à chaque cap droit.
 */
export function rotateTo(item: PlannerItem, deg: number, free = false): PlannerItem {
  const target = norm360(free ? Math.round(deg) : Math.round(deg / 15) * 15);
  if (!isLinear(item)) {
    const next = { ...item, rotation: target };
    return target % 90 === 0 ? snapPoint(next) : next;
  }
  // Un segment tourne autour de son milieu, à longueur constante.
  const cx = (item.x0 + item.x1) / 2;
  const cy = (item.y0 + item.y1) / 2;
  const half = Math.hypot(item.x1 - item.x0, item.y1 - item.y0) / 2;
  const a = (target * Math.PI) / 180;
  const step = gridStep(item);
  const round = (v: number) => (target % 90 === 0 ? snap(v, step) : v);
  return { ...item, x0: round(cx - Math.cos(a) * half), y0: round(cy - Math.sin(a) * half), x1: round(cx + Math.cos(a) * half), y1: round(cy + Math.sin(a) * half) };
}

/** Le cap d'un élément, en degrés. */
export function headingOf(item: PlannerItem): number {
  if (!isLinear(item)) return item.rotation;
  return norm360((Math.atan2(item.y1 - item.y0, item.x1 - item.x0) * 180) / Math.PI);
}

/** Déplacer un élément de `(dx, dy)`, calé sur la grille. */
export function moveBy(item: PlannerItem, dx: number, dy: number): PlannerItem {
  if (isLinear(item)) {
    const step = gridStep(item);
    const sx = snap(item.x0 + dx, step) - item.x0;
    const sy = snap(item.y0 + dy, step) - item.y0;
    return { ...item, x0: item.x0 + sx, y0: item.y0 + sy, x1: item.x1 + sx, y1: item.y1 + sy };
  }
  return snapPoint({ ...item, x: item.x + dx, y: item.y + dy });
}

/** Tourner d'un quart de tour, autour du centre — dans un sens (`+1`) ou dans l'autre (`-1`). */
export function rotateQuarter(item: PlannerItem, dir: 1 | -1 = 1): PlannerItem {
  if (dir === -1) return rotateTo(item, headingOf(item) - 90);
  if (!isLinear(item)) return snapPoint({ ...item, rotation: (item.rotation + 90) % 360 });
  const cx = (item.x0 + item.x1) / 2;
  const cy = (item.y0 + item.y1) / 2;
  const rot = (x: number, y: number) => ({ x: snap(cx - (y - cy)), y: snap(cy + (x - cx)) });
  const a = rot(item.x0, item.y0);
  const b = rot(item.x1, item.y1);
  return { ...item, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

/** Retourner un élément linéaire : ce qui était dehors passe dedans — la cour d'un quai change de
 *  côté. */
export function flip(item: PlannerItem): PlannerItem {
  if (!isLinear(item)) return snapPoint({ ...item, rotation: (item.rotation + 180) % 360 });
  return { ...item, x0: item.x1, y0: item.y1, x1: item.x0, y1: item.y0 };
}

let counter = 0;
/** Un nouvel élément de l'outil `kind`, centré en `(x, y)`. */
export function createItem(kind: PlannerKind, x: number, y: number): PlannerItem {
  counter += 1;
  const id = `${kind}-${Date.now().toString(36)}-${counter}`;
  const tool = PLANNER_TOOLS.find((t) => t.kind === kind);
  if ((LINEAR_KINDS as string[]).includes(kind)) {
    const half = (tool?.length ?? 6) / 2;
    const step = kind === "wall" || kind === "dock" || kind === "fence" ? 1 : 0.5;
    const cx = snap(x, step);
    const cy = snap(y, step);
    return { id, kind: kind as PlannerLinearKind, x0: cx - half, y0: cy, x1: cx + half, y1: cy };
  }
  return snapPoint({ id, kind: kind as PlannerPointKind, x, y, rotation: 0 });
}

// --- Le tracé des murs, à la manière des Sims ------------------------------------------------------

/** Les façons de tracer : un segment, une chaîne de segments, deux murs parallèles, une pièce. */
export type DrawMode = "segment" | "chain" | "parallel" | "room";

/**
 * Le point du tracé sous le curseur.
 *
 *  Comme dans les Sims, un mur va **d'un nœud de la grille à un autre** — une case entière, jamais
 *  une fraction — et part droit ou en diagonale à 45°. Au départ, le curseur s'accroche aussi au
 *  bout d'un mur existant à portée : c'est ce qui fait qu'un nouveau mur se raccorde au précédent au
 *  lieu de s'arrêter à côté.
 */
export function wallPoint(p: { x: number; y: number }, start: { x: number; y: number } | null, mode: DrawMode, items: PlannerItem[]): { x: number; y: number } {
  if (!start || mode === "parallel" || mode === "room") {
    let best: { x: number; y: number } | null = null;
    let bestD = 0.8;
    if (!start)
      for (const it of items)
        if (isLinear(it))
          for (const q of [
            { x: it.x0, y: it.y0 },
            { x: it.x1, y: it.y1 },
          ]) {
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bestD) {
              bestD = d;
              best = q;
            }
          }
    return best ?? { x: Math.round(p.x), y: Math.round(p.y) };
  }
  const dx = p.x - start.x;
  const dy = p.y - start.y;
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const ux = Math.round(Math.cos(a));
  const uy = Math.round(Math.sin(a));
  if (ux !== 0 && uy !== 0) {
    const n = Math.round((Math.abs(dx) + Math.abs(dy)) / 2);
    return { x: start.x + ux * n, y: start.y + uy * n };
  }
  const n = Math.round(ux !== 0 ? Math.abs(dx) : Math.abs(dy));
  return { x: start.x + ux * n, y: start.y + uy * n };
}

/**
 * Les murs d'un tracé en cours, du point `s` au point `e`.
 *
 *  Une pièce est tracée dans l'ordre qui met l'extérieur de chaque mur **dehors** (voir
 *  `wallPlacement`) : un mur de quai qu'on y changerait aurait sa cour du bon côté. Les deux murs
 *  parallèles sont les deux grands côtés du rectangle tiré.
 */
export function draftWalls(kind: PlannerLinearKind, mode: DrawMode, s: { x: number; y: number }, e: { x: number; y: number }): PlannerLinear[] {
  const id = (i: number) => `draft-${i}`;
  if (mode === "segment" || mode === "chain") {
    if (Math.hypot(e.x - s.x, e.y - s.y) < 1) return [];
    return [{ id: id(0), kind, x0: s.x, y0: s.y, x1: e.x, y1: e.y }];
  }
  const x0 = Math.min(s.x, e.x);
  const x1 = Math.max(s.x, e.x);
  const y0 = Math.min(s.y, e.y);
  const y1 = Math.max(s.y, e.y);
  const w = x1 - x0;
  const h = y1 - y0;
  const bottom: PlannerLinear = { id: id(0), kind, x0, y0, x1, y1: y0 };
  const right: PlannerLinear = { id: id(1), kind, x0: x1, y0, x1, y1 };
  const top: PlannerLinear = { id: id(2), kind, x0: x1, y0: y1, x1: x0, y1 };
  const left: PlannerLinear = { id: id(3), kind, x0, y0: y1, x1: x0, y1: y0 };
  if (mode === "room") return w >= 1 && h >= 1 ? [bottom, right, top, left] : [];
  if (w >= h) return w >= 1 && h >= 1 ? [bottom, top] : [];
  return w >= 1 && h >= 1 ? [left, right] : [];
}

/** Donner des identifiants neufs aux murs d'un tracé qu'on valide. */
export function commitDraft(draft: PlannerLinear[]): PlannerLinear[] {
  counter += 1;
  const stamp = `${Date.now().toString(36)}-${counter}`;
  return draft.map((w, i) => ({ ...w, id: `${w.kind}-${stamp}-${i}` }));
}
