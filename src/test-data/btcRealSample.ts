import raw from "./btc-real-sample.json";
import type { Candle } from "../components/charts/candlestick/interfaces/Candle.interface";

type RawRow = [number, number, number, number, number, number];

/** Real BTC/USDT 15-minute OHLCV candles (Binance historical klines, May 2026), unlike every other
 *  dataset in this folder which is synthetically generated — kept as a small `?`-free JSON import
 *  (`[openTimeMs, open, high, low, close, volume]` tuples, `btc-real-sample.json`) rather than an
 *  array of `Candle` object literals so the checked-in data file itself stays compact. Exists to
 *  check a script's output (originally "Niveaux de support/résistance (KDE gaussienne)") against
 *  real market structure instead of generated noise — see `CandlestickChart.stories.tsx`'s own
 *  `BtcRealSample` story, which pairs this with the same `KDE_DEBUG_SCRIPT`/`defaultScripts` wiring
 *  the "Toutes les options" story already uses. */
export const BTC_REAL_SAMPLE: Candle[] = (raw as RawRow[]).map(([t, open, high, low, close, volume]) => ({
  date: new Date(t),
  open,
  high,
  low,
  close,
  volume,
}));
