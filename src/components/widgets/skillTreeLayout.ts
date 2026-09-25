import type { SkillTreeBranch, SkillTreeNode } from "./SkillTree";

/**
 * La disposition « en arbre » du `SkillTree` : un calcul pur, sans DOM, qui reçoit les nœuds et les
 * branches et rend des positions, des tracés et des repères — ce que le composant n'a plus qu'à
 * poser.
 *
 * ## Le repère
 *
 * On travaille dans un plan où `x` croît vers la droite et `y` vers le bas, comme en SVG ; l'axe du
 * tronc est `x = 0`. Chaque nœud est représenté par le centre de sa pastille ronde : c'est là que
 * les membres de l'arbre viennent le toucher. Son étiquette pend dessous ; la boîte d'encombrement
 * qu'on protège des collisions couvre donc la pastille et son étiquette, décalée vers le bas.
 *
 * ## Le tronc
 *
 * Les nœuds `trunk` s'empilent sur l'axe, du bas vers le haut, dans l'ordre de leur rang (`tier`) :
 * c'est le rang **distinct** qui compte, pas sa valeur. Plusieurs nœuds du tronc au même rang — un
 * premier choix, souvent exclusif — s'écartent de part et d'autre de l'axe, reliés à lui par un
 * rameau. Au-dessus du dernier rang se trouve la **couronne**, le point d'où partent les branches.
 *
 * ## Les branches
 *
 * Chaque branche a une direction, en degrés, de −80 (à gauche) à +80 (à droite), 0 étant tout droit
 * vers le haut : celle qu'elle donne (`angle`), ou, à défaut, une part égale de l'éventail −70…+70
 * selon sa place dans la liste. Elle possède autour de cette direction un **secteur** : de la
 * bissectrice avec sa voisine de gauche à celle avec sa voisine de droite (aux extrémités, autant de
 * place vers l'extérieur, sans passer ±88°).
 *
 * Les nœuds se posent sur des **anneaux** centrés sur la couronne, un anneau par rang distinct des
 * branches, du plus petit (le plus près) au plus grand : un rang, c'est une distance à la couronne.
 * Sur un anneau, les nœuds se suivent dans l'ordre des angles de leurs branches, puis, dans une
 * branche, en rameaux régulièrement répartis dans son secteur — les choix exclusifs d'une même
 * branche côte à côte, et un nœud dont le rival est dans la branche voisine poussé vers le bord qui
 * lui fait face, pour que le « ou » reste court.
 *
 * On écarte ensuite les voisins d'un anneau qui se touchent, sans jamais les faire changer d'ordre ;
 * si l'un d'eux sort alors de son secteur, l'anneau grandit (un rang chargé s'éloigne de la
 * couronne au lieu de déborder chez les voisins), d'un tiers au plus. Ce qui ne tient toujours pas
 * est ramené dans son secteur, et une dernière passe règle les contacts restants — entre deux
 * anneaux, contre le tronc, entre rameaux serrés — en éloignant le nœud le plus extérieur **le long
 * de son rayon** : il change de distance, jamais de secteur. Rien ne traverse la couronne.
 */

/** La largeur d'un nœud (pastille et étiquette), en unités du plan. */
export const TREE_NODE_W = 132;
/** La hauteur de la boîte d'un nœud : la pastille, l'étiquette sur deux lignes, les points. */
export const TREE_NODE_H = 96;
/** Le rayon de la pastille — le centre du nœud au sens des tracés. */
export const TREE_DOT_R = 22;
/** Ce que la boîte d'un nœud descend sous le centre de sa pastille (au-dessus : le rayon et un peu). */
const BOX_BELOW = TREE_NODE_H - TREE_DOT_R - 4;
/** La hauteur d'une rangée : l'écart vertical entre deux rangs. */
const ROW_H = 124;
/** Le rayon minimal du premier anneau, autour de la couronne. */
const RING0 = 190;
/** L'angle au-delà duquel aucun secteur ne s'étend : une branche ne tombe jamais à l'horizontale. */
const MAX_ANGLE = 88;
/** L'écart minimal entre deux boîtes voisines ; plus large entre deux choix exclusifs, pour le « ou ». */
const GAP = 18;
const GAP_FORK = 46;
const PAD = 24;

export type TreeLinkState = "bare" | "lit" | "alive" | "dead";

export interface TreeLimb {
  id: string;
  d: string;
  width: number;
  state: TreeLinkState;
  branch?: string;
}

