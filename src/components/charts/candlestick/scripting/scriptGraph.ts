import { isBlockMarkerLine } from "./scriptBlocks";

/** The node-graph ("no-code") view of a script, and the two functions that turn a script's own
 *  source text into it and back.
 *
 *  The whole design rests on one decision: **the code is the only source of truth**. There is no
 *  sidecar JSON holding the diagram, because a script whose graph lives outside it is a script
 *  that breaks the moment anyone edits the text — and this editor lets you switch to the text at
 *  any moment. So everything the diagram knows (which blocks exist, where they sit, what points at
 *  what) is written on the `@block` line that already delimits each cell:
 *
 *      @block(prix at 40 120) Charger les prix
 *      @block(sma at 340 120 after prix) Moyenne mobile
 *      @block(signal at 640 120 after sma prix) Signal d'achat
 *
 *  `@block Titre` with no parentheses is still exactly what it always was, which matters more than
 *  it sounds: every script already written is a valid graph — a straight chain — so switching one
 *  to no-code shows something true immediately instead of an empty canvas. And since `@block` is
 *  already stripped before compiling (see `stripScriptBlocks`), the engine needed no change at all
 *  to run a script written this way.
 *
 *  **What an arrow means.** It means "runs after", not "sends data to". Blocks are cells of one
 *  script sharing one scope, exactly as they were in the notebook view — an arrow from A to B says
 *  B may use what A defined, and orders them accordingly. Making arrows carry values would mean
 *  inventing a runtime that no longer matches the code you get when you switch back to text, which
 *  is precisely the property this whole file exists to protect. */
export interface ScriptGraphNode {
  /** Unique within the graph. Referenced by other nodes' `after`, so it has to survive a round
   *  trip through the text — which is why it is written out rather than regenerated. */
  id: string;
  /** Free text after the block header. The diagram's own label. */
  title: string;
  /** Canvas position. `null` when the source carried no `at` — `layoutScriptGraph` assigns one. */
  at: { x: number; y: number } | null;
  /** Ids of the nodes this one runs after. Empty for a root. */
  after: string[];
  /** Everything between this block's header line and the next one, verbatim, newlines included.
   *  Never parsed, never reformatted: whatever the graph does to a script, it must not silently
   *  rewrite the code inside a block. */
  body: string;
  /** Whether `id` was written in the source rather than derived from the title. An authored id is
   *  always written back out — it is the user's own naming, and something outside this file (a
   *  comment, their memory) may well refer to it. A derived one is written only when it has to be:
   *  see `serializeScriptGraph`. */
  authoredId?: boolean;
  /** The synthetic node holding whatever sits before the first `@block` — `@description`, the
   *  `@indicator`/`@strategy` line, imports, `new Variable(...)` declarations. It always runs
   *  first, cannot be deleted, and nothing can point into it. Shown on the canvas rather than
   *  hidden, so the diagram accounts for the whole file and not just the part that happens to be
   *  in cells — but pinned rather than draggable: it has no `@block` line of its own to write a
   *  position on, and it is always first regardless, so a position would mean nothing anyway. */
  preamble?: boolean;
}

export interface ScriptGraph {
  nodes: ScriptGraphNode[];
  /** Problems found while reading the text, in French, ready to show. Never thrown: a graph that
   *  refuses to open because one `after` names a block that was renamed in the text would be worse
   *  than useless — it would be a trap. Unresolvable references are dropped and reported here. */
  warnings: string[];
}

/** The synthetic preamble's own id. Exported so the editor can recognise it; deliberately spelled
 *  like nothing a person would type, because it is the one id that never appears in a script. */
export const PREAMBLE_ID = "__preambule__";

/** Attribute keywords inside `@block(...)`. Anything else in first position is the block's own id. */
const ATTRIBUTE_KEYWORDS = new Set(["at", "after"]);

/** `@block(<attrs>) <title>` / `@block <title>` / the legacy `// %% <title>`. The attribute list is
 *  optional so that every block line written before this existed still parses. */
