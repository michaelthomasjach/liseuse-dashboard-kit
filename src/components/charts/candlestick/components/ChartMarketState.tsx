import { useMemo, useState } from "react";
import { MarketStatePanel } from "./MarketStatePanel";
import { MarketStateBands } from "./MarketStateBands";
import { DetachedWindow } from "./DetachedWindow";
import { DEFAULT_MARKET_STATE_BAND_COLORS } from "../marketStateBandColors";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";

export interface ChartMarketStateProps {
  /** Whether the readout is showing. Owned by the chart rather than here, because it is reachable
   *  from two places outside this component — the tools rail and the plot's own context menu — and
   *  both need to read it to label their toggle. Everything *else* about the readout lives here. */
  open: boolean;
  onClose: () => void;
  candles: Candle[];
  /** The bar every reading describes — the hovered one, or the last revealed. */
  index: number;
  /** Every indicator the chart is drawing, hidden ones included: filtering them is this
   *  component's own job (see `visible` below). */
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  formatDate: (date: Date) => string;
  /** Where the shading may paint, in the plot's own coordinates, and how to place a bar in it.
   *  `null` when there is no price plot to paint on (a maximized sub-pane zeroes its height). */
  bands: { left: number; top: number; width: number; height: number; xForIndex: (index: number) => number } | null;
  /** The element the detached window copies its theme scope from — see `DetachedWindow`. */
  themeSource: HTMLElement | null;
}

/** The Market State readout, its optional shading of the price plot, and the browser window it can
 *  be torn off into.
 *
 *  One component rather than three fragments in `CandlestickChart`, because the three share state
 *  nothing else has any use for: whether the shading is on, what colour each zone is, and which
 *  window the panel currently lives in. Keeping that in the chart meant four `useState` calls and
 *  fifty lines of JSX sitting in a file that has no other business with any of it. */
export function ChartMarketState({
  open,
  onClose,
  candles,
  index,
  indicatorValues,
  formatDate,
  bands,
  themeSource,
}: ChartMarketStateProps) {
  // Off by default, and only reachable while the readout is open: the shading is that readout's
  // claim drawn large, and a chart tinted by something whose reasoning the user cannot see would
  // be the exact opposite of what this panel is for.
  const [bandsOn, setBandsOn] = useState(false);
  const [bandColors, setBandColors] = useState(DEFAULT_MARKET_STATE_BAND_COLORS);
  // Its own browser window. Opened inside the click, never from an effect — see `DetachedWindow`.
  const [detachedWindow, setDetachedWindow] = useState<Window | null>(null);

  // Hidden indicators are excluded: a score fed partly by something the reader cannot see would be
  // unexplainable by looking at the chart, which is the one thing this readout promises. Memoized
  // because every score is recomputed when this identity changes, and a fresh array per render
  // would mean recomputing on every mouse move.
  const visible = useMemo(() => indicatorValues.filter(({ indicator }) => !indicator.hidden), [indicatorValues]);

  if (!open) return null;

  const panel = (detached: boolean, close: () => void) => (
    <MarketStatePanel
      candles={candles}
      index={index}
      indicators={visible}
      onClose={close}
      formatDate={formatDate}
      detached={detached}
      // The switch works from the detached copy too — it drives shading on the chart that window
      // was torn off, which is exactly the arrangement that makes a second window worth opening:
      // the reasoning on one screen, the chart on the other.
      bandsOn={bandsOn}
      onBandsChange={setBandsOn}
      bandColors={bandColors}
      onBandColorsChange={setBandColors}
      onRequestDetach={
        detached
          ? undefined
          : () => {
              const child = window.open("", "", "width=460,height=900");
              if (child !== null) setDetachedWindow(child);
            }
      }
    />
  );

  return (
    <>
      {/* Behind the candles, and only while the readout that explains it is open. */}
      {bandsOn && bands !== null && (
        <MarketStateBands
          candles={candles}
          indicators={visible}
          xForIndex={bands.xForIndex}
          left={bands.left}
          top={bands.top}
          width={bands.width}
          height={bands.height}
          colors={bandColors}
        />
      )}
      {detachedWindow === null ? (
        panel(false, onClose)
      ) : (
        <DetachedWindow
          target={detachedWindow}
          title="État du marché"
          themeSource={themeSource}
          onClose={() => setDetachedWindow(null)}
          layout="page"
        >
          {panel(true, () => setDetachedWindow(null))}
        </DetachedWindow>
      )}
    </>
  );
}
