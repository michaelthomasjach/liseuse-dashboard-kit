/** Company logos for the demos: a real URL per ticker, which is what `HeatmapTile.logoUrl` and the
 *  symbol-search results take.
 *
 *  In an application this URL comes from the market-data provider along with the quote. The demos
 *  use a public one keyed by ticker so the fixtures stay one line each and read the way a caller's
 *  own data would. It is a third-party host, so it can be slow, blocked, or return 404 for a
 *  ticker it does not know — `Heatmap` falls back to a disc in `logoColor` whenever an image fails
 *  to load, which is also what makes the offline Storybook build still look deliberate. */
export function companyLogoUrl(ticker: string): string {
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(ticker)}.png`;
}

/** Brand colors, by ticker, used for the fallback disc. Approximate on purpose: these are sample
 *  fixtures, not brand assets. */
export const COMPANY_BRAND: Record<string, string> = {
  AAPL: "#4b4b4d",
  MSFT: "#0078d4",
  NVDA: "#76b900",
  GOOGL: "#1a73e8",
  META: "#0866ff",
  ORCL: "#c74634",
  ADBE: "#eb1000",
  CRM: "#00a1e0",
  AVGO: "#cc092f",
  JPM: "#5c4033",
  "BRK.B": "#1c3f6e",
  V: "#1a1f71",
  MA: "#eb001b",
  BAC: "#012169",
  WFC: "#d71e28",
  GS: "#7399c6",
  LLY: "#d52b1e",
  UNH: "#0056b8",
  JNJ: "#d51900",
  MRK: "#00857c",
  ABBV: "#061d49",
  XOM: "#d52b1e",
  CVX: "#0054a4",
  WTI: "#8a6d3b",
  AMZN: "#ff9900",
  TSLA: "#cc0000",
  WMT: "#0071ce",
  HD: "#f96302",
  MCD: "#da291c",
  NKE: "#111111",
};

export const COMPANY_LOGOS: Record<string, string> = Object.fromEntries(
  Object.keys(COMPANY_BRAND).map((ticker) => [ticker, companyLogoUrl(ticker)])
);
