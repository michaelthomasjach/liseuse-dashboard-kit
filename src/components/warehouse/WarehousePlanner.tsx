import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { IsoCamera, type IsoProjection } from "./isoCamera";
import { viewProjector } from "./three/camera";
import { WarehouseScene, frameBounds } from "./three/scene";
import { SnapshotStudio, cachedSnapshot, type SnapshotJob } from "./three/snapshot";
import { BuildPlot } from "./BuildPlot";
import { PlannerItem3D } from "./PlannerItem3D";
import { generatePlot, plotArea, type PlotShape } from "./plot";
import {
  PLANNER_LABEL,
  TIERS,
  levelOf,
  sizeOf,
  tierLabel,
  withLevel,
  commitDraft,
  cornersOf,
  createItem,
  draftWalls,
  dragEnd,
  fitsPlot,
  flip,
  footprintOf,
  hitTest,
  isLinear,
  moveBy,
  headingOf,
  rotateQuarter,
  rotateTo,
  wallPoint,
  WALL_MOUNTED,
  snapToWall,
  wallMounts,
  type DrawMode,
  type PlannerItem,
  type PlannerLinear,
  type PlannerLinearKind,
  type PlannerPoint,
  type PlannerPointKind,
} from "./plannerModel";
import { STORAGE_CLASSES, STORAGE_LABEL, type StorageClass } from "./storageClass";
import { ChevronDownIcon, ChevronRightIcon, MaximizeIcon, RefreshIcon, SearchIcon, TrashIcon } from "../icons";
import "./WarehousePlanner.css";

/**
 * Le plan de l'entrepôt : un terrain, une palette, et ce qu'on y construit.
 *
 * ## Ce qu'on voit
 *
 * Deux vues, qu'on bascule en haut à droite. **Dessus** : les modules 3D du kit vus d'aplomb — les
 * toits des voisins, le faîte des racks, les voitures sur la rue. **3D** : la même scène vue de
 * biais. On construit et on modifie **dans les deux** : un clic est ramené au point du sol qu'il vise,
 * sous n'importe quel angle. Et deux projections : **isométrique**, sans fuite, où l'on mesure ; et
 * **perspective**, où la scène prend sa profondeur.
 *
 * La caméra : **clic molette maintenu et glisser** pour tourner autour (de gauche à droite) et
 * l'incliner (de haut en bas) — depuis la vue de dessus, cela passe en 3D ; glisser le fond pour se
 * déplacer ; molette pour zoomer autour du pointeur. Le terrain à bâtir est la zone claire semée de
 * points, bordée d'un pointillé : c'est la seule où l'on peut poser quelque chose.
 *
 * ## Tracer des murs, comme dans les Sims
 *
 * On choisit un outil de mur, on **clique le point de départ**, et le mur **suit le curseur**,
 * d'un nœud de la grille à l'autre, droit ou à 45° ; un **second clic l'arrête**. L'outil reste en
 * main pour le mur suivant ; Échap ou un clic droit le repose.
 *
 * - **Mur**, **Mur de quai** : un segment par tracé ;
 * - **Murs en chaîne**, **Clôture**, **Tapis**, **Rail** : chaque clic pose un segment et commence le suivant
 *   là où il s'arrête — un double-clic, un clic droit ou Échap terminent la chaîne ;
 * - **Murs //** : deux murs parallèles, les grands côtés du rectangle tiré — un couloir, une
 *   travée ;
 * - **Pièce** : les quatre murs du rectangle tiré, d'un coup.
 *
 * Le départ s'accroche au bout d'un mur existant à portée : les murs se raccordent d'eux-mêmes. Le
 * tracé est montré **en 3D** avant d'être posé, sa longueur cotée, et en rouge s'il sort du terrain.
 *
 * ## Modifier
 *
 * Un segment posé porte une **poignée ronde à chaque bout**, qu'on tire pour l'étirer, et une
 * **poignée carrée au milieu**, qui le déplace d'un bloc. Les autres éléments se déplacent en les
 * tirant. Suppr efface, R tourne d'un quart de tour, F retourne un segment (la cour d'un quai
 * change de côté).
 */

export interface WarehousePlannerProps {
  /** La graine du terrain. Contrôlée si `onSeedChange` est donné avec elle. */
  seed?: number;
  defaultSeed?: number;
  onSeedChange?: (seed: number) => void;
  /** Imposer la forme du terrain. */
  shape?: PlotShape;
  /** Ce qui est construit. Contrôlé si `onItemsChange` est donné avec lui. */
  items?: PlannerItem[];
  defaultItems?: PlannerItem[];
  onItemsChange?: (items: PlannerItem[]) => void;
  /** Imposer les cotes du terrain, en cases. */
  plotSize?: { width: number; depth: number };
  /** La vue au départ : de dessus, ou de biais. */
  defaultView?: "top" | "3d";
  /** Le cap et l'inclinaison de la vue de biais au départ, en degrés. */
  defaultOrbit?: { yaw: number; tilt: number };
  /** La projection au départ. */
  defaultProjection?: IsoProjection;
  /** Le grossissement au départ, relatif au cadrage du terrain entier : `2` s'approche deux fois. */
  defaultZoom?: number;
  /** Pixels par case au grossissement 1. */
  cellSize?: number;
  /** Hauteur de l'éditeur. */
  height?: number | string;
  className?: string;
}

type P = { x: number; y: number };

/** Une entrée de la palette : un outil de tracé, ou un élément à poser. */
type Entry =
  | { id: string; label: string; group: string; type: "draw"; kind: PlannerLinearKind; mode: DrawMode }
  | { id: string; label: string; group: string; type: "place"; kind: PlannerPointKind }
  | { id: string; label: string; group: string; type: "area"; kind: "roof" };

