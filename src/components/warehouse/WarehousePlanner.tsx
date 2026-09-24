import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { IsoCamera } from "./isoCamera";
import { WarehouseScene, frameBounds } from "./three/scene";
import { SnapshotStudio, cachedSnapshot, type SnapshotJob } from "./three/snapshot";
import { BuildPlot } from "./BuildPlot";
import { PlannerItem3D } from "./PlannerItem3D";
import { generatePlot, plotArea, type PlotShape } from "./plot";
import {
  PLANNER_LABEL,
  POINT_SIZE,
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
  rotateQuarter,
  wallPoint,
  type DrawMode,
  type PlannerItem,
  type PlannerLinear,
  type PlannerLinearKind,
  type PlannerPointKind,
} from "./plannerModel";
import { MaximizeIcon, RefreshIcon, TrashIcon } from "../icons";
import "./WarehousePlanner.css";

/**
 * Le plan de l'entrepôt : un terrain, une palette, et ce qu'on y construit.
 *
 * ## Ce qu'on voit
 *
 * Deux vues, qu'on bascule en haut à droite. **Dessus** : les modules 3D du kit vus d'aplomb — les
 * toits des voisins, le faîte des racks, les voitures sur la rue —, et c'est là qu'on construit.
 * **3D** : la même scène en perspective, qu'on fait tourner en tirant (à gauche, à droite pour le
 * cap, en haut, en bas pour la hauteur) et qu'on zoome à la molette. Le terrain à bâtir est la zone
 * claire semée de points, bordée d'un pointillé : c'est la seule où l'on peut poser quelque chose.
 *
 * ## Tracer des murs, comme dans les Sims
 *
 * On choisit un outil de mur, on **clique le point de départ**, et le mur **suit le curseur**,
 * d'un nœud de la grille à l'autre, droit ou à 45° ; un **second clic l'arrête**. L'outil reste en
 * main pour le mur suivant ; Échap ou un clic droit le repose.
 *
 * - **Mur**, **Mur de quai** : un segment par tracé ;
 * - **Murs en chaîne**, **Clôture**, **Tapis** : chaque clic pose un segment et commence le suivant
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
  /** La vue au départ : de dessus, ou en perspective. */
  defaultView?: "top" | "3d";
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
  | { id: string; label: string; group: string; type: "place"; kind: PlannerPointKind };

const ENTRIES: Entry[] = [
  { id: "wall", label: "Mur", group: "Murs", type: "draw", kind: "wall", mode: "segment" },
  { id: "chain", label: "Murs en chaîne", group: "Murs", type: "draw", kind: "wall", mode: "chain" },
  { id: "parallel", label: "Murs //", group: "Murs", type: "draw", kind: "wall", mode: "parallel" },
  { id: "room", label: "Pièce", group: "Murs", type: "draw", kind: "wall", mode: "room" },
  { id: "dock", label: "Mur de quai", group: "Murs", type: "draw", kind: "dock", mode: "segment" },
  { id: "fence", label: "Clôture", group: "Murs", type: "draw", kind: "fence", mode: "chain" },
  { id: "palletRack", label: "Rack à palettes", group: "Stockage", type: "draw", kind: "palletRack", mode: "segment" },
  { id: "shelf", label: "Étagère", group: "Stockage", type: "place", kind: "shelf" },
  { id: "zone", label: "Zone de stockage", group: "Stockage", type: "place", kind: "zone" },
  { id: "conveyor", label: "Tapis roulant", group: "Manutention", type: "draw", kind: "conveyor", mode: "chain" },
  { id: "arm", label: "Bras robotisé", group: "Manutention", type: "place", kind: "arm" },
  { id: "forklift", label: "Chariot élévateur", group: "Véhicules", type: "place", kind: "forklift" },
  { id: "amr", label: "Robot autonome", group: "Véhicules", type: "place", kind: "amr" },
  { id: "truck", label: "Semi-remorque", group: "Véhicules", type: "place", kind: "truck" },
  { id: "container", label: "Conteneur", group: "Extérieur", type: "place", kind: "container" },
  { id: "worker", label: "Opérateur", group: "Extérieur", type: "place", kind: "worker" },
  { id: "tree", label: "Arbre", group: "Extérieur", type: "place", kind: "tree" },
  { id: "light", label: "Mât d'éclairage", group: "Extérieur", type: "place", kind: "light" },
];
const GROUPS = ["Murs", "Stockage", "Manutention", "Véhicules", "Extérieur"];

type Drag =
  | { t: "pan"; sx: number; sy: number; cx: number; cy: number; moved: boolean }
  | { t: "orbit"; sx: number; sy: number; yaw: number; tilt: number }
  | { t: "end"; id: string; which: 0 | 1; orig: PlannerItem }
  | { t: "move"; id: string; wx: number; wy: number; orig: PlannerItem };

