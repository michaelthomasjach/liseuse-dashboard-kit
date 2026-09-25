import { Builder, type P2, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { transformTrack } from "./three/transport";
import { rng } from "./three/random";

/**
 * Les voies d'un site : la route qui y mène, la rue qui le longe, les carrefours qui les relient.
 *
 * ## Des tuiles qui se raccordent
 *
 * Une route est faite de **tuiles** — `"straight"`, `"corner"`, `"tee"`, `"cross"` — de même
 * largeur, qu'on met bout à bout comme les tapis d'une ligne. Toutes se décrivent dans le même
 * repère : la chaussée court le long des `x`, centrée en `y = width / 2`, et une tuile d'angle ou de
 * carrefour est un carré de côté `width`. Deux tuiles jointives ont donc leurs chaussées, leurs
 * trottoirs et leurs marquages exactement dans le prolongement l'un de l'autre.
 *
 * - `"straight"` : un tronçon droit de longueur `length` ;
 * - `"corner"`   : un virage d'un quart de tour, qui entre par le bord `x = 0` et sort par le bord
 *   `y = width` — pour tourner de l'autre côté, on le tourne ;
 * - `"tee"`      : la chaussée traverse, une branche part par le bord `y = width` ;
 * - `"cross"`    : un carrefour à quatre branches.
 *
 * ## Ce qui est dessiné
 *
 * La chaussée, en enrobé sombre, affleure le sol. Les **trottoirs** sont en surélévation, bordés de
 * leur bordure — c'est la marche qui fait qu'on les lit comme des trottoirs et non comme une bande
 * peinte. Le marquage est en peinture blanche : ligne axiale discontinue, lignes de rive, passage
 * piéton (`crosswalk`) et, dans un carrefour, les lignes d'arrêt.
 *
 * ## Les voies de circulation
 *
 * `roadTrack` donne l'axe d'une voie, en coordonnées monde — ce que suit une voiture ou un camion
 * (`follow`). On roule à droite : sur une tuile droite, la voie `0` va vers les `x` croissants, la
 * voie `1` en sens inverse.
 */

export type RoadKind = "straight" | "corner" | "tee" | "cross";

export interface RoadProps {
  kind?: RoadKind;
  /** Longueur d'un tronçon droit, en cases (une case vaut deux mètres). */
  length?: number;
  /** Nombre de voies de circulation, toutes directions confondues. */
  lanes?: number;
  /** Largeur d'une voie, en cases. 1,75 : trois mètres cinquante. */
  laneWidth?: number;
  /** Largeur d'un trottoir, en cases. `0` : une route de campagne, sans trottoir. */
  sidewalk?: number;
  /** Un passage piéton sur un tronçon droit : au début, à la fin, aux deux bouts. */
  crosswalk?: "start" | "end" | "both";
  /** La ligne axiale : discontinue, continue, ou aucune. */
  centerLine?: "dashed" | "solid" | "none";
  /**
   * Des **bateaux** sur un tronçon droit : là où une voie d'accès vient se brancher, le trottoir est
   * ouvert — l'enrobé de la chaussée court jusqu'à son bord — et descend en pente douce de part et
   * d'autre de l'ouverture. `side` : le trottoir en `y = 0` (`0`) ou en `y = width` (`1`) ; `from` et
   * `to` : l'ouverture, le long des `x` de la tuile, en cases.
   */
  driveways?: RoadDriveway[];
  /** Rotation sur le sol, en degrés, autour du centre de la tuile. */
  rotation?: number;
  /** Où poser le coin de la tuile, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** Une ouverture du trottoir d'un tronçon droit (voir `RoadProps.driveways`). */
export interface RoadDriveway {
  side: 0 | 1;
  from: number;
  to: number;
}

/** Le dessus de la chaussée : un rien au-dessus du sol, pour ne pas s'y confondre. */
const TOP = 0.02;
/** Le dessus de la chaussée, exporté pour ce qui vient s'y raccorder à fleur (une voie d'accès). */
export const ROAD_SURFACE = TOP;
/** La hauteur d'un trottoir au-dessus de la chaussée : 160 mm. */
const KERB = 0.08;
/** L'épaisseur d'une ligne peinte : 150 mm. */
const PAINT = 0.075;

function roadLayout(p: RoadProps) {
  const kind = p.kind ?? "straight";
  const lanes = Math.max(1, Math.round(p.lanes ?? 2));
  const lw = Math.max(0.8, p.laneWidth ?? 1.75);
  const sw = Math.max(0, p.sidewalk ?? 1);
  const carriage = lanes * lw;
  const W = carriage + 2 * sw;
  const L = kind === "straight" ? Math.max(0.5, p.length ?? 8) : W;
  return { kind, lanes, lw, sw, carriage, W, L };
}

/** Un quart de disque, ou un quart d'anneau, autour de `(cx, cy)`, de l'angle `a0` à `a1`. */
function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, steps = 14): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + r1 * Math.cos(a), y: cy + r1 * Math.sin(a) });
  }
  if (r0 <= 1e-4) out.push({ x: cx, y: cy });
  else
    for (let i = steps; i >= 0; i -= 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      out.push({ x: cx + r0 * Math.cos(a), y: cy + r0 * Math.sin(a) });
    }
  return out;
}

