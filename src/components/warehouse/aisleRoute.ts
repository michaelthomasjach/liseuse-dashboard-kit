import { footprintOf, isLinear, type PlannerItem, type PlannerKind } from "./plannerModel";

/**
 * Le chemin d'un engin **dans les allées** : autour des racks, des étagères, des murs — et non plus
 * à travers.
 *
 * ## La méthode
 *
 *  1. **Une grille fine** (`cell`, un quart de case par défaut) couvre le départ, l'arrivée et les
 *     obstacles. Chaque obstacle y est **gonflé** de `clearance` — la demi-largeur de l'engin et une
 *     marge : un point de la grille hors des obstacles gonflés est un point où le centre de l'engin
 *     peut passer.
 *  2. **Le milieu des allées** : une carte des distances aux obstacles renchérit les cellules qui
 *     les frôlent. Le chemin le moins cher n'est pas le plus court qui rase les montants, mais celui
 *     qui garde ses distances — celui d'un cariste.
 *  3. **A\*** sur cette grille, en huit directions.
 *  4. **Le lissage** : on tire la ficelle — de chaque point, on file au plus loin qu'on voit sans
 *     toucher un obstacle gonflé d'une marge de plus (pour que l'arrondi des virages, que l'engin
 *     prend à son rayon de braquage, ne morde pas dessus).
 *  5. **Garder sa droite** (`lane`) : les points intérieurs sont décalés vers la droite du sens de
 *     la marche, si l'allée est assez large ; deux engins qui se croisent passent chacun de leur côté.
 *
 *  Un départ ou une arrivée **dans** un obstacle (une palette posée contre un rack) est ramené à la
 *  cellule libre la plus proche. Sans chemin possible, on rend la ligne droite — et un avertissement
 *  en développement — plutôt que de figer l'engin.
 *
 *  Les obstacles changent rarement, les trajets souvent : les résultats sont gardés, par départ,
 *  arrivée, obstacles et réglages.
 *
 * ## Le repère
 *
 *  Le plan, en cases. Un obstacle est l'emprise d'un élément du plan : **son centre**, sa longueur
 *  `width` le long de son axe, sa profondeur `depth` en travers, et sa `rotation` en degrés — la même
 *  convention que les éléments ponctuels de `WarehousePlanner` (`plannerObstacles` les en tire).
 */

export interface Pt {
  x: number;
  y: number;
}

export interface AisleObstacle {
  /** Le centre de l'emprise, en cases. */
  x: number;
  y: number;
  /** La longueur, le long de l'axe de l'élément. */
  width: number;
  /** La profondeur, en travers. */
  depth: number;
  /** En degrés. */
  rotation?: number;
}

export interface AisleRouteOptions {
  /** La marge à garder autour des obstacles : la demi-largeur de l'engin, et un peu. Défaut : 0,6. */
  clearance?: number;
  /** Le pas de la grille, en cases. Défaut : 0,25. */
  cell?: number;
  /** Garder sa droite de tant de cases, si l'allée le permet. Défaut : 0 (le milieu). */
  lane?: number;
  /** Ce qu'on ajoute autour pour contourner, en cases. Défaut : 4. */
  margin?: number;
}

/** La demi-largeur de chaque engin, et la marge qu'on garde : ce qu'on passe à `clearance`. */
export const VEHICLE_CLEARANCE: Record<"palletJack" | "forklift" | "worker" | "amr", number> = {
  palletJack: 0.6,
  forklift: 0.85,
  worker: 0.4,
  amr: 0.65,
};

/** Ce qui n'arrête pas un engin au sol : les toits et ce qui est dessus, ce qui est dans un mur, les
 *  tracés au sol et ce qui est au-dessus des têtes. */
const PASSABLE: PlannerKind[] = ["roof", "roofSolar", "hvac", "door", "window", "bay", "accessRoad", "powerLine", "gate", "monorail", "monoPicker", "light"] as PlannerKind[];

/**
 * Les obstacles d'un plan : l'emprise de chaque élément qui barre le passage au sol (racks,
 * étagères, murs, tapis, machines…). `except` : les éléments à ignorer — ceux qu'un engin dessert.
 */
