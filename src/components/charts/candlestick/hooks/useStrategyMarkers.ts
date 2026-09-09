import { useMemo, useState } from "react";
import type { Candle } from "../interfaces/Candle.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";

export interface UseStrategyMarkersArgs {
  data: Candle[];
  /** Every drawing currently rendered, script-produced ones included — the fills are found in here
   *  rather than passed separately, since that is what they are (see `scriptOutputToDrawings`). */
  drawings: TrendLineDrawing[];
  hoverIndex: number | null;
  indexForDate: (date: Date) => number;
}

/** Pointing at a strategy's fills, in both directions.
 *
 *  One way: the chart's own markers answer to the crosshair, and can be pinned by clicking so they
 *  stay marked once the pointer leaves. The other: the tester panel reports which trades *it* is
 *  pointing at (a row in MAE/MFE, a bin in the distribution, a fill on the equity curve), and this
 *  turns them into rules on the bars they happened on.
 *
 *  Extracted from `CandlestickChart` because none of it touches anything else in that file: it
 *  reads the drawings and the hovered bar, and hands back what to draw. */
export function useStrategyMarkers({ data, drawings, hoverIndex, indexForDate }: UseStrategyMarkersArgs) {
  // The fill markers a running strategy has put on the chart. They are ordinary drawings, which is
  // what lets them be hovered and clicked here with no hit-testing of their own.
  const markers = useMemo(() => drawings.filter((d) => d.markerSide !== undefined), [drawings]);

  // Half the average bar spacing: what still counts as "the same column on screen". Averaged over
  // the whole series rather than taken from the last two bars, so one irregular gap (a holiday, a
  // half-session) does not set the tolerance for everything.
  const barToleranceMs = useMemo(() => {
    if (data.length < 2) return 0;
    return Math.abs(data[data.length - 1].date.getTime() - data[0].date.getTime()) / (data.length - 1) / 2;
  }, [data]);

  // A fill the user has clicked, which stays marked once the pointer moves away — the whole point
  // of clicking rather than hovering.
  //
  // Its own click test rather than the drawing selection machinery: script-produced drawings are
  // deliberately kept out of the interactive `visibleDrawings` so a signal regenerated on every run
  // can never be selected and dragged like a hand-drawn shape. That decision stands; this just
  // gives the markers a way to be *pointed at* without becoming editable.
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);

  // The fill under the pointer right now, by column rather than by hitting the pin icon: a 12px
  // icon should not have to be hit exactly, and the ask is about crossing the same vertical axis
  // as a fill.
  const hoveredTime = useMemo(() => {
    if (hoverIndex === null) return null;
    const bar = data[hoverIndex];
    if (bar === undefined) return null;
    const hit = markers.find((d) => Math.abs(d.x1.getTime() - bar.date.getTime()) <= barToleranceMs);
    return hit === undefined ? null : hit.x1.getTime();
  }, [markers, hoverIndex, data, barToleranceMs]);

  function handlePlotClick() {
    // Deliberately reuses what the hover pass already resolved instead of re-deriving a bar from
    // the click's own coordinates: the pointer is on that column by definition, and two independent
    // derivations are two chances to disagree about which fill is being pointed at. Clicking the
    // same fill again releases it, and clicking a column with no fill releases too, so there is
    // always an obvious way to let go.
    setPinnedTime((current) => (hoveredTime !== null && current === hoveredTime ? null : hoveredTime));
  }

  // Trades the tester is pointing at, travelling the other way.
  const [panelHoveredTrades, setPanelHoveredTrades] = useState<StrategyTrade[] | null>(null);
  const externalFills = useMemo(() => {
    if (panelHoveredTrades === null || panelHoveredTrades.length === 0) return [];
    // A single trade gets its two fills named; a whole histogram bin gets rules only, since a dozen
    // overlapping badges would say less than the rules already do.
    const named = panelHoveredTrades.length === 1;
    return panelHoveredTrades.flatMap((t) => {
      const entryUp = t.direction === "long";
      return [
        {
          key: `${t.id}-entry`,
          index: indexForDate(new Date(t.entryTime)),
          direction: (entryUp ? "up" : "down") as "up" | "down",
          label: named ? `${entryUp ? "Achat" : "Vente"} ${t.entryPrice.toFixed(2)}` : undefined,
        },
        {
          key: `${t.id}-exit`,
          index: indexForDate(new Date(t.exitTime)),
          direction: (entryUp ? "down" : "up") as "up" | "down",
          label: named ? `Sortie ${t.exitPrice.toFixed(2)}` : undefined,
        },
      ];
    });
  }, [panelHoveredTrades, indexForDate]);

  return {
    barToleranceMs,
    handlePlotClick,
    /** A pinned fill wins over the pointer, which is the whole point of clicking rather than
     *  hovering. */
    markedTime: pinnedTime ?? hoveredTime,
    externalFills,
    setPanelHoveredTrades,
  };
}
