import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronRightIcon } from "../icons";
import { Checkbox } from "../forms/Checkbox";
import { Spinner } from "../feedback/Spinner";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import "./TreeView.css";

export interface TreeNode {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
  /** With `loadChildren`: this node has children that aren't in `children` yet — it gets a chevron,
   *  and expanding it the first time calls `loadChildren(node)`. Ignored when `children` is set. */
  hasChildren?: boolean;
}

export type TreeDropPosition = "before" | "after" | "inside";

export interface TreeViewProps {
  nodes: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  defaultExpandedIds?: string[];
  /** Controlled expanded set; pass with `onExpandedChange` to own the state yourself. */
  expandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Enables drag-and-drop reordering/reparenting; called on drop with the dragged node's id, the
   *  node it was dropped on, and where relative to it. Pair with `moveTreeNode` to update `nodes`. */
  onMove?: (draggedId: string, targetId: string, position: TreeDropPosition) => void;
  /** A checkbox in front of every node. Checking a parent checks its whole subtree; a parent whose
   *  children are only partly checked shows the indeterminate state. */
  checkable?: boolean;
  /** Controlled checked set (every checked id, parents included); pair with `onCheckedChange`. */
  checkedIds?: string[];
  defaultCheckedIds?: string[];
  onCheckedChange?: (ids: string[]) => void;
  /** Default icons for nodes without their own `icon`: an open or closed folder for a parent, a file
   *  for a leaf. */
  showIcons?: boolean;
  /** Right-click (or the Menu key / Shift+F10 on the focused node) opens a `ContextMenu` with these
   *  items. Return an empty array to leave a node without a menu. */
  contextMenu?: (node: TreeNode) => ContextMenuItem[];
  /** Keeps only the nodes whose label contains this text (case and accents ignored) and their
   *  ancestors, unfolds those ancestors and highlights the match. Children not loaded yet (see
   *  `loadChildren`) aren't searched. */
  filter?: string;
  /** Shown instead of the tree when `filter` matches nothing. */
  filterEmptyMessage?: string;
  /** Vertical guide lines joining each parent to its children. */
  showGuides?: boolean;
  density?: "normal" | "compact";
  /** Lazy loading: called the first time a node with `hasChildren` (and no `children`) is expanded.
   *  A spinner replaces its chevron until the promise settles. */
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  /** Accessible name of the tree. */
  ariaLabel?: string;
  className?: string;
}

interface DragState {
  draggedId: string | null;
  overId: string | null;
  position: TreeDropPosition | null;
}

const NO_DRAG: DragState = { draggedId: null, overId: null, position: null };

/** One row of the tree as currently displayed (after filtering, only under expanded parents). */
interface VisibleRow {
  node: TreeNode;
  parentId: string | null;
  expandable: boolean;
  open: boolean;
}

/** Everything a row needs from the tree, passed down once instead of prop by prop. */
interface TreeContext {
  childrenOf: (node: TreeNode) => TreeNode[] | undefined;
  isExpandable: (node: TreeNode) => boolean;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  selectedId?: string | null;
  select: (node: TreeNode) => void;
  tabbableId: string | null;
  focusItem: (id: string) => void;
  registerItem: (id: string, el: HTMLLIElement | null) => void;
  onMove?: TreeViewProps["onMove"];
  dragState: DragState;
  setDragState: (updater: DragState | ((s: DragState) => DragState)) => void;
  checkable: boolean;
  checkState: (node: TreeNode) => boolean | "mixed";
  toggleCheck: (node: TreeNode) => void;
  showIcons: boolean;
  openMenu: (node: TreeNode, x: number, y: number) => boolean;
  loading: Set<string>;
  failed: Set<string>;
  query: string;
}

/** Case- and accent-insensitive folding that keeps one character per character, so an index found
 *  in the folded label is also an index in the original one. */
function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const f = ch.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
    out += f.length === ch.length ? f : ch.toLocaleLowerCase("fr");
  }
  return out;
}

/** Recursive expand/collapse tree — file explorers, category trees, org charts. Pass `onMove` to
 *  enable drag-and-drop; see `moveTreeNode` for a ready-made immutable reducer. Optional checkboxes
 *  with cascade, default folder/file icons, a context menu, filtering, guide lines, a compact density
 *  and lazy loading. Keyboard: the ARIA treeview pattern (arrows, Home/End, Enter/Space, `*`, type-ahead). */
