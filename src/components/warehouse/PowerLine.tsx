import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";

/**
 * Les lignes électriques qui alimentent un site.
 *
 * Trois gabarits, du plus modeste au plus lourd — ce sont aussi les trois étapes d'un site qui
 * grandit et consomme davantage :
 * - `"wood"`     : la ligne basse tension sur **poteaux bois**, une traverse, deux conducteurs ;
 * - `"concrete"` : la ligne moyenne tension sur **poteaux béton**, un armement à trois isolateurs,
 *   trois conducteurs ;
 * - `"pylon"`    : la ligne haute tension sur **pylônes à treillis**, deux consoles, six
 *   conducteurs sous chaînes d'isolateurs.
 *
 * Les câbles ne sont pas tendus droit : entre deux supports ils **fléchissent** — une chaînette,
 * approchée ici par une parabole —, et c'est cette courbe qui les fait lire comme des câbles et
 * non comme des barres. La ligne court le long des `x` sur `length`, les supports régulièrement
 * espacés, un à chaque bout.
 */

export type PowerLineKind = "wood" | "concrete" | "pylon";

export interface PowerLineProps {
  kind?: PowerLineKind;
  /** Longueur de la ligne, en cases (une case vaut deux mètres). */
  length?: number;
  /** L'écart visé entre deux supports, en cases. Par défaut, celui du gabarit. */
  span?: number;
  rotation?: number;
  /** Où commence la ligne, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Hauteur d'un support, écart ordinaire entre deux, largeur de l'armement — en cases. */
const SPEC: Record<PowerLineKind, { height: number; span: number; arm: number; sag: number }> = {
  wood: { height: 4, span: 12, arm: 0.5, sag: 0.25 },
  concrete: { height: 5.5, span: 15, arm: 0.8, sag: 0.35 },
  pylon: { height: 11, span: 30, arm: 2.2, sag: 0.9 },
};

/** Les points d'attache des conducteurs sur un support, dans son repère : `(y, z)`. */
function attachments(kind: PowerLineKind): [number, number][] {
  const s = SPEC[kind];
  if (kind === "wood") return [[-s.arm * 0.8, s.height - 0.12], [s.arm * 0.8, s.height - 0.12]];
  if (kind === "concrete") return [[-s.arm, s.height - 0.25], [0, s.height + 0.15], [s.arm, s.height - 0.25]];
  const out: [number, number][] = [];
  for (const [z, w] of [
    [s.height * 0.72, s.arm],
    [s.height * 0.88, s.arm * 0.8],
  ] as const)
    for (const side of [-1, 1]) out.push([side * w, z - 0.9]);
  out.push([-s.arm * 0.6, s.height * 0.58 - 0.9], [s.arm * 0.6, s.height * 0.58 - 0.9]);
  return out;
}

/** Un support, pied en `(x, 0, 0)`. */
function addSupport(b: Builder, kind: PowerLineKind, x: number) {
  const s = SPEC[kind];
  if (kind === "wood") {
    b.cylinder("bark", x, 0, s.height / 2, 0.07, s.height, "z", 8, 0.055);
    b.box("bark", x - 0.04, x + 0.04, -s.arm, s.arm, s.height - 0.3, s.height - 0.22);
    for (const [y, z] of attachments(kind)) b.cylinder("lamp", x, y, z - 0.06, 0.03, 0.12, "z", 8);
    return;
  }
  if (kind === "concrete") {
    // Un poteau béton, de section carrée, qui s'affine en montant, et son armement en acier.
    b.hexa("slab", [
      [x - 0.1, -0.1, 0],
      [x + 0.1, -0.1, 0],
      [x + 0.1, 0.1, 0],
      [x - 0.1, 0.1, 0],
      [x - 0.06, -0.06, s.height + 0.2],
      [x + 0.06, -0.06, s.height + 0.2],
      [x + 0.06, 0.06, s.height + 0.2],
      [x - 0.06, 0.06, s.height + 0.2],
    ]);
    b.box("steel", x - 0.04, x + 0.04, -s.arm - 0.1, s.arm + 0.1, s.height - 0.45, s.height - 0.37);
    for (const [y, z] of attachments(kind)) b.cylinder("lamp", x, y, z - 0.1, 0.035, 0.2, "z", 8);
    return;
  }
  // Le pylône : quatre membrures qui s'effilent, un treillis de diagonales, les consoles.
  const base = 1.2;
  const topW = 0.35;
  const H = s.height;
  const at = (u: number) => base + (topW - base) * u;
  const corner = (sx: number, sy: number, z: number): P3 => {
    const w = at(z / H) / 2;
    return [x + sx * w, sy * w, z];
  };
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.beam("iron", corner(sx, sy, 0), corner(sx, sy, H), 0.035, false);
  const levels = 8;
  for (let i = 0; i < levels; i += 1) {
    const z0 = (H * i) / levels;
    const z1 = (H * (i + 1)) / levels;
    for (const [a, c] of [
      [[-1, -1], [1, -1]],
      [[1, -1], [1, 1]],
      [[1, 1], [-1, 1]],
      [[-1, 1], [-1, -1]],
    ] as const) {
      b.beam("iron", corner(a[0], a[1], z0), corner(c[0], c[1], z1), 0.015, false);
      b.beam("iron", corner(c[0], c[1], z0), corner(a[0], a[1], z1), 0.015, false);
    }
  }
  for (const [z, w] of [
    [H * 0.72, s.arm],
    [H * 0.88, s.arm * 0.8],
    [H * 0.58, s.arm * 0.6],
  ] as const) {
    b.beam("iron", [x, -w, z], [x, w, z], 0.04, false);
    b.beam("iron", [x, -w, z], [x, -at(z / H) / 2, z + 0.5], 0.02, false);
    b.beam("iron", [x, w, z], [x, at(z / H) / 2, z + 0.5], 0.02, false);
  }
  // Le câble de garde, au sommet.
  b.cylinder("iron", x, 0, H + 0.3, 0.04, 0.6, "z", 6);
  for (const [y, z] of attachments(kind)) b.cylinder("lamp", x, y, z + 0.45, 0.05, 0.9, "z", 8);
}

function layout(p: PowerLineProps) {
  const kind = p.kind ?? "wood";
  const L = Math.max(1, p.length ?? 24);
  const want = Math.max(2, p.span ?? SPEC[kind].span);
  const n = Math.max(1, Math.round(L / want));
  return { kind, L, n, step: L / n };
}

function buildLine(p: PowerLineProps) {
  const { kind, n, step } = layout(p);
  const b = new Builder();
  for (let i = 0; i <= n; i += 1) addSupport(b, kind, i * step);
  // Les conducteurs : une parabole entre deux attaches, creusée de la flèche du gabarit.
  const wires: [P3, P3][] = [];
  const sag = SPEC[kind].sag * (step / SPEC[kind].span);
  for (const [y, z] of attachments(kind))
    for (let i = 0; i < n; i += 1) {
      const x0 = i * step;
      const seg = 12;
      for (let k = 0; k < seg; k += 1) {
        const u0 = k / seg;
        const u1 = (k + 1) / seg;
        const zz = (u: number) => z - 4 * sag * u * (1 - u);
        wires.push([[x0 + step * u0, y, zz(u0)], [x0 + step * u1, y, zz(u1)]]);
      }
    }
  if (kind === "pylon")
    for (let i = 0; i < n; i += 1) {
      const H = SPEC.pylon.height + 0.6;
      const x0 = i * step;
      for (let k = 0; k < 12; k += 1) {
        const u0 = k / 12;
        const u1 = (k + 1) / 12;
        wires.push([[x0 + step * u0, 0, H - 4 * 0.5 * u0 * (1 - u0)], [x0 + step * u1, 0, H - 4 * 0.5 * u1 * (1 - u1)]]);
      }
    }
  b.lines("lq-powerline__wire", wires);
  return b.build();
}

export function PowerLine(props: PowerLineProps) {
  const { kind = "wood", rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 20, className } = props;
  const { L } = layout(props);
  const s = SPEC[kind];
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L, y0: -s.arm - 0.3, y1: s.arm + 0.3, z0: 0, z1: s.height + 1 }, { x: L / 2, y: 0 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={className} ariaLabel="Ligne électrique">
      <PowerLineBody {...props} />
    </Solo>
  );
}

function PowerLineBody(props: PowerLineProps) {
  const { rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { L } = layout(props);
  const built = useBuilt(() => buildLine(props), [props.kind, props.length, props.span]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: 0, z0: 0, z1: 1 }, { x: L / 2, y: 0 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

/** L'emprise transversale d'une ligne, en cases : ce que couvrent ses armements. */
export function powerLineWidth(kind: PowerLineKind): number {
  return SPEC[kind].arm * 2 + 0.2;
}