export interface TreeVine {
  id: string;
  d: string;
  state: TreeLinkState;
  /** Les feuilles le long de la liane : leur position et leur orientation, en degrés. */
  leaves: { x: number; y: number; a: number }[];
  branch?: string;
}

export interface TreeFork {
  id: string;
  x: number;
  y: number;
  /** Le petit trait entre les deux choix, d'un bord de pastille à l'autre. */
  d: string;
  labels: [string, string];
}

export interface TreeLabel {
  branch: string;
  x: number;
  y: number;
}

export interface TreeLayout {
  width: number;
  height: number;
  /** Le centre de la pastille de chaque nœud. */
  pos: Map<string, { x: number; y: number }>;
  /** L'ordre des nœuds pour le clavier et les lecteurs d'écran : le tronc, puis branche par branche. */
  order: SkillTreeNode[];
  trunk: { body: string; grain: string[]; ground: { cx: number; cy: number; rx: number } };
  limbs: TreeLimb[];
  vines: TreeVine[];
  forks: TreeFork[];
  labels: TreeLabel[];
}

const clampAngle = (a: number) => Math.max(-80, Math.min(80, a));

/** La direction de chaque branche : la sienne si elle en donne une, sinon sa part de l'éventail. */
export function branchAngles(branches: SkillTreeBranch[]): Map<string, number> {
  const n = branches.length;
  const out = new Map<string, number>();
  branches.forEach((b, i) => {
    const even = n <= 1 ? 0 : -70 + (140 * i) / (n - 1);
    out.set(b.id, clampAngle(b.angle ?? even));
  });
  return out;
}

const rank = (tier: number) => Math.max(0, Math.round(tier));
const f = (v: number) => Math.round(v * 10) / 10;

/** Un membre de p0 à p1 : il part vers l'extérieur puis se redresse — une courbe cubique dont la
 *  première poignée file surtout de côté et la seconde surtout vers le haut. */
function limbPath(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return `M${f(x0)} ${f(y0)} C${f(x0 + dx * 0.55)} ${f(y0 + dy * 0.12)}, ${f(x1 - dx * 0.08)} ${f(y1 - dy * 0.5)}, ${f(x1)} ${f(y1)}`;
}

/** Une racine de branche, de la couronne à son premier nœud : elle quitte le tronc dans la direction
 *  de la branche (la première poignée suit l'angle), puis se redresse vers le nœud. */
function rootPath(x0: number, y0: number, x1: number, y1: number, angle: number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const r = (angle * Math.PI) / 180;
  const c1x = x0 + Math.sin(r) * len * 0.5;
  const c1y = y0 - Math.cos(r) * len * 0.5;
  return `M${f(x0)} ${f(y0)} C${f(c1x)} ${f(c1y)}, ${f(x1 - (x1 - x0) * 0.05)} ${f(y1 + (y0 - y1) * 0.35)}, ${f(x1)} ${f(y1)}`;
}

