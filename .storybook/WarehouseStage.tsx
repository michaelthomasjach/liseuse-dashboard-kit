import { useState, type ReactNode } from "react";
import { IsoCamera } from "../src/components/warehouse/isoCamera";
import { RotationGizmo, useDragRotation } from "../src/components/warehouse/RotationGizmo";

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
 *
 * On tourne aussi **en tirant dans la scène au clic molette**, partout sur l'exemple : c'est le même
 * angle, et le cadran suit.
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
  const drag = useDragRotation(yaw, change);
  return (
    <IsoCamera yaw={yaw}>
      {/* La surface qui prend le glisser au bouton du milieu, et qui **centre la scène**.

          Une scène tournée n'occupe pas la même place à l'écran qu'à plat — un magasin vu dans l'axe
          de ses rangées est deux fois moins large que vu de trois quarts — donc son conteneur change
          de taille en tournant. Calé en haut à gauche, il grandit et rétrécit vers la droite et vers
          le bas, et la scène semble glisser alors qu'elle tourne sur elle-même. Centré, il grandit
          des deux côtés à la fois : ce qu'on regarde reste où on le regarde.

          Sur une story seule, la surface occupe toute la hauteur visible — moins les marges du
          décorateur — pour qu'on puisse aussi tirer à côté de la scène ; sur une page Docs, elle
          s'en tient à la hauteur de sa story. */}
      <div
        {...drag}
        style={{
          touchAction: "none",
          minHeight: docked ? "calc(100vh - 64px)" : undefined,
          display: "flex",
          flexDirection: "column",
          // `safe` : un contenu plus haut que la zone — une story d'atelier et ses réglages — se
          // cale en haut au lieu d'être centré, faute de quoi il déborderait par le haut, là où
          // rien ne permet d'aller le rechercher.
          alignItems: "safe center",
          justifyContent: "safe center",
        }}
      >
        <div style={docked ? { position: "fixed", top: 12, right: 12, zIndex: 10 } : { alignSelf: "stretch", display: "flex", justifyContent: "flex-end" }}>
          <RotationGizmo value={yaw} onChange={change} />
        </div>
        {children}
      </div>
    </IsoCamera>
  );
}
