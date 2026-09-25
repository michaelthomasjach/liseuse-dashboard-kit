import { useMemo, useRef, type ReactNode } from "react";
import { Builder, type P3 } from "./three/builder";
import { rng } from "./three/random";
import { Parts, Solo, WarehouseScene, frameBounds, resolveSceneQuality, useBuilt, useSceneQuality } from "./three/scene";
import { useSimClock } from "./three/time";
import { ROAD_SURFACE, Road, roadSize, type RoadDriveway } from "./Road";
import { Buildings } from "./Building";
import { Trees } from "./Tree";
import { Fence } from "./Fence";
import { StreetLight } from "./StreetLight";
import { Car } from "./Car";
import { ForSaleSign } from "./ForSaleSign";
import { SlidingGate } from "./SlidingGate";
import { layGates, type PlannerGate } from "./accessRoad";
import { PLOT_STREET, generatePlot, lockedFences, perimeterFenceRuns, plotInside, plotOutline, plotSideFrame, trafficCars, type PlotCar, type PlotDriveway, type PlotFenceRun, type PlotLayout, type PlotRect, type PlotShape, type PlotTile } from "./plot";

/**
 * Le terrain à bâtir, et tout ce qui l'entoure — le décor d'une partie.
 *
 * Le terrain est un sol clair, semé d'une **grille de points** comme le canevas d'un éditeur de
 * flux, et bordé d'un **trait pointillé** : c'est la zone où l'on construit, et rien d'autre ne la
 * signale. Autour, la rue, les voisins, les arbres, les voitures qui passent : le monde qui
 * continue, et qui n'est pas à nous. Voir `generatePlot` pour ce que la graine décide.
 *
 * `children` sont posés **sur** le terrain, dans la même scène : c'est là que va l'entrepôt.
 */

/**
 * Le décor autour du terrain, élément par élément. Chacun est affiché par défaut ; l'éteindre
 * **supprime le travail** — rien n'est monté, rien n'est animé —, pas seulement l'affichage. Les
 * rues elles-mêmes restent toujours : les camions y roulent.
 */
export interface SceneryToggles {
  /** Les bâtiments de la ville autour du terrain. */
  buildings: boolean;
  /** Les voitures qui circulent dans les rues (la densité reste réglée par `traffic`). */
  traffic: boolean;
  /** Les voitures garées devant les bâtiments de la ville (pas le parking du joueur). */
  parkedCars: boolean;
  /** Les arbres d'alignement des rues. */
  trees: boolean;
  /** Les candélabres des rues. */
  streetLights: boolean;
  /** Les passages piétons peints sur la chaussée. */
  crosswalks: boolean;
  /** Le grain du sol : touffes d'herbe, joints de dalle, taches, regards. */
  groundDetail: boolean;
}

export const DEFAULT_SCENERY: SceneryToggles = { buildings: true, traffic: true, parkedCars: true, trees: true, streetLights: true, crosswalks: true, groundDetail: true };

/** Les réglages du décor, dans l'ordre d'un écran de paramètres, avec ce qu'ils coûtent à peu près. */
export const SCENERY_OPTIONS: { key: keyof SceneryToggles; label: string; description: string; costHint: "low" | "medium" | "high" }[] = [
  { key: "buildings", label: "Bâtiments de la ville", description: "Les maisons, immeubles et ateliers autour du terrain.", costHint: "high" },
  { key: "traffic", label: "Circulation", description: "Les voitures qui roulent dans les rues. Seuls les camions du quai et les employés circulent alors.", costHint: "high" },
  { key: "trees", label: "Arbres des rues", description: "Les arbres d'alignement le long des trottoirs.", costHint: "medium" },
  { key: "streetLights", label: "Candélabres", description: "L'éclairage public des rues, et sa lumière la nuit.", costHint: "medium" },
  { key: "parkedCars", label: "Voitures garées en ville", description: "Les voitures garées devant les bâtiments voisins (pas le parking de l'entrepôt).", costHint: "low" },
  { key: "groundDetail", label: "Détails du sol", description: "Touffes d'herbe, joints de dalle, taches et regards.", costHint: "low" },
  { key: "crosswalks", label: "Passages piétons", description: "Le marquage des passages piétons sur la chaussée.", costHint: "low" },
];