const ENTRIES: Entry[] = [
  { id: "wall", label: "Mur", group: "Murs", type: "draw", kind: "wall", mode: "segment" },
  { id: "chain", label: "Murs en chaîne", group: "Murs", type: "draw", kind: "wall", mode: "chain" },
  { id: "parallel", label: "Murs //", group: "Murs", type: "draw", kind: "wall", mode: "parallel" },
  { id: "room", label: "Pièce", group: "Murs", type: "draw", kind: "wall", mode: "room" },
  { id: "lowWall", label: "Muret", group: "Murs", type: "draw", kind: "lowWall", mode: "chain" },
  { id: "dock", label: "Mur de quai", group: "Murs", type: "draw", kind: "dock", mode: "segment" },
  { id: "door", label: "Porte", group: "Murs", type: "place", kind: "door" },
  { id: "window", label: "Fenêtre", group: "Murs", type: "place", kind: "window" },
  { id: "bay", label: "Baie vitrée", group: "Murs", type: "place", kind: "bay" },
  { id: "roof", label: "Toiture", group: "Murs", type: "area", kind: "roof" },
  { id: "fence", label: "Clôture", group: "Murs", type: "draw", kind: "fence", mode: "chain" },
  { id: "palletRack", label: "Rack à palettes", group: "Stockage", type: "draw", kind: "palletRack", mode: "segment" },
  { id: "shelf", label: "Étagère", group: "Stockage", type: "place", kind: "shelf" },
  { id: "zone", label: "Zone de stockage", group: "Stockage", type: "place", kind: "zone" },
  { id: "conveyor", label: "Tapis droit", group: "Manutention", type: "draw", kind: "conveyor", mode: "chain" },
  { id: "conveyorCorner", label: "Tapis d'angle", group: "Manutention", type: "place", kind: "conveyorCorner" },
  { id: "conveyorTee", label: "Tapis en T", group: "Manutention", type: "place", kind: "conveyorTee" },
  { id: "rail", label: "Rail", group: "Manutention", type: "draw", kind: "rail", mode: "chain" },
  { id: "railCorner", label: "Rail d'angle", group: "Manutention", type: "place", kind: "railCorner" },
  { id: "picker", label: "Picker sur rail", group: "Manutention", type: "draw", kind: "picker", mode: "segment" },
  { id: "arm", label: "Bras robotisé", group: "Manutention", type: "place", kind: "arm" },
  { id: "consolidator", label: "Regroupement de commande", group: "Manutention", type: "place", kind: "consolidator" },
  { id: "delta", label: "Robot delta", group: "Manutention", type: "place", kind: "delta" },
  { id: "palletizer", label: "Palettiseur", group: "Manutention", type: "place", kind: "palletizer" },
  { id: "packer", label: "Machine d'emballage", group: "Manutention", type: "place", kind: "packer" },
  { id: "forklift", label: "Chariot élévateur", group: "Véhicules", type: "place", kind: "forklift" },
  { id: "amr", label: "Robot autonome", group: "Véhicules", type: "place", kind: "amr" },
  { id: "truck", label: "Semi-remorque", group: "Véhicules", type: "place", kind: "truck" },
  { id: "container", label: "Conteneur", group: "Extérieur", type: "place", kind: "container" },
  { id: "worker", label: "Opérateur", group: "Extérieur", type: "place", kind: "worker" },
  { id: "tree", label: "Arbre", group: "Extérieur", type: "place", kind: "tree" },
  { id: "light", label: "Éclairage", group: "Extérieur", type: "place", kind: "light" },
  { id: "parking", label: "Parking", group: "Extérieur", type: "place", kind: "parking" },
  { id: "shrub", label: "Arbuste", group: "Extérieur", type: "place", kind: "shrub" },
  { id: "flowerBed", label: "Parterre de fleurs", group: "Extérieur", type: "place", kind: "flowerBed" },
  { id: "barrier", label: "Barrière", group: "Extérieur", type: "place", kind: "barrier" },
  { id: "gate", label: "Portail coulissant", group: "Extérieur", type: "draw", kind: "gate", mode: "segment" },
  { id: "tollBooth", label: "Poste de péage", group: "Extérieur", type: "place", kind: "tollBooth" },
  { id: "transformer", label: "Transformateur", group: "Énergie", type: "place", kind: "transformer" },
  { id: "solar", label: "Panneaux solaires", group: "Énergie", type: "place", kind: "solar" },
  { id: "powerLine", label: "Ligne électrique", group: "Énergie", type: "draw", kind: "powerLine", mode: "chain" },
];
/**
 * La palette, en menus et sous-menus : cinq familles qu'on ouvre et referme, et dans chacune des
 * rayons — de quoi retrouver un outil d'un coup d'œil quand il y en a une vingtaine.
 */
const MENU: { title: string; subs: { title: string; ids: string[] }[] }[] = [
  {
    title: "Murs",
    subs: [
      { title: "Tracer", ids: ["wall", "chain", "parallel", "room", "lowWall"] },
      { title: "Quai et clôtures", ids: ["dock", "fence"] },
      { title: "Ouvertures", ids: ["door", "window", "bay"] },
      { title: "Toiture", ids: ["roof"] },
    ],
  },
  {
    title: "Stockage",
    subs: [
      { title: "Racks", ids: ["palletRack"] },
      { title: "Étagères", ids: ["shelf"] },
      { title: "Au sol", ids: ["zone"] },
    ],
  },
  {
    title: "Convoyage",
    subs: [
      { title: "Tapis", ids: ["conveyor", "conveyorCorner", "conveyorTee"] },
      { title: "Rails et pickers", ids: ["rail", "railCorner", "picker"] },
      { title: "Robots", ids: ["arm", "consolidator", "delta", "palletizer"] },
      { title: "Machines", ids: ["packer"] },
    ],
  },
  {
    title: "Véhicules",
    subs: [
      { title: "Engins", ids: ["forklift", "amr"] },
      { title: "Camions", ids: ["truck"] },
    ],
  },
  {
    title: "Extérieur",
    subs: [
      { title: "Accès", ids: ["barrier", "gate", "tollBooth"] },
      { title: "Cour", ids: ["container", "light", "parking"] },
      { title: "Nature et personnes", ids: ["tree", "shrub", "flowerBed", "worker"] },
    ],
  },
  {
    title: "Énergie",
    subs: [
      { title: "Production", ids: ["solar"] },
      { title: "Réseau", ids: ["powerLine", "transformer"] },
    ],
  },
];

type Drag =
  | { t: "pan"; sx: number; sy: number; cx: number; cy: number; gx: number; gy: number; moved: boolean }
  | { t: "orbit"; sx: number; sy: number; yaw: number; tilt: number }
  | { t: "end"; id: string; which: 0 | 1; orig: PlannerItem }
  | { t: "move"; id: string; wx: number; wy: number; orig: PlannerItem }
  | { t: "rotate"; id: string; cx: number; cy: number; orig: PlannerItem };

const DND = "application/x-lq-planner";
/** Comparer sans casse ni accents : « etagere » trouve « Étagère ». */
const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
/** Le cap qui met les `x` à droite et les `y` en bas de l'écran, en vue de dessus. */
const TOP_YAW = -45;

