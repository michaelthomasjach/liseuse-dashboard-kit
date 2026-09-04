import { useEffect, useRef, useState } from "react";
import { Popover } from "../../forms/Popover";
import { Checkbox } from "../../forms/Checkbox";
import { TextField } from "../../forms/TextField";
import { Modal } from "../../primitives/Modal";
import { SymbolSearchModal } from "../candlestick/components/SymbolSearchModal";
import { WatchlistExposureModal } from "./WatchlistExposureModal";
import type { WatchlistEarningsRow, WatchlistDividendRow, WatchlistNewsItem } from "./WatchlistExposureModal";
import { useSymbolSearchState } from "../candlestick/hooks/useSymbolSearchState";
import { defaultSymbolLogoColor } from "../candlestick/symbolSearchCatalog";
import { useWatchlistRowDrag, watchlistDropZoneProps, watchlistRowProps } from "./useWatchlistRowDrag";
import { useWatchlistSectionDrag } from "./useWatchlistSectionDrag";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MoreHorizontalIcon,
  GripIcon,
  TrashIcon,
  PieChartIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "../../icons";
import type { SymbolSearchCategory } from "../candlestick/interfaces/SymbolSearchCategory.interface";
import type { SymbolSearchResult } from "../candlestick/interfaces/SymbolSearchResult.interface";
import type { ChartWorkspaceWatchlist, ChartWorkspaceWatchlistRow, ChartWorkspaceWatchlistSection } from "./ChartWorkspaceWatchlist.interface";

// Matches the CSS default `.lq-chart-workspace__watchlist-cell` itself falls back to — the JS
// value is what actually drives width from here on (see startColumnResize below), the CSS one is
// only ever read before a caller's own render has passed anything through inline styles yet.
const DEFAULT_COLUMN_WIDTH = 68;
const MIN_COLUMN_WIDTH = 40;

export interface WatchlistPanelProps {
  watchlists: ChartWorkspaceWatchlist[];
  activeWatchlistId: string | undefined;
  onSelectWatchlist: (id: string) => void;
  visibleColumnIds: Set<string>;
  onVisibleColumnIdsChange: (ids: Set<string>) => void;
  /** Fires when a row is clicked — same "which symbol should the chart show now" role
   *  `CandlestickChart`'s own `onSymbolSelect` already plays for the main symbol search, just
   *  sourced from a watchlist row instead. What "opens in the candle chart" actually means (which
   *  panel, in a multi-panel workspace) is entirely up to whatever the caller does with this. */
  onRowClick: ((row: ChartWorkspaceWatchlistRow, watchlistId: string) => void) | undefined;
  symbolSearchResults: SymbolSearchResult[] | undefined;
  onSymbolSearchChange: ((query: string, category: SymbolSearchCategory) => void) | undefined;
  onAddSymbol: ((watchlistId: string, result: SymbolSearchResult) => void) | undefined;
  onCreateWatchlist: ((name: string) => void) | undefined;
  onCreateSection: ((watchlistId: string, name: string) => void) | undefined;
  onRemoveRow: ((watchlistId: string, rowId: string, sectionId: string | null) => void) | undefined;
  onMoveRow: ((watchlistId: string, rowId: string, fromSectionId: string | null, toSectionId: string | null, toIndex: number) => void) | undefined;
  onRemoveSection: ((watchlistId: string, sectionId: string) => void) | undefined;
  onReorderSections: ((watchlistId: string, orderedSectionIds: string[]) => void) | undefined;
  /** Passed straight through to the "Répartition" modal's own "Résultats"/"Dividendes"/
   *  "Actualités" tabs — see WatchlistExposureModal's own doc, this panel never reads them
   *  itself. */
  earnings?: WatchlistEarningsRow[];
  dividends?: WatchlistDividendRow[];
  news?: WatchlistNewsItem[];
  /** Drops this panel's own header row — the name+caret dropdown, the "Répartition" button and
   *  the "+"/"…" pair. Set by `ChartWorkspace` on its narrow layout (see its own
   *  `isMobileWorkspace`), where the topbar already lists every watchlist by name as its own
   *  button: the dropdown would be a second way to do what those buttons already do, and a
   *  header of four controls costs more of a phone's width than it earns. The "+" doesn't
   *  disappear with it — it moves up into that topbar, and reaches back in through
   *  `addSymbolRequestId` below. */
  mobile?: boolean;
  /** Opens the add-symbol modal whenever this number changes — how the topbar's own "+" reaches
   *  the modal on the `mobile` layout, where this panel no longer renders a "+" of its own.
   *  A counter rather than a boolean deliberately: the modal's real open state stays inside
   *  `useSymbolSearchState` (which drives the `onSymbolSearchChange` reporting effect off it),
   *  and a second copy up in the parent would drift the moment the modal is closed from the
   *  inside — closing it can't write back to a value the parent owns. Ignored while the initial
   *  value stays untouched, so mounting with any starting number never pops the modal open. */
  addSymbolRequestId?: number;
}