export interface BuildPlotProps {
  /** La graine du terrain. */
  seed?: number;
  /** Imposer une forme ; sinon la graine la choisit. */
  shape?: PlotShape;
  /** Un terrain déjà tiré — pour le partager avec un éditeur qui en connaît les limites. */
  layout?: PlotLayout;
  /**
   * La circulation sur la rue : `true` (les voitures du terrain), `false`, ou une **densité** de
   * 0 (la nuit, presque personne) à 1 (l'heure de pointe : beaucoup de voitures, lentes, en paquets).
   */
  traffic?: boolean | number;
  /** La nuit, de 0 (le jour) à 1 (la nuit noire) : les candélabres s'allument et éclairent la rue. */
  night?: number;
  /** La grille de points et le pointillé du terrain. */
  grid?: boolean;
  /**
   * L'allure du sol constructible. `"site"` (défaut) : un chantier — dalle à joints, grille de points,
   * taches d'huile, regards, touffes d'herbe. `"clean"` : un **sol industriel** propre et uni, béton
   * poli ou résine clairs, à peine quadrillé de grands carreaux — ce qu'on attend sous un entrepôt. Les
   * parcelles à vendre, la bande d'herbe, les trottoirs et la rue gardent leur allure.
   */
  groundStyle?: PlotGroundStyle;
  /**
   * Des rectangles (en cases, alignés sur les axes) où **ne pas planter de candélabres** : les
   * lampadaires de la rue qui s'y trouvent, et leur flaque de lumière la nuit, ne sont pas dessinés.
   * Pour dégager la manœuvre des camions devant les quais (voir `dockTrafficClearance`).
   */
  lightExclusions?: PlotRect[];
  /** De même pour les arbres du décor — ceux d'alignement de la rue et ceux des parcelles voisines. */
  treeExclusions?: PlotRect[];
  /**
   * Des **raccordements** à la rue (voir `PlotDriveway`, et `accessRoadDriveways` pour les tirer des
   * voies d'accès d'un plan) : le trottoir côté terrain s'y ouvre en bateau, l'enrobé court du bout
   * de la voie jusqu'à la chaussée, et les candélabres qui s'y trouvaient ne sont pas plantés.
   */
  driveways?: PlotDriveway[];
  /**
   * Une **clôture de pourtour** : tout le bord constructible — le rectangle du terrain moins ses
   * échancrures et ses parcelles à vendre — est clos d'une clôture grillagée sur poteaux. Elle
   * remplace, sur les bords qu'elles partagent, les clôtures des échancrures et des parcelles à
   * vendre, et suit le bord quand une parcelle est achetée. Voir `fenceOpenings`.
   */
  perimeterFence?: boolean;
  /**
   * Là où la clôture de pourtour s'interrompt : des polygones convexes, en cases — l'emprise des voies
   * d'accès, élargie d'un rien (voir `accessRoadOpenings`).
   */
  fenceOpenings?: { x: number; y: number }[][];
  /**
   * Des **portails** dans la clôture de pourtour (voir `PlannerGate`) : sur un côté qui longe la rue,
   * un portail coulissant motorisé, la clôture ouverte sur sa largeur, et la rue raccordée jusqu'à
   * lui — trottoir abaissé, enrobé de la chaussée jusqu'un peu dans le terrain. Un portail hors d'un
   * côté sur rue n'est pas dessiné.
   */
  gates?: PlannerGate[];
  /**
   * La qualité de rendu : en `"low"`, un décor allégé — un voisin et un arbre sur deux, une seule
   * voiture par sens. Défaut : `"auto"`, la qualité de la scène où le terrain est posé (voir
   * `resolveSceneQuality`).
   */
  quality?: "auto" | "high" | "low";
  /** Le décor à montrer, élément par élément (voir `SceneryToggles`). Défaut : tout. */
  scenery?: Partial<SceneryToggles>;
  cellSize?: number;
  className?: string;
  children?: ReactNode;
}