/** La toiture tracée d'un coin à l'autre, ou rien si le rectangle est trop mince. */
function roofBetween(a: P, b: P): PlannerPoint | null {
  const length = Math.abs(b.x - a.x);
  const width = Math.abs(b.y - a.y);
  if (length < 1 || width < 1) return null;
  return { id: "draft-roof", kind: "roof", level: 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, rotation: 0, size: { length, width } };
}

/** Ce qu'une entrée pose quand on la lâche sur le terrain sans la tracer. */
function dropped(entry: Entry, x: number, y: number): PlannerItem[] {
  if (entry.type === "place") return [createItem(entry.kind, x, y)];
  if (entry.type === "area") return [{ ...createItem("roof", x, y), size: { length: 8, width: 6 } } as PlannerItem];
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (entry.mode === "room") return commitDraft(draftWalls(entry.kind, "room", { x: cx - 5, y: cy - 4 }, { x: cx + 5, y: cy + 4 }));
  if (entry.mode === "parallel") return commitDraft(draftWalls(entry.kind, "parallel", { x: cx - 5, y: cy - 2 }, { x: cx + 5, y: cy + 2 }));
  return [createItem(entry.kind, x, y)];
}

/** La prise de vue d'une entrée de la palette : ce qu'elle pose, seul, en perspective. */
function entryJob(entry: Entry): SnapshotJob {
  // Une ouverture se montre dans un bout de mur : seule, elle n'existe pas.
  if (WALL_MOUNTED.includes(entry.kind)) {
    const L = entry.kind === "bay" ? 5 : 3;
    const wall: PlannerItem = { id: `thumb-${entry.id}-wall`, kind: "wall", level: 2, x0: 0, y0: 0, x1: L, y1: 0 };
    const opening = { ...createItem(entry.kind, L / 2, 0), id: `thumb-${entry.id}` } as PlannerItem;
    return {
      id: `planner-${entry.id}`,
      bounds: { x0: -0.3, x1: L + 0.3, y0: -0.6, y1: 0.6, z0: 0, z1: 3.2 },
      node: <PlannerItem3D item={wall} mounts={wallMounts(wall as PlannerLinear, [opening])} />,
    };
  }
  const items = dropped(entry, 0, 0);
  const pts = items.map(footprintOf).flatMap(cornersOf);
  let x0 = Math.min(...pts.map((p) => p.x)) - 0.3;
  let x1 = Math.max(...pts.map((p) => p.x)) + 0.3;
  let y0 = Math.min(...pts.map((p) => p.y)) - 0.3;
  const y1 = Math.max(...pts.map((p) => p.y)) + 0.3;
  if (entry.kind === "dock") y0 -= 0.6;
  if (entry.kind === "tree" || entry.kind === "light") {
    x0 -= 0.6;
    x1 += 0.6;
  }
  const tall: Partial<Record<string, number>> = {
    light: 6,
    tree: 3.4,
    palletRack: 3.5,
    shelfDecks: 2.8,
    picker: 4,
    parking: 1.5,
    solar: 1.4,
    powerLine: 4.3,
    fence: 1.6,
    conveyor: 1.6,
    conveyorCorner: 1.4,
    conveyorTee: 1.4,
    rail: 0.6,
    railCorner: 0.6,
    roof: 3.5,
    shrub: 0.5,
    flowerBed: 0.4,
    barrier: 1.3,
    gate: 1.2,
    lowWall: 1.2,
    tollBooth: 3,
    transformer: 1.4,
    packer: 2.2,
    consolidator: 2.6,
    delta: 2.3,
    palletizer: 2.4,
  };
  const h = tall[entry.kind] ?? (entry.type === "place" ? 2 : 3);
  const node: ReactNode = items.map((it, i) => <PlannerItem3D key={i} item={{ ...it, id: `thumb-${entry.id}-${i}` }} />);
  return { id: `planner-${entry.id}`, bounds: { x0, x1, y0, y1, z0: 0, z1: h }, node };
}

