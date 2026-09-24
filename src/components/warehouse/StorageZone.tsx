import { Builder } from "./three/builder";
import { Parts, Solo, placed, useBuilt } from "./three/scene";
import { addGood } from "./three/goods";
import "./rackItems.css";
import "./StorageZone.css";

/**
 * Zone de stockage — des marchandises sur palettes, posées au sol.
 *
 * C'est l'autre façon de stocker, celle qui ne demande aucune machine : des palettes alignées à
 * même le sol, empilées sur quelques hauteurs. Une étagère range en hauteur ce qu'une zone range en
 * surface, et un entrepôt fait les deux — d'où un objet à part plutôt qu'un réglage de l'étagère.
 *
 * Bâtie dans le vocabulaire commun (`rackItems.tsx`) : volumes alignés sur les axes montrant les
 * trois faces que la caméra voit, trois clartés d'une même couleur sous une seule lumière, opaques,
 * et les faces visibles choisies d'après la rotation plutôt que supposées.
 *
 * ## Ce qu'une pile est
 *
 * Une **palette** de bois, et au-dessus des charges empilées, chacune un volume à part. Elles ne
 * sont pas dessinées comme un seul bloc de la bonne hauteur : c'est la ligne entre deux charges qui
 * dit combien il y en a, et un bloc unique dirait seulement « c'est haut ». `stacks` donne la
 * hauteur de chaque emplacement en ordre de lecture, et zéro laisse l'emplacement vide — un magasin
 * plein n'est pas un magasin, c'est un magasin qu'on ne peut plus remplir.
 *
 * ## Le jeu entre les piles
 *
 * `gap` sépare deux emplacements. Il n'est pas décoratif : c'est ce qui permet de distinguer deux
 * piles voisines de même hauteur, qui sans lui formeraient un seul pavé. À zéro, une zone pleine
 * redevient un bloc, et c'est parfois ce qu'on veut dire.
 */

export interface StorageZoneProps {
  /** Emplacements sur l'axe X. */
  columns?: number;
  /** Emplacements sur l'axe Y. */
  rows?: number;
  /** Hauteur de pile de chaque emplacement, en ordre de lecture (une rangée Y après l'autre).
   *  Plus courte que le nombre d'emplacements, elle se complète par `fill`. */
  stacks?: number[];
  /** Hauteur des emplacements que `stacks` ne mentionne pas. */
  fill?: number;
  /** Côté d'une palette, en cases. */
  palletSize?: number;
  /** Jeu entre deux emplacements, en cases. */
  gap?: number;
  /** Hauteur d'une charge, en fraction du côté de la palette. */
  unitHeight?: number;
  /** Rotation de la zone sur le sol, en degrés. */
  rotation?: number;
  /** Où poser la zone, en cases. */
  origin?: { x: number; y: number };
  /** Peindre la zone au sol : un liseré de sécurité autour, un trait entre les emplacements. */
  marked?: boolean;
  /** Poser les ombres au sol. */
  shadows?: boolean;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}


/** Épaisseur d'une palette, en fraction de son côté. Assez pour qu'on voie qu'il y en a une. */
const PALLET_THICK = 0.14;

/** Par axe, pour la même raison que partout ailleurs ici : au-delà ce n'est plus un dessin mais une
 *  scène, et c'est un autre travail que celui-ci. */
const MAX = 40;


const count = (n: number) => Math.max(1, Math.min(MAX, Math.floor(n) || 1));

export function StorageZone(props: StorageZoneProps) {
  const { columns = 4, rows = 3, palletSize = 1.2, gap = 0.35, rotation = 0, origin = { x: 0, y: 0 }, cellSize = 30, className, stacks, fill = 3, unitHeight = 0.62 } = props;
  const nx = count(columns);
  const ny = count(rows);
  const side = Math.max(0.2, palletSize);
  const step = side + Math.max(0, gap);
  const spanX = nx * step - Math.max(0, gap);
  const spanY = ny * step - Math.max(0, gap);
  const tallest = PALLET_THICK * side + Math.max(fill, ...(stacks ?? [0])) * Math.max(0.05, unitHeight) * side;
  const { bounds } = placed(origin, rotation, { x0: -0.2, x1: spanX + 0.2, y0: -0.2, y1: spanY + 0.2, z0: 0, z1: tallest });
  const filled = Array.from({ length: nx * ny }, (_, i) => (stacks ? stacks[i] : fill) ?? fill).filter((n) => n > 0).length;
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={["lq-storage", className].filter(Boolean).join(" ")} ariaLabel={`Zone de stockage, ${filled} emplacement${filled > 1 ? "s" : ""} occupé${filled > 1 ? "s" : ""} sur ${nx * ny}`}>
      <StorageZoneBody {...props} />
    </Solo>
  );
}

function StorageZoneBody({ columns = 4, rows = 3, stacks, fill = 3, palletSize = 1.2, gap = 0.35, unitHeight = 0.62, rotation = 0, origin = { x: 0, y: 0 }, marked = true }: StorageZoneProps) {
  const nx = count(columns);
  const ny = count(rows);
  const side = Math.max(0.2, palletSize);
  const step = side + Math.max(0, gap);
  const spanX = nx * step - Math.max(0, gap);
  const spanY = ny * step - Math.max(0, gap);
  const unit = Math.max(0.05, unitHeight) * side;
  const deck = PALLET_THICK * side;
  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  const built = useBuilt(() => {
    const b = new Builder();
    // Le marquage au sol : c'est lui qui fait une zone de stockage et non un tas de palettes. Un
    // liseré de sécurité tout autour, et un trait qui délimite chaque emplacement — un
    // emplacement vide se lit ainsi comme une place libre, pas comme un oubli.
    if (marked) {
      const w = 0.06;
      const m = 0.16;
      const z = 0.004;
      b.faceZ("lq-zone__line", z, -m, spanX + m, -m, -m + w);
      b.faceZ("lq-zone__line", z, -m, spanX + m, spanY + m - w, spanY + m);
      b.faceZ("lq-zone__line", z, -m, -m + w, -m, spanY + m);
      b.faceZ("lq-zone__line", z, spanX + m - w, spanX + m, -m, spanY + m);
      for (let j = 0; j < ny; j += 1)
        for (let i = 0; i < nx; i += 1) {
          const x0 = i * step - 0.03;
          const y0 = j * step - 0.03;
          b.lines("lq-rack2__divider", [
            [[x0, y0, z], [x0 + side + 0.06, y0, z]],
            [[x0 + side + 0.06, y0, z], [x0 + side + 0.06, y0 + side + 0.06, z]],
            [[x0 + side + 0.06, y0 + side + 0.06, z], [x0, y0 + side + 0.06, z]],
            [[x0, y0 + side + 0.06, z], [x0, y0, z]],
          ]);
        }
    }
    for (let j = 0; j < ny; j += 1)
      for (let i = 0; i < nx; i += 1) {
        const n = Math.max(0, Math.floor((stacks ? stacks[j * nx + i] : fill) ?? fill));
        if (n === 0) continue;
        const cx = i * step + side / 2;
        const cy = j * step + side / 2;
        // Une vraie palette, et dessus des couches de cartons : chacune avec son adhésif, si bien
        // qu'on compte les couches d'un coup d'œil.
        addGood(b, "palette", cx, cy, 0, side / 2, deck);
        for (let k = 0; k < n; k += 1) addGood(b, "carton", cx, cy, deck + k * unit, side / 2 - 0.02, unit - 0.005);
      }
    return b.build();
  }, [nx, ny, side, step, unit, deck, JSON.stringify(stacks), fill, marked]);
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
