import type { ScaleLinear } from "d3";
import type { ResolvedScriptLabel } from "../scripting/interfaces/ScriptRunOutput.interface";
import type { Indicator } from "../interfaces/Indicator.interface";

export interface ScriptLabelOverlayProps {
  labels: ResolvedScriptLabel[];
  dims: { margin: { top: number; left: number }; boundedWidth: number };
  priceHeight: number;
  ownPaneIndicators: Indicator[];
  indicatorPaneTops: number[];
  indicatorPaneHeights: number[];
  /** Bar index -> x, for a label anchored to the data (`unit: "bar"`). The zoomed scale, so an
   *  anchored label pans and zooms with the candle it marks. */
  zoomedXScale: ScaleLinear<number, number>;
  /** Price -> y within the price section, for an anchored label on an `overlay` pane. */
  zoomedPriceScale: ScaleLinear<number, number>;
  /** Value -> y within its own sub-pane, by indicator id, for an anchored label on an "own" pane. */
  zoomedOwnPaneScales: Record<string, ScaleLinear<number, number>>;
}

/** Renders every active script's own `pane.label(...)`/`overlay.label(...)` output (see
 *  `PlotApi.label`'s own doc) as a small floating `<div>` positioned within its own target pane —
 *  a plain DOM overlay, not canvas, same reasoning `ScriptTableOverlay.tsx` gives (real text
 *  layout, and CSS `transform: rotate(...)` needs no canvas rotation math of its own).
 *
 *  Unlike `ScriptTableOverlay` (deliberately `dims`-margin-free, always anchored to one of 4 fixed
 *  chart corners), a label's own `x`/`y` are relative to *its own pane's* box, not the whole
 *  chart — `overlay`'s box is always `{top: 0, height: priceHeight}` (the price pane), `pane`'s is
 *  whichever "own" pane `label.paneId` resolves to in `ownPaneIndicators` (the same
 *  `scriptPaneIndicatorId` id `scriptIndicatorToChartIndicator.ts` already reuses as that
 *  indicator's own `Indicator.id` — see `useScriptEngine.ts`'s own `applyRunOutput` for where this
 *  gets resolved). A label whose own pane isn't found (removed, or a name typo) simply doesn't
 *  render — silent, like an indicator with a missing id elsewhere in this engine, not a crash. */
export function ScriptLabelOverlay({
  labels,
  dims,
  priceHeight,
  ownPaneIndicators,
  indicatorPaneTops,
  indicatorPaneHeights,
  zoomedXScale,
  zoomedPriceScale,
  zoomedOwnPaneScales,
}: ScriptLabelOverlayProps) {
  if (labels.length === 0) return null;
  return (
    <>
      {labels.map((label, i) => {
        let paneTop: number;
        let paneHeight: number;
        if (label.paneType === "overlay") {
          paneTop = 0;
          paneHeight = priceHeight;
        } else {
          const idx = ownPaneIndicators.findIndex((ind) => ind.id === label.paneId);
          if (idx === -1) return null;
          paneTop = indicatorPaneTops[idx];
          paneHeight = indicatorPaneHeights[idx];
        }
        let x: number;
        let y: number;
        if (label.unit === "bar") {
          // Anchored to the data: x is a bar index, y a price on this pane's own scale. `+ 0.5`
          // centres it on the candle rather than on the boundary between two, matching every other
          // per-bar drawing in this chart.
          const valueScale = label.paneType === "overlay" ? zoomedPriceScale : zoomedOwnPaneScales[label.paneId ?? ""];
          if (!valueScale) return null;
          x = zoomedXScale(label.x + 0.5);
          // `paneTop` is added by the wrapper below, and an own-pane scale already returns a y
          // relative to its own pane — so only the overlay's own price scale, which is relative to
          // the price section (paneTop 0), needs nothing subtracted here.
          y = valueScale(label.y);
          // A label scrolled outside the visible bars would otherwise pile up against the plot's
          // edge; dropping it is how every other data-anchored element here behaves.
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > dims.boundedWidth) return null;
        } else {
          x = label.unit === "px" ? label.x : (label.x / 100) * dims.boundedWidth;
          y = label.unit === "px" ? label.y : (label.y / 100) * paneHeight;
        }
        const align = label.align ?? "left";
        return (
          <div
            key={i}
            className="lq-chart__script-label"
            style={{
              left: dims.margin.left + x,
              top: dims.margin.top + paneTop + y,
              transform: `translate(${align === "left" ? "0" : align === "center" ? "-50%" : "-100%"}, -50%) rotate(${label.rotation}deg)`,
              color: label.color,
              fontSize: label.fontSize,
            }}
          >
            {label.text}
          </div>
        );
      })}
    </>
  );
}
