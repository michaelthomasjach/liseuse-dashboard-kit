import { useMemo, useRef, type ReactNode } from "react";
import { Builder, type P3 } from "./three/builder";
import { rng } from "./three/random";
import { Parts, Solo, WarehouseScene, frameBounds, useBuilt } from "./three/scene";
import { useSimClock } from "./three/time";
import { Road } from "./Road";
import { Buildings } from "./Building";
import { Trees } from "./Tree";
import { Fence } from "./Fence";
import { StreetLight } from "./StreetLight";
import { Car } from "./Car";
import { ForSaleSign } from "./ForSaleSign";
import { generatePlot, lockedFences, plotInside, plotOutline, trafficCars, type PlotCar, type PlotLayout, type PlotRect, type PlotShape } from "./plot";

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
function buildGround(plot: PlotLayout, grid: boolean, style: PlotGroundStyle = "site") {
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
  addGroundDetail(b, plot, clean);
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

function BuildPlotBody({ layout, traffic = true, grid = true, night = 0, groundStyle = "site", lightExclusions, treeExclusions, children }: BuildPlotProps) {
  const plot = layout as PlotLayout;
  const ground = useBuilt(() => buildGround(plot, grid, groundStyle), [plot, grid, groundStyle]);
  // Les candélabres et les arbres qu'une manœuvre accrocherait ne sont pas plantés.
  const lightKey = JSON.stringify(lightExclusions ?? []);
  const treeKey = JSON.stringify(treeExclusions ?? []);
  const lights = useMemo(() => plot.lights.filter((l) => !inRects(lightExclusions, l.x, l.y)), [plot, lightKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const trees = useMemo(() => plot.trees.filter((t) => !inRects(treeExclusions, t.x, t.y)), [plot, treeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Les parcelles à vendre : closes du côté de ce qu'on possède, et leur panneau.
  const lockFences = useMemo(() => lockedFences(plot), [plot]);
  const cars = useMemo(() => (traffic === false ? [] : traffic === true ? plot.cars : trafficCars(plot, traffic)), [plot, traffic]);
  return (
    <>
      <Parts built={ground} />
      {plot.roads.map((t, i) => (
        <Road key={`r${i}`} {...t} />
      ))}
      <Buildings buildings={plot.neighbors} />
      <Trees trees={trees} />
      {lights.map((l) => (
        <StreetLight key={`l${l.x},${l.y}`} kind="street" origin={{ x: l.x, y: l.y }} rotation={l.rotation} glow={night} />
      ))}
      {plot.fences.map((f, i) => {
        const L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
        const mx = (f.x0 + f.x1) / 2;
        const my = (f.y0 + f.y1) / 2;
        const rot = (Math.atan2(f.y1 - f.y0, f.x1 - f.x0) * 180) / Math.PI;
        return <Fence key={`f${i}`} kind="mesh" length={L} origin={{ x: mx - L / 2, y: my }} rotation={rot} />;
      })}
      {lockFences.map((f, i) => {
        const L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
        const mx = (f.x0 + f.x1) / 2;
        const my = (f.y0 + f.y1) / 2;
        const rot = (Math.atan2(f.y1 - f.y0, f.x1 - f.x0) * 180) / Math.PI;
        return <Fence key={`lf${i}`} kind="mesh" length={L} origin={{ x: mx - L / 2, y: my }} rotation={rot} />;
      })}
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
export function PlotScene({ seed = 1, shape, layout, cellSize = 10, traffic, grid, night, groundStyle, lightExclusions, treeExclusions, className, children }: BuildPlotProps) {
  const plot = useMemo(() => layout ?? generatePlot(seed, { shape }), [layout, seed, shape]);
  return (
    <WarehouseScene bounds={frameBounds(plot.frame)} cellSize={cellSize} className={className} ariaLabel="Terrain à bâtir">
      <BuildPlotBody layout={plot} traffic={traffic} grid={grid} night={night} groundStyle={groundStyle} lightExclusions={lightExclusions} treeExclusions={treeExclusions}>
        {children}
      </BuildPlotBody>
    </WarehouseScene>
  );
}
