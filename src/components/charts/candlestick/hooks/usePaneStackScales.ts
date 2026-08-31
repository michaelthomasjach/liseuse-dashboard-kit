import { useMemo } from "react";
import * as d3 from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { IndicatorMACD } from "../interfaces/IndicatorMACD.interface";
import type { IndicatorBand } from "../interfaces/IndicatorBand.interface";

export interface UsePaneStackScalesArgs {
  ownPaneIndicators: Indicator[];
  indicatorPaneHeights: number[];
  visibleIndicators: { indicator: Indicator; points: { i: number; value: IndicatorValue }[] }[];
  paneYTransform: Record<string, d3.ZoomTransform>;
}

/** One pane *stack*'s own Y-scale per "own"-pane indicator in it — extracted out of
 *  `useIndicatorPaneScales` (which still calls this once, for the bottom stack — see its own doc)
 *  so a `plot.pane(name, { dock: "left"|"right" })` script pane's own column can get the exact
 *  same scale logic for its own (much smaller) subset of indicators, called directly a fixed two
 *  more times in `CandlestickChart.tsx`, without redoing `computeIndicatorValues` for every
 *  indicator a second and third time — that expensive, dock-independent pass stays computed
 *  exactly once, in `useIndicatorPaneScales`, and its result (`visibleIndicators`, covering every
 *  indicator regardless of which stack it ends up in) is simply passed into each of these three
 *  calls instead. See `useIndicatorPaneScales.ts`'s own doc on `ownPaneScales` for what "auto-fit"
 *  means per indicator kind — unchanged here, just parametrized by which stack's own indicators/
 *  heights/transform to run it over. */
export function usePaneStackScales({ ownPaneIndicators, indicatorPaneHeights, visibleIndicators, paneYTransform }: UsePaneStackScalesArgs) {
  const ownPaneScales = useMemo(() => {
    const scales: Record<string, d3.ScaleLinear<number, number>> = {};
    ownPaneIndicators.forEach((ind, idx) => {
      const height = indicatorPaneHeights[idx];
      if (ind.kind === "rsi" || ind.kind === "chop" || ind.kind === "adx") {
        scales[ind.id] = d3.scaleLinear().domain([0, 100]).range([height, 0]);
      } else if (ind.kind === "correlation") {
        scales[ind.id] = d3.scaleLinear().domain([-1, 1]).range([height, 0]);
      } else if (ind.kind === "macd") {
        const points = (visibleIndicators.find((v) => v.indicator.id === ind.id)?.points ?? []) as { i: number; value: IndicatorMACD }[];
        let lo = 0;
        let hi = 0;
        for (const p of points) {
          lo = Math.min(lo, p.value.macd, p.value.signal ?? p.value.macd, p.value.histogram ?? 0);
          hi = Math.max(hi, p.value.macd, p.value.signal ?? p.value.macd, p.value.histogram ?? 0);
        }
        const pad = (hi - lo) * 0.1 || 1;
        scales[ind.id] = d3.scaleLinear().domain([lo - pad, hi + pad]).range([height, 0]);
      } else if (ind.customData?.draw === "multi") {
        const points = (visibleIndicators.find((v) => v.indicator.id === ind.id)?.points ?? []) as {
          i: number;
          value: { multi: Record<string, number | IndicatorBand | null> };
        }[];
        let lo = 0;
        let hi = 0;
        for (const p of points) {
          for (const sub of Object.values(p.value.multi)) {
            if (sub === null) continue;
            if (typeof sub === "number") {
              lo = Math.min(lo, sub);
              hi = Math.max(hi, sub);
            } else {
              lo = Math.min(lo, sub.upper, sub.lower);
              hi = Math.max(hi, sub.upper, sub.lower);
            }
          }
        }
        const pad = (hi - lo) * 0.1 || 1;
        scales[ind.id] = d3.scaleLinear().domain([lo - pad, hi + pad]).range([height, 0]);
      } else {
        const points = (visibleIndicators.find((v) => v.indicator.id === ind.id)?.points ?? []) as { i: number; value: number }[];
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of points) {
          lo = Math.min(lo, p.value);
          hi = Math.max(hi, p.value);
        }
        if (!isFinite(lo) || !isFinite(hi)) {
          lo = 0;
          hi = 1;
        }
        const pad = (hi - lo) * 0.1 || 1;
        scales[ind.id] = d3.scaleLinear().domain([lo - pad, hi + pad]).range([height, 0]);
      }
    });
    return scales;
  }, [ownPaneIndicators, indicatorPaneHeights, visibleIndicators]);

  const zoomedOwnPaneScales = useMemo(() => {
    const scales: Record<string, d3.ScaleLinear<number, number>> = {};
    ownPaneIndicators.forEach((ind) => {
      const base = ownPaneScales[ind.id];
      if (base) scales[ind.id] = (paneYTransform[ind.id] ?? d3.zoomIdentity).rescaleY(base);
    });
    return scales;
  }, [ownPaneIndicators, ownPaneScales, paneYTransform]);

  return { ownPaneScales, zoomedOwnPaneScales };
}
