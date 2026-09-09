import type { ReactElement } from "react";
import type { CandlestickChartProps } from "../CandlestickChart";
import type { SymbolProfile } from "./SymbolProfile.interface";
import type { Candle } from "../candlestick/interfaces/Candle.interface";

export interface CurrentSymbolProfile {
  /** Which panel the docked profile is about. */
  panelIndex: number;
  symbol: string | undefined;
  profile: SymbolProfile | undefined;
  /** That panel's own candles — the mobile details page draws its sparkline from them. */
  data: Candle[] | undefined;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

/** "Which symbol is currently being studied", for the docked panel's own company-info section.
 *
 *  The focused panel if one is, else the first ("primary") one — matching how a single-chart,
 *  TradingView-style workspace already treats "the" chart when nothing is explicitly focused.
 *
 *  Price and change are derived from that panel's own OHLCV data (its last two candles) rather
 *  than carried on `SymbolProfile` itself: the chart's own header reads the very same candles, so
 *  the two can never show a different number for the same symbol. */
export function currentSymbolProfile(
  focusedPanelIndex: number | null,
  panelElements: ReactElement<CandlestickChartProps>[],
  resolvedSymbol: (panelIndex: number, child: ReactElement<CandlestickChartProps> | undefined) => string | undefined,
  profiles: SymbolProfile[] | undefined,
): CurrentSymbolProfile {
  const panelIndex = focusedPanelIndex ?? 0;
  const child = panelElements[panelIndex] as ReactElement<CandlestickChartProps> | undefined;
  const symbol = child ? resolvedSymbol(panelIndex, child) : undefined;

  const data = child?.props.data;
  const last = data && data.length > 0 ? data[data.length - 1] : undefined;
  const previous = data && data.length > 1 ? data[data.length - 2] : undefined;

  return {
    panelIndex,
    symbol,
    profile: profiles?.find((p) => p.ticker === symbol),
    data,
    price: last?.close ?? null,
    change: last && previous ? last.close - previous.close : null,
    changePercent: last && previous && previous.close !== 0 ? ((last.close - previous.close) / previous.close) * 100 : null,
  };
}
