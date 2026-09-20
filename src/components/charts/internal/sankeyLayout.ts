/** Sankey placement — columns, node boxes and ribbon endpoints — written here rather than pulled
 *  in from `d3-sankey`.
 *
 *  `d3-sankey` is not part of d3 core: it is a separate package, and this library's whole d3
 *  surface is a single peer dependency the consumer already has. Adding a second one, that the
 *  consumer would also have to install, for ~200 lines of arithmetic is a bad trade — especially
 *  since two of the things this chart needs are not in that package anyway (a cycle that degrades
 *  instead of throwing, and columns that keep their identity so the view can zoom to a branch).
 *
 *  The algorithm itself is the usual one and makes no claim to originality: longest-path columns,
 *  a shared value→pixel scale, then a few passes of "pull each node toward the average height of
 *  what it is connected to, then push overlapping nodes apart again". */

export interface SankeyInputNode {
  id: string;
  label: string;
  color?: string;
}

export interface SankeyInputLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

export interface SankeyLaidOutNode {
  id: string;
  label: string;
  color?: string;
  /** Column index, 0 on the left. */
  depth: number;
  /** The larger of what flows in and what flows out — a node that loses value on the way through
   *  (a fee, a rounding) is still drawn at its widest side rather than pinched. */
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Links leaving this node (this node is their source). */
  outgoing: SankeyLaidOutLink[];
  /** Links arriving at this node (this node is their target). */
  incoming: SankeyLaidOutLink[];
}

export interface SankeyLaidOutLink {
  /** Index into the input `links` array, so a caller can key on it and map back. */
  index: number;
  source: SankeyLaidOutNode;
  target: SankeyLaidOutNode;
  value: number;
  color?: string;
  /** Ribbon thickness in px. */
  width: number;
  /** Centre of the ribbon where it meets the source node. */
  y0: number;
  /** Centre of the ribbon where it meets the target node. */
  y1: number;
}

export interface SankeyLayout {
  nodes: SankeyLaidOutNode[];
  links: SankeyLaidOutLink[];
  columns: SankeyLaidOutNode[][];
  /** Pixels per unit of value — the one scale every ribbon and every node box is drawn from. */
  ky: number;
}

export interface SankeyLayoutOptions {
  width: number;
  height: number;
  /** Width of a node's own bar, in px. Default 12. */
  nodeWidth?: number;
  /** Vertical gap between two nodes in the same column, in px. Default 14. */
  nodePadding?: number;
  /** How many relaxation passes to run. Default 8 — past that the arrangement stops changing
   *  visibly on every dataset tested here, and each pass is O(links). */
  iterations?: number;
  /** `"justify"` pushes every node with nothing flowing out of it to the last column, which is
   *  what makes the leaves line up down the right-hand edge in a budget diagram. `"left"` leaves
   *  each node in the column its longest incoming path puts it in. Default "justify". */
  align?: "justify" | "left";
}

/** Longest-path depth per node, in topological order.
 *
 *  Kahn's algorithm rather than a recursive walk, for one reason: a cycle. Real data has them —
 *  an account that feeds a pot that feeds the account back — and a recursive longest-path walk
 *  either recurses forever or throws, which is not an acceptable answer to "draw my budget". Here
 *  the acyclic part is ordered exactly, and whatever is left in a cycle is dropped into the
 *  deepest column reached so far: the diagram is wrong about that one node's column and right
 *  about everything else, which beats rendering nothing. */
function computeDepths(nodeIds: string[], links: SankeyInputLink[]): Map<string, number> {
  const depth = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const indegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const out = new Map<string, SankeyInputLink[]>(nodeIds.map((id) => [id, []]));

  for (const link of links) {
    out.get(link.source)?.push(link);
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  }

  const queue = nodeIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  let settled = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    settled += 1;
    const here = depth.get(id) ?? 0;
    for (const link of out.get(id) ?? []) {
      if ((depth.get(link.target) ?? 0) < here + 1) depth.set(link.target, here + 1);
      const remaining = (indegree.get(link.target) ?? 0) - 1;
      indegree.set(link.target, remaining);
      if (remaining === 0) queue.push(link.target);
    }
  }

  if (settled < nodeIds.length) {
    const deepest = Math.max(0, ...depth.values());
    for (const id of nodeIds) if ((indegree.get(id) ?? 0) > 0) depth.set(id, deepest);
  }

  return depth;
}

/** Pushes apart every node in one column that overlaps its neighbour, then pulls the whole column
 *  back inside the plot. Two passes — downward from the top, then upward from the bottom — because
 *  a single downward pass can push the last node straight out of the bottom of the chart. */