export function TreeView({
  nodes,
  selectedId,
  onSelect,
  defaultExpandedIds = [],
  expandedIds,
  onExpandedChange,
  onMove,
  checkable = false,
  checkedIds,
  defaultCheckedIds = [],
  onCheckedChange,
  showIcons = false,
  contextMenu,
  filter,
  filterEmptyMessage = "Aucun élément ne correspond",
  showGuides = false,
  density = "normal",
  loadChildren,
  ariaLabel,
  className,
}: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set(defaultExpandedIds));
  const [dragState, setDragState] = useState<DragState>(NO_DRAG);
  const [internalChecked, setInternalChecked] = useState<Set<string>>(new Set(defaultCheckedIds));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ node: TreeNode; x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState<Record<string, TreeNode[]>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const typeAhead = useRef({ text: "", at: 0 });

  const expanded = expandedIds ? new Set(expandedIds) : internalExpanded;
  const checked = checkedIds ? new Set(checkedIds) : internalChecked;
  const query = fold((filter ?? "").trim());

  const childrenOf = (node: TreeNode) => node.children ?? loaded[node.id];
  const isLazyPending = (node: TreeNode) =>
    Boolean(loadChildren && node.hasChildren && !node.children && !(node.id in loaded));
  const isExpandable = (node: TreeNode) => (childrenOf(node)?.length ?? 0) > 0 || isLazyPending(node);

  // Filtering: keep a match and its ancestors. A matching parent keeps its whole subtree (collapsed)
  // unless some descendant matches too, in which case only the matching branches stay.
  const { shown, forcedOpen } = useMemo(() => {
    const forced = new Set<string>();
    if (!query) return { shown: nodes, forcedOpen: forced };
    function walk(list: TreeNode[]): TreeNode[] {
      const out: TreeNode[] = [];
      for (const n of list) {
        const kids = n.children ?? loaded[n.id];
        const keptKids = kids ? walk(kids) : [];
        const selfMatch = fold(n.label).includes(query);
        if (keptKids.length > 0) {
          forced.add(n.id);
          out.push({ ...n, children: keptKids });
        } else if (selfMatch) {
          out.push(n);
        }
      }
      return out;
    }
    return { shown: walk(nodes), forcedOpen: forced };
  }, [nodes, loaded, query]);

  // While filtering, the matches' ancestors are open by force; the ones the user folds anyway are
  // remembered here, and forgotten as soon as the filter text changes.
  const [filterOverride, setFilterOverride] = useState<{ query: string; closed: Set<string> }>({ query, closed: new Set() });
  const overrideClosed = filterOverride.query === query ? filterOverride.closed : new Set<string>();

  const isOpen = (id: string) => (query && forcedOpen.has(id) ? !overrideClosed.has(id) : expanded.has(id));

  function setExpanded(next: Set<string>) {
    if (expandedIds) onExpandedChange?.(Array.from(next));
    else {
      setInternalExpanded(next);
      onExpandedChange?.(Array.from(next));
    }
  }

  function toggle(id: string) {
    if (failed.has(id)) {
      // Folding a node whose load failed, then unfolding it, tries again.
      setFailed((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
    if (query && forcedOpen.has(id)) {
      const closed = new Set(overrideClosed);
      if (closed.has(id)) closed.delete(id);
      else closed.add(id);
      setFilterOverride({ query, closed });
      return;
    }
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  // The rows as displayed, in order — what the arrow keys walk through.
  const visible: VisibleRow[] = [];
  (function flatten(list: TreeNode[], parentId: string | null) {
    for (const node of list) {
      const expandable = isExpandable(node);
      const open = expandable && isOpen(node.id);
      visible.push({ node, parentId, expandable, open });
      const kids = childrenOf(node);
      if (open && kids) flatten(kids, node.id);
    }
  })(shown, null);

  const tabbableId =
    (focusedId && visible.some((r) => r.node.id === focusedId) && focusedId) ||
    (selectedId && visible.some((r) => r.node.id === selectedId) && selectedId) ||
    visible[0]?.node.id ||
    null;

  // Lazy loading: whenever a pending node is open (by a click, a key, `defaultExpandedIds` or the
  // controlled set), fetch its children once.
  const pendingOpen = visible.filter((r) => r.open && isLazyPending(r.node) && !loading.has(r.node.id) && !failed.has(r.node.id));
  const pendingKey = pendingOpen.map((r) => r.node.id).join("|");
  const latest = useRef({ checked, checkedIds, onCheckedChange, loadChildren });
  useEffect(() => {
    latest.current = { checked, checkedIds, onCheckedChange, loadChildren };
  });
  useEffect(() => {
    if (!pendingKey || !latest.current.loadChildren) return;
    for (const { node } of pendingOpen) {
      setLoading((s) => new Set(s).add(node.id));
      latest.current
        .loadChildren!(node)
        .then((kids) => {
          setLoaded((m) => ({ ...m, [node.id]: kids }));
          // Children arriving under a checked parent are born checked.
          const { checked: cur, checkedIds: ctl, onCheckedChange: notify } = latest.current;
          if (cur.has(node.id) && kids.length > 0) {
            const next = new Set(cur);
            collectIds(kids, (n) => n.children, next);
            if (!ctl) setInternalChecked(next);
            notify?.(Array.from(next));
          }
        })
        .catch(() => setFailed((s) => new Set(s).add(node.id)))
        .finally(() =>
          setLoading((s) => {
            const next = new Set(s);
            next.delete(node.id);
            return next;
          }),
        );
    }
    // pendingOpen is described entirely by pendingKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  // ── Checkboxes ──────────────────────────────────────────────────────────────────────────────
  // Checks always reason on the real tree, not on the copy pruned by the filter.
  const originals = new Map<string, TreeNode>();
  (function index(list: TreeNode[]) {
    for (const n of list) {
      originals.set(n.id, n);
      const kids = childrenOf(n);
      if (kids) index(kids);
    }
  })(nodes);

  function checkState(shownNode: TreeNode): boolean | "mixed" {
    const node = originals.get(shownNode.id) ?? shownNode;
    if (checked.has(node.id)) return true;
    const kids = childrenOf(node);
    if (!kids?.length) return false;
    return kids.some((k) => checkState(k) !== false) ? "mixed" : false;
  }

  function toggleCheck(shownNode: TreeNode) {
    const node = originals.get(shownNode.id) ?? shownNode;
    if (node.disabled) return;
    const next = new Set(checked);
    const on = !next.has(node.id);
    // The node and its whole enabled subtree follow…
    (function cascade(n: TreeNode) {
      if (on) next.add(n.id);
      else next.delete(n.id);
      for (const k of childrenOf(n) ?? []) if (!k.disabled) cascade(k);
    })(node);
    // …then every ancestor, bottom-up: checked exactly when all its enabled children are.
    const path = pathTo(nodes, node.id, childrenOf);
    for (let i = path.length - 2; i >= 0; i--) {
      const parent = path[i];
      const kids = (childrenOf(parent) ?? []).filter((k) => !k.disabled);
      if (kids.length && kids.every((k) => next.has(k.id))) next.add(parent.id);
      else next.delete(parent.id);
    }
    if (!checkedIds) setInternalChecked(next);
    onCheckedChange?.(Array.from(next));
  }

  // ── Focus and keyboard ──────────────────────────────────────────────────────────────────────
  function focusItem(id: string) {
    setFocusedId(id);
    itemRefs.current.get(id)?.focus({ preventScroll: false });
  }

  function select(node: TreeNode) {
    if (node.disabled) return;
    onSelect?.(node.id);
  }

  function openMenu(node: TreeNode, x: number, y: number) {
    if (!contextMenu) return false;
    const items = contextMenu(node);
    if (!items.length) return false;
    setFocusedId(node.id);
    setMenu({ node, x, y });
    return true;
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLUListElement>) {
    const item = (e.target as HTMLElement).closest<HTMLElement>("[role='treeitem']");
    // Keys typed in the checkbox or a button keep their native meaning; the tree reacts to its items.
    if (!item || e.target !== item) return;
    const index = visible.findIndex((r) => r.node.id === item.dataset.id);
    if (index < 0) return;
    const row = visible[index];
    const go = (r: VisibleRow | undefined) => r && focusItem(r.node.id);

    switch (e.key) {
      case "ArrowDown":
        go(visible[index + 1]);
        break;
      case "ArrowUp":
        go(visible[index - 1]);
        break;
      case "Home":
        go(visible[0]);
        break;
      case "End":
        go(visible[visible.length - 1]);
        break;
      case "ArrowRight":
        if (row.expandable && !row.open) toggle(row.node.id);
        else if (row.open) go(visible[index + 1]?.parentId === row.node.id ? visible[index + 1] : undefined);
        break;
      case "ArrowLeft":
        if (row.open) toggle(row.node.id);
        else if (row.parentId) focusItem(row.parentId);
        break;
      case "Enter":
        select(row.node);
        if (row.expandable) toggle(row.node.id);
        break;
      case " ":
        if (checkable) toggleCheck(row.node);
        else select(row.node);
        break;
      case "*": {
        // Expands every sibling of the focused node, as the ARIA pattern describes.
        const siblings = visible.filter((r) => r.parentId === row.parentId && r.expandable && !r.open);
        if (!siblings.length) break;
        const next = new Set(expanded);
        const closed = new Set(overrideClosed);
        for (const s of siblings) {
          next.add(s.node.id);
          closed.delete(s.node.id);
        }
        setExpanded(next);
        if (query) setFilterOverride({ query, closed });
        break;
      }
      case "ContextMenu":
      case "F10": {
        if (e.key === "F10" && !e.shiftKey) return;
        const rect = item.querySelector(".lq-tree__label")?.getBoundingClientRect() ?? item.getBoundingClientRect();
        if (!openMenu(row.node, rect.left + 12, rect.bottom)) return;
        break;
      }
      default: {
        // Type-ahead: the next visible node whose label starts with what was just typed.
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || !/\S/.test(e.key)) return;
        const now = e.timeStamp;
        const t = typeAhead.current;
        t.text = now - t.at > 600 ? e.key : t.text + e.key;
        t.at = now;
        const needle = fold(t.text);
        const order = [...visible.slice(index + (t.text.length === 1 ? 1 : 0)), ...visible.slice(0, index + 1)];
        go(order.find((r) => fold(r.node.label).startsWith(needle)));
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }

  const ctx: TreeContext = {
    childrenOf,
    isExpandable,
    isOpen,
    toggle,
    selectedId,
    select,
    tabbableId,
    focusItem,
    registerItem: (id, el) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    },
    onMove,
    dragState,
    setDragState,
    checkable,
    checkState,
    toggleCheck,
    showIcons,
    openMenu,
    loading,
    failed,
    query,
  };

  return (
    <>
      {query && shown.length === 0 ? (
        <p className={["lq-tree__empty", className].filter(Boolean).join(" ")} role="status">
          {filterEmptyMessage}
        </p>
      ) : (
        <ul
          className={[
            "lq-tree",
            density === "compact" && "lq-tree--compact",
            showGuides && "lq-tree--guides",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          role="tree"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
        >
          {shown.map((node) => (
            <TreeItem key={node.id} node={node} depth={0} ctx={ctx} />
          ))}
        </ul>
      )}
      {menu && contextMenu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={contextMenu(menu.node)}
          ariaLabel={`Actions sur « ${menu.node.label} »`}
          onClose={() => {
            const id = menu.node.id;
            setMenu(null);
            // Back to the node the menu was about, unless a command just removed it.
            requestAnimationFrame(() => itemRefs.current.get(id)?.focus());
          }}
        />
      )}
    </>
  );
}

function TreeItem({ node, depth, ctx }: { node: TreeNode; depth: number; ctx: TreeContext }) {
  const { dragState, setDragState, onMove } = ctx;
  const kids = ctx.childrenOf(node);
  const hasChildren = ctx.isExpandable(node);
  const isOpen = hasChildren && ctx.isOpen(node.id);
  const isLoading = ctx.loading.has(node.id);
  const hasFailed = ctx.failed.has(node.id) && !kids;
  const isSelected = node.id === ctx.selectedId;
  const draggable = Boolean(onMove) && !node.disabled;
  const isDragging = dragState.draggedId === node.id;
  const isDropTarget = dragState.overId === node.id && dragState.draggedId !== node.id;
  const checkState = ctx.checkable ? ctx.checkState(node) : undefined;
  const depthStyle = { "--lq-tree-depth": depth } as CSSProperties;

  const icon =
    node.icon ??
    (ctx.showIcons ? (
      hasChildren ? (
        isOpen ? <FolderOpenGlyph /> : <FolderGlyph />
      ) : (
        <FileGlyph />
      )
    ) : null);

  return (
    <li
      ref={(el) => ctx.registerItem(node.id, el)}
      role="treeitem"
      className="lq-tree__item"
      data-id={node.id}
      tabIndex={node.id === ctx.tabbableId ? 0 : -1}
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
      aria-checked={checkState}
      aria-disabled={node.disabled}
      aria-busy={isLoading || undefined}
      onFocus={(e) => {
        if (e.target === e.currentTarget) ctx.focusItem(node.id);
      }}
    >
      <div
        className={[
          "lq-tree__row",
          isSelected && "lq-tree__row--selected",
          node.disabled && "lq-tree__row--disabled",
          isDragging && "lq-tree__row--dragging",
          isDropTarget && dragState.position && `lq-tree__row--drop-${dragState.position}`,
        ]
          .filter(Boolean)
          .join(" ")}
        style={depthStyle}
        draggable={draggable}
        onContextMenu={(e) => {
          if (ctx.openMenu(node, e.clientX, e.clientY)) e.preventDefault();
        }}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", node.id);
          setDragState({ draggedId: node.id, overId: null, position: null });
        }}
        onDragEnd={() => setDragState(NO_DRAG)}
        onDragOver={(e) => {
          if (!onMove || !dragState.draggedId || dragState.draggedId === node.id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          const position: TreeDropPosition = ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
          setDragState((s) => (s.overId === node.id && s.position === position ? s : { ...s, overId: node.id, position }));
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragState((s) => (s.overId === node.id ? { ...s, overId: null, position: null } : s));
        }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = dragState.draggedId ?? e.dataTransfer.getData("text/plain");
          if (onMove && draggedId && draggedId !== node.id) {
            onMove(draggedId, node.id, dragState.position ?? "after");
          }
          setDragState(NO_DRAG);
        }}
      >
        <button
          type="button"
          className={["lq-tree__toggle", !hasChildren && "lq-tree__toggle--spacer"].filter(Boolean).join(" ")}
          onClick={() => {
            if (hasChildren) ctx.toggle(node.id);
            ctx.focusItem(node.id);
          }}
          aria-label={hasChildren ? (isOpen ? "Réduire" : "Développer") : undefined}
          aria-hidden={hasChildren ? undefined : true}
          tabIndex={-1}
        >
          {isLoading ? (
            <Spinner size={12} className="lq-tree__spinner" label={`Chargement de « ${node.label} »`} />
          ) : (
            hasChildren && (
              <ChevronRightIcon size={14} className={isOpen ? "lq-tree__chevron lq-tree__chevron--open" : "lq-tree__chevron"} />
            )
          )}
        </button>
        {checkState !== undefined && (
          <TreeCheckbox
            state={checkState}
            disabled={node.disabled}
            onToggle={() => {
              ctx.toggleCheck(node);
              ctx.focusItem(node.id);
            }}
          />
        )}
        <button
          type="button"
          className="lq-tree__label"
          disabled={node.disabled}
          tabIndex={-1}
          onClick={() => {
            ctx.select(node);
            if (hasChildren) ctx.toggle(node.id);
            ctx.focusItem(node.id);
          }}
        >
          {icon && <span className="lq-tree__icon">{icon}</span>}
          <span className="lq-tree__text">
            <MatchedLabel label={node.label} query={ctx.query} />
          </span>
        </button>
      </div>

      {hasFailed && isOpen && (
        <div className="lq-tree__note" style={{ "--lq-tree-depth": depth + 1 } as CSSProperties} role="alert">
          Impossible de charger le contenu
        </div>
      )}

      {hasChildren && isOpen && kids && kids.length > 0 && (
        <ul role="group" className="lq-tree__group" style={depthStyle}>
          {kids.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The kit's `Checkbox`, taken out of the tab order: the treeitem carries `aria-checked` and Space
 *  toggles it, so a second tab stop per row would only get in the way. */
function TreeCheckbox({ state, disabled, onToggle }: { state: boolean | "mixed"; disabled?: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const input = ref.current?.querySelector("input");
    if (input) input.tabIndex = -1;
  }, []);
  return (
    <span ref={ref} className="lq-tree__check" aria-hidden="true" onClick={(e) => e.stopPropagation()}>
      <Checkbox checked={state === true} indeterminate={state === "mixed"} disabled={disabled} onChange={onToggle} />
    </span>
  );
}

/** The label with the part matching the filter wrapped in a `<mark>`. */
function MatchedLabel({ label, query }: { label: string; query: string }) {
  if (!query) return <>{label}</>;
  const at = fold(label).indexOf(query);
  if (at < 0) return <>{label}</>;
  const end = at + query.length;
  return (
    <>
      {label.slice(0, at)}
      <mark className="lq-tree__match">{label.slice(at, end)}</mark>
      {label.slice(end)}
    </>
  );
}

// Default icons for `showIcons` — local on purpose, drawn on the kit's 24-unit grid and 1.6 stroke.
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function FolderGlyph() {
  return (
    <Glyph>
      <path d="M3.5 6.5a1 1 0 0 1 1-1h4.7l1.6 2h8.7a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" />
    </Glyph>
  );
}

function FolderOpenGlyph() {
  return (
    <Glyph>
      <path d="M3.5 17.5v-11a1 1 0 0 1 1-1h4.7l1.6 2h7.2a1 1 0 0 1 1 1v1.5" />
      <path d="M3.5 18.5l2.6-7.3a1 1 0 0 1 .95-.7H20.6a.8.8 0 0 1 .76 1.05L19 18.5Z" />
    </Glyph>
  );
}

function FileGlyph() {
  return (
    <Glyph>
      <path d="M6.5 3.5h7l4 4v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M13.5 3.5v4h4M9 12.5h6M9 16h6" />
    </Glyph>
  );
}

/** Adds the ids of `list` and of everything under it to `into`. */
function collectIds(list: TreeNode[], childrenOf: (n: TreeNode) => TreeNode[] | undefined, into: Set<string>) {
  for (const n of list) {
    if (n.disabled) continue;
    into.add(n.id);
    const kids = childrenOf(n);
    if (kids) collectIds(kids, childrenOf, into);
  }
}

/** The chain of nodes from a root down to `id` (inclusive), or `[]` when it isn't in the tree. */
function pathTo(list: TreeNode[], id: string, childrenOf: (n: TreeNode) => TreeNode[] | undefined): TreeNode[] {
  for (const n of list) {
    if (n.id === id) return [n];
    const kids = childrenOf(n);
    if (kids) {
      const below = pathTo(kids, id, childrenOf);
      if (below.length) return [n, ...below];
    }
  }
  return [];
}

/**
 * Immutable helper for `onMove`: removes the dragged node from wherever it is
 * in the tree and re-inserts it before/after/inside the target node. Returns
 * the original array unchanged if the move would be a no-op or would nest a
 * node inside its own descendant.
 */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper colocated with the component that uses it
export function moveTreeNode(nodes: TreeNode[], draggedId: string, targetId: string, position: TreeDropPosition): TreeNode[] {
  if (draggedId === targetId) return nodes;

  let draggedNode: TreeNode | null = null;

  function remove(list: TreeNode[]): TreeNode[] {
    const next: TreeNode[] = [];
    for (const n of list) {
      if (n.id === draggedId) {
        draggedNode = n;
        continue;
      }
      next.push(n.children ? { ...n, children: remove(n.children) } : n);
    }
    return next;
  }

  const withoutDragged = remove(nodes);
  if (!draggedNode) return nodes;

  function isDescendant(node: TreeNode, id: string): boolean {
    if (!node.children) return false;
    return node.children.some((c) => c.id === id || isDescendant(c, id));
  }
  if (isDescendant(draggedNode, targetId)) return nodes;

  function insert(list: TreeNode[]): TreeNode[] {
    const next: TreeNode[] = [];
    for (const n of list) {
      if (n.id === targetId) {
        if (position === "before") {
          next.push(draggedNode as TreeNode, n);
        } else if (position === "after") {
          next.push(n, draggedNode as TreeNode);
        } else {
          next.push({ ...n, children: [...(n.children ?? []), draggedNode as TreeNode] });
        }
        continue;
      }
      next.push(n.children ? { ...n, children: insert(n.children) } : n);
    }
    return next;
  }

  return insert(withoutDragged);
}
