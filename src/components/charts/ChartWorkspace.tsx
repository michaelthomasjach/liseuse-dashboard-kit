import { Children, cloneElement, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { CandlestickChartProps } from "./candlestick/interfaces/CandlestickChartProps.interface";
import type { SymbolSearchCategory } from "./candlestick/interfaces/SymbolSearchCategory.interface";
import type { SymbolSearchResult } from "./candlestick/interfaces/SymbolSearchResult.interface";
import { useLinkGroups } from "./workspace/useLinkGroups";
import { LinkGroupsModal } from "./workspace/LinkGroupsModal";
import { SymbolTargetModal } from "./workspace/SymbolTargetModal";
import { WatchlistPanel } from "./workspace/WatchlistPanel";
import { useSidePanel } from "./candlestick/hooks/useSidePanel";
import { ChartSidePanel } from "./candlestick/components/ChartSidePanel";
import { Popover } from "../forms/Popover";
import { Modal } from "../primitives/Modal";
import { WatchlistIcon, BellIcon, GridIcon, MaximizeIcon, MinimizeIcon, HelpIcon, CodeIcon } from "../icons";
import { useFullscreen } from "./internal/useFullscreen";
import "./ChartWorkspace.css";

// Item 21 — one entry per global feature the rail's own "?" button explains, in the order they
// read most naturally (layout, then focus, then protection) rather than the order their own
// buttons sit in the rail.
const HELP_ITEMS: { title: string; description: string }[] = [
  { title: "Écran divisé", description: "Affiche 1, 2, 4, 6 ou 8 graphiques à la fois, répartis en grille." },
  {
    title: "Focus fenêtre active",
    description: "Une fois plusieurs graphiques affichés, agrandit celui survolé pour qu'il occupe toute la grille — les autres restent ouverts en dessous, juste masqués. Recliquer restaure la disposition.",
  },
  { title: "Plein écran de l'espace de travail", description: "Fait passer l'ensemble de l'espace de travail (grille, liste de surveillance et alertes comprises) en plein écran." },
  { title: "Graphiques liés", description: "Synchronise le curseur (survol) entre plusieurs graphiques d'un même groupe." },
  {
    title: "Éditeur de script",
    description:
      "Ouvre l'éditeur de script du panneau actif (ou du premier panneau si aucun n'est en focus) — visible uniquement si ce panneau a activé la prop `scripting`.",
  },
  {
    title: "Verrouillage",
    description:
      "Un quadruple clic (ou plus) sur la grille la verrouille : elle s'estompe et devient protégée contre toute interaction, un curseur en forme de cadenas apparaît au survol. Un triple clic la déverrouille.",
  },
];

// Moved here from CandlestickChart's own ChartHeader (see this file's own git history) — laying
// out multiple panels is a workspace-wide concern, not a per-chart one, so the control for it
// belongs on the workspace's own rail rather than duplicated/hidden inside each panel's header.
const SPLIT_SCREEN_OPTIONS: { value: 1 | 2 | 4 | 6 | 8; label: string }[] = [
  { value: 1, label: "1 fenêtre" },
  { value: 2, label: "2 panneaux" },
  { value: 4, label: "4 panneaux" },
  { value: 6, label: "6 panneaux" },
  { value: 8, label: "8 panneaux" },
];

export type {
  ChartWorkspaceWatchlist,
  ChartWorkspaceWatchlistColumn,
  ChartWorkspaceWatchlistRow,
} from "./workspace/ChartWorkspaceWatchlist.interface";
import type { ChartWorkspaceWatchlist, ChartWorkspaceWatchlistRow } from "./workspace/ChartWorkspaceWatchlist.interface";
export type { WatchlistEarningsRow, WatchlistDividendRow, WatchlistNewsItem } from "./workspace/WatchlistExposureModal";
import type { WatchlistEarningsRow, WatchlistDividendRow, WatchlistNewsItem } from "./workspace/WatchlistExposureModal";

/** Which of the docked panel's (up to) two tabs is currently showing — see `watchlists`/`alerts`. */
export type ChartWorkspaceSidePanelTab = "watchlist" | "alerts";

const GRID_COLUMNS: Record<1 | 2 | 4 | 6 | 8, number> = { 1: 1, 2: 2, 4: 2, 6: 3, 8: 4 };
const GRID_ROWS: Record<1 | 2 | 4 | 6 | 8, number> = { 1: 1, 2: 1, 4: 2, 6: 2, 8: 2 };

export interface ChartWorkspaceProps {
  /** Uncontrolled initial panel count — also picks the grid: 1 is a plain single chart (no grid
   *  chrome), 2 is a single row, 4/6/8 wrap into two rows (2/3/4 columns respectively). Owned
   *  internally from here on (same uncontrolled pattern as everywhere else in this library): the
   *  right-edge rail's own "Écran divisé" button lets the user change it live — including going
   *  from 1 up to a split view and back — same as the chain-link button does for groups. Default
   *  1. */
  defaultPanels?: 1 | 2 | 4 | 6 | 8;
  /** Fires whenever the panel count changes via the rail's own "Écran divisé" menu. */
  onPanelsChange?: (panels: 1 | 2 | 4 | 6 | 8) => void;
  /** A single pre-configured `<CandlestickChart {...allTheOptions} />` — the same "compose, don't
   *  configure" shape as everywhere else a caller hands this library a data source of their own,
   *  `ChartWorkspace` only adds layout and cross-chart sync on top. Every panel gets its own
   *  independent *instance* of exactly this configuration (own drawings, own indicators, own
   *  zoom, own templates — everything `CandlestickChart` itself owns internally), not a cut-down
   *  version of it, so splitting from one window to several never loses toolbar/drawing-tool/
   *  indicator access in the new ones. Pass an array instead (one element per panel, in order —
   *  "Fenêtre 1" = the first) if different panels should show genuinely different data/symbols;
   *  extra array entries past the current panel count are ignored, fewer leave the remaining grid
   *  cells empty. */
  children: ReactElement<CandlestickChartProps> | ReactElement<CandlestickChartProps>[];
  /** Fixed height in px applied to every panel uniformly, overriding each child's own `height`
   *  prop if it set one — a mixed-height grid wouldn't read as one coherent workspace. Omit
   *  (default) to instead fill 100% of the viewport height, splitting that budget evenly across
   *  however many rows the current panel count needs (a plain CSS grid fraction per row) — the
   *  usual choice for a workspace that's the main content of its own page. Always filled this way
   *  once the grid wraps into two rows (4/6/8 panels) regardless of this prop: stacking two rows'
   *  worth of a height meant for *one* row would run well past the screen. */
  panelHeight?: number;
  /** Uncontrolled initial link groups — each a plain array of panel indices (0-based). */
  defaultLinkGroups?: number[][];
  /** Fires whenever a group is created, changed, or dissolved from the "Graphiques liés" modal. */
  onLinkGroupsChange?: (groups: number[][]) => void;
  /** Named lists for a collapsible, resizable panel docked to the *workspace's* own right edge,
   *  switched via a right-edge icon rail alongside `alerts` (TradingView's own watchlist/alerts
   *  rail is the reference point) — deliberately a `ChartWorkspace`-level prop rather than
   *  something read off each panel's own `CandlestickChart.sidePanel` (which still exists, for a
   *  single standalone chart used outside a workspace entirely): a single `children` template
   *  gets cloned into every panel here (see `panelElements` below), so a docked panel set on that
   *  template would render once *per panel* instead of once for the whole workspace — a watchlist
   *  duplicated 2/4/6/8 times over instead of shown once beside the whole grid.
   *  `CandlestickChart.sidePanel` is stripped from every cloned panel below for exactly that
   *  reason; set it here instead. More than one list gets a clickable name + caret in the panel's
   *  own header that opens a dropdown of every list to switch between (see
   *  `defaultActiveWatchlistId`) — a single list still gets the same clickable header, simply with
   *  nothing else to switch to. The header also gets a "+" (opens the same `SymbolSearchModal`
   *  shell `CandlestickChart`'s own symbol search uses, see `watchlistSymbolSearchResults`, to add
   *  a row to whichever list is active) and a "…" (toggles which of a list's own optional
   *  `columns` are currently shown, see `defaultVisibleColumnIds`). Omit entirely (or pass an
   *  empty array) to skip the watchlist tab altogether — its own rail icon only appears once
   *  there's at least one list to show. */
  watchlists?: ChartWorkspaceWatchlist[];
  /** Uncontrolled initial pick among `watchlists` (by id) — defaults to the first one. */
  defaultActiveWatchlistId?: string;
  onActiveWatchlistChange?: (id: string) => void;
  /** Uncontrolled initial set of visible optional-column ids (see `ChartWorkspaceWatchlist.columns`)
   *  — shared across every list rather than tracked per list (see that prop's own doc). Defaults
   *  to every column, across every list, actually visible. */
  defaultVisibleColumnIds?: string[];
  onVisibleColumnsChange?: (ids: string[]) => void;
  /** Results for the watchlist panel's own "+" (add a symbol) modal — same shape
   *  `CandlestickChartProps.symbolSearchResults`/`onSymbolSearchChange` already use for the main
   *  chart's own symbol search (a real app can likely feed both from the same source). Omit to
   *  leave the modal's own results list empty regardless of what's typed into it. */
  watchlistSymbolSearchResults?: SymbolSearchResult[];
  onWatchlistSymbolSearchChange?: (query: string, category: SymbolSearchCategory) => void;
  /** Fires when a result is picked from the "+" modal — the caller owns `watchlists` itself (see
   *  its own doc), so this only reports "the user wants `result` added to list `watchlistId`";
   *  updating that list's own `rows` (and giving the new row whatever `values` it should show) is
   *  entirely up to whatever this does. */
  onAddWatchlistSymbol?: (watchlistId: string, result: SymbolSearchResult) => void;
  /** Fires when a watchlist row is clicked — same "which symbol should show now" role
   *  `CandlestickChartProps.onSymbolSelect` already plays for the main chart's own symbol search.
   *  What "opens in the candle chart" means in a multi-panel workspace (which panel gets it) is
   *  entirely up to whatever this does with it. */
  onWatchlistRowClick?: (row: ChartWorkspaceWatchlistRow, watchlistId: string) => void;
  /** Fires from the watchlist dropdown's own "Nouvelle liste" button once a name is entered —
   *  the caller owns `watchlists` itself (see its own doc), so this only reports the chosen name;
   *  appending a new entry (and picking its own `id`) is entirely up to whatever this does.
   *  Omitting this hides the "Nouvelle liste" button entirely rather than showing one that
   *  silently does nothing. */
  onCreateWatchlist?: (name: string) => void;
  /** Fires from a list's own "Nouvelle section" button once a name is entered — same "caller owns
   *  the data, this only reports the chosen name" shape as `onCreateWatchlist`. Omitting this
   *  hides the button. */
  onCreateWatchlistSection?: (watchlistId: string, name: string) => void;
  /** Fires from a row's own hover-revealed trash button — `sectionId` is `null` when the row
   *  being removed isn't inside any of that list's own `sections`. Omitting this hides the trash
   *  button entirely (no half-working delete affordance). */
  onRemoveWatchlistSymbol?: (watchlistId: string, rowId: string, sectionId: string | null) => void;
  /** Fires from a section's own hover-revealed trash button, already past a confirmation modal
   *  whenever that section actually contains rows (an empty one is removed immediately — nothing
   *  a confirmation would protect). Omitting this hides the trash button entirely. */
  onRemoveWatchlistSection?: (watchlistId: string, sectionId: string) => void;
  /** Fires when a row is dragged (from anywhere on the row) to a precise position — within its
   *  own section/the no-section zone (reordering) or a different one (moving), `toIndex` either
   *  way giving where it lands *after* removal from wherever it started (see
   *  `MoveWatchlistRowArgs`'s own doc for the exact convention) — see
   *  `ChartWorkspaceWatchlistSection`'s own doc. The caller owns `watchlists` itself, so this only
   *  reports the move; actually moving the row between `rows`/`sections[].rows` arrays is up to
   *  whatever this does. */
  onMoveWatchlistRow?: (watchlistId: string, rowId: string, fromSectionId: string | null, toSectionId: string | null, toIndex: number) => void;
  /** Fires while a section is being dragged (via its own grip handle) past a neighbor — live, not
   *  just on drop (see `useWatchlistSectionDrag`'s own doc) — with the section list's own new
   *  order. Same "caller owns `watchlists`, this only reports the intent" shape as
   *  `onMoveWatchlistRow`; reordering `sections` itself is up to whatever this does. */
  onReorderWatchlistSections?: (watchlistId: string, orderedSectionIds: string[]) => void;
  /** Rows/items for the "Répartition" modal's own "Résultats"/"Dividendes"/"Actualités" tabs
   *  (opened from a watchlist's own pie-chart icon) — same "caller owns the data, this never
   *  fetches or infers any of it" stance as `watchlists` itself. Omitting any of the three just
   *  leaves that tab's own table empty. */
  watchlistEarnings?: WatchlistEarningsRow[];
  watchlistDividends?: WatchlistDividendRow[];
  watchlistNews?: WatchlistNewsItem[];
  /** Content for the docked panel's own "Alertes" tab, alongside `watchlists` — same "structure
   *  only, caller owns the content" shape. Omit entirely to skip the tab — its own rail icon only
   *  appears once this is set. */
  alerts?: ReactNode;
  /** Uncontrolled initial open/collapsed state for the docked panel (`watchlists`/`alerts`) —
   *  collapsing gives the grid back its full width. Day to day this is driven by the right-edge
   *  rail's own two icons instead (clicking whichever tab is already showing collapses the panel;
   *  clicking the other one opens it there, or switches to it if already open) — this only seeds
   *  where it starts. Default true (open). */
  defaultSidePanelOpen?: boolean;
  onSidePanelOpenChange?: (open: boolean) => void;
  /** Uncontrolled initial active tab among whichever of `watchlists`/`alerts` is actually set —
   *  defaults to "watchlist" if set, else "alerts". */
  defaultSidePanelTab?: ChartWorkspaceSidePanelTab;
  onSidePanelTabChange?: (tab: ChartWorkspaceSidePanelTab) => void;
  className?: string;
}

/** A split-screen grid of `CandlestickChart`s (1/2/4/6/8 panels) whose crosshairs can be synced
 *  across whichever ones the user links together — hovering a candle on any panel in a group
 *  draws the same crosshair (vertical line, date badge, OHLC readout, plus the horizontal price
 *  line/badge) on every other panel in that group, each axis translated to that panel's own
 *  scale (nearest candle by date on X, the same price re-projected through that panel's own
 *  price scale on Y) rather than a raw shared index/pixel, so panels showing different symbols,
 *  zoom levels, or ranges still line up correctly. Grouping itself happens through the
 *  chain-link button each panel's own header gets (`CandlestickChart.linkable`, wired here) —
 *  opens one shared "Graphiques liés" modal (see `LinkGroupsModal`) regardless of which panel's
 *  button was clicked, since the groups themselves are workspace-wide, not per-panel. */
export function ChartWorkspace({
  defaultPanels = 1,
  onPanelsChange,
  children,
  panelHeight,
  defaultLinkGroups,
  onLinkGroupsChange,
  watchlists,
  defaultActiveWatchlistId,
  onActiveWatchlistChange,
  defaultVisibleColumnIds,
  onVisibleColumnsChange,
  watchlistSymbolSearchResults,
  onWatchlistSymbolSearchChange,
  onAddWatchlistSymbol,
  onWatchlistRowClick,
  onCreateWatchlist,
  onCreateWatchlistSection,
  onRemoveWatchlistSymbol,
  onRemoveWatchlistSection,
  onMoveWatchlistRow,
  onReorderWatchlistSections,
  watchlistEarnings,
  watchlistDividends,
  watchlistNews,
  alerts,
  defaultSidePanelOpen,
  onSidePanelOpenChange,
  defaultSidePanelTab,
  onSidePanelTabChange,
  className,
}: ChartWorkspaceProps) {
  const [panels, setPanels] = useState(defaultPanels);
  const { groups, linkPanels, unlinkGroup, groupIndexOfPanel } = useLinkGroups({ defaultLinkGroups, onLinkGroupsChange });
  const sidePanelState = useSidePanel({ defaultSidePanelOpen, onSidePanelOpenChange });
  // Whole-workspace fullscreen (the rail's own "Plein écran de l'espace de travail" button below,
  // item 3) — a plain, uncontrolled `useFullscreen()` like a standalone CandlestickChart's own,
  // just applied to the outer `.lq-chart-workspace` row instead of one panel. Distinct from
  // focusedPanelIndex right below: this one covers the whole viewport (grid + side panel + rail);
  // that one only takes over the grid's own area, and only one panel at a time.
  const { isFullscreen: workspaceFullscreen, toggle: toggleWorkspaceFullscreen } = useFullscreen();
  // Which panel (if any) is "focused" — occupying the whole grid's area, other panels still
  // mounted underneath but visually covered (see the cloneElement below and
  // .lq-chart-workspace__panel--focused in ChartWorkspace.css). A single index rather than one
  // piece of state per panel: every panel's own CandlestickChart.isFullscreen reads off this same
  // value, so focusing a new panel automatically defocuses whichever one had it before, for free.
  // Clamped against the current `panels` count at read time (just below) rather than reset via an
  // effect — simpler, and a panel count change can never leave it referencing a since-removed panel.
  const [focusedPanelIndex, setFocusedPanelIndex] = useState<number | null>(null);
  // Which panel's own script editor the rail's own "</>" button below has open — same single-
  // index-of-truth shape as focusedPanelIndex above, and deliberately a *separate* piece of state
  // rather than reusing that one: fullscreen-focus and "which panel's editor is open" are
  // orthogonal (a script editor should stay reachable without first fullscreen-focusing its own
  // panel), even though the button below defaults its target to whichever panel *is* currently
  // focused, when one is.
  const [scriptEditorPanelIndex, setScriptEditorPanelIndex] = useState<number | null>(null);
  // Item 20: a plain click-count gesture (native `MouseEvent.detail`, the same counter a real
  // double-click already relies on elsewhere in this library — see ChartLegend's own
  // onDoubleClick) rather than any custom timing/debounce logic of its own. This also makes a
  // *real* quadruple-click self-correct on its own: the browser fires one `click` per tap in the
  // burst (detail 1, 2, 3, then 4), so the intermediate detail-3 tap fires "unlock" a moment
  // before detail-4 fires "lock" — starting locked, that's unlock-then-relock (ends locked, same
  // as a plain quadruple-click from unlocked); starting unlocked, the detail-3 "unlock" is already
  // a no-op (see below), so only the detail-4 "lock" actually does anything. Either way the final
  // state always matches the spec (triple locks nothing it doesn't already touch; quadruple+
  // always ends locked) without tracking anything across events.
  const [workspaceLocked, setWorkspaceLocked] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  function handleGridClick(e: React.MouseEvent) {
    if (e.detail === 3) setWorkspaceLocked((locked) => (locked ? false : locked));
    else if (e.detail >= 4) setWorkspaceLocked((locked) => (locked ? locked : true));
  }
  const [splitScreenMenuOpen, setSplitScreenMenuOpen] = useState(false);
  const splitScreenTriggerRef = useRef<HTMLButtonElement>(null);
  const hasWatchlists = !!watchlists && watchlists.length > 0;
  const hasAlerts = alerts !== undefined;
  const [activeTab, setActiveTab] = useState<ChartWorkspaceSidePanelTab>(defaultSidePanelTab ?? (hasWatchlists ? "watchlist" : "alerts"));
  const [activeWatchlistId, setActiveWatchlistId] = useState(defaultActiveWatchlistId ?? watchlists?.[0]?.id);
  // Every column, across every list, visible by default — same "start showing everything, let the
  // user narrow it down" reasoning `excludedYears` avoids for SeasonalityView's own years filter,
  // just inverted (a whitelist here reads as the more natural default for "which columns" than an
  // exclusion list would).
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(
    new Set(defaultVisibleColumnIds ?? watchlists?.flatMap((w) => w.columns.map((c) => c.id)) ?? [])
  );

  // Clicking whichever tab is already open collapses the panel (same "click the active one again
  // to close" convention CandlestickChart's own header toggle uses); clicking the *other* tab
  // switches to it instead, opening the panel first if it was collapsed — same shape a VSCode-
  // style activity-bar rail already gives, one docked panel with several switchable tabs rather
  // than each tab being its own independently-open panel.
  function toggleTab(tab: ChartWorkspaceSidePanelTab) {
    if (sidePanelState.open && activeTab === tab) {
      sidePanelState.commitOpen(false);
      return;
    }
    setActiveTab(tab);
    onSidePanelTabChange?.(tab);
    if (!sidePanelState.open) sidePanelState.commitOpen(true);
  }

  function selectWatchlist(id: string) {
    setActiveWatchlistId(id);
    onActiveWatchlistChange?.(id);
  }

  function changeVisibleColumns(ids: Set<string>) {
    setVisibleColumnIds(ids);
    onVisibleColumnsChange?.(Array.from(ids));
  }

  // Each panel's own last-reported real hover date (or null) — keyed by panel index, not a single
  // "currently hovered panel" value, since a panel that isn't in any group still needs its own
  // entry cleared correctly when its mouse leaves regardless of what else is going on.
  const [hoverByPanel, setHoverByPanel] = useState<Record<number, Date | null>>({});
  // Horizontal-axis counterpart to hoverByPanel — a price rather than a date, see
  // syncedPriceForPanel/CandlestickChartProps.syncedHoverPrice for why a price (not a raw pixel)
  // is what's actually shared here.
  const [priceByPanel, setPriceByPanel] = useState<Record<number, number | null>>({});
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  // A single template child (see panelElements below) means every clone starts from the very same
  // `timeframe`/`onTimeframeChange` pair — without this, calling the template's own (shared)
  // `onTimeframeChange` from one panel would update the one piece of state every other panel also
  // reads its `timeframe` from, changing all of them at once instead of just the one the user
  // actually touched. Forked here the same way hover/price already are: once a panel's picker is
  // used, that panel's own entry takes over for good, independent of whatever the template's own
  // `timeframe` prop does afterward; a panel never individually touched still tracks the template's
  // value, same as plain controlled behavior outside a workspace. The clone below still also calls
  // the template's own `onTimeframeChange` (if it passed one) after updating this — forking which
  // panel owns which timeframe is an internal *layout* concern, not a reason to also cut a caller
  // off from ever finding out a timeframe changed (the `defaultPanels={1}` case especially: a
  // caller that wants to resample its own `data` per timeframe has nowhere else to learn the
  // selection from, since there's no per-panel timeframe getting reported back out otherwise).
  const [timeframeByPanel, setTimeframeByPanel] = useState<Record<number, string | undefined>>({});
  // Symbol counterpart to timeframeByPanel above — same "shared template value until a panel is
  // individually touched, then that panel's own entry takes over for good" fork, just triggered by
  // either a watchlist row click resolved to this panel (see handleWatchlistRowClick/
  // confirmSymbolTarget below) or that panel's own native symbol search (see the onSymbolSelect
  // override in panelElements.map below) instead of a timeframe picker.
  const [symbolByPanel, setSymbolByPanel] = useState<Record<number, string | undefined>>({});
  // Which panel(s) the "Graphiques liés" modal's own checkboxes currently have checked — mirrored
  // out from LinkGroupsModal (which has no reach into the grid behind it) purely to drive each
  // matching panel's highlight className below. Cleared whenever the modal closes, same as the
  // modal's own staged selection is (see LinkGroupsModal's own reset-on-open effect). Also reused
  // by SymbolTargetModal below for the exact same purpose — the two are never open at once, so
  // sharing one piece of highlight state is simpler than keeping a second copy in sync.
  const [selectedPanels, setSelectedPanels] = useState<number[]>([]);
  // The watchlist row awaiting a "which window(s)" answer from SymbolTargetModal — non-null is
  // what actually keeps that modal open (see its own `open` prop below), not a separate boolean,
  // so there's never a stale row hanging around once the modal's done with it.
  const [pendingSymbolRow, setPendingSymbolRow] = useState<{ row: ChartWorkspaceWatchlistRow; watchlistId: string } | null>(null);

  function closeLinkModal() {
    setLinkModalOpen(false);
    setSelectedPanels([]);
  }

  // The current value each panel's own `symbol` should resolve to — its own fork once one exists
  // (a prior watchlist target pick or native symbol search), else whatever the template child
  // itself was given. Shared by the grid's own cloneElement below and both modals' own
  // `panelSymbols` labels, so neither can drift out of sync with what's actually on screen.
  function resolvedSymbol(panelIndex: number, child: ReactElement<CandlestickChartProps>): string | undefined {
    return panelIndex in symbolByPanel ? symbolByPanel[panelIndex] : child.props.symbol;
  }

  // Routes a watchlist row click: with only one panel there's no ambiguity, so it's applied right
  // away (same immediate feel clicking a result in a panel's own symbol search already has); with
  // several, "which window" isn't decidable here, so SymbolTargetModal asks instead and
  // confirmSymbolTarget below does the actual applying once the user answers.
  function handleWatchlistRowClick(row: ChartWorkspaceWatchlistRow, watchlistId: string) {
    if (panels >= 2) {
      setPendingSymbolRow({ row, watchlistId });
    } else {
      setSymbolByPanel((prev) => ({ ...prev, 0: row.ticker }));
      onWatchlistRowClick?.(row, watchlistId);
    }
  }

  function confirmSymbolTarget(panelIndices: number[]) {
    if (!pendingSymbolRow) return;
    const { row, watchlistId } = pendingSymbolRow;
    setSymbolByPanel((prev) => {
      const next = { ...prev };
      for (const i of panelIndices) next[i] = row.ticker;
      return next;
    });
    onWatchlistRowClick?.(row, watchlistId);
    closeSymbolTargetModal();
  }

  function closeSymbolTargetModal() {
    setPendingSymbolRow(null);
    setSelectedPanels([]);
  }

  function handlePanelsChange(next: 1 | 2 | 4 | 6 | 8) {
    setPanels(next);
    onPanelsChange?.(next);
  }

  function handleHoverChange(panelIndex: number, date: Date | null) {
    setHoverByPanel((prev) => {
      const current = prev[panelIndex] ?? null;
      // Bails out on an unchanged value rather than always spreading a fresh object — `date` is a
      // freshly-constructed Date every call (see useHoverSync's own dateForIndex), so `===` alone
      // would never short-circuit even when nothing meaningful changed, defeating the point.
      if (current === date || (current !== null && date !== null && current.getTime() === date.getTime())) return prev;
      return { ...prev, [panelIndex]: date };
    });
  }

  // The synced date a given panel should render its own crosshair at: whichever *other* panel in
  // its own group most recently reported a real hover, or null if none currently has one (nobody
  // in the group is hovering right now, or this panel isn't in a group at all).
  function syncedDateForPanel(panelIndex: number): Date | null {
    const groupIndex = groupIndexOfPanel(panelIndex);
    if (groupIndex === null) return null;
    for (const otherIndex of groups[groupIndex]) {
      if (otherIndex === panelIndex) continue;
      const date = hoverByPanel[otherIndex];
      if (date) return date;
    }
    return null;
  }

  function handleHoverPriceChange(panelIndex: number, price: number | null) {
    setPriceByPanel((prev) => (prev[panelIndex] === price ? prev : { ...prev, [panelIndex]: price }));
  }

  // Horizontal-axis counterpart to syncedDateForPanel above.
  function syncedPriceForPanel(panelIndex: number): number | null {
    const groupIndex = groupIndexOfPanel(panelIndex);
    if (groupIndex === null) return null;
    for (const otherIndex of groups[groupIndex]) {
      if (otherIndex === panelIndex) continue;
      const price = priceByPanel[otherIndex];
      if (price !== null && price !== undefined) return price;
    }
    return null;
  }

  // A single child is a *template*, repeated to fill every panel — each still becomes its own
  // independent component instance below (cloneElement gives each a distinct `key`, and React
  // mounts a fresh instance per distinct key regardless of them all starting from the same
  // element), it's only the initial props that are shared. Multiple children keep the older
  // "one config per panel" behavior unchanged.
  const rawChildren = Children.toArray(children) as ReactElement<CandlestickChartProps>[];
  const panelElements = rawChildren.length === 1 ? Array.from({ length: panels }, () => rawChildren[0]) : rawChildren.slice(0, panels);
  const effectiveFocusedPanelIndex = focusedPanelIndex !== null && focusedPanelIndex < panels ? focusedPanelIndex : null;
  const columns = GRID_COLUMNS[panels];
  const rows = GRID_ROWS[panels];
  // Fills 100% of the viewport height whenever the caller hasn't opted into a fixed `panelHeight`
  // — always true once the grid wraps into two rows (stacking two rows' worth of a single-row
  // height would run well past the screen regardless of what the caller asked for), and now also
  // the default for a single row (1/2 panels) since that's the more common case in practice: a
  // workspace that's the main content of its own page, same as any other panel count.
  const fillHeight = panelHeight === undefined || rows > 1;

  return (
    // A flex row of up to two children — `.lq-chart-workspace__grid` (the actual panel grid) and,
    // when `watchlists`/`alerts` is set, the docked panel itself plus its own rail — same split
    // CandlestickChart's own `.lq-chart`/`.lq-chart__main` uses and for the same reason (see
    // ChartSidePanel's own doc):
    // ordinary flexbox hands the grid whatever width the panel doesn't take, so every panel's own
    // ResizeObserver-based measurement (CandlestickChart's `useChartDimensions`) picks up the
    // narrower box for free, no per-panel math needed here. `height: 100vh` (fillHeight) moves to
    // *this* outer row rather than the grid itself so the side panel stretches to the exact same
    // height via the row's own default `align-items: stretch`, not just the grid.
    <div
      className={["lq-chart-workspace", workspaceFullscreen && "lq-chart-workspace--fullscreen", className].filter(Boolean).join(" ")}
      // Same `height: 100vh` vs. `undefined` fork CandlestickChart's own fullscreen style uses
      // (see its own doc) — `.lq-chart-workspace--fullscreen`'s `inset` already pins all four
      // edges, so an explicit height here would just fight it instead of matching it.
      style={workspaceFullscreen ? undefined : fillHeight ? { height: "100vh" } : undefined}
    >
      <div
        className={["lq-chart-workspace__grid", workspaceLocked && "lq-chart-workspace__grid--locked"].filter(Boolean).join(" ")}
        onClick={handleGridClick}
        style={{
          // Custom properties, not gridTemplateColumns/gridTemplateRows directly — an inline style
          // always wins the cascade over a stylesheet rule, which would leave .lq-chart-workspace's
          // own narrow-viewport media query (see ChartWorkspace.css) unable to ever override it.
          // The actual `grid-template-columns: repeat(var(--lq-workspace-columns), 1fr)` lives in
          // that stylesheet instead, where the media query can win normally; `--lq-workspace-
          // panels` is the *panel* count (not `rows`, which is always ≤2 by GRID_ROWS above) so
          // that same media query can give a collapsed single column one explicit row per panel,
          // stacked, instead of splitting only 2 rows' worth of height across up to 4 of them.
          ["--lq-workspace-columns" as string]: columns,
          ["--lq-workspace-panels" as string]: panels,
          // gridTemplateRows splits the row's own height evenly between the rows, and each panel
          // below gets `height: undefined` (see CandlestickChart's own useChartDimensions doc) so
          // it measures and fills its own row's actual share via ResizeObserver rather than a
          // hardcoded pixel figure.
          ...(fillHeight ? { gridTemplateRows: `repeat(${rows}, 1fr)` } : {}),
        }}
      >
        {panelElements.map((child, i) =>
          cloneElement(child, {
            // Always the panel index, never `child.key` — panels don't reorder, so it's already a
            // stable, unique identity on its own, and in the single-child "repeat as a template"
            // case above every entry in `panelElements` is literally the *same* element (same key,
            // whatever `Children.toArray` assigned it), which would otherwise collide and collapse
            // every panel down to one shared React instance instead of `panels` independent ones.
            key: i,
            // `height: undefined` alone can't express "fill your container" here — CandlestickChart
            // reads an explicitly-undefined `height` prop identically to an omitted one (both fall
            // through to its own 380 default via a plain JS default parameter), so passing it
            // through cloneElement this way silently lost the "fill instead of default to 380"
            // intent entirely, leaving every panel's own plot area pinned at ~340px inside a
            // correctly-stretched-but-otherwise-empty grid cell. `fillHeight` is a dedicated flag
            // for exactly this (see its own doc) that doesn't have that collision.
            height: panelHeight,
            fillHeight,
            className:
              [
                child.props.className,
                selectedPanels.includes(i) && "lq-chart-workspace__panel--selected",
                effectiveFocusedPanelIndex === i && "lq-chart-workspace__panel--focused",
              ]
                .filter(Boolean)
                .join(" ") || undefined,
            // Workspace-level knowledge a template child can't have on its own — stripped/overridden
            // regardless of what it set, same as sidePanel below. Only shown once there's another
            // panel to focus *away* from (panels >= 2); isFullscreen/onFullscreenChange route every
            // panel's own toggle through the single focusedPanelIndex above instead of each panel
            // managing its own independent viewport-covering state (see useFullscreen's own doc).
            fullscreenToggle: panels >= 2,
            isFullscreen: effectiveFocusedPanelIndex === i,
            onFullscreenChange: (value: boolean) => setFocusedPanelIndex(value ? i : null),
            // Same controlled-prop split as isFullscreen/onFullscreenChange just above, for the
            // same reason — lets the rail's own "</>" button (below) open *this* panel's own
            // script editor from outside it, regardless of which panel that turns out to be.
            scriptEditorOpen: scriptEditorPanelIndex === i,
            onScriptEditorOpenChange: (open: boolean) => setScriptEditorPanelIndex(open ? i : null),
            timeframe: i in timeframeByPanel ? timeframeByPanel[i] : child.props.timeframe,
            onTimeframeChange: (value: string) => {
              setTimeframeByPanel((prev) => ({ ...prev, [i]: value }));
              child.props.onTimeframeChange?.(value);
            },
            // Same fork as timeframe just above, for the symbol shown — driven either by a
            // watchlist row resolved to this panel (handleWatchlistRowClick/confirmSymbolTarget)
            // or this panel's own header symbol search, both landing in the same symbolByPanel
            // slot so the two stay consistent with each other.
            symbol: resolvedSymbol(i, child),
            onSymbolSelect: (result: SymbolSearchResult) => {
              setSymbolByPanel((prev) => ({ ...prev, [i]: result.ticker }));
              child.props.onSymbolSelect?.(result);
            },
            syncedHoverDate: syncedDateForPanel(i),
            onHoverDateChange: (date: Date | null) => handleHoverChange(i, date),
            syncedHoverPrice: syncedPriceForPanel(i),
            onHoverPriceChange: (price: number | null) => handleHoverPriceChange(i, price),
            // Linking only means anything once there's at least one *other* panel to link with —
            // shown regardless in a single-chart workspace, the button had nothing to actually do.
            linkable: panels >= 2,
            isLinked: groupIndexOfPanel(i) !== null,
            onLinkClick: () => setLinkModalOpen(true),
            // `ChartWorkspace`'s own `watchlists`/`alerts` (above) are the single source of truth
            // once a chart is composed into a workspace — a docked panel is a "whole view" concept,
            // not a per-panel one, so a template child that also set its *own*
            // `CandlestickChart.sidePanel` would otherwise render once per panel instead of once
            // for the whole workspace (see `watchlists`' own doc for why). Stripped here
            // regardless of what the template set.
            sidePanel: undefined,
            defaultSidePanelOpen: undefined,
            onSidePanelOpenChange: undefined,
          })
        )}
        {/* Blocks every panel underneath from receiving pointer input at all while locked (the
            actual point of "locking") — the triple-click that lifts it still reaches
            handleGridClick above regardless, since blocking a *descendant* from being the click's
            own target doesn't stop the click from bubbling up through this element to its
            ancestor's listener. Last child so it paints above every panel, including a focused
            one (see .lq-chart-workspace__panel--focused's own z-index). */}
        {workspaceLocked && <div className="lq-chart-workspace__lock-overlay" aria-hidden="true" />}
      </div>

      {(hasWatchlists || hasAlerts) && sidePanelState.open && (
        <ChartSidePanel panelRef={sidePanelState.panelRef} widthPx={sidePanelState.widthPx} startResize={sidePanelState.startResize}>
          {activeTab === "watchlist" && hasWatchlists ? (
            <WatchlistPanel
              watchlists={watchlists!}
              activeWatchlistId={activeWatchlistId}
              onSelectWatchlist={selectWatchlist}
              visibleColumnIds={visibleColumnIds}
              onVisibleColumnIdsChange={changeVisibleColumns}
              onRowClick={handleWatchlistRowClick}
              symbolSearchResults={watchlistSymbolSearchResults}
              onSymbolSearchChange={onWatchlistSymbolSearchChange}
              onAddSymbol={onAddWatchlistSymbol}
              onCreateWatchlist={onCreateWatchlist}
              onCreateSection={onCreateWatchlistSection}
              onRemoveRow={onRemoveWatchlistSymbol}
              onMoveRow={onMoveWatchlistRow}
              onRemoveSection={onRemoveWatchlistSection}
              onReorderSections={onReorderWatchlistSections}
              earnings={watchlistEarnings}
              dividends={watchlistDividends}
              news={watchlistNews}
            />
          ) : (
            <>
              {/* A minimal header of its own just for the tab's own title — unlike a single
                  CandlestickChart, the workspace has no shared header of its own to host this in
                  (each panel has its own independent one instead), so the panel carries it
                  directly. Open/close/switch itself lives in the rail below instead of a button
                  here. WatchlistPanel above renders this same header slot itself (it needs its
                  own name+caret dropdown plus the +/… actions there, not just a plain title). */}
              <div className="lq-chart-workspace__side-panel-header">
                <span className="lq-chart-workspace__side-panel-title">Alertes</span>
              </div>
              {alerts}
            </>
          )}
        </ChartSidePanel>
      )}

      {/* Always visible — unlike the watchlist/alerts icons right above it (each gated on there
          actually being something to show), split-screen has no such prerequisite: laying out
          the grid works with any panel count, one included, so it's unconditional. Also why this
          whole rail no longer only renders when watchlists/alerts is set the way it used to
          (before split-screen moved here) — it needs to exist regardless, for this alone. */}
      <div className="lq-chart-workspace__side-rail">
        {hasWatchlists && (
          <button
            type="button"
            className={["lq-chart__icon-button", sidePanelState.open && activeTab === "watchlist" && "lq-chart__icon-button--active"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => toggleTab("watchlist")}
            aria-label="Liste de surveillance"
            title="Liste de surveillance"
          >
            <WatchlistIcon size={16} />
          </button>
        )}
        {hasAlerts && (
          <button
            type="button"
            className={["lq-chart__icon-button", sidePanelState.open && activeTab === "alerts" && "lq-chart__icon-button--active"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => toggleTab("alerts")}
            aria-label="Alertes"
            title="Alertes"
          >
            <BellIcon size={16} />
          </button>
        )}
        {/* Gated on the *template* panel's own `scripting` prop — same "the button only shows up
            if the feature is actually on" rule `hasWatchlists`/`hasAlerts` follow above, just read
            from the child template instead of a ChartWorkspace-level prop, since scripting is a
            per-`CandlestickChart` concern. Opens whichever panel is currently fullscreen-focused,
            or the first one otherwise — see `scriptEditorPanelIndex`'s own doc for why this is a
            separate piece of state from focus rather than reusing it outright. */}
        {rawChildren[0]?.props.scripting && (
          <button
            type="button"
            className={["lq-chart__icon-button", scriptEditorPanelIndex !== null && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
            onClick={() => setScriptEditorPanelIndex((cur) => (cur !== null ? null : (effectiveFocusedPanelIndex ?? 0)))}
            aria-label="Éditeur de script"
            title="Éditeur de script"
          >
            <CodeIcon size={16} />
          </button>
        )}
        <button
          ref={splitScreenTriggerRef}
          type="button"
          className={["lq-chart__icon-button", splitScreenMenuOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => setSplitScreenMenuOpen((o) => !o)}
          aria-label="Écran divisé"
          title="Écran divisé"
        >
          <GridIcon size={16} />
        </button>
        <Popover open={splitScreenMenuOpen} onClose={() => setSplitScreenMenuOpen(false)} anchorRef={splitScreenTriggerRef} placement="bottom">
          <div className="lq-chart__display-mode-menu">
            {SPLIT_SCREEN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={["lq-chart__display-mode-option", opt.value === panels && "lq-chart__display-mode-option--selected"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  handlePanelsChange(opt.value);
                  setSplitScreenMenuOpen(false);
                }}
              >
                <GridIcon size={15} />
                {opt.label}
              </button>
            ))}
          </div>
        </Popover>
        {/* Item 3: the whole workspace, not just one panel (see workspaceFullscreen above) — always
            visible, same as split-screen right above it, with no panel-count precondition. */}
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={toggleWorkspaceFullscreen}
          aria-label={workspaceFullscreen ? "Quitter le plein écran de l'espace de travail" : "Plein écran de l'espace de travail"}
          title={workspaceFullscreen ? "Quitter le plein écran de l'espace de travail" : "Plein écran de l'espace de travail"}
        >
          {workspaceFullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
        </button>
        {/* Item 21 — pinned to the rail's own bottom edge (`margin-top: auto` inside a column flex
            that already stretches to the workspace's full height, see .lq-chart-workspace__side-
            rail) rather than just sitting last after whichever of the buttons above happened to
            render, so it stays in the same spot regardless of how many of them are showing. */}
        <button
          type="button"
          className="lq-chart__icon-button lq-chart-workspace__help-button"
          onClick={() => setHelpOpen(true)}
          aria-label="Aide"
          title="Aide"
        >
          <HelpIcon size={16} />
        </button>
      </div>

      {helpOpen && (
        <Modal open onClose={() => setHelpOpen(false)} title="Fonctionnalités de l'espace de travail">
          <div className="lq-chart-workspace__help-list">
            {HELP_ITEMS.map((item) => (
              <div className="lq-chart-workspace__help-item" key={item.title}>
                <p className="lq-chart-workspace__help-item-title">{item.title}</p>
                <p className="lq-chart__indicator-info-text">{item.description}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      <LinkGroupsModal
        open={linkModalOpen}
        onClose={closeLinkModal}
        panelCount={panelElements.length}
        groups={groups}
        onLink={linkPanels}
        onUnlink={unlinkGroup}
        panelSymbols={panelElements.map((child, i) => resolvedSymbol(i, child))}
        onSelectedPanelsChange={setSelectedPanels}
      />

      <SymbolTargetModal
        open={pendingSymbolRow !== null}
        onClose={closeSymbolTargetModal}
        panelCount={panelElements.length}
        panelSymbols={panelElements.map((child, i) => resolvedSymbol(i, child))}
        onConfirm={confirmSymbolTarget}
        onSelectedPanelsChange={setSelectedPanels}
      />
    </div>
  );
}
