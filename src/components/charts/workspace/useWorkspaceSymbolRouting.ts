import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import type { CandlestickChartProps } from "../CandlestickChart";
import type { ChartWorkspaceWatchlistRow } from "./ChartWorkspaceWatchlist.interface";

export interface UseWorkspaceSymbolRoutingArgs {
  panels: number;
  /** On a phone a row tap opens that symbol's details page instead of asking which window. */
  isMobileWorkspace: boolean;
  /** Opens the mobile details page over the list. */
  showMobileProfile: (ticker: string) => void;
  /** Clears the panel highlights the target modal drives. */
  clearPanelHighlights: () => void;
  onWatchlistRowClick?: (row: ChartWorkspaceWatchlistRow, watchlistId: string) => void;
}

/** Which symbol each panel is showing, and where a watchlist row click ends up.
 *
 *  The two are one concern: a panel's symbol is the template child's until something targets that
 *  panel individually, and from then on that panel's own entry takes over for good — the same fork
 *  `timeframeByPanel` makes, just triggered by a row click or a panel's own symbol search instead
 *  of a timeframe picker. */
export function useWorkspaceSymbolRouting({
  panels,
  isMobileWorkspace,
  showMobileProfile,
  clearPanelHighlights,
  onWatchlistRowClick,
}: UseWorkspaceSymbolRoutingArgs) {
  const [symbolByPanel, setSymbolByPanel] = useState<Record<number, string | undefined>>({});
  // The watchlist row awaiting a "which window(s)" answer from SymbolTargetModal — non-null is
  // what actually keeps that modal open (see its own `open` prop), not a separate boolean, so
  // there's never a stale row hanging around once the modal's done with it.
  const [pendingRow, setPendingRow] = useState<{ row: ChartWorkspaceWatchlistRow; watchlistId: string } | null>(null);

  /** The current value each panel's own `symbol` should resolve to — its own fork once one exists
   *  (a prior watchlist target pick or native symbol search), else whatever the template child
   *  itself was given. Shared by the grid's own cloneElement and both modals' `panelSymbols`
   *  labels, so neither can drift out of sync with what's actually on screen.
   *
   *  `child` is `undefined` whenever `panelIndex` is beyond the panel elements' own actual length
   *  — reachable from `scriptPanelChoices`, which (unlike the grid's own render loop, which only
   *  ever maps over the real entries) always builds one candidate per `panels` regardless of how
   *  many explicit `<CandlestickChart>` children were supplied. Multiple fewer-than-`panels`
   *  children is documented as valid (the remaining grid cells just render empty) — bumping the
   *  split-screen panel count past the number of explicit children (always reachable, no gate on
   *  it) used to crash the whole workspace here instead. */
  const resolvedSymbol = useCallback(
    (panelIndex: number, child: ReactElement<CandlestickChartProps> | undefined): string | undefined =>
      panelIndex in symbolByPanel ? symbolByPanel[panelIndex] : child?.props.symbol,
    [symbolByPanel],
  );

  /** Assigns a symbol to specific panels — the path a panel's own symbol search takes. */
  const setPanelSymbol = useCallback((panelIndex: number, ticker: string) => {
    setSymbolByPanel((prev) => ({ ...prev, [panelIndex]: ticker }));
  }, []);

  /** Routes a watchlist row click: with only one panel there's no ambiguity, so it's applied right
   *  away (same immediate feel clicking a result in a panel's own symbol search already has); with
   *  several, "which window" isn't decidable here, so SymbolTargetModal asks instead and
   *  `confirmTarget` does the actual applying once the user answers. */
  const handleRowClick = useCallback(
    (row: ChartWorkspaceWatchlistRow, watchlistId: string) => {
      // Mobile: the tap opens that symbol's own details page over the list. SymbolTargetModal is
      // skipped on the way, whatever `panels` says — "which of the windows" is a desktop question,
      // and a modal landing on top of the page that just opened would be two answers to one tap.
      // The ticker still goes to the primary panel, so switching to the Graphique page afterwards
      // shows what was tapped rather than the previous symbol.
      if (isMobileWorkspace) {
        showMobileProfile(row.ticker);
        setPanelSymbol(0, row.ticker);
        onWatchlistRowClick?.(row, watchlistId);
        return;
      }
      if (panels >= 2) {
        setPendingRow({ row, watchlistId });
        return;
      }
      setPanelSymbol(0, row.ticker);
      onWatchlistRowClick?.(row, watchlistId);
    },
    [isMobileWorkspace, panels, showMobileProfile, setPanelSymbol, onWatchlistRowClick],
  );

  const closeTargetModal = useCallback(() => {
    setPendingRow(null);
    clearPanelHighlights();
  }, [clearPanelHighlights]);

  const confirmTarget = useCallback(
    (panelIndices: number[]) => {
      if (!pendingRow) return;
      const { row, watchlistId } = pendingRow;
      setSymbolByPanel((prev) => {
        const next = { ...prev };
        for (const i of panelIndices) next[i] = row.ticker;
        return next;
      });
      onWatchlistRowClick?.(row, watchlistId);
      closeTargetModal();
    },
    [pendingRow, onWatchlistRowClick, closeTargetModal],
  );

  return { resolvedSymbol, setPanelSymbol, pendingRow, handleRowClick, confirmTarget, closeTargetModal };
}
