import { Vector3 } from "three";

/**
 * La caméra des scènes 3D, en calcul pur : où elle est, où elle regarde, et comment un point de
 * l'écran retombe sur le sol — dans les deux projections.
 *
 * ## Deux projections
 *
 * - **Isométrique** (`"orthographic"`) : pas de fuite, une case a la même taille au fond qu'au
 *   premier plan. C'est la vue de plan, celle où l'on mesure et où l'on construit.
 * - **Perspective** (`"perspective"`) : les lointains rapetissent, la scène prend de la profondeur.
 *   La caméra est placée à la distance qui donne, **au centre de la vue**, la même échelle que
 *   l'isométrique : basculer de l'une à l'autre ne fait pas sauter la scène.
 *
 * ## Le repère
 *
 * Les scènes sont dessinées sous une symétrie `x ↔ y` (voir `MIRROR` dans `scene.tsx`) : un point
 * `(x, y, z)` en cases est `(y, x, z)` dans le monde de three.js. Tout ce qui entre et sort d'ici est
 * en cases ; la symétrie est appliquée à l'intérieur.
 */

export type Projection = "orthographic" | "perspective";

/** L'ouverture verticale de la caméra perspective, en degrés : un « normal » un peu long, qui garde
 *  les verticales presque droites. */
export const PERSPECTIVE_FOV = 34;

/** La direction du sol vers la caméra au cap `deg`, depuis la diagonale des `x` et `y` croissants. */
export function heading(deg: number) {
  const t = (deg * Math.PI) / 180;
  const hx = Math.cos(t) - Math.sin(t);
  const hy = Math.sin(t) + Math.cos(t);
  const n = Math.hypot(hx, hy);
  return { hx: hx / n, hy: hy / n };
}

/** Le repère de la caméra, dans le monde de three.js : `dir` va de la cible vers la caméra. */
export function cameraBasis(yaw: number, tilt: number) {
  const { hx, hy } = heading(yaw);
  const el = (Math.max(0.5, Math.min(89.9, tilt)) * Math.PI) / 180;
  const dir = new Vector3(hx * Math.cos(el), hy * Math.cos(el), Math.sin(el));
  // À la verticale, « le haut » ne peut plus être le ciel : c'est alors le fond de la scène.
  const up = tilt > 89 ? new Vector3(-hx, -hy, 0) : new Vector3(0, 0, 1);
  const right = new Vector3().crossVectors(up, dir).normalize();
  const top = new Vector3().crossVectors(dir, right).normalize();
  return { dir, up, right, top };
}

/** La distance de la caméra perspective pour qu'une case mesure `scale` pixels au centre d'une vue
 *  haute de `height` pixels. */
export function perspectiveDistance(height: number, scale: number) {
  const visible = height / Math.max(1e-6, scale);
  return visible / 2 / Math.tan((PERSPECTIVE_FOV * Math.PI) / 360);
}

export interface ViewSpec {
  yaw: number;
  tilt: number;
  /** Pixels par case au centre de la vue. */
  scale: number;
  width: number;
  height: number;
  /** Le point visé, en cases. */
  center: { x: number; y: number; z?: number };
  projection?: Projection;
}

/**
 * Passer de l'écran au sol et du sol à l'écran, pour une vue donnée.
 *
 *  C'est ce qui permet d'éditer une scène sous n'importe quel angle : un clic est ramené au point du
 *  sol qu'il vise — en isométrique par une translation, en perspective par un rayon depuis l'œil.
 */
export function viewProjector(v: ViewSpec) {
  const { dir, right, top } = cameraBasis(v.yaw, v.tilt);
  const target = new Vector3(v.center.y, v.center.x, v.center.z ?? 0);
  const persp = v.projection === "perspective";
  const dist = persp ? perspectiveDistance(v.height, v.scale) : 0;
  const eye = target.clone().addScaledVector(dir, dist);
  const f = (v.height / 2) / Math.tan((PERSPECTIVE_FOV * Math.PI) / 360);

  /** Le point du sol (à la hauteur `z`) sous le pixel `(sx, sy)`, en cases. */
  const toGround = (sx: number, sy: number, z = 0) => {
    const dx = sx - v.width / 2;
    const dy = sy - v.height / 2;
    let o: Vector3;
    let d: Vector3;
    if (persp) {
      o = eye.clone();
      d = dir.clone().negate().multiplyScalar(f).addScaledVector(right, dx).addScaledVector(top, -dy).normalize();
    } else {
      o = target.clone().addScaledVector(right, dx / v.scale).addScaledVector(top, -dy / v.scale);
      d = dir.clone().negate();
    }
    if (Math.abs(d.z) < 1e-6) return null;
    const s = (z - o.z) / d.z;
    if (s < 0) return null;
    const g = o.addScaledVector(d, s);
    return { x: g.y, y: g.x };
  };

  /** Le pixel d'un point `(x, y, z)` en cases. */
  const toScreen = (x: number, y: number, z = 0) => {
    const w = new Vector3(y, x, z);
    if (persp) {
      const d = w.sub(eye);
      const depth = Math.max(1e-6, -d.dot(dir));
      return { x: v.width / 2 + (f * d.dot(right)) / depth, y: v.height / 2 - (f * d.dot(top)) / depth };
    }
    const d = w.sub(target);
    return { x: v.width / 2 + v.scale * d.dot(right), y: v.height / 2 - v.scale * d.dot(top) };
  };

  return { toGround, toScreen, eye, target, dir, distance: dist };
}
