import { useState, type ReactNode } from "react";
import { IsoCamera } from "../src/components/warehouse/isoCamera";
import { RotationGizmo } from "../src/components/warehouse/RotationGizmo";

const KEY = "lq-warehouse-yaw";

function read(): number {
  try {
    const v = Number(window.sessionStorage.getItem(KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Autour de chaque exemple d'entrepôt : un gizmo pour faire le tour de la scène.
 *
 * C'est la caméra qui tourne (`IsoCamera`), pas les objets, donc une scène composée tourne d'un seul
 * bloc sans qu'aucune story ait à le savoir. L'angle survit au changement de story le temps de la
 * session : on compare deux exemples sous le même angle.
 *
 * Sur une story seule, le gizmo est `docked` : fixé en haut à droite de l'écran. Une page Docs empile
 * toutes les stories d'un fichier, chacune avec sa caméra ; là, chaque gizmo se pose au-dessus de sa
 * scène au lieu de s'empiler au même coin.
 */
export function WarehouseStage({ children, docked = true }: { children: ReactNode; docked?: boolean }) {
  const [yaw, setYaw] = useState(read);
  const change = (deg: number) => {
    setYaw(deg);
    try {
      window.sessionStorage.setItem(KEY, String(deg));
    } catch {
      // Sans stockage, l'angle vaut pour cette story seulement.
    }
  };
  return (
    <IsoCamera yaw={yaw}>
      <div style={docked ? { position: "fixed", top: 12, right: 12, zIndex: 10 } : { display: "flex", justifyContent: "flex-end" }}>
        <RotationGizmo value={yaw} onChange={change} />
      </div>
      {children}
    </IsoCamera>
  );
}
