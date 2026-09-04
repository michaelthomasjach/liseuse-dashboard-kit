import { Children, cloneElement, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { CandlestickChartProps } from "./candlestick/interfaces/CandlestickChartProps.interface";
import type { SymbolSearchCategory } from "./candlestick/interfaces/SymbolSearchCategory.interface";
import type { SymbolSearchResult } from "./candlestick/interfaces/SymbolSearchResult.interface";
import type { ScriptDef } from "./candlestick/interfaces/ScriptDef.interface";
import type { ScriptAlertEvent } from "./candlestick/interfaces/ScriptAlertEvent.interface";
import { useLinkGroups } from "./workspace/useLinkGroups";
import { LinkGroupsModal } from "./workspace/LinkGroupsModal";
import { SymbolTargetModal } from "./workspace/SymbolTargetModal";
import { WatchlistPanel } from "./workspace/WatchlistPanel";
import { SymbolProfilePanel } from "./workspace/SymbolProfilePanel";
import type { SymbolProfile } from "./workspace/SymbolProfile.interface";
export type {
  SymbolProfile,
  SymbolProfilePerformancePoint,
  SymbolProfileNewsItem,
  SymbolProfileKeyStats,
  SymbolProfileEarningsPoint,
} from "./workspace/SymbolProfile.interface";
import { useSymbolProfileSplit } from "./workspace/useSymbolProfileSplit";
import { useDragToDismiss } from "./workspace/useDragToDismiss";
import { useSidePanel } from "./candlestick/hooks/useSidePanel";
import { useScriptingState } from "./candlestick/hooks/useScriptingState";
import { ChartSidePanel } from "./candlestick/components/ChartSidePanel";
import { ScriptEditorPanel } from "./candlestick/scripting/components/ScriptEditorPanel";
import { Popover } from "../forms/Popover";
import { Modal } from "../primitives/Modal";
import { WatchlistIcon, BellIcon, PlusIcon, CandleModeIcon, GridIcon, MaximizeIcon, MinimizeIcon, HelpIcon, CodeIcon, LockIcon } from "../icons";
import { useFullscreen } from "./internal/useFullscreen";
import { useChartDimensions } from "./internal/useChartDimensions";
import { MOBILE_LAYOUT_BREAKPOINT } from "./candlestick/constants";
import { useViewportWidth } from "./internal/useViewportWidth";
import "./ChartWorkspace.css";

// Item 21 — one entry per global feature the rail's own "?" button explains, in the order they
// read most naturally (layout, then focus, then protection) rather than the order their own
// buttons sit in the rail.
/** How long the grid has to be held to toggle its lock. Three seconds is deliberately long: this
 *  protects a laid-out workspace from stray clicks, so arming it by accident would defeat the
 *  point. */
const LOCK_HOLD_MS = 3000;
/** When the hold starts showing itself — the fade and the gauge. Before this a press is just a
 *  press, and a click, a drag or a tap costs nothing visually. */
const LOCK_HOLD_REVEAL_MS = 1000;
/** How far the pointer may travel and still count as held rather than dragged. */
const LOCK_HOLD_SLOP = 10;

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
      "Ouvre l'éditeur de script partagé de l'espace de travail — un script y choisit sur quel panneau s'exécuter. Visible uniquement si ce ChartWorkspace a activé la prop `scripting`.",
  },
  {
    title: "Verrouillage",
    description:
      "Un appui maintenu trois secondes sur la grille la verrouille : elle s'estompe et devient protégée contre toute interaction, un curseur en forme de cadenas apparaît au survol. Le même appui la déverrouille. Après une seconde, une jauge et un cadenas apparaissent au centre pour montrer la progression — relâcher ou faire glisser le doigt avant la fin annule. Le geste est sans effet tant qu'un outil de dessin est actif, pour ne pas se confondre avec la pose d'un point.",
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
  /** Name/exchange/performance/seasonality for whichever symbols the caller wants covered — same
   *  "caller owns the data, this never fetches or infers any of it" stance as `watchlistEarnings`
   *  etc. above. The side panel's own "company info" section (below the watchlist/alerts, see
   *  `SymbolProfilePanel`) looks up whichever entry's `ticker` matches the currently-focused
   *  panel's own symbol; the section itself only appears once `hasWatchlists || hasAlerts` is
   *  already true (it rides on that same docked panel, not a separate one of its own) and the
   *  focused panel actually resolves to a symbol. Missing a `SymbolProfile` for the current symbol
   *  entirely still shows a bare price/change readout — see that component's own doc. */
  symbolProfiles?: SymbolProfile[];
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
  /** Shows the rail's own "</>" button and shares *one* script list (and one editor) across every
   *  panel — unlike every other `CandlestickChartProps` scripting prop, which stays per-panel for
   *  a standalone chart, a workspace script explicitly targets one chosen panel (see
   *  `ScriptDef.targetPanelIndex`'s own doc) rather than living inside any one panel's own state.
   *  Default false. */
  scripting?: boolean;
  defaultScripts?: ScriptDef[];
  onScriptsChange?: (scripts: ScriptDef[]) => void;
  onScriptAlert?: (event: ScriptAlertEvent) => void;
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
  symbolProfiles,
  alerts,
  defaultSidePanelOpen,
  onSidePanelOpenChange,
  defaultSidePanelTab,
  onSidePanelTabChange,
  scripting = false,
  defaultScripts,
  onScriptsChange,
  onScriptAlert,
  className,
}: ChartWorkspaceProps) {
  const [panels, setPanels] = useState(defaultPanels);
  const { groups, linkPanels, unlinkGroup } = useLinkGroups({ defaultLinkGroups, onLinkGroupsChange });
  // `groups` clamped to the current panel count, without touching the underlying committed state
  // — same "recompute from source rather than mutate" pattern `effectiveFocusedPanelIndex` below
  // already uses: a group involving a panel index the workspace no longer has recovers
  // automatically if it grows back to include that index again, instead of permanently losing
  // that membership the moment it briefly shrinks (reducing the panel count is always reachable
  // via the rail's own "Écran divisé" menu, no gate on it). Each group's own *membership* is
  // filtered here, not the groups array itself sliced down — a group's position in this array
  // still matches unlinkGroup's own index into the *real* array below, so LinkGroupsModal can
  // still dissolve the right one; it just skips rendering any group left with fewer than 2 real
  // members instead of dropping it from the array outright. Left unclamped before this fix, a
  // panel still grouped with one that's now gone could keep reading that removed panel's own
  // last-known (now permanently frozen — it can never update again) hover position forever, via
  // syncedDateForPanel/syncedPriceForPanel below.
  const effectiveGroups = groups.map((g) => g.filter((idx) => idx < panels));
  function effectiveGroupIndexOfPanel(panelIndex: number): number | null {
    const i = effectiveGroups.findIndex((g) => g.length >= 2 && g.includes(panelIndex));
    return i === -1 ? null : i;
  }
  const sidePanelState = useSidePanel({ defaultSidePanelOpen, onSidePanelOpenChange });
  const symbolProfileSplit = useSymbolProfileSplit();
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
  // One shared script list (and one shared editor) for the whole workspace — see
  // ChartWorkspaceProps.scripting's own doc for why this lives here rather than inside any one
  // panel. Uncontrolled at this level (nothing above ChartWorkspace itself needs to drive it).
  const workspaceScripting = useScriptingState({ defaultScripts, onScriptsChange });
  // Item 20: hold anywhere on the grid for LOCK_HOLD_MS to toggle the lock, in either direction.
  // A press rather than a click count (which this used to be) because a count has no way to show
  // its own progress — you either guessed right or nothing happened. A hold can be watched, and
  // abandoned.
  const [workspaceLocked, setWorkspaceLocked] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // 0 while nothing is held; otherwise how far through the hold we are, 0→1. Only surfaces past
  // LOCK_HOLD_REVEAL_MS — see the overlay below — so a stray press costs nothing visually.
  const [lockHoldProgress, setLockHoldProgress] = useState(0);
  const lockHoldRef = useRef<{ frame: number; startedAt: number; startX: number; startY: number } | null>(null);

  const endLockHold = useCallback(() => {
    const hold = lockHoldRef.current;
    if (!hold) return;
    cancelAnimationFrame(hold.frame);
    lockHoldRef.current = null;
    setLockHoldProgress(0);
  }, []);

  function startLockHold(e: React.PointerEvent<HTMLDivElement>) {
    if (lockHoldRef.current) return;
    // A drawing tool being active anywhere in the workspace disables the gesture outright: with a
    // tool armed, a press on the plot is the first point of a drawing, and it must not also arm a
    // lock. Read off the DOM rather than through props — `.lq-chart__overlay--drawing` is the
    // class CandlestickChart already puts on its hit rect for exactly this state, and every panel
    // is a descendant of this grid, so one query answers it for all of them without threading a
    // per-panel `activeTool` up through the tree.
    if (!workspaceLocked && e.currentTarget.querySelector(".lq-chart__overlay--drawing")) return;
    const startedAt = performance.now();
    const step = () => {
      const hold = lockHoldRef.current;
      if (!hold) return;
      const progress = Math.min(1, (performance.now() - hold.startedAt) / LOCK_HOLD_MS);
      setLockHoldProgress(progress);
      if (progress >= 1) {
        setWorkspaceLocked((locked) => !locked);
        endLockHold();
        return;
      }
      hold.frame = requestAnimationFrame(step);
    };
    lockHoldRef.current = { frame: requestAnimationFrame(step), startedAt, startX: e.clientX, startY: e.clientY };
  }

  function trackLockHold(e: React.PointerEvent<HTMLDivElement>) {
    const hold = lockHoldRef.current;
    if (!hold) return;
    // A press that travels is a pan, not a hold. Without this, panning the chart for three seconds
    // would silently lock the workspace — the gesture would misfire far more often than it fired.
    if (Math.hypot(e.clientX - hold.startX, e.clientY - hold.startY) > LOCK_HOLD_SLOP) endLockHold();
  }
  const [splitScreenMenuOpen, setSplitScreenMenuOpen] = useState(false);
  const splitScreenTriggerRef = useRef<HTMLButtonElement>(null);
  // Reuses CandlestickChart's own generic wrapper-measuring hook (see its own doc — margin/options
  // both optional, and nothing about it assumes a canvas/candles) purely for `dims.width`, to
  // decide the same "too narrow to fit" question ToolsRail/MOBILE_LAYOUT_BREAKPOINT already answer
  // for a single chart's own drawing-tools rail, just at the whole-workspace level instead: below
  // this width, the side rail (watchlist/alerts/scripting/split-screen/fullscreen icons) is
  // replaced by a second, scrollable topbar — see isMobileWorkspace's own usages below.
  const [workspaceRef] = useChartDimensions();
  // The window's width, not the workspace's own box — the touch layout is a property of the
  // screen in hand (see MOBILE_LAYOUT_BREAKPOINT's own doc). The wrapper is still measured for its
  // ref alone; nothing here reads its size any more.
  const viewportWidth = useViewportWidth();
  const isMobileWorkspace = viewportWidth > 0 && viewportWidth < MOBILE_LAYOUT_BREAKPOINT;
  // The panel starts closed on mobile, where it covers the whole content area (see ChartSidePanel's
  // own `fullscreen`) — opening onto a symbol list with the charts hidden behind it is the wrong
  // first impression of a charting workspace. Deliberately once, on the first real measurement,
  // rather than on every crossing of the breakpoint: this sets the *default*, and past that the
  // panel is the user's to open and close (someone who opens it and then narrows their window
  // shouldn't have it yanked shut under them).
  // In an effect, not inline during render: `commitOpen` also fires the caller's own
  // `onSidePanelOpenChange`, and reaching outside the component is not something render may do.
  const mobileDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (mobileDefaultAppliedRef.current || viewportWidth <= 0) return;
    mobileDefaultAppliedRef.current = true;
    if (viewportWidth < MOBILE_LAYOUT_BREAKPOINT) sidePanelState.commitOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth]);
  const hasWatchlists = !!watchlists && watchlists.length > 0;
  const hasAlerts = alerts !== undefined;
  const [activeTab, setActiveTab] = useState<ChartWorkspaceSidePanelTab>(defaultSidePanelTab ?? (hasWatchlists ? "watchlist" : "alerts"));
  const [activeWatchlistId, setActiveWatchlistId] = useState(defaultActiveWatchlistId ?? watchlists?.[0]?.id);
  // Bumped by the mobile topbar's own "+" to open WatchlistPanel's add-symbol modal — that panel
  // drops its whole header row (and with it its own "+") on this layout, see its `mobile` prop.
  // A counter, not a boolean: the modal's open state stays down in the panel, which closes it
  // itself without needing to write anything back up here (see `addSymbolRequestId`'s own doc).
  const [addSymbolRequestId, setAddSymbolRequestId] = useState(0);
  // Mobile only: which symbol's own details page is covering the list, or null for the list
  // itself. The ticker rather than a boolean, because the page has to name the row that was
  // actually tapped even before the panel behind it has caught up to that symbol — see where
  // it's read below. Deliberately not derived from `symbolByPanel`: that says which symbol a
  // *chart* is showing, which stays true long after the user has come back to the list.
  const [mobileProfileTicker, setMobileProfileTicker] = useState<string | null>(null);
  // The details page's own presentation — the slide up, the drag down, the slide out. Declared
  // beside the state it reads rather than next to where it renders, because that page is built
  // inside an IIFE in the JSX, which is no place for a hook: it renders conditionally, and a hook
  // that comes and goes with a condition is exactly what the rules of hooks forbid.
  const profileDrag = useDragToDismiss({ open: mobileProfileTicker !== null, onDismiss: () => setMobileProfileTicker(null) });
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
    // Not on the mobile layout: there the bottom nav is what opens and closes the panel, and these
    // buttons only ever live *inside* it (see the topbar's own render condition). Collapsing from
    // here would drop the user onto the chart page as a side effect of tapping the tab they were
    // already on, which is not what a tab does.
    if (!isMobileWorkspace && sidePanelState.open && activeTab === tab) {
      sidePanelState.commitOpen(false);
      return;
    }
    // Any move that changes what the panel is showing drops the mobile details page with it —
    // it belongs to one row of one list, and leaving it up over a different tab would be a page
    // about a symbol nothing on screen is still about.
    setMobileProfileTicker(null);
    setActiveTab(tab);
    onSidePanelTabChange?.(tab);
    if (!sidePanelState.open) sidePanelState.commitOpen(true);
  }

  function selectWatchlist(id: string) {
    setActiveWatchlistId(id);
    onActiveWatchlistChange?.(id);
  }

  // Mobile topbar's own per-list buttons (see isMobileWorkspace) — same "click the active one
  // again to close" convention as toggleTab above, just keyed on *which list* is both open and
  // active instead of only the tab, since every list gets its own button here rather than one
  // shared icon plus an in-panel dropdown to pick among them (WatchlistPanel's own trigger).
  function selectWatchlistTab(id: string) {
    // Same carve-out as toggleTab above, for the same reason — and it bites harder here, since
    // these buttons only exist on the mobile layout at all.
    if (!isMobileWorkspace && sidePanelState.open && activeTab === "watchlist" && activeWatchlistId === id) {
      sidePanelState.commitOpen(false);
      return;
    }
    // Same as toggleTab — switching lists takes you back to the list itself, not to a details page
    // opened from the one you just left.
    setMobileProfileTicker(null);
    selectWatchlist(id);
    setActiveTab("watchlist");
    onSidePanelTabChange?.("watchlist");
    if (!sidePanelState.open) sidePanelState.commitOpen(true);
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
  // `child` is `undefined` whenever `panelIndex` is beyond `panelElements`'s own actual length —
  // reachable from `scriptPanelChoices` below, which (unlike the grid's own render loop, which
  // only ever maps over `panelElements`'s real entries) always builds one candidate per `panels`
  // regardless of how many explicit `<CandlestickChart>` children were actually supplied. Multiple
  // fewer-than-`panels` children is documented as valid (the remaining grid cells just render
  // empty) — bumping the split-screen panel count past the number of explicit children (always
  // reachable, no gate on it) used to crash the whole workspace here instead.
  function resolvedSymbol(panelIndex: number, child: ReactElement<CandlestickChartProps> | undefined): string | undefined {
    return panelIndex in symbolByPanel ? symbolByPanel[panelIndex] : child?.props.symbol;
  }

  // Routes a watchlist row click: with only one panel there's no ambiguity, so it's applied right
  // away (same immediate feel clicking a result in a panel's own symbol search already has); with
  // several, "which window" isn't decidable here, so SymbolTargetModal asks instead and
  // confirmSymbolTarget below does the actual applying once the user answers.
  function handleWatchlistRowClick(row: ChartWorkspaceWatchlistRow, watchlistId: string) {
    // Mobile: the tap opens that symbol's own details page over the list (see the side panel's own
    // render below). SymbolTargetModal is skipped on the way, whatever `panels` says — "which of
    // the windows" is a desktop question, and a modal landing on top of the page that just opened
    // would be two answers to one tap. The ticker still goes to the primary panel, so switching to
    // the Graphique page afterwards shows what was tapped rather than the previous symbol.
    if (isMobileWorkspace) {
      setMobileProfileTicker(row.ticker);
      setSymbolByPanel((prev) => ({ ...prev, 0: row.ticker }));
      onWatchlistRowClick?.(row, watchlistId);
      return;
    }
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
    const groupIndex = effectiveGroupIndexOfPanel(panelIndex);
    if (groupIndex === null) return null;
    for (const otherIndex of effectiveGroups[groupIndex]) {
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
    const groupIndex = effectiveGroupIndexOfPanel(panelIndex);
    if (groupIndex === null) return null;
    for (const otherIndex of effectiveGroups[groupIndex]) {
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
  // One candidate target per panel for the shared editor's own "Exécuter" picker (exigence: "si
  // plusieurs charts sont ouvertes, on me demande sur laquelle exécuter") — a single-panel
  // workspace never shows this at all (ScriptEditorPanel's own needsTargetChoice only engages past
  // one choice), so this array existing unconditionally costs nothing in the common case.
  const scriptPanelChoices = Array.from({ length: panels }, (_, i) => {
    const symbol = resolvedSymbol(i, panelElements[i]);
    return { index: i, label: symbol ? `Panneau ${i + 1} (${symbol})` : `Panneau ${i + 1}` };
  });
  // "Which symbol is currently being studied" for the side panel's own company-info section below
  // (see SymbolProfilePanel) — the focused panel if one is, else the first ("primary") one,
  // matching how a single-chart TradingView-style workspace already treats "the" chart when
  // nothing's explicitly focused.
  const symbolProfilePanelIndex = effectiveFocusedPanelIndex ?? 0;
  const symbolProfileChild = panelElements[symbolProfilePanelIndex] as ReactElement<CandlestickChartProps> | undefined;
  const currentProfileSymbol = symbolProfileChild ? resolvedSymbol(symbolProfilePanelIndex, symbolProfileChild) : undefined;
  // Price/change derived directly from that panel's own OHLCV data (the last two candles) rather
  // than carried on SymbolProfile itself — the same single source of truth the chart's own header
  // already reads, so the two can never show a different number for the same symbol.
  const profileData = symbolProfileChild?.props.data;
  const profileLastCandle = profileData && profileData.length > 0 ? profileData[profileData.length - 1] : undefined;
  const profilePrevCandle = profileData && profileData.length > 1 ? profileData[profileData.length - 2] : undefined;
  const currentProfilePrice = profileLastCandle?.close ?? null;
  const currentProfileChange = profileLastCandle && profilePrevCandle ? profileLastCandle.close - profilePrevCandle.close : null;
  const currentProfileChangePercent =
    profileLastCandle && profilePrevCandle && profilePrevCandle.close !== 0
      ? ((profileLastCandle.close - profilePrevCandle.close) / profilePrevCandle.close) * 100
      : null;
  const currentSymbolProfile = symbolProfiles?.find((p) => p.ticker === currentProfileSymbol);
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
      ref={workspaceRef}
      className={[
        "lq-chart-workspace",
        workspaceFullscreen && "lq-chart-workspace--fullscreen",
        isMobileWorkspace && "lq-chart-workspace--mobile",
        // Not while fullscreen: `.lq-chart-workspace--fullscreen`'s own `inset` already pins all
        // four edges, and an explicit height would only fight it.
        fillHeight && !workspaceFullscreen && "lq-chart-workspace--fill",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      // Same `height: 100vh` vs. `undefined` fork CandlestickChart's own fullscreen style uses
      // (see its own doc) — `.lq-chart-workspace--fullscreen`'s `inset` already pins all four
      // edges, so an explicit height here would just fight it instead of matching it.
      // The fill height is a class rather than an inline `height: 100vh` so it can carry two
      // declarations — see `.lq-chart-workspace--fill`: `100dvh`, with `100vh` as the fallback.
      // An inline style can only say one.
    >
      {/* Replaces the side rail's watchlist/alerts icons below a certain width (isMobileWorkspace)
          — every list's own full name instead of one icon + an in-panel dropdown to pick among
          them (not enough room to justify the extra step on a phone), plus the alert bell moved
          in from the rail. scripting/split-screen/fullscreen simply have no mobile equivalent —
          they just don't render anywhere on this layout. Native horizontal scroll (not a custom
          drag handler) for when the list names don't all fit — same finger-drag-for-free pattern
          `.lq-chart__header` and ToolsRail's own `--horizontal` variant already use.
          Only while the list itself is the page being shown — not on the chart page (the bottom
          nav further down is what opens and closes the panel on this layout), and not over a
          symbol's details page either: these buttons pick *which* list, a question that only
          exists while you're looking at one. Anywhere else they're 40px of permanent overhead
          answering nothing, and the details page in particular already has a header of its own
          naming where you are and how to get back. */}
      {isMobileWorkspace && sidePanelState.open && mobileProfileTicker === null && (hasWatchlists || hasAlerts) && (
        <div className="lq-chart-workspace__mobile-topbar">
          {watchlists?.map((w) => (
            <button
              key={w.id}
              type="button"
              className={[
                "lq-chart__timeframe-trigger",
                "lq-chart-workspace__mobile-topbar-item",
                sidePanelState.open && activeTab === "watchlist" && activeWatchlistId === w.id && "lq-chart-workspace__mobile-topbar-item--active",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => selectWatchlistTab(w.id)}
            >
              <span className="lq-chart__timeframe-trigger-label">{w.name}</span>
            </button>
          ))}
          {/* WatchlistPanel's own "+", relocated: on this layout that panel renders no header of
              its own at all (see its `mobile` prop), so the one action worth keeping from it lands
              here instead. Only while that panel is actually the open tab — it owns the modal this
              opens, so with the panel unmounted (or showing alerts) there'd be nothing listening,
              and "add a symbol" has no meaning without a visible list to add it to. Sits with the
              bell rather than among the list-name buttons: those pick *which* list, these two act. */}
          {sidePanelState.open && activeTab === "watchlist" && hasWatchlists && (
            <button
              type="button"
              className="lq-chart__icon-button"
              onClick={() => setAddSymbolRequestId((n) => n + 1)}
              aria-label="Ajouter un symbole"
              title="Ajouter un symbole"
            >
              <PlusIcon size={16} />
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
        </div>
      )}
      <div className="lq-chart-workspace__row">
      <div
        className={["lq-chart-workspace__grid", workspaceLocked && "lq-chart-workspace__grid--locked"].filter(Boolean).join(" ")}
        onPointerDown={startLockHold}
        onPointerMove={trackLockHold}
        onPointerUp={endLockHold}
        onPointerCancel={endLockHold}
        onPointerLeave={endLockHold}
        style={{
          // How far through the hold we are, for the fade below — see LOCK_HOLD_MS. Zero (and so
          // no fade at all) whenever nothing is being held.
          ["--lq-lock-hold" as string]: lockHoldProgress,
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
            // The workspace's own shared script list, filtered down to whichever scripts target
            // *this* panel (see ScriptDef.targetPanelIndex's own doc) — same controlled-prop split
            // as isFullscreen/onFullscreenChange just above, but for the list itself rather than a
            // single open/closed flag. A panel-local change (e.g. toggling a script's own enabled
            // state from this panel's "Mes scripts" picker row) reports back as just its own
            // subset, so it has to be spliced back into the *full* shared list here rather than
            // replacing it outright — every other panel's own scripts must survive untouched.
            ...(scripting
              ? {
                  scripts: workspaceScripting.scripts.filter((s) => s.targetPanelIndex === i),
                  onScriptsChange: (updatedSubset: ScriptDef[]) => {
                    workspaceScripting.commitScripts([
                      ...workspaceScripting.scripts.filter((s) => s.targetPanelIndex !== i),
                      ...updatedSubset,
                    ]);
                  },
                  onScriptAlert,
                  // The pane header's own "</>" shortcut (see PaneHeaders.tsx) on a script-produced
                  // indicator — jumps straight to that script's own tab in the shared editor instead
                  // of leaving the user to hunt for it by name in the tab strip.
                  onEditScript: (scriptId: string) => {
                    workspaceScripting.setActiveScriptId(scriptId);
                    workspaceScripting.setEditorOpen(true);
                  },
                  // "Ouvrir dans l'éditeur" on a built-in indicator's own code view (see
                  // IndicatorModals.tsx) — forks that indicator's script equivalent into a real new
                  // script. `targetPanelIndex: i` at creation time (not a follow-up updateScript,
                  // see addScript's own doc on the stale closure that would be) points it at the
                  // panel the user was actually looking at, so it runs there immediately instead of
                  // sitting untargeted until they pick a chart in the editor's own "Cible".
                  onCreateScript: (name: string, code: string) => {
                    workspaceScripting.addScript(name, code, { targetPanelIndex: i });
                  },
                  // The picker's own trash button on a "Mes scripts" row, after its confirmation
                  // modal. Deliberately the *workspace's* own removeScript, not the panel's own
                  // (which would work on the list all the same, routing back up through
                  // onScriptsChange): only this one also clears the shared editor's own
                  // activeScriptId/runOutputs, so the deleted script leaves the tab strip instead
                  // of leaving it pointed at something that no longer exists.
                  onDeleteScript: workspaceScripting.removeScript,
                  // Bridges each panel's own local script-run output back up into the *shared*
                  // editor's own `runOutputs` — the editor itself has no `ScriptRunner` of its own
                  // (every script actually executes inside whichever panel it's routed to, not
                  // here), so without this its own error/console panel and notebook cell output
                  // (see CandlestickChartProps.onScriptRunOutput's own doc) never see a single real
                  // result despite the chart itself rendering that script's own indicators just fine.
                  onScriptRunOutput: workspaceScripting.reportRunOutput,
                }
              : {}),
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
            isLinked: effectiveGroupIndexOfPanel(i) !== null,
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
        {/* Shown only once the hold has been sustained past LOCK_HOLD_REVEAL_MS, so a click or a
            tap never flashes it. The gauge reads the *whole* hold rather than just the visible
            part, so it appears already a third full — which is the truth: a third of the hold is
            already done by the time it shows up. The padlock names what is about to happen, and
            flips with the direction, since the same gesture does both. */}
        {lockHoldProgress * LOCK_HOLD_MS >= LOCK_HOLD_REVEAL_MS && (
          <div className="lq-chart-workspace__lock-hold" aria-hidden="true">
            {/* One padlock either way — there is no open-padlock icon in this set, and inventing
                one for a two-second overlay would be more inconsistency than it buys. The verb
                below carries the direction instead. */}
            <LockIcon size={20} />
            <span className="lq-chart-workspace__lock-hold-label">{workspaceLocked ? "Déverrouiller" : "Verrouiller"}</span>
            <div className="lq-chart-workspace__lock-hold-track">
              <div className="lq-chart-workspace__lock-hold-fill" style={{ width: `${Math.round(lockHoldProgress * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {(hasWatchlists || hasAlerts) && sidePanelState.open && (
        <ChartSidePanel
          panelRef={sidePanelState.panelRef}
          widthPx={sidePanelState.widthPx}
          startResize={sidePanelState.startResize}
          fullscreen={isMobileWorkspace}
        >
          {(() => {
            const topContent =
              activeTab === "watchlist" && hasWatchlists ? (
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
                  mobile={isMobileWorkspace}
                  addSymbolRequestId={addSymbolRequestId}
                />
              ) : (
                <>
                  {/* A minimal header of its own just for the tab's own title — unlike a single
                      CandlestickChart, the workspace has no shared header of its own to host this
                      in (each panel has its own independent one instead), so the panel carries it
                      directly. Open/close/switch itself lives in the rail below instead of a
                      button here. WatchlistPanel above renders this same header slot itself (it
                      needs its own name+caret dropdown plus the +/… actions there, not just a
                      plain title). */}
                  <div className="lq-chart-workspace__side-panel-header">
                    <span className="lq-chart-workspace__side-panel-title">Alertes</span>
                  </div>
                  {alerts}
                </>
              );
            // Mobile: one page at a time, never the split. The list is the whole panel, and a
            // tapped row pushes that symbol's own details over it with a back button to return —
            // the desktop split would leave the table roughly a third of a phone's screen, which
            // is the one thing this page exists to show. Each page carries its own scroll
            // container, the job the split's own two halves used to do.
            if (isMobileWorkspace) {
              // Price/change come from a *panel's* own candles (see currentProfilePrice above), so
              // they're only meaningful while that panel is actually on this ticker. It normally
              // is — the tap put it there — but a focused second panel, or a host that hasn't
              // supplied data for the new symbol yet, both break that; showing the previous
              // symbol's price under this one's name would be worse than showing none.
              const profileIsForTicker = currentProfileSymbol === mobileProfileTicker;
              return (
                <div className="lq-chart-workspace__side-pages">
                  {/* The list stays mounted underneath the details page rather than being swapped
                      out for it — that's what makes dragging the page down reveal the list itself
                      instead of an empty panel, and it keeps the list's own scroll position (and
                      any half-finished drag/collapse state in it) exactly where it was. */}
                  <div className="lq-chart-workspace__side-page">
                    <div className="lq-chart-workspace__side-page-body">{topContent}</div>
                  </div>
                  {mobileProfileTicker !== null && (
                    <div
                      className={[
                        "lq-chart-workspace__side-page",
                        "lq-chart-workspace__side-page--overlay",
                        // `--entered` is what the opening slide transitions *to*; dropping it (or
                        // never having added it yet) leaves the base rule's own translateY(100%),
                        // which is both the start of the entrance and the end of the exit. See
                        // useDragToDismiss' own doc for why these are classes and not keyframes.
                        profileDrag.entered && !profileDrag.closing && "lq-chart-workspace__side-page--entered",
                        profileDrag.dragging && "lq-chart-workspace__side-page--dragging",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={profileDrag.dragging ? { transform: `translateY(${profileDrag.offsetY}px)` } : undefined}
                      onTransitionEnd={profileDrag.onTransitionEnd}
                    >
                      {/* Replaces the back-button header this page used to carry: one bar, drag it
                          down to close. `touch-action: none` on it (see the CSS) is what stops the
                          browser claiming the same vertical gesture for scrolling the page body
                          underneath before the handler ever sees it. Still a real <button>, so the
                          page keeps a keyboard/screen-reader way out — a drag gesture is not one. */}
                      <button
                        type="button"
                        className="lq-chart-workspace__side-page-grabber"
                        onPointerDown={profileDrag.startDrag}
                        // Not a straight `setMobileProfileTicker(null)` — that would cut the page
                        // out mid-frame. `requestClose` plays the same downward slide a released
                        // drag does, and nulls the ticker only once it has finished.
                        onClick={profileDrag.onGrabberClick}
                        aria-label="Fermer les détails du symbole"
                        title="Glisser vers le bas pour fermer"
                      >
                        <span className="lq-chart-workspace__side-page-grabber-bar" aria-hidden="true" />
                      </button>
                      <div className="lq-chart-workspace__side-page-body">
                        <SymbolProfilePanel
                          symbol={mobileProfileTicker}
                          price={profileIsForTicker ? currentProfilePrice : null}
                          change={profileIsForTicker ? currentProfileChange : null}
                          changePercent={profileIsForTicker ? currentProfileChangePercent : null}
                          profile={symbolProfiles?.find((p) => p.ticker === mobileProfileTicker)}
                          // Same guard as the price above, and for the same reason: these are one
                          // panel's own candles, worth drawing only while that panel is on this
                          // ticker. The desktop split gets neither prop — the real chart is already
                          // on screen beside it there.
                          priceHistory={profileIsForTicker ? profileData : undefined}
                          onOpenInChart={() => {
                            setMobileProfileTicker(null);
                            sidePanelState.commitOpen(false);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            // Split vertically whenever there's an actual symbol to show company info for — the
            // content above, unchanged, on top; SymbolProfilePanel below; a drag handle between
            // the two (see useSymbolProfileSplit's own doc). Falls back to the plain unsplit
            // layout when there's no resolvable symbol at all (e.g. every panel's own `symbol` is
            // unset) — a bottom half with nothing to show isn't worth the divider.
            if (!currentProfileSymbol) return topContent;
            return (
              <div className="lq-chart-workspace__side-split">
                <div className="lq-chart-workspace__side-split-top">{topContent}</div>
                <div className="lq-chart-workspace__side-split-handle" onPointerDown={symbolProfileSplit.startResize} aria-hidden="true">
                  <span className="lq-chart__pane-resize-grip" aria-hidden="true" />
                </div>
                <div
                  ref={symbolProfileSplit.panelRef}
                  className="lq-chart-workspace__side-split-bottom"
                  style={{
                    flexBasis: symbolProfileSplit.heightPx !== null ? `${symbolProfileSplit.heightPx}px` : symbolProfileSplit.defaultHeightFraction,
                  }}
                >
                  <SymbolProfilePanel
                    symbol={currentProfileSymbol}
                    price={currentProfilePrice}
                    change={currentProfileChange}
                    changePercent={currentProfileChangePercent}
                    profile={currentSymbolProfile}
                  />
                </div>
              </div>
            );
          })()}
        </ChartSidePanel>
      )}

      {/* Always visible — unlike the watchlist/alerts icons right above it (each gated on there
          actually being something to show), split-screen has no such prerequisite: laying out
          the grid works with any panel count, one included, so it's unconditional. Also why this
          whole rail no longer only renders when watchlists/alerts is set the way it used to
          (before split-screen moved here) — it needs to exist regardless, for this alone.
          Hidden entirely on the mobile layout (isMobileWorkspace) — watchlist/alerts move into
          the topbar above instead (see its own doc), and scripting/split-screen/fullscreen simply
          have no mobile equivalent. */}
      {!isMobileWorkspace && (
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
        {/* Gated on ChartWorkspace's own `scripting` prop (same "the button only shows up if the
            feature is actually on" rule hasWatchlists/hasAlerts follow above) — opens the one
            shared editor (rendered below, outside the rail) rather than any one panel's own. */}
        {scripting && (
          <button
            type="button"
            className={["lq-chart__icon-button", workspaceScripting.editorOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
            onClick={() => workspaceScripting.setEditorOpen(!workspaceScripting.editorOpen)}
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
      )}
      </div>

      {/* The mobile layout's own two pages, and the only way between them: the charts, or the
          docked panel (whichever of watchlist/alerts `activeTab` last named). Both stay mounted
          throughout — the panel covers the row rather than replacing it (see
          `.lq-chart__side-panel--fullscreen`), so switching pages never unmounts a chart and loses
          its zoom, its drawings or a running script.
          Reads and writes `sidePanelState.open` rather than owning a page enum of its own: on this
          layout "the panel is open" and "the panel is the page you're on" are already the same
          fact, and a second piece of state saying so could only ever disagree with the first.
          Last child of the workspace column, so it sits under the row and stays put while the row
          above it scrolls — no `position: fixed`, which would escape a workspace embedded in a
          taller page and pin itself to the viewport instead. */}
      {isMobileWorkspace && (hasWatchlists || hasAlerts) && (
        <div className="lq-chart-workspace__mobile-bottomnav">
          <button
            type="button"
            className={["lq-chart-workspace__mobile-bottomnav-item", !sidePanelState.open && "lq-chart-workspace__mobile-bottomnav-item--active"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              // Leaving for the chart also drops any open details page, so coming back lands on
              // the list — the predictable place to return to, rather than wherever the last tap
              // happened to leave things.
              setMobileProfileTicker(null);
              sidePanelState.commitOpen(false);
            }}
            aria-current={sidePanelState.open ? undefined : "page"}
          >
            <CandleModeIcon size={18} />
            Graphique
          </button>
          <button
            type="button"
            className={["lq-chart-workspace__mobile-bottomnav-item", sidePanelState.open && "lq-chart-workspace__mobile-bottomnav-item--active"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              // With a symbol's details covering the list, "Listes" was a dead button: the panel
              // was already open, so `commitOpen(true)` changed nothing and the tap did nothing
              // visible. It means "take me back to the list" here, which is the details page's own
              // dismissal — same downward slide as the grab bar, not a cut.
              if (mobileProfileTicker !== null) profileDrag.requestClose();
              sidePanelState.commitOpen(true);
            }}
            aria-current={sidePanelState.open ? "page" : undefined}
          >
            {/* The panel is whatever `activeTab` last named, and a workspace given alerts but no
                watchlists has only one thing it can ever be — naming it "Listes" there would
                promise a page that doesn't exist. */}
            {hasWatchlists ? <WatchlistIcon size={18} /> : <BellIcon size={18} />}
            {hasWatchlists ? "Listes" : "Alertes"}
          </button>
        </div>
      )}

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
        groups={effectiveGroups}
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

      {scripting && (
        <ScriptEditorPanel
          // The active script's own target panel's own candles — `.props.data` reads it straight
          // off that panel's original JSX element the same way `resolvedSymbol` already reads
          // `.props.symbol` above, since (unlike a panel's own *indicator* state, genuinely
          // internal and never reported upward) a panel's own `data` is just the plain prop this
          // workspace itself was given for it in the first place. `undefined` before a target is
          // chosen — the notebook cell-output preview simply has nothing to draw against yet.
          previewData={
            (() => {
              const targetIndex = workspaceScripting.scripts.find((s) => s.id === workspaceScripting.activeScriptId)?.targetPanelIndex;
              return targetIndex !== undefined ? panelElements[targetIndex]?.props.data : undefined;
            })()
          }
          open={workspaceScripting.editorOpen}
          onClose={() => workspaceScripting.setEditorOpen(false)}
          scripts={workspaceScripting.scripts}
          activeScriptId={workspaceScripting.activeScriptId}
          setActiveScriptId={workspaceScripting.setActiveScriptId}
          addScript={workspaceScripting.addScript}
          updateScript={workspaceScripting.updateScript}
          removeScript={workspaceScripting.removeScript}
          setScriptParamValue={workspaceScripting.setScriptParamValue}
          resetScriptParamValues={workspaceScripting.resetScriptParamValues}
          toggleScriptEnabled={workspaceScripting.toggleScriptEnabled}
          runScript={workspaceScripting.runScript}
          stopScript={workspaceScripting.stopScript}
          runOutputs={workspaceScripting.runOutputs}
          panelChoices={scriptPanelChoices}
        />
      )}
    </div>
  );
}