/** Une bande de peinture le long d'une polyligne au sol. */
function paintAlong(b: Builder, pts: P2[], half: number, dash?: { on: number; off: number }) {
  // On découpe la polyligne en longueur, puis on peint les tronçons « pleins ».
  const seg: { a: P2; b: P2; s0: number; s1: number }[] = [];
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push({ a: pts[i - 1], b: pts[i], s0: s, s1: s + d });
    s += d;
  }
  const total = s;
  const at = (u: number): P2 & { nx: number; ny: number } => {
    const k = seg.find((q) => u <= q.s1 + 1e-9) ?? seg[seg.length - 1];
    const t = (u - k.s0) / (k.s1 - k.s0 || 1);
    const dx = k.b.x - k.a.x;
    const dy = k.b.y - k.a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: k.a.x + dx * t, y: k.a.y + dy * t, nx: -dy / l, ny: dx / l };
  };
  const strip = (u0: number, u1: number) => {
    const n = Math.max(1, Math.ceil((u1 - u0) / 0.3));
    for (let i = 0; i < n; i += 1) {
      const p = at(u0 + ((u1 - u0) * i) / n);
      const q = at(u0 + ((u1 - u0) * (i + 1)) / n);
      b.decal("lq-road__mark", [
        [p.x + p.nx * half, p.y + p.ny * half, TOP],
        [q.x + q.nx * half, q.y + q.ny * half, TOP],
        [q.x - q.nx * half, q.y - q.ny * half, TOP],
        [p.x - p.nx * half, p.y - p.ny * half, TOP],
      ]);
    }
  };
  if (!dash) return strip(0, total);
  const period = dash.on + dash.off;
  // Les tirets sont centrés sur la tuile : deux tuiles jointives gardent un rythme régulier.
  const count = Math.max(1, Math.floor(total / period));
  const lead = (total - count * period + dash.off) / 2;
  for (let i = 0; i < count; i += 1) strip(lead + i * period, lead + i * period + dash.on);
}

/** Un trottoir : une dalle surélevée de contour `ring`, sa bordure comprise. */
function sidewalkPiece(b: Builder, ring: P2[]) {
  b.prism("pavement", ring, -0.04, TOP + KERB);
}

/** La longueur de la pente d'un bateau, de chaque côté de l'ouverture. */
const RAMP = 0.6;
/** Ce qui reste de bordure au droit d'un bateau : une bordure abaissée, à peine une marche. */
const LOW_KERB = 0.012;

/**
 * Le trottoir d'un tronçon droit, de `y0` à `y1`, ouvert là où passent des bateaux.
 *
 *  Entre deux ouvertures, la dalle surélevée ordinaire ; à l'approche d'une ouverture, elle descend
 *  en pente — un profil en biais, extrudé sur la largeur du trottoir — jusqu'à la bordure abaissée ;
 *  dans l'ouverture, plus de dalle du tout : l'enrobé de la chaussée, posé sous toute la tuile,
 *  affleure, et seule une bordure couchée marque encore le fil d'eau.
 */
