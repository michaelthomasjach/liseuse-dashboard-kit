import { Matrix4 } from "three";
import { Builder, annulus, type P2, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { transformTrack } from "./three/transport";

/**
 * Le monorail : **une seule** poutre d'acier, un profilé en I posé sur la tranche, qui guide une
 * machine au sol.
 *
 * ## Ce qu'on voit
 *
 * Un I debout : une semelle en bas, une âme verticale, une semelle en haut. C'est le profil le plus
 * raide pour son poids, et c'est ce qui permet de n'en poser qu'un — la machine ne porte pas sur
 * lui, elle roule au sol de part et d'autre, et le rail ne fait que la **tenir dans sa voie** par
 * des galets qui pincent sa semelle haute. La poutre est posée sur des **plots en béton**, espacés
 * de `plinthEvery`, qui la lèvent au-dessus des irrégularités de la dalle.
 *
 * ## Droit et virage
 *
 * - `"straight"` : un tronçon droit, couché le long des `x`, centré en `y = width / 2` ;
 * - `"corner"` : un quart de tour de rayon `radius` autour du coin `(0, spanY)` — il entre par le
 *   bord `x = 0` et sort par le bord `y = spanY`, comme le rail double et les tapis d'angle. Pour
 *   tourner de l'autre côté, on le tourne.
 *
 * Deux tronçons jointifs ont leur poutre dans le prolongement l'une de l'autre, à la même hauteur :
 * c'est ce qui permet de les mettre bout à bout en circuit (`monorailTrack`).
 */

export type MonorailKind = "straight" | "corner";

export interface MonorailProps {
  kind?: MonorailKind;
  /** Longueur d'un tronçon droit, en cases (une case vaut deux mètres). */
  length?: number;
  /** L'emprise transversale — celle de la machine qui y roule. */
  width?: number;
  /** Rayon d'un virage, à l'axe de la poutre, en cases. */
  radius?: number;
  /** L'écart entre deux plots, en cases. 1,5 : trois mètres. */
  plinthEvery?: number;
  rotation?: number;
  /** Où poser le coin de l'emprise, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Les cotes du profilé et des plots, en cases : un IPE de 300 mm sur des plots de 28 cm. */
export const MONORAIL_PLINTH = 0.14;
export const MONORAIL_BEAM = 0.16;
/** Le dessus de la poutre : ce que pincent les galets de la machine. */
export const MONORAIL_TOP = MONORAIL_PLINTH + MONORAIL_BEAM;
export const MONORAIL_FLANGE = 0.09;
export const MONORAIL_WIDTH = 1.2;
const FLANGE_T = 0.018;
const WEB_T = 0.014;
const PLINTH_L = 0.22;
const PLINTH_W = 0.26;

function layout(p: MonorailProps) {
  const kind = p.kind ?? "straight";
  const W = Math.max(0.4, p.width ?? MONORAIL_WIDTH);
  const R = Math.max(W / 2 + 0.2, p.radius ?? 2);
  const spanY = kind === "straight" ? W : R + W / 2;
  const spanX = kind === "straight" ? Math.max(0.5, p.length ?? 8) : spanY;
  return { kind, W, R, spanX, spanY, every: Math.max(0.5, p.plinthEvery ?? 1.5) };
}

/** Le profil en I, en coupe dans `(y, z)` : semelle basse, âme, semelle haute. */
function iSection(cy: number): P2[][] {
  const z0 = MONORAIL_PLINTH;
  const z1 = MONORAIL_TOP;
  const f = MONORAIL_FLANGE / 2;
  const w = WEB_T / 2;
  return [
    [
      { x: cy - f, y: z0 },
      { x: cy + f, y: z0 },
      { x: cy + f, y: z0 + FLANGE_T },
      { x: cy - f, y: z0 + FLANGE_T },
    ],
    [
      { x: cy - w, y: z0 + FLANGE_T },
      { x: cy + w, y: z0 + FLANGE_T },
      { x: cy + w, y: z1 - FLANGE_T },
      { x: cy - w, y: z1 - FLANGE_T },
    ],
    [
      { x: cy - f, y: z1 - FLANGE_T },
      { x: cy + f, y: z1 - FLANGE_T },
      { x: cy + f, y: z1 },
      { x: cy - f, y: z1 },
    ],
  ];
}

function buildMonorail(p: MonorailProps) {
  const { kind, W, R, spanX, spanY, every } = layout(p);
  const b = new Builder();
  const cy = W / 2;
  const plinth = () => {
    // Un plot : un bloc de béton, et la platine d'acier sur laquelle la poutre est boulonnée.
    b.box("slab", -PLINTH_L / 2, PLINTH_L / 2, -PLINTH_W / 2, PLINTH_W / 2, 0, MONORAIL_PLINTH - 0.012);
    b.box("steel", -PLINTH_L / 2 + 0.02, PLINTH_L / 2 - 0.02, -MONORAIL_FLANGE / 2 - 0.02, MONORAIL_FLANGE / 2 + 0.02, MONORAIL_PLINTH - 0.012, MONORAIL_PLINTH, false);
  };
  if (kind === "straight") {
    // La poutre : le profil en I extrudé le long des `x`, en couchant la coupe d'un quart de tour.
    const spin = new Matrix4().makeRotationZ(Math.PI / 2);
    for (const part of iSection(0)) b.within(new Matrix4().makeTranslation(0, cy, 0).multiply(spin), () => b.profile("steel", part, -spanX, 0));
    const n = Math.max(1, Math.round(spanX / every));
    for (let i = 0; i <= n; i += 1) {
      const x = Math.min(spanX - PLINTH_L / 2, Math.max(PLINTH_L / 2, (spanX * i) / n));
      b.within(new Matrix4().makeTranslation(x, cy, 0), plinth);
    }
    return b.build();
  }
  // Le virage : la même coupe, balayée en quart d'anneau autour du coin `(0, spanY)`.
  const f = MONORAIL_FLANGE / 2;
  const w = WEB_T / 2;
  const z0 = MONORAIL_PLINTH;
  const z1 = MONORAIL_TOP;
  const ring = (ri: number, ro: number) => annulus(0, spanY, ri, ro, -Math.PI / 2, 0, 28);
  b.prism("steel", ring(R - f, R + f), z0, z0 + FLANGE_T);
  b.prism("steel", ring(R - w, R + w), z0 + FLANGE_T, z1 - FLANGE_T);
  b.prism("steel", ring(R - f, R + f), z1 - FLANGE_T, z1);
  const arc = (Math.PI / 2) * R;
  const n = Math.max(1, Math.round(arc / every));
  for (let i = 0; i <= n; i += 1) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / n);
    // Un plot dans un virage est posé en travers de la poutre : tourné sur le rayon.
    const m = new Matrix4().makeTranslation(R * Math.cos(a), spanY + R * Math.sin(a), 0).multiply(new Matrix4().makeRotationZ(a + Math.PI / 2));
    b.within(m, plinth);
  }
  void spanX;
  return b.build();
}

