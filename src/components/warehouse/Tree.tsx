import { useRef } from "react";
import type { Group } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { rng } from "./three/random";

/**
 * Les arbres et les haies qui bordent un site logistique.
 *
 * Un entrepôt est posé dans un paysage : une bande d'arbres le long de la clôture, une haie autour
 * du parking des salariés, un rond-point planté. Sans eux, la scène est un plan technique ; avec
 * eux, c'est un lieu. Ils donnent aussi l'**échelle** — un chêne fait douze mètres, un camion
 * quatre.
 *
 * Quatre silhouettes, qu'on reconnaît de loin, sur une liseuse comme ailleurs :
 * - `"round"`   : le feuillu, une couronne de boules à facettes ;
 * - `"conifer"` : le résineux, des cônes empilés ;
 * - `"poplar"`  : le peuplier, un fuseau haut et étroit — la haie brise-vent des zones d'activité ;
 * - `"bush"`    : l'arbuste, bas, sans tronc visible.
 *
 * Le feuillage est à **facettes** (un icosaèdre, jamais une sphère lisse) : sous la lumière en
 * paliers de la scène, chaque facette prend un gris franc, et la couronne se lit en volume sans
 * dégradé. Chaque arbre est tiré d'une **graine** : deux arbres voisins n'ont pas la même couronne,
 * mais un arbre donné garde la sienne d'un rendu à l'autre.
 */

export type TreeKind = "round" | "conifer" | "poplar" | "bush";

export interface TreeSpec {
  /** Où est le pied de l'arbre, en cases. */
  x: number;
  y: number;
  kind?: TreeKind;
  /** Hauteur totale, en cases (une case vaut deux mètres). */
  height?: number;
  /** La graine de sa silhouette. */
  seed?: number;
}

const DEFAULT_HEIGHT: Record<TreeKind, number> = { round: 3.2, conifer: 3.6, poplar: 4.4, bush: 0.7 };

/** Le tronc d'un arbre, pied en `(x, y, 0)`. */
function addTrunk(b: Builder, kind: TreeKind, x: number, y: number, h: number) {
  if (kind === "bush") return;
  const r = kind === "poplar" ? h * 0.018 : h * 0.028;
  const up = kind === "conifer" ? h * 0.22 : kind === "poplar" ? h * 0.2 : h * 0.42;
  b.cylinder("bark", x, y, up / 2, r, up, "z", 7, r * 0.75);
}

/** La couronne d'un arbre, pied en `(x, y, 0)`. */
function addCrown(b: Builder, kind: TreeKind, x: number, y: number, h: number, seed: number) {
  const r = rng(seed + 1);
  const jitter = (k: number) => (r() - 0.5) * k;
  if (kind === "conifer") {
    // Trois cônes, chacun plus étroit, qui se chevauchent : la silhouette en sapin.
    const base = h * 0.18;
    const tiers = 3;
    for (let i = 0; i < tiers; i += 1) {
      const w = h * (0.3 - i * 0.07) * (0.92 + r() * 0.16);
      const z0 = base + i * h * 0.24;
      b.cone(i % 2 ? "foliage" : "foliage-dark", x + jitter(0.04), y + jitter(0.04), z0, w, h * 0.42, 9);
    }
    return;
  }
  if (kind === "poplar") {
    b.blob("foliage", x, y, h * 0.58, h * 0.16, 1, 2.6);
    b.blob("foliage-dark", x + jitter(0.1), y + jitter(0.1), h * 0.44, h * 0.12, 1, 2.2);
    return;
  }
  if (kind === "bush") {
    const n = 3;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + r();
      b.blob(i % 2 ? "foliage-dark" : "foliage", x + Math.cos(a) * h * 0.35, y + Math.sin(a) * h * 0.35, h * 0.45, h * (0.45 + r() * 0.15), 1, 0.8);
    }
    return;
  }
  // Le feuillu : une grosse boule au centre, et quatre ou cinq plus petites qui débordent — c'est
  // l'irrégularité qui fait une couronne, et non une sphère.
  const R = h * 0.26;
  const cz = h * 0.66;
  b.blob("foliage", x, y, cz, R, 1, 0.9);
  const n = 4 + Math.floor(r() * 2);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8;
    const d = R * (0.55 + r() * 0.25);
    const rr = R * (0.5 + r() * 0.2);
    b.blob(i % 2 ? "foliage-dark" : "foliage", x + Math.cos(a) * d, y + Math.sin(a) * d, cz + (r() - 0.35) * R * 0.8, rr, 1, 0.9);
  }
}

