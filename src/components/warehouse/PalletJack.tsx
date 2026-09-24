import { Builder, roundedRect } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { GOOD_SIZE, addGood } from "./three/goods";
import { Worker } from "./Worker";

/**
 * Transpalette — l'engin le plus humble de l'entrepôt : deux fourches, un châssis, un timon.
 *
 * Ce n'est pas un chariot élévateur : il ne lève une palette que de quoi la décoller du sol, et
 * c'est un homme qui le tire ou le pousse. Tout son dessin tient à cela — **il est bas**, à hauteur
 * de palette ; ses fourches sont longues et fines, faites pour se glisser dessous ; son seul organe
 * haut est le **timon**, incliné, avec sa poignée en boucle, par où l'opérateur le mène.
 *
 * Le repère : l'emprise va de `(0, 0)` à `(PALLET_JACK_LENGTH, PALLET_JACK_WIDTH)`, les fourches
 * vers les `x` croissants, le timon à l'arrière. L'opérateur (`operator`) se tient derrière le
 * timon, hors de l'emprise, et marche quand l'engin roule (`walking`).
 *
 * La charge : une palette nue, une palette chargée d'un bloc de marchandise (`"palette"`), ou une
 * pile de **cartons** (`"carton"`) dont `cartons` dit le nombre — de quoi montrer d'un coup d'œil
 * ce qu'un aller emporte.
 */

export const PALLET_JACK_LENGTH = 1.5;
export const PALLET_JACK_WIDTH = 0.62;

/** Ce qu'un engin du kit porte : des cartons empilés sur une palette, ou une palette pleine. */
export type HaulLoad = "carton" | "palette";

export interface PalletJackProps {
  /** Ce qu'il porte. `null` : fourches vides. */
  load?: HaulLoad | null;
  /** Le nombre de cartons sur la palette, pour une charge `"carton"`. */
  cartons?: number;
  /** Pour une palette pleine (`"palette"`) : sa hauteur de marchandise, de 0 à 1. */
  fill?: number;
  /** Un opérateur qui le mène. */
  operator?: boolean;
  /** La vitesse de marche de l'opérateur, en cases par seconde : il marche si elle n'est pas nulle. */
  walking?: number;
  /** Rotation sur le sol, en degrés. À 0, les fourches regardent vers les `x` croissants. */
  rotation?: number;
  /** Où poser l'engin sur le sol (le coin de son emprise), en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/**
 * Poser une charge sur une palette, centrée en `(cx, cy)`, la palette à `z`.
 *
 *  Des cartons : quatre par couche, en deux rangs, jusqu'à trois couches — au-delà on n'en montre
 *  pas davantage, la pile dit déjà « plein ». Une palette pleine : la palette et un bloc filmé de
 *  marchandise, d'autant plus haut que `fill` (de 0 à 1) est grand.
 */
export function addHaul(b: Builder, load: HaulLoad, count: number, cx: number, cy: number, z: number, half = 0.3, fill = 1): void {
  const pal = GOOD_SIZE.palette.height;
  addGood(b, "palette", cx, cy, z, half, pal);
  if (load === "palette") {
    addGood(b, "carton", cx, cy, z + pal, half * 0.94, 0.16 + 0.3 * Math.max(0, Math.min(1, fill)));
    return;
  }
  const n = Math.max(0, Math.min(12, Math.round(count)));
  const hc = half * 0.46;
  const h = 0.17;
  for (let i = 0; i < n; i += 1) {
    const layer = Math.floor(i / 4);
    const k = i % 4;
    const dx = (k % 2 === 0 ? -1 : 1) * half * 0.5;
    const dy = (k < 2 ? -1 : 1) * half * 0.5;
    addGood(b, "carton", cx + dx, cy + dy, z + pal + layer * h, hc, h);
  }
}

export function PalletJack(props: PalletJackProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 60, className } = props;
  const { bounds } = placed(origin, rotation, { x0: -0.6, x1: PALLET_JACK_LENGTH, y0: 0, y1: PALLET_JACK_WIDTH, z0: 0, z1: 1.3 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Transpalette">
      <PalletJackBody {...props} />
    </Solo>
  );
}

/**
 * Le corps du transpalette, **dans** une scène : ce que `PalletJack` pose, et ce que les engins qui
 * roulent (`PlannerShuttle`, `PlannerDockTraffic`) montent dans leur groupe mobile.
 */
export function PalletJackBody({ load = null, cartons = 4, fill = 1, operator = true, walking = 0, rotation = 0, origin = { x: 0, y: 0 } }: PalletJackProps) {
  const L = PALLET_JACK_LENGTH;
  const W = PALLET_JACK_WIDTH;
  const built = useBuilt(() => {
    const b = new Builder();
    // Les deux fourches, longues et basses, leurs galets au bout.
    for (const y of [0.07, W - 0.21]) {
      b.box("iron", 0.42, L, y, y + 0.14, 0.03, 0.1);
      b.cylinder("rubber", L - 0.1, y + 0.07, 0.03, 0.028, 0.1, "y", 10);
    }
    // Le châssis : le carter de la pompe, peint, sur ses deux roues directrices.
    b.prism("safety", roundedRect(0.16, 0.46, 0.04, W - 0.04, 0.06, 2), 0.06, 0.3);
    for (const y of [0.17, W - 0.17]) b.cylinder("rubber", 0.28, y, 0.07, 0.07, 0.06, "y", 14);
    // La pompe hydraulique, le pivot du timon, le timon incliné et sa poignée en boucle.
    b.cylinder("chrome", 0.31, W / 2, 0.36, 0.045, 0.12, "z", 12);
    b.beam("iron", [0.31, W / 2, 0.42], [-0.02, W / 2, 0.92], 0.022, false);
    b.beam("rubber", [-0.02, W / 2 - 0.13, 0.95], [-0.02, W / 2 + 0.13, 0.95], 0.025, false);
    b.beam("iron", [-0.02, W / 2 - 0.13, 0.95], [0.02, W / 2 - 0.05, 0.88], 0.015, false);
    b.beam("iron", [-0.02, W / 2 + 0.13, 0.95], [0.02, W / 2 + 0.05, 0.88], 0.015, false);
    if (load) addHaul(b, load, cartons, 0.98, W / 2, 0.1, 0.3, fill);
    return b.build();
  }, [load, cartons, fill]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
      {operator && <Worker origin={{ x: -0.3, y: W / 2 }} pose={walking ? "walk" : "stand"} walking={Math.abs(walking)} />}
    </group>
  );
}
