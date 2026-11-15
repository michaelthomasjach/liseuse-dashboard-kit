import "./ChartMenuTargetHighlight.css";
export interface ChartMenuTargetHighlightProps {
  /** Le panneau visé, en pixels dans la racine positionnée du graphique (marges comprises). */
  rect: { left: number; top: number; width: number; height: number };
  /** La courbe visée, en coordonnées du tracé (sans les marges), ou null : seul le panneau est entouré. */
  path: string | null;
  color?: string;
}

/** Ce que vise l'entrée survolée du menu contextuel : une bordure et un léger voile autour du panneau, et la courbe
 *  visée repassée plus épaisse. Rien d'interactif : le pointeur traverse. */
export function ChartMenuTargetHighlight({ rect, path, color }: ChartMenuTargetHighlightProps) {
  return (
    <div className="lq-chart__menu-target" aria-hidden="true" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      {path !== null && (
        <svg className="lq-chart__menu-target-line" width={rect.width} height={rect.height}>
          <path d={path} style={color ? { stroke: color } : undefined} />
        </svg>
      )}
    </div>
  );
}
