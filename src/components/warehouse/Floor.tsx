import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, useBuilt } from "./three/scene";
import "./Floor.css";

/**
 * Le sol : une **dalle**, et non un fond.
 *
 * Une scène isométrique posée sur rien flotte. Ce qui la pose, ce n'est pas une couleur derrière —
 * un aplat n'a pas de bord — c'est un volume : une dalle dont on **voit l'épaisseur** sur les deux
 * côtés qui regardent la caméra. C'est cette tranche qui dit où le sol s'arrête, et qui donne à
 * tout ce qui est dessus quelque chose sur quoi reposer.
 *
 * Elle occupe `z` de `−0,1` à `0`, et non de `0` à `0,1` : le zéro du monde est le sol sur lequel
 * tout le reste est déjà posé, et le relever déplacerait toute la scène. La dalle descend donc sous
 * lui, et c'est son dessus qui est le sol. Son épaisseur ne se règle pas : une dalle est une dalle,
 * et deux sols d'épaisseurs différentes dans la même image se lisent comme deux niveaux.
 *
 * Elle ne porte pas d'ombre — elle *est* ce sur quoi les autres la portent — et elle se peint avant
 * tout le monde : `parts="shadow"` ne dessine donc rien, pour qu'une scène puisse lui demander ses
 * couches comme à n'importe quel autre module.
 *
 * Elle est **lisse**. Des joints de dalle donneraient l'échelle, mais ils quadrillent le fond de
 * toute la scène : dans une image faite de traits fins, une grille pâle sous chaque objet se lit
 * comme un calque de plus, et ce qui est posé dessus passe au second plan.
 */

export interface FloorProps {
  /** Longueur, en cases, le long des `x`. */
  width?: number;
  /** Profondeur, en cases, le long des `y`. */
  depth?: number;
  /** Où poser le coin de la dalle, en cases. */
  origin?: { x: number; y: number };
  /** La hauteur de son dessus, en cases. `0` : au niveau du sol.
   *
   *  C'est ce qui fait une **plateforme de quai** : le plancher d'un entrepôt de messagerie n'est
   *  pas au niveau de la cour, il est 1 200 mm au-dessus — la hauteur d'un plancher de remorque —
   *  et ce qu'on voit tout autour du bâtiment est la tranche de cette dalle. */
  level?: number;
  /**
   * Le niveau du dessus au bord `y = 0`, quand il n'est pas celui du bord opposé : la dalle
   * **penche**.
   *
   *  Une cour de quai n'est pas plate. Le plancher des remorques est à 1 200 mm, le sol de la cour
   *  est en bas, et entre les deux il faut bien que quelque chose monte : c'est le plan incliné
   *  devant les portes, celui par lequel on rejoint le niveau du quai autrement qu'en sautant.
   *  Sans lui, la plateforme s'arrête sur une falaise et la cour n'est plus reliée à rien.
   *
   *  L'inclinaison est **sur `y` seulement**, et c'est suffisant : une rampe est une voie, elle
   *  monte dans un sens. Une scène qui la veut en travers pose sa dalle tournée d'un quart de tour.
   */
  slope?: number;
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine. La dalle n'ayant pas d'ombre, `"shadow"` ne dessine rien. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

/** L'épaisseur d'une dalle : 200 mm. */
const THICKNESS = 0.1;

export function Floor({ width = 12, depth = 8, origin = { x: 0, y: 0 }, level = 0, slope, frame, parts = "all", cellSize = 30, className }: FloorProps) {
  const x1 = Math.max(0.5, width);
  const y1 = Math.max(0.5, depth);
  const z1 = Math.max(0, level);
  const zNear = Math.max(0, slope ?? z1);
  // Une dalle surélevée descend jusqu'au sol : c'est un massif, pas une plaque suspendue.
  const z0 = Math.min(0, z1, zNear) - THICKNESS;
  const built = useBuilt(() => {
    const b = new Builder();
    const X = origin.x;
    const Y = origin.y;
    // Huit coins et non une boîte : le dessus peut monter de `zNear` au bord des `y` bas jusqu'à
    // `z1` au bord des `y` hauts — la cour qui descend en pente jusqu'au pied des portes.
    b.hexa("slab", [
      [X, Y, z0],
      [X + x1, Y, z0],
      [X + x1, Y + y1, z0],
      [X, Y + y1, z0],
      [X, Y, zNear],
      [X + x1, Y, zNear],
      [X + x1, Y + y1, z1],
      [X, Y + y1, z1],
    ]);
    return b.build();
  }, [origin.x, origin.y, x1, y1, z0, z1, zNear]);
  // Les ombres ne sont plus une couche à part : la lumière les porte. La dalle n'a donc rien à
  // dessiner quand une scène en couches lui demande les siennes.
  if (parts === "shadow") return null;
  const bounds = frame ? frameBounds(frame) : { x0: origin.x, x1: origin.x + x1, y0: origin.y, y1: origin.y + y1, z0, z1: Math.max(z1, zNear) };
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={["lq-floor", className].filter(Boolean).join(" ")} ariaLabel="Sol">
      <Parts built={built} />
    </Solo>
  );
}
