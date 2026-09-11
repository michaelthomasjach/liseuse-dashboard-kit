import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { PlayIcon, CloseIcon, PlusIcon } from "../../../../icons";
import { Modal } from "../../../../primitives/Modal";
import {
  GRAPH_NODE_WIDTH,
  codeForRunPath,
  layoutScriptGraph,
  parseScriptGraph,
  serializeScriptGraph,
  slugifyBlockId,
  wouldCreateCycle,
  PREAMBLE_ID,
  type ScriptGraph,
  type ScriptGraphNode,
} from "../scriptGraph";
import { SCRIPT_BLOCK_TEMPLATES, scriptBlockTemplateGroups, type ScriptBlockTemplate } from "../scriptBlockTemplates";
import "./ScriptGraphEditor.css";

/** Fixed, so an arrow can be anchored to a node's own middle without measuring it. Variable-height
 *  nodes would mean a ResizeObserver per node just to draw a line — and a diagram whose boxes are
 *  all the same size is easier to read anyway. Must match `.lq-script-graph__node`'s own height. */
const NODE_HEIGHT = 92;
/** Where the first named input port sits down a node's left edge, and how far apart the next ones
 *  are. Two fit inside `NODE_HEIGHT`; past that the ports run below the box, which is deliberate —
 *  a node with five inputs should look like one. */
const INPUT_PORT_TOP = 26;
const INPUT_PORT_GAP = 22;
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;

export interface ScriptGraphEditorProps {
  /** The script's own source. The graph is derived from it on every render and written back to it
   *  on every change — there is no second copy of the diagram anywhere, which is what makes
   *  switching to the code view mid-edit safe. */
  code: string;
  onChange: (code: string) => void;
  /** Runs one block: called with the code of that block and everything it depends on, already
   *  assembled (see `codeForRunPath`). */
  onRunBlock: (code: string) => void;
  running?: boolean;
  /** The editor for the selected block's own body. Passed in rather than built here so this
   *  component never imports CodeMirror — `ScriptEditorPanel` already loads it lazily, and a static
   *  import here would undo that for everyone who never opens the no-code view. `blockId` is the
   *  selected block's own id, for the host to key its editor on: without it, selecting another
   *  block would reuse the same editor instance and carry the previous block's undo history and
   *  cursor into code that has nothing to do with it. */
  renderBodyEditor: (value: string, onChange: (next: string) => void, blockId: string) => ReactNode;
}

type DragState =
  | { kind: "node"; id: string; grabX: number; grabY: number; x: number; y: number }
  | { kind: "palette"; template: ScriptBlockTemplate; x: number; y: number }
  | { kind: "link"; fromId: string; x: number; y: number }
  | { kind: "pan"; startX: number; startY: number; originX: number; originY: number };

/** How far a node may travel between press and release and still count as a click rather than a
 *  drag, in screen pixels. */
const CLICK_SLACK = 4;

/** The no-code view of a script: its `@block` cells as boxes on a canvas, the "runs after"
 *  relationships between them as arrows, and a palette of ready-made blocks to drag in.
 *
 *  Deliberately *not* a general flow-chart editor. Everything it can express, the script's own text
 *  can express too — see `scriptGraph.ts` for the syntax and for why the code, not this diagram, is
 *  the source of truth. That constraint is what lets the toolbar's mode switch be a genuine switch
 *  rather than a one-way door: nothing here can produce a script the code view cannot show, and
 *  nothing in the code view is lost by coming here and going back. */