/**
 * The docked panel's own "watchlist" tab body (see `ChartWorkspace.tsx`'s own `activeTab`) — the
 * name+caret header (opens a dropdown to switch among `watchlists`, or create a new one), the
 * "+"/"…" action pair (add a symbol via the same `SymbolSearchModal` shell `CandlestickChart`
 * uses, toggle which optional columns show), and the table itself: an ungrouped row list plus any
 * named `sections` (collapsible, drag-and-drop between them via each row's own grip handle — see
 * `useWatchlistRowDrag`). Kept as its own file/component rather than inlined in
 * `ChartWorkspace.tsx` — enough of its own state (three popovers/modals, the add-symbol modal's
 * search state, column widths, section collapse) to read as a distinct unit, same "extract when
 * there's real internal complexity" call this library already makes for `ChartHeader`/
 * `ChartSidePanel`/etc.
 * Under `mobile` that whole header row is dropped and the table stands alone — see `mobile`'s
 * own doc; the only one of those controls that survives, the "+", moves up into the workspace
 * topbar and drives this panel's add-symbol modal through `addSymbolRequestId`.
 */
export function WatchlistPanel({
  watchlists,
  activeWatchlistId,
  onSelectWatchlist,
  visibleColumnIds,
  onVisibleColumnIdsChange,
  onRowClick,
  symbolSearchResults,
  onSymbolSearchChange,
  onAddSymbol,
  onCreateWatchlist,
  onCreateSection,
  onRemoveRow,
  onMoveRow,
  onRemoveSection,
  onReorderSections,
  earnings,
  dividends,
  mobile,
  addSymbolRequestId,
  news,
}: WatchlistPanelProps) {
  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
  const [watchlistMenuOpen, setWatchlistMenuOpen] = useState(false);
  const watchlistTriggerRef = useRef<HTMLButtonElement>(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsTriggerRef = useRef<HTMLButtonElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());
  // Which of the two "enter a name" modals is open, if either — a single piece of state (not two
  // separate booleans) since they're mutually exclusive and share one <NameModal/> render below.
  const [nameModal, setNameModal] = useState<"list" | "section" | null>(null);
  // The section a delete was just requested for, while it still needs confirming — only set when
  // that section actually has rows in it (see confirmRemoveSection below); an empty section is
  // removed immediately with no modal, since there's nothing a confirmation would be protecting.
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<ChartWorkspaceWatchlistSection | null>(null);
  const [exposureModalOpen, setExposureModalOpen] = useState(false);
  // Which column the table's own rows are sorted by, if any — "symbol" (the always-present
  // ticker column) or one of `activeWatchlist.columns`' own ids. Pure view state (like
  // collapsedSectionIds/columnWidths below): sorting only changes what's *rendered*, never
  // `activeWatchlist.rows`/`section.rows` themselves — see toggleSort's own doc for why a manual
  // drag clears it instead of fighting it.
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { pressedRowId, draggingRowId, dropIndicator, startDrag } = useWatchlistRowDrag({
    // A finger has to hold the row for a second before it can be dragged — see the hook's own
    // `holdMs` doc: on a touch layout the first pixel of movement is a scroll, and a drag that
    // starts on it hijacks the list. A mouse keeps the immediate desktop behaviour.
    holdMs: mobile ? 1000 : 0,
    onMove: activeWatchlist
      ? ({ rowId, fromSectionId, toSectionId, toIndex }) => {
          // `toIndex` was computed against whatever order was actually *rendered* (see
          // useWatchlistRowDrag's own doc) — with a sort active, that's sortedRows' own order,
          // not activeWatchlist.rows/section.rows' own (unsorted) order the caller's onMoveRow
          // expects an index into. Translate by finding which row sits at that sorted position
          // and using *that* row's own index in the raw array instead — a no-op whenever no sort
          // is active (sortedRows returns the same array unchanged then, so this just re-finds
          // the same index). A manually-placed row would otherwise land somewhere unrelated to
          // where it was actually dropped the moment the sort below clears and the view snaps
          // back to unsorted order.
          const rawRows = toSectionId === null ? activeWatchlist.rows : (activeWatchlist.sections?.find((s) => s.id === toSectionId)?.rows ?? []);
          const displayedRows = sortedRows(rawRows).filter((r) => r.id !== rowId);
          const targetRow = displayedRows[toIndex];
          const rawIndex = targetRow ? rawRows.findIndex((r) => r.id === targetRow.id) : rawRows.length;
          // A manually-placed row would just snap right back the moment the active sort
          // re-renders it — same "dragging overrides sorting" behavior most real tables already
          // have, rather than a drag that silently does nothing while a sort is active.
          setSortColumn(null);
          onMoveRow?.(activeWatchlist.id, rowId, fromSectionId, toSectionId, rawIndex);
        }
      : undefined,
  });
  const { pressedSectionId, draggingSectionId, dropIndex: sectionDropIndex, startDrag: startSectionDrag } = useWatchlistSectionDrag({
    sectionOrder: activeWatchlist.sections?.map((s) => s.id) ?? [],
    onReorder: onReorderSections ? (order) => onReorderSections(activeWatchlist.id, order) : undefined,
  });
  // No favorites concept here (see SymbolSearchModal's own doc on reusing it without them) —
  // `useSymbolSearchState` still owns the open/query/category state either way.
  const addSymbolState = useSymbolSearchState({
    defaultFavoriteSymbolIds: undefined,
    onFavoriteSymbolIdsChange: undefined,
    onSymbolSearchChange,
  });

  // See `addSymbolRequestId`'s own doc for why the topbar signals through a counter rather than
  // owning the open flag itself. Seeded with the incoming value (not 0/undefined) so only a
  // *change* ever counts: a panel mounted while the counter already sits at 3 opens to the table,
  // not to the modal.
  const lastAddSymbolRequestId = useRef(addSymbolRequestId);
  const { setSymbolSearchOpen: openAddSymbolModal } = addSymbolState;
  useEffect(() => {
    if (addSymbolRequestId === undefined || addSymbolRequestId === lastAddSymbolRequestId.current) return;
    lastAddSymbolRequestId.current = addSymbolRequestId;
    openAddSymbolModal(true);
  }, [addSymbolRequestId, openAddSymbolModal]);

  function toggleColumn(id: string) {
    const next = new Set(visibleColumnIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onVisibleColumnIdsChange(next);
  }

  function columnWidth(id: string) {
    return columnWidths[id] ?? DEFAULT_COLUMN_WIDTH;
  }

  // A column the user hasn't dragged yet stays flexible (see .lq-chart-workspace__watchlist-cell's
  // own default `flex: 1 1 <width>`) so removing another column via the "…" checklist actually
  // frees up space for it (and the ticker) to grow into, not just a narrower row overall — no
  // inline style at all lets that CSS default win. Once dragged, it's pinned to an exact pixel
  // width (`flex: 0 0 <width>`) instead, same as a deliberately-resized column in any real
  // spreadsheet/table stays exactly that size regardless of what else changes around it.
  function columnFlexStyle(id: string): React.CSSProperties {
    const width = columnWidths[id];
    return width === undefined ? {} : { flex: `0 0 ${width}px` };
  }

  // Same window-pointermove-listener pattern useSidePanel's own startResize uses (see its own
  // comment) — a plain drag delta from the column's own width at drag-start.
  function startColumnResize(columnId: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startWidth = columnWidth(columnId);
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (ev.clientX - startClientX));
      setColumnWidths((prev) => ({ ...prev, [columnId]: next }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function toggleSectionCollapsed(id: string) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!activeWatchlist) return null;
  const visibleColumns = activeWatchlist.columns.filter((c) => visibleColumnIds.has(c.id));

  // "symbol" (the ticker) is always sortable, with no accessor needed — every other column's own
  // `sortValue` decides whether it's sortable at all (see that field's own doc: `values[id]` is a
  // ReactNode, not necessarily comparable on its own).
  function sortValueFor(row: ChartWorkspaceWatchlistRow, columnId: string): string | number | undefined {
    if (columnId === "symbol") return row.ticker;
    return activeWatchlist.columns.find((c) => c.id === columnId)?.sortValue?.(row);
  }

  function isSortable(columnId: string): boolean {
    return columnId === "symbol" || activeWatchlist.columns.find((c) => c.id === columnId)?.sortValue !== undefined;
  }

  // Clicking the already-active column flips direction; clicking a *different* one starts fresh
  // — ascending for a text column (A→Z, "Symbole"'s own convention), descending for a numeric one
  // (highest first, e.g. biggest gainer first on "Variation") — inferred from whichever direction
  // reads most useful for that value's own type rather than always defaulting to ascending.
  function toggleSort(columnId: string) {
    if (!isSortable(columnId)) return;
    if (sortColumn === columnId) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(columnId);
    const allRows = [...activeWatchlist.rows, ...(activeWatchlist.sections?.flatMap((s) => s.rows) ?? [])];
    const sample = allRows.map((r) => sortValueFor(r, columnId)).find((v) => v !== undefined);
    setSortDirection(typeof sample === "number" ? "desc" : "asc");
  }

  // Independent per section (and for the root list) — see ChartWorkspaceWatchlistColumn's own
  // doc: an active sort reorders what each list *contains*, never the lists themselves.
  function sortedRows(rows: ChartWorkspaceWatchlistRow[]): ChartWorkspaceWatchlistRow[] {
    if (!sortColumn) return rows;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValueFor(a, sortColumn);
      const vb = sortValueFor(b, sortColumn);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
    });
  }

  function sortIcon(columnId: string) {
    if (sortColumn !== columnId) return null;
    return sortDirection === "asc" ? <ArrowUpIcon size={10} /> : <ArrowDownIcon size={10} />;
  }

  // Only asks for confirmation when deleting the section would also delete something — an empty
  // one is removed on the spot.
  function requestRemoveSection(section: ChartWorkspaceWatchlistSection) {
    if (section.rows.length > 0) setConfirmDeleteSection(section);
    else onRemoveSection?.(activeWatchlist.id, section.id);
  }

  function renderRow(row: ChartWorkspaceWatchlistRow, sectionId: string | null, index: number) {
    return (
      <div
        key={row.id}
        className={[
          "lq-chart-workspace__watchlist-row",
          pressedRowId === row.id && "lq-chart-workspace__watchlist-row--pressed",
          draggingRowId === row.id && "lq-chart-workspace__watchlist-row--dragging",
        ]
          .filter(Boolean)
          .join(" ")}
        {...watchlistRowProps(row.id)}
      >
        <button
          type="button"
          className="lq-chart-workspace__watchlist-row-main"
          onPointerDown={(e) => startDrag(row.id, sectionId, e)}
          onClick={() => onRowClick?.(row, activeWatchlist.id)}
        >
          {/* Purely decorative — the button above already starts the same drag from anywhere on
              the row (see onPointerDown), same "grip has no handler of its own, the press just
              bubbles up" convention the section header's own grip already established. A
              *different* class from that one (not .lq-chart-workspace__watchlist-grip) since this
              one overlaps the logo's own position instead of reserving space beside it (see its
              own CSS doc for why: floating it into the panel's own padding instead would clip
              against `.lq-chart__side-panel`'s own `overflow: auto`) — the section header's own
              grip keeps its original reserved-space layout untouched. */}
          <span className="lq-chart-workspace__watchlist-row-grip" aria-hidden="true">
            <GripIcon size={12} />
          </span>
          <span
            className="lq-chart-workspace__watchlist-logo"
            style={row.logoUrl ? undefined : { backgroundColor: row.logoColor ?? defaultSymbolLogoColor(index) }}
          >
            {row.logoUrl ? <img src={row.logoUrl} alt="" /> : row.ticker.slice(0, 2).toUpperCase()}
          </span>
          <span className="lq-chart-workspace__watchlist-ticker">{row.ticker}</span>
          {visibleColumns.map((c) => (
            <span key={c.id} className="lq-chart-workspace__watchlist-cell" style={columnFlexStyle(c.id)}>
              {row.values[c.id]}
            </span>
          ))}
        </button>
        {onRemoveRow && (
          <button
            type="button"
            className="lq-chart-workspace__watchlist-delete"
            onClick={() => onRemoveRow(activeWatchlist.id, row.id, sectionId)}
            aria-label={`Supprimer ${row.ticker}`}
            title="Supprimer"
          >
            <TrashIcon size={12} />
          </button>
        )}
      </div>
    );
  }

  // Rows for one zone (root, or one section), interleaved with a drop-indicator line at
  // `dropIndicator`'s own position when it's currently pointing into *this* zone — rendered as a
  // sibling between rows rather than any kind of border on the rows themselves, so it reads as
  // "the row will land exactly here" instead of "this existing row is highlighted".
  function renderRowsWithIndicator(rows: ChartWorkspaceWatchlistRow[], sectionId: string | null) {
    const showIndicatorAt = (i: number) => dropIndicator && dropIndicator.sectionId === sectionId && dropIndicator.index === i;
    const nodes: React.ReactNode[] = [];
    rows.forEach((row, i) => {
      if (showIndicatorAt(i)) nodes.push(<div key={`drop-${i}`} className="lq-chart-workspace__watchlist-drop-line" />);
      nodes.push(renderRow(row, sectionId, i));
    });
    if (showIndicatorAt(rows.length)) nodes.push(<div key="drop-end" className="lq-chart-workspace__watchlist-drop-line" />);
    return nodes;
  }

  function renderSection(section: ChartWorkspaceWatchlistSection) {
    const collapsed = collapsedSectionIds.has(section.id);
    return (
      <div key={section.id}>
        <div
          className={[
            "lq-chart-workspace__watchlist-section-header",
            pressedSectionId === section.id && "lq-chart-workspace__watchlist-row--pressed",
            draggingSectionId === section.id && "lq-chart-workspace__watchlist-row--dragging",
          ]
            .filter(Boolean)
            .join(" ")}
          data-watchlist-section-id={section.id}
          onPointerDown={onReorderSections ? (e) => startSectionDrag(section.id, e) : undefined}
          {...watchlistDropZoneProps(section.id)}
        >
          {/* No onPointerDown of its own — sitting inside the header div above, its
              press already bubbles up to that div's own handler, which is exactly the
              same startSectionDrag call this would otherwise duplicate. */}
          {onReorderSections && (
            <span className="lq-chart-workspace__watchlist-grip" aria-hidden="true">
              <GripIcon size={12} />
            </span>
          )}
          <button type="button" className="lq-chart-workspace__watchlist-section-toggle" onClick={() => toggleSectionCollapsed(section.id)}>
            {collapsed ? <ChevronRightIcon size={12} /> : <ChevronDownIcon size={12} />}
            {section.name}
          </button>
          {onRemoveSection && (
            <button
              type="button"
              className="lq-chart-workspace__watchlist-delete"
              onClick={() => requestRemoveSection(section)}
              aria-label={`Supprimer la section ${section.name}`}
              title="Supprimer la section"
            >
              <TrashIcon size={12} />
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="lq-chart-workspace__watchlist-group" {...watchlistDropZoneProps(section.id)}>
            {renderRowsWithIndicator(sortedRows(section.rows), section.id)}
          </div>
        )}
      </div>
    );
  }

  // Same "interleave a drop-line sibling at the live target position" shape as
  // renderRowsWithIndicator above, just for the section list itself instead of one zone's rows —
  // see useWatchlistSectionDrag's own doc for why this now mirrors row-drag's gesture instead of
  // the live-splice-on-cross reordering it used to do.
  function renderSectionsWithIndicator() {
    const sections = activeWatchlist.sections ?? [];
    const nodes: React.ReactNode[] = [];
    sections.forEach((section, i) => {
      if (sectionDropIndex === i) nodes.push(<div key={`section-drop-${i}`} className="lq-chart-workspace__watchlist-drop-line" />);
      nodes.push(renderSection(section));
    });
    if (sectionDropIndex === sections.length) nodes.push(<div key="section-drop-end" className="lq-chart-workspace__watchlist-drop-line" />);
    return nodes;
  }

  return (
    <>
      {!mobile && (
        <div className="lq-chart-workspace__side-panel-header">
          <button
            ref={watchlistTriggerRef}
            type="button"
            className="lq-chart__timeframe-trigger"
            onClick={() => setWatchlistMenuOpen((o) => !o)}
            aria-label={`Liste : ${activeWatchlist.name}`}
          >
            <span className="lq-chart__timeframe-trigger-label">{activeWatchlist.name}</span>
            <ChevronDownIcon size={12} />
          </button>
          <Popover open={watchlistMenuOpen} onClose={() => setWatchlistMenuOpen(false)} anchorRef={watchlistTriggerRef} placement="bottom">
            <div className="lq-chart__tool-menu">
              {watchlists.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={["lq-chart__tool-menu-option", w.id === activeWatchlist.id && "lq-chart__tool-menu-option--selected"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    onSelectWatchlist(w.id);
                    setWatchlistMenuOpen(false);
                  }}
                >
                  {w.name}
                </button>
              ))}
              {onCreateWatchlist && (
                <>
                  <div className="lq-chart__tool-menu-divider" />
                  <button
                    type="button"
                    className="lq-chart__tool-menu-option"
                    onClick={() => {
                      setWatchlistMenuOpen(false);
                      setNameModal("list");
                    }}
                  >
                    <PlusIcon size={12} />
                    Nouvelle liste
                  </button>
                </>
              )}
            </div>
          </Popover>
  
          {/* Right next to the name, not grouped with the +/… actions further right (see that
              div's own `margin-left: auto`) — a concentration/exposure view is about *this list*
              itself, closer in spirit to the name than to those per-row/per-column actions. */}
          <button
            type="button"
            className="lq-chart__icon-button lq-chart-workspace__exposure-button"
            onClick={() => setExposureModalOpen(true)}
            aria-label="Répartition de la liste"
            title="Répartition de la liste"
          >
            <PieChartIcon size={14} />
          </button>
  
          <div className="lq-chart-workspace__watchlist-actions">
            <button
              type="button"
              className="lq-chart__icon-button"
              onClick={() => addSymbolState.setSymbolSearchOpen(true)}
              aria-label="Ajouter un symbole"
              title="Ajouter un symbole"
            >
              <PlusIcon size={14} />
            </button>
            <button
              ref={columnsTriggerRef}
              type="button"
              className="lq-chart__icon-button"
              onClick={() => setColumnsMenuOpen((o) => !o)}
              aria-label="Colonnes affichées"
              title="Colonnes affichées"
            >
              <MoreHorizontalIcon size={14} />
            </button>
            <Popover open={columnsMenuOpen} onClose={() => setColumnsMenuOpen(false)} anchorRef={columnsTriggerRef} placement="bottom">
              <div className="lq-chart__tool-menu">
                {activeWatchlist.columns.map((c) => (
                  <Checkbox key={c.id} checked={visibleColumnIds.has(c.id)} onChange={() => toggleColumn(c.id)} label={c.label} />
                ))}
              </div>
            </Popover>
          </div>
        </div>
      )}

      {/* No grip spacer anymore — a real row's own grip no longer reserves any layout space of
          its own (see .lq-chart-workspace__watchlist-grip's own CSS doc), so there's nothing left
          here to match. Delete-spacer stays: real rows still reserve that space on their own
          right edge. Each cell (including "Symbole") is its own clickable sort button now — see
          toggleSort — with an arrow icon appearing next to whichever one is currently active. No
          logo spacer, unlike a real row's own leading logo: "Symbole" labels the *whole* identity
          column (logo + ticker together), so it starts flush with the logo's own left edge — the
          leftmost thing that column actually shows — rather than indented past it to align with
          the ticker text specifically. */}
      <div className="lq-chart-workspace__watchlist-row lq-chart-workspace__watchlist-row--header">
        <span className="lq-chart-workspace__watchlist-row-main">
          {/* Inert stand-in for the logo every real row carries, same reasoning (and same
              `visibility: hidden`) as the delete spacer at the end of this row. Not cosmetic: the
              header and the rows are separate flex containers sharing one width, so a row's logo
              reserving 18px + a gap that the header doesn't means the two hand out *different*
              widths to the very same columns — every numeric header then sits a growing few pixels
              off from the numbers it labels. */}
          <span className="lq-chart-workspace__watchlist-logo lq-chart-workspace__watchlist-logo--spacer" />
          <button
            type="button"
            className="lq-chart-workspace__watchlist-sort-header lq-chart-workspace__watchlist-ticker"
            onClick={() => toggleSort("symbol")}
          >
            Symbole
            {sortIcon("symbol")}
          </button>
          {visibleColumns.map((c) => (
            <button
              key={c.id}
              type="button"
              className={[
                "lq-chart-workspace__watchlist-sort-header lq-chart-workspace__watchlist-cell",
                !isSortable(c.id) && "lq-chart-workspace__watchlist-sort-header--disabled",
              ]
                .filter(Boolean)
                .join(" ")}
              style={columnFlexStyle(c.id)}
              onClick={() => toggleSort(c.id)}
              disabled={!isSortable(c.id)}
            >
              {c.label}
              {sortIcon(c.id)}
              <span
                className="lq-chart-workspace__watchlist-col-resize"
                onPointerDown={(e) => startColumnResize(c.id, e)}
                onClick={(e) => e.stopPropagation()}
                role="separator"
                aria-orientation="vertical"
                aria-label={`Redimensionner la colonne ${c.label}`}
              />
            </button>
          ))}
        </span>
        <span className="lq-chart-workspace__watchlist-delete lq-chart-workspace__watchlist-delete--spacer" />
      </div>

      <div className="lq-chart-workspace__watchlist-group" {...watchlistDropZoneProps(null)}>
        {renderRowsWithIndicator(sortedRows(activeWatchlist.rows), null)}
      </div>

      {renderSectionsWithIndicator()}

      {onCreateSection && (
        <button type="button" className="lq-chart-workspace__watchlist-add-section" onClick={() => setNameModal("section")}>
          <PlusIcon size={12} />
          Nouvelle section
        </button>
      )}

      <SymbolSearchModal
        title={`Ajouter un symbole — ${activeWatchlist.name}`}
        symbolSearchOpen={addSymbolState.symbolSearchOpen}
        setSymbolSearchOpen={addSymbolState.setSymbolSearchOpen}
        symbolSearchQuery={addSymbolState.symbolSearchQuery}
        setSymbolSearchQuery={addSymbolState.setSymbolSearchQuery}
        symbolSearchCategory={addSymbolState.symbolSearchCategory}
        setSymbolSearchCategory={addSymbolState.setSymbolSearchCategory}
        symbolSearchResults={symbolSearchResults}
        onSymbolSelect={(result) => onAddSymbol?.(activeWatchlist.id, result)}
        onAddSymbolOverlay={undefined}
        symbolOverlays={[]}
        addingOverlaySymbols={new Set()}
        handleAddSymbolOverlay={() => {}}
        removeSymbolOverlay={() => {}}
      />

      <WatchlistExposureModal
        open={exposureModalOpen}
        onClose={() => setExposureModalOpen(false)}
        watchlist={activeWatchlist}
        earnings={earnings}
        dividends={dividends}
        news={news}
      />

      {nameModal && (
        <NameModal
          title={nameModal === "list" ? "Nouvelle liste" : "Nouvelle section"}
          placeholder={nameModal === "list" ? "Ma nouvelle liste" : "Ma nouvelle section"}
          onClose={() => setNameModal(null)}
          onSubmit={(name) => (nameModal === "list" ? onCreateWatchlist?.(name) : onCreateSection?.(activeWatchlist.id, name))}
        />
      )}

      {confirmDeleteSection && (
        <Modal
          open
          onClose={() => setConfirmDeleteSection(null)}
          title="Supprimer la section ?"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setConfirmDeleteSection(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="lq-chart__confirm-button"
                onClick={() => {
                  onRemoveSection?.(activeWatchlist.id, confirmDeleteSection.id);
                  setConfirmDeleteSection(null);
                }}
              >
                Supprimer
              </button>
            </div>
          }
        >
          <p className="lq-chart__indicator-picker-empty">
            La section « {confirmDeleteSection.name} » contient {confirmDeleteSection.rows.length} symbole
            {confirmDeleteSection.rows.length > 1 ? "s" : ""}. Les supprimer aussi ?
          </p>
        </Modal>
      )}
    </>
  );
}

/** Shared "enter a name, Créer/Annuler" shell for both `onCreateWatchlist` and `onCreateSection`
 *  above — same `.lq-chart__edit-drawing-footer`/`.lq-chart__reset-button`/`.lq-chart__confirm-
 *  button` recipe `TemplateControls`' own "save as" modal already uses for the identical shape
 *  (enter a name, confirm or cancel). */
function NameModal({ title, placeholder, onSubmit, onClose }: { title: string; placeholder: string; onSubmit: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="lq-chart__confirm-button" onClick={submit} disabled={!value.trim()}>
            Créer
          </button>
        </div>
      }
    >
      <TextField
        label="Nom"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
    </Modal>
  );
}