export function WarehousePlanner({
  seed: seedProp,
  defaultSeed = 7,
  onSeedChange,
  shape,
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  plotSize,
  defaultView = "top",
  defaultOrbit = { yaw: 30, tilt: 40 },
  defaultProjection = "orthographic",
  defaultZoom = 1,
  cellSize = 14,
  height = 640,
  className,
}: WarehousePlannerProps) {
  const [ownSeed, setOwnSeed] = useState(defaultSeed);
  const seed = seedProp ?? ownSeed;
  const setSeed = (s: number) => {
    setOwnSeed(s);
    onSeedChange?.(s);
  };
  const [ownItems, setOwnItems] = useState<PlannerItem[]>(defaultItems);
  const items = itemsProp ?? ownItems;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const setItems = useCallback(
    (next: PlannerItem[]) => {
      itemsRef.current = next;
      setOwnItems(next);
      onItemsChange?.(next);
    },
    [onItemsChange]
  );

  const plot = useMemo(() => generatePlot(seed, { shape, width: plotSize?.width, depth: plotSize?.depth }), [seed, shape, plotSize?.width, plotSize?.depth]);
  const jobs = useMemo(() => ENTRIES.map(entryJob), []);
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => Object.fromEntries(jobs.map((j) => [j.id, cachedSnapshot(j.id)]).filter(([, u]) => u)));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** L'outil en main : une entrée de la palette. */
  const [tool, setTool] = useState<Entry | null>(null);
  /** Le cap de l'élément qu'on s'apprête à poser — R le tourne avant le clic. */
  const [placeRot, setPlaceRot] = useState(0);
  /** Les toitures affichées — on les masque pour voir et construire dedans. */
  const [showRoofs, setShowRoofs] = useState(true);
  /** Le départ du tracé en cours, et le point sous le curseur. */
  const [start, setStart] = useState<P | null>(null);
  const [cursor, setCursor] = useState<P | null>(null);
  const [mode3d, setMode3d] = useState(defaultView === "3d");
  const [orbit, setOrbit] = useState(defaultOrbit);
  const [projection, setProjection] = useState<IsoProjection>(defaultProjection);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ Murs: true, Stockage: true, Convoyage: true });
  const [message, setMessage] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 800, height: 520 });
  const [view, setView] = useState({ cx: 0, cy: 0, zoom: 1 });
  const fitted = useRef<number | null>(null);
  const measured = useRef(false);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      measured.current = true;
      setSize({ width: Math.max(100, el.clientWidth), height: Math.max(100, el.clientHeight) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Cadrer le terrain et un peu de sa rue. */
  const fit = useCallback(() => {
    const zoom = Math.min(size.width / (plot.width + 16), size.height / (plot.depth + 16)) / cellSize;
    setView({ cx: plot.width / 2, cy: plot.depth / 2, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) });
  }, [plot, size, cellSize]);
  useEffect(() => {
    if (!measured.current || fitted.current === plot.seed) return;
    // Le tout premier cadrage tient compte du grossissement demandé ; les suivants, non.
    const first = fitted.current === null;
    fitted.current = plot.seed;
    fit();
    if (first && defaultZoom !== 1) setView((v) => ({ ...v, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * defaultZoom)) }));
  }, [plot.seed, fit, defaultZoom]);

  // --- La caméra, et le passage écran ↔ sol dans n'importe quelle vue ---------------------------
  const camYaw = mode3d ? orbit.yaw : TOP_YAW;
  const camTilt = mode3d ? orbit.tilt : 90;
  const projectorFor = (cx: number, cy: number, zoom: number) =>
    viewProjector({ yaw: camYaw, tilt: camTilt, scale: cellSize * zoom, width: size.width, height: size.height, center: { x: cx, y: cy }, projection });
  const proj = projectorFor(view.cx, view.cy, view.zoom);
  const toScreen = (x: number, y: number, z = 0) => proj.toScreen(x, y, z);
  /** Le point du sol sous un pixel ; au-dessus de l'horizon, le centre de la vue. */
  const toWorld = (sx: number, sy: number) => proj.toGround(sx, sy) ?? { x: view.cx, y: view.cy };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 2600);
  };

  /** Poser ce qu'une entrée pose au point `(x, y)`, ou au plus près qui tienne. */
  const place = (entry: Entry, x: number, y: number) => {
    const base = dropped(entry, x, y);
    for (let r = 0; r <= 12; r += 0.5) {
      const steps = r === 0 ? 1 : Math.ceil(r * 8);
      for (let k = 0; k < steps; k += 1) {
        const a = (k / steps) * Math.PI * 2;
        const cand = base.map((it) => moveBy(it, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)));
        if (cand.every((it) => fitsPlot(it, plot))) {
          setItems([...itemsRef.current, ...cand]);
          setSelectedId(cand.length === 1 ? cand[0].id : null);
          return;
        }
      }
    }
    flash("Pas de place sur le terrain pour cet élément ici.");
  };

  // --- Le tracé en cours -------------------------------------------------------------------------
  const drawing = tool?.type === "draw" ? tool : null;
  const placing = tool?.type === "place" ? tool : null;
  const areaTool = tool?.type === "area" ? tool : null;
  /** L'élément à poser, sous le curseur, calé sur la grille : ce que le clic posera, exactement.
   *  Une porte, une fenêtre, une baie s'accrochent au mur le plus proche — sinon, rien. */
  const rawGhost = placing && cursor ? rotateTo(createItem(placing.kind, cursor.x, cursor.y), placeRot) : null;
  const mountedGhost = !!rawGhost && WALL_MOUNTED.includes(rawGhost.kind);
  const ghost = rawGhost && mountedGhost ? snapToWall(rawGhost as PlannerPoint, items) : rawGhost;
  const ghostOk = ghost ? fitsPlot(ghost, plot) : false;
  /** La toiture en cours de tracé : le rectangle entre le coin de départ et le curseur. */
  const areaDraft = areaTool && start && cursor ? roofBetween(start, cursor) : null;
  const areaOk = areaDraft ? fitsPlot(areaDraft, plot) : false;
  const draft: PlannerLinear[] = drawing && start && cursor ? draftWalls(drawing.kind, drawing.mode, start, cursor) : [];
  const draftOk = draft.every((w) => fitsPlot(w, plot));

  const pickTool = (entry: Entry | null) => {
    setTool(entry);
    setStart(null);
    setSelectedId(null);
  };

  const drawClick = (p: P) => {
    if (!drawing) return;
    const q = wallPoint(p, start, drawing.mode, itemsRef.current);
    if (!start) {
      setStart(q);
      setCursor(q);
      return;
    }
    const walls = draftWalls(drawing.kind, drawing.mode, start, q);
    if (!walls.length) return;
    if (!walls.every((w) => fitsPlot(w, plot))) {
      flash("Ce tracé sort du terrain constructible.");
      return;
    }
    setItems([...itemsRef.current, ...commitDraft(walls)]);
    // Une chaîne continue là où le mur s'arrête ; les autres outils attendent un nouveau départ.
    setStart(drawing.mode === "chain" ? q : null);
  };

  const areaClick = (p: P) => {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    if (!start) {
      setStart(q);
      setCursor(q);
      return;
    }
    const roof = roofBetween(start, q);
    if (!roof) return;
    if (!fitsPlot(roof, plot)) {
      flash("Cette toiture sort du terrain constructible.");
      return;
    }
    setItems([...itemsRef.current, { ...roof, id: createItem("roof", 0, 0).id }]);
    setStart(null);
  };

  const update = (id: string, next: PlannerItem) => setItems(itemsRef.current.map((it) => (it.id === id ? next : it)));

  // --- Les gestes -------------------------------------------------------------------------------
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    stage.current?.focus();
    const p = local(e);
    if (e.button === 2) {
      // Le clic droit repose le tracé en cours, puis l'outil.
      if (start) setStart(null);
      else setTool(null);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const w = toWorld(p.x, p.y);
    const pan = { t: "pan" as const, sx: p.x, sy: p.y, cx: view.cx, cy: view.cy, gx: w.x, gy: w.y, moved: false };
    if (e.button === 1) {
      // Le clic molette tient la caméra : tourner autour, incliner. Depuis la vue de dessus, on part
      // de l'aplomb, au même cap, et on bascule de biais sans à-coup.
      e.preventDefault();
      const from = mode3d ? orbit : { yaw: TOP_YAW, tilt: 89 };
      if (!mode3d) {
        setOrbit(from);
        setMode3d(true);
      }
      drag.current = { t: "orbit", sx: p.x, sy: p.y, yaw: from.yaw, tilt: from.tilt };
      return;
    }
    if (drawing) {
      drawClick(w);
      return;
    }
    if (areaTool) {
      areaClick(w);
      return;
    }
    if (placing) {
      // On pose ce que montre le fantôme, là où il est — pas ailleurs.
      let item = rotateTo(createItem(placing.kind, w.x, w.y), placeRot);
      if (WALL_MOUNTED.includes(item.kind)) {
        const onWall = snapToWall(item as PlannerPoint, itemsRef.current);
        if (!onWall) {
          flash("Une ouverture se pose sur un mur : approchez-la d'un mur.");
          return;
        }
        item = onWall;
      }
      if (!fitsPlot(item, plot)) {
        flash("Hors du terrain constructible.");
        return;
      }
      setItems([...itemsRef.current, item]);
      setSelectedId(item.id);
      if (!e.shiftKey) setTool(null);
      return;
    }
    const handle = (e.target as Element).closest?.("[data-handle]") as HTMLElement | null;
    if (handle) {
      const id = handle.dataset.id as string;
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item) return;
      setSelectedId(id);
      if (handle.dataset.handle === "move") drag.current = { t: "move", id, wx: w.x, wy: w.y, orig: item };
      else if (handle.dataset.handle === "rotate") {
        const f = footprintOf(item);
        drag.current = { t: "rotate", id, cx: f.cx, cy: f.cy, orig: item };
      }
      else drag.current = { t: "end", id, which: handle.dataset.handle === "end0" ? 0 : 1, orig: item };
      return;
    }
    const hit = hitTest(itemsRef.current, w);
    if (hit) {
      setSelectedId(hit.id);
      drag.current = { t: "move", id: hit.id, wx: w.x, wy: w.y, orig: hit };
      return;
    }
    drag.current = pan;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(e);
    const d = drag.current;
    if (!d) {
      const w = toWorld(p.x, p.y);
      if (drawing) {
        const q = wallPoint(w, start, drawing.mode, itemsRef.current);
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      if (areaTool) {
        const q = { x: Math.round(w.x), y: Math.round(w.y) };
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      if (placing) {
        // Le fantôme ne bouge que d'un cran de grille à l'autre.
        const g = rotateTo(createItem(placing.kind, w.x, w.y), placeRot);
        const q = { x: (g as { x: number }).x, y: (g as { y: number }).y };
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      const id = hitTest(itemsRef.current, w)?.id ?? null;
      if (id !== hoverId) setHoverId(id);
      return;
    }
    if (d.t === "orbit") {
      // La main qui monte relève la caméra, comme sur la planche : on voit la scène de plus haut.
      setOrbit({ yaw: d.yaw + (p.x - d.sx) * 0.4, tilt: Math.max(10, Math.min(89, d.tilt - (p.y - d.sy) * 0.25)) });
      return;
    }
    if (d.t === "pan") {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) > 3) d.moved = true;
      // On tient le point du sol attrapé sous le pointeur : la vue glisse d'autant, sous tout angle.
      const g = projectorFor(d.cx, d.cy, view.zoom).toGround(p.x, p.y);
      if (g) setView((v) => ({ ...v, cx: d.cx + (d.gx - g.x), cy: d.cy + (d.gy - g.y) }));
      return;
    }
    const w = toWorld(p.x, p.y);
    if (d.t === "move") {
      let next = moveBy(d.orig, w.x - d.wx, w.y - d.wy);
      // Une ouverture glisse le long de son mur, ou passe à un autre ; jamais dans le vide.
      if (WALL_MOUNTED.includes(next.kind)) next = snapToWall(next as PlannerPoint, itemsRef.current.filter((it) => it.id !== d.id)) ?? d.orig;
      update(d.id, next);
    }
    else if (d.t === "rotate") update(d.id, rotateTo(d.orig, (Math.atan2(w.y - d.cy, w.x - d.cx) * 180) / Math.PI, e.altKey));
    else if (isLinear(d.orig)) update(d.id, dragEnd(d.orig, d.which, w, e.altKey));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.t === "pan") {
      if (!d.moved) setSelectedId(null);
      return;
    }
    if (d.t === "orbit") return;
    const now = itemsRef.current.find((it) => it.id === d.id);
    if (now && !fitsPlot(now, plot)) {
      update(d.id, d.orig);
      flash("Hors du terrain constructible : l'élément revient à sa place.");
    }
  };

  // La molette zoome autour du pointeur. Écoutée à la main : React la rend passive. L'écouteur est
  // posé une fois ; il lit la caméra du moment par une référence.
  const zoomProjector = useRef(projectorFor);
  zoomProjector.current = projectorFor;
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      setView((v) => {
        const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        // Le point du sol sous le pointeur y reste : on le vise avant et après, et on recale.
        const g0 = zoomProjector.current(v.cx, v.cy, v.zoom).toGround(sx, sy);
        const g1 = zoomProjector.current(v.cx, v.cy, zoom).toGround(sx, sy);
        if (!g0 || !g1) return { ...v, zoom };
        return { zoom, cx: v.cx + g0.x - g1.x, cy: v.cy + g0.y - g1.y };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cellSize]);

  const zoomBy = (k: number) => setView((v) => ({ ...v, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * k)) }));

  const selected = items.find((it) => it.id === selectedId) ?? null;
  const remove = () => {
    if (!selected) return;
    setItems(itemsRef.current.filter((it) => it.id !== selected.id));
    setSelectedId(null);
  };
  const turn = (dir: 1 | -1 = 1) => selected && !WALL_MOUNTED.includes(selected.kind) && update(selected.id, rotateQuarter(selected, dir));
  const setOption = (patch: { storage?: StorageClass; passage?: boolean }) => selected && update(selected.id, { ...selected, ...patch } as PlannerItem);
  const reverse = () => selected && update(selected.id, flip(selected));
  /** Améliorer (`+1`) ou rétrograder (`-1`) l'élément choisi — s'il tient encore sur le terrain. */
  const evolve = (dir: 1 | -1) => {
    if (!selected) return;
    const next = withLevel(selected, levelOf(selected) + dir);
    if (levelOf(next) === levelOf(selected)) return;
    if (!fitsPlot(next, plot)) {
      flash("Pas la place pour ce niveau ici : déplacez l'élément d'abord.");
      return;
    }
    update(selected.id, next);
  };
  const swapDock = () => {
    if (selected && isLinear(selected) && (selected.kind === "wall" || selected.kind === "dock")) update(selected.id, { ...selected, kind: selected.kind === "wall" ? "dock" : "wall" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Dans le champ de recherche, une lettre est une lettre.
    if ((e.target as HTMLElement).closest?.("input, textarea")) return;
    if (e.key === "Escape") {
      if (start) setStart(null);
      else if (tool) setTool(null);
      else setSelectedId(null);
    } else if (e.key === "Delete" || e.key === "Backspace") remove();
    else if (e.key === "r" || e.key === "R") {
      // Avant la pose, R tourne le fantôme ; après, l'élément choisi. Maj : dans l'autre sens.
      if (placing) setPlaceRot((r) => (r + (e.shiftKey ? 270 : 90)) % 360);
      else turn(e.shiftKey ? -1 : 1);
    }
    else if (e.key === "f" || e.key === "F") reverse();
    else if (e.key === "u" || e.key === "U") evolve(e.shiftKey ? -1 : 1);
    else if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-") zoomBy(0.8);
    else return;
    e.preventDefault();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(DND);
    const entry = ENTRIES.find((x) => x.id === id);
    if (!entry) return;
    e.preventDefault();
    const p = local(e);
    const w = toWorld(p.x, p.y);
    place(entry, w.x, w.y);
  };

  // --- Le calque : contours, poignées, cotes -----------------------------------------------------
  const outline = (item: PlannerItem, cls: string, key: string) => {
    const poly = cornersOf(footprintOf(item))
      .map((c) => toScreen(c.x, c.y))
      .map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`)
      .join(" ");
    return <polygon key={key} className={cls} points={poly} />;
  };
  const dim = (w: PlannerLinear, key: string) => {
    const L = Math.hypot(w.x1 - w.x0, w.y1 - w.y0);
    const m = toScreen((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2);
    return (
      <text key={key} className="lq-planner__dim" x={m.x} y={m.y - 12} textAnchor="middle">
        {`${(L * 2).toFixed(0)} m`}
      </text>
    );
  };
  const overlay = (item: PlannerItem, strong: boolean) => {
    const ok = fitsPlot(item, plot);
    const cls = ["lq-planner__outline", strong && "lq-planner__outline--selected", !ok && "lq-planner__outline--invalid"].filter(Boolean).join(" ");
    const parts: ReactNode[] = [outline(item, cls, "o")];
    if (isLinear(item)) {
      const a = toScreen(item.x0, item.y0);
      const b = toScreen(item.x1, item.y1);
      const m = toScreen((item.x0 + item.x1) / 2, (item.y0 + item.y1) / 2);
      parts.push(
        <circle key="e0" className="lq-planner__handle lq-planner__handle--end" data-handle="end0" data-id={item.id} cx={a.x} cy={a.y} r={7}>
          <title>Tirer pour étirer</title>
        </circle>,
        <circle key="e1" className="lq-planner__handle lq-planner__handle--end" data-handle="end1" data-id={item.id} cx={b.x} cy={b.y} r={7}>
          <title>Tirer pour étirer</title>
        </circle>,
        <g key="m" className="lq-planner__handle lq-planner__handle--move" data-handle="move" data-id={item.id} transform={`translate(${m.x} ${m.y})`}>
          <rect x={-9} y={-9} width={18} height={18} rx={3} />
          <path d="M0 -6 L0 6 M-6 0 L6 0 M0 -6 l-2 2 M0 -6 l2 2 M0 6 l-2 -2 M0 6 l2 -2 M-6 0 l2 -2 M-6 0 l2 2 M6 0 l-2 -2 M6 0 l-2 2" />
          <title>Tirer pour déplacer</title>
        </g>
      );
      if (strong) parts.push(dim(item, "d"));
    } else if (strong && !WALL_MOUNTED.includes(item.kind)) {
      // La poignée de rotation, devant l'élément, dans son cap : on la tire autour de lui.
      const f = footprintOf(item);
      const reach = f.halfL + 0.9;
      const c = toScreen(f.cx, f.cy);
      const h = toScreen(f.cx + Math.cos(f.angle) * reach, f.cy + Math.sin(f.angle) * reach);
      parts.push(
        <line key="rl" className="lq-planner__rotate-arm" x1={c.x} y1={c.y} x2={h.x} y2={h.y} />,
        <g key="r" className="lq-planner__handle lq-planner__handle--rotate" data-handle="rotate" data-id={item.id} transform={`translate(${h.x} ${h.y})`}>
          <circle r={9} />
          <path d="M-4 -3 A5 5 0 1 1 -5 2 M-4 -3 l-2.5 0.5 M-4 -3 l0.5 -2.5" />
          <title>Tirer pour tourner (Alt : sans crans)</title>
        </g>,
        <text key="ra" className="lq-planner__dim" x={h.x} y={h.y - 14} textAnchor="middle">
          {`${Math.round(headingOf(item))}°`}
        </text>
      );
    }
    return <g key={item.id}>{parts}</g>;
  };

  const shown = drawing ? [] : items.filter((it) => it.id === selectedId || it.id === hoverId);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.kind, (m.get(it.kind) ?? 0) + 1);
    return m;
  }, [items]);
  const cur = cursor && drawing ? toScreen(cursor.x, cursor.y) : null;
  const anchor = start && drawing ? toScreen(start.x, start.y) : null;
  /** Le carré de la case sous le curseur, projeté : un losange en vue de biais. */
  const cell = cursor && drawing ? [toScreen(cursor.x - 0.5, cursor.y - 0.5), toScreen(cursor.x + 0.5, cursor.y - 0.5), toScreen(cursor.x + 0.5, cursor.y + 0.5), toScreen(cursor.x - 0.5, cursor.y + 0.5)] : null;
  /** Combien d'éléments une entrée a posés — les murs, sur l'entrée « Mur » seulement. */
  const entryCount = (id: string) => {
    const entry = ENTRIES.find((e) => e.id === id);
    if (!entry) return undefined;
    if (entry.type === "draw" && entry.kind === "wall") return id === "wall" ? counts.get("wall") : undefined;
    return counts.get(entry.kind);
  };
  const toolButton = (entry: Entry) => {
    const url = thumbs[`planner-${entry.id}`];
    const n = entryCount(entry.id);
    return (
      <button
        key={entry.id}
        type="button"
        className={["lq-planner__tool", tool?.id === entry.id && "lq-planner__tool--armed"].filter(Boolean).join(" ")}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DND, entry.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => pickTool(tool?.id === entry.id ? null : entry)}
        title={`${entry.label} — évolutions : ${TIERS[entry.kind].join(" → ")}`}
        aria-pressed={tool?.id === entry.id}
      >
        {url ? <img className="lq-planner__thumb" src={url} alt="" draggable={false} /> : <span className="lq-planner__thumb lq-planner__thumb--pending" aria-hidden />}
        <span className="lq-planner__tool-label">{entry.label}</span>
        {TIERS[entry.kind].length > 1 && (
          <span className="lq-planner__tool-tiers" title={TIERS[entry.kind].join(" → ")}>
            {TIERS[entry.kind].length} niveaux
          </span>
        )}
        {n ? <span className="lq-planner__tool-count">{n}</span> : null}
      </button>
    );
  };

  const hint = areaTool
    ? start
      ? "Cliquez le coin opposé de la toiture — Échap pour l'annuler."
      : "Toiture : cliquez un coin de la pièce à couvrir."
    : placing && mountedGhost
      ? "Approchez l'ouverture d'un mur : elle s'y accroche. Cliquez pour la poser."
      : drawing
    ? start
      ? drawing.mode === "chain"
        ? "Cliquez pour poser et continuer — double-clic, clic droit ou Échap pour finir la chaîne."
        : "Cliquez une seconde fois pour arrêter le tracé — Échap pour l'annuler."
      : `${drawing.label} : cliquez le point de départ.`
    : tool
      ? `${tool.label} : cliquez où le poser (Maj pour en poser plusieurs).`
      : null;

  return (
    // Le clavier est écouté sur tout l'éditeur : juste après un clic dans la palette, R doit déjà
    // tourner l'élément à poser.
    <div className={["lq-planner", className].filter(Boolean).join(" ")} style={{ height }} onKeyDown={onKeyDown}>
      <SnapshotStudio jobs={jobs} width={128} height={96} onShot={(id, url) => setThumbs((t) => ({ ...t, [id]: url }))} />
      <aside className="lq-planner__palette" aria-label="Palette d'éléments">
        <p className="lq-planner__intro">Choisissez un outil puis cliquez sur le terrain — un mur se trace d'un clic à l'autre. Les éléments se glissent aussi depuis la palette.</p>
        <label className="lq-planner__search">
          <SearchIcon size={13} />
          <input type="search" placeholder="Chercher un élément…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher un élément" />
        </label>
        {query.trim() ? (
          <div className="lq-planner__tools">{ENTRIES.filter((e) => fold(e.label).includes(fold(query))).map(toolButton)}</div>
        ) : (
          MENU.map((menu) => {
            const isOpen = open[menu.title] ?? false;
            const total = menu.subs.flatMap((sub) => sub.ids).reduce((n, id) => n + (entryCount(id) ?? 0), 0);
            return (
              <section key={menu.title} className="lq-planner__group">
                <button type="button" className="lq-planner__menu" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [menu.title]: !isOpen }))}>
                  {isOpen ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
                  <span>{menu.title}</span>
                  {total ? <span className="lq-planner__menu-count">{total}</span> : null}
                </button>
                {isOpen &&
                  menu.subs.map((sub) => (
                    <div key={sub.title} className="lq-planner__sub">
                      <h4 className="lq-planner__sub-title">{sub.title}</h4>
                      <div className="lq-planner__tools">{sub.ids.map((id) => ENTRIES.find((e) => e.id === id)).filter((e): e is Entry => !!e).map(toolButton)}</div>
                    </div>
                  ))}
              </section>
            );
          })
        )}
      </aside>

      <div className="lq-planner__main">
        <div
          ref={stage}
          className={["lq-planner__stage", drawing && "lq-planner__stage--drawing", tool?.type === "place" && "lq-planner__stage--armed", mode3d && "lq-planner__stage--3d"].filter(Boolean).join(" ")}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            if (!drag.current) setHoverId(null);
          }}
          onDoubleClick={() => {
            if (drawing?.mode === "chain") setStart(null);
          }}
          onContextMenu={(e) => e.preventDefault()}
          // Sans cela, le clic molette lance le défilement automatique du navigateur.
          onMouseDown={(e) => {
            if (e.button === 1) e.preventDefault();
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DND)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={onDrop}
          aria-label="Plan de l'entrepôt"
        >
          <IsoCamera yaw={camYaw} tilt={camTilt} zoom={1} projection={projection}>
            <WarehouseScene
              bounds={frameBounds(plot.frame)}
              cellSize={cellSize}
              viewport={{ width: size.width, height: size.height, center: { x: view.cx, y: view.cy }, zoom: view.zoom }}
              lazy={false}
              style={{ position: "absolute", inset: 0 }}
              ariaLabel="Terrain et construction"
            >
              <BuildPlot layout={plot} />
              {items.map((it) => (
                <PlannerItem3D
                  key={it.id}
                  item={it}
                  roofs={showRoofs}
                  // Un mur porte les ouvertures accrochées à lui — et celle qu'on s'apprête à poser.
                  mounts={isLinear(it) && (it.kind === "wall" || it.kind === "dock") ? wallMounts(it, ghost && mountedGhost ? [...items, ghost] : items) : undefined}
                />
              ))}
              {/* Le tracé en cours, déjà en volume : on voit le mur avant de le poser. */}
              {ghost && !mountedGhost && <PlannerItem3D key={`ghost-${ghost.kind}-${placeRot}`} item={{ ...ghost, id: `ghost-${ghost.kind}` }} />}
              {areaDraft && <PlannerItem3D key={`roof-${areaDraft.x}-${areaDraft.y}-${areaDraft.size?.length}-${areaDraft.size?.width}`} item={areaDraft} />}
              {draft.map((w) => (
                <PlannerItem3D key={`${w.id}:${w.x0},${w.y0},${w.x1},${w.y1}`} item={w} />
              ))}
            </WarehouseScene>
          </IsoCamera>
          {(
            <svg className="lq-planner__overlay" width={size.width} height={size.height}>
              {shown.map((it) => overlay(it, it.id === selectedId))}
              {draft.map((w, i) => outline(w, ["lq-planner__outline", "lq-planner__outline--draft", !draftOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), `draft${i}`))}
              {draft.map((w, i) => dim(w, `dd${i}`))}
              {anchor && <circle className="lq-planner__anchor" cx={anchor.x} cy={anchor.y} r={5} />}
              {(ghost ?? rawGhost) && outline((ghost ?? rawGhost) as PlannerItem, ["lq-planner__outline", "lq-planner__outline--draft", !ghostOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), "ghost")}
              {areaDraft && outline(areaDraft, ["lq-planner__outline", "lq-planner__outline--draft", !areaOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), "area")}
              {cur && cell && (
                <g className="lq-planner__cursor">
                  <polygon points={cell.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")} />
                  <path d={`M${cur.x - 8} ${cur.y} H${cur.x + 8} M${cur.x} ${cur.y - 8} V${cur.y + 8}`} />
                </g>
              )}
            </svg>
          )}

          <div className="lq-planner__toolbar" onPointerDown={(e) => e.stopPropagation()}>
            <div className="lq-planner__switch" role="group" aria-label="Vue">
              <button type="button" className={!mode3d ? "is-on" : undefined} aria-pressed={!mode3d} onClick={() => setMode3d(false)}>
                Dessus
              </button>
              <button
                type="button"
                className={mode3d ? "is-on" : undefined}
                aria-pressed={mode3d}
                onClick={() => setMode3d(true)}
              >
                3D
              </button>
            </div>
            <div className="lq-planner__switch" role="group" aria-label="Projection">
              <button type="button" className={projection === "orthographic" ? "is-on" : undefined} aria-pressed={projection === "orthographic"} onClick={() => setProjection("orthographic")} title="Vue isométrique, sans fuite">
                Iso
              </button>
              <button type="button" className={projection === "perspective" ? "is-on" : undefined} aria-pressed={projection === "perspective"} onClick={() => setProjection("perspective")} title="Vue en perspective">
                Perspective
              </button>
            </div>
            {mode3d && (
              <>
                <button type="button" onClick={() => setOrbit((o) => ({ ...o, yaw: o.yaw - 45 }))} title="Tourner à gauche" aria-label="Tourner à gauche">
                  ⟲
                </button>
                <button type="button" onClick={() => setOrbit((o) => ({ ...o, yaw: o.yaw + 45 }))} title="Tourner à droite" aria-label="Tourner à droite">
                  ⟳
                </button>
              </>
            )}
            <button type="button" onClick={() => zoomBy(1.25)} title="Zoomer (+)" aria-label="Zoomer">
              +
            </button>
            <button type="button" onClick={() => zoomBy(0.8)} title="Dézoomer (−)" aria-label="Dézoomer">
              −
            </button>
            <button type="button" onClick={fit} title="Cadrer le terrain" aria-label="Cadrer le terrain">
              <MaximizeIcon size={14} />
            </button>
            <button type="button" className={showRoofs ? "is-on" : undefined} aria-pressed={showRoofs} onClick={() => setShowRoofs((v) => !v)} title="Afficher ou masquer les toitures, pour voir dedans">
              Toits
            </button>
          </div>

          {selected && !drawing && (
            <div className="lq-planner__inspector" onPointerDown={(e) => e.stopPropagation()}>
              <strong>{PLANNER_LABEL[selected.kind]}</strong>
              {isLinear(selected) ? (
                <span>{(Math.hypot(selected.x1 - selected.x0, selected.y1 - selected.y0) * 2).toFixed(0)} m</span>
              ) : (
                <span>
                  {(sizeOf(selected).length * 2).toFixed(1)} × {(sizeOf(selected).width * 2).toFixed(1)} m
                </span>
              )}
              {TIERS[selected.kind].length > 1 && (
                <span className="lq-planner__tier" title="Niveau d'évolution">
                  <span className="lq-planner__tier-pips" aria-hidden>
                    {TIERS[selected.kind].map((_, i) => (
                      <i key={i} className={i < levelOf(selected) ? "is-on" : undefined} />
                    ))}
                  </span>
                  {tierLabel(selected)}
                </span>
              )}
              {levelOf(selected) < TIERS[selected.kind].length && (
                <button type="button" className="lq-planner__upgrade" onClick={() => evolve(1)} title={`Améliorer : ${tierLabel(selected, levelOf(selected) + 1)} (U)`}>
                  ▲ {tierLabel(selected, levelOf(selected) + 1)}
                </button>
              )}
              {levelOf(selected) > 1 && (
                <button type="button" onClick={() => evolve(-1)} title="Revenir au niveau précédent (Maj + U)" aria-label="Rétrograder">
                  ▼
                </button>
              )}
              <span className="lq-planner__angle">{Math.round(headingOf(selected))}°</span>
              <button type="button" onClick={() => turn(-1)} title="Quart de tour à gauche (Maj + R)" aria-label="Quart de tour à gauche">
                ⟲ 90°
              </button>
              <button type="button" onClick={() => turn(1)} title="Quart de tour à droite (R)" aria-label="Quart de tour à droite">
                ⟳ 90°
              </button>
              {isLinear(selected) && (
                <button type="button" onClick={reverse} title="Retourner (F)">
                  ⇅ Retourner
                </button>
              )}
              {(selected.kind === "palletRack" || selected.kind === "shelf") && (
                <>
                  <label className="lq-planner__option" title="Ce que l'élément peut recevoir">
                    Stockage
                    <select value={selected.storage ?? ""} onChange={(e) => setOption({ storage: (e.target.value || undefined) as StorageClass | undefined })}>
                      <option value="">—</option>
                      {STORAGE_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {STORAGE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lq-planner__option" title="Un passage sous l'élément, pour les engins">
                    <input type="checkbox" checked={!!selected.passage} onChange={(e) => setOption({ passage: e.target.checked })} />
                    Passage dessous
                  </label>
                </>
              )}
              {isLinear(selected) && (selected.kind === "wall" || selected.kind === "dock") && (
                <button type="button" onClick={swapDock} title="Changer en mur de quai, ou en mur plein">
                  {selected.kind === "wall" ? "→ Quai" : "→ Mur plein"}
                </button>
              )}
              <button type="button" className="lq-planner__danger" onClick={remove} title="Supprimer (Suppr)">
                <TrashIcon size={13} /> Supprimer
              </button>
            </div>
          )}

          {hint ? <div className="lq-planner__hint">{hint}</div> : mode3d && <div className="lq-planner__hint">Clic molette + glisser : tourner et incliner · glisser le fond : se déplacer · molette : zoomer.</div>}
          {message && <div className="lq-planner__toast">{message}</div>}
          {items.length === 0 && !tool && <div className="lq-planner__empty">Choisissez « Mur » ou « Pièce » dans la palette, puis cliquez le point de départ sur le terrain pointillé.</div>}
        </div>

        <footer className="lq-planner__status">
          <span>
            Terrain <strong>{plot.shape}</strong> · {plot.width * 2} × {plot.depth * 2} m · {plotArea(plot) * 4} m² constructibles
          </span>
          <label className="lq-planner__seed">
            Graine
            <input type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <button type="button" onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))} title="Tirer un autre terrain">
            <RefreshIcon size={13} /> Nouveau terrain
          </button>
          <span className="lq-planner__count">
            {items.length} élément{items.length > 1 ? "s" : ""}
          </span>
        </footer>
      </div>
    </div>
  );
}