const BLOCK_HEADER_RE = /^[ \t]*@block(?:\(([^)]*)\))?[ \t]*(.*)$/;
const LEGACY_HEADER_RE = /^[ \t]*\/\/[ \t]*%%[ \t]*(.*)$/;

/** Turns a title into an id: lowercase, accents folded, non-word runs to a single dash. Only used
 *  when the source didn't carry one — an id read from the text is never rewritten, or every edge
 *  pointing at it would break. */
export function slugifyBlockId(title: string, taken: ReadonlySet<string>): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "bloc";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

interface ParsedHeader {
  id: string | null;
  at: { x: number; y: number } | null;
  after: string[] | null;
  title: string;
}

/** Reads the inside of `@block(...)`. Whitespace-separated tokens: a leading bare token is the id,
 *  `at` takes the next two numbers, `after` takes every id up to the next keyword. Deliberately
 *  forgiving — a malformed attribute is skipped rather than failing the whole parse, since the user
 *  may well be mid-keystroke in the text editor while the graph is being read. */
function parseHeaderAttributes(raw: string): Omit<ParsedHeader, "title"> {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  let id: string | null = null;
  let at: { x: number; y: number } | null = null;
  let after: string[] | null = null;

  let i = 0;
  if (tokens.length > 0 && !ATTRIBUTE_KEYWORDS.has(tokens[0])) {
    id = tokens[0];
    i = 1;
  }
  while (i < tokens.length) {
    const keyword = tokens[i++];
    if (keyword === "at") {
      const x = Number(tokens[i]);
      const y = Number(tokens[i + 1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        at = { x, y };
        i += 2;
      }
    } else if (keyword === "after") {
      const parents: string[] = [];
      while (i < tokens.length && !ATTRIBUTE_KEYWORDS.has(tokens[i])) parents.push(tokens[i++]);
      after = parents;
    }
  }
  return { id, at, after };
}

function parseHeader(line: string): ParsedHeader {
  const legacy = LEGACY_HEADER_RE.exec(line);
  if (legacy) return { id: null, at: null, after: null, title: legacy[1].trim() };
  const match = BLOCK_HEADER_RE.exec(line);
  if (!match) return { id: null, at: null, after: null, title: "" };
  return { ...parseHeaderAttributes(match[1] ?? ""), title: (match[2] ?? "").trim() };
}

/** Splits a script's own source into the graph it describes.
 *
 *  A block with no `after` attribute inherits the block written before it, which is what makes a
 *  plain notebook-style script read as a chain rather than as a heap of disconnected boxes. */
export function parseScriptGraph(code: string): ScriptGraph {
  const lines = code.split("\n");
  const headerIndices: number[] = [];
  lines.forEach((line, i) => {
    if (isBlockMarkerLine(line)) headerIndices.push(i);
  });

  const nodes: ScriptGraphNode[] = [];
  const warnings: string[] = [];

  const preambleEnd = headerIndices.length > 0 ? headerIndices[0] : lines.length;
  const preambleBody = lines.slice(0, preambleEnd).join("\n");
  // An entirely blank preamble is not worth a box of its own; anything else is, including a lone
  // `@indicator` line — hiding it would make the canvas quietly incomplete.
  const hasPreamble = preambleBody.trim() !== "";
  if (hasPreamble) {
    nodes.push({ id: PREAMBLE_ID, title: "Préambule", at: null, after: [], body: preambleBody, preamble: true });
  }

  const taken = new Set<string>(nodes.map((n) => n.id));
  const parsed = headerIndices.map((lineIndex, n) => {
    const bodyStart = lineIndex + 1;
    const bodyEnd = n + 1 < headerIndices.length ? headerIndices[n + 1] : lines.length;
    return { header: parseHeader(lines[lineIndex]), body: lines.slice(bodyStart, bodyEnd).join("\n") };
  });

  // Ids first, in one pass, so an `after` can reference a block written *later* in the file — which
  // it legitimately can, since the graph's order is the arrows', not the text's.
  const ids = parsed.map(({ header }) => {
    const authored = header.id !== null && !taken.has(header.id);
    const id = authored ? (header.id as string) : slugifyBlockId(header.title || "bloc", taken);
    taken.add(id);
    return { id, authored };
  });

  const allIds = ids.map((entry) => entry.id);
  parsed.forEach(({ header, body }, n) => {
    const previous = n === 0 ? (hasPreamble ? [PREAMBLE_ID] : []) : [allIds[n - 1]];
    let after = previous;
    if (header.after !== null) {
      const known = header.after.filter((parent) => allIds.includes(parent) || parent === PREAMBLE_ID);
      for (const missing of header.after.filter((parent) => !known.includes(parent))) {
        warnings.push(`Le bloc « ${header.title || allIds[n]} » suit « ${missing} », qui n'existe pas — lien ignoré.`);
      }
      after = known;
    }
    nodes.push({ id: allIds[n], authoredId: ids[n].authored, title: header.title, at: header.at, after, body });
  });

  return { nodes, warnings };
}

/** Writes a graph back out as a script. Bodies are copied verbatim; only the `@block` header lines
 *  are (re)generated.
 *
 *  `after` is written only when it isn't already implied by the order the blocks come out in — so a
 *  plain chain, which is what most scripts are, keeps header lines that read as they would if a
 *  person had typed them. */
export function serializeScriptGraph(graph: ScriptGraph): string {
  const order = topologicalOrder(graph);

  // Which nodes need their `after` spelled out, and therefore which ids have to be written for
  // those references to resolve. Decided in a first pass because a node may be referenced by one
  // written *after* it, and by then its own header line is already emitted.
  // The preamble is never named in a written `after`. Depending on it is a no-op — it runs before
  // everything by construction — so writing `after … __preambule__` into someone's script would be
  // pure noise in a file they have to read.
  const visibleAfter = (node: ScriptGraphNode) => node.after.filter((id) => id !== PREAMBLE_ID);
  const impliedFor = (previous: string | null) => (previous === null || previous === PREAMBLE_ID ? [] : [previous]);

  const explicitAfter = new Set<string>();
  const referenced = new Set<string>();
  let previous: string | null = null;
  for (const node of order) {
    if (!node.preamble) {
      const after = visibleAfter(node);
      const implied = impliedFor(previous);
      const sameAsImplied = after.length === implied.length && after.every((id, i) => id === implied[i]);
      if (!sameAsImplied) {
        explicitAfter.add(node.id);
        for (const parent of after) referenced.add(parent);
      }
    }
    previous = node.id;
  }

  const parts: string[] = [];
  previous = null;
  for (const node of order) {
    if (node.preamble) {
      parts.push(node.body);
      previous = node.id;
      continue;
    }
    // An id is written when it is the user's own, when a position is anchored to it, or when
    // another block points at it. Otherwise the header stays the plain `@block Titre` it was — so
    // merely *opening* the no-code view and switching back leaves the file untouched, which is the
    // whole reason positions are not assigned until something is actually moved.
    const attributes: string[] = [];
    if (node.authoredId || node.at || referenced.has(node.id)) attributes.push(node.id);
    if (node.at) attributes.push(`at ${Math.round(node.at.x)} ${Math.round(node.at.y)}`);
    if (explicitAfter.has(node.id)) {
      const after = visibleAfter(node);
      // A bare `after` with nothing behind it is how a block says "I depend on nothing" — without
      // it, the reader would inherit the block written before it (see `parseScriptGraph`).
      attributes.push(after.length > 0 ? `after ${after.join(" ")}` : "after");
    }
    const header = attributes.length > 0 ? `@block(${attributes.join(" ")})` : "@block";
    parts.push(`${header}${node.title ? ` ${node.title}` : ""}\n${node.body}`);
    previous = node.id;
  }
  return parts.join("\n");
}

/** Execution order: parents before children, and among nodes with no relationship, the order they
 *  are already in — so re-serializing a graph nobody has rewired produces the file it came from,
 *  line for line.
 *
 *  A cycle cannot be produced through the editor (`wouldCreateCycle` refuses the edge that would
 *  close one), but a hand-written `after` can say anything at all. Rather than fail, whatever is
 *  left once no node can be placed is appended in file order: the script it produces is wrong, but
 *  it is *visible*, which is the only way the user finds out. */
export function topologicalOrder(graph: ScriptGraph): ScriptGraphNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const placed = new Set<string>();
  const order: ScriptGraphNode[] = [];

  let progress = true;
  while (progress) {
    progress = false;
    for (const node of graph.nodes) {
      if (placed.has(node.id)) continue;
      if (!node.after.every((parent) => !byId.has(parent) || placed.has(parent))) continue;
      placed.add(node.id);
      order.push(node);
      progress = true;
    }
  }
  for (const node of graph.nodes) if (!placed.has(node.id)) order.push(node);
  return order;
}

