import { useIsoCamera } from "./isoCamera";
import { RACK_ITEM_LABEL, fitRackItem, rackItemIso, rackItemPlan, type Project, type RackItemKind } from "./rackItems";
import "./rackItems.css";

/** Un élément seul, dans l'une ou l'autre vue — pour un catalogue, une légende, une palette.
 *
 *  Le dessin lui-même est celui de `rackItems.tsx`, le même que l'étagère utilise : une sorte est
 *  décrite une fois et vue de deux caméras, donc un bidon posé sur une étagère et le bidon d'une
 *  légende ne peuvent pas diverger. */
export interface RackItemProps {
  kind: RackItemKind;
  /** `"iso"` pour la vue isométrique, `"plan"` pour la vue de dessus. */
  view?: "iso" | "plan";
  /** Côté de la portion sur laquelle l'élément est posé, en cases. */
  slot?: number;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

/** Un élément seul, dans l'une ou l'autre vue — pour un catalogue, une légende, une palette. */
export function RackItem({ kind, view = "iso", slot = 2, cellSize = 40, className }: RackItemProps) {
  const cam = useIsoCamera();
  const fit = fitRackItem(kind, { x: 0, y: 0, width: slot, depth: slot }, 0, Infinity);
  const pad = 3;

  if (view === "plan") {
    const size = slot * cellSize;
    return (
      <svg
        className={["lq-rack-item", className].filter(Boolean).join(" ")}
        width={size + pad * 2}
        height={size + pad * 2}
        viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
        role="img"
        aria-label={RACK_ITEM_LABEL[kind]}
      >
        {rackItemPlan(kind, fit, cellSize, kind)}
      </svg>
    );
  }

  const at: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  // Le cadre est celui de la *portion*, pas celui de l'objet — comme en vue de dessus. Cadrer
  // chaque objet sur lui-même les ramenait tous à la même taille apparente : une bouteille sortait
  // presque aussi large qu'un carton, alors que c'est justement leur rapport de taille qu'un
  // catalogue est là pour montrer. Seule la hauteur suit l'objet, faute de quoi une bouteille
  // laisserait un vide au-dessus d'un carton.
  const corners = [
    at(0, 0, 0),
    at(slot, 0, 0),
    at(slot, slot, 0),
    at(0, slot, 0),
    // Le haut de l'objet aux quatre coins : sous une caméra tournée, les extrêmes changent de coin.
    at(fit.cx - fit.half, fit.cy - fit.half, fit.height),
    at(fit.cx + fit.half, fit.cy - fit.half, fit.height),
    at(fit.cx + fit.half, fit.cy + fit.half, fit.height),
    at(fit.cx - fit.half, fit.cy + fit.half, fit.height),
  ];
  const minX = Math.min(...corners.map((p) => p.x)) - pad;
  const minY = Math.min(...corners.map((p) => p.y)) - pad;
  const width = Math.max(...corners.map((p) => p.x)) + pad - minX;
  const height = Math.max(...corners.map((p) => p.y)) + pad - minY;

  return (
    <svg
      className={["lq-rack-item", className].filter(Boolean).join(" ")}
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      role="img"
      aria-label={RACK_ITEM_LABEL[kind]}
    >
      {rackItemIso(kind, fit, at, cam.facing(0), kind)}
    </svg>
  );
}