function sidewalkWithCuts(b: Builder, L: number, y0: number, y1: number, cuts: { from: number; to: number }[], edgeY: number) {
  const sorted = cuts.map((c) => ({ from: Math.max(0, c.from), to: Math.min(L, c.to) })).filter((c) => c.to - c.from > 0.05).sort((a, c) => a.from - c.from);
  let x = 0;
  const slab = (a: number, c: number) => {
    if (c - a > 0.01) sidewalkPiece(b, [{ x: a, y: y0 }, { x: c, y: y0 }, { x: c, y: y1 }, { x: a, y: y1 }]);
  };
  for (const cut of sorted) {
    const r0 = Math.max(x, cut.from - RAMP);
    slab(x, r0);
    // La pente d'avant l'ouverture : de la hauteur du trottoir à celle de la bordure abaissée.
    if (cut.from - r0 > 0.01)
      b.profile("pavement", [{ x: r0, y: -0.04 }, { x: cut.from, y: -0.04 }, { x: cut.from, y: TOP + LOW_KERB }, { x: r0, y: TOP + KERB }], y0, y1, { edges: false });
    const r1 = Math.min(L, cut.to + RAMP);
    if (r1 - cut.to > 0.01)
      b.profile("pavement", [{ x: cut.to, y: -0.04 }, { x: r1, y: -0.04 }, { x: r1, y: TOP + KERB }, { x: cut.to, y: TOP + LOW_KERB }], y0, y1, { edges: false });
    // La bordure couchée, au fil de la chaussée.
    // Elle est côté trottoir du fil d'eau : en deçà pour le trottoir bas, au-delà pour le haut.
    const inward = y1 > edgeY ? 1 : -1;
    b.box("kerb", cut.from, cut.to, Math.min(edgeY, edgeY + inward * 0.12), Math.max(edgeY, edgeY + inward * 0.12), -0.02, TOP + LOW_KERB, false);
    x = Math.max(x, r1);
  }
  slab(x, L);
}

/** Un passage piéton en travers de la chaussée, à l'abscisse `x`. */
function zebra(b: Builder, x: number, sw: number, carriage: number) {
  const bar = 0.25;
  const n = Math.floor(carriage / (bar * 2));
  const lead = (carriage - (n * 2 - 1) * bar) / 2;
  for (let i = 0; i < n; i += 1) {
    const y0 = sw + lead + i * bar * 2;
    b.faceZ("lq-road__mark", TOP, x - 0.6, x + 0.6, y0, y0 + bar);
  }
}