/** Every node `id` transitively depends on, in execution order, `id` itself last. This is what
 *  "run this block" actually runs: a block on its own almost never stands up — it reads variables
 *  its parents declared — so running one means running the closure that leads to it, which is the
 *  graph's own generalisation of what the notebook view's "run through this cell" already did. */
export function runPathTo(graph: ScriptGraph, id: string): ScriptGraphNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const needed = new Set<string>();
  const visit = (nodeId: string) => {
    if (needed.has(nodeId)) return;
    const node = byId.get(nodeId);
    if (!node) return;
    needed.add(nodeId);
    for (const parent of node.after) visit(parent);
  };
  visit(id);
  return topologicalOrder(graph).filter((node) => needed.has(node.id));
}

/** The code a "run this block" actually sends to the engine: the run path's bodies, in order,
 *  joined as one script. Header lines are left out entirely — they carry no code, and the engine
 *  would strip them anyway. */
export function codeForRunPath(graph: ScriptGraph, id: string): string {
  return runPathTo(graph, id)
    .map((node) => node.body)
    .join("\n");
}

/** Whether adding `parent → child` would close a loop. Checked *before* the edge is added rather
 *  than repaired afterwards: a cycle has no execution order, so a graph is far better off never
 *  containing one than containing one the serializer has to guess its way around. */
