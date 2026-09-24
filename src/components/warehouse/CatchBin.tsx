import { Matrix4 } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { addGood } from "./three/goods";
import "./rackItems.css";
import "./CatchBin.css";

/**
 * Bac récupérateur — une caisse ouverte, et ce qui tombe dedans en vrac.
 *
 * C'est le bout d'une ligne : ce qui n'est pas rangé y arrive par le haut et s'y entasse sans
 * ordre. L'objet est donc l'inverse d'une zone de stockage — là-bas tout est aligné parce que tout
 * a été posé, ici rien ne l'est parce que rien ne l'a été.
 *
 * ## Pourquoi on voit dedans
 *
 * Les quatre parois sont dessinées comme quatre volumes ordinaires, et le tri par profondeur fait
 * le reste : les deux parois lointaines passent avant le contenu, les deux proches après. Il n'y a
 * pas de « face intérieure » à dessiner à part — une paroi mince montre celle de ses deux faces qui
 * regarde la caméra, et pour une paroi lointaine c'est justement l'intérieure. Le même calcul de
 * faces visibles qui sert à tout le reste du kit donne donc une caisse ouverte sans qu'on ait à le
 * lui demander.
 *
 * ## Le vrac
 *
 * Les colis sont posés par un tirage **déterministe** : un générateur à graine, et non
 * `Math.random`. Un dessin qui change à chaque rendu n'est pas un dessin, c'est une animation
 * involontaire, et il rend toute comparaison d'images impossible. `seed` donne donc un vrac stable,
 * et en changer donne un autre vrac, tout aussi stable.
 *
 * Chaque colis a sa taille, son cap et sa place. Le cap se fait en tournant le **projecteur** autour
 * du colis plutôt qu'en tournant la boîte, comme partout ailleurs ici : c'est ce qui permet de
 * dessiner une boîte de travers avec le code qui n'en sait dessiner que des droites. Les couches se
 * tassent d'un peu moins que la hauteur d'un colis, parce qu'un tas n'est pas un empilement.
 */

export interface CatchBinProps {
  /** Longueur du bac, en cases. */
  width?: number;
  /** Profondeur du bac, en cases. */
  depth?: number;
  /** Hauteur des parois, en cases. */
  height?: number;
  /** Épaisseur d'une paroi, en cases. */
  wall?: number;
  /** Nombre de colis dans le bac. */
  count?: number;
  /** Côté d'un colis, en cases. */
  itemSize?: number;
  /** La graine du vrac. La changer rebrasse le tas ; la garder le fige. */
  seed?: number;
  /** Rotation du bac sur le sol, en degrés. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le bac sur le sol, en cases. Sert à le composer avec d'autres modules — le bout d'un
   *  tapis — dans une même scène. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le bac seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}


/** Ce qu'une couche gagne en hauteur, en fraction d'un colis. Moins d'un colis entier : un tas se
 *  tasse, les colis se calent les uns dans les autres, et une pile parfaite ne serait plus du vrac. */
const LAYER_RISE = 0.72;


/** Un générateur à graine. Le tirage doit être le même à chaque rendu : un dessin qui change tout
 *  seul n'est pas un dessin. */
function sequence(seed: number) {
  let state = (Math.floor(seed) || 1) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function CatchBin(props: CatchBinProps) {
  const { width = 3, depth = 2.4, height = 1.1, count = 9, itemSize = 0.7, rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 40, className } = props;
  if (parts === "shadow") return null;
  const spanX = Math.max(0.6, width);
  const spanY = Math.max(0.6, depth);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: Math.max(height, itemSize * 2) });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-bin", className].filter(Boolean).join(" ")} ariaLabel={`Bac récupérateur, ${Math.max(0, Math.floor(count))} colis`}>
      <CatchBinBody {...props} />
    </Solo>
  );
}

function CatchBinBody({ width = 3, depth = 2.4, height = 1.1, wall = 0.12, count = 9, itemSize = 0.7, seed = 7, rotation = 0, origin = { x: 0, y: 0 } }: CatchBinProps) {
  const spanX = Math.max(0.6, width);
  const spanY = Math.max(0.6, depth);
  const wallThick = Math.max(0.03, Math.min(wall, Math.min(spanX, spanY) / 4));
  const walls = Math.max(0.1, height);
  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: walls });
  const built = useBuilt(() => {
    const b = new Builder();
    // Les quatre parois et le fond.
    b.box("bin", 0, spanX, 0, wallThick, 0, walls);
    b.box("bin", 0, spanX, spanY - wallThick, spanY, 0, walls);
    b.box("bin", 0, wallThick, wallThick, spanY - wallThick, 0, walls);
    b.box("bin", spanX - wallThick, spanX, wallThick, spanY - wallThick, 0, walls);
    b.box("bin", wallThick, spanX - wallThick, wallThick, spanY - wallThick, 0, wallThick);
    // Le tas : des colis tombés au hasard, **en vrac** — tournés, et en 3D un peu basculés, parce
    // qu'un colis qui tombe dans un bac ne se pose jamais à plat sur un autre.
    const next = sequence(seed);
    const inner = { x0: wallThick, x1: spanX - wallThick, y0: wallThick, y1: spanY - wallThick };
    const unit = Math.max(0.15, itemSize);
    const perRow = Math.max(1, Math.floor((inner.x1 - inner.x0) / unit));
    const perCol = Math.max(1, Math.floor((inner.y1 - inner.y0) / unit));
    const perLayer = perRow * perCol;
    for (let n = 0; n < Math.max(0, Math.floor(count)); n += 1) {
      const layer = Math.floor(n / perLayer);
      const slot = n % perLayer;
      const cx = inner.x0 + ((slot % perRow) + 0.5) * ((inner.x1 - inner.x0) / perRow) + (next() - 0.5) * unit * 0.34;
      const cy = inner.y0 + (Math.floor(slot / perRow) + 0.5) * ((inner.y1 - inner.y0) / perCol) + (next() - 0.5) * unit * 0.34;
      const size = unit * (0.78 + next() * 0.34);
      const yaw = (next() - 0.5) * Math.PI * 0.5;
      const tilt = (next() - 0.5) * (layer > 0 ? 0.45 : 0.12);
      const z0 = wallThick + layer * unit * LAYER_RISE + (next() - 0.5) * unit * 0.12;
      const m = new Matrix4()
        .makeTranslation(cx, cy, z0 + size / 2)
        .multiply(new Matrix4().makeRotationZ(yaw))
        .multiply(new Matrix4().makeRotationX(tilt))
        .multiply(new Matrix4().makeTranslation(0, 0, -size / 2));
      b.within(m, () => addGood(b, "carton", 0, 0, 0, size / 2, size * 0.8));
    }
    return b.build();
  }, [spanX, spanY, wallThick, walls, count, itemSize, seed]);
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
