import { useMemo } from "react";
import { computeMarketStateBands } from "../marketStateBands";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { MarketStateBandColors } from "../marketStateBandColors";
import "./MarketStateBands.css";

export interface MarketStateBandsProps {
  candles: Candle[];
  indicators: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  /** Maps a bar index to a pixel x inside the plot. */
  xForIndex: (index: number) => number;
  /** The price plot's own box, so the shading stops at the volume pane rather than running the
   *  whole height of the chart. */
  left: number;
  top: number;
  height: number;
  width: number;
  /** One colour per direction, edited from the readout (see `marketStateBandColors.ts`). */
  colors: MarketStateBandColors;
}

/** Shades the price plot by what the Market State reads across it — one colour per direction,
 *  long, neutral and short, all three drawn.
 *
 *  Behind everything and inert (`pointer-events: none`): this is context for the candles, never a
 *  thing to read on its own, which is also why the defaults are as pale as they are (see
 *  `DEFAULT_MARKET_STATE_BAND_COLORS`). A band that competes with the candles has stopped being a
 *  background. */
export function MarketStateBands({ candles, indicators, xForIndex, left, top, height, width, colors }: MarketStateBandsProps) {
  // Keyed on the data alone — not on the visible range, which the bands do not depend on (see
  // `computeMarketStateBands`). That is what keeps a pan free: the bands are computed once and the
  // container simply clips whichever ones fall outside it.
  const bands = useMemo(() => computeMarketStateBands({ candles, indicators }), [candles, indicators]);

  return (
    <div className="lq-market-bands" style={{ left, top, width, height }} aria-hidden="true">
      {bands.map((band) => {
          // Half a bar out on each side, so a band covers its bars rather than the gaps between
          // their centres — otherwise every run stops visibly short of the candle it describes.
          const x1 = xForIndex(band.from - 0.5) - left;
          const x2 = xForIndex(band.to + 0.5) - left;
          return (
            <span
              key={`${band.direction}-${band.from}`}
              className="lq-market-bands__band"
              style={{ left: Math.min(x1, x2), width: Math.max(1, Math.abs(x2 - x1)), backgroundColor: colors[band.direction] }}
            />
          );
        })}
    </div>
  );
}
