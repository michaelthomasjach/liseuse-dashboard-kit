import { IsoCanvas } from "./isoCanvas";
import { Builder } from "./three/builder";
import { Parts, Solo, useBuilt } from "./three/scene";
import { addGood } from "./three/goods";
import { RACK_ITEM_LABEL, fitRackItem, rackItemPlan, type RackItemKind } from "./rackItems";
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
  const fit = fitRackItem(kind, { x: 0, y: 0, width: slot, depth: slot }, 0, Infinity);
  const pad = 3;

  if (view === "plan") {
    const size = slot * cellSize;
    return (
      <IsoCanvas
        className={["lq-rack-item", className].filter(Boolean).join(" ")}
        width={size + pad * 2}
        height={size + pad * 2}
        viewBox={[-pad, -pad, size + pad * 2, size + pad * 2]}
        ariaLabel={RACK_ITEM_LABEL[kind]}
      >
        {rackItemPlan(kind, fit, cellSize, kind)}
      </IsoCanvas>
    );
  }

  // En perspective, une marchandise seule est un petit volume dans sa propre scène 3D.
  return (
    <Solo bounds={{ x0: 0, x1: slot, y0: 0, y1: slot, z0: 0, z1: fit.height }} cellSize={cellSize} className={["lq-rack-item", className].filter(Boolean).join(" ")} ariaLabel={RACK_ITEM_LABEL[kind]}>
      <RackItemBody kind={kind} slot={slot} />
    </Solo>
  );
}

function RackItemBody({ kind, slot }: { kind: RackItemKind; slot: number }) {
  const built = useBuilt(() => {
    const b = new Builder();
    const fit = fitRackItem(kind, { x: 0, y: 0, width: slot, depth: slot }, 0, Infinity);
    addGood(b, kind, fit.cx, fit.cy, fit.z, fit.half, fit.height);
    return b.build();
  }, [kind, slot]);
  return <Parts built={built} />;
}