/** L'allure du sol constructible (voir `BuildPlotProps.groundStyle`). */
export type PlotGroundStyle = "site" | "clean";

/** Le point `(x, y)` est-il dans l'un des rectangles ? */
export function inRects(rects: PlotRect[] | undefined, x: number, y: number): boolean {
  return !!rects && rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.depth);
}

/** Le sol du terrain, sa grille de points et son pointillé, en un maillage. */
function buildGround(plot: PlotLayout, grid: boolean, style: PlotGroundStyle = "site", detail = true) {
  const clean = style === "clean";
  const b = new Builder();
  const f = plot.frame;
  // L'herbe partout, puis la dalle claire du terrain, case par rangée.
  b.box("grass", f.x, f.x + f.width, f.y, f.y + f.depth, -0.1, -0.005, false);
  for (let y = 0; y < plot.depth; y += 1) {
    let x = 0;
    while (x < plot.width) {
      if (!plotInside(plot, x, y)) {
        x += 1;
        continue;
      }
      let x1 = x;
      while (x1 < plot.width && plotInside(plot, x1, y)) x1 += 1;
      b.box(clean ? "floor-clean" : "pavement", x, x1, y, y + 1, -0.1, 0.004, false);
      x = x1;
    }
  }
  if (detail) addGroundDetail(b, plot, clean);
  if (clean) {
    // Un sol d'entrepôt : uni, et seulement de grands carreaux de résine, tous les quatre cases, en
    // traits à peine plus soutenus que lui.
    const seams: [P3, P3][] = [];
    const owned = (x: number, y: number) => plotInside(plot, Math.floor(x), Math.floor(y));
    for (let x = 4; x < plot.width; x += 4)
      for (let y = 0; y < plot.depth; y += 1) if (owned(x - 0.5, y + 0.5) && owned(x + 0.5, y + 0.5)) seams.push([[x, y, 0.005], [x, y + 1, 0.005]]);
    for (let y = 4; y < plot.depth; y += 4)
      for (let x = 0; x < plot.width; x += 1) if (owned(x + 0.5, y - 0.5) && owned(x + 0.5, y + 0.5)) seams.push([[x, y, 0.005], [x + 1, y, 0.005]]);
    b.lines("lq-plot__seam", seams);
  }
  // La bande entre le terrain et la rue : de l'herbe, déjà posée.
  if (!grid || clean) {
    if (clean && grid) addOutline(b, plot);
    return b.build();
  }
  // Les points de la grille, à chaque croisement intérieur.
  for (let x = 1; x < plot.width; x += 1)
    for (let y = 1; y < plot.depth; y += 1) {
      if (!(plotInside(plot, x - 1, y - 1) && plotInside(plot, x, y) && plotInside(plot, x - 1, y) && plotInside(plot, x, y - 1))) continue;
      b.faceZ("lq-plot__dot", 0.006, x - 0.05, x + 0.05, y - 0.05, y + 0.05);
    }
  addOutline(b, plot);
  return b.build();
}

/** Le pointillé du bord constructible : un tiret par arête de case, centré. */
function addOutline(b: Builder, plot: PlotLayout) {
  for (const [x0, y0, x1, y1] of plotOutline(plot)) {
    const h = 0.07;
    if (y0 === y1) b.faceZ("lq-plot__edge", 0.007, x0 + 0.2, x1 - 0.2, y0 - h, y0 + h);
    else b.faceZ("lq-plot__edge", 0.007, x0 - h, x0 + h, y0 + 0.2, y1 - 0.2);
  }
}

/** Un disque à plat, en décalque : un regard, une tache. */
function disc(b: Builder, cls: string, x: number, y: number, z: number, rx: number, ry = rx, n = 14) {
  const pts: P3[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry, z]);
  }
  b.decal(cls, pts);
}

