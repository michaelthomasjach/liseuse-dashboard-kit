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
 * selon sa place dans la liste. Un nœud de branche se pose ainsi :
 *
 * - sa **hauteur** vient de son rang : le plus petit rang des branches forme la première rangée
 *   au-dessus de la couronne (1,3 rangée plus haut), chaque rang suivant une rangée plus haut (`ROW_H`). Les branches très
 *   inclinées retombent un peu (jusqu'à quatre dixièmes de rang pour ±80°) — l'arbre prend une cime en dôme
 *   plutôt qu'un sommet plat ;
 * - son **écart à l'axe** vient de la direction et du rang : `sin(angle) × REACH × √rang`. La
 *   racine carrée fait que la branche s'écarte vite près de la couronne puis monte de plus en plus
 *   droit, comme un vrai membre qui cherche la lumière ;
 * - plusieurs nœuds d'une même branche au même rang s'écartent de côté, en rameaux.
 *
 * Une passe de **poussée** sépare ensuite ce qui se chevauche : deux boîtes qui se recouvrent sont
 * écartées à l'horizontale (ou, si elles ne se touchent que d'un rien en hauteur, à la verticale),
 * moitié chacune, les nœuds du tronc restant fixes. Quelques dizaines de passes suffisent aux arbres
 * d'un jeu (une trentaine de nœuds).
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
/** L'écart à l'axe d'une branche couchée, au premier rang. */
const REACH = 210;
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
  const branchIndex = new Map(branches.map((b, i) => [b.id, i]));
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

  // --- Les branches : la hauteur par le rang, l'écart par la direction.
  const minTier = limbNodes.length ? Math.min(...limbNodes.map((n) => rank(n.tier))) : 0;
  const groups = new Map<string, SkillTreeNode[]>();
  for (const n of limbNodes) {
    const k = `${n.branch}|${rank(n.tier)}`;
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  for (const list of groups.values()) {
    const n0 = list[0];
    const angle = angles.get(n0.branch) ?? 0;
    const s = Math.sin((angle * Math.PI) / 180);
    const k = rank(n0.tier) - minTier + 1;
    const x = s * REACH * Math.sqrt(k);
    const y = crownY - (k + 0.3) * ROW_H + Math.abs(s) * ROW_H * 0.4;
    const offs = spread(list);
    list.forEach((n, j) => placed.set(n.id, { n, x: x + offs[j], y: y + (j % 2 ? -12 : 0), fixed: false, angle }));
  }

  // --- La poussée : on écarte ce qui se chevauche, jusqu'au repos (ou presque).
  const all = [...placed.values()];
  const order = (p: P) => (p.n.trunk ? -1 : branchIndex.get(p.n.branch) ?? 0);
  for (let pass = 0; pass < 160; pass++) {
    let moved = false;
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.fixed && b.fixed) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = TREE_NODE_W + (sameFork(a.n, b.n) ? GAP_FORK : GAP) - Math.abs(dx);
        const oy = TREE_NODE_H + 8 - Math.abs(dy);
        if (ox <= 0.5 || oy <= 0.5) continue;
        moved = true;
        // À peine un recouvrement en hauteur : on décale verticalement, c'est moins coûteux.
        const vertical = oy < 18 && oy < ox;
        const amount = (vertical ? oy : ox) + 0.5;
        const dir =
          (vertical ? dy : dx) !== 0
            ? Math.sign(vertical ? dy : dx)
            : Math.sign(b.angle - a.angle) || Math.sign(order(b) - order(a)) || 1;
        const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const wb = 1 - wa;
        if (vertical) {
          a.y -= dir * amount * wa;
          b.y += dir * amount * wb;
        } else {
          a.x -= dir * amount * wa;
          b.x += dir * amount * wb;
        }
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
  const widthAt = (n: SkillTreeNode) => Math.max(2.5, 13 - 2.3 * (rank(n.tier) - minTier));

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
      // Une racine de branche : elle part de la couronne — ou du choix du tronc dont elle dépend,
      // s'il est écarté de l'axe.
      const tr = reqs.filter((r) => r.trunk).map((r) => placed.get(r.id)!).sort((a, b) => a.y - b.y)[0];
      const from = tr && Math.abs(tr.x) > 1 ? { x: tr.x, y: tr.y } : { x: 0, y: crownY };
      const d = from.x === 0 ? rootPath(0, crownY, p.x, p.y, p.angle) : limbPath(from.x, from.y, p.x, p.y);
      limbs.push({ id: `root->${n.id}`, d, width: 14, state: stateOf(n, tr?.n), branch: n.branch });
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

  // --- Les noms des branches, au-dessus de leur plus haut nœud.
  const labels: TreeLabel[] = [];
  for (const b of branches) {
    const tip = all.filter((p) => !p.n.trunk && p.n.branch === b.id).sort((a, c) => a.y - c.y || Math.abs(c.x) - Math.abs(a.x))[0];
    if (tip) labels.push({ branch: b.id, x: tip.x, y: tip.y - TREE_DOT_R - 30 });
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
  for (const l of labels) minY = Math.min(minY, l.y - 14);
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