function resolveCollisions(column: SankeyLaidOutNode[], height: number, nodePadding: number) {
  column.sort((a, b) => a.y0 - b.y0);

  let y = 0;
  for (const node of column) {
    const shift = y - node.y0;
    if (shift > 0) {
      node.y0 += shift;
      node.y1 += shift;
    }
    y = node.y1 + nodePadding;
  }

  y = height;
  for (let i = column.length - 1; i >= 0; i -= 1) {
    const node = column[i];
    const shift = node.y1 - y;
    if (shift > 0) {
      node.y0 -= shift;
      node.y1 -= shift;
    }
    y = node.y0 - nodePadding;
  }
}

function centre(node: SankeyLaidOutNode): number {
  return (node.y0 + node.y1) / 2;
}

/** Where a node wants to sit: the average height of everything on the other side of its links,
 *  weighted by how much flows through each — so a node fed mostly by one big ribbon lines up with
 *  that ribbon rather than splitting the difference with three small ones. */
function weightedCentre(links: SankeyLaidOutLink[], side: "source" | "target"): number | null {
  let total = 0;
  let sum = 0;
  for (const link of links) {
    const other = side === "source" ? link.source : link.target;
    sum += centre(other) * link.value;
    total += link.value;
  }
  return total > 0 ? sum / total : null;
}

