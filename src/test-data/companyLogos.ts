/** Company marks for the demos, as self-contained `data:` URIs.
 *
 *  `HeatmapTile.logoUrl` (and the symbol-search results) take a URL, which in a real application is
 *  whatever the market-data provider serves. A demo cannot depend on the network — a Storybook
 *  build has to render identically offline, and the library inlines every asset it imports — so
 *  each mark here is generated: the ticker's initial on the company's own brand colour, drawn as a
 *  40x40 SVG and encoded inline. Swap `COMPANY_LOGOS` for real URLs and nothing else changes. */
export function monogramLogo(initial: string, background: string, foreground = "#ffffff"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">`
    + `<circle cx="20" cy="20" r="20" fill="${background}"/>`
    + `<text x="20" y="20" text-anchor="middle" dominant-baseline="central"`
    + ` font-family="Helvetica,Arial,sans-serif" font-size="20" font-weight="700" fill="${foreground}">`
    + `${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Brand colors, by ticker. Approximate on purpose: these are sample fixtures, not brand assets. */
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
  Object.entries(COMPANY_BRAND).map(([ticker, color]) => [ticker, monogramLogo(ticker[0], color)])
);