export function ScriptGraphEditor({ code, onChange, onRunBlock, running, renderBodyEditor }: ScriptGraphEditorProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* Which block's code is open in the modal. Separate from `selectedId`, which also means "what a
     newly added block attaches to" and is set on pointer-down: tying the modal to it would pop it
     open at the start of every drag. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /* Where a node grab started, and whether it has since travelled far enough to count as a drag.
     A block is opened by a click that did not move it, which is the only way to tell a tap from
     the beginning of a drag — but "did not move" has to allow a few pixels of slack. A mouse or a
     trackpad reports movement on almost every press, so treating the very first pointermove as a
     drag made a perfectly ordinary click fail to open anything, at random. */
  const grabOriginRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  // Parsed fresh from the code every time it changes, then laid out — nodes the source positions
  // stay where they are, the rest get a place by depth (see `layoutScriptGraph`).
  const parsed = useMemo(() => parseScriptGraph(code), [code]);
  const graph = useMemo(() => layoutScriptGraph(parsed), [parsed]);
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const editing = graph.nodes.find((n) => n.id === editingId) ?? null;

  /** Writes a graph back to the code. Every mutation goes through here, so the code is updated
   *  synchronously with the diagram and the two can never drift apart. */
  const commit = useCallback((next: ScriptGraph) => onChange(serializeScriptGraph(next)), [onChange]);

  const withNodes = useCallback(
    (update: (nodes: ScriptGraphNode[]) => ScriptGraphNode[]) => commit({ ...graph, nodes: update(graph.nodes) }),
    [commit, graph],
  );

  /** Pointer position in canvas coordinates — the space node positions are written in. */
  function toCanvas(clientX: number, clientY: number) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - view.x) / view.scale, y: (clientY - rect.top - view.y) / view.scale };
  }

  function onSurfacePointerMove(e: ReactPointerEvent) {
    if (!drag) return;
    if (drag.kind === "pan") {
      setView((v) => ({ ...v, x: drag.originX + (e.clientX - drag.startX), y: drag.originY + (e.clientY - drag.startY) }));
      return;
    }
    const point = toCanvas(e.clientX, e.clientY);
    if (drag.kind === "node") {
      const origin = grabOriginRef.current;
      if (origin !== null && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > CLICK_SLACK) draggedRef.current = true;
      setDrag({ ...drag, x: point.x - drag.grabX, y: point.y - drag.grabY });
    }
    else setDrag({ ...drag, x: point.x, y: point.y });
  }

  function onSurfacePointerUp() {
    if (!drag) return;
    if (drag.kind === "node") {
      // Commits the *laid-out* graph, not the parsed one: the moment anything is placed by hand,
      // every other node's position is pinned too. Otherwise the ones still being auto-placed would
      // shuffle around the one that isn't, every time the graph changed.
      withNodes((nodes) => nodes.map((n) => (n.id === drag.id ? { ...n, at: { x: drag.x, y: drag.y } } : n)));
    } else if (drag.kind === "palette") {
      addBlock(drag.template, { x: drag.x - GRAPH_NODE_WIDTH / 2, y: drag.y - NODE_HEIGHT / 2 });
    }
    setDrag(null);
  }

  /** Where a tapped (rather than dragged) block goes: to the right of whatever it will follow, or
   *  below it when the right would land outside the part of the canvas actually on screen. Placing
   *  a block where the user cannot see it is the one outcome worth going out of the way to avoid —
   *  it reads as "nothing happened", and the block is then also impossible to grab. */
  function spotBesideAnchor(): { x: number; y: number } {
    const anchor = selected ?? graph.nodes[graph.nodes.length - 1];
    if (!anchor?.at) return { x: 32, y: 28 };
    const right = { x: anchor.at.x + GRAPH_NODE_WIDTH + 110, y: anchor.at.y };
    const surfaceWidth = surfaceRef.current?.clientWidth ?? 0;
    const rightEdgeOnScreen = (right.x + GRAPH_NODE_WIDTH) * view.scale + view.x;
    if (surfaceWidth === 0 || rightEdgeOnScreen <= surfaceWidth) return right;
    return { x: anchor.at.x, y: anchor.at.y + NODE_HEIGHT + 40 };
  }

  function addBlock(template: ScriptBlockTemplate, at: { x: number; y: number }) {
    const taken = new Set(graph.nodes.map((n) => n.id));
    const id = slugifyBlockId(template.title, taken);
    // Joined to whatever is selected, or to the last block if nothing is — an unconnected block is
    // almost never what someone dropping one wants, and detaching it afterwards is one click.
    const parent = selected ?? graph.nodes[graph.nodes.length - 1] ?? null;
    const node: ScriptGraphNode = {
      id,
      title: template.title,
      at,
      after: parent ? [{ from: parent.id }] : [],
      body: template.body,
    };
    commit({ ...graph, nodes: [...graph.nodes, node] });
    setSelectedId(id);
  }

  /** Wires one block's output into one of another's inputs. `input` names which — left off, the
   *  block's default, unnamed one. A block's output may feed several of the same block's inputs:
   *  each is its own edge, and the pair (parent, input) is what must be unique, not the parent. */
  function connect(parentId: string, childId: string, input?: string) {
    const child = graph.nodes.find((n) => n.id === childId);
    if (!child || child.preamble) return;
    // Nothing depends on the preamble explicitly: it already runs before every block, so the edge
    // would draw a promise the script cannot break. Its arrow to the first block is drawn from the
    // implicit chain instead.
    if (parentId === PREAMBLE_ID) return;
    if (child.after.some((edge) => edge.from === parentId && edge.input === input)) return;
    if (wouldCreateCycle(graph, parentId, childId)) return;
    withNodes((nodes) => nodes.map((n) => (n.id === childId ? { ...n, after: [...n.after, { from: parentId, input }] } : n)));
  }

  function disconnect(parentId: string, childId: string, input?: string) {
    withNodes((nodes) =>
      nodes.map((n) => (n.id === childId ? { ...n, after: n.after.filter((e) => !(e.from === parentId && e.input === input)) } : n)),
    );
  }

  /** Declares one more named input on a block. The first one also names the input the block
   *  already had: a block that has been given ports should not keep an unlabelled one beside them,
   *  which would leave the reader to guess which is which. Existing arrows are re-pointed at it, so
   *  naming inputs never quietly unwires anything. */
  function addInput(id: string, name: string) {
    const trimmed = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").toLowerCase();
    if (!trimmed) return;
    withNodes((nodes) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        const existing = n.inputs ?? [];
        if (existing.includes(trimmed)) return n;
        const inputs = existing.length === 0 ? ["entrée", trimmed] : [...existing, trimmed];
        const after = existing.length === 0 ? n.after.map((e) => ({ ...e, input: e.input ?? "entrée" })) : n.after;
        return { ...n, inputs, after };
      }),
    );
  }

  /** Removes a named input, and every arrow that fed it — the arrows belonged to that port, and
   *  silently re-pointing them at another one would rewire the script behind the user's back. */
  function removeInput(id: string, name: string) {
    withNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, inputs: (n.inputs ?? []).filter((i) => i !== name), after: n.after.filter((e) => e.input !== name) } : n,
      ),
    );
  }

  function removeNode(id: string) {
    const removed = graph.nodes.find((n) => n.id === id);
    if (!removed || removed.preamble) return;
    withNodes((nodes) =>
      nodes
        .filter((n) => n.id !== id)
        // Its children inherit its parents, so deleting a block from the middle of a chain closes
        // the gap instead of cutting everything downstream loose.
        .map((n) =>
          n.after.some((e) => e.from === id)
            ? {
                ...n,
                after: [
                  ...n.after.filter((e) => e.from !== id),
                  // The removed block's own parents take its place, on whichever of this block's
                  // inputs it was feeding — so closing the gap keeps the wiring's shape.
                  ...n.after
                    .filter((e) => e.from === id)
                    .flatMap((e) => removed.after.map((inherited) => ({ from: inherited.from, input: e.input })))
                    .filter((e, i, all) => all.findIndex((o) => o.from === e.from && o.input === e.input) === i),
                ],
              }
            : n,
        ),
    );
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  function setNodeTitle(id: string, title: string) {
    withNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, title } : n)));
  }

  function setNodeBody(id: string, body: string) {
    withNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, body } : n)));
  }

  /** Where a node is drawn right now — its committed position, or the one the pointer is currently
   *  holding it at. */
  function positionOf(node: ScriptGraphNode) {
    if (drag?.kind === "node" && drag.id === node.id) return { x: drag.x, y: drag.y };
    return node.at ?? { x: 0, y: 0 };
  }

  const edges = graph.nodes.flatMap((node) =>
    node.after
      .filter((edge) => graph.nodes.some((n) => n.id === edge.from))
      .map((edge) => ({ parentId: edge.from, childId: node.id, input: edge.input })),
  );

  /** How far down a node's own left edge one of its input ports sits. A block with no declared
   *  inputs has its single port at mid-height, exactly where it always was; declared ones are
   *  spread evenly over the node's height so several arrows into the same block stay told apart. */
  function inputOffsetY(node: ScriptGraphNode | undefined, input: string | undefined) {
    const inputs = node?.inputs ?? [];
    if (inputs.length === 0) return NODE_HEIGHT / 2;
    const index = input === undefined ? 0 : Math.max(0, inputs.indexOf(input));
    return INPUT_PORT_TOP + index * INPUT_PORT_GAP;
  }

  function edgePath(from: { x: number; y: number }, to: { x: number; y: number }, toOffsetY = NODE_HEIGHT / 2) {
    const x1 = from.x + GRAPH_NODE_WIDTH;
    const y1 = from.y + NODE_HEIGHT / 2;
    const x2 = to.x;
    const y2 = to.y + toOffsetY;
    // Horizontal control points, so an arrow leaves an output port and enters an input port
    // travelling sideways whichever way the two boxes actually sit relative to each other.
    const reach = Math.max(40, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + reach} ${y1}, ${x2 - reach} ${y2}, ${x2} ${y2}`;
  }

  return (
    <div className="lq-script-graph">
      <div className="lq-script-graph__palette">
        <p className="lq-script-graph__palette-intro">
          Glissez un bloc sur la zone, ou cliquez-le pour l'ajouter à la suite du bloc sélectionné.
        </p>
        {scriptBlockTemplateGroups().map(({ group, templates }) => (
          <section key={group} className="lq-script-graph__palette-group">
            <h4 className="lq-script-graph__palette-title">{group}</h4>
            {templates.map((template) => (
              <button
                key={template.key}
                type="button"
                className="lq-script-graph__palette-item"
                onPointerDown={(e) => {
                  const point = toCanvas(e.clientX, e.clientY);
                  setDrag({ kind: "palette", template, x: point.x, y: point.y });
                }}
                // Releasing *on the palette item itself* means the block was tapped, not dragged
                // out — so it is added beside whatever is selected. A real drag releases over the
                // canvas, which is where `onSurfacePointerUp` places it at the drop point instead.
                // Deliberately not an `onClick`: a click fires on the nearest common ancestor of
                // press and release, so a drag onto the canvas would fire one here too and add a
                // second block nobody asked for.
                onPointerUp={() => {
                  if (drag?.kind !== "palette") return;
                  addBlock(template, spotBesideAnchor());
                  setDrag(null);
                }}
              >
                <span className="lq-script-graph__palette-item-title">
                  <PlusIcon size={11} /> {template.title}
                </span>
                <span className="lq-script-graph__palette-item-hint">{template.hint}</span>
              </button>
            ))}
          </section>
        ))}
      </div>

      <div className="lq-script-graph__stage">
        <div className="lq-script-graph__toolbar">
          <button type="button" onClick={() => setView((v) => ({ ...v, scale: Math.max(MIN_SCALE, v.scale - 0.15) }))} aria-label="Dézoomer">
            −
          </button>
          <span className="lq-script-graph__zoom">{Math.round(view.scale * 100)} %</span>
          <button type="button" onClick={() => setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, v.scale + 0.15) }))} aria-label="Zoomer">
            +
          </button>
          <button type="button" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>
            Recadrer
          </button>
          <span className="lq-script-graph__count">
            {graph.nodes.length} bloc{graph.nodes.length > 1 ? "s" : ""}
          </span>
        </div>

        {graph.warnings.length > 0 && (
          <div className="lq-script-graph__warnings">
            {graph.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        <div
          ref={surfaceRef}
          className={["lq-script-graph__surface", drag?.kind === "pan" && "lq-script-graph__surface--panning"].filter(Boolean).join(" ")}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains("lq-script-graph__canvas")) return;
            setSelectedId(null);
            setDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y });
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerCancel={() => setDrag(null)}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setView((v) => ({ ...v, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale - e.deltaY * 0.002)) }));
          }}
        >
          <div
            className="lq-script-graph__canvas"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            <svg className="lq-script-graph__edges" aria-hidden="true">
              <defs>
                <marker id="lq-graph-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--lq-color-border)" />
                </marker>
              </defs>
              {edges.map(({ parentId, childId, input }) => {
                const parent = graph.nodes.find((n) => n.id === parentId);
                const child = graph.nodes.find((n) => n.id === childId);
                if (!parent || !child) return null;
                const path = edgePath(positionOf(parent), positionOf(child), inputOffsetY(child, input));
                return (
                  // Keyed by the input too: one block's output may feed several inputs of the same
                  // block, and those edges differ in nothing else.
                  <g key={`${parentId}->${childId}:${input ?? ""}`} className="lq-script-graph__edge">
                    <path d={path} markerEnd="url(#lq-graph-arrow)" />
                    {/* A second, invisible, much thicker copy: a 1.5px curve is impossible to hit
                        with a pointer, and this is what carries the click that removes the link. */}
                    <path className="lq-script-graph__edge-hit" d={path} onClick={() => disconnect(parentId, childId, input)}>
                      <title>{input ? `Cliquer pour supprimer ce lien vers « ${input} »` : "Cliquer pour supprimer ce lien"}</title>
                    </path>
                  </g>
                );
              })}
              {drag?.kind === "link" &&
                (() => {
                  const from = graph.nodes.find((n) => n.id === drag.fromId);
                  if (!from) return null;
                  return (
                    <path
                      className="lq-script-graph__edge-pending"
                      d={edgePath(positionOf(from), { x: drag.x, y: drag.y - NODE_HEIGHT / 2 })}
                    />
                  );
                })()}
            </svg>

            {graph.nodes.map((node) => {
              const at = positionOf(node);
              return (
                <div
                  key={node.id}
                  className={[
                    "lq-script-graph__node",
                    node.preamble && "lq-script-graph__node--preamble",
                    selectedId === node.id && "lq-script-graph__node--selected",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: at.x, top: at.y, width: GRAPH_NODE_WIDTH }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(node.id);
                    grabOriginRef.current = { x: e.clientX, y: e.clientY };
                    draggedRef.current = false;
                    // The preamble is pinned: it has no `@block` line to write a position on, and
                    // it always runs first anyway (see ScriptGraphNode.preamble).
                    if (node.preamble) return;
                    const point = toCanvas(e.clientX, e.clientY);
                    setDrag({ kind: "node", id: node.id, grabX: point.x - at.x, grabY: point.y - at.y, x: at.x, y: at.y });
                  }}
                  onClick={() => {
                    if (draggedRef.current) return;
                    setEditingId(node.id);
                  }}
                >
                  {!node.preamble &&
                    (node.inputs && node.inputs.length > 0 ? (
                      // One port per declared input, labelled and spread down the node's own left
                      // edge — which is what lets one block's output be wired into two of them and
                      // still be read apart.
                      node.inputs.map((input, i) => (
                        <span
                          key={input}
                          className="lq-script-graph__port lq-script-graph__port--in lq-script-graph__port--named"
                          style={{ top: INPUT_PORT_TOP + i * INPUT_PORT_GAP }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            if (drag?.kind === "link") connect(drag.fromId, node.id, input);
                            setDrag(null);
                          }}
                        >
                          <span className="lq-script-graph__port-label">{input}</span>
                          <button
                            type="button"
                            className="lq-script-graph__port-remove"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removeInput(node.id, input)}
                            aria-label={`Supprimer l'entrée ${input} de ${node.title}`}
                            title="Supprimer cette entrée"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      <span
                        className="lq-script-graph__port lq-script-graph__port--in"
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          if (drag?.kind === "link") connect(drag.fromId, node.id);
                          setDrag(null);
                        }}
                      />
                    ))}
                  <div className="lq-script-graph__node-head">
                    <span className="lq-script-graph__node-title">{node.title || "Sans titre"}</span>
                    <span className="lq-script-graph__node-actions">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onRunBlock(codeForRunPath(graph, node.id))}
                        disabled={running}
                        title="Exécuter ce bloc et tout ce dont il dépend"
                        aria-label={`Exécuter ${node.title}`}
                      >
                        <PlayIcon size={11} />
                      </button>
                      {!node.preamble && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            const name = window.prompt("Nom de la nouvelle entrée", `entrée ${(node.inputs?.length ?? 1) + 1}`);
                            if (name !== null) addInput(node.id, name);
                          }}
                          title="Ajouter une entrée nommée à ce bloc"
                          aria-label={`Ajouter une entrée à ${node.title}`}
                        >
                          <PlusIcon size={11} />
                        </button>
                      )}
                      {!node.preamble && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => removeNode(node.id)}
                          title="Supprimer ce bloc"
                          aria-label={`Supprimer ${node.title}`}
                        >
                          <CloseIcon size={10} />
                        </button>
                      )}
                    </span>
                  </div>
                  <pre className="lq-script-graph__node-body">{node.body.trim() || "// vide"}</pre>
                  <span
                    className="lq-script-graph__port lq-script-graph__port--out"
                    // Where arrows leave from — but on the preamble it is only that: a block cannot
                    // be made to depend on the preamble, since it already depends on it (see
                    // `connect`), so there is nothing to drag out of it.
                    title={node.preamble ? undefined : "Glisser vers un autre bloc pour le faire suivre celui-ci"}
                    onPointerDown={
                      node.preamble
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            const point = toCanvas(e.clientX, e.clientY);
                            setDrag({ kind: "link", fromId: node.id, x: point.x, y: point.y });
                          }
                    }
                  />
                </div>
              );
            })}

            {drag?.kind === "palette" && (
              <div
                className="lq-script-graph__node lq-script-graph__node--ghost"
                style={{ left: drag.x - GRAPH_NODE_WIDTH / 2, top: drag.y - NODE_HEIGHT / 2, width: GRAPH_NODE_WIDTH }}
              >
                <div className="lq-script-graph__node-head">
                  <span className="lq-script-graph__node-title">{drag.template.title}</span>
                </div>
                <pre className="lq-script-graph__node-body">{drag.template.body.trim()}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditingId(null)}
        size="wide"
        title={
          editing === null ? null : editing.preamble ? (
            "Préambule — s'exécute avant tous les blocs"
          ) : (
            <input
              className="lq-script-graph__inspector-name"
              value={editing.title}
              onChange={(e) => setNodeTitle(editing.id, e.target.value)}
              placeholder="Titre du bloc"
              aria-label="Titre du bloc"
            />
          )
        }
        footer={
          editing === null ? null : (
            <button
              type="button"
              className="lq-script-graph__inspector-run"
              onClick={() => onRunBlock(codeForRunPath(graph, editing.id))}
              disabled={running}
            >
              <PlayIcon size={12} /> Exécuter jusqu'ici
            </button>
          )
        }
      >
        {editing !== null && (
          <div className="lq-script-graph__inspector-editor">
            {renderBodyEditor(editing.body, (next) => setNodeBody(editing.id, next), editing.id)}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Re-exported so `ScriptEditorPanel` can offer "ajouter un bloc" without importing the palette
 *  module itself. */
export { SCRIPT_BLOCK_TEMPLATES };
