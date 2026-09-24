import { useEffect, useMemo } from "react";
import { AdditiveBlending, CanvasTexture, Color, MeshBasicMaterial, SRGBColorSpace, SpriteMaterial, type Texture } from "three";
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
  /**
   * La nuit, de 0 (le jour : rien ne change) à 1 (la nuit noire) : la lanterne s'allume et pose au
   * sol une flaque de lumière chaude, d'autant plus franche qu'il fait nuit.
   */
  glow?: number;
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

/**
 * Le dégradé d'une flaque de lumière : chaud et plein au centre, qui s'éteint doucement vers le bord.
 * Une seule texture pour tous les luminaires d'une page — c'est ce qui rend la nuit bon marché : pas
 * une lumière de la scène, un simple disque peint par lampadaire.
 */
let POOL: Texture | null = null;
function poolTexture(): Texture {
  if (POOL) return POOL;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255, 214, 140, 1)");
    g.addColorStop(0.35, "rgba(255, 196, 110, 0.55)");
    g.addColorStop(0.7, "rgba(255, 180, 90, 0.16)");
    g.addColorStop(1, "rgba(255, 170, 80, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  POOL = new CanvasTexture(c);
  POOL.colorSpace = SRGBColorSpace;
  return POOL;
}

/** Où tombe la lumière de chaque luminaire, en cases autour de son pied, et jusqu'où. */
const POOL_OF: Record<StreetLightKind, { x: number; radius: number; heads: [number, number, number][] }> = {
  street: { x: 1.2, radius: 3.6, heads: [[1.2, 0, 0]] },
  flood: { x: 0, radius: 6.5, heads: [[0.32, 0, 0], [-0.32, 0, 0], [0, 0.32, 0], [0, -0.32, 0]] },
  bollard: { x: 0, radius: 1.3, heads: [[0, 0, 0]] },
};

/** La flaque de lumière et le halo des lanternes, à la mesure de la nuit. */
function LightPool({ kind, height, glow }: { kind: StreetLightKind; height: number; glow: number }) {
  const spec = POOL_OF[kind];
  const pool = useMemo(() => new MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), []);
  const halo = useMemo(() => new SpriteMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), []);
  const lamp = useMemo(() => new MeshBasicMaterial({ color: new Color("#ffe3a6"), transparent: true, toneMapped: false }), []);
  useEffect(() => {
    pool.opacity = Math.min(1, glow) * 0.8;
    halo.opacity = Math.min(1, glow);
    lamp.opacity = Math.min(1, glow);
  }, [glow, pool, halo, lamp]);
  useEffect(
    () => () => {
      pool.dispose();
      halo.dispose();
      lamp.dispose();
    },
    [pool, halo, lamp]
  );
  const h = kind === "street" ? height + 0.11 : kind === "flood" ? height - 0.19 : height + 0.02;
  const r = spec.radius;
  return (
    <group>
      <mesh position={[spec.x, 0, 0.05]} material={pool} renderOrder={5}>
        <planeGeometry args={[r * 2, r * 2]} />
      </mesh>
      {spec.heads.map(([x, y], i) => (
        <group key={i}>
          <mesh position={[x, y, h]} material={lamp}>
            <boxGeometry args={kind === "street" ? [0.4, 0.18, 0.01] : [0.2, 0.2, 0.01]} />
          </mesh>
          <sprite position={[x, y, h - 0.05]} scale={kind === "bollard" ? [0.5, 0.5, 1] : [1.3, 1.3, 1]} material={halo} renderOrder={6} />
        </group>
      ))}
    </group>
  );
}

function StreetLightBody({ kind = "street", height, rotation = 0, origin = { x: 0, y: 0 }, glow = 0 }: StreetLightProps) {
  const built = useBuilt(() => {
    const b = new Builder();
    addStreetLight(b, kind, height ?? HEIGHT[kind]);
    return b.build();
  }, [kind, height]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 1 }, { x: 0, y: 0 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
      {glow > 0 && <LightPool kind={kind} height={Math.max(0.2, height ?? HEIGHT[kind])} glow={glow} />}
    </group>
  );
}