/**
 * Le grain du sol : ce qui fait qu'une dalle est une dalle et une pelouse une pelouse.
 *
 *  Sur le terrain, les **joints** de la dalle de béton, tous les deux cases ; quelques **taches**
 *  d'huile, là où l'on a garé ; des **regards** et des **grilles** d'évacuation. Dans l'herbe, des
 *  **touffes** plus sombres, semées au hasard — les routes et les dalles, posées par-dessus, les
 *  couvrent d'elles-mêmes. Tout est tiré de la graine du terrain : le même terrain a toujours les
 *  mêmes taches.
 */
function addGroundDetail(b: Builder, plot: PlotLayout, clean = false) {
  const r = rng(plot.seed * 7 + 5);
  const f = plot.frame;
  const inside = (x: number, y: number) => plotInside(plot, Math.floor(x), Math.floor(y));
  if (clean) {
    // Un sol propre n'a ni joints de chantier, ni taches, ni regards : seulement l'herbe autour, et
    // ses touffes — hors du terrain.
    const tufts = Math.round((f.width * f.depth) / 5);
    for (let i = 0; i < tufts; i += 1) {
      const x = f.x + r() * f.width;
      const y = f.y + r() * f.depth;
      const s = 0.05 + r() * 0.12;
      const light = r() < 0.5;
      if (inside(x, y) || inside(x - s, y - s) || inside(x + s, y + s)) continue;
      b.faceZ(light ? "lq-plot__tuft" : "lq-plot__tuft-light", -0.0045, x - s, x + s, y - s * 0.6, y + s * 0.6);
    }
    return;
  }
  // Les joints de la dalle.
  const joints: [P3, P3][] = [];
  for (let x = 2; x < plot.width; x += 2)
    for (let y = 0; y < plot.depth; y += 1) if (inside(x - 0.5, y + 0.5) && inside(x + 0.5, y + 0.5)) joints.push([[x, y, 0.005], [x, y + 1, 0.005]]);
  for (let y = 2; y < plot.depth; y += 2)
    for (let x = 0; x < plot.width; x += 1) if (inside(x + 0.5, y - 0.5) && inside(x + 0.5, y + 0.5)) joints.push([[x, y, 0.005], [x + 1, y, 0.005]]);
  b.lines("lq-plot__joint", joints);
  // Des taches, des regards, des grilles — seulement sur la dalle.
  const spot = () => {
    for (let k = 0; k < 20; k += 1) {
      const x = 1 + r() * (plot.width - 2);
      const y = 1 + r() * (plot.depth - 2);
      if (inside(x - 0.8, y - 0.8) && inside(x + 0.8, y + 0.8)) return { x, y };
    }
    return null;
  };
  const area = plot.width * plot.depth;
  for (let i = 0; i < Math.round(area / 90); i += 1) {
    const p = spot();
    if (p) disc(b, "lq-plot__stain", p.x, p.y, 0.0052 + i * 1e-5, 0.2 + r() * 0.35, 0.12 + r() * 0.25, 10);
  }
  for (let i = 0; i < Math.round(area / 400) + 2; i += 1) {
    const p = spot();
    if (!p) continue;
    disc(b, "lq-plot__manhole", p.x, p.y, 0.0058, 0.3, 0.3, 16);
    disc(b, "lq-plot__manhole-lid", p.x, p.y, 0.0062, 0.24, 0.24, 16);
  }
  for (let i = 0; i < Math.round(area / 500) + 2; i += 1) {
    const p = spot();
    if (!p) continue;
    b.faceZ("lq-plot__manhole", 0.0058, p.x - 0.35, p.x + 0.35, p.y - 0.12, p.y + 0.12, true);
    b.lines(
      "lq-plot__joint",
      [-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map((d): [P3, P3] => [[p.x + d, p.y - 0.1, 0.0064], [p.x + d, p.y + 0.1, 0.0064]])
    );
  }
  // Les touffes d'herbe, partout ; ce qui est posé par-dessus les cache.
  const tufts = Math.round((f.width * f.depth) / 5);
  for (let i = 0; i < tufts; i += 1) {
    const x = f.x + r() * f.width;
    const y = f.y + r() * f.depth;
    const s = 0.05 + r() * 0.12;
    b.faceZ(r() < 0.5 ? "lq-plot__tuft" : "lq-plot__tuft-light", -0.0045, x - s, x + s, y - s * 0.6, y + s * 0.6);
  }
}

export function BuildPlot(props: BuildPlotProps) {
  const { seed = 1, shape, layout, cellSize = 10, className } = props;
  const plot = useMemo(() => layout ?? generatePlot(seed, { shape }), [layout, seed, shape]);
  return (
    <Solo bounds={frameBounds(plot.frame)} cellSize={cellSize} className={["lq-plot", className].filter(Boolean).join(" ")} ariaLabel="Terrain à bâtir">
      <BuildPlotBody {...props} layout={plot} />
    </Solo>
  );
}

/**
 * Les bateaux d'une tuile de la rue : chaque raccordement dont l'ouverture tombe sur l'un de ses
 * trottoirs, ramené dans le repère de la tuile — le long de ses `x`, du côté `0` ou `1`.
 */
function tileDriveways(t: PlotTile, plot: PlotLayout, driveways: PlotDriveway[]): RoadDriveway[] | undefined {
  if ((t.kind ?? "straight") !== "straight" || driveways.length === 0) return undefined;
  const { length: L, width: W } = roadSize(t);
  const sw = PLOT_STREET.sidewalk;
  const th = ((t.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const o = t.origin ?? { x: 0, y: 0 };
  // La tuile tourne autour de son centre : on défait la rotation autour de lui.
  const local = (p: { x: number; y: number }) => {
    const dx = p.x - o.x - L / 2;
    const dy = p.y - o.y - W / 2;
    return { x: L / 2 + dx * c + dy * s, y: W / 2 - dx * s + dy * c };
  };
  const out: RoadDriveway[] = [];
  for (const d of driveways) {
    const f = plotSideFrame(plot, d.side);
    const a = local(f.at(d.from, plot.margin + sw / 2));
    const b = local(f.at(d.to, plot.margin + sw / 2));
    const near = (y: number, target: number) => Math.abs(y - target) < 0.3;
    const side = near(a.y, sw / 2) && near(b.y, sw / 2) ? 0 : near(a.y, W - sw / 2) && near(b.y, W - sw / 2) ? 1 : null;
    if (side === null) continue;
    const from = Math.max(0, Math.min(a.x, b.x));
    const to = Math.min(L, Math.max(a.x, b.x));
    if (to - from > 0.05) out.push({ side, from, to });
  }
  return out.length ? out : undefined;
}

/** L'enrobé des raccordements : du bout de chaque voie d'accès jusqu'à la chaussée. */
function buildAprons(driveways: PlotDriveway[]) {
  const b = new Builder();
  // Un rien sous la chaussée de la rue, qu'il chevauche au droit du trottoir ouvert : même matière,
  // même teinte, et c'est la rue qui l'emporte là où ils se recouvrent.
  for (const d of driveways) b.prism("asphalt", d.apron, -0.04, ROAD_SURFACE - 0.001, false);
  return b.build();
}

/** Des tronçons de clôture, d'un point à l'autre : les échancrures, les parcelles à vendre, ou tout
 *  le pourtour. */
function FenceRuns({ runs, prefix }: { runs: PlotFenceRun[]; prefix: string }) {
  return (
    <>
      {runs.map((f, i) => {
        const L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
        const mx = (f.x0 + f.x1) / 2;
        const my = (f.y0 + f.y1) / 2;
        const rot = (Math.atan2(f.y1 - f.y0, f.x1 - f.x0) * 180) / Math.PI;
        return <Fence key={`${prefix}${i}`} kind="mesh" length={L} origin={{ x: mx - L / 2, y: my }} rotation={rot} />;
      })}
    </>
  );
}

function BuildPlotBody({ layout, traffic = true, grid = true, night = 0, groundStyle = "site", lightExclusions, treeExclusions, driveways, perimeterFence = false, fenceOpenings, gates, quality, scenery, children }: BuildPlotProps) {
  const plot = layout as PlotLayout;
  const show = { ...DEFAULT_SCENERY, ...scenery };
  // La qualité demandée, sinon celle de la scène où le terrain est posé.
  const scene = useSceneQuality();
  const lite = (quality === undefined || quality === "auto" ? scene : resolveSceneQuality(quality)) === "low";
  const ground = useBuilt(() => buildGround(plot, grid, groundStyle, show.groundDetail), [plot, grid, groundStyle, show.groundDetail]);
  const gateKey = JSON.stringify(gates ?? []);
  const openKey = JSON.stringify(fenceOpenings ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const laid = useMemo(() => layGates(plot, gates ?? [], fenceOpenings), [plot, gateKey, openKey]);
  const driveKey = JSON.stringify(driveways ?? []);
  // Les raccordements des voies d'accès, et ceux des portails.
  const drives = useMemo(() => [...(driveways ?? []), ...laid.map((g) => g.layout.driveway)], [driveKey, laid]); // eslint-disable-line react-hooks/exhaustive-deps
  const aprons = useBuilt(() => buildAprons(drives), [drives]);
  // Au droit d'un bateau, pas de candélabre : on le planterait au milieu de l'entrée.
  const driveRects = useMemo<PlotRect[]>(
    () =>
      drives.map((d) => {
        const f = plotSideFrame(plot, d.side);
        const p = f.at(d.from - 0.8, 0);
        const q = f.at(d.to + 0.8, plot.margin + PLOT_STREET.sidewalk + 0.3);
        return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), depth: Math.abs(q.y - p.y) };
      }),
    [drives, plot]
  );
  // Les candélabres et les arbres qu'une manœuvre accrocherait ne sont pas plantés.
  const lightKey = JSON.stringify(lightExclusions ?? []);
  const treeKey = JSON.stringify(treeExclusions ?? []);
  const lights = useMemo(() => plot.lights.filter((l) => !inRects(lightExclusions, l.x, l.y) && !inRects(driveRects, l.x, l.y)), [plot, lightKey, driveRects]); // eslint-disable-line react-hooks/exhaustive-deps
  // En qualité basse, un arbre sur deux : l'alignement reste lisible, à moitié prix.
  const trees = useMemo(() => plot.trees.filter((t, i) => !inRects(treeExclusions, t.x, t.y) && (!lite || i % 2 === 0)), [plot, treeKey, lite]); // eslint-disable-line react-hooks/exhaustive-deps
  // De même, un voisin sur deux : le décor de la rue reste habité, mais plus clairsemé.
  const neighbors = useMemo(() => (lite ? plot.neighbors.filter((_, i) => i % 2 === 0) : plot.neighbors), [plot, lite]);
  // Les parcelles à vendre : closes du côté de ce qu'on possède, et leur panneau.
  const lockFences = useMemo(() => lockedFences(plot), [plot]);
  // Le pourtour remplace les clôtures des échancrures et des parcelles à vendre : elles courent sur
  // les mêmes bords, et deux clôtures l'une sur l'autre se verraient.
  const perimeter = useMemo(() => (perimeterFence ? perimeterFenceRuns(plot, [...(fenceOpenings ?? []), ...laid.map((g) => g.layout.opening)]) : null), [plot, perimeterFence, openKey, laid]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => (traffic === false || !show.traffic ? [] : traffic === true ? plot.cars : trafficCars(plot, traffic)), [plot, traffic, show.traffic]);
  // En qualité basse, une voiture par sens, pas davantage : chacune est une trentaine d'objets à
  // dessiner et une animation de plus, pour un décor qu'on regarde à peine.
  const cars = useMemo(() => (lite ? [all.find((c) => !c.reverse), all.find((c) => c.reverse)].filter((c): c is PlotCar => !!c) : all), [all, lite]);
  return (
    <>
      <Parts built={ground} />
      {plot.roads.map((t, i) => (
        <Road key={`r${i}`} {...t} crosswalk={show.crosswalks ? t.crosswalk : undefined} driveways={tileDriveways(t, plot, drives)} />
      ))}
      {drives.length > 0 && <Parts built={aprons} shadows={false} />}
      {show.buildings && <Buildings buildings={neighbors} cars={show.parkedCars} />}
      {show.trees && <Trees trees={trees} />}
      {show.streetLights && lights.map((l) => (
        <StreetLight key={`l${l.x},${l.y}`} kind="street" origin={{ x: l.x, y: l.y }} rotation={l.rotation} glow={night} />
      ))}
      {laid.map(({ gate, layout: g }) => (
        <SlidingGate key={`gate-${gate.id}`} length={g.slide.length} origin={g.slide.origin} rotation={g.slide.rotation} open={gate.open ?? 1} />
      ))}
      {perimeter ? (
        <FenceRuns runs={perimeter} prefix="pf" />
      ) : (
        <>
          <FenceRuns runs={plot.fences} prefix="f" />
          <FenceRuns runs={lockFences} prefix="lf" />
        </>
      )}
      {(plot.locked ?? []).map((a) => (
        <ForSaleSign key={`sale-${a.id}`} x={a.x + a.width / 2} y={a.y + a.depth / 2} label={a.label} />
      ))}
      {cars.map((c, i) => (
        // Une clé par sens et par rang : une voiture ajoutée dans un sens ne renumérote pas l'autre.
        <StreetCar key={`${c.reverse ? "b" : "f"}${cars.slice(0, i).filter((o) => o.reverse === c.reverse).length}`} car={c} plot={plot} />
      ))}
      {children}
    </>
  );
}

/**
 * Une voiture de la rue. Sa position ne dépend que de l'horloge et de sa vitesse (`useFollow`) :
 * changer la vitesse la ferait sauter le long de la boucle. Quand la circulation ralentit, on décale
 * donc sa phase d'autant, pour qu'elle reparte **d'où elle est**, simplement plus lentement.
 */
function StreetCar({ car, plot }: { car: PlotCar; plot: PlotLayout }) {
  const clock = useSimClock();
  const state = useRef({ speed: car.speed, phase: car.phase, base: car.phase });
  const st = state.current;
  if (st.base !== car.phase) {
    st.base = car.phase;
    st.phase = car.phase;
    st.speed = car.speed;
  } else if (st.speed !== car.speed) {
    st.phase += clock.t.current * (st.speed - car.speed);
    st.speed = car.speed;
  }
  return <Car kind={car.kind} tone={car.tone} follow={{ route: car.reverse ? plot.lanes.backward : plot.lanes.forward, closed: true, speed: car.speed, phase: st.phase, corners: 0.5 }} />;
}

/** Une scène toute prête : le terrain et son décor, et ce qu'on y pose. */
export function PlotScene({ seed = 1, shape, layout, cellSize = 10, traffic, grid, night, groundStyle, lightExclusions, treeExclusions, driveways, perimeterFence, fenceOpenings, gates, quality, className, children }: BuildPlotProps) {
  const plot = useMemo(() => layout ?? generatePlot(seed, { shape }), [layout, seed, shape]);
  return (
    <WarehouseScene bounds={frameBounds(plot.frame)} cellSize={cellSize} quality={quality} className={className} ariaLabel="Terrain à bâtir">
      <BuildPlotBody layout={plot} traffic={traffic} grid={grid} night={night} groundStyle={groundStyle} lightExclusions={lightExclusions} treeExclusions={treeExclusions} driveways={driveways} perimeterFence={perimeterFence} fenceOpenings={fenceOpenings} gates={gates}>
        {children}
      </BuildPlotBody>
    </WarehouseScene>
  );
}