export function plannerObstacles(items: PlannerItem[], opts: { except?: string[] } = {}): AisleObstacle[] {
  const out: AisleObstacle[] = [];
  for (const it of items) {
    if ((PASSABLE as string[]).includes(it.kind) || opts.except?.includes(it.id)) continue;
    if (!isLinear(it) && it.kind === "zone") continue;
    const f = footprintOf(it);
    out.push({ x: f.cx, y: f.cy, width: f.halfL * 2, depth: f.halfW * 2, rotation: (f.angle * 180) / Math.PI });
  }
  return out;
}

const cache = new Map<string, Pt[]>();
const CACHE_MAX = 300;

/** Le chemin de `from` à `to` dans les allées : une liste de points, du départ à l'arrivée. */
export function planAisleRoute(from: Pt, to: Pt, obstacles: AisleObstacle[], opts: AisleRouteOptions = {}): Pt[] {
  const key = JSON.stringify([from.x, from.y, to.x, to.y, obstacles.map((o) => [o.x, o.y, o.width, o.depth, o.rotation ?? 0]), opts.clearance, opts.cell, opts.lane, opts.margin]);
  const hit = cache.get(key);
  if (hit) return hit;
  const route = compute(from, to, obstacles, opts);
  cache.set(key, route);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return route;
}

function warn(msg: string) {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  if (env !== "production") console.warn(`[planAisleRoute] ${msg}`);
}