/** Poser un arbre entier dans un constructeur — de quoi en planter cent en un seul maillage. */
export function addTree(b: Builder, spec: TreeSpec): void {
  const kind = spec.kind ?? "round";
  const h = Math.max(0.2, spec.height ?? DEFAULT_HEIGHT[kind]);
  addTrunk(b, kind, spec.x, spec.y, h);
  addCrown(b, kind, spec.x, spec.y, h, spec.seed ?? spec.x * 31 + spec.y * 17);
}

export interface TreeProps {
  kind?: TreeKind;
  /** Hauteur totale, en cases. */
  height?: number;
  /** Où est le pied de l'arbre, en cases. */
  origin?: { x: number; y: number };
  /** La graine de sa silhouette. */
  seed?: number;
  /** Le vent : la couronne se balance, doucement, au rythme de la simulation. */
  wind?: boolean;
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

export function Tree(props: TreeProps) {
  const { kind = "round", origin = { x: 0, y: 0 }, frame, cellSize = 40, className } = props;
  const h = props.height ?? DEFAULT_HEIGHT[kind];
  const w = kind === "poplar" ? h * 0.2 : kind === "bush" ? h * 0.9 : h * 0.45;
  return (
    <Solo bounds={frame ? frameBounds(frame) : { x0: origin.x - w, x1: origin.x + w, y0: origin.y - w, y1: origin.y + w, z0: 0, z1: h }} cellSize={cellSize} className={className} ariaLabel="Arbre">
      <TreeBody {...props} />
    </Solo>
  );
}

function TreeBody({ kind = "round", height, origin = { x: 0, y: 0 }, seed = 1, wind = true }: TreeProps) {
  const h = Math.max(0.2, height ?? DEFAULT_HEIGHT[kind]);
  const trunk = useBuilt(() => {
    const b = new Builder();
    addTrunk(b, kind, 0, 0, h);
    return b.build();
  }, [kind, h]);
  const crown = useBuilt(() => {
    const b = new Builder();
    addCrown(b, kind, 0, 0, h, seed);
    return b.build();
  }, [kind, h, seed]);
  const sway = useRef<Group>(null);
  useSimFrame((t) => {
    const g = sway.current;
    if (!g) return;
    // Deux fréquences qui ne se recoupent pas : un balancement qui ne se répète pas à l'œil.
    const k = 0.018 + 0.006 * Math.sin(t * 0.37 + seed);
    g.rotation.x = Math.sin(t * 1.1 + seed) * k;
    g.rotation.y = Math.sin(t * 0.83 + seed * 2) * k;
  }, wind && kind !== "bush");
  return (
    <group position={[origin.x, origin.y, 0]}>
      <Parts built={trunk} />
      <group ref={sway}>
        <Parts built={crown} />
      </group>
    </group>
  );
}

export interface TreesProps {
  /** Les arbres, chacun à sa place. Tous forment un seul maillage : un bois entier coûte un arbre. */
  trees: TreeSpec[];
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Un bosquet, un alignement, une haie : beaucoup d'arbres, immobiles, en un seul maillage. */
export function Trees(props: TreesProps) {
  const { trees, frame, cellSize = 24, className } = props;
  const xs = trees.map((t) => t.x);
  const ys = trees.map((t) => t.y);
  const hs = trees.map((t) => t.height ?? DEFAULT_HEIGHT[t.kind ?? "round"]);
  const pad = Math.max(0.5, ...hs) * 0.5;
  const bounds = trees.length
    ? { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad, z0: 0, z1: Math.max(...hs) }
    : { x0: 0, x1: 1, y0: 0, y1: 1, z0: 0, z1: 1 };
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Arbres">
      <TreesBody {...props} />
    </Solo>
  );
}

function TreesBody({ trees }: TreesProps) {
  const built = useBuilt(() => {
    const b = new Builder();
    for (const t of trees) addTree(b, t);
    return b.build();
  }, [JSON.stringify(trees)]);
  return <Parts built={built} />;
}

/** Un alignement : `count` arbres de `from` à `to`, en quinconce léger. */
export function treeLine(from: { x: number; y: number }, to: { x: number; y: number }, count: number, kind: TreeKind = "round", seed = 1): TreeSpec[] {
  const n = Math.max(1, Math.floor(count));
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return {
      x: from.x + (to.x - from.x) * t + (r() - 0.5) * 0.2,
      y: from.y + (to.y - from.y) * t + (r() - 0.5) * 0.2,
      kind,
      height: DEFAULT_HEIGHT[kind] * (0.85 + r() * 0.3),
      seed: seed * 100 + i,
    };
  });
}
