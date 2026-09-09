import { useMemo } from "react";
import { computeMarketStateBands } from "../marketStateBands";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import "./MarketStateBands.css";

export interface MarketStateBandsProps {
  candles: Candle[];
  indicators: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  /** The visible bar range, as the chart's own x scale sees it. */
  from: number;
  to: number;
  /** Maps a bar index to a pixel x inside the plot. */
  xForIndex: (index: number) => number;
  /** The price plot's own box, so the shading stops at the volume pane rather than running the
   *  whole height of the chart. */
  left: number;
  top: number;
  height: number;
  width: number;
}

/** Shades the price plot by what the Market State reads across it: green where the blend comes out
 *  long, red where it comes out short, nothing where it is neutral.
 *
 *  Neutral is drawn as *nothing at all*, not as a third tint. Three shades across a chart is a
 *  chart with a coloured background; two, with the majority of it usually plain, is a chart with
 *  something marked on it. And it matches what the reading means — neutral is the absence of a
 *  claim, so the absence of a mark is the honest way to draw it.
 *
 *  Behind everything, and inert: `pointer-events: none` and a very low opacity, because this is
 *  context for the candles, never a thing to read on its own. */
export function MarketStateBands({ candles, indicators, from, to, xForIndex, left, top, height, width }: MarketStateBandsProps) {
  const bands = useMemo(
    () => computeMarketStateBands({ candles, indicators }, from, to),
    [candles, indicators, from, to],
  );

  return (
    <div className="lq-market-bands" style={{ left, top, width, height }} aria-hidden="true">
      {bands
        .filter((band) => band.direction !== "neutral")
        .map((band) => {
          // Half a bar out on each side, so a band covers its bars rather than the gaps between
          // their centres — otherwise every run stops visibly short of the candle it describes.
          const x1 = xForIndex(band.from - 0.5) - left;
          const x2 = xForIndex(band.to + 0.5) - left;
          return (
            <span
              key={`${band.direction}-${band.from}`}
              className={`lq-market-bands__band lq-market-bands__band--${band.direction}`}
              style={{ left: Math.min(x1, x2), width: Math.max(1, Math.abs(x2 - x1)) }}
            />
          );
        })}
    </div>
  );
}
