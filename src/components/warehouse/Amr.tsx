import { Builder, roundedRect } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useFollow, type Follow } from "./three/follow";
import { GOOD_SIZE, addGood } from "./three/goods";
import type { RackItemKind } from "./rackItems";
import "./rackItems.css";
import "./Amr.css";

/**
 * Robot autonome (AMR) — le plateau roulant qui porte une palette d'un bout à l'autre du bâtiment.
 *
 * ## Ce qu'il est, et ce qu'il n'est pas
 *
 * Ce n'est ni un chariot ni un picker : personne ne le conduit et il ne lève rien. Il se glisse
 * sous une charge, la porte et la pose. Tout son dessin en découle — **il est bas et il est plat**,
 * parce que ce qu'il transporte doit pouvoir être pris et laissé par une machine qui, elle, lève :
 * sa hauteur est celle d'un socle, pas celle d'un engin.
 *
 * Il n'a donc ni cabine, ni mât, ni contrepoids. Ce qui le distingue d'une simple caisse, c'est :
 *
 * - son **bandeau lumineux**, qui fait le tour et dit son état — c'est ce qu'on regarde quand on
 *   croise un robot, et c'est le seul endroit d'où il parle ;
 * - ses **capteurs** aux angles avant, qui balayent le sol devant lui ;
 * - ses **roues**, enfoncées sous le plateau et visibles seulement par leur ombre de flanc.
 *
 * ## Le dessin
 *
 * Une caisse aux angles abattus (`prismVolume`, `roundedRing`) : un robot de manutention n'a pas
 * d'arête vive, parce qu'une arête vive accroche les palettes et les mollets. Le bandeau est une
 * couche mince prise entre deux autres, plutôt qu'un trait posé sur la face : sur un volume tourné
 * dans tous les caps, un trait doit être replacé à chaque fois, une couche non.
 */

export interface AmrProps {
  /** Ce qu'il porte : une palette, chargée ou non. `null` : plateau nu. */
  load?: RackItemKind | null;
  /** Rotation sur le sol, en degrés. À 0, il avance vers les `x` croissants. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le robot sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le robot seul. */
  parts?: "all" | "shadow" | "machine";
  /** Rouler le long d'un itinéraire, charge comprise : la position et le cap viennent alors de lui. */
  follow?: Follow;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

/** L'emprise d'un AMR : à peine plus qu'une palette, puisque c'est ce qu'il porte. */
const LENGTH = 1.6;
const WIDTH = 1.15;
const DECK = 0.34;


export function Amr(props: AmrProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 30, className } = props;
  if (parts === "shadow") return null;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: WIDTH, z0: 0, z1: DECK + 0.9 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-amr", className].filter(Boolean).join(" ")} ariaLabel="Robot autonome">
      <AmrBody {...props} />
    </Solo>
  );
}

function AmrBody({ load = "palette", rotation = 0, origin = { x: 0, y: 0 }, follow }: AmrProps) {
  const built = useBuilt(() => {
    const b = new Builder();
    const body = (inset: number) => roundedRect(inset, LENGTH - inset, inset, WIDTH - inset, 0.26 - inset, 4);
    // Une jupe sombre en retrait, la coque, le bandeau lumineux qui en fait le tour, le plateau.
    b.prism("robot-dark", body(0.09), 0.03, 0.12);
    b.prism("robot", body(0), 0.12, 0.2);
    b.prism("robot-led", body(-0.012), 0.19, 0.25);
    b.prism("robot", body(0), 0.25, DECK);
    // Les deux capteurs d'angle à l'avant, qui disent de quel côté il va.
    b.prism("robot-dark", roundedRect(LENGTH - 0.26, LENGTH - 0.06, 0.06, 0.26, 0.07, 2), 0.14, 0.24);
    b.prism("robot-dark", roundedRect(LENGTH - 0.26, LENGTH - 0.06, WIDTH - 0.26, WIDTH - 0.06, 0.07, 2), 0.14, 0.24);
    // La charge : la même palette et la même marchandise que partout ailleurs.
    if (load) {
      const cx = LENGTH / 2;
      const cy = WIDTH / 2;
      const half = Math.min(LENGTH - 0.24, WIDTH - 0.08) / 2;
      addGood(b, "palette", cx, cy, DECK, half, GOOD_SIZE.palette.height);
      if (load !== "palette") {
        const g = GOOD_SIZE[load as RackItemKind];
        const k = (half - 0.05) / g.half;
        addGood(b, load as RackItemKind, cx, cy, DECK + GOOD_SIZE.palette.height, g.half * k, g.height * k);
      }
    }
    return b.build();
  }, [load]);
  const ride = useFollow(follow);
  const { pose } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: WIDTH, z0: 0, z1: 1 });
  if (follow) {
    // Sur un itinéraire, le robot est centré sur la piste : son centre suit, son nez regarde devant.
    return (
      <group ref={ride}>
        <group position={[-LENGTH / 2, -WIDTH / 2, 0]}>
          <Parts built={built} />
        </group>
      </group>
    );
  }
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
