import { useCallback, useState } from "react";

export interface UsePanelCrosshairSyncArgs {
  /** Link groups already clamped to the live panel count, each a list of panel indices. */
  groups: number[][];
  /** Which group a panel belongs to, or null when it is in none. */
  groupIndexOfPanel: (panelIndex: number) => number | null;
}

/** What each panel in a link group shows of the others' crosshair.
 *
 *  Kept per panel index rather than as one "currently hovered panel": a panel outside every group
 *  still needs its own entry cleared correctly when the mouse leaves it, regardless of what any
 *  other panel is doing. A date and a price rather than pixels — the panels do not share a scale,
 *  so what travels between them has to be a value each can place on its own axes (see
 *  CandlestickChartProps.syncedHoverDate / syncedHoverPrice). */
export function usePanelCrosshairSync({ groups, groupIndexOfPanel }: UsePanelCrosshairSyncArgs) {
  const [hoverByPanel, setHoverByPanel] = useState<Record<number, Date | null>>({});
  const [priceByPanel, setPriceByPanel] = useState<Record<number, number | null>>({});

  const reportHoverDate = useCallback((panelIndex: number, date: Date | null) => {
    setHoverByPanel((prev) => {
      const current = prev[panelIndex] ?? null;
      // Bails out on an unchanged value rather than always spreading a fresh object — `date` is a
      // freshly-constructed Date every call (see useHoverSync's own dateForIndex), so `===` alone
      // would never short-circuit even when nothing meaningful changed, defeating the point.
      if (current === date || (current !== null && date !== null && current.getTime() === date.getTime())) return prev;
      return { ...prev, [panelIndex]: date };
    });
  }, []);

  const reportHoverPrice = useCallback((panelIndex: number, price: number | null) => {
    setPriceByPanel((prev) => (prev[panelIndex] === price ? prev : { ...prev, [panelIndex]: price }));
  }, []);

  /** The synced date a given panel should render its own crosshair at: whichever *other* panel in
   *  its own group most recently reported a real hover, or null if none currently has one (nobody
   *  in the group is hovering right now, or this panel isn't in a group at all). */
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

  /** Horizontal-axis counterpart to `syncedDateForPanel`. */
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

  return { reportHoverDate, reportHoverPrice, syncedDateForPanel, syncedPriceForPanel };
}
