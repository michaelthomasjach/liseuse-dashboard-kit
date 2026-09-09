import { useEffect, useRef, useState } from "react";
import { useDragToDismiss } from "./useDragToDismiss";
import type { ChartWorkspaceWatchlist } from "./ChartWorkspaceWatchlist.interface";

export type ChartWorkspaceSidePanelTab = "watchlist" | "alerts";

export interface UseWorkspaceSidePanelStateArgs {
  watchlists?: ChartWorkspaceWatchlist[];
  hasWatchlists: boolean;
  defaultSidePanelTab?: ChartWorkspaceSidePanelTab;
  defaultActiveWatchlistId?: string;
  defaultVisibleColumnIds?: string[];
  isMobileWorkspace: boolean;
  /** 0 until the viewport has been measured once. */
  viewportWidth: number;
  mobileBreakpoint: number;
  /** The docked panel's own open state — this hook drives it, it does not own it. */
  panel: { open: boolean; commitOpen: (open: boolean) => void };
  onSidePanelTabChange?: (tab: ChartWorkspaceSidePanelTab) => void;
  onActiveWatchlistChange?: (id: string) => void;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

/** Everything about *what the docked panel is currently showing*: which tab, which list, which
 *  columns, and — on mobile — whether a symbol's details page is covering the list.
 *
 *  One hook because these four move together. Every switch among them drops the mobile details
 *  page, because that page belongs to one row of one list: left up over a different tab or a
 *  different list, it would be a page about a symbol nothing else on screen is still about. Held
 *  apart in four places, that rule was four separate lines that each had to be remembered. */
export function useWorkspaceSidePanelState({
  watchlists,
  hasWatchlists,
  defaultSidePanelTab,
  defaultActiveWatchlistId,
  defaultVisibleColumnIds,
  isMobileWorkspace,
  viewportWidth,
  mobileBreakpoint,
  panel,
  onSidePanelTabChange,
  onActiveWatchlistChange,
  onVisibleColumnsChange,
}: UseWorkspaceSidePanelStateArgs) {
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
    if (viewportWidth < mobileBreakpoint) panel.commitOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth]);

  const [activeTab, setActiveTab] = useState<ChartWorkspaceSidePanelTab>(defaultSidePanelTab ?? (hasWatchlists ? "watchlist" : "alerts"));
  const [activeWatchlistId, setActiveWatchlistId] = useState(defaultActiveWatchlistId ?? watchlists?.[0]?.id);
  // Bumped by the mobile topbar's own "+" to open WatchlistPanel's add-symbol modal — that panel
  // drops its whole header row (and with it its own "+") on this layout, see its `mobile` prop.
  // A counter, not a boolean: the modal's open state stays down in the panel, which closes it
  // itself without needing to write anything back up here.
  const [addSymbolRequestId, setAddSymbolRequestId] = useState(0);
  // Mobile only: which symbol's own details page is covering the list, or null for the list
  // itself. The ticker rather than a boolean, because the page has to name the row that was
  // actually tapped even before the panel behind it has caught up to that symbol. Deliberately
  // not derived from the per-panel symbols: those say which symbol a *chart* is showing, which
  // stays true long after the user has come back to the list.
  const [mobileProfileTicker, setMobileProfileTicker] = useState<string | null>(null);
  // The details page's own presentation — the slide up, the drag down, the slide out. Declared
  // here rather than next to where it renders, because that page is built inside an IIFE in the
  // JSX, which is no place for a hook: it renders conditionally, and a hook that comes and goes
  // with a condition is exactly what the rules of hooks forbid.
  const profileDrag = useDragToDismiss({ open: mobileProfileTicker !== null, onDismiss: () => setMobileProfileTicker(null) });
  // Every column, across every list, visible by default — same "start showing everything, let the
  // user narrow it down" reasoning `excludedYears` avoids for SeasonalityView's own years filter,
  // just inverted (a whitelist here reads as the more natural default for "which columns" than an
  // exclusion list would).
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(
    new Set(defaultVisibleColumnIds ?? watchlists?.flatMap((w) => w.columns.map((c) => c.id)) ?? []),
  );

  /** Clicking whichever tab is already open collapses the panel (same "click the active one again
   *  to close" convention CandlestickChart's own header toggle uses); clicking the *other* tab
   *  switches to it instead, opening the panel first if it was collapsed — same shape a VSCode-
   *  style activity-bar rail already gives, one docked panel with several switchable tabs rather
   *  than each tab being its own independently-open panel. */
  function toggleTab(tab: ChartWorkspaceSidePanelTab) {
    // Not on the mobile layout: there the bottom nav is what opens and closes the panel, and these
    // buttons only ever live *inside* it (see the topbar's own render condition). Collapsing from
    // here would drop the user onto the chart page as a side effect of tapping the tab they were
    // already on, which is not what a tab does.
    if (!isMobileWorkspace && panel.open && activeTab === tab) {
      panel.commitOpen(false);
      return;
    }
    setMobileProfileTicker(null);
    setActiveTab(tab);
    onSidePanelTabChange?.(tab);
    if (!panel.open) panel.commitOpen(true);
  }

  function selectWatchlist(id: string) {
    setActiveWatchlistId(id);
    onActiveWatchlistChange?.(id);
  }

  /** The mobile topbar's own per-list buttons — same "click the active one again to close"
   *  convention as `toggleTab`, just keyed on *which list* is both open and active instead of only
   *  the tab, since every list gets its own button here rather than one shared icon plus an
   *  in-panel dropdown to pick among them (WatchlistPanel's own trigger). */
  function selectWatchlistTab(id: string) {
    // Same carve-out as toggleTab, for the same reason — and it bites harder here, since these
    // buttons only exist on the mobile layout at all.
    if (!isMobileWorkspace && panel.open && activeTab === "watchlist" && activeWatchlistId === id) {
      panel.commitOpen(false);
      return;
    }
    setMobileProfileTicker(null);
    selectWatchlist(id);
    setActiveTab("watchlist");
    onSidePanelTabChange?.("watchlist");
    if (!panel.open) panel.commitOpen(true);
  }

  function changeVisibleColumns(ids: Set<string>) {
    setVisibleColumnIds(ids);
    onVisibleColumnsChange?.(Array.from(ids));
  }

  return {
    activeTab,
    setActiveTab,
    activeWatchlistId,
    selectWatchlist,
    selectWatchlistTab,
    toggleTab,
    addSymbolRequestId,
    requestAddSymbol: () => setAddSymbolRequestId((n) => n + 1),
    mobileProfileTicker,
    setMobileProfileTicker,
    profileDrag,
    visibleColumnIds,
    changeVisibleColumns,
  };
}