function buildRoad(p: RoadProps) {
  const { kind, lanes, lw, sw, carriage, W, L } = roadLayout(p);
  const b = new Builder();
  const centerLine = p.centerLine ?? "dashed";
  const dash = { on: 1.5, off: 1.5 };
  // La chaussée : un seul pavé qui couvre la tuile, les trottoirs viennent dessus.
  b.box("asphalt", 0, L, 0, W, -0.04, TOP);

  /** Les lignes d'une chaussée droite, de `x0` à `x1`. */
  const straightMarks = (x0: number, x1: number, edges: boolean) => {
    if (edges) {
      paintAlong(b, [{ x: x0, y: sw + 0.15 }, { x: x1, y: sw + 0.15 }], PAINT / 2);
      paintAlong(b, [{ x: x0, y: W - sw - 0.15 }, { x: x1, y: W - sw - 0.15 }], PAINT / 2);
    }
    for (let i = 1; i < lanes; i += 1) {
      const y = sw + i * lw;
      const axis = lanes % 2 === 0 && i === lanes / 2;
      if (axis && centerLine === "none") continue;
      paintAlong(b, [{ x: x0, y }, { x: x1, y }], PAINT / 2, axis && centerLine === "solid" ? undefined : dash);
    }
  };

  if (kind === "straight") {
    if (sw > 0) {
      const cuts = p.driveways ?? [];
      sidewalkWithCuts(b, L, 0, sw, cuts.filter((c) => c.side === 0), sw);
      sidewalkWithCuts(b, L, W - sw, W, cuts.filter((c) => c.side === 1), W - sw);
    }
    straightMarks(0, L, true);
    const cw = p.crosswalk;
    if (cw === "start" || cw === "both") zebra(b, 1, sw, carriage);
    if (cw === "end" || cw === "both") zebra(b, L - 1, sw, carriage);
    // Le grain de l'enrobé : des regards au milieu d'une voie, des fissures qui courent.
    const r = rng(Math.round(L * 131 + lanes * 7 + sw * 3));
    for (let x = 3 + r() * 3; x < L - 2; x += 7 + r() * 5) {
      const y = sw + lw * (0.5 + Math.floor(r() * lanes));
      const ring: P3[] = [];
      for (let i = 0; i < 14; i += 1) ring.push([x + Math.cos((i / 14) * Math.PI * 2) * 0.28, y + Math.sin((i / 14) * Math.PI * 2) * 0.28, TOP + 0.001]);
      b.decal("lq-road__manhole", ring, true);
    }
    const cracks: [P3, P3][] = [];
    for (let k = 0; k < Math.round(L / 3); k += 1) {
      let x = r() * L;
      let y = sw + 0.2 + r() * (carriage - 0.4);
      for (let j = 0; j < 4; j += 1) {
        const nx = Math.min(L, Math.max(0, x + (r() - 0.5) * 0.9));
        const ny = Math.min(W - sw - 0.1, Math.max(sw + 0.1, y + (r() - 0.5) * 0.5));
        cracks.push([[x, y, TOP + 0.0012], [nx, ny, TOP + 0.0012]]);
        x = nx;
        y = ny;
      }
    }
    b.lines("lq-road__crack", cracks);
    return b.build();
  }

  if (kind === "corner") {
    // Le virage tourne autour du coin `(0, W)` : il entre par `x = 0` et sort par `y = W`.
    const cx = 0;
    const cy = W;
    const a0 = -Math.PI / 2;
    const a1 = 0;
    if (sw > 0) {
      // Le trottoir intérieur, un quart de disque ; l'extérieur, un quart d'anneau et le coin.
      sidewalkPiece(b, sector(cx, cy, 0, sw, a0, a1));
      sidewalkPiece(b, sector(cx, cy, W - sw, W, a0, a1));
      const arc = sector(cx, cy, 0, W, a0, a1).slice(0, -1).reverse();
      sidewalkPiece(b, [{ x: W, y: 0 }, ...arc]);
    }
    const arcAt = (r: number) => Array.from({ length: 25 }, (_, i) => ({ x: cx + r * Math.cos(a0 + ((a1 - a0) * i) / 24), y: cy + r * Math.sin(a0 + ((a1 - a0) * i) / 24) }));
    paintAlong(b, arcAt(sw + 0.15), PAINT / 2);
    paintAlong(b, arcAt(W - sw - 0.15), PAINT / 2);
    for (let i = 1; i < lanes; i += 1) {
      const r = W - sw - i * lw;
      const axis = lanes % 2 === 0 && i === lanes / 2;
      if (axis && centerLine === "none") continue;
      paintAlong(b, arcAt(r), PAINT / 2, axis && centerLine === "solid" ? undefined : { on: 1, off: 1 });
    }
    return b.build();
  }

  // Le té et le carrefour : des trottoirs aux angles, en quart de disque, et des lignes d'arrêt.
  const corners: { cx: number; cy: number; a0: number }[] = [
    { cx: 0, cy: W, a0: -Math.PI / 2 },
    { cx: W, cy: W, a0: Math.PI },
  ];
  if (kind === "cross") corners.push({ cx: 0, cy: 0, a0: 0 }, { cx: W, cy: 0, a0: Math.PI / 2 });
  if (sw > 0) {
    for (const c of corners) sidewalkPiece(b, sector(c.cx, c.cy, 0, sw, c.a0, c.a0 + Math.PI / 2));
    if (kind === "tee") sidewalkPiece(b, [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: sw }, { x: 0, y: sw }]);
  }
  // Les lignes d'arrêt, en travers de la voie qui arrive, sur chaque branche.
  const stop = (x0: number, y0: number, x1: number, y1: number) => paintAlong(b, [{ x: x0, y: y0 }, { x: x1, y: y1 }], 0.1);
  const mid = W / 2;
  stop(sw + 0.3, sw, sw + 0.3, mid);
  stop(W - sw - 0.3, mid, W - sw - 0.3, W - sw);
  stop(sw, W - sw - 0.3, mid, W - sw - 0.3);
  if (kind === "cross") stop(mid, sw + 0.3, W - sw, sw + 0.3);
  if (kind === "tee") paintAlong(b, [{ x: 0, y: sw + 0.15 }, { x: W, y: sw + 0.15 }], PAINT / 2);
  return b.build();
}

/**
 * L'axe d'une voie de circulation, en coordonnées monde : ce que suit un véhicule.
 *
 *  On roule à droite. Sur un tronçon droit, la voie `0` va vers les `x` croissants ; sur un virage,
 *  elle entre par `x = 0` et sort par `y = width`. `reverse` parcourt la tuile dans l'autre sens —
 *  c'est l'autre moitié de la chaussée. Le té et le carrefour se traversent tout droit.
 */
