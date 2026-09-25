import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Color, DoubleSide, MeshBasicMaterial } from "three";
import { Builder, type P3 } from "./three/builder";
import { parseCss } from "./three/palette";
import { useBuilt } from "./three/scene";

/**
 * Les **zones** du plan, peintes au sol : ce que le joueur a délimité avant de dire ce qu'on y fera.
 *
 *  Une zone est un rectangle de cases entières, aligné sur les axes. Elle n'est rien d'autre qu'une
 *  intention — l'application décide de ce qu'elle y pose —, et son dessin le dit : un voile coloré
 *  sur le sol, sous tout ce qui est construit, qu'on voit dans la vue de dessus comme de biais.
 *
 *  - **À affecter** (`assigned` faux) : un voile neutre, **hachuré**, bordé d'un **pointillé** — un
 *    terrain réservé, pas encore un usage ;
 *  - **affectée** : le voile prend la couleur de l'usage (`color`), bordé d'un trait **plein** et
 *    fin.
 *
 *  La zone choisie est plus soutenue, et son bord plus épais. Les couleurs sont des couleurs CSS
 *  quelconques — `var(--lq-color-sky)` aussi bien que `#6faf82` — résolues par le navigateur dans le
 *  conteneur de la scène : un thème qui change de variables change la zone avec lui au prochain
 *  rendu.
 */

/** Une zone tracée par le joueur (voir `WarehousePlanner.zones`). En cases. */
export interface PlannerZone {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Ce qu'on lit sur l'étiquette. Défaut : « Zone à affecter », ou rien d'autre que les cotes. */
  label?: string;
  /** La couleur d'une zone affectée : une couleur CSS. Défaut : la couleur d'accent. */
  color?: string;
  /** L'usage de la zone, pour l'application (« stockage », « expédition »…). */
  kind?: string;
  /** Affectée à un usage : pleine et colorée ; sinon hachurée et neutre. */
  assigned?: boolean;
}

/** La hauteur du voile : au-dessus du sol et des voies, sous tout ce qui est posé. */
const Z = 0.028;
const NEUTRAL = "color-mix(in srgb, var(--lq-color-text) 55%, var(--lq-color-bg))";
const ACCENT = "var(--lq-color-accent)";

/** Une bande diagonale `x − y ∈ [c, c + w]`, découpée au rectangle : un polygone convexe. */
function clipBand(x0: number, y0: number, x1: number, y1: number, c: number, w: number): P3[] {
  let poly: [number, number][] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  // Sutherland–Hodgman contre les deux demi-plans de la bande.
  const clip = (keep: (p: [number, number]) => number) => {
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ka = keep(a);
      const kb = keep(b);
      if (ka >= 0) out.push(a);
      if (ka * kb < 0) {
        const t = ka / (ka - kb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    poly = out;
  };
  clip((p) => p[0] - p[1] - c);
  clip((p) => c + w - (p[0] - p[1]));
  return poly.map(([x, y]) => [x, y, Z + 0.0005] as P3);
}

/** Le bord d'un rectangle : quatre bandes pleines, ou des tirets. */
function border(b: Builder, cls: string, x0: number, y0: number, x1: number, y1: number, t: number, dashed: boolean) {
  const run = (ax: number, ay: number, bx: number, by: number) => {
    const L = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / L;
    const uy = (by - ay) / L;
    const seg = (s0: number, s1: number) => {
      const p = { x: ax + ux * s0, y: ay + uy * s0 };
      const q = { x: ax + ux * s1, y: ay + uy * s1 };
      // La bande est tenue à l'intérieur du rectangle : le bord ne déborde pas sur la case voisine.
      const nx = -uy * t;
      const ny = ux * t;
      b.decal(cls, [
        [p.x, p.y, Z + 0.001],
        [q.x, q.y, Z + 0.001],
        [q.x + nx, q.y + ny, Z + 0.001],
        [p.x + nx, p.y + ny, Z + 0.001],
      ]);
    };
    if (!dashed) return seg(0, L);
    const on = 0.55;
    const off = 0.35;
    for (let s = 0; s < L; s += on + off) seg(s, Math.min(L, s + on));
  };
  // Dans le sens des aiguilles d'une montre dans le repère du plan : la normale gauche rentre.
  run(x0, y0, x1, y0);
  run(x1, y0, x1, y1);
  run(x1, y1, x0, y1);
  run(x0, y1, x0, y0);
}

function buildZone(z: PlannerZone, selected: boolean) {
  const b = new Builder();
  const x0 = z.x;
  const y0 = z.y;
  const x1 = z.x + z.width;
  const y1 = z.y + z.depth;
  b.faceZ("fill", Z, x0, x1, y0, y1);
  if (!z.assigned) {
    // Des hachures à 45°, toutes les trois quarts de case.
    for (let c = x0 - y1; c < x1 - y0; c += 0.75) {
      const poly = clipBand(x0, y0, x1, y1, c, 0.12);
      if (poly.length >= 3) b.decal("hatch", poly);
    }
  }
  border(b, "border", x0, y0, x1, y1, selected ? 0.16 : z.assigned ? 0.07 : 0.09, !z.assigned);
  return b.build();
}

/** Une zone, au sol. */
function Zone3D({ zone, selected, resolve }: { zone: PlannerZone; selected: boolean; resolve: (css: string) => Color }) {
  const built = useBuilt(() => buildZone(zone, selected), [zone.x, zone.y, zone.width, zone.depth, zone.assigned, selected]);
  const css = zone.assigned ? (zone.color ?? ACCENT) : NEUTRAL;
  const color = resolve(css);
  const hex = color.getHexString();
  const mats = useMemo(() => {
    const make = (opacity: number) =>
      new MeshBasicMaterial({ color: new Color(`#${hex}`), transparent: true, opacity, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const assigned = !!zone.assigned;
    return {
      fill: make((assigned ? 0.26 : 0.1) + (selected ? 0.12 : 0)),
      hatch: make(selected ? 0.42 : 0.3),
      border: make(assigned ? 0.95 : 0.8),
    };
  }, [hex, zone.assigned, selected]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return (
    <group>
      {[...built.decals].map(([cls, g]) => (
        <mesh key={cls} geometry={g} material={mats[cls as keyof typeof mats]} renderOrder={2} />
      ))}
    </group>
  );
}

/** Toutes les zones d'un plan, dans sa scène. */
export function PlannerZones3D({ zones, selectedId }: { zones: PlannerZone[]; selectedId?: string | null }) {
  const gl = useThree((s) => s.gl);
  // Une sonde dans le conteneur de la toile : elle hérite des variables du thème, et le navigateur
  // y résout n'importe quelle couleur CSS.
  const resolve = useMemo(() => {
    const cache = new Map<string, Color>();
    return (css: string): Color => {
      const hit = cache.get(css);
      if (hit) return hit;
      const host = gl.domElement.parentElement ?? document.body;
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
      probe.style.color = css;
      host.appendChild(probe);
      const parsed = parseCss(getComputedStyle(probe).color);
      probe.remove();
      const c = parsed?.color ?? new Color("#6d8fb3");
      cache.set(css, c);
      return c;
    };
  }, [gl]);
  return (
    <group>
      {zones.map((z) => (
        <Zone3D key={z.id} zone={z} selected={z.id === selectedId} resolve={resolve} />
      ))}
    </group>
  );
}
