import { useMemo } from "react";
import { computeMarketStateBands } from "../marketStateBands";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { MarketStateBandColors } from "../marketStateBandColors";
import { DEFAULT_MARKET_STATE_SETTINGS, type MarketStateSettings } from "../marketStateSettings";
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
  /** The same settings the panel reads, so the shading and the readout are one claim rather than
   *  two. `bandSmoothing` is read from here too. */
  settings?: MarketStateSettings;
}

/** Shades the price plot by what the Market State reads across it — one colour per direction,
 *  long, neutral and short, all three drawn.
 *
 *  Behind everything and inert (`pointer-events: none`): this is context for the candles, never a
 *  thing to read on its own, which is also why the defaults are as pale as they are (see
 *  `DEFAULT_MARKET_STATE_BAND_COLORS`). A band that competes with the candles has stopped being a
 *  background. */
export function MarketStateBands({
  candles,
  indicators,
  xForIndex,
  left,
  top,
  height,
  width,
  colors,
  settings = DEFAULT_MARKET_STATE_SETTINGS,
}: MarketStateBandsProps) {
  // Keyed on the data alone — not on the visible range, which the bands do not depend on (see
  // `computeMarketStateBands`). That is what keeps a pan free: the bands are computed once and the
  // container simply clips whichever ones fall outside it.
  const bands = useMemo(
    () => computeMarketStateBands({ candles, indicators, settings }, settings.bandSmoothing),
    [candles, indicators, settings],
  );

  return (
    <div className="lq-market-bands" style={{ left, top, width, height }} aria-hidden="true">
      {bands.map((band) => {
          // `xForIndex(i)` is bar `i`'s own left edge — the candles are drawn at `i + 0.5`, their
          // centre — so the run covering bars [from, to] spans from that bar's left edge to the
          // *next* bar's, which is `to + 1`. Half-bar offsets were being applied on both sides,
          // which put every band half a bar left of the candles it describes.
          //
          // And no `- left`: these coordinates are already relative to the plot, which is exactly
          // where this container starts. Subtracting the margin a second time shifted every band
          // left by the whole gutter — so the shading ran past the first candle by that much and
          // stopped short of the last one by the same, which is the symptom that found this.
          const x1 = xForIndex(band.from);
          const x2 = xForIndex(band.to + 1);
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