export function roadTrack(p: RoadProps, opts: { lane?: number; reverse?: boolean } = {}): P3[] {
  const { kind, lanes, lw, sw, W, L } = roadLayout(p);
  const perSide = Math.max(1, Math.floor(lanes / 2));
  const lane = Math.max(0, Math.min(perSide - 1, opts.lane ?? 0));
  const rev = opts.reverse ?? false;
  const z = TOP;
  // Rouler à droite : dans le sens des `x`, la moitié basse ; dans l'autre, la moitié haute.
  const offset = lanes === 1 ? W / 2 : rev ? W - sw - (lane + 0.5) * lw : sw + (lane + 0.5) * lw;
  const local: P3[] = [];
  if (kind === "corner") {
    const r = W - offset;
    for (let i = 0; i <= 24; i += 1) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / 24);
      local.push([r * Math.cos(a), W + r * Math.sin(a), z]);
    }
    if (rev) local.reverse();
  } else {
    local.push([0, offset, z], [L, offset, z]);
    if (rev) local.reverse();
  }
  const { pose } = placed(p.origin ?? { x: 0, y: 0 }, p.rotation ?? 0, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return transformTrack(local, pose);
}

/** L'emprise d'une tuile — longueur le long des `x`, largeur le long des `y` — avant rotation. */
export function roadSize(p: RoadProps): { length: number; width: number } {
  const { L, W } = roadLayout(p);
  return { length: L, width: W };
}

export function Road(props: RoadProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 24, className, kind = "straight" } = props;
  const { L, W } = roadLayout(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: -0.05, z1: 0.3 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-road", className].filter(Boolean).join(" ")} ariaLabel={kind === "straight" ? "Route" : "Carrefour"}>
      <RoadBody {...props} />
    </Solo>
  );
}

