import { createContext, useContext, useMemo, type ReactNode } from "react";
import { projectIso } from "./warehouseIso";
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
 * À `yaw = 0`, tout vaut exactement ce que le kit faisait avant : la caméra par défaut n'a pas changé.
 */

export interface IsoCameraView {
  /** Le cap, en degrés. */
  yaw: number;
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

/** La caméra à un cap donné. */
export function isoCamera(yaw = 0): IsoCameraView {
  const t = (-yaw * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Une direction de l'image ramenée dans le monde : tournée de −yaw.
  const back = (p: Point): Point => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  const view = back({ x: 1, y: 1 });
  return {
    yaw,
    project: (x, y, z = 0) => projectIso(x, y, z, yaw),
    facing: (rotation = 0) => isoFacing(rotation + yaw),
    view,
    depth: (x, y) => x * view.x + y * view.y,
    order: (boxes) => paintOrder(boxes, view),
    sun: back(SUN_CAST),
  };
}

const IsoCameraContext = createContext(0);

/** Tourne la caméra de toutes les pièces isométriques qu'il contient. */
export function IsoCamera({ yaw, children }: { yaw: number; children: ReactNode }) {
  return <IsoCameraContext.Provider value={((yaw % 360) + 360) % 360}>{children}</IsoCameraContext.Provider>;
}

/** La caméra de l'`IsoCamera` qui entoure le composant — la caméra par défaut s'il n'y en a pas. */
export function useIsoCamera(): IsoCameraView {
  const yaw = useContext(IsoCameraContext);
  return useMemo(() => isoCamera(yaw), [yaw]);
}