export function wouldCreateCycle(graph: ScriptGraph, parentId: string, childId: string): boolean {
  if (parentId === childId) return true;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  // Walk up from the proposed parent: if the child is already one of its ancestors, the new edge
  // would close the loop.
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === childId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(byId.get(current)?.after ?? []));
  }
  return false;
}

/** Column/row spacing for the fallback layout below. Wide enough that a node's own box (see
 *  `.lq-script-graph__node` for its width) leaves room for the arrow between two columns to be
 *  read as an arrow rather than as a join. */
export const GRAPH_NODE_WIDTH = 230;
const COLUMN_GAP = 110;
const ROW_GAP = 40;
const NODE_HEIGHT = 96;
const ORIGIN = { x: 32, y: 28 };

/** Gives a position to every node that hasn't got one, by depth: a node sits one column right of
 *  its deepest parent, and rows fill top to bottom within a column. Runs on a script opened in
 *  no-code mode for the first time — where nothing has been placed by hand yet, and a pile of
 *  boxes at the origin would be useless. Nodes that *do* carry an `at` are left exactly where they
 *  are, so opening the view never moves anything the user positioned. */
export function layoutScriptGraph(graph: ScriptGraph): ScriptGraph {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const depths = new Map<string, number>();
  for (const node of topologicalOrder(graph)) {
    const parentDepths = node.after.map((parent) => (byId.has(parent) ? (depths.get(parent) ?? 0) + 1 : 0));
    depths.set(node.id, parentDepths.length > 0 ? Math.max(...parentDepths) : 0);
  }
  const usedRows = new Map<number, number>();
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.at) return node;
      const column = depths.get(node.id) ?? 0;
      const row = usedRows.get(column) ?? 0;
      usedRows.set(column, row + 1);
      return {
        ...node,
        at: {
          x: ORIGIN.x + column * (GRAPH_NODE_WIDTH + COLUMN_GAP),
          y: ORIGIN.y + row * (NODE_HEIGHT + ROW_GAP),
        },
      };
    }),
  };
}