/** L'axe de la poutre, sur sa semelle haute, **en coordonnées monde** : ce que suit la machine. */
export function monorailTrack(p: MonorailProps): P3[] {
  const { kind, W, R, spanX, spanY } = layout(p);
  const local: P3[] = [];
  if (kind === "straight") local.push([0, W / 2, MONORAIL_TOP], [spanX, W / 2, MONORAIL_TOP]);
  else
    for (let i = 0; i <= 24; i += 1) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / 24);
      local.push([R * Math.cos(a), spanY + R * Math.sin(a), MONORAIL_TOP]);
    }
  const { pose } = placed(p.origin ?? { x: 0, y: 0 }, p.rotation ?? 0, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  return transformTrack(local, pose);
}

/** L'emprise d'un tronçon avant rotation : longueur le long des `x`, largeur le long des `y`. */
export function monorailSize(p: MonorailProps): { length: number; width: number } {
  const { spanX, spanY } = layout(p);
  return { length: spanX, width: spanY };
}

export function Monorail(props: MonorailProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 30, className, kind = "straight" } = props;
  const { spanX, spanY } = layout(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: MONORAIL_TOP + 0.05 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-monorail", className].filter(Boolean).join(" ")} ariaLabel={kind === "corner" ? "Monorail, virage" : "Monorail"}>
      <MonorailBody {...props} />
    </Solo>
  );
}

function MonorailBody(props: MonorailProps) {
  const { rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { spanX, spanY } = layout(props);
  const built = useBuilt(() => buildMonorail(props), [props.kind, props.length, props.width, props.radius, props.plinthEvery]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