export function layoutTree(nodes: SkillTreeNode[], branches: SkillTreeBranch[]): TreeLayout {
  const angles = branchAngles(branches);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const trunkNodes = nodes.filter((n) => n.trunk);
  const limbNodes = nodes.filter((n) => !n.trunk);

  type P = { n: SkillTreeNode; x: number; y: number; fixed: boolean; angle: number };
  const placed = new Map<string, P>();

  /** L'écart entre deux voisins d'une même rangée : plus large s'ils forment un choix exclusif. */
  const sameFork = (a: SkillTreeNode, b: SkillTreeNode) => !!a.exclusiveGroup && a.exclusiveGroup === b.exclusiveGroup;
  const spread = (list: SkillTreeNode[]) => {
    const offs: number[] = [0];
    for (let j = 1; j < list.length; j++) offs.push(offs[j - 1] + TREE_NODE_W + (sameFork(list[j - 1], list[j]) ? GAP_FORK : GAP));
    const mid = (offs[0] + offs[offs.length - 1]) / 2;
    return offs.map((o) => o - mid);
  };

  // --- Le tronc : un rang distinct par étage, du bas vers le haut.
  const trunkTiers = [...new Set(trunkNodes.map((n) => rank(n.tier)))].sort((a, b) => a - b);
  for (const [level, tier] of trunkTiers.entries()) {
    const list = trunkNodes.filter((n) => rank(n.tier) === tier);
    const offs = spread(list);
    list.forEach((n, j) => placed.set(n.id, { n, x: offs[j], y: -level * ROW_H, fixed: true, angle: 0 }));
  }
  const trunkTop = trunkNodes.length ? -(trunkTiers.length - 1) * ROW_H : 0;
  const crownY = trunkTop - ROW_H * 0.72;
  const groundY = TREE_DOT_R + 40 + (trunkNodes.length ? BOX_BELOW - TREE_DOT_R : 0);

  // --- Les branches : des anneaux autour de la couronne, un par rang, et un secteur par branche.
  //
  // Chaque branche possède un secteur angulaire : de la bissectrice avec sa voisine de gauche à celle
  // avec sa voisine de droite (aux extrémités, autant de place de l'autre côté, sans dépasser ±88°).
  // Un nœud n'en sort jamais, et l'ordre des branches sur un anneau est celui de leurs angles : rien
  // ne passe d'un côté à l'autre de la couronne.
  const sorted = branches.filter((b) => limbNodes.some((n) => n.branch === b.id)).sort((a, b) => (angles.get(a.id) ?? 0) - (angles.get(b.id) ?? 0));
  const sector = new Map<string, { lo: number; hi: number; mid: number; rank: number }>();
  sorted.forEach((b, i) => {
    const a = angles.get(b.id) ?? 0;
    const prev = i > 0 ? angles.get(sorted[i - 1].id) ?? 0 : undefined;
    const next = i < sorted.length - 1 ? angles.get(sorted[i + 1].id) ?? 0 : undefined;
    const half = Math.min(prev !== undefined ? (a - prev) / 2 : Infinity, next !== undefined ? (next - a) / 2 : Infinity, 30);
    const lo = prev !== undefined ? (prev + a) / 2 : Math.max(-MAX_ANGLE, a - (Number.isFinite(half) ? half : 30));
    const hi = next !== undefined ? (a + next) / 2 : Math.min(MAX_ANGLE, a + (Number.isFinite(half) ? half : 30));
    sector.set(b.id, { lo, hi, mid: a, rank: i });
  });

  /** L'écart tangentiel qu'il faut entre deux voisins d'un anneau, autour de l'angle `m` (radians) :
   *  deux boîtes ne se touchent plus dès qu'elles sont séparées en largeur **ou** en hauteur ; le long
   *  d'un anneau presque horizontal (en haut), c'est la largeur qui compte ; sur les flancs, presque
   *  verticaux, la hauteur. */
  const tangential = (m: number, fork: boolean) =>
    Math.min((TREE_NODE_W + (fork ? GAP_FORK : GAP)) / Math.max(1e-3, Math.abs(Math.cos(m))), (TREE_NODE_H + GAP) / Math.max(1e-3, Math.abs(Math.sin(m))));
  /** Et l'écart radial entre deux anneaux, pour une branche d'angle `m` : la même règle, de travers. */
  const radial = (m: number) =>
    Math.min((TREE_NODE_W + GAP) / Math.max(1e-3, Math.abs(Math.sin(m))), (TREE_NODE_H + GAP) / Math.max(1e-3, Math.abs(Math.cos(m))));

  const exclusivePartners = (n: SkillTreeNode) => (n.exclusiveGroup ? nodes.filter((m) => m.id !== n.id && m.exclusiveGroup === n.exclusiveGroup) : []);

  const ringTiers = [...new Set(limbNodes.map((n) => rank(n.tier)))].sort((a, b) => a - b);
  const ringStep = Math.max(...sorted.map((b) => radial(((angles.get(b.id) ?? 0) * Math.PI) / 180)), TREE_NODE_H + GAP);
  let radius = RING0 - ringStep;
  const polar = new Map<string, { r: number; a: number }>();

  for (const tier of ringTiers) {
    // L'anneau : ses nœuds dans l'ordre des branches, et dans une branche, dans un ordre qui garde
    // les choix exclusifs côte à côte — et qui pousse vers le bord un nœud dont le rival est dans la
    // branche voisine, pour que le « ou » reste court.
    type Item = { n: SkillTreeNode; want: number; lo: number; hi: number };
    const ring: Item[] = [];
    for (const b of sorted) {
      const s = sector.get(b.id)!;
      const own = limbNodes.filter((n) => n.branch === b.id && rank(n.tier) === tier);
      if (!own.length) continue;
      const side = (n: SkillTreeNode) => {
        // −1 : son rival est dans une branche à gauche ; +1 : à droite ; 0 : dans la sienne, ou aucun.
        const other = exclusivePartners(n).find((m) => !m.trunk && m.branch !== n.branch);
        if (!other) return 0;
        return Math.sign((angles.get(other.branch) ?? 0) - s.mid);
      };
      const groupKey = new Map<string, number>();
      own.forEach((n, i) => {
        const g = n.exclusiveGroup;
        if (g && !groupKey.has(g)) groupKey.set(g, i);
      });
      const list = own
        .map((n, i) => ({ n, i, side: side(n), g: n.exclusiveGroup ? groupKey.get(n.exclusiveGroup)! : i }))
        .sort((p, q) => p.side - q.side || p.g - q.g || p.i - q.i);
      const m = list.length;
      list.forEach(({ n, side: sd }, j) => {
        let want = m === 1 ? s.mid : s.lo + ((s.hi - s.lo) * (j + 1)) / (m + 1);
        if (m === 1 && sd !== 0) want = s.mid + 0.7 * ((sd < 0 ? s.lo : s.hi) - s.mid);
        ring.push({ n, want: (want * Math.PI) / 180, lo: (s.lo * Math.PI) / 180, hi: (s.hi * Math.PI) / 180 });
      });
    }

    // Le rayon : au moins un pas plus loin que l'anneau précédent ; puis, tant que les nœuds ne
    // tiennent pas chacun dans son secteur une fois écartés, un anneau plus grand — un rang chargé
    // prend de la place en s'éloignant, pas en débordant chez les voisins. L'anneau ne grandit que
    // d'un tiers au plus : au-delà, les nœuds sont ramenés dans leur secteur, et ceux qui s'y
    // touchent encore s'étagent vers l'extérieur (la passe suivante), en rameaux.
    radius = Math.max(RING0, radius + ringStep);
    const maxRadius = radius * 1.35;
    let pos = ring.map((it) => it.want);
    for (let attempt = 0; attempt < 60 && radius <= maxRadius; attempt++) {
      pos = ring.map((it) => it.want);
      for (let pass = 0; pass < 400; pass++) {
        let moved = false;
        for (let i = 0; i + 1 < ring.length; i++) {
          const need = tangential((pos[i] + pos[i + 1]) / 2, sameFork(ring[i].n, ring[i + 1].n)) / radius;
          const gap = pos[i + 1] - pos[i];
          if (gap < need - 1e-6) {
            const d = (need - gap) / 2;
            pos[i] -= d;
            pos[i + 1] += d;
            moved = true;
          }
        }
        if (!moved) break;
      }
      const tol = 1e-3;
      if (ring.every((it, i) => pos[i] >= it.lo - tol && pos[i] <= it.hi + tol)) break;
      radius = Math.min(maxRadius + 1, radius * 1.05);
    }
    radius = Math.min(radius, maxRadius);
    ring.forEach((it, i) => polar.set(it.n.id, { r: radius, a: Math.max(it.lo, Math.min(it.hi, pos[i])) }));
  }

  const toXY = (r: number, a: number) => ({ x: r * Math.sin(a), y: crownY - r * Math.cos(a) });
  for (const n of limbNodes) {
    const q = polar.get(n.id)!;
    const { x, y } = toXY(q.r, q.a);
    placed.set(n.id, { n, x, y, fixed: false, angle: (q.a * 180) / Math.PI });
  }

  // --- Ce qui se touche encore (deux anneaux en diagonale, un nœud contre le tronc) : le nœud le plus
  // loin de la couronne s'éloigne encore, le long de son rayon — il ne change jamais de secteur.
  const all = [...placed.values()];
  const overlaps = (a: P, b: P) =>
    Math.abs(b.x - a.x) < TREE_NODE_W + (sameFork(a.n, b.n) ? GAP_FORK : GAP) - 0.5 && Math.abs(b.y - a.y) < TREE_NODE_H + 8 - 0.5;
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.fixed && b.fixed) continue;
        if (!overlaps(a, b)) continue;
        const ra = a.fixed ? -1 : polar.get(a.n.id)!.r;
        const rb = b.fixed ? -1 : polar.get(b.n.id)!.r;
        const out = rb > ra || (rb === ra && Math.abs(b.angle) >= Math.abs(a.angle)) ? b : a;
        const q = polar.get(out.n.id)!;
        q.r += 8;
        const xy = toXY(q.r, q.a);
        out.x = xy.x;
        out.y = xy.y;
        moved = true;
      }
    if (!moved) break;
  }

  // --- Les membres, les rameaux du tronc, les lianes.
  const stateOf = (child: SkillTreeNode, parent?: SkillTreeNode): TreeLinkState =>
    child.state === "closed" || parent?.state === "closed"
      ? "dead"
      : child.state === "unlocked"
        ? "alive"
        : !parent || parent.state === "unlocked"
          ? "lit"
          : "bare";
  const limbs: TreeLimb[] = [];
  const vines: TreeVine[] = [];
  const widthAt = (n: SkillTreeNode) => Math.max(2.5, 13 - 2.3 * Math.max(0, ringTiers.indexOf(rank(n.tier))));

  for (const p of all.filter((q) => q.n.trunk && Math.abs(q.x) > 1)) {
    // Un nœud du tronc écarté de l'axe : un rameau court le rattache au fût.
    limbs.push({ id: `twig:${p.n.id}`, d: limbPath(0, p.y + ROW_H * 0.3, p.x, p.y), width: 9, state: stateOf(p.n) });
  }

  const vine = (id: string, a: { x: number; y: number }, b: { x: number; y: number }, bend: number, state: TreeLinkState, branch: string) => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const cx = mx + nx * len * 0.26 * bend;
    const cy = my + ny * len * 0.26 * bend;
    const at = (t: number) => {
      const u = 1 - t;
      const x = u * u * a.x + 2 * u * t * cx + t * t * b.x;
      const y = u * u * a.y + 2 * u * t * cy + t * t * b.y;
      const tx = 2 * u * (cx - a.x) + 2 * t * (b.x - cx);
      const ty = 2 * u * (cy - a.y) + 2 * t * (b.y - cy);
      return { x: f(x), y: f(y), a: f((Math.atan2(ty, tx) * 180) / Math.PI + (t < 0.5 ? 40 : -40)) };
    };
    vines.push({ id, d: `M${f(a.x)} ${f(a.y)} Q${f(cx)} ${f(cy)}, ${f(b.x)} ${f(b.y)}`, state, leaves: [at(0.3), at(0.5), at(0.7)], branch });
  };

  let vineCount = 0;
  for (const p of all) {
    const n = p.n;
    if (n.trunk) continue;
    const reqs = (n.requires ?? []).map((id) => byId.get(id)).filter((r): r is SkillTreeNode => !!r);
    const own = reqs.filter((r) => !r.trunk && r.branch === n.branch);
    if (own.length) {
      for (const r of own) {
        const q = placed.get(r.id)!;
        limbs.push({ id: `${r.id}->${n.id}`, d: limbPath(q.x, q.y, p.x, p.y), width: widthAt(r), state: stateOf(n, r), branch: n.branch });
      }
    } else {
      // Une racine de branche : elle part toujours de la couronne, dans sa direction. Le nœud du
      // tronc dont elle dépend est dans le fût : c'est le tronc lui-même qui porte ce lien.
      const tr = reqs.filter((r) => r.trunk).map((r) => placed.get(r.id)!).sort((a, b) => a.y - b.y)[0];
      limbs.push({ id: `root->${n.id}`, d: rootPath(0, crownY, p.x, p.y, p.angle), width: 14, state: stateOf(n, tr?.n), branch: n.branch });
    }
    for (const r of reqs) {
      const isLimb = own.includes(r) || (r.trunk && !own.length);
      if (isLimb) continue;
      const q = placed.get(r.id)!;
      vine(`${r.id}~>${n.id}`, q, p, vineCount++ % 2 ? 1 : -1, stateOf(n, r), r.branch);
    }
  }

  // --- Les carrefours exclusifs : un « ou » entre deux choix voisins d'un même groupe.
  const forks: TreeFork[] = [];
  const excl = new Map<string, P[]>();
  for (const p of all) if (p.n.exclusiveGroup) excl.set(p.n.exclusiveGroup, [...(excl.get(p.n.exclusiveGroup) ?? []), p]);
  for (const [g, list] of excl) {
    list.sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const r = TREE_DOT_R + 4;
      forks.push({
        id: `${g}:${a.n.id}|${b.n.id}`,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        d: `M${f(a.x + ux * r)} ${f(a.y + uy * r)} L${f(b.x - ux * r)} ${f(b.y - uy * r)}`,
        labels: [a.n.label, b.n.label],
      });
    }
  }

  // --- Les noms des branches, au-delà de leur nœud le plus éloigné, dans le prolongement de son rayon.
  const labels: TreeLabel[] = [];
  for (const b of branches) {
    const tip = all.filter((p) => !p.n.trunk && p.n.branch === b.id).sort((a, c) => polar.get(c.n.id)!.r - polar.get(a.n.id)!.r)[0];
    if (!tip) continue;
    const q = polar.get(tip.n.id)!;
    const a = q.a;
    // Au-dessus de la pastille quand la branche monte ; sur un flanc, de côté, à hauteur de pastille.
    const lift = TREE_DOT_R + 30;
    labels.push({ branch: b.id, x: tip.x + Math.sin(a) * (TREE_NODE_W / 2 + 56), y: tip.y - Math.cos(a) * lift });
  }

  // --- Le cadre : tout ce qui est posé, plus une marge ; on ramène le coin haut-gauche à (0, 0).
  const trunkHalf = 74;
  let minX = -trunkHalf - 30;
  let maxX = trunkHalf + 30;
  let minY = crownY - 20;
  let maxY = groundY + 16;
  for (const p of all) {
    minX = Math.min(minX, p.x - TREE_NODE_W / 2);
    maxX = Math.max(maxX, p.x + TREE_NODE_W / 2);
    minY = Math.min(minY, p.y - TREE_DOT_R - 4);
    maxY = Math.max(maxY, p.y + BOX_BELOW);
  }
  for (const l of labels) {
    minY = Math.min(minY, l.y - 14);
    minX = Math.min(minX, l.x - 70);
    maxX = Math.max(maxX, l.x + 70);
  }
  const ox = PAD - minX;
  const oy = PAD - minY;
  const X = (x: number) => x + ox;
  const Y = (y: number) => y + oy;
  const shiftPath = (d: string) => {
    // Les tracés alternent x et y : on décale chaque paire de nombres.
    let k = 0;
    return d.replace(/-?\d+(?:\.\d+)?/g, (m) => String(f(Number(m) + (k++ % 2 === 0 ? ox : oy))));
  };

  // Le fût : large et évasé au pied, en racines, il s'affine jusqu'à la couronne.
  const base = 34;
  const top = 15;
  const flare = 70;
  const g = groundY;
  const c = crownY;
  const mid = (g + c) / 2;
  const body =
    `M${-flare} ${g} ` +
    `C${-base * 1.15} ${g - 4}, ${-base} ${g - 16}, ${-base} ${f(g - 38)} ` +
    `C${-base * 0.85} ${f(mid)}, ${-top * 1.25} ${f(c + 36)}, ${-top} ${f(c)} ` +
    `Q0 ${f(c - 10)}, ${top} ${f(c)} ` +
    `C${top * 1.25} ${f(c + 36)}, ${base * 0.85} ${f(mid)}, ${base} ${f(g - 38)} ` +
    `C${base} ${g - 16}, ${base * 1.15} ${g - 4}, ${flare} ${g} ` +
    `Q0 ${g + 8}, ${-flare} ${g} Z`;
  const grain = [
    `M-9 ${f(g - 18)} Q-3 ${f(mid)}, -5 ${f(c + 26)}`,
    `M11 ${f(g - 30)} Q5 ${f(mid + 20)}, 4 ${f(c + 44)}`,
    `M-22 ${f(g - 8)} Q-17 ${f(g - 34)}, -15 ${f(g - 60)}`,
  ];

  const pos = new Map<string, { x: number; y: number }>();
  for (const p of all) pos.set(p.n.id, { x: X(p.x), y: Y(p.y) });

  const ordered = [
    ...trunkNodes.slice().sort((a, b) => rank(a.tier) - rank(b.tier) || placed.get(a.id)!.x - placed.get(b.id)!.x),
    ...branches.flatMap((b) =>
      limbNodes.filter((n) => n.branch === b.id).sort((a, c) => rank(a.tier) - rank(c.tier) || placed.get(a.id)!.x - placed.get(c.id)!.x)
    ),
  ];

  return {
    width: Math.ceil(maxX - minX + PAD * 2),
    height: Math.ceil(maxY - minY + PAD * 2),
    pos,
    order: ordered,
    trunk: { body: shiftPath(body), grain: grain.map(shiftPath), ground: { cx: X(0), cy: Y(g + 2), rx: 150 } },
    limbs: limbs.map((l) => ({ ...l, d: shiftPath(l.d) })),
    vines: vines.map((v) => ({ ...v, d: shiftPath(v.d), leaves: v.leaves.map((q) => ({ x: X(q.x), y: Y(q.y), a: q.a })) })),
    forks: forks.map((k) => ({ ...k, x: X(k.x), y: Y(k.y), d: shiftPath(k.d) })),
    labels: labels.map((l) => ({ ...l, x: X(l.x), y: Y(l.y) })),
  };
}