function RoadBody(props: RoadProps) {
  const { rotation = 0, origin = { x: 0, y: 0 } } = props;
  const { L, W } = roadLayout(props);
  const cutKey = JSON.stringify(props.driveways ?? []);
  const built = useBuilt(() => buildRoad(props), [props.kind, props.length, props.lanes, props.laneWidth, props.sidewalk, props.crosswalk, props.centerLine, cutKey]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: W, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

// --- La voie d'accès ---------------------------------------------------------------------------------

export interface AccessRoadProps {
  /** La longueur de la voie, en cases, le long des `x`. */
  length?: number;
  /** Une voie à double sens unique (`1`), ou deux voies (`2`). */
  lanes?: 1 | 2;
  /** Un trottoir de chaque côté, au lieu d'une simple bordure. */
  sidewalk?: boolean;
  /** La largeur totale, bordures ou trottoirs compris, en cases. Défaut : 2,2 · 3,6 · 4,6. */
  width?: number;
  /** Rotation sur le sol, en degrés, autour du centre de la voie. */
  rotation?: number;
  /** Où poser le coin de la voie, en cases. */
  origin?: { x: number; y: number };
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  cellSize?: number;
  className?: string;
}

/** La largeur d'une voie d'accès, bordures comprises. */
export function accessRoadWidth(p: Pick<AccessRoadProps, "lanes" | "sidewalk" | "width">): number {
  return p.width ?? (p.sidewalk ? 4.6 : (p.lanes ?? 2) === 1 ? 2.2 : 3.6);
}

/** Une flèche peinte au sol, pointe vers `dir` (±1 le long des `x`), centrée en `(x, y)`. */
function groundArrow(b: Builder, x: number, y: number, dir: 1 | -1, half = false) {
  const z = TOP + 0.0015;
  const at = (u: number, v: number): P3 => [x + u * dir, y + v * dir, z];
  // `half` : la moitié d'une flèche double — un fût court, la pointe au bout.
  const tail = half ? -0.35 : -0.7;
  b.decal("lq-road__arrow", [at(tail, -0.06), at(0.05, -0.06), at(0.05, 0.06), at(tail, 0.06)]);
  b.decal("lq-road__arrow", [at(0.05, -0.24), at(0.65, 0), at(0.05, 0.24)]);
}

function buildAccessRoad(p: AccessRoadProps) {
  const L = Math.max(0.5, p.length ?? 10);
  const lanes = p.lanes ?? 2;
  const T = accessRoadWidth(p);
  const b = new Builder();
  // L'enrobé, le même que celui de la rue : une voie d'accès est une rue qui entre chez soi.
  b.box("asphalt", 0, L, 0, T, -0.04, TOP);
  // Sur les côtés, des trottoirs de la rue en plus étroit, ou une simple bordure — la marche qui fait
  // lire une chaussée plutôt qu'une bande peinte.
  const side = p.sidewalk ? Math.min(0.5, T / 6) : Math.min(0.14, T / 10);
  if (p.sidewalk) {
    sidewalkPiece(b, [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: side }, { x: 0, y: side }]);
    sidewalkPiece(b, [{ x: 0, y: T - side }, { x: L, y: T - side }, { x: L, y: T }, { x: 0, y: T }]);
  } else {
    b.box("kerb", 0, L, 0, side, -0.04, TOP + KERB * 0.75);
    b.box("kerb", 0, L, T - side, T, -0.04, TOP + KERB * 0.75);
  }
  const c0 = side;
  const c1 = T - side;
  // Les lignes de rive, et l'axe discontinu d'une voie double.
  paintAlong(b, [{ x: 0, y: c0 + 0.12 }, { x: L, y: c0 + 0.12 }], PAINT / 2);
  paintAlong(b, [{ x: 0, y: c1 - 0.12 }, { x: L, y: c1 - 0.12 }], PAINT / 2);
  if (lanes === 2) paintAlong(b, [{ x: 0, y: (c0 + c1) / 2 }, { x: L, y: (c0 + c1) / 2 }], PAINT / 2, { on: 1.5, off: 1.5 });
  // Une flèche à chaque bout, discrète : on roule à droite, la voie basse va vers les `x` croissants.
  if (L >= 4) {
    const inset = Math.min(1.6, L / 4);
    if (lanes === 2) {
      const yIn = c0 + (c1 - c0) * 0.25;
      const yOut = c0 + (c1 - c0) * 0.75;
      groundArrow(b, inset, yIn, 1);
      groundArrow(b, L - inset, yOut, -1);
      if (L >= 9) {
        groundArrow(b, L - inset - 1.6, yIn, 1);
        groundArrow(b, inset + 1.6, yOut, -1);
      }
    } else {
      // Une voie unique se prend dans les deux sens : une flèche double à chaque bout.
      for (const x of [inset, L - inset]) {
        groundArrow(b, x + 0.35, (c0 + c1) / 2, 1, true);
        groundArrow(b, x - 0.35, (c0 + c1) / 2, -1, true);
      }
    }
  }
  // Le grain de l'enrobé : quelques fissures, tirées de la longueur — deux voies pareilles se
  // ressemblent.
  const r = rng(Math.round(L * 53 + T * 11));
  const cracks: [P3, P3][] = [];
  for (let k = 0; k < Math.round(L / 4); k += 1) {
    let x = r() * L;
    let y = c0 + 0.2 + r() * Math.max(0.1, c1 - c0 - 0.4);
    for (let j = 0; j < 3; j += 1) {
      const nx = Math.min(L, Math.max(0, x + (r() - 0.5) * 0.8));
      const ny = Math.min(c1 - 0.1, Math.max(c0 + 0.1, y + (r() - 0.5) * 0.4));
      cracks.push([[x, y, TOP + 0.0012], [nx, ny, TOP + 0.0012]]);
      x = nx;
      y = ny;
    }
  }
  b.lines("lq-road__crack", cracks);
  return b.build();
}

/**
 * Une **voie d'accès** : la route qui entre sur le terrain, depuis la rue jusqu'aux quais.
 *
 *  C'est un tronçon de rue en plus modeste — même enrobé, mêmes lignes blanches —, le long des `x` :
 *  une voie unique bordée, deux voies séparées d'un axe discontinu, ou deux voies et leurs trottoirs.
 *  Une flèche au sol à chaque bout dit dans quel sens on y roule. Elle ne sait rien de la rue : c'est
 *  le terrain (`BuildPlot.driveways`) qui ouvre le trottoir et prolonge l'enrobé jusqu'à la
 *  chaussée, là où un bout de la voie arrive au bord (voir `accessRoadLinks`).
 */
export function AccessRoad(props: AccessRoadProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, cellSize = 24, className } = props;
  const L = Math.max(0.5, props.length ?? 10);
  const T = accessRoadWidth(props);
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: T, z0: -0.05, z1: 0.3 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-road", className].filter(Boolean).join(" ")} ariaLabel="Voie d'accès">
      <AccessRoadBody {...props} />
    </Solo>
  );
}

function AccessRoadBody(props: AccessRoadProps) {
  const { rotation = 0, origin = { x: 0, y: 0 } } = props;
  const L = Math.max(0.5, props.length ?? 10);
  const T = accessRoadWidth(props);
  const built = useBuilt(() => buildAccessRoad(props), [L, props.lanes, props.sidewalk, props.width]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: L, y0: 0, y1: T, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
