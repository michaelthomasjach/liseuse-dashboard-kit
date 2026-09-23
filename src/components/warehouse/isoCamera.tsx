import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ISO_TILT, ISO_TILT_MAX, ISO_TILT_MIN, projectIso } from "./warehouseIso";
import { paintOrder, type PaintBox } from "./warehousePaint";
import { SUN_CAST, isoFacing, type IsoFacing, type Point } from "./rackItems";

/**
 * La caméra isométrique, et son **cap** : l'angle dont elle a tourné autour de la verticale.
 *
 * ## Tourner la caméra, pas les objets
 *
 * Chaque pièce a déjà sa `rotation`, mais elle tourne autour de son propre centre : faire pivoter une
 * scène entière en tournant chaque pièce demanderait de recalculer toutes les positions, et chaque
 * story compose sa scène à sa façon. Tourner la **caméra** fait tourner tout le monde d'un coup, sans
 * qu'aucune scène ait à le savoir. C'est aussi ce qu'on attend d'un gizmo : on fait le tour de la
 * scène, la scène ne bouge pas.
 *
 * Tourner la caméra de `yaw` degrés revient à tourner le sol d'autant avant de le projeter. Tout ce
 * qui dépendait de la caméra en découle, et c'est ce que ce module rassemble :
 *
 * - la **projection** (`project`) : le sol tourné, puis la projection habituelle ;
 * - les **faces visibles** (`facing`) : une pièce tournée de `r` sous une caméra tournée de `yaw` se
 *   voit comme une pièce tournée de `r + yaw` sous la caméra par défaut — `isoFacing` sait déjà
 *   répondre à ça ;
 * - l'**ordre de peinture** (`order`) : la caméra ne regarde plus depuis le coin `+x, +y` mais depuis
 *   la direction `view`, et c'est elle qui dit laquelle de deux boîtes est devant ;
 * - la **profondeur** d'un point (`depth`), pour ceux qui trient eux-mêmes ;
 * - le **soleil** (`sun`) : il **suit la caméra**. L'éclairage des faces est attaché à l'image — la
 *   face de gauche est à demi-éclairée, quelle qu'elle soit — et une ombre portée qui resterait fixe
 *   dans le monde tomberait, au bout d'un demi-tour, du côté éclairé des objets qui la portent.
 *
 * Le **site** (`tilt`) est l'autre réglage : de combien la caméra est au-dessus du sol. Il ne change
 * ni les faces visibles, ni l'ordre de peinture, ni l'ombre — tout cela se lit sur le cap — il ne
 * change que l'écrasement du sol et l'allongement des hauteurs, donc il tient entier dans la
 * projection. C'est pour cette raison qu'il coûte si peu : une scène se redessine sous un autre
 * site sans qu'une seule pièce ait à le savoir.
 *
 * À `yaw = 0` et au site par défaut, tout vaut exactement ce que le kit faisait avant : la caméra
 * par défaut n'a pas changé.
 */

export interface IsoCameraView {
  /** Le cap, en degrés. */
  yaw: number;
  /** Le site : de combien la caméra est au-dessus du sol, en degrés. */
  tilt: number;
  /** Un point du sol (et une hauteur), en pixels, vers l'écran. */
  project: (x: number, y: number, z?: number) => Point;
  /** Les faces qu'on voit d'une pièce tournée de `rotation` degrés sur le sol. */
  facing: (rotation?: number) => IsoFacing;
  /** D'où regarde la caméra, en direction du sol : `(1, 1)` à cap nul. */
  view: Point;
  /** La profondeur d'un point du sol : plus elle est grande, plus il est proche. */
  depth: (x: number, y: number) => number;
  /** Les boîtes au sol, de la plus lointaine à la plus proche. */
  order: <T extends PaintBox>(boxes: T[]) => T[];
  /** D'où vient la lumière, pour une hauteur d'une case — `SUN_CAST` tourné avec la caméra. */
  sun: Point;
}

/** La caméra à un cap et un site donnés. */
export function isoCamera(yaw = 0, tilt = ISO_TILT): IsoCameraView {
  const t = (-yaw * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Une direction de l'image ramenée dans le monde : tournée de −yaw.
  const back = (p: Point): Point => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  const view = back({ x: 1, y: 1 });
  return {
    yaw,
    tilt,
    project: (x, y, z = 0) => projectIso(x, y, z, yaw, tilt),
    facing: (rotation = 0) => isoFacing(rotation + yaw),
    view,
    depth: (x, y) => x * view.x + y * view.y,
    order: (boxes) => paintOrder(boxes, view),
    sun: back(SUN_CAST),
  };
}

const IsoCameraContext = createContext<{ yaw: number; tilt: number }>({ yaw: 0, tilt: ISO_TILT });

/** Le site, ramené entre ses bornes : de 0°, dans le plan du sol, à 90°, à la verticale. */
export const clampTilt = (deg: number) => Math.min(ISO_TILT_MAX, Math.max(ISO_TILT_MIN, deg));

/** Oriente la caméra de toutes les pièces isométriques qu'il contient : son cap, et son site. */
export function IsoCamera({ yaw, tilt = ISO_TILT, children }: { yaw: number; tilt?: number; children: ReactNode }) {
  const view = useMemo(() => ({ yaw: ((yaw % 360) + 360) % 360, tilt: clampTilt(tilt) }), [yaw, tilt]);
  return <IsoCameraContext.Provider value={view}>{children}</IsoCameraContext.Provider>;
}

/** La caméra de l'`IsoCamera` qui entoure le composant — la caméra par défaut s'il n'y en a pas. */
export function useIsoCamera(): IsoCameraView {
  const { yaw, tilt } = useContext(IsoCameraContext);
  return useMemo(() => isoCamera(yaw, tilt), [yaw, tilt]);
}