function compute(from: Pt, to: Pt, obstacles: AisleObstacle[], opts: AisleRouteOptions): Pt[] {
  const clearance = opts.clearance ?? 0.6;
  const cell = Math.max(0.1, opts.cell ?? 0.25);
  const margin = opts.margin ?? 4;
  if (!obstacles.length) return [from, to];

  // Seuls comptent les obstacles près du trajet : le pavé du départ et de l'arrivée, élargi.
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const reach = margin + span * 0.6 + 6;
  const near = obstacles.filter((o) => {
    const r = Math.hypot(o.width, o.depth) / 2 + clearance;
    return o.x + r > Math.min(from.x, to.x) - reach && o.x - r < Math.max(from.x, to.x) + reach && o.y + r > Math.min(from.y, to.y) - reach && o.y - r < Math.max(from.y, to.y) + reach;
  });
  let x0 = Math.min(from.x, to.x) - margin;
  let y0 = Math.min(from.y, to.y) - margin;
  let x1 = Math.max(from.x, to.x) + margin;
  let y1 = Math.max(from.y, to.y) + margin;
  for (const o of near) {
    const r = Math.hypot(o.width, o.depth) / 2 + clearance + 2;
    x0 = Math.min(x0, o.x - r);
    y0 = Math.min(y0, o.y - r);
    x1 = Math.max(x1, o.x + r);
    y1 = Math.max(y1, o.y + r);
  }
  const nx = Math.min(1200, Math.ceil((x1 - x0) / cell) + 1);
  const ny = Math.min(1200, Math.ceil((y1 - y0) / cell) + 1);
  const at = (i: number, j: number) => ({ x: x0 + i * cell, y: y0 + j * cell });

  // La distance de chaque cellule au plus proche obstacle (non gonflé), bornée : pour le prix des
  // cellules et pour savoir ce qui est libre.
  const CAP = clearance + 3;
  const dist = new Float32Array(nx * ny).fill(CAP);
  for (const o of near) {
    const th = ((o.rotation ?? 0) * Math.PI) / 180;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const hl = o.width / 2;
    const hw = o.depth / 2;
    const r = Math.hypot(hl, hw) + CAP;
    const i0 = Math.max(0, Math.floor((o.x - r - x0) / cell));
    const i1 = Math.min(nx - 1, Math.ceil((o.x + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((o.y - r - y0) / cell));
    const j1 = Math.min(ny - 1, Math.ceil((o.y + r - y0) / cell));
    for (let j = j0; j <= j1; j += 1)
      for (let i = i0; i <= i1; i += 1) {
        const px = x0 + i * cell - o.x;
        const py = y0 + j * cell - o.y;
        const u = Math.abs(px * c + py * s) - hl;
        const v = Math.abs(-px * s + py * c) - hw;
        const d = u <= 0 && v <= 0 ? 0 : Math.hypot(Math.max(0, u), Math.max(0, v));
        const k = j * nx + i;
        if (d < dist[k]) dist[k] = d;
      }
  }
  const free = (k: number, extra = 0) => dist[k] > clearance + extra;
  const idx = (p: Pt) => {
    const i = Math.max(0, Math.min(nx - 1, Math.round((p.x - x0) / cell)));
    const j = Math.max(0, Math.min(ny - 1, Math.round((p.y - y0) / cell)));
    return j * nx + i;
  };

  // Un bout dans un obstacle : la cellule libre la plus proche.
  const snap = (k: number): number => {
    if (free(k)) return k;
    const seen = new Uint8Array(nx * ny);
    const queue = [k];
    seen[k] = 1;
    for (let h = 0; h < queue.length; h += 1) {
      const q = queue[h];
      if (free(q)) return q;
      const i = q % nx;
      const j = (q - i) / nx;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const n = b * nx + a;
        if (!seen[n]) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    return k;
  };
  const sk = snap(idx(from));
  const gk = snap(idx(to));
  const start = at(sk % nx, Math.floor(sk / nx));
  const goal = at(gk % nx, Math.floor(gk / nx));

  // A* : le prix d'un pas est sa longueur, renchérie près des obstacles (le milieu des allées).
  const penalty = (k: number) => 1 + 1.6 * Math.max(0, 1 - (dist[k] - clearance) / 1.2);
  const g = new Float32Array(nx * ny).fill(Infinity);
  const came = new Int32Array(nx * ny).fill(-1);
  const closed = new Uint8Array(nx * ny);
  const heap = new Heap();
  const gi = gk % nx;
  const gj = Math.floor(gk / nx);
  const hOf = (k: number) => {
    const i = k % nx;
    const j = (k - i) / nx;
    const dx = Math.abs(i - gi);
    const dy = Math.abs(j - gj);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * cell;
  };
  g[sk] = 0;
  heap.push(sk, hOf(sk));
  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  let found = sk === gk;
  let guard = 0;
  while (heap.size && !found && guard++ < nx * ny * 2) {
    const k = heap.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === gk) {
      found = true;
      break;
    }
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj, len] of DIRS) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const n = b * nx + a;
      if (closed[n] || !free(n)) continue;
      // En diagonale, on ne coupe pas un coin.
      if (di && dj && (!free(j * nx + a) || !free(b * nx + i))) continue;
      const cost = g[k] + len * cell * penalty(n);
      if (cost < g[n]) {
        g[n] = cost;
        came[n] = k;
        heap.push(n, cost + hOf(n));
      }
    }
  }
  if (!found) {
    warn(`aucun chemin de (${from.x.toFixed(1)}, ${from.y.toFixed(1)}) à (${to.x.toFixed(1)}, ${to.y.toFixed(1)}) : ligne droite.`);
    return [from, to];
  }
  const cells: number[] = [];
  for (let k = gk; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const raw = cells.map((k) => at(k % nx, Math.floor(k / nx)));

  // Tirer la ficelle, sur une grille gonflée d'une marge de plus.
  const extra = 0.25;
  const sees = (a: Pt, b: Pt) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / (cell * 0.5)));
    for (let t = 0; t <= n; t += 1) {
      const k = idx({ x: a.x + ((b.x - a.x) * t) / n, y: a.y + ((b.y - a.y) * t) / n });
      if (!free(k, extra)) return false;
    }
    return true;
  };
  // Pour garder sa droite, il suffit de rester hors des obstacles gonflés, sans la marge de plus.
  const seesLane = (a: Pt, b: Pt) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / (cell * 0.5)));
    for (let t = 0; t <= n; t += 1) if (!free(idx({ x: a.x + ((b.x - a.x) * t) / n, y: a.y + ((b.y - a.y) * t) / n }))) return false;
    return true;
  };
  const pulled: Pt[] = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !sees(raw[i], raw[j])) j -= 1;
    pulled.push(raw[j]);
    i = j;
  }

  // Garder sa droite : chaque point intérieur glisse vers la droite de la marche, si c'est libre.
  const lane = opts.lane ?? 0;
  let path = pulled;
  if (lane > 0) {
    // Les longs tronçons sont recoupés, pour que le décalage vaille sur toute leur longueur et pas
    // seulement à leurs coins.
    const dense: Pt[] = [pulled[0]];
    for (let k = 1; k < pulled.length; k += 1) {
      const a = pulled[k - 1];
      const b = pulled[k];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5));
      for (let q = 1; q <= n; q += 1) dense.push({ x: a.x + ((b.x - a.x) * q) / n, y: a.y + ((b.y - a.y) * q) / n });
    }
    pulled.splice(0, pulled.length, ...dense);
  }
  if (lane > 0 && pulled.length > 2) {
    const shifted = pulled.map((p, k) => {
      if (k === 0 || k === pulled.length - 1) return p;
      const a = pulled[k - 1];
      const b = pulled[k + 1];
      const d1 = norm(p.x - a.x, p.y - a.y);
      const d2 = norm(b.x - p.x, b.y - p.y);
      // La bissectrice des deux normales à droite, allongée pour garder la même distance aux deux
      // tronçons.
      const n1 = { x: d1.y, y: -d1.x };
      const n2 = { x: d2.y, y: -d2.x };
      const m = norm(n1.x + n2.x, n1.y + n2.y);
      const k2 = Math.max(0.5, m.x * n1.x + m.y * n1.y);
      return { x: p.x + (m.x * lane) / k2, y: p.y + (m.y * lane) / k2 };
    });
    // Point par point : un point décalé n'est gardé que si l'on y va, et en repart, sans toucher un
    // obstacle ; sinon on reste au milieu à cet endroit (l'allée y est trop étroite pour deux).
    const kept: Pt[] = [pulled[0]];
    for (let k = 1; k < pulled.length; k += 1) {
      const cand = shifted[k];
      const next = pulled[k + 1] ?? cand;
      const ok = k < pulled.length - 1 && seesLane(kept[kept.length - 1], cand) && seesLane(cand, shifted[k + 1] && k + 1 < pulled.length - 1 ? shifted[k + 1] : next);
      kept.push(ok ? cand : pulled[k]);
    }
    path = kept;
  }
  // Les vrais bouts, s'ils étaient libres ; sinon la cellule libre où on les a ramenés.
  const out = [...path];
  if (free(idx(from))) out[0] = from;
  else out[0] = start;
  if (free(idx(to))) out[out.length - 1] = to;
  else out[out.length - 1] = goal;
  return out;
}

