import { useMemo, type ReactNode } from "react";
import { Builder } from "./three/builder";
import { Parts, Solo, WarehouseScene, frameBounds, useBuilt } from "./three/scene";
import { Road } from "./Road";
import { Buildings } from "./Building";
import { Trees } from "./Tree";
import { Fence } from "./Fence";
import { StreetLight } from "./StreetLight";
import { Car } from "./Car";
import { generatePlot, plotInside, plotOutline, type PlotLayout, type PlotShape } from "./plot";

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
  /** La circulation sur la rue. */
  traffic?: boolean;
  /** La grille de points et le pointillé du terrain. */
  grid?: boolean;
  cellSize?: number;
  className?: string;
  children?: ReactNode;
}

/** Le sol du terrain, sa grille de points et son pointillé, en un maillage. */
function buildGround(plot: PlotLayout, grid: boolean) {
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
      b.box("pavement", x, x1, y, y + 1, -0.1, 0.004, false);
      x = x1;
    }
  }
  // La bande entre le terrain et la rue : de l'herbe, déjà posée.
  if (!grid) return b.build();
  // Les points de la grille, à chaque croisement intérieur.
  for (let x = 1; x < plot.width; x += 1)
    for (let y = 1; y < plot.depth; y += 1) {
      if (!(plotInside(plot, x - 1, y - 1) && plotInside(plot, x, y) && plotInside(plot, x - 1, y) && plotInside(plot, x, y - 1))) continue;
      b.faceZ("lq-plot__dot", 0.006, x - 0.05, x + 0.05, y - 0.05, y + 0.05);
    }
  // Le pointillé : un tiret par arête de case, centré.
  for (const [x0, y0, x1, y1] of plotOutline(plot)) {
    const h = 0.07;
    if (y0 === y1) b.faceZ("lq-plot__edge", 0.007, x0 + 0.2, x1 - 0.2, y0 - h, y0 + h);
    else b.faceZ("lq-plot__edge", 0.007, x0 - h, x0 + h, y0 + 0.2, y1 - 0.2);
  }
  return b.build();
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

function BuildPlotBody({ layout, traffic = true, grid = true, children }: BuildPlotProps) {
  const plot = layout as PlotLayout;
  const ground = useBuilt(() => buildGround(plot, grid), [plot, grid]);
  return (
    <>
      <Parts built={ground} />
      {plot.roads.map((t, i) => (
        <Road key={`r${i}`} {...t} />
      ))}
      <Buildings buildings={plot.neighbors} />
      <Trees trees={plot.trees} />
      {plot.lights.map((l, i) => (
        <StreetLight key={`l${i}`} kind="street" origin={{ x: l.x, y: l.y }} rotation={l.rotation} />
      ))}
      {plot.fences.map((f, i) => {
        const L = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
        const mx = (f.x0 + f.x1) / 2;
        const my = (f.y0 + f.y1) / 2;
        const rot = (Math.atan2(f.y1 - f.y0, f.x1 - f.x0) * 180) / Math.PI;
        return <Fence key={`f${i}`} kind="mesh" length={L} origin={{ x: mx - L / 2, y: my }} rotation={rot} />;
      })}
      {traffic &&
        plot.cars.map((c, i) => (
          <Car key={`c${i}`} kind={c.kind} tone={c.tone} follow={{ route: c.reverse ? plot.lanes.backward : plot.lanes.forward, closed: true, speed: c.speed, phase: c.phase }} />
        ))}
      {children}
    </>
  );
}

/** Une scène toute prête : le terrain et son décor, et ce qu'on y pose. */
export function PlotScene({ seed = 1, shape, layout, cellSize = 10, traffic, grid, className, children }: BuildPlotProps) {
  const plot = useMemo(() => layout ?? generatePlot(seed, { shape }), [layout, seed, shape]);
  return (
    <WarehouseScene bounds={frameBounds(plot.frame)} cellSize={cellSize} className={className} ariaLabel="Terrain à bâtir">
      <BuildPlotBody layout={plot} traffic={traffic} grid={grid}>
        {children}
      </BuildPlotBody>
    </WarehouseScene>
  );
}