export function sankeyLayout(
  inputNodes: SankeyInputNode[],
  inputLinks: SankeyInputLink[],
  options: SankeyLayoutOptions
): SankeyLayout {
  const { width, height, nodeWidth = 12, nodePadding = 14, iterations = 8, align = "justify" } = options;

  const known = new Set(inputNodes.map((n) => n.id));
  // A link to a node nobody declared, or one carrying nothing, has no box to attach to and no
  // thickness to draw — dropped here rather than crashing the layout further down.
  const links = inputLinks.filter((l) => known.has(l.source) && known.has(l.target) && l.value > 0 && l.source !== l.target);

  if (inputNodes.length === 0 || links.length === 0 || width <= 0 || height <= 0) {
    return { nodes: [], links: [], columns: [], ky: 0 };
  }

  const depth = computeDepths(
    inputNodes.map((n) => n.id),
    links
  );

  const nodes: SankeyLaidOutNode[] = inputNodes.map((n) => ({
    id: n.id,
    label: n.label,
    color: n.color,
    depth: depth.get(n.id) ?? 0,
    value: 0,
    x0: 0,
    x1: 0,
    y0: 0,
    y1: 0,
    outgoing: [],
    incoming: [],
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const laidOutLinks: SankeyLaidOutLink[] = links.map((l, index) => {
    const source = byId.get(l.source) as SankeyLaidOutNode;
    const target = byId.get(l.target) as SankeyLaidOutNode;
    const link: SankeyLaidOutLink = { index, source, target, value: l.value, color: l.color, width: 0, y0: 0, y1: 0 };
    source.outgoing.push(link);
    target.incoming.push(link);
    return link;
  });

  for (const node of nodes) {
    const into = node.incoming.reduce((sum, l) => sum + l.value, 0);
    const outOf = node.outgoing.reduce((sum, l) => sum + l.value, 0);
    node.value = Math.max(into, outOf);
  }

  if (align === "justify") {
    const deepest = Math.max(...nodes.map((n) => n.depth));
    for (const node of nodes) if (node.outgoing.length === 0) node.depth = deepest;
  }

  const columnCount = Math.max(...nodes.map((n) => n.depth)) + 1;
  const columns: SankeyLaidOutNode[][] = Array.from({ length: columnCount }, () => []);
  for (const node of nodes) columns[node.depth].push(node);

  // Horizontal: the last column's bar has to end *at* the right edge, not start there, so the
  // available travel is the plot width minus one bar.
  const step = columnCount > 1 ? (width - nodeWidth) / (columnCount - 1) : 0;
  for (const node of nodes) {
    node.x0 = node.depth * step;
    node.x1 = node.x0 + nodeWidth;
  }

  // The requested padding, capped so it can never eat the diagram. A budget's last column is
  // routinely twenty-odd leaves, and 20 × 14px of gap is already 280px of a 400px chart — measured
  // before this cap existed: the ribbons were scaled down to a fraction of a pixel and the column
  // still overflowed both ends of the plot. Gaps get at most half the height; the flows keep the
  // rest, which is what the diagram is actually about.
  const busiest = Math.max(...columns.map((c) => c.length));
  const padding = busiest > 1 ? Math.min(nodePadding, (height * 0.5) / (busiest - 1)) : 0;

  // One scale for the whole diagram, set by whichever column is the most crowded: pick it per
  // column and the same 1 000 € would be a different thickness on the left and on the right, which
  // is the one thing a Sankey must never do.
  let ky = Infinity;
  for (const column of columns) {
    if (column.length === 0) continue;
    const total = column.reduce((sum, n) => sum + n.value, 0);
    if (total <= 0) continue;
    const usable = Math.max(1, height - (column.length - 1) * padding);
    ky = Math.min(ky, usable / total);
  }
  if (!Number.isFinite(ky) || ky <= 0) ky = 1;

  for (const column of columns) {
    const stackHeight = column.reduce((sum, n) => sum + n.value * ky, 0) + (column.length - 1) * padding;
    let y = Math.max(0, (height - stackHeight) / 2);
    for (const node of column) {
      node.y0 = y;
      // No minimum height. A node is exactly its value on the shared scale, or the ribbons leaving
      // it would not add up to it any more — and a hairline node is the correct rendering of a
      // rounding-error flow. Making those readable is what the zoom is for; a floor here would
      // instead make them lie at every zoom level. The drawing code applies its own
      // minimum-visible thickness without touching these numbers.
      node.y1 = y + node.value * ky;
      y = node.y1 + padding;
    }
  }

  // Relaxation. Each pass drags nodes toward the things they are linked to and then un-overlaps
  // them; `alpha` decays so the first passes do the coarse untangling and the last ones only
  // nudge, which is what stops the arrangement oscillating between two equally good answers.
  for (let pass = 0; pass < iterations; pass += 1) {
    const alpha = 0.9 ** pass;

    for (let d = columnCount - 2; d >= 0; d -= 1) {
      for (const node of columns[d]) {
        const wanted = weightedCentre(node.outgoing, "target");
        if (wanted === null) continue;
        const shift = (wanted - centre(node)) * alpha;
        node.y0 += shift;
        node.y1 += shift;
      }
      resolveCollisions(columns[d], height, padding);
    }

    for (let d = 1; d < columnCount; d += 1) {
      for (const node of columns[d]) {
        const wanted = weightedCentre(node.incoming, "source");
        if (wanted === null) continue;
        const shift = (wanted - centre(node)) * alpha;
        node.y0 += shift;
        node.y1 += shift;
      }
      resolveCollisions(columns[d], height, padding);
    }
  }

  // Ribbon endpoints. Each side is stacked in the order of where the *other* end sits, which is
  // what keeps ribbons from crossing each other inside a single node — the difference between a
  // readable diagram and a knot.
  for (const node of nodes) {
    node.outgoing.sort((a, b) => centre(a.target) - centre(b.target));
    node.incoming.sort((a, b) => centre(a.source) - centre(b.source));

    let y = node.y0;
    for (const link of node.outgoing) {
      link.width = link.value * ky;
      link.y0 = y + link.width / 2;
      y += link.width;
    }

    y = node.y0;
    for (const link of node.incoming) {
      link.width = link.value * ky;
      link.y1 = y + link.width / 2;
      y += link.width;
    }
  }

  return { nodes, links: laidOutLinks, columns, ky };
}

/** Thinnest ribbon (and node) the drawing code will produce. The layout keeps exact values — see
 *  the node-height comment above — and this is applied only when turning them into pixels, so a
 *  flow that rounds to nothing still leaves a hairline instead of vanishing. */
export const SANKEY_MIN_VISIBLE = 0.9;

/** The ribbon itself: a closed shape rather than a fat stroke, so its two ends can be clipped,
 *  filled and hit-tested independently of its thickness. */
export function sankeyRibbonPath(link: SankeyLaidOutLink): string {
  const x0 = link.source.x1;
  const x1 = link.target.x0;
  const xm = (x0 + x1) / 2;
  const half = Math.max(link.width, SANKEY_MIN_VISIBLE) / 2;
  const a0 = link.y0 - half;
  const a1 = link.y0 + half;
  const b0 = link.y1 - half;
  const b1 = link.y1 + half;
  return `M${x0},${a0}C${xm},${a0} ${xm},${b0} ${x1},${b0}L${x1},${b1}C${xm},${b1} ${xm},${a1} ${x0},${a1}Z`;
}

/** Every node reachable downstream from `id`, `id` itself included — the "branch" a click zooms
 *  into. Iterative and visited-guarded, so the cycle the depth pass tolerated cannot hang this. */
export function downstreamOf(start: SankeyLaidOutNode): Set<string> {
  const seen = new Set<string>([start.id]);
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop() as SankeyLaidOutNode;
    for (const link of node.outgoing) {
      if (seen.has(link.target.id)) continue;
      seen.add(link.target.id);
      stack.push(link.target);
    }
  }
  return seen;
}

/** Same, upstream — what feeds `start`. A branch reads as a branch only with its own trunk still
 *  visible, so focusing a node keeps the path back to the sources lit. */
export function upstreamOf(start: SankeyLaidOutNode): Set<string> {
  const seen = new Set<string>([start.id]);
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop() as SankeyLaidOutNode;
    for (const link of node.incoming) {
      if (seen.has(link.source.id)) continue;
      seen.add(link.source.id);
      stack.push(link.source);
    }
  }
  return seen;
}
