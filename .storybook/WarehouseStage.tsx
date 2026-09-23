import { useCallback, useRef, useState, type ReactNode } from "react";
import { IsoCamera, clampTilt } from "../src/components/warehouse/isoCamera";
import { ISO_TILT } from "../src/components/warehouse/warehouseIso";
import { RotationGizmo, useDragOrbit } from "../src/components/warehouse/RotationGizmo";
import { ZoomGizmo, useWheelZoom, clampZoom } from "../src/components/warehouse/ZoomGizmo";

const KEY = "lq-warehouse-yaw";
const TILT_KEY = "lq-warehouse-tilt";
const ZOOM_KEY = "lq-warehouse-zoom";

function read(key: string, fallback: number): number {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: number) {
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch {
    // Sans stockage, le réglage vaut pour cette story seulement.
  }
}

/**
 * Autour de chaque exemple d'entrepôt : un gizmo pour faire le tour de la scène, et deux loupes pour
 * s'en approcher.
 *
 * C'est la caméra qui tourne (`IsoCamera`), pas les objets, donc une scène composée tourne d'un seul
 * bloc sans qu'aucune story ait à le savoir. L'angle et le grossissement survivent au changement de
 * story le temps de la session : on compare deux exemples sous le même angle, à la même échelle.
 *
 * Sur une story seule, les commandes sont `docked` : fixées en haut à droite de l'écran. Une page
 * Docs empile toutes les stories d'un fichier, chacune avec sa caméra ; là, chaque jeu de commandes
 * se pose au-dessus de sa scène au lieu de s'empiler au même coin.
 *
 * On tourne aussi **en tirant dans la scène au clic molette**, partout sur l'exemple, et on
 * grossit **à la molette** : c'est le même angle et le même grossissement, et les cadrans suivent.
 * Le même glisser, **de haut en bas**, change le site de la caméra — de combien elle est au-dessus
 * du sol, entre 20 et 50°. Les deux axes d'un glisser font les deux angles d'une orbite, et une
 * caméra sans perspective n'a rien d'autre à régler.
 */
export function WarehouseStage({ children, docked = true }: { children: ReactNode; docked?: boolean }) {
  const [yaw, setYaw] = useState(() => read(KEY, 0));
  const [tilt, setTilt] = useState(() => clampTilt(read(TILT_KEY, ISO_TILT)));
  const [zoom, setZoom] = useState(() => clampZoom(read(ZOOM_KEY, 1)));
  const surface = useRef<HTMLDivElement>(null);

  const change = (deg: number) => {
    setYaw(deg);
    remember(KEY, deg);
  };
  const tiltTo = (deg: number) => {
    const value = clampTilt(deg);
    setTilt(value);
    remember(TILT_KEY, value);
  };
  // Stable, donc l'écouteur de molette est posé une fois et non à chaque rendu — et il reçoit une
  // fonction de mise à jour plutôt qu'une valeur, parce qu'un cran de molette part toujours du
  // grossissement courant et non de celui capturé au montage.
  const zoomTo = useCallback((next: (current: number) => number) => {
    setZoom((current) => {
      const value = clampZoom(next(current));
      remember(ZOOM_KEY, value);
      return value;
    });
  }, []);
  const drag = useDragOrbit({ yaw, onYaw: change, tilt, onTilt: tiltTo });
  useWheelZoom(surface, zoomTo);

  return (
    <IsoCamera yaw={yaw} tilt={tilt}>
      {/* La surface qui prend le glisser au bouton du milieu et la molette, et qui **centre la
          scène**.

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
        ref={surface}
        style={{
          touchAction: "none",
          minHeight: docked ? "calc(100vh - 64px)" : undefined,
          display: "flex",
          flexDirection: "column",
          // `safe` : un contenu plus haut que la zone — une story d'atelier et ses réglages, ou une
          // scène grossie — se cale en haut au lieu d'être centré, faute de quoi il déborderait par
          // le haut, là où rien ne permet d'aller le rechercher.
          alignItems: "safe center",
          justifyContent: "safe center",
        }}
      >
        <div
          style={
            docked
              ? { position: "fixed", top: 12, right: 12, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }
              : { alignSelf: "stretch", display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: 8 }
          }
        >
          <RotationGizmo value={yaw} onChange={change} tilt={tilt} />
          <ZoomGizmo value={zoom} onChange={(z) => zoomTo(() => z)} />
        </div>
        {/* Le grossissement porte ici, et non sur la surface : les commandes sont à l'intérieur de
            celle-ci et ne doivent pas grossir avec la scène qu'elles règlent. */}
        <div style={{ zoom }}>{children}</div>
      </div>
    </IsoCamera>
  );
}
