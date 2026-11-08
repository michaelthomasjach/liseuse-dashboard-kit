import type { ChartWorkspaceGridLayout } from "./gridLayouts";

export interface GridLayoutIconProps {
  layout: ChartWorkspaceGridLayout;
  /** Taille en px. Le rectangle n'est pas carré : un écran est plus large que haut, et les
   *  dispositions en colonnes se lisent mieux dans un cadre qui leur laisse de la largeur. */
  width?: number;
  height?: number;
}

/** Le dessin d'une disposition : un rectangle découpé par des traits, une case par fenêtre.
 *
 *  Calculé depuis la définition même de la disposition (`areas`, voir `gridLayouts.ts`), comme la
 *  grille CSS : l'icône ne peut pas montrer autre chose que ce que la grille fera. Chaque fenêtre est
 *  un `<rect>` au trait ; deux fenêtres voisines tracent leur bord commun au même endroit, au pixel
 *  près (mêmes arrondis), donc un seul trait. Les coordonnées tombent sur des demi-pixels pour que
 *  les traits d'un pixel restent nets. */
export function GridLayoutIcon({ layout, width = 28, height = 20 }: GridLayoutIconProps) {
  const x = (column: number) => 0.5 + Math.round((column / layout.columns) * (width - 1));
  const y = (row: number) => 0.5 + Math.round((row / layout.rows) * (height - 1));
  return (
    <svg
      className="lq-chart-workspace__layout-icon"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {layout.areas.map((area, i) => {
        const left = x(area.column - 1);
        const top = y(area.row - 1);
        return (
          <rect
            key={i}
            x={left}
            y={top}
            width={x(area.column - 1 + area.columnSpan) - left}
            height={y(area.row - 1 + area.rowSpan) - top}
          />
        );
      })}
    </svg>
  );
}