const DND = "application/x-lq-planner";
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
/** Le cap qui met les `x` à droite et les `y` en bas de l'écran, en vue de dessus. */
const TOP_YAW = -45;

/** Ce qu'une entrée pose quand on la lâche sur le terrain sans la tracer. */
function dropped(entry: Entry, x: number, y: number): PlannerItem[] {
  if (entry.type === "place") return [createItem(entry.kind, x, y)];
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (entry.mode === "room") return commitDraft(draftWalls(entry.kind, "room", { x: cx - 5, y: cy - 4 }, { x: cx + 5, y: cy + 4 }));
  if (entry.mode === "parallel") return commitDraft(draftWalls(entry.kind, "parallel", { x: cx - 5, y: cy - 2 }, { x: cx + 5, y: cy + 2 }));
  return [createItem(entry.kind, x, y)];
}

/** La prise de vue d'une entrée de la palette : ce qu'elle pose, seul, en perspective. */
function entryJob(entry: Entry): SnapshotJob {
  const items = dropped(entry, 0, 0);
  const pts = items.map(footprintOf).flatMap(cornersOf);
  let x0 = Math.min(...pts.map((p) => p.x)) - 0.3;
  let x1 = Math.max(...pts.map((p) => p.x)) + 0.3;
  let y0 = Math.min(...pts.map((p) => p.y)) - 0.3;
  const y1 = Math.max(...pts.map((p) => p.y)) + 0.3;
  if (entry.kind === "dock") y0 -= 4.8;
  if (entry.kind === "tree" || entry.kind === "light") {
    x0 -= 0.6;
    x1 += 0.6;
  }
  const h = entry.kind === "light" ? 6 : entry.kind === "tree" ? 3.4 : entry.kind === "palletRack" ? 3.5 : entry.kind === "fence" || entry.kind === "conveyor" ? 1.6 : entry.type === "place" ? 2 : 3;
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
  defaultView = "top",
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

  const plot = useMemo(() => generatePlot(seed, { shape }), [seed, shape]);
  const jobs = useMemo(() => ENTRIES.map(entryJob), []);
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => Object.fromEntries(jobs.map((j) => [j.id, cachedSnapshot(j.id)]).filter(([, u]) => u)));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** L'outil en main : une entrée de la palette. */
  const [tool, setTool] = useState<Entry | null>(null);
  /** Le départ du tracé en cours, et le point sous le curseur. */
  const [start, setStart] = useState<P | null>(null);
  const [cursor, setCursor] = useState<P | null>(null);
  const [mode3d, setMode3d] = useState(defaultView === "3d");
  const [orbit, setOrbit] = useState({ yaw: 30, tilt: 40 });
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
    fitted.current = plot.seed;
    fit();
  }, [plot.seed, fit]);

  // --- La vue de dessus : une application affine entre le sol et l'écran ------------------------
  const scale = cellSize * view.zoom;
  const toScreen = (x: number, y: number) => ({ x: (x - view.cx) * scale + size.width / 2, y: (y - view.cy) * scale + size.height / 2 });
  const toWorld = (sx: number, sy: number) => ({ x: (sx - size.width / 2) / scale + view.cx, y: (sy - size.height / 2) / scale + view.cy });
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
  const draft: PlannerLinear[] = drawing && start && cursor ? draftWalls(drawing.kind, drawing.mode, start, cursor) : [];
  const draftOk = draft.every((w) => fitsPlot(w, plot));

  const pickTool = (entry: Entry | null) => {
    setTool(entry);
    setStart(null);
    setSelectedId(null);
    if (entry && mode3d) setMode3d(false);
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
    if (mode3d) {
      drag.current = e.button === 1 || e.shiftKey ? { t: "pan", sx: p.x, sy: p.y, cx: view.cx, cy: view.cy, moved: false } : { t: "orbit", sx: p.x, sy: p.y, yaw: orbit.yaw, tilt: orbit.tilt };
      return;
    }
    if (e.button === 1) {
      drag.current = { t: "pan", sx: p.x, sy: p.y, cx: view.cx, cy: view.cy, moved: false };
      return;
    }
    const w = toWorld(p.x, p.y);
    if (drawing) {
      drawClick(w);
      return;
    }
    if (tool?.type === "place") {
      place(tool, w.x, w.y);
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
      else drag.current = { t: "end", id, which: handle.dataset.handle === "end0" ? 0 : 1, orig: item };
      return;
    }
    const hit = hitTest(itemsRef.current, w);
    if (hit) {
      setSelectedId(hit.id);
      drag.current = { t: "move", id: hit.id, wx: w.x, wy: w.y, orig: hit };
      return;
    }
    drag.current = { t: "pan", sx: p.x, sy: p.y, cx: view.cx, cy: view.cy, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(e);
    const d = drag.current;
    if (!d) {
      if (mode3d) return;
      const w = toWorld(p.x, p.y);
      if (drawing) {
        const q = wallPoint(w, start, drawing.mode, itemsRef.current);
        if (!cursor || q.x !== cursor.x || q.y !== cursor.y) setCursor(q);
        return;
      }
      const id = hitTest(itemsRef.current, w)?.id ?? null;
      if (id !== hoverId) setHoverId(id);
      return;
    }
    if (d.t === "orbit") {
      setOrbit({ yaw: d.yaw + (p.x - d.sx) * 0.4, tilt: Math.max(12, Math.min(88, d.tilt + (p.y - d.sy) * 0.25)) });
      return;
    }
    if (d.t === "pan") {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) > 3) d.moved = true;
      if (mode3d) {
        // En perspective, l'écran est tourné du cap : on ramène le geste dans le repère du sol.
        const a = ((orbit.yaw - TOP_YAW) * Math.PI) / 180;
        const dx = (p.x - d.sx) / scale;
        const dy = (p.y - d.sy) / scale / Math.max(0.3, Math.sin((orbit.tilt * Math.PI) / 180));
        setView((v) => ({ ...v, cx: d.cx - (dx * Math.cos(a) + dy * Math.sin(a)), cy: d.cy - (-dx * Math.sin(a) + dy * Math.cos(a)) }));
      } else setView((v) => ({ ...v, cx: d.cx - (p.x - d.sx) / scale, cy: d.cy - (p.y - d.sy) / scale }));
      return;
    }
    const w = toWorld(p.x, p.y);
    if (d.t === "move") update(d.id, moveBy(d.orig, w.x - d.wx, w.y - d.wy));
    else if (isLinear(d.orig)) update(d.id, dragEnd(d.orig, d.which, w, e.altKey));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.t === "pan") {
      if (!d.moved && !mode3d) setSelectedId(null);
      return;
    }
    if (d.t === "orbit") return;
    const now = itemsRef.current.find((it) => it.id === d.id);
    if (now && !fitsPlot(now, plot)) {
      update(d.id, d.orig);
      flash("Hors du terrain constructible : l'élément revient à sa place.");
    }
  };

  // La molette zoome autour du pointeur. Écoutée à la main : React la rend passive.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      setView((v) => {
        const s0 = cellSize * v.zoom;
        const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * Math.exp(-e.deltaY * 0.0015)));
        if (mode3d) return { ...v, zoom };
        const s1 = cellSize * zoom;
        const wx = (sx - r.width / 2) / s0 + v.cx;
        const wy = (sy - r.height / 2) / s0 + v.cy;
        return { zoom, cx: wx - (sx - r.width / 2) / s1, cy: wy - (sy - r.height / 2) / s1 };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cellSize, mode3d]);

  const zoomBy = (k: number) => setView((v) => ({ ...v, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * k)) }));

  const selected = items.find((it) => it.id === selectedId) ?? null;
  const remove = () => {
    if (!selected) return;
    setItems(itemsRef.current.filter((it) => it.id !== selected.id));
    setSelectedId(null);
  };
  const turn = () => selected && update(selected.id, rotateQuarter(selected));
  const reverse = () => selected && update(selected.id, flip(selected));
  const swapDock = () => {
    if (selected && isLinear(selected) && (selected.kind === "wall" || selected.kind === "dock")) update(selected.id, { ...selected, kind: selected.kind === "wall" ? "dock" : "wall" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      if (start) setStart(null);
      else if (tool) setTool(null);
      else setSelectedId(null);
    } else if (e.key === "Delete" || e.key === "Backspace") remove();
    else if (e.key === "r" || e.key === "R") turn();
    else if (e.key === "f" || e.key === "F") reverse();
    else if (e.key === "+" || e.key === "=") zoomBy(1.25);
    else if (e.key === "-") zoomBy(0.8);
    else return;
    e.preventDefault();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(DND);
    const entry = ENTRIES.find((x) => x.id === id);
    if (!entry || mode3d) return;
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
    }
    return <g key={item.id}>{parts}</g>;
  };

  const shown = mode3d || drawing ? [] : items.filter((it) => it.id === selectedId || it.id === hoverId);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.kind, (m.get(it.kind) ?? 0) + 1);
    return m;
  }, [items]);
  const cur = cursor && drawing && !mode3d ? toScreen(cursor.x, cursor.y) : null;
  const anchor = start && drawing && !mode3d ? toScreen(start.x, start.y) : null;
  const hint = drawing
    ? start
      ? drawing.mode === "chain"
        ? "Cliquez pour poser et continuer — double-clic, clic droit ou Échap pour finir la chaîne."
        : "Cliquez une seconde fois pour arrêter le tracé — Échap pour l'annuler."
      : `${drawing.label} : cliquez le point de départ.`
    : tool
      ? `${tool.label} : cliquez où le poser (Maj pour en poser plusieurs).`
      : null;

  return (
    <div className={["lq-planner", className].filter(Boolean).join(" ")} style={{ height }}>
      <SnapshotStudio jobs={jobs} width={128} height={96} onShot={(id, url) => setThumbs((t) => ({ ...t, [id]: url }))} />
      <aside className="lq-planner__palette" aria-label="Palette d'éléments">
        <p className="lq-planner__intro">Choisissez un outil puis cliquez sur le terrain — un mur se trace d'un clic à l'autre. Les éléments se glissent aussi depuis la palette.</p>
        {GROUPS.map((group) => (
          <section key={group} className="lq-planner__group">
            <h3 className="lq-planner__group-title">{group}</h3>
            <div className="lq-planner__tools">
              {ENTRIES.filter((t) => t.group === group).map((entry) => {
                const url = thumbs[`planner-${entry.id}`];
                const shared = entry.type === "draw" && entry.kind === "wall";
                const n = shared ? (entry.id === "wall" ? counts.get("wall") : undefined) : counts.get(entry.kind);
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
                    title={entry.label}
                    aria-pressed={tool?.id === entry.id}
                  >
                    {url ? <img className="lq-planner__thumb" src={url} alt="" draggable={false} /> : <span className="lq-planner__thumb lq-planner__thumb--pending" aria-hidden />}
                    <span className="lq-planner__tool-label">{entry.label}</span>
                    {n ? <span className="lq-planner__tool-count">{n}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
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
          onKeyDown={onKeyDown}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DND)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={onDrop}
          aria-label="Plan de l'entrepôt"
        >
          <IsoCamera yaw={mode3d ? orbit.yaw : TOP_YAW} tilt={mode3d ? orbit.tilt : 90} zoom={1}>
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
                <PlannerItem3D key={it.id} item={it} />
              ))}
              {/* Le tracé en cours, déjà en volume : on voit le mur avant de le poser. */}
              {draft.map((w) => (
                <PlannerItem3D key={`${w.id}:${w.x0},${w.y0},${w.x1},${w.y1}`} item={w} />
              ))}
            </WarehouseScene>
          </IsoCamera>
          {!mode3d && (
            <svg className="lq-planner__overlay" width={size.width} height={size.height}>
              {shown.map((it) => overlay(it, it.id === selectedId))}
              {draft.map((w, i) => outline(w, ["lq-planner__outline", "lq-planner__outline--draft", !draftOk && "lq-planner__outline--invalid"].filter(Boolean).join(" "), `draft${i}`))}
              {draft.map((w, i) => dim(w, `dd${i}`))}
              {anchor && <circle className="lq-planner__anchor" cx={anchor.x} cy={anchor.y} r={5} />}
              {cur && (
                <g className="lq-planner__cursor" transform={`translate(${cur.x} ${cur.y})`}>
                  <rect x={-scale / 2} y={-scale / 2} width={scale} height={scale} />
                  <path d="M-8 0 H8 M0 -8 V8" />
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
                onClick={() => {
                  setMode3d(true);
                  setTool(null);
                  setStart(null);
                }}
              >
                3D
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
          </div>

          {selected && !mode3d && !drawing && (
            <div className="lq-planner__inspector" onPointerDown={(e) => e.stopPropagation()}>
              <strong>{PLANNER_LABEL[selected.kind]}</strong>
              {isLinear(selected) ? (
                <span>{(Math.hypot(selected.x1 - selected.x0, selected.y1 - selected.y0) * 2).toFixed(0)} m</span>
              ) : (
                <span>
                  {(POINT_SIZE[selected.kind].length * 2).toFixed(1)} × {(POINT_SIZE[selected.kind].width * 2).toFixed(1)} m
                </span>
              )}
              <button type="button" onClick={turn} title="Tourner d'un quart de tour (R)">
                <RefreshIcon size={13} /> Tourner
              </button>
              {isLinear(selected) && (
                <button type="button" onClick={reverse} title="Retourner (F)">
                  ⇅ Retourner
                </button>
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

          {hint && !mode3d && <div className="lq-planner__hint">{hint}</div>}
          {mode3d && <div className="lq-planner__hint">Tirez pour tourner autour, Maj + tirer pour vous déplacer, molette pour zoomer. Revenez à « Dessus » pour construire.</div>}
          {message && <div className="lq-planner__toast">{message}</div>}
          {items.length === 0 && !tool && !mode3d && <div className="lq-planner__empty">Choisissez « Mur » ou « Pièce » dans la palette, puis cliquez le point de départ sur le terrain pointillé.</div>}
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
