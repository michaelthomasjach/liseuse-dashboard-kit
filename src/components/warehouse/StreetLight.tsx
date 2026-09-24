import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * L'éclairage extérieur, et le petit mobilier qui l'accompagne.
 *
 * - `"street"` : le candélabre de voirie, un mât et une crosse qui porte la lanterne au-dessus de la
 *   chaussée ;
 * - `"flood"`  : le mât de cour, plus haut, à quatre projecteurs — celui qui éclaire l'aire de
 *   manœuvre devant les quais, de nuit comme de jour ;
 * - `"bollard"` : la borne de protection, un fût jaune rempli de béton, qui protège un angle de
 *   bâtiment ou une porte des manœuvres ratées.
 *
 * Le pied est en `origin` ; la crosse regarde vers les `x` croissants à `rotation = 0`.
 */

export type StreetLightKind = "street" | "flood" | "bollard";

export interface StreetLightProps {
  kind?: StreetLightKind;
  /** Hauteur du mât, en cases. */
  height?: number;
  rotation?: number;
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

const HEIGHT: Record<StreetLightKind, number> = { street: 4, flood: 6, bollard: 0.55 };

/** Poser un luminaire dans un constructeur, pied en `(0, 0, 0)`. */
export function addStreetLight(b: Builder, kind: StreetLightKind, height = HEIGHT[kind]): void {
  const h = Math.max(0.2, height);
  if (kind === "bollard") {
    b.cylinder("safety", 0, 0, h / 2, 0.1, h, "z", 14);
    b.cylinder("paint-dark", 0, 0, h * 0.72, 0.102, h * 0.08, "z", 14, undefined, false);
    b.cylinder("safety", 0, 0, h, 0.1, 0.001, "z", 14, 0.06);
    return;
  }
  // Le massif, le mât conique.
  b.box("slab", -0.12, 0.12, -0.12, 0.12, 0, 0.08);
  b.cylinder("steel", 0, 0, 0.08 + (h - 0.08) / 2, 0.06, h - 0.08, "z", 10, 0.035);
  if (kind === "street") {
    // La crosse, puis la lanterne plate, face éclairante vers le sol.
    b.beam("steel", [0, 0, h - 0.05], [0.5, 0, h + 0.18], 0.025);
    b.beam("steel", [0.5, 0, h + 0.18], [1.1, 0, h + 0.2], 0.025);
    b.box("paint-dark", 0.95, 1.45, -0.12, 0.12, h + 0.12, h + 0.22);
    b.faceZ("lq-car__lamp", h + 0.118, 1.0, 1.4, -0.09, 0.09);
    return;
  }
  // Le mât de cour : une couronne et quatre projecteurs inclinés vers le sol.
  b.box("steel", -0.3, 0.3, -0.04, 0.04, h - 0.05, h + 0.02);
  b.box("steel", -0.04, 0.04, -0.3, 0.3, h - 0.05, h + 0.02);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = dx * 0.32;
    const y = dy * 0.32;
    b.box("paint-dark", x - 0.12, x + 0.12, y - 0.12, y + 0.12, h - 0.18, h + 0.02);
    b.faceZ("lq-car__lamp", h - 0.182, x - 0.1, x + 0.1, y - 0.1, y + 0.1);
  }
}

export function StreetLight(props: StreetLightProps) {
  const { kind = "street", rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 34, className } = props;
  const h = props.height ?? HEIGHT[kind];
  const r = kind === "street" ? 1.5 : kind === "flood" ? 0.5 : 0.12;
  const { bounds } = placed(origin, rotation, { x0: -r, x1: r, y0: -r, y1: r, z0: 0, z1: h + 0.3 }, { x: 0, y: 0 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel={kind === "bollard" ? "Borne" : "Lampadaire"}>
      <StreetLightBody {...props} />
    </Solo>
  );
}

function StreetLightBody({ kind = "street", height, rotation = 0, origin = { x: 0, y: 0 } }: StreetLightProps) {
  const built = useBuilt(() => {
    const b = new Builder();
    addStreetLight(b, kind, height ?? HEIGHT[kind]);
    return b.build();
  }, [kind, height]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 1 }, { x: 0, y: 0 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