function norm(x: number, y: number) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

/** Un tas binaire de clés entières, par priorité croissante. */
class Heap {
  private keys: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(k: number, p: number) {
    const a = this.keys;
    const b = this.pri;
    a.push(k);
    b.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (b[up] <= b[i]) break;
      [a[up], a[i]] = [a[i], a[up]];
      [b[up], b[i]] = [b[i], b[up]];
      i = up;
    }
  }
  pop(): number {
    const a = this.keys;
    const b = this.pri;
    const top = a[0];
    const lk = a.pop() as number;
    const lp = b.pop() as number;
    if (a.length) {
      a[0] = lk;
      b[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && b[l] < b[m]) m = l;
        if (r < a.length && b[r] < b[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [b[m], b[i]] = [b[i], b[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Un point est-il dans un obstacle gonflé de `clearance` ? Pour vérifier un trajet, ou placer un
 * point de chargement hors des emprises.
 */
export function insideObstacle(p: Pt, obstacles: AisleObstacle[], clearance = 0): boolean {
  return obstacles.some((o) => {
    const th = ((o.rotation ?? 0) * Math.PI) / 180;
    const px = p.x - o.x;
    const py = p.y - o.y;
    const u = Math.abs(px * Math.cos(th) + py * Math.sin(th));
    const v = Math.abs(-px * Math.sin(th) + py * Math.cos(th));
    return u < o.width / 2 + clearance && v < o.depth / 2 + clearance;
  });
}
